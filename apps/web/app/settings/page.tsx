import { Check, GitBranch, X } from "lucide-react"

import { MainLayout } from "@/components/main-layout"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Panel, NotWired, ErrorState } from "@/components/panel"
import { getConfig } from "@/lib/api/pages"

export const dynamic = "force-dynamic"

function ago(iso: string | null) {
  if (!iso) return "never"
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 2) return "just now"
  if (m < 90) return `${m} min ago`
  return `${Math.round(m / 60)}h ago`
}

function Row({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/50 px-4 py-2 last:border-0">
      <span className={`text-[13px] ${mono ? "font-mono text-xs" : ""}`}>{k}</span>
      <span className="tnum text-[13px] text-muted-foreground">{v}</span>
    </div>
  )
}

export default async function SettingsPage() {
  const result = await getConfig()

  return (
    <MainLayout>
      <ScrollArea className="h-[calc(100vh-3.5rem)]">
        <div className="container max-w-[1400px] space-y-5 py-6">
          <div className="flex items-baseline justify-between">
            <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
            {/* Saying where configuration lives is the point. Values are edited
                as reviewable commits, not through a form with no audit trail. */}
            <span className="text-xs text-muted-foreground">configuration lives in <code>config/</code> in the repo</span>
          </div>

          {!result.ok && <ErrorState title="Configuration unavailable" error={result.error} />}

          {result.ok && (
            <>
              <Panel title="Connected clusters" meta="listed from telemetry, not a registry">
                {result.data.clusters.length === 0 ? (
                  <NotWired what="No clusters reporting" needs="Connect one from /onboarding." />
                ) : (
                  result.data.clusters.map((c) => (
                    <Row key={c.id} k={c.id} mono v={`${c.gpuCount} GPU(s) · last seen ${ago(c.lastSeenAt)}`} />
                  ))
                )}
              </Panel>

              <Panel title="Service level objectives" meta="config/slos.json">
                <Row k="Default p95 TTFT" v={`${result.data.slos.defaultTtftP95Ms} ms`} />
                {Object.entries(result.data.slos.models).map(([m, v]) => (
                  <Row key={m} k={m} mono v={`${v} ms`} />
                ))}
              </Panel>

              <Panel title="Alert routing" meta="config/notifications.json">
                <Row k="Deep-link base URL" v={result.data.notifications.publicUrl || "not set"} />
                {result.data.notifications.destinations.map((d) => (
                  <Row
                    key={d.id}
                    k={d.id}
                    mono
                    v={
                      <span className="inline-flex items-center gap-2">
                        <span>{d.kind} · ≥{d.minSeverity}</span>
                        {d.enabled && d.configured ? (
                          <span className="inline-flex items-center gap-1 text-ok"><Check className="h-3 w-3" />active</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <X className="h-3 w-3" />
                            {d.configured ? "disabled" : "no endpoint"}
                          </span>
                        )}
                      </span>
                    }
                  />
                ))}
              </Panel>

              <Panel title="GPU rates" meta="config/gpu-rates.json">
                <Row k="Default" v={`${result.data.gpuRates.defaultPerHour} ${result.data.gpuRates.currency}/hr`} />
                {Object.entries(result.data.gpuRates.rates)
                  .sort((a, b) => b[1] - a[1])
                  .map(([model, rate]) => (
                    <Row key={model} k={model} mono v={`${rate} ${result.data.gpuRates.currency}/hr`} />
                  ))}
              </Panel>

              <Panel title="GitOps">
                <Row
                  k="Repository"
                  mono
                  v={
                    <span className="inline-flex items-center gap-2">
                      <GitBranch className="h-3 w-3" />
                      {result.data.gitops.repo}
                    </span>
                  }
                />
                <Row
                  k="Status"
                  v={
                    result.data.gitops.reachable ? (
                      <span className="text-ok">reachable · on {result.data.gitops.branch}</span>
                    ) : (
                      <span className="text-warn">not reachable</span>
                    )
                  }
                />
              </Panel>
            </>
          )}

          <Panel title="Access control">
            <NotWired
              what="No authentication is configured"
              needs="Actions are attributed from an X-Orchestr8-Actor header, which anyone can set. The audit log proves nobody edited history; it proves nothing about who wrote it. Real identity must be wired before the ledger is relied on."
            />
          </Panel>
        </div>
      </ScrollArea>
    </MainLayout>
  )
}
