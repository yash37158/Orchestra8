package main

import (
	"context"
	"testing"
	"time"
)

// A scan that times out has to still be recorded. It was not: Run persisted
// the failure on the same context the deadline had just killed, so the write
// failed instantly, the error was discarded, and a four-minute scan of a large
// image vanished — no row, no ledger entry, nothing for the person watching
// the spinner. recordCtx is what keeps the bookkeeping alive.
func TestRecordCtxSurvivesACancelledParent(t *testing.T) {
	parent, cancel := context.WithCancel(withOrg(context.Background(), "acme"))
	cancel() // the four-minute cap firing, or the caller closing the tab

	if parent.Err() == nil {
		t.Fatal("parent should be cancelled")
	}

	rec, done := recordCtx(parent)
	defer done()

	if err := rec.Err(); err != nil {
		t.Fatalf("recording context is already dead: %v — the scan would vanish", err)
	}
	// The organisation has to survive, or the row lands in the wrong tenant.
	if got := orgFromContext(rec); got != "acme" {
		t.Errorf("org lost through WithoutCancel: got %q, want %q", got, "acme")
	}
	if dl, ok := rec.Deadline(); !ok || time.Until(dl) > time.Minute {
		t.Error("recording context needs its own short deadline, not an open-ended one")
	}
}

// The deadline message has to say what happened. "signal: killed" is what the
// process layer reports and it tells the reader nothing.
func TestScanTimeoutIsQuotedInMinutes(t *testing.T) {
	if scanTimeout < time.Minute {
		t.Fatalf("scanTimeout %v is too short to be a real cap", scanTimeout)
	}
	if got := scanTimeout.String(); got != "4m0s" {
		t.Errorf("scanTimeout is %s; the failure message quotes this value, so check it still reads well", got)
	}
}

// scanOnce holds the single-scan lock. An early return that skipped the
// unlock would wedge every later scan in the process with no error and no
// log line — the first draft of this had exactly that, a `return` on the
// parse-failure path between a manual Lock and Unlock. The lock lives behind
// a defer now; this fails if anyone goes back to hand-placing it.
func TestScanOnceReleasesTheLockWhenTrivyFails(t *testing.T) {
	s := &scanner{bin: "/nonexistent/trivy-does-not-exist"}

	for i := 0; i < 2; i++ {
		if _, _, err := s.scanOnce(context.Background(), "fs", "whatever"); err == nil {
			t.Fatalf("call %d: expected a failure from a missing binary", i)
		}
	}

	// A leaked lock shows up as a hang, not a failure, so bound it.
	done := make(chan struct{})
	go func() {
		s.execMu.Lock()
		s.execMu.Unlock()
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("lock still held after a failed scan — every later scan would hang here")
	}
}
