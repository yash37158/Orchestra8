# Orchestr8 local development.
#
# Full pipeline, in dependency order:
#   make store      clickhouse           :8123 / :9000
#   make devkit     GPU fleet simulator  :9400   (stands in for DCGM + vLLM)
#   make collector  otel collector       :13133
#   make api        query API            :8088
#   make web        next.js UI           :3000
#
# `make check` runs everything that can fail.

CH_DATA := .localdev/clickhouse
OTELCOL := .localdev/bin/otelcol-contrib
SECRET  := .localdev/collector.secret
LOGS    := .localdev/logs

.PHONY: up down status logs store schema devkit collector api web \
        check contract test fault surge healthy scenarios scan audit hook alerts verify-engine verify-ingest control-plane tenancy clean-store

# ---------------------------------------------------------------- one command
# The individual targets below run in the FOREGROUND, which is what you want
# when debugging one service. `make up` runs the whole stack in the background
# so a normal day needs one terminal, not five.

up:                          ## start the whole stack in the background
	@mkdir -p $(LOGS) $(CH_DATA)
	@echo "starting stack..."
	@# The gateway->collector hop. Generated once, never committed: it is the
	@# only reason the collector's OTLP port cannot be written to directly.
	@[ -s $(SECRET) ] || (openssl rand -hex 32 > $(SECRET) && chmod 600 $(SECRET))
	@lsof -ti:8123  >/dev/null 2>&1 || (cd $(CH_DATA) && nohup clickhouse server > ../../$(LOGS)/clickhouse.log 2>&1 </dev/null &)
	@for i in $$(seq 1 60); do lsof -ti:8123 >/dev/null 2>&1 && break; sleep 0.5; done; \
		lsof -ti:8123 >/dev/null 2>&1 || echo "  !! clickhouse failed - see $(LOGS)/clickhouse.log"
	@clickhouse client --multiquery < services/api/schema.sql 2>/dev/null || true
	@lsof -ti:9400  >/dev/null 2>&1 || (cd services/devkit && nohup go run . -addr :9400 -interval 5s > ../../$(LOGS)/devkit.log 2>&1 </dev/null &)
	@for i in $$(seq 1 60); do lsof -ti:9400 >/dev/null 2>&1 && break; sleep 0.5; done; \
		lsof -ti:9400 >/dev/null 2>&1 || echo "  !! devkit failed - see $(LOGS)/devkit.log"
	@lsof -ti:13133 >/dev/null 2>&1 || (nohup $(OTELCOL) --config services/collector/otel-collector.local.yaml > $(LOGS)/collector.log 2>&1 </dev/null &)
	@for i in $$(seq 1 60); do lsof -ti:13133 >/dev/null 2>&1 && break; sleep 0.5; done; \
		lsof -ti:13133 >/dev/null 2>&1 || echo "  !! collector failed - see $(LOGS)/collector.log"
	@lsof -ti:8088  >/dev/null 2>&1 || (cd services/api && nohup go run . > ../../$(LOGS)/api.log 2>&1 </dev/null &)
	@for i in $$(seq 1 60); do lsof -ti:8088 >/dev/null 2>&1 && break; sleep 0.5; done; \
		lsof -ti:8088 >/dev/null 2>&1 || echo "  !! api failed - see $(LOGS)/api.log"
	@lsof -ti:3000  >/dev/null 2>&1 || (cd apps/web && nohup npm run dev > ../../$(LOGS)/web.log 2>&1 </dev/null &)
	@for i in $$(seq 1 60); do lsof -ti:3000 >/dev/null 2>&1 && break; sleep 0.5; done; \
		lsof -ti:3000 >/dev/null 2>&1 || echo "  !! web failed - see $(LOGS)/web.log"
	@echo ""
	@$(MAKE) --no-print-directory status
	@echo ""
	@echo "  open http://localhost:3000/dashboard"

down:                        ## stop everything started by `make up`
	@for p in 3000 8088 13133 9400 8123; do \
		pid=$$(lsof -ti:$$p 2>/dev/null); \
		if [ -n "$$pid" ]; then kill $$pid 2>/dev/null && echo "  stopped :$$p"; fi; \
	done

