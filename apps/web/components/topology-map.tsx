"use client"

import { useEffect, useRef } from "react"
import * as d3 from "d3"
import type { Topology } from "@orchestr8/contracts"

// Read from the live token set so the map cannot drift from the rest of the UI.
function statusColors() {
  const cs = getComputedStyle(document.documentElement)
  const v = (n: string) => `hsl(${cs.getPropertyValue(n).trim()})`
  return { healthy: v("--ok"), degraded: v("--warn"), offline: v("--crit") } as const
}

export function TopologyMap({ topology }: { topology: Topology }) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current || topology.clusters.length === 0) return

    const width = svgRef.current.clientWidth
    const height = 400
    const STATUS_COLOR = statusColors()
    const svg = d3.select(svgRef.current)
    svg.selectAll("*").remove()

    // Force layout rather than hardcoded coordinates: the cluster count is
    // whatever the API returns, not a fixed five.
    const nodes = topology.clusters.map((c) => ({ ...c }))
    const links = topology.links.map((l) => ({ ...l }))

    const sim = d3
      .forceSimulation(nodes as d3.SimulationNodeDatum[])
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(120))
      .force("charge", d3.forceManyBody().strength(-420))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide(44))
      .stop()

    // Run to convergence synchronously — no animation, no layout thrash.
    sim.tick(220)

    const link = svg
      .append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", (d: any) => STATUS_COLOR[d.status as keyof typeof STATUS_COLOR])
      .attr("stroke-opacity", (d: any) => (d.status === "offline" ? 0.45 : 0.8))
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", (d: any) => (d.status === "healthy" ? null : "4,4"))
      .attr("x1", (d: any) => d.source.x)
      .attr("y1", (d: any) => d.source.y)
      .attr("x2", (d: any) => d.target.x)
      .attr("y2", (d: any) => d.target.y)

    link.append("title").text((d: any) => `${d.source.id} → ${d.target.id}  ${d.latencyMs}ms`)

    const node = svg
      .append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("transform", (d: any) => `translate(${d.x},${d.y})`)

    node
      .append("circle")
      .attr("r", 22)
      .attr("fill", "hsl(var(--background))")
      .attr("stroke", (d: any) => STATUS_COLOR[d.status as keyof typeof STATUS_COLOR])
      .attr("stroke-width", 2.5)

    node
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", 4)
      .attr("fill", "hsl(var(--foreground))")
      .style("font-size", "10px")
      .style("font-weight", "600")
      .text((d: any) => d.provider.toUpperCase().slice(0, 3))

    node
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", 38)
      .attr("fill", "hsl(var(--muted-foreground))")
      .style("font-size", "11px")
      .text((d: any) => d.name)

    node.append("title").text((d: any) => `${d.name} — ${d.status}, ${d.nodes} nodes, ${d.uptimePct}% uptime`)
  }, [topology])

  return <svg ref={svgRef} className="h-[400px] w-full" style={{ minWidth: "100%", overflow: "visible" }} />
}
