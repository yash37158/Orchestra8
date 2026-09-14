import Link from "next/link"
import { AlertTriangle, ChevronRight, Cloud, Coins, Cpu, Gauge, ShieldCheck } from "lucide-react"
import type {
  ClusterDetail, Correlation, DashboardResponse, InferenceResponse, SeriesPoint,
} from "@orchestr8/contracts"

import { ActivityFeed } from "@/components/activity-feed"
import { FleetCost } from "@/components/fleet-cost"
import { GpuFleet } from "@/components/gpu-fleet"
import { InferenceServices } from "@/components/inference-services"
import { Sparkline } from "@/components/sparkline"
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

/**
 * A single headline number.
 *
 * `trend` is optional because not every metric has one worth drawing: fleet
 * cost is inventory times a rate card, so its line is flat until somebody buys
 * a GPU. Where a trend does exist it carries the thing the number alone cannot
 * — 88% utilisation reads the same whether it has been steady all day or
 * climbed twenty points in an hour.
 */
function Kpi({ label, icon: Icon, value, sub, state = "ok", trend }: {
  label: string; icon: typeof Cloud; value: string; sub: string; state?: State; trend?: SeriesPoint[]
}) {
  const delta = trend && trend.length > 1 ? trend[trend.length - 1].v - trend[0].v : null
  return (
    <div className={`rounded-md border bg-card px-4 py-3.5 ${RAIL[state]}`}>
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
        <Icon className="h-3.5 w-3.5 text-muted-foreground/60" />
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="tnum text-[26px] font-semibold leading-none tracking-tight">{value}</div>
        {trend && trend.length > 1 && (
          <div className="w-[84px] shrink-0 opacity-70">
            <Sparkline points={trend} height={26} labels={false} />
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[state]}`} />
        <span className="text-xs text-muted-foreground">{sub}</span>
        {/* Rounded to the nearest whole unit: sub-decimal drift on a one-hour
            window is noise, and rendering it invites reading meaning into it. */}
        {delta !== null && Math.abs(delta) >= 1 && (
          <span className="tnum ml-auto text-[11px] text-muted-foreground/80">
            {delta > 0 ? "+" : ""}{Math.round(delta)} / 1h
          </span>
        )}
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

export function Dashboard({ data, inference, clusters, utilTrend, sloTrends }: {
  data: DashboardResponse
  inference: InferenceResponse | null
  clusters: ClusterDetail[]
  utilTrend: SeriesPoint[]
  sloTrends: Record<string, SeriesPoint[]>
}) {
  const { overview, activity, correlations } = data

  // SLO attainment is derived from the very models rendered below, not from
  // overview.inferenceSloAttainmentPct. The two are computed over different
  // windows — the overview smooths over five minutes, /v1/inference uses the
  // engine's three-minute detection window — so on a fleet sitting near its
  // target the headline read 100% while the table underneath showed a row in
  // red. One fact, one source.
  const models = inference?.models ?? []
  const breaching = models.filter((m) => !m.withinSlo)
  const sloPct = models.length > 0
    ? Math.round(((models.length - breaching.length) / models.length) * 100)
    : 100
  const sloBreaching = breaching.length > 0
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
            trend={utilTrend}
          />
          <Kpi
            label="Inference SLO"
            icon={Gauge}
            value={`${sloPct}%`}
            sub={sloBreaching
              ? `${breaching.length} of ${models.length} over p95 target`
              : `all ${models.length} models within target`}
            state={sloBreaching ? "crit" : "ok"}
          />
          <Kpi
            label="Fleet cost"
            icon={Coins}
            value={usd.format(overview.fleetCostPerDayUsd)}
            sub={`per day · ${data.gpus.length} GPU${data.gpus.length === 1 ? "" : "s"}`}
          />
        </div>

        <section className="space-y-2.5">
          <div className="flex items-baseline justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              {correlations.length > 0
                ? <AlertTriangle className="h-4 w-4 text-warn" />
                : <ShieldCheck className="h-4 w-4 text-ok" />}
              Correlated incidents
            </h2>
            <span className="text-xs text-muted-foreground">infrastructure cause linked to inference symptom</span>
          </div>
          {correlations.length > 0
            ? correlations.map((c) => <CorrelationCard key={c.id} c={c} />)
            : (
              /* An empty section used to vanish, which left a hole where the
                 product's whole claim should be and said nothing about whether
                 the engine had even run. Silence is a result; it should look
                 like one. */
              <div className="rounded-md border bg-card px-4 py-3.5">
                {/* Says only what was measured. The first version asserted
                    "every model is inside its SLO", which went stale the moment
                    a model breached without the engine finding a cause for it —
                    the panel then contradicted the table directly below. */}
                <p className="text-[13.5px] text-foreground/90">
                  {sloBreaching
                    ? `No cause identified yet for ${breaching.length} breaching model${breaching.length === 1 ? "" : "s"}.`
                    : "No correlated incidents. Every model is inside its SLO."}
                </p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Watching <span className="tnum">{models.length}</span> service
                  {models.length === 1 ? "" : "s"} across{" "}
                  <span className="tnum">{data.gpus.length}</span> GPU{data.gpus.length === 1 ? "" : "s"}.
                  {/* This used to end "not that nothing was checked", which was
                      false for every tenant but the first: the engine watched a
                      single organisation taken from an environment variable, so
                      a second customer was reassured by a panel that had never
                      examined their fleet. It sweeps every tenant now. */}
                  The engine links an infrastructure cause to an inference symptom only when it can
                  evidence both, so an empty list means no cause was provable — not that nothing is wrong.
                </p>
              </div>
            )}
        </section>

        <section className="rounded-md border bg-card">
          <div className="flex items-baseline justify-between border-b px-4 py-3">
            <h2 className="text-sm font-semibold tracking-tight">Inference services</h2>
            <Link href="/ai" className="text-xs text-primary hover:underline">economics</Link>
          </div>
          <InferenceServices inference={inference} trends={sloTrends} />
        </section>

        <div className="grid gap-3 lg:grid-cols-5">
          <section className="rounded-md border bg-card lg:col-span-3">
            <div className="flex items-baseline justify-between border-b px-4 py-3">
              <h2 className="text-sm font-semibold tracking-tight">GPU fleet</h2>
              <Link href="/clusters" className="text-xs text-primary hover:underline">clusters</Link>
            </div>
            <GpuFleet gpus={data.gpus} />
          </section>

          <section className="rounded-md border bg-card lg:col-span-2">
            <div className="flex items-baseline justify-between border-b px-4 py-3">
              <h2 className="text-sm font-semibold tracking-tight">Spend by GPU model</h2>
              <Link href="/ai" className="text-xs text-primary hover:underline">recommendations</Link>
            </div>
            <FleetCost clusters={clusters} />
          </section>
        </div>

        <section className="rounded-md border bg-card">
          <div className="flex items-baseline justify-between border-b px-4 py-3">
            <h2 className="text-sm font-semibold tracking-tight">Activity</h2>
            <Link href="/audit" className="text-xs text-primary hover:underline">ledger</Link>
          </div>
          <div className="px-4 py-3.5">
            <ActivityFeed events={activity} />
          </div>
        </section>
      </div>
    </ScrollArea>
  )
}
