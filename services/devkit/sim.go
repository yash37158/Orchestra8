package main

import (
	"fmt"
	"math"
	"math/rand"
	"strings"
	"sync"
	"time"
)

// The device simulator. Emits DCGM exporter and vLLM metrics in the real
// Prometheus exposition format so the OTel collector scrapes it with the same
// config it would use against real hardware — swapping in a real GPU is an
// endpoint change, not a code change.
//
// The point is NOT to produce plausible-looking noise. It is to produce the
// specific *correlation signatures* the engine must learn to tell apart:
// a thermal throttle and a traffic surge both raise p95 TTFT, and only one of
// them is the GPU's fault. A generator that cannot express that difference is
// useless for developing the thing this product sells.

// ---------------------------------------------------------------- tunables
//
// ponytail: these are calibration knobs, not constants. Real silicon throttles
// at a temperature that depends on chassis airflow, and real TTFT depends on
// model size and batch shape. Measured values from real hardware replace these.
type Tunables struct {
	ThrottleTempC   float64 // temp at which the card starts dropping clocks
	CriticalTempC   float64 // temp at which it drops hard
	BaseClockMHz    float64
	MinClockMHz     float64
	ThermalRiseCPerTick float64
	ThermalFallCPerTick float64
}

func DefaultTunables() Tunables {
	return Tunables{
		ThrottleTempC:       84,
		CriticalTempC:       92,
		BaseClockMHz:        1980, // H100 SXM5 boost
		MinClockMHz:         1200,
		ThermalRiseCPerTick: 1.4,
		ThermalFallCPerTick: 2.2,
	}
}

type GPU struct {
	UUID       string
	Index      int
	Host       string
	Model      string
	MemTotalGB float64

	TempC     float64
	ClockMHz  float64
	UtilPct   float64
	MemUsedGB float64
	PowerW    float64
	XidErrors int
}

type Service struct {
	Model     string
	Engine    string
	GPUs      []string // UUIDs backing this service
	Replicas  int

	ReqPerMin    float64
	QueueDepth   int
	KVCachePct   float64
	BaseTtftMs   float64 // TTFT at full clock with an empty queue
	TtftSamples  []float64 // most recent tick only, for /debug and tests
	SuccessTotal int
	ErrorTotal   int

	// Prometheus histograms are CUMULATIVE counters: buckets, sum and count all
	// grow monotonically for the lifetime of the process. Emitting a per-tick
	// snapshot instead makes _count a constant, so anything downstream that
	// derives a REQUEST RATE from it measures scrape frequency rather than load
	// — and a traffic-surge rule built on that can never fire.
	TtftBucketsCum []uint64
	TtftSumCum     float64
	TtftCountCum   uint64
}

type Fleet struct {
	mu       sync.Mutex
	tun      Tunables
	GPUs     []*GPU
	Services []*Service
	scenario Scenario
	tick        int
	tickSeconds float64
	rng         *rand.Rand
}

func NewFleet(tun Tunables, seed int64) *Fleet {
	gpus := []*GPU{
		{UUID: "GPU-0a1b2c3d", Index: 0, Host: "gpu-a-04", Model: "NVIDIA H100 80GB HBM3", MemTotalGB: 80},
		{UUID: "GPU-4e5f6a7b", Index: 1, Host: "gpu-a-05", Model: "NVIDIA H100 80GB HBM3", MemTotalGB: 80},
		{UUID: "GPU-8c9d0e1f", Index: 0, Host: "gpu-b-01", Model: "NVIDIA A100-SXM4-40GB", MemTotalGB: 40},
	}
	for _, g := range gpus {
		g.TempC = 62
		g.ClockMHz = tun.BaseClockMHz
		g.UtilPct = 70
		g.MemUsedGB = g.MemTotalGB * 0.6
		g.PowerW = 400
	}
	svcs := []*Service{
		{
			Model: "llama-3.3-70b-instruct", Engine: "vllm", Replicas: 6,
			GPUs:       []string{"GPU-0a1b2c3d", "GPU-4e5f6a7b"},
			ReqPerMin:  340, BaseTtftMs: 520, KVCachePct: 48,
		},
		{
			Model: "bge-large-en-v1.5", Engine: "triton", Replicas: 4,
			GPUs:       []string{"GPU-8c9d0e1f"},
			ReqPerMin:  1200, BaseTtftMs: 16, KVCachePct: 12,
		},
	}
	return &Fleet{tun: tun, GPUs: gpus, Services: svcs, scenario: ScenarioHealthy, tickSeconds: 5, rng: rand.New(rand.NewSource(seed))}
}

func (f *Fleet) SetScenario(s Scenario) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.scenario = s
	f.tick = 0
}

