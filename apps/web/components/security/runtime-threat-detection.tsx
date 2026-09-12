"use client"

import { useState } from "react"
import { Ban, Clock, Filter, Lock, Search, Shield, ShieldAlert } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ThreatContextPanel } from "@/components/security/threat-context-panel"

// Mock data for threats
const threats = [
  {
    id: "threat-001",
    severity: "critical",
    title: "Cryptomining detected in pod/frontend-xyz",
    description: "Unusual CPU usage pattern and known cryptomining process detected",
    timestamp: "10 minutes ago",
    status: "active",
    resource: "pod/frontend-xyz",
    namespace: "default",
    cluster: "production-east",
    rule: "Cryptomining Detection",
    actions: ["quarantine", "investigate"],
  },
  {
    id: "threat-002",
    severity: "warning",
    title: "Unauthorized kubectl exec from IP 192.168.1.1",
    description: "Kubectl exec command executed from unauthorized IP address",
    timestamp: "25 minutes ago",
    status: "active",
    resource: "cluster/production-east",
    namespace: "N/A",
    cluster: "production-east",
    rule: "Unauthorized Access",
    actions: ["investigate", "block-ip"],
  },
  {
    id: "threat-003",
    severity: "critical",
    title: "Privilege escalation attempt in pod/backend-api-7",
    description: "Container attempted to modify host system files",
    timestamp: "45 minutes ago",
    status: "active",
    resource: "pod/backend-api-7",
    namespace: "backend",
    cluster: "production-west",
    rule: "Privilege Escalation",
    actions: ["quarantine", "investigate"],
  },
  {
    id: "threat-004",
    severity: "info",
    title: "Unusual network connection to external IP",
    description: "Pod connected to unusual external IP address not in allowlist",
    timestamp: "1 hour ago",
    status: "investigating",
    resource: "pod/cache-redis-9",
    namespace: "data",
    cluster: "production-east",
    rule: "Unusual Network",
    actions: ["investigate"],
  },
  {
    id: "threat-005",
    severity: "warning",
    title: "Container running with excessive privileges",
    description: "Container running with privileged flag enabled",
    timestamp: "2 hours ago",
    status: "resolved",
    resource: "pod/monitoring-agent-3",
    namespace: "monitoring",
    cluster: "production-east",
    rule: "Privileged Container",
    actions: [],
  },
]

