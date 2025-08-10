"use client"

import { useState } from "react"
import { AlertTriangle, Bell, Check, Info, Mail, MessageSquare, Send, Settings } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
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

export function NotificationPreferences() {
  const [emailEnabled, setEmailEnabled] = useState(true)
  const [slackEnabled, setSlackEnabled] = useState(true)
  const [pagerDutyEnabled, setPagerDutyEnabled] = useState(false)
  const [webhookEnabled, setWebhookEnabled] = useState(false)

  const [criticalAlerts, setCriticalAlerts] = useState(true)
  const [warningAlerts, setWarningAlerts] = useState(true)
  const [infoAlerts, setInfoAlerts] = useState(false)

  const [testNotificationChannel, setTestNotificationChannel] = useState<string | null>(null)
  const [testNotificationSent, setTestNotificationSent] = useState(false)

  const handleTestNotification = () => {
    // Simulate sending a test notification
    setTestNotificationSent(true)

    // Reset after 3 seconds
    setTimeout(() => {
      setTestNotificationSent(false)
      setTestNotificationChannel(null)
    }, 3000)
  }

  return (
    <div className="space-y-6">
      <Card className="border-blue-600/20 shadow-md shadow-blue-600/10">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Alert Channels</CardTitle>
          <CardDescription>Configure notification channels for alerts and events</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <Card className={`border-2 transition-all ${emailEnabled ? "border-blue-500" : "border-transparent"}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Email Notifications</CardTitle>
                  <Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} />
                </div>
              </CardHeader>
              <CardContent className={emailEnabled ? "opacity-100" : "opacity-50"}>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email-recipients">Recipients</Label>
                    <Input
                      id="email-recipients"
                      placeholder="admin@example.com, alerts@example.com"
                      disabled={!emailEnabled}
                    />
                    <div className="text-xs text-muted-foreground">Separate multiple email addresses with commas</div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email-frequency">Digest Frequency</Label>
                    <Select disabled={!emailEnabled} defaultValue="realtime">
                      <SelectTrigger id="email-frequency">
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="realtime">Real-time</SelectItem>
                        <SelectItem value="hourly">Hourly Digest</SelectItem>
                        <SelectItem value="daily">Daily Digest</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex justify-end">
                    <Dialog
                      open={testNotificationChannel === "email"}
                      onOpenChange={(open) => {
                        if (open) setTestNotificationChannel("email")
                        else setTestNotificationChannel(null)
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1.5" disabled={!emailEnabled}>
                          <Mail className="h-4 w-4" />
                          Test Email
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Send Test Email</DialogTitle>
                          <DialogDescription>Send a test email to verify your notification settings.</DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="test-email">Send To</Label>
                            <Input id="test-email" placeholder="admin@example.com" />
                          </div>

                          {testNotificationSent && (
                            <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-500">
                              <div className="flex items-start gap-2">
                                <Check className="mt-0.5 h-4 w-4" />
                                <div>
                                  <p className="font-medium">Test email sent!</p>
                                  <p className="mt-1">Check your inbox for the test notification.</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        <DialogFooter>
                          <Button variant="outline" onClick={() => setTestNotificationChannel(null)}>
                            Cancel
                          </Button>
                          <Button onClick={handleTestNotification}>Send Test</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={`border-2 transition-all ${slackEnabled ? "border-blue-500" : "border-transparent"}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Slack Notifications</CardTitle>
                  <Switch checked={slackEnabled} onCheckedChange={setSlackEnabled} />
                </div>
              </CardHeader>
              <CardContent className={slackEnabled ? "opacity-100" : "opacity-50"}>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="slack-webhook">Webhook URL</Label>
                    <Input
                      id="slack-webhook"
                      placeholder="https://hooks.slack.com/services/..."
                      type="password"
                      disabled={!slackEnabled}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="slack-channel">Channel</Label>
                    <Input id="slack-channel" placeholder="#alerts" disabled={!slackEnabled} />
                  </div>

                  <div className="flex justify-end">
                    <Dialog
                      open={testNotificationChannel === "slack"}
                      onOpenChange={(open) => {
                        if (open) setTestNotificationChannel("slack")
                        else setTestNotificationChannel(null)
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1.5" disabled={!slackEnabled}>
                          <MessageSquare className="h-4 w-4" />
                          Test Slack
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Send Test Slack Message</DialogTitle>
                          <DialogDescription>Send a test message to verify your Slack integration.</DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="test-message">Test Message</Label>
                            <Input id="test-message" placeholder="This is a test notification from Orchestr8" />
                          </div>

                          {testNotificationSent && (
                            <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-500">
                              <div className="flex items-start gap-2">
                                <Check className="mt-0.5 h-4 w-4" />
                                <div>
                                  <p className="font-medium">Test message sent!</p>
                                  <p className="mt-1">Check your Slack channel for the test notification.</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        <DialogFooter>
                          <Button variant="outline" onClick={() => setTestNotificationChannel(null)}>
                            Cancel
                          </Button>
                          <Button onClick={handleTestNotification}>Send Test</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={`border-2 transition-all ${pagerDutyEnabled ? "border-blue-500" : "border-transparent"}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">PagerDuty</CardTitle>
                  <Switch checked={pagerDutyEnabled} onCheckedChange={setPagerDutyEnabled} />
                </div>
              </CardHeader>
              <CardContent className={pagerDutyEnabled ? "opacity-100" : "opacity-50"}>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="pagerduty-key">Integration Key</Label>
                    <Input
                      id="pagerduty-key"
                      placeholder="PagerDuty integration key"
                      type="password"
                      disabled={!pagerDutyEnabled}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pagerduty-severity">Default Severity</Label>
                    <Select disabled={!pagerDutyEnabled} defaultValue="critical">
                      <SelectTrigger id="pagerduty-severity">
                        <SelectValue placeholder="Select severity" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="error">Error</SelectItem>
                        <SelectItem value="warning">Warning</SelectItem>
                        <SelectItem value="info">Info</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      disabled={!pagerDutyEnabled}
                      onClick={() => {
                        setTestNotificationChannel("pagerduty")
                        handleTestNotification()
                      }}
                    >
                      <Bell className="h-4 w-4" />
                      Test PagerDuty
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={`border-2 transition-all ${webhookEnabled ? "border-blue-500" : "border-transparent"}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Custom Webhook</CardTitle>
                  <Switch checked={webhookEnabled} onCheckedChange={setWebhookEnabled} />
                </div>
              </CardHeader>
              <CardContent className={webhookEnabled ? "opacity-100" : "opacity-50"}>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="webhook-url">Webhook URL</Label>
                    <Input id="webhook-url" placeholder="https://example.com/webhook" disabled={!webhookEnabled} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="webhook-method">HTTP Method</Label>
                    <Select disabled={!webhookEnabled} defaultValue="post">
                      <SelectTrigger id="webhook-method">
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="post">POST</SelectItem>
                        <SelectItem value="put">PUT</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      disabled={!webhookEnabled}
                      onClick={() => {
                        setTestNotificationChannel("webhook")
                        handleTestNotification()
                      }}
                    >
                      <Send className="h-4 w-4" />
                      Test Webhook
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
          <CardTitle className="text-xl font-semibold">Alert Severity Filters</CardTitle>
          <CardDescription>Configure which types of alerts you want to receive</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
              <Card className={`border-2 transition-all ${criticalAlerts ? "border-red-500" : "border-transparent"}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                      <h3 className="font-medium">Critical</h3>
                    </div>
                    <Switch checked={criticalAlerts} onCheckedChange={setCriticalAlerts} />
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    Pod crashes, service outages, security breaches
                  </div>
                </CardContent>
              </Card>

              <Card className={`border-2 transition-all ${warningAlerts ? "border-yellow-500" : "border-transparent"}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-500" />
                      <h3 className="font-medium">Warning</h3>
                    </div>
                    <Switch checked={warningAlerts} onCheckedChange={setWarningAlerts} />
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    High latency, resource constraints, scaling events
                  </div>
                </CardContent>
              </Card>

              <Card className={`border-2 transition-all ${infoAlerts ? "border-blue-500" : "border-transparent"}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Info className="h-5 w-5 text-blue-500" />
                      <h3 className="font-medium">Info</h3>
                    </div>
                    <Switch checked={infoAlerts} onCheckedChange={setInfoAlerts} />
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    Deployment success, config changes, routine events
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="rounded-md border p-4">
              <h3 className="mb-3 font-medium">Alert Delivery Rules</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch id="quiet-hours" />
                    <Label htmlFor="quiet-hours" className="text-sm font-normal">
                      Enable Quiet Hours
                    </Label>
                  </div>
                  <span className="text-sm text-muted-foreground">10:00 PM - 8:00 AM</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch id="deduplication" defaultChecked />
                    <Label htmlFor="deduplication" className="text-sm font-normal">
                      Alert Deduplication
                    </Label>
                  </div>
                  <span className="text-sm text-muted-foreground">15 minute window</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch id="auto-resolve" defaultChecked />
                    <Label htmlFor="auto-resolve" className="text-sm font-normal">
                      Auto-resolve Alerts
                    </Label>
                  </div>
                  <span className="text-sm text-muted-foreground">After 24 hours</span>
                </div>
              </div>
            </div>

            <div className="rounded-md bg-blue-500/10 p-4 text-sm">
              <div className="flex items-start gap-2">
                <Settings className="mt-0.5 h-5 w-5 text-blue-500" />
                <div>
                  <p className="font-medium text-blue-500">Advanced Configuration</p>
                  <p className="mt-1">
                    For more granular control over alert routing and escalation policies, configure advanced settings in
                    your PagerDuty or Opsgenie integration.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
