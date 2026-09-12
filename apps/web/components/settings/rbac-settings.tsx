"use client"

import { useState } from "react"
import { Editor } from "@monaco-editor/react"
import { Check, ChevronDown, Download, Plus, Search, Shield, Trash, User, Users } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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

// Mock data for users and roles
const users = [
  {
    id: "user-001",
    name: "Admin User",
    email: "admin@orchestr8.com",
    role: "admin",
    type: "user",
    clusters: ["all"],
    lastActive: "2023-11-10T09:30:00Z",
  },
  {
    id: "user-002",
    name: "DevOps Team",
    email: "devops@orchestr8.com",
    role: "developer",
    type: "group",
    clusters: ["production", "staging"],
    lastActive: "2023-11-10T10:15:00Z",
  },
  {
    id: "user-003",
    name: "John Smith",
    email: "john@orchestr8.com",
    role: "developer",
    type: "user",
    clusters: ["staging", "development"],
    lastActive: "2023-11-09T16:45:00Z",
  },
  {
    id: "user-004",
    name: "Sarah Johnson",
    email: "sarah@orchestr8.com",
    role: "observer",
    type: "user",
    clusters: ["production"],
    lastActive: "2023-11-08T14:20:00Z",
  },
  {
    id: "user-005",
    name: "QA Team",
    email: "qa@orchestr8.com",
    role: "observer",
    type: "group",
    clusters: ["staging", "development"],
    lastActive: "2023-11-10T11:05:00Z",
  },
]

// Sample role definition JSON
const roleDefinitionJson = `{
  "name": "developer",
  "description": "Developer role with access to manage applications",
  "permissions": [
    "view:clusters",
    "view:applications",
    "edit:applications",
    "create:deployments",
    "view:metrics",
    "view:logs"
  ],
  "clusterPermissions": {
    "production": ["view"],
    "staging": ["view", "edit", "deploy"],
    "development": ["view", "edit", "deploy", "delete"]
  }
}`

// Available permissions for custom roles
const availablePermissions = [
  { id: "view:clusters", category: "Clusters", name: "View Clusters" },
  { id: "edit:clusters", category: "Clusters", name: "Edit Clusters" },
  { id: "delete:clusters", category: "Clusters", name: "Delete Clusters" },
  { id: "view:applications", category: "Applications", name: "View Applications" },
  { id: "edit:applications", category: "Applications", name: "Edit Applications" },
  { id: "delete:applications", category: "Applications", name: "Delete Applications" },
  { id: "create:deployments", category: "Deployments", name: "Create Deployments" },
  { id: "rollback:deployments", category: "Deployments", name: "Rollback Deployments" },
  { id: "view:metrics", category: "Monitoring", name: "View Metrics" },
  { id: "view:logs", category: "Monitoring", name: "View Logs" },
  { id: "view:alerts", category: "Monitoring", name: "View Alerts" },
  { id: "edit:alerts", category: "Monitoring", name: "Edit Alerts" },
  { id: "edit:settings", category: "Settings", name: "Edit Settings" },
  { id: "manage:users", category: "Settings", name: "Manage Users" },
]

