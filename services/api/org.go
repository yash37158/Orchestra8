package main

import (
	"net/http"
	"os"
	"regexp"
)

// Organisation scoping for every read.
//
// The schema keys on OrgId, but a sort key isolates nothing on its own: a query
// that omits the filter still returns every tenant's rows. With two
// organisations present the fleet endpoint merged them into one — reporting six
// GPUs when each org owned six — because cluster ids and GPU UUIDs collide
// across tenants by design.
//
// ponytail: the org is read from configuration for now. Step 3 replaces
// orgFromRequest with the session's organisation, at which point this becomes
// a real authorisation boundary rather than a correctness fix. It is written as
// a request-scoped lookup already so that swap touches one function.

var orgIDRe = regexp.MustCompile(`^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$`)

func defaultOrg() string {
	if v := os.Getenv("ORCHESTR8_ORG"); orgIDRe.MatchString(v) {
		return v
	}
	return "local"
}

// orgFromRequest resolves which organisation a request may read.
//
// The header is a DEVELOPMENT affordance and is deliberately gated: it is
// honoured only when ORCHESTR8_ALLOW_ORG_HEADER is set, because otherwise it
// would be exactly the vulnerability this file exists to close — a caller
// choosing its own tenant.
func orgFromRequest(r *http.Request) string {
	if os.Getenv("ORCHESTR8_ALLOW_ORG_HEADER") == "1" {
		if v := r.Header.Get("X-Orchestr8-Org"); orgIDRe.MatchString(v) {
			return v
		}
	}
	return defaultOrg()
}

// orgClause scopes a query on a table that has an OrgId column.
func orgClause(org string) string { return "OrgId = " + chQuote(org) }

// orgClauseRaw scopes a query on the raw otel_* tables, which carry the
// organisation as a resource attribute until the ingest gateway owns their
// schema. Same guarantee, different column.
func orgClauseRaw(org string) string {
	return "ResourceAttributes['orchestr8.org.id'] = " + chQuote(org)
}
