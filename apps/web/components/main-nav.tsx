"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DeployDialog } from "@/components/deploy-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Shield, Search, FileDown, Wand2, Rocket, Zap } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function MainNav({ className }: { className?: string }) {
  const { toast } = useToast()

  const [isScanning, setIsScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [scanResults, setScanResults] = useState<{
    vulnerabilities: { name: string; severity: string; cvss: number; affected: string }[]
    policyViolations: { name: string; severity: string; resource: string; description: string }[]
    runtimeThreats: { name: string; severity: string; container: string; timestamp: string }[]
  }>({
    vulnerabilities: [],
    policyViolations: [],
    runtimeThreats: [],
  })
  const [showResults, setShowResults] = useState(false)

  const handleScan = async (scanType: string) => {
    setIsScanning(true)
    setScanProgress(0)
    setShowResults(false)

    // Simulate scanning progress
    const interval = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          return 100
        }
        return prev + 5
      })
    }, 300)

    // Simulate scan completion
    setTimeout(() => {
      clearInterval(interval)
      setScanProgress(100)
      setIsScanning(false)

      // Generate mock results based on scan type
      const mockVulnerabilities = [
        { name: "CVE-2023-1234", severity: "Critical", cvss: 9.8, affected: "nginx:1.19" },
        { name: "CVE-2023-5678", severity: "High", cvss: 8.2, affected: "node:16" },
        { name: "CVE-2023-9012", severity: "Medium", cvss: 5.5, affected: "python:3.9" },
      ]

      const mockPolicyViolations = [
        {
          name: "Privileged Container",
          severity: "High",
          resource: "deployment/api-server",
          description: "Container running in privileged mode",
        },
        {
          name: "No Resource Limits",
          severity: "Medium",
          resource: "deployment/frontend",
          description: "Container has no CPU/memory limits",
        },
        {
          name: "Latest Tag",
          severity: "Low",
          resource: "deployment/logger",
          description: "Container using 'latest' tag",
        },
      ]

      const mockRuntimeThreats = [
        { name: "Suspicious Process", severity: "Critical", container: "api-server", timestamp: "2023-05-15 14:23:45" },
        {
          name: "File System Modification",
          severity: "Medium",
          container: "database",
          timestamp: "2023-05-15 14:25:12",
        },
      ]

      if (scanType === "deep") {
        // Add more results for deep scan
        mockVulnerabilities.push({ name: "CVE-2023-3456", severity: "Critical", cvss: 9.5, affected: "redis:6" })
        mockPolicyViolations.push({
          name: "Exposed Secret",
          severity: "Critical",
          resource: "secret/db-creds",
          description: "Secret not encrypted",
        })
        mockRuntimeThreats.push({
          name: "Network Anomaly",
          severity: "High",
          container: "proxy",
          timestamp: "2023-05-15 14:26:30",
        })
      }

      setScanResults({
        vulnerabilities: mockVulnerabilities,
        policyViolations: mockPolicyViolations,
        runtimeThreats: mockRuntimeThreats,
      })

      setShowResults(true)
    }, 5000)
  }

  return (
    <nav className={cn("hidden items-center space-x-4 md:flex", className)}>
      <DeployDialog />

      <Sheet open={showResults} onOpenChange={setShowResults}>
        <SheetTrigger asChild>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={isScanning}>
                {isScanning ? (
                  <>
                    <Search className="mr-2 h-4 w-4 animate-pulse" />
                    Scanning {scanProgress}%
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-4 w-4" />
                    Security scan
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Select Scan Type</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleScan("quick")}>
                <Shield className="mr-2 h-4 w-4" />
                Quick Scan
                <span className="ml-auto text-xs text-muted-foreground">Trivy CVEs only</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleScan("deep")}>
                <Shield className="mr-2 h-4 w-4" />
                Deep Scan
                <span className="ml-auto text-xs text-muted-foreground">+ OPA, Falco</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Shield className="mr-2 h-4 w-4" />
                Custom Scope...
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SheetTrigger>
        <SheetContent className="w-[400px] sm:w-[540px] md:w-[640px]">
          <SheetHeader>
            <SheetTitle>Security Scan Results</SheetTitle>
            <SheetDescription>
              {scanResults.vulnerabilities.filter((v) => v.severity === "Critical").length} critical issues found
            </SheetDescription>
          </SheetHeader>

          {isScanning ? (
            <div className="py-6">
              <h4 className="text-sm font-medium mb-2">Scanning in progress...</h4>
              <Progress value={scanProgress} className="h-2 mb-2" />
              <p className="text-sm text-muted-foreground">{scanProgress}% complete</p>
            </div>
          ) : (
            <div className="py-4">
              <Tabs defaultValue="vulnerabilities">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="vulnerabilities">
                    Vulnerabilities
                    <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                      {scanResults.vulnerabilities.length}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="policies">
                    Policy Violations
                    <span className="ml-2 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                      {scanResults.policyViolations.length}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="runtime">
                    Runtime Threats
                    <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
                      {scanResults.runtimeThreats.length}
                    </span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="vulnerabilities" className="mt-4 space-y-4">
                  <div className="rounded-md border">
                    <div className="grid grid-cols-12 gap-2 p-3 font-medium border-b">
                      <div className="col-span-5">Vulnerability</div>
                      <div className="col-span-2">Severity</div>
                      <div className="col-span-2">CVSS</div>
                      <div className="col-span-3">Affected</div>
                    </div>
                    <div className="divide-y">
                      {scanResults.vulnerabilities.map((vuln, i) => (
                        <div key={i} className="grid grid-cols-12 gap-2 p-3 text-sm">
                          <div className="col-span-5 font-mono">{vuln.name}</div>
                          <div className="col-span-2">
                            <span
                              className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                                vuln.severity === "Critical"
                                  ? "bg-red-100 text-red-800"
                                  : vuln.severity === "High"
                                    ? "bg-orange-100 text-orange-800"
                                    : "bg-yellow-100 text-yellow-800"
                              }`}
                            >
                              {vuln.severity}
                            </span>
                          </div>
                          <div className="col-span-2">{vuln.cvss}</div>
                          <div className="col-span-3 font-mono text-xs">{vuln.affected}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="policies" className="mt-4 space-y-4">
                  <div className="rounded-md border">
                    <div className="grid grid-cols-12 gap-2 p-3 font-medium border-b">
                      <div className="col-span-4">Policy</div>
                      <div className="col-span-2">Severity</div>
                      <div className="col-span-3">Resource</div>
                      <div className="col-span-3">Description</div>
                    </div>
                    <div className="divide-y">
                      {scanResults.policyViolations.map((policy, i) => (
                        <div key={i} className="grid grid-cols-12 gap-2 p-3 text-sm">
                          <div className="col-span-4">{policy.name}</div>
                          <div className="col-span-2">
                            <span
                              className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                                policy.severity === "Critical"
                                  ? "bg-red-100 text-red-800"
                                  : policy.severity === "High"
                                    ? "bg-orange-100 text-orange-800"
                                    : "bg-yellow-100 text-yellow-800"
                              }`}
                            >
                              {policy.severity}
                            </span>
                          </div>
                          <div className="col-span-3 font-mono text-xs">{policy.resource}</div>
                          <div className="col-span-3 text-xs">{policy.description}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="runtime" className="mt-4 space-y-4">
                  <div className="rounded-md border">
                    <div className="grid grid-cols-12 gap-2 p-3 font-medium border-b">
                      <div className="col-span-4">Threat</div>
                      <div className="col-span-2">Severity</div>
                      <div className="col-span-3">Container</div>
                      <div className="col-span-3">Timestamp</div>
                    </div>
                    <div className="divide-y">
                      {scanResults.runtimeThreats.map((threat, i) => (
                        <div key={i} className="grid grid-cols-12 gap-2 p-3 text-sm">
                          <div className="col-span-4">{threat.name}</div>
                          <div className="col-span-2">
                            <span
                              className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                                threat.severity === "Critical"
                                  ? "bg-red-100 text-red-800"
                                  : threat.severity === "High"
                                    ? "bg-orange-100 text-orange-800"
                                    : "bg-yellow-100 text-yellow-800"
                              }`}
                            >
                              {threat.severity}
                            </span>
                          </div>
                          <div className="col-span-3 font-mono text-xs">{threat.container}</div>
                          <div className="col-span-3 text-xs">{threat.timestamp}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}

          <SheetFooter className="flex justify-between sm:justify-between mt-4">
            <div className="flex space-x-2">
              <Button variant="outline" size="sm" className="flex items-center">
                <FileDown className="mr-2 h-4 w-4" />
                Export Report
              </Button>
              <Button variant="outline" size="sm" className="flex items-center">
                <Wand2 className="mr-2 h-4 w-4" />
                Auto-Remediate
              </Button>
            </div>
            <SheetClose asChild>
              <Button variant="ghost" size="sm">
                Close
              </Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Button variant="ghost" size="sm" className="text-muted-foreground">
        <Zap className="mr-2 h-4 w-4" />
        Resilience test
      </Button>
    </nav>
  )
}
