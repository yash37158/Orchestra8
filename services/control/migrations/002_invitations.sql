-- Invitations.
--
-- Until now the first person to sign in owned the deployment and everybody
-- after them accidentally founded their own empty organisation. This is how a
-- second person joins the first one's.
--
-- The table is also the membership audit trail: who invited whom, to what,
-- when it was accepted, and by which account. Those questions get asked during
-- security review and the answer has to be a query, not a guess.

BEGIN;

CREATE TABLE IF NOT EXISTS invitations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Who it was issued to. An invite is bound to this address: accepting with
    -- a different account is refused, so a forwarded link does not become an
    -- open door into the organisation.
    email       TEXT NOT NULL CHECK (position('@' IN email) > 1),

    -- Deliberately excludes 'owner'. Ownership is a transfer, not something
    -- that should be grantable by pasting a link into a chat window — and a
    -- link that hands over the company is the one you least want forwarded.
    role        TEXT NOT NULL CHECK (role IN ('admin', 'operator', 'viewer')),

    -- SHA-256 of the invite token, never the token. Same rule as ingest
    -- tokens: a leaked database must not contain working credentials.
    token_hash  BYTEA NOT NULL UNIQUE,
    -- First characters, in clear, so the UI can tell two pending invites apart
    -- without either being usable.
    prefix      TEXT NOT NULL,

    invited_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Every invite dies on its own. An invitation that works forever is a
    -- credential nobody remembers issuing.
    expires_at  TIMESTAMPTZ NOT NULL,

    accepted_at TIMESTAMPTZ,
    accepted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    revoked_at  TIMESTAMPTZ,

    -- Accepted means accepted by somebody. Without this a row could claim a
    -- time with no account against it, which is exactly the gap an auditor
    -- asks about.
    CONSTRAINT accepted_has_an_account
        CHECK ((accepted_at IS NULL) = (accepted_by IS NULL))
);

-- One live invite per address per organisation. Re-inviting somebody who
-- already has one pending should replace it rather than leave two working
-- links, and two admins inviting the same person at once must not produce two.
CREATE UNIQUE INDEX IF NOT EXISTS invitations_one_pending_per_email
    ON invitations (org_id, lower(email))
    WHERE accepted_at IS NULL AND revoked_at IS NULL;

-- The accept path looks up by hash on every attempt.
CREATE INDEX IF NOT EXISTS invitations_hash_idx
    ON invitations (token_hash) WHERE accepted_at IS NULL AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS invitations_org_idx ON invitations (org_id, created_at DESC);

COMMIT;
