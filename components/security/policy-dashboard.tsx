"use client"

import { useState } from "react"
import { ChevronDown, Filter, Play, Plus, Search, ShieldCheck } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PolicyEditor } from "@/components/security/policy-editor"
import { PolicyTable } from "@/components/security/policy-table"

// Mock data for policies
const policies = [
  {
    id: "pol-001",
    name: "Block Privileged Containers",
    description: "Prevents containers from running with root privileges",
    type: "OPA/Gatekeeper",
    scope: "Cluster-wide",
    status: "Active",
    lastModified: "2023-11-10T14:30:00Z",
    violations: 0,
    severity: "Critical",
  },
  {
    id: "pol-002",
    name: "Enforce Resource Limits",
    description: "Requires CPU and memory limits on all containers",
    type: "OPA/Gatekeeper",
    scope: "Default Namespace",
    status: "Active",
    lastModified: "2023-11-08T09:15:00Z",
    violations: 0,
    severity: "High",
  },
  {
    id: "pol-003",
    name: "Block Public Load Balancers",
    description: "Prevents creation of services with public load balancers",
    type: "Network Policy",
    scope: "Cluster-wide",
    status: "Active",
    lastModified: "2023-11-05T11:45:00Z",
    violations: 0,
    severity: "Critical",
  },
  {
    id: "pol-004",
    name: "Enforce Image Signing",
    description: "Only allows deployment of signed container images",
    type: "Pod Security",
    scope: "Production Namespace",
    status: "Violated",
    lastModified: "2023-11-01T16:20:00Z",
    violations: 3,
    severity: "Critical",
  },
  {
    id: "pol-005",
    name: "Restrict Egress Traffic",
    description: "Limits outbound network connections from pods",
    type: "Network Policy",
    scope: "Payment Namespace",
    status: "Active",
    lastModified: "2023-10-28T13:10:00Z",
    violations: 0,
    severity: "Medium",
  },
  {
    id: "pol-006",
    name: "Enforce Pod Security Standards",
    description: "Applies Kubernetes Pod Security Standards (Restricted)",
    type: "Pod Security",
    scope: "Cluster-wide",
    status: "Violated",
    lastModified: "2023-10-25T10:05:00Z",
    violations: 2,
    severity: "High",
  },
]

export function PolicyDashboard() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedPolicy, setSelectedPolicy] = useState<(typeof policies)[0] | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [simulateOpen, setSimulateOpen] = useState(false)
  const [filters, setFilters] = useState({
    opa: true,
    network: true,
    podSecurity: true,
    active: true,
    violated: true,
  })

  // Filter policies based on search query and filters
  const filteredPolicies = policies.filter((policy) => {
    // Search filter
    const matchesSearch =
      policy.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      policy.description.toLowerCase().includes(searchQuery.toLowerCase())

    // Type filters
    const matchesType =
      (policy.type === "OPA/Gatekeeper" && filters.opa) ||
      (policy.type === "Network Policy" && filters.network) ||
      (policy.type === "Pod Security" && filters.podSecurity)

    // Status filters
    const matchesStatus =
      (policy.status === "Active" && filters.active) || (policy.status === "Violated" && filters.violated)

    return matchesSearch && matchesType && matchesStatus
  })

  const handleEditPolicy = (policy: (typeof policies)[0]) => {
    setSelectedPolicy(policy)
    setEditorOpen(true)
  }

  const handleSimulatePolicy = (policy: (typeof policies)[0]) => {
    setSelectedPolicy(policy)
    setSimulateOpen(true)
  }

  return (
    <div className="space-y-6">
      <Card className="border-blue-600/20 shadow-md shadow-blue-600/10">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-semibold">Policy Dashboard</CardTitle>
              <CardDescription>Manage and enforce security policies across your clusters</CardDescription>
            </div>
            <Button className="gap-1.5">
              <Plus className="h-4 w-4" />
              New Policy
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search policies..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                <Filter className="h-3.5 w-3.5" />
                Filters
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>

              <div className="flex items-center gap-1.5">
                <Checkbox
                  id="filter-opa"
                  checked={filters.opa}
                  onCheckedChange={(checked) => setFilters((prev) => ({ ...prev, opa: checked === true }))}
                />
                <label htmlFor="filter-opa" className="text-xs">
                  OPA/Gatekeeper
                </label>
              </div>

              <div className="flex items-center gap-1.5">
                <Checkbox
                  id="filter-network"
                  checked={filters.network}
                  onCheckedChange={(checked) => setFilters((prev) => ({ ...prev, network: checked === true }))}
                />
                <label htmlFor="filter-network" className="text-xs">
                  Network
                </label>
              </div>

              <div className="flex items-center gap-1.5">
                <Checkbox
                  id="filter-pod"
                  checked={filters.podSecurity}
                  onCheckedChange={(checked) => setFilters((prev) => ({ ...prev, podSecurity: checked === true }))}
                />
                <label htmlFor="filter-pod" className="text-xs">
                  Pod Security
                </label>
              </div>
            </div>
          </div>

          <PolicyTable policies={filteredPolicies} onEdit={handleEditPolicy} onSimulate={handleSimulatePolicy} />
        </CardContent>
      </Card>

      {/* Policy Editor Dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Edit Policy: {selectedPolicy?.name}</DialogTitle>
            <DialogDescription>Modify the policy definition and preview the impact</DialogDescription>
          </DialogHeader>

          <div className="h-[500px]">
            <PolicyEditor policy={selectedPolicy} />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setEditorOpen(false)}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Policy Simulation Dialog */}
      <Dialog open={simulateOpen} onOpenChange={setSimulateOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Simulate Policy: {selectedPolicy?.name}</DialogTitle>
            <DialogDescription>Preview the impact of this policy on your resources</DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="results">
            <TabsList>
              <TabsTrigger value="results">Simulation Results</TabsTrigger>
              <TabsTrigger value="logs">Detailed Logs</TabsTrigger>
            </TabsList>

            <TabsContent value="results" className="space-y-4 pt-4">
              <div className="rounded-md bg-green-500/10 p-4 text-green-500">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5" />
                  <div>
                    <p className="font-medium">Policy simulation successful</p>
                    <p className="mt-1 text-sm">
                      This policy would enforce the intended security controls without affecting existing workloads.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-md border p-4">
                <h3 className="mb-2 font-medium">Resources Affected</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span>Total resources scanned:</span>
                    <span className="font-medium">128</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Resources that would be blocked:</span>
                    <span className="font-medium">0</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Resources that would be modified:</span>
                    <span className="font-medium">0</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSimulateOpen(false)}>
                  Close
                </Button>
                <Button className="gap-1.5" onClick={() => setSimulateOpen(false)}>
                  <Play className="h-4 w-4" />
                  Apply Policy
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="logs" className="pt-4">
              <div className="h-[300px] overflow-auto rounded-md bg-black p-4 font-mono text-xs text-green-400">
                <div>INFO: Starting policy simulation for &quot;{selectedPolicy?.name}&quot;</div>
                <div>INFO: Scanning resources in scope: {selectedPolicy?.scope}</div>
                <div>INFO: Applying policy rules to 128 resources</div>
                <div>INFO: No violations detected</div>
                <div>INFO: Simulation completed successfully</div>
                <div>INFO: Policy would be enforced without affecting existing workloads</div>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  )
}
