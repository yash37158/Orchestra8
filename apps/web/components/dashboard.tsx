import Link from "next/link"
import { AlertTriangle, ChevronRight, Cloud, Coins, Cpu, Gauge } from "lucide-react"
import type { Correlation, DashboardResponse, InferenceResponse } from "@orchestr8/contracts"

import { ActivityFeed } from "@/components/activity-feed"
import { TelemetryStatus } from "@/components/telemetry-status"
import { ScrollArea } from "@/components/ui/scroll-area"

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
const usd2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 })

type State = "ok" | "warn" | "crit"
const RAIL: Record<State, string> = {
  ok: "",
  warn: "shadow-[inset_2px_0_0_0_hsl(var(--warn))]",
  crit: "shadow-[inset_2px_0_0_0_hsl(var(--crit))]",
}
const DOT: Record<State, string> = { ok: "bg-ok", warn: "bg-warn", crit: "bg-crit" }

function Kpi({ label, icon: Icon, value, sub, state = "ok" }: {
  label: string; icon: typeof Cloud; value: string; sub: string; state?: State
}) {
  return (
    <div className={`rounded-md border bg-card px-4 py-3.5 ${RAIL[state]}`}>
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
        <Icon className="h-3.5 w-3.5 text-muted-foreground/60" />
      </div>
      <div className="tnum text-[26px] font-semibold leading-none tracking-tight">{value}</div>
      <div className="mt-2 flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[state]}`} />
        <span className="text-xs text-muted-foreground">{sub}</span>
      </div>
    </div>
  )
}

const SEV_TEXT: Record<string, string> = {
  critical: "text-crit", warning: "text-warn", info: "text-muted-foreground",
}

function CorrelationCard({ c }: { c: Correlation }) {
  return (
    <Link
      href={`/correlations/${encodeURIComponent(c.id)}`}
      className={`group block rounded-md border bg-card px-4 py-3.5 transition-colors hover:border-foreground/20 ${
        c.severity === "critical" ? RAIL.crit : RAIL.warn}`}
    >
      <div className="mb-2 flex items-center gap-2.5">
        <span className={`text-[10px] font-semibold uppercase tracking-[0.08em] ${SEV_TEXT[c.severity]}`}>
          {c.severity}
        </span>
        <span className="text-[11px] text-muted-foreground">
          <span className="tnum">{Math.round(c.confidence * 100)}%</span> confidence
        </span>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground/70">
          {c.cause.kind.replace(/_/g, " ")}
        </span>
      </div>
      <p className="text-[13.5px] leading-relaxed text-foreground/90">{c.summary}</p>
      <ul className="mt-3 space-y-1 border-l border-border pl-3">
        {c.cause.evidence.slice(0, 3).map((e, i) => (
          <li key={i} className="text-xs leading-relaxed text-muted-foreground">{e.text}</li>
        ))}
      </ul>
      <p className="mt-3 flex items-center gap-1 text-xs font-medium text-primary">
        {c.recommendedAction}
        <ChevronRight className="h-3 w-3 shrink-0 transition-transform group-hover:translate-x-0.5" />
      </p>
    </Link>
  )
}

/**
 * Per-model SLO and spend.
 *
 * This replaces a force-directed topology map that, with two clusters and no
 * measured inter-cluster links, drew two unconnected circles across half the
 * viewport. Topology needs edges to be worth the space; it lives on /clusters
 * where there is room for it. What belongs above the fold is the thing being
 * defended — the SLO — and what it costs.
 */
