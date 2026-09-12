"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import * as d3 from "d3"
import { Badge } from "@/components/ui/badge"

// Mock data for the topology
const nodes = [
  { id: "aws-us-east-1", label: "AWS US East", type: "aws", status: "healthy" },
  { id: "aws-eu-west-1", label: "AWS EU West", type: "aws", status: "healthy" },
  { id: "gcp-us-central1", label: "GCP US Central", type: "gcp", status: "degraded" },
  { id: "edge-mumbai", label: "Edge Mumbai", type: "edge", status: "healthy" },
  { id: "edge-berlin", label: "Edge Berlin", type: "edge", status: "healthy" },
  { id: "edge-london", label: "Edge London", type: "edge", status: "offline" },
]

const links = [
  { source: "aws-us-east-1", target: "aws-eu-west-1", status: "healthy" },
  { source: "aws-eu-west-1", target: "gcp-us-central1", status: "healthy" },
  { source: "gcp-us-central1", target: "edge-mumbai", status: "degraded" },
  { source: "gcp-us-central1", target: "edge-berlin", status: "healthy" },
  { source: "aws-eu-west-1", target: "edge-london", status: "offline" },
]

type TooltipData = {
  id: string
  label: string
  type: string
  status: string
  position: { x: number; y: number }
  metrics?: {
    cpu: string
    memory: string
    latency: string
    errorRate: string
  }
}

export function ClusterTopologyMap() {
  const svgRef = useRef<SVGSVGElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [tooltipData, setTooltipData] = useState<TooltipData | null>(null)

  // Generate random metrics for the tooltip
  const getNodeMetrics = useCallback((nodeId: string) => {
    return {
      cpu: `${Math.floor(Math.random() * 90) + 10}%`,
      memory: `${Math.floor(Math.random() * 80) + 20}%`,
      latency: `${Math.floor(Math.random() * 100) + 20}ms`,
      errorRate: `${(Math.random() * 2).toFixed(2)}%`,
    }
  }, [])

  useEffect(() => {
    if (!svgRef.current) return

    const width = svgRef.current.clientWidth
    const height = 500

    // Create a force simulation
    const simulation = d3
      .forceSimulation(nodes as d3.SimulationNodeDatum[])
      .force(
        "link",
        d3
          .forceLink(links)
          .id((d: any) => d.id)
          .distance(100),
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(60))

    const svg = d3.select(svgRef.current)
    svg.selectAll("*").remove()

    // Define cloud provider icons
    const defs = svg.append("defs")

    // Define filters for glow effect on hover
    defs
      .append("filter")
      .attr("id", "glow")
      .append("feGaussianBlur")
      .attr("stdDeviation", "3.5")
      .attr("result", "coloredBlur")

    // Draw links
    const link = svg
      .append("g")
      .selectAll("line")
      .data(links)
      .enter()
      .append("line")
      .attr("stroke", (d) => {
        switch (d.status) {
          case "healthy":
            return "#10B981" // Green
          case "degraded":
            return "#F59E0B" // Amber
          case "offline":
          default:
            return "#EF4444" // Red
        }
      })
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", (d) => (d.status === "degraded" ? "5,5" : "none"))

    // Create node groups
    const node = svg
      .append("g")
      .selectAll("g")
      .data(nodes)
      .enter()
      .append("g")
      .call(d3.drag<SVGGElement, any>().on("start", dragstarted).on("drag", dragged).on("end", dragended))
      .on("mouseover", (event, d) => {
        d3.select(event.currentTarget).select("circle").attr("filter", "url(#glow)")

        if (tooltipRef.current) {
          setTooltipData({
            id: d.id,
            label: d.label,
            type: d.type,
            status: d.status,
            position: { x: event.pageX, y: event.pageY },
            metrics: getNodeMetrics(d.id),
          })
        }
      })
      .on("mouseout", (event) => {
        d3.select(event.currentTarget).select("circle").attr("filter", null)
        setTooltipData(null)
      })

    // Add circles for the nodes
    node
      .append("circle")
      .attr("r", 25)
      .attr("fill", (d) => {
        switch (d.type) {
          case "aws":
            return "#FF9900" // AWS orange
          case "gcp":
            return "#4285F4" // GCP blue
          case "edge":
          default:
            return "#2563EB" // Edge blue
        }
      })
      .attr("stroke", (d) => {
        switch (d.status) {
          case "healthy":
            return "#10B981" // Green
          case "degraded":
            return "#F59E0B" // Amber
          case "offline":
          default:
            return "#EF4444" // Red
        }
      })
      .attr("stroke-width", 3)

    // Add text labels for cloud type
    node
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", 5)
      .attr("fill", "white")
      .style("font-size", "10px")
      .style("font-weight", "bold")
      .text((d) => d.type.toUpperCase().substring(0, 3))

    // Add text labels for node IDs
    node
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", 45)
      .attr("fill", "currentColor")
      .style("font-size", "12px")
      .text((d) => d.label)

    // Update positions on simulation tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y)

      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`)
    })

    // Drag functions
    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart()
      event.subject.fx = event.subject.x
      event.subject.fy = event.subject.y
    }

    function dragged(event: any) {
      event.subject.fx = event.x
      event.subject.fy = event.y
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0)
      event.subject.fx = null
      event.subject.fy = null
    }

    // Cleanup
    return () => {
      simulation.stop()
    }
  }, [getNodeMetrics])

  return (
    <div className="relative">
      <div className="mb-4 flex flex-wrap gap-2">
        <Badge variant="outline" className="border-green-500 text-green-500">
          <span className="mr-1 h-2 w-2 rounded-full bg-green-500"></span> Healthy
        </Badge>
        <Badge variant="outline" className="border-amber-500 text-amber-500">
          <span className="mr-1 h-2 w-2 rounded-full bg-amber-500"></span> Degraded
        </Badge>
        <Badge variant="outline" className="border-red-500 text-red-500">
          <span className="mr-1 h-2 w-2 rounded-full bg-red-500"></span> Offline
        </Badge>
      </div>

      <svg ref={svgRef} width="100%" height="500" style={{ overflow: "visible" }}></svg>

      {tooltipData && (
        <div
          ref={tooltipRef}
          className="absolute z-50 w-64 rounded-lg border bg-card p-4 shadow-lg"
          style={{
            left: `${tooltipData.position.x + 10}px`,
            top: `${tooltipData.position.y - 100}px`,
          }}
        >
          <div className="mb-1 flex items-center justify-between">
            <span className="font-semibold">{tooltipData.label}</span>
            <Badge
              variant={
                tooltipData.status === "healthy"
                  ? "success"
                  : tooltipData.status === "degraded"
                    ? "warning"
                    : "destructive"
              }
            >
              {tooltipData.status}
            </Badge>
          </div>

          {tooltipData.metrics && (
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <div className="text-muted-foreground">CPU</div>
                <div>{tooltipData.metrics.cpu}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Memory</div>
                <div>{tooltipData.metrics.memory}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Latency</div>
                <div>{tooltipData.metrics.latency}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Error Rate</div>
                <div>{tooltipData.metrics.errorRate}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
