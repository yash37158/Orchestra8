"use client"

import { useState } from "react"
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Clock,
  Database,
  FileDown,
  FileUp,
  Filter,
  MoreHorizontal,
  RefreshCw,
  Search,
  Trash,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ConflictResolution } from "@/components/edge/conflict-resolution"

// Mock data for pending sync jobs
const syncJobs = [
  {
    id: "job-001",
    nodeId: "edge-ber-02",
    nodeName: "Berlin Edge 02",
    dataType: "logs",
    queueTime: "2 hours ago",
    retries: 3,
    size: "2.4 MB",
    priority: "high",
    status: "pending",
  },
  {
    id: "job-002",
    nodeId: "edge-ber-02",
    nodeName: "Berlin Edge 02",
    dataType: "metrics",
    queueTime: "2 hours ago",
    retries: 3,
    size: "1.2 MB",
    priority: "medium",
    status: "pending",
  },
  {
    id: "job-003",
    nodeId: "edge-ber-02",
    nodeName: "Berlin Edge 02",
    dataType: "config",
    queueTime: "2 hours ago",
    retries: 2,
    size: "0.5 MB",
    priority: "high",
    status: "pending",
  },
  {
    id: "job-004",
    nodeId: "edge-lon-01",
    nodeName: "London Edge 01",
    dataType: "logs",
    queueTime: "1 hour ago",
    retries: 2,
    size: "3.1 MB",
    priority: "medium",
    status: "pending",
  },
  {
    id: "job-005",
    nodeId: "edge-lon-01",
    nodeName: "London Edge 01",
    dataType: "metrics",
    queueTime: "1 hour ago",
    retries: 2,
    size: "1.8 MB",
    priority: "low",
    status: "pending",
  },
  {
    id: "job-006",
    nodeId: "edge-lon-01",
    nodeName: "London Edge 01",
    dataType: "telemetry",
    queueTime: "1 hour ago",
    retries: 1,
    size: "4.2 MB",
    priority: "high",
    status: "pending",
  },
  {
    id: "job-007",
    nodeId: "edge-mum-02",
    nodeName: "Mumbai Edge 02",
    dataType: "logs",
    queueTime: "5 mins ago",
    retries: 0,
    size: "1.5 MB",
    priority: "medium",
    status: "pending",
  },
  {
    id: "job-008",
    nodeId: "edge-mum-02",
    nodeName: "Mumbai Edge 02",
    dataType: "config",
    queueTime: "5 mins ago",
    retries: 0,
    size: "0.3 MB",
    priority: "high",
    status: "pending",
  },
  {
    id: "job-009",
    nodeId: "edge-sao-01",
    nodeName: "São Paulo Edge 01",
    dataType: "metrics",
    queueTime: "8 mins ago",
    retries: 0,
    size: "2.1 MB",
    priority: "medium",
    status: "pending",
  },
  {
    id: "job-010",
    nodeId: "edge-sao-01",
    nodeName: "São Paulo Edge 01",
    dataType: "logs",
    queueTime: "8 mins ago",
    retries: 0,
    size: "1.9 MB",
    priority: "low",
    status: "pending",
  },
  {
    id: "job-011",
    nodeId: "edge-sao-01",
    nodeName: "São Paulo Edge 01",
    dataType: "telemetry",
    queueTime: "8 mins ago",
    retries: 0,
    size: "0.8 MB",
    priority: "medium",
    status: "pending",
  },
]

// Mock data for conflicts
const conflicts = [
  {
    id: "conflict-001",
    nodeId: "edge-ber-02",
    nodeName: "Berlin Edge 02",
    dataType: "config",
    detectedAt: "30 mins ago",
    status: "unresolved",
    description: "Configuration file modified both locally and remotely",
  },
  {
    id: "conflict-002",
    nodeId: "edge-lon-01",
    nodeName: "London Edge 01",
    dataType: "sensor-data",
    detectedAt: "45 mins ago",
    status: "unresolved",
    description: "Sensor readings collected during offline period conflict with server data",
  },
]

