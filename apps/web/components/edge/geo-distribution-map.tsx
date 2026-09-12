"use client"

import { useEffect, useRef, useState } from "react"
import * as d3 from "d3"
import * as topojson from "topojson-client"
import { Activity, AlertTriangle, ArrowRight, Clock, Wifi, WifiOff } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EdgeNodeDetails } from "@/components/edge/edge-node-details"

// Mock data for edge nodes
const edgeNodes = [
  {
    id: "edge-mum-01",
    name: "Mumbai Edge 01",
    location: "Mumbai, IN",
    coordinates: [72.8777, 19.076],
    status: "online",
    lastSync: "2 mins ago",
    cpu: 45,
    memory: 62,
    bandwidth: 7.2,
    maxBandwidth: 10,
    storage: 68,
    region: "Asia Pacific",
    latency: 32,
    signalStrength: 85,
    firmware: "v2.3.4",
    pendingSyncs: 0,
  },
  {
    id: "edge-mum-02",
    name: "Mumbai Edge 02",
    location: "Mumbai, IN",
    coordinates: [72.8677, 19.066],
    status: "online",
    lastSync: "5 mins ago",
    cpu: 38,
    memory: 55,
    bandwidth: 6.5,
    maxBandwidth: 10,
    storage: 72,
    region: "Asia Pacific",
    latency: 35,
    signalStrength: 82,
    firmware: "v2.3.4",
    pendingSyncs: 2,
  },
  {
    id: "edge-ber-01",
    name: "Berlin Edge 01",
    location: "Berlin, DE",
    coordinates: [13.405, 52.52],
    status: "online",
    lastSync: "1 min ago",
    cpu: 32,
    memory: 48,
    bandwidth: 5.8,
    maxBandwidth: 10,
    storage: 45,
    region: "Europe",
    latency: 28,
    signalStrength: 90,
    firmware: "v2.3.4",
    pendingSyncs: 0,
  },
  {
    id: "edge-ber-02",
    name: "Berlin Edge 02",
    location: "Berlin, DE",
    coordinates: [13.415, 52.53],
    status: "offline",
    lastSync: "2 hours ago",
    cpu: 0,
    memory: 0,
    bandwidth: 0,
    maxBandwidth: 10,
    storage: 65,
    region: "Europe",
    latency: 0,
    signalStrength: 0,
    firmware: "v2.3.3",
    pendingSyncs: 15,
  },
  {
    id: "edge-nyc-01",
    name: "New York Edge 01",
    location: "New York, US",
    coordinates: [-74.006, 40.7128],
    status: "online",
    lastSync: "3 mins ago",
    cpu: 65,
    memory: 72,
    bandwidth: 8.5,
    maxBandwidth: 10,
    storage: 58,
    region: "North America",
    latency: 25,
    signalStrength: 88,
    firmware: "v2.3.4",
    pendingSyncs: 0,
  },
  {
    id: "edge-nyc-02",
    name: "New York Edge 02",
    location: "New York, US",
    coordinates: [-74.016, 40.7138],
    status: "online",
    lastSync: "7 mins ago",
    cpu: 58,
    memory: 65,
    bandwidth: 7.8,
    maxBandwidth: 10,
    storage: 62,
    region: "North America",
    latency: 27,
    signalStrength: 86,
    firmware: "v2.3.4",
    pendingSyncs: 1,
  },
  {
    id: "edge-syd-01",
    name: "Sydney Edge 01",
    location: "Sydney, AU",
    coordinates: [151.2093, -33.8688],
    status: "online",
    lastSync: "4 mins ago",
    cpu: 42,
    memory: 58,
    bandwidth: 6.2,
    maxBandwidth: 10,
    storage: 55,
    region: "Asia Pacific",
    latency: 45,
    signalStrength: 78,
    firmware: "v2.3.4",
    pendingSyncs: 0,
  },
  {
    id: "edge-sao-01",
    name: "São Paulo Edge 01",
    location: "São Paulo, BR",
    coordinates: [-46.6333, -23.5505],
    status: "online",
    lastSync: "8 mins ago",
    cpu: 52,
    memory: 68,
    bandwidth: 7.5,
    maxBandwidth: 10,
    storage: 72,
    region: "South America",
    latency: 52,
    signalStrength: 75,
    firmware: "v2.3.4",
    pendingSyncs: 3,
  },
  {
    id: "edge-lon-01",
    name: "London Edge 01",
    location: "London, UK",
    coordinates: [-0.1278, 51.5074],
    status: "offline",
    lastSync: "1 hour ago",
    cpu: 0,
    memory: 0,
    bandwidth: 0,
    maxBandwidth: 10,
    storage: 70,
    region: "Europe",
    latency: 0,
    signalStrength: 0,
    firmware: "v2.3.3",
    pendingSyncs: 12,
  },
  {
    id: "edge-sin-01",
    name: "Singapore Edge 01",
    location: "Singapore, SG",
    coordinates: [103.8198, 1.3521],
    status: "online",
    lastSync: "5 mins ago",
    cpu: 48,
    memory: 62,
    bandwidth: 6.8,
    maxBandwidth: 10,
    storage: 65,
    region: "Asia Pacific",
    latency: 38,
    signalStrength: 82,
    firmware: "v2.3.4",
    pendingSyncs: 0,
  },
]

