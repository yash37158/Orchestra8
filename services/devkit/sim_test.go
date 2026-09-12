package main

import (
	"fmt"
	"strings"
	"testing"
)

// settle runs a scenario to steady state and returns the snapshot.
func settle(t *testing.T, s Scenario) Snapshot {
	t.Helper()
	f := NewFleet(DefaultTunables(), 42)
	f.SetScenario(s)
	for i := 0; i < 40; i++ {
		f.Tick()
	}
	return f.Snapshot()
}

func gpu(s Snapshot, uuid string) SnapshotGPU {
	for _, g := range s.GPUs {
		if g.UUID == uuid {
			return g
		}
	}
	return SnapshotGPU{}
}

func svc(s Snapshot, model string) SnapshotSvc {
	for _, x := range s.Services {
		if strings.HasPrefix(x.Model, model) {
			return x
		}
	}
	return SnapshotSvc{}
}

func TestHealthyIsHealthy(t *testing.T) {
	s := settle(t, ScenarioHealthy)
	for _, g := range s.GPUs {
		if g.Throttled {
			t.Errorf("%s throttling in the healthy scenario (temp %.1fC)", g.UUID, g.TempC)
		}
	}
	if p95 := svc(s, "llama").TtftP95Ms; p95 > 1200 {
		t.Errorf("healthy p95 TTFT %.0fms already breaches the 1200ms SLO", p95)
	}
}

// The load-bearing test. Thermal throttle and traffic surge BOTH raise p95
// TTFT. If the simulator cannot produce two states that a clock-and-rate check
// separates, it cannot be used to develop or demo the correlation engine —
// which is the only reason this service exists.
func TestThermalAndSurgeAreDistinguishable(t *testing.T) {
	base := settle(t, ScenarioHealthy)
	therm := settle(t, ScenarioThermal)
	surge := settle(t, ScenarioSurge)

	baseP95 := svc(base, "llama").TtftP95Ms
	thermP95 := svc(therm, "llama").TtftP95Ms
	surgeP95 := svc(surge, "llama").TtftP95Ms

	// 1. Both must actually degrade latency, or there is nothing to diagnose.
	if thermP95 <= baseP95*1.3 {
		t.Errorf("thermal throttle barely moved p95: %.0f → %.0fms", baseP95, thermP95)
	}
	if surgeP95 <= baseP95*1.3 {
		t.Errorf("traffic surge barely moved p95: %.0f → %.0fms", baseP95, surgeP95)
	}

	// 2. Thermal: the fault GPU throttles, its sibling does not. That asymmetry
	//    is the evidence line "sibling GPU shows no regression".
	tf := gpu(therm, faultGPU)
	if !tf.Throttled {
		t.Errorf("thermal scenario: %s not throttling (temp %.1fC, clock %.0fMHz)", tf.UUID, tf.TempC, tf.ClockMHz)
	}
	if sib := gpu(therm, "GPU-4e5f6a7b"); sib.Throttled {
		t.Errorf("thermal scenario: sibling %s should stay healthy, but is throttling at %.1fC", sib.UUID, sib.TempC)
	}

	// 3. Surge: no throttling anywhere — the clock check exonerates the hardware.
	if sf := gpu(surge, faultGPU); sf.Throttled {
		t.Errorf("surge scenario: %s throttling at %.1fC — the decoy is contaminated, "+
			"an engine cannot use clock to rule out hardware", sf.UUID, sf.TempC)
	}

	// 4. The discriminator: request rate is flat under thermal, up under surge.
	baseReq := svc(base, "llama").ReqPerMin
	thermReq := svc(therm, "llama").ReqPerMin
	surgeReq := svc(surge, "llama").ReqPerMin

	if d := abs(thermReq-baseReq) / baseReq; d > 0.15 {
		t.Errorf("thermal scenario moved request rate by %.0f%% (%.0f → %.0f); it must stay flat "+
			"or 'traffic did not rise' is not provable", d*100, baseReq, thermReq)
	}
	if surgeReq <= baseReq*1.4 {
		t.Errorf("surge scenario only moved request rate %.0f → %.0f; too weak to be the load signal", baseReq, surgeReq)
	}

	t.Logf("thermal: p95 %.0f→%.0fms, clock %.0fMHz, req flat at %.0f/min",
		baseP95, thermP95, tf.ClockMHz, thermReq)
	t.Logf("surge:   p95 %.0f→%.0fms, clock %.0fMHz, req %.0f→%.0f/min",
		baseP95, surgeP95, gpu(surge, faultGPU).ClockMHz, baseReq, surgeReq)
}

func TestKVSaturationRaisesQueueWithoutThrottling(t *testing.T) {
	s := settle(t, ScenarioKVSat)
	sv := svc(s, "llama")
	if sv.KVCachePct < 85 {
		t.Errorf("KV cache only reached %.1f%%; expected saturation", sv.KVCachePct)
	}
	if sv.QueueDepth < 10 {
		t.Errorf("queue depth %d — saturation should back requests up", sv.QueueDepth)
	}
	if g := gpu(s, faultGPU); g.Throttled {
		t.Errorf("KV saturation must not throttle the GPU, else it is indistinguishable from thermal")
	}
}

func TestXidFaultAccumulates(t *testing.T) {
	s := settle(t, ScenarioXid)
	if g := gpu(s, faultGPU); g.XidErrors == 0 {
		t.Error("xid scenario produced no XID errors")
	}
	if g := gpu(s, "GPU-4e5f6a7b"); g.XidErrors != 0 {
		t.Errorf("XID errors leaked onto the healthy sibling (%d)", g.XidErrors)
	}
}

