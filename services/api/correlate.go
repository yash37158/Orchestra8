package main

import (
	"fmt"
	"math"
	"regexp"
	"strings"
	"time"
)

// The correlation engine. Rules, not a model — deliberately.
//
// A new product has no training data, and an unexplainable verdict at 3am is
// worse than no verdict: it costs trust you only get to spend once. Every rule
// here is a hand-written hypothesis that states its evidence and a confidence
// the on-call engineer can argue with.
//
// Rules are ordered most-specific first and the FIRST MATCH WINS. That is a
// precision-over-recall choice: we would rather say "SLO breached, cause
// unknown" than send someone to drain a healthy node.

type rule struct {
	name string
	eval func(serviceSignal) (*Correlation, bool)
}

// rules, in priority order.
var rules = []rule{
	{"xid_error", ruleXidError},
	{"gpu_thermal_throttle", ruleThermalThrottle},
	{"gpu_memory_pressure", ruleMemoryPressure},
	{"kv_cache_saturation", ruleKVSaturation},
	{"traffic_surge", ruleTrafficSurge},
}

// Correlate runs the rules for one service. Returns nil when the service is
// healthy — a correlation for a service meeting its SLO is noise.
func Correlate(s serviceSignal) *Correlation {
	if !s.Breaching() {
		return nil
	}
	for _, r := range rules {
		if c, ok := r.eval(s); ok {
			return c
		}
	}
	return ruleUnknown(s)
}

// ------------------------------------------------------------------- rules

// A GPU reporting XID errors is failing at the hardware level. Most specific
// signal available, so it runs first and outranks any latency explanation.
func ruleXidError(s serviceSignal) (*Correlation, bool) {
	for _, g := range s.GPUs {
		if g.XidErrors <= 0 {
			continue
		}
		ev := []Evidence{
			evidence(s, fmt.Sprintf("%s on %s reported %.0f XID error(s) in the window",
				g.UUID, g.NodeName, g.XidErrors), "DCGM_FI_DEV_XID_ERRORS", g.UUID),
			evidence(s, fmt.Sprintf("p95 TTFT %.0fms against a %.0fms target", s.TtftP95Now, s.SloMs),
				"vllm:time_to_first_token_seconds", s.Model),
		}
		return build(s, "critical", "xid_error", &g.UUID, &g.NodeName, 0.88, ev,
			fmt.Sprintf("XID errors on %s indicate a hardware fault, and p95 TTFT for %s is %.0fms against a %.0fms target.",
				g.UUID, s.Model, s.TtftP95Now, s.SloMs),
			fmt.Sprintf("Cordon and drain %s, then run a GPU health check on %s. XID errors rarely resolve on their own.",
				g.NodeName, g.UUID)), true
	}
	return nil, false
}

// The thesis rule. A GPU pinned at high utilization while thermally throttling
// looks perfectly healthy on every infrastructure dashboard, and is the most
// common cause of an inference SLO breach that traffic does not explain.
func ruleThermalThrottle(s serviceSignal) (*Correlation, bool) {
	throttled := s.ThrottledGPUs()
	if len(throttled) == 0 {
		return nil, false
	}
	// Traffic must be flat. If load also rose we cannot separate the two, and
	// claiming the GPU is at fault would be a guess wearing a confidence score.
	delta := s.ReqRateDeltaPct()
	if s.HasBaseline && math.Abs(delta) > 20 {
		return nil, false
	}
	g := throttled[0]

	ev := []Evidence{
		evidence(s, fmt.Sprintf("%s is at %.1fC and has lost %.0f%% of its clock (%.0fMHz against a fleet peak of %.0fMHz)",
			g.UUID, g.TempC, g.ClockLossPct(), g.ClockMhz, g.PeakClockMhz), "DCGM_FI_DEV_SM_CLOCK", g.UUID),
		evidence(s, fmt.Sprintf("Temperature on %s reached %.1fC", g.NodeName, g.TempC), "DCGM_FI_DEV_GPU_TEMP", g.UUID),
		evidence(s, fmt.Sprintf("Utilization is %.1f%% — the card is busy, not fast", g.UtilPct),
			"DCGM_FI_DEV_GPU_UTIL", g.UUID),
	}

	// Confidence is assembled from what the evidence actually supports rather
	// than asserted. Each clause below is a fact that narrows the alternatives.
	conf := 0.55
	if s.HasBaseline {
		ev = append(ev, evidence(s, fmt.Sprintf("Request rate is flat (%.0f/min against a %.0f/min baseline, %+.0f%%) — load did not cause this",
			s.ReqRateNow, s.ReqRateBase, delta), "vllm:request_success_total", s.Model))
		conf += 0.20
	} else {
		ev = append(ev, evidence(s, "No baseline window yet; traffic could not be ruled out as a contributing cause", "", ""))
	}
	if healthy := s.HealthyGPUs(); len(healthy) > 0 {
		ev = append(ev, evidence(s, fmt.Sprintf("Sibling %s on %s is at %.1fC with full clock and is not implicated",
			healthy[0].UUID, healthy[0].NodeName, healthy[0].TempC), "DCGM_FI_DEV_GPU_TEMP", healthy[0].UUID))
		conf += 0.15 // a fleet-wide problem would not spare a sibling
	}
	if g.ClockLossPct() > 25 {
		conf += 0.08
	}

	sev := "warning"
	if s.TtftP95Now > s.SloMs*1.25 {
		sev = "critical"
	}
	return build(s, sev, "gpu_thermal_throttle", &g.UUID, &g.NodeName, clampConf(conf), ev,
		fmt.Sprintf("p95 TTFT on %s breached its %.0fms SLO at %.0fms because %s on %s is thermally throttling at %.1fC — not because traffic rose.",
			s.Model, s.SloMs, s.TtftP95Now, g.UUID, g.NodeName, g.TempC),
		fmt.Sprintf("Drain %s and check chassis airflow. Rebalance the %s replica onto a cooler node to restore the SLO.",
			g.NodeName, s.Model)), true
}

