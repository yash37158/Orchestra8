"use client"

import { useState } from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

// Generate mock data for the heatmap
const generateHeatmapData = () => {
  const clusters = ["payment-cluster", "analytics-cluster", "auth-cluster", "frontend-cluster"]
  const services = [
    "payment-service",
    "analytics-service",
    "auth-service",
    "frontend-service",
    "notification-service",
    "search-service",
    "recommendation-service",
    "checkout-service",
  ]

  const data = []

  for (const cluster of clusters) {
    for (const service of services) {
      // Skip some combinations to make it look more realistic
      if (
        (cluster === "payment-cluster" && service === "analytics-service") ||
        (cluster === "analytics-cluster" && service === "payment-service") ||
        (cluster === "auth-cluster" && service === "recommendation-service")
      ) {
        continue
      }

      // Generate CPU and memory usage values
      const cpuUsage = Math.floor(Math.random() * 100)
      const memoryUsage = Math.floor(Math.random() * 100)
      const podCount = Math.floor(Math.random() * 15) + 1

      // Calculate predicted values (slightly higher)
      const predictedCpuUsage = Math.min(100, cpuUsage + Math.floor(Math.random() * 30))
      const predictedMemoryUsage = Math.min(100, memoryUsage + Math.floor(Math.random() * 25))

      // Determine if this is a critical service that needs attention
      const isCritical = predictedCpuUsage > 85 || predictedMemoryUsage > 90

      data.push({
        cluster,
        service,
        cpuUsage,
        memoryUsage,
        predictedCpuUsage,
        predictedMemoryUsage,
        podCount,
        isCritical,
      })
    }
  }

  return data
}

export function ResourceAllocationHeatmap() {
  const [heatmapData, setHeatmapData] = useState(generateHeatmapData())
  const [selectedMetric, setSelectedMetric] = useState<"cpu" | "memory">("cpu")
  const [hoveredCell, setHoveredCell] = useState<any>(null)

  // Get unique clusters and services for the grid
  const clusters = Array.from(new Set(heatmapData.map((item) => item.cluster)))
  const services = Array.from(new Set(heatmapData.map((item) => item.service)))

  // Color scale function
  const getColor = (value: number, predicted = false) => {
    if (value < 50) {
      return predicted ? "bg-green-500/30" : "bg-green-500/80"
    } else if (value < 75) {
      return predicted ? "bg-yellow-500/30" : "bg-yellow-500/80"
    } else if (value < 90) {
      return predicted ? "bg-orange-500/30" : "bg-orange-500/80"
    } else {
      return predicted ? "bg-red-500/30" : "bg-red-500/80"
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            className={`rounded-md px-3 py-1 text-sm font-medium ${
              selectedMetric === "cpu" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
            }`}
            onClick={() => setSelectedMetric("cpu")}
          >
            CPU Usage
          </button>
          <button
            className={`rounded-md px-3 py-1 text-sm font-medium ${
              selectedMetric === "memory"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground"
            }`}
            onClick={() => setSelectedMetric("memory")}
          >
            Memory Usage
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Current</span>
          <div className="h-3 w-3 rounded-sm bg-green-500/80"></div>
          <span>Predicted</span>
          <div className="h-3 w-3 rounded-sm bg-green-500/30"></div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Header row with service names */}
          <div className="grid grid-cols-[150px_repeat(8,1fr)] gap-1">
            <div className="h-16 rounded-md bg-muted p-2 font-medium">Cluster / Service</div>
            {services.map((service) => (
              <div key={service} className="h-16 rounded-md bg-muted p-2 text-center text-xs font-medium">
                <div className="truncate">{service}</div>
              </div>
            ))}
          </div>

          {/* Data rows */}
          {clusters.map((cluster) => (
            <div key={cluster} className="grid grid-cols-[150px_repeat(8,1fr)] gap-1 py-1">
              <div className="rounded-md bg-muted p-2 text-xs font-medium">{cluster}</div>

              {services.map((service) => {
                const cell = heatmapData.find((item) => item.cluster === cluster && item.service === service)

                if (!cell) {
                  return <div key={`${cluster}-${service}`} className="rounded-md bg-muted/30 p-2"></div>
                }

                const currentValue = selectedMetric === "cpu" ? cell.cpuUsage : cell.memoryUsage
                const predictedValue = selectedMetric === "cpu" ? cell.predictedCpuUsage : cell.predictedMemoryUsage

                return (
                  <TooltipProvider key={`${cluster}-${service}`}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className={`relative flex h-16 cursor-pointer items-center justify-center rounded-md ${
                            cell.isCritical ? "ring-2 ring-red-500" : ""
                          }`}
                          onMouseEnter={() => setHoveredCell(cell)}
                          onMouseLeave={() => setHoveredCell(null)}
                        >
                          {/* Current usage bar */}
                          <div
                            className={`absolute bottom-0 left-0 right-0 ${getColor(currentValue)}`}
                            style={{ height: `${currentValue}%` }}
                          ></div>

                          {/* Predicted usage bar (outline) */}
                          <div
                            className={`absolute bottom-0 left-0 right-0 border-t-2 border-dashed ${getColor(predictedValue, true)}`}
                            style={{ height: `${predictedValue}%` }}
                          ></div>

                          {/* Pod count */}
                          <div className="absolute top-1 right-1 rounded-full bg-background px-1 text-[10px] font-medium">
                            {cell.podCount}
                          </div>

                          {/* Percentage */}
                          <div className="relative z-10 text-xs font-bold text-white drop-shadow-md">
                            {currentValue}%
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="w-64">
                        <div className="space-y-2">
                          <div className="font-medium">{service}</div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <div className="text-muted-foreground">Current CPU:</div>
                              <div>{cell.cpuUsage}%</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Predicted CPU:</div>
                              <div>{cell.predictedCpuUsage}%</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Current Memory:</div>
                              <div>{cell.memoryUsage}%</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Predicted Memory:</div>
                              <div>{cell.predictedMemoryUsage}%</div>
                            </div>
                          </div>
                          <div className="text-xs">
                            <span className="text-muted-foreground">Pods: </span>
                            {cell.podCount}
                          </div>
                          {cell.isCritical && (
                            <div className="rounded-md bg-red-500/20 p-1.5 text-xs text-red-500">
                              Resource shortage predicted! Consider scaling this service.
                            </div>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
