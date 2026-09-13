package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"sort"
	"strings"
	"sync"
	"time"
)

// Fleet inventory and cost attribution (F-21/F-22/F-23).
//
// Everything here is derived from telemetry that actually arrived. A cluster
// appears because it is reporting, not because someone registered it in a
// config file — which means the page cannot show a cluster that has silently
// stopped sending data as though it were healthy.

// ------------------------------------------------------------- rate card

type rateCard struct {
	path     string
	mu       sync.RWMutex
	currency string
	rates    map[string]float64
	fallback float64
	modTime  time.Time
}

func newRateCard(path string) *rateCard {
	r := &rateCard{path: path, rates: map[string]float64{}, fallback: 1.0, currency: "USD"}
	if err := r.reload(); err != nil {
		log.Printf("rates: %v — falling back to %.2f/GPU-hour", err, r.fallback)
	}
	return r
}

func (r *rateCard) reload() error {
	fi, err := os.Stat(r.path)
	if err != nil {
		return err
	}
	r.mu.RLock()
	unchanged := fi.ModTime().Equal(r.modTime)
	r.mu.RUnlock()
	if unchanged {
		return nil
	}
	raw, err := os.ReadFile(r.path)
	if err != nil {
		return err
	}
	var f struct {
		Currency       string             `json:"currency"`
		DefaultPerHour float64            `json:"defaultPerHour"`
		Rates          map[string]float64 `json:"rates"`
	}
	if err := json.Unmarshal(raw, &f); err != nil {
		return err
	}
	r.mu.Lock()
	r.rates = f.Rates
	r.currency = f.Currency
	if r.currency == "" {
		r.currency = "USD"
	}
	r.fallback = f.DefaultPerHour
	if r.fallback <= 0 {
		r.fallback = 1.0
	}
	r.modTime = fi.ModTime()
	r.mu.Unlock()
	log.Printf("rates: %d GPU rate(s) loaded (default %.2f %s/hr)", len(f.Rates), r.fallback, r.currency)
	return nil
}

// For returns the hourly rate for a DCGM modelName.
//
// Longest substring match wins, so "A100-SXM4-80GB" beats a generic "A100"
// entry. Matching on substrings rather than exact names is deliberate: DCGM
// reports strings like "NVIDIA H100 80GB HBM3" that vary by driver version,
// and an exact-match table silently falls back to the default the first time
// NVIDIA changes a product string.
func (r *rateCard) For(model string) float64 {
	_ = r.reload()
	r.mu.RLock()
	defer r.mu.RUnlock()
	up := strings.ToUpper(strings.ReplaceAll(model, " ", "-"))
	best, bestLen := r.fallback, 0
	for key, rate := range r.rates {
		k := strings.ToUpper(key)
		if strings.Contains(up, k) && len(k) > bestLen {
			best, bestLen = rate, len(k)
		}
	}
	return best
}

func (r *rateCard) Currency() string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.currency
}

// ------------------------------------------------------------------ query

const qFleet = `
SELECT
    ClusterId                               AS clusterId,
    NodeName                                AS nodeName,
    GpuUuid                                 AS uuid,
    any(GpuModel)                           AS model,
    round(avgIfMerge(UtilizationPct), 1)    AS utilizationPct,
    round(avgIfMerge(MemoryUsedMib)/1024, 2)  AS memoryUsedGb,
    round(maxIfMerge(MemoryTotalMib)/1024, 2) AS memoryTotalGb,
    round(maxIfMerge(TemperatureC), 1)      AS temperatureC,
    round(avgIfMerge(PowerWatts), 1)        AS powerWatts,
    round(minIfMerge(SmClockMhz), 0)        AS smClockMhz,
    toUnixTimestamp(max(Minute))            AS lastSeen
FROM orchestr8.gpu_minute
WHERE %s AND Minute >= toStartOfMinute(now()) - INTERVAL 10 MINUTE
GROUP BY ClusterId, NodeName, GpuUuid
ORDER BY ClusterId, NodeName, uuid`