status:                      ## what is running
	@for pair in "8123 clickhouse" "9400 devkit" "13133 collector" "8088 api" "4319 ingest" "3000 web"; do \
		port=$${pair%% *}; name=$${pair#* }; \
		if lsof -ti:$$port >/dev/null 2>&1; then echo "  UP    $$name  :$$port"; \
		else echo "  down  $$name  :$$port"; fi; \
	done

logs:                        ## tail every background service
	@tail -f $(LOGS)/*.log


store:                       ## start clickhouse (data in .localdev, gitignored)
	@mkdir -p $(CH_DATA)
	cd $(CH_DATA) && clickhouse server

schema:                      ## apply rollup DDL (idempotent)
	clickhouse client --multiquery < services/api/schema.sql

control-plane:               ## create the Postgres control plane (orgs, users, tokens)
	@createdb -h 127.0.0.1 orchestr8 2>/dev/null || true
	@psql -h 127.0.0.1 -d orchestr8 -v ON_ERROR_STOP=1 -q -f services/control/migrations/001_control_plane.sql
	@psql -h 127.0.0.1 -d orchestr8 -tAc "SELECT '  '||tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"

tenancy:                     ## show who owns what
	@echo "  control plane (postgres):"
	@psql -h 127.0.0.1 -d orchestr8 -tAc "SELECT '    '||o.slug||' / '||c.cluster_key||'  team='||coalesce(c.team,'-') \
		FROM clusters c JOIN organizations o ON o.id=c.org_id ORDER BY o.slug, c.cluster_key" 2>/dev/null || echo "    (not initialised - run: make control-plane)"
	@echo "  telemetry (clickhouse):"
	@clickhouse client --query "SELECT concat('    ', OrgId, ' / ', ClusterId, '  ', toString(uniq(GpuUuid)), ' GPU(s)') \
		FROM orchestr8.gpu_minute WHERE Minute >= now() - INTERVAL 10 MINUTE GROUP BY OrgId, ClusterId ORDER BY OrgId, ClusterId" 2>/dev/null

devkit:                      ## GPU fleet simulator on :9400
	cd services/devkit && go run . -addr :9400 -interval 5s

collector:                   ## scrape devkit -> clickhouse
	@[ -s $(SECRET) ] || (openssl rand -hex 32 > $(SECRET) && chmod 600 $(SECRET))
	$(OTELCOL) --config services/collector/otel-collector.local.yaml

api:                         ## query API on :8088
	cd services/api && go run .

web:                         ## Next.js UI
	cd apps/web && npm run dev

# Drive the simulated fleet into a fault. This is how the correlation engine
# gets developed without hardware, and later how it gets proven (F-25).
fault:                       ## GPU overheats: slow AND throttling
	@curl -s 'localhost:9400/scenario?set=thermal-throttle' >/dev/null && \
		echo "thermal-throttle injected - wait ~60s, the GPU heats up gradually"

surge:                       ## the decoy: slow with NO throttling
	@curl -s 'localhost:9400/scenario?set=traffic-surge' >/dev/null && \
		echo "traffic-surge injected - SLO goes red, GPU stays healthy"

healthy:                     ## back to baseline
	@curl -s 'localhost:9400/scenario?set=healthy' >/dev/null && echo "fleet healthy - wait ~60s to cool down"

scenarios:                   ## list faults and show the active one
	@curl -s localhost:9400/scenario | python3 -m json.tool

# -count=1 matters: fixtures live outside the Go package, so a cached result
# will happily pass over real contract drift.
contract:                    ## cross-language contract check
	cd packages/contracts && npm run verify
	cd services/api && go test -count=1 ./...

check: contract              ## everything that can fail
	cd services/devkit && go test -count=1 ./...
	cd services/api && go vet ./...
	cd services/devkit && go vet ./...

test: check

scan:                        ## scan this repo's dependencies with trivy
	@curl -s -X POST localhost:8088/v1/scans -H 'Content-Type: application/json' \
		-d '{"target":"../../package-lock.json","kind":"filesystem"}' \
		| python3 -c 'import json,sys;d=json.load(sys.stdin);print(f"  {d[\"id\"]}: {d[\"critical\"]} critical, {d[\"high\"]} high, {d[\"fixable\"]} fixable")'

hook:                        ## run a local webhook receiver to watch alerts land
	@echo "  listening on :9999 — alerts append to /tmp/hook-received.jsonl"
	@python3 .localdev/hook-receiver.py

alerts:                      ## show alerts delivered so far
	@test -s /tmp/hook-received.jsonl && python3 -c 'import json,sys;\
[print(f"  {d[\"event\"]:<22} {d[\"severity\"]:<9} {d[\"cause\"]}\n    {d[\"link\"]}") \
for d in map(json.loads, open("/tmp/hook-received.jsonl"))]' || echo "  no alerts delivered yet"

verify-ingest:               ## prove the gateway: every attack fails, the one legitimate write lands
	@bash scripts/verify-ingest.sh

verify-engine:               ## prove the engine: inject known faults, assert the verdicts
	@scripts/verify-engine.sh

audit:                       ## verify the audit chain
	@curl -s localhost:8088/v1/audit/verify | python3 -m json.tool

clean-store:                 ## wipe local telemetry
	clickhouse client --query "DROP DATABASE IF EXISTS orchestr8"
