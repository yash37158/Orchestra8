package main

import (
	"encoding/json"
	"net/http"
	"os"
	"os/exec"
	"sort"
	"strings"
	"time"
)

// Configuration surface (the /settings page).
//
// Every value here is read from a file in the repo, because that is where this
// product's configuration lives — an SLO or routing change should be a
// reviewable commit, not a click with no audit trail. The page therefore shows
// what IS configured and names the file, rather than pretending to be an
// editor for settings that have no backend.

func handleConfig(w http.ResponseWriter, r *http.Request, c *chClient, slos *sloStore, rates *rateCard, ntf *notifier, repo string) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	sloMap := slos.All()
	models := map[string]float64{}
	for k, v := range sloMap {
		models[k] = v
	}

	nc := ntf.config()
	dests := make([]map[string]any, 0, len(nc.Destinations))
	for _, d := range nc.Destinations {
		dests = append(dests, map[string]any{
			"id": d.ID, "kind": d.Kind, "minSeverity": d.MinSeverity,
			"enabled": d.Enabled,
			// Never return the URL: a Slack webhook URL is a credential, and a
			// settings page is exactly where one gets screenshotted.
			"configured": d.URL != "",
		})
	}

	rates.mu.RLock()
	rateMap := map[string]float64{}
	for k, v := range rates.rates {
		rateMap[k] = v
	}
	currency, fallback := rates.currency, rates.fallback
	rates.mu.RUnlock()

	// Clusters are listed from telemetry, not a registry: a cluster that has
	// stopped reporting must not appear here as though it were connected.
	var rows []struct {
		ClusterID string `json:"clusterId"`
		Gpus      int    `json:"gpus"`
		LastSeen  int64  `json:"lastSeen"`
	}
	_ = c.query(r.Context(), `
SELECT ResourceAttributes['orchestr8.cluster.id'] AS clusterId,
       uniq(Attributes['UUID']) AS gpus,
       toUnixTimestamp(max(TimeUnix)) AS lastSeen
FROM orchestr8.otel_metrics_gauge
WHERE MetricName = 'DCGM_FI_DEV_GPU_TEMP' AND TimeUnix >= now() - INTERVAL 1 DAY
GROUP BY clusterId ORDER BY clusterId`, &rows)

	clusters := make([]map[string]any, 0, len(rows))
	for _, row := range rows {
		var seen *string
		if row.LastSeen > 0 {
			s := time.Unix(row.LastSeen, 0).UTC().Format(time.RFC3339Nano)
			seen = &s
		}
		clusters = append(clusters, map[string]any{
			"id": row.ClusterID, "gpuCount": row.Gpus, "lastSeenAt": seen,
		})
	}

	writeJSON(w, map[string]any{
		"slos": map[string]any{
			"defaultTtftP95Ms": float64(defaultTtftSloMs),
			"models":           models,
		},
		"notifications": map[string]any{
			"publicUrl":    nc.PublicURL,
			"destinations": dests,
		},
		"gpuRates": map[string]any{
			"currency": currency, "defaultPerHour": fallback, "rates": rateMap,
		},
		"clusters": clusters,
		"gitops":   gitopsStatus(repo),
	})
}

func gitopsStatus(repo string) map[string]any {
	out := map[string]any{"repo": repo, "reachable": false, "branch": ""}
	if _, err := os.Stat(repo); err != nil {
		return out
	}
	cmd := exec.Command("git", "rev-parse", "--abbrev-ref", "HEAD")
	cmd.Dir = repo
	b, err := cmd.Output()
	if err != nil {
		return out
	}
	out["reachable"] = true
	out["branch"] = strings.TrimSpace(string(b))
	return out
}

// sortedKeys keeps config rendering stable between reloads.
func sortedKeys(m map[string]float64) []string {
	ks := make([]string, 0, len(m))
	for k := range m {
		ks = append(ks, k)
	}
	sort.Strings(ks)
	return ks
}

var _ = json.Marshal
