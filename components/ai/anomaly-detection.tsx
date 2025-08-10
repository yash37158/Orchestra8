"use client"

import { useState } from "react"
import { AlertTriangle, ExternalLink, Info, Search, Zap } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// Mock data for anomalies
const anomalies = [
  {
    id: 1,
    severity: "critical",
    title: "5xx errors spiked by 300% in auth-service",
    description: "Error rate increased from 0.5% to 2.0% in the last 15 minutes",
    timestamp: "15 minutes ago",
    service: "auth-service",
    metrics: {
      errorRate: "2.0%",
      latency: "450ms",
      cpu: "85%",
      memory: "72%",
    },
    rootCause: "Database connection pool exhaustion due to connection leaks",
    remediation: "Restart auth-service pods and increase connection pool size",
    status: "active",
  },
  {
    id: 2,
    severity: "warning",
    title: "Latency > 500ms in checkout-service",
    description: "P95 latency increased from 320ms to 520ms in the last 30 minutes",
    timestamp: "30 minutes ago",
    service: "checkout-service",
    metrics: {
      errorRate: "0.2%",
      latency: "520ms",
      cpu: "65%",
      memory: "58%",
    },
    rootCause: "Payment gateway API slowdown affecting checkout flow",
    remediation: "Implement circuit breaker pattern for payment gateway calls",
    status: "active",
  },
  {
    id: 3,
    severity: "info",
    title: "Unusual traffic pattern detected in search-service",
    description: "Traffic increased by 40% outside of normal business hours",
    timestamp: "1 hour ago",
    service: "search-service",
    metrics: {
      errorRate: "0.1%",
      latency: "180ms",
      cpu: "45%",
      memory: "52%",
    },
    rootCause: "Potential bot traffic from specific IP ranges",
    remediation: "Implement rate limiting for suspicious IP ranges",
    status: "active",
  },
  {
    id: 4,
    severity: "critical",
    title: "Memory leak detected in recommendation-service",
    description: "Memory usage increased steadily from 45% to 92% over 6 hours",
    timestamp: "2 hours ago",
    service: "recommendation-service",
    metrics: {
      errorRate: "0.3%",
      latency: "210ms",
      cpu: "35%",
      memory: "92%",
    },
    rootCause: "Cache not being properly cleared between requests",
    remediation: "Deploy hotfix for cache management in recommendation-service",
    status: "resolved",
  },
]

