import { MainLayout } from "@/components/main-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function AuditPage() {
  return (
    <MainLayout>
      <div className="container space-y-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Audit Ledger</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-muted-foreground">Blockchain-based audit logs</div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}
