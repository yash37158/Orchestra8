package main

import (
	"context"
	"fmt"
	"time"
)

// Signal assembly for the correlation engine. Every rule reads from the same
// bundle, so rules stay pure functions over a snapshot and can be unit-tested
// without a database.

// Detection windows. Overridable because the right values depend on scrape
// interval and how fast the workload moves — and because a 15-minute baseline
// makes the engine untestable in a dev session.
//
//	nowWindow : the window under examination. Short enough to react, long
//	            enough that one bad scrape cannot produce a verdict.
//	baseFrom/To : what "normal" looked like. The GAP between the two windows
//	            matters; overlapping them washes out the change being detected.
var (
	nowWindow = envDuration("ORCHESTR8_WINDOW_NOW", 3*time.Minute)
	baseFrom  = envDuration("ORCHESTR8_WINDOW_BASE_FROM", 15*time.Minute)
	baseTo    = envDuration("ORCHESTR8_WINDOW_BASE_TO", 5*time.Minute)

	// How long to let a minute settle before trusting it. The collector batches
	// (5s) and the materialized view writes asynchronously, so the most recent
	// "complete" minute keeps growing for a short while after it ends. Reading
	// it too early returns a partial count, which looks exactly like a sudden
	// drop in traffic — and a traffic drop is precisely what the thermal rule
	// uses to rule ITSELF out. One early read tore down a correct diagnosis.
	settle = envDuration("ORCHESTR8_WINDOW_SETTLE", time.Minute)
)

type gpuSignal struct {
	UUID       string  `json:"uuid"`
	ClusterID  string  `json:"clusterId"`
	NodeName   string  `json:"nodeName"`
	Model      string  `json:"model"`
	TempC      float64 `json:"tempC"`
	ClockMhz   float64 `json:"clockMhz"`
	UtilPct    float64 `json:"utilPct"`
	MemUsedMib float64 `json:"memUsedMib"`
	MemTotMib  float64 `json:"memTotMib"`
	XidErrors  float64 `json:"xidErrors"`

	PeakClockMhz float64 `json:"-"` // best clock seen for this GPU model in the fleet
}

// Throttled reports whether the card has lost meaningful clock. A GPU can sit
// at 99% utilization while throttling — utilization measures busy, not fast.
func (g gpuSignal) Throttled() bool {
	return g.PeakClockMhz > 0 && g.ClockMhz < g.PeakClockMhz*0.97
}

func (g gpuSignal) ClockLossPct() float64 {
	if g.PeakClockMhz <= 0 {
		return 0
	}
	return (1 - g.ClockMhz/g.PeakClockMhz) * 100
}

func (g gpuSignal) MemUsedPct() float64 {
	if g.MemTotMib <= 0 {
		return 0
	}
	return g.MemUsedMib / g.MemTotMib * 100
}

type serviceSignal struct {
	ClusterID  string
	Model      string
	SloMs      float64
	TtftP95Now float64
	TtftP50Now float64
	QueueDepth float64
	KvCachePct float64

	ReqRateNow  float64
	ReqRateBase float64
	TtftP95Base float64
	HasBaseline bool

	GPUs []gpuSignal

	WindowStart time.Time
	WindowEnd   time.Time
}

// Breaching reports whether the service is currently outside its SLO. Rules
// only run for breaching services: a correlation for a healthy service is noise.
func (s serviceSignal) Breaching() bool { return s.TtftP95Now > s.SloMs }

// ReqRateDeltaPct is the discriminator between a hardware fault and real load.
// Both raise p95; only one moves this number.
func (s serviceSignal) ReqRateDeltaPct() float64 {
	if !s.HasBaseline || s.ReqRateBase <= 0 {
		return 0
	}
	return (s.ReqRateNow/s.ReqRateBase - 1) * 100
}

func (s serviceSignal) ThrottledGPUs() []gpuSignal {
	var out []gpuSignal
	for _, g := range s.GPUs {
		if g.Throttled() {
			out = append(out, g)
		}
	}
	return out
}

func (s serviceSignal) HealthyGPUs() []gpuSignal {
	var out []gpuSignal
	for _, g := range s.GPUs {
		if !g.Throttled() {
			out = append(out, g)
		}
	}
	return out
}

// ------------------------------------------------------------------ queries

