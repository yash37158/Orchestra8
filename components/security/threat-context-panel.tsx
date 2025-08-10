"use client"

import { Ban, FileText, Lock, Shield, Terminal, X } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface ThreatContextPanelProps {
  threat: any
  onClose: () => void
  onQuarantine: (threat: any) => void
  onResolve: (threat: any) => void
}

export function ThreatContextPanel({ threat, onClose, onQuarantine, onResolve }: ThreatContextPanelProps) {
  // Generate mock timeline events based on threat
  const timelineEvents = [
    {
      id: 1,
      time: "10 minutes before detection",
      title: "Pod created",
      description: `Pod ${threat.resource.split("/")[1]} created in namespace ${threat.namespace}`,
    },
    {
      id: 2,
      time: "5 minutes before detection",
      title: "Container started",
      description: "Container runtime started successfully",
    },
    {
      id: 3,
      time: "2 minutes before detection",
      title: "Unusual process started",
      description:
        threat.severity === "critical"
          ? "Process 'xmrig' started with high CPU usage"
          : "Unusual network connection established",
    },
    {
      id: 4,
      time: "At detection",
      title: "Security rule triggered",
      description: `Rule "${threat.rule}" triggered by runtime behavior`,
    },
  ]

  return (
    <Card className="border-red-600/20 shadow-md shadow-red-600/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-semibold">Threat Details</CardTitle>
            <CardDescription>Detailed analysis and context</CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md bg-muted p-4">
          <div className="mb-2 flex items-center gap-2">
            <Badge
              variant={
                threat.severity === "critical" ? "destructive" : threat.severity === "warning" ? "warning" : "default"
              }
            >
              {threat.severity}
            </Badge>
            <h3 className="font-medium">{threat.title}</h3>
          </div>
          <p className="text-sm text-muted-foreground">{threat.description}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Resource Details</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <div className="space-y-2">
                <div>
                  <span className="text-muted-foreground">Resource: </span>
                  <span className="font-medium">{threat.resource}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Namespace: </span>
                  <span className="font-medium">{threat.namespace}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Cluster: </span>
                  <span className="font-medium">{threat.cluster}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Status: </span>
                  <Badge
                    variant={
                      threat.status === "active"
                        ? "destructive"
                        : threat.status === "investigating"
                          ? "warning"
                          : "outline"
                    }
                  >
                    {threat.status}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Detection Details</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <div className="space-y-2">
                <div>
                  <span className="text-muted-foreground">Rule: </span>
                  <span className="font-medium">{threat.rule}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Detected: </span>
                  <span>{threat.timestamp}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Confidence: </span>
                  <span className="font-medium">
                    {threat.severity === "critical"
                      ? "High (95%)"
                      : threat.severity === "warning"
                        ? "Medium (75%)"
                        : "Low (60%)"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="timeline">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
          </TabsList>

          <TabsContent value="timeline" className="space-y-4 pt-4">
            <div className="relative pl-6">
              <div className="absolute bottom-0 left-2 top-0 w-0.5 bg-muted"></div>

              {timelineEvents.map((event, index) => (
                <div key={event.id} className="mb-4 last:mb-0">
                  <div className="absolute left-0 mt-1.5 h-4 w-4 rounded-full border border-primary bg-background"></div>
                  <div className="mb-1 text-xs text-muted-foreground">{event.time}</div>
                  <div className="font-medium">{event.title}</div>
                  <div className="text-sm text-muted-foreground">{event.description}</div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="logs" className="pt-4">
            <div className="h-[200px] overflow-auto rounded-md bg-black p-4 font-mono text-xs text-green-400">
              <div>
                [2023-11-10T14:30:00Z] INFO: Pod {threat.resource.split("/")[1]} created in namespace {threat.namespace}
              </div>
              <div>[2023-11-10T14:35:00Z] INFO: Container started successfully</div>
              <div>[2023-11-10T14:38:00Z] WARN: Unusual process activity detected</div>
              {threat.severity === "critical" && (
                <>
                  <div>[2023-11-10T14:38:30Z] WARN: High CPU usage detected (95%)</div>
                  <div>[2023-11-10T14:39:00Z] ERROR: Process 'xmrig' identified - potential cryptomining</div>
                  <div>[2023-11-10T14:40:00Z] ALERT: Security rule "{threat.rule}" triggered</div>
                </>
              )}
              {threat.severity === "warning" && (
                <>
                  <div>[2023-11-10T14:38:30Z] WARN: Unusual network connection to 203.0.113.100:8545</div>
                  <div>[2023-11-10T14:39:00Z] WARN: Connection not in allowlist</div>
                  <div>[2023-11-10T14:40:00Z] ALERT: Security rule "{threat.rule}" triggered</div>
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="actions" className="space-y-4 pt-4">
            <div className="rounded-md bg-muted p-4">
              <h3 className="mb-2 font-medium">Recommended Actions</h3>
              <div className="space-y-2 text-sm">
                {threat.severity === "critical" && (
                  <div className="flex items-start gap-2">
                    <Lock className="mt-0.5 h-4 w-4 text-red-500" />
                    <div>
                      <p className="font-medium text-red-500">Quarantine Workload</p>
                      <p className="text-muted-foreground">Isolate the affected pod to prevent further damage</p>
                    </div>
                  </div>
                )}

                {threat.title.includes("Unauthorized kubectl exec") && (
                  <div className="flex items-start gap-2">
                    <Ban className="mt-0.5 h-4 w-4 text-yellow-500" />
                    <div>
                      <p className="font-medium text-yellow-500">Block IP Address</p>
                      <p className="text-muted-foreground">Add 192.168.1.1 to network deny list</p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-2">
                  <FileText className="mt-0.5 h-4 w-4 text-blue-500" />
                  <div>
                    <p className="font-medium text-blue-500">Generate Incident Report</p>
                    <p className="text-muted-foreground">Create detailed documentation for security team</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {threat.status === "active" && threat.actions.includes("quarantine") && (
                <Button className="gap-1.5" onClick={() => onQuarantine(threat)}>
                  <Lock className="h-4 w-4" />
                  Quarantine Workload
                </Button>
              )}

              {threat.title.includes("Unauthorized kubectl exec") && (
                <Button variant="outline" className="gap-1.5">
                  <Ban className="h-4 w-4" />
                  Block IP Address
                </Button>
              )}

              {threat.status === "investigating" && (
                <Button className="gap-1.5" onClick={() => onResolve(threat)}>
                  <Shield className="h-4 w-4" />
                  Mark as Resolved
                </Button>
              )}

              <Button variant="outline" className="gap-1.5">
                <Terminal className="h-4 w-4" />
                Run Diagnostics
              </Button>

              <Button variant="outline" className="gap-1.5">
                <FileText className="h-4 w-4" />
                Generate Report
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