func (f *Fleet) Scenario() Scenario {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.scenario
}

// Tick advances the simulation one step. Physics first, then metrics — the
// correlation between temperature and latency emerges from the model rather
// than being scripted, which is what makes the generated data worth testing against.
func (f *Fleet) Tick() {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.tick++

	eff := f.scenario.effect(f.tick)

	for _, g := range f.GPUs {
		target := 66 + eff.tempBiasC(g.UUID)
		if g.TempC < target {
			g.TempC = math.Min(target, g.TempC+f.tun.ThermalRiseCPerTick)
		} else {
			g.TempC = math.Max(target, g.TempC-f.tun.ThermalFallCPerTick)
		}
		g.TempC += f.jitter(0.35)

		// Thermal throttle: clocks fall linearly once past the throttle point.
		// This is the whole reason a GPU can be "99% busy" and slow at once.
		g.ClockMHz = f.tun.BaseClockMHz
		if g.TempC > f.tun.ThrottleTempC {
			span := f.tun.CriticalTempC - f.tun.ThrottleTempC
			over := math.Min(g.TempC-f.tun.ThrottleTempC, span)
			g.ClockMHz = f.tun.BaseClockMHz - (f.tun.BaseClockMHz-f.tun.MinClockMHz)*(over/span)
		}

		// Utilization stays pinned high while throttling — the trap.
		g.UtilPct = math.Min(99.8, 88+eff.loadBias*8+f.jitter(1.2))
		g.MemUsedGB = math.Min(g.MemTotalGB*0.98, g.MemTotalGB*(0.58+eff.memBias)+f.jitter(0.4))
		g.PowerW = 380 + (g.UtilPct/100)*320*(g.ClockMHz/f.tun.BaseClockMHz) + f.jitter(8)
		g.XidErrors += eff.xidFor(g.UUID)
	}

	for _, s := range f.Services {
		s.ReqPerMin = math.Max(1, s.baseReq()*(1+eff.loadBias)+f.jitter(6))
		s.KVCachePct = clamp(s.baseKV()+eff.kvBias*100+f.jitter(1.0), 0, 99.5)

		// TTFT degrades with clock loss and with queueing. Both paths raise p95,
		// which is exactly why p95 alone never identifies the cause.
		clockRatio := f.slowestClockRatio(s)
		kvPressure := math.Max(0, (s.KVCachePct-80)/20) // bites above 80%
		loadPressure := math.Max(0, eff.loadBias)

		ttft := s.BaseTtftMs / clockRatio
		ttft *= 1 + 1.9*kvPressure
		ttft *= 1 + 1.4*loadPressure

		s.QueueDepth = int(math.Max(0, (ttft/s.BaseTtftMs-1)*38+f.jitter(1.5)))

		// Requests actually served this tick, so the cumulative counter grows in
		// proportion to load and a rate derived from it is real.
		n := int(math.Max(1, s.ReqPerMin*f.tickSeconds/60))
		s.TtftSamples = f.sampleTtftN(ttft, n)
		if s.TtftBucketsCum == nil {
			s.TtftBucketsCum = make([]uint64, len(ttftBuckets)+1)
		}
		for _, v := range s.TtftSamples {
			s.TtftSumCum += v / 1000
			s.TtftCountCum++
			placed := false
			for i, le := range ttftBuckets {
				if v/1000 <= le {
					s.TtftBucketsCum[i]++
					placed = true
					break
				}
			}
			if !placed {
				s.TtftBucketsCum[len(ttftBuckets)]++
			}
		}
		s.SuccessTotal += n
		if s.KVCachePct > 97 {
			s.ErrorTotal += 1 + f.rng.Intn(3)
		}
	}
}

// slowestClockRatio: a service is only as fast as its worst GPU, which is why a
// single throttling card degrades a whole model's p95.
func (f *Fleet) slowestClockRatio(s *Service) float64 {
	worst := 1.0
	for _, uuid := range s.GPUs {
		for _, g := range f.GPUs {
			if g.UUID == uuid {
				if r := g.ClockMHz / f.tun.BaseClockMHz; r < worst {
					worst = r
				}
			}
		}
	}
	return math.Max(0.3, worst)
}

func (f *Fleet) sampleTtftN(median float64, n int) []float64 {
	out := make([]float64, n)
	for i := range out {
		// Lognormal-ish: a long right tail is what makes p95 meaningful.
		out[i] = median * math.Exp(f.rng.NormFloat64()*0.42)
	}
	return out
}

func (f *Fleet) jitter(scale float64) float64 { return (f.rng.Float64() - 0.5) * 2 * scale }

