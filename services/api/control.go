package main

// Control plane access.
//
// Postgres holds this, not ClickHouse: organisations, clusters and ingest
// tokens need transactions, foreign keys and revocation, and an analytics
// store is bad at all three. Schema lives in services/control/migrations.
//
// Only the ingest gateway reads from here today. Step 3 adds sessions, at
// which point orgFromRequest stops being a config lookup and starts being an
// identity lookup — against these same tables.

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"time"

	_ "github.com/lib/pq"
)

type control struct{ db *sql.DB }

// errNoToken means the credential resolved to nothing: unknown, revoked, or
// pointing at a cluster that has since been deleted. Deliberately one error
// for all three — telling a caller which one it was confirms half its guess.
var errNoToken = errors.New("unknown or revoked token")

func newControl(dsn string) *control {
	// sql.Open does not connect, so this cannot fail on a cold Postgres and
	// the read API stays up regardless. Connections are made lazily and
	// re-made after an outage; see lookupToken for how that surfaces.
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		// Only a malformed DSN reaches here, which is a startup misconfig.
		log.Printf("control plane DSN rejected: %v — ingest will refuse every token", err)
		return &control{}
	}
	// The gateway's token lookup is the only hot path and it is a single
	// indexed read. A large pool would buy nothing and starve Postgres of
	// connections that Auth.js will want in step 3.
	db.SetMaxOpenConns(8)
	db.SetMaxIdleConns(4)
	db.SetConnMaxLifetime(time.Hour)
	return &control{db: db}
}

// tokenIdentity is what a credential resolves to. Nothing in it comes from the
// request body — that is the entire point of the gateway.
type tokenIdentity struct {
	Org     string
	Cluster string
}

// hashToken is what is stored. A leaked control-plane database must not hand
// over working credentials, so the token itself is never written down.
func hashToken(tok string) []byte {
	sum := sha256.Sum256([]byte(tok))
	return sum[:]
}

// lookupToken resolves a bearer token to the org and cluster it may write.
//
// Returns errNoToken when the credential is not valid, and any other error
// when the control plane could not answer. Callers must keep those apart: an
// OTLP exporter drops a batch on 4xx and retries on 5xx, so reporting a
// Postgres outage as "bad token" silently destroys telemetry.
func (c *control) lookupToken(ctx context.Context, tok string) (tokenIdentity, error) {
	if c.db == nil {
		return tokenIdentity{}, errors.New("control plane not configured")
	}
	// The UPDATE is the lookup: one round trip records the use and returns the
	// identity. c.org_id = t.org_id is not redundant — it is a fail-closed
	// check. If a token and its cluster ever disagree about the owner, this
	// resolves to nothing rather than to the wrong tenant.
	//
	// ponytail: writes last_used_at on every batch. That is one HOT update per
	// cluster per batch interval; add a staleness guard if it ever shows up in
	// Postgres write volume.
	const q = `
UPDATE ingest_tokens t
   SET last_used_at = now()
  FROM clusters c
  JOIN organizations o ON o.id = c.org_id
 WHERE t.token_hash = $1
   AND t.revoked_at IS NULL
   AND c.id = t.cluster_id
   AND c.org_id = t.org_id
RETURNING o.slug, c.cluster_key`

	var id tokenIdentity
	err := c.db.QueryRowContext(ctx, q, hashToken(tok)).Scan(&id.Org, &id.Cluster)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return tokenIdentity{}, errNoToken
	case err != nil:
		return tokenIdentity{}, err
	}
	return id, nil
}

// tokenPrefixesFor returns the prefix of every token ever issued for a
// cluster, revoked ones included — a revoked token is exactly the case the
// onboarding screen needs to explain. Prefixes are already stored in clear:
// they exist so a human can tell two tokens apart without either being
// readable, and 8 hex characters of 48 identify without unlocking.
func (c *control) tokenPrefixesFor(ctx context.Context, org, clusterKey string) map[string]bool {
	out := map[string]bool{}
	if c.db == nil || clusterKey == "" {
		return out
	}
	rows, err := c.db.QueryContext(ctx, `
SELECT t.prefix FROM ingest_tokens t
  JOIN clusters c      ON c.id = t.cluster_id
  JOIN organizations o ON o.id = c.org_id
 WHERE o.slug = $1 AND c.cluster_key = $2`, org, clusterKey)
	if err != nil {
		// A hint is not worth failing a status page over.
		log.Printf("onboarding: token prefixes for %s/%s: %v", org, clusterKey, err)
		return out
	}
	defer rows.Close()
	for rows.Next() {
		var p string
		if err := rows.Scan(&p); err == nil {
			out[p] = true
		}
	}
	return out
}

// tokenPrefix is the leading slice recorded against a refusal, matching what
// registerCluster stores. Short tokens keep their whole length, which can
// never equal a full-length issued prefix — so garbage cannot match by being
// truncated.
func tokenPrefix(tok string) string {
	if len(tok) > 14 {
		return tok[:14]
	}
	return tok
}

// newToken mints a credential. 24 bytes of crypto/rand: the token is the only
// thing standing between a stranger and a tenant's data, so it is not derived
// from anything guessable.
func newToken() (string, error) {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("no entropy for a token: %w", err)
	}
	return "orch8_" + hex.EncodeToString(b), nil
}

// registerCluster creates the cluster if the org does not already have one by
// that key, and issues a token bound to it. The plaintext token is returned
// once and never stored, only its hash.
func (c *control) registerCluster(ctx context.Context, org, clusterKey, displayName string) (string, error) {
	if c.db == nil {
		return "", errors.New("control plane not configured")
	}
	tok, err := newToken()
	if err != nil {
		return "", err
	}
	tx, err := c.db.BeginTx(ctx, nil)
	if err != nil {
		return "", err
	}
	defer func() { _ = tx.Rollback() }()

	var orgID string
	if err := tx.QueryRowContext(ctx, `SELECT id FROM organizations WHERE slug = $1`, org).Scan(&orgID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", fmt.Errorf("no such organisation: %s", org)
		}
		return "", err
	}

	// Re-onboarding an existing cluster is a normal thing to do — a chart gets
	// reinstalled, a token gets rotated — so this is an upsert, not a conflict.
	var clusterID string
	if err := tx.QueryRowContext(ctx, `
INSERT INTO clusters (org_id, cluster_key, display_name) VALUES ($1, $2, $3)
ON CONFLICT (org_id, cluster_key) DO UPDATE SET display_name = EXCLUDED.display_name
RETURNING id`, orgID, clusterKey, displayName).Scan(&clusterID); err != nil {
		return "", err
	}

	if _, err := tx.ExecContext(ctx, `
INSERT INTO ingest_tokens (org_id, cluster_id, token_hash, prefix, name)
VALUES ($1, $2, $3, $4, $5)`,
		orgID, clusterID, hashToken(tok), tokenPrefix(tok), "onboarding"); err != nil {
		return "", err
	}
	if err := tx.Commit(); err != nil {
		return "", err
	}
	return tok, nil
}