// The collector scrapes this output with the same config it uses on real
// hardware, so the metric names and label keys are part of the contract.
func TestExpositionFormatMatchesRealExporters(t *testing.T) {
	f := NewFleet(DefaultTunables(), 7)
	f.Tick()
	out := f.Render()

	required := []string{
		// DCGM exporter metric names
		"DCGM_FI_DEV_GPU_UTIL", "DCGM_FI_DEV_GPU_TEMP", "DCGM_FI_DEV_SM_CLOCK",
		"DCGM_FI_DEV_POWER_USAGE", "DCGM_FI_DEV_FB_USED", "DCGM_FI_DEV_XID_ERRORS",
		// DCGM label keys the collector relabels on
		`UUID="GPU-`, `Hostname="gpu-a-04"`, `modelName="NVIDIA H100`,
		// vLLM metric names
		"vllm:time_to_first_token_seconds_bucket", "vllm:time_to_first_token_seconds_sum",
		"vllm:time_to_first_token_seconds_count", "vllm:num_requests_waiting",
		"vllm:gpu_cache_usage_perc", "vllm:request_success_total",
		`model_name="llama-3.3-70b-instruct"`,
		// exposition format structure
		"# HELP ", "# TYPE ", `le="+Inf"`,
	}
	for _, want := range required {
		if !strings.Contains(out, want) {
			t.Errorf("exposition output missing %q — collector config would need changing for real hardware", want)
		}
	}

	// Every non-comment line must be `name{labels} value` with a parseable float.
	for _, line := range strings.Split(out, "\n") {
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		i := strings.LastIndex(line, " ")
		if i < 0 {
			t.Errorf("malformed exposition line: %q", line)
			continue
		}
		if !strings.ContainsAny(line[i+1:], "0123456789") {
			t.Errorf("non-numeric value in exposition line: %q", line)
		}
	}
}

func abs(f float64) float64 {
	if f < 0 {
		return -f
	}
	return f
}

// Prometheus histogram invariants: buckets monotonic within a scrape, and
// _count monotonic ACROSS scrapes. Violating either corrupts every quantile
// and every rate computed downstream.
func TestHistogramIsCumulative(t *testing.T) {
	f := NewFleet(DefaultTunables(), 3)

	countAt := func() uint64 {
		out := f.Render()
		var last uint64
		var total uint64
		for _, line := range strings.Split(out, "\n") {
			if !strings.HasPrefix(line, "vllm:time_to_first_token_seconds_bucket{model_name=\"llama-3.3-70b-instruct\"") {
				continue
			}
			var n uint64
			if k := strings.LastIndex(line, " "); k >= 0 {
				_, _ = fmt.Sscanf(line[k+1:], "%d", &n)
			}
			if n < last {
				t.Errorf("buckets not monotonic within a scrape: %d after %d", n, last)
			}
			last = n
			if strings.Contains(line, `le="+Inf"`) {
				total = n
			}
		}
		return total
	}

	f.Tick()
	first := countAt()
	for i := 0; i < 5; i++ {
		f.Tick()
	}
	later := countAt()

	if first == 0 {
		t.Fatal("no requests recorded")
	}
	if later <= first {
		t.Errorf("_count did not grow across ticks (%d -> %d) — it is a snapshot, not a counter, "+
			"so any rate derived from it measures scrape frequency, not load", first, later)
	}
}

// The traffic-surge rule derives request rate from this counter's slope. If the
// slope does not track load, that rule can never fire on real telemetry.
func TestCounterSlopeTracksLoad(t *testing.T) {
	measure := func(sc Scenario) uint64 {
		f := NewFleet(DefaultTunables(), 5)
		f.SetTickSeconds(5)
		f.SetScenario(sc)
		for i := 0; i < 20; i++ {
			f.Tick()
		}
		for _, s := range f.Services {
			if strings.HasPrefix(s.Model, "llama") {
				return s.TtftCountCum
			}
		}
		return 0
	}
	base := measure(ScenarioHealthy)
	surge := measure(ScenarioSurge)
	if base == 0 {
		t.Fatal("no baseline requests")
	}
	ratio := float64(surge) / float64(base)
	if ratio < 1.4 {
		t.Errorf("surge produced only %.2fx the requests of baseline (%d vs %d); "+
			"the counter is not tracking load", ratio, surge, base)
	}
	t.Logf("healthy %d requests, surge %d requests — %.2fx", base, surge, ratio)
}

// Without this binding the engine cannot attribute a model's latency to a
// specific card, which is the entire premise of the correlation.
func TestModelGpuBindingIsPublished(t *testing.T) {
	f := NewFleet(DefaultTunables(), 11)
	f.Tick()
	out := f.Render()
	for _, want := range []string{
		`orchestr8_model_gpu_binding{model_name="llama-3.3-70b-instruct",UUID="GPU-0a1b2c3d",Hostname="gpu-a-04"} 1`,
		`orchestr8_model_gpu_binding{model_name="llama-3.3-70b-instruct",UUID="GPU-4e5f6a7b",Hostname="gpu-a-05"} 1`,
		`orchestr8_model_gpu_binding{model_name="bge-large-en-v1.5",UUID="GPU-8c9d0e1f",Hostname="gpu-b-01"} 1`,
	} {
		if !strings.Contains(out, want) {
			t.Errorf("missing binding: %s", want)
		}
	}
}
