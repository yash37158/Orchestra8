package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"
)

// Onboarding.
//
// The value milestone is deliberately concrete: the operator sees their own
// GPU's real temperature. Not a product tour, not a sample dashboard — their
// hardware, their number. Everything here exists to shorten the path to that
// moment, because a user who never reaches it does not come back.

var clusterIDRe = regexp.MustCompile(`^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$`)

type ConnectRequest struct {
	ClusterID string `json:"clusterId"`
	Namespace string `json:"namespace"`
}

type ConnectResponse struct {
	ClusterID  string `json:"clusterId"`
	Namespace  string `json:"namespace"`
	Endpoint   string `json:"endpoint"`
	Token      string `json:"token"`
	HelmRepo   string `json:"helmRepo"`
	Command    string `json:"command"`
	ChartLocal string `json:"chartLocal"`
}

// ComponentStatus is what the waiting screen renders. Each component reports
// separately and says what to do when it is missing: "waiting..." tells the
// operator nothing, while "no DCGM metrics from gpu-a-04" is actionable.
type ComponentStatus struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	State    string `json:"state"` // waiting | ok | partial
	Detail   string `json:"detail"`
	Hint     string `json:"hint,omitempty"`
	Observed int    `json:"observed"`
}

type OnboardingStatus struct {
	ClusterID  string            `json:"clusterId"`
	Connected  bool              `json:"connected"`
	Components []ComponentStatus `json:"components"`
	FirstSignal *FirstSignal     `json:"firstSignal"`
	CheckedAt  string            `json:"checkedAt"`
}

// FirstSignal is the activation moment, carried explicitly so the UI can make
// it the loudest thing on the screen.
type FirstSignal struct {
	NodeName string  `json:"nodeName"`
	GpuUUID  string  `json:"gpuUuid"`
	Model    string  `json:"model"`
	TempC    float64 `json:"tempC"`
}

func newToken() string {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		// A predictable token is worse than none: fail loudly rather than
		// hand out something guessable.
		return ""
	}
	return "orch8_" + hex.EncodeToString(b)
}

func handleConnect(w http.ResponseWriter, r *http.Request, apiBase string) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req ConnectRequest
	if err := decodeJSON(r, &req); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	req.ClusterID = strings.TrimSpace(strings.ToLower(req.ClusterID))
	if !clusterIDRe.MatchString(req.ClusterID) {
		// The cluster id becomes a Kubernetes label value and a ClickHouse
		// LowCardinality key, so it is constrained up front rather than
		// failing later inside a manifest the operator cannot see.
		http.Error(w, "cluster id must be lowercase letters, digits and hyphens (max 40)", http.StatusBadRequest)
		return
	}
	if req.Namespace == "" {
		req.Namespace = "orchestr8"
	}
	token := newToken()
	if token == "" {
		http.Error(w, "could not generate a token", http.StatusInternalServerError)
		return
	}

	cmd := fmt.Sprintf(`helm install orchestr8 ./deploy/helm/orchestr8-collector \
  --namespace %s --create-namespace \
  --set clusterId=%s \
  --set endpoint=%s \
  --set token=%s`, req.Namespace, req.ClusterID, apiBase, token)

	writeJSON(w, ConnectResponse{
		ClusterID: req.ClusterID, Namespace: req.Namespace,
		Endpoint: apiBase, Token: token,
		HelmRepo: "", ChartLocal: "./deploy/helm/orchestr8-collector",
		Command: cmd,
	})
}

