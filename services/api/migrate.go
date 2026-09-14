package main

// Schema bootstrap.
//
// Run as `orchestr8-api -migrate`, from a Job, before the API starts. It lives
// in the same binary because the SQL is already in the image and both stores
// are already reachable from here — a separate migration image would mean
// shipping the same DDL twice and keeping the copies in step by hand.
//
// ponytail: applies whatever is in the files, every time. Both schemas are
// written to be idempotent (IF NOT EXISTS throughout), which is cheaper than a
// version table until a migration needs to run exactly once.

import (
	"bytes"
	"context"
	"database/sql"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// splitStatements breaks a script into individual statements.
//
// ClickHouse's HTTP interface refuses more than one statement per request
// ("Multi-statements are not allowed"), so the file has to be taken apart.
// Line comments go first: a `--` comment containing a semicolon would
// otherwise split a statement in half.
func splitStatements(script string) []string {
	var clean strings.Builder
	for _, line := range strings.Split(script, "\n") {
		if i := strings.Index(line, "--"); i >= 0 {
			line = line[:i]
		}
		clean.WriteString(line)
		clean.WriteByte('\n')
	}
	var out []string
	for _, stmt := range strings.Split(clean.String(), ";") {
		if s := strings.TrimSpace(stmt); s != "" {
			out = append(out, s)
		}
	}
	return out
}

// migrate applies both schemas and returns once they are in place.
func migrate(ctx context.Context, dsn, chURL, pgFile, chFile string) error {
	if err := migratePostgres(ctx, dsn, pgFile); err != nil {
		return fmt.Errorf("control plane: %w", err)
	}
	if err := migrateClickHouse(ctx, chURL, chFile); err != nil {
		return fmt.Errorf("telemetry schema: %w", err)
	}
	return nil
}

// migratePostgres applies every .sql file in a directory, in name order.
//
// A directory rather than one named file: the control plane will grow more
// migrations, and a bootstrap wired to 001 alone would apply the first and
// silently skip the rest — leaving a schema that looks installed and is
// missing half its tables. Names sort, so 001 runs before 002.
func migratePostgres(ctx context.Context, dsn, dir string) error {
	scripts, err := sqlFilesIn(dir)
	if err != nil {
		return err
	}
	if len(scripts) == 0 {
		return fmt.Errorf("no .sql files in %s", dir)
	}
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return err
	}
	defer db.Close()
	if err := waitFor(ctx, func() error { return db.PingContext(ctx) }, "postgres"); err != nil {
		return err
	}
	// One migration at a time across every replica.
	//
	// Each API pod runs this in an init container, so with more than one
	// replica they start together. Concurrent CREATE TABLE IF NOT EXISTS is
	// not as idempotent as it reads — Postgres can fail one of them on a
	// duplicate key in its own catalogue. An advisory lock is released
	// automatically when the connection closes, so a killed pod cannot wedge
	// the next one.
	conn, err := db.Conn(ctx)
	if err != nil {
		return err
	}
	defer conn.Close()
	if _, err := conn.ExecContext(ctx, `SELECT pg_advisory_lock(hashtext('orchestr8.migrate'))`); err != nil {
		return err
	}
	defer func() {
		_, _ = conn.ExecContext(context.Background(), `SELECT pg_advisory_unlock(hashtext('orchestr8.migrate'))`)
	}()

	// Postgres accepts a whole script in one Exec, and each file wraps itself
	// in BEGIN/COMMIT so a failure half way leaves nothing behind.
	for _, f := range scripts {
		script, err := os.ReadFile(f)
		if err != nil {
			return err
		}
		if _, err := conn.ExecContext(ctx, string(script)); err != nil {
			return fmt.Errorf("%s: %w", filepath.Base(f), err)
		}
		log.Printf("migrate: control plane applied %s", filepath.Base(f))
	}
	return nil
}

// sqlFilesIn lists the .sql files in a directory, sorted by name.
//
// A single file is accepted too, so a deployment that still points
// ORCHESTR8_PG_SCHEMA at one path keeps working across the upgrade that
// introduces this.
func sqlFilesIn(path string) ([]string, error) {
	info, err := os.Stat(path)
	if err != nil {
		return nil, err
	}
	if !info.IsDir() {
		return []string{path}, nil
	}
	found, err := filepath.Glob(filepath.Join(path, "*.sql"))
	if err != nil {
		return nil, err
	}
	sort.Strings(found)
	return found, nil
}

func migrateClickHouse(ctx context.Context, url, file string) error {
	script, err := os.ReadFile(file)
	if err != nil {
		return err
	}
	client := &http.Client{Timeout: 30 * time.Second}
	post := func(sql string) error {
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, strings.NewReader(sql))
		if err != nil {
			return err
		}
		resp, err := client.Do(req)
		if err != nil {
			return err
		}
		defer resp.Body.Close()
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<16))
		if resp.StatusCode != http.StatusOK {
			return fmt.Errorf("clickhouse %d: %s", resp.StatusCode, bytes.TrimSpace(body))
		}
		return nil
	}
	if err := waitFor(ctx, func() error { return post("SELECT 1") }, "clickhouse"); err != nil {
		return err
	}
	stmts := splitStatements(string(script))
	for i, s := range stmts {
		if err := post(s); err != nil {
			// Naming the statement matters: "syntax error" against a 200-line
			// file is not a diagnosis.
			return fmt.Errorf("statement %d/%d (%.60s...): %w", i+1, len(stmts), s, err)
		}
	}
	log.Printf("migrate: %d statements applied from %s", len(stmts), file)
	return nil
}

// waitFor retries until the store answers or the context is done. A Job starts
// the moment its dependencies are scheduled, not the moment they are ready.
func waitFor(ctx context.Context, probe func() error, what string) error {
	var last error
	for attempt := 0; attempt < 60; attempt++ {
		if last = probe(); last == nil {
			return nil
		}
		// Every tenth attempt, so an operator watching the logs sees why the
		// container is sitting there rather than two silent minutes and an
		// exit code. A 401 here means credentials, not readiness, and waiting
		// will never fix it.
		if attempt%10 == 0 {
			log.Printf("migrate: waiting for %s: %v", what, last)
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(2 * time.Second):
		}
	}
	return fmt.Errorf("%s never became ready: %w", what, last)
}
