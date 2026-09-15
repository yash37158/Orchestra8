"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowUpRight, FileDown, Loader2, Shield } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getScanTargetsAction, pollScanAction, startScanAction } from "@/app/scan-actions"
import type { ScanFinding, ScanProgress, ScanTarget } from "@orchestr8/contracts"

/**
 * Runs a real Trivy scan through the API and shows what it stored.
 *
 * This replaced a simulation: a five-second timer, a progress bar counting to
 * a number nothing measured, and four hardcoded 2023 CVEs against images this
 * platform does not run. It reported "2 critical issues found" on a fleet it
 * had never looked at. In a security tool that is worse than showing nothing,
 * because someone acts on it.
 *
 * Every run here is persisted by the API before it returns — including the
 * failures, which is why a failed scan renders its reason rather than an empty
 * table.
 */

// Trivy caches its advisory database, so a repeat scan finishes in under a
// second. Fixed at one decimal that renders as "0.0s", which reads as though
// nothing ran.
const secs = (ms?: number) => Math.round((ms ?? 0) / 1000)

const took = (ms: number) => (ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`)

const SEV_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN"]

const SEV_TONE: Record<string, string> = {
  CRITICAL: "text-crit",
  HIGH: "text-warn",
  MEDIUM: "text-muted-foreground",
  LOW: "text-muted-foreground",
}

/**
 * Severity first, then fixable, then package.
 *
 * Fixable outranks the package name because it is the only axis that changes
 * what you do next: a high with a published patch is a version bump, one
 * without is a conversation with whoever owns the dependency.
 */
function rank(findings: ScanFinding[]): ScanFinding[] {
  return [...findings].sort((a, b) => {
    const s = SEV_ORDER.indexOf(a.severity.toUpperCase()) - SEV_ORDER.indexOf(b.severity.toUpperCase())
    if (s !== 0) return s
    if (a.fixable !== b.fixable) return a.fixable ? -1 : 1
    return a.package.localeCompare(b.package) || a.vulnId.localeCompare(b.vulnId)
  })
}

function Count({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-md border bg-card px-3 py-2">
      <div className={`tnum font-mono text-[17px] ${value > 0 && tone ? tone : "text-foreground"}`}>{value}</div>
      <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </div>
    </div>
  )
}

function Finding({ f }: { f: ScanFinding }) {
  const tone = SEV_TONE[f.severity.toUpperCase()] ?? "text-muted-foreground"
  return (
    <li className="px-4 py-3.5">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className={`text-[10px] font-semibold uppercase tracking-[0.08em] ${tone}`}>{f.severity}</span>
        {f.primaryUrl ? (
          <a
            href={f.primaryUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="group inline-flex items-center gap-1 font-mono text-[12.5px] hover:text-primary"
          >
            {f.vulnId}
            <ArrowUpRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-70" />
          </a>
        ) : (
          <span className="font-mono text-[12.5px]">{f.vulnId}</span>
        )}
        <span className="ml-auto font-mono text-[11px] text-muted-foreground">
          {f.package} <span className="tnum">{f.installed}</span>
          {f.fixable && f.fixedVersion && (
            <>
              {" → "}
              <span className="tnum text-ok">{f.fixedVersion}</span>
            </>
          )}
        </span>
      </div>
      {f.title && (
        <p className="mt-1.5 max-w-prose text-[12.5px] leading-relaxed text-muted-foreground">{f.title}</p>
      )}
      {!f.fixable && (
        <p className="mt-1.5 text-[11px] text-muted-foreground/70">
          No fixed version published. Track the advisory or waive it with an expiry.
        </p>
      )}
    </li>
  )
}

export function SecurityScan() {
  const [open, setOpen] = useState(false)
  const [run, setRun] = useState<ScanProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [custom, setCustom] = useState("")
  const [customKind, setCustomKind] = useState<"filesystem" | "image">("image")
  const [targets, setTargets] = useState<ScanTarget[] | null>(null)
  const [targetsError, setTargetsError] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  const running = run?.status === "running"

  // Loaded when the menu is first opened rather than on mount: this component
  // sits in the nav on every page, and the list is only ever read here.
  const loadTargets = async () => {
    if (targets || targetsError) return
    const r = await getScanTargetsAction()
    if (r.ok) setTargets(r.targets)
    else setTargetsError(r.error)
  }

  // Polling lives here rather than inside start() so it survives a re-render
  // and stops cleanly on unmount. Two seconds: Trivy reports no progress of
  // its own, so this is only asking "are you done yet".
  const pollingId = run && run.status === "running" ? run.id : null
  useEffect(() => {
    if (!pollingId) return
    let live = true
    const tick = async () => {
      const r = await pollScanAction(pollingId)
      if (!live) return
      if (r.ok) setRun(r.progress)
      else {
        setError(r.error)
        setRun(null)
      }
    }
    const t = setInterval(tick, 2000)
    return () => {
      live = false
      clearInterval(t)
    }
  }, [pollingId])

  const start = async (label: string, target: string, kind: "filesystem" | "image") => {
    if (!target.trim()) return
    setMenuOpen(false)
    // The field kept its text after a scan started, so the next thing typed
    // into it appended: "alpine:3.18" then "alpine:3.14" became the target
    // "alpine:3.18alpine:3.14", which fails as an image reference and lands in
    // the history looking like a scanner problem.
    setCustom("")
    setError(null)
    setOpen(true)
    // Shown immediately so the drawer is never blank while the request is in
    // flight; the id arrives a moment later and the poll takes over.
    setRun({
      id: "", status: "running", target: target.trim(),
      elapsedMs: 0, critical: 0, high: 0, medium: 0, low: 0, fixable: 0,
      osEosl: false, findings: [],
    })
    const started = await startScanAction({ target: target.trim(), kind })
    if (!started.ok) {
      setRun(null)
      setError(started.error)
      return
    }
    setRun((cur) => (cur ? { ...cur, id: started.id } : cur))
  }

  const findings = run?.findings ? rank(run.findings) : []
  const total = findings.length

  return (
    <>
      {/* modal={false} for the same reason as the sheet: a modal dropdown
        * also pins pointer-events:none on the body, so leaving the sheet
        * non-modal while this stayed modal fixed nothing. */}
      <DropdownMenu
        modal={false}
        open={menuOpen}
        onOpenChange={(o) => {
          setMenuOpen(o)
          if (o) loadTargets()
        }}
      >
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={!!running}>
            {running ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Scanning <span className="tnum ml-1">{secs(run?.elapsedMs)}s</span>
              </>
            ) : (
              <>
                <Shield className="mr-2 h-4 w-4" />
                Security scan
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            Images this organisation has deployed. Every run is stored.
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {targetsError && (
            <p className="px-2 py-2 text-[11px] leading-relaxed text-crit">{targetsError}</p>
          )}

          {targets === null && !targetsError && (
            <p className="px-2 py-2 text-[11px] text-muted-foreground">Loading deployed images…</p>
          )}

          {targets?.length === 0 && (
            <p className="px-2 py-2 text-[11px] leading-relaxed text-muted-foreground">
              Nothing deployed through Orchestr8 yet, so there is no list to offer. Deploy a model and its
              image appears here — or scan any image by name below.
            </p>
          )}

          {targets?.map((t) => (
            <DropdownMenuItem
              key={t.image}
              onClick={() => start(t.image, t.image, "image")}
              className="flex-col items-start gap-0.5 py-2"
            >
              <span className="font-mono text-[11.5px]">{t.image}</span>
              <span className="text-[10px] text-muted-foreground">
                {t.app} · {t.clusterId}
              </span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <div
            className="px-2 py-1.5"
            // The menu closes on any click inside it, which would dismiss the
            // field the moment you tried to type in it.
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Any other image
            </label>
            <div className="mt-1.5 flex gap-1.5">
              <Input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") start(custom, custom, customKind)
                }}
                placeholder="vllm/vllm-openai:v0.9.0"
                className="h-8 font-mono text-xs"
              />
              <Button size="sm" className="h-8" disabled={!custom.trim()} onClick={() => start(custom, custom, customKind)}>
                Scan
              </Button>
            </div>
            <div className="mt-1.5 flex gap-1">
              {(["image", "filesystem"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setCustomKind(k)}
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                    customKind === k
                      ? "bg-primary/12 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Deliberately not modal.
        *
        * A scan of a model image runs for minutes, and a modal sheet sets
        * pointer-events:none on the body and locks scrolling for as long as it
        * is open — so starting a scan froze the whole dashboard behind it. The
        * panel reports on work happening on the server; it has no claim on the
        * rest of the page. Escape and the close button still dismiss it, and an
        * outside click deliberately does not, so a stray click on the page
        * behind cannot throw away a result that took ten minutes to get. */}
      <Sheet open={open} onOpenChange={setOpen} modal={false}>
        <SheetContent
          overlay={false}
          onInteractOutside={(e) => e.preventDefault()}
          className="flex w-full flex-col gap-0 border-l p-0 shadow-2xl sm:max-w-[42rem]"
        >
          <SheetHeader className="space-y-1 border-b px-6 py-4 text-left">
            <SheetTitle className="text-base">Security scan</SheetTitle>
            <SheetDescription className="font-mono text-[11px]">
              {run?.target ?? "—"}
            </SheetDescription>
          </SheetHeader>

          {running && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Scanning for <span className="tnum font-mono text-foreground">{secs(run?.elapsedMs)}s</span>
              </p>
              <p className="max-w-sm text-center text-[12px] leading-relaxed text-muted-foreground/70">
                Trivy reports no progress of its own until it finishes. A lockfile takes about 20 seconds; a
                model image it has to pull can take several minutes.
              </p>
              <p className="max-w-sm text-center text-[12px] leading-relaxed text-muted-foreground/70">
                This runs on the server — you can close this panel and the result will be waiting on the{" "}
                <Link href="/security" onClick={() => setOpen(false)} className="text-primary hover:underline">
                  security page
                </Link>
                .
              </p>
            </div>
          )}

          {error && !running && (
            <div className="px-6 py-5">
              <div className="rounded-md border border-crit/25 bg-crit-surface px-4 py-3">
                <div className="mb-1 flex items-center gap-2 text-crit">
                  <AlertTriangle className="h-4 w-4" />
                  <h3 className="text-sm font-semibold">Scan could not run</h3>
                </div>
                <p className="text-[13px] leading-relaxed text-muted-foreground">{error}</p>
              </div>
            </div>
          )}

          {run && !running && (
            <>
              <div className="space-y-4 border-b px-6 py-4">
                {run.status === "ok" && <div className="grid grid-cols-5 gap-2">
                  <Count label="Critical" value={run.critical} tone="text-crit" />
                  <Count label="High" value={run.high} tone="text-warn" />
                  <Count label="Medium" value={run.medium} />
                  <Count label="Low" value={run.low} />
                  <Count label="Fixable" value={run.fixable} tone="text-ok" />
                </div>}
                <p className="tnum font-mono text-[11px] text-muted-foreground/70">
                  {run.id} · {run.scanner ?? "trivy"} · {took(run.durationMs ?? 0)} · stored
                </p>
              </div>

              {run.status === "ok" && run.osEosl && total > 0 && (
                <div className="border-b bg-warn-surface px-6 py-3">
                  <p className="text-[12.5px] leading-relaxed">
                    <span className="font-medium text-warn">Incomplete.</span>{" "}
                    <span className="text-muted-foreground">
                      {run.osName || "This OS"} no longer receives security updates, so this list is only
                      what was known before the advisory feed stopped.
                    </span>
                  </p>
                </div>
              )}

              {run.status === "failed" ? (
                <div className="px-6 py-5">
                  <div className="rounded-md border border-crit/25 bg-crit-surface px-4 py-3">
                    <div className="mb-1 flex items-center gap-2 text-crit">
                      <AlertTriangle className="h-4 w-4" />
                      <h3 className="text-sm font-semibold">The scanner failed</h3>
                    </div>
                    <p className="text-[13px] leading-relaxed text-muted-foreground">
                      {run.error || "Trivy exited without a reason."}
                    </p>
                    <p className="mt-2 text-[12px] text-muted-foreground/70">
                      This is recorded as a failed scan, not a clean one.
                    </p>
                  </div>
                </div>
              ) : total === 0 ? (
                <div className="px-6 py-8 text-center">
                  {run.osEosl ? (
                    <>
                      <p className="text-sm font-medium text-warn">Nothing found, but nothing is watching</p>
                      <p className="mx-auto mt-1.5 max-w-md text-[12.5px] leading-relaxed text-muted-foreground">
                        {run.osName || "This OS"} is past its support window, so its vendor has stopped
                        publishing advisories. An empty result here means the feed ended, not that the image
                        is safe. Move to a supported base image before reading this as a pass.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-ok">No known vulnerabilities</p>
                      <p className="mx-auto mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-muted-foreground">
                        Trivy matched this target against its advisory database and found nothing. That is a
                        result, not an absence of one — it is stored and timestamped.
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <div className="flex items-baseline justify-between border-b px-6 py-2.5">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Findings
                    </h3>
                    <span className="tnum text-[11px] text-muted-foreground">
                      {total} · most severe first
                    </span>
                  </div>
                  <ul className="divide-y px-2">
                    {findings.map((f) => (
                      <Finding key={`${f.vulnId}/${f.package}/${f.installed}`} f={f} />
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 border-t px-6 py-3">
                {total > 0 && (
                  <>
                    <Button asChild variant="outline" size="sm">
                      <a href={`/api/scans/${encodeURIComponent(run.id)}/export?format=csv`}>
                        <FileDown className="mr-2 h-4 w-4" />
                        CSV
                      </a>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <a href={`/api/scans/${encodeURIComponent(run.id)}/export?format=sbom`}>
                        <FileDown className="mr-2 h-4 w-4" />
                        SBOM
                      </a>
                    </Button>
                  </>
                )}
                <Link
                  href="/security"
                  onClick={() => setOpen(false)}
                  className="ml-auto inline-flex items-center gap-1 text-[13px] text-primary hover:underline"
                >
                  All scans
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
