"use client"

import { useState } from "react"
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Clock,
  Download,
  FileText,
  Filter,
  History,
  Search,
  Shield,
  User,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { SecurityAuditTimeline } from "@/components/security/security-audit-timeline"

export function AuditForensics() {
  const [searchQuery, setSearchQuery] = useState("")

  return (
    <div className="space-y-6">
      <Card className="border-blue-600/20 shadow-md shadow-blue-600/10">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Security Audit Timeline</CardTitle>
          <CardDescription>Chronological record of security events and policy changes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search audit events..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                <Calendar className="h-3.5 w-3.5" />
                Date Range
              </Button>

              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                <User className="h-3.5 w-3.5" />
                Users
              </Button>

              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                <Filter className="h-3.5 w-3.5" />
                Event Types
              </Button>

              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                <Download className="h-3.5 w-3.5" />
                Export
              </Button>
            </div>
          </div>

          <SecurityAuditTimeline />
        </CardContent>
      </Card>

      <Card className="border-blue-600/20 shadow-md shadow-blue-600/10">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Forensic Snapshots</CardTitle>
          <CardDescription>Point-in-time recovery snapshots for compromised clusters</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-medium">Available Snapshots</h3>
            <Button className="gap-1.5">
              <History className="h-4 w-4" />
              Create Snapshot
            </Button>
          </div>

          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">production-east Snapshot</h4>
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-500">
                        <Clock className="mr-1 h-3 w-3" />2 days ago
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">Created after security incident #INC-2023-11-08</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                      <Search className="h-3.5 w-3.5" />
                      Explore
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                      <ArrowRight className="h-3.5 w-3.5" />
                      Restore
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">staging-west Snapshot</h4>
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-500">
                        <Clock className="mr-1 h-3 w-3" />1 week ago
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">Created before major configuration change</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                      <Search className="h-3.5 w-3.5" />
                      Explore
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                      <ArrowRight className="h-3.5 w-3.5" />
                      Restore
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">production-west Snapshot</h4>
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-500">
                        <Clock className="mr-1 h-3 w-3" />2 weeks ago
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">Weekly automated snapshot</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                      <Search className="h-3.5 w-3.5" />
                      Explore
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                      <ArrowRight className="h-3.5 w-3.5" />
                      Restore
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Card className="border-blue-600/20 shadow-md shadow-blue-600/10">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Incident Reports</CardTitle>
          <CardDescription>Detailed security incident documentation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-red-500/10 p-2 text-red-500">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-medium">INC-2023-11-08: Unauthorized Access Attempt</div>
                  <div className="text-xs text-muted-foreground">Created on Nov 8, 2023</div>
                </div>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5">
                <FileText className="h-4 w-4" />
                View Report
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-yellow-500/10 p-2 text-yellow-500">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-medium">INC-2023-10-15: Unusual Network Activity</div>
                  <div className="text-xs text-muted-foreground">Created on Oct 15, 2023</div>
                </div>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5">
                <FileText className="h-4 w-4" />
                View Report
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-green-500/10 p-2 text-green-500">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-medium">INC-2023-09-22: Security Drill Report</div>
                  <div className="text-xs text-muted-foreground">Created on Sep 22, 2023</div>
                </div>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5">
                <FileText className="h-4 w-4" />
                View Report
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
