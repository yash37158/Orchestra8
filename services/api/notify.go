package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

// Alert routing.
//
// The correlation engine writes a complete diagnosis every tick. Without this
// file nobody sees it unless they already have the dashboard open — which is
// the opposite of how on-call works. Every notification carries a deep link to
// the correlation, so the engineer lands on the answer rather than on a
// dashboard they then have to search.
//
// Three rules shape the design:
//
//  1. Notify ONCE per condition, not once per tick. An incident lasting an hour
//     must not page someone 180 times.
//  2. Re-notify on ESCALATION only (warning -> critical). That is new
//     information; a repeat of the same severity is not.
//  3. A dead webhook must never break detection. Delivery failures are logged
//     and audited, and the engine carries on.

type destination struct {
	ID          string `json:"id"`
	Kind        string `json:"kind"` // webhook | slack
	URL         string `json:"url"`
	MinSeverity string `json:"minSeverity"`
	Enabled     bool   `json:"enabled"`
	Note        string `json:"note"`
}

type notifyFile struct {
	PublicURL    string        `json:"publicUrl"`
	Destinations []destination `json:"destinations"`
}

type notifier struct {
	path  string
	audit *auditLog
	http  *http.Client

	mu      sync.RWMutex
	cfg     notifyFile
	modTime time.Time
}

func newNotifier(path string, audit *auditLog) *notifier {
	n := &notifier{
		path: path, audit: audit,
		// A slow endpoint must not stall the detection loop.
		http: &http.Client{Timeout: 8 * time.Second},
	}
	if err := n.reload(); err != nil {
		log.Printf("notify: %v — alert routing is OFF until this file is readable", err)
	}
	return n
}

func (n *notifier) reload() error {
	fi, err := os.Stat(n.path)
	if err != nil {
		return err
	}
	n.mu.RLock()
	unchanged := fi.ModTime().Equal(n.modTime)
	n.mu.RUnlock()
	if unchanged {
		return nil
	}
	raw, err := os.ReadFile(n.path)
	if err != nil {
		return err
	}
	var f notifyFile
	if err := json.Unmarshal(raw, &f); err != nil {
		return err
	}
	n.mu.Lock()
	n.cfg, n.modTime = f, fi.ModTime()
	n.mu.Unlock()

	var on int
	for _, d := range f.Destinations {
		if d.Enabled && d.URL != "" {
			on++
		}
	}
	log.Printf("notify: %d destination(s) active of %d configured", on, len(f.Destinations))
	return nil
}

func (n *notifier) config() notifyFile {
	_ = n.reload()
	n.mu.RLock()
	defer n.mu.RUnlock()
	return n.cfg
}

var severityOrder = map[string]int{"info": 0, "warning": 1, "critical": 2}

// shouldNotify decides whether this correlation is news.
func shouldNotify(c Correlation, notifiedSeverity string, notifiedAt time.Time) (bool, string) {
	if c.Status != "open" {
		return false, "" // acknowledged and suppressed conditions are somebody's problem already
	}
	if notifiedSeverity == "" {
		return true, "new"
	}
	if severityOrder[c.Severity] > severityOrder[notifiedSeverity] {
		return true, "escalated"
	}
	return false, ""
}

func meetsThreshold(sev, min string) bool {
	if min == "" {
		min = "warning"
	}
	return severityOrder[sev] >= severityOrder[min]
}

// Notify delivers one correlation to every destination that wants it.
// Returns the destinations that accepted it.
func (n *notifier) Notify(ctx context.Context, c Correlation, reason string) []string {
	cfg := n.config()
	link := strings.TrimRight(cfg.PublicURL, "/") + "/correlations/" + c.ID

	var delivered []string
	for _, d := range cfg.Destinations {
		if !d.Enabled || d.URL == "" || !meetsThreshold(c.Severity, d.MinSeverity) {
			continue
		}
		body, err := buildPayload(d.Kind, c, link, reason)
		if err != nil {
			log.Printf("notify: build %s: %v", d.ID, err)
			continue
		}
		if err := n.post(ctx, d.URL, body); err != nil {
			// Deliberately non-fatal. Losing an alert is bad; losing detection
			// because an alert endpoint is down is worse.
			log.Printf("notify: %s failed: %v", d.ID, err)
			_, _ = n.audit.Append(ctx, "orchestr8-engine", "notify.send", c.ID, c.Cause.ClusterID, "failed",
				map[string]any{"destination": d.ID, "error": err.Error(), "severity": c.Severity})
			continue
		}
		delivered = append(delivered, d.ID)
		_, _ = n.audit.Append(ctx, "orchestr8-engine", "notify.send", c.ID, c.Cause.ClusterID, "allowed",
			map[string]any{"destination": d.ID, "severity": c.Severity, "reason": reason, "link": link})
	}
	return delivered
}

