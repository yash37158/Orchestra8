"use client"

import { useRef } from "react"
import {
  Chart,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip as ChartTooltip,
  Legend,
  Filler,
} from "chart.js"
import { Line } from "react-chartjs-2"

// Register the required Chart.js components
Chart.register(LineElement, PointElement, LinearScale, CategoryScale, ChartTooltip, Legend, Filler)

// Generate mock data for the chart
const generateMockData = (timeframe: string) => {
  let labels: string[] = []
  let inboundData: number[] = []
  let outboundData: number[] = []
  let thresholdData: number[] = []

  if (timeframe === "hourly") {
    // Generate hourly data for the last 24 hours
    labels = Array.from({ length: 24 }, (_, i) => `${i % 12 || 12}${i < 12 ? "AM" : "PM"}`)

    // Generate realistic traffic patterns with morning and evening peaks
    inboundData = labels.map((_, i) => {
      // Base value
      let value = 5 + Math.random() * 2

      // Morning peak (8-11 AM)
      if (i >= 8 && i < 11) {
        value += 3 * (1 - Math.abs(i - 9.5) / 1.5)
      }
      // Evening peak (6-9 PM)
      else if (i >= 18 && i < 21) {
        value += 4 * (1 - Math.abs(i - 19.5) / 1.5)
      }

      return value
    })

    // Outbound is typically less than inbound
    outboundData = inboundData.map((val) => val * 0.7 + Math.random())

    // Threshold line
    thresholdData = Array(24).fill(12)
  } else if (timeframe === "daily") {
    // Generate daily data for the last 7 days
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    labels = days

    // Weekdays have higher traffic than weekends
    inboundData = days.map((day, i) => {
      const isWeekend = i >= 5 // Sat or Sun
      return isWeekend ? 6 + Math.random() * 2 : 8 + Math.random() * 3
    })

    outboundData = inboundData.map((val) => val * 0.7 + Math.random())
    thresholdData = Array(7).fill(12)
  } else {
    // Generate weekly data for the last 4 weeks
    labels = ["Week 1", "Week 2", "Week 3", "Week 4"]

    // Gradual increase in traffic over the weeks
    inboundData = labels.map((_, i) => 7 + i * 0.8 + Math.random() * 2)
    outboundData = inboundData.map((val) => val * 0.7 + Math.random())
    thresholdData = Array(4).fill(12)
  }

  return {
    labels,
    inboundData,
    outboundData,
    thresholdData,
  }
}

interface BandwidthUsageChartProps {
  timeframe: "hourly" | "daily" | "weekly"
}

export function BandwidthUsageChart({ timeframe }: BandwidthUsageChartProps) {
  const chartRef = useRef<any>(null)

  // Generate data based on timeframe
  const { labels, inboundData, outboundData, thresholdData } = generateMockData(timeframe)

  const data = {
    labels,
    datasets: [
      {
        label: "Inbound Traffic",
        data: inboundData,
        borderColor: "#3B82F6", // Blue
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.4,
        fill: true,
      },
      {
        label: "Outbound Traffic",
        data: outboundData,
        borderColor: "#10B981", // Green
        backgroundColor: "rgba(16, 185, 129, 0.1)",
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.4,
        fill: true,
      },
      {
        label: "Bandwidth Threshold",
        data: thresholdData,
        borderColor: "#EF4444", // Red
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
        labels: {
          usePointStyle: true,
          boxWidth: 6,
        },
      },
      tooltip: {
        mode: "index" as const,
        intersect: false,
        callbacks: {
          label: (context: any) => {
            let label = context.dataset.label || ""
            if (label) {
              label += ": "
            }
            if (context.parsed.y !== null) {
              label += `${context.parsed.y.toFixed(1)} Mbps`
            }
            return label
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: "rgba(255, 255, 255, 0.1)",
        },
        ticks: {
          callback: (value: any) => {
            return `${value} Mbps`
          },
        },
      },
    },
    interaction: {
      mode: "nearest" as const,
      axis: "x" as const,
      intersect: false,
    },
  }

  return <Line ref={chartRef} data={data} options={options} />
}
