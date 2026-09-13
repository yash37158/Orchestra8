package main

// The ingest gateway: the one door telemetry comes through.
//
// Before this existed, a collector declared which organisation it belonged to
// in a resource attribute and the pipeline believed it. Anyone who could reach
// the OTLP port could write into any tenant's data by editing one line of
// YAML. Now the token decides who you are, and the payload only gets to agree
// with it.
//
// The gateway does not write to ClickHouse. It authenticates, checks the
// claim, and hands the bytes to the collector, which owns the storage layout.
// Re-implementing the ClickHouse exporter to save one hop would be trading a
// process boundary for a schema we would have to keep in sync forever.

import (
	"bytes"
	"compress/gzip"
	"context"
	"errors"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

// An OTLP batch is bounded by the collector's send_batch_size, so anything
// this large is not a real batch. Reading it into memory first is what makes
// the check possible at all, which is why the ceiling is explicit.
const maxIngestBytes = 16 << 20

type gateway struct {
	// A func rather than the *control itself, so the authorisation branches
	// below can be tested without a Postgres. Cheaper than an interface with
	// one implementation, and it keeps the dependency pointed the right way.
	lookup   func(context.Context, string) (tokenIdentity, error)
	upstream string // the collector's OTLP/HTTP receiver
	// Shared secret for that hop. The collector refuses writes without it, so
	// holding it is what makes this gateway the only way in — a network
	// binding is not enough when something else can route to the port.
	upstreamSecret string
	http           *http.Client
}

func newGateway(ctrl *control, upstream, secretFile string) *gateway {
	g := &gateway{lookup: ctrl.lookupToken, upstream: strings.TrimRight(upstream, "/"),
		http: &http.Client{Timeout: 30 * time.Second}}
	b, err := os.ReadFile(secretFile)
	if err != nil {
		// Not fatal here: the collector will reject every forward, which is
		// the safe direction to fail and says so in the logs on each batch.
		log.Printf("ingest: no collector secret at %s (%v) — forwards will be refused", secretFile, err)
		return g
	}
	g.upstreamSecret = strings.TrimSpace(string(b))
	return g
}

func (g *gateway) routes() *http.ServeMux {
	mux := http.NewServeMux()
	// The three OTLP/HTTP signal paths, named exactly as the spec requires so
	// an unmodified exporter can point straight at this.
	for _, p := range []string{"/v1/metrics", "/v1/traces", "/v1/logs"} {
		mux.HandleFunc(p, g.handle)
	}
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	return mux
}

func (g *gateway) handle(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	tok := bearerToken(r)
	if tok == "" {
		// WWW-Authenticate so a misconfigured exporter's logs say what is
		// missing rather than just "401".
		w.Header().Set("WWW-Authenticate", `Bearer realm="orchestr8-ingest"`)
		http.Error(w, "missing bearer token", http.StatusUnauthorized)
		return
	}

	id, err := g.lookup(r.Context(), tok)
	switch {
	case errors.Is(err, errNoToken):
		http.Error(w, "unknown or revoked token", http.StatusUnauthorized)
		return
	case err != nil:
		// 503, NOT 401. An OTLP exporter drops a batch permanently on 4xx and
		// retries on 5xx, so reporting a control-plane outage as a bad
		// credential would quietly destroy every customer's telemetry for the
		// duration of the outage.
		log.Printf("ingest: control plane unavailable: %v", err)
		http.Error(w, "control plane unavailable", http.StatusServiceUnavailable)
		return
	}

	body, err := io.ReadAll(io.LimitReader(r.Body, maxIngestBytes+1))
	if err != nil {
		http.Error(w, "could not read body", http.StatusBadRequest)
		return
	}
	if len(body) > maxIngestBytes {
		http.Error(w, "payload too large", http.StatusRequestEntityTooLarge)
		return
	}
	if ct := r.Header.Get("Content-Type"); !strings.Contains(ct, "x-protobuf") {
		// JSON is legal OTLP but nothing we ship emits it, and accepting an
		// encoding this cannot inspect would be a hole shaped exactly like the
		// one being closed.
		http.Error(w, "only application/x-protobuf is accepted", http.StatusUnsupportedMediaType)
		return
	}

	// Inspect a decompressed copy; forward the original bytes untouched so the
	// collector sees byte-for-byte what the exporter sent.
	raw := body
	if strings.Contains(r.Header.Get("Content-Encoding"), "gzip") {
		if raw, err = gunzip(body); err != nil {
			http.Error(w, "could not decompress body", http.StatusBadRequest)
			return
		}
	}

	resources, err := otlpResourceAttrs(raw)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if len(resources) == 0 {
		// Nothing to store and nothing to check. Accepting it keeps an empty
		// keepalive batch from looking like a credential problem.
		w.WriteHeader(http.StatusOK)
		return
	}
	for _, attrs := range resources {
		if attrs["orchestr8.org.id"] != id.Org || attrs["orchestr8.cluster.id"] != id.Cluster {
			// Worth a log line: this is either a misconfigured chart or
			// somebody probing with a token they do hold.
			log.Printf("ingest: rejected claim org=%q cluster=%q from a token for org=%q cluster=%q",
				attrs["orchestr8.org.id"], attrs["orchestr8.cluster.id"], id.Org, id.Cluster)
			http.Error(w, "payload does not belong to this token's cluster", http.StatusForbidden)
			return
		}
	}

	g.forward(w, r, body)
}

func (g *gateway) forward(w http.ResponseWriter, r *http.Request, body []byte) {
	req, err := http.NewRequestWithContext(r.Context(), http.MethodPost, g.upstream+r.URL.Path, bytes.NewReader(body))
	if err != nil {
		http.Error(w, "bad upstream", http.StatusInternalServerError)
		return
	}
	// The customer's token stops here — the collector has no use for it and no
	// way to check it. What goes upstream is our own secret for that hop.
	req.Header.Set("Content-Type", r.Header.Get("Content-Type"))
	if g.upstreamSecret != "" {
		req.Header.Set("Authorization", "Bearer "+g.upstreamSecret)
	}
	if enc := r.Header.Get("Content-Encoding"); enc != "" {
		req.Header.Set("Content-Encoding", enc)
	}
	resp, err := g.http.Do(req)
	if err != nil {
		log.Printf("ingest: upstream collector unreachable: %v", err)
		http.Error(w, "collector unavailable", http.StatusServiceUnavailable)
		return
	}
	defer resp.Body.Close()
	// Mirror the collector's verdict. Its 429 and 503 carry backpressure the
	// exporter knows how to honour; swallowing them into a 200 would drop data.
	if ct := resp.Header.Get("Content-Type"); ct != "" {
		w.Header().Set("Content-Type", ct)
	}
	w.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(w, io.LimitReader(resp.Body, 1<<20))
}

func bearerToken(r *http.Request) string {
	h := r.Header.Get("Authorization")
	if len(h) > 7 && strings.EqualFold(h[:7], "bearer ") {
		return strings.TrimSpace(h[7:])
	}
	return ""
}

// gunzip decompresses for inspection, and refuses anything that would not fit.
//
// The limit is not only about memory. The body forwarded upstream is the
// ORIGINAL, so inspecting a truncated decompression would check the first N
// bytes and pass along the rest unread — an attacker puts a valid claim in the
// first megabyte and whatever they like after it. Truncation must therefore be
// an error, never a silent short read.
func gunzip(b []byte) ([]byte, error) {
	zr, err := gzip.NewReader(bytes.NewReader(b))
	if err != nil {
		return nil, err
	}
	defer zr.Close()
	out, err := io.ReadAll(io.LimitReader(zr, maxIngestBytes+1))
	if err != nil {
		return nil, err
	}
	if len(out) > maxIngestBytes {
		return nil, errors.New("decompressed payload too large to inspect")
	}
	return out, nil
}
