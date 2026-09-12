"use client"
import { AlertTriangle, Check, FileText, Shield, ShieldAlert, User } from "lucide-react"
import { Badge } from "@/components/ui/badge"

// Mock data for audit events
const auditEvents = [
  {
    id: "event-001",
    timestamp: "2023-11-10T14:30:00Z",
    user: "admin",
    type: "policy-change",
    description: "Updated Block Privileged Containers policy",
    severity: "info",
    details: "Modified policy to include exception for monitoring namespace",
  },
  {
    id: "event-002",
    timestamp: "2023-11-09T10:15:00Z",
    user: "system",
    type: "violation",
    description: "Policy violation detected: Enforce Resource Limits",
    severity: "warning",
    details: "Pod frontend-service-pod-1 created without resource limits",
  },
  {
    id: "event-003",
    timestamp: "2023-11-08T16:45:00Z",
    user: "security-admin",
    type: "remediation",
    description: "Auto-remediation applied to security violation",
    severity: "info",
    details: "Quarantined pod backend-api-7 due to privilege escalation attempt",
  },
  {
    id: "event-004",
    timestamp: "2023-11-08T16:30:00Z",
    user: "system",
    type: "threat",
    description: "Security threat detected: Privilege escalation attempt",
    severity: "critical",
    details: "Container attempted to modify host system files in pod backend-api-7",
  },
  {
    id: "event-005",
    timestamp: "2023-11-07T09:20:00Z",
    user: "devops-lead",
    type: "policy-change",
    description: "Created new policy: Enforce Image Signing",
    severity: "info",
    details: "Added policy to require signed container images in production namespace",
  },
  {
    id: "event-006",
    timestamp: "2023-11-05T11:10:00Z",
    user: "system",
    type: "compliance",
    description: "Compliance scan completed",
    severity: "info",
    details: "GDPR compliance score: 92%, PCI-DSS: 85%, HIPAA: 78%",
  },
]

export function SecurityAuditTimeline() {
  const getEventIcon = (type: string, severity: string) => {
    switch (type) {
      case "policy-change":
        return <Shield className="h-5 w-5 text-blue-500" />
      case "violation":
        return severity === "critical" ? (
          <ShieldAlert className="h-5 w-5 text-red-500" />
        ) : (
          <ShieldAlert className="h-5 w-5 text-yellow-500" />
        )
      case "threat":
        return <AlertTriangle className="h-5 w-5 text-red-500" />
      case "remediation":
        return <Check className="h-5 w-5 text-green-500" />
      case "compliance":
        return <FileText className="h-5 w-5 text-blue-500" />
      default:
        return <Shield className="h-5 w-5 text-muted-foreground" />
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  }

  return (
    <div className="relative pl-6">
      <div className="absolute bottom-0 left-2 top-0 w-0.5 bg-muted"></div>

      {auditEvents.map((event, index) => (
        <div key={event.id} className="mb-6 last:mb-0">
          <div className="absolute left-0 mt-1 flex h-4 w-4 items-center justify-center rounded-full border border-primary bg-background">
            {getEventIcon(event.type, event.severity)}
          </div>

          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="mb-2 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    event.severity === "critical" ? "destructive" : event.severity === "warning" ? "warning" : "default"
                  }
                >
                  {event.type}
                </Badge>
                <span className="text-xs text-muted-foreground">{formatDate(event.timestamp)}</span>
              </div>

              <div className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
                <User className="mr-1 h-3 w-3 text-muted-foreground" />
                {event.user}
              </div>
            </div>

            <h3 className="font-medium">{event.description}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{event.details}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
