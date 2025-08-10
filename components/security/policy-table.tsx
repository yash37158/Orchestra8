"use client"

import { useState } from "react"
import { ArrowDown, ArrowUp, Edit, Eye, MoreHorizontal, Play, Power, Trash } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { format } from "date-fns"

interface Policy {
  id: string
  name: string
  description: string
  type: string
  scope: string
  status: string
  lastModified: string
  violations: number
  severity: string
}

interface PolicyTableProps {
  policies: Policy[]
  onEdit: (policy: Policy) => void
  onSimulate: (policy: Policy) => void
}

export function PolicyTable({ policies, onEdit, onSimulate }: PolicyTableProps) {
  const [sortField, setSortField] = useState<keyof Policy>("lastModified")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")

  const handleSort = (field: keyof Policy) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  // Sort policies
  const sortedPolicies = [...policies].sort((a, b) => {
    if (sortField === "lastModified") {
      const dateA = new Date(a[sortField]).getTime()
      const dateB = new Date(b[sortField]).getTime()
      return sortDirection === "asc" ? dateA - dateB : dateB - dateA
    }

    if (a[sortField] < b[sortField]) return sortDirection === "asc" ? -1 : 1
    if (a[sortField] > b[sortField]) return sortDirection === "asc" ? 1 : -1
    return 0
  })

  const renderSortIcon = (field: keyof Policy) => {
    if (sortField !== field) return null
    return sortDirection === "asc" ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="cursor-pointer px-4 py-3 text-left text-sm font-medium" onClick={() => handleSort("name")}>
              <div className="flex items-center">
                Policy Name
                {renderSortIcon("name")}
              </div>
            </th>
            <th className="cursor-pointer px-4 py-3 text-left text-sm font-medium" onClick={() => handleSort("status")}>
              <div className="flex items-center">
                Status
                {renderSortIcon("status")}
              </div>
            </th>
            <th className="cursor-pointer px-4 py-3 text-left text-sm font-medium" onClick={() => handleSort("type")}>
              <div className="flex items-center">
                Type
                {renderSortIcon("type")}
              </div>
            </th>
            <th className="cursor-pointer px-4 py-3 text-left text-sm font-medium" onClick={() => handleSort("scope")}>
              <div className="flex items-center">
                Scope
                {renderSortIcon("scope")}
              </div>
            </th>
            <th
              className="cursor-pointer px-4 py-3 text-left text-sm font-medium"
              onClick={() => handleSort("lastModified")}
            >
              <div className="flex items-center">
                Last Modified
                {renderSortIcon("lastModified")}
              </div>
            </th>
            <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedPolicies.map((policy) => (
            <tr key={policy.id} className="border-b">
              <td className="px-4 py-3">
                <div className="flex flex-col">
                  <div className="font-medium">{policy.name}</div>
                  <div className="text-xs text-muted-foreground">{policy.description}</div>
                </div>
              </td>
              <td className="px-4 py-3">
                {policy.status === "Active" ? (
                  <Badge variant="outline" className="border-green-500 text-green-500">
                    <span className="mr-1 h-2 w-2 rounded-full bg-green-500"></span>
                    Active
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-red-500 text-red-500">
                    <span className="mr-1 h-2 w-2 rounded-full bg-red-500"></span>
                    Violated ({policy.violations})
                  </Badge>
                )}
              </td>
              <td className="px-4 py-3">
                <Badge variant="secondary" className="font-normal">
                  {policy.type}
                </Badge>
              </td>
              <td className="px-4 py-3 text-sm">{policy.scope}</td>
              <td className="px-4 py-3 text-sm">{format(new Date(policy.lastModified), "MMM d, yyyy")}</td>
              <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(policy)}>
                    <Edit className="h-4 w-4" />
                    <span className="sr-only">Edit</span>
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onSimulate(policy)}>
                    <Play className="h-4 w-4" />
                    <span className="sr-only">Simulate</span>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">More</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Power className="mr-2 h-4 w-4" />
                        {policy.status === "Active" ? "Disable" : "Enable"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-500">
                        <Trash className="mr-2 h-4 w-4" />
                        Delete
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
  )
}