function Models({ inference }: { inference: InferenceResponse | null }) {
  if (!inference || inference.models.length === 0) {
    return (
      <p className="px-4 py-5 text-sm text-muted-foreground">
        No inference services reporting. A serving pod needs the
        <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">orchestr8.io/scrape</code>
        annotation to be collected.
      </p>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b text-left text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
            {["Model", "Cluster", "p95 / target", "GPUs", "Cost/hr"].map((h) => (
              <th key={h} className="whitespace-nowrap px-4 py-2 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {inference.models.map((m) => {
            const pct = m.ttftSloMs > 0 ? Math.min(100, (m.ttftMsP95 / m.ttftSloMs) * 100) : 0
            return (
              <tr key={m.clusterId + m.model} className="border-b border-border/50 last:border-0">
                <td className="whitespace-nowrap px-4 py-2 font-mono text-xs">{m.model}</td>
                <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-muted-foreground">{m.clusterId}</td>
                {/* Observed and target in one cell: a latency figure means
                    nothing without the budget it is spending. The bar carries
                    the ratio, the numbers carry the magnitude. */}
                <td className="whitespace-nowrap px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span className={`tnum font-medium ${m.withinSlo ? "" : "text-crit"}`}>{m.ttftMsP95}</span>
                    <span className="tnum text-xs text-muted-foreground">/ {m.ttftSloMs}ms</span>
                    <div className="h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-muted">
                      <div className={`h-full rounded-full ${m.withinSlo ? "bg-ok" : "bg-crit"}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </td>
                <td className="tnum px-4 py-2 text-muted-foreground">{m.gpuCount}</td>
                <td className="tnum whitespace-nowrap px-4 py-2 text-muted-foreground">{usd2.format(m.costPerHourUsd)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function Dashboard({ data, inference }: { data: DashboardResponse; inference: InferenceResponse | null }) {
  const { overview, activity, correlations } = data
  const sloBreaching = overview.inferenceSloAttainmentPct < 100
  const throttled = data.gpus.filter((g) => g.throttled).length
  const degraded = data.topology.clusters.filter((c) => c.status !== "healthy").length

  return (
    <ScrollArea className="h-[calc(100vh-3.5rem)]">
      <div className="container max-w-[1400px] space-y-5 py-6">
        <div className="flex items-baseline justify-between">
          <h1 className="text-lg font-semibold tracking-tight">Overview</h1>
          <span className="tnum text-xs text-muted-foreground">
            updated {new Date(overview.generatedAt).toLocaleTimeString()}
          </span>
        </div>

        <TelemetryStatus lastTelemetryAt={overview.lastTelemetryAt} />

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Kpi
            label="Clusters"
            icon={Cloud}
            value={`${overview.clusters.healthy - degraded}/${overview.clusters.total}`}
            sub={degraded > 0 ? `${degraded} degraded` : "all healthy"}
            state={degraded > 0 ? "warn" : "ok"}
          />
          <Kpi
            label="GPU utilisation"
            icon={Cpu}
            value={`${overview.gpuUtilizationPct}%`}
            sub={throttled > 0 ? `${throttled} GPU${throttled > 1 ? "s" : ""} throttling` : "none throttling"}
            state={throttled > 0 ? "warn" : "ok"}
          />
          <Kpi
            label="Inference SLO"
            icon={Gauge}
            value={`${overview.inferenceSloAttainmentPct}%`}
            sub={sloBreaching ? "p95 TTFT over target" : "all models within target"}
            state={sloBreaching ? "crit" : "ok"}
          />
          <Kpi
            label="Fleet cost"
            icon={Coins}
            value={usd.format(overview.fleetCostPerDayUsd)}
            sub={`per day · ${data.gpus.length} GPU${data.gpus.length === 1 ? "" : "s"}`}
          />
        </div>

        {correlations.length > 0 && (
          <section className="space-y-2.5">
            <div className="flex items-baseline justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                <AlertTriangle className="h-4 w-4 text-warn" />
                Correlated incidents
              </h2>
              <span className="text-xs text-muted-foreground">infrastructure cause linked to inference symptom</span>
            </div>
            {correlations.map((c) => <CorrelationCard key={c.id} c={c} />)}
          </section>
        )}

        <div className="grid gap-3 lg:grid-cols-5">
          <section className="rounded-md border bg-card lg:col-span-3">
            <div className="flex items-baseline justify-between border-b px-4 py-3">
              <h2 className="text-sm font-semibold tracking-tight">Models</h2>
              <Link href="/ai" className="text-xs text-primary hover:underline">economics</Link>
            </div>
            <Models inference={inference} />
          </section>

          <section className="rounded-md border bg-card lg:col-span-2">
            <div className="flex items-baseline justify-between border-b px-4 py-3">
              <h2 className="text-sm font-semibold tracking-tight">Activity</h2>
              <Link href="/audit" className="text-xs text-primary hover:underline">ledger</Link>
            </div>
            <div className="px-4 py-3.5">
              <ActivityFeed events={activity} />
            </div>
          </section>
        </div>
      </div>
    </ScrollArea>
  )
}
