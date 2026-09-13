package main

import (
	"context"
	"fmt"
	"log"
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

func handleConnect(w http.ResponseWriter, r *http.Request, ctrl *control, apiBase string) {
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
	// Registering the cluster and minting the token are one step: a token that
	// is not bound to a cluster can authenticate nothing, and a cluster with no
	// token can send nothing. The plaintext is returned here and never again —
	// only its hash is stored.
	org := orgFromRequest(r)
	token, err := ctrl.registerCluster(r.Context(), org, req.ClusterID, req.ClusterID)
	if err != nil {
		log.Printf("onboarding: register %s/%s: %v", org, req.ClusterID, err)
		http.Error(w, "could not register the cluster", http.StatusInternalServerError)
		return
	}

	// orgId and clusterId are in the command because the gateway checks them
	// against the token rather than inferring them. Getting either wrong is a
	// 403 with a message that says so, which beats telemetry quietly landing
	// in the wrong tenant.
	cmd := fmt.Sprintf(`helm install orchestr8 ./deploy/helm/orchestr8-collector \
  --namespace %s --create-namespace \
  --set clusterId=%s \
  --set orgId=%s \
  --set endpoint=%s \
  --set token=%s`, req.Namespace, req.ClusterID, org, apiBase, token)

	writeJSON(w, ConnectResponse{
		ClusterID: req.ClusterID, Namespace: req.Namespace,
		Endpoint: apiBase, Token: token,
		HelmRepo: "", ChartLocal: "./deploy/helm/orchestr8-collector",
		Command: cmd,
	})
}

// handleOnboardingStatus powers the waiting screen. It answers one question per
// component: has anything arrived, and if not, what should the operator check?
func handleOnboardingStatus(w http.ResponseWriter, r *http.Request, c *chClient, ctrl *control, rejects *rejectLog) {
	cluster := r.URL.Query().Get("clusterId")
	st := OnboardingStatus{ClusterID: cluster, CheckedAt: time.Now().UTC().Format(time.RFC3339Nano)}

	org := orgFromRequest(r)
	filter := " AND " + orgClauseRaw(org)
	if cluster != "" {
		filter += fmt.Sprintf(" AND ResourceAttributes['orchestr8.cluster.id'] = %s", chQuote(cluster))
	}

	// 1. Is anything at all arriving? Distinguishes "chart not installed" from
	//    "chart installed but scraping nothing".
	var any []struct {
		N int `json:"n"`
	}
	_ = c.query(r.Context(), fmt.Sprintf(
		`SELECT count() AS n FROM orchestr8.otel_metrics_gauge WHERE TimeUnix >= now() - INTERVAL 3 MINUTE%s`, filter), &any)
	collectorSeen := len(any) > 0 && any[0].N > 0

	detail := pick(collectorSeen, fmt.Sprintf("%d samples in the last 3 minutes", countOf(any)), "No telemetry received yet")
	hint := pick(collectorSeen, "",
		"Check the gateway is running: kubectl -n orchestr8 get pods -l app.kubernetes.io/component=gateway")
	// Being turned away and never arriving look the same from here — no rows
	// either way, and every pod Running in both. When the gateway knows which
	// it was, say so: the two have nothing in common as fixes.
	if !collectorSeen {
		if n, why := rejects.explain(org, cluster, ctrl.tokenPrefixesFor(r.Context(), org, cluster), time.Now()); why != "" {
			detail = fmt.Sprintf("%d batch(es) refused in the last %d minutes", n, int(rejectWindow.Minutes()))
			hint = why
		}
	}
	st.Components = append(st.Components, ComponentStatus{
		ID: "collector", Name: "Collector",
		State:    stateOf(collectorSeen),
		Detail:   detail,
		Hint:     hint,
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
		writeJSON(w, map[string]any{"models": s.All(), "default": s.Fallback()})
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		// Optional. Omitting it sets the default every unlisted model
		// inherits, which is what onboarding means: it runs before any
		// inference service has been seen, so it has no model to name.
		Model     string  `json:"model"`
		TtftP95Ms float64 `json:"ttftP95Ms"`
		Note      string  `json:"note"`
	}
	if err := decodeJSON(r, &req); err != nil || req.TtftP95Ms <= 0 {
		http.Error(w, "a positive ttftP95Ms is required", http.StatusBadRequest)
		return
	}
	if err := s.Upsert(req.Model, req.TtftP95Ms, req.Note); err != nil {
		// A rejected model name is the caller's mistake, not the server's.
		// Reporting it as a 500 hid the one error message that said what to
		// send instead.
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	subject := req.Model
	if subject == "" {
		subject = "(default)"
	}
	_, _ = a.Append(r.Context(), actorOf(r, "operator"), "slo.set", subject, "", "allowed",
		map[string]any{"ttftP95Ms": req.TtftP95Ms})
	writeJSON(w, map[string]any{"model": req.Model, "ttftP95Ms": req.TtftP95Ms})
}

var _ = context.Background
