package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"
)

// Append-only audit log with a hash chain.
//
// Each entry hashes its own contents together with the previous entry's hash,
// so the log is tamper-EVIDENT: edit or delete any row and every hash after it
// stops matching. That is the property people actually want when they say
// "blockchain audit log", at roughly none of the cost.
//
// ponytail: single-writer. Seq is read-then-written, so two API replicas could
// race and produce a fork. Move to a ClickHouse sequence or leader election
// before scaling the API horizontally — the chain would detect the fork rather
// than silently accepting it, which is the right failure mode.

// One audit log for every tenant, not one per tenant.
//
// The organisation comes from the context on each call, so a single mutex
// serialises the read-then-write of Seq across all of them. Per-tenant
// instances would each hold their own lock and could fork the chain when a
// handler and the detection engine wrote for the same org at once.
//
// ponytail: that mutex serialises audit writes globally. They happen on
// deploys, scans and pages — rare enough that contention is not a concern, and
// the fix if it ever is would be a ClickHouse sequence rather than finer locks.
type auditLog struct {
	ch *chClient
	mu sync.Mutex
}

type AuditEntry struct {
	Seq       uint64         `json:"seq"`
	At        string         `json:"at"`
	Actor     string         `json:"actor"`
	Action    string         `json:"action"`
	Subject   string         `json:"subject"`
	ClusterID string         `json:"clusterId"`
	Outcome   string         `json:"outcome"`
	Detail    map[string]any `json:"detail"`
	PrevHash  string         `json:"prevHash"`
	Hash      string         `json:"hash"`
}

type auditRow struct {
	OrgId     string `json:"OrgId"`
	Seq       uint64 `json:"Seq"`
	At        string `json:"At"`
	Actor     string `json:"Actor"`
	Action    string `json:"Action"`
	Subject   string `json:"Subject"`
	ClusterId string `json:"ClusterId"`
	Outcome   string `json:"Outcome"`
	Detail    string `json:"Detail"`
	PrevHash  string `json:"PrevHash"`
	Hash      string `json:"Hash"`
}

// hashEntry is the chain function. Field order and separator are part of the
// format: changing either invalidates every existing chain, so it is fixed.
func hashEntry(prevHash string, seq uint64, at, actor, action, subject, cluster, outcome, detail string) string {
	h := sha256.New()
	fmt.Fprintf(h, "%s\x1f%d\x1f%s\x1f%s\x1f%s\x1f%s\x1f%s\x1f%s\x1f%s",
		prevHash, seq, at, actor, action, subject, cluster, outcome, detail)
	return hex.EncodeToString(h.Sum(nil))
}

// Append writes one entry. Never updates, never deletes.
func (a *auditLog) Append(ctx context.Context, actor, action, subject, cluster, outcome string, detail map[string]any) (*AuditEntry, error) {
	org := orgFromContext(ctx)
	a.mu.Lock()
	defer a.mu.Unlock()

	var head []struct {
		Seq  uint64 `json:"seq"`
		Hash string `json:"hash"`
	}
	if err := a.ch.query(ctx,
		`SELECT Seq AS seq, Hash AS hash FROM orchestr8.audit_log WHERE `+orgClause(org)+` ORDER BY Seq DESC LIMIT 1`, &head); err != nil {
		return nil, fmt.Errorf("audit head: %w", err)
	}
	var prevSeq uint64
	prevHash := "genesis"
	if len(head) > 0 {
		prevSeq, prevHash = head[0].Seq, head[0].Hash
	}

	if detail == nil {
		detail = map[string]any{}
	}
	detailJSON, err := json.Marshal(detail)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	atCH := now.Format("2006-01-02 15:04:05.000")

	e := AuditEntry{
		Seq: prevSeq + 1, At: now.Format(time.RFC3339Nano),
		Actor: actor, Action: action, Subject: subject, ClusterID: cluster,
		Outcome: outcome, Detail: detail, PrevHash: prevHash,
	}
	// OrgId is inside the hash so an entry cannot be moved between tenants.
	e.Hash = hashEntry(prevHash, e.Seq, atCH, org+"|"+actor, action, subject, cluster, outcome, string(detailJSON))

	row := auditRow{
		OrgId: org,
		Seq:   e.Seq, At: atCH, Actor: actor, Action: action, Subject: subject,
		ClusterId: cluster, Outcome: outcome, Detail: string(detailJSON),
		PrevHash: prevHash, Hash: e.Hash,
	}
	line, err := json.Marshal(row)
	if err != nil {
		return nil, err
	}
	if err := a.ch.exec(ctx, "INSERT INTO orchestr8.audit_log FORMAT JSONEachRow\n"+string(line)+"\n"); err != nil {
		return nil, fmt.Errorf("audit insert: %w", err)
	}
	return &e, nil
}

