import type { ReactNode } from "react"
import { Info } from "lucide-react"

export function Panel({
  title, meta, children,
}: { title: string; meta?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-md border bg-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {meta && <span className="text-xs text-muted-foreground">{meta}</span>}
      </div>
      {children}
    </section>
  )
}

/**
 * Shown where a feature has no data source wired up yet.
 *
 * It names what is missing and what would supply it, rather than rendering an
 * empty chart. An empty chart is indistinguishable from a healthy one, which
 * is the failure mode this whole product exists to remove.
 */
export function NotWired({ what, needs }: { what: string; needs: string }) {
  return (
    <div className="flex gap-3 px-4 py-5">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-sm font-medium">{what}</p>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">{needs}</p>
      </div>
    </div>
  )
}

export function ErrorState({ title, error }: { title: string; error: string }) {
  return (
    <div className="rounded-md border border-crit/25 bg-crit-surface px-5 py-4">
      <h2 className="mb-1 text-sm font-semibold text-crit">{title}</h2>
      <p className="text-sm text-muted-foreground">{error}</p>
    </div>
  )
}
