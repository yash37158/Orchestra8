"use client"

import { useState } from "react"
import { AlertCircle, Info, Server, Zap } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { TrafficForecastChart } from "@/components/ai/traffic-forecast-chart"
import { ResourceAllocationHeatmap } from "@/components/ai/resource-allocation-heatmap"

export function PredictiveScalingDashboard() {
  const [confidenceInterval, setConfidenceInterval] = useState("95")
  const [enablePreScaling, setEnablePreScaling] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  return (
    <Card className="border-blue-600/20 shadow-md shadow-blue-600/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-semibold">Predictive Scaling Dashboard</CardTitle>
            <CardDescription>AI-driven resource optimization and traffic forecasting</CardDescription>
          </div>
          <Button
            variant={enablePreScaling ? "default" : "outline"}
            className="gap-1.5"
            onClick={() => setShowConfirmDialog(true)}
          >
            <Zap className="h-4 w-4" />
            {enablePreScaling ? "Pre-Scaling Enabled" : "Enable Pre-Scaling"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="traffic" className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="traffic">Traffic Forecast</TabsTrigger>
              <TabsTrigger value="resources">Resource Allocation</TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-4">
              {/* Confidence Interval Selector */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Confidence:</span>
                <select
                  value={confidenceInterval}
                  onChange={(e) => setConfidenceInterval(e.target.value)}
                  className="rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="80">80%</option>
                  <option value="95">95%</option>
                  <option value="99">99%</option>
                </select>
              </div>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">
                      AI predictions are based on historical patterns, current traffic, and external factors like
                      scheduled events.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          <TabsContent value="traffic" className="m-0">
            <TrafficForecastChart confidenceInterval={Number.parseInt(confidenceInterval)} />
          </TabsContent>

          <TabsContent value="resources" className="m-0">
            <ResourceAllocationHeatmap />
          </TabsContent>
        </Tabs>

        <div className="mt-4 rounded-md bg-blue-500/10 p-3 text-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 text-blue-500" />
            <div>
              <p className="font-medium text-blue-500">AI Suggestion</p>
              <p className="mt-1">
                Scale payment-service pods from 10 → 15 replicas at 3 PM to handle predicted traffic spike.
              </p>
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 border-blue-500/50 text-xs text-blue-500 hover:bg-blue-500/10 hover:text-blue-500"
                >
                  <Server className="h-3 w-3" />
                  View Service
                </Button>
                <Button size="sm" className="h-7 gap-1 bg-blue-500 text-xs text-white hover:bg-blue-600">
                  <Zap className="h-3 w-3" />
                  Apply Now
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enable AI Pre-Scaling</DialogTitle>
            <DialogDescription>
              This will allow the AI to automatically scale resources based on predicted traffic patterns. You can
              disable this at any time.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center space-x-2 py-4">
            <Switch id="auto-apply" checked={enablePreScaling} onCheckedChange={setEnablePreScaling} />
            <Label htmlFor="auto-apply">Auto-apply critical scaling recommendations</Label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setShowConfirmDialog(false)
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
