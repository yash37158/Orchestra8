import type { GpuDevice } from "@orchestr8/contracts"

/**
 * The silicon, one row per device.
 *
 * Everything here was already being fetched and thrown away, which is how a
 * GPU observability dashboard ended up with no GPUs on it. Utilisation alone
 * is the least useful of these numbers — it says busy, not healthy. The three
 * that predict a latency incident are temperature, memory headroom and the
 * throttle flag, so they get the space.
 */

// Thresholds are the point of the colour, so they live in one place and are
// named. 84C is where an H100 starts clocking down; memory over 90% is where
// the KV cache stops growing and requests start queueing.
const TEMP_WARN = 78
const TEMP_CRIT = 84
const MEM_WARN = 0.85
const MEM_CRIT = 0.95

type Tone = "ok" | "warn" | "crit"

// Written out rather than interpolated: Tailwind generates classes by scanning
// source text, so a name built at runtime is a class that never gets emitted.
const TEXT: Record<Tone, string> = { ok: "text-muted-foreground", warn: "text-warn", crit: "text-crit" }
const FILL: Record<Tone, string> = { ok: "bg-foreground/45", warn: "bg-warn", crit: "bg-crit" }

function bar(pct: number, tone: Tone) {
  const fill = FILL[tone]
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className={`h-full rounded-full ${fill}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  )
}

export function GpuFleet({ gpus }: { gpus: GpuDevice[] }) {
  if (gpus.length === 0) {
    return (
      <p className="px-4 py-5 text-sm text-muted-foreground">
        No GPUs reporting. The agent scrapes pods labelled
        <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">app=dcgm-exporter</code>.
      </p>
    )
  }

  // Hottest first. On a healthy fleet the order barely changes; on a sick one
  // the device you need is already at the top. Ties break on identity so a
  // fleet sitting at one temperature does not reshuffle on every poll.
  const sorted = [...gpus].sort(
    (a, b) => b.temperatureC - a.temperatureC || a.clusterId.localeCompare(b.clusterId) || a.uuid.localeCompare(b.uuid),
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b text-left text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
            {["GPU", "Node", "Util", "Memory", "Temp", "Power", ""].map((h, i) => (
              <th key={i} className="whitespace-nowrap px-4 py-2 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((g) => {
            const memRatio = g.memoryTotalGb > 0 ? g.memoryUsedGb / g.memoryTotalGb : 0
            const memTone = memRatio >= MEM_CRIT ? "crit" : memRatio >= MEM_WARN ? "warn" : "ok"
            const tempTone = g.temperatureC >= TEMP_CRIT ? "crit" : g.temperatureC >= TEMP_WARN ? "warn" : "ok"
            // Keyed by cluster AND uuid: a GPU UUID is unique within a
            // cluster, not across the fleet, and React silently drops rows
            // whose keys collide. Same shape of bug as attributing a GPU to
            // the wrong cluster in the engine.
            return (
              <tr key={`${g.clusterId}/${g.uuid}`} className="border-b border-border/50 last:border-0">
                <td className="whitespace-nowrap px-4 py-2.5">
                  <div className="font-mono text-xs">{g.uuid}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {g.model}{g.migProfile ? ` · ${g.migProfile}` : ""}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-muted-foreground">
                  {g.nodeName}
                  <div className="text-[11px] text-muted-foreground/70">{g.clusterId}</div>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="tnum w-9 shrink-0 text-right text-xs">{Math.round(g.utilizationPct)}%</span>
                    <div className="w-16 shrink-0">{bar(g.utilizationPct, "ok")}</div>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="tnum w-20 shrink-0 text-right text-xs text-muted-foreground">
                      {g.memoryUsedGb.toFixed(0)}/{g.memoryTotalGb.toFixed(0)} GB
                    </span>
                    <div className="w-16 shrink-0">{bar(memRatio * 100, memTone)}</div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5">
                  <span className={`tnum text-xs ${TEXT[tempTone]}`}>
                    {g.temperatureC.toFixed(0)}°C
                  </span>
                </td>
                <td className="tnum whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">
                  {g.powerWatts.toFixed(0)} W
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right">
                  {/* Only shown when set. A row of green "OK" badges trains
                      people to stop reading the column. */}
                  {g.throttled && (
                    <span className="rounded border border-warn/40 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-warn">
                      throttling
                    </span>
                  )}
                  {g.xidErrors > 0 && (
                    <span className="ml-1.5 rounded border border-crit/40 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-crit">
                      {g.xidErrors} XID
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
