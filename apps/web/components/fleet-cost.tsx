import type { ClusterDetail } from "@orchestr8/contracts"

/**
 * Where the money goes, by GPU model.
 *
 * "$352/day" is a number nobody can act on. The actionable version is which
 * hardware it is spent on and how hard that hardware is working — an H100 at
 * 12% utilisation is the single most expensive thing in a fleet, and a total
 * hides it completely.
 */

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })

// Below this, a GPU is costing far more than it returns and is worth naming.
const IDLE_PCT = 40

export function FleetCost({ clusters }: { clusters: ClusterDetail[] }) {
  // Roll every cluster's inventory up by GPU model: the buying decision is per
  // model, not per cluster.
  const byModel = new Map<string, { count: number; costPerHourUsd: number; utilSum: number }>()
  for (const c of clusters) {
    for (const inv of c.inventory) {
      const e = byModel.get(inv.model) ?? { count: 0, costPerHourUsd: 0, utilSum: 0 }
      e.count += inv.count
      e.costPerHourUsd += inv.costPerHourUsd
      e.utilSum += inv.avgUtilizationPct * inv.count
      byModel.set(inv.model, e)
    }
  }
  const rows = [...byModel.entries()]
    .map(([model, e]) => ({ model, ...e, utilPct: e.count > 0 ? e.utilSum / e.count : 0 }))
    .sort((a, b) => b.costPerHourUsd - a.costPerHourUsd)

  if (rows.length === 0) {
    return <p className="px-4 py-5 text-sm text-muted-foreground">No GPU inventory reporting yet.</p>
  }

  const total = rows.reduce((s, r) => s + r.costPerHourUsd, 0)

  return (
    <div className="space-y-3 px-4 py-3.5">
      {rows.map((r) => {
        const share = total > 0 ? (r.costPerHourUsd / total) * 100 : 0
        const idle = r.utilPct < IDLE_PCT
        return (
          <div key={r.model}>
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <span className="truncate font-mono text-xs" title={r.model}>{r.model}</span>
              <span className="tnum shrink-0 text-xs font-medium">{usd.format(r.costPerHourUsd * 24)}</span>
            </div>
            <div className="mb-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-foreground/45" style={{ width: `${share}%` }} />
            </div>
            <div className="flex items-baseline justify-between text-[11px] text-muted-foreground">
              <span className="tnum">
                {r.count}× · {Math.round(r.utilPct)}% used
              </span>
              <span className={`tnum ${idle ? "text-warn" : ""}`}>
                {idle ? "under-used" : `${Math.round(share)}% of spend`}
              </span>
            </div>
          </div>
        )
      })}
      <div className="flex items-baseline justify-between border-t pt-3 text-xs">
        <span className="text-muted-foreground">Total</span>
        <span className="tnum font-medium">{usd.format(total * 24)}/day</span>
      </div>
    </div>
  )
}
