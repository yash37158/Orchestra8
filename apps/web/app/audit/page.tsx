import { AlertTriangle, ShieldCheck, ShieldX } from "lucide-react"

import { MainLayout } from "@/components/main-layout"
import { ScrollArea } from "@/components/ui/scroll-area"
import { getAudit } from "@/lib/api/audit"

export const dynamic = "force-dynamic"

const OUTCOME: Record<string, string> = {
  allowed: "text-ok",
  denied: "text-warn",
  failed: "text-crit",
}

function summarise(detail: Record<string, unknown> | null): string {
  if (!detail) return ""
  const bits: string[] = []
  if (typeof detail.image === "string") bits.push(detail.image)
  if (typeof detail.branch === "string") bits.push(detail.branch)
  if (typeof detail.commit === "string") bits.push(String(detail.commit))
  if (typeof detail.blockers === "number" && detail.blockers > 0) bits.push(`${detail.blockers} blocker(s)`)
  if (typeof detail.critical === "number") bits.push(`${detail.critical} critical`)
  if (typeof detail.format === "string") bits.push(String(detail.format))
  if (typeof detail.error === "string") bits.push(String(detail.error))
  return bits.join(" · ")
}

export default async function AuditPage() {
  const { entries, verification, error } = await getAudit()

  return (
    <MainLayout>
      <ScrollArea className="h-[calc(100vh-3.5rem)]">
        <div className="container max-w-[1400px] space-y-5 py-6">
          <div className="flex items-baseline justify-between">
            <h1 className="text-lg font-semibold tracking-tight">Audit ledger</h1>
            <span className="text-xs text-muted-foreground">
              append-only · every write path records here
            </span>
          </div>

          {error && (
            <div className="rounded-md border border-crit/25 bg-crit-surface px-4 py-3">
              <div className="mb-1 flex items-center gap-2 text-crit">
                <AlertTriangle className="h-4 w-4" />
                <h2 className="text-sm font-semibold">Ledger unavailable</h2>
              </div>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          )}

          {/* Chain integrity is the headline, not a footnote: without it
              "append-only" is a promise rather than a verifiable property. */}
          {verification && (
            <div className={`flex items-start gap-3 rounded-md border px-4 py-3 ${
              verification.intact ? "border-ok/25 bg-ok-surface" : "border-crit/25 bg-crit-surface"}`}>
              {verification.intact
                ? <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ok" />
                : <ShieldX className="mt-0.5 h-4 w-4 shrink-0 text-crit" />}
              <div>
                <p className="text-sm">
                  <span className={`font-medium ${verification.intact ? "text-ok" : "text-crit"}`}>
                    {verification.intact ? "Hash chain intact." : "Hash chain broken."}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    {verification.intact
                      ? `${verification.entries} entries verified end to end. Any edit or deletion would break the chain.`
                      : `Entry ${verification.brokenAt}: ${verification.reason}`}
                  </span>
                </p>
              </div>
            </div>
          )}

          {entries.length === 0 && !error ? (
            <p className="text-sm text-muted-foreground">
              No entries yet. Deployments, scans, approvals and overrides all record here.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b bg-muted/30 text-left">
                    {["#", "Time", "Actor", "Action", "Subject", "Outcome", "Detail", "Hash"].map((h) => (
                      <th key={h} className="whitespace-nowrap px-3 py-2 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.seq} className="border-b border-border/50 last:border-0">
                      <td className="px-3 py-2 text-muted-foreground">{e.seq}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                        {new Date(e.at).toLocaleTimeString()}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">{e.actor}</td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{e.action}</td>
                      <td className="max-w-[200px] truncate px-3 py-2 font-mono text-xs" title={e.subject}>
                        {e.subject}
                      </td>
                      <td className={`whitespace-nowrap px-3 py-2 font-medium ${OUTCOME[e.outcome] ?? ""}`}>
                        {e.outcome}
                      </td>
                      <td className="max-w-[320px] truncate px-3 py-2 text-xs text-muted-foreground" title={summarise(e.detail)}>
                        {summarise(e.detail)}
                      </td>
                      <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground/70" title={e.hash}>
                        {e.hash.slice(0, 10)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </ScrollArea>
    </MainLayout>
  )
}
