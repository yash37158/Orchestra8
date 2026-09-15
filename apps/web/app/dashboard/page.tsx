import { AlertTriangle } from "lucide-react"

import { MainLayout } from "@/components/main-layout"
import { Dashboard } from "@/components/dashboard"
import { getDashboard } from "@/lib/api/dashboard"
import { getClusters } from "@/lib/api/clusters"
import { getHeadroom, getInference, getSeries } from "@/lib/api/pages"

// Server component: the fetch happens on the server, the contract is validated
// there, and components receive data already known to be the right shape.
// No client-side data library, no loading spinner, no useEffect.
export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  // Three independent reads, one round of latency.
  const [result, inference, clusters, headroom] = await Promise.all([
    getDashboard(), getInference(), getClusters(), getHeadroom(),
  ])

  // A second round, because the per-model trends cannot be requested until the
  // models are known. Worth the extra hop: a p95 without its own hour of
  // history reads as healthy right up to the moment it isn't.
  const models = inference.ok ? inference.data.models : []
  const [utilTrend, ...modelTrends] = await Promise.all([
    getSeries("DCGM_FI_DEV_GPU_UTIL", ""),
    ...models.map((m) => getSeries("vllm:time_to_first_token_seconds", m.model, m.clusterId)),
  ])
  const sloTrends = Object.fromEntries(
    models.map((m, i) => [`${m.clusterId}/${m.model}`, modelTrends[i] ?? []]),
  )

  return (
    <MainLayout>
      {result.ok ? (
        <Dashboard
          data={result.data}
          inference={inference.ok ? inference.data : null}
          clusters={clusters.ok ? clusters.data.clusters : []}
          headroom={headroom.ok ? (headroom.data.services ?? []) : []}
          utilTrend={utilTrend}
          sloTrends={sloTrends}
        />
      ) : (
        <div className="container py-16">
          <div className="mx-auto max-w-lg rounded-lg border border-red-500/30 bg-red-500/5 p-6">
            <div className="mb-2 flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-5 w-5" />
              <h2 className="font-semibold">Dashboard unavailable</h2>
            </div>
            <p className="text-sm text-muted-foreground">{result.error}</p>
            <p className="mt-4 text-xs text-muted-foreground">
              Start the API with <code className="rounded bg-muted px-1 py-0.5">make api</code>, or set{" "}
              <code className="rounded bg-muted px-1 py-0.5">ORCHESTR8_API_URL</code>.
            </p>
          </div>
        </div>
      )}
    </MainLayout>
  )
}
