"use client"

import { useState } from "react"
import { Copy, Key, Plus, RefreshCw, Search, Trash } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

// Mock data for API keys
const apiKeys = [
  {
    id: "key-001",
    name: "Production API Key",
    permissions: ["read", "write"],
    created: "2023-10-15T10:30:00Z",
    expires: "2024-10-15T10:30:00Z",
    lastUsed: "2023-11-09T15:45:00Z",
    status: "active",
  },
  {
    id: "key-002",
    name: "CI/CD Pipeline Key",
    permissions: ["read", "write", "admin"],
    created: "2023-09-20T08:15:00Z",
    expires: "2024-09-20T08:15:00Z",
    lastUsed: "2023-11-10T09:20:00Z",
    status: "active",
  },
  {
    id: "key-003",
    name: "Monitoring Read-Only Key",
    permissions: ["read"],
    created: "2023-11-01T14:00:00Z",
    expires: "2024-11-01T14:00:00Z",
    lastUsed: "2023-11-10T11:30:00Z",
    status: "active",
  },
  {
    id: "key-004",
    name: "Development Key",
    permissions: ["read", "write"],
    created: "2023-08-05T11:45:00Z",
    expires: "2023-11-05T11:45:00Z",
    lastUsed: "2023-11-04T16:20:00Z",
    status: "expired",
  },
]

// Mock data for API usage
const apiUsageData = {
  daily: [120, 150, 180, 210, 190, 220, 250],
  weekly: [1200, 1350, 1100, 1400],
  monthly: [4500, 5200, 4800],
}