func (s *Service) baseReq() float64 {
	if s.Engine == "vllm" {
		return 340
	}
	return 1200
}
func (s *Service) baseKV() float64 {
	if s.Engine == "vllm" {
		return 48
	}
	return 12
}

func clamp(v, lo, hi float64) float64 { return math.Max(lo, math.Min(hi, v)) }

// Quantile over the current TTFT window. Used by the self-check and by /debug.
func Quantile(xs []float64, q float64) float64 {
	if len(xs) == 0 {
		return 0
	}
	s := append([]float64(nil), xs...)
	for i := 1; i < len(s); i++ {
		for j := i; j > 0 && s[j] < s[j-1]; j-- {
			s[j], s[j-1] = s[j-1], s[j]
		}
	}
	idx := int(q * float64(len(s)-1))
	return s[idx]
}

// -------------------------------------------------------------- exposition

var ttftBuckets = []float64{0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 5.0, 10.0}

// Render writes the Prometheus exposition format that DCGM exporter and vLLM
// actually produce. Metric names and label keys are copied from the real
// exporters — the collector config in services/collector must not need a single
// change when this is swapped for hardware.
func (f *Fleet) Render() string {
	f.mu.Lock()
	defer f.mu.Unlock()
	var b strings.Builder

	dcgm := []struct {
		name, help, typ string
		val             func(*GPU) float64
	}{
		{"DCGM_FI_DEV_GPU_UTIL", "GPU utilization (in %).", "gauge", func(g *GPU) float64 { return g.UtilPct }},
		{"DCGM_FI_DEV_GPU_TEMP", "GPU temperature (in C).", "gauge", func(g *GPU) float64 { return g.TempC }},
		{"DCGM_FI_DEV_SM_CLOCK", "SM clock frequency (in MHz).", "gauge", func(g *GPU) float64 { return g.ClockMHz }},
		{"DCGM_FI_DEV_POWER_USAGE", "Power draw (in W).", "gauge", func(g *GPU) float64 { return g.PowerW }},
		{"DCGM_FI_DEV_FB_USED", "Framebuffer memory used (in MiB).", "gauge", func(g *GPU) float64 { return g.MemUsedGB * 1024 }},
		{"DCGM_FI_DEV_FB_TOTAL", "Framebuffer memory total (in MiB).", "gauge", func(g *GPU) float64 { return g.MemTotalGB * 1024 }},
		{"DCGM_FI_DEV_XID_ERRORS", "Value of the last XID error encountered.", "counter", func(g *GPU) float64 { return float64(g.XidErrors) }},
	}
	for _, m := range dcgm {
		fmt.Fprintf(&b, "# HELP %s %s\n# TYPE %s %s\n", m.name, m.help, m.name, m.typ)
		for _, g := range f.GPUs {
			fmt.Fprintf(&b, "%s{gpu=\"%d\",UUID=\"%s\",device=\"nvidia%d\",modelName=\"%s\",Hostname=\"%s\"} %.2f\n",
				m.name, g.Index, g.UUID, g.Index, g.Model, g.Host, m.val(g))
		}
	}

	fmt.Fprintf(&b, "# HELP vllm:time_to_first_token_seconds Histogram of time to first token.\n# TYPE vllm:time_to_first_token_seconds histogram\n")
	for _, s := range f.Services {
		// Prometheus histogram buckets are CUMULATIVE: each le carries the count
		// of every sample at or below it, monotonically increasing to _count.
		// Emitting per-bucket deltas here makes every downstream quantile wrong.
		// Cumulative across the process lifetime, and monotonic by construction.
		var running uint64
		for i, le := range ttftBuckets {
			running += s.TtftBucketsCum[i]
			fmt.Fprintf(&b, "vllm:time_to_first_token_seconds_bucket{model_name=\"%s\",le=\"%g\"} %d\n", s.Model, le, running)
		}
		fmt.Fprintf(&b, "vllm:time_to_first_token_seconds_bucket{model_name=\"%s\",le=\"+Inf\"} %d\n", s.Model, s.TtftCountCum)
		fmt.Fprintf(&b, "vllm:time_to_first_token_seconds_sum{model_name=\"%s\"} %.4f\n", s.Model, s.TtftSumCum)
		fmt.Fprintf(&b, "vllm:time_to_first_token_seconds_count{model_name=\"%s\"} %d\n", s.Model, s.TtftCountCum)
	}

	gauges := []struct {
		name, help string
		val        func(*Service) float64
	}{
		{"vllm:num_requests_waiting", "Number of requests waiting to be processed.", func(s *Service) float64 { return float64(s.QueueDepth) }},
		{"vllm:num_requests_running", "Number of requests currently running.", func(s *Service) float64 { return float64(s.Replicas * 4) }},
		{"vllm:gpu_cache_usage_perc", "GPU KV-cache usage. 1 means 100 percent.", func(s *Service) float64 { return s.KVCachePct / 100 }},
		{"vllm:avg_generation_throughput_toks_per_s", "Average generation throughput.", func(s *Service) float64 { return s.ReqPerMin * 4.2 }},
	}
	for _, m := range gauges {
		fmt.Fprintf(&b, "# HELP %s %s\n# TYPE %s gauge\n", m.name, m.help, m.name)
		for _, s := range f.Services {
			fmt.Fprintf(&b, "%s{model_name=\"%s\"} %.4f\n", m.name, s.Model, m.val(s))
		}
	}

	fmt.Fprintf(&b, "# HELP vllm:request_success_total Count of successfully processed requests.\n# TYPE vllm:request_success_total counter\n")
	for _, s := range f.Services {
		fmt.Fprintf(&b, "vllm:request_success_total{model_name=\"%s\"} %d\n", s.Model, s.SuccessTotal)
	}

	// Which GPUs serve which model. In a real cluster the collector derives this
	// from Kubernetes metadata (pod -> node -> device plugin allocation) via the
	// k8sattributes processor. There is no k8s here, so the simulator publishes
	// it directly — same shape, same join key, so the engine's query is
	// unchanged when real metadata replaces it.
	fmt.Fprintf(&b, "# HELP orchestr8_model_gpu_binding Model-to-GPU assignment (1 = assigned).\n# TYPE orchestr8_model_gpu_binding gauge\n")
	for _, s := range f.Services {
		for _, uuid := range s.GPUs {
			host := ""
			for _, g := range f.GPUs {
				if g.UUID == uuid {
					host = g.Host
				}
			}
			fmt.Fprintf(&b, "orchestr8_model_gpu_binding{model_name=\"%s\",UUID=\"%s\",Hostname=\"%s\"} 1\n", s.Model, uuid, host)
		}
	}

	fmt.Fprintf(&b, "# HELP orchestr8_devkit_scenario Active simulator scenario (1 = active).\n# TYPE orchestr8_devkit_scenario gauge\n")
	fmt.Fprintf(&b, "orchestr8_devkit_scenario{scenario=\"%s\"} 1\n", f.scenario)
	_ = time.Now()
	return b.String()
}

