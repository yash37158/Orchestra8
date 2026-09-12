"use client"

import { Checkbox } from "@/components/ui/checkbox"

import { useState } from "react"
import { AlertTriangle, ArrowRight, Check, ExternalLink, Plus, RefreshCw, Settings, Trash, Webhook } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

// Mock data for integrations
const integrations = [
  {
    id: "prometheus",
    name: "Prometheus",
    description: "Metrics collection and alerting",
    status: "connected",
    icon: "https://raw.githubusercontent.com/cncf/artwork/master/projects/prometheus/icon/color/prometheus-icon-color.svg",
    lastSync: "10 minutes ago",
  },
  {
    id: "grafana",
    name: "Grafana",
    description: "Metrics visualization and dashboards",
    status: "connected",
    icon: "https://raw.githubusercontent.com/grafana/grafana/main/public/img/grafana_icon.svg",
    lastSync: "15 minutes ago",
  },
  {
    id: "slack",
    name: "Slack",
    description: "Team communication and notifications",
    status: "connected",
    icon: "https://a.slack-edge.com/80588/marketing/img/icons/icon_slack_hash_colored.png",
    lastSync: "30 minutes ago",
  },
  {
    id: "github",
    name: "GitHub",
    description: "Source code and CI/CD integration",
    status: "connected",
    icon: "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png",
    lastSync: "1 hour ago",
  },
  {
    id: "datadog",
    name: "Datadog",
    description: "Infrastructure monitoring and APM",
    status: "not_connected",
    icon: "https://imgix.datadoghq.com/img/about/presskit/logo-v/dd_vertical_purple.png",
    lastSync: null,
  },
  {
    id: "pagerduty",
    name: "PagerDuty",
    description: "Incident management and on-call scheduling",
    status: "not_connected",
    icon: "https://seeklogo.com/images/P/pagerduty-logo-41AE94D829-seeklogo.com.png",
    lastSync: null,
  },
]

// Mock data for webhooks
const webhooks = [
  {
    id: "webhook-001",
    name: "Deployment Notifications",
    url: "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX",
    events: ["deployment.success", "deployment.failure"],
    status: "active",
    lastTriggered: "2 hours ago",
  },
  {
    id: "webhook-002",
    name: "Security Alerts",
    url: "https://api.example.com/webhooks/security",
    events: ["security.vulnerability", "security.threat"],
    status: "active",
    lastTriggered: "1 day ago",
  },
  {
    id: "webhook-003",
    name: "Cost Alerts",
    url: "https://api.example.com/webhooks/cost",
    events: ["cost.threshold.exceeded"],
    status: "inactive",
    lastTriggered: "5 days ago",
  },
]