export function RuntimeThreatDetection() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedThreat, setSelectedThreat] = useState<(typeof threats)[0] | null>(null)
  const [activeThreats, setActiveThreats] = useState(threats.filter((t) => t.status === "active"))
  const [investigatingThreats, setInvestigatingThreats] = useState(threats.filter((t) => t.status === "investigating"))
  const [resolvedThreats, setResolvedThreats] = useState(threats.filter((t) => t.status === "resolved"))

  const handleQuarantine = (threat: (typeof threats)[0]) => {
    // Move from active to investigating
    setActiveThreats((prev) => prev.filter((t) => t.id !== threat.id))
    setInvestigatingThreats((prev) => [...prev, { ...threat, status: "investigating" }])
  }

  const handleResolve = (threat: (typeof threats)[0]) => {
    // Move from investigating to resolved
    setInvestigatingThreats((prev) => prev.filter((t) => t.id !== threat.id))
    setResolvedThreats((prev) => [...prev, { ...threat, status: "resolved" }])
  }

  const handleSelectThreat = (threat: (typeof threats)[0]) => {
    setSelectedThreat(threat)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Card className="border-red-600/20 shadow-md shadow-red-600/10">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold tracking-tight">Runtime Threat Detection</CardTitle>
                <CardDescription>Real-time security threats and anomalies</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                  <Filter className="h-3.5 w-3.5" />
                  Filter
                </Button>
                <div className="relative w-[180px]">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search threats..."
                    className="h-8 pl-8 text-xs"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="active" className="space-y-4">
              <TabsList>
                <TabsTrigger value="active" className="gap-2">
                  Active
                  {activeThreats.length > 0 && (
                    <Badge variant="destructive" className="h-5 px-1">
                      {activeThreats.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="investigating" className="gap-2">
                  Investigating
                  {investigatingThreats.length > 0 && (
                    <Badge variant="warning" className="h-5 px-1">
                      {investigatingThreats.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="resolved">Resolved</TabsTrigger>
              </TabsList>

              <TabsContent value="active" className="m-0 space-y-4">
                {activeThreats.length === 0 ? (
                  <div className="flex h-40 flex-col items-center justify-center rounded-md border border-dashed p-8 text-center">
                    <div className="text-4xl">🛡️</div>
                    <h3 className="mt-2 text-sm font-medium">No active threats</h3>
                    <p className="mt-1 text-xs text-muted-foreground">All systems are secure</p>
                  </div>
                ) : (
                  activeThreats.map((threat) => (
                    <Card
                      key={threat.id}
                      className={`overflow-hidden transition-all hover:shadow-md ${
                        selectedThreat?.id === threat.id ? "ring-2 ring-primary" : ""
                      }`}
                      onClick={() => handleSelectThreat(threat)}
                    >
                      <CardContent className="p-0">
                        <div className="flex flex-col border-l-4 sm:flex-row sm:items-center sm:justify-between sm:border-l-0 sm:border-t-0 sm:p-0">
                          <div
                            className={`border-l-4 p-4 ${
                              threat.severity === "critical"
                                ? "border-red-500"
                                : threat.severity === "warning"
                                  ? "border-yellow-500"
                                  : "border-blue-500"
                            } sm:flex-1`}
                          >
                            <div className="mb-1 flex items-center gap-2">
                              <Badge
                                variant={
                                  threat.severity === "critical"
                                    ? "destructive"
                                    : threat.severity === "warning"
                                      ? "warning"
                                      : "default"
                                }
                              >
                                {threat.severity}
                              </Badge>
                              <span className="text-xs text-muted-foreground">{threat.timestamp}</span>
                            </div>

                            <h3 className="font-medium">{threat.title}</h3>
                            <p className="mt-1 text-xs text-muted-foreground">{threat.description}</p>

                            <div className="mt-3 flex flex-wrap gap-3 text-xs">
                              <div>
                                <span className="text-muted-foreground">Resource: </span>
                                <span className="font-medium">{threat.resource}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Namespace: </span>
                                <span className="font-medium">{threat.namespace}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Rule: </span>
                                <span className="font-medium">{threat.rule}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex border-t p-3 sm:w-[180px] sm:flex-col sm:items-stretch sm:border-l sm:border-t-0">
                            {threat.actions.includes("quarantine") && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 gap-1 text-xs sm:mb-2"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleQuarantine(threat)
                                }}
                              >
                                <Lock className="h-3 w-3" />
                                Quarantine
                              </Button>
                            )}
                            {threat.actions.includes("block-ip") && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 gap-1 text-xs sm:mb-2"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  // Handle block IP
                                }}
                              >
                                <Ban className="h-3 w-3" />
                                Block IP
                              </Button>
                            )}
                            {threat.actions.includes("investigate") && (
                              <Button
                                size="sm"
                                className={`ml-2 flex-1 gap-1 text-xs sm:ml-0 ${
                                  threat.severity === "critical" ? "bg-red-500 hover:bg-red-600" : ""
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleSelectThreat(threat)
                                }}
                              >
                                <Search className="h-3 w-3" />
                                Investigate
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>

              <TabsContent value="investigating" className="m-0 space-y-4">
                {investigatingThreats.length === 0 ? (
                  <div className="flex h-40 flex-col items-center justify-center rounded-md border border-dashed p-8 text-center">
                    <h3 className="text-sm font-medium">No threats under investigation</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Threats under investigation will appear here</p>
                  </div>
                ) : (
                  investigatingThreats.map((threat) => (
                    <Card
                      key={threat.id}
                      className={`overflow-hidden transition-all hover:shadow-md ${
                        selectedThreat?.id === threat.id ? "ring-2 ring-primary" : ""
                      }`}
                      onClick={() => handleSelectThreat(threat)}
                    >
                      <CardContent className="p-4">
                        <div className="mb-1 flex items-center gap-2">
                          <Badge variant="outline" className="border-yellow-500 text-yellow-500">
                            <Clock className="mr-1 h-3 w-3" />
                            Investigating
                          </Badge>
                          <span className="text-xs text-muted-foreground">{threat.timestamp}</span>
                        </div>

                        <h3 className="font-medium">{threat.title}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">{threat.description}</p>

                        <div className="mt-3 flex justify-end">
                          <Button
                            size="sm"
                            className="gap-1 text-xs"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleResolve(threat)
                            }}
                          >
                            <Shield className="h-3 w-3" />
                            Mark as Resolved
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>

              <TabsContent value="resolved" className="m-0 space-y-4">
                {resolvedThreats.length === 0 ? (
                  <div className="flex h-40 flex-col items-center justify-center rounded-md border border-dashed p-8 text-center">
                    <h3 className="text-sm font-medium">No resolved threats</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Resolved threats will appear here</p>
                  </div>
                ) : (
                  resolvedThreats.map((threat) => (
                    <Card
                      key={threat.id}
                      className="overflow-hidden opacity-80"
                      onClick={() => handleSelectThreat(threat)}
                    >
                      <CardContent className="p-4">
                        <div className="mb-1 flex items-center gap-2">
                          <Badge variant="outline" className="border-green-500 text-green-500">
                            <Shield className="mr-1 h-3 w-3" />
                            Resolved
                          </Badge>
                          <span className="text-xs text-muted-foreground">{threat.timestamp}</span>
                        </div>

                        <h3 className="font-medium">{threat.title}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">{threat.description}</p>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <div>
        {selectedThreat ? (
          <ThreatContextPanel
            threat={selectedThreat}
            onClose={() => setSelectedThreat(null)}
            onQuarantine={handleQuarantine}
            onResolve={handleResolve}
          />
        ) : (
          <Card className="flex h-full flex-col items-center justify-center border-dashed p-8 text-center">
            <ShieldAlert className="mb-2 h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-medium">Select a threat</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Select a threat to view detailed information and take action
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}
