package main

// Invitations: how a second person gets into an organisation.
//
// Create, list and revoke live here rather than in the web app, for the same
// reason every other privileged write does: this is where the session
// middleware has already established who is asking and with what authority,
// and where the audit ledger is. Accepting lives in the web app, because it
// happens during sign-in — before there is a session to authorise against.

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"
)

// How long an invite lives. Long enough to survive a weekend, short enough
// that a link pasted into a chat window stops working before anyone has
// forgotten it exists.
const inviteTTL = 7 * 24 * time.Hour

// Who may grant what.
//
// An owner can appoint admins; an admin cannot. That is deliberate: letting
// admins mint admins means one compromised admin account can quietly widen
// itself, and every account it creates can do the same. Nobody can grant
// 'owner' at all — ownership is a transfer, and the database CHECK refuses it
// even if this map is ever wrong.
var canGrant = map[string][]string{
	"owner": {"admin", "operator", "viewer"},
	"admin": {"operator", "viewer"},
}

func mayGrant(actorRole, target string) bool {
	for _, r := range canGrant[actorRole] {
		if r == target {
			return true
		}
	}
	return false
}

type Invitation struct {
	ID        string `json:"id"`
	Email     string `json:"email"`
	Role      string `json:"role"`
	Prefix    string `json:"prefix"`
	InvitedBy string `json:"invitedBy"`
	CreatedAt string `json:"createdAt"`
	ExpiresAt string `json:"expiresAt"`
	State     string `json:"state"` // pending | accepted | revoked | expired
}

type Member struct {
	Email    string `json:"email"`
	Name     string `json:"name"`
	Role     string `json:"role"`
	JoinedAt string `json:"joinedAt"`
}

// newInviteToken is the thing that travels in the link. Same shape and same
// entropy as an ingest token, because it is the same kind of secret.
func newInviteToken() (string, error) {
	tok, err := newToken()
	if err != nil {
		return "", err
	}
	return strings.Replace(tok, "orch8_", "inv_", 1), nil
}

var errInviteNotFound = errors.New("invitation is not valid")

// uuidRe guards the id before it reaches a ::uuid cast.
//
// Without it a malformed id is a Postgres syntax error surfacing as a 500 —
// the caller's mistake reported as the server's fault, and a database error
// shape in the logs for something that should never have reached the database.
var uuidRe = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// CreateInvitation issues one, replacing any pending invite for the same
// address so an organisation never has two working links for one person.
func (c *control) CreateInvitation(ctx context.Context, org, email, role, invitedBy string) (string, *Invitation, error) {
	if c.db == nil {
		return "", nil, errors.New("control plane not configured")
	}
	email = strings.TrimSpace(strings.ToLower(email))
	if !strings.Contains(email, "@") || len(email) < 3 {
		return "", nil, fmt.Errorf("%q is not an email address", email)
	}
	tok, err := newInviteToken()
	if err != nil {
		return "", nil, err
	}

	tx, err := c.db.BeginTx(ctx, nil)
	if err != nil {
		return "", nil, err
	}
	defer func() { _ = tx.Rollback() }()

	var orgID string
	if err := tx.QueryRowContext(ctx, `SELECT id FROM organizations WHERE slug = $1`, org).Scan(&orgID); err != nil {
		return "", nil, fmt.Errorf("no such organisation: %s", org)
	}

	// Already inside? Say so plainly. Issuing a link that will be refused on
	// use wastes the inviter's time and looks like a broken product.
	var already string
	err = tx.QueryRowContext(ctx, `
SELECT m.role FROM memberships m JOIN users u ON u.id = m.user_id
 WHERE m.org_id = $1 AND lower(u.email) = $2`, orgID, email).Scan(&already)
	if err == nil {
		return "", nil, fmt.Errorf("%s is already a member (%s)", email, already)
	} else if !errors.Is(err, sql.ErrNoRows) {
		return "", nil, err
	}

	// Supersede rather than collide: the partial unique index allows exactly
	// one live invite per address, so the old one is retired first.
	if _, err := tx.ExecContext(ctx, `
UPDATE invitations SET revoked_at = now()
 WHERE org_id = $1 AND lower(email) = $2 AND accepted_at IS NULL AND revoked_at IS NULL`,
		orgID, email); err != nil {
		return "", nil, err
	}

	inv := &Invitation{Email: email, Role: role, Prefix: tok[:10], State: "pending"}
	var invitedByID any
	if invitedBy != "" {
		invitedByID = invitedBy
	}
	if err := tx.QueryRowContext(ctx, `
INSERT INTO invitations (org_id, email, role, token_hash, prefix, invited_by, expires_at)
VALUES ($1, $2, $3, $4, $5, $6, now() + $7::interval)
RETURNING id::text, created_at::text, expires_at::text`,
		orgID, email, role, hashToken(tok), inv.Prefix, invitedByID,
		fmt.Sprintf("%d seconds", int(inviteTTL.Seconds())),
	).Scan(&inv.ID, &inv.CreatedAt, &inv.ExpiresAt); err != nil {
		return "", nil, err
	}
	if err := tx.Commit(); err != nil {
		return "", nil, err
	}
	return tok, inv, nil
}

