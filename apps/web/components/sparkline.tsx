/** Pinned locale so server and client agree, and no seconds: this label sits
 *  under a live chart and a ticking third digit reflows it every second. */
const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })

/**
 * Inline SVG sparkline. No chart library: this draws one polyline from at most
 * a few dozen points, and pulling in a charting dependency for that would cost
 * more than it returns.
 *
 * The threshold line is the point of the whole component — a latency curve
 * without its SLO drawn on it does not tell you whether anything is wrong.
 */
export function Sparkline({
  points,
  threshold,
  unit = "",
  height = 40,
  // Off for an inline spark in a table cell or a KPI card, where the numbers
  // are already on the row and a second copy under a 26px line just collides
  // with itself. On where the chart stands alone and has to be readable.
  labels = true,
}: {
  points: { t: string; v: number }[]
  threshold?: number
  unit?: string
  height?: number
  labels?: boolean
}) {
  if (points.length < 2) {
    return <p className="text-xs text-muted-foreground">Not enough data in this window to plot.</p>
  }

  const values = points.map((p) => p.v)
  const lo = Math.min(...values, threshold ?? Infinity)
  const hi = Math.max(...values, threshold ?? -Infinity)
  const span = hi - lo || 1
  const pad = span * 0.1
  const min = lo - pad
  const max = hi + pad

  const W = 320
  const x = (i: number) => (i / (points.length - 1)) * W
  const y = (v: number) => height - ((v - min) / (max - min)) * height

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ")
  const breached = threshold !== undefined && values.some((v) => v > threshold)

  return (
    <div className="space-y-1">
      {/* The rendered height follows the prop. It used to set only the viewBox
          while a fixed class pinned the box at 40px, so every caller that asked
          for a shorter spark silently got the tall one. */}
      <svg viewBox={`0 0 ${W} ${height}`} style={{ height }} className="w-full" preserveAspectRatio="none" role="img"
           aria-label={`${points.length} points from ${values[0]}${unit} to ${values[values.length - 1]}${unit}`}>
        {threshold !== undefined && y(threshold) >= 0 && y(threshold) <= height && (
          <line x1="0" y1={y(threshold)} x2={W} y2={y(threshold)}
                stroke="currentColor" strokeWidth="1" strokeDasharray="3,3" className="text-crit/50" />
        )}
        <path d={path} fill="none" strokeWidth="1.5" vectorEffect="non-scaling-stroke"
              stroke="currentColor" className={breached ? "text-warn" : "text-chart-1"} />
      </svg>
      {labels && <div className="tnum flex justify-between text-[10px] text-muted-foreground">
        <span>{hhmm(points[0].t)}</span>
        <span className="font-mono">
          {values[0].toFixed(0)}{unit} → {values[values.length - 1].toFixed(0)}{unit}
          {threshold !== undefined && <span className="ml-2 text-crit/80">target {threshold}{unit}</span>}
        </span>
        <span>{hhmm(points[points.length - 1].t)}</span>
      </div>}
    </div>
  )
}
