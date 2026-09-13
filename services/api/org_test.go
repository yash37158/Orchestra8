package main

// The middleware is the only thing standing between an anonymous request and
// twenty-five org-scoped queries. What matters is not that it works on the
// happy path — it is that nothing reaches a handler without an identity, and
// that a failure to resolve one never degrades into "some org".

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

func alice() sessionIdentity {
	return sessionIdentity{UserID: "u1", Email: "alice@local.test", Org: "local", Role: "owner"}
}

// spy records what the protected handler saw, or that it was never reached.
func spy(t *testing.T, lookup func(context.Context, string) (sessionIdentity, error)) (http.Handler, *int, *string) {
	t.Helper()
	reached, org := 0, ""
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		reached++
		org = orgFromRequest(r)
	})
	return requireIdentity(lookup, inner), &reached, &org
}

func get(h http.Handler, cookie string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(http.MethodGet, "/v1/clusters", nil)
	if cookie != "" {
		r.Header.Set("Cookie", sessionCookie+"="+cookie)
	}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}

func TestRequireIdentity(t *testing.T) {
	ok := func(context.Context, string) (sessionIdentity, error) { return alice(), nil }
	none := func(context.Context, string) (sessionIdentity, error) { return sessionIdentity{}, errNoSession }
	broken := func(context.Context, string) (sessionIdentity, error) {
		return sessionIdentity{}, errors.New("dial tcp: connection refused")
	}

	cases := []struct {
		name    string
		cookie  string
		lookup  func(context.Context, string) (sessionIdentity, error)
		want    int
		reached int
		org     string
	}{
		{"no cookie", "", ok, http.StatusUnauthorized, 0, ""},
		{"empty cookie", "", none, http.StatusUnauthorized, 0, ""},
		{"unknown session", "nope", none, http.StatusUnauthorized, 0, ""},
		{"expired session", "old", none, http.StatusUnauthorized, 0, ""},
		{
			// 503, not 401. Telling a signed-in user to sign in again during a
			// database outage sends them round a loop that cannot succeed.
			"control plane down", "sess", broken, http.StatusServiceUnavailable, 0, "",
		},
		{"valid session", "sess", ok, http.StatusOK, 1, "local"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			h, reached, org := spy(t, tc.lookup)
			if got := get(h, tc.cookie).Code; got != tc.want {
				t.Errorf("status = %d, want %d", got, tc.want)
			}
			if *reached != tc.reached {
				t.Errorf("handler ran %d times, want %d", *reached, tc.reached)
			}
			if *org != tc.org {
				t.Errorf("handler saw org %q, want %q", *org, tc.org)
			}
		})
	}
}

// The secure cookie must win, so a downgrade attempt cannot pin an old value
// alongside the real one.
func TestSecureCookieWins(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/v1/clusters", nil)
	r.Header.Add("Cookie", sessionCookie+"=insecure")
	r.Header.Add("Cookie", sessionCookieSecure+"=secure")
	if got := sessionToken(r); got != "secure" {
		t.Errorf("sessionToken = %q, want %q", got, "secure")
	}
}

// Without an identity, orgFromRequest must not resolve to a readable org. A
// default here would be a way to read a tenant's data by sending no credential
// at all — the same hole the ingest gateway closed on the write side.
func TestOrgWithoutIdentityMatchesNothing(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/v1/clusters", nil)
	org := orgFromRequest(r)
	if orgIDRe.MatchString(org) {
		t.Errorf("org %q is a legal organisation id; it must match nothing", org)
	}
	if org == defaultOrg() || org == "" {
		t.Errorf("org %q falls back to a readable organisation", org)
	}
}

// The ledger's whole value is that entries name the person who acted. Reading
// a header let anyone sign it with anyone's name.
func TestActorIgnoresTheHeader(t *testing.T) {
	h := requireIdentity(
		func(context.Context, string) (sessionIdentity, error) { return alice(), nil },
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if got := actorOf(r, "operator"); got != "alice@local.test" {
				t.Errorf("actor = %q, want the signed-in user", got)
			}
			if got := roleOf(r); got != "owner" {
				t.Errorf("role = %q, want owner", got)
			}
		}),
	)
	r := httptest.NewRequest(http.MethodGet, "/v1/clusters", nil)
	r.Header.Set("Cookie", sessionCookie+"=sess")
	r.Header.Set("X-Orchestr8-Actor", "mallory@evil.test")
	r.Header.Set("X-Orchestr8-Org", "acme")
	h.ServeHTTP(httptest.NewRecorder(), r)
}
