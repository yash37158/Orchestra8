# Orchestr8 — Product Requirements Document

| | |
|---|---|
| **Product** | Orchestr8 — AI-workload observability for Kubernetes |
| **Version** | 0.1 (draft) |
| **Date** | 12 September 2026 |
| **Status** | Phase 0 shipped · Phases 1–4 specified below |
| **Companion** | [`docs/correlation-gap.html`](docs/correlation-gap.html) — market & architecture research |

---

## 1. Problem

Two industries sell "AI observability" and neither answers the question that matters.

**Infrastructure APM** (Datadog, Dynatrace, Grafana) sees nodes, pods and GPUs. It reports a GPU at 99% utilization as healthy. **LLM observability** (Langfuse, LangSmith, Arize, Helicone) sees prompts, tokens and latency. It reports slow inference with no cause, because it has no idea what hardware served the request.

The most common production failure in AI serving sits exactly between them: a GPU pinned at 99% *while thermally throttling*, queue depth climbing, p95 time-to-first-token breaching SLO. Utilization looks perfect. The service is failing.

> On-call engineers jump between five dashboards to correlate a single incident.
> — SRE tooling research, 2026

**Orchestr8's job is to collapse those five dashboards into one sentence**, with the evidence attached:

> *"p95 TTFT on llama-3.3-70b breached its 1200ms SLO because GPU-0a1b2c3d on gpu-a-04 is thermally throttling at 88°C — not because traffic rose. Request rate is flat over the window."*

Everything else in this document is table stakes that incumbents already ship. The correlation is the product.

### 1.1 Why now

- **66%** of organisations running GenAI inference use Kubernetes (CNCF Annual Survey 2026) — the substrate is settled.
- **OpenTelemetry GenAI semantic conventions** (semconv v1.40.0, Feb 2026) give token and latency telemetry a vendor-neutral shape for the first time.
- LLM observability is a **$2.69B market in 2026 heading to $9.26B by 2030** (36.2% CAGR), and every funded player is blind below the API call.

### 1.2 Non-goals

| Not building | Why |
|---|---|
| A general-purpose APM | Datadog wins on breadth. We win on one question. |
| A prompt-engineering / eval workbench | Braintrust and LangSmith own this. Different buyer (AI eng, not platform). |
| A GPU scheduler or orchestrator | Run:ai, Volcano, KAI already do it. We observe, we don't place workloads. |
| A log aggregator | Logs are context for a correlation, never the headline product. |
| Direct cluster mutation | Every action Orchestr8 takes goes through GitOps (§6.1). Non-negotiable. |

---

## 2. Users

### 2.1 Primary — "Priya", Platform Engineer

Runs a 15-cluster fleet with GPU nodes serving three internal models. On-call rotation. Owns the inference SLO but does not own the models.

**Jobs to be done**
- When TTFT breaches, tell me *within 90 seconds* whether it's my hardware or their model.
- Stop me from being paged for the same thermal issue three nights running.
- Show me which team's GPU-hours are costing what, so chargeback conversations use data.

**Pain today:** Grafana for GPU, Langfuse for tokens, kubectl for pods, Slack for context. Nothing joins them.

### 2.2 Secondary — "Sam", AI/ML Engineer

Ships and tunes the models. Does not have cluster access and does not want it.

**Jobs to be done**
- Is my model slow, or is the cluster slow? Give me the answer without filing a ticket.
- What did my v2.3.1 prompt-template change do to KV-cache pressure and cost?

### 2.3 Tertiary — "Dana", Engineering Manager / Compliance

Never opens the product during an incident. Opens it monthly.

**Jobs to be done**
- Prove to audit who approved which production deployment, when.
- Show spend trend per model per team.

---

## 3. Entry points

An observability product is almost never opened at the front door. Design for the deep link first.

| # | Entry | Trigger | Lands on | User's state |
|---|---|---|---|---|
| **E1** | **Alert deep link** | PagerDuty / Slack / Teams notification | `/correlations/{id}` | Stressed, 3am, needs an answer in seconds |
| **E2** | Daily check | Bookmark, start of shift | `/dashboard` | Calm, scanning for anything new |
| **E3** | CI status check | PR check fails on scan | `/security/scans/{id}` | Blocked, wants the specific CVE |
| **E4** | Teammate share | Pasted URL in incident channel | Any resource URL | Joining mid-incident, no context |
| **E5** | Cold acquisition | Marketing site → signup | `/onboarding` | Evaluating, will leave in 10 minutes |
| **E6** | Scheduled report | Monthly email | `/reports/{id}` | Compliance or budget review |

**E1 is the highest-value entry and the one to build first.** It must render the full correlation — symptom, cause, evidence, recommended action — with zero clicks and no further navigation required.

### 3.1 Entry-point requirements

