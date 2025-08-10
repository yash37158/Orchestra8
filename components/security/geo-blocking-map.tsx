"use client"

import { useEffect, useRef, useState } from "react"
import * as d3 from "d3"
import * as topojson from "topojson-client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

// Mock data for blocked regions
const blockedRegions = [
  { id: "RUS", name: "Russia", threats: 245 },
  { id: "CHN", name: "China", threats: 189 },
  { id: "PRK", name: "North Korea", threats: 76 },
  { id: "IRN", name: "Iran", threats: 112 },
  { id: "SYR", name: "Syria", threats: 43 },
]

// Mock data for threat hotspots
const threatHotspots = [
  { coordinates: [116.4, 39.9], country: "China", city: "Beijing", count: 87 },
  { coordinates: [37.6, 55.7], country: "Russia", city: "Moscow", count: 65 },
  { coordinates: [126.0, 39.0], country: "North Korea", city: "Pyongyang", count: 42 },
  { coordinates: [51.4, 35.7], country: "Iran", city: "Tehran", count: 38 },
  { coordinates: [77.2, 28.6], country: "India", city: "New Delhi", count: 29 },
  { coordinates: [-77.0, 38.9], country: "United States", city: "Washington DC", count: 18 },
]

export function GeoBlockingMap() {
  const svgRef = useRef<SVGSVGElement>(null)
  const [tooltipData, setTooltipData] = useState<{
    content: string
    x: number
    y: number
  } | null>(null)
  const [showThreats, setShowThreats] = useState(true)

  useEffect(() => {
    if (!svgRef.current) return

    const width = svgRef.current.clientWidth
    const height = 300

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
          .attr("fill", (d: any) => {
            // Check if country is in blocked regions
            const isBlocked = blockedRegions.some((region) => region.id === d.id)
            return isBlocked ? "#EF4444" : "hsl(var(--muted))"
          })
          .attr("stroke", "hsl(var(--border))")
          .attr("stroke-width", 0.5)
          .on("mouseover", (event, d: any) => {
            const blockedRegion = blockedRegions.find((region) => region.id === d.id)
            if (blockedRegion) {
              setTooltipData({
                content: `<strong>${blockedRegion.name}</strong><br>Blocked Region<br>${blockedRegion.threats} threats detected`,
                x: event.pageX,
                y: event.pageY,
              })
            }
          })
          .on("mouseout", () => {
            setTooltipData(null)
          })

        // Add threat hotspots if enabled
        if (showThreats) {
          svg
            .selectAll("circle")
            .data(threatHotspots)
            .enter()
            .append("circle")
            .attr("cx", (d) => projection(d.coordinates)?.[0] || 0)
            .attr("cy", (d) => projection(d.coordinates)?.[1] || 0)
            .attr("r", (d) => Math.sqrt(d.count) / 2 + 3)
            .attr("fill", "#F59E0B")
            .attr("fill-opacity", 0.7)
            .attr("stroke", "#FFFFFF")
            .attr("stroke-width", 0.5)
            .on("mouseover", (event, d) => {
              setTooltipData({
                content: `<strong>${d.city}, ${d.country}</strong><br>${d.count} threats detected`,
                x: event.pageX,
                y: event.pageY,
              })
            })
            .on("mouseout", () => {
              setTooltipData(null)
            })
        }
      })
      .catch((error) => {
        console.error("Error loading map data:", error)
      })
  }, [showThreats])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Badge variant="outline" className="border-red-500 text-red-500">
            <span className="mr-1 h-2 w-2 rounded-full bg-red-500"></span>
            Blocked Regions
          </Badge>
          {showThreats && (
            <Badge variant="outline" className="border-amber-500 text-amber-500">
              <span className="mr-1 h-2 w-2 rounded-full bg-amber-500"></span>
              Threat Hotspots
            </Badge>
          )}
        </div>

        <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowThreats(!showThreats)}>
          {showThreats ? "Hide Threats" : "Show Threats"}
        </Button>
      </div>

      <div className="relative h-[300px] rounded-lg border">
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

      <div className="space-y-2">
        <h3 className="text-sm font-medium">Blocked Regions</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {blockedRegions.map((region) => (
            <div key={region.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
              <span>{region.name}</span>
              <Badge variant="secondary">{region.threats} threats</Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
