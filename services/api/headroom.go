package main

// Headroom: how much more load a service has absorbed before it missed its
// target, and what happens if it loses a GPU.
//
// This is a measurement, not a forecast. Every point on the curve is a load
// level this service has actually run at and the latency it actually produced,
// read back out of the same per-minute histograms the dashboard already shows.
// Nothing is fitted, extrapolated or predicted — which is the only reason it
// can be trusted for the decision it exists to support.
//
// The decision is: a card is degrading, do I pull it now or does that breach
// the SLO? Knowing a GPU is failing is not useful on its own. Knowing the
// latency cost of removing it is.

import (
	"context"
	"fmt"
	"log"
	"math"
	"net/http"
	"sort"
)

// loadSample is one minute of history: what the service was carrying, and the
// latency it produced while carrying it.
type loadSample struct {
	ReqPerMin float64
	P95Ms     float64
}

// How far back the curve looks. Long enough to have seen a quiet night and a
// busy afternoon; short enough that the hardware and the model are plausibly
// the same service they are today.
const headroomWindowDays = 7

// A load level has to have been seen for at least this many minutes before it
// is treated as evidence. One unlucky minute during a restart is not a
// measurement of anything.
const minMinutesPerBucket = 3

// CurvePoint is one observed load level and the latency seen at it.
type CurvePoint struct {
	ReqPerMin float64 `json:"reqPerMin"`
	P95Ms     float64 `json:"p95Ms"`
	Minutes   int     `json:"minutes"`
	WithinSlo bool    `json:"withinSlo"`
}

// DrainEstimate answers "what if this service loses one GPU".
//
// Removing one of G GPUs leaves the same traffic to G-1, so each remaining
// card carries G/(G-1) times what it does now. That equivalent load is looked
// up on the curve rather than modelled.
type DrainEstimate struct {
	EquivalentReqPerMin float64 `json:"equivalentReqPerMin"`
	P95Ms               float64 `json:"p95Ms"`
	WithinSlo           bool    `json:"withinSlo"`
	// False when the service has never run at that load, in which case the
	// figures above are absent rather than guessed.
	Observed bool   `json:"observed"`
	Note     string `json:"note"`
}

type Headroom struct {
	ClusterID string  `json:"clusterId"`
	Model     string  `json:"model"`
	SloMs     float64 `json:"sloMs"`
	GpuCount  int     `json:"gpuCount"`

	CurrentReqPerMin float64 `json:"currentReqPerMin"`
	CurrentP95Ms     float64 `json:"currentP95Ms"`

	Curve []CurvePoint `json:"curve"`

	// Highest load observed while still inside the target, and the lowest
	// observed outside it. Both are measurements; either can be absent.
	SafeUpToReqPerMin   *float64 `json:"safeUpToReqPerMin"`
	BreachesAtReqPerMin *float64 `json:"breachesAtReqPerMin"`
	HeadroomPct         *float64 `json:"headroomPct"`

	Drain DrainEstimate `json:"drain"`

	// Why an answer is missing, when one is. Stated rather than left as a
	// blank field the reader has to interpret.
	Sufficient bool   `json:"sufficient"`
	Basis      string `json:"basis"`
}

