"use client"

import { useState } from "react"
import {
  Activity,
  ArrowRight,
  ChevronDown,
  Clock,
  Cpu,
  Filter,
  HardDrive,
  MoreHorizontal,
  Plus,
  RefreshCw,
  RotateCw,
  Search,
  Terminal,
  Trash,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// Mock data for edge nodes
const edgeNodes = [
  {
    id: "edge-mum-01",
    name: "Mumbai Edge 01",
    location: "Mumbai, IN",
    coordinates: [72.8777, 19.076],
    status: "online",
    lastSync: "2 mins ago",
    cpu: 45,
    memory: 62,
    bandwidth: 7.2,
    maxBandwidth: 10,
    storage: 68,
    region: "Asia Pacific",
    latency: 32,
    signalStrength: 85,
    firmware: "v2.3.4",
    pendingSyncs: 0,
  },
  {
    id: "edge-mum-02",
    name: "Mumbai Edge 02",
    location: "Mumbai, IN",
    coordinates: [72.8677, 19.066],
    status: "online",
    lastSync: "5 mins ago",
    cpu: 38,
    memory: 55,
    bandwidth: 6.5,
    maxBandwidth: 10,
    storage: 72,
    region: "Asia Pacific",
    latency: 35,
    signalStrength: 82,
    firmware: "v2.3.4",
    pendingSyncs: 2,
  },
  {
    id: "edge-ber-01",
    name: "Berlin Edge 01",
    location: "Berlin, DE",
    coordinates: [13.405, 52.52],
    status: "online",
    lastSync: "1 min ago",
    cpu: 32,
    memory: 48,
    bandwidth: 5.8,
    maxBandwidth: 10,
    storage: 45,
    region: "Europe",
    latency: 28,
    signalStrength: 90,
    firmware: "v2.3.4",
    pendingSyncs: 0,
  },
  {
    id: "edge-ber-02",
    name: "Berlin Edge 02",
    location: "Berlin, DE",
    coordinates: [13.415, 52.53],
    status: "offline",
    lastSync: "2 hours ago",
    cpu: 0,
    memory: 0,
    bandwidth: 0,
    maxBandwidth: 10,
    storage: 65,
    region: "Europe",
    latency: 0,
    signalStrength: 0,
    firmware: "v2.3.3",
    pendingSyncs: 15,
  },
  {
    id: "edge-nyc-01",
    name: "New York Edge 01",
    location: "New York, US",
    coordinates: [-74.006, 40.7128],
    status: "online",
    lastSync: "3 mins ago",
    cpu: 65,
    memory: 72,
    bandwidth: 8.5,
    maxBandwidth: 10,
    storage: 58,
    region: "North America",
    latency: 25,
    signalStrength: 88,
    firmware: "v2.3.4",
    pendingSyncs: 0,
  },
  {
    id: "edge-nyc-02",
    name: "New York Edge 02",
    location: "New York, US",
    coordinates: [-74.016, 40.7138],
    status: "online",
    lastSync: "7 mins ago",
    cpu: 58,
    memory: 65,
    bandwidth: 7.8,
    maxBandwidth: 10,
    storage: 62,
    region: "North America",
    latency: 27,
    signalStrength: 86,
    firmware: "v2.3.4",
    pendingSyncs: 1,
  },
  {
    id: "edge-syd-01",
    name: "Sydney Edge 01",
    location: "Sydney, AU",
    coordinates: [151.2093, -33.8688],
    status: "online",
    lastSync: "4 mins ago",
    cpu: 42,
    memory: 58,
    bandwidth: 6.2,
    maxBandwidth: 10,
    storage: 55,
    region: "Asia Pacific",
    latency: 45,
    signalStrength: 78,
    firmware: "v2.3.4",
    pendingSyncs: 0,
  },
  {
    id: "edge-sao-01",
    name: "São Paulo Edge 01",
    location: "São Paulo, BR",
    coordinates: [-46.6333, -23.5505],
    status: "online",
    lastSync: "8 mins ago",
    cpu: 52,
    memory: 68,
    bandwidth: 7.5,
    maxBandwidth: 10,
    storage: 72,
    region: "South America",
    latency: 52,
    signalStrength: 75,
    firmware: "v2.3.4",
    pendingSyncs: 3,
  },
  {
    id: "edge-lon-01",
    name: "London Edge 01",
    location: "London, UK",
    coordinates: [-0.1278, 51.5074],
    status: "offline",
    lastSync: "1 hour ago",
    cpu: 0,
    memory: 0,
    bandwidth: 0,
    maxBandwidth: 10,
    storage: 70,
    region: "Europe",
    latency: 0,
    signalStrength: 0,
    firmware: "v2.3.3",
    pendingSyncs: 12,
  },
  {
    id: "edge-sin-01",
    name: "Singapore Edge 01",
    location: "Singapore, SG",
    coordinates: [103.8198, 1.3521],
    status: "online",
    lastSync: "5 mins ago",
    cpu: 48,
    memory: 62,
    bandwidth: 6.8,
    maxBandwidth: 10,
    storage: 65,
    region: "Asia Pacific",
    latency: 38,
    signalStrength: 82,
    firmware: "v2.3.4",
    pendingSyncs: 0,
  },
]

export function EdgeNodeGrid() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedNodes, setSelectedNodes] = useState<string[]>([])
  const [filters, setFilters] = useState({
    online: true,
    offline: true,
    pendingSync: false,
  })
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    description: string
    action: () => void
  }>({
    open: false,
    title: "",
    description: "",
    action: () => {},
  })

  // Filter nodes based on search query and filters
  const filteredNodes = edgeNodes.filter((node) => {
    // Search filter
    const matchesSearch =
      node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      node.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      node.location.toLowerCase().includes(searchQuery.toLowerCase())

    // Status filters
    const matchesStatus = (node.status === "online" && filters.online) || (node.status === "offline" && filters.offline)

    // Pending sync filter
    const matchesPendingSync = !filters.pendingSync || node.pendingSyncs > 0

    return matchesSearch && matchesStatus && matchesPendingSync
  })

  const handleSelectAll = () => {
    if (selectedNodes.length === filteredNodes.length) {
      setSelectedNodes([])
    } else {
      setSelectedNodes(filteredNodes.map((node) => node.id))
    }
  }

  const handleSelectNode = (nodeId: string) => {
    if (selectedNodes.includes(nodeId)) {
      setSelectedNodes(selectedNodes.filter((id) => id !== nodeId))
    } else {
      setSelectedNodes([...selectedNodes, nodeId])
    }
  }

  const handleBulkAction = (action: string) => {
    setConfirmDialog({
      open: true,
      title: `Confirm ${action}`,
      description: `Are you sure you want to ${action.toLowerCase()} ${selectedNodes.length} selected edge nodes?`,
      action: () => {
        // Handle the action
        console.log(`Performing ${action} on:`, selectedNodes)
        setSelectedNodes([])
        setConfirmDialog((prev) => ({ ...prev, open: false }))
      },
    })
  }

  return (
    <div className="space-y-6">
      <Card className="border-blue-600/20 shadow-md shadow-blue-600/10">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold tracking-tight">Edge Node Management</CardTitle>
              <CardDescription>Monitor and manage your distributed edge infrastructure</CardDescription>
            </div>
            <Button className="gap-1.5">
              <Plus className="h-4 w-4" />
              Add Edge Node
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search edge nodes..."
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
                  id="filter-online"
                  checked={filters.online}
                  onCheckedChange={(checked) => setFilters((prev) => ({ ...prev, online: checked === true }))}
                />
                <label htmlFor="filter-online" className="text-xs">
                  Online
                </label>
              </div>

              <div className="flex items-center gap-1.5">
                <Checkbox
                  id="filter-offline"
                  checked={filters.offline}
                  onCheckedChange={(checked) => setFilters((prev) => ({ ...prev, offline: checked === true }))}
                />
                <label htmlFor="filter-offline" className="text-xs">
                  Offline
                </label>
              </div>

              <div className="flex items-center gap-1.5">
                <Checkbox
                  id="filter-pending"
                  checked={filters.pendingSync}
                  onCheckedChange={(checked) => setFilters((prev) => ({ ...prev, pendingSync: checked === true }))}
                />
                <label htmlFor="filter-pending" className="text-xs">
                  Pending Sync
                </label>
              </div>
            </div>
          </div>

          {selectedNodes.length > 0 && (
            <div className="mb-4 flex items-center justify-between rounded-md bg-muted p-2">
              <div className="text-sm">
                <span className="font-medium">{selectedNodes.length}</span> nodes selected
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1 text-xs"
                  onClick={() => handleBulkAction("Force Sync")}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Force Sync
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1 text-xs"
                  onClick={() => handleBulkAction("Reboot")}
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  Reboot
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1 text-xs"
                  onClick={() => handleBulkAction("Update Firmware")}
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                  Update Firmware
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setSelectedNodes([])}>
                  Clear
                </Button>
              </div>
            </div>
          )}

          <div className="mb-2 flex items-center">
            <Checkbox
              id="select-all"
              checked={selectedNodes.length === filteredNodes.length && filteredNodes.length > 0}
              onCheckedChange={handleSelectAll}
            />
            <label htmlFor="select-all" className="ml-2 text-xs font-medium">
              Select All
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredNodes.map((node) => (
              <Card
                key={node.id}
                className={`overflow-hidden transition-all hover:shadow-md ${
                  selectedNodes.includes(node.id) ? "ring-2 ring-primary" : ""
                }`}
              >
                <CardContent className="p-0">
                  <div className="flex items-center justify-between border-b p-3">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selectedNodes.includes(node.id)}
                        onCheckedChange={() => handleSelectNode(node.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div>
                        <div className="font-medium">{node.name}</div>
                        <div className="text-xs text-muted-foreground">{node.location}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex h-2 w-2 items-center justify-center rounded-full ${
                          node.status === "online" ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-red-500"
                        }`}
                      >
                        <div
                          className={`h-2 w-2 animate-ping rounded-full ${
                            node.status === "online" ? "bg-green-500" : "bg-red-500"
                          } opacity-75`}
                        ></div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">More</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Force Sync
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <RotateCw className="mr-2 h-4 w-4" />
                            Reboot
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Terminal className="mr-2 h-4 w-4" />
                            View Logs
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-500">
                            <Trash className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className="p-3">
                    <div className="mb-3 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>Last sync: {node.lastSync}</span>
                      </div>
                      {node.pendingSyncs > 0 && (
                        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500">
                          {node.pendingSyncs} pending
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1">
                            <Cpu className="h-3 w-3 text-muted-foreground" />
                            <span>CPU</span>
                          </div>
                          <span>{node.cpu}%</span>
                        </div>
                        <Progress value={node.cpu} className="h-1" />
                      </div>

                      <div>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1">
                            <HardDrive className="h-3 w-3 text-muted-foreground" />
                            <span>Memory</span>
                          </div>
                          <span>{node.memory}%</span>
                        </div>
                        <Progress value={node.memory} className="h-1" />
                      </div>

                      <div>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1">
                            <Activity className="h-3 w-3 text-muted-foreground" />
                            <span>Bandwidth</span>
                          </div>
                          <span>
                            {node.bandwidth} / {node.maxBandwidth} Mbps
                          </span>
                        </div>
                        <Progress value={(node.bandwidth / node.maxBandwidth) * 100} className="h-1" />
                      </div>
                    </div>

                    <div className="mt-3 flex justify-between gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1 text-xs"
                        disabled={node.status === "offline"}
                      >
                        <RefreshCw className="h-3 w-3" />
                        Force Sync
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1 gap-1 text-xs">
                        <Terminal className="h-3 w-3" />
                        View Logs
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredNodes.length === 0 && (
            <div className="flex h-40 flex-col items-center justify-center rounded-md border border-dashed p-8 text-center">
              <div className="text-4xl">🔍</div>
              <h3 className="mt-2 text-sm font-medium">No edge nodes found</h3>
              <p className="mt-1 text-xs text-muted-foreground">Try adjusting your search or filters</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmDialog.title}</DialogTitle>
            <DialogDescription>{confirmDialog.description}</DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}>
              Cancel
            </Button>
            <Button onClick={confirmDialog.action}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