- **Every resource has a stable, shareable URL.** No state lives only in component memory. Tab selections, filters and time ranges are URL query params so a pasted link reproduces exactly what the sender saw.
- **Deep links survive auth.** An unauthenticated hit on `/correlations/abc` goes to login and returns to `/correlations/abc`, not to the dashboard.
- **Time ranges pin on share.** A link shared at 14:12 shows the 14:12 window forever, not "last 15 minutes" relative to the reader's clock. This is the single most common way incident links become useless.

### 3.2 Current state

> **Bug (blocking E2):** the sidebar's "Dashboard" item links to `/`, which is the marketing landing page, not `/dashboard`. See [`apps/web/components/main-sidebar.tsx:16`](apps/web/components/main-sidebar.tsx). Clicking it from any inner page ejects the user from the app.
>
> **Gap (blocking E1, E3, E4):** no resource-level routes exist. Correlations, scans and nodes are component state, not addressable pages.

---

## 4. Exit points

**For an incident tool, time-in-app is a cost, not engagement.** A dashboard product optimises for dwell time. Orchestr8 optimises for getting Priya out of the building with an answer. Every exit below is instrumented, and §10 measures them.

| # | Exit | Meaning | Product must provide |
|---|---|---|---|
| **X1** | **Resolved** | Root cause understood, no action needed in-app | One-click acknowledge, with the reason recorded |
| **X2** | **Delegated to GitOps** | Fix is a config change | "Open PR" that leaves with a real diff |
| **X3** | **Escalated / shared** | Needs another human | Copy-link and Slack share carrying the pinned window |
| **X4** | **Exported** | Evidence leaves for audit or a ticket | PDF / CSV / JSON with the evidence chain intact |
| **X5** | **Automated away** | Correlation converted to a standing rule | "Never page me for this again" → suppression rule |

### 4.1 Failure exits — design these explicitly

| # | Failure exit | Today | Required |
|---|---|---|---|
| **F1** | No data yet (new install) | — | Empty state that says *which* collector isn't reporting and links the install command |
| **F2** | Backend unreachable | ✅ handled — [`app/dashboard/page.tsx`](apps/web/app/dashboard/page.tsx) renders an explicit error | Extend to every page |
| **F3** | Stale data | — | Banner: "Last telemetry 14 min ago" — silently showing old numbers is the worst failure mode |
| **F4** | Empty result | — | "No correlations" must be distinguishable from "correlation engine is down" |
| **F5** | Permission denied | — | Name the missing permission and who can grant it |

> **Principle:** Orchestr8 never renders a plausible-looking number it cannot vouch for. The Phase 0 refactor deliberately removed the mock-data fallback for exactly this reason — when the API is down the dashboard says so rather than inventing figures.

---

## 5. Core UX flows

### 5.1 Flow A — Incident (the golden path)

**Target: alert → root cause in under 90 seconds.**

```
PagerDuty alert
  └─> /correlations/corr-1                          [0s]  deep link, no login friction
        ├── Symptom     p95 TTFT 1840ms vs 1200ms SLO
        ├── Cause       gpu_thermal_throttle · GPU-0a1b2c3d · gpu-a-04
        ├── Confidence  91%
        ├── Evidence    4 items, each a link to the underlying series
        └── Action      "Drain gpu-a-04, rebalance replica to gpu-a-05"
                                                    [~20s] Priya has the answer
        ├─> [Open PR]      ──> GitHub, drain patch          X2
        ├─> [Share]        ──> Slack, window pinned         X3
        ├─> [Acknowledge]  ──> out, reason recorded         X1
        └─> [Suppress]     ──> standing rule created        X5
```

**Requirements**
- The correlation renders server-side. No spinner, no client fetch waterfall.
- Every evidence line is clickable and opens the underlying time series **with the incident window pinned**.
- Confidence is always visible. A verdict without a confidence number is not shippable.
- If confidence < 0.6, the UI leads with "possible cause" phrasing and surfaces the two next-best hypotheses.

### 5.2 Flow B — Deploy (see §6.1 for the full spec)

```
Deploy App ──> Target & version ──> Preflight ──> Approval gate ──> Progressive rollout ──> Verify ──> Exit
                                       │                                    │
                                       └── blocked ──> Security tab         └── SLO breach ──> auto-rollback
```

### 5.3 Flow C — Security scan (see §6.2)

```
Run Security Scan ──> Scope ──> Running ──> Findings triaged by severity ──> Remediate / waive / PR ──> Exit
```

### 5.4 Flow D — Onboarding (first run)

Across 62 B2B SaaS companies average activation is **37.5%**, and **over 98% of users who never hit a value milestone churn within two weeks.** Onboarding is therefore a first-class feature, not a nicety.

**The value milestone for Orchestr8 is explicit: the user sees their own GPU's real temperature.** Not a tour, not a sample dashboard — their hardware, their number. Target: under 15 minutes from signup.

