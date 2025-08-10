import { MainLayout } from "@/components/main-layout"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { GitOpsConfig } from "@/components/settings/gitops-config"
import { ApiKeyManagement } from "@/components/settings/api-key-management"
import { NotificationPreferences } from "@/components/settings/notification-preferences"
import { RbacSettings } from "@/components/settings/rbac-settings"
import { ThemeCustomization } from "@/components/settings/theme-customization"
import { SystemIntegrations } from "@/components/settings/system-integrations"

export default function SettingsPage() {
  return (
    <MainLayout>
      <ScrollArea className="h-[calc(100vh-4rem)]">
        <div className="container space-y-6 py-6">
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>

          <Tabs defaultValue="gitops" className="space-y-6">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="gitops">GitOps & CI/CD</TabsTrigger>
              <TabsTrigger value="api">API Keys</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              <TabsTrigger value="rbac">RBAC</TabsTrigger>
              <TabsTrigger value="theme">Theme</TabsTrigger>
              <TabsTrigger value="integrations">Integrations</TabsTrigger>
            </TabsList>

            <TabsContent value="gitops" className="space-y-6">
              <GitOpsConfig />
            </TabsContent>

            <TabsContent value="api" className="space-y-6">
              <ApiKeyManagement />
            </TabsContent>

            <TabsContent value="notifications" className="space-y-6">
              <NotificationPreferences />
            </TabsContent>

            <TabsContent value="rbac" className="space-y-6">
              <RbacSettings />
            </TabsContent>

            <TabsContent value="theme" className="space-y-6">
              <ThemeCustomization />
            </TabsContent>

            <TabsContent value="integrations" className="space-y-6">
              <SystemIntegrations />
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </MainLayout>
  )
}
