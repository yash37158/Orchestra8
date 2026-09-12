#!/usr/bin/env bash
# Correlation-engine self-validation (F-25).
#
# Injects a fault whose cause is known, waits for the engine to reach a verdict,
# and asserts the verdict matches. This is the only check that proves the
# product does what it claims end to end — everything else tests a component.
set -uo pipefail

API=${ORCHESTR8_API:-http://localhost:8088}
DEVKIT=${ORCHESTR8_DEVKIT:-http://localhost:9400}
# Which cluster the local devkit feeds. Required once a second cluster is
# connected: two clusters serve the same model name, and reading "the first
# llama service" silently checks the wrong one.
CLUSTER=${ORCHESTR8_CLUSTER:-gcp-usc1}
MODEL=${ORCHESTR8_MODEL:-llama-3.3-70b-instruct}
# How long to wait after injecting before reading the verdict.
#
# Must cover the SLOWEST fault's full path: thermal ramps ~95s (66C -> 92C at
# 1.4C per 5s tick), then the 3-minute detection window has to fill, and that
# window is itself shifted back 60s to let ingest settle. 200s was enough for
# traffic-surge (which ramps in 40s) and silently too short for thermal — the
# service simply was not breaching yet, and the script read "none" as a failure
# of the engine rather than of its own patience.
SETTLE=${SETTLE:-340}
COOL=${COOL:-200}

pass=0; fail=0

verdict_for() {
  curl -s "$API/v1/debug/signals" 2>/dev/null | CLUSTER="$CLUSTER" MODEL="$MODEL" python3 -c "
import json,os,sys
try: rows=json.load(sys.stdin)
except Exception: print('api-unreachable'); raise SystemExit
want_c, want_m = os.environ['CLUSTER'], os.environ['MODEL']
for v in rows:
    if v.get('clusterId')==want_c and v.get('model')==want_m:
        print(v.get('verdict','none')); raise SystemExit
print('no-service')"
}

check() {
  scenario=$1; expected=$2
  printf '  %-18s expecting %-22s ' "$scenario" "$expected"
  curl -s "$DEVKIT/scenario?set=healthy" >/dev/null 2>&1
  sleep "$COOL"
  curl -s "$DEVKIT/scenario?set=$scenario" >/dev/null 2>&1
  sleep "$SETTLE"
  got=$(verdict_for)
  if [ "$got" = "$expected" ]; then
    echo "PASS"; pass=$((pass+1))
  else
    echo "FAIL (got '$got')"; fail=$((fail+1))
  fi
}

echo "Correlation engine self-validation"
echo "  target: $MODEL on $CLUSTER"
echo "  each case: cool to healthy, inject, wait, read the verdict"
echo
if [ $# -ge 2 ]; then
  while [ $# -ge 2 ]; do check "$1" "$2"; shift 2; done
else
  # The pair that matters: both breach the SLO, only one is the GPU's fault.
  check thermal-throttle gpu_thermal_throttle
  check traffic-surge    traffic_surge
fi
curl -s "$DEVKIT/scenario?set=healthy" >/dev/null 2>&1
echo
echo "  $pass passed, $fail failed"
[ "$fail" -eq 0 ]