```
Signup
  └─> /onboarding
        1. Connect a cluster      helm install one-liner, copyable, pre-filled with the org token
        2. Waiting for telemetry  live checklist — collector ✓ / DCGM ✓ / inference engine ⋯
        3. First signal           "gpu-a-04 is at 71°C" ← activation moment
        4. Set one SLO            "p95 TTFT under ___ ms" — the number every later alert references
  └─> /dashboard, populated
```

- Step 2 must show **which specific component** hasn't reported, not a generic spinner. "No DCGM metrics from node gpu-a-04" is actionable; "Waiting…" is not.
- Onboarding is resumable and re-enterable from Settings. Users add clusters months later.
- Offer a **demo dataset** for evaluators with no GPU — clearly watermarked, never mixed with real data.

### 5.5 Flow E — Chaos (see §6.3)

```
Simulate Chaos ──> Hypothesis ──> Blast radius ──> Confirm ──> Run (live SLO view) ──> Auto-abort or complete ──> Report
```

---

## 6. Global actions

Three buttons live in the top nav on every page ([`apps/web/components/main-nav.tsx`](apps/web/components/main-nav.tsx)). They are the product's only write paths, and all three are currently theatre.

### 6.1 Deploy App

#### Current state

| Aspect | Today |
|---|---|
| Trigger | Blue "🚀 Deploy App" button → modal |
| Inputs | Environment (5 hardcoded), Version (5 hardcoded), Canary toggle, Auto-rollback checkbox |
| Execution | `await new Promise(r => setTimeout(r, 2000))` |
| Outcome | **`Math.random() > 0.3`** — succeeds 70% of the time, at random |
| Feedback | Toast with a Retry button |
| Tracking | None. The deployment does not exist after the toast fades. |

> **The `Math.random()` failure is the single most misleading line in the codebase.** It manufactures a failure the user cannot diagnose, cannot retry meaningfully, and which corresponds to nothing. It must be deleted in Phase 1, not "wired up later".

#### Target design

**Principle: Orchestr8 never writes to a cluster directly.** Deploy opens a pull request against the GitOps repo; Argo CD reconciles it. Every deployment is therefore reviewable, revertible and auditable by construction — and the audit trail is a git history, not a database table we have to defend to a compliance reviewer.

**Engine choice: Argo Rollouts** over Flagger. Flagger has no UI and promotes on metrics via a `confirm-promotion` webhook; Argo Rollouts assumes a human above it, and Argo CD ships health checks that understand `Rollout` objects and visualise each step of the ladder. Orchestr8 *is* the human-facing layer, so the tool that expects one is the right fit. Argo Rollouts v1.10.0 (Aug 2026) adds the `RolloutPlugin` CRD, extending progressive delivery to StatefulSets and DaemonSets — relevant because inference servers frequently run as StatefulSets for KV-cache affinity.

**Step 1 — Target**

| Field | Behaviour |
|---|---|
| Application | Typeahead over apps Argo CD actually knows. Never a hardcoded list. |
| Target cluster | Real clusters from the fleet. Shows current version, health, and **available GPU headroom**. |
| Version | Real tags from the registry, newest first, with build date and commit SHA. |
| Strategy | Rolling · Canary · Blue-Green. Defaults to whatever the app's `Rollout` spec already declares. |

**Step 2 — Preflight (new, and the differentiator)**

Runs before the gate and blocks on failure. This is where Deploy and Security Scan join up:

- **Image scan** — inherits the latest Trivy result for this exact digest. Unsigned or critical-CVE images block (§6.2).
- **Policy admission dry-run** — Kyverno/Gatekeeper evaluated ahead of time, so violations surface here rather than as a cryptic admission rejection.
- **Capacity check** — does the target have GPU memory for the new replica set alongside the old one during rollout? *A blue-green deploy of a 70B model needs 2× GPU memory; discovering that mid-rollout is an outage.*
- **SLO budget check** — is this service already burning error budget? Deploying into a live incident needs explicit override.
- **Diff** — the actual YAML change, rendered. No blind deploys.

**Step 3 — Approval gate**

Required for production targets; RBAC-configurable per environment. Regulated environments need audit-log evidence of *who approved which promotion at what time*, so the record captures approver identity, timestamp, the diff hash, and the preflight results as they stood at approval.

**Step 4 — Progressive rollout**

Live view of the canary ladder — 10% → 25% → 50% → 100% — with, at each step, the analysis metrics Argo Rollouts is evaluating. For inference workloads these are **TTFT p95, error rate, queue depth and KV-cache usage**, not just HTTP 5xx. A model rollout that doubles KV-cache pressure passes an HTTP health check and fails its users.

Manual approval pauses on high-risk transitions (50% → 100%) so automation doesn't promote a change that passed metrics but has other implications.

**Step 5 — Verify and exit**

- Auto-rollback on analysis failure, with **the reason** — which metric, which threshold, which step.
- Deployment gets a permanent URL: `/deployments/{id}`, linked from Audit Ledger.
- Post-deploy watch window (default 30 min) during which any new correlation is automatically tagged with this deployment as a candidate cause.