func (c *control) ListInvitations(ctx context.Context, org string) ([]Invitation, error) {
	if c.db == nil {
		return nil, errors.New("control plane not configured")
	}
	rows, err := c.db.QueryContext(ctx, `
SELECT i.id::text, i.email, i.role, i.prefix,
       coalesce(u.email, ''), i.created_at::text, i.expires_at::text,
       CASE WHEN i.accepted_at IS NOT NULL THEN 'accepted'
            WHEN i.revoked_at  IS NOT NULL THEN 'revoked'
            WHEN i.expires_at  < now()     THEN 'expired'
            ELSE 'pending' END
  FROM invitations i
  JOIN organizations o ON o.id = i.org_id
  LEFT JOIN users u ON u.id = i.invited_by
 WHERE o.slug = $1
 ORDER BY i.created_at DESC
 LIMIT 100`, org)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Invitation{}
	for rows.Next() {
		var v Invitation
		if err := rows.Scan(&v.ID, &v.Email, &v.Role, &v.Prefix, &v.InvitedBy,
			&v.CreatedAt, &v.ExpiresAt, &v.State); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

func (c *control) RevokeInvitation(ctx context.Context, org, id string) error {
	if c.db == nil {
		return errors.New("control plane not configured")
	}
	if !uuidRe.MatchString(id) {
		// Same answer as an id that simply does not exist. Distinguishing
		// "malformed" from "not yours" tells a prober which half landed.
		return errInviteNotFound
	}
	// Scoped by organisation in the statement itself, so an id from another
	// tenant matches nothing rather than being revoked by a stranger.
	res, err := c.db.ExecContext(ctx, `
UPDATE invitations i SET revoked_at = now()
  FROM organizations o
 WHERE o.id = i.org_id AND o.slug = $1 AND i.id = $2::uuid
   AND i.accepted_at IS NULL AND i.revoked_at IS NULL`, org, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return errInviteNotFound
	}
	return nil
}

func (c *control) Members(ctx context.Context, org string) ([]Member, error) {
	if c.db == nil {
		return nil, errors.New("control plane not configured")
	}
	rows, err := c.db.QueryContext(ctx, `
SELECT u.email, coalesce(u.name, ''), m.role, m.created_at::text
  FROM memberships m
  JOIN users u ON u.id = m.user_id
  JOIN organizations o ON o.id = m.org_id
 WHERE o.slug = $1
 ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'operator' THEN 2 ELSE 3 END,
          u.email`, org)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Member{}
	for rows.Next() {
		var m Member
		if err := rows.Scan(&m.Email, &m.Name, &m.Role, &m.JoinedAt); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

// ---------------------------------------------------------------- handlers

// handleTeam serves GET /v1/team — members and invitations together, because
// the screen shows them as one list and two round trips would let them
// disagree.
func handleTeam(w http.ResponseWriter, r *http.Request, ctrl *control) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	org := orgFromRequest(r)
	members, err := ctrl.Members(r.Context(), org)
	if err != nil {
		log.Printf("team: members: %v", err)
		http.Error(w, "could not read the team", http.StatusInternalServerError)
		return
	}
	invites, err := ctrl.ListInvitations(r.Context(), org)
	if err != nil {
		log.Printf("team: invitations: %v", err)
		http.Error(w, "could not read invitations", http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]any{
		"members":     members,
		"invitations": invites,
		// What this caller may do, so the UI hides what would be refused
		// rather than offering it and failing.
		"role":      roleOf(r),
		"canInvite": canGrant[roleOf(r)],
	})
}

// handleInvitations serves POST /v1/invitations (create) and
// POST /v1/invitations/{id}/revoke.
func handleInvitations(w http.ResponseWriter, r *http.Request, ctrl *control, aud *auditLog, appURL string) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	org, actorRole, actor := orgFromRequest(r), roleOf(r), actorOf(r, "unknown")

	if id, ok := strings.CutPrefix(r.URL.Path, "/v1/invitations/"); ok {
		id = strings.TrimSuffix(id, "/revoke")
		if len(canGrant[actorRole]) == 0 {
			http.Error(w, "your role cannot manage invitations", http.StatusForbidden)
			return
		}
		if err := ctrl.RevokeInvitation(r.Context(), org, id); err != nil {
			if errors.Is(err, errInviteNotFound) {
				http.Error(w, "no such pending invitation", http.StatusNotFound)
				return
			}
			log.Printf("invitations: revoke: %v", err)
			http.Error(w, "could not revoke", http.StatusInternalServerError)
			return
		}
		_, _ = aud.Append(r.Context(), actor, "invite.revoke", id, "", "allowed", nil)
		writeJSON(w, map[string]any{"id": id, "state": "revoked"})
		return
	}

	var req struct {
		Email string `json:"email"`
		Role  string `json:"role"`
	}
	if err := decodeJSON(r, &req); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	// The role check comes before anything is written, and names the rule
	// rather than just refusing: "forbidden" with no reason is how people file
	// bugs against working software.
	if !mayGrant(actorRole, req.Role) {
		_, _ = aud.Append(r.Context(), actor, "invite.create", req.Email, "", "denied",
			map[string]any{"role": req.Role, "actorRole": actorRole})
		http.Error(w, fmt.Sprintf("a %s cannot grant %q", actorRole, req.Role), http.StatusForbidden)
		return
	}

	var invitedBy string
	if id, ok := identityOf(r); ok {
		invitedBy = id.UserID
	}
	tok, inv, err := ctrl.CreateInvitation(r.Context(), org, req.Email, req.Role, invitedBy)
	if err != nil {
		// These are the caller's mistakes — a bad address, somebody who is
		// already in — so they carry their own message and a 400.
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	_, _ = aud.Append(r.Context(), actor, "invite.create", inv.Email, "", "allowed",
		map[string]any{"role": inv.Role, "expiresAt": inv.ExpiresAt})

	// The token is returned exactly once, here. It is not stored and cannot be
	// shown again; a lost link is re-issued, not recovered.
	writeJSON(w, map[string]any{
		"invitation": inv,
		"link":       strings.TrimRight(appURL, "/") + "/invite/" + tok,
	})
}

var _ = json.Marshal

// ------------------------------------------------------------------ accept

// InvitePreview is what the accept page shows before anyone signs in.
//
// Deliberately thin: the organisation's name, the role offered, and the
// address it was issued to. Anyone holding the link sees this, so it carries
// nothing about the organisation's size, members, or fleet.
type InvitePreview struct {
	Org   string `json:"org"`
	Name  string `json:"name"`
	Email string `json:"email"`
	Role  string `json:"role"`
}

// PreviewInvitation resolves a token without consuming it.
func (c *control) PreviewInvitation(ctx context.Context, tok string) (*InvitePreview, error) {
	if c.db == nil {
		return nil, errors.New("control plane not configured")
	}
	var p InvitePreview
	err := c.db.QueryRowContext(ctx, `
SELECT o.slug, o.name, i.email, i.role
  FROM invitations i JOIN organizations o ON o.id = i.org_id
 WHERE i.token_hash = $1
   AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > now()`,
		hashToken(tok)).Scan(&p.Org, &p.Name, &p.Email, &p.Role)
	if errors.Is(err, sql.ErrNoRows) {
		// One error for unknown, revoked, accepted and expired. Which of the
		// four it was is not information a holder of a bad link is owed.
		return nil, errInviteNotFound
	}
	return &p, err
}

var (
	errInviteWrongAccount = errors.New("this invitation was issued to a different address")
	errAlreadyElsewhere   = errors.New("this account already belongs to another organisation")
)

// AcceptInvitation consumes a token and grants the membership.
//
// Everything happens in one transaction with the row locked, so two clicks on
// the same link — or two people racing with a forwarded one — produce one
// membership and one winner.
func (c *control) AcceptInvitation(ctx context.Context, tok, userID, userEmail string) (string, error) {
	if c.db == nil {
		return "", errors.New("control plane not configured")
	}
	tx, err := c.db.BeginTx(ctx, nil)
	if err != nil {
		return "", err
	}
	defer func() { _ = tx.Rollback() }()

	var invID, orgID, orgSlug, invEmail, role string
	// FOR UPDATE holds the row for the length of the transaction: the check
	// that it is unused and the write that uses it cannot interleave.
	err = tx.QueryRowContext(ctx, `
SELECT i.id::text, o.id::text, o.slug, i.email, i.role
  FROM invitations i JOIN organizations o ON o.id = i.org_id
 WHERE i.token_hash = $1
   AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > now()
 FOR UPDATE OF i`, hashToken(tok)).Scan(&invID, &orgID, &orgSlug, &invEmail, &role)
	if errors.Is(err, sql.ErrNoRows) {
		return "", errInviteNotFound
	} else if err != nil {
		return "", err
	}

	// Bound to the address it was issued to. Without this a forwarded link is
	// an open door: anyone who can sign in at all could walk into the
	// organisation with the role somebody else was offered.
	if !strings.EqualFold(strings.TrimSpace(userEmail), invEmail) {
		return "", errInviteWrongAccount
	}

	// Already in this organisation: accept idempotently rather than erroring,
	// because a second click on the same link is a normal thing to do.
	var existingOrg string
	err = tx.QueryRowContext(ctx, `
SELECT o.slug FROM memberships m JOIN organizations o ON o.id = m.org_id
 WHERE m.user_id = $1 ORDER BY m.created_at LIMIT 1`, userID).Scan(&existingOrg)
	switch {
	case err == nil && existingOrg == orgSlug:
		// Nothing to grant, but the invite is still spent.
	case err == nil:
		// ponytail: one organisation per account. Accepting a second would
		// create a membership the session resolver never picks, so it would
		// look accepted and change nothing. Refused with a real reason until
		// there is an organisation switcher to make it meaningful.
		return "", errAlreadyElsewhere
	case !errors.Is(err, sql.ErrNoRows):
		return "", err
	default:
		if _, err := tx.ExecContext(ctx, `
INSERT INTO memberships (org_id, user_id, role) VALUES ($1, $2, $3)
ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role`, orgID, userID, role); err != nil {
			return "", err
		}
	}

	if _, err := tx.ExecContext(ctx, `
UPDATE invitations SET accepted_at = now(), accepted_by = $1 WHERE id = $2::uuid`,
		userID, invID); err != nil {
		return "", err
	}
	if err := tx.Commit(); err != nil {
		return "", err
	}
	return orgSlug, nil
}

// handleInvitePreview and handleInviteAccept are the two unauthenticated
// invite routes.
//
// They have to be unauthenticated: the whole point is that the person holding
// the link does not have an account in this organisation yet. The token is the
// credential, and it is single-use, expiring, and bound to one address.
func handleInvitePreview(w http.ResponseWriter, r *http.Request, ctrl *control) {
	tok := strings.TrimPrefix(r.URL.Path, "/v1/invite/")
	if tok == "" {
		http.Error(w, "missing token", http.StatusBadRequest)
		return
	}
	p, err := ctrl.PreviewInvitation(r.Context(), tok)
	if err != nil {
		if errors.Is(err, errInviteNotFound) {
			http.Error(w, "this invitation is no longer valid", http.StatusNotFound)
			return
		}
		log.Printf("invite preview: %v", err)
		http.Error(w, "could not read the invitation", http.StatusServiceUnavailable)
		return
	}
	writeJSON(w, p)
}

func handleInviteAccept(w http.ResponseWriter, r *http.Request, ctrl *control, aud *auditLog) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		Token string `json:"token"`
	}
	if err := decodeJSON(r, &req); err != nil || req.Token == "" {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}

	// WHO is accepting comes from the session cookie, never from the body.
	//
	// The first version of this took userId and email as request fields. The
	// route is unauthenticated by necessity — the caller has no membership yet
	// — so that let anyone holding a link name any account, including one they
	// did not control, and grant it access. The email check compared two
	// attacker-supplied values against each other and proved nothing.
	//
	// By the time anyone reaches this point they have signed in, so a session
	// exists. It just does not belong to an organisation yet, which is why
	// this resolves the user directly instead of going through requireIdentity.
	tok := sessionToken(r)
	if tok == "" {
		http.Error(w, "sign in before accepting an invitation", http.StatusUnauthorized)
		return
	}
	userID, userEmail, err := ctrl.lookupSessionUser(r.Context(), tok)
	if errors.Is(err, errNoSession) {
		http.Error(w, "sign in before accepting an invitation", http.StatusUnauthorized)
		return
	} else if err != nil {
		log.Printf("invite accept: session: %v", err)
		http.Error(w, "control plane unavailable", http.StatusServiceUnavailable)
		return
	}

	org, err := ctrl.AcceptInvitation(r.Context(), req.Token, userID, userEmail)
	switch {
	case errors.Is(err, errInviteNotFound):
		http.Error(w, "this invitation is no longer valid", http.StatusNotFound)
		return
	case errors.Is(err, errInviteWrongAccount):
		http.Error(w, "this invitation was issued to a different email address", http.StatusForbidden)
		return
	case errors.Is(err, errAlreadyElsewhere):
		http.Error(w, "this account already belongs to another organisation", http.StatusConflict)
		return
	case err != nil:
		log.Printf("invite accept: %v", err)
		http.Error(w, "could not accept the invitation", http.StatusInternalServerError)
		return
	}
	// Audited against the organisation joined, which is why the org rides the
	// context here rather than coming from a session that does not exist yet.
	_, _ = aud.Append(withOrg(r.Context(), org), userEmail, "invite.accept", userEmail, "", "allowed", nil)
	writeJSON(w, map[string]any{"org": org})
}
