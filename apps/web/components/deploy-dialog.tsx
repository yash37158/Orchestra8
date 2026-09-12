"use client"

import { useState } from "react"
import { AlertTriangle, Check, GitBranch, Loader2, Minus, Rocket, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { deployAction, preflightAction } from "@/app/deploy-actions"
import type { Deployment, Preflight, PreflightCheck } from "@/lib/api/deploy"

const STATUS_ICON = {
  pass: { Icon: Check, cls: "text-ok" },
  fail: { Icon: X, cls: "text-crit" },
  warn: { Icon: AlertTriangle, cls: "text-warn" },
  skipped: { Icon: Minus, cls: "text-muted-foreground" },
} as const

function CheckRow({ c }: { c: PreflightCheck }) {
  const { Icon, cls } = STATUS_ICON[c.status]
  return (
    <li className="flex gap-2.5 border-t border-border/60 py-2.5 first:border-t-0 first:pt-0">
      <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${cls}`} />
      <div className="min-w-0">
        <p className="text-[13px] font-medium">
          {c.name}
          {c.blocking && c.status === "fail" && (
            <span className="ml-2 rounded bg-crit-surface px-1.5 py-0.5 text-[10px] font-semibold uppercase text-crit">
              blocking
            </span>
          )}
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">{c.detail}</p>
      </div>
    </li>
  )
}

/**
 * Deploy.
 *
 * This replaces a dialog whose outcome was decided by `Math.random() > 0.3`.
 * Nothing here is simulated: preflight reads live GPU telemetry and the open
 * correlations, and applying writes a commit to the GitOps repository. No
 * cluster is ever touched directly.
 */
export function DeployDialog() {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<null | "preflight" | "deploy">(null)
  const [pf, setPf] = useState<Preflight | null>(null)
  const [done, setDone] = useState<Deployment | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [app, setApp] = useState("llama-3.3-70b")
  const [clusterId, setClusterId] = useState("gcp-usc1")
  const [image, setImage] = useState("vllm/vllm-openai:v0.9.1")
  const [replicas, setReplicas] = useState(6)
  const [strategy, setStrategy] = useState("rolling")

  const input = { app, clusterId, image, replicas, strategy }

  const reset = () => { setPf(null); setDone(null); setError(null) }

  const check = async () => {
    setBusy("preflight"); setError(null); setDone(null)
    try { setPf(await preflightAction(input)) }
    catch (e) { setError(e instanceof Error ? e.message : "Preflight failed") }
    finally { setBusy(null) }
  }

  const deploy = async (approved: boolean) => {
    setBusy("deploy"); setError(null)
    try {
      const r = await deployAction({ ...input, approved })
      if (r.ok) setDone(r.deployment)
      else { setPf(r.preflight); setError("Preflight blocked this deploy.") }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Deploy failed")
    } finally { setBusy(null) }
  }

  return (
    <>
      <Button size="sm" onClick={() => { reset(); setOpen(true) }}>
        <Rocket className="mr-2 h-4 w-4" />
        Deploy
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Deploy</DialogTitle>
            <DialogDescription>
              Commits a manifest change to the GitOps repository. Orchestr8 never writes to a cluster.
            </DialogDescription>
          </DialogHeader>

          {done ? (
            <div className="space-y-3 py-2">
              <div className="flex items-center gap-2 text-ok">
                <Check className="h-4 w-4" />
                <p className="text-sm font-medium">Committed</p>
              </div>
              <dl className="space-y-1.5 rounded-md border bg-muted/30 p-3 text-xs">
                <div className="flex gap-2">
                  <dt className="w-16 shrink-0 text-muted-foreground">Branch</dt>
                  <dd className="flex items-center gap-1.5 font-mono">
                    <GitBranch className="h-3 w-3 text-muted-foreground" />
                    {done.branch}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-16 shrink-0 text-muted-foreground">Commit</dt>
                  <dd className="font-mono">{done.commit}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-16 shrink-0 text-muted-foreground">Image</dt>
                  <dd className="font-mono">{done.image}</dd>
                </div>
              </dl>
              <p className="text-xs text-muted-foreground">
                Merge the branch to roll it out. Nothing has changed in the cluster yet.
              </p>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="app" className="text-xs">Application</Label>
                  <Select value={app} onValueChange={(v) => { setApp(v); reset() }}>
                    <SelectTrigger id="app"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="llama-3.3-70b">llama-3.3-70b</SelectItem>
                      <SelectItem value="bge-large">bge-large</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cluster" className="text-xs">Cluster</Label>
                  <Select value={clusterId} onValueChange={(v) => { setClusterId(v); reset() }}>
                    <SelectTrigger id="cluster"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gcp-usc1">gcp-usc1</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="image" className="text-xs">Image</Label>
                <Input id="image" value={image} onChange={(e) => { setImage(e.target.value); reset() }}
                       className="font-mono text-xs" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="replicas" className="text-xs">Replicas</Label>
                  <Input id="replicas" type="number" min={1} max={64} value={replicas}
                         onChange={(e) => { setReplicas(Number(e.target.value) || 1); reset() }} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="strategy" className="text-xs">Strategy</Label>
                  <Select value={strategy} onValueChange={(v) => { setStrategy(v); reset() }}>
                    <SelectTrigger id="strategy"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rolling">Rolling</SelectItem>
                      <SelectItem value="canary">Canary</SelectItem>
                      <SelectItem value="blue-green">Blue-green</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {pf && (
                <div className="space-y-2">
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    Preflight
                  </p>
                  <ul className="rounded-md border bg-muted/20 px-3 py-2.5">
                    {pf.checks.map((c) => <CheckRow key={c.id} c={c} />)}
                  </ul>
                  {pf.diff && (
                    <pre className="max-h-28 overflow-auto rounded-md border bg-muted/20 p-2.5 font-mono text-[11px] leading-relaxed">
                      {pf.diff}
                    </pre>
                  )}
                </div>
              )}

              {error && <p className="text-xs text-crit">{error}</p>}
            </div>
          )}

          <DialogFooter className="gap-2">
            {done ? (
              <Button size="sm" onClick={() => setOpen(false)}>Close</Button>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
                {!pf ? (
                  <Button size="sm" onClick={check} disabled={busy !== null}>
                    {busy === "preflight" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Run preflight
                  </Button>
                ) : pf.canApply ? (
                  <Button size="sm" onClick={() => deploy(false)} disabled={busy !== null}>
                    {busy === "deploy" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Commit deploy
                  </Button>
                ) : (
                  // Overriding a blocking check is itself recorded in the audit
                  // log, with the checks that were overridden and by whom.
                  <Button size="sm" variant="destructive" onClick={() => deploy(true)} disabled={busy !== null}>
                    {busy === "deploy" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Override {pf.blockers} block{pf.blockers === 1 ? "" : "s"} and deploy
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
