import { AlertTriangle } from "lucide-react"

import { MainLayout } from "@/components/main-layout"
import { Dashboard } from "@/components/dashboard"
import { getDashboard } from "@/lib/api/dashboard"
import { getInference } from "@/lib/api/pages"

// Server component: the fetch happens on the server, the contract is validated
// there, and components receive data already known to be the right shape.
// No client-side data library, no loading spinner, no useEffect.
export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  // Fetched together: two independent reads, one round of latency.
  const [result, inference] = await Promise.all([getDashboard(), getInference()])

  return (
    <MainLayout>
      {result.ok ? (
        <Dashboard data={result.data} inference={inference.ok ? inference.data : null} />
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
