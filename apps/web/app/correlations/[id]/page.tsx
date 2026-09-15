import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ArrowRight } from "lucide-react"

import { MainLayout } from "@/components/main-layout"
import { ErrorState } from "@/components/panel"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sparkline } from "@/components/sparkline"
import { CorrelationActions } from "@/components/correlation-actions"
import { getCorrelation, getSeries } from "@/lib/api/correlations"
import type { Evidence } from "@orchestr8/contracts"

export const dynamic = "force-dynamic"

const CAUSE_LABEL: Record<string, string> = {
  gpu_thermal_throttle: "GPU thermal throttle",
  gpu_memory_pressure: "GPU memory pressure",
  kv_cache_saturation: "KV cache saturation",
  node_pressure: "Node pressure",
  xid_error: "GPU hardware fault (XID)",
  traffic_surge: "Traffic surge",
  model_rollout: "Model rollout",
  unknown: "Not determined",
}

// The symptom metric is an enum of four, and "ttft_p95: 2512" means nothing to
// somebody who did not write the engine.
const SYMPTOM_LABEL: Record<string, { name: string; unit: string }> = {
  ttft_p95: { name: "p95 time to first token", unit: "ms" },
  error_rate: { name: "error rate", unit: "%" },
  queue_depth: { name: "queue depth", unit: "" },
  tokens_per_second: { name: "throughput", unit: "tok/s" },
}

// Pinned locale: this renders on the server and hydrates on the client, and a
// separator that disagrees between the two is a hydration error.
const num = (n: number) =>
  n.toLocaleString("en-US", {
    // The contract allows error_rate here, which arrives as a fraction. Fixed
    // at 0 decimals it would render 0.03 as "0" — a silent lie on a page whose
    // whole job is to be checkable.
    maximumFractionDigits: Math.abs(n) < 1 ? 2 : Math.abs(n) < 10 ? 1 : 0,
  })

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })

/**
 * One evidence line, with the metric it cites drawn over the window the engine
 * examined. Fetched per item on the server so the reader can check the claim
 * instead of taking it on faith.
 */
async function EvidenceRow({ e, n, threshold }: { e: Evidence; n: number; threshold?: number }) {
  const series =
    e.metric && e.subject ? await getSeries(e.metric, e.subject, e.windowStart, e.windowEnd) : null
  const points = series?.ok ? series.data.points : null

  return (
    <li className="flex gap-4 px-5 py-5">
      <span className="tnum mt-0.5 shrink-0 font-mono text-[11px] text-muted-foreground/60">
        {String(n).padStart(2, "0")}
      </span>
      <div className="min-w-0 flex-1">
        <p className="max-w-3xl text-[13.5px] leading-relaxed text-foreground/90">{e.text}</p>
        {e.metric && (
          <p className="tnum mt-1.5 font-mono text-[11px] text-muted-foreground/70">
            {e.metric}
            {e.subject && ` · ${e.subject}`}
            {` · ${clock(e.windowStart)}–${clock(e.windowEnd)}`}
          </p>
        )}
        {points && points.length > 1 && (
          <div className="mt-3 max-w-2xl rounded-md border bg-background/40 px-3 pb-2 pt-3">
            <Sparkline
              points={points}
              threshold={threshold}
              unit={e.metric === "vllm:time_to_first_token_seconds" ? "ms" : ""}
              height={52}
            />
          </div>
        )}
      </div>
    </li>
  )
}

