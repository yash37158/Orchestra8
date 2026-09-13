package main

// The screen this feeds is the one an operator stares at during onboarding, so
// the thing to get right is not the ring buffer — it is never explaining a
// silence with the wrong cause.

import (
	"strings"
	"testing"
	"time"
)

// Tokens this cluster was issued. Anything else cannot explain its silence.
var issued = map[string]bool{"orch8_aaaaaaaa": true}

func TestRejectLogExplainsAMismatch(t *testing.T) {
	l := &rejectLog{}
	now := time.Now()
	l.add(rejection{At: now, Code: 403,
		ClaimedOrg: "local", ClaimedCluster: "prod",
		TokenOrg: "acme", TokenCluster: "staging"})

	n, why := l.explain("local", "prod", issued, now)
	if n != 1 {
		t.Errorf("count = %d, want 1", n)
	}
	// Both halves must appear: naming only one leaves the operator guessing
	// which end to change.
	for _, want := range []string{`"local"`, `"prod"`, `"acme"`, `"staging"`} {
		if !strings.Contains(why, want) {
			t.Errorf("hint does not mention %s: %s", want, why)
		}
	}
}

func TestRejectLogDoesNotExplainAnotherCluster(t *testing.T) {
	l := &rejectLog{}
	now := time.Now()
	l.add(rejection{At: now, Code: 403,
		ClaimedOrg: "local", ClaimedCluster: "other",
		TokenOrg: "acme", TokenCluster: "staging"})

	// Same org, different cluster: silence here has nothing to do with that.
	if n, why := l.explain("local", "prod", issued, now); why != "" {
		t.Errorf("explained an unrelated refusal: %d %q", n, why)
	}
	// Same cluster name, different org: two tenants may both run "other", and
	// one must never account for the other's silence.
	if n, why := l.explain("acme", "other", issued, now); why != "" {
		t.Errorf("crossed a tenant boundary: %d %q", n, why)
	}
}

// An unknown token cannot be tied to a cluster, so the hint must not pretend
// otherwise — and must not echo anything that confirms a guess.
func TestRejectLogKeepsUnknownTokensVague(t *testing.T) {
	l := &rejectLog{}
	now := time.Now()
	l.add(rejection{At: now, Code: 401, Prefix: "orch8_aaaaaaaa"})
	l.add(rejection{At: now, Code: 401, Prefix: "orch8_aaaaaaaa"})

	n, why := l.explain("local", "prod", issued, now)
	if n != 2 {
		t.Errorf("count = %d, want 2", n)
	}
	if !strings.Contains(why, "no longer valid") {
		t.Errorf("unexpected hint: %s", why)
	}
	for _, leak := range []string{"orch8_", "aaaaaaaa"} {
		if strings.Contains(why, leak) {
			t.Errorf("hint leaks %q: %s", leak, why)
		}
	}
}

// A mismatch is the specific answer, so it wins over a vague one even when
// unknown-token noise arrived more recently.
func TestRejectLogPrefersTheSpecificCause(t *testing.T) {
	l := &rejectLog{}
	now := time.Now()
	l.add(rejection{At: now.Add(-time.Minute), Code: 403,
		ClaimedOrg: "local", ClaimedCluster: "prod", TokenOrg: "acme", TokenCluster: "staging"})
	l.add(rejection{At: now, Code: 401, Prefix: "orch8_aaaaaaaa"})

	if _, why := l.explain("local", "prod", issued, now); !strings.Contains(why, "acme") {
		t.Errorf("vague cause won over the specific one: %s", why)
	}
}

func TestRejectLogForgetsOldAndOverflow(t *testing.T) {
	l := &rejectLog{}
	now := time.Now()

	l.add(rejection{At: now.Add(-2 * rejectWindow), Code: 401, Prefix: "orch8_aaaaaaaa"})
	if _, why := l.explain("local", "prod", issued, now); why != "" {
		t.Errorf("explained a silence with a stale refusal: %s", why)
	}

	// Overflow the ring. It must keep the newest entries and stay at capacity
	// rather than growing — the keys are attacker-controlled.
	for i := 0; i < len(l.buf)*3; i++ {
		l.add(rejection{At: now, Code: 401, Prefix: "orch8_aaaaaaaa"})
	}
	n, _ := l.explain("local", "prod", issued, now)
	if n != len(l.buf) {
		t.Errorf("kept %d refusals, want the ring's %d", n, len(l.buf))
	}

	// The newest entry must survive the wrap.
	l.add(rejection{At: now, Code: 403,
		ClaimedOrg: "local", ClaimedCluster: "prod", TokenOrg: "acme", TokenCluster: "staging"})
	if _, why := l.explain("local", "prod", issued, now); !strings.Contains(why, "acme") {
		t.Errorf("newest entry lost across the wrap: %s", why)
	}
}

// The regression that made this hint worth building twice.
//
// A stranger presenting a bad token must not explain the silence of a cluster
// that was never installed. Telling that operator their token is wrong sends
// them to re-copy a token they have not yet used — confidently wrong, which is
// worse than the vague advice it replaced.
func TestRejectLogBlamesNobodyForAStrangersBadToken(t *testing.T) {
	l := &rejectLog{}
	now := time.Now()
	for i := 0; i < 5; i++ {
		l.add(rejection{At: now, Code: 401, Prefix: "orch8_somebody"})
	}

	// This cluster never issued that token, and has not been installed at all.
	if n, why := l.explain("local", "never-installed", map[string]bool{}, now); why != "" {
		t.Errorf("blamed an uninstalled cluster: %d %q", n, why)
	}
	// The cluster the token WAS issued for still gets its answer.
	if _, why := l.explain("local", "prod", map[string]bool{"orch8_somebody": true}, now); why == "" {
		t.Error("no hint for the cluster the token belongs to")
	}
}

// A short garbage token records a short prefix, which can never equal a
// full-length issued one — so it cannot match by being a truncation.
func TestTokenPrefixCannotCollideByTruncation(t *testing.T) {
	full := tokenPrefix("orch8_0123456789abcdef")
	if full != "orch8_01234567" {
		t.Errorf("prefix = %q", full)
	}
	if short := tokenPrefix("orch8_"); short == full {
		t.Error("a short token produced a full-length prefix")
	}
}
