package main

// Two tenants can run clusters with the same name serving the same model,
// which produces the same correlation id. Anything the engine remembers
// between ticks therefore has to be scoped by tenant, or one customer's
// recovery silently closes another customer's live incident.

import (
	"context"
	"sync"
	"testing"
)

func TestMissCountersAreScopedByTenant(t *testing.T) {
	e := &engine{}
	const id = "colima-k3s|llama-3.3-70b-instruct|gpu_thermal_throttle"

	// Tenant A's condition goes undetected twice — one short of resolving.
	if got := e.miss("acme", id); got != 1 {
		t.Fatalf("first miss = %d, want 1", got)
	}
	if got := e.miss("acme", id); got != 2 {
		t.Fatalf("second miss = %d, want 2", got)
	}

	// Tenant B, same id, must start from zero rather than inheriting A's count
	// and resolving on its very first miss.
	if got := e.miss("globex", id); got != 1 {
		t.Errorf("other tenant's first miss = %d, want 1 — counters are shared", got)
	}

	// And clearing one must not clear the other.
	e.forget("globex", id)
	if got := e.miss("acme", id); got != 3 {
		t.Errorf("after another tenant cleared, miss = %d, want 3", got)
	}
}

func TestMissCountersSurviveConcurrentTenants(t *testing.T) {
	e := &engine{}
	const id = "shared-id"
	var wg sync.WaitGroup
	for _, org := range []string{"a", "b", "c", "d"} {
		wg.Add(1)
		go func(org string) {
			defer wg.Done()
			for i := 0; i < 50; i++ {
				e.miss(org, id)
			}
		}(org)
	}
	wg.Wait()
	for _, org := range []string{"a", "b", "c", "d"} {
		if got := e.misses[scopeKey(org, id)]; got != 50 {
			t.Errorf("tenant %s counted %d misses, want 50", org, got)
		}
	}
}

// A sweep with no tenants must be a no-op rather than an error path, because
// that is the normal state of a deployment nobody has connected a cluster to
// yet.
func TestSweepWithNoTenantsDoesNothing(t *testing.T) {
	e := &engine{ch: newCHClient("http://127.0.0.1:1"), workers: 2}
	// Unreachable store: sweep must log and return, not panic.
	e.sweep(context.Background())
}

// Not tested here: the per-tenant panic guard inside sweep(). Reaching it
// needs a tenant whose stored data makes a rule panic, which cannot be
// arranged without a live store and deliberately corrupt rows. A test that
// panicked in a goroutine of its own would prove only that recover() works.

// A resolved condition that starts happening again must come back.
//
// "resolved" is the engine's own bookkeeping, not a human decision, so it must
// not be carried onto a fresh detection the way acknowledged and suppressed
// are. It used to be, and the effect was that the second occurrence of any
// incident was written back as resolved, filtered out of the list, and never
// paged — the product went blind to anything that had happened once before.
func TestStatusCarriedForwardOnlyForHumanDecisions(t *testing.T) {
	cases := []struct {
		previously string
		want       string
	}{
		{"acknowledged", "acknowledged"}, // somebody owns it; do not re-page
		{"suppressed", "suppressed"},     // somebody silenced it deliberately
		{"resolved", "open"},             // the engine closed it; it is back
		{"open", "open"},
		{"", "open"}, // never seen before
	}
	for _, tc := range cases {
		got := statusForDetection(tc.previously)
		if got != tc.want {
			t.Errorf("previously %q -> %q, want %q", tc.previously, got, tc.want)
		}
	}
}
