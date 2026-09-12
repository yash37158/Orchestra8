"use client"

import { useState } from "react"
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Check,
  Download,
  Gauge,
  RotateCw,
  Search,
  Wifi,
  WifiOff,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ConnectivityTimeline } from "@/components/edge/connectivity-timeline"
import { SignalStrengthWidget } from "@/components/edge/signal-strength-widget"

// Mock data for edge nodes
const edgeNodes = [
  {
    id: "edge-mum-01",
    name: "Mumbai Edge 01",
    location: "Mumbai, IN",
    status: "online",
    signalStrength: 85,
    connectionType: "Fiber",
    backupType: "4G LTE",
    latency: 32,
    packetLoss: 0.2,
    jitter: 3.5,
    uptime: 99.8,
  },
  {
    id: "edge-ber-01",
    name: "Berlin Edge 01",
    location: "Berlin, DE",
    status: "online",
    signalStrength: 90,
    connectionType: "Fiber",
    backupType: "5G",
    latency: 28,
    packetLoss: 0.1,
    jitter: 2.8,
    uptime: 99.9,
  },
  {
    id: "edge-ber-02",
    name: "Berlin Edge 02",
    location: "Berlin, DE",
    status: "offline",
    signalStrength: 0,
    connectionType: "Fiber",
    backupType: "4G LTE",
    latency: 0,
    packetLoss: 100,
    jitter: 0,
    uptime: 95.2,
  },
  {
    id: "edge-nyc-01",
    name: "New York Edge 01",
    location: "New York, US",
    status: "online",
    signalStrength: 88,
    connectionType: "Fiber",
    backupType: "5G",
    latency: 25,
    packetLoss: 0.3,
    jitter: 4.2,
    uptime: 99.7,
  },
  {
    id: "edge-lon-01",
    name: "London Edge 01",
    location: "London, UK",
    status: "offline",
    signalStrength: 0,
    connectionType: "Fiber",
    backupType: "4G LTE",
    latency: 0,
    packetLoss: 100,
    jitter: 0,
    uptime: 94.5,
  },
]

