package main

// The whole value of this feature is that it reports measurements and refuses
// to invent them. So the cases worth pinning down are the refusals: outside
// the observed range, too few minutes, one GPU, a flat history.

import "testing"

// A service whose latency climbs with load, observed across a real range.
func rampSamples() []loadSample {
	var out []loadSample
	for load := 100.0; load <= 700; load += 10 {
		// Gentle up to 500, then it starts to hurt.
		p95 := 400 + load
		if load > 500 {
			p95 = 400 + load + (load-500)*3
		}
		for i := 0; i < 5; i++ { // five minutes at each level
			out = append(out, loadSample{ReqPerMin: load, P95Ms: p95})
		}
	}
	return out
}

func TestCurveIsOrderedAndBounded(t *testing.T) {
	c := buildCurve(rampSamples(), 1200)
	if len(c) < 5 {
		t.Fatalf("got %d points from a wide range of load", len(c))
	}
	for i := 1; i < len(c); i++ {
		if c[i].ReqPerMin <= c[i-1].ReqPerMin {
			t.Errorf("curve is not ordered at %d: %v then %v", i, c[i-1], c[i])
		}
	}
	for _, p := range c {
		if p.Minutes < minMinutesPerBucket {
			t.Errorf("kept a point backed by only %d minutes", p.Minutes)
		}
	}
}

// One unlucky minute at an unusual load is not a measurement of anything.
func TestThinlyObservedLoadIsDiscarded(t *testing.T) {
	samples := rampSamples()
	samples = append(samples, loadSample{ReqPerMin: 5000, P95Ms: 90000})
	for _, p := range buildCurve(samples, 1200) {
		if p.ReqPerMin > 1000 {
			t.Errorf("a single outlier minute became a curve point: %v", p)
		}
	}
}

// Reading outside the observed range must fail rather than extrapolate —
// this is the difference between a measurement and a guess, and somebody is
// going to drain a production node on the answer.
func TestLookupRefusesToExtrapolate(t *testing.T) {
	c := buildCurve(rampSamples(), 1200)
	lo, hi := c[0].ReqPerMin, c[len(c)-1].ReqPerMin

	if _, ok := lookup(c, lo-50); ok {
		t.Error("answered below the observed range")
	}
	if _, ok := lookup(c, hi+50); ok {
		t.Error("answered above the observed range")
	}
	mid, ok := lookup(c, (lo+hi)/2)
	if !ok {
		t.Fatal("refused a load inside the observed range")
	}
	if mid <= 0 {
		t.Errorf("interpolated to %v", mid)
	}
}

func TestLookupInterpolatesBetweenObservations(t *testing.T) {
	c := []CurvePoint{
		{ReqPerMin: 100, P95Ms: 500, Minutes: 10},
		{ReqPerMin: 200, P95Ms: 900, Minutes: 10},
	}
	got, ok := lookup(c, 150)
	if !ok {
		t.Fatal("refused a load between two observations")
	}
	if got != 700 {
		t.Errorf("midpoint = %v, want 700", got)
	}
}

func TestDrainEstimate(t *testing.T) {
	c := buildCurve(rampSamples(), 1200)

	t.Run("a single GPU cannot be drained", func(t *testing.T) {
		d := estimateDrain(c, 300, 1, 1200)
		if d.Observed {
			t.Error("offered a latency figure for taking the service down")
		}
		if d.Note == "" {
			t.Error("refused without saying why")
		}
	})

	t.Run("load after drain is looked up, not modelled", func(t *testing.T) {
		// 300 across 3 GPUs; losing one leaves 3/2 of the load on each.
		d := estimateDrain(c, 300, 3, 1200)
		if !d.Observed {
			t.Fatalf("refused a load inside the observed range: %+v", d)
		}
		if want := 450.0; d.EquivalentReqPerMin != want {
			t.Errorf("equivalent load = %v, want %v", d.EquivalentReqPerMin, want)
		}
		if !d.WithinSlo {
			t.Errorf("450 req/min should still be inside a 1200ms target, got %vms", d.P95Ms)
		}
	})

	t.Run("a drain that breaches is reported as breaching", func(t *testing.T) {
		d := estimateDrain(c, 450, 2, 1200) // -> 900 req/min, beyond the knee
		if d.Observed && d.WithinSlo {
			t.Errorf("claimed 900 req/min is safe: %+v", d)
		}
	})

	t.Run("beyond anything observed, it says so", func(t *testing.T) {
		d := estimateDrain(c, 690, 2, 1200) // -> 1380, past the top of the range
		if d.Observed {
			t.Error("answered for a load never seen")
		}
		if d.Note == "" {
			t.Error("refused without saying why")
		}
	})
}

// A service that has only ever run at one load has no curve, and must not
// pretend otherwise.
func TestFlatHistoryYieldsNoUsableCurve(t *testing.T) {
	var flat []loadSample
	for i := 0; i < 400; i++ {
		flat = append(flat, loadSample{ReqPerMin: 340, P95Ms: 1010})
	}
	c := buildCurve(flat, 1200)
	if len(c) > 1 {
		t.Errorf("invented %d points from a single load level", len(c))
	}
	if _, ok := lookup(c, 500); ok {
		t.Error("answered a question a flat history cannot answer")
	}
	d := estimateDrain(c, 340, 2, 1200)
	if d.Observed {
		t.Error("estimated a drain from a flat history")
	}
}

func TestSafeCeiling(t *testing.T) {
	c := buildCurve(rampSamples(), 1200)
	safe, breach := safeCeiling(c)
	if safe == nil {
		t.Fatal("no safe ceiling from a history that spent most of its time inside target")
	}
	if breach == nil {
		t.Fatal("no breach point from a history that clearly exceeded target")
	}
	if *safe >= *breach {
		t.Errorf("safe ceiling %v is not below the breach point %v", *safe, *breach)
	}
}
