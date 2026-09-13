package main

// Upsert rewrites a file a human maintains. The bug worth guarding is not the
// arithmetic — it is the rewrite quietly dropping something it did not
// understand, which is how the comment explaining this file's purpose got
// deleted by a click in the onboarding UI.

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const seedSLOs = `{
  "_comment": "Service level objectives. Reviewable in git on purpose.",
  "defaults": { "ttftP95Ms": 1200 },
  "models": {
    "llama-3.3-70b-instruct": { "ttftP95Ms": 1200, "note": "Interactive chat path." }
  }
}`

func newTestStore(t *testing.T) *sloStore {
	t.Helper()
	path := filepath.Join(t.TempDir(), "slos.json")
	if err := os.WriteFile(path, []byte(seedSLOs), 0o644); err != nil {
		t.Fatal(err)
	}
	return newSLOStore(path)
}

func readSLOFile(t *testing.T, s *sloStore) map[string]any {
	t.Helper()
	raw, err := os.ReadFile(s.path)
	if err != nil {
		t.Fatal(err)
	}
	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil {
		t.Fatalf("file is no longer valid JSON: %v", err)
	}
	return m
}

func TestUpsertKeepsTheFileComment(t *testing.T) {
	s := newTestStore(t)
	if err := s.Upsert("bge-large-en-v1.5", 100, "Embedding hot path."); err != nil {
		t.Fatal(err)
	}
	got := readSLOFile(t, s)
	if c, _ := got["_comment"].(string); !strings.Contains(c, "Reviewable in git") {
		t.Errorf("_comment was dropped by the rewrite; got %q", c)
	}
	// And the threshold that was already there must survive.
	models, _ := got["models"].(map[string]any)
	if _, ok := models["llama-3.3-70b-instruct"]; !ok {
		t.Error("an existing model was lost by the rewrite")
	}
}

// Onboarding has no model to name, so it sets the fallback. Storing that as a
// model literally called "default" made the whole step a no-op that still
// reported success.
func TestUpsertWithNoModelSetsTheDefault(t *testing.T) {
	s := newTestStore(t)
	if err := s.Upsert("", 900, ""); err != nil {
		t.Fatal(err)
	}
	got := readSLOFile(t, s)
	defaults, _ := got["defaults"].(map[string]any)
	if v, _ := defaults["ttftP95Ms"].(float64); v != 900 {
		t.Errorf("default = %v, want 900", v)
	}
	if models, _ := got["models"].(map[string]any); models["default"] != nil {
		t.Error(`wrote a model named "default" instead of setting the default`)
	}
	// An unlisted model must now inherit the new fallback.
	if s.fallback != 900 {
		t.Errorf("in-memory fallback = %v, want 900", s.fallback)
	}
}

func TestUpsertRejectsNamesThatWouldApplyToNothing(t *testing.T) {
	s := newTestStore(t)
	for _, name := range []string{"default", "Default", " defaults ", "*", "all"} {
		err := s.Upsert(name, 900, "")
		if err == nil {
			t.Errorf("%q was accepted as a model name", name)
			continue
		}
		if !strings.Contains(err.Error(), "omit the model") {
			t.Errorf("%q: error does not say what to do instead: %v", name, err)
		}
	}
	// A non-positive threshold is equally meaningless.
	if err := s.Upsert("llama-3.3-70b-instruct", 0, ""); err == nil {
		t.Error("a zero threshold was accepted")
	}
}

func TestUpsertRoundTripsThroughReload(t *testing.T) {
	s := newTestStore(t)
	if err := s.Upsert("bge-large-en-v1.5", 100, "Embedding hot path."); err != nil {
		t.Fatal(err)
	}
	// A fresh store reading the same file must see the same thresholds: the
	// write is only correct if the next process agrees with this one.
	fresh := newSLOStore(s.path)
	all := fresh.All()
	if all["bge-large-en-v1.5"] != 100 {
		t.Errorf("bge threshold = %v, want 100", all["bge-large-en-v1.5"])
	}
	if all["llama-3.3-70b-instruct"] != 1200 {
		t.Errorf("llama threshold = %v, want 1200", all["llama-3.3-70b-instruct"])
	}
}

// Reading a threshold back must agree with writing it. The GET handler used to
// report the compile-time constant, so a caller who set 900 was told 1200 by
// the very next request — while the engine was correctly using 900.
func TestFallbackReflectsWhatWasWritten(t *testing.T) {
	s := newTestStore(t)
	if got := s.Fallback(); got != 1200 {
		t.Fatalf("seeded fallback = %v, want 1200", got)
	}
	if err := s.Upsert("", 900, ""); err != nil {
		t.Fatal(err)
	}
	if got := s.Fallback(); got != 900 {
		t.Errorf("fallback after write = %v, want 900", got)
	}
	if got := newSLOStore(s.path).Fallback(); got != 900 {
		t.Errorf("fallback in a fresh store = %v, want 900", got)
	}
}