export function OfflineSyncQueue() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedConflict, setSelectedConflict] = useState<(typeof conflicts)[0] | null>(null)
  const [sortField, setSortField] = useState<string>("queueTime")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")

  // Filter jobs based on search query
  const filteredJobs = syncJobs.filter((job) => {
    return (
      job.nodeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.nodeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.dataType.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })

  // Sort jobs
  const sortedJobs = [...filteredJobs].sort((a, b) => {
    if (sortField === "priority") {
      const priorityOrder = { high: 0, medium: 1, low: 2 }
      const priorityA = priorityOrder[a.priority as keyof typeof priorityOrder]
      const priorityB = priorityOrder[b.priority as keyof typeof priorityOrder]
      return sortDirection === "asc" ? priorityA - priorityB : priorityB - priorityA
    }

    if (sortField === "retries") {
      return sortDirection === "asc" ? a.retries - b.retries : b.retries - a.retries
    }

    if (sortField === "size") {
      const sizeA = Number.parseFloat(a.size.split(" ")[0])
      const sizeB = Number.parseFloat(b.size.split(" ")[0])
      return sortDirection === "asc" ? sizeA - sizeB : sizeB - sizeA
    }

    // Default sort by queue time (most recent first)
    return sortDirection === "asc" ? 1 : -1
  })

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const handleRetryJob = (jobId: string) => {
    console.log(`Retrying job ${jobId}`)
  }

  const handlePurgeJob = (jobId: string) => {
    console.log(`Purging job ${jobId}`)
  }

  const handleRetryAll = () => {
    console.log("Retrying all jobs")
  }

  const handlePurgeAll = () => {
    console.log("Purging all failed jobs")
  }

  return (
    <div className="space-y-6">
      <Card className="border-blue-600/20 shadow-md shadow-blue-600/10">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Offline Sync Queue</CardTitle>
          <CardDescription>Manage pending synchronization jobs for offline edge nodes</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="pending">
            <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <TabsList>
                <TabsTrigger value="pending" className="gap-2">
                  Pending Sync Jobs
                  <Badge>{syncJobs.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="conflicts" className="gap-2">
                  Conflicts
                  <Badge variant="destructive">{conflicts.length}</Badge>
                </TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-2">
                <div className="relative w-[200px]">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search jobs..."
                    className="pl-8"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <Button variant="outline" size="sm" className="gap-1.5">
                  <Filter className="h-4 w-4" />
                  Filter
                </Button>
              </div>
            </div>

            <TabsContent value="pending" className="m-0">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm">
                  <span className="font-medium">{sortedJobs.length}</span> pending sync jobs
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={handleRetryAll}>
                    <RefreshCw className="h-4 w-4" />
                    Retry All
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePurgeAll}>
                    <Trash className="h-4 w-4" />
                    Purge Failed
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-md border">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left text-sm font-medium">Node ID</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Data Type</th>
                      <th
                        className="cursor-pointer px-4 py-3 text-left text-sm font-medium"
                        onClick={() => handleSort("queueTime")}
                      >
                        <div className="flex items-center">
                          Queue Time
                          {sortField === "queueTime" &&
                            (sortDirection === "asc" ? (
                              <ArrowUp className="ml-1 h-3 w-3" />
                            ) : (
                              <ArrowDown className="ml-1 h-3 w-3" />
                            ))}
                        </div>
                      </th>
                      <th
                        className="cursor-pointer px-4 py-3 text-left text-sm font-medium"
                        onClick={() => handleSort("retries")}
                      >
                        <div className="flex items-center">
                          Retries
                          {sortField === "retries" &&
                            (sortDirection === "asc" ? (
                              <ArrowUp className="ml-1 h-3 w-3" />
                            ) : (
                              <ArrowDown className="ml-1 h-3 w-3" />
                            ))}
                        </div>
                      </th>
                      <th
                        className="cursor-pointer px-4 py-3 text-left text-sm font-medium"
                        onClick={() => handleSort("size")}
                      >
                        <div className="flex items-center">
                          Size
                          {sortField === "size" &&
                            (sortDirection === "asc" ? (
                              <ArrowUp className="ml-1 h-3 w-3" />
                            ) : (
                              <ArrowDown className="ml-1 h-3 w-3" />
                            ))}
                        </div>
                      </th>
                      <th
                        className="cursor-pointer px-4 py-3 text-left text-sm font-medium"
                        onClick={() => handleSort("priority")}
                      >
                        <div className="flex items-center">
                          Priority
                          {sortField === "priority" &&
                            (sortDirection === "asc" ? (
                              <ArrowUp className="ml-1 h-3 w-3" />
                            ) : (
                              <ArrowDown className="ml-1 h-3 w-3" />
                            ))}
                        </div>
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedJobs.map((job) => (
                      <tr key={job.id} className="border-b">
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <div className="font-medium">{job.nodeId}</div>
                            <div className="text-xs text-muted-foreground">{job.nodeName}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline">
                            {job.dataType === "logs" && <FileDown className="mr-1 h-3 w-3" />}
                            {job.dataType === "metrics" && <Database className="mr-1 h-3 w-3" />}
                            {job.dataType === "config" && <FileUp className="mr-1 h-3 w-3" />}
                            {job.dataType === "telemetry" && <FileDown className="mr-1 h-3 w-3" />}
                            {job.dataType}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            {job.queueTime}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">{job.retries}</td>
                        <td className="px-4 py-3 text-sm">{job.size}</td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              job.priority === "high" ? "default" : job.priority === "medium" ? "secondary" : "outline"
                            }
                          >
                            {job.priority}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleRetryJob(job.id)}
                            >
                              <RefreshCw className="h-4 w-4" />
                              <span className="sr-only">Retry</span>
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                  <span className="sr-only">More</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleRetryJob(job.id)}>
                                  <RefreshCw className="mr-2 h-4 w-4" />
                                  Retry Now
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <ArrowUp className="mr-2 h-4 w-4" />
                                  Increase Priority
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <ArrowDown className="mr-2 h-4 w-4" />
                                  Decrease Priority
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-red-500" onClick={() => handlePurgeJob(job.id)}>
                                  <Trash className="mr-2 h-4 w-4" />
                                  Purge Job
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {sortedJobs.length === 0 && (
                <div className="flex h-40 flex-col items-center justify-center rounded-md border border-dashed p-8 text-center">
                  <div className="text-4xl">🎉</div>
                  <h3 className="mt-2 text-sm font-medium">No pending sync jobs</h3>
                  <p className="mt-1 text-xs text-muted-foreground">All edge nodes are synced</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="conflicts" className="m-0">
              {selectedConflict ? (
                <ConflictResolution conflict={selectedConflict} onClose={() => setSelectedConflict(null)} />
              ) : (
                <div className="space-y-4">
                  <div className="text-sm">
                    <span className="font-medium">{conflicts.length}</span> unresolved conflicts
                  </div>

                  {conflicts.map((conflict) => (
                    <Card key={conflict.id} className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="destructive">Conflict</Badge>
                              <h4 className="font-medium">{conflict.nodeId}</h4>
                              <span className="text-xs text-muted-foreground">{conflict.nodeName}</span>
                            </div>
                            <p className="text-sm">{conflict.description}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock className="h-3.5 w-3.5" />
                              <span>Detected {conflict.detectedAt}</span>
                              <Badge variant="outline">{conflict.dataType}</Badge>
                            </div>
                          </div>

                          <Button className="gap-1.5" onClick={() => setSelectedConflict(conflict)}>
                            <AlertTriangle className="h-4 w-4" />
                            Resolve Conflict
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {conflicts.length === 0 && (
                    <div className="flex h-40 flex-col items-center justify-center rounded-md border border-dashed p-8 text-center">
                      <div className="text-4xl">✅</div>
                      <h3 className="mt-2 text-sm font-medium">No conflicts detected</h3>
                      <p className="mt-1 text-xs text-muted-foreground">All data is synchronized properly</p>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
