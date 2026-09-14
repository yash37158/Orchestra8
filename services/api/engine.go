package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"
)

// The detection loop. Runs inside the API rather than as a fourth service:
// it reads the same store, on the same schedule, and a separate deployable
// would buy nothing today.
//
// It watches every tenant, not one. It used to take a single organisation from
// an environment variable, which meant a second customer got a working
// dashboard and no alerts, ever, with nothing to indicate it — the correlation
// panel said "nothing was provable", when in truth nothing had been examined.
// That is worse than an outage: it is a silent, confident, wrong reassurance.
//
// ponytail: assumes a single writer. Two API replicas would both detect and
// both write — harmless with ReplacingMergeTree and a stable Id, but wasteful.
// Move to a leader election or a dedicated engine deployment when the API
// needs to scale horizontally.

type engine struct {
	ch       *chClient
	slos     *sloStore
	notify   *notifier
	interval time.Duration
	// How many tenants are examined at once. Bounded on purpose: unbounded
	// would let a hundred organisations open a hundred simultaneous queries,
	// and one at a time would let a single slow tenant delay everybody else's
	// alerts by the whole sweep.
	workers int

	// Consecutive ticks each open correlation has gone undetected. An alerting
	// system that flaps is worse than one that is slightly slow to clear, so a
	// condition must be absent for several ticks before it is resolved — one
	// unlucky read must never tear down a correct diagnosis.
	//
	// Keyed by organisation AND correlation id. Two tenants can run clusters
	// with the same name serving the same model, which produces the same
	// correlation id — sharing a counter would let one tenant's recovery
	// resolve another's live incident.
	mu     sync.Mutex
	misses map[string]int
}

const missesBeforeResolve = 3

// statusForDetection is what a freshly detected correlation's status becomes,
// given whatever the store already held for it.
//
// Only a human's decision survives a re-detection. The engine's own "resolved"
// does not: see the note at the call site.
func statusForDetection(previous string) string {
	switch previous {
	case "acknowledged", "suppressed":
		return previous
	default:
		return "open"
	}
}

// How long any one tenant may take before it is abandoned for this tick. A
// sweep that outruns the interval is how alerts start arriving late for
// everyone, so a tenant whose data is pathological is dropped rather than
// allowed to hold the sweep open.
const perOrgBudget = 20 * time.Second

func (e *engine) run(ctx context.Context) {
	t := time.NewTicker(e.interval)
	defer t.Stop()
	e.sweep(ctx) // don't make the first correlation wait a full interval
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			e.sweep(ctx)
		}
	}
}

// sweep examines every tenant that has sent telemetry recently.
func (e *engine) sweep(ctx context.Context) {
	orgs, err := e.ch.activeOrgs(ctx)
	if err != nil {
		log.Printf("engine: list tenants: %v", err)
		return
	}
	if len(orgs) == 0 {
		return
	}

	workers := e.workers
	if workers < 1 {
		workers = 1
	}
	sem := make(chan struct{}, workers)
	var wg sync.WaitGroup
	for _, org := range orgs {
		select {
		case <-ctx.Done():
			return
		case sem <- struct{}{}:
		}
		wg.Add(1)
		go func(org string) {
			defer wg.Done()
			defer func() { <-sem }()
			// A panic in one tenant's rules must not take down detection for
			// everybody. The engine is the thing that is supposed to notice
			// trouble; it cannot be the thing that dies of it.
			defer func() {
				if r := recover(); r != nil {
					log.Printf("engine: tenant %s panicked: %v", org, r)
				}
			}()
			tctx, cancel := context.WithTimeout(withOrg(ctx, org), perOrgBudget)
			defer cancel()
			e.tick(tctx, org)
		}(org)
	}
	wg.Wait()
}

// activeOrgs lists the tenants worth examining.
//
// Read from telemetry rather than from the control plane: an organisation that
// has sent nothing cannot produce a correlation, so querying the customer list
// would mean sweeping accounts that provably have nothing to find. The window
// is generous enough to cover a cluster that is briefly quiet.
func (c *chClient) activeOrgs(ctx context.Context) ([]string, error) {
	var rows []struct {
		Org string `json:"org"`
	}
	if err := c.query(ctx, `
SELECT DISTINCT OrgId AS org FROM orchestr8.inference_minute
WHERE Minute >= now() - INTERVAL 30 MINUTE AND OrgId != ''
ORDER BY org`, &rows); err != nil {
		return nil, err
	}
	out := make([]string, 0, len(rows))
	for _, r := range rows {
		out = append(out, r.Org)
	}
	return out, nil
}

