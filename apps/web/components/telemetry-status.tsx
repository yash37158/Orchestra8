import { AlertTriangle, Radio } from "lucide-react"

const STALE_AFTER_SECONDS = 120

function ago(seconds: number) {
  if (seconds < 90) return `${Math.round(seconds)}s ago`
  const mins = Math.round(seconds / 60)
  if (mins < 90) return `${mins} min ago`
  return `${Math.round(mins / 60)}h ago`
}

/**
 * Freshness banner. Two distinct states, deliberately not merged:
 *
 *   null      — telemetry has never arrived. A new install, not an outage.
 *               The fix is an install command, so say that.
 *   stale     — it arrived and stopped. Everything on the page is a frozen
 *               snapshot that still looks healthy, which is the single most
 *               dangerous way an observability tool can fail.
 *
 * Silence is the third state, and it is the only one that renders nothing.
 */
export function TelemetryStatus({ lastTelemetryAt }: { lastTelemetryAt: string | null }) {
  if (lastTelemetryAt === null) {
    return (
      <div className="rounded-lg border border-warn/25 bg-warn-surface p-5">
        <div className="mb-1 flex items-center gap-2 text-warn">
          <Radio className="h-4 w-4" />
          <h2 className="text-sm font-semibold">No telemetry yet</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          The API is reachable but no collector has reported. Check that the OpenTelemetry collector
          is running and that a DCGM exporter is reachable on your GPU nodes.
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          Locally: <code className="rounded bg-muted px-1 py-0.5">make devkit</code> starts the
          device simulator on <code className="rounded bg-muted px-1 py-0.5">:9400</code>.
        </p>
      </div>
    )
  }

  const ageSeconds = (Date.now() - new Date(lastTelemetryAt).getTime()) / 1000
  if (ageSeconds < STALE_AFTER_SECONDS) return null

  return (
    <div className="flex items-start gap-3 rounded-lg border border-warn/25 bg-warn-surface px-4 py-3">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
      <p className="text-sm">
        <span className="font-medium text-warn">Telemetry is stale.</span>{" "}
        <span className="text-muted-foreground">
          Last signal {ago(ageSeconds)}. Every figure below is a frozen snapshot from that moment,
          not current state.
        </span>
      </p>
    </div>
  )
}
