package main

import "math"

// A Scenario biases the physics. Each one exists to produce a distinct
// correlation signature — in particular, thermal-throttle and traffic-surge
// BOTH raise p95 TTFT, and the correlation engine has to tell them apart from
// clock and request rate. If the engine can only see p95, it blames the wrong
// thing half the time.
type Scenario string

const (
	ScenarioHealthy   Scenario = "healthy"
	ScenarioThermal   Scenario = "thermal-throttle"
	ScenarioKVSat     Scenario = "kv-saturation"
	ScenarioSurge     Scenario = "traffic-surge"
	ScenarioXid       Scenario = "xid-fault"
)

func AllScenarios() []Scenario {
	return []Scenario{ScenarioHealthy, ScenarioThermal, ScenarioKVSat, ScenarioSurge, ScenarioXid}
}

func ParseScenario(s string) (Scenario, bool) {
	for _, sc := range AllScenarios() {
		if string(sc) == s {
			return sc, true
		}
	}
	return "", false
}

// The GPU a fault lands on. Faults are deliberately scoped to ONE card so the
// sibling stays healthy — "the other GPU on the same node is fine" is the
// strongest single piece of evidence that a fault is local, not systemic.
const faultGPU = "GPU-0a1b2c3d"

type effect struct {
	tempBias map[string]float64
	xid      map[string]int
	loadBias float64 // fraction above baseline request rate
	memBias  float64
	kvBias   float64 // fraction added to KV-cache usage
}

func (e effect) tempBiasC(uuid string) float64 { return e.tempBias[uuid] }
func (e effect) xidFor(uuid string) int        { return e.xid[uuid] }

// ramp eases a fault in over ~8 ticks so the onset has a slope the engine can
// measure. An instantaneous step is not something real hardware does, and an
// engine tuned against step changes misfires on real gradual degradation.
func ramp(tick, over int) float64 {
	if tick <= 0 {
		return 0
	}
	return math.Min(1, float64(tick)/float64(over))
}

func (s Scenario) effect(tick int) effect {
	e := effect{tempBias: map[string]float64{}, xid: map[string]int{}}
	r := ramp(tick, 8)

	switch s {
	case ScenarioThermal:
		// One card overheats. Load is untouched — that is the whole point.
		e.tempBias[faultGPU] = 26 * r

	case ScenarioKVSat:
		// Longer contexts fill the KV cache. Temperature is normal.
		e.kvBias = 0.48 * r

	case ScenarioSurge:
		// Genuine load increase. Temps rise a little because the card is busier,
		// but nowhere near the throttle point — the decoy.
		e.loadBias = 1.3 * r
		for _, g := range []string{faultGPU, "GPU-4e5f6a7b", "GPU-8c9d0e1f"} {
			e.tempBias[g] = 6 * r
		}

	case ScenarioXid:
		// Hardware fault. Rare, discrete, and the reason to drain a node.
		if tick%12 == 0 {
			e.xid[faultGPU] = 1
		}
		e.tempBias[faultGPU] = 9 * r
	}
	return e
}