export function ApiKeyManagement() {
  const [searchQuery, setSearchQuery] = useState("")
  const [newKeyName, setNewKeyName] = useState("")
  const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>(["read"])
  const [newKeyExpiry, setNewKeyExpiry] = useState("365")
  const [showNewKeyDialog, setShowNewKeyDialog] = useState(false)
  const [newKeyGenerated, setNewKeyGenerated] = useState(false)
  const [generatedKey, setGeneratedKey] = useState("")
  const [maxRequestsPerMinute, setMaxRequestsPerMinute] = useState(60)
  const [maxConcurrentJobs, setMaxConcurrentJobs] = useState(5)

  // Filter keys based on search query
  const filteredKeys = apiKeys.filter((key) => key.name.toLowerCase().includes(searchQuery.toLowerCase()))

  const handleCreateKey = () => {
    // Simulate key generation
    const mockKey = "orch8_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    setGeneratedKey(mockKey)
    setNewKeyGenerated(true)
  }

  const handleCopyKey = () => {
    navigator.clipboard.writeText(generatedKey)
  }

  const handleCloseDialog = () => {
    setShowNewKeyDialog(false)
    setNewKeyGenerated(false)
    setNewKeyName("")
    setNewKeyPermissions(["read"])
    setNewKeyExpiry("365")
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date)
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMinutes = Math.floor(diffMs / (1000 * 60))

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`
    } else {
      return `${diffMinutes} minute${diffMinutes > 1 ? "s" : ""} ago`
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-blue-600/20 shadow-md shadow-blue-600/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold tracking-tight">API Key Management</CardTitle>
              <CardDescription>Create and manage API keys for accessing the platform</CardDescription>
            </div>
            <Dialog open={showNewKeyDialog} onOpenChange={setShowNewKeyDialog}>
              <DialogTrigger asChild>
                <Button className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Create New Key
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{newKeyGenerated ? "API Key Generated" : "Create New API Key"}</DialogTitle>
                  <DialogDescription>
                    {newKeyGenerated
                      ? "Copy this key now. You won't be able to see it again!"
                      : "Configure permissions and expiry for your new API key."}
                  </DialogDescription>
                </DialogHeader>

                {newKeyGenerated ? (
                  <div className="space-y-4">
                    <div className="rounded-md bg-muted p-4">
                      <div className="mb-2 text-xs text-muted-foreground">API Key</div>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 overflow-x-auto rounded bg-black p-2 text-xs text-green-400">
                          {generatedKey}
                        </code>
                        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCopyKey}>
                          <Copy className="h-4 w-4" />
                          Copy
                        </Button>
                      </div>
                    </div>

                    <div className="rounded-md bg-yellow-500/10 p-4 text-sm text-yellow-500">
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5 text-lg">⚠️</div>
                        <div>
                          <p className="font-medium">Security Warning</p>
                          <p className="mt-1">
                            This API key will not be shown again. Make sure to copy it now and store it securely.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="key-name">Key Name</Label>
                      <Input
                        id="key-name"
                        placeholder="Production API Key"
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Permissions</Label>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="permission-read"
                            checked={newKeyPermissions.includes("read")}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setNewKeyPermissions([...newKeyPermissions, "read"])
                              } else {
                                setNewKeyPermissions(newKeyPermissions.filter((p) => p !== "read"))
                              }
                            }}
                          />
                          <Label htmlFor="permission-read" className="text-sm font-normal">
                            Read (View resources and metrics)
                          </Label>
                        </div>

                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="permission-write"
                            checked={newKeyPermissions.includes("write")}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setNewKeyPermissions([...newKeyPermissions, "write"])
                              } else {
                                setNewKeyPermissions(newKeyPermissions.filter((p) => p !== "write"))
                              }
                            }}
                          />
                          <Label htmlFor="permission-write" className="text-sm font-normal">
                            Write (Create and update resources)
                          </Label>
                        </div>

                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="permission-admin"
                            checked={newKeyPermissions.includes("admin")}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setNewKeyPermissions([...newKeyPermissions, "admin"])
                              } else {
                                setNewKeyPermissions(newKeyPermissions.filter((p) => p !== "admin"))
                              }
                            }}
                          />
                          <Label htmlFor="permission-admin" className="text-sm font-normal">
                            Admin (Full access including settings)
                          </Label>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="key-expiry">Expiry (days)</Label>
                      <Input
                        id="key-expiry"
                        type="number"
                        min="1"
                        max="365"
                        value={newKeyExpiry}
                        onChange={(e) => setNewKeyExpiry(e.target.value)}
                      />
                      <div className="text-xs text-muted-foreground">Key will expire after {newKeyExpiry} days</div>
                    </div>
                  </div>
                )}

                <DialogFooter>
                  {newKeyGenerated ? (
                    <Button onClick={handleCloseDialog}>Done</Button>
                  ) : (
                    <>
                      <Button variant="outline" onClick={handleCloseDialog}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreateKey} disabled={!newKeyName || newKeyPermissions.length === 0}>
                        Generate Key
                      </Button>
                    </>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search API keys..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredKeys.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <Key className="mb-2 h-8 w-8 text-muted-foreground" />
                        <p className="text-sm font-medium">No API keys found</p>
                        <p className="text-xs text-muted-foreground">Create a new API key to get started</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredKeys.map((key) => (
                    <TableRow key={key.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="font-medium">{key.name}</div>
                          {key.status === "expired" && (
                            <Badge variant="outline" className="bg-red-500/10 text-red-500">
                              Expired
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {key.permissions.includes("read") && (
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-500">
                              Read
                            </Badge>
                          )}
                          {key.permissions.includes("write") && (
                            <Badge variant="outline" className="bg-green-500/10 text-green-500">
                              Write
                            </Badge>
                          )}
                          {key.permissions.includes("admin") && (
                            <Badge variant="outline" className="bg-purple-500/10 text-purple-500">
                              Admin
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(key.created)}</TableCell>
                      <TableCell>{formatDate(key.expires)}</TableCell>
                      <TableCell>{formatTimeAgo(key.lastUsed)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <svg
                                className="h-4 w-4"
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <circle cx="12" cy="12" r="1" />
                                <circle cx="12" cy="5" r="1" />
                                <circle cx="12" cy="19" r="1" />
                              </svg>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <RefreshCw className="mr-2 h-4 w-4" />
                              <span>Regenerate</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Copy className="mr-2 h-4 w-4" />
                              <span>Copy ID</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-500">
                              <Trash className="mr-2 h-4 w-4" />
                              <span>Revoke</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-blue-600/20 shadow-md shadow-blue-600/10">
        <CardHeader>
          <CardTitle className="text-sm font-semibold tracking-tight">Rate Limits & Quotas</CardTitle>
          <CardDescription>Configure API rate limits and resource quotas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="max-requests">Max API Requests per Minute</Label>
                  <span className="font-medium">{maxRequestsPerMinute}</span>
                </div>
                <Slider
                  id="max-requests"
                  min={10}
                  max={200}
                  step={10}
                  value={[maxRequestsPerMinute]}
                  onValueChange={(value) => setMaxRequestsPerMinute(value[0])}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>10</span>
                  <span>100</span>
                  <span>200</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="max-jobs">Max Concurrent CI/CD Jobs</Label>
                  <span className="font-medium">{maxConcurrentJobs}</span>
                </div>
                <Slider
                  id="max-jobs"
                  min={1}
                  max={20}
                  step={1}
                  value={[maxConcurrentJobs]}
                  onValueChange={(value) => setMaxConcurrentJobs(value[0])}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1</span>
                  <span>10</span>
                  <span>20</span>
                </div>
              </div>

              <div className="rounded-md border p-4">
                <h3 className="mb-3 font-medium">Advanced Rate Limiting</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch id="burst-limit" />
                      <Label htmlFor="burst-limit" className="text-sm font-normal">
                        Enable Burst Limiting
                      </Label>
                    </div>
                    <span className="text-sm text-muted-foreground">2x for 30s</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch id="per-key-limit" defaultChecked />
                      <Label htmlFor="per-key-limit" className="text-sm font-normal">
                        Per-Key Rate Limits
                      </Label>
                    </div>
                    <span className="text-sm text-muted-foreground">Enabled</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch id="ip-throttling" defaultChecked />
                      <Label htmlFor="ip-throttling" className="text-sm font-normal">
                        IP-based Throttling
                      </Label>
                    </div>
                    <span className="text-sm text-muted-foreground">Enabled</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-medium">API Usage</h3>

              <Tabs defaultValue="daily">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="daily">Daily</TabsTrigger>
                  <TabsTrigger value="weekly">Weekly</TabsTrigger>
                  <TabsTrigger value="monthly">Monthly</TabsTrigger>
                </TabsList>

                <TabsContent value="daily" className="pt-4">
                  <div className="h-[200px] rounded-md border p-4">
                    <div className="flex h-full items-end justify-between gap-2">
                      {apiUsageData.daily.map((value, index) => (
                        <div key={index} className="flex flex-1 flex-col items-center">
                          <div
                            className="w-full rounded-t-sm bg-blue-500"
                            style={{ height: `${(value / 250) * 100}%` }}
                          ></div>
                          <div className="mt-2 text-xs">{`D${index + 1}`}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-2 text-center text-xs text-muted-foreground">
                    Last 7 days - Total: {apiUsageData.daily.reduce((a, b) => a + b, 0)} requests
                  </div>
                </TabsContent>

                <TabsContent value="weekly" className="pt-4">
                  <div className="h-[200px] rounded-md border p-4">
                    <div className="flex h-full items-end justify-between gap-2">
                      {apiUsageData.weekly.map((value, index) => (
                        <div key={index} className="flex flex-1 flex-col items-center">
                          <div
                            className="w-full rounded-t-sm bg-blue-500"
                            style={{ height: `${(value / 1400) * 100}%` }}
                          ></div>
                          <div className="mt-2 text-xs">{`W${index + 1}`}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-2 text-center text-xs text-muted-foreground">
                    Last 4 weeks - Total: {apiUsageData.weekly.reduce((a, b) => a + b, 0)} requests
                  </div>
                </TabsContent>

                <TabsContent value="monthly" className="pt-4">
                  <div className="h-[200px] rounded-md border p-4">
                    <div className="flex h-full items-end justify-between gap-2">
                      {apiUsageData.monthly.map((value, index) => (
                        <div key={index} className="flex flex-1 flex-col items-center">
                          <div
                            className="w-full rounded-t-sm bg-blue-500"
                            style={{ height: `${(value / 5200) * 100}%` }}
                          ></div>
                          <div className="mt-2 text-xs">{`M${index + 1}`}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-2 text-center text-xs text-muted-foreground">
                    Last 3 months - Total: {apiUsageData.monthly.reduce((a, b) => a + b, 0)} requests
                  </div>
                </TabsContent>
              </Tabs>

              <div className="rounded-md bg-blue-500/10 p-4 text-sm">
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 text-lg">💡</div>
                  <div>
                    <p className="font-medium text-blue-500">Usage Insights</p>
                    <p className="mt-1">
                      API usage has increased by 15% in the last month. Consider increasing rate limits if you're
                      experiencing throttling.
                    </p>
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