#### Acceptance criteria

- [ ] `Math.random()` deleted; every failure traces to a real cause with a real message
- [ ] No hardcoded environment or version lists — both come from the API
- [ ] Cancelling at any step leaves zero side effects
- [ ] A deploy is fully reconstructible from `/deployments/{id}` a year later
- [ ] Preflight failure explains *which* check failed and links to the fix
- [ ] Rollback is reachable in one click from the deployment page

---

### 6.2 Run Security Scan

#### Current state

| Aspect | Today |
|---|---|
| Trigger | Purple "🛡️ Run Security Scan" → dropdown |
| Scopes | Quick Scan (*Trivy CVEs only*) · Deep Scan (*+ OPA, Falco*) · **Custom Scope… (no handler)** |
| Execution | Progress bar `+5%` per 300ms; results appear on a 5s `setTimeout` |
| Results | Sheet, 3 tabs: Vulnerabilities / Policy Violations / Runtime Threats |
| Data | Hardcoded `CVE-2023-1234`, `CVE-2023-5678` … with 2023 timestamps |
| Footer | **Export Report (no handler)** · **Auto-Remediate (no handler)** |

The tool names are the right instinct — Trivy, OPA and Falco are the correct choices — but nothing is wired.

#### Target design

**Scanner: Trivy as primary.** One binary covers vulnerabilities, secrets, misconfiguration, IaC and Kubernetes manifests, and generates SBOMs. **Grype as an optional second opinion** on externally-facing images: roughly 30–40% faster on image-only scans with a reputation for fewer false positives, and SBOM-first, which enables the key capability below.

**Store the SBOM, not just the verdict.** When a new CVE drops, a stored SBOM can be re-matched against the updated vulnerability database **without rebuilding or re-pulling the image**. That turns "are we exposed to the new Log4Shell?" from a multi-hour rebuild into a database query. This is the highest-leverage feature in the whole security surface and it is cheap.

**Policy engine: Kyverno.** Policies are plain YAML with no Rego to learn, and it verifies image signatures and attestations natively — no stitching together Cosign, Notary and a separate admission webhook. OPA/Gatekeeper stays supported for teams already invested in Rego, since the existing UI already shows OPA/Gatekeeper policies ([`components/security/policy-table.tsx`](apps/web/components/security/policy-table.tsx)).

**Runtime: Falco**, streamed as events rather than polled by a scan. "Runtime threats" is not a scan result — it is a live feed that the scan view snapshots.

**Three real scopes, replacing the dropdown**

| Scope | Runs | Duration | When |
|---|---|---|---|
| **Image** | Trivy against one digest | seconds | Pre-deploy preflight, PR check |
| **Cluster** | Trivy K8s + Kyverno audit across live workloads | minutes | Scheduled nightly, or on demand |
| **Custom** | User-selected namespaces / clusters / severity floor | varies | Replaces the dead "Custom Scope…" item |

**Results — designed for triage, not for counting**

The current three-tab split by *source* is wrong; it makes the user check three places to find what matters. Sort by **severity × exploitability × reachability** instead:

- **Reachability matters more than CVSS.** A critical CVE in a package the code never calls is noise; a medium in a request-path dependency is not. Trivy's reachability data is what makes a findings list survivable.
- Group by **fix availability** — "12 findings, 9 have a patched version" is the actionable framing.
- Show **first-seen** and **age**. A critical open for 40 days is a different conversation from one that landed this morning.

**Wire the dead footer buttons**

- **Export Report** → SBOM (CycloneDX/SPDX), CSV, or signed PDF for audit. This is exit X4 and compliance genuinely needs it.
- **Auto-Remediate** → generates a **GitOps PR** bumping the base image or adding the policy exception. Never a direct cluster write. Shows the diff before opening. If no automatic fix exists, the button is disabled with the reason, not silently inert.
- **Waive** (new) → suppress a finding with a mandatory reason and expiry date. Permanent silent waivers are how vulnerability programmes rot.

#### Acceptance criteria

- [ ] Zero hardcoded CVEs; all findings come from a real scanner run
- [ ] Every finding links to its upstream advisory and names the fixed version
- [ ] Scan results are addressable at `/security/scans/{id}` and shareable
- [ ] SBOM persisted per image digest and re-matchable against new CVE data
- [ ] Export produces a file that opens correctly in Excel and in an SBOM tool
- [ ] Auto-Remediate opens a real PR, or is disabled with a stated reason
- [ ] Failed scans report *why* (registry auth, timeout, unreachable node) — never a silent empty list

---

### 6.3 Simulate Chaos

#### Current state

```tsx
<Button variant="ghost" size="sm">
  Simulate Chaos
</Button>
```

No `onClick`. No handler. The button is decoration. A second "Inject Chaos" button exists on cluster cards ([`components/clusters/cluster-health-cards.tsx:167`](apps/web/components/clusters/cluster-health-cards.tsx)) and is equally inert.

