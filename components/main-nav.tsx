"use client"

import { useState } from "react"
import { Check, Loader2 } from "lucide-react"
import { useForm } from "react-hook-form"

import { Button } from "@/components/ui/button"
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
import { Shield, Search, FileDown, Wand2 } from "lucide-react"
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

interface DeployFormValues {
  environment: string
  version: string
  canaryDeployment: boolean
  autoRollback: boolean
}

export function MainNav({ className }: { className?: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isDeploying, setIsDeploying] = useState(false)
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

  const form = useForm<DeployFormValues>({
    defaultValues: {
      environment: "",
      version: "",
      canaryDeployment: false,
      autoRollback: true,
    },
  })

  const handleDeploy = async (values: DeployFormValues) => {
    setIsDeploying(true)

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Random success/failure for demo purposes
      const isSuccess = Math.random() > 0.3

      if (isSuccess) {
        toast({
          title: `Deployment initiated to ${values.environment} 🎉`,
          description: `Version ${values.version} is being deployed.`,
          variant: "success",
        })
        setIsOpen(false)
      } else {
        throw new Error("Image pull failed")
      }
    } catch (error) {
      toast({
        title: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        description: "Check your configuration and try again.",
        variant: "destructive",
        action: (
          <Button variant="outline" size="sm" onClick={() => handleDeploy(values)}>
            Retry
          </Button>
        ),
      })
    } finally {
      setIsDeploying(false)
    }
  }

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
      <Button
        onClick={() => setIsOpen(true)}
        className="bg-blue-600 hover:bg-blue-700 text-white"
        disabled={isDeploying}
        size="sm"
      >
        {isDeploying ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Deploying...
          </>
        ) : (
          <>
            <span className="mr-2" role="img" aria-label="rocket">
              🚀
            </span>
            Deploy App
          </>
        )}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Deploy Application</DialogTitle>
            <DialogDescription>Configure your deployment settings below.</DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(handleDeploy)} className="space-y-6 py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="environment">Environment</Label>
                <Select
                  onValueChange={(value) => form.setValue("environment", value)}
                  defaultValue={form.getValues("environment")}
                >
                  <SelectTrigger id="environment" className="w-full">
                    <SelectValue placeholder="Select environment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aws-prod">AWS Production</SelectItem>
                    <SelectItem value="aws-staging">AWS Staging</SelectItem>
                    <SelectItem value="gcp-prod">GCP Production</SelectItem>
                    <SelectItem value="gcp-staging">GCP Staging</SelectItem>
                    <SelectItem value="edge-network">Edge Network</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="version">Version</Label>
                <Select
                  onValueChange={(value) => form.setValue("version", value)}
                  defaultValue={form.getValues("version")}
                >
                  <SelectTrigger id="version" className="w-full">
                    <SelectValue placeholder="Select version" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="v1.0.0">v1.0.0 (latest)</SelectItem>
                    <SelectItem value="v0.9.5">v0.9.5</SelectItem>
                    <SelectItem value="v0.9.0">v0.9.0</SelectItem>
                    <SelectItem value="main">main (branch)</SelectItem>
                    <SelectItem value="develop">develop (branch)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-4 border-t">
                <h4 className="text-sm font-medium mb-3">Advanced Options</h4>

                <div className="flex items-center justify-between mb-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="canary-deployment">Enable Canary Deployment</Label>
                    <p className="text-sm text-muted-foreground">Gradually roll out to a subset of users</p>
                  </div>
                  <Switch
                    id="canary-deployment"
                    checked={form.watch("canaryDeployment")}
                    onCheckedChange={(checked) => form.setValue("canaryDeployment", checked)}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="auto-rollback"
                    checked={form.watch("autoRollback")}
                    onCheckedChange={(checked) => {
                      if (typeof checked === "boolean") {
                        form.setValue("autoRollback", checked)
                      }
                    }}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <Label htmlFor="auto-rollback">Auto-Rollback on Failure</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically revert to previous version if deployment fails
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-emerald-500 hover:bg-emerald-600" disabled={isDeploying}>
                {isDeploying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deploying...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Confirm Deployment
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Sheet open={showResults} onOpenChange={setShowResults}>
        <SheetTrigger asChild>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={isScanning ? "bg-purple-700 text-white" : "bg-purple-600 hover:bg-purple-700 text-white"}
                disabled={isScanning}
              >
                {isScanning ? (
                  <>
                    <Search className="mr-2 h-4 w-4 animate-pulse" />
                    Scanning... {scanProgress}%
                  </>
                ) : (
                  <>
                    <span className="mr-2" role="img" aria-label="shield">
                      🛡️
                    </span>
                    Run Security Scan
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

      <Button variant="ghost" size="sm">
        Simulate Chaos
      </Button>
    </nav>
  )
}
