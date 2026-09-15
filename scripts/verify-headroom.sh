#!/usr/bin/env bash
# Headroom self-validation.
#
# The feature's whole claim is that it reports measurements and refuses to
# invent them, so these probes are mostly about the refusals. A number here is
# something somebody drains a production node on.
set -uo pipefail

API=${ORCHESTR8_API:-http://localhost:8088}
PSQL=${PSQL:-psql -d orchestr8}
ORG=${ORG:-local}

pass=0; fail=0
check() {
  if [ "$3" = "$2" ]; then printf '  PASS  %-48s %s\n' "$1" "$3"; pass=$((pass+1))
  else printf '  FAIL  %-48s got %s, want %s\n' "$1" "$3" "$2"; fail=$((fail+1)); fi
}

SESSION="vh-$$"
cleanup() {
  $PSQL -q -c "DELETE FROM sessions WHERE \"sessionToken\" = '$SESSION'" >/dev/null 2>&1
  $PSQL -q -c "DELETE FROM memberships WHERE user_id='dddddddd-0000-0000-0000-000000000001'" >/dev/null 2>&1
  $PSQL -q -c "DELETE FROM users WHERE id='dddddddd-0000-0000-0000-000000000001'" >/dev/null 2>&1
}
trap cleanup EXIT
$PSQL -q <<SQL >/dev/null 2>&1
INSERT INTO users (id,name,email) VALUES ('dddddddd-0000-0000-0000-000000000001','VH','vh@verify.test')
ON CONFLICT (email) DO NOTHING;
INSERT INTO memberships (org_id,user_id,role)
  SELECT id,'dddddddd-0000-0000-0000-000000000001','viewer' FROM organizations WHERE slug='$ORG'
ON CONFLICT DO NOTHING;
INSERT INTO sessions ("sessionToken","userId",expires)
VALUES ('$SESSION','dddddddd-0000-0000-0000-000000000001', now() + interval '1 hour');
SQL

get() { curl -s -H "Cookie: authjs.session-token=$SESSION" "$API/v1/headroom"; }

echo "api: $API   org: $ORG"
echo
echo "access"
check "no session is refused" 401 "$(curl -s -o /dev/null -w '%{http_code}' "$API/v1/headroom")"
check "a session is served"   200 "$(curl -s -o /dev/null -w '%{http_code}' -H "Cookie: authjs.session-token=$SESSION" "$API/v1/headroom")"

get > /tmp/vh.json
echo
echo "shape"
check "services returned" 1 "$(python3 -c '
import json; d=json.load(open("/tmp/vh.json")); print(1 if (d.get("services") or []) else 0)')"
check "every service states its basis" 1 "$(python3 -c '
import json
s=json.load(open("/tmp/vh.json")).get("services") or []
print(1 if all(x.get("basis") for x in s) else 0)')"

echo
echo "it reports measurements, not guesses"
# Every curve point must be backed by real minutes, and ordered by load.
check "curve points are backed by minutes" 1 "$(python3 -c '
import json
s=json.load(open("/tmp/vh.json")).get("services") or []
print(1 if all(p["minutes"] >= 3 for x in s for p in x["curve"]) else 0)')"
check "curves are ordered by load" 1 "$(python3 -c '
import json
s=json.load(open("/tmp/vh.json")).get("services") or []
ok=all([p["reqPerMin"] for p in x["curve"]] == sorted(p["reqPerMin"] for p in x["curve"]) for x in s)
print(1 if ok else 0)')"
# A drain figure is only ever published alongside observed=true.
check "no drain figure without an observation" 1 "$(python3 -c '
import json
s=json.load(open("/tmp/vh.json")).get("services") or []
bad=[x for x in s if not x["drain"]["observed"] and (x["drain"]["p95Ms"] or 0) > 0]
print(0 if bad else 1)')"
check "a refusal always explains itself" 1 "$(python3 -c '
import json
s=json.load(open("/tmp/vh.json")).get("services") or []
bad=[x for x in s if not x["drain"]["observed"] and not x["drain"]["note"]]
print(0 if bad else 1)')"
# A single-GPU service cannot be drained; it must say so rather than compute.
check "single-GPU services refuse the drain" 1 "$(python3 -c '
import json
s=json.load(open("/tmp/vh.json")).get("services") or []
one=[x for x in s if x["gpuCount"] < 2]
print(1 if all(not x["drain"]["observed"] for x in one) else 0)')"
# Anything inside the observed range must carry a load and a latency.
check "observed drains carry both figures" 1 "$(python3 -c '
import json
s=json.load(open("/tmp/vh.json")).get("services") or []
d=[x["drain"] for x in s if x["drain"]["observed"]]
print(1 if all(x["equivalentReqPerMin"] > 0 and x["p95Ms"] > 0 for x in d) else 0)')"

echo
echo "tenancy"
$PSQL -q -c "INSERT INTO organizations (slug,name) VALUES ('vh-empty','Empty') ON CONFLICT DO NOTHING" >/dev/null 2>&1
$PSQL -q -c "UPDATE memberships SET org_id=(SELECT id FROM organizations WHERE slug='vh-empty') WHERE user_id='dddddddd-0000-0000-0000-000000000001'" >/dev/null 2>&1
check "a tenant with no telemetry sees none" 0 "$(get | python3 -c '
import json,sys; print(len(json.load(sys.stdin).get("services") or []))')"
$PSQL -q -c "UPDATE memberships SET org_id=(SELECT id FROM organizations WHERE slug='$ORG') WHERE user_id='dddddddd-0000-0000-0000-000000000001'" >/dev/null 2>&1
$PSQL -q -c "DELETE FROM organizations WHERE slug='vh-empty'" >/dev/null 2>&1

echo
printf '  %d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