// A GPU near memory capacity stalls on allocation. Distinct from KV-cache
// saturation: this is device memory, not the engine's own cache accounting.
func ruleMemoryPressure(s serviceSignal) (*Correlation, bool) {
	for _, g := range s.GPUs {
		if g.MemUsedPct() < 95 || g.Throttled() {
			continue
		}
		ev := []Evidence{
			evidence(s, fmt.Sprintf("%s is using %.0f%% of device memory (%.0f of %.0f MiB)",
				g.UUID, g.MemUsedPct(), g.MemUsedMib, g.MemTotMib), "DCGM_FI_DEV_FB_USED", g.UUID),
			evidence(s, fmt.Sprintf("The card is not throttling (%.0fMHz), so this is not thermal", g.ClockMhz),
				"DCGM_FI_DEV_SM_CLOCK", g.UUID),
		}
		return build(s, "warning", "gpu_memory_pressure", &g.UUID, &g.NodeName, 0.7, ev,
			fmt.Sprintf("p95 TTFT on %s is %.0fms against a %.0fms target, with %s at %.0f%% device memory.",
				s.Model, s.TtftP95Now, s.SloMs, g.UUID, g.MemUsedPct()),
			fmt.Sprintf("Reduce gpu-memory-utilization for %s or move a replica off %s.", s.Model, g.NodeName)), true
	}
	return nil, false
}

// KV cache is the engine's own memory for in-flight sequences. When it fills,
// requests queue rather than fail, so latency rises before errors do.
func ruleKVSaturation(s serviceSignal) (*Correlation, bool) {
	if s.KvCachePct < 85 || len(s.ThrottledGPUs()) > 0 {
		return nil, false
	}
	ev := []Evidence{
		evidence(s, fmt.Sprintf("KV cache is at %.1f%%", s.KvCachePct), "vllm:gpu_cache_usage_perc", s.Model),
		evidence(s, fmt.Sprintf("%.0f requests are waiting", s.QueueDepth), "vllm:num_requests_waiting", s.Model),
		evidence(s, "No GPU backing this model is throttling, so the hardware is not the constraint", "", ""),
	}
	conf := 0.62
	if s.QueueDepth > 20 {
		conf += 0.12
	}
	if s.HasBaseline && math.Abs(s.ReqRateDeltaPct()) < 20 {
		ev = append(ev, evidence(s, fmt.Sprintf("Request rate is flat (%+.0f%%), so longer sequences rather than more of them are filling the cache",
			s.ReqRateDeltaPct()), "vllm:request_success_total", s.Model))
		conf += 0.1
	}
	return build(s, "warning", "kv_cache_saturation", nil, nil, clampConf(conf), ev,
		fmt.Sprintf("KV cache on %s is at %.1f%% with %.0f requests queued; p95 TTFT is %.0fms against a %.0fms target.",
			s.Model, s.KvCachePct, s.QueueDepth, s.TtftP95Now, s.SloMs),
		fmt.Sprintf("Raise gpu-memory-utilization or add a replica for %s. Check whether a recent prompt change increased sequence length.", s.Model)), true
}