// buildCurve turns observed (load, p95) minutes into a curve.
//
// Buckets are proportional to the observed range rather than fixed, because a
// service running 20 req/min and one running 20,000 need the same number of
// steps, not the same step size.
func buildCurve(samples []loadSample, sloMs float64) []CurvePoint {
	if len(samples) == 0 {
		return []CurvePoint{}
	}
	lo, hi := samples[0].ReqPerMin, samples[0].ReqPerMin
	for _, s := range samples {
		lo = math.Min(lo, s.ReqPerMin)
		hi = math.Max(hi, s.ReqPerMin)
	}
	// A service that never varies has one point. Reporting that honestly beats
	// inventing a slope through a single cluster of observations.
	width := (hi - lo) / 12
	if width <= 0 {
		width = math.Max(hi, 1)
	}

	type acc struct {
		sumLoad float64
		p95s    []float64
		n       int
	}
	bins := map[int]*acc{}
	for _, s := range samples {
		k := int((s.ReqPerMin - lo) / width)
		a := bins[k]
		if a == nil {
			a = &acc{}
			bins[k] = a
		}
		a.sumLoad += s.ReqPerMin
		a.p95s = append(a.p95s, s.P95Ms)
		a.n++
	}

	out := make([]CurvePoint, 0, len(bins))
	for _, a := range bins {
		if a.n < minMinutesPerBucket {
			continue
		}
		// The median of the minutes in this bin, not the mean: a single
		// restart spike should not redraw the curve.
		sort.Float64s(a.p95s)
		p95 := a.p95s[len(a.p95s)/2]
		load := a.sumLoad / float64(a.n)
		out = append(out, CurvePoint{
			ReqPerMin: round1(load),
			P95Ms:     round1(p95),
			Minutes:   a.n,
			WithinSlo: p95 <= sloMs,
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ReqPerMin < out[j].ReqPerMin })
	return out
}

// lookup reads a load level off the curve by interpolating between the two
// observations either side of it.
//
// Returns false outside the observed range. Extrapolation is what turns a
// measurement into a guess, and a guess is not worth draining a node on.
func lookup(curve []CurvePoint, reqPerMin float64) (float64, bool) {
	if len(curve) < 2 {
		return 0, false
	}
	if reqPerMin < curve[0].ReqPerMin || reqPerMin > curve[len(curve)-1].ReqPerMin {
		return 0, false
	}
	for i := 1; i < len(curve); i++ {
		a, b := curve[i-1], curve[i]
		if reqPerMin > b.ReqPerMin {
			continue
		}
		span := b.ReqPerMin - a.ReqPerMin
		if span <= 0 {
			return b.P95Ms, true
		}
		t := (reqPerMin - a.ReqPerMin) / span
		return a.P95Ms + t*(b.P95Ms-a.P95Ms), true
	}
	return curve[len(curve)-1].P95Ms, true
}

// safeCeiling is the highest observed load still inside the target, and the
// lowest observed load outside it.
func safeCeiling(curve []CurvePoint) (safe, breach *float64) {
	for i := range curve {
		p := curve[i]
		if p.WithinSlo {
			v := p.ReqPerMin
			safe = &v
		} else if breach == nil {
			v := p.ReqPerMin
			breach = &v
		}
	}
	return safe, breach
}

// estimateDrain answers the question the feature exists for.
func estimateDrain(curve []CurvePoint, currentLoad float64, gpus int, sloMs float64) DrainEstimate {
	if gpus < 2 {
		return DrainEstimate{
			Note: "Only one GPU serves this model, so draining it takes the service down. " +
				"There is no latency answer to give.",
		}
	}
	// Same traffic, one fewer card to carry it.
	equivalent := currentLoad * float64(gpus) / float64(gpus-1)
	p95, ok := lookup(curve, equivalent)
	if !ok {
		return DrainEstimate{
			EquivalentReqPerMin: round1(equivalent),
			Note: fmt.Sprintf(
				"This service has never run at %.0f requests a minute, so there is no measurement to report. "+
					"Draining a GPU would take it there.", equivalent),
		}
	}
	return DrainEstimate{
		EquivalentReqPerMin: round1(equivalent),
		P95Ms:               round1(p95),
		WithinSlo:           p95 <= sloMs,
		Observed:            true,
	}
}

// ------------------------------------------------------------------ store

// One row per minute of history: what the service carried, and the histogram
// of how long it took. The quantile is interpolated in Go from the stored
// buckets rather than averaged across minutes, for the same reason the rest of
// the product does it — averaging per-minute p95s is wrong in a way that looks
// plausible.
const qHeadroomHistory = `
SELECT
    toUnixTimestamp(Minute)     AS t,
    any(Bounds)                 AS bounds,
    sumForEachMerge(BucketSums) AS buckets,
    sumMerge(Requests)          AS requests
FROM orchestr8.inference_minute
WHERE %s AND ClusterId = %s AND Model = %s
  AND Minute >= now() - INTERVAL %d DAY
  AND Minute < toStartOfMinute(now())
GROUP BY Minute
ORDER BY Minute`

func (c *chClient) loadHistory(ctx context.Context, org, cluster, model string, days int) ([]loadSample, error) {
	var rows []struct {
		T        int64     `json:"t"`
		Bounds   []float64 `json:"bounds"`
		Buckets  []uint64  `json:"buckets"`
		Requests uint64    `json:"requests"`
	}
	q := fmt.Sprintf(qHeadroomHistory, orgClause(org), chQuote(cluster), chQuote(model), days)
	if err := c.query(ctx, q, &rows); err != nil {
		return nil, err
	}
	out := make([]loadSample, 0, len(rows))
	for _, r := range rows {
		if r.Requests == 0 {
			continue // an idle minute measures nothing about capacity
		}
		out = append(out, loadSample{
			ReqPerMin: float64(r.Requests),
			P95Ms:     histQuantile(r.Bounds, r.Buckets, 0.95) * 1000,
		})
	}
	return out, nil
}

// headroomFor assembles the answer for one service.
func headroomFor(ctx context.Context, c *chClient, org string, s serviceSignal) (*Headroom, error) {
	samples, err := c.loadHistory(ctx, org, s.ClusterID, s.Model, headroomWindowDays)
	if err != nil {
		return nil, err
	}
	gpus := len(s.GPUs)
	h := &Headroom{
		ClusterID: s.ClusterID, Model: s.Model, SloMs: s.SloMs,
		GpuCount:         gpus,
		CurrentReqPerMin: round1(s.ReqRateNow),
		CurrentP95Ms:     round1(s.TtftP95Now),
		Curve:            []CurvePoint{},
	}

	if len(samples) < 30 {
		h.Basis = fmt.Sprintf(
			"Only %d minutes of history. Capacity cannot be read from a service that has barely run.",
			len(samples))
		return h, nil
	}

	h.Curve = buildCurve(samples, s.SloMs)
	h.Drain = estimateDrain(h.Curve, s.ReqRateNow, gpus, s.SloMs)

	if len(h.Curve) < 2 {
		h.Basis = fmt.Sprintf(
			"%d minutes of history, but at one load level throughout. Capacity shows up in the "+
				"difference between a quiet hour and a busy one, and this service has not had both.",
			len(samples))
		return h, nil
	}

	h.Sufficient = true
	h.SafeUpToReqPerMin, h.BreachesAtReqPerMin = safeCeiling(h.Curve)
	if h.SafeUpToReqPerMin != nil && s.ReqRateNow > 0 {
		pct := (*h.SafeUpToReqPerMin - s.ReqRateNow) / s.ReqRateNow * 100
		pct = round1(pct)
		h.HeadroomPct = &pct
	}
	h.Basis = fmt.Sprintf("%d minutes over %d days, %.0f–%.0f requests a minute.",
		len(samples), headroomWindowDays, h.Curve[0].ReqPerMin, h.Curve[len(h.Curve)-1].ReqPerMin)
	return h, nil
}

// ---------------------------------------------------------------- handler

func handleHeadroom(w http.ResponseWriter, r *http.Request, c *chClient, slos *sloStore) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	org := orgFromRequest(r)
	signals, err := collectSignals(r.Context(), c, org, slos.All())
	if err != nil {
		log.Printf("headroom: collect: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	out := make([]Headroom, 0, len(signals))
	for _, s := range signals {
		h, err := headroomFor(r.Context(), c, org, s)
		if err != nil {
			// One service failing to produce a curve must not deny the answer
			// for the others.
			log.Printf("headroom %s/%s: %v", s.ClusterID, s.Model, err)
			continue
		}
		out = append(out, *h)
	}
	writeJSON(w, map[string]any{"services": out})
}