// Snapshot is the human-readable view used by /debug and by the tests.
type Snapshot struct {
	Scenario Scenario         `json:"scenario"`
	Tick     int              `json:"tick"`
	GPUs     []SnapshotGPU    `json:"gpus"`
	Services []SnapshotSvc    `json:"services"`
}

type SnapshotGPU struct {
	UUID     string  `json:"uuid"`
	Host     string  `json:"host"`
	TempC    float64 `json:"tempC"`
	ClockMHz float64 `json:"clockMHz"`
	UtilPct  float64 `json:"utilPct"`
	Throttled bool   `json:"throttled"`
	XidErrors int    `json:"xidErrors"`
}

type SnapshotSvc struct {
	Model      string  `json:"model"`
	TtftP50Ms  float64 `json:"ttftP50Ms"`
	TtftP95Ms  float64 `json:"ttftP95Ms"`
	ReqPerMin  float64 `json:"reqPerMin"`
	QueueDepth int     `json:"queueDepth"`
	KVCachePct float64 `json:"kvCachePct"`
}

func (f *Fleet) Snapshot() Snapshot {
	f.mu.Lock()
	defer f.mu.Unlock()
	s := Snapshot{Scenario: f.scenario, Tick: f.tick}
	for _, g := range f.GPUs {
		s.GPUs = append(s.GPUs, SnapshotGPU{
			UUID: g.UUID, Host: g.Host, TempC: round(g.TempC), ClockMHz: round(g.ClockMHz),
			UtilPct: round(g.UtilPct), Throttled: g.ClockMHz < f.tun.BaseClockMHz*0.98, XidErrors: g.XidErrors,
		})
	}
	for _, sv := range f.Services {
		s.Services = append(s.Services, SnapshotSvc{
			Model: sv.Model, TtftP50Ms: round(Quantile(sv.TtftSamples, 0.50)),
			TtftP95Ms: round(Quantile(sv.TtftSamples, 0.95)), ReqPerMin: round(sv.ReqPerMin),
			QueueDepth: sv.QueueDepth, KVCachePct: round(sv.KVCachePct),
		})
	}
	return s
}

func round(v float64) float64 { return math.Round(v*10) / 10 }

// SetTickSeconds tells the fleet how much simulated time one tick represents,
// so request counts scale correctly with the configured interval.
func (f *Fleet) SetTickSeconds(s float64) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if s > 0 {
		f.tickSeconds = s
	}
}
