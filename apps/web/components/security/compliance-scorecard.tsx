"use client"

import { useEffect, useRef } from "react"
import { Check, Info } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface ComplianceScorecardProps {
  onSelectStandard: (standard: string) => void
  selectedStandard: string | null
}

export function ComplianceScorecard({ onSelectStandard, selectedStandard }: ComplianceScorecardProps) {
  // Mock data for compliance standards
  const standards = [
    {
      id: "GDPR",
      name: "GDPR",
      score: 92,
      color: "#3B82F6", // Blue
      description: "General Data Protection Regulation",
    },
    {
      id: "PCI-DSS",
      name: "PCI-DSS",
      score: 85,
      color: "#10B981", // Green
      description: "Payment Card Industry Data Security Standard",
    },
    {
      id: "HIPAA",
      name: "HIPAA",
      score: 78,
      color: "#F59E0B", // Amber
      description: "Health Insurance Portability and Accountability Act",
    },
  ]

  // Refs for each progress ring
  const ringRefs = useRef<(SVGCircleElement | null)[]>([])

  // Draw progress rings on mount
  useEffect(() => {
    standards.forEach((standard, index) => {
      const circle = ringRefs.current[index]
      if (!circle) return

      const radius = 40
      const circumference = 2 * Math.PI * radius

      // Calculate stroke-dasharray and stroke-dashoffset
      const offset = circumference - (standard.score / 100) * circumference

      // Set the attributes
      circle.style.strokeDasharray = `${circumference} ${circumference}`
      circle.style.strokeDashoffset = `${offset}`
    })
  }, [standards])

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {standards.map((standard, index) => (
        <Card
          key={standard.id}
          className={`cursor-pointer p-4 transition-all hover:shadow-md ${
            selectedStandard === standard.id ? "ring-2 ring-primary" : ""
          }`}
          onClick={() => onSelectStandard(standard.id)}
        >
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-2 flex items-center justify-center">
              <svg width="100" height="100" viewBox="0 0 100 100">
                {/* Background circle */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="text-muted"
                />

                {/* Progress circle */}
                <circle
                  ref={(el) => (ringRefs.current[index] = el)}
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke={standard.color}
                  strokeWidth="4"
                  strokeLinecap="round"
                  style={{
                    transformOrigin: "center",
                    transform: "rotate(-90deg)",
                    transition: "stroke-dashoffset 1s ease-in-out",
                  }}
                />
              </svg>

              <div className="absolute flex flex-col items-center">
                <span className="text-2xl font-bold">{standard.score}%</span>
                <span className="text-xs text-muted-foreground">Compliant</span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <h3 className="font-medium">{standard.name}</h3>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{standard.description}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="mt-2 flex items-center gap-1 text-xs">
              {standard.score >= 90 ? (
                <div className="flex items-center gap-1 text-green-500">
                  <Check className="h-3 w-3" />
                  <span>Fully Compliant</span>
                </div>
              ) : standard.score >= 80 ? (
                <span className="text-yellow-500">Minor Gaps</span>
              ) : (
                <span className="text-red-500">Needs Attention</span>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
