import { MainLayout } from "@/components/main-layout"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { GeoDistributionMap } from "@/components/edge/geo-distribution-map"
import { EdgeNodeGrid } from "@/components/edge/edge-node-grid"
import { BandwidthOptimization } from "@/components/edge/bandwidth-optimization"
import { OfflineSyncQueue } from "@/components/edge/offline-sync-queue"
import { EdgeConnectivityHealth } from "@/components/edge/edge-connectivity-health"

export default function EdgePage() {
  return (
    <MainLayout>
      <ScrollArea className="h-[calc(100vh-4rem)]">
        <div className="container space-y-6 py-6">
          <h1 className="text-3xl font-bold tracking-tight">Edge Nodes</h1>

          <Tabs defaultValue="map" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="map">Geo-Distribution</TabsTrigger>
              <TabsTrigger value="nodes">Edge Nodes</TabsTrigger>
              <TabsTrigger value="bandwidth">Bandwidth</TabsTrigger>
              <TabsTrigger value="sync">Sync Queue</TabsTrigger>
              <TabsTrigger value="connectivity">Connectivity</TabsTrigger>
            </TabsList>

            <TabsContent value="map" className="space-y-6">
              <GeoDistributionMap />
            </TabsContent>

            <TabsContent value="nodes" className="space-y-6">
              <EdgeNodeGrid />
            </TabsContent>

            <TabsContent value="bandwidth" className="space-y-6">
              <BandwidthOptimization />
            </TabsContent>

            <TabsContent value="sync" className="space-y-6">
              <OfflineSyncQueue />
            </TabsContent>

            <TabsContent value="connectivity" className="space-y-6">
              <EdgeConnectivityHealth />
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </MainLayout>
  )
}