#### Target design

**This feature is strategically more valuable than it looks.** Chaos is how Orchestr8 *proves its own correlation engine works* — inject a known fault, verify the correlation engine names it correctly. That is a demo no competitor can run, and for a final-year project it is the strongest possible viva demonstration: cause a failure on purpose, watch the product explain it unprompted.

**Engine: Chaos Mesh.** Daemon-based with roughly 20–30% lower resource consumption than Litmus's per-experiment pods, the richest granular fault set (pod, network, IO, stress, time, kernel, DNS, HTTP), and a clean built-in dashboard. LitmusChaos is the better choice only if multi-cluster ChaosCenter and a shared ChaosHub of reusable experiments become a requirement later.

**AI-workload-specific experiments — the differentiated set.** AI inference workloads fail differently from traditional services, and generic pod-kill chaos does not exercise those paths:

| Experiment | Injects | Validates |
|---|---|---|
| **GPU thermal throttle** | Clock reduction via stress | Does the engine correlate TTFT breach → throttle, not → traffic? |
| **KV-cache exhaustion** | Long-context request flood | Does saturation get predicted before request rejection? |
| **Inference replica kill** | Pod kill on a vLLM replica | Queue drain behaviour, TTFT recovery curve |
| **XID error injection** | Simulated GPU fault | Is the node drained before more requests route to it? |
| **Edge partition** | Network partition of an edge node | Offline sync queue behaviour |
| **Model rollout regression** | Deploy a deliberately slower version | Does auto-rollback trigger on TTFT, not just 5xx? |

**Required guardrails — this feature can cause a real outage**

- **Production is blocked by default.** Enabling it requires an explicit per-cluster setting plus a second approver.
- **Blast radius is stated before confirmation**, in plain language: "This will degrade 1 of 6 replicas of llama-3.3-70b in gcp-us-central for 5 minutes."
- **Auto-abort on SLO breach.** If error budget burn exceeds the threshold, the experiment halts and reverts itself.
- **Dead-man's switch.** Every experiment has a hard maximum duration and reverts if the controller loses contact.
- **Full audit record** — who ran what, where, when, and what happened. Chaos runs are audit-grade evidence of resilience; treat the record accordingly.

**Rename.** "Simulate Chaos" sounds like a toy. Call it **Resilience Test** in the UI — that is the language that survives a conversation with a compliance reviewer.

#### Acceptance criteria

- [ ] Button either works or is removed — no inert controls in the nav
- [ ] Blast radius shown and confirmed before any injection
- [ ] Production requires explicit opt-in plus second approval
- [ ] Auto-abort verified by test
- [ ] Every run produces a report at `/chaos/runs/{id}` stating hypothesis, result, and whether the correlation engine identified the injected cause

---

## 7. Page specifications

Status key: **✅ live** (fed by the API) · **🟡 built, hardcoded** · **⬜ not built**

### 7.0 Correlation Detail — `/correlations/{id}` ⬜

**The most important page in the product, and it does not exist yet.** Entry point E1 lands here.

| Priority | Feature |
|---|---|
| P0 | Symptom / cause / confidence / evidence / recommended action, server-rendered |
| P0 | Each evidence line links to its time series with the incident window **pinned** |
| P0 | Acknowledge · Share · Open PR · Suppress (exits X1–X3, X5) |
| P1 | Timeline: what else happened ±30 min — deploys, scaling, policy changes |
| P1 | "Similar past incidents" — has this fired before, what fixed it |
| P2 | Inline comment thread for handoff between on-call shifts |

**Exit:** X1 acknowledge · X2 PR · X3 share · X5 suppress.

---

### 7.1 Dashboard — `/dashboard` ✅

**Purpose:** the 10-second answer to "is anything wrong right now?" Not an analytics surface.

**Current state:** live against `orchestr8-api` via [`lib/api/dashboard.ts`](apps/web/lib/api/dashboard.ts). KPIs, correlations panel, force-directed topology and activity feed all render from the validated contract.

| Priority | Feature | Status |
|---|---|---|
| P0 | KPI row — clusters, GPU utilisation, inference SLO, token spend | ✅ |
| P0 | GPU utilisation shown **with throttle count beside it** — utilisation alone is misleading by design | ✅ |
| P0 | Correlated Incidents panel with evidence and confidence | ✅ |
| P0 | Topology map, force layout, status-coloured | ✅ |
| P0 | Activity feed, `explained` badge when an event has a correlation | ✅ |
| P1 | Time-range selector, URL-persisted | ⬜ |
| P1 | Sparkline per KPI — a number without a trend hides the direction of travel | ⬜ |
| P1 | Stale-data banner (F3) | ⬜ |
| P2 | Per-user layout persistence | ⬜ |
| P2 | Auto-refresh with a visible "updated 8s ago" stamp | ⬜ |

