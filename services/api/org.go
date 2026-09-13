package main

// Who is asking.
//
// Step 1 scoped every read by organisation but took the organisation from
// configuration, which made the whole product one implicit tenant. Step 2 gave
// machines a real credential. This gives humans one.
//
// The resolution happens once, in middleware, and is stashed on the request
// context. The alternative — teaching all twenty-five call sites to do their
// own lookup — would mean twenty-five chances to forget, and twenty-five
// database reads per page.

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"regexp"
)

var orgIDRe = regexp.MustCompile(`^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$`)

// The cookie Auth.js sets. The __Secure- prefix appears once the app is served
// over HTTPS, so both names are accepted and the secure one wins.
const (
	sessionCookie       = "authjs.session-token"
	sessionCookieSecure = "__Secure-authjs.session-token"
)

type ctxKey int

const identityKey ctxKey = iota

// defaultOrg is the organisation the background detection engine runs as.
//
// ponytail: the engine is single-tenant. It has no request and therefore no
// session, so it watches one organisation. Making it iterate every org is its
// own change, and doing it badly means one slow tenant delays everyone's
// alerts.
func defaultOrg() string {
	if v := os.Getenv("ORCHESTR8_ORG"); orgIDRe.MatchString(v) {
		return v
	}
	return "local"
}

func sessionToken(r *http.Request) string {
	if c, err := r.Cookie(sessionCookieSecure); err == nil && c.Value != "" {
		return c.Value
	}
	if c, err := r.Cookie(sessionCookie); err == nil {
		return c.Value
	}
	return ""
}

// requireIdentity resolves the caller and rejects anyone it cannot place.
//
// Rejecting here rather than in each handler is the point: a handler added
// next month is protected by existing on the mux, not by remembering to ask.
// Takes the lookup as a function rather than the *control, so these branches
// can be tested without a Postgres — the same shape the ingest gateway uses.
func requireIdentity(lookup func(context.Context, string) (sessionIdentity, error), next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Preflight carries no cookies by design; answering it is not access.
		if r.Method == http.MethodOptions {
			next.ServeHTTP(w, r)
			return
		}
		tok := sessionToken(r)
		if tok == "" {
			http.Error(w, "sign in required", http.StatusUnauthorized)
			return
		}
		id, err := lookup(r.Context(), tok)
		switch {
		case errors.Is(err, errNoSession):
			http.Error(w, "sign in required", http.StatusUnauthorized)
			return
		case err != nil:
			// 503, not 401. A control-plane outage is not a failed login, and
			// telling a signed-in user to sign in again during one sends them
			// round a loop that cannot succeed.
			log.Printf("auth: control plane unavailable: %v", err)
			http.Error(w, "control plane unavailable", http.StatusServiceUnavailable)
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), identityKey, id)))
	})
}

// identityOf returns the caller resolved by requireIdentity.
func identityOf(r *http.Request) (sessionIdentity, bool) {
	id, ok := r.Context().Value(identityKey).(sessionIdentity)
	return id, ok
}

// orgFromRequest is the organisation a request may read.
//
// It reads the identity the middleware resolved from a session cookie. There
// is no header form and no fallback: a fallback here is a way to read another
// tenant's data by sending no credential at all, which is exactly the hole
// step 2 closed on the write side.
func orgFromRequest(r *http.Request) string {
	if id, ok := identityOf(r); ok {
		return id.Org
	}
	// Unreachable behind requireIdentity. Returning an org that cannot exist
	// is the safe failure: a mistake in wiring shows up as an empty dashboard,
	// never as somebody else's data.
	return "\x00none"
}

// actorOf names who did something, for the audit ledger.
//
// It used to read the X-Orchestr8-Actor header, which meant anyone could sign
// the ledger with anyone's name and the hash chain was guarding a value the
// caller chose. It now reports the signed-in user.
func actorOf(r *http.Request, fallback string) string {
	if id, ok := identityOf(r); ok && id.Email != "" {
		return id.Email
	}
	return fallback
}

// roleOf is what the caller is allowed to do. Step 4 enforces it on write
// paths; today it is recorded so the ledger says which authority was used.
func roleOf(r *http.Request) string {
	if id, ok := identityOf(r); ok {
		return id.Role
	}
	return "none"
}

func orgClause(org string) string { return "OrgId = " + chQuote(org) }
func orgClauseRaw(org string) string {
	return "ResourceAttributes['orchestr8.org.id'] = " + chQuote(org)
}
