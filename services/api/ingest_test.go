package main

// The fixture is a real OTLP batch, captured off the wire from the collector
// running in a k3s cluster — gzipped protobuf, exactly as an unmodified
// otlphttp exporter sends it. Testing the parser against bytes it did not
// produce is the whole point: a fixture built by the same assumptions as the
// decoder proves only that the assumptions agree with themselves.

import (
	"bytes"
	"compress/gzip"
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
)

const (
	fixtureOrg     = "local"
	fixtureCluster = "colima-k3s"
)

func realBatch(t *testing.T) []byte {
	t.Helper()
	b, err := os.ReadFile("testdata/otlp_metrics.bin")
	if err != nil {
		t.Fatalf("fixture: %v", err)
	}
	return b
}

func TestOTLPResourceAttrsOnRealBatch(t *testing.T) {
	raw, err := gunzip(realBatch(t))
	if err != nil {
		t.Fatalf("gunzip: %v", err)
	}
	res, err := otlpResourceAttrs(raw)
	if err != nil {
		t.Fatalf("scan: %v", err)
	}
	if len(res) == 0 {
		t.Fatal("no resource blocks found in a real batch")
	}
	for i, attrs := range res {
		if attrs["orchestr8.org.id"] != fixtureOrg {
			t.Errorf("block %d: org = %q, want %q", i, attrs["orchestr8.org.id"], fixtureOrg)
		}
		if attrs["orchestr8.cluster.id"] != fixtureCluster {
			t.Errorf("block %d: cluster = %q, want %q", i, attrs["orchestr8.cluster.id"], fixtureCluster)
		}
	}
	// A resource carries more than our two stamps; if this ever drops to two
	// the walk has started skipping attributes rather than reading them.
	if n := len(res[0]); n < 3 {
		t.Errorf("block 0 has %d attributes, expected the collector's own as well", n)
	}
}

// Garbage must not be read as a valid empty claim — that would sail through the
// comparison and land in whatever tenant the token named.
func TestOTLPResourceAttrsRejectsGarbage(t *testing.T) {
	raw, err := gunzip(realBatch(t))
	if err != nil {
		t.Fatalf("gunzip: %v", err)
	}
	for _, tc := range []struct {
		name string
		in   []byte
	}{
		{"truncated", raw[:len(raw)/2]},
		{"trailing junk", append(append([]byte{}, raw...), 0xff, 0xff, 0xff)},
		{"random", []byte("not a protobuf at all, not even close")},
	} {
		if _, err := otlpResourceAttrs(tc.in); err == nil {
			t.Errorf("%s: accepted, want an error", tc.name)
		}
	}
}

func testGateway(t *testing.T, lookup func(context.Context, string) (tokenIdentity, error)) (*gateway, *int) {
	t.Helper()
	forwarded := 0
	up := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		forwarded++
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(up.Close)
	return &gateway{lookup: lookup, upstream: up.URL, http: up.Client()}, &forwarded
}

func post(g *gateway, auth string, body []byte) *httptest.ResponseRecorder {
	r := httptest.NewRequest(http.MethodPost, "/v1/metrics", strings.NewReader(string(body)))
	r.Header.Set("Content-Type", "application/x-protobuf")
	r.Header.Set("Content-Encoding", "gzip")
	if auth != "" {
		r.Header.Set("Authorization", auth)
	}
	w := httptest.NewRecorder()
	g.routes().ServeHTTP(w, r)
	return w
}