> **Deliberately excluded:** widget drag-and-drop, custom dashboard builder. Grafana wins that fight. Orchestr8's dashboard is opinionated on purpose — if the user needs to build a view to find the answer, the correlation engine has already failed.

**Exit:** click a correlation → §7.0 · click a cluster → §7.2.

---

### 7.2 Multi-Cluster View — `/clusters` 🟡

**Purpose:** fleet-level health and the drill path to a single cluster.

**Current state:** topology map, health cards, geo map and search all render hardcoded arrays. "Inspect Pods" and "Inject Chaos" buttons are inert.

| Priority | Feature | Status |
|---|---|---|
| P0 | Cluster list from API — status, nodes, CPU/mem, uptime, cost/hr | 🟡 hardcoded |
| P0 | **GPU inventory per cluster** — model, count, MIG profile, health | ⬜ |
| P0 | Cluster detail route `/clusters/{id}` | ⬜ |
| P1 | Topology with real dependency edges and measured inter-cluster latency | 🟡 |
| P1 | Geo map for physical placement | 🟡 |
| P1 | Search across clusters, nodes, pods, models | 🟡 non-functional |
| P1 | Cost per cluster with **GPU-hour attribution** — feeds chargeback | ⬜ |
| P2 | Compare two clusters side by side | ⬜ |
| P2 | Inspect Pods → live pod list | ⬜ inert button |

> A single H100 partitions into up to **7 MIG instances**, each potentially serving a different model for a different tenant. Per-slice tracking is a P0 requirement, not a refinement — a cluster view that shows "8 GPUs" when there are 56 addressable slices is wrong.

**Exit:** drill to cluster detail · jump to a correlation · open Deploy targeting this cluster.

---

### 7.3 AI Recommendations — `/ai` 🟡

**Purpose:** where the correlation engine's proactive output lives — predictions and cost optimisation, as distinct from reactive incident correlation.

**Current state:** the most visually complete section. Predictive scaling chart, cost panel, anomaly detection, model performance and a collaborative decision log — all hardcoded.

| Priority | Feature | Status |
|---|---|---|
| P0 | Anomaly detection fed by real signals | 🟡 |
| P0 | Every recommendation carries evidence + confidence, as correlations do | 🟡 partial |
| P0 | **Cost optimisation with real GPU-hour and token spend** | 🟡 |
| P1 | Predictive scaling — traffic forecast with confidence bands | 🟡 |
| P1 | Apply → **GitOps PR**, never a direct write | 🟡 button inert |
| P1 | Model performance: accuracy, precision, drift | 🟡 |
| P2 | Decision log with @mentions | 🟡 |
| P2 | Feedback loop — accepted/rejected recommendations tune future ranking | ⬜ |

