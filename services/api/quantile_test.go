package main

import (
	"math"
	"testing"
)

// histQuantile is the one piece of real arithmetic in this service. A quantile
// that is quietly wrong produces SLO verdicts that are quietly wrong, so it
// gets checked against hand-computable cases.
func TestHistQuantile(t *testing.T) {
	bounds := []float64{1, 2, 3, 4}

	cases := []struct {
		name    string
		buckets []uint64
		q       float64
		want    float64
	}{
		// 100 samples spread evenly over [0,1): the median sits mid-bucket.
		{"single bucket median", []uint64{100, 0, 0, 0, 0}, 0.5, 0.5},
		// 50 in [0,1), 50 in [1,2): p50 lands exactly on the 1.0 boundary.
		{"boundary", []uint64{50, 50, 0, 0, 0}, 0.5, 1.0},
		// p95 of the same: 95th of 100 is 45 into the second bucket of 50.
		{"p95 interpolates within bucket", []uint64{50, 50, 0, 0, 0}, 0.95, 1.9},
		// Everything in the +Inf bucket: no upper edge exists to interpolate to,
		// so report the last explicit bound rather than invent a value.
		{"overflow clamps to last bound", []uint64{0, 0, 0, 0, 10}, 0.95, 4},
		{"empty is zero", []uint64{0, 0, 0, 0, 0}, 0.95, 0},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := histQuantile(bounds, c.buckets, c.q)
			if math.Abs(got-c.want) > 1e-9 {
				t.Errorf("histQuantile(%v, q=%g) = %g, want %g", c.buckets, c.q, got, c.want)
			}
		})
	}
}

// Guards the specific mistake the schema comments warn about: a p95 taken over
// merged buckets is not the average of per-window p95s.
func TestQuantileOverMergedBucketsIsNotAverageOfQuantiles(t *testing.T) {
	bounds := []float64{1, 2, 3, 4}
	slow := []uint64{0, 0, 0, 100, 0} // all in [3,4)
	fast := []uint64{100, 0, 0, 0, 0} // all in [0,1)

	p95slow := histQuantile(bounds, slow, 0.95)
	p95fast := histQuantile(bounds, fast, 0.95)
	avgOfQuantiles := (p95slow + p95fast) / 2

	merged := make([]uint64, len(slow))
	for i := range slow {
		merged[i] = slow[i] + fast[i]
	}
	quantileOfMerged := histQuantile(bounds, merged, 0.95)

	if math.Abs(avgOfQuantiles-quantileOfMerged) < 0.5 {
		t.Fatalf("test is not exercising the difference: avg=%g merged=%g", avgOfQuantiles, quantileOfMerged)
	}
	if quantileOfMerged < 3.5 {
		t.Errorf("p95 of merged buckets = %g; with half the mass in [3,4) it must land there", quantileOfMerged)
	}
	t.Logf("avg of p95s = %.2f, p95 of merged = %.2f — averaging understates by %.0f%%",
		avgOfQuantiles, quantileOfMerged, (1-avgOfQuantiles/quantileOfMerged)*100)
}