func (e *engine) tick(ctx context.Context, org string) {
	signals, err := collectSignals(ctx, e.ch, org, e.slos.All())
	if err != nil {
		log.Printf("engine: collect: %v", err)
		return
	}
	// A user's decision outranks the engine's. If someone acknowledged or
	// suppressed a condition that is still happening, re-detecting it must not
	// quietly flip it back to open and re-page them.
	existing, err := e.ch.correlationStatuses(ctx, org)
	if err != nil {
		log.Printf("engine: read statuses: %v", err)
		existing = map[string]correlationState{}
	}

	// Highest severity already paged for each SERVICE, across every hypothesis
	// the engine has held about it. Only open correlations count: a resolved
	// one must not suppress a page for a fresh incident.
	pagedForService := map[string]string{}
	for _, st := range existing {
		if st.Status != "open" || st.NotifiedSeverity == "" {
			continue
		}
		k := notifyKey(st.ClusterID, st.Model)
		if severityOrder[st.NotifiedSeverity] > severityOrder[pagedForService[k]] {
			pagedForService[k] = st.NotifiedSeverity
		}
	}

	var found []Correlation
	notifyState := map[string]correlationState{}
	for _, s := range signals {
		c := Correlate(s)
		if c == nil {
			continue
		}
		prev := existing[c.ID]
		// A human's decision outranks the engine, so acknowledged and
		// suppressed are carried forward untouched.
		//
		// "resolved" is NOT a decision — it is the engine's own bookkeeping
		// for a condition that stopped being detected. Carrying it forward
		// meant every recurrence was written straight back as resolved,
		// filtered out of the list, and never paged: the product went blind to
		// any incident that had happened once before. Thermal throttling comes
		// and goes by nature, so that was most of them.
		//
		// Re-detecting a resolved condition means it is happening again.
		c.Status = statusForDetection(prev.Status)
		reopened := prev.Status == "resolved"
		if reopened {
			// A fresh occurrence deserves a fresh page. The old notification
			// record belongs to an incident that already ended, and leaving it
			// in place would suppress this one as a duplicate of it.
			prev.NotifiedSeverity, prev.NotifiedAt = "", time.Time{}
			log.Printf("engine: [%s] reopened %s", org, c.ID)
		}
		// Carry the notification record forward by default, so re-detecting an
		// ongoing condition does not re-page anyone.
		st := correlationState{Status: c.Status, ClusterID: c.Cause.ClusterID, Model: c.Symptom.Model,
			NotifiedSeverity: prev.NotifiedSeverity, NotifiedAt: prev.NotifiedAt}
		if e.notify != nil {
			key := notifyKey(c.Cause.ClusterID, c.Symptom.Model)
			if ok, reason := shouldNotify(*c, pagedForService[key], prev.NotifiedAt); ok {
				if delivered := e.notify.Notify(ctx, *c, reason); len(delivered) > 0 {
					st.NotifiedSeverity, st.NotifiedAt = c.Severity, time.Now().UTC()
					// Record against the service too, so a second correlation
					// for the same service in this same tick does not page again.
					pagedForService[key] = c.Severity
					log.Printf("engine: [%s] notified %s (%s, service=%s) -> %v", org, c.ID, reason, key, delivered)
				}
			}
		}
		notifyState[c.ID] = st
		found = append(found, *c)
	}
	// Close what is no longer happening. A correlation that stops being detected
	// has either recovered or been superseded by a better explanation — an early
	// "unknown" replaced by a thermal diagnosis once the card actually throttled.
	// Leaving those open is how a correlation list turns into the alert-fatigue
	// problem this product exists to remove.
	live := map[string]bool{}
	for _, c := range found {
		live[c.ID] = true
	}
	for id, st := range existing {
		if st.Status != "open" {
			continue
		}
		if live[id] {
			e.forget(org, id)
			continue
		}
		if e.miss(org, id) < missesBeforeResolve {
			continue
		}
		if err := e.ch.setStatus(ctx, org, id, "resolved"); err != nil {
			log.Printf("engine: resolve %s: %v", id, err)
			continue
		}
		e.forget(org, id)
		log.Printf("engine: [%s] resolved %s (absent for %d ticks)", org, id, missesBeforeResolve)
	}

	if len(found) == 0 {
		return
	}
	if err := e.ch.insertCorrelations(ctx, org, found, notifyState); err != nil {
		log.Printf("engine: insert: %v", err)
		return
	}
	for _, c := range found {
		log.Printf("engine: [%s] %s  %s  conf=%.2f  %s", org, c.Severity, c.Cause.Kind, c.Confidence, c.ID)
	}
}

