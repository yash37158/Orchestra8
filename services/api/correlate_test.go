package main

import (
	"strings"
	"testing"
	"time"
)

// baseSignal is a breaching service on healthy hardware. Each test perturbs
// exactly one thing, so a rule firing can only be attributed to that change.
func baseSignal() serviceSignal {
	now := time.Now().UTC()
	return serviceSignal{
		ClusterID: "gcp-usc1", Model: "llama-3.3-70b-instruct", SloMs: 1200,
		TtftP95Now: 1650, TtftP50Now: 700,
		QueueDepth: 4, KvCachePct: 48,
		ReqRateNow: 340, ReqRateBase: 338, TtftP95Base: 800, HasBaseline: true,
		GPUs: []gpuSignal{
			{UUID: "GPU-A", NodeName: "gpu-a-04", Model: "H100", TempC: 66, ClockMhz: 1980,
				UtilPct: 88, MemUsedMib: 48000, MemTotMib: 81920, PeakClockMhz: 1980},
			{UUID: "GPU-B", NodeName: "gpu-a-05", Model: "H100", TempC: 66, ClockMhz: 1980,
				UtilPct: 88, MemUsedMib: 47000, MemTotMib: 81920, PeakClockMhz: 1980},
		},
		WindowStart: now.Add(-3 * time.Minute), WindowEnd: now,
	}
}

func TestHealthyServiceProducesNoCorrelation(t *testing.T) {
	s := baseSignal()
	s.TtftP95Now = 900 // inside SLO
	if c := Correlate(s); c != nil {
		t.Errorf("correlation raised for a healthy service: %s", c.Summary)
	}
}

// THE test. Thermal throttle and traffic surge both breach p95 by a similar
// amount. If the engine cannot separate them it will send someone to drain a
// perfectly healthy node, which is the failure mode that ends trust in the
// product. Precision over recall is the whole design.
func TestThermalAndSurgeGetDifferentVerdicts(t *testing.T) {
	// Thermal: one card throttling, traffic flat.
	thermal := baseSignal()
	thermal.GPUs[0].TempC = 92
	thermal.GPUs[0].ClockMhz = 1213

	// Surge: hardware pristine, load up 130%.
	surge := baseSignal()
	surge.ReqRateNow = 780

	ct := Correlate(thermal)
	cs := Correlate(surge)
	if ct == nil || cs == nil {
		t.Fatal("both scenarios breach the SLO and must produce a correlation")
	}

	if ct.Cause.Kind != "gpu_thermal_throttle" {
		t.Errorf("thermal scenario diagnosed as %q, want gpu_thermal_throttle", ct.Cause.Kind)
	}
	if cs.Cause.Kind != "traffic_surge" {
		t.Errorf("surge scenario diagnosed as %q, want traffic_surge", cs.Cause.Kind)
	}

	// The verdicts must lead to OPPOSITE actions. Same p95, same service.
	if ct.Cause.GpuUUID == nil || *ct.Cause.GpuUUID != "GPU-A" {
		t.Errorf("thermal verdict must name the failing card, got %v", ct.Cause.GpuUUID)
	}
	if cs.Cause.GpuUUID != nil {
		t.Errorf("surge verdict must blame no GPU, got %v", *cs.Cause.GpuUUID)
	}
	if !strings.Contains(cs.RecommendedAction, "No node needs draining") {
		t.Errorf("surge action should explicitly spare the hardware, got: %s", cs.RecommendedAction)
	}
	t.Logf("thermal -> %s (%.0f%%): %s", ct.Cause.Kind, ct.Confidence*100, ct.RecommendedAction)
	t.Logf("surge   -> %s (%.0f%%): %s", cs.Cause.Kind, cs.Confidence*100, cs.RecommendedAction)
}

// If load rose AND a card is throttling, the two causes cannot be separated.
// Guessing here would be a confident lie, so the engine must decline.
func TestAmbiguousCaseDoesNotClaimThermal(t *testing.T) {
	s := baseSignal()
	s.GPUs[0].TempC = 92
	s.GPUs[0].ClockMhz = 1213
	s.ReqRateNow = 800 // load ALSO rose

	c := Correlate(s)
	if c == nil {
		t.Fatal("expected a correlation")
	}
	if c.Cause.Kind == "gpu_thermal_throttle" {
		t.Errorf("claimed thermal throttle while traffic also rose %+.0f%% — that is a guess, not a diagnosis",
			s.ReqRateDeltaPct())
	}
	t.Logf("ambiguous -> %s at %.2f confidence", c.Cause.Kind, c.Confidence)
}

func TestXidOutranksThermal(t *testing.T) {
	s := baseSignal()
	s.GPUs[0].TempC = 92
	s.GPUs[0].ClockMhz = 1213
	s.GPUs[0].XidErrors = 2 // hardware fault present too

	c := Correlate(s)
	if c.Cause.Kind != "xid_error" {
		t.Errorf("got %q; an XID error is more specific than a thermal symptom and must win", c.Cause.Kind)
	}
}

