"use client"

import { useState } from "react"
import { AlertTriangle, ArrowRight, Download, FileText } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ComplianceScorecard } from "@/components/security/compliance-scorecard"
import { GeoBlockingMap } from "@/components/security/geo-blocking-map"

export function ComplianceTracking() {
  const [selectedStandard, setSelectedStandard] = useState<string | null>(null)

  // Mock data for compliance gaps
  const complianceGaps = {
    GDPR: [
      {
        id: "gdpr-1",
        title: "Data retention policy not enforced",
        description: "Automated data deletion after retention period is not implemented",
        severity: "medium",
        remediation: "Implement automated data lifecycle management",
      },
      {
        id: "gdpr-2",
        title: "Missing data processing records",
        description: "Complete records of processing activities not maintained",
        severity: "low",
        remediation: "Update data processing documentation",
      },
    ],
    "PCI-DSS": [
      {
        id: "pci-1",
        title: "Encryption not enabled for S3 buckets",
        description: "Server-side encryption not enabled for all payment data storage",
        severity: "high",
        remediation: "Enable default encryption for all S3 buckets",
      },
      {
        id: "pci-2",
        title: "Weak network segmentation",
        description: "Payment processing systems not properly isolated",
        severity: "high",
        remediation: "Implement stricter network policies",
      },
      {
        id: "pci-3",
        title: "Insufficient log retention",
        description: "Audit logs not retained for required 1-year period",
        severity: "medium",
        remediation: "Configure log retention policies",
      },
    ],
    HIPAA: [
      {
        id: "hipaa-1",
        title: "PHI access not properly logged",
        description: "Detailed audit logs for PHI access not implemented",
        severity: "critical",
        remediation: "Implement comprehensive audit logging",
      },
      {
        id: "hipaa-2",
        title: "Encryption at rest not enforced",
        description: "Some databases containing PHI not encrypted",
        severity: "high",
        remediation: "Enable encryption for all PHI storage",
      },
      {
        id: "hipaa-3",
        title: "Business Associate Agreements outdated",
        description: "BAAs not updated with current requirements",
        severity: "medium",
        remediation: "Review and update all BAAs",
      },
      {
        id: "hipaa-4",
        title: "Emergency access procedure missing",
        description: "No documented procedure for emergency PHI access",
        severity: "medium",
        remediation: "Develop and document emergency access procedures",
      },
    ],
  }

  const handleSelectStandard = (standard: string) => {
    setSelectedStandard(standard === selectedStandard ? null : standard)
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-blue-600/20 shadow-md shadow-blue-600/10">
          <CardHeader>
            <CardTitle className="text-sm font-semibold tracking-tight">Compliance Scorecard</CardTitle>
            <CardDescription>Track compliance with security standards and regulations</CardDescription>
          </CardHeader>
          <CardContent>
            <ComplianceScorecard onSelectStandard={handleSelectStandard} selectedStandard={selectedStandard} />

            {selectedStandard && (
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">{selectedStandard} Gap Analysis</h3>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                    <Download className="h-3.5 w-3.5" />
                    Export Report
                  </Button>
                </div>

                <div className="space-y-3">
                  {complianceGaps[selectedStandard as keyof typeof complianceGaps].map((gap) => (
                    <Card key={gap.id} className="overflow-hidden">
                      <CardContent className="p-3">
                        <div className="flex items-start gap-3">
                          <div
                            className={`mt-0.5 rounded-full p-1 ${
                              gap.severity === "critical"
                                ? "bg-red-500/10 text-red-500"
                                : gap.severity === "high"
                                  ? "bg-orange-500/10 text-orange-500"
                                  : gap.severity === "medium"
                                    ? "bg-yellow-500/10 text-yellow-500"
                                    : "bg-blue-500/10 text-blue-500"
                            }`}
                          >
                            <AlertTriangle className="h-4 w-4" />
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">{gap.title}</div>
                            <p className="mt-1 text-xs text-muted-foreground">{gap.description}</p>
                            <div className="mt-2 flex items-center gap-1 text-xs">
                              <ArrowRight className="h-3 w-3 text-muted-foreground" />
                              <span>{gap.remediation}</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-blue-600/20 shadow-md shadow-blue-600/10">
          <CardHeader>
            <CardTitle className="text-sm font-semibold tracking-tight">Geo-Blocking Map</CardTitle>
            <CardDescription>Geographic access controls and threat visualization</CardDescription>
          </CardHeader>
          <CardContent>
            <GeoBlockingMap />
          </CardContent>
        </Card>
      </div>

      <Card className="border-blue-600/20 shadow-md shadow-blue-600/10">
        <CardHeader>
          <CardTitle className="text-sm font-semibold tracking-tight">Compliance Reports</CardTitle>
          <CardDescription>Generated compliance reports and documentation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-blue-500/10 p-2 text-blue-500">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-medium">GDPR Compliance Report</div>
                  <div className="text-xs text-muted-foreground">Generated on Nov 10, 2023</div>
                </div>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Download className="h-4 w-4" />
                Download
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-blue-500/10 p-2 text-blue-500">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-medium">PCI-DSS Audit Documentation</div>
                  <div className="text-xs text-muted-foreground">Generated on Oct 15, 2023</div>
                </div>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Download className="h-4 w-4" />
                Download
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-blue-500/10 p-2 text-blue-500">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-medium">HIPAA Security Assessment</div>
                  <div className="text-xs text-muted-foreground">Generated on Sep 22, 2023</div>
                </div>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Download className="h-4 w-4" />
                Download
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