// Group nodes by region
const nodesByRegion = edgeNodes.reduce(
  (acc, node) => {
    acc[node.region] = acc[node.region] || []
    acc[node.region].push(node)
    return acc
  },
  {} as Record<string, typeof edgeNodes>,
)

// Calculate summary statistics
const totalNodes = edgeNodes.length
const onlineNodes = edgeNodes.filter((node) => node.status === "online").length
const offlineNodes = totalNodes - onlineNodes
const avgLatency = Math.round(
  edgeNodes.filter((node) => node.status === "online").reduce((sum, node) => sum + node.latency, 0) / onlineNodes,
)
const totalBandwidth = edgeNodes
  .filter((node) => node.status === "online")
  .reduce((sum, node) => sum + node.bandwidth, 0)

export function GeoDistributionMap() {
  const svgRef = useRef<SVGSVGElement>(null)
  const [selectedNode, setSelectedNode] = useState<(typeof edgeNodes)[0] | null>(null)
  const [tooltipData, setTooltipData] = useState<{
    content: string
    x: number
    y: number
  } | null>(null)
  const [activeRegion, setActiveRegion] = useState<string | null>(null)

  useEffect(() => {
    if (!svgRef.current) return

    const width = svgRef.current.clientWidth
    const height = 500

    // Clear previous content
    const svg = d3.select(svgRef.current)
    svg.selectAll("*").remove()

    // Create a simple world map projection
    const projection = d3
      .geoMercator()
      .scale(width / 2 / Math.PI)
      .center([0, 20])
      .translate([width / 2, height / 2])

    const path = d3.geoPath().projection(projection)

    // Draw a simple world map outline
    d3.json("https://unpkg.com/world-atlas@2.0.2/countries-110m.json")
      .then((data: any) => {
        const countries = topojson.feature(data, data.objects.countries)

        // Draw countries
        svg
          .append("g")
          .selectAll("path")
          .data(countries.features)
          .enter()
          .append("path")
          .attr("d", path as any)
          .attr("fill", "hsl(var(--muted))")
          .attr("stroke", "hsl(var(--border))")
          .attr("stroke-width", 0.5)

        // Filter nodes by active region if set
        const filteredNodes = activeRegion ? edgeNodes.filter((node) => node.region === activeRegion) : edgeNodes

        // Add edge nodes
        const nodeGroups = svg
          .selectAll(".node")
          .data(filteredNodes)
          .enter()
          .append("g")
          .attr("class", "node")
          .attr("transform", (d) => {
            const [x, y] = projection(d.coordinates) || [0, 0]
            return `translate(${x}, ${y})`
          })
          .style("cursor", "pointer")
          .on("mouseover", (event, d) => {
            // Pulse animation
            d3.select(event.currentTarget)
              .select("circle.pulse")
              .transition()
              .duration(300)
              .attr("r", 15)
              .attr("opacity", 0.3)
              .transition()
              .duration(300)
              .attr("r", 10)
              .attr("opacity", 0.6)

            setTooltipData({
              content: `<strong>${d.name}</strong><br>${d.location}<br>Status: ${d.status}<br>CPU: ${d.cpu}% | Memory: ${d.memory}%`,
              x: event.pageX,
              y: event.pageY,
            })
          })
          .on("mouseout", (event) => {
            d3.select(event.currentTarget)
              .select("circle.pulse")
              .transition()
              .duration(300)
              .attr("r", 12)
              .attr("opacity", 0.4)

            setTooltipData(null)
          })
          .on("click", (event, d) => {
            setSelectedNode(d)
          })

        // Add pulse circles
        nodeGroups
          .append("circle")
          .attr("class", "pulse")
          .attr("r", 12)
          .attr("fill", (d) => (d.status === "online" ? "#10B981" : "#EF4444"))
          .attr("opacity", 0.4)

        // Add node circles
        nodeGroups
          .append("circle")
          .attr("r", 5)
          .attr("fill", (d) => (d.status === "online" ? "#10B981" : "#EF4444"))
          .attr("stroke", "white")
          .attr("stroke-width", 1.5)

        // Add region labels for node clusters
        const regions = Object.keys(nodesByRegion)

        regions.forEach((region) => {
          const nodes = nodesByRegion[region]
          if (nodes.length === 0) return

          // Calculate average position for the region label
          const avgLon = nodes.reduce((sum, node) => sum + node.coordinates[0], 0) / nodes.length
          const avgLat = nodes.reduce((sum, node) => sum + node.coordinates[1], 0) / nodes.length

          const [x, y] = projection([avgLon, avgLat]) || [0, 0]

          // Add region label
          svg
            .append("text")
            .attr("x", x)
            .attr("y", y - 20)
            .attr("text-anchor", "middle")
            .attr("font-size", "12px")
            .attr("font-weight", "bold")
            .attr("fill", "currentColor")
            .text(`${region} (${nodes.length})`)
        })
      })
      .catch((error) => {
        console.error("Error loading map data:", error)
      })
  }, [activeRegion])

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Card className="border-blue-600/20 shadow-md shadow-blue-600/10">
          <CardHeader>
            <CardTitle className="text-sm font-semibold tracking-tight">Edge Node Distribution</CardTitle>
            <CardDescription>Geographic distribution of edge nodes across regions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Button
                variant={activeRegion === null ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveRegion(null)}
              >
                All Regions
              </Button>
              {Object.keys(nodesByRegion).map((region) => (
                <Button
                  key={region}
                  variant={activeRegion === region ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveRegion(region === activeRegion ? null : region)}
                >
                  {region}
                </Button>
              ))}
            </div>

            <div className="relative h-[500px] rounded-lg border">
              <svg ref={svgRef} width="100%" height="100%" className="rounded-lg"></svg>

              {tooltipData && (
                <div
                  className="absolute z-10 rounded-md border bg-card p-2 text-xs shadow-md"
                  style={{
                    left: `${tooltipData.x + 10}px`,
                    top: `${tooltipData.y - 80}px`,
                  }}
                  dangerouslySetInnerHTML={{ __html: tooltipData.content }}
                />
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-1">
                <div className="h-3 w-3 rounded-full bg-green-500"></div>
                <span>Online Node</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-3 w-3 rounded-full bg-red-500"></div>
                <span>Offline Node</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        {selectedNode ? (
          <EdgeNodeDetails node={selectedNode} onClose={() => setSelectedNode(null)} />
        ) : (
          <Card className="border-blue-600/20 shadow-md shadow-blue-600/10">
            <CardHeader>
              <CardTitle className="text-sm font-semibold tracking-tight">Edge Node Health</CardTitle>
              <CardDescription>Summary of edge node status and performance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold">{totalNodes}</div>
                    <div className="text-sm font-medium">Total Nodes</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-2xl font-bold text-green-500">{onlineNodes}</span>
                      <span className="text-2xl font-bold text-muted-foreground">/</span>
                      <span className="text-2xl font-bold text-red-500">{offlineNodes}</span>
                    </div>
                    <div className="text-sm font-medium">Online / Offline</div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>Average Latency</span>
                    </div>
                    <span className="font-medium">{avgLatency} ms</span>
                  </div>
                  <Progress value={avgLatency} max={100} className="h-2" />
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      <span>Bandwidth Usage</span>
                    </div>
                    <span className="font-medium">{totalBandwidth.toFixed(1)} GB/day</span>
                  </div>
                  <Progress value={totalBandwidth * 10} max={100} className="h-2" />
                </div>
              </div>

              <div className="rounded-md bg-blue-500/10 p-4 text-sm">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 text-blue-500" />
                  <div>
                    <p className="font-medium text-blue-500">Edge Node Insights</p>
                    <p className="mt-1">
                      {offlineNodes > 0
                        ? `${offlineNodes} nodes are currently offline. Check connectivity in the Europe region.`
                        : "All edge nodes are online and functioning properly."}
                    </p>
                    <Button variant="link" size="sm" className="mt-2 h-auto p-0 text-blue-500">
                      View Detailed Report
                      <ArrowRight className="ml-1 h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>

              <Tabs defaultValue="status">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="status">Status</TabsTrigger>
                  <TabsTrigger value="firmware">Firmware</TabsTrigger>
                </TabsList>

                <TabsContent value="status" className="space-y-4 pt-4">
                  <div className="space-y-2">
                    {Object.entries(nodesByRegion).map(([region, nodes]) => {
                      const regionOnline = nodes.filter((n) => n.status === "online").length
                      const regionOffline = nodes.length - regionOnline

                      return (
                        <div key={region} className="flex items-center justify-between rounded-md border p-2">
                          <span className="font-medium">{region}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-green-500/10 text-green-500">
                              <Wifi className="mr-1 h-3 w-3" />
                              {regionOnline}
                            </Badge>
                            {regionOffline > 0 && (
                              <Badge variant="outline" className="bg-red-500/10 text-red-500">
                                <WifiOff className="mr-1 h-3 w-3" />
                                {regionOffline}
                              </Badge>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </TabsContent>

                <TabsContent value="firmware" className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between rounded-md border p-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">v2.3.4</span>
                        <Badge variant="outline" className="bg-green-500/10 text-green-500">
                          Latest
                        </Badge>
                      </div>
                      <span>{edgeNodes.filter((n) => n.firmware === "v2.3.4").length} nodes</span>
                    </div>

                    <div className="flex items-center justify-between rounded-md border p-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">v2.3.3</span>
                        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500">
                          Outdated
                        </Badge>
                      </div>
                      <span>{edgeNodes.filter((n) => n.firmware === "v2.3.3").length} nodes</span>
                    </div>

                    <Button size="sm" className="mt-2 w-full gap-1.5">
                      <ArrowRight className="h-4 w-4" />
                      Push Firmware Update
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
