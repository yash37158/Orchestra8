"use client"

import { useEffect, useRef } from "react"
import * as d3 from "d3"

export function TopologyMap() {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current) return

    const width = svgRef.current.clientWidth
    const height = 400

    const svg = d3.select(svgRef.current)
    svg.selectAll("*").remove()

    // Sample data for the topology
    const nodes = [
      { id: "aws-1", type: "cloud", x: width * 0.2, y: height * 0.3 },
      { id: "aws-2", type: "cloud", x: width * 0.4, y: height * 0.6 },
      { id: "gcp-1", type: "cloud", x: width * 0.6, y: height * 0.4 },
      { id: "edge-1", type: "edge", x: width * 0.8, y: height * 0.2 },
      { id: "edge-2", type: "edge", x: width * 0.7, y: height * 0.7 },
    ]

    const links = [
      { source: "aws-1", target: "aws-2" },
      { source: "aws-2", target: "gcp-1" },
      { source: "gcp-1", target: "edge-1" },
      { source: "gcp-1", target: "edge-2" },
    ]

    // Draw links
    svg
      .selectAll("line")
      .data(links)
      .enter()
      .append("line")
      .attr("x1", (d) => nodes.find((n) => n.id === d.source)?.x || 0)
      .attr("y1", (d) => nodes.find((n) => n.id === d.source)?.y || 0)
      .attr("x2", (d) => nodes.find((n) => n.id === d.target)?.x || 0)
      .attr("y2", (d) => nodes.find((n) => n.id === d.target)?.y || 0)
      .attr("stroke", "hsl(var(--muted-foreground))")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "4,4")

    // Draw nodes
    const nodeGroups = svg
      .selectAll("g")
      .data(nodes)
      .enter()
      .append("g")
      .attr("transform", (d) => `translate(${d.x},${d.y})`)

    nodeGroups
      .append("circle")
      .attr("r", 20)
      .attr("fill", "hsl(var(--background))")
      .attr("stroke", "hsl(var(--border))")
      .attr("stroke-width", 2)

    nodeGroups
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", 30)
      .attr("fill", "hsl(var(--foreground))")
      .style("font-size", "12px")
      .text((d) => d.id)
  }, [])

  return <svg ref={svgRef} className="h-[400px] w-full" style={{ minWidth: "100%", overflow: "visible" }} />
}
