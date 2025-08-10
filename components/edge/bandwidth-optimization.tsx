"use client"

import { useState } from "react"
import { ArrowRight, Check, Download, FileDown, FileUp, Lightbulb } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BandwidthUsageChart } from "@/components/edge/bandwidth-usage-chart"

export function BandwidthOptimization() {
  const [lowBandwidthMode, setLowBandwidthMode] = useState(false)
  const [compressionEnabled, setCompressionEnabled] = useState(true)
  const [deltaSyncEnabled, setDeltaSyncEnabled] = useState(true)

  return (
    <div className="space-y-6">
      <Card className="border-blue-600/20 shadow-md shadow-blue-600/10">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Bandwidth Usage Dashboard</CardTitle>
          <CardDescription>Monitor and optimize bandwidth consumption across edge nodes</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="hourly">
            <div className="mb-4 flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="hourly">Hourly</TabsTrigger>
                <TabsTrigger value="daily">Daily</TabsTrigger>
                <TabsTrigger value="weekly">Weekly</TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-500">
                    <FileDown className="mr-1 h-3 w-3" />
                    Inbound
                  </Badge>
                  <Badge variant="outline" className="bg-green-500/10 text-green-500">
                    <FileUp className="mr-1 h-3 w-3" />
                    Outbound
                  </Badge>
                </div>

                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  <Download className="h-3.5 w-3.5" />
                  Export Data
                </Button>
              </div>
            </div>

            <TabsContent value="hourly">
              <div className="h-[350px]">
                <BandwidthUsageChart timeframe="hourly" />
              </div>
            </TabsContent>

            <TabsContent value="daily">
              <div className="h-[350px]">
                <BandwidthUsageChart timeframe="daily" />
              </div>
            </TabsContent>

            <TabsContent value="weekly">
              <div className="h-[350px]">
                <BandwidthUsageChart timeframe="weekly" />
              </div>
            </TabsContent>
          </Tabs>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">AI Bandwidth Optimization Suggestions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-md bg-blue-500/10 p-3 text-sm">
                  <div className="flex items-start gap-2">
                    <Lightbulb className="mt-0.5 h-4 w-4 text-blue-500" />
                    <div>
                      <p className="font-medium text-blue-500">Compress telemetry data for edge-ber-02</p>
                      <p className="mt-1">Implementing LZ4 compression could save 40% bandwidth for this node.</p>
                      <Button variant="link" size="sm" className="mt-1 h-auto p-0 text-blue-500">
                        Apply Suggestion
                        <ArrowRight className="ml-1 h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="rounded-md bg-blue-500/10 p-3 text-sm">
                  <div className="flex items-start gap-2">
                    <Lightbulb className="mt-0.5 h-4 w-4 text-blue-500" />
                    <div>
                      <p className="font-medium text-blue-500">Reduce sync frequency for low-priority data</p>
                      <p className="mt-1">
                        Changing sync interval from 5 to 15 minutes for non-critical metrics could save 25% bandwidth.
                      </p>
                      <Button variant="link" size="sm" className="mt-1 h-auto p-0 text-blue-500">
                        Apply Suggestion
                        <ArrowRight className="ml-1 h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="rounded-md bg-blue-500/10 p-3 text-sm">
                  <div className="flex items-start gap-2">
                    <Lightbulb className="mt-0.5 h-4 w-4 text-blue-500" />
                    <div>
                      <p className="font-medium text-blue-500">Implement batch processing for edge-nyc-01</p>
                      <p className="mt-1">Batching small API calls could reduce overhead and save 15% bandwidth.</p>
                      <Button variant="link" size="sm" className="mt-1 h-auto p-0 text-blue-500">
                        Apply Suggestion
                        <ArrowRight className="ml-1 h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Low-Bandwidth Mode</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="low-bandwidth-mode">Enable Low-Bandwidth Mode</Label>
                    <p className="text-xs text-muted-foreground">Optimize data transfer for constrained networks</p>
                  </div>
                  <Switch id="low-bandwidth-mode" checked={lowBandwidthMode} onCheckedChange={setLowBandwidthMode} />
                </div>

                <div className={`space-y-4 ${lowBandwidthMode ? "opacity-100" : "opacity-50"}`}>
                  <div className="rounded-md border p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <Label htmlFor="compression" className="font-medium">
                        Data Compression
                      </Label>
                      <Switch
                        id="compression"
                        checked={compressionEnabled}
                        onCheckedChange={setCompressionEnabled}
                        disabled={!lowBandwidthMode}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Use LZ4/Zstandard compression for all data transfers
                    </p>
                  </div>

                  <div className="rounded-md border p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <Label htmlFor="delta-sync" className="font-medium">
                        Delta Sync
                      </Label>
                      <Switch
                        id="delta-sync"
                        checked={deltaSyncEnabled}
                        onCheckedChange={setDeltaSyncEnabled}
                        disabled={!lowBandwidthMode}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Only sync changes instead of full data transfers</p>
                  </div>

                  <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-500">
                    <div className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4" />
                      <div>
                        <p className="font-medium">Bandwidth Savings</p>
                        <p className="mt-1">Saved 2.1 GB this week with optimizations</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Card className="border-blue-600/20 shadow-md shadow-blue-600/10">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Bandwidth Allocation</CardTitle>
          <CardDescription>Manage bandwidth quotas and priorities across edge nodes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="rounded-md border p-4">
              <h3 className="mb-3 font-medium">Bandwidth Quotas by Region</h3>
              <div className="space-y-4">
                <div>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span>North America</span>
                    <span className="font-medium">40 Mbps</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div className="h-2 w-[40%] rounded-full bg-blue-500"></div>
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span>Europe</span>
                    <span className="font-medium">30 Mbps</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div className="h-2 w-[30%] rounded-full bg-blue-500"></div>
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span>Asia Pacific</span>
                    <span className="font-medium">20 Mbps</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div className="h-2 w-[20%] rounded-full bg-blue-500"></div>
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span>South America</span>
                    <span className="font-medium">10 Mbps</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div className="h-2 w-[10%] rounded-full bg-blue-500"></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-md border p-4">
              <h3 className="mb-3 font-medium">Traffic Prioritization</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-md bg-muted p-2">
                  <div className="flex items-center gap-2">
                    <Badge>High</Badge>
                    <span className="text-sm">Critical Telemetry</span>
                  </div>
                  <span className="text-sm font-medium">40% of bandwidth</span>
                </div>

                <div className="flex items-center justify-between rounded-md bg-muted p-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Medium</Badge>
                    <span className="text-sm">System Logs</span>
                  </div>
                  <span className="text-sm font-medium">30% of bandwidth</span>
                </div>

                <div className="flex items-center justify-between rounded-md bg-muted p-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Low</Badge>
                    <span className="text-sm">Metrics & Analytics</span>
                  </div>
                  <span className="text-sm font-medium">20% of bandwidth</span>
                </div>

                <div className="flex items-center justify-between rounded-md bg-muted p-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Background</Badge>
                    <span className="text-sm">Firmware Updates</span>
                  </div>
                  <span className="text-sm font-medium">10% of bandwidth</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