type fleetRow struct {
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
	LastSeen       int64   `json:"lastSeen"`
}

// providerOf infers the cloud from the cluster id. A guess, and labelled as
// such: "unknown" is more useful than confidently mislabelling someone's
// on-prem cluster as AWS.
func providerOf(clusterID string) string {
	id := strings.ToLower(clusterID)
	switch {
	case strings.HasPrefix(id, "aws-"), strings.Contains(id, "eks"):
		return "aws"
	case strings.HasPrefix(id, "gcp-"), strings.Contains(id, "gke"):
		return "gcp"
	case strings.HasPrefix(id, "az-"), strings.Contains(id, "aks"):
		return "azure"
	case strings.HasPrefix(id, "edge-"):
		return "edge"
	default:
		return "unknown"
	}
}

type gpuInventoryEntry struct {
	Model             string   `json:"model"`
	Count             int      `json:"count"`
	MigProfile        *string  `json:"migProfile"`
	TotalMemoryGb     float64  `json:"totalMemoryGb"`
	AvgUtilizationPct float64  `json:"avgUtilizationPct"`
	ThrottledCount    int      `json:"throttledCount"`
	RatePerHourUsd    float64  `json:"ratePerHourUsd"`
	CostPerHourUsd    float64  `json:"costPerHourUsd"`
}

type clusterDetail struct {
	ID                string              `json:"id"`
	Name              string              `json:"name"`
	Provider          string              `json:"provider"`
	Region            string              `json:"region"`
	Status            string              `json:"status"`
	NodeCount         int                 `json:"nodeCount"`
	GpuCount          int                 `json:"gpuCount"`
	ThrottledCount    int                 `json:"throttledCount"`
	AvgUtilizationPct float64             `json:"avgUtilizationPct"`
	MemoryUsedGb      float64             `json:"memoryUsedGb"`
	MemoryTotalGb     float64             `json:"memoryTotalGb"`
	Models            []string            `json:"models"`
	Inventory         []gpuInventoryEntry `json:"inventory"`
	Gpus              []GpuDevice         `json:"gpus"`
	CostPerHourUsd    float64             `json:"costPerHourUsd"`
	CostPer24hUsd     float64             `json:"costPer24hUsd"`
	LastSeenAt        *string             `json:"lastSeenAt"`
}