export function EdgeConnectivityHealth() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedNode, setSelectedNode] = useState<(typeof edgeNodes)[0] | null>(edgeNodes[0])
  const [timeframe, setTimeframe] = useState<"24h" | "7d" | "30d">("24h")

  // Filter nodes based on search query
  const filteredNodes = edgeNodes.filter((node) => {
    return (
      node.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      node.location.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })

  return (
    <div className="space-y-6">
      <Card className="border-blue-600/20 shadow-md shadow-blue-600/10">
        <CardHeader>
          <CardTitle className="text-sm font-semibold tracking-tight">Edge Node Connectivity</CardTitle>
          <CardDescription>Monitor connection health and uptime for edge nodes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search edge nodes..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={timeframe === "24h" ? "default" : "outline"}
                size="sm"
                onClick={() => setTimeframe("24h")}
              >
                24h
              </Button>
              <Button variant={timeframe === "7d" ? "default" : "outline"} size="sm" onClick={() => setTimeframe("7d")}>
                7d
              </Button>
              <Button
                variant={timeframe === "30d" ? "default" : "outline"}
                size="sm"
                onClick={() => setTimeframe("30d")}
              >
                30d
              </Button>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="md:col-span-1">
              <div className="space-y-2">
                {filteredNodes.map((node) => (
                  <Card
                    key={node.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedNode?.id === node.id ? "ring-2 ring-primary" : ""
                    }`}
                    onClick={() => setSelectedNode(node)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="font-medium">{node.name}</div>
                          <div className="text-xs text-muted-foreground">{node.location}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          {node.status === "online" ? (
                            <Badge variant="outline" className="bg-green-500/10 text-green-500">
                              <Wifi className="mr-1 h-3 w-3" />
                              Online
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-red-500/10 text-red-500">
                              <WifiOff className="mr-1 h-3 w-3" />
                              Offline
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div className="md:col-span-2">
              {selectedNode ? (
                <div className="space-y-6">
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Connectivity Timeline</CardTitle>
                        <Badge variant={selectedNode.status === "online" ? "outline" : "destructive"}>
                          {selectedNode.status === "online" ? (
                            <>
                              <Check className="mr-1 h-3 w-3" />
                              Connected
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="mr-1 h-3 w-3" />
                              Disconnected
                            </>
                          )}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <ConnectivityTimeline node={selectedNode} timeframe={timeframe} />
                    </CardContent>
                  </Card>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Signal Strength</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <SignalStrengthWidget node={selectedNode} />
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Connection Details</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <div className="text-xs text-muted-foreground">Primary Connection</div>
                            <div className="font-medium">{selectedNode.connectionType}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Backup Connection</div>
                            <div className="font-medium">{selectedNode.backupType}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Latency</div>
                            <div className="font-medium">{selectedNode.latency} ms</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Packet Loss</div>
                            <div className="font-medium">{selectedNode.packetLoss}%</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Jitter</div>
                            <div className="font-medium">{selectedNode.jitter} ms</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Uptime</div>
                            <div className="font-medium">{selectedNode.uptime}%</div>
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                            <ArrowRight className="h-3.5 w-3.5" />
                            View Detailed Metrics
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ) : (
                <Card className="flex h-full flex-col items-center justify-center border-dashed p-8 text-center">
                  <Wifi className="mb-2 h-12 w-12 text-muted-foreground" />
                  <h3 className="text-lg font-medium">Select an edge node</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Select an edge node to view detailed connectivity information
                  </p>
                </Card>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-blue-600/20 shadow-md shadow-blue-600/10">
        <CardHeader>
          <CardTitle className="text-sm font-semibold tracking-tight">Network Diagnostics</CardTitle>
          <CardDescription>Run diagnostics and troubleshoot connectivity issues</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Diagnostic Tools</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start gap-1.5 text-sm">
                  <Activity className="h-4 w-4" />
                  Run Network Speed Test
                </Button>
                <Button variant="outline" className="w-full justify-start gap-1.5 text-sm">
                  <Gauge className="h-4 w-4" />
                  Check Latency & Packet Loss
                </Button>
                <Button variant="outline" className="w-full justify-start gap-1.5 text-sm">
                  <RotateCw className="h-4 w-4" />
                  Test Failover Connection
                </Button>
                <Button variant="outline" className="w-full justify-start gap-1.5 text-sm">
                  <Download className="h-4 w-4" />
                  Download Diagnostic Report
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Recent Connectivity Events</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between rounded-md border p-2">
                  <div className="flex items-center gap-2">
                    <WifiOff className="h-4 w-4 text-red-500" />
                    <span className="text-sm">edge-lon-01 disconnected</span>
                  </div>
                  <span className="text-xs text-muted-foreground">1 hour ago</span>
                </div>

                <div className="flex items-center justify-between rounded-md border p-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm">edge-nyc-01 high latency</span>
                  </div>
                  <span className="text-xs text-muted-foreground">3 hours ago</span>
                </div>

                <div className="flex items-center justify-between rounded-md border p-2">
                  <div className="flex items-center gap-2">
                    <Wifi className="h-4 w-4 text-green-500" />
                    <span className="text-sm">edge-ber-01 connection restored</span>
                  </div>
                  <span className="text-xs text-muted-foreground">5 hours ago</span>
                </div>

                <div className="flex items-center justify-between rounded-md border p-2">
                  <div className="flex items-center gap-2">
                    <WifiOff className="h-4 w-4 text-red-500" />
                    <span className="text-sm">edge-ber-02 disconnected</span>
                  </div>
                  <span className="text-xs text-muted-foreground">2 days ago</span>
                </div>

                <div className="flex justify-end">
                  <Button variant="link" size="sm" className="gap-1.5 text-xs">
                    View All Events
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
