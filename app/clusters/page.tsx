import { MainLayout } from "@/components/main-layout"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ClusterTopologyMap } from "@/components/clusters/cluster-topology-map"
import { ClusterHealthCards } from "@/components/clusters/cluster-health-cards"
import { ClusterGeoMap } from "@/components/clusters/cluster-geo-map"
import { ClusterSearch } from "@/components/clusters/cluster-search"

export default function ClustersPage() {
  return (
    <MainLayout>
      <ScrollArea className="h-[calc(100vh-4rem)]">
        <div className="container space-y-6 py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-3xl font-bold tracking-tight">Multi-Cluster View</h1>
            <ClusterSearch />
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="col-span-3 rounded-lg border bg-card shadow-sm md:col-span-2">
              <div className="p-6">
                <h2 className="mb-4 text-xl font-semibold">Topology Map</h2>
                <ClusterTopologyMap />
              </div>
            </div>
            <div className="col-span-3 rounded-lg border bg-card p-6 shadow-sm md:col-span-1">
              <h2 className="mb-4 text-xl font-semibold">Cluster Health</h2>
              <ClusterHealthCards />
            </div>
          </div>

          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold">Geographic Distribution</h2>
            <ClusterGeoMap />
          </div>
        </div>
      </ScrollArea>
    </MainLayout>
  )
}