// The reason this service exists: a valid token for one tenant must not be
// able to write another tenant's data.
func TestGatewayAuthorisation(t *testing.T) {
	body := realBatch(t)

	cases := []struct {
		name    string
		auth    string
		lookup  func(context.Context, string) (tokenIdentity, error)
		want    int
		forward int
	}{
		{
			name:   "no token",
			lookup: func(context.Context, string) (tokenIdentity, error) { return tokenIdentity{}, errNoToken },
			want:   http.StatusUnauthorized,
		},
		{
			name:   "unknown token",
			auth:   "Bearer orch8_nope",
			lookup: func(context.Context, string) (tokenIdentity, error) { return tokenIdentity{}, errNoToken },
			want:   http.StatusUnauthorized,
		},
		{
			// 503, not 401: an exporter drops a batch permanently on 4xx, so a
			// Postgres blip reported as a bad credential destroys telemetry.
			name: "control plane down",
			auth: "Bearer orch8_x",
			lookup: func(context.Context, string) (tokenIdentity, error) {
				return tokenIdentity{}, errors.New("dial tcp: refused")
			},
			want: http.StatusServiceUnavailable,
		},
		{
			name: "token for another org",
			auth: "Bearer orch8_x",
			lookup: func(context.Context, string) (tokenIdentity, error) {
				return tokenIdentity{Org: "acme", Cluster: fixtureCluster}, nil
			},
			want: http.StatusForbidden,
		},
		{
			// Same org, different cluster: a token is bound to one cluster, so
			// this is still somebody else's data within the tenant.
			name: "token for another cluster",
			auth: "Bearer orch8_x",
			lookup: func(context.Context, string) (tokenIdentity, error) {
				return tokenIdentity{Org: fixtureOrg, Cluster: "some-other"}, nil
			},
			want: http.StatusForbidden,
		},
		{
			name: "matching token",
			auth: "Bearer orch8_x",
			lookup: func(context.Context, string) (tokenIdentity, error) {
				return tokenIdentity{Org: fixtureOrg, Cluster: fixtureCluster}, nil
			},
			want: http.StatusOK, forward: 1,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			g, forwarded := testGateway(t, tc.lookup)
			if got := post(g, tc.auth, body).Code; got != tc.want {
				t.Errorf("status = %d, want %d", got, tc.want)
			}
			if *forwarded != tc.forward {
				t.Errorf("forwarded %d batches, want %d", *forwarded, tc.forward)
			}
		})
	}
}

// JSON is legal OTLP, but this gateway cannot read it, and accepting an
// encoding it cannot inspect would reopen the hole it exists to close.
func TestGatewayRejectsUninspectableEncoding(t *testing.T) {
	g, forwarded := testGateway(t, func(context.Context, string) (tokenIdentity, error) {
		return tokenIdentity{Org: fixtureOrg, Cluster: fixtureCluster}, nil
	})
	r := httptest.NewRequest(http.MethodPost, "/v1/metrics", strings.NewReader(`{"resourceMetrics":[]}`))
	r.Header.Set("Content-Type", "application/json")
	r.Header.Set("Authorization", "Bearer orch8_x")
	w := httptest.NewRecorder()
	g.routes().ServeHTTP(w, r)

	if w.Code != http.StatusUnsupportedMediaType {
		t.Errorf("status = %d, want 415", w.Code)
	}
	if *forwarded != 0 {
		t.Errorf("forwarded %d batches, want 0", *forwarded)
	}
}

// A gzip bomb must be refused, not inspected up to the limit and forwarded
// whole. The body that goes upstream is the original, so a short read here
// would check a prefix and pass along everything after it unexamined.
func TestGatewayRefusesOversizedDecompression(t *testing.T) {
	var buf bytes.Buffer
	zw := gzip.NewWriter(&buf)
	// Compresses to a few KB, expands past the inspection ceiling.
	chunk := make([]byte, 1<<20)
	for i := 0; i <= maxIngestBytes>>20; i++ {
		if _, err := zw.Write(chunk); err != nil {
			t.Fatal(err)
		}
	}
	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}
	if buf.Len() > maxIngestBytes {
		t.Fatalf("bomb is %d bytes compressed, too big to reach the decompression path", buf.Len())
	}

	if _, err := gunzip(buf.Bytes()); err == nil {
		t.Error("gunzip accepted an oversized payload, want an error")
	}

	g, forwarded := testGateway(t, func(context.Context, string) (tokenIdentity, error) {
		return tokenIdentity{Org: fixtureOrg, Cluster: fixtureCluster}, nil
	})
	if got := post(g, "Bearer orch8_x", buf.Bytes()).Code; got != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", got)
	}
	if *forwarded != 0 {
		t.Errorf("forwarded %d batches, want 0", *forwarded)
	}
}