func (n *notifier) post(ctx context.Context, url string, body []byte) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := n.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("endpoint returned %d", resp.StatusCode)
	}
	return nil
}

// -------------------------------------------------------------- payloads

func buildPayload(kind string, c Correlation, link, reason string) ([]byte, error) {
	switch kind {
	case "slack":
		return slackPayload(c, link, reason)
	default:
		return genericPayload(c, link, reason)
	}
}

// genericPayload is deliberately flat and self-describing so it can be mapped
// onto PagerDuty Events, Opsgenie or a homegrown receiver without this service
// knowing about any of them.
func genericPayload(c Correlation, link, reason string) ([]byte, error) {
	evidence := make([]string, 0, len(c.Cause.Evidence))
	for _, e := range c.Cause.Evidence {
		evidence = append(evidence, e.Text)
	}
	return json.Marshal(map[string]any{
		"source":      "orchestr8",
		"event":       "correlation." + reason,
		"id":          c.ID,
		"link":        link,
		"severity":    c.Severity,
		"summary":     c.Summary,
		"confidence":  c.Confidence,
		"detectedAt":  c.DetectedAt,
		"cluster":     c.Cause.ClusterID,
		"cause":       c.Cause.Kind,
		"gpuUuid":     c.Cause.GpuUUID,
		"nodeName":    c.Cause.NodeName,
		"model":       c.Symptom.Model,
		"metric":      c.Symptom.Metric,
		"observed":    c.Symptom.Observed,
		"threshold":   c.Symptom.Threshold,
		"evidence":    evidence,
		"action":      c.RecommendedAction,
	})
}

// slackPayload leads with the summary and the action. Someone reading this on a
// phone at 3am needs the cause and the next step above the fold; the evidence
// is there for when they open the link.
func slackPayload(c Correlation, link, reason string) ([]byte, error) {
	emoji := ":large_orange_diamond:"
	if c.Severity == "critical" {
		emoji = ":red_circle:"
	}
	header := fmt.Sprintf("%s %s — %s", emoji, strings.ToUpper(c.Severity), strings.ReplaceAll(c.Cause.Kind, "_", " "))

	var ev strings.Builder
	for i, e := range c.Cause.Evidence {
		if i >= 3 {
			fmt.Fprintf(&ev, "_+%d more_", len(c.Cause.Evidence)-3)
			break
		}
		fmt.Fprintf(&ev, "• %s\n", e.Text)
	}

	return json.Marshal(map[string]any{
		"text": fmt.Sprintf("%s: %s", header, c.Summary),
		"blocks": []any{
			map[string]any{"type": "section", "text": map[string]any{"type": "mrkdwn",
				"text": fmt.Sprintf("*%s*\n%s", header, c.Summary)}},
			map[string]any{"type": "context", "elements": []any{
				map[string]any{"type": "mrkdwn",
					"text": fmt.Sprintf("*%d%%* confidence · cluster `%s` · %s",
						int(c.Confidence*100), c.Cause.ClusterID, c.Symptom.Model)}}},
			map[string]any{"type": "section", "text": map[string]any{"type": "mrkdwn",
				"text": "*Evidence*\n" + ev.String()}},
			map[string]any{"type": "section", "text": map[string]any{"type": "mrkdwn",
				"text": "*Recommended action*\n" + c.RecommendedAction}},
			map[string]any{"type": "actions", "elements": []any{
				map[string]any{"type": "button", "style": "primary",
					"text": map[string]any{"type": "plain_text", "text": "Open correlation"},
					"url":  link}}},
		},
	})
}
