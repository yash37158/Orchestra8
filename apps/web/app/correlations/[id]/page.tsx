import Link from "next/link"
import { notFound } from "next/navigation"
import { AlertTriangle, ArrowLeft, Cpu, Gauge } from "lucide-react"

import { MainLayout } from "@/components/main-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

/**
 * One evidence line, with the metric it cites drawn over the window the engine
 * examined. Fetched per item on the server so the reader can check the claim
 * instead of taking it on faith.
 */
async function EvidenceRow({ e, threshold }: { e: Evidence; threshold?: number }) {
  const series =
    e.metric && e.subject ? await getSeries(e.metric, e.subject, e.windowStart, e.windowEnd) : null

  return (
    <li className="border-t border-border/60 py-4 first:border-t-0 first:pt-0">
      <p className="text-sm leading-relaxed">{e.text}</p>
      {e.metric && (
        <p className="mt-1 font-mono text-[11px] text-muted-foreground">
          {e.metric}
          {e.subject && ` · ${e.subject}`}
          {" · "}
          {new Date(e.windowStart).toLocaleTimeString()}–{new Date(e.windowEnd).toLocaleTimeString()}
        </p>
      )}
      {series?.ok && series.data.points && series.data.points.length > 1 && (
        <div className="mt-3 max-w-md">
          <Sparkline
            points={series.data.points}
            threshold={threshold}
            unit={e.metric === "vllm:time_to_first_token_seconds" ? "ms" : ""}
          />
        </div>
      )}
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
        <div className="container py-16">
          <div className="mx-auto max-w-lg rounded-lg border border-crit/25 bg-crit-surface p-6">
            <div className="mb-2 flex items-center gap-2 text-crit">
              <AlertTriangle className="h-5 w-5" />
              <h2 className="font-semibold">Correlation unavailable</h2>
            </div>
            <p className="text-sm text-muted-foreground">{result.error}</p>
          </div>
        </div>
      </MainLayout>
    )
  }

  const c = result.data
  const isCritical = c.severity === "critical"
  const ttftThreshold = c.symptom.metric === "ttft_p95" ? c.symptom.threshold : undefined

  return (
    <MainLayout>
      <ScrollArea className="h-[calc(100vh-3.5rem)]">
        <div className="container max-w-4xl space-y-6 py-8">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>

          {/* The answer, before anything else. Nobody arriving from a 3am page
              should have to scroll or click to find out what broke and why. */}
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className={`rounded px-2 py-0.5 text-[11px] font-semibold uppercase ${
                isCritical ? "bg-red-500/15 text-crit" : "bg-amber-500/15 text-warn"}`}>
                {c.severity}
              </span>
              <span className="rounded bg-muted px-2 py-0.5 text-[11px] font-medium">
                {CAUSE_LABEL[c.cause.kind] ?? c.cause.kind}
              </span>
              <span className="text-xs text-muted-foreground">{Math.round(c.confidence * 100)}% confidence</span>
              {c.status !== "open" && (
                <span className="rounded bg-primary/12 px-2 py-0.5 text-[11px] font-medium text-primary">{c.status}</span>
              )}
            </div>
            <h1 className="text-xl font-semibold leading-snug tracking-tight">{c.summary}</h1>
            <p className="mt-2 text-xs text-muted-foreground">
              Detected {new Date(c.detectedAt).toLocaleString()} · window{" "}
              {new Date(c.windowStart).toLocaleTimeString()}–{new Date(c.windowEnd).toLocaleTimeString()}
            </p>
          </div>

          {c.confidence < 0.6 && (
            <div className="rounded-lg border border-warn/25 bg-warn-surface px-4 py-3">
              <p className="text-sm">
                <span className="font-medium text-warn">Low confidence.</span>{" "}
                <span className="text-muted-foreground">
                  Treat this as a possible cause, not a diagnosis. The evidence below is what the engine could
                  and could not rule out.
                </span>
              </p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Symptom</CardTitle>
                <Gauge className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-crit">
                  {c.symptom.observed.toFixed(0)}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    vs {c.symptom.threshold.toFixed(0)} target
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {c.symptom.metric} · {c.symptom.model}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cause</CardTitle>
                <Cpu className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-lg font-semibold">{CAUSE_LABEL[c.cause.kind] ?? c.cause.kind}</div>
                <p className="text-xs text-muted-foreground">
                  {c.cause.gpuUuid ? `${c.cause.gpuUuid} · ${c.cause.nodeName}` : c.cause.clusterId}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Evidence</CardTitle>
            </CardHeader>
            <CardContent>
              <ul>
                {c.cause.evidence.map((e, i) => (
                  <EvidenceRow key={i} e={e} threshold={e.metric === "vllm:time_to_first_token_seconds" ? ttftThreshold : undefined} />
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recommended action</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-relaxed">{c.recommendedAction}</p>
              <CorrelationActions id={c.id} status={c.status} />
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </MainLayout>
  )
}
