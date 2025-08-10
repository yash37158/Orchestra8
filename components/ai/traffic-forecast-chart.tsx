"use client"

import { useEffect, useRef } from "react"
import {
  Chart,
  type ChartData,
  type ChartOptions,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip as ChartTooltip,
  Legend,
  Filler,
} from "chart.js"
import "chart.js/auto"
import { Line } from "react-chartjs-2"
import { addHours, format } from "date-fns"

// Register the required Chart.js components
Chart.register(LineElement, PointElement, LinearScale, CategoryScale, ChartTooltip, Legend, Filler)

// Generate mock data for the chart
const generateMockData = (confidenceInterval: number) => {
  const now = new Date()
  const hours = Array.from({ length: 48 }, (_, i) => i - 24) // -24 to 23 hours

  // Format the labels as strings instead of Date objects
  const labels = hours.map((hour) => {
    const date = addHours(now, hour)
    return format(date, "MMM d, h:mm a")
  })

  // Historical data (past 24 hours)
  const historicalData = hours
    .filter((hour) => hour < 0)
    .map((hour) => {
      // Create a realistic traffic pattern with morning and evening peaks
      const hourOfDay = (now.getHours() + hour + 24) % 24
      let baseValue = 500 // Base traffic

      // Morning peak (8-11 AM)
      if (hourOfDay >= 8 && hourOfDay < 11) {
        baseValue += 300 * (1 - Math.abs(hourOfDay - 9.5) / 1.5)
      }
      // Evening peak (6-9 PM)
      else if (hourOfDay >= 18 && hourOfDay < 21) {
        baseValue += 400 * (1 - Math.abs(hourOfDay - 19.5) / 1.5)
      }

      // Add some randomness
      return baseValue + Math.random() * 50 - 25
    })

  // Predicted data (next 24 hours)
  const predictedData = hours
    .filter((hour) => hour >= 0)
    .map((hour) => {
      const hourOfDay = (now.getHours() + hour) % 24
      let baseValue = 520 // Slightly higher base traffic for future

      // Morning peak (8-11 AM)
      if (hourOfDay >= 8 && hourOfDay < 11) {
        baseValue += 320 * (1 - Math.abs(hourOfDay - 9.5) / 1.5)
      }
      // Evening peak (6-9 PM)
      else if (hourOfDay >= 18 && hourOfDay < 21) {
        baseValue += 450 * (1 - Math.abs(hourOfDay - 19.5) / 1.5) // Higher evening peak predicted
      }

      return baseValue
    })

  // Calculate confidence intervals
  const ciMultiplier = confidenceInterval === 99 ? 2.58 : confidenceInterval === 95 ? 1.96 : 1.28 // 80% CI

  const upperBound = predictedData.map((val) => val + val * 0.15 * ciMultiplier)
  const lowerBound = predictedData.map((val) => val - val * 0.15 * ciMultiplier)

  return {
    labels,
    historicalData,
    predictedData,
    upperBound,
    lowerBound,
  }
}

interface TrafficForecastChartProps {
  confidenceInterval: number
}

export function TrafficForecastChart({ confidenceInterval }: TrafficForecastChartProps) {
  const chartRef = useRef<any>(null)

  // Generate data based on confidence interval
  const { labels, historicalData, predictedData, upperBound, lowerBound } = generateMockData(confidenceInterval)

  // Combine historical and predicted data with null values for the gaps
  const historicalWithGaps = [...historicalData, ...Array(24).fill(null)]
  const predictedWithGaps = [...Array(24).fill(null), ...predictedData]

  const data: ChartData = {
    labels,
    datasets: [
      {
        label: "Historical Traffic",
        data: historicalWithGaps,
        borderColor: "#3B82F6", // Blue
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.4,
        fill: false,
      },
      {
        label: "Predicted Traffic",
        data: predictedWithGaps,
        borderColor: "#F59E0B", // Amber
        backgroundColor: "rgba(245, 158, 11, 0.1)",
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.4,
        fill: false,
      },
      {
        label: `Upper Bound (${confidenceInterval}%)`,
        data: [...Array(24).fill(null), ...upperBound],
        borderColor: "rgba(245, 158, 11, 0.3)",
        backgroundColor: "rgba(245, 158, 11, 0.1)",
        borderWidth: 1,
        pointRadius: 0,
        pointHoverRadius: 0,
        tension: 0.4,
        fill: false,
      },
      {
        label: `Lower Bound (${confidenceInterval}%)`,
        data: [...Array(24).fill(null), ...lowerBound],
        borderColor: "rgba(245, 158, 11, 0.3)",
        backgroundColor: "rgba(245, 158, 11, 0.1)",
        borderWidth: 1,
        pointRadius: 0,
        pointHoverRadius: 0,
        tension: 0.4,
        fill: "+1", // Fill between this dataset and the dataset at index 1 (Predicted Traffic)
      },
    ],
  }

  const options: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
        labels: {
          usePointStyle: true,
          boxWidth: 6,
        },
      },
      tooltip: {
        mode: "index",
        intersect: false,
        callbacks: {
          title: (items) => {
            if (!items.length) return ""
            return items[0].label
          },
          label: (context) => {
            if (context.dataset.label?.includes("Bound")) {
              return null // Don't show tooltip for bounds
            }
            let label = context.dataset.label || ""
            if (label) {
              label += ": "
            }
            if (context.parsed.y !== null) {
              label += Math.round(context.parsed.y).toLocaleString() + " requests/min"
            }
            return label
          },
        },
      },
    },
    scales: {
      x: {
        type: "category",
        grid: {
          display: false,
        },
        ticks: {
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 12,
        },
      },
      y: {
        beginAtZero: false,
        grid: {
          color: "rgba(255, 255, 255, 0.1)",
        },
        ticks: {
          callback: (value) => {
            return value.toLocaleString()
          },
        },
      },
    },
    interaction: {
      mode: "nearest",
      axis: "x",
      intersect: false,
    },
    elements: {
      line: {
        tension: 0.4,
      },
    },
  }

  // Add a vertical line to indicate current time
  useEffect(() => {
    const chart = chartRef.current

    if (chart) {
      const originalDraw = chart.draw

      chart.draw = function () {
        originalDraw.apply(this, arguments)

        const ctx = chart.ctx
        const xAxis = chart.scales.x
        const yAxis = chart.scales.y

        // Find the middle point (current time)
        const xPosition = xAxis.getPixelForValue(labels[24]) // Index 24 is the current time

        // Draw vertical line for current time
        ctx.save()
        ctx.beginPath()
        ctx.moveTo(xPosition, yAxis.top)
        ctx.lineTo(xPosition, yAxis.bottom)
        ctx.lineWidth = 2
        ctx.strokeStyle = "rgba(255, 255, 255, 0.5)"
        ctx.setLineDash([5, 5])
        ctx.stroke()

        // Draw "Now" label
        ctx.fillStyle = "rgba(255, 255, 255, 0.8)"
        ctx.textAlign = "center"
        ctx.fillText("Now", xPosition, yAxis.top - 10)
        ctx.restore()
      }
    }

    return () => {
      if (chart) {
        chart.draw = Chart.prototype.draw
      }
    }
  }, [labels])

  return (
    <div className="h-[350px] w-full">
      <Line ref={chartRef} data={data} options={options} />
    </div>
  )
}