// The decoy. Load genuinely rose, the hardware is fine, and the honest verdict
// is "this is capacity, not a fault". Without this rule the thermal rule would
// eventually be blamed for ordinary traffic growth.
func ruleTrafficSurge(s serviceSignal) (*Correlation, bool) {
	if !s.HasBaseline || len(s.ThrottledGPUs()) > 0 {
		return nil, false
	}
	delta := s.ReqRateDeltaPct()
	if delta < 35 {
		return nil, false
	}
	ev := []Evidence{
		evidence(s, fmt.Sprintf("Request rate rose %+.0f%% (%.0f/min against a %.0f/min baseline)",
			delta, s.ReqRateNow, s.ReqRateBase), "vllm:request_success_total", s.Model),
		evidence(s, "No GPU backing this model is throttling; every card is at full clock", "DCGM_FI_DEV_SM_CLOCK", ""),
	}
	conf := 0.68
	if delta > 80 {
		conf += 0.12
	}
	return build(s, "warning", "traffic_surge", nil, nil, clampConf(conf), ev,
		fmt.Sprintf("p95 TTFT on %s is %.0fms against a %.0fms target because request rate rose %+.0f%%. The hardware is healthy — this is capacity, not a fault.",
			s.Model, s.TtftP95Now, s.SloMs, delta),
		fmt.Sprintf("Scale %s out, or raise the SLO if this load is the new normal. No node needs draining.", s.Model)), true
}

// The honest fallback. Something is wrong and none of the hypotheses fit.
// Saying so is more useful than forcing the closest rule to take the blame.
func ruleUnknown(s serviceSignal) *Correlation {
	ev := []Evidence{
		evidence(s, fmt.Sprintf("p95 TTFT is %.0fms against a %.0fms target", s.TtftP95Now, s.SloMs),
			"vllm:time_to_first_token_seconds", s.Model),
		evidence(s, fmt.Sprintf("No GPU backing %s is throttling or reporting errors", s.Model), "", ""),
		evidence(s, fmt.Sprintf("KV cache %.1f%%, queue depth %.0f — neither is saturated", s.KvCachePct, s.QueueDepth), "", ""),
	}
	if s.HasBaseline {
		ev = append(ev, evidence(s, fmt.Sprintf("Request rate %+.0f%% against baseline — not a load change", s.ReqRateDeltaPct()),
			"vllm:request_success_total", s.Model))
	} else {
		ev = append(ev, evidence(s, "No baseline window available yet, which limits what can be ruled out", "", ""))
	}
	return build(s, "warning", "unknown", nil, nil, 0.3, ev,
		fmt.Sprintf("p95 TTFT on %s is %.0fms against a %.0fms target, and none of the known causes match. This needs a human.",
			s.Model, s.TtftP95Now, s.SloMs),
		"Check recent deployments and prompt changes for this model. If this pattern recurs, it is a candidate for a new rule.")
}

// ----------------------------------------------------------------- helpers

func evidence(s serviceSignal, text, metric, subject string) Evidence {
	e := Evidence{
		Text:        text,
		WindowStart: s.WindowStart.Format(time.RFC3339Nano),
		WindowEnd:   s.WindowEnd.Format(time.RFC3339Nano),
	}
	if metric != "" {
		e.Metric = &metric
	}
	if subject != "" {
		e.Subject = &subject
	}
	return e
}

func build(s serviceSignal, severity, kind string, gpu, node *string, conf float64, ev []Evidence, summary, action string) *Correlation {
	now := time.Now().UTC().Format(time.RFC3339Nano)
	return &Correlation{
		ID:          stableID(s.ClusterID, s.Model, kind),
		DetectedAt:  now,
		UpdatedAt:   now,
		Status:      "open",
		Severity:    severity,
		Summary:     summary,
		WindowStart: s.WindowStart.Format(time.RFC3339Nano),
		WindowEnd:   s.WindowEnd.Format(time.RFC3339Nano),
		Symptom: CorrelationSymptom{
			ServiceID: "svc-" + s.Model, Model: s.Model,
			Metric: "ttft_p95", Observed: round1(s.TtftP95Now), Threshold: s.SloMs,
		},
		Cause: CorrelationCause{
			Kind: kind, GpuUUID: gpu, NodeName: node, ClusterID: s.ClusterID, Evidence: ev,
		},
		Confidence:        math.Round(conf*100) / 100,
		RecommendedAction: action,
	}
}

var slugRe = regexp.MustCompile(`[^a-z0-9]+`)

// stableID keeps one row per ongoing condition. A thermal throttle that
// persists for an hour is ONE correlation being updated, not twenty duplicates
// competing for the same on-call engineer's attention.
func stableID(cluster, model, kind string) string {
	slug := func(v string) string {
		return strings.Trim(slugRe.ReplaceAllString(strings.ToLower(v), "-"), "-")
	}
	return fmt.Sprintf("%s--%s--%s", slug(cluster), slug(model), slug(kind))
}

func clampConf(c float64) float64 { return math.Max(0.05, math.Min(0.97, c)) }