// miss records that a correlation went undetected and returns the running
// count. Scoped by tenant, and guarded because tenants are swept concurrently.
func (e *engine) miss(org, id string) int {
	e.mu.Lock()
	defer e.mu.Unlock()
	if e.misses == nil {
		e.misses = map[string]int{}
	}
	k := scopeKey(org, id)
	e.misses[k]++
	return e.misses[k]
}

func (e *engine) forget(org, id string) {
	e.mu.Lock()
	defer e.mu.Unlock()
	delete(e.misses, scopeKey(org, id))
}

// ------------------------------------------------------------ persistence

type correlationRow struct {
	Id                string  `json:"Id"`
	DetectedAt        string  `json:"DetectedAt"`
	UpdatedAt         string  `json:"UpdatedAt"`
	Status            string  `json:"Status"`
	Severity          string  `json:"Severity"`
	Summary           string  `json:"Summary"`
	WindowStart       string  `json:"WindowStart"`
	WindowEnd         string  `json:"WindowEnd"`
	ServiceId         string  `json:"ServiceId"`
	Model             string  `json:"Model"`
	SymptomMetric     string  `json:"SymptomMetric"`
	SymptomObserved   float64 `json:"SymptomObserved"`
	SymptomThreshold  float64 `json:"SymptomThreshold"`
	CauseKind         string  `json:"CauseKind"`
	CauseGpuUuid      string  `json:"CauseGpuUuid"`
	CauseNodeName     string  `json:"CauseNodeName"`
	ClusterId         string  `json:"ClusterId"`
	EvidenceJson      string  `json:"EvidenceJson"`
	OrgId             string  `json:"OrgId"`
	Confidence        float64 `json:"Confidence"`
	RecommendedAction string  `json:"RecommendedAction"`
	NotifiedAt        string  `json:"NotifiedAt"`
	NotifiedSeverity  string  `json:"NotifiedSeverity"`
}

// correlationState is what the engine must carry across ticks: a human's
// decision, and whether anyone has already been told.
type correlationState struct {
	Status           string
	ClusterID        string
	Model            string
	NotifiedSeverity string
	NotifiedAt       time.Time
}

// notifyKey is the unit an on-call engineer actually cares about: a SERVICE,
// not a hypothesis about it.
//
// Correlation ids are per (cluster, model, cause). As a situation develops the
// engine can revise its diagnosis — traffic_surge, then unknown, then
// gpu_thermal_throttle — and each revision is a different id. Deduping on id
// therefore pages three times for one incident, and two of those pages are
// superseded within a minute. Deduping on the service collapses them into one
// page plus a genuine escalation.
func notifyKey(clusterID, model string) string { return clusterID + "|" + model }

// ClickHouse DateTime64 wants 'YYYY-MM-DD hh:mm:ss.SSS', not RFC3339.
func chTime(rfc string) string {
	t, err := time.Parse(time.RFC3339Nano, rfc)
	if err != nil {
		t = time.Now().UTC()
	}
	return t.UTC().Format("2006-01-02 15:04:05.000")
}

