import type { Headroom } from "@orchestr8/contracts"

/**
 * How much load each service has absorbed before missing its target, and what
 * it costs to lose a GPU.
 *
 * Every figure here is a measurement. Where history has not covered a load
 * level, the panel says so rather than showing a number — somebody is deciding
 * whether to pull a card out of production on the strength of this, and a
 * plausible guess is worse than an admission.
 */

// Below this, a spike has nowhere to go.
const TIGHT_PCT = 25

function Bar({ headroomPct }: { headroomPct: number }) {
  const pct = Math.max(0, Math.min(100, headroomPct))
  const tone = headroomPct < TIGHT_PCT ? "bg-warn" : "bg-ok"
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function DrainVerdict({ h }: { h: Headroom }) {
  const d = h.drain
  if (!d.observed) {
    return (
      <p className="text-[12.5px] leading-relaxed text-muted-foreground">
        {d.note || "Not enough history to say."}
      </p>
    )
  }
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline gap-2">
        <span
          className={`text-[10px] font-semibold uppercase tracking-[0.08em] ${
            d.withinSlo ? "text-ok" : "text-crit"
          }`}
        >
          {d.withinSlo ? "safe to drain" : "do not drain"}
        </span>
      </div>
      <p className="text-[12.5px] leading-relaxed text-muted-foreground">
        Losing one of {h.gpuCount} GPUs leaves{" "}
        <span className="tnum font-mono text-foreground/85">{d.equivalentReqPerMin}</span> req/min on
        each remaining card. This service has run at that load and served{" "}
        <span className={`tnum font-mono ${d.withinSlo ? "text-foreground/85" : "text-crit"}`}>
          {d.p95Ms}ms
        </span>{" "}
        p95, against a {h.sloMs}ms target.
      </p>
    </div>
  )
}

export function HeadroomPanel({ services }: { services: Headroom[] }) {
  if (services.length === 0) {
    return (
      <p className="px-4 py-5 text-sm text-muted-foreground">
        No inference services reporting yet.
      </p>
    )
  }
  // Tightest first: the service closest to its ceiling is the one that decides
  // whether tonight goes badly.
  const sorted = [...services].sort(
    (a, b) => (a.headroomPct ?? Number.POSITIVE_INFINITY) - (b.headroomPct ?? Number.POSITIVE_INFINITY),
  )

  return (
    <div className="divide-y">
      {sorted.map((h) => (
        <div key={h.clusterId + h.model} className="px-4 py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <div className="font-mono text-xs">{h.model}</div>
              <div className="text-[11px] text-muted-foreground">{h.clusterId}</div>
            </div>
            {h.headroomPct !== null ? (
              <div className="text-right">
                <div
                  className={`tnum font-mono text-[15px] ${
                    h.headroomPct < TIGHT_PCT ? "text-warn" : "text-foreground"
                  }`}
                >
                  {Math.round(h.headroomPct)}%
                </div>
                <div className="text-[10px] uppercase tracking-[0.07em] text-muted-foreground">
                  headroom
                </div>
              </div>
            ) : (
              <span className="text-[11px] text-muted-foreground">not established</span>
            )}
          </div>

          {h.headroomPct !== null && (
            <div className="mt-3">
              <Bar headroomPct={h.headroomPct} />
              <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
                <span className="tnum">
                  now {Math.round(h.currentReqPerMin)}/min · p95 {Math.round(h.currentP95Ms)}ms
                </span>
                <span className="tnum">
                  {h.safeUpToReqPerMin !== null && `held target to ${Math.round(h.safeUpToReqPerMin)}/min`}
                  {h.breachesAtReqPerMin !== null &&
                    ` · missed it at ${Math.round(h.breachesAtReqPerMin)}`}
                </span>
              </div>
            </div>
          )}

          <div className="mt-3.5 border-l-2 border-border pl-3">
            <DrainVerdict h={h} />
          </div>

          {/* The provenance line. A capacity claim with no stated basis is an
              opinion, and this one is asking somebody to act. */}
          <p className="mt-2.5 text-[11px] text-muted-foreground/80">{h.basis}</p>
        </div>
      ))}
    </div>
  )
}