> **Scope warning.** "Retrain Model" and "Data Drift Detected" in the current UI describe a model-observability product (Arize's territory), not an infra-correlation product. Recommend cutting them from v1 and keeping this page focused on **cost and capacity** — the two things a platform team acts on. Revisit after the correlation engine is proven.

**Exit:** apply → PR (X2) · dismiss → recorded as negative feedback.

---

### 7.4 Security Policies — `/security` 🟡

**Purpose:** policy posture, admission control and the findings surface. Consumes §6.2.

**Current state:** five tabs — Policies, Threats, Compliance, Shift-Left, Audit & Forensics — all hardcoded. The policy table correctly models OPA/Gatekeeper, Network Policy and Pod Security types.

| Priority | Feature | Status |
|---|---|---|
| P0 | Policy list from the live admission controller, with real violation counts | 🟡 |
| P0 | Scan results at `/security/scans/{id}` (E3, X4) | ⬜ |
| P0 | Findings sorted by severity × **reachability** × fix availability | ⬜ |
| P0 | SBOM per image digest, re-matchable against new CVEs | ⬜ |
| P1 | Policy editor with dry-run against live workloads before enforcing | 🟡 Monaco editor exists |
| P1 | Image signature verification (Cosign via Kyverno) | ⬜ |
| P1 | Runtime threat feed (Falco), streamed not polled | 🟡 |
| P1 | Waive with mandatory reason + expiry | ⬜ |
| P2 | Compliance mapping — SOC2 / ISO 27001 / CIS benchmark | 🟡 |
| P2 | Shift-left: PR-time policy feedback | 🟡 |

> **Audit & Forensics is on the wrong page.** It duplicates §7.6. Merge into the Audit Ledger and reclaim the tab.

**Exit:** remediate → PR (X2) · export → SBOM/PDF (X4) · waive (X5).

---

### 7.5 Edge Nodes — `/edge` 🟡

**Purpose:** the fleet that is intermittently connected — different failure model from a datacentre cluster.

**Current state:** the second most complete section. Geo-distribution map, node grid, bandwidth charts, offline sync queue, connectivity health — all hardcoded but well-modelled.

| Priority | Feature | Status |
|---|---|---|
| P0 | Node inventory with real last-seen timestamps | 🟡 |
| P0 | Offline sync queue with real pending jobs and retry counts | 🟡 |
| P0 | Distinguish *offline* from *not reporting* — different causes, different fixes | ⬜ |
| P1 | Bandwidth usage and optimisation suggestions | 🟡 |
| P1 | Connectivity timeline per node | 🟡 |
| P1 | Conflict resolution for divergent edge state | 🟡 |
| P2 | **Edge inference metrics** — small models served at the edge, same TTFT SLO treatment | ⬜ |
| P2 | Firmware/agent version tracking and staged upgrade | 🟡 |

> This section is a genuine differentiator if edge inference is in scope — no competitor covers intermittently-connected inference well. If it is not in scope, it is the largest candidate for deferral; it is a substantial surface serving a narrow use case.

**Exit:** force sync · view logs · drill to node detail.

---

### 7.6 Audit Ledger — `/audit` ⬜

**Current state:** a single card reading "Blockchain-based audit logs". Nothing else.

**Recommendation: drop the blockchain.** Append-only Postgres or ClickHouse with signed entries gives every property an auditor asks for — immutability, ordering, verifiability — at a fraction of the complexity. Blockchain here is a claim that invites scrutiny the project cannot repay. If tamper-evidence matters, hash-chain the entries and publish periodic checkpoints.

| Priority | Feature |
|---|---|
| P0 | Every write action recorded: deploys, approvals, policy edits, waivers, chaos runs |
| P0 | Immutable, queryable by actor / resource / time |
| P0 | **Approval evidence** — who approved which promotion at what time, with the diff hash (§6.1) |
| P1 | Export for audit (X4) |
| P1 | Cross-link into the originating deployment / scan / correlation |
| P2 | Hash-chain + periodic checkpoint for tamper-evidence |
| P2 | Retention policy per compliance regime |

**Exit:** X4 export.

---

### 7.7 Settings — `/settings` 🟡

**Current state:** six tabs — GitOps & CI/CD, API Keys, Notifications, RBAC, Theme, Integrations. All hardcoded, but the information architecture is sound.

| Priority | Feature | Status |
|---|---|---|
| P0 | **Cluster connection** — add/remove clusters, install command, health per collector | ⬜ |
| P0 | GitOps repo config — the write path for every action | 🟡 |
| P0 | **SLO definitions** — TTFT targets per model; every alert references these | ⬜ |
| P0 | API keys with scoping, rotation and last-used | 🟡 |
| P1 | RBAC — who can deploy, approve, waive, run chaos | 🟡 |
| P1 | Notification routing — Slack / PagerDuty / webhook, per severity | 🟡 |
| P1 | Integrations — Prometheus, Grafana, Slack, GitHub, Datadog | 🟡 |
| P2 | Theme customisation | 🟡 |

> **SLO definitions are a P0 gap.** The entire correlation engine compares observed values against thresholds. There is currently nowhere to set them, which means today's thresholds are hardcoded in the fixture.
>
> Theme customisation is ~490 lines serving a preference; the app is hard-forced to dark mode in [`app/layout.tsx`](apps/web/app/layout.tsx) anyway. Lowest priority in the product.

**Exit:** save → confirmation · onboarding re-entry (§5.4).

---

## 8. Consolidated feature list

### Phase 1 — Make one signal real (P0)

| ID | Feature | Page |
|---|---|---|
| F-01 | ClickHouse + collector against one real GPU node | infra |
| F-02 | Replace fixture read in `loadDashboard()` with real queries | api |
| F-03 | Fix sidebar Dashboard → `/dashboard` | nav |
| F-04 | SLO definition UI + storage | settings |
| F-05 | Cluster connection + install flow | settings/onboarding |
| F-06 | Stale-data banner, empty states (F1, F3, F4) | global |

### Phase 2 — The correlation engine (P0)

| ID | Feature | Page |
|---|---|---|
| F-07 | 8 correlation rules joining `gpu_minute` ↔ `inference_minute` | engine |
| F-08 | `/correlations/{id}` detail page | new |
| F-09 | Evidence deep-links with pinned time windows | new |
| F-10 | Acknowledge / Share / Suppress (X1, X3, X5) | new |
| F-11 | Alert routing → deep link (E1) | settings |

### Phase 3 — Real actions (P0/P1)

| ID | Feature | Page |
|---|---|---|
| F-12 | **Delete `Math.random()`; GitOps-backed deploy** | nav |
| F-13 | Deploy preflight (scan + policy + capacity + SLO) | nav |
| F-14 | Approval gate with audit evidence | nav |
| F-15 | Progressive rollout view, inference-aware metrics | nav |
| F-16 | **Trivy integration, real findings** | security |
| F-17 | SBOM storage + re-matching | security |
| F-18 | Export report (X4) | security |
| F-19 | Auto-Remediate → GitOps PR (X2) | security |
| F-20 | Audit ledger, append-only | audit |

### Phase 4 — Breadth (P1/P2)

| ID | Feature | Page |
|---|---|---|
| F-21 | Migrate clusters / edge / AI pages to the API | all |
| F-22 | GPU + MIG inventory per cluster | clusters |
| F-23 | GPU-hour cost attribution | clusters/ai |
| F-24 | Chaos Mesh integration + AI-specific experiments | nav |
| F-25 | Correlation-engine self-validation via chaos | nav |
| F-26 | Edge inference metrics | edge |

### Cut / deferred

| Feature | Reason |
|---|---|
| Blockchain audit | Complexity with no benefit over a signed append-only log |
| Model retraining / drift | Different product, different buyer (Arize's territory) |
| Custom dashboard builder | Grafana wins; opinionated views are the point |
| Theme customisation | 490 lines for a preference in a dark-forced app |
| Duplicate landing page `/landing` | Unreachable duplicate of `/` |

---

## 9. Non-functional requirements

| Area | Requirement |
|---|---|
| **Correlation latency** | Signal → correlation surfaced in < 60s |
| **Page load** | Dashboard TTFB < 400ms at p95; a dashboard load is a rollup key lookup, never a raw-span scan |
| **Ingest** | 50k spans/sec per gateway; agent/gateway split, Kafka when spikes outgrow the queue |
| **Retention** | Raw spans 30d, per-minute rollups 13 months |
| **Correctness** | Store quantile **sketches**, never pre-computed p95s — averaging p95s is silently wrong |
| **Availability** | Ingest must survive query-tier failure; losing telemetry during an incident is unacceptable |
| **Contract** | Zod ↔ Go validated against shared golden fixtures; drift fails CI (`make contract`) |
| **Security** | No credentials in URLs; scoped API keys; RBAC on every write; no direct cluster writes |
| **Accessibility** | Keyboard-navigable, visible focus, WCAG AA contrast, never colour alone for severity |
| **Build hygiene** | Remove `ignoreBuildErrors`/`ignoreDuringBuilds` (29 type errors currently hidden); patch `next@15.2.4` (CVE-2025-66478) |

---

## 10. Success metrics

**Product**

| Metric | Target | Why |
|---|---|---|
| Time to root cause (alert → cause identified) | < 90s | The core promise |
| Correlation **precision** | > 90% | Being confidently wrong costs trust once |
| Correlations acknowledged without further navigation | > 60% | Proves the page answered the question |
| Repeat pages for the same root cause | ↓ over time | Suppression and fixes are working |

> Precision over recall for the first year. A missed incident is forgiven; sending someone to drain a healthy node is not.

**Activation** — industry average activation is 37.5%, and 98% of users who never hit a value milestone churn within two weeks.

| Metric | Target |
|---|---|
| Signup → first real GPU metric | < 15 min |
| Activation (reached the value milestone) | > 50% |
| Clusters connected in week 1 | ≥ 2 |

**Anti-metrics — deliberately not optimised**

- Session duration. Longer means the answer was harder to find.
- Dashboard views per user. Five dashboards per incident is the problem, not the product.

---

## 11. Open questions

| # | Question | Blocks | Owner |
|---|---|---|---|
| Q1 | Access to real GPU hardware for development? Rented A100 hours to capture one real trace for replay is the cheapest path. | F-01, the entire thesis | — |
| Q2 | Is edge inference in scope, or is `/edge` deferred? Large surface, narrow use case. | F-26 | — |
| Q3 | Single-tenant or multi-tenant from day one? Affects every ClickHouse table's primary key — expensive to retrofit. | schema | — |
| Q4 | Which GitOps tool is assumed — Argo CD, Flux, or both? Argo CD assumed throughout §6.1. | F-12 | — |
| Q5 | Is the audit ledger a compliance claim or a convenience feature? Determines whether hash-chaining is P0. | F-20 | — |
| Q6 | Does the project need a working demo without hardware? If yes, the chaos engine doubles as the demo generator. | F-24 | — |

---

## Appendix — current state summary

| Route | Status | Data source |
|---|---|---|
| `/` | 🟡 | Marketing landing, static |
| `/dashboard` | ✅ | `orchestr8-api` over validated contract |
| `/clusters` | 🟡 | Hardcoded arrays |
| `/ai` | 🟡 | Hardcoded arrays |
| `/security` | 🟡 | Hardcoded arrays |
| `/edge` | 🟡 | Hardcoded arrays |
| `/audit` | ⬜ | Placeholder card |
| `/settings` | 🟡 | Hardcoded arrays |
| `/landing` | ⬜ | Unreachable duplicate — delete |

**Shipped (Phase 0):** monorepo split into `apps/web`, `services/api`, `services/collector`, `packages/contracts`; cross-language contract with drift-detecting tests; dashboard live against the Go API with an explicit error state when the backend is unreachable.