export function AnomalyDetection() {
  const [activeAnomalies, setActiveAnomalies] = useState(anomalies.filter((a) => a.status === "active"))
  const [resolvedAnomalies, setResolvedAnomalies] = useState(anomalies.filter((a) => a.status === "resolved"))
  const [selectedAnomaly, setSelectedAnomaly] = useState<(typeof anomalies)[0] | null>(null)
  const [remediationDialog, setRemediationDialog] = useState(false)
  const [investigateDialog, setInvestigateDialog] = useState(false)

  const handleRemediate = (anomaly: (typeof anomalies)[0]) => {
    setSelectedAnomaly(anomaly)
    setRemediationDialog(true)
  }

  const handleInvestigate = (anomaly: (typeof anomalies)[0]) => {
    setSelectedAnomaly(anomaly)
    setInvestigateDialog(true)
  }

  const confirmRemediation = () => {
    if (selectedAnomaly) {
      // Move from active to resolved
      setActiveAnomalies((prev) => prev.filter((a) => a.id !== selectedAnomaly.id))
      setResolvedAnomalies((prev) => [...prev, { ...selectedAnomaly, status: "resolved" }])
      setRemediationDialog(false)
    }
  }

  return (
    <Card className="border-red-600/20 shadow-md shadow-red-600/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-semibold">Anomaly Detection & Remediation</CardTitle>
            <CardDescription>AI-detected anomalies and recommended actions</CardDescription>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Search className="h-3.5 w-3.5" />
            <span>View All Alerts</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="active" className="space-y-4">
          <TabsList>
            <TabsTrigger value="active" className="gap-2">
              Active
              {activeAnomalies.length > 0 && (
                <Badge variant="destructive" className="h-5 px-1">
                  {activeAnomalies.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="resolved">Resolved</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="m-0 space-y-4">
            {activeAnomalies.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center rounded-md border border-dashed p-8 text-center">
                <div className="text-4xl">🎉</div>
                <h3 className="mt-2 text-sm font-medium">No active anomalies</h3>
                <p className="mt-1 text-xs text-muted-foreground">All systems are operating normally</p>
              </div>
            ) : (
              activeAnomalies.map((anomaly) => (
                <Card key={anomaly.id} className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="flex flex-col border-l-4 sm:flex-row sm:items-center sm:justify-between sm:border-l-0 sm:border-t-0 sm:p-0">
                      <div
                        className={`border-l-4 p-4 ${
                          anomaly.severity === "critical"
                            ? "border-red-500"
                            : anomaly.severity === "warning"
                              ? "border-yellow-500"
                              : "border-blue-500"
                        } sm:flex-1`}
                      >
                        <div className="mb-1 flex items-center gap-2">
                          <Badge
                            variant={
                              anomaly.severity === "critical"
                                ? "destructive"
                                : anomaly.severity === "warning"
                                  ? "warning"
                                  : "default"
                            }
                          >
                            {anomaly.severity}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{anomaly.timestamp}</span>
                        </div>

                        <h3 className="font-medium">{anomaly.title}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">{anomaly.description}</p>

                        <div className="mt-3 flex flex-wrap gap-3 text-xs">
                          <div>
                            <span className="text-muted-foreground">Service: </span>
                            <span className="font-medium">{anomaly.service}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Error Rate: </span>
                            <span className="font-medium">{anomaly.metrics.errorRate}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Latency: </span>
                            <span className="font-medium">{anomaly.metrics.latency}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex border-t p-3 sm:w-[180px] sm:flex-col sm:items-stretch sm:border-l sm:border-t-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 gap-1 text-xs sm:mb-2"
                          onClick={() => handleInvestigate(anomaly)}
                        >
                          <Search className="h-3 w-3" />
                          Investigate
                        </Button>
                        <Button
                          size="sm"
                          className={`ml-2 flex-1 gap-1 text-xs sm:ml-0 ${
                            anomaly.severity === "critical" ? "bg-red-500 hover:bg-red-600" : ""
                          }`}
                          onClick={() => handleRemediate(anomaly)}
                        >
                          <Zap className="h-3 w-3" />
                          Auto-Remediate
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="resolved" className="m-0 space-y-4">
            {resolvedAnomalies.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center rounded-md border border-dashed p-8 text-center">
                <h3 className="text-sm font-medium">No resolved anomalies</h3>
                <p className="mt-1 text-xs text-muted-foreground">Resolved anomalies will appear here</p>
              </div>
            ) : (
              resolvedAnomalies.map((anomaly) => (
                <Card key={anomaly.id} className="overflow-hidden opacity-80">
                  <CardContent className="p-4">
                    <div className="mb-1 flex items-center gap-2">
                      <Badge variant="outline">Resolved</Badge>
                      <span className="text-xs text-muted-foreground">{anomaly.timestamp}</span>
                    </div>

                    <h3 className="font-medium">{anomaly.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{anomaly.description}</p>

                    <div className="mt-2 text-xs">
                      <span className="text-muted-foreground">Root Cause: </span>
                      <span>{anomaly.rootCause}</span>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>

        {/* Remediation Dialog */}
        <Dialog open={remediationDialog} onOpenChange={setRemediationDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Auto-Remediate Anomaly</DialogTitle>
              <DialogDescription>The AI will automatically apply the recommended remediation action.</DialogDescription>
            </DialogHeader>

            {selectedAnomaly && (
              <div className="space-y-4">
                <div className="rounded-md bg-muted p-3">
                  <div className="font-medium">{selectedAnomaly.title}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{selectedAnomaly.description}</div>
                </div>

                <div>
                  <h4 className="text-sm font-medium">Root Cause Analysis</h4>
                  <p className="mt-1 text-sm">{selectedAnomaly.rootCause}</p>
                </div>

                <div>
                  <h4 className="text-sm font-medium">Recommended Action</h4>
                  <p className="mt-1 text-sm">{selectedAnomaly.remediation}</p>
                </div>

                <div className="rounded-md bg-yellow-500/10 p-3 text-sm text-yellow-500">
                  <AlertTriangle className="mb-1 h-4 w-4" />
                  <p>This action will make changes to your infrastructure. Proceed with caution.</p>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setRemediationDialog(false)}>
                Cancel
              </Button>
              <Button
                variant="default"
                className={selectedAnomaly?.severity === "critical" ? "bg-red-500 hover:bg-red-600" : ""}
                onClick={confirmRemediation}
              >
                Apply Remediation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Investigate Dialog */}
        <Dialog open={investigateDialog} onOpenChange={setInvestigateDialog}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Investigate Anomaly</DialogTitle>
              <DialogDescription>Detailed analysis and metrics for this anomaly.</DialogDescription>
            </DialogHeader>

            {selectedAnomaly && (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Anomaly Details</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm">
                      <div className="space-y-2">
                        <div>
                          <span className="text-muted-foreground">Service: </span>
                          <span className="font-medium">{selectedAnomaly.service}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Detected: </span>
                          <span>{selectedAnomaly.timestamp}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Severity: </span>
                          <Badge
                            variant={
                              selectedAnomaly.severity === "critical"
                                ? "destructive"
                                : selectedAnomaly.severity === "warning"
                                  ? "warning"
                                  : "default"
                            }
                          >
                            {selectedAnomaly.severity}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Current Metrics</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-y-2 text-sm">
                        <div>
                          <div className="text-muted-foreground">Error Rate</div>
                          <div className="font-medium">{selectedAnomaly.metrics.errorRate}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Latency</div>
                          <div className="font-medium">{selectedAnomaly.metrics.latency}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">CPU</div>
                          <div className="font-medium">{selectedAnomaly.metrics.cpu}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Memory</div>
                          <div className="font-medium">{selectedAnomaly.metrics.memory}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Root Cause Analysis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <p className="text-sm">{selectedAnomaly.rootCause}</p>

                      <div className="rounded-md bg-muted p-3 text-sm">
                        <div className="font-medium">AI Confidence: 92%</div>
                        <p className="mt-1 text-muted-foreground">
                          Based on similar patterns observed in historical incidents and current metrics.
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" className="h-8 gap-1 text-xs">
                          <ExternalLink className="h-3 w-3" />
                          View Logs
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 gap-1 text-xs">
                          <ExternalLink className="h-3 w-3" />
                          View Traces
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 gap-1 text-xs">
                          <ExternalLink className="h-3 w-3" />
                          View Metrics
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Recommended Actions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="rounded-md bg-blue-500/10 p-3 text-sm">
                        <div className="flex items-start gap-2">
                          <Info className="mt-0.5 h-4 w-4 text-blue-500" />
                          <div>
                            <p className="font-medium text-blue-500">Primary Recommendation</p>
                            <p className="mt-1">{selectedAnomaly.remediation}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setInvestigateDialog(false)}>
                          Close
                        </Button>
                        <Button
                          className={selectedAnomaly.severity === "critical" ? "bg-red-500 hover:bg-red-600" : ""}
                          onClick={() => {
                            setInvestigateDialog(false)
                            handleRemediate(selectedAnomaly)
                          }}
                        >
                          Auto-Remediate
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
