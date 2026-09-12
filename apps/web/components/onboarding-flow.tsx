"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Check, Copy, Loader2, Thermometer } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  connectCluster, onboardingStatus, setSLO,
  type ComponentStatus, type ConnectResponse, type OnboardingStatus,
} from "@/lib/api/onboarding"

const STEPS = ["Name the cluster", "Install the collector", "First signal", "Set a target"] as const

function StepRail({ current }: { current: number }) {
  return (
    <ol className="mb-8 flex flex-wrap gap-x-6 gap-y-2">
      {STEPS.map((s, i) => (
        <li key={s} className="flex items-center gap-2 text-[13px]">
          <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${
            i < current ? "bg-ok/15 text-ok" : i === current ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            {i < current ? <Check className="h-3 w-3" /> : i + 1}
          </span>
          <span className={i === current ? "font-medium" : "text-muted-foreground"}>{s}</span>
        </li>
      ))}
    </ol>
  )
}

function ComponentRow({ c }: { c: ComponentStatus }) {
  const ok = c.state === "ok"
  return (
    <li className="flex gap-3 border-t border-border/60 py-3 first:border-t-0 first:pt-0">
      {ok
        ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-ok" />
        : <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
      <div className="min-w-0">
        <p className="text-[13px] font-medium">{c.name}</p>
        <p className="text-xs text-muted-foreground">{c.detail}</p>
        {/* The hint is the whole point of this screen: a spinner tells the
            operator nothing, "no DCGM metrics" tells them what to install. */}
        {!ok && c.hint && (
          <p className="mt-1.5 rounded border border-border/60 bg-muted/30 px-2 py-1.5 font-mono text-[11px] leading-relaxed text-muted-foreground">
            {c.hint}
          </p>
        )}
      </div>
    </li>
  )
}

export function OnboardingFlow() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [clusterId, setClusterId] = useState("")
  const [namespace, setNamespace] = useState("orchestr8")
  const [conn, setConn] = useState<ConnectResponse | null>(null)
  const [status, setStatus] = useState<OnboardingStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [slo, setSloValue] = useState(1200)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const begin = async () => {
    setBusy(true); setError(null)
    try {
      setConn(await connectCluster(clusterId.trim().toLowerCase(), namespace.trim() || "orchestr8"))
      setStep(1)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start")
    } finally { setBusy(false) }
  }

  const poll = useCallback(async (id: string) => {
    try {
      const s = await onboardingStatus(id)
      setStatus(s)
      if (s.connected) setStep((cur) => (cur === 1 ? 2 : cur))
    } catch { /* keep polling; a transient failure is not worth a scary banner */ }
  }, [])

  // Poll only while the install screen is open, and stop the moment telemetry
  // lands — a timer left running behind a finished step is a memory leak and a
  // pointless load on the API.
  useEffect(() => {
    if (step !== 1 || !conn) return
    void poll(conn.clusterId)
    timer.current = setInterval(() => void poll(conn.clusterId), 4000)
    return () => { if (timer.current) clearInterval(timer.current) }
  }, [step, conn, poll])

  const copy = async () => {
    if (!conn) return
    try {
      await navigator.clipboard.writeText(conn.command)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    } catch { setError("Clipboard blocked — select the command and copy it manually.") }
  }

  const finish = async () => {
    setBusy(true); setError(null)
    try {
      const model = status?.firstSignal ? "default" : "default"
      await setSLO(model, slo)
      router.push("/dashboard")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the target")
    } finally { setBusy(false) }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <StepRail current={step} />

      {step === 0 && (
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold tracking-tight">Name the cluster</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              This becomes the label on every metric from it, so pick something you will recognise in a list.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cid" className="text-xs">Cluster ID</Label>
              <Input id="cid" value={clusterId} placeholder="gcp-us-central1" autoFocus
                     onChange={(e) => setClusterId(e.target.value)} className="font-mono text-xs" />
              <p className="text-[11px] text-muted-foreground">lowercase letters, digits and hyphens</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ns" className="text-xs">Namespace</Label>
              <Input id="ns" value={namespace} onChange={(e) => setNamespace(e.target.value)}
                     className="font-mono text-xs" />
            </div>
          </div>
          {error && <p className="text-xs text-crit">{error}</p>}
          <Button size="sm" onClick={begin} disabled={!clusterId.trim() || busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </section>
      )}

      {step === 1 && conn && (
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold tracking-tight">Install the collector</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Run this against the cluster you want to watch. It installs a read-only agent on each GPU node.
            </p>
          </div>

          <div className="relative">
            <pre className="overflow-x-auto rounded-md border bg-muted/30 p-3 pr-12 font-mono text-[11px] leading-relaxed">
{conn.command}
            </pre>
            <Button size="sm" variant="ghost" onClick={copy} className="absolute right-1.5 top-1.5 h-7 px-2">
              {copied ? <Check className="h-3.5 w-3.5 text-ok" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>

          <div className="rounded-md border bg-card px-4 py-3">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Waiting for telemetry
            </p>
            <ul>
              {(status?.components ?? []).map((c) => <ComponentRow key={c.id} c={c} />)}
              {!status && <li className="py-2 text-xs text-muted-foreground">Checking…</li>}
            </ul>
          </div>

          {error && <p className="text-xs text-crit">{error}</p>}
          <p className="text-xs text-muted-foreground">
            This screen updates itself. Nothing to click — it moves on as soon as the first GPU reports.
          </p>
        </section>
      )}

      {step === 2 && status?.firstSignal && (
        <section className="space-y-5">
          <div>
            <h2 className="text-base font-semibold tracking-tight">Connected</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              This is your hardware, reporting live.
            </p>
          </div>
          {/* The activation moment: their own GPU's real temperature. */}
          <div className="rounded-md border border-ok/30 bg-ok-surface px-5 py-4">
            <div className="flex items-center gap-2 text-ok">
              <Thermometer className="h-4 w-4" />
              <span className="text-[11px] font-medium uppercase tracking-[0.08em]">First signal</span>
            </div>
            <p className="tnum mt-2 text-[28px] font-semibold leading-none">
              {status.firstSignal.tempC}°C
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              <span className="font-mono text-xs">{status.firstSignal.nodeName}</span>
              {status.firstSignal.model && <> · {status.firstSignal.model}</>}
            </p>
          </div>
          <Button size="sm" onClick={() => setStep(3)}>
            Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </section>
      )}

      {step === 3 && (
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold tracking-tight">Set a target</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              How slow is too slow? Every alert and every correlation compares against this number.
            </p>
          </div>
          <div className="max-w-xs space-y-1.5">
            <Label htmlFor="slo" className="text-xs">p95 time-to-first-token (ms)</Label>
            <Input id="slo" type="number" min={10} max={60000} value={slo}
                   onChange={(e) => setSloValue(Number(e.target.value) || 1200)} className="tnum" />
            <p className="text-[11px] text-muted-foreground">
              1200ms is a reasonable default for interactive chat. Embedding services are usually far tighter.
            </p>
          </div>
          {error && <p className="text-xs text-crit">{error}</p>}
          <Button size="sm" onClick={finish} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Finish
          </Button>
        </section>
      )}
    </div>
  )
}
