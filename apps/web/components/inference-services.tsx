import type { InferenceResponse, SeriesPoint } from "@orchestr8/contracts"

import { Sparkline } from "@/components/sparkline"

/**
 * What the platform is actually defending: per-model serving health.
 *
 * The table used to carry p95, GPU count and cost — three numbers that tell
 * you a model is in trouble only once it already is. Queue depth and KV cache
 * are the ones that move first: the cache fills, new requests stop finding
 * room, and the queue grows before p95 has shifted at all. They are leading
 * indicators, so they get columns of their own.
 *
 * The trend column matters for the same reason. A p95 of 1008ms against a
 * 1200ms target reads as healthy right up until you see it was 400ms an hour
 * ago, which is why the SLO line is drawn on every spark.
 */

const usd4 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 4 })

// vLLM starts evicting and queueing as the KV cache approaches full; the
// queue itself is already a symptom rather than a warning.
const KV_WARN = 75
const KV_CRIT = 90

type Tone = "ok" | "warn" | "crit"
const TEXT: Record<Tone, string> = { ok: "text-muted-foreground", warn: "text-warn", crit: "text-crit" }

export function InferenceServices({
  inference,
  trends,
}: {
  inference: InferenceResponse | null
  trends: Record<string, SeriesPoint[]>
}) {
  if (!inference || inference.models.length === 0) {
    return (
      <p className="px-4 py-5 text-sm text-muted-foreground">
        No inference services reporting. A serving pod needs the
        <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">orchestr8.io/scrape</code>
        annotation to be collected.
      </p>
    )
  }

  // Closest to breaching its own SLO first. Ranking by raw latency would put a
  // 1000ms model with a 1200ms target above a 90ms model with a 100ms target,
  // and the second one is the one in trouble.
  const sorted = [...inference.models].sort(
    (a, b) => b.ttftMsP95 / (b.ttftSloMs || 1) - a.ttftMsP95 / (a.ttftSloMs || 1),
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b text-left text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
            {["Model", "p95 / target", "Trend · 1h", "Req/min", "Queue", "KV cache", "$/1k req"].map((h) => (
              <th key={h} className="whitespace-nowrap px-4 py-2 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((m) => {
            const pct = m.ttftSloMs > 0 ? Math.min(100, (m.ttftMsP95 / m.ttftSloMs) * 100) : 0
            const kvTone: Tone = m.kvCacheUsagePct >= KV_CRIT ? "crit" : m.kvCacheUsagePct >= KV_WARN ? "warn" : "ok"
            const qTone: Tone = m.queueDepth >= 5 ? "crit" : m.queueDepth >= 1 ? "warn" : "ok"
            const points = trends[`${m.clusterId}/${m.model}`] ?? []
            return (
              <tr key={m.clusterId + m.model} className="border-b border-border/50 last:border-0">
                <td className="whitespace-nowrap px-4 py-2.5">
                  <div className="font-mono text-xs">{m.model}</div>
                  <div className="text-[11px] text-muted-foreground">{m.clusterId}</div>
                </td>
                {/* Observed and target in one cell: a latency figure means
                    nothing without the budget it is spending. */}
                <td className="whitespace-nowrap px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`tnum font-medium ${m.withinSlo ? "" : "text-crit"}`}>{m.ttftMsP95}</span>
                    <span className="tnum text-xs text-muted-foreground">/ {m.ttftSloMs}ms</span>
                    <div className="h-1.5 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
                      <div className={`h-full rounded-full ${m.withinSlo ? "bg-ok" : "bg-crit"}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="tnum mt-0.5 text-[11px] text-muted-foreground">p50 {m.ttftMsP50}ms</div>
                </td>
                <td className="w-[140px] px-4 py-2">
                  {points.length > 1
                    ? <Sparkline points={points} threshold={m.ttftSloMs} height={28} unit="ms" labels={false} />
                    : <span className="text-[11px] text-muted-foreground">—</span>}
                </td>
                <td className="tnum whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                  {Math.round(m.requestsPerMin).toLocaleString()}
                </td>
                <td className={`tnum whitespace-nowrap px-4 py-2.5 ${TEXT[qTone]}`}>
                  {m.queueDepth.toFixed(1)}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`tnum text-xs ${TEXT[kvTone]}`}>{m.kvCacheUsagePct.toFixed(0)}%</span>
                    <div className="h-1.5 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${kvTone === "crit" ? "bg-crit" : kvTone === "warn" ? "bg-warn" : "bg-foreground/45"}`}
                        style={{ width: `${m.kvCacheUsagePct}%` }}
                      />
                    </div>
                  </div>
                </td>
                {/* Cost per unit of work, not per hour. An idle GPU and a
                    saturated one bill the same per hour and are worth wildly
                    different amounts. */}
                <td className="tnum whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                  {usd4.format(m.costPerKRequestsUsd)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
