package main

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

// TestContractRoundTrip is the cross-language contract check. It decodes the
// shared golden fixtures strictly (unknown field => the Go structs are behind
// the zod schema) and re-encodes them (missing field => the fixture is behind
// the Go structs). packages/contracts/verify.mjs checks the same files from
// the TypeScript side, so the two languages cannot drift silently.
func TestContractRoundTrip(t *testing.T) {
	path := filepath.Join("..", "..", "packages", "contracts", "fixtures", "dashboard.json")
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read fixture: %v", err)
	}

	var typed DashboardResponse
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&typed); err != nil {
		t.Fatalf("fixture has a field the Go structs do not: %v", err)
	}

	reencoded, err := json.Marshal(typed)
	if err != nil {
		t.Fatalf("re-encode: %v", err)
	}

	var before, after map[string]any
	if err := json.Unmarshal(raw, &before); err != nil {
		t.Fatalf("unmarshal fixture: %v", err)
	}
	if err := json.Unmarshal(reencoded, &after); err != nil {
		t.Fatalf("unmarshal re-encoded: %v", err)
	}
	if !reflect.DeepEqual(before, after) {
		t.Errorf("round-trip changed the payload — Go structs and fixture disagree.\n"+
			"missing or altered keys indicate schema drift.\nbefore: %d top-level keys, after: %d",
			len(before), len(after))
		for k, v := range before {
			if av, ok := after[k]; !ok {
				t.Errorf("  key %q dropped by Go structs", k)
			} else if !reflect.DeepEqual(v, av) {
				t.Errorf("  key %q differs after round-trip", k)
			}
		}
	}
}

// TestCorrelationsAreExplainable guards the one product invariant that
// separates this from a metrics dashboard: every correlation must carry
// evidence and a confidence a human can argue with.
func TestCorrelationsAreExplainable(t *testing.T) {
	d, err := loadFixture(t)
	if err != nil {
		t.Fatal(err)
	}
	if len(d.Correlations) == 0 {
		t.Fatal("fixture has no correlations to check")
	}
	for _, c := range d.Correlations {
		if len(c.Cause.Evidence) == 0 {
			t.Errorf("correlation %s has no evidence", c.ID)
		}
		if c.Confidence <= 0 || c.Confidence > 1 {
			t.Errorf("correlation %s confidence %v outside (0,1]", c.ID, c.Confidence)
		}
		if c.RecommendedAction == "" {
			t.Errorf("correlation %s has no recommended action", c.ID)
		}
	}
}

func loadFixture(t *testing.T) (*DashboardResponse, error) {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join("..", "..", "packages", "contracts", "fixtures", "dashboard.json"))
	if err != nil {
		return nil, err
	}
	var d DashboardResponse
	return &d, json.Unmarshal(raw, &d)
}
