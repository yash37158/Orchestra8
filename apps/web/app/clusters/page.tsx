import { AlertTriangle } from "lucide-react"

import { MainLayout } from "@/components/main-layout"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Fleet } from "@/components/clusters/fleet"
import { getClusters } from "@/lib/api/clusters"

export const dynamic = "force-dynamic"

export default async function ClustersPage() {
  const result = await getClusters()

  return (
    <MainLayout>
      <ScrollArea className="h-[calc(100vh-3.5rem)]">
        <div className="container max-w-[1400px] space-y-5 py-6">
          <div className="flex items-baseline justify-between">
            <h1 className="text-lg font-semibold tracking-tight">Multi-cluster view</h1>
            {result.ok && (
              <span className="tnum text-xs text-muted-foreground">
                updated {new Date(result.data.generatedAt).toLocaleTimeString()}
              </span>
            )}
          </div>

          {result.ok ? (
            <Fleet data={result.data} />
          ) : (
            <div className="rounded-md border border-crit/25 bg-crit-surface px-5 py-4">
              <div className="mb-1 flex items-center gap-2 text-crit">
                <AlertTriangle className="h-4 w-4" />
                <h2 className="text-sm font-semibold">Fleet unavailable</h2>
              </div>
              <p className="text-sm text-muted-foreground">{result.error}</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </MainLayout>
  )
}
