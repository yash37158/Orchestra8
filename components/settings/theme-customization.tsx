"use client"

import type React from "react"

import { useState } from "react"
import { Check, Copy, Download, Moon, Save, Sun, Upload } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function ThemeCustomization() {
  const [theme, setTheme] = useState("dark")
  const [accentColor, setAccentColor] = useState("#2B6CB0")
  const [highContrastMode, setHighContrastMode] = useState(false)
  const [animationsEnabled, setAnimationsEnabled] = useState(true)
  const [fontScale, setFontScale] = useState(100)
  const [borderRadius, setBorderRadius] = useState(8)

  const presetColors = [
    { name: "Blue", value: "#2B6CB0" },
    { name: "Green", value: "#48BB78" },
    { name: "Purple", value: "#805AD5" },
    { name: "Red", value: "#E53E3E" },
    { name: "Orange", value: "#ED8936" },
    { name: "Teal", value: "#38B2AC" },
  ]

  const handleThemeChange = (value: string) => {
    setTheme(value)
    // In a real app, this would update the theme in the ThemeProvider
  }

  const handleAccentColorChange = (value: string) => {
    setAccentColor(value)
    // In a real app, this would update CSS variables
  }

  const handleFontScaleChange = (value: number[]) => {
    setFontScale(value[0])
    // In a real app, this would update CSS variables
  }

  const handleBorderRadiusChange = (value: number[]) => {
    setBorderRadius(value[0])
    // In a real app, this would update CSS variables
  }

  const handleSaveTheme = () => {
    // In a real app, this would save the theme settings to user preferences
    alert("Theme settings saved!")
  }

  return (
    <div className="space-y-6">
      <Card className="border-blue-600/20 shadow-md shadow-blue-600/10">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Theme Settings</CardTitle>
          <CardDescription>Customize the appearance of the platform</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>Color Theme</Label>
                <div className="flex gap-2">
                  <Button
                    variant={theme === "light" ? "default" : "outline"}
                    className="flex-1 gap-2"
                    onClick={() => handleThemeChange("light")}
                  >
                    <Sun className="h-4 w-4" />
                    Light
                  </Button>
                  <Button
                    variant={theme === "dark" ? "default" : "outline"}
                    className="flex-1 gap-2"
                    onClick={() => handleThemeChange("dark")}
                  >
                    <Moon className="h-4 w-4" />
                    Dark
                  </Button>
                  <Button
                    variant={theme === "system" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => handleThemeChange("system")}
                  >
                    System
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Accent Color</Label>
                <div className="grid grid-cols-6 gap-2">
                  {presetColors.map((color) => (
                    <button
                      key={color.value}
                      className={`h-8 rounded-md ${
                        accentColor === color.value ? "ring-2 ring-offset-2 ring-offset-background" : ""
                      }`}
                      style={{ backgroundColor: color.value }}
                      onClick={() => handleAccentColorChange(color.value)}
                      title={color.name}
                    >
                      {accentColor === color.value && <Check className="mx-auto h-4 w-4 text-white" />}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-8 w-8 rounded-md" style={{ backgroundColor: accentColor }}></div>
                  <input
                    type="text"
                    value={accentColor}
                    onChange={(e) => handleAccentColorChange(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <Button variant="outline" size="sm" className="h-9 px-2.5">
                    <span className="sr-only">Pick color</span>
                    <input
                      type="color"
                      value={accentColor}
                      onChange={(e) => handleAccentColorChange(e.target.value)}
                      className="h-4 w-4 cursor-pointer appearance-none border-0 bg-transparent p-0"
                    />
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="high-contrast">High Contrast Mode</Label>
                  <Switch id="high-contrast" checked={highContrastMode} onCheckedChange={setHighContrastMode} />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="animations">Enable Animations</Label>
                  <Switch id="animations" checked={animationsEnabled} onCheckedChange={setAnimationsEnabled} />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <Label htmlFor="font-scale">Font Size</Label>
                    <span className="text-sm">{fontScale}%</span>
                  </div>
                  <Slider
                    id="font-scale"
                    min={75}
                    max={150}
                    step={5}
                    value={[fontScale]}
                    onValueChange={handleFontScaleChange}
                  />
                  <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                    <span>Smaller</span>
                    <span>Default</span>
                    <span>Larger</span>
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <Label htmlFor="border-radius">Border Radius</Label>
                    <span className="text-sm">{borderRadius}px</span>
                  </div>
                  <Slider
                    id="border-radius"
                    min={0}
                    max={16}
                    step={1}
                    value={[borderRadius]}
                    onValueChange={handleBorderRadiusChange}
                  />
                  <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                    <span>Square</span>
                    <span>Default</span>
                    <span>Rounded</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-md border p-4">
                <h3 className="mb-4 font-medium">Preview</h3>
                <div
                  className={`space-y-4 rounded-lg border p-4 ${
                    theme === "dark" ? "bg-slate-900 text-white" : "bg-white text-slate-900"
                  } ${highContrastMode ? "contrast-more" : ""}`}
                  style={
                    {
                      "--theme-primary": accentColor,
                      borderRadius: `${borderRadius}px`,
                      fontSize: `${fontScale}%`,
                    } as React.CSSProperties
                  }
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Sample Card</h4>
                    <Badge style={{ backgroundColor: accentColor, color: "white" }}>New</Badge>
                  </div>

                  <p className="text-sm">
                    This is a preview of your theme settings. Adjust the options to see changes in real-time.
                  </p>

                  <div className="flex gap-2">
                    <Button className="text-sm" style={{ backgroundColor: accentColor, color: "white" }}>
                      Primary Button
                    </Button>
                    <Button
                      variant="outline"
                      className="text-sm"
                      style={{ borderColor: accentColor, color: accentColor }}
                    >
                      Secondary
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded-md border p-4">
                <h3 className="mb-4 font-medium">Theme Presets</h3>
                <RadioGroup defaultValue="custom" className="space-y-2">
                  <div className="flex items-center justify-between rounded-md border p-2">
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="default" id="theme-default" />
                      <Label htmlFor="theme-default" className="text-sm font-normal">
                        Default Theme
                      </Label>
                    </div>
                    <div className="flex gap-1">
                      <div className="h-4 w-4 rounded-full bg-blue-500"></div>
                      <div className="h-4 w-4 rounded-full bg-slate-900"></div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-md border p-2">
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="green" id="theme-green" />
                      <Label htmlFor="theme-green" className="text-sm font-normal">
                        Green Theme
                      </Label>
                    </div>
                    <div className="flex gap-1">
                      <div className="h-4 w-4 rounded-full bg-green-500"></div>
                      <div className="h-4 w-4 rounded-full bg-slate-900"></div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-md border p-2">
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="purple" id="theme-purple" />
                      <Label htmlFor="theme-purple" className="text-sm font-normal">
                        Purple Theme
                      </Label>
                    </div>
                    <div className="flex gap-1">
                      <div className="h-4 w-4 rounded-full bg-purple-500"></div>
                      <div className="h-4 w-4 rounded-full bg-slate-900"></div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-md border p-2 bg-muted/50">
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="custom" id="theme-custom" />
                      <Label htmlFor="theme-custom" className="text-sm font-normal">
                        Custom Theme
                      </Label>
                      <Badge variant="outline">Current</Badge>
                    </div>
                    <div className="flex gap-1">
                      <div className="h-4 w-4 rounded-full" style={{ backgroundColor: accentColor }}></div>
                      <div className="h-4 w-4 rounded-full bg-slate-900"></div>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" className="gap-1.5">
                  <Download className="h-4 w-4" />
                  Export Theme
                </Button>
                <Button variant="outline" className="gap-1.5">
                  <Upload className="h-4 w-4" />
                  Import Theme
                </Button>
                <Button className="gap-1.5" onClick={handleSaveTheme}>
                  <Save className="h-4 w-4" />
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-blue-600/20 shadow-md shadow-blue-600/10">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Dashboard Layout</CardTitle>
          <CardDescription>Customize the layout of your dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="layout">
            <TabsList>
              <TabsTrigger value="layout">Layout Editor</TabsTrigger>
              <TabsTrigger value="presets">Saved Layouts</TabsTrigger>
            </TabsList>

            <TabsContent value="layout" className="space-y-4 pt-4">
              <div className="rounded-md border p-4">
                <h3 className="mb-4 font-medium">Drag and Drop Widgets</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Available Widgets</Label>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between rounded-md border border-dashed p-2">
                        <span className="text-sm">Topology Map</span>
                        <Button variant="outline" size="sm" className="h-7 text-xs">
                          Add
                        </Button>
                      </div>
                      <div className="flex items-center justify-between rounded-md border border-dashed p-2">
                        <span className="text-sm">Resource Usage</span>
                        <Button variant="outline" size="sm" className="h-7 text-xs">
                          Add
                        </Button>
                      </div>
                      <div className="flex items-center justify-between rounded-md border border-dashed p-2">
                        <span className="text-sm">Recent Alerts</span>
                        <Button variant="outline" size="sm" className="h-7 text-xs">
                          Add
                        </Button>
                      </div>
                      <div className="flex items-center justify-between rounded-md border border-dashed p-2">
                        <span className="text-sm">Deployment History</span>
                        <Button variant="outline" size="sm" className="h-7 text-xs">
                          Add
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Dashboard Layout</Label>
                    <div className="h-[200px] rounded-md border border-dashed p-4">
                      <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
                        Drag widgets here to customize your dashboard layout
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-md border p-4">
                <h3 className="mb-4 font-medium">Layout Settings</h3>
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="columns">Grid Columns</Label>
                      <Select defaultValue="12">
                        <SelectTrigger id="columns">
                          <SelectValue placeholder="Select columns" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 Column</SelectItem>
                          <SelectItem value="2">2 Columns</SelectItem>
                          <SelectItem value="3">3 Columns</SelectItem>
                          <SelectItem value="4">4 Columns</SelectItem>
                          <SelectItem value="6">6 Columns</SelectItem>
                          <SelectItem value="12">12 Columns</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="gap">Grid Gap</Label>
                      <Select defaultValue="4">
                        <SelectTrigger id="gap">
                          <SelectValue placeholder="Select gap" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2">Small (8px)</SelectItem>
                          <SelectItem value="4">Medium (16px)</SelectItem>
                          <SelectItem value="6">Large (24px)</SelectItem>
                          <SelectItem value="8">Extra Large (32px)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="compact-mode">Compact Mode</Label>
                    <Switch id="compact-mode" />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="sticky-header">Sticky Widget Headers</Label>
                    <Switch id="sticky-header" defaultChecked />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline">Reset Layout</Button>
                <Button>Save Layout</Button>
              </div>
            </TabsContent>

            <TabsContent value="presets" className="space-y-4 pt-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <h4 className="font-medium">Default Layout</h4>
                    <p className="text-sm text-muted-foreground">Standard dashboard layout</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      Preview
                    </Button>
                    <Button size="sm">Apply</Button>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <h4 className="font-medium">Monitoring Focus</h4>
                    <p className="text-sm text-muted-foreground">Emphasis on metrics and alerts</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      Preview
                    </Button>
                    <Button size="sm">Apply</Button>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <h4 className="font-medium">DevOps Layout</h4>
                    <p className="text-sm text-muted-foreground">Focus on deployments and CI/CD</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      Preview
                    </Button>
                    <Button size="sm">Apply</Button>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-md border p-3 bg-muted/50">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">My Custom Layout</h4>
                      <Badge variant="outline">Current</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">Last modified 2 days ago</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" className="text-red-500">
                      Delete
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button className="gap-1.5">
                  <Copy className="h-4 w-4" />
                  Create New Layout
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
