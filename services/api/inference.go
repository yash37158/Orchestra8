package main

import (
	"fmt"
	"math"
	"net/http"
	"sort"
	"time"
)

// Inference economics and cost recommendations (the /ai page).
//
// Scope note: this page deliberately does NOT cover model accuracy, drift or
// retraining. That is model observability — a different product with a
// different buyer (Arize, Braintrust). What a platform team acts on is cost
// and capacity, so that is what this computes, from telemetry that arrived.

type modelEconomics struct {
	ClusterID           string  `json:"clusterId"`
	Model               string  `json:"model"`
	TtftMsP50           float64 `json:"ttftMsP50"`
	TtftMsP95           float64 `json:"ttftMsP95"`
	TtftSloMs           float64 `json:"ttftSloMs"`
	WithinSlo           bool    `json:"withinSlo"`
	RequestsPerMin      float64 `json:"requestsPerMin"`
	QueueDepth          float64 `json:"queueDepth"`
	KvCacheUsagePct     float64 `json:"kvCacheUsagePct"`
	GpuCount            int     `json:"gpuCount"`
	GpuUtilizationPct   float64 `json:"gpuUtilizationPct"`
	CostPerHourUsd      float64 `json:"costPerHourUsd"`
	CostPerKRequestsUsd float64 `json:"costPerKRequestsUsd"`
}

type recommendation struct {
	ID                       string   `json:"id"`
	Kind                     string   `json:"kind"`
	Severity                 string   `json:"severity"`
	Title                    string   `json:"title"`
	Detail                   string   `json:"detail"`
	Evidence                 []string `json:"evidence"`
	EstimatedSavingUsdPerDay float64  `json:"estimatedSavingUsdPerDay"`
	Action                   string   `json:"action"`
}

func handleInference(w http.ResponseWriter, r *http.Request, c *chClient, slos *sloStore, rates *rateCard) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	signals, err := collectSignals(r.Context(), c, slos.All())
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	models := make([]modelEconomics, 0, len(signals))
	var totalPerHour float64

	for _, s := range signals {
		var cost, util float64
		for _, g := range s.GPUs {
			cost += rates.For(g.Model)
			util += g.UtilPct
		}
		if len(s.GPUs) > 0 {
			util /= float64(len(s.GPUs))
		}
		// Cost per thousand requests makes two models comparable even when they
		// run on different hardware at different scale.
		perK := 0.0
		if s.ReqRateNow > 0 {
			perK = cost / (s.ReqRateNow * 60 / 1000)
		}
		models = append(models, modelEconomics{
			ClusterID: s.ClusterID, Model: s.Model,
			TtftMsP50: round1(s.TtftP50Now), TtftMsP95: round1(s.TtftP95Now),
			TtftSloMs: s.SloMs, WithinSlo: s.TtftP95Now <= s.SloMs,
			RequestsPerMin: round1(s.ReqRateNow), QueueDepth: s.QueueDepth,
			KvCacheUsagePct: s.KvCachePct, GpuCount: len(s.GPUs),
			GpuUtilizationPct: round1(util),
			CostPerHourUsd:    math.Round(cost*100) / 100,
			CostPerKRequestsUsd: math.Round(perK*10000) / 10000,
		})
		totalPerHour += cost
	}
	sort.Slice(models, func(i, j int) bool {
		if models[i].ClusterID != models[j].ClusterID {
			return models[i].ClusterID < models[j].ClusterID
		}
		return models[i].Model < models[j].Model
	})

	writeJSON(w, map[string]any{
		"generatedAt":        time.Now().UTC().Format(time.RFC3339Nano),
		"models":             models,
		"recommendations":    recommend(signals, models, rates),
		"totalCostPerDayUsd": math.Round(totalPerHour*24*100) / 100,
	})
}

