"use client"
import { AlertTriangle, RotateCw, Wifi, WifiOff } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface ConnectivityTimelineProps {
  node: any
  timeframe: "24h" | "7d" | "30d"
}

export function ConnectivityTimeline({ node, timeframe }: ConnectivityTimelineProps) {
  // Generate mock connectivity events based on the node and timeframe
  const generateEvents = () => {
    const events = []

    // Number of events based on timeframe
    const numEvents = timeframe === "24h" ? 5 : timeframe === "7d" ? 10 : 15

    // If node is offline, add a disconnection event
    if (node.status === "offline") {
      events.push({
        type: "disconnect",
        time: "1 hour ago",
        duration: "1 hour",
        description: "Connection lost",
        icon: WifiOff,
        iconColor: "text-red-500",
      })
    }

    // Add some random events
    const eventTypes = ["connect", "disconnect", "latency", "reboot"]

    for (let i = 0; i < numEvents; i++) {
      const type = eventTypes[Math.floor(Math.random() * eventTypes.length)]
      let event

      switch (type) {
        case "connect":
          event = {
            type: "connect",
            time: `${i + 2} hours ago`,
            duration: "",
            description: "Connection established",
            icon: Wifi,
            iconColor: "text-green-500",
          }
          break
        case "disconnect":
          event = {
            type: "disconnect",
            time: `${i + 2} hours ago`,
            duration: `${Math.floor(Math.random() * 30) + 5} minutes`,
            description: "Connection lost",
            icon: WifiOff,
            iconColor: "text-red-500",
          }
          break
        case "latency":
          event = {
            type: "latency",
            time: `${i + 2} hours ago`,
            duration: `${Math.floor(Math.random() * 10) + 5} minutes`,
            description: "High latency detected",
            icon: AlertTriangle,
            iconColor: "text-yellow-500",
          }
          break
        case "reboot":
          event = {
            type: "reboot",
            time: `${i + 2} hours ago`,
            duration: "",
            description: "System rebooted",
            icon: RotateCw,
            iconColor: "text-blue-500",
          }
          break
      }

      events.push(event)
    }

    // Sort events by time (most recent first)
    return events.sort((a, b) => {
      const timeA = Number.parseInt(a.time.split(" ")[0])
      const timeB = Number.parseInt(b.time.split(" ")[0])
      return timeA - timeB
    })
  }

  const events = generateEvents()

  return (
    <div className="relative pl-6">
      <div className="absolute bottom-0 left-2 top-0 w-0.5 bg-muted"></div>

      {events.map((event, index) => (
        <div key={index} className="mb-4 last:mb-0">
          <div
            className={`absolute left-0 mt-1.5 flex h-4 w-4 items-center justify-center rounded-full border ${event.iconColor} bg-background`}
          >
            <event.icon className="h-2.5 w-2.5" />
          </div>
          <div className="mb-1 text-xs text-muted-foreground">{event.time}</div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{event.description}</span>
            {event.duration && (
              <Badge variant="outline" className="text-xs">
                {event.duration}
              </Badge>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