export default async function CorrelationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await getCorrelation(id)

  if (!result.ok && result.error === "not-found") notFound()

  if (!result.ok) {
    return (
      <MainLayout>
        <div className="container max-w-lg py-16">
          <ErrorState title="Correlation unavailable" error={result.error} />
        </div>
      </MainLayout>
    )
  }

  const c = result.data
  const isCritical = c.severity === "critical"
  const ttftThreshold = c.symptom.metric === "ttft_p95" ? c.symptom.threshold : undefined
  const sym = SYMPTOM_LABEL[c.symptom.metric] ?? { name: c.symptom.metric, unit: "" }
  const causeLabel = CAUSE_LABEL[c.cause.kind] ?? c.cause.kind
  const windowLabel = `${clock(c.windowStart)}–${clock(c.windowEnd)}`

  return (
    <MainLayout>
      <ScrollArea className="h-[calc(100vh-3.5rem)]">
        <div className="container max-w-[1400px] space-y-5 py-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Dashboard
          </Link>

          {/* The verdict, before anything else. Nobody arriving from a 3am page
              should have to scroll or click to find out what broke and why. */}
          <section
            className={`rounded-md border bg-card ${isCritical ? "state-rail-crit" : "state-rail-warn"}`}
          >
            <div className="px-6 pb-6 pt-5">
              <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span
                  className={`text-[10px] font-semibold uppercase tracking-[0.08em] ${
                    isCritical ? "text-crit" : "text-warn"
                  }`}
                >
                  {c.severity}
                </span>
                {c.status !== "open" && (
                  <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em] text-primary">
                    {c.status}
                  </span>
                )}
                <span className="text-[11px] text-muted-foreground">
                  <span className="tnum">{Math.round(c.confidence * 100)}%</span> confidence
                </span>
                <span className="tnum ml-auto font-mono text-[11px] text-muted-foreground/70">
                  {new Date(c.detectedAt).toLocaleString("en-US", {
                    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
                  })}{" "}
                  · window {windowLabel}
                </span>
              </div>

              <h1 className="display text-[28px] leading-[1.15]">{causeLabel}</h1>
              <p className="mt-2.5 max-w-3xl text-[14.5px] leading-relaxed text-muted-foreground">
                {c.summary}
              </p>
            </div>

            {/* Symptom and cause read as one sentence, because that pairing is
                the entire claim the product is making. Kept adjacent rather than
                pushed to opposite ends of the card — a stretched row reads as two
                unrelated facts. */}
            <div className="flex flex-wrap items-center gap-x-9 gap-y-4 border-t px-6 py-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Symptom
                </p>
                <p className="mt-1.5 flex items-baseline gap-1.5">
                  <span className={`tnum font-mono text-[22px] ${isCritical ? "text-crit" : "text-warn"}`}>
                    {num(c.symptom.observed)}
                    {sym.unit}
                  </span>
                  <span className="tnum text-[12px] text-muted-foreground">
                    vs {num(c.symptom.threshold)}{sym.unit} target
                  </span>
                </p>
                <p className="mt-1 text-[11.5px] text-muted-foreground">
                  {sym.name} · <span className="font-mono">{c.symptom.model}</span>
                </p>
              </div>

              <ArrowRight className="hidden h-4 w-4 shrink-0 text-muted-foreground/40 lg:block" />

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Cause
                </p>
                <p className="mt-1.5 text-[17px] font-medium leading-tight">{causeLabel}</p>
                <p className="mt-1 font-mono text-[11.5px] text-muted-foreground">
                  {c.cause.gpuUuid ? `${c.cause.gpuUuid} · ${c.cause.nodeName}` : c.cause.clusterId}
                </p>
              </div>
            </div>
          </section>

          {c.confidence < 0.6 && (
            <div className="rounded-md border border-warn/25 bg-warn-surface px-5 py-3.5">
              <p className="text-[13.5px] leading-relaxed">
                <span className="font-medium text-warn">Low confidence.</span>{" "}
                <span className="text-muted-foreground">
                  Treat this as a possible cause, not a diagnosis. The evidence below is what the engine
                  could and could not rule out.
                </span>
              </p>
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
            <section className="rounded-md border bg-card">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-5 py-3">
                <h2 className="text-sm font-semibold tracking-tight">Evidence</h2>
                <span className="tnum text-xs text-muted-foreground">
                  {c.cause.evidence.length} {c.cause.evidence.length === 1 ? "check" : "checks"} over{" "}
                  {windowLabel}
                </span>
              </div>
              {c.cause.evidence.length === 0 ? (
                <p className="px-5 py-5 text-sm text-muted-foreground">
                  The engine recorded no supporting signals for this window.
                </p>
              ) : (
                <ul className="divide-y">
                  {c.cause.evidence.map((e, i) => (
                    <EvidenceRow
                      key={i}
                      e={e}
                      n={i + 1}
                      threshold={e.metric === "vllm:time_to_first_token_seconds" ? ttftThreshold : undefined}
                    />
                  ))}
                </ul>
              )}
            </section>

            {/* Sticky: the way out of the incident stays on screen however far
                down the evidence the reader goes. */}
            <section className="rounded-md border bg-card lg:sticky lg:top-0">
              <div className="border-b px-5 py-3">
                <h2 className="text-sm font-semibold tracking-tight">Recommended action</h2>
              </div>
              <div className="space-y-4 px-5 py-4">
                <p className="text-[13.5px] leading-relaxed text-foreground/90">{c.recommendedAction}</p>
                <CorrelationActions id={c.id} status={c.status} />
              </div>
            </section>
          </div>
        </div>
      </ScrollArea>
    </MainLayout>
  )
}