// recommend derives cost and capacity advice from measured state.
//
// Every recommendation carries its evidence and a saving computed from the
// actual rate card — not a percentage pulled from the air. A recommendation
// nobody can check is a recommendation nobody will act on.
func recommend(signals []serviceSignal, models []modelEconomics, rates *rateCard) []recommendation {
	out := []recommendation{}
	byKey := map[string]modelEconomics{}
	for _, m := range models {
		byKey[m.ClusterID+"|"+m.Model] = m
	}

	for _, s := range signals {
		m := byKey[s.ClusterID+"|"+s.Model]
		if m.GpuCount == 0 {
			continue
		}

		// Idle: paying full rate for capacity nothing is using.
		if m.GpuUtilizationPct < 15 && m.RequestsPerMin < 10 {
			out = append(out, recommendation{
				ID: "idle-" + s.ClusterID + "-" + s.Model, Kind: "idle", Severity: "warning",
				Title:  fmt.Sprintf("%s is idle on %s", s.Model, s.ClusterID),
				Detail: fmt.Sprintf("%d GPU(s) at %.0f%% utilisation serving %.0f requests/min.", m.GpuCount, m.GpuUtilizationPct, m.RequestsPerMin),
				Evidence: []string{
					fmt.Sprintf("GPU utilisation %.0f%%", m.GpuUtilizationPct),
					fmt.Sprintf("Request rate %.0f/min", m.RequestsPerMin),
					fmt.Sprintf("Costing $%.2f/hr", m.CostPerHourUsd),
				},
				EstimatedSavingUsdPerDay: math.Round(m.CostPerHourUsd*24*100) / 100,
				Action:                   "Scale to zero outside working hours, or consolidate onto a shared replica.",
			})
			continue
		}

		// Right-size: comfortably inside SLO with headroom to spare. Saving is
		// one GPU's actual rate, not a guess.
		if m.WithinSlo && m.GpuCount > 1 && m.GpuUtilizationPct < 55 && m.TtftMsP95 < m.TtftSloMs*0.6 {
			perGpu := m.CostPerHourUsd / float64(m.GpuCount)
			out = append(out, recommendation{
				ID: "rightsize-" + s.ClusterID + "-" + s.Model, Kind: "rightsize", Severity: "info",
				Title: fmt.Sprintf("%s has spare capacity on %s", s.Model, s.ClusterID),
				Detail: fmt.Sprintf("p95 TTFT is %.0fms against a %.0fms target at %.0f%% GPU utilisation. One fewer GPU would likely still meet the SLO.",
					m.TtftMsP95, m.TtftSloMs, m.GpuUtilizationPct),
				Evidence: []string{
					fmt.Sprintf("p95 TTFT %.0fms, %.0f%% of the %.0fms budget", m.TtftMsP95, m.TtftMsP95/m.TtftSloMs*100, m.TtftSloMs),
					fmt.Sprintf("GPU utilisation %.0f%% across %d GPU(s)", m.GpuUtilizationPct, m.GpuCount),
					fmt.Sprintf("Queue depth %.0f", m.QueueDepth),
				},
				EstimatedSavingUsdPerDay: math.Round(perGpu*24*100) / 100,
				Action:                   "Drop one replica and watch p95 for an hour before removing the next.",
			})
		}

		// SLO mismatch: comfortably inside target for a long time suggests the
		// target, not the service, is wrong.
		if m.WithinSlo && m.TtftMsP95 < m.TtftSloMs*0.35 {
			out = append(out, recommendation{
				ID: "slo-" + s.ClusterID + "-" + s.Model, Kind: "slo_mismatch", Severity: "info",
				Title:  fmt.Sprintf("%s target may be too loose", s.Model),
				Detail: fmt.Sprintf("p95 TTFT is %.0fms against a %.0fms target — under a third of the budget. A target this loose will not fire until users are already unhappy.", m.TtftMsP95, m.TtftSloMs),
				Evidence: []string{
					fmt.Sprintf("p95 %.0fms vs target %.0fms", m.TtftMsP95, m.TtftSloMs),
					"Alerting on a budget this large delays detection",
				},
				EstimatedSavingUsdPerDay: 0,
				Action:                   fmt.Sprintf("Consider tightening the target toward %.0fms in config/slos.json.", math.Ceil(m.TtftMsP95*1.5/50)*50),
			})
		}
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].EstimatedSavingUsdPerDay > out[j].EstimatedSavingUsdPerDay
	})
	return out
}
