"use client"

import { useState } from "react"
import { ArrowLeft, Check, Clock, FileDown, FileUp, GitMerge } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface ConflictResolutionProps {
  conflict: any
  onClose: () => void
}

export function ConflictResolution({ conflict, onClose }: ConflictResolutionProps) {
  const [selectedVersion, setSelectedVersion] = useState<"local" | "remote" | "merged">("merged")

  // Mock data for the conflict
  const localData =
    conflict.dataType === "config"
      ? `{
  "sampling_rate": 60,
  "log_level": "debug",
  "max_connections": 100,
  "timeout": 30,
  "retry_count": 5,
  "compression": true
}`
      : `[
  {"timestamp": "2023-11-10T10:15:00Z", "value": 23.5, "status": "normal"},
  {"timestamp": "2023-11-10T10:30:00Z", "value": 24.1, "status": "normal"},
  {"timestamp": "2023-11-10T10:45:00Z", "value": 25.8, "status": "warning"},
  {"timestamp": "2023-11-10T11:00:00Z", "value": 22.3, "status": "normal"}
]`

  const remoteData =
    conflict.dataType === "config"
      ? `{
  "sampling_rate": 30,
  "log_level": "info",
  "max_connections": 200,
  "timeout": 30,
  "retry_count": 3,
  "compression": true
}`
      : `[
  {"timestamp": "2023-11-10T10:15:00Z", "value": 23.5, "status": "normal"},
  {"timestamp": "2023-11-10T10:30:00Z", "value": 24.1, "status": "normal"},
  {"timestamp": "2023-11-10T10:45:00Z", "value": 24.7, "status": "normal"},
  {"timestamp": "2023-11-10T11:00:00Z", "value": 25.2, "status": "normal"}
]`

  const mergedData =
    conflict.dataType === "config"
      ? `{
  "sampling_rate": 30,
  "log_level": "debug",
  "max_connections": 200,
  "timeout": 30,
  "retry_count": 5,
  "compression": true
}`
      : `[
  {"timestamp": "2023-11-10T10:15:00Z", "value": 23.5, "status": "normal"},
  {"timestamp": "2023-11-10T10:30:00Z", "value": 24.1, "status": "normal"},
  {"timestamp": "2023-11-10T10:45:00Z", "value": 25.8, "status": "warning"},
  {"timestamp": "2023-11-10T11:00:00Z", "value": 25.2, "status": "normal"}
]`

  const handleResolve = () => {
    // Handle conflict resolution
    console.log(`Resolving conflict with ${selectedVersion} version`)
    onClose()
  }

  return (
    <Card className="border-red-600/20 shadow-md shadow-red-600/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-semibold">Resolve Data Conflict</CardTitle>
            <CardDescription>
              {conflict.nodeId} • {conflict.nodeName}
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={onClose}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between rounded-md border p-3">
          <div className="flex items-center gap-3">
            <Badge variant="destructive">Conflict</Badge>
            <span className="font-medium">{conflict.dataType}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Detected {conflict.detectedAt}</span>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="font-medium">Conflict Description</h3>
          <p className="text-sm">{conflict.description}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card className={selectedVersion === "local" ? "ring-2 ring-primary" : ""}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Local Version</CardTitle>
                <Badge variant="outline" className="bg-blue-500/10 text-blue-500">
                  <FileDown className="mr-1 h-3 w-3" />
                  Edge Node
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-3 rounded-md bg-muted p-3 font-mono text-xs">
                <pre>{localData}</pre>
              </div>
              <Button
                className="w-full gap-1.5"
                variant={selectedVersion === "local" ? "default" : "outline"}
                onClick={() => setSelectedVersion("local")}
              >
                <Check className="h-4 w-4" />
                Use Local Version
              </Button>
            </CardContent>
          </Card>

          <Card className={selectedVersion === "remote" ? "ring-2 ring-primary" : ""}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Remote Version</CardTitle>
                <Badge variant="outline" className="bg-green-500/10 text-green-500">
                  <FileUp className="mr-1 h-3 w-3" />
                  Server
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-3 rounded-md bg-muted p-3 font-mono text-xs">
                <pre>{remoteData}</pre>
              </div>
              <Button
                className="w-full gap-1.5"
                variant={selectedVersion === "remote" ? "default" : "outline"}
                onClick={() => setSelectedVersion("remote")}
              >
                <Check className="h-4 w-4" />
                Use Remote Version
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className={selectedVersion === "merged" ? "ring-2 ring-primary" : ""}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Auto-Merged Version (CRDT)</CardTitle>
              <Badge variant="outline" className="bg-purple-500/10 text-purple-500">
                <GitMerge className="mr-1 h-3 w-3" />
                Merged
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-3 rounded-md bg-muted p-3 font-mono text-xs">
              <pre>{mergedData}</pre>
            </div>
            <Button
              className="w-full gap-1.5"
              variant={selectedVersion === "merged" ? "default" : "outline"}
              onClick={() => setSelectedVersion("merged")}
            >
              <Check className="h-4 w-4" />
              Use Merged Version
            </Button>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleResolve}>Resolve Conflict</Button>
        </div>
      </CardContent>
    </Card>
  )
}
