import { Activity, AlertTriangle, CheckCircle2, Cpu, XCircle } from "lucide-react"
import type { ActivityEvent } from "@orchestr8/contracts"

const ICONS = {
  deployment: { icon: CheckCircle2, color: "text-ok" },
  scaling: { icon: Activity, color: "text-chart-1" },
  security: { icon: AlertTriangle, color: "text-warn" },
  error: { icon: XCircle, color: "text-crit" },
  inference: { icon: Cpu, color: "text-chart-4" },
} as const

function relative(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  return hrs < 24 ? `${hrs} hour${hrs > 1 ? "s" : ""} ago` : `${Math.round(hrs / 24)}d ago`
}

export function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No activity in this window.</p>
  }
  return (
    <div className="space-y-3.5">
      {events.map((event) => {
        const { icon: Icon, color } = ICONS[event.kind]
        return (
          <div key={event.id} className="flex items-start gap-2.5">
            <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${color}`} />
            <div className="min-w-0 space-y-0.5">
              <p className="text-[13px] font-medium leading-tight">{event.title}</p>
              <p className="truncate text-xs text-muted-foreground" title={event.description}>{event.description}</p>
              <p className="text-xs text-muted-foreground">
                {relative(event.at)}
                {event.correlationId && (
                  <span className="ml-2 rounded bg-primary/12 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    explained
                  </span>
                )}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