func handleClusters(w http.ResponseWriter, r *http.Request, c *chClient, rates *rateCard) {
	org := orgFromRequest(r)
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var rows []fleetRow
	if err := c.query(r.Context(), fmt.Sprintf(qFleet, orgClause(org)), &rows); err != nil {
		log.Printf("clusters: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	// Throttle reference: the best clock any card of that model is achieving
	// across the whole fleet. Without a per-model spec table this is the most
	// honest baseline available, and it is fleet-wide so a cluster where every
	// card is throttling is still detected.
	peak := map[string]float64{}
	for _, r := range rows {
		if r.SmClockMhz > peak[r.Model] {
			peak[r.Model] = r.SmClockMhz
		}
	}

	byCluster := map[string]*clusterDetail{}
	nodes := map[string]map[string]bool{}
	invAgg := map[string]map[string]*gpuInventoryEntry{}

	for _, row := range rows {
		cd, ok := byCluster[row.ClusterID]
		if !ok {
			cd = &clusterDetail{
				ID: row.ClusterID, Name: row.ClusterID,
				Provider: providerOf(row.ClusterID), Region: row.ClusterID,
				Status: "healthy", Gpus: []GpuDevice{}, Inventory: []gpuInventoryEntry{}, Models: []string{},
			}
			byCluster[row.ClusterID] = cd
			nodes[row.ClusterID] = map[string]bool{}
			invAgg[row.ClusterID] = map[string]*gpuInventoryEntry{}
		}
		nodes[row.ClusterID][row.NodeName] = true
		throttled := peak[row.Model] > 0 && row.SmClockMhz < peak[row.Model]*0.97

		cd.Gpus = append(cd.Gpus, GpuDevice{
			UUID: row.UUID, ClusterID: row.ClusterID, NodeName: row.NodeName, Model: row.Model,
			MigProfile: migProfileOf(row.Model), UtilizationPct: row.UtilizationPct,
			MemoryUsedGb: row.MemoryUsedGb, MemoryTotalGb: maxf(row.MemoryTotalGb, 1),
			TemperatureC: row.TemperatureC, PowerWatts: row.PowerWatts,
			Throttled: throttled, XidErrors: 0,
		})
		cd.GpuCount++
		cd.MemoryUsedGb += row.MemoryUsedGb
		cd.MemoryTotalGb += row.MemoryTotalGb
		cd.AvgUtilizationPct += row.UtilizationPct
		if throttled {
			cd.ThrottledCount++
			cd.Status = "degraded"
		}
		if row.LastSeen > 0 {
			ts := time.Unix(row.LastSeen, 0).UTC().Format(time.RFC3339Nano)
			if cd.LastSeenAt == nil || ts > *cd.LastSeenAt {
				cd.LastSeenAt = &ts
			}
		}

		e, ok := invAgg[row.ClusterID][row.Model]
		if !ok {
			rate := rates.For(row.Model)
			e = &gpuInventoryEntry{Model: row.Model, MigProfile: migProfileOf(row.Model), RatePerHourUsd: rate}
			invAgg[row.ClusterID][row.Model] = e
		}
		e.Count++
		e.TotalMemoryGb += row.MemoryTotalGb
		e.AvgUtilizationPct += row.UtilizationPct
		if throttled {
			e.ThrottledCount++
		}
	}

	out := make([]ClusterDetailJSON, 0, len(byCluster))
	for id, cd := range byCluster {
		cd.NodeCount = len(nodes[id])
		if cd.GpuCount > 0 {
			cd.AvgUtilizationPct = round1(cd.AvgUtilizationPct / float64(cd.GpuCount))
		}
		cd.MemoryUsedGb = round1(cd.MemoryUsedGb)
		cd.MemoryTotalGb = round1(cd.MemoryTotalGb)

		for _, e := range invAgg[id] {
			if e.Count > 0 {
				e.AvgUtilizationPct = round1(e.AvgUtilizationPct / float64(e.Count))
			}
			e.CostPerHourUsd = math.Round(e.RatePerHourUsd*float64(e.Count)*100) / 100
			e.TotalMemoryGb = round1(e.TotalMemoryGb)
			cd.Inventory = append(cd.Inventory, *e)
			cd.Models = append(cd.Models, e.Model)
			cd.CostPerHourUsd += e.CostPerHourUsd
		}
		sort.Slice(cd.Inventory, func(i, j int) bool { return cd.Inventory[i].Count > cd.Inventory[j].Count })
		sort.Strings(cd.Models)
		cd.CostPerHourUsd = math.Round(cd.CostPerHourUsd*100) / 100
		cd.CostPer24hUsd = math.Round(cd.CostPerHourUsd*24*100) / 100
		sort.Slice(cd.Gpus, func(i, j int) bool {
			if cd.Gpus[i].NodeName != cd.Gpus[j].NodeName {
				return cd.Gpus[i].NodeName < cd.Gpus[j].NodeName
			}
			return cd.Gpus[i].UUID < cd.Gpus[j].UUID
		})
		out = append(out, ClusterDetailJSON(*cd))
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })

	writeJSON(w, map[string]any{
		"generatedAt": time.Now().UTC().Format(time.RFC3339Nano),
		"currency":    rates.Currency(),
		"clusters":    out,
	})
}

type ClusterDetailJSON = clusterDetail

// migProfileOf extracts a MIG profile from the model string when the card is
// partitioned. DCGM reports partitioned instances with a profile like
// "1g.10gb" in the product name.
func migProfileOf(model string) *string {
	for _, part := range strings.Fields(model) {
		if strings.Contains(part, "g.") && strings.HasSuffix(strings.ToLower(part), "gb") {
			p := part
			return &p
		}
	}
	return nil
}

var _ = fmt.Sprintf
var _ = context.Background