func (c *chClient) insertCorrelations(ctx context.Context, org string, cs []Correlation, state map[string]correlationState) error {
	var body bytes.Buffer
	body.WriteString("INSERT INTO orchestr8.correlations FORMAT JSONEachRow\n")
	for _, x := range cs {
		ev, err := json.Marshal(x.Cause.Evidence)
		if err != nil {
			return err
		}
		row := correlationRow{
			OrgId: org,
			Id:    x.ID, DetectedAt: chTime(x.DetectedAt), UpdatedAt: chTime(x.UpdatedAt),
			Status: x.Status, Severity: x.Severity, Summary: x.Summary,
			WindowStart: chTime(x.WindowStart), WindowEnd: chTime(x.WindowEnd),
			ServiceId: x.Symptom.ServiceID, Model: x.Symptom.Model,
			SymptomMetric: x.Symptom.Metric, SymptomObserved: x.Symptom.Observed,
			SymptomThreshold: x.Symptom.Threshold,
			CauseKind:        x.Cause.Kind, ClusterId: x.Cause.ClusterID,
			EvidenceJson: string(ev), Confidence: x.Confidence, RecommendedAction: x.RecommendedAction,
		}
		if x.Cause.GpuUUID != nil {
			row.CauseGpuUuid = *x.Cause.GpuUUID
		}
		if x.Cause.NodeName != nil {
			row.CauseNodeName = *x.Cause.NodeName
		}
		if st, ok := state[x.ID]; ok {
			row.NotifiedSeverity = st.NotifiedSeverity
			if !st.NotifiedAt.IsZero() {
				row.NotifiedAt = st.NotifiedAt.Format("2006-01-02 15:04:05.000")
			}
		}
		if row.NotifiedAt == "" {
			row.NotifiedAt = "1970-01-01 00:00:00.000"
		}
		line, err := json.Marshal(row)
		if err != nil {
			return err
		}
		body.Write(line)
		body.WriteByte('\n')
	}
	return c.exec(ctx, body.String())
}

// exec runs a statement that returns no rows.
func (c *chClient) exec(ctx context.Context, sql string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.url, strings.NewReader(sql))
	if err != nil {
		return err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("clickhouse unreachable: %w", err)
	}
	defer resp.Body.Close()
	out, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("clickhouse %d: %s", resp.StatusCode, bytes.TrimSpace(out))
	}
	return nil
}

// ------------------------------------------------------------------ reads

// FINAL forces ReplacingMergeTree to collapse duplicates at read time. Without
// it a correlation updated on every tick reads back as many rows, and the most
// recent one is not guaranteed to be the one you get.
const qCorrelations = `
SELECT Id, toString(DetectedAt) AS DetectedAt, toString(UpdatedAt) AS UpdatedAt,
       Status, Severity, Summary,
       toString(WindowStart) AS WindowStart, toString(WindowEnd) AS WindowEnd,
       ServiceId, Model, SymptomMetric, SymptomObserved, SymptomThreshold,
       CauseKind, CauseGpuUuid, CauseNodeName, ClusterId, EvidenceJson,
       Confidence, RecommendedAction
FROM orchestr8.correlations FINAL
WHERE OrgId = '%s' AND (Status NOT IN ('suppressed', 'resolved') %s)
ORDER BY multiIf(Severity = 'critical', 0, Severity = 'warning', 1, 2), UpdatedAt DESC`

func (c *chClient) correlationStatuses(ctx context.Context, org string) (map[string]correlationState, error) {
	var rows []struct {
		Id               string `json:"Id"`
		Status           string `json:"Status"`
		ClusterId        string `json:"ClusterId"`
		Model            string `json:"Model"`
		NotifiedSeverity string `json:"NotifiedSeverity"`
		NotifiedAt       string `json:"NotifiedAt"`
	}
	if err := c.query(ctx,
		"SELECT Id, Status, ClusterId, Model, NotifiedSeverity, toString(NotifiedAt) AS NotifiedAt FROM orchestr8.correlations FINAL WHERE "+orgClause(org),
		&rows); err != nil {
		return nil, err
	}
	out := map[string]correlationState{}
	for _, r := range rows {
		st := correlationState{Status: r.Status, ClusterID: r.ClusterId, Model: r.Model,
			NotifiedSeverity: r.NotifiedSeverity}
		if t, err := time.Parse("2006-01-02 15:04:05.000", r.NotifiedAt); err == nil {
			st.NotifiedAt = t
		}
		out[r.Id] = st
	}
	return out, nil
}

