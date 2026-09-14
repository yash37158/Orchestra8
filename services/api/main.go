// orchestr8-api serves the query side of the platform: the UI asks it
// questions, it answers from the telemetry store. Ingest is the collector's
// job (services/collector), not this service's.
package main

import (
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
)

func main() {
	// A one-shot mode, run from a Job before the Deployments roll. Exits when
	// the schemas are in place so the Job can report success.
	if len(os.Args) > 1 && os.Args[1] == "-migrate" {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
		defer cancel()
		if err := migrate(ctx,
			env("ORCHESTR8_CONTROL_DSN", "postgres://localhost:5432/orchestr8?sslmode=disable"),
			env("ORCHESTR8_CLICKHOUSE_URL", "http://127.0.0.1:8123/?database=orchestr8"),
			env("ORCHESTR8_PG_SCHEMA", "/migrations/001_control_plane.sql"),
			env("ORCHESTR8_CH_SCHEMA", "/schema.sql"),
		); err != nil {
			log.Fatalf("migrate: %v", err)
		}
		log.Print("migrate: done")
		return
	}

	addr := env("ORCHESTR8_ADDR", ":8088") // 8080 is a common local collision (Tomcat, etc.)
	origins := strings.Split(env("ORCHESTR8_CORS_ORIGINS", "http://localhost:3000"), ",")

	ch := newCHClient(env("ORCHESTR8_CLICKHOUSE_URL", "http://127.0.0.1:8123/?database=orchestr8&output_format_json_quote_64bit_integers=0"))
	slos := newSLOStore(env("ORCHESTR8_SLO_FILE", "../../config/slos.json"))

	// The detection loop lives with the query API: same store, same schedule.
	aud := &auditLog{ch: ch}
	ntf := newNotifier(env("ORCHESTR8_NOTIFY_FILE", "../../config/notifications.json"), aud)
	eng := &engine{ch: ch, slos: slos, notify: ntf,
		interval: envDuration("ORCHESTR8_DETECT_INTERVAL", 30*time.Second),
		workers:  envInt("ORCHESTR8_DETECT_WORKERS", 4)}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go eng.run(ctx)

	// Everything on this mux requires a session; /healthz is registered on the
	// outer mux further down, outside the check.
	mux := http.NewServeMux()
	// What the rules actually see. Correlation bugs are almost always signal
	// bugs, and reading the inputs beats guessing from the verdict.
	dep := &deployer{
		repo: env("ORCHESTR8_GITOPS_REPO", "../../.localdev/gitops"),
		ch:   ch, slos: slos, audit: aud,
	}
	scn := &scanner{
		ch: ch, audit: aud,
		bin:    env("ORCHESTR8_TRIVY_BIN", "trivy"),
		docker: env("ORCHESTR8_DOCKER_CONFIG", "../../.localdev/dockerconfig"),
	}

	// The control plane decides who a collector is. Opening it never fails
	// and never blocks: a cold Postgres must not take the read API down with
	// it, so connection problems surface per-request as a 503 instead.
	ctrl := newControl(env("ORCHESTR8_CONTROL_DSN", "postgres://localhost:5432/orchestr8?sslmode=disable"))

	// Written by the ingest gateway, read by the onboarding screen. Neither
	// owns it, so it is built here and handed to both.
	rejects := &rejectLog{}

	// Where an in-cluster gateway ships telemetry: the ingest gateway below,
	// not the collector. The collector's own OTLP port is bound to loopback so
	// there is no way around the token check.
	apiBase := env("ORCHESTR8_INGEST_ENDPOINT", "http://host.lima.internal:4319")
	rates := newRateCard(env("ORCHESTR8_RATES_FILE", "../../config/gpu-rates.json"))
	mux.HandleFunc("/v1/dashboard", func(w http.ResponseWriter, r *http.Request) {
		handleDashboard(w, r, ch, slos, rates, aud)
	})
	mux.HandleFunc("/v1/inference", func(w http.ResponseWriter, r *http.Request) { handleInference(w, r, ch, slos, rates) })
	mux.HandleFunc("/v1/config", func(w http.ResponseWriter, r *http.Request) {
		handleConfig(w, r, ch, slos, rates, ntf, env("ORCHESTR8_GITOPS_REPO", "../../.localdev/gitops"))
	})
	mux.HandleFunc("/v1/clusters", func(w http.ResponseWriter, r *http.Request) { handleClusters(w, r, ch, rates) })

	mux.HandleFunc("/v1/onboarding/connect", func(w http.ResponseWriter, r *http.Request) {
		handleConnect(w, r, ctrl, apiBase)
	})
	mux.HandleFunc("/v1/onboarding/status", func(w http.ResponseWriter, r *http.Request) { handleOnboardingStatus(w, r, ch, ctrl, rejects) })
	mux.HandleFunc("/v1/slos", func(w http.ResponseWriter, r *http.Request) { handleSLOUpsert(w, r, slos, aud) })

	mux.HandleFunc("/v1/deployments", func(w http.ResponseWriter, r *http.Request) { handleDeployments(w, r, dep) })
	mux.HandleFunc("/v1/deployments/preflight", func(w http.ResponseWriter, r *http.Request) { handlePreflight(w, r, dep) })
	mux.HandleFunc("/v1/scans", func(w http.ResponseWriter, r *http.Request) { handleScans(w, r, scn) })
	mux.HandleFunc("/v1/scans/", func(w http.ResponseWriter, r *http.Request) { handleScan(w, r, scn, dep) })
	mux.HandleFunc("/v1/audit", func(w http.ResponseWriter, r *http.Request) { handleAudit(w, r, aud) })
	mux.HandleFunc("/v1/audit/verify", func(w http.ResponseWriter, r *http.Request) { handleAudit(w, r, aud) })

	mux.HandleFunc("/v1/debug/signals", func(w http.ResponseWriter, r *http.Request) {
		sig, err := collectSignals(r.Context(), ch, orgFromRequest(r), slos.All())
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		type view struct {
			ClusterID    string      `json:"clusterId"`
			Model        string      `json:"model"`
			SloMs        float64     `json:"sloMs"`
			TtftP95Now   float64     `json:"ttftP95Now"`
			Breaching    bool        `json:"breaching"`
			HasBaseline  bool        `json:"hasBaseline"`
			ReqRateNow   float64     `json:"reqRateNow"`
			ReqRateBase  float64     `json:"reqRateBase"`
			ReqDeltaPct  float64     `json:"reqDeltaPct"`
			KvCachePct   float64     `json:"kvCachePct"`
			QueueDepth   float64     `json:"queueDepth"`
			GPUs         []gpuSignal `json:"gpus"`
			ThrottledNum int         `json:"throttledCount"`
			Verdict      string      `json:"verdict"`
		}
		out := []view{}
		for _, s := range sig {
			v := view{
				ClusterID: s.ClusterID,
				Model:     s.Model, SloMs: s.SloMs, TtftP95Now: round1(s.TtftP95Now),
				Breaching: s.Breaching(), HasBaseline: s.HasBaseline,
				ReqRateNow: round1(s.ReqRateNow), ReqRateBase: round1(s.ReqRateBase),
				ReqDeltaPct: round1(s.ReqRateDeltaPct()), KvCachePct: s.KvCachePct,
				QueueDepth: s.QueueDepth, GPUs: s.GPUs, ThrottledNum: len(s.ThrottledGPUs()),
				Verdict: "none",
			}
			if c := Correlate(s); c != nil {
				v.Verdict = c.Cause.Kind
			}
			out = append(out, v)
		}
		writeJSON(w, out)
	})
	mux.HandleFunc("/v1/series", func(w http.ResponseWriter, r *http.Request) {
		handleSeries(w, r, ch)
	})
	mux.HandleFunc("/v1/correlations", func(w http.ResponseWriter, r *http.Request) {
		handleCorrelations(w, r, ch)
	})
	mux.HandleFunc("/v1/correlations/", func(w http.ResponseWriter, r *http.Request) {
		handleCorrelation(w, r, ch)
	})

	// Authentication wraps the whole mux rather than each handler: a route
	// added later is protected by being on the mux, not by someone remembering
	// to guard it. /healthz is registered on the outer mux below so a load
	// balancer can probe without a session.
	authed := requireIdentity(ctrl.lookupSession, mux)
	root := http.NewServeMux()
	root.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	root.Handle("/", authed)

	srv := &http.Server{
		Addr:              addr,
		Handler:           cors(origins, root),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	// Ingest listens on its own port. It is the write path, it is the only
	// thing reachable from a customer's cluster, and it authenticates
	// differently from the read API — sharing a port would mean one mistake in
	// routing exposes one to the other.
	//
	// ponytail: same process for now. Split into its own binary when ingest
	// throughput starts competing with query latency, not before.
	gw := newGateway(ctrl, env("ORCHESTR8_COLLECTOR_OTLP", "http://127.0.0.1:4318"),
		env("ORCHESTR8_COLLECTOR_SECRET_FILE", "../../.localdev/collector.secret"), rejects)
	ingest := &http.Server{
		Addr:              env("ORCHESTR8_INGEST_ADDR", ":4319"),
		Handler:           gw.routes(),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	go func() {
		log.Printf("orchestr8-ingest listening on %s -> %s", ingest.Addr, gw.upstream)
		log.Fatal(ingest.ListenAndServe())
	}()

	log.Printf("orchestr8-api listening on %s (cors: %v)", addr, origins)
	log.Fatal(srv.ListenAndServe())
}

func handleDashboard(w http.ResponseWriter, r *http.Request, ch *chClient, slos *sloStore, rates *rateCard, aud *auditLog) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	data, err := loadDashboardFromCH(r.Context(), ch, orgFromRequest(r), slos.All(), rates, aud)
	if err != nil {
		log.Printf("dashboard: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	if err := json.NewEncoder(w).Encode(data); err != nil {
		log.Printf("dashboard encode: %v", err)
	}
}

func handleCorrelations(w http.ResponseWriter, r *http.Request, ch *chClient) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	cs, err := ch.correlations(r.Context(), orgFromRequest(r), "")
	if err != nil {
		log.Printf("correlations: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]any{"correlations": cs})
}

// /v1/correlations/{id}          GET  one correlation
// /v1/correlations/{id}/status   POST {"status":"acknowledged"|"suppressed"|"open"}
func handleCorrelation(w http.ResponseWriter, r *http.Request, ch *chClient) {
	rest := strings.TrimPrefix(r.URL.Path, "/v1/correlations/")
	id, action, _ := strings.Cut(rest, "/")
	if id == "" {
		http.Error(w, "missing correlation id", http.StatusBadRequest)
		return
	}

	if action == "status" {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var body struct {
			Status string `json:"status"`
		}
		if err := json.NewDecoder(io.LimitReader(r.Body, 1<<12)).Decode(&body); err != nil {
			http.Error(w, "invalid body", http.StatusBadRequest)
			return
		}
		switch body.Status {
		case "open", "acknowledged", "suppressed":
		default:
			http.Error(w, "status must be open, acknowledged or suppressed", http.StatusBadRequest)
			return
		}
		if err := ch.setStatus(r.Context(), orgFromRequest(r), id, body.Status); err != nil {
			log.Printf("set status %s=%s: %v", id, body.Status, err)
			http.Error(w, "could not update status", http.StatusInternalServerError)
			return
		}
		log.Printf("correlation %s -> %s", id, body.Status)
		writeJSON(w, map[string]any{"id": id, "status": body.Status})
		return
	}

	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	cs, err := ch.correlations(r.Context(), orgFromRequest(r), id)
	if err != nil {
		log.Printf("correlation %s: %v", id, err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if len(cs) == 0 {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	writeJSON(w, cs[0])
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("encode: %v", err)
	}
}

func envInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			return n
		}
	}
	return fallback
}

func envDuration(key string, fallback time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			return d
		}
	}
	return fallback
}

func cors(allowed []string, next http.Handler) http.Handler {
	set := make(map[string]bool, len(allowed))
	for _, o := range allowed {
		set[strings.TrimSpace(o)] = true
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if origin := r.Header.Get("Origin"); set[origin] {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			// Cookies only travel cross-origin when both sides opt in, and the
			// allowed origin must then be an exact match — never "*".
			w.Header().Set("Access-Control-Allow-Credentials", "true")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
