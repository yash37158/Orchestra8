import { MainLayout } from "@/components/main-layout"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PolicyDashboard } from "@/components/security/policy-dashboard"
import { RuntimeThreatDetection } from "@/components/security/runtime-threat-detection"
import { ComplianceTracking } from "@/components/security/compliance-tracking"
import { ShiftLeftSecurity } from "@/components/security/shift-left-security"
import { AuditForensics } from "@/components/security/audit-forensics"

export default function SecurityPage() {
  return (
    <MainLayout>
      <ScrollArea className="h-[calc(100vh-4rem)]">
        <div className="container space-y-6 py-6">
          <h1 className="text-3xl font-bold tracking-tight">Security Policies</h1>

          <Tabs defaultValue="policies" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="policies">Policies</TabsTrigger>
              <TabsTrigger value="threats">Threats</TabsTrigger>
              <TabsTrigger value="compliance">Compliance</TabsTrigger>
              <TabsTrigger value="shift-left">Shift-Left</TabsTrigger>
              <TabsTrigger value="audit">Audit & Forensics</TabsTrigger>
            </TabsList>

            <TabsContent value="policies" className="space-y-6">
              <PolicyDashboard />
            </TabsContent>

            <TabsContent value="threats" className="space-y-6">
              <RuntimeThreatDetection />
            </TabsContent>

            <TabsContent value="compliance" className="space-y-6">
              <ComplianceTracking />
            </TabsContent>

            <TabsContent value="shift-left" className="space-y-6">
              <ShiftLeftSecurity />
            </TabsContent>

            <TabsContent value="audit" className="space-y-6">
              <AuditForensics />
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </MainLayout>
  )
}
