package main

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func corr(sev, status string) Correlation {
	return Correlation{
		ID: "c1", Severity: sev, Status: status,
		Summary: "p95 TTFT breached because GPU-A is throttling",
		Symptom: CorrelationSymptom{Model: "llama", Metric: "ttft_p95", Observed: 1800, Threshold: 1200},
		Cause: CorrelationCause{Kind: "gpu_thermal_throttle", ClusterID: "gcp-usc1",
			Evidence: []Evidence{{Text: "temp 92C"}, {Text: "clock 1200MHz"}, {Text: "traffic flat"}, {Text: "sibling healthy"}}},
		Confidence: 0.91, RecommendedAction: "Drain gpu-a-04",
	}
}

// The engine re-detects an ongoing condition every tick. Without dedup an
// incident lasting an hour pages the on-call engineer 180 times, and the next
// real alert gets ignored.
func TestNotifyOncePerCondition(t *testing.T) {
	now := time.Now()

	if ok, reason := shouldNotify(corr("warning", "open"), "", time.Time{}); !ok || reason != "new" {
		t.Errorf("first sighting should notify as new, got ok=%v reason=%q", ok, reason)
	}
	if ok, _ := shouldNotify(corr("warning", "open"), "warning", now); ok {
		t.Error("re-detecting the same severity notified again — this is the paging storm")
	}
	// Escalation IS new information.
	if ok, reason := shouldNotify(corr("critical", "open"), "warning", now); !ok || reason != "escalated" {
		t.Errorf("warning -> critical should notify as escalated, got ok=%v reason=%q", ok, reason)
	}
	// De-escalation is not.
	if ok, _ := shouldNotify(corr("warning", "open"), "critical", now); ok {
		t.Error("critical -> warning notified; a condition improving is not worth a page")
	}
	// A human has already taken it.
	for _, st := range []string{"acknowledged", "suppressed", "resolved"} {
		if ok, _ := shouldNotify(corr("critical", st), "", time.Time{}); ok {
			t.Errorf("notified for a %s correlation", st)
		}
	}
}

func TestSeverityThreshold(t *testing.T) {
	cases := []struct{ sev, min string; want bool }{
		{"critical", "warning", true},
		{"warning", "warning", true},
		{"info", "warning", false},
		{"warning", "critical", false},
		{"critical", "critical", true},
		{"warning", "", true}, // empty defaults to warning
	}
	for _, c := range cases {
		if got := meetsThreshold(c.sev, c.min); got != c.want {
			t.Errorf("meetsThreshold(%q, min=%q) = %v, want %v", c.sev, c.min, got, c.want)
		}
	}
}

// The deep link is the entire point: the engineer must land on the answer, not
// on a dashboard they then have to search.
func TestPayloadCarriesDeepLinkAndCause(t *testing.T) {
	link := "http://localhost:3000/correlations/c1"

	raw, err := genericPayload(corr("critical", "open"), link, "new")
	if err != nil {
		t.Fatal(err)
	}
	var g map[string]any
	if err := json.Unmarshal(raw, &g); err != nil {
		t.Fatal(err)
	}
	if g["link"] != link {
		t.Errorf("generic payload link = %v, want %v", g["link"], link)
	}
	for _, k := range []string{"severity", "summary", "cause", "confidence", "evidence", "action"} {
		if _, ok := g[k]; !ok {
			t.Errorf("generic payload missing %q", k)
		}
	}
	if ev, ok := g["evidence"].([]any); !ok || len(ev) != 4 {
		t.Errorf("evidence not carried through: %v", g["evidence"])
	}

	sraw, err := slackPayload(corr("critical", "open"), link, "new")
	if err != nil {
		t.Fatal(err)
	}
	s := string(sraw)
	if !strings.Contains(s, link) {
		t.Error("slack payload has no link button URL")
	}
	for _, want := range []string{"Drain gpu-a-04", "91%", "gpu_thermal_throttle", "Recommended action"} {
		if !strings.Contains(s, want) && !strings.Contains(s, strings.ReplaceAll(want, "_", " ")) {
			t.Errorf("slack payload missing %q", want)
		}
	}
}

// The engine revises its diagnosis as a situation develops: traffic_surge,
// then unknown, then gpu_thermal_throttle — three ids, one incident. Deduping
// per id pages three times and two of those pages are wrong by the time they
// are read. This pins the per-service behaviour instead.
func TestOneIncidentPagesOnce(t *testing.T) {
	const cluster, model = "gcp-usc1", "llama-3.3-70b-instruct"
	pagedForService := map[string]string{}
	key := notifyKey(cluster, model)

	// The sequence actually observed in a live run.
	sequence := []struct {
		cause, severity string
	}{
		{"traffic_surge", "warning"},
		{"unknown", "warning"},
		{"gpu_thermal_throttle", "critical"},
		{"gpu_thermal_throttle", "critical"},
		{"gpu_thermal_throttle", "critical"},
	}

	var pages []string
	for _, step := range sequence {
		c := corr(step.severity, "open")
		c.Cause.Kind = step.cause
		c.Cause.ClusterID = cluster
		c.Symptom.Model = model
		if ok, reason := shouldNotify(c, pagedForService[key], time.Time{}); ok {
			pages = append(pages, step.cause+":"+reason)
			pagedForService[key] = step.severity
		}
	}

	// One page when it starts, one when it escalates. Not five, not three.
	want := []string{"traffic_surge:new", "gpu_thermal_throttle:escalated"}
	if len(pages) != len(want) {
		t.Fatalf("paged %d time(s) %v, want %d %v", len(pages), pages, len(want), want)
	}
	for i := range want {
		if pages[i] != want[i] {
			t.Errorf("page %d = %q, want %q", i, pages[i], want[i])
		}
	}
}
