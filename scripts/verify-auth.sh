#!/usr/bin/env bash
# Sign-in self-validation.
#
# Every probe here is a way somebody might try to read a tenant's data without
# being that tenant. The sessions are seeded directly into the control plane in
# exactly the shape Auth.js writes them, so the credential path is exercised
# for real without standing up an OAuth provider.
set -uo pipefail

API=${ORCHESTR8_API:-http://localhost:8088}
WEB=${ORCHESTR8_WEB:-http://localhost:3001}
PSQL=${PSQL:-psql -d orchestr8}

pass=0; fail=0
check() {  # check <name> <expected> <actual>
  if [ "$3" = "$2" ]; then printf '  PASS  %-46s %s\n' "$1" "$3"; pass=$((pass+1))
  else printf '  FAIL  %-46s got %s, want %s\n' "$1" "$3" "$2"; fail=$((fail+1)); fi
}
code() {  # code <session-token> <path> [extra curl args...]
  local tok=$1 path=$2; shift 2
  if [ -n "$tok" ]; then set -- -H "Cookie: authjs.session-token=$tok" "$@"; fi
  curl -s -o /tmp/va -w '%{http_code}' --max-time 15 "$@" "$API$path"
}
clusters_for() {  # clusters_for <session-token> -> "<n> <ids>"
  code "$1" /v1/clusters >/dev/null
  python3 -c "
import json
try: cs=json.load(open('/tmp/va')).get('clusters',[])
except Exception: print('err'); raise SystemExit
print(f\"{len(cs)} {','.join(sorted(c['id'] for c in cs)) or '-'}\")"
}

SEED_TAG='verify-auth'
seed() {
  $PSQL -q <<SQL >/dev/null 2>&1
INSERT INTO users (id,name,email) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001','VA One','one@$SEED_TAG.test'),
  ('aaaaaaaa-0000-0000-0000-000000000002','VA Two','two@$SEED_TAG.test'),
  ('aaaaaaaa-0000-0000-0000-000000000003','VA Orphan','orphan@$SEED_TAG.test')
ON CONFLICT (email) DO NOTHING;
INSERT INTO memberships (org_id,user_id,role)
  SELECT id,'aaaaaaaa-0000-0000-0000-000000000001','owner'  FROM organizations WHERE slug='$ORG_A' ON CONFLICT DO NOTHING;
INSERT INTO memberships (org_id,user_id,role)
  SELECT id,'aaaaaaaa-0000-0000-0000-000000000002','viewer' FROM organizations WHERE slug='$ORG_B' ON CONFLICT DO NOTHING;
INSERT INTO sessions ("sessionToken","userId",expires) VALUES
  ('va-one','aaaaaaaa-0000-0000-0000-000000000001', now() + interval '1 hour'),
  ('va-two','aaaaaaaa-0000-0000-0000-000000000002', now() + interval '1 hour'),
  ('va-orphan','aaaaaaaa-0000-0000-0000-000000000003', now() + interval '1 hour'),
  ('va-expired','aaaaaaaa-0000-0000-0000-000000000001', now() - interval '1 hour')
ON CONFLICT ("sessionToken") DO UPDATE SET expires=EXCLUDED.expires;
SQL
}
cleanup() {
  $PSQL -q -c "DELETE FROM sessions WHERE \"sessionToken\" LIKE 'va-%'" >/dev/null 2>&1
  $PSQL -q -c "DELETE FROM users WHERE email LIKE '%@$SEED_TAG.test'" >/dev/null 2>&1
}
trap cleanup EXIT

ORG_A=${ORG_A:-local}
ORG_B=${ORG_B:-acme}
seed

echo "api: $API   orgs: $ORG_A / $ORG_B"
echo
echo "no credential reaches no data"
check "no cookie"                        401 "$(code '' /v1/dashboard)"
check "invented session token"           401 "$(code 'not-a-session' /v1/dashboard)"
check "expired session"                  401 "$(code 'va-expired' /v1/dashboard)"
check "signed in, but in no organisation" 401 "$(code 'va-orphan' /v1/dashboard)"
check "health check stays open"          200 "$(code '' /healthz)"

echo
echo "the removed back doors stay removed"
check "X-Orchestr8-Org without a session" 401 "$(code '' /v1/dashboard -H 'X-Orchestr8-Org: '"$ORG_B")"
# A session for org A that also asks to be org B must still see only A.
code va-one /v1/clusters -H "X-Orchestr8-Org: $ORG_B" >/dev/null
SPOOFED=$(python3 -c "
import json
cs=json.load(open('/tmp/va')).get('clusters',[])
print(','.join(sorted(c['id'] for c in cs)) or '-')")
HONEST=$(code va-one /v1/clusters >/dev/null; python3 -c "
import json
cs=json.load(open('/tmp/va')).get('clusters',[])
print(','.join(sorted(c['id'] for c in cs)) or '-')")
check "X-Orchestr8-Org with a session is ignored" "$HONEST" "$SPOOFED"

echo
echo "each session sees only its own organisation"
A=$(clusters_for va-one); B=$(clusters_for va-two)
printf '        %-10s %s\n' "$ORG_A" "$A"
printf '        %-10s %s\n' "$ORG_B" "$B"
if [ "$A" = "$B" ]; then
  printf '  FAIL  %-46s both sessions saw the same clusters\n' "two organisations are distinguishable"; fail=$((fail+1))
else
  printf '  PASS  %-46s %s\n' "two organisations are distinguishable" "different"; pass=$((pass+1))
fi

echo
echo "revocation is immediate"
$PSQL -q -c "DELETE FROM sessions WHERE \"sessionToken\"='va-one'" >/dev/null 2>&1
check "deleting the session locks it out"  401 "$(code 'va-one' /v1/dashboard)"
$PSQL -q -c "INSERT INTO sessions (\"sessionToken\",\"userId\",expires) VALUES ('va-one','aaaaaaaa-0000-0000-0000-000000000001', now() + interval '1 hour')" >/dev/null 2>&1
check "restoring it lets them back in"     200 "$(code 'va-one' /v1/dashboard)"
$PSQL -q -c "DELETE FROM memberships WHERE user_id='aaaaaaaa-0000-0000-0000-000000000001'" >/dev/null 2>&1
check "removing membership locks them out" 401 "$(code 'va-one' /v1/dashboard)"

echo
echo "the browser sends people to sign in"
check "/dashboard redirects"  307 "$(curl -s -o /dev/null -w '%{http_code}' --max-time 25 "$WEB/dashboard")"
check "/signin is reachable"  200 "$(curl -s -o /dev/null -w '%{http_code}' --max-time 25 "$WEB/signin")"

echo
printf '  %d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
