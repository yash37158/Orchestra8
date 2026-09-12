"use client"

import { useState } from "react"
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Code,
  FileWarning,
  GitBranch,
  GitPullRequest,
  Package,
  Play,
  Shield,
  ShieldCheck,
  X,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

export function ShiftLeftSecurity() {
  const [blockCritical, setBlockCritical] = useState(true)

  return (
    <div className="space-y-6">
      <Card className="border-blue-600/20 shadow-md shadow-blue-600/10">
        <CardHeader>
          <CardTitle className="text-sm font-semibold tracking-tight">Pre-Deployment Scans</CardTitle>
          <CardDescription>CI/CD pipeline security integration</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="vulnerabilities">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="vulnerabilities">Vulnerabilities</TabsTrigger>
              <TabsTrigger value="dependencies">Dependencies</TabsTrigger>
              <TabsTrigger value="secrets">Secrets</TabsTrigger>
            </TabsList>

            <TabsContent value="vulnerabilities" className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="font-medium">Latest Scan Results</h3>
                  <p className="text-sm text-muted-foreground">frontend-service:v1.2.3 scanned 15 minutes ago</p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center space-x-2">
                    <Switch id="block-critical" checked={blockCritical} onCheckedChange={setBlockCritical} />
                    <Label htmlFor="block-critical">Block Critical Vulnerabilities</Label>
                  </div>

                  <Button className="gap-1.5">
                    <Play className="h-4 w-4" />
                    Run Scan
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-4">
                <Card className="bg-red-500/10">
                  <CardContent className="p-4 text-center">
                    <FileWarning className="mx-auto mb-2 h-8 w-8 text-red-500" />
                    <div className="text-2xl font-bold text-red-500">3</div>
                    <div className="text-sm font-medium">Critical</div>
                  </CardContent>
                </Card>

                <Card className="bg-orange-500/10">
                  <CardContent className="p-4 text-center">
                    <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-orange-500" />
                    <div className="text-2xl font-bold text-orange-500">7</div>
                    <div className="text-sm font-medium">High</div>
                  </CardContent>
                </Card>

                <Card className="bg-yellow-500/10">
                  <CardContent className="p-4 text-center">
                    <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-yellow-500" />
                    <div className="text-2xl font-bold text-yellow-500">12</div>
                    <div className="text-sm font-medium">Medium</div>
                  </CardContent>
                </Card>

                <Card className="bg-blue-500/10">
                  <CardContent className="p-4 text-center">
                    <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-blue-500" />
                    <div className="text-2xl font-bold text-blue-500">24</div>
                    <div className="text-sm font-medium">Low</div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-3">
                <h3 className="font-medium">Critical Vulnerabilities</h3>

                <Collapsible className="rounded-md border">
                  <CollapsibleTrigger className="flex w-full items-center justify-between p-4 text-left">
                    <div className="flex items-center gap-3">
                      <Badge variant="destructive">CVE-2023-1234</Badge>
                      <span className="font-medium">Remote Code Execution in log4j</span>
                    </div>
                    <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="border-t px-4 pb-4 pt-2">
                    <div className="space-y-2">
                      <div className="grid gap-1 sm:grid-cols-2">
                        <div>
                          <div className="text-xs text-muted-foreground">CVSS Score</div>
                          <div className="font-medium">9.8 (Critical)</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Affected Package</div>
                          <div className="font-medium">org.apache.logging.log4j:log4j-core:2.14.0</div>
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-muted-foreground">Description</div>
                        <div className="text-sm">
                          Remote code execution vulnerability in Apache Log4j allows attackers to execute arbitrary code
                          by sending crafted LDAP requests.
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-muted-foreground">Remediation</div>
                        <div className="text-sm">
                          Update to log4j-core:2.15.0 or later to mitigate this vulnerability.
                        </div>
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                          <GitPullRequest className="h-3.5 w-3.5" />
                          Create Fix PR
                        </Button>
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                          <Shield className="h-3.5 w-3.5" />
                          Add Exception
                        </Button>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Collapsible className="rounded-md border">
                  <CollapsibleTrigger className="flex w-full items-center justify-between p-4 text-left">
                    <div className="flex items-center gap-3">
                      <Badge variant="destructive">CVE-2023-5678</Badge>
                      <span className="font-medium">SQL Injection in database connector</span>
                    </div>
                    <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="border-t px-4 pb-4 pt-2">
                    <div className="space-y-2">
                      <div className="grid gap-1 sm:grid-cols-2">
                        <div>
                          <div className="text-xs text-muted-foreground">CVSS Score</div>
                          <div className="font-medium">8.9 (Critical)</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Affected Package</div>
                          <div className="font-medium">com.example:db-connector:1.2.0</div>
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-muted-foreground">Description</div>
                        <div className="text-sm">
                          SQL injection vulnerability in the database connector allows attackers to execute arbitrary
                          SQL commands.
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-muted-foreground">Remediation</div>
                        <div className="text-sm">
                          Update to db-connector:1.3.0 or later which includes proper input sanitization.
                        </div>
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                          <GitPullRequest className="h-3.5 w-3.5" />
                          Create Fix PR
                        </Button>
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                          <Shield className="h-3.5 w-3.5" />
                          Add Exception
                        </Button>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>

              <div className="flex justify-end">
                <Button variant="outline" className="gap-1.5">
                  <FileWarning className="h-4 w-4" />
                  View All Vulnerabilities
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="dependencies" className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Dependency Graph</h3>
                <Badge variant="outline">152 Dependencies</Badge>
              </div>

              <div className="rounded-md border p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">Top-level Dependencies</span>
                  </div>
                  <Badge variant="secondary">12 packages</Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-md bg-muted p-2">
                    <div className="flex items-center gap-2">
                      <span>react@18.2.0</span>
                      <Badge variant="outline" className="bg-green-500/10 text-green-500">
                        <Check className="mr-1 h-3 w-3" />
                        Secure
                      </Badge>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                      <GitBranch className="h-3.5 w-3.5" />
                      View Tree
                    </Button>
                  </div>

                  <div className="flex items-center justify-between rounded-md bg-muted p-2">
                    <div className="flex items-center gap-2">
                      <span>express@4.18.2</span>
                      <Badge variant="outline" className="bg-green-500/10 text-green-500">
                        <Check className="mr-1 h-3 w-3" />
                        Secure
                      </Badge>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                      <GitBranch className="h-3.5 w-3.5" />
                      View Tree
                    </Button>
                  </div>

                  <div className="flex items-center justify-between rounded-md bg-muted p-2">
                    <div className="flex items-center gap-2">
                      <span>axios@1.3.0</span>
                      <Badge variant="outline" className="bg-red-500/10 text-red-500">
                        <AlertTriangle className="mr-1 h-3 w-3" />
                        Vulnerable
                      </Badge>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                      <GitBranch className="h-3.5 w-3.5" />
                      View Tree
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="secrets" className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Secret Scanning Results</h3>
                <Badge variant="secondary">Last scan: 15 minutes ago</Badge>
              </div>

              <div className="rounded-md bg-green-500/10 p-4 text-green-500">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5" />
                  <div>
                    <p className="font-medium">No secrets detected</p>
                    <p className="mt-1 text-sm">No API keys, passwords, or credentials found in the codebase</p>
                  </div>
                </div>
              </div>

              <div className="rounded-md border p-4">
                <h4 className="mb-2 font-medium">Secret Scanning Policy</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch id="block-secrets" checked={true} />
                      <Label htmlFor="block-secrets">Block deployments with detected secrets</Label>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>AWS access keys</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>Database connection strings</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>API tokens and keys</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>Private keys and certificates</span>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card className="border-blue-600/20 shadow-md shadow-blue-600/10">
        <CardHeader>
          <CardTitle className="text-sm font-semibold tracking-tight">Policy Simulator</CardTitle>
          <CardDescription>Test security policies against sample workloads</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="font-medium">Simulation Results</h3>
                <p className="text-sm text-muted-foreground">Testing 3 policies against sample workloads</p>
              </div>

              <Button className="gap-1.5">
                <Play className="h-4 w-4" />
                Run Simulation
              </Button>
            </div>

            <div className="space-y-3">
              <div className="rounded-md border">
                <div className="flex items-center justify-between border-b p-4">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="bg-green-500/10 text-green-500">
                      <Check className="mr-1 h-3 w-3" />
                      Pass
                    </Badge>
                    <span className="font-medium">deny-privileged-containers</span>
                  </div>
                  <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                    <Code className="h-3.5 w-3.5" />
                    View Policy
                  </Button>
                </div>
                <div className="p-4">
                  <div className="mb-2 text-sm">
                    <span className="text-muted-foreground">Description: </span>
                    <span>Prevents containers from running with privileged security context</span>
                  </div>
                  <div className="mb-4 text-sm">
                    <span className="text-muted-foreground">Resources tested: </span>
                    <span>15 pods</span>
                  </div>
                  <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-500">
                    <div className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4" />
                      <div>
                        <p className="font-medium">All resources passed</p>
                        <p className="mt-1">No privileged containers detected in sample workloads</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-md border">
                <div className="flex items-center justify-between border-b p-4">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="bg-red-500/10 text-red-500">
                      <X className="mr-1 h-3 w-3" />
                      Fail
                    </Badge>
                    <span className="font-medium">require-resource-limits</span>
                  </div>
                  <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                    <Code className="h-3.5 w-3.5" />
                    View Policy
                  </Button>
                </div>
                <div className="p-4">
                  <div className="mb-2 text-sm">
                    <span className="text-muted-foreground">Description: </span>
                    <span>Requires CPU and memory limits on all containers</span>
                  </div>
                  <div className="mb-4 text-sm">
                    <span className="text-muted-foreground">Resources tested: </span>
                    <span>15 pods</span>
                  </div>
                  <div className="rounded-md bg-red-500/10 p-3 text-sm text-red-500">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4" />
                      <div>
                        <p className="font-medium">3 resources failed</p>
                        <p className="mt-1">The following pods do not have resource limits defined:</p>
                        <ul className="mt-1 list-inside list-disc">
                          <li>frontend-service-pod-1</li>
                          <li>frontend-service-pod-2</li>
                          <li>cache-service-pod-1</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-md border">
                <div className="flex items-center justify-between border-b p-4">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="bg-green-500/10 text-green-500">
                      <Check className="mr-1 h-3 w-3" />
                      Pass
                    </Badge>
                    <span className="font-medium">restrict-host-paths</span>
                  </div>
                  <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                    <Code className="h-3.5 w-3.5" />
                    View Policy
                  </Button>
                </div>
                <div className="p-4">
                  <div className="mb-2 text-sm">
                    <span className="text-muted-foreground">Description: </span>
                    <span>Restricts hostPath volume mounts to approved paths</span>
                  </div>
                  <div className="mb-4 text-sm">
                    <span className="text-muted-foreground">Resources tested: </span>
                    <span>15 pods</span>
                  </div>
                  <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-500">
                    <div className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4" />
                      <div>
                        <p className="font-medium">All resources passed</p>
                        <p className="mt-1">No unauthorized hostPath mounts detected</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
