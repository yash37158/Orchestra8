#!/usr/bin/env bash
# Ingest-gateway self-validation.
#
# Everything here is an attack that must fail, plus the one legitimate write
# that must succeed. The payload is a REAL OTLP batch captured off the wire
# from a k3s cluster — gzipped protobuf, exactly as an unmodified exporter
# sends it. Hand-built bytes would only prove the encoder and decoder share
# assumptions.
#
# Run against a live stack: make up, then make verify-ingest.
set -uo pipefail

GATEWAY=${ORCHESTR8_INGEST:-http://localhost:4319}
COLLECTOR=${ORCHESTR8_COLLECTOR_OTLP:-http://localhost:4318}
BATCH=${BATCH:-services/api/testdata/otlp_metrics.bin}
PSQL=${PSQL:-psql -d orchestr8}

pass=0; fail=0

# The fixture declares this owner. A token for anything else must be refused.
FIXTURE_ORG=local
FIXTURE_CLUSTER=colima-k3s

post() {  # post <url> <token> [content-type] [encoding]
  local url=$1 tok=$2 ct=${3:-application/x-protobuf} enc=${4:-gzip}
  local args=(-s -o /dev/null -w '%{http_code}' --max-time 15 -X POST "$url/v1/metrics"
              -H "Content-Type: $ct" --data-binary "@$BATCH")
  [ -n "$tok" ] && args+=(-H "Authorization: Bearer $tok")
  [ -n "$enc" ] && args+=(-H "Content-Encoding: $enc")
  curl "${args[@]}" 2>/dev/null
}

check() {  # check <name> <expected> <actual>
  if [ "$3" = "$2" ]; then printf '  PASS  %-46s %s\n' "$1" "$3"; pass=$((pass+1))
  else printf '  FAIL  %-46s got %s, want %s\n' "$1" "$3" "$2"; fail=$((fail+1)); fi
}

# A token that is valid for this batch's declared owner, so the legitimate
# path is tested with the same bytes as every attack.
token_for() {  # token_for <org> <cluster> -> prints a fresh token
  local org=$1 cluster=$2 tok hash
  tok="orch8_$(python3 -c 'import secrets;print(secrets.token_hex(24))')"
  hash=$(printf '%s' "$tok" | shasum -a 256 | cut -d' ' -f1)
  $PSQL -q -c "INSERT INTO ingest_tokens (org_id, cluster_id, token_hash, prefix, name)
    SELECT o.id, c.id, decode('$hash','hex'), '${tok:0:14}', 'verify-ingest'
    FROM organizations o JOIN clusters c ON c.org_id=o.id
    WHERE o.slug='$org' AND c.cluster_key='$cluster'" >/dev/null 2>&1
  echo "$tok"
}
cleanup() { $PSQL -q -c "DELETE FROM ingest_tokens WHERE name='verify-ingest'" >/dev/null 2>&1; }
trap cleanup EXIT

[ -r "$BATCH" ] || { echo "missing fixture: $BATCH"; exit 1; }

echo "ingest gateway: $GATEWAY"
echo "batch declares: org=$FIXTURE_ORG cluster=$FIXTURE_CLUSTER"
echo

GOOD=$(token_for "$FIXTURE_ORG" "$FIXTURE_CLUSTER")
OTHER_ORG=$(token_for acme prod)
SAME_ORG_OTHER_CLUSTER=$(token_for "$FIXTURE_ORG" gcp-usc1)

echo "credentials"
check "no token"                       401 "$(post "$GATEWAY" '')"
check "malformed token"                401 "$(post "$GATEWAY" 'not-a-token')"
check "well-formed but unissued token" 401 "$(post "$GATEWAY" "orch8_$(python3 -c 'import secrets;print(secrets.token_hex(24))')")"
check "valid token"                    200 "$(post "$GATEWAY" "$GOOD")"

echo
echo "tenancy — a valid token must not reach another tenant's data"
check "token from another org"         403 "$(post "$GATEWAY" "$OTHER_ORG")"
check "token from another cluster"     403 "$(post "$GATEWAY" "$SAME_ORG_OTHER_CLUSTER")"

echo
echo "revocation"
$PSQL -q -c "UPDATE ingest_tokens SET revoked_at=now() WHERE name='verify-ingest' AND prefix='${GOOD:0:14}'" >/dev/null 2>&1
check "revoked token stops working"    401 "$(post "$GATEWAY" "$GOOD")"
$PSQL -q -c "UPDATE ingest_tokens SET revoked_at=NULL WHERE name='verify-ingest' AND prefix='${GOOD:0:14}'" >/dev/null 2>&1
check "un-revoking restores it"        200 "$(post "$GATEWAY" "$GOOD")"

echo
echo "payloads the gateway cannot vouch for"
check "json (uninspectable)"           415 "$(post "$GATEWAY" "$GOOD" application/json '')"
check "not a protobuf"                 400 "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$GATEWAY/v1/metrics" \
                                            -H "Authorization: Bearer $GOOD" -H 'Content-Type: application/x-protobuf' \
                                            --data-binary 'definitely not protobuf' 2>/dev/null)"

echo
echo "bypass — nothing may write to the collector directly"
check "collector refuses anonymous writes" 401 "$(post "$COLLECTOR" '')"
check "collector refuses a customer token" 401 "$(post "$COLLECTOR" "$GOOD")"

echo
printf '  %d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