// Bindings MUST carry the cluster. GPU UUIDs and model names are only unique
// within a cluster — two clusters running the same model, or a fleet cloned
// from the same image, collide. Without the cluster in the key, a service in
// one cluster gets attributed GPUs from another: costs double, and the
// correlation engine can blame a card that is nowhere near the workload.
const qBindings = `
SELECT
    ResourceAttributes['orchestr8.cluster.id'] AS clusterId,
    Attributes['model_name'] AS model,
    Attributes['UUID']       AS uuid,
    Attributes['Hostname']   AS host
FROM orchestr8.otel_metrics_gauge
WHERE MetricName = 'orchestr8_model_gpu_binding'
  AND TimeUnix >= now() - INTERVAL 10 MINUTE
GROUP BY clusterId, model, uuid, host`

type bindingRow struct {
	ClusterID string `json:"clusterId"`
	Model     string `json:"model"`
	UUID      string `json:"uuid"`
	Host      string `json:"host"`
}

// scopeKey namespaces anything whose identifier is only cluster-unique.
func scopeKey(clusterID, id string) string { return clusterID + "\x1f" + id }

const qGPUState = `
SELECT
    GpuUuid                                 AS uuid,
    ClusterId                               AS clusterId,
    NodeName                                AS nodeName,
    any(GpuModel)                           AS model,
    round(maxIfMerge(TemperatureC), 1)      AS tempC,
    round(minIfMerge(SmClockMhz), 0)        AS clockMhz,
    round(avgIfMerge(UtilizationPct), 1)    AS utilPct,
    round(avgIfMerge(MemoryUsedMib), 0)     AS memUsedMib,
    round(maxIfMerge(MemoryTotalMib), 0)    AS memTotMib
FROM orchestr8.gpu_minute
WHERE Minute >= now() - INTERVAL %d SECOND
GROUP BY GpuUuid, ClusterId, NodeName`

const qXid = `
SELECT
    ResourceAttributes['orchestr8.cluster.id'] AS clusterId,
    Attributes['UUID'] AS uuid,
    max(Value)         AS xidErrors
FROM orchestr8.otel_metrics_sum
WHERE MetricName = 'DCGM_FI_DEV_XID_ERRORS' AND TimeUnix >= now() - INTERVAL %d SECOND
GROUP BY clusterId, uuid`

type xidRow struct {
	ClusterID string  `json:"clusterId"`
	UUID      string  `json:"uuid"`
	XidErrors float64 `json:"xidErrors"`
}

// Service TTFT over a window, returned as raw buckets so the caller
// re-quantiles correctly rather than averaging pre-computed percentiles.
//
// Two things here are load-bearing:
//
//  1. The window ENDS at the last complete minute. The rollup buckets by
//     minute, so the current one is still filling — including it understates
//     every rate by however much of the minute has not happened yet. That bug
//     made a flat 340 req/min read as a 50% COLLAPSE in traffic, which in turn
//     made the thermal rule refuse to fire on a genuinely throttling GPU.
//  2. The rate divides by the number of minutes actually present, not by the
//     nominal window length, so a gap in ingest cannot masquerade as a drop
//     in load.
const qSvcWindow = `
SELECT
    ClusterId                   AS clusterId,
    Model                       AS model,
    any(Bounds)                 AS bounds,
    sumForEachMerge(BucketSums) AS buckets,
    sumMerge(Requests)          AS requests,
    count() AS minutes
FROM orchestr8.inference_minute
WHERE Minute >= toStartOfMinute(now()) - INTERVAL %d SECOND
  AND Minute <  toStartOfMinute(now()) - INTERVAL %d SECOND
GROUP BY ClusterId, Model`

type svcWindowRow struct {
	ClusterID string    `json:"clusterId"`
	Model     string    `json:"model"`
	Bounds    []float64 `json:"bounds"`
	Buckets   []uint64  `json:"buckets"`
	Requests  uint64    `json:"requests"`
	Minutes   uint64    `json:"minutes"`
}

// perMinute divides by the minutes actually observed. Returns 0 when the window
// is empty, so a missing baseline reads as "unknown", never as "zero traffic".
func (r svcWindowRow) perMinute() float64 {
	if r.Minutes == 0 {
		return 0
	}
	return float64(r.Requests) / float64(r.Minutes)
}

const qSvcGaugesNow = `
SELECT
    Attributes['model_name'] AS model,
    round(avgIf(Value, MetricName = 'vllm:num_requests_waiting'), 1)     AS queueDepth,
    round(avgIf(Value, MetricName = 'vllm:gpu_cache_usage_perc')*100, 1) AS kvCachePct
FROM orchestr8.otel_metrics_gauge
WHERE TimeUnix >= now() - INTERVAL %d SECOND AND MetricName LIKE 'vllm:%%'
GROUP BY model`

