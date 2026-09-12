import { Lightbulb } from "lucide-react"

import { MainLayout } from "@/components/main-layout"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Panel, NotWired, ErrorState } from "@/components/panel"
import { getInference } from "@/lib/api/pages"

export const dynamic = "force-dynamic"

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
const usd2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 })
const usd4 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 4 })

export default async function AIPage() {
  const result = await getInference()

  return (
    <MainLayout>
      <ScrollArea className="h-[calc(100vh-3.5rem)]">
        <div className="container max-w-[1400px] space-y-5 py-6">
          <div className="flex items-baseline justify-between">
            <h1 className="text-lg font-semibold tracking-tight">Inference &amp; cost</h1>
            {result.ok && (
              <span className="tnum text-xs text-muted-foreground">
                {usd.format(result.data.totalCostPerDayUsd)}/day across the fleet
              </span>
            )}
          </div>

          {!result.ok && <ErrorState title="Inference data unavailable" error={result.error} />}

          {result.ok && (
            <>
              <Panel title="Per-model economics" meta="cost joined to serving performance">
                {result.data.models.length === 0 ? (
                  <NotWired
                    what="No inference services reporting"
                    needs="A serving pod must expose Prometheus metrics and carry the orchestr8.io/scrape annotation for the collector to pick it up."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                      <thead>
                        <tr className="border-b text-left text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
                          {["Cluster", "Model", "p95 TTFT", "Target", "Req/min", "GPUs", "Util", "Cost/hr", "Cost/1k req"].map((h) => (
                            <th key={h} className="whitespace-nowrap px-4 py-2 font-medium">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.data.models.map((m) => (
                          <tr key={m.clusterId + m.model} className="border-b border-border/50 last:border-0">
                            <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-muted-foreground">{m.clusterId}</td>
                            <td className="px-4 py-2 font-mono text-xs">{m.model}</td>
                            <td className={`tnum whitespace-nowrap px-4 py-2 font-medium ${m.withinSlo ? "" : "text-crit"}`}>
                              {m.ttftMsP95}ms
                            </td>
                            <td className="tnum whitespace-nowrap px-4 py-2 text-muted-foreground">{m.ttftSloMs}ms</td>
                            <td className="tnum whitespace-nowrap px-4 py-2 text-muted-foreground">{m.requestsPerMin}</td>
                            <td className="tnum px-4 py-2 text-muted-foreground">{m.gpuCount}</td>
                            <td className="tnum whitespace-nowrap px-4 py-2 text-muted-foreground">{m.gpuUtilizationPct}%</td>
                            <td className="tnum whitespace-nowrap px-4 py-2">{usd2.format(m.costPerHourUsd)}</td>
                            {/* The number that makes two models comparable when
                                they run on different hardware at different scale. */}
                            <td className="tnum whitespace-nowrap px-4 py-2">{usd4.format(m.costPerKRequestsUsd)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>

              <Panel
                title="Recommendations"
                meta={
                  result.data.recommendations.length > 0
                    ? `${usd.format(result.data.recommendations.reduce((a, r) => a + r.estimatedSavingUsdPerDay, 0))}/day identified`
                    : undefined
                }
              >
                {result.data.recommendations.length === 0 ? (
                  <div className="px-4 py-5 text-sm text-muted-foreground">
                    <Lightbulb className="mb-1 mr-1.5 inline h-4 w-4" />
                    Nothing to recommend. Every model is inside its SLO and no GPU is meaningfully idle — an
                    empty list here means the fleet is well-sized, not that the check did not run.
                  </div>
                ) : (
                  <ul className="divide-y divide-border/60">
                    {result.data.recommendations.map((r) => (
                      <li key={r.id} className="px-4 py-3.5">
                        <div className="mb-1 flex flex-wrap items-baseline gap-2">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                            {r.kind.replace(/_/g, " ")}
                          </span>
                          <span className="text-[13px] font-medium">{r.title}</span>
                          {r.estimatedSavingUsdPerDay > 0 && (
                            <span className="tnum ml-auto text-[13px] font-medium text-ok">
                              {usd.format(r.estimatedSavingUsdPerDay)}/day
                            </span>
                          )}
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground">{r.detail}</p>
                        <ul className="mt-2 space-y-0.5 border-l border-border pl-3">
                          {r.evidence.map((e) => (
                            <li key={e} className="text-xs text-muted-foreground">{e}</li>
                          ))}
                        </ul>
                        <p className="mt-2 text-xs font-medium text-primary">{r.action}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </>
          )}

          <Panel title="Model quality">
            <NotWired
              what="Deliberately out of scope"
              needs="Accuracy, drift and eval scores are model observability — a different product with a different buyer (Arize, Braintrust). This page covers cost and capacity, which is what a platform team acts on."
            />
          </Panel>
        </div>
      </ScrollArea>
    </MainLayout>
  )
}