func (a *auditLog) List(ctx context.Context, org string, limit int) ([]AuditEntry, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	var rows []auditRow
	q := fmt.Sprintf(`SELECT Seq, toString(At) AS At, Actor, Action, Subject, ClusterId,
	       Outcome, Detail, PrevHash, Hash
	FROM orchestr8.audit_log WHERE %s ORDER BY Seq DESC LIMIT %d`, orgClause(org), limit)
	if err := a.ch.query(ctx, q, &rows); err != nil {
		return nil, err
	}
	out := make([]AuditEntry, 0, len(rows))
	for _, r := range rows {
		var d map[string]any
		if r.Detail != "" {
			_ = json.Unmarshal([]byte(r.Detail), &d)
		}
		out = append(out, AuditEntry{
			Seq: r.Seq, At: isoFromCH(r.At), Actor: r.Actor, Action: r.Action,
			Subject: r.Subject, ClusterID: r.ClusterId, Outcome: r.Outcome,
			Detail: d, PrevHash: r.PrevHash, Hash: r.Hash,
		})
	}
	return out, nil
}

type AuditVerification struct {
	Entries  int    `json:"entries"`
	Intact   bool   `json:"intact"`
	BrokenAt uint64 `json:"brokenAt,omitempty"`
	Reason   string `json:"reason,omitempty"`
}

// Verify recomputes the whole chain. This is the feature that makes the log
// worth having: without it "append-only" is a promise rather than a property.
func (a *auditLog) Verify(ctx context.Context) (*AuditVerification, error) {
	org := orgFromContext(ctx)
	var rows []auditRow
	// OrgId has to be selected, not just referenced: Append hashes org|actor,
	// so leaving the column out of this query verified every entry against an
	// empty organisation and failed at the first row. The chain has reported
	// itself broken on every call since tenancy went into the hash.
	q := `SELECT OrgId, Seq, toString(At) AS At, Actor, Action, Subject, ClusterId,
	       Outcome, Detail, PrevHash, Hash
	FROM orchestr8.audit_log WHERE ` + orgClause(org) + ` ORDER BY Seq ASC`
	if err := a.ch.query(ctx, q, &rows); err != nil {
		return nil, err
	}
	v := &AuditVerification{Entries: len(rows), Intact: true}
	prev := "genesis"
	var expectSeq uint64 = 1
	for _, r := range rows {
		if r.Seq != expectSeq {
			v.Intact, v.BrokenAt, v.Reason = false, r.Seq,
				fmt.Sprintf("sequence gap: expected %d, found %d — an entry was removed", expectSeq, r.Seq)
			return v, nil
		}
		if r.PrevHash != prev {
			v.Intact, v.BrokenAt, v.Reason = false, r.Seq, "previous-hash mismatch — the chain was re-linked"
			return v, nil
		}
		want := hashEntry(prev, r.Seq, r.At, r.OrgId+"|"+r.Actor, r.Action, r.Subject, r.ClusterId, r.Outcome, r.Detail)
		if !strings.EqualFold(want, r.Hash) {
			v.Intact, v.BrokenAt, v.Reason = false, r.Seq, "content hash mismatch — this entry was modified after it was written"
			return v, nil
		}
		prev = r.Hash
		expectSeq++
	}
	return v, nil
}
