import { AlertTriangle, Cpu, HardDrive, Server } from "lucide-react"
import type { ClusterDetail, ClustersResponse } from "@orchestr8/contracts"

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
const usd2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 })

const PROVIDER: Record<string, string> = {
  aws: "AWS", gcp: "GCP", azure: "Azure", edge: "Edge", onprem: "On-prem", unknown: "Unknown",
}

function ago(iso: string | null) {
  if (!iso) return "never"
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 90) return `${Math.round(s)}s ago`
  const m = Math.round(s / 60)
  return m < 90 ? `${m} min ago` : `${Math.round(m / 60)}h ago`
}

/** Horizontal capacity bar. Utilisation and memory both read better as a
 *  proportion than as a number you have to mentally divide. */
function Bar({ pct, tone = "accent" }: { pct: number; tone?: "accent" | "warn" }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={`h-full rounded-full ${tone === "warn" ? "bg-warn" : "bg-primary"}`}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  )
}

function ClusterCard({ c }: { c: ClusterDetail }) {
  const degraded = c.status !== "healthy"
  const memPct = c.memoryTotalGb > 0 ? (c.memoryUsedGb / c.memoryTotalGb) * 100 : 0

  return (
    <div className={`rounded-md border bg-card ${degraded ? "shadow-[inset_2px_0_0_0_hsl(var(--warn))]" : ""}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3">
        <div className="flex items-baseline gap-2.5">
          <h3 className="font-mono text-sm font-semibold">{c.id}</h3>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
            {PROVIDER[c.provider] ?? c.provider}
          </span>
          {degraded && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-warn">
              <AlertTriangle className="h-3 w-3" />
              {c.throttledCount} throttling
            </span>
          )}
        </div>
        <span className="text-[11px] text-muted-foreground">last seen {ago(c.lastSeenAt)}</span>
      </div>

      <div className="grid gap-x-6 gap-y-4 px-4 py-3.5 sm:grid-cols-3">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
            <Server className="h-3 w-3" /> Nodes / GPUs
          </div>
          <div className="tnum text-lg font-semibold">
            {c.nodeCount} <span className="text-muted-foreground">/</span> {c.gpuCount}
          </div>
        </div>
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
            <Cpu className="h-3 w-3" /> Utilisation
          </div>
          <div className="tnum mb-1.5 text-lg font-semibold">{c.avgUtilizationPct}%</div>
          <Bar pct={c.avgUtilizationPct} tone={c.throttledCount > 0 ? "warn" : "accent"} />
        </div>
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
            <HardDrive className="h-3 w-3" /> GPU memory
          </div>
          <div className="tnum mb-1.5 text-lg font-semibold">
            {c.memoryUsedGb}
            <span className="text-sm font-normal text-muted-foreground"> / {c.memoryTotalGb} GB</span>
          </div>
          <Bar pct={memPct} />
        </div>
      </div>

      <div className="border-t px-4 py-3">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">Inventory</span>
          {/* Cost is the number a platform team gets asked about upward, so it
              sits beside the hardware that generates it rather than on a
              separate billing page nobody opens. */}
          <span className="tnum text-[13px] font-medium">
            {usd2.format(c.costPerHourUsd)}<span className="text-muted-foreground">/hr</span>
            <span className="ml-2 text-muted-foreground">{usd.format(c.costPer24hUsd)}/day</span>
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <tbody>
              {c.inventory.map((e) => (
                <tr key={e.model} className="border-t border-border/50 first:border-0">
                  <td className="py-1.5 pr-3 tnum w-10 font-medium">{e.count}×</td>
                  <td className="py-1.5 pr-3 font-mono text-xs">
                    {e.model}
                    {e.migProfile && (
                      <span className="ml-1.5 rounded bg-primary/12 px-1 py-0.5 text-[10px] text-primary">
                        MIG {e.migProfile}
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 pr-3 tnum whitespace-nowrap text-right text-muted-foreground">
                    {e.totalMemoryGb} GB
                  </td>
                  <td className="py-1.5 pr-3 tnum whitespace-nowrap text-right text-muted-foreground">
                    {e.avgUtilizationPct}%
                  </td>
                  <td className="py-1.5 tnum whitespace-nowrap text-right">
                    {usd2.format(e.costPerHourUsd)}<span className="text-muted-foreground">/hr</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <details className="border-t">
        <summary className="cursor-pointer px-4 py-2 text-[11px] uppercase tracking-[0.06em] text-muted-foreground hover:text-foreground">
          {c.gpus.length} device{c.gpus.length === 1 ? "" : "s"}
        </summary>
        <div className="overflow-x-auto px-4 pb-3">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
                <th className="py-1 pr-3 font-medium">Node</th>
                <th className="py-1 pr-3 font-medium">UUID</th>
                <th className="py-1 pr-3 text-right font-medium">Temp</th>
                <th className="py-1 pr-3 text-right font-medium">Util</th>
                <th className="py-1 pr-3 text-right font-medium">Mem</th>
                <th className="py-1 text-right font-medium">Power</th>
              </tr>
            </thead>
            <tbody>
              {c.gpus.map((g) => (
                <tr key={`${g.nodeName}-${g.uuid}`} className="border-t border-border/40">
                  <td className="py-1.5 pr-3 font-mono">{g.nodeName}</td>
                  <td className="py-1.5 pr-3 font-mono text-muted-foreground">
                    {g.uuid}
                    {g.throttled && (
                      <span className="ml-1.5 rounded bg-warn-surface px-1 py-0.5 text-[10px] font-medium text-warn">
                        throttling
                      </span>
                    )}
                  </td>
                  <td className={`py-1.5 pr-3 tnum text-right ${g.throttled ? "text-warn" : ""}`}>{g.temperatureC}°C</td>
                  <td className="py-1.5 pr-3 tnum text-right">{g.utilizationPct}%</td>
                  <td className="py-1.5 pr-3 tnum text-right text-muted-foreground">
                    {g.memoryUsedGb}/{g.memoryTotalGb}
                  </td>
                  <td className="py-1.5 tnum text-right text-muted-foreground">{g.powerWatts}W</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}

export function Fleet({ data }: { data: ClustersResponse }) {
  const totals = data.clusters.reduce(
    (a, c) => ({
      gpus: a.gpus + c.gpuCount,
      nodes: a.nodes + c.nodeCount,
      throttled: a.throttled + c.throttledCount,
      perDay: a.perDay + c.costPer24hUsd,
    }),
    { gpus: 0, nodes: 0, throttled: 0, perDay: 0 },
  )

  if (data.clusters.length === 0) {
    return (
      <div className="rounded-md border border-warn/25 bg-warn-surface px-5 py-4">
        <h2 className="mb-1 text-sm font-semibold text-warn">No clusters reporting</h2>
        <p className="text-sm text-muted-foreground">
          A cluster appears here once its collector sends telemetry. Connect one from the onboarding flow.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "Clusters", value: String(data.clusters.length) },
          { label: "Nodes", value: String(totals.nodes) },
          { label: "GPUs", value: String(totals.gpus), sub: totals.throttled > 0 ? `${totals.throttled} throttling` : undefined },
          { label: "Fleet cost", value: usd.format(totals.perDay), sub: "per day" },
        ].map((t) => (
          <div key={t.label} className="rounded-md border bg-card px-4 py-3">
            <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              {t.label}
            </div>
            <div className="tnum text-[22px] font-semibold leading-none">{t.value}</div>
            {t.sub && <div className="mt-1.5 text-xs text-muted-foreground">{t.sub}</div>}
          </div>
        ))}
      </div>

      {data.clusters.map((c) => (
        <ClusterCard key={c.id} c={c} />
      ))}
    </div>
  )
}
