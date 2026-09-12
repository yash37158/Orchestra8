-- Orchestr8 control plane.
--
-- Postgres, not ClickHouse, holds this. Organisations, memberships and tokens
-- need transactions, foreign keys and revocation — an analytics store is bad at
-- all three. The split is deliberate:
--
--   Postgres    who exists, and what they may do          (small, mutable)
--   ClickHouse  what happened                             (huge, append-only)

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------ organisations

CREATE TABLE IF NOT EXISTS organizations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- The slug appears in URLs and in telemetry, so it is constrained to the
    -- same shape a Kubernetes label value allows.
    slug        TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$'),
    name        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------- users
-- Shaped for Auth.js so its Postgres adapter can own these tables directly.

CREATE TABLE IF NOT EXISTS users (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name           TEXT,
    email          TEXT NOT NULL UNIQUE,
    "emailVerified" TIMESTAMPTZ,
    image          TEXT,
    -- Only set for the self-hosted email/password path. Null for anyone who
    -- signs in through an identity provider, so there is no password to steal.
    password_hash  TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS accounts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId"            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type                TEXT NOT NULL,
    provider            TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    refresh_token       TEXT,
    access_token        TEXT,
    expires_at          BIGINT,
    token_type          TEXT,
    scope               TEXT,
    id_token            TEXT,
    session_state       TEXT,
    UNIQUE (provider, "providerAccountId")
);

CREATE TABLE IF NOT EXISTS sessions (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "sessionToken" TEXT NOT NULL UNIQUE,
    "userId"       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires        TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS verification_token (
    identifier TEXT NOT NULL,
    token      TEXT NOT NULL,
    expires    TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (identifier, token)
);

-- -------------------------------------------------------------- membership
--
-- Roles map onto the write paths that already exist:
--   viewer    read only
--   operator  deploy, acknowledge a correlation, run a scan
--   admin     override a blocked preflight, run chaos, edit SLOs and tokens
--   owner     billing, members, delete the organisation

CREATE TABLE IF NOT EXISTS memberships (
    org_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role       TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'operator', 'viewer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (org_id, user_id)
);

CREATE INDEX IF NOT EXISTS memberships_user_idx ON memberships (user_id);

-- ---------------------------------------------------------------- clusters

CREATE TABLE IF NOT EXISTS clusters (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    -- The key written into every telemetry row. Unique per organisation, not
    -- globally: two customers may both call a cluster "prod", and neither
    -- should be able to discover that by trying.
    cluster_key  TEXT NOT NULL CHECK (cluster_key ~ '^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$'),
    display_name TEXT NOT NULL,
    -- Chargeback dimension. A label rather than a hierarchy level: teams change
    -- far more often than the structure of an organisation does.
    team         TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (org_id, cluster_key)
);

-- ----------------------------------------------------------- ingest tokens
--
-- The token IS the identity. A collector presents one, and the gateway derives
-- org and cluster from it — the payload never gets a say. That is what stops
-- one customer writing into another's data by guessing a cluster name.

CREATE TABLE IF NOT EXISTS ingest_tokens (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    cluster_id   UUID NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    -- SHA-256 of the token. Never the token itself: a leaked database must not
    -- hand over working credentials.
    token_hash   BYTEA NOT NULL UNIQUE,
    -- First few characters, kept in clear so the UI can show "orch8_live_a1b2…"
    -- and a human can tell two tokens apart without either being readable.
    prefix       TEXT NOT NULL,
    name         TEXT NOT NULL DEFAULT 'default',
    created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ,
    revoked_at   TIMESTAMPTZ
);

-- The gateway looks up by hash on every batch, so this index is the hot path.
CREATE INDEX IF NOT EXISTS ingest_tokens_hash_idx ON ingest_tokens (token_hash) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS ingest_tokens_cluster_idx ON ingest_tokens (cluster_id);

COMMIT;
