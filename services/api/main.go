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
	"strings"
	"time"
)

func main() {
	addr := env("ORCHESTR8_ADDR", ":8088")  // 8080 is a common local collision (Tomcat, etc.)
	origins := strings.Split(env("ORCHESTR8_CORS_ORIGINS", "http://localhost:3000"), ",")

	ch := newCHClient(env("ORCHESTR8_CLICKHOUSE_URL", "http://127.0.0.1:8123/?database=orchestr8&output_format_json_quote_64bit_integers=0"))
	slos := newSLOStore(env("ORCHESTR8_SLO_FILE", "../../config/slos.json"))

	// The detection loop lives with the query API: same store, same schedule.
	ntf := newNotifier(env("ORCHESTR8_NOTIFY_FILE", "../../config/notifications.json"), &auditLog{ch: ch})
	eng := &engine{ch: ch, slos: slos, notify: ntf,
		interval: envDuration("ORCHESTR8_DETECT_INTERVAL", 30*time.Second)}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go eng.run(ctx)

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	// What the rules actually see. Correlation bugs are almost always signal
	// bugs, and reading the inputs beats guessing from the verdict.
	aud := &auditLog{ch: ch}
	dep := &deployer{
		repo:  env("ORCHESTR8_GITOPS_REPO", "../../.localdev/gitops"),
		ch:    ch, slos: slos, audit: aud,
	}
	scn := &scanner{
		ch: ch, audit: aud,
		bin:    env("ORCHESTR8_TRIVY_BIN", "trivy"),
		docker: env("ORCHESTR8_DOCKER_CONFIG", "../../.localdev/dockerconfig"),
	}

	// Where an in-cluster gateway ships telemetry: the collector's OTLP HTTP
	// receiver, which is the only component that writes to ClickHouse.
	apiBase := env("ORCHESTR8_OTLP_ENDPOINT", "http://host.lima.internal:4318")
	rates := newRateCard(env("ORCHESTR8_RATES_FILE", "../../config/gpu-rates.json"))
	mux.HandleFunc("/v1/dashboard", func(w http.ResponseWriter, r *http.Request) {
		handleDashboard(w, r, ch, slos, rates, aud)
	})
	mux.HandleFunc("/v1/inference", func(w http.ResponseWriter, r *http.Request) { handleInference(w, r, ch, slos, rates) })
	mux.HandleFunc("/v1/config", func(w http.ResponseWriter, r *http.Request) {
		handleConfig(w, r, ch, slos, rates, ntf, env("ORCHESTR8_GITOPS_REPO", "../../.localdev/gitops"))
	})
	mux.HandleFunc("/v1/clusters", func(w http.ResponseWriter, r *http.Request) { handleClusters(w, r, ch, rates) })

	mux.HandleFunc("/v1/onboarding/connect", func(w http.ResponseWriter, r *http.Request) { handleConnect(w, r, apiBase) })
	mux.HandleFunc("/v1/onboarding/status", func(w http.ResponseWriter, r *http.Request) { handleOnboardingStatus(w, r, ch) })
	mux.HandleFunc("/v1/slos", func(w http.ResponseWriter, r *http.Request) { handleSLOUpsert(w, r, slos, aud) })

	mux.HandleFunc("/v1/deployments", func(w http.ResponseWriter, r *http.Request) { handleDeployments(w, r, dep) })
	mux.HandleFunc("/v1/deployments/preflight", func(w http.ResponseWriter, r *http.Request) { handlePreflight(w, r, dep) })
	mux.HandleFunc("/v1/scans", func(w http.ResponseWriter, r *http.Request) { handleScans(w, r, scn) })
	mux.HandleFunc("/v1/scans/", func(w http.ResponseWriter, r *http.Request) { handleScan(w, r, scn, dep) })
	mux.HandleFunc("/v1/audit", func(w http.ResponseWriter, r *http.Request) { handleAudit(w, r, aud) })
	mux.HandleFunc("/v1/audit/verify", func(w http.ResponseWriter, r *http.Request) { handleAudit(w, r, aud) })

	mux.HandleFunc("/v1/debug/signals", func(w http.ResponseWriter, r *http.Request) {
		sig, err := collectSignals(r.Context(), ch, slos.All())
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
				Model: s.Model, SloMs: s.SloMs, TtftP95Now: round1(s.TtftP95Now),
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

	srv := &http.Server{
		Addr:              addr,
		Handler:           cors(origins, mux),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	log.Printf("orchestr8-api listening on %s (cors: %v)", addr, origins)
	log.Fatal(srv.ListenAndServe())
}

func handleDashboard(w http.ResponseWriter, r *http.Request, ch *chClient, slos *sloStore, rates *rateCard, aud *auditLog) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	data, err := loadDashboardFromCH(r.Context(), ch, slos.All(), rates, aud)
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
	cs, err := ch.correlations(r.Context(), "")
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
		if err := ch.setStatus(r.Context(), id, body.Status); err != nil {
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
	cs, err := ch.correlations(r.Context(), id)
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

