"use client"

import { CpuIcon, Server, ZapIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

// Mock data for the cluster health cards
const clusters = [
  {
    id: "aws-us-east-1",
    name: "AWS US East",
    status: "healthy",
    costPerHour: "$1.25",
    nodeCount: 12,
    uptime: 99.99,
    cpu: 65,
    memory: 72,
  },
  {
    id: "aws-eu-west-1",
    name: "AWS EU West",
    status: "healthy",
    costPerHour: "$1.05",
    nodeCount: 8,
    uptime: 99.95,
    cpu: 42,
    memory: 58,
  },
  {
    id: "gcp-us-central1",
    name: "GCP US Central",
    status: "degraded",
    costPerHour: "$0.85",
    nodeCount: 6,
    uptime: 98.75,
    cpu: 88,
    memory: 76,
  },
  {
    id: "edge-mumbai",
    name: "Edge Mumbai",
    status: "healthy",
    costPerHour: "$0.45",
    nodeCount: 3,
    uptime: 99.8,
    cpu: 35,
    memory: 42,
  },
  {
    id: "edge-berlin",
    name: "Edge Berlin",
    status: "healthy",
    costPerHour: "$0.55",
    nodeCount: 4,
    uptime: 99.9,
    cpu: 28,
    memory: 51,
  },
  {
    id: "edge-london",
    name: "Edge London",
    status: "offline",
    costPerHour: "$0.50",
    nodeCount: 4,
    uptime: 0.0,
    cpu: 0,
    memory: 0,
  },
]

export function ClusterHealthCards() {
  return (
    <div className="space-y-4">
      {clusters.map((cluster) => (
        <Card key={cluster.id} className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`h-3 w-3 rounded-full ${
                    cluster.status === "healthy"
                      ? "bg-green-500"
                      : cluster.status === "degraded"
                        ? "bg-amber-500"
                        : "bg-red-500"
                  }`}
                />
                <span className="font-medium">{cluster.name}</span>
              </div>
              <span
                className={`text-xs font-medium ${
                  cluster.status === "healthy"
                    ? "text-green-500"
                    : cluster.status === "degraded"
                      ? "text-amber-500"
                      : "text-red-500"
                }`}
              >
                {cluster.status.charAt(0).toUpperCase() + cluster.status.slice(1)}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div>
                <div className="text-muted-foreground">Cost/hr</div>
                <div className="font-medium">{cluster.costPerHour}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Nodes</div>
                <div className="font-medium">{cluster.nodeCount}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Uptime</div>
                <div className="font-medium">{cluster.uptime}%</div>
              </div>
            </div>

            {cluster.status !== "offline" && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <CpuIcon className="h-3 w-3 text-muted-foreground" />
                    <span>CPU</span>
                  </div>
                  <span>{cluster.cpu}%</span>
                </div>
                <Progress value={cluster.cpu} className="h-1.5" />

                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <Server className="h-3 w-3 text-muted-foreground" />
                    <span>Memory</span>
                  </div>
                  <span>{cluster.memory}%</span>
                </div>
                <Progress value={cluster.memory} className="h-1.5" />
              </div>
            )}

            <div className="mt-3 flex justify-between gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="outline" className="w-full text-xs">
                      <Server className="mr-1 h-3 w-3" />
                      Inspect Pods
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>View all pods in this cluster</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs"
                      disabled={cluster.status === "offline"}
                    >
                      <ZapIcon className="mr-1 h-3 w-3" />
                      Inject Chaos
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Run chaos engineering tests</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
