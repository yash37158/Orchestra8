package main

// The splitter is the only part of migration with logic in it, and it runs
// against the real schema this product ships.

import (
	"os"
	"strings"
	"testing"
)

func TestSplitStatementsOnTheRealSchema(t *testing.T) {
	raw, err := os.ReadFile("schema.sql")
	if err != nil {
		t.Fatal(err)
	}
	stmts := splitStatements(string(raw))
	if len(stmts) < 5 {
		t.Fatalf("got %d statements from schema.sql, expected the whole rollup layer", len(stmts))
	}
	for i, s := range stmts {
		// ClickHouse rejects a body holding more than one statement, which is
		// the entire reason this function exists.
		if strings.Contains(s, ";") {
			t.Errorf("statement %d still contains a semicolon: %.60s", i, s)
		}
		// A chunk that is only a comment would be posted as an empty query.
		if strings.TrimSpace(s) == "" {
			t.Errorf("statement %d is empty", i)
		}
	}
	// Every table the API reads must be created by the script it ships with.
	joined := strings.Join(stmts, "\n")
	for _, table := range []string{"gpu_minute", "inference_minute", "correlations", "audit_log", "scans", "scan_findings"} {
		if !strings.Contains(joined, table) {
			t.Errorf("schema.sql no longer creates %s", table)
		}
	}
}

// A semicolon inside a comment must not split the statement around it.
func TestSplitStatementsIgnoresCommentedSemicolons(t *testing.T) {
	got := splitStatements("CREATE TABLE a (x Int64) -- careful; this matters\nENGINE = Memory;\nSELECT 1;")
	if len(got) != 2 {
		t.Fatalf("got %d statements, want 2: %#v", len(got), got)
	}
	if !strings.Contains(got[0], "ENGINE = Memory") {
		t.Errorf("first statement was cut at the comment: %q", got[0])
	}
}
