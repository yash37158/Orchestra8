package main

// An invitation is a credential that creates access to a tenant's data. The
// rules worth pinning down are who may issue one, and everything the accept
// path refuses.

import "testing"

// An admin cannot mint another admin. One compromised admin account would
// otherwise be able to widen itself, and every account it created could do the
// same — which is how a single stolen session becomes permanent.
func TestWhoMayGrantWhat(t *testing.T) {
	cases := []struct {
		actor, target string
		want          bool
	}{
		{"owner", "admin", true},
		{"owner", "operator", true},
		{"owner", "viewer", true},
		{"admin", "operator", true},
		{"admin", "viewer", true},

		{"admin", "admin", false},     // no self-widening
		{"owner", "owner", false},     // ownership is a transfer, not a link
		{"admin", "owner", false},     // and certainly not upward
		{"operator", "viewer", false}, // operators run things, they do not staff them
		{"viewer", "viewer", false},
		{"", "viewer", false}, // no role at all grants nothing
		{"owner", "", false},
		{"owner", "superuser", false}, // a role the database would reject anyway
	}
	for _, tc := range cases {
		if got := mayGrant(tc.actor, tc.target); got != tc.want {
			t.Errorf("%q granting %q = %v, want %v", tc.actor, tc.target, got, tc.want)
		}
	}
}

// Nobody can be invited as an owner through any path. The map above is one
// guard; the database CHECK is the other, and this asserts the map cannot
// disagree with it.
func TestOwnerIsNeverGrantable(t *testing.T) {
	for actor := range canGrant {
		for _, granted := range canGrant[actor] {
			if granted == "owner" {
				t.Errorf("%q is allowed to grant owner", actor)
			}
		}
	}
	if mayGrant("owner", "owner") {
		t.Error("an owner can grant ownership by link")
	}
}

// The token in the link must not look like an ingest token. They are different
// credentials for different things, and a support conversation that confuses
// them ends with somebody pasting the wrong secret somewhere.
func TestInviteTokenIsDistinguishable(t *testing.T) {
	tok, err := newInviteToken()
	if err != nil {
		t.Fatal(err)
	}
	if got := tok[:4]; got != "inv_" {
		t.Errorf("prefix = %q, want inv_", got)
	}
	if len(tok) < 40 {
		t.Errorf("token is %d characters; too short to be unguessable", len(tok))
	}
	other, _ := newInviteToken()
	if tok == other {
		t.Error("two invitations got the same token")
	}
}