// handleOnboardingStatus powers the waiting screen. It answers one question per
// component: has anything arrived, and if not, what should the operator check?
func handleOnboardingStatus(w http.ResponseWriter, r *http.Request, c *chClient) {
	cluster := r.URL.Query().Get("clusterId")
	st := OnboardingStatus{ClusterID: cluster, CheckedAt: time.Now().UTC().Format(time.RFC3339Nano)}

	filter := ""
	if cluster != "" {
		filter = fmt.Sprintf(" AND ResourceAttributes['orchestr8.cluster.id'] = %s", chQuote(cluster))
	}

	// 1. Is anything at all arriving? Distinguishes "chart not installed" from
	//    "chart installed but scraping nothing".
	var any []struct {
		N int `json:"n"`
	}
	_ = c.query(r.Context(), fmt.Sprintf(
		`SELECT count() AS n FROM orchestr8.otel_metrics_gauge WHERE TimeUnix >= now() - INTERVAL 3 MINUTE%s`, filter), &any)
	collectorSeen := len(any) > 0 && any[0].N > 0

	st.Components = append(st.Components, ComponentStatus{
		ID: "collector", Name: "Collector",
		State:  stateOf(collectorSeen),
		Detail: pick(collectorSeen, fmt.Sprintf("%d samples in the last 3 minutes", countOf(any)), "No telemetry received yet"),
		Hint: pick(collectorSeen, "",
			"Check the gateway is running: kubectl -n orchestr8 get pods -l app.kubernetes.io/component=gateway"),
		Observed: countOf(any),
	})

	// 2. GPU metrics specifically. A collector can be healthy while DCGM is
	//    absent, and that is a completely different fix.
	var gpus []struct {
		Node string  `json:"node"`
		UUID string  `json:"uuid"`
		Mdl  string  `json:"model"`
		Temp float64 `json:"temp"`
	}
	_ = c.query(r.Context(), fmt.Sprintf(`
SELECT Attributes['Hostname'] AS node, Attributes['UUID'] AS uuid,
       Attributes['modelName'] AS model, round(avg(Value),1) AS temp
FROM orchestr8.otel_metrics_gauge
WHERE MetricName = 'DCGM_FI_DEV_GPU_TEMP' AND TimeUnix >= now() - INTERVAL 3 MINUTE%s
GROUP BY node, uuid, model ORDER BY node LIMIT 1`, filter), &gpus)
	gpuSeen := len(gpus) > 0

	st.Components = append(st.Components, ComponentStatus{
		ID: "dcgm", Name: "GPU metrics (DCGM)",
		State:  stateOf(gpuSeen),
		Detail: pick(gpuSeen, fmt.Sprintf("%s reporting", gpuName(gpus)), "No DCGM metrics received"),
		Hint: pick(gpuSeen, "",
			"The agent only scrapes pods labelled app=dcgm-exporter. Install the NVIDIA DCGM exporter, or set scrape.dcgmLabel to match yours."),
		Observed: len(gpus),
	})

	// 3. Inference engine.
	var models []struct {
		M string `json:"m"`
	}
	_ = c.query(r.Context(), fmt.Sprintf(`
SELECT DISTINCT Attributes['model_name'] AS m FROM orchestr8.otel_metrics_gauge
WHERE MetricName LIKE 'vllm:%%' AND TimeUnix >= now() - INTERVAL 3 MINUTE%s LIMIT 10`, filter), &models)
	infSeen := len(models) > 0

	st.Components = append(st.Components, ComponentStatus{
		ID: "inference", Name: "Inference engine",
		State:  stateOf(infSeen),
		Detail: pick(infSeen, fmt.Sprintf("%d model(s) reporting", len(models)), "No inference metrics received"),
		Hint: pick(infSeen, "",
			`Annotate the serving pod with orchestr8.io/scrape="true" so the agent picks up its /metrics endpoint.`),
		Observed: len(models),
	})

	if gpuSeen {
		st.FirstSignal = &FirstSignal{
			NodeName: gpus[0].Node, GpuUUID: gpus[0].UUID,
			Model: gpus[0].Mdl, TempC: gpus[0].Temp,
		}
	}
	// Connected means the activation moment is reachable: real telemetry from
	// real hardware. Inference can follow.
	st.Connected = collectorSeen && gpuSeen
	writeJSON(w, st)
}

func stateOf(ok bool) string {
	if ok {
		return "ok"
	}
	return "waiting"
}
func pick(ok bool, a, b string) string {
	if ok {
		return a
	}
	return b
}
func countOf(rows []struct {
	N int `json:"n"`
}) int {
	if len(rows) == 0 {
		return 0
	}
	return rows[0].N
}
func gpuName(g []struct {
	Node string  `json:"node"`
	UUID string  `json:"uuid"`
	Mdl  string  `json:"model"`
	Temp float64 `json:"temp"`
}) string {
	if len(g) == 0 {
		return ""
	}
	return g[0].Node
}

// handleSLOUpsert writes the threshold chosen during onboarding. SLOs are
// config, so this edits the same JSON file that lives in the repo rather than
// introducing a second source of truth in the database.
func handleSLOUpsert(w http.ResponseWriter, r *http.Request, s *sloStore, a *auditLog) {
	if r.Method == http.MethodGet {
		writeJSON(w, map[string]any{"models": s.All(), "default": defaultTtftSloMs})
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		Model     string  `json:"model"`
		TtftP95Ms float64 `json:"ttftP95Ms"`
		Note      string  `json:"note"`
	}
	if err := decodeJSON(r, &req); err != nil || req.Model == "" || req.TtftP95Ms <= 0 {
		http.Error(w, "model and a positive ttftP95Ms are required", http.StatusBadRequest)
		return
	}
	if err := s.Upsert(req.Model, req.TtftP95Ms, req.Note); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	_, _ = a.Append(r.Context(), actorOf(r, "operator"), "slo.set", req.Model, "", "allowed",
		map[string]any{"ttftP95Ms": req.TtftP95Ms})
	writeJSON(w, map[string]any{"model": req.Model, "ttftP95Ms": req.TtftP95Ms})
}

var _ = context.Background