func TestKVSaturationFiresWithoutThrottle(t *testing.T) {
	s := baseSignal()
	s.KvCachePct = 92
	s.QueueDepth = 46

	c := Correlate(s)
	if c.Cause.Kind != "kv_cache_saturation" {
		t.Errorf("got %q, want kv_cache_saturation", c.Cause.Kind)
	}
	if c.Cause.GpuUUID != nil {
		t.Error("KV saturation is an engine-level problem and must not blame a card")
	}
}

// A breach nobody can explain must be reported as unexplained, at low
// confidence, rather than forced into the nearest-fitting rule.
func TestUnexplainedBreachIsHonest(t *testing.T) {
	s := baseSignal() // breaching, but every signal is nominal
	c := Correlate(s)
	if c == nil {
		t.Fatal("a breaching service must always produce something")
	}
	if c.Cause.Kind != "unknown" {
		t.Errorf("got %q; with all signals nominal the only honest answer is unknown", c.Cause.Kind)
	}
	if c.Confidence > 0.4 {
		t.Errorf("confidence %.2f is too high for an unexplained breach", c.Confidence)
	}
	if !strings.Contains(c.Summary, "needs a human") {
		t.Errorf("unknown verdict should say so plainly, got: %s", c.Summary)
	}
}

// Every verdict must be inspectable: evidence, a confidence, and an action.
func TestEveryVerdictIsExplainable(t *testing.T) {
	variants := map[string]func(*serviceSignal){
		"thermal": func(s *serviceSignal) { s.GPUs[0].TempC = 92; s.GPUs[0].ClockMhz = 1213 },
		"surge":   func(s *serviceSignal) { s.ReqRateNow = 800 },
		"kv":      func(s *serviceSignal) { s.KvCachePct = 92; s.QueueDepth = 46 },
		"xid":     func(s *serviceSignal) { s.GPUs[0].XidErrors = 1 },
		"memory":  func(s *serviceSignal) { s.GPUs[0].MemUsedMib = 80000 },
		"unknown": func(s *serviceSignal) {},
	}
	for name, mutate := range variants {
		t.Run(name, func(t *testing.T) {
			s := baseSignal()
			mutate(&s)
			c := Correlate(s)
			if c == nil {
				t.Fatal("no correlation")
			}
			if len(c.Cause.Evidence) < 2 {
				t.Errorf("%s verdict carries only %d evidence lines", name, len(c.Cause.Evidence))
			}
			if c.Confidence <= 0 || c.Confidence > 1 {
				t.Errorf("confidence %v out of range", c.Confidence)
			}
			if c.RecommendedAction == "" {
				t.Error("no recommended action")
			}
			for _, e := range c.Cause.Evidence {
				if e.WindowStart == "" || e.WindowEnd == "" {
					t.Errorf("evidence %q has no pinned window", e.Text)
				}
			}
			if c.ID != stableID(s.ClusterID, s.Model, c.Cause.Kind) {
				t.Error("id is not stable for the condition")
			}
		})
	}
}

// GPU UUIDs and model names are only unique WITHIN a cluster. Two clusters
// running the same model — or cloned from the same image — collide. If
// attribution is not scoped, a service in one cluster is charged for GPUs in
// another, and the engine can name a card that is nowhere near the workload.
func TestAttributionIsScopedToOneCluster(t *testing.T) {
	if a, b := scopeKey("cluster-a", "GPU-1"), scopeKey("cluster-b", "GPU-1"); a == b {
		t.Fatal("the same GPU UUID in two clusters produced the same key")
	}
	if a, b := scopeKey("c", "llama"), scopeKey("c", "llama"); a != b {
		t.Fatal("scopeKey is not deterministic")
	}
	// The separator must not be forgeable from ordinary ids, or a cluster named
	// "a\x1fGPU" could impersonate another cluster's device.
	if scopeKey("a", "b-c") == scopeKey("a-b", "c") {
		t.Error("keys collide across the cluster/id boundary")
	}

	// A correlation must only ever name a GPU that is in its own cluster.
	s := baseSignal()
	s.ClusterID = "gcp-usc1"
	for i := range s.GPUs {
		s.GPUs[i].ClusterID = "gcp-usc1"
	}
	s.GPUs[0].TempC = 92
	s.GPUs[0].ClockMhz = 1213

	c := Correlate(s)
	if c == nil || c.Cause.GpuUUID == nil {
		t.Fatal("expected a thermal correlation naming a GPU")
	}
	var found bool
	for _, g := range s.GPUs {
		if g.UUID == *c.Cause.GpuUUID {
			found = true
			if g.ClusterID != c.Cause.ClusterID {
				t.Errorf("blamed %s in cluster %q for a service in cluster %q",
					g.UUID, g.ClusterID, c.Cause.ClusterID)
			}
		}
	}
	if !found {
		t.Errorf("blamed %s, which is not bound to this service at all", *c.Cause.GpuUUID)
	}
}