func (c *chClient) correlations(ctx context.Context, org, id string) ([]Correlation, error) {
	// Listing hides resolved and suppressed noise. Fetching ONE by id must not:
	// a link from a page received at 3am has to open even after the condition
	// recovered, or the evidence disappears exactly when someone goes to read it.
	filter := ""
	if id != "" {
		filter = fmt.Sprintf("OR Id = %s", chQuote(id))
	}
	var rows []correlationRow
	q := fmt.Sprintf(qCorrelations, org, filter)
	if id != "" {
		// Restrict to the requested id; the OR above only widens status.
		q = fmt.Sprintf("SELECT * FROM (%s) WHERE Id = %s", q, chQuote(id))
	}
	if err := c.query(ctx, q, &rows); err != nil {
		return nil, err
	}
	out := make([]Correlation, 0, len(rows))
	for _, r := range rows {
		var ev []Evidence
		if r.EvidenceJson != "" {
			_ = json.Unmarshal([]byte(r.EvidenceJson), &ev)
		}
		if ev == nil {
			ev = []Evidence{}
		}
		c := Correlation{
			ID: r.Id, DetectedAt: isoFromCH(r.DetectedAt), UpdatedAt: isoFromCH(r.UpdatedAt),
			Status: r.Status, Severity: r.Severity, Summary: r.Summary,
			WindowStart: isoFromCH(r.WindowStart), WindowEnd: isoFromCH(r.WindowEnd),
			Symptom: CorrelationSymptom{
				ServiceID: r.ServiceId, Model: r.Model, Metric: r.SymptomMetric,
				Observed: r.SymptomObserved, Threshold: r.SymptomThreshold,
			},
			Cause: CorrelationCause{
				Kind: r.CauseKind, ClusterID: r.ClusterId, Evidence: ev,
			},
			Confidence: r.Confidence, RecommendedAction: r.RecommendedAction,
		}
		if r.CauseGpuUuid != "" {
			v := r.CauseGpuUuid
			c.Cause.GpuUUID = &v
		}
		if r.CauseNodeName != "" {
			v := r.CauseNodeName
			c.Cause.NodeName = &v
		}
		out = append(out, c)
	}
	return out, nil
}

// setStatus records a human decision. Writes a new row rather than mutating:
// ReplacingMergeTree collapses on UpdatedAt, and an append-only history is what
// the audit ledger will later read.
func (c *chClient) setStatus(ctx context.Context, org, id, status string) error {
	existing, err := c.correlationsRaw(ctx, org, id)
	if err != nil {
		return err
	}
	if len(existing) == 0 {
		return fmt.Errorf("no correlation %q", id)
	}
	row := existing[0]
	row.Status = status
	row.UpdatedAt = time.Now().UTC().Format("2006-01-02 15:04:05.000")
	row.DetectedAt = chTime(isoFromCH(row.DetectedAt))
	if row.NotifiedAt != "" {
		row.NotifiedAt = chTime(isoFromCH(row.NotifiedAt))
	} else {
		row.NotifiedAt = "1970-01-01 00:00:00.000"
	}
	row.WindowStart = chTime(isoFromCH(row.WindowStart))
	row.WindowEnd = chTime(isoFromCH(row.WindowEnd))
	line, err := json.Marshal(row)
	if err != nil {
		return err
	}
	return c.exec(ctx, "INSERT INTO orchestr8.correlations FORMAT JSONEachRow\n"+string(line)+"\n")
}

func (c *chClient) correlationsRaw(ctx context.Context, org, id string) ([]correlationRow, error) {
	var rows []correlationRow
	q := fmt.Sprintf(`SELECT Id, toString(DetectedAt) AS DetectedAt, toString(UpdatedAt) AS UpdatedAt,
       Status, Severity, Summary, toString(WindowStart) AS WindowStart, toString(WindowEnd) AS WindowEnd,
       ServiceId, Model, SymptomMetric, SymptomObserved, SymptomThreshold,
       CauseKind, CauseGpuUuid, CauseNodeName, ClusterId, EvidenceJson, Confidence, RecommendedAction,
       toString(NotifiedAt) AS NotifiedAt, NotifiedSeverity, OrgId
FROM orchestr8.correlations FINAL WHERE %s AND Id = %s LIMIT 1`, orgClause(org), chQuote(id))
	return rows, c.query(ctx, q, &rows)
}

// chQuote escapes a string for ClickHouse SQL. Ids come from the engine, but
// the status endpoints accept them from the network, so they are never
// concatenated raw.
func chQuote(s string) string {
	return "'" + strings.ReplaceAll(strings.ReplaceAll(s, `\`, `\\`), `'`, `\'`) + "'"
}

func isoFromCH(s string) string {
	for _, layout := range []string{"2006-01-02 15:04:05.000", "2006-01-02 15:04:05"} {
		if t, err := time.Parse(layout, s); err == nil {
			return t.UTC().Format(time.RFC3339Nano)
		}
	}
	return s
}
