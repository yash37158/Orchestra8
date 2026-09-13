package main

import (
	"context"
	"fmt"
	"net/http"
	"time"
)

// Time series behind a piece of evidence.
//
// This is what turns "the GPU was throttling" from a claim into something the
// reader can check. The window comes from the evidence record itself, so a
// correlation opened tomorrow shows the same window the engine examined — not
// "the last 15 minutes" relative to whenever the page happens to load.

type seriesPoint struct {
	T string  `json:"t"`
	V float64 `json:"v"`
}

// Time bounds are passed as Unix EPOCH integers, and timestamps come back the
// same way. ClickHouse renders and parses naive DateTime strings in the
// server's local timezone, so a string round-trip silently shifts every window
// by the UTC offset — on a +05:30 host the query window and the data never
// overlap and the result is an empty series with no error. An integer has no
// timezone. toDateTime(<int>) is an absolute instant and still uses the index.
const qSeriesGauge = `
SELECT toUnixTimestamp(toStartOfInterval(TimeUnix, INTERVAL %d SECOND)) AS t,
       round(avg(Value), 2) AS v
FROM orchestr8.otel_metrics_gauge
WHERE %s AND MetricName = %s
  AND TimeUnix >= toDateTime(%d) AND TimeUnix <= toDateTime(%d)
  %s
GROUP BY t ORDER BY t`

const qSeriesHistP95 = `
SELECT toUnixTimestamp(toStartOfInterval(TimeUnix, INTERVAL %d SECOND)) AS t,
       any(ExplicitBounds) AS bounds, sumForEach(BucketCounts) AS buckets
FROM orchestr8.otel_metrics_histogram
WHERE %s AND MetricName = 'vllm:time_to_first_token_seconds'
  AND TimeUnix >= toDateTime(%d) AND TimeUnix <= toDateTime(%d)
  AND Attributes['model_name'] = %s
GROUP BY t ORDER BY t`

// handleSeries serves GET /v1/series?metric=&subject=&from=&to=
func handleSeries(w http.ResponseWriter, r *http.Request, c *chClient) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	q := r.URL.Query()
	metric, subject := q.Get("metric"), q.Get("subject")
	from, to := q.Get("from"), q.Get("to")
	if metric == "" || from == "" || to == "" {
		http.Error(w, "metric, from and to are required", http.StatusBadRequest)
		return
	}
	// Widen a very short window so a sparkline has something to draw.
	fromT, err1 := time.Parse(time.RFC3339Nano, from)
	toT, err2 := time.Parse(time.RFC3339Nano, to)
	if err1 != nil || err2 != nil {
		http.Error(w, "from and to must be RFC3339", http.StatusBadRequest)
		return
	}
	if toT.Sub(fromT) < 5*time.Minute {
		fromT = toT.Add(-5 * time.Minute)
	}
	bucket := int(toT.Sub(fromT).Seconds() / 40)
	if bucket < 5 {
		bucket = 5
	}

	pts, err := querySeries(r.Context(), c, orgFromRequest(r), metric, subject, fromT, toT, bucket)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]any{
		"metric": metric, "subject": subject,
		"from": fromT.UTC().Format(time.RFC3339Nano), "to": toT.UTC().Format(time.RFC3339Nano),
		"points": pts,
	})
}

func querySeries(ctx context.Context, c *chClient, org, metric, subject string, from, to time.Time, bucket int) ([]seriesPoint, error) {
	f, t := from.Unix(), to.Unix()

	// TTFT is a histogram, so a p95 per bucket has to be interpolated rather
	// than averaged out of a gauge.
	if metric == "vllm:time_to_first_token_seconds" {
		var rows []struct {
			T       int64     `json:"t"`
			Bounds  []float64 `json:"bounds"`
			Buckets []uint64  `json:"buckets"`
		}
		if err := c.query(ctx, fmt.Sprintf(qSeriesHistP95, bucket, orgClauseRaw(org), f, t, chQuote(subject)), &rows); err != nil {
			return nil, err
		}
		out := make([]seriesPoint, 0, len(rows))
		for _, r := range rows {
			out = append(out, seriesPoint{
				T: time.Unix(r.T, 0).UTC().Format(time.RFC3339Nano),
				V: round1(histQuantile(r.Bounds, r.Buckets, 0.95) * 1000),
			})
		}
		return out, nil
	}

	// Gauges: DCGM metrics key on UUID, vLLM gauges on model_name.
	filter := ""
	if subject != "" {
		key := "model_name"
		if len(metric) > 5 && metric[:5] == "DCGM_" {
			key = "UUID"
		}
		filter = fmt.Sprintf("AND Attributes[%s] = %s", chQuote(key), chQuote(subject))
	}
	var raw []struct {
		T int64   `json:"t"`
		V float64 `json:"v"`
	}
	if err := c.query(ctx, fmt.Sprintf(qSeriesGauge, bucket, orgClauseRaw(org), chQuote(metric), f, t, filter), &raw); err != nil {
		return nil, err
	}
	pts := make([]seriesPoint, 0, len(raw))
	for _, r := range raw {
		pts = append(pts, seriesPoint{T: time.Unix(r.T, 0).UTC().Format(time.RFC3339Nano), V: r.V})
	}
	return pts, nil
}