export function SystemIntegrations() {
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(null)
  const [showWebhookDialog, setShowWebhookDialog] = useState(false)
  const [isTestingWebhook, setIsTestingWebhook] = useState(false)
  const [webhookTestSuccess, setWebhookTestSuccess] = useState<boolean | null>(null)

  const handleConnectIntegration = (integrationId: string) => {
    setSelectedIntegration(integrationId)
  }

  const handleTestWebhook = () => {
    setIsTestingWebhook(true)

    // Simulate webhook test
    setTimeout(() => {
      setIsTestingWebhook(false)
      setWebhookTestSuccess(Math.random() > 0.2) // 80% success rate
    }, 1500)
  }

  return (
    <div className="space-y-6">
      <Card className="border-blue-600/20 shadow-md shadow-blue-600/10">
        <CardHeader>
          <CardTitle className="text-sm font-semibold tracking-tight">Tool Integrations</CardTitle>
          <CardDescription>Connect external tools and services to enhance your platform</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {integrations.map((integration) => (
              <Card key={integration.id} className="overflow-hidden transition-all hover:shadow-md">
                <CardContent className="p-0">
                  <div className="flex items-center gap-3 border-b p-4">
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-md bg-muted">
                      <img
                        src={integration.icon || "/placeholder.svg"}
                        alt={integration.name}
                        className="h-8 w-8 object-contain"
                      />
                    </div>
                    <div>
                      <h3 className="font-medium">{integration.name}</h3>
                      <p className="text-xs text-muted-foreground">{integration.description}</p>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {integration.status === "connected" ? (
                          <Badge variant="outline" className="bg-green-500/10 text-green-500">
                            <Check className="mr-1 h-3 w-3" />
                            Connected
                          </Badge>
                        ) : (
                          <Badge variant="outline">Not Connected</Badge>
                        )}
                      </div>
                      {integration.status === "connected" && (
                        <div className="text-xs text-muted-foreground">Last sync: {integration.lastSync}</div>
                      )}
                    </div>

                    {integration.status === "connected" ? (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs">
                          <RefreshCw className="h-3.5 w-3.5" />
                          Sync
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs">
                          <Settings className="h-3.5 w-3.5" />
                          Configure
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        className="w-full gap-1.5 text-xs"
                        onClick={() => handleConnectIntegration(integration.id)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Connect
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-blue-600/20 shadow-md shadow-blue-600/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold tracking-tight">Webhook Endpoints</CardTitle>
              <CardDescription>Configure webhooks to integrate with external systems</CardDescription>
            </div>
            <Dialog open={showWebhookDialog} onOpenChange={setShowWebhookDialog}>
              <DialogTrigger asChild>
                <Button className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Add Webhook
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Webhook Endpoint</DialogTitle>
                  <DialogDescription>Create a new webhook to receive event notifications</DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="webhook-name">Webhook Name</Label>
                    <Input id="webhook-name" placeholder="Deployment Notifications" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="webhook-url">Endpoint URL</Label>
                    <Input id="webhook-url" placeholder="https://example.com/webhook" />
                  </div>

                  <div className="space-y-2">
                    <Label>Events to Trigger</Label>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Checkbox id="event-deployment" />
                        <Label htmlFor="event-deployment" className="text-sm font-normal">
                          Deployment Events
                        </Label>
                      </div>

                      <div className="flex items-center gap-2">
                        <Checkbox id="event-security" />
                        <Label htmlFor="event-security" className="text-sm font-normal">
                          Security Events
                        </Label>
                      </div>

                      <div className="flex items-center gap-2">
                        <Checkbox id="event-cost" />
                        <Label htmlFor="event-cost" className="text-sm font-normal">
                          Cost & Billing Events
                        </Label>
                      </div>

                      <div className="flex items-center gap-2">
                        <Checkbox id="event-alerts" />
                        <Label htmlFor="event-alerts" className="text-sm font-normal">
                          Alert Events
                        </Label>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="webhook-secret">Secret (Optional)</Label>
                    <Input id="webhook-secret" type="password" placeholder="Webhook secret for verification" />
                    <div className="text-xs text-muted-foreground">
                      Used to verify that requests are coming from Orchestr8
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="webhook-active">Active</Label>
                    <Switch id="webhook-active" defaultChecked />
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowWebhookDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={() => setShowWebhookDialog(false)}>Create Webhook</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {webhooks.map((webhook) => (
              <Card key={webhook.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex items-center justify-between border-b p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                        <Webhook className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <h3 className="font-medium">{webhook.name}</h3>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Last triggered: {webhook.lastTriggered}</span>
                          {webhook.status === "active" ? (
                            <Badge variant="outline" className="bg-green-500/10 text-green-500">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500">
                              Inactive
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setIsTestingWebhook(true)
                          setWebhookTestSuccess(null)
                          handleTestWebhook()
                        }}
                      >
                        <RefreshCw className={`h-4 w-4 ${isTestingWebhook ? "animate-spin" : ""}`} />
                        <span className="sr-only">Test Webhook</span>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Settings className="h-4 w-4" />
                        <span className="sr-only">Configure</span>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500">
                        <Trash className="h-4 w-4" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="space-y-3">
                      <div>
                        <div className="text-xs text-muted-foreground">Endpoint URL</div>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 truncate rounded bg-muted px-1 py-0.5 text-xs">{webhook.url}</code>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            <ExternalLink className="h-3.5 w-3.5" />
                            <span className="sr-only">Open</span>
                          </Button>
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-muted-foreground">Events</div>
                        <div className="flex flex-wrap gap-1 pt-1">
                          {webhook.events.map((event) => (
                            <Badge key={event} variant="outline" className="text-xs">
                              {event}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {webhookTestSuccess !== null && (
                        <div
                          className={`rounded-md p-2 text-xs ${
                            webhookTestSuccess ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                          }`}
                        >
                          {webhookTestSuccess ? (
                            <div className="flex items-center gap-1">
                              <Check className="h-3.5 w-3.5" />
                              <span>Webhook test successful! (200 OK)</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              <span>Webhook test failed! (Connection refused)</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            <div className="rounded-md border p-4">
              <h3 className="mb-3 font-medium">Webhook Payload Example</h3>
              <div className="rounded-md bg-muted p-3">
                <pre className="text-xs">
                  {`{
  "event": "deployment.success",
  "timestamp": "2023-11-10T15:30:00Z",
  "data": {
    "application": "frontend",
    "version": "v1.2.3",
    "environment": "production",
    "deployedBy": "john@example.com"
  }
}`}
                </pre>
              </div>
              <div className="mt-2 flex justify-end">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  <ArrowRight className="h-3.5 w-3.5" />
                  View Documentation
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
