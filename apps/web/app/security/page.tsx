import { AlertTriangle, ExternalLink, ShieldCheck } from "lucide-react"

import { MainLayout } from "@/components/main-layout"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Panel, NotWired, ErrorState } from "@/components/panel"
import { getScans, getScanFindings } from "@/lib/api/pages"

export const dynamic = "force-dynamic"

const SEV: Record<string, string> = {
  CRITICAL: "text-crit", HIGH: "text-warn", MEDIUM: "text-muted-foreground", LOW: "text-muted-foreground",
}

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return "just now"
  if (m < 90) return `${m} min ago`
  const h = Math.round(m / 60)
  return h < 48 ? `${h}h ago` : `${Math.round(h / 24)}d ago`
}

export default async function SecurityPage() {
  const scans = await getScans()
  const latest = scans.ok ? scans.data.scans.find((s) => s.outcome === "ok") : undefined
  const findings = latest ? await getScanFindings(latest.id) : null
  const rows = findings?.ok ? (findings.data.findings ?? []) : []
  const fixable = rows.filter((f) => f.fixable).length

  return (
    <MainLayout>
      <ScrollArea className="h-[calc(100vh-3.5rem)]">
        <div className="container max-w-[1400px] space-y-5 py-6">
          <div className="flex items-baseline justify-between">
            <h1 className="text-lg font-semibold tracking-tight">Security</h1>
            {latest && <span className="text-xs text-muted-foreground">last scan {ago(latest.at)}</span>}
          </div>

          {!scans.ok && <ErrorState title="Scans unavailable" error={scans.error} />}

          {scans.ok && scans.data.scans.length === 0 && (
            <Panel title="Vulnerabilities">
              <NotWired
                what="No scans have been run"
                needs="Run one from the Security scan button, or POST a target to /v1/scans. Trivy scans container images, filesystems and git repos."
              />
            </Panel>
          )}

          {latest && (
            <>
              <div className="grid gap-3 sm:grid-cols-4">
                {[
                  { label: "Critical", value: latest.critical, tone: latest.critical > 0 ? "crit" : "ok" },
                  { label: "High", value: latest.high, tone: latest.high > 0 ? "warn" : "ok" },
                  { label: "Medium", value: latest.medium, tone: "none" },
                  { label: "Fixable", value: fixable, tone: "none" },
                ].map((t) => (
                  <div
                    key={t.label}
                    className={`rounded-md border bg-card px-4 py-3 ${
                      t.tone === "crit" ? "shadow-[inset_2px_0_0_0_hsl(var(--crit))]"
                      : t.tone === "warn" ? "shadow-[inset_2px_0_0_0_hsl(var(--warn))]" : ""}`}
                  >
                    <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                      {t.label}
                    </div>
                    <div className="tnum text-[22px] font-semibold leading-none">{t.value}</div>
                  </div>
                ))}
              </div>

              <Panel
                title="Findings"
                meta={
                  <span className="font-mono text-[11px]">
                    {latest.target} · {latest.id}
                  </span>
                }
              >
                {rows.length === 0 ? (
                  latest.osEosl ? (
                    <div className="px-4 py-5">
                      <p className="text-sm">
                        <AlertTriangle className="mb-0.5 mr-1 inline h-4 w-4 text-warn" />
                        <span className="font-medium text-warn">Empty, but not clean.</span>{" "}
                        <span className="text-muted-foreground">
                          This target runs an OS past its support window, so advisories for it are no longer
                          published. Nothing was found because nothing is being looked for.
                        </span>
                      </p>
                    </div>
                  ) : (
                  <div className="px-4 py-5 text-sm text-muted-foreground">
                    <ShieldCheck className="mb-1 inline h-4 w-4 text-ok" /> No findings at or above medium in this scan.
                  </div>
                  )
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                      <thead>
                        <tr className="border-b text-left text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
                          {["Vulnerability", "Severity", "Package", "Installed", "Fix", ""].map((h) => (
                            <th key={h} className="whitespace-nowrap px-4 py-2 font-medium">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((f) => (
                          <tr key={f.vulnId + f.package} className="border-b border-border/50 last:border-0">
                            <td className="whitespace-nowrap px-4 py-2 font-mono text-xs">{f.vulnId}</td>
                            <td className={`whitespace-nowrap px-4 py-2 text-[11px] font-semibold ${SEV[f.severity] ?? ""}`}>
                              {f.severity}
                            </td>
                            <td className="px-4 py-2 font-mono text-xs">{f.package}</td>
                            <td className="tnum whitespace-nowrap px-4 py-2 text-muted-foreground">{f.installed}</td>
                            <td className="px-4 py-2">
                              {f.fixable ? (
                                <span className="tnum text-ok">{f.fixedVersion.split(",")[0]}</span>
                              ) : (
                                <span className="text-muted-foreground">none published</span>
                              )}
                            </td>
                            <td className="px-4 py-2">
                              {f.primaryUrl && (
                                <a href={f.primaryUrl} target="_blank" rel="noreferrer"
                                   className="text-muted-foreground hover:text-foreground">
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>

              <Panel title="Scan history">
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <tbody>
                      {scans.ok && scans.data.scans.map((s) => (
                        <tr key={s.id} className="border-b border-border/50 last:border-0">
                          <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">{ago(s.at)}</td>
                          <td className="px-4 py-2 font-mono text-xs">{s.target}</td>
                          <td className="tnum whitespace-nowrap px-4 py-2">
                            {s.outcome === "failed" ? (
                              <span className="text-crit">did not run</span>
                            ) : (
                              <>
                                <span className={s.critical > 0 ? "text-crit" : "text-muted-foreground"}>{s.critical} crit</span>
                                <span className="mx-2 text-muted-foreground">·</span>
                                <span className={s.high > 0 ? "text-warn" : "text-muted-foreground"}>{s.high} high</span>
                                {s.osEosl && <span className="ml-2 text-warn" title="OS past its support window — the advisory feed for it has stopped">
                                  · unsupported OS
                                </span>}
                              </>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {s.outcome === "ok" && <>
                            <a href={`/api/scans/${s.id}/export?format=csv`}
                               className="text-xs text-primary hover:underline">CSV</a>
                            <span className="mx-1.5 text-muted-foreground">·</span>
                            <a href={`/api/scans/${s.id}/export?format=sbom`}
                               className="text-xs text-primary hover:underline">SBOM</a>
                            </>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </>
          )}

          <Panel title="Admission policy">
            <NotWired
              what="No admission controller connected"
              needs="Policy evaluation needs Kyverno or OPA Gatekeeper reachable from the collector. Until one is configured, deploy preflight reports this check as skipped rather than passed."
            />
          </Panel>

          <Panel title="Runtime threats">
            <NotWired
              what="No runtime sensor connected"
              needs="Runtime detection needs Falco streaming events into the collector. This is a live feed rather than a scan result, so it stays empty until that stream exists."
            />
          </Panel>
        </div>
      </ScrollArea>
    </MainLayout>
  )
}
