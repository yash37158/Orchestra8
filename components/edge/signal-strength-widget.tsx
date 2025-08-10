"use client"

import { useEffect, useRef } from "react"
import { Wifi, WifiOff } from "lucide-react"

interface SignalStrengthWidgetProps {
  node: any
}

export function SignalStrengthWidget({ node }: SignalStrengthWidgetProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Draw the signal strength meter
  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set canvas dimensions
    const width = canvas.width
    const height = canvas.height

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    if (node.status === "offline") {
      // Draw offline state
      const centerX = width / 2
      const centerY = height / 2
      const radius = Math.min(width, height) / 2 - 10

      // Draw outer circle
      ctx.beginPath()
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI)
      ctx.strokeStyle = "rgba(239, 68, 68, 0.2)" // Red with opacity
      ctx.lineWidth = 10
      ctx.stroke()

      // Draw icon
      ctx.fillStyle = "rgba(239, 68, 68, 0.8)" // Red with opacity
      ctx.font = "24px sans-serif"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText("⚠️", centerX, centerY)

      // Draw text
      ctx.fillStyle = "rgba(239, 68, 68, 0.8)" // Red with opacity
      ctx.font = "14px sans-serif"
      ctx.fillText("Offline", centerX, centerY + 30)

      return
    }

    // Draw signal strength meter
    const centerX = width / 2
    const centerY = height / 2
    const radius = Math.min(width, height) / 2 - 10

    // Calculate start and end angles for the arc
    const startAngle = Math.PI * 0.75 // 135 degrees
    const endAngle = Math.PI * 2.25 // 405 degrees

    // Draw background arc
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius, startAngle, endAngle)
    ctx.strokeStyle = "rgba(100, 116, 139, 0.2)" // Slate with opacity
    ctx.lineWidth = 10
    ctx.stroke()

    // Draw signal strength arc
    const signalAngle = startAngle + (endAngle - startAngle) * (node.signalStrength / 100)

    // Create gradient for signal strength
    const gradient = ctx.createLinearGradient(0, 0, width, 0)
    gradient.addColorStop(0, "rgba(239, 68, 68, 0.8)") // Red
    gradient.addColorStop(0.5, "rgba(245, 158, 11, 0.8)") // Amber
    gradient.addColorStop(1, "rgba(16, 185, 129, 0.8)") // Green

    ctx.beginPath()
    ctx.arc(centerX, centerY, radius, startAngle, signalAngle)
    ctx.strokeStyle = gradient
    ctx.lineWidth = 10
    ctx.stroke()

    // Draw signal strength percentage in the center
    ctx.fillStyle = "white"
    ctx.font = "bold 24px sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(`${node.signalStrength}%`, centerX, centerY)

    // Draw signal strength label
    ctx.fillStyle = "rgba(148, 163, 184, 0.8)" // Slate with opacity
    ctx.font = "14px sans-serif"
    ctx.fillText("Signal Strength", centerX, centerY + 30)

    // Draw signal bars
    const barWidth = 6
    const barGap = 3
    const barCount = 5
    const totalWidth = barWidth * barCount + barGap * (barCount - 1)
    const startX = centerX - totalWidth / 2
    const startY = centerY - 50

    for (let i = 0; i < barCount; i++) {
      const barHeight = 10 + i * 5
      const barX = startX + i * (barWidth + barGap)
      const barY = startY - barHeight

      // Determine if this bar should be filled based on signal strength
      const threshold = (i + 1) * (100 / barCount)
      const isFilled = node.signalStrength >= threshold

      ctx.fillStyle = isFilled ? gradient : "rgba(100, 116, 139, 0.2)"
      ctx.fillRect(barX, barY, barWidth, barHeight)
    }

    // Draw historical sparkline
    const sparklineWidth = width - 40
    const sparklineHeight = 30
    const sparklineX = 20
    const sparklineY = height - 40

    // Generate mock historical data
    const historyPoints = 20
    const historyData = Array.from({ length: historyPoints }, () => {
      // Generate values around the current signal strength with some variation
      return Math.max(0, Math.min(100, node.signalStrength + (Math.random() * 20 - 10)))
    })

    // Draw sparkline background
    ctx.fillStyle = "rgba(100, 116, 139, 0.1)"
    ctx.fillRect(sparklineX, sparklineY, sparklineWidth, sparklineHeight)

    // Draw sparkline
    ctx.beginPath()
    ctx.moveTo(sparklineX, sparklineY + sparklineHeight - (historyData[0] / 100) * sparklineHeight)

    for (let i = 1; i < historyPoints; i++) {
      const x = sparklineX + (i / (historyPoints - 1)) * sparklineWidth
      const y = sparklineY + sparklineHeight - (historyData[i] / 100) * sparklineHeight
      ctx.lineTo(x, y)
    }

    ctx.strokeStyle = gradient
    ctx.lineWidth = 2
    ctx.stroke()

    // Draw sparkline label
    ctx.fillStyle = "rgba(148, 163, 184, 0.8)"
    ctx.font = "10px sans-serif"
    ctx.textAlign = "left"
    ctx.fillText("Signal History (24h)", sparklineX, sparklineY - 5)
  }, [node])

  return (
    <div className="flex flex-col items-center">
      <div className="mb-2 flex items-center gap-2">
        {node.status === "online" ? (
          <Wifi className="h-5 w-5 text-green-500" />
        ) : (
          <WifiOff className="h-5 w-5 text-red-500" />
        )}
        <span className="font-medium capitalize">{node.status}</span>
      </div>
      <canvas ref={canvasRef} width={200} height={200} className="w-full" />
    </div>
  )
}
