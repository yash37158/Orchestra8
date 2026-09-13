package main

// Why a cluster is silent.
//
// A refused batch and an absent one look identical from the query side: no
// rows either way, and every pod Running. The onboarding screen used to answer both
// with "check the gateway is running", which is the correct advice for exactly
// one of them and a twenty-minute detour for the other.
//
// So the gateway keeps its recent refusals and the onboarding screen reads
// them. Nothing is persisted: this answers "why is nothing arriving right
// now", and a question about last Tuesday belongs in the audit log.

import (
	"fmt"
	"sync"
	"time"
)

// How far back the onboarding screen looks. Longer than its 3-minute telemetry
// window, so a helm install that was refused a few minutes ago still explains
// a screen that has been blank ever since.
const rejectWindow = 10 * time.Minute

type rejection struct {
	At   time.Time
	Code int
	// Set only for a 403, where the payload named an owner and the token named
	// a different one. A 401 never gets this far: the body is not parsed until
	// the credential is good, so an unknown token is all we can honestly say.
	ClaimedOrg, ClaimedCluster string
	TokenOrg, TokenCluster     string
	// Leading characters of the credential that was presented. The only way to
	// tie an unrecognised token to a cluster: the body is not parsed before
	// the credential is checked, so the payload cannot be asked who it is.
	// Recorded, never echoed.
	Prefix string
}

// rejectLog holds the last few refusals.
//
// A ring, not a map. Map keys here would be attacker-controlled — anyone can
// present an unknown token with any cluster name attached — and a fixed 32
// entries cannot be grown by anybody.
type rejectLog struct {
	mu  sync.Mutex
	buf [32]rejection
	n   int // total ever recorded; the newest sits at (n-1) % len(buf)
}

// Nil-safe, deliberately. add() sits on a path an unauthenticated stranger can
// reach with one bad token, so a gateway wired without a log must lose its
// hints, not the process.
func (l *rejectLog) add(r rejection) {
	if l == nil {
		return
	}
	if r.At.IsZero() {
		r.At = time.Now()
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	l.buf[l.n%len(l.buf)] = r
	l.n++
}

// recent returns refusals newer than the window, newest first.
func (l *rejectLog) recent(now time.Time) []rejection {
	if l == nil {
		return nil
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	cutoff := now.Add(-rejectWindow)
	var out []rejection
	for i := 0; i < len(l.buf) && i < l.n; i++ {
		if r := l.buf[(l.n-1-i)%len(l.buf)]; r.At.After(cutoff) {
			out = append(out, r)
		}
	}
	return out
}

// explain says why an org's cluster is being turned away, or returns 0 if the
// gateway has not turned anything away recently.
//
// A mismatch naming this cluster is reported precisely, because we know both
// halves. An unrecognised token is reported only when its prefix was issued
// for this cluster; anything else cannot be attributed here and stays silent
// rather than blaming a cluster that may not have been installed yet.
func (l *rejectLog) explain(org, cluster string, issued map[string]bool, now time.Time) (int, string) {
	var mismatch *rejection
	mismatched, unknown := 0, 0
	// recent() is newest-first, so the first match is the one to quote.
	for _, r := range l.recent(now) {
		r := r
		switch {
		case r.Code == 403 && r.ClaimedOrg == org && r.ClaimedCluster == cluster:
			mismatched++
			if mismatch == nil {
				mismatch = &r
			}
		// Only when the credential was one WE issued for this cluster. Without
		// that check a stranger's bad token anywhere explains every silent
		// cluster everywhere — telling an operator who has not yet run the
		// install command that their token is wrong. Confidently wrong is
		// worse than vague.
		case r.Code == 401 && issued[r.Prefix]:
			unknown++
		}
	}
	switch {
	case mismatch != nil:
		return mismatched, fmt.Sprintf(
			"Refused by the gateway. This collector says it belongs to org %q / cluster %q, "+
				"but the token it presents was issued for org %q / cluster %q. Reinstall with the "+
				"command above — it pairs them correctly.",
			mismatch.ClaimedOrg, mismatch.ClaimedCluster, mismatch.TokenOrg, mismatch.TokenCluster)
	case unknown > 0:
		return unknown, "Refused by the gateway: this cluster's token is no longer valid. It has " +
			"been revoked, or replaced by a newer one. Generate a fresh token and reinstall."
	}
	return 0, ""
}
