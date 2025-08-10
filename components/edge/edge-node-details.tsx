"use client"

import {
  Activity,
  ArrowRight,
  Clock,
  Cpu,
  Database,
  Download,
  HardDrive,
  RefreshCw,
  RotateCw,
  Terminal,
  Wifi,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface EdgeNodeDetailsProps {
  node: any
  onClose: () => void
}

export function EdgeNodeDetails({ node, onClose }: EdgeNodeDetailsProps) {
  return (
    <Card className="border-blue-600/20 shadow-md shadow-blue-600/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-semibold">{node.name}</CardTitle>
            <CardDescription>
              {node.location} • ID: {node.id}
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between rounded-md border p-3">
          <div className="flex items-center gap-3">
            <div className={`h-3 w-3 rounded-full ${node.status === "online" ? "bg-green-500" : "bg-red-500"}`}></div>
            <span className="font-medium capitalize">{node.status}</span>
          </div>
          <div className="text-sm text-muted-foreground">Last sync: {node.lastSync}</div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-1 flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-muted-foreground" />
                <span>CPU Usage</span>
              </div>
              <span className="font-medium">{node.cpu}%</span>
            </div>
            <Progress value={node.cpu} className="h-2" />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-muted-foreground" />
                <span>Memory Usage</span>
              </div>
              <span className="font-medium">{node.memory}%</span>
            </div>
            <Progress value={node.memory} className="h-2" />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <span>Bandwidth</span>
              </div>
              <span className="font-medium">
                {node.bandwidth} / {node.maxBandwidth} Mbps
              </span>
            </div>
            <Progress value={(node.bandwidth / node.maxBandwidth) * 100} className="h-2" />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-muted-foreground" />
                <span>Storage</span>
              </div>
              <span className="font-medium">{node.storage}%</span>
            </div>
            <Progress value={node.storage} className="h-2" />
          </div>
        </div>

        <Tabs defaultValue="details">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="connectivity">Connectivity</TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4 pt-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-md border p-2">
                <div className="text-xs text-muted-foreground">Region</div>
                <div className="font-medium">{node.region}</div>
              </div>

              <div className="rounded-md border p-2">
                <div className="text-xs text-muted-foreground">Firmware Version</div>
                <div className="font-medium">{node.firmware}</div>
              </div>

              <div className="rounded-md border p-2">
                <div className="text-xs text-muted-foreground">Pending Syncs</div>
                <div className="font-medium">{node.pendingSyncs}</div>
              </div>

              <div className="rounded-md border p-2">
                <div className="text-xs text-muted-foreground">Coordinates</div>
                <div className="font-medium">{node.coordinates.join(", ")}</div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="connectivity" className="space-y-4 pt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>Latency</span>
                  </div>
                  <span className="font-medium">{node.latency} ms</span>
                </div>
                <Progress value={node.latency} max={100} className="h-2" />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Wifi className="h-4 w-4 text-muted-foreground" />
                    <span>Signal Strength</span>
                  </div>
                  <span className="font-medium">{node.signalStrength}%</span>
                </div>
                <Progress value={node.signalStrength} className="h-2" />
              </div>
            </div>

            <div className="rounded-md border p-3">
              <h3 className="mb-2 text-sm font-medium">Connection Type</h3>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-blue-500/10 text-blue-500">
                  Primary: Fiber
                </Badge>
                <Badge variant="outline">Backup: 4G LTE</Badge>
              </div>
            </div>

            <div className="rounded-md border p-3">
              <h3 className="mb-2 text-sm font-medium">Network Status</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>Packet Loss</span>
                  <span className="font-medium">0.2%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Jitter</span>
                  <span className="font-medium">3.5 ms</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Uptime</span>
                  <span className="font-medium">99.8%</span>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="actions" className="space-y-4 pt-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <Button className="gap-1.5">
                <RefreshCw className="h-4 w-4" />
                Force Sync
              </Button>

              <Button className="gap-1.5">
                <RotateCw className="h-4 w-4" />
                Reboot Node
              </Button>

              <Button variant="outline" className="gap-1.5">
                <Terminal className="h-4 w-4" />
                View Logs
              </Button>

              <Button variant="outline" className="gap-1.5">
                <Download className="h-4 w-4" />
                Download Diagnostics
              </Button>
            </div>

            <div className="rounded-md border p-3">
              <h3 className="mb-2 text-sm font-medium">Advanced Actions</h3>
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start gap-1.5 text-xs">
                  <ArrowRight className="h-3.5 w-3.5" />
                  Update Firmware
                </Button>

                <Button variant="outline" size="sm" className="w-full justify-start gap-1.5 text-xs">
                  <ArrowRight className="h-3.5 w-3.5" />
                  Configure Network Settings
                </Button>

                <Button variant="outline" size="sm" className="w-full justify-start gap-1.5 text-xs text-red-500">
                  <ArrowRight className="h-3.5 w-3.5" />
                  Factory Reset
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
