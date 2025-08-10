"use client"

import { useEffect, useRef, useState } from "react"
import * as d3 from "d3"
import * as topojson from "topojson-client"
import { Button } from "@/components/ui/button"

// Mock data for edge node locations
const edgeNodes = [
  {
    id: "edge-mumbai",
    name: "Edge Mumbai",
    coordinates: [72.8777, 19.076],
    status: "healthy",
    region: "Asia Pacific",
  },
  {
    id: "edge-berlin",
    name: "Edge Berlin",
    coordinates: [13.405, 52.52],
    status: "healthy",
    region: "Europe",
  },
  {
    id: "edge-london",
    name: "Edge London",
    coordinates: [-0.1278, 51.5074],
    status: "offline",
    region: "Europe",
  },
  {
    id: "edge-new-york",
    name: "Edge New York",
    coordinates: [-74.006, 40.7128],
    status: "healthy",
    region: "North America",
  },
  {
    id: "edge-sydney",
    name: "Edge Sydney",
    coordinates: [151.2093, -33.8688],
    status: "degraded",
    region: "Asia Pacific",
  },
  {
    id: "edge-sao-paulo",
    name: "Edge São Paulo",
    coordinates: [-46.6333, -23.5505],
    status: "healthy",
    region: "South America",
  },
]

// Mock data for cloud regions
const cloudRegions = [
  {
    id: "aws-us-east-1",
    name: "AWS US East",
    coordinates: [-78.0, 38.0],
    provider: "AWS",
    region: "North America",
  },
  {
    id: "aws-eu-west-1",
    name: "AWS EU West",
    coordinates: [-6.2603, 53.3498],
    provider: "AWS",
    region: "Europe",
  },
  {
    id: "gcp-us-central1",
    name: "GCP US Central",
    coordinates: [-94.5786, 39.0997],
    provider: "GCP",
    region: "North America",
  },
]

// All regions and nodes combined
const allLocations = [...cloudRegions, ...edgeNodes]

export function ClusterGeoMap() {
  const svgRef = useRef<SVGSVGElement>(null)
  const [activeFilter, setActiveFilter] = useState<string>("all")
  const [activeProviderFilter, setActiveProviderFilter] = useState<string>("all")
  const [tooltipData, setTooltipData] = useState<{
    content: string
    x: number
    y: number
  } | null>(null)

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

    // Filter locations based on active filters
    const filteredLocations = allLocations.filter((location) => {
      const regionMatch = activeFilter === "all" || location.region === activeFilter

      // Check if it's a cloud region or edge node
      if ("provider" in location) {
        return regionMatch && (activeProviderFilter === "all" || activeProviderFilter === location.provider)
      } else {
        return regionMatch && (activeProviderFilter === "all" || activeProviderFilter === "Edge")
      }
    })

    // Draw a simple world map outline
    d3.json("https://unpkg.com/world-atlas@2.0.2/countries-110m.json")
      .then((data: any) => {
        const countries = topojson.feature(data, data.objects.countries)

        const path = d3.geoPath().projection(projection)

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
      })
      .catch((error) => {
        // Fallback if we can't load the map data
        svg.append("rect").attr("width", width).attr("height", height).attr("fill", "hsl(var(--muted))").attr("rx", 8)
      })

    // Add markers for each location
    filteredLocations.forEach((location) => {
      const [longitude, latitude] = location.coordinates
      const [x, y] = projection([longitude, latitude]) || [0, 0]

      const isCloudRegion = "provider" in location
      const group = svg
        .append("g")
        .attr("transform", `translate(${x}, ${y})`)
        .style("cursor", "pointer")
        .on("mouseover", (event) => {
          const content = isCloudRegion
            ? `<strong>${location.name}</strong><br>${(location as any).provider} Region`
            : `<strong>${location.name}</strong><br>Status: ${(location as any).status}<br>${location.region}`

          setTooltipData({
            content,
            x: event.pageX,
            y: event.pageY,
          })
        })
        .on("mouseout", () => {
          setTooltipData(null)
        })

      // Different styling for cloud regions vs edge nodes
      if (isCloudRegion) {
        const cloudRegion = location as (typeof cloudRegions)[0]
        group
          .append("circle")
          .attr("r", 8)
          .attr("fill", cloudRegion.provider === "AWS" ? "#FF9900" : "#4285F4")
          .attr("stroke", "white")
          .attr("stroke-width", 2)

        group
          .append("text")
          .attr("text-anchor", "middle")
          .attr("dy", "0.3em")
          .attr("fill", "white")
          .attr("font-size", "8px")
          .attr("font-weight", "bold")
          .text(cloudRegion.provider.charAt(0))
      } else {
        const edgeNode = location as (typeof edgeNodes)[0]
        const color = edgeNode.status === "healthy" ? "#10B981" : edgeNode.status === "degraded" ? "#F59E0B" : "#EF4444"

        group.append("circle").attr("r", 5).attr("fill", color).attr("stroke", "white").attr("stroke-width", 1.5)
      }
    })
  }, [activeFilter, activeProviderFilter])

  return (
    <div className="h-[400px] rounded-lg bg-muted/20">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={activeFilter === "all" ? "default" : "outline"}
            className="text-xs"
            onClick={() => setActiveFilter("all")}
          >
            All Regions
          </Button>
          <Button
            size="sm"
            variant={activeFilter === "North America" ? "default" : "outline"}
            className="text-xs"
            onClick={() => setActiveFilter("North America")}
          >
            North America
          </Button>
          <Button
            size="sm"
            variant={activeFilter === "Europe" ? "default" : "outline"}
            className="text-xs"
            onClick={() => setActiveFilter("Europe")}
          >
            Europe
          </Button>
          <Button
            size="sm"
            variant={activeFilter === "Asia Pacific" ? "default" : "outline"}
            className="text-xs"
            onClick={() => setActiveFilter("Asia Pacific")}
          >
            Asia Pacific
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={activeProviderFilter === "AWS" ? "default" : "outline"}
            className="text-xs"
            onClick={() => setActiveProviderFilter(activeProviderFilter === "AWS" ? "all" : "AWS")}
          >
            Only AWS
          </Button>
          <Button
            size="sm"
            variant={activeProviderFilter === "GCP" ? "default" : "outline"}
            className="text-xs"
            onClick={() => setActiveProviderFilter(activeProviderFilter === "GCP" ? "all" : "GCP")}
          >
            Only GCP
          </Button>
          <Button
            size="sm"
            variant={activeProviderFilter === "Edge" ? "default" : "outline"}
            className="text-xs"
            onClick={() => setActiveProviderFilter(activeProviderFilter === "Edge" ? "all" : "Edge")}
          >
            Only Edge
          </Button>
        </div>
      </div>

      <div className="relative h-[300px] rounded-lg">
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

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded-full bg-[#FF9900]"></div>
          <span>AWS Region</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded-full bg-[#4285F4]"></div>
          <span>GCP Region</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded-full bg-green-500"></div>
          <span>Healthy Edge</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded-full bg-amber-500"></div>
          <span>Degraded Edge</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded-full bg-red-500"></div>
          <span>Offline Edge</span>
        </div>
      </div>
    </div>
  )
}
