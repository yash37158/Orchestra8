#!/usr/bin/env bash
# Invitation self-validation.
#
# An invitation is a credential that creates access to a tenant's data, so the
# things worth asserting are who may issue one and everything the accept path
# refuses. Sessions are seeded directly, the same way verify-auth does: the
# credential path is not what is under test here.
set -uo pipefail

API=${ORCHESTR8_API:-http://localhost:8088}
PSQL=${PSQL:-psql -d orchestr8}
ORG=${ORG:-local}

pass=0; fail=0
check() {
  if [ "$3" = "$2" ]; then printf '  PASS  %-46s %s\n' "$1" "$3"; pass=$((pass+1))
  else printf '  FAIL  %-46s got %s, want %s\n' "$1" "$3" "$2"; fail=$((fail+1)); fi
}
post() {  # post <path> <session> <json>
  local args=(-s -o /tmp/vi -w '%{http_code}' --max-time 15 -X POST "$API$1" -H 'content-type: application/json')
  [ -n "$2" ] && args+=(-H "Cookie: authjs.session-token=$2")
  [ -n "${3:-}" ] && args+=(-d "$3")
  curl "${args[@]}"
}

TAG=verify-invites
cleanup() {
  $PSQL -q -c "DELETE FROM invitations WHERE email LIKE '%@$TAG.test'" >/dev/null 2>&1
  $PSQL -q -c "DELETE FROM sessions WHERE \"sessionToken\" LIKE 'vi-%'" >/dev/null 2>&1
  $PSQL -q -c "DELETE FROM memberships WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@$TAG.test')" >/dev/null 2>&1
  $PSQL -q -c "DELETE FROM users WHERE email LIKE '%@$TAG.test'" >/dev/null 2>&1
  $PSQL -q -c "DELETE FROM organizations WHERE slug = 'vi-rival'" >/dev/null 2>&1
}
trap cleanup EXIT
cleanup

# An owner to invite from, an operator to be refused, and a newcomer to accept.
$PSQL -q <<SQL >/dev/null 2>&1
INSERT INTO users (id,name,email) VALUES
  ('cccccccc-0000-0000-0000-000000000001','VI Owner','owner@$TAG.test'),
  ('cccccccc-0000-0000-0000-000000000002','VI Operator','operator@$TAG.test'),
  ('cccccccc-0000-0000-0000-000000000003','VI Newcomer','newcomer@$TAG.test'),
  ('cccccccc-0000-0000-0000-000000000004','VI Stranger','stranger@$TAG.test')
ON CONFLICT (email) DO NOTHING;
INSERT INTO memberships (org_id,user_id,role)
  SELECT id,'cccccccc-0000-0000-0000-000000000001','owner'    FROM organizations WHERE slug='$ORG' ON CONFLICT DO NOTHING;
INSERT INTO memberships (org_id,user_id,role)
  SELECT id,'cccccccc-0000-0000-0000-000000000002','operator' FROM organizations WHERE slug='$ORG' ON CONFLICT DO NOTHING;
INSERT INTO sessions ("sessionToken","userId",expires) VALUES
  ('vi-owner','cccccccc-0000-0000-0000-000000000001', now()+interval '1 hour'),
  ('vi-operator','cccccccc-0000-0000-0000-000000000002', now()+interval '1 hour'),
  ('vi-newcomer','cccccccc-0000-0000-0000-000000000003', now()+interval '1 hour'),
  ('vi-stranger','cccccccc-0000-0000-0000-000000000004', now()+interval '1 hour');
SQL

echo "api: $API   org: $ORG"
echo
echo "who may issue one"
check "no session"                 401 "$(post /v1/invitations '' '{"email":"a@'$TAG'.test","role":"viewer"}')"
check "an operator may not"        403 "$(post /v1/invitations vi-operator '{"email":"a@'$TAG'.test","role":"viewer"}')"
check "nobody may grant owner"     403 "$(post /v1/invitations vi-owner '{"email":"a@'$TAG'.test","role":"owner"}')"
check "a role that does not exist" 403 "$(post /v1/invitations vi-owner '{"email":"a@'$TAG'.test","role":"superuser"}')"
check "not an email address"       400 "$(post /v1/invitations vi-owner '{"email":"nope","role":"viewer"}')"
check "an owner may"               200 "$(post /v1/invitations vi-owner '{"email":"newcomer@'$TAG'.test","role":"operator"}')"
TOKEN=$(python3 -c "import json;print(json.load(open('/tmp/vi'))['link'].split('/invite/')[-1])" 2>/dev/null)

echo
echo "what the link reveals before anyone signs in"
check "preview needs no session"   200 "$(curl -s -o /tmp/vi -w '%{http_code}' "$API/v1/invite/$TOKEN")"
# Four fields and no more. Anyone who ends up holding the link sees this, so
# it must not grow to include the organisation's size, members or fleet.
check "and reveals nothing else"   4 "$(python3 -c 'import json,sys; print(len(json.load(sys.stdin)))' < /tmp/vi 2>/dev/null)"
check "an invented token"          404 "$(curl -s -o /dev/null -w '%{http_code}' "$API/v1/invite/inv_nothing")"

echo
echo "who may spend it"
check "nobody signed in"           401 "$(post /v1/invite-accept '' "{\"token\":\"$TOKEN\"}")"
check "a forwarded link, wrong account" 403 "$(post /v1/invite-accept vi-stranger "{\"token\":\"$TOKEN\"}")"
check "the person it names"        200 "$(post /v1/invite-accept vi-newcomer "{\"token\":\"$TOKEN\"}")"
check "the same link twice"        404 "$(post /v1/invite-accept vi-newcomer "{\"token\":\"$TOKEN\"}")"
check "and they are now a member"  operator "$($PSQL -tAc "SELECT m.role FROM memberships m JOIN users u ON u.id=m.user_id WHERE u.email='newcomer@$TAG.test'" | tr -d ' ')"

echo
echo "one tenant cannot touch another's"
$PSQL -q -c "INSERT INTO organizations (slug,name) VALUES ('vi-rival','Rival') ON CONFLICT DO NOTHING" >/dev/null 2>&1
RIVAL=$($PSQL -tAc "INSERT INTO invitations (org_id,email,role,token_hash,prefix,expires_at)
  SELECT id,'spy@$TAG.test','admin',decode(md5(random()::text)||md5(random()::text),'hex'),'inv_zzzzzz',now()+interval '1 day'
  FROM organizations WHERE slug='vi-rival' RETURNING id" 2>/dev/null | head -1 | tr -d ' ')
check "revoking another org's invite"   404 "$(post "/v1/invitations/$RIVAL/revoke" vi-owner '')"
check "and it is still live"            t   "$($PSQL -tAc "SELECT revoked_at IS NULL FROM invitations WHERE email='spy@$TAG.test'" | tr -d ' ')"
check "a malformed id is not a 500"     404 "$(post "/v1/invitations/not-a-uuid/revoke" vi-owner '')"
check "sql injection in the token"      404 "$(curl -s -o /dev/null -w '%{http_code}' "$API/v1/invite/inv_%27%3BDROP%20TABLE%20invitations%3B--")"
check "the table survived"              t   "$($PSQL -tAc "SELECT count(*) >= 0 FROM invitations" | tr -d ' ')"

echo
printf '  %d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
