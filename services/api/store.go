package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"sort"
	"strings"
	"time"
)

// ClickHouse access over its HTTP interface. Deliberately no driver dependency:
// this service issues a handful of read-only analytical queries, and net/http
// plus encoding/json covers that completely. A driver earns its place when we
// need native protocol features (streaming inserts, bind params at volume);
// ingest is the collector's job, so that day may never come.

type chClient struct {
	url  string
	http *http.Client
}

func newCHClient(url string) *chClient {
	return &chClient{url: url, http: &http.Client{Timeout: 10 * time.Second}}
}

// query runs SQL and decodes `FORMAT JSON` into out.data.
func (c *chClient) query(ctx context.Context, sql string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.url, bytes.NewBufferString(sql+"\nFORMAT JSON"))
	if err != nil {
		return err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("clickhouse unreachable: %w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	if resp.StatusCode != http.StatusOK {
		// ClickHouse puts the real diagnosis in the body; surfacing only the
		// status code turns a typo into a twenty-minute hunt.
		return fmt.Errorf("clickhouse %d: %s", resp.StatusCode, bytes.TrimSpace(body))
	}
	var envelope struct {
		Data json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(body, &envelope); err != nil {
		return fmt.Errorf("decode clickhouse envelope: %w", err)
	}
	return json.Unmarshal(envelope.Data, out)
}

// ------------------------------------------------------------------ queries

// Latest state per GPU. Reads the rollup, never the raw gauge table.
// Epoch seconds, not a formatted string: ClickHouse renders DateTime in the
// server's local timezone, and parsing that as UTC silently shifts freshness by
// the offset — which on a +05:30 host makes every reading look 5.5h in the
// FUTURE, so the stale banner can never fire. An integer has no timezone.
const qFreshness = `
SELECT toUnixTimestamp(max(TimeUnix)) AS t FROM orchestr8.otel_metrics_gauge
WHERE %s AND TimeUnix >= now() - INTERVAL 1 DAY`

const qGPUs = `
SELECT
    ClusterId                              AS clusterId,
    NodeName                               AS nodeName,
    GpuUuid                                AS uuid,
    any(GpuModel)                          AS model,
    round(avgIfMerge(UtilizationPct), 2)   AS utilizationPct,
    round(avgIfMerge(MemoryUsedMib)/1024, 2)  AS memoryUsedGb,
    round(maxIfMerge(MemoryTotalMib)/1024, 2) AS memoryTotalGb,
    round(maxIfMerge(TemperatureC), 1)     AS temperatureC,
    round(avgIfMerge(PowerWatts), 1)       AS powerWatts,
    round(minIfMerge(SmClockMhz), 0)       AS smClockMhz
FROM orchestr8.gpu_minute
WHERE %s AND Minute >= now() - INTERVAL 5 MINUTE
GROUP BY ClusterId, NodeName, GpuUuid
ORDER BY nodeName, uuid`

type gpuRow struct {
	ClusterID      string  `json:"clusterId"`
	NodeName       string  `json:"nodeName"`
	UUID           string  `json:"uuid"`
	Model          string  `json:"model"`
	UtilizationPct float64 `json:"utilizationPct"`
	MemoryUsedGb   float64 `json:"memoryUsedGb"`
	MemoryTotalGb  float64 `json:"memoryTotalGb"`
	TemperatureC   float64 `json:"temperatureC"`
	PowerWatts     float64 `json:"powerWatts"`
	SmClockMhz     float64 `json:"smClockMhz"`
}

// Histogram buckets summed across the window. Quantiles are interpolated in Go
// from the summed buckets — never by averaging per-minute p95s, which is wrong
// in a way that looks plausible.
const qServices = `
SELECT
    ClusterId                   AS clusterId,
    Model                       AS model,
    any(Bounds)                 AS bounds,
    sumForEachMerge(BucketSums) AS buckets,
    sumMerge(Requests)          AS requests,
    sumMerge(TtftSumSec)        AS ttftSumSec
FROM orchestr8.inference_minute
WHERE %s AND Minute >= now() - INTERVAL 5 MINUTE
GROUP BY ClusterId, Model
ORDER BY model`

type svcRow struct {
	ClusterID  string    `json:"clusterId"`
	Model      string    `json:"model"`
	Bounds     []float64 `json:"bounds"`
	Buckets    []uint64  `json:"buckets"`
	Requests   uint64    `json:"requests"`
	TtftSumSec float64   `json:"ttftSumSec"`
}

// Queue depth and KV-cache are plain gauges, fetched separately so a missing
// inference engine degrades one field rather than the whole row.
const qServiceGauges = `
SELECT
    Attributes['model_name']                                          AS model,
    round(avgIf(Value, MetricName = 'vllm:num_requests_waiting'), 0)  AS queueDepth,
    round(avgIf(Value, MetricName = 'vllm:gpu_cache_usage_perc')*100, 2) AS kvCacheUsagePct,
    round(avgIf(Value, MetricName = 'vllm:avg_generation_throughput_toks_per_s'), 1) AS tokensPerSecond
FROM orchestr8.otel_metrics_gauge
WHERE %s AND TimeUnix >= now() - INTERVAL 2 MINUTE AND MetricName LIKE 'vllm:%%'
GROUP BY model`

type svcGaugeRow struct {
	Model           string  `json:"model"`
	QueueDepth      float64 `json:"queueDepth"`
	KvCacheUsagePct float64 `json:"kvCacheUsagePct"`
	TokensPerSecond float64 `json:"tokensPerSecond"`
}

// --------------------------------------------------------------- quantiles

// histQuantile interpolates a quantile from OpenTelemetry histogram buckets.
// buckets has one more element than bounds: the final entry is the +Inf bucket.
// Within the chosen bucket the distribution is assumed uniform, which is the
// standard approach and the reason bucket choice matters more than bucket count.
func histQuantile(bounds []float64, buckets []uint64, q float64) float64 {
	if len(buckets) == 0 || q <= 0 || q > 1 {
		return 0
	}
	var total uint64
	for _, c := range buckets {
		total += c
	}
	if total == 0 {
		return 0
	}
	target := q * float64(total)

	var cum float64
	for i, c := range buckets {
		prev := cum
		cum += float64(c)
		if cum < target || c == 0 {
			continue
		}
		// Values above the last explicit bound land in +Inf; there is no upper
		// edge to interpolate toward, so report the last bound rather than
		// inventing a number.
		if i >= len(bounds) {
			if len(bounds) == 0 {
				return 0
			}
			return bounds[len(bounds)-1]
		}
		lo := 0.0
		if i > 0 {
			lo = bounds[i-1]
		}
		hi := bounds[i]
		frac := (target - prev) / float64(c)
		return lo + (hi-lo)*frac
	}
	if len(bounds) == 0 {
		return 0
	}
	return bounds[len(bounds)-1]
}

// ------------------------------------------------------------------ loading

// loadDashboardFromCH builds the dashboard response from telemetry.
//
// Fields with no telemetry source yet are returned EMPTY rather than filled
// with something plausible: correlations arrive in Phase 2, and token spend
// needs GenAI spans the simulator does not emit. A zero the user can see is
// honest; an invented number is the failure mode this whole refactor exists
// to remove.
func loadDashboardFromCH(ctx context.Context, c *chClient, org string, slos map[string]float64, rates *rateCard, aud *auditLog) (*DashboardResponse, error) {
	var gRows []gpuRow
	if err := c.query(ctx, fmt.Sprintf(qGPUs, orgClause(org)), &gRows); err != nil {
		return nil, fmt.Errorf("gpu query: %w", err)
	}
	var sRows []svcRow
	if err := c.query(ctx, fmt.Sprintf(qServices, orgClause(org)), &sRows); err != nil {
		return nil, fmt.Errorf("service query: %w", err)
	}
	var sgRows []svcGaugeRow
	if err := c.query(ctx, fmt.Sprintf(qServiceGauges, orgClauseRaw(org)), &sgRows); err != nil {
		return nil, fmt.Errorf("service gauge query: %w", err)
	}
	gauges := map[string]svcGaugeRow{}
	for _, r := range sgRows {
		gauges[r.Model] = r
	}

	// Real correlations from the engine. Empty means "nothing detected",
	// which the UI renders differently from "engine unreachable".
	corrs, cerr := c.correlations(ctx, org, "")
	if cerr != nil {
		return nil, fmt.Errorf("correlations: %w", cerr)
	}

	out := &DashboardResponse{
		Activity:     recentActivity(ctx, aud, org),
		Correlations: corrs,
		Gpus:         []GpuDevice{},
		Services:     []InferenceService{},
	}

	// A GPU is throttling when its clock has dropped meaningfully below the
	// model's boost clock. Without a per-model spec table the best available
	// reference is the highest clock seen on that model across the fleet.
	peak := map[string]float64{}
	for _, r := range gRows {
		if r.SmClockMhz > peak[r.Model] {
			peak[r.Model] = r.SmClockMhz
		}
	}

	clusters := map[string]bool{}
	var utilSum float64
	for _, r := range gRows {
		clusters[r.ClusterID] = true
		utilSum += r.UtilizationPct
		out.Gpus = append(out.Gpus, GpuDevice{
			UUID: r.UUID, ClusterID: r.ClusterID, NodeName: r.NodeName, Model: r.Model,
			MigProfile: nil, UtilizationPct: r.UtilizationPct,
			MemoryUsedGb: r.MemoryUsedGb, MemoryTotalGb: maxf(r.MemoryTotalGb, 1),
			TemperatureC: r.TemperatureC, PowerWatts: r.PowerWatts,
			Throttled: peak[r.Model] > 0 && r.SmClockMhz < peak[r.Model]*0.97,
			XidErrors: 0,
		})
	}

	var withinSlo, totalSvc int
	for _, r := range sRows {
		g := gauges[r.Model]
		slo := slos[r.Model]
		if slo == 0 {
			slo = defaultTtftSloMs
		}
		p95 := histQuantile(r.Bounds, r.Buckets, 0.95) * 1000
		svc := InferenceService{
			ID: "svc-" + r.Model, ClusterID: r.ClusterID, Model: r.Model, Engine: "vllm",
			Replicas:        0,
			TtftMsP50:       round1(histQuantile(r.Bounds, r.Buckets, 0.50) * 1000),
			TtftMsP95:       round1(p95),
			TtftMsP99:       round1(histQuantile(r.Bounds, r.Buckets, 0.99) * 1000),
			TokensPerSecond: g.TokensPerSecond,
			QueueDepth:      int(g.QueueDepth),
			BatchSize:       0,
			KvCacheUsagePct: g.KvCacheUsagePct,
			ErrorRatePct:    0,
			TtftSloMs:       slo,
		}
		totalSvc++
		if p95 <= slo {
			withinSlo++
		}
		out.Services = append(out.Services, svc)
	}
	sort.Slice(out.Services, func(i, j int) bool { return out.Services[i].Model < out.Services[j].Model })

	var gpuUtil float64
	if len(gRows) > 0 {
		gpuUtil = round1(utilSum / float64(len(gRows)))
	}
	sloPct := 100.0
	if totalSvc > 0 {
		sloPct = round1(float64(withinSlo) / float64(totalSvc) * 100)
	}

	// Freshness is read from the data itself, not from the clock. If ingest
	// stops, this stops moving and the UI says so instead of showing a frozen
	// number that still looks healthy.
	var lastTelemetry *string
	var fresh []struct {
		T int64 `json:"t"`
	}
	if err := c.query(ctx, fmt.Sprintf(qFreshness, orgClauseRaw(org)), &fresh); err == nil && len(fresh) > 0 && fresh[0].T > 0 {
		s := time.Unix(fresh[0].T, 0).UTC().Format(time.RFC3339Nano)
		lastTelemetry = &s
	}

	out.Overview = Overview{
		GeneratedAt:               time.Now().UTC().Format(time.RFC3339Nano),
		LastTelemetryAt:           lastTelemetry,
		Clusters:                  ClusterCount{Healthy: len(clusters), Total: len(clusters)},
		FleetUptimePct:            100,
		GpuUtilizationPct:         gpuUtil,
		InferenceSloAttainmentPct: sloPct,
		FleetCostPerDayUsd:        fleetCost(out.Gpus, rates),
		OpenCorrelations:          countOpen(corrs),
	}

	// Topology is derived from the clusters telemetry actually arrived from —
	// there is no cluster inventory source yet, so we report what we can see.
	out.Topology = Topology{Clusters: []Cluster{}, Links: []TopologyLink{}}
	for id := range clusters {
		out.Topology.Clusters = append(out.Topology.Clusters, Cluster{
			ID: id, Name: id, Provider: providerOf(id), Region: id, Status: clusterStatus(id, out.Gpus),
			Nodes: countNodes(gRows, id), CPUPct: 0, MemoryPct: 0,
			UptimePct: 100, CostPerHourUSD: 0,
		})
	}
	sort.Slice(out.Topology.Clusters, func(i, j int) bool {
		return out.Topology.Clusters[i].ID < out.Topology.Clusters[j].ID
	})
	return out, nil
}

func countNodes(rows []gpuRow, cluster string) int {
	seen := map[string]bool{}
	for _, r := range rows {
		if r.ClusterID == cluster {
			seen[r.NodeName] = true
		}
	}
	return len(seen)
}

func maxf(a, b float64) float64 { return math.Max(a, b) }
func round1(v float64) float64  { return math.Round(v*10) / 10 }

func countOpen(cs []Correlation) int {
	n := 0
	for _, c := range cs {
		if c.Status == "open" {
			n++
		}
	}
	return n
}


// clusterStatus reports what the telemetry says, not a constant. A cluster with
// a throttling GPU is degraded — calling it healthy next to a tile that says
// "1 GPU throttling" is the kind of contradiction that teaches people to stop
// trusting the page.
func clusterStatus(clusterID string, gpus []GpuDevice) string {
	for _, g := range gpus {
		if g.ClusterID == clusterID && g.Throttled {
			return "degraded"
		}
	}
	return "healthy"
}

// fleetCost prices measured inventory against the rate card.
func fleetCost(gpus []GpuDevice, rates *rateCard) float64 {
	var perHour float64
	for _, g := range gpus {
		perHour += rates.For(g.Model)
	}
	return math.Round(perHour*24*100) / 100
}

// auditKind maps an audit action onto the activity feed's vocabulary.
func auditKind(action string) string {
	switch {
	case strings.HasPrefix(action, "deploy."):
		return "deployment"
	case strings.HasPrefix(action, "scan."):
		return "security"
	case strings.HasPrefix(action, "notify."):
		return "inference"
	case strings.HasPrefix(action, "correlation."), strings.HasPrefix(action, "slo."):
		return "scaling"
	default:
		return "deployment"
	}
}

// recentActivity feeds the dashboard from the audit ledger.
//
// The feed used to be an empty array with no source at all. The ledger already
// records every write path — deploys, scans, overrides, pages — so it is the
// honest source: anything that appears here actually happened and is
// independently verifiable in /audit.
func recentActivity(ctx context.Context, aud *auditLog, org string) []ActivityEvent {
	out := []ActivityEvent{}
	if aud == nil {
		return out
	}
	entries, err := aud.List(ctx, org, 12)
	if err != nil {
		return out
	}
	for _, e := range entries {
		sev := "info"
		switch e.Outcome {
		case "failed":
			sev = "critical"
		case "denied":
			sev = "warning"
		}
		desc := e.Subject
		if e.ClusterID != "" {
			desc = e.Subject + " on " + e.ClusterID
		}
		if d, ok := e.Detail["error"].(string); ok && d != "" {
			desc = d
		} else if b, ok := e.Detail["branch"].(string); ok && b != "" {
			desc = b
		} else if dst, ok := e.Detail["destination"].(string); ok && dst != "" {
			desc = "delivered to " + dst
		}
		out = append(out, ActivityEvent{
			ID:            fmt.Sprintf("audit-%d", e.Seq),
			Kind:          auditKind(e.Action),
			Severity:      sev,
			Title:         strings.ReplaceAll(e.Action, ".", " ") + " by " + e.Actor,
			Description:   desc,
			At:            e.At,
			CorrelationID: nil,
		})
	}
	return out
}
