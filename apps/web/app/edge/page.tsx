import { MainLayout } from "@/components/main-layout"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Panel, NotWired } from "@/components/panel"
import { getClusters } from "@/lib/api/clusters"

export const dynamic = "force-dynamic"

export default async function EdgePage() {
  const result = await getClusters()
  const edge = result.ok ? result.data.clusters.filter((c) => c.provider === "edge") : []

  return (
    <MainLayout>
      <ScrollArea className="h-[calc(100vh-3.5rem)]">
        <div className="container max-w-[1400px] space-y-5 py-6">
          <h1 className="text-lg font-semibold tracking-tight">Edge nodes</h1>

          {edge.length > 0 ? (
            <Panel title="Edge clusters">
              {edge.map((c) => (
                <div key={c.id} className="flex justify-between border-b border-border/50 px-4 py-2 last:border-0">
                  <span className="font-mono text-[13px]">{c.id}</span>
                  <span className="tnum text-[13px] text-muted-foreground">
                    {c.nodeCount} node(s) · {c.gpuCount} GPU(s) · {c.avgUtilizationPct}%
                  </span>
                </div>
              ))}
            </Panel>
          ) : (
            <Panel title="Edge fleet">
              {/* This page previously rendered five tabs of invented data: a
                  world map, bandwidth charts, a sync queue and connectivity
                  timelines, none of it backed by anything. An honest empty
                  state is worth more than a convincing fiction. */}
              <NotWired
                what="No edge clusters connected"
                needs={
                  "An edge cluster is one whose id begins with edge-. Connect it the same way as any other, " +
                  "from /onboarding — the collector chart is identical. Intermittent-connectivity features " +
                  "(offline sync queues, bandwidth shaping, conflict resolution) are not built: whether edge " +
                  "inference is in scope at all is still an open question in the PRD."
                }
              />
            </Panel>
          )}
        </div>
      </ScrollArea>
    </MainLayout>
  )
}