type svcGaugeNowRow struct {
	Model      string  `json:"model"`
	QueueDepth float64 `json:"queueDepth"`
	KvCachePct float64 `json:"kvCachePct"`
}

// collectSignals assembles one bundle per inference service.
func collectSignals(ctx context.Context, c *chClient, slos map[string]float64) ([]serviceSignal, error) {
	var binds []bindingRow
	if err := c.query(ctx, qBindings, &binds); err != nil {
		return nil, fmt.Errorf("bindings: %w", err)
	}
	var gpus []gpuSignal
	if err := c.query(ctx, fmt.Sprintf(qGPUState, int(nowWindow.Seconds())), &gpus); err != nil {
		return nil, fmt.Errorf("gpu state: %w", err)
	}
	var xids []xidRow
	_ = c.query(ctx, fmt.Sprintf(qXid, int(nowWindow.Seconds())), &xids) // absent when no faults
	var nowRows, baseRows []svcWindowRow
	// Every window is shifted back by `settle` so it only covers minutes that
	// have finished being written.
	st := int(settle.Seconds())
	if err := c.query(ctx, fmt.Sprintf(qSvcWindow, int(nowWindow.Seconds())+st, st), &nowRows); err != nil {
		return nil, fmt.Errorf("service now: %w", err)
	}
	_ = c.query(ctx, fmt.Sprintf(qSvcWindow, int(baseFrom.Seconds())+st, int(baseTo.Seconds())+st), &baseRows)
	var gaugeRows []svcGaugeNowRow
	_ = c.query(ctx, fmt.Sprintf(qSvcGaugesNow, int(nowWindow.Seconds())), &gaugeRows)

	// Peak clock per GPU model, used as the throttle reference. Without a
	// per-model spec table, the best clock any card of that model is currently
	// achieving is the most honest available baseline.
	// Peak clock stays fleet-wide on purpose: it is a property of the GPU
	// model, not of a cluster, and a cluster where every card throttles would
	// otherwise define its own degraded state as normal.
	peak := map[string]float64{}
	for _, g := range gpus {
		if g.ClockMhz > peak[g.Model] {
			peak[g.Model] = g.ClockMhz
		}
	}
	xidBy := map[string]float64{}
	for _, x := range xids {
		xidBy[scopeKey(x.ClusterID, x.UUID)] = x.XidErrors
	}
	gpuBy := map[string]gpuSignal{}
	for _, g := range gpus {
		g.PeakClockMhz = peak[g.Model]
		g.XidErrors = xidBy[scopeKey(g.ClusterID, g.UUID)]
		gpuBy[scopeKey(g.ClusterID, g.UUID)] = g
	}
	boundGPUs := map[string][]gpuSignal{}
	for _, b := range binds {
		if g, ok := gpuBy[scopeKey(b.ClusterID, b.UUID)]; ok {
			boundGPUs[scopeKey(b.ClusterID, b.Model)] = append(boundGPUs[scopeKey(b.ClusterID, b.Model)], g)
		}
	}
	gaugeBy := map[string]svcGaugeNowRow{}
	for _, r := range gaugeRows {
		gaugeBy[r.Model] = r
	}
	baseBy := map[string]svcWindowRow{}
	for _, r := range baseRows {
		baseBy[r.Model] = r
	}

	end := time.Now().UTC()
	out := make([]serviceSignal, 0, len(nowRows))
	for _, r := range nowRows {
		slo := slos[r.Model]
		if slo == 0 {
			slo = defaultTtftSloMs
		}
		s := serviceSignal{
			ClusterID:   r.ClusterID,
			Model:       r.Model,
			SloMs:       slo,
			TtftP95Now:  histQuantile(r.Bounds, r.Buckets, 0.95) * 1000,
			TtftP50Now:  histQuantile(r.Bounds, r.Buckets, 0.50) * 1000,
			QueueDepth:  gaugeBy[r.Model].QueueDepth,
			KvCachePct:  gaugeBy[r.Model].KvCachePct,
			ReqRateNow:  r.perMinute(),
			GPUs:        boundGPUs[scopeKey(r.ClusterID, r.Model)],
			WindowStart: end.Add(-nowWindow),
			WindowEnd:   end,
		}
		if b, ok := baseBy[r.Model]; ok && b.Requests > 0 && b.Minutes > 0 {
			s.HasBaseline = true
			s.ReqRateBase = b.perMinute()
			s.TtftP95Base = histQuantile(b.Bounds, b.Buckets, 0.95) * 1000
		}
		out = append(out, s)
	}
	return out, nil
}
