package main

import "testing"

// The chain is the audit log's only real security property. These check the
// hash function directly, without a database, so the guarantee is pinned even
// if storage changes underneath it.
func TestHashChainDetectsTampering(t *testing.T) {
	const at = "2026-09-12 10:00:00.000"
	h1 := hashEntry("genesis", 1, at, "priya", "deploy.request", "llama", "gcp-usc1", "allowed", `{}`)
	h2 := hashEntry(h1, 2, at, "priya", "deploy.blocked", "llama", "gcp-usc1", "denied", `{}`)

	// The scenario that matters: someone edits a denial into an approval.
	tampered := hashEntry(h1, 2, at, "priya", "deploy.blocked", "llama", "gcp-usc1", "allowed", `{}`)
	if tampered == h2 {
		t.Fatal("changing the outcome did not change the hash — the log is not tamper-evident")
	}

	// Re-linking the chain to hide a deletion must also fail.
	if relinked := hashEntry("genesis", 2, at, "priya", "deploy.blocked", "llama", "gcp-usc1", "denied", `{}`); relinked == h2 {
		t.Fatal("re-linking to a different predecessor produced the same hash")
	}

	// And it must be deterministic, or verification would false-positive.
	if again := hashEntry(h1, 2, at, "priya", "deploy.blocked", "llama", "gcp-usc1", "denied", `{}`); again != h2 {
		t.Fatal("hash is not deterministic")
	}
}

func TestEveryFieldIsCovered(t *testing.T) {
	base := []string{"2026-09-12 10:00:00.000", "priya", "deploy.request", "llama", "gcp-usc1", "allowed", `{"image":"a"}`}
	ref := hashEntry("prev", 1, base[0], base[1], base[2], base[3], base[4], base[5], base[6])
	names := []string{"at", "actor", "action", "subject", "cluster", "outcome", "detail"}
	for i := range base {
		m := append([]string(nil), base...)
		m[i] = m[i] + "X"
		if hashEntry("prev", 1, m[0], m[1], m[2], m[3], m[4], m[5], m[6]) == ref {
			t.Errorf("field %q is not covered by the hash — it could be altered undetected", names[i])
		}
	}
	if hashEntry("prev", 2, base[0], base[1], base[2], base[3], base[4], base[5], base[6]) == ref {
		t.Error("seq is not covered by the hash")
	}
}
