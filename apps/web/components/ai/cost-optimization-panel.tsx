"use client"

import { useState } from "react"
import { Check, Clock, DollarSign, X } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Mock data for recommendations
const initialRecommendations = [
  {
    id: 1,
    title: "Downsize overprovisioned pods in analytics-cluster",
    description: "Reduce pod count from 20 to 12 based on historical usage patterns",
    impact: "Save $400/month",
    risk: "Low",
    applied: false,
    ignored: false,
  },
  {
    id: 2,
    title: "Optimize storage class for logging service",
    description: "Switch from SSD to HDD for log storage to reduce costs",
    impact: "Save $250/month",
    risk: "Low",
    applied: false,
    ignored: false,
  },
  {
    id: 3,
    title: "Consolidate dev/test environments",
    description: "Merge 3 test environments into a single shared environment",
    impact: "Save $350/month",
    risk: "Medium",
    applied: false,
    ignored: false,
  },
  {
    id: 4,
    title: "Implement auto-scaling for payment-service",
    description: "Replace static provisioning with dynamic scaling based on traffic",
    impact: "Save $200/month",
    risk: "Low",
    applied: false,
    ignored: false,
  },
]

export function CostOptimizationPanel() {
  const [recommendations, setRecommendations] = useState(initialRecommendations)
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; id: number | null }>({ open: false, id: null })
  const [ignoreDialog, setIgnoreDialog] = useState<{ open: boolean; id: number | null; duration: number }>({
    open: false,
    id: null,
    duration: 7,
  })

  // Calculate total potential savings
  const totalSavings = recommendations
    .filter((rec) => !rec.applied && !rec.ignored)
    .reduce((sum, rec) => sum + Number.parseInt(rec.impact.replace(/\D/g, "")), 0)

  // Calculate progress percentage
  const appliedSavings = recommendations
    .filter((rec) => rec.applied)
    .reduce((sum, rec) => sum + Number.parseInt(rec.impact.replace(/\D/g, "")), 0)

  const totalPossibleSavings = recommendations.reduce(
    (sum, rec) => sum + Number.parseInt(rec.impact.replace(/\D/g, "")),
    0,
  )

  const savingsPercentage = Math.round((appliedSavings / totalPossibleSavings) * 100) || 0

  // Handle apply recommendation
  const handleApply = (id: number) => {
    setRecommendations((prev) => prev.map((rec) => (rec.id === id ? { ...rec, applied: true } : rec)))
    setConfirmDialog({ open: false, id: null })
  }

  // Handle ignore recommendation
  const handleIgnore = (id: number, days: number) => {
    setRecommendations((prev) => prev.map((rec) => (rec.id === id ? { ...rec, ignored: true } : rec)))
    setIgnoreDialog({ open: false, id: null, duration: 7 })
  }

  return (
    <Card className="border-green-600/20 shadow-md shadow-green-600/10">
      <CardHeader>
        <CardTitle className="text-sm font-semibold tracking-tight">Cost Optimization</CardTitle>
        <CardDescription>AI-recommended resource optimizations</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-green-500/10 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-500" />
              <div>
                <div className="text-sm font-medium text-green-500">Monthly Savings Potential</div>
                <div className="text-2xl font-bold">${totalSavings}</div>
              </div>
            </div>
            <div className="text-right text-sm">
              <div className="font-medium">{savingsPercentage}% Optimized</div>
              <div className="text-muted-foreground">
                ${appliedSavings} / ${totalPossibleSavings}
              </div>
            </div>
          </div>
          <Progress value={savingsPercentage} className="mt-2 h-2" />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Recommendations</h3>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={recommendations.filter((r) => !r.applied && !r.ignored).length === 0}
            >
              Apply All
            </Button>
          </div>

          <div className="max-h-[400px] space-y-3 overflow-auto pr-1">
            {recommendations.filter((r) => !r.applied && !r.ignored).length === 0 ? (
              <div className="flex h-20 flex-col items-center justify-center rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                <p>All recommendations have been addressed!</p>
              </div>
            ) : (
              recommendations
                .filter((r) => !r.applied && !r.ignored)
                .map((recommendation) => (
                  <Card key={recommendation.id} className="overflow-hidden">
                    <CardContent className="p-3">
                      <div className="space-y-2">
                        <div className="font-medium">{recommendation.title}</div>
                        <p className="text-xs text-muted-foreground">{recommendation.description}</p>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-500">
                              {recommendation.impact}
                            </div>
                            <div
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                recommendation.risk === "Low"
                                  ? "bg-blue-500/10 text-blue-500"
                                  : recommendation.risk === "Medium"
                                    ? "bg-yellow-500/10 text-yellow-500"
                                    : "bg-red-500/10 text-red-500"
                              }`}
                            >
                              {recommendation.risk} Risk
                            </div>
                          </div>

                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-muted-foreground"
                              onClick={() => setIgnoreDialog({ open: true, id: recommendation.id, duration: 7 })}
                            >
                              <X className="h-4 w-4" />
                              <span className="sr-only">Ignore</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="default"
                              className="h-7 w-7 bg-green-500 p-0 hover:bg-green-600"
                              onClick={() => setConfirmDialog({ open: true, id: recommendation.id })}
                            >
                              <Check className="h-4 w-4" />
                              <span className="sr-only">Apply</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
            )}

            {recommendations.some((r) => r.applied) && (
              <div className="pt-2">
                <h4 className="mb-2 text-xs font-medium text-muted-foreground">Applied Recommendations</h4>
                {recommendations
                  .filter((r) => r.applied)
                  .map((recommendation) => (
                    <div key={recommendation.id} className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <Check className="h-3 w-3 text-green-500" />
                      <span>{recommendation.title}</span>
                    </div>
                  ))}
              </div>
            )}

            {recommendations.some((r) => r.ignored) && (
              <div className="pt-2">
                <h4 className="mb-2 text-xs font-medium text-muted-foreground">Ignored Recommendations</h4>
                {recommendations
                  .filter((r) => r.ignored)
                  .map((recommendation) => (
                    <div key={recommendation.id} className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{recommendation.title}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply Recommendation</DialogTitle>
            <DialogDescription>
              Are you sure you want to apply this recommendation? This action will make changes to your infrastructure.
            </DialogDescription>
          </DialogHeader>

          {confirmDialog.id && (
            <div className="rounded-md bg-muted p-3 text-sm">
              <p className="font-medium">{recommendations.find((r) => r.id === confirmDialog.id)?.title}</p>
              <p className="mt-1 text-muted-foreground">
                {recommendations.find((r) => r.id === confirmDialog.id)?.description}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog({ open: false, id: null })}>
              Cancel
            </Button>
            <Button
              variant="default"
              className="bg-green-500 hover:bg-green-600"
              onClick={() => confirmDialog.id && handleApply(confirmDialog.id)}
            >
              Apply Recommendation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ignore Dialog */}
      <Dialog open={ignoreDialog.open} onOpenChange={(open) => setIgnoreDialog({ ...ignoreDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ignore Recommendation</DialogTitle>
            <DialogDescription>For how long would you like to ignore this recommendation?</DialogDescription>
          </DialogHeader>

          <Select
            value={ignoreDialog.duration.toString()}
            onValueChange={(value) => setIgnoreDialog({ ...ignoreDialog, duration: Number.parseInt(value) })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select duration" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 day</SelectItem>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
              <SelectItem value="90">90 days</SelectItem>
              <SelectItem value="-1">Permanently</SelectItem>
            </SelectContent>
          </Select>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIgnoreDialog({ open: false, id: null, duration: 7 })}>
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={() => ignoreDialog.id && handleIgnore(ignoreDialog.id, ignoreDialog.duration)}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
