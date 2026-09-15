#!/usr/bin/env bash
# Runs one scan through the API and waits for it.
#
# A script rather than a Makefile one-liner because the API needs a session on
# every /v1 route, and seeding one is the same dance the verify-* scripts do.
# The old `make scan` predates sign-in and had been answering 401 since.
set -euo pipefail

API=${ORCHESTR8_API:-http://localhost:8088}
ORG=${ORCHESTR8_ORG:-local}
TARGET=${1:-../../package-lock.json}
KIND=${2:-filesystem}
PSQL=${PSQL:-psql -d orchestr8}
SESSION="make-scan-$$"

setup() {
  $PSQL -q <<SQL >/dev/null 2>&1
INSERT INTO users (id, name, email) VALUES
  ('eeeeeeee-0000-0000-0000-00000000f00d','Make Scan','make-scan@local.test')
ON CONFLICT (email) DO NOTHING;
INSERT INTO memberships (org_id, user_id, role)
  SELECT id,'eeeeeeee-0000-0000-0000-00000000f00d','operator' FROM organizations WHERE slug='$ORG'
ON CONFLICT DO NOTHING;
INSERT INTO sessions ("sessionToken","userId",expires)
VALUES ('$SESSION','eeeeeeee-0000-0000-0000-00000000f00d', now() + interval '1 hour');
SQL
}
teardown() {
  $PSQL -q -c "DELETE FROM sessions WHERE \"sessionToken\" = '$SESSION'" >/dev/null 2>&1 || true
  $PSQL -q -c "DELETE FROM users WHERE email = 'make-scan@local.test'" >/dev/null 2>&1 || true
}
trap teardown EXIT
setup

auth=(-H "Cookie: authjs.session-token=$SESSION")
start=$(curl -s -X POST "$API/v1/scans" "${auth[@]}" -H 'Content-Type: application/json' \
  -d "{\"target\":\"$TARGET\",\"kind\":\"$KIND\"}")
id=$(printf '%s' "$start" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])') || {
  echo "  could not start: $start" >&2; exit 1; }
echo "  $id started on $TARGET"

# The scan outlives the request now, so this polls rather than waits on a
# socket. The API caps a scan at four minutes; allow a little past that.
for _ in $(seq 1 130); do
  out=$(curl -s "$API/v1/scans/$id" "${auth[@]}")
  status=$(printf '%s' "$out" | python3 -c 'import json,sys; print(json.load(sys.stdin)["status"])')
  [ "$status" = "running" ] || break
  sleep 2
done

printf '%s' "$out" | python3 -c '
import json, sys
d = json.load(sys.stdin)
if d["status"] == "failed":
    print("  failed: " + (d.get("error") or "no reason recorded"))
    sys.exit(1)
if d["status"] == "running":
    print("  still running after the poll budget — check /v1/scans/" + d["id"])
    sys.exit(1)
line = "  ok: %d critical, %d high, %d medium, %d fixable" % (
    d["critical"], d["high"], d["medium"], d["fixable"])
if d.get("osEosl"):
    line += "  (unsupported OS — advisories for it have stopped, so this is not a clean bill)"
print(line)
'