export function RbacSettings() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [showAddUserDialog, setShowAddUserDialog] = useState(false)
  const [showRoleDialog, setShowRoleDialog] = useState(false)
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([])
  const [roleJson, setRoleJson] = useState(roleDefinitionJson)

  // Filter users based on search query
  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.role.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const handleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([])
    } else {
      setSelectedUsers(filteredUsers.map((user) => user.id))
    }
  }

  const handleSelectUser = (userId: string) => {
    if (selectedUsers.includes(userId)) {
      setSelectedUsers(selectedUsers.filter((id) => id !== userId))
    } else {
      setSelectedUsers([...selectedUsers, userId])
    }
  }

  const handlePermissionChange = (permissionId: string, checked: boolean) => {
    if (checked) {
      setSelectedPermissions([...selectedPermissions, permissionId])
    } else {
      setSelectedPermissions(selectedPermissions.filter((id) => id !== permissionId))
    }
  }

  const handleEditorChange = (value: string | undefined) => {
    if (value) {
      setRoleJson(value)
    }
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
              <CardTitle className="text-sm font-semibold tracking-tight">User Roles & Permissions</CardTitle>
              <CardDescription>Manage user access and permissions across the platform</CardDescription>
            </div>
            <div className="flex gap-2">
              <Dialog open={showAddUserDialog} onOpenChange={setShowAddUserDialog}>
                <DialogTrigger asChild>
                  <Button className="gap-1.5">
                    <Plus className="h-4 w-4" />
                    Add User
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add User or Group</DialogTitle>
                    <DialogDescription>Add a new user or group and assign permissions</DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="user-type">Type</Label>
                      <Select defaultValue="user">
                        <SelectTrigger id="user-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="group">Group</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="user-email">Email</Label>
                      <Input id="user-email" placeholder="user@example.com" />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="user-role">Role</Label>
                      <Select defaultValue="observer">
                        <SelectTrigger id="user-role">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="developer">Developer</SelectItem>
                          <SelectItem value="observer">Observer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Cluster Access</Label>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Checkbox id="cluster-production" />
                          <Label htmlFor="cluster-production" className="text-sm font-normal">
                            Production
                          </Label>
                        </div>

                        <div className="flex items-center gap-2">
                          <Checkbox id="cluster-staging" defaultChecked />
                          <Label htmlFor="cluster-staging" className="text-sm font-normal">
                            Staging
                          </Label>
                        </div>

                        <div className="flex items-center gap-2">
                          <Checkbox id="cluster-development" defaultChecked />
                          <Label htmlFor="cluster-development" className="text-sm font-normal">
                            Development
                          </Label>
                        </div>
                      </div>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowAddUserDialog(false)}>
                      Cancel
                    </Button>
                    <Button onClick={() => setShowAddUserDialog(false)}>Add User</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users and groups..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {selectedUsers.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm">
                  <span className="font-medium">{selectedUsers.length}</span> selected
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      Bulk Actions
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem>
                      <Shield className="mr-2 h-4 w-4" />
                      <span>Assign Role</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Check className="mr-2 h-4 w-4" />
                      <span>Grant Cluster Access</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-red-500">
                      <Trash className="mr-2 h-4 w-4" />
                      <span>Remove Access</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Name / Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Cluster Access</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <Users className="mb-2 h-8 w-8 text-muted-foreground" />
                        <p className="text-sm font-medium">No users found</p>
                        <p className="text-xs text-muted-foreground">Try adjusting your search or add a new user</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedUsers.includes(user.id)}
                          onCheckedChange={() => handleSelectUser(user.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {user.type === "user" ? (
                            <User className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <Users className="h-5 w-5 text-muted-foreground" />
                          )}
                          <div>
                            <div className="font-medium">{user.name}</div>
                            <div className="text-xs text-muted-foreground">{user.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            user.role === "admin" ? "default" : user.role === "developer" ? "outline" : "secondary"
                          }
                        >
                          {user.role === "admin" ? "Admin" : user.role === "developer" ? "Developer" : "Observer"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{user.type === "user" ? "User" : "Group"}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {user.clusters.includes("all") ? (
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-500">
                              All Clusters
                            </Badge>
                          ) : (
                            user.clusters.map((cluster) => (
                              <Badge key={cluster} variant="outline">
                                {cluster}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{formatTimeAgo(user.lastActive)}</TableCell>
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
                              <Shield className="mr-2 h-4 w-4" />
                              <span>Edit Permissions</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Check className="mr-2 h-4 w-4" />
                              <span>Edit Cluster Access</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-500">
                              <Trash className="mr-2 h-4 w-4" />
                              <span>Remove Access</span>
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
          <CardTitle className="text-sm font-semibold tracking-tight">Custom Role Builder</CardTitle>
          <CardDescription>Create and manage custom roles with fine-grained permissions</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="visual">
            <TabsList>
              <TabsTrigger value="visual">Visual Builder</TabsTrigger>
              <TabsTrigger value="json">JSON Editor</TabsTrigger>
            </TabsList>

            <TabsContent value="visual" className="space-y-4 pt-4">
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <div className="mb-4 space-y-2">
                    <Label htmlFor="role-name">Role Name</Label>
                    <Input id="role-name" placeholder="custom-developer" />
                  </div>

                  <div className="mb-4 space-y-2">
                    <Label htmlFor="role-description">Description</Label>
                    <Input id="role-description" placeholder="Custom role for developers" />
                  </div>

                  <div className="rounded-md border p-4">
                    <h3 className="mb-3 font-medium">Cluster Permissions</h3>
                    <div className="space-y-4">
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <Label className="text-sm font-normal">Production</Label>
                          <Select defaultValue="view">
                            <SelectTrigger className="w-[120px]">
                              <SelectValue placeholder="Select access" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No Access</SelectItem>
                              <SelectItem value="view">View Only</SelectItem>
                              <SelectItem value="edit">Edit</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <Label className="text-sm font-normal">Staging</Label>
                          <Select defaultValue="edit">
                            <SelectTrigger className="w-[120px]">
                              <SelectValue placeholder="Select access" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No Access</SelectItem>
                              <SelectItem value="view">View Only</SelectItem>
                              <SelectItem value="edit">Edit</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <Label className="text-sm font-normal">Development</Label>
                          <Select defaultValue="admin">
                            <SelectTrigger className="w-[120px]">
                              <SelectValue placeholder="Select access" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No Access</SelectItem>
                              <SelectItem value="view">View Only</SelectItem>
                              <SelectItem value="edit">Edit</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium">Permissions</h3>

                  <div className="max-h-[400px] overflow-y-auto rounded-md border p-4">
                    {Object.entries(
                      availablePermissions.reduce(
                        (acc, permission) => {
                          acc[permission.category] = acc[permission.category] || []
                          acc[permission.category].push(permission)
                          return acc
                        },
                        {} as Record<string, typeof availablePermissions>,
                      ),
                    ).map(([category, permissions]) => (
                      <div key={category} className="mb-4 last:mb-0">
                        <h4 className="mb-2 text-sm font-medium">{category}</h4>
                        <div className="space-y-2">
                          {permissions.map((permission) => (
                            <div key={permission.id} className="flex items-center gap-2">
                              <Checkbox
                                id={permission.id}
                                checked={selectedPermissions.includes(permission.id)}
                                onCheckedChange={(checked) => handlePermissionChange(permission.id, checked === true)}
                              />
                              <Label htmlFor={permission.id} className="text-sm font-normal">
                                {permission.name}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" className="gap-1.5">
                  <Download className="h-4 w-4" />
                  Export Role
                </Button>
                <Button className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Create Role
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="json" className="space-y-4 pt-4">
              <div className="rounded-md border">
                <div className="flex items-center justify-between border-b p-4">
                  <h3 className="font-medium">Role Definition (JSON)</h3>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                      <Download className="h-3.5 w-3.5" />
                      Export
                    </Button>
                  </div>
                </div>
                <div className="h-[400px] overflow-auto p-0">
                  <Editor
                    height="400px"
                    defaultLanguage="json"
                    value={roleJson}
                    onChange={handleEditorChange}
                    options={{
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      fontSize: 14,
                      tabSize: 2,
                    }}
                    theme="vs-dark"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Create Role from JSON
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
