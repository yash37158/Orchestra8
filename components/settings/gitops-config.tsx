"use client"

import { useState } from "react"
import { Editor } from "@monaco-editor/react"
import { ArrowRight, Check, Copy, Download, Github, Gitlab, GitBranch, RotateCw, Save, Upload } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

// Sample pipeline template YAML
const pipelineTemplateYaml = `apiVersion: tekton.dev/v1beta1
kind: Pipeline
metadata:
  name: security-scan-deploy
spec:
  params:
    - name: git-url
      type: string
    - name: git-revision
      type: string
    - name: image-name
      type: string
  tasks:
    - name: fetch-repository
      taskRef:
        name: git-clone
      params:
        - name: url
          value: $(params.git-url)
        - name: revision
          value: $(params.git-revision)
    - name: run-security-scan
      taskRef:
        name: security-scanner
      runAfter:
        - fetch-repository
    - name: build-and-push
      taskRef:
        name: kaniko
      runAfter:
        - run-security-scan
      params:
        - name: IMAGE
          value: $(params.image-name)
    - name: deploy-to-cluster
      taskRef:
        name: kubectl-deploy
      runAfter:
        - build-and-push
`

export function GitOpsConfig() {
  const [gitProvider, setGitProvider] = useState("github")
  const [repoUrl, setRepoUrl] = useState("")
  const [branch, setBranch] = useState("main")
  const [syncInterval, setSyncInterval] = useState("5")
  const [isConnected, setIsConnected] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState(0)
  const [selectedTemplate, setSelectedTemplate] = useState("security-scan-deploy")
  const [pipelineYaml, setPipelineYaml] = useState(pipelineTemplateYaml)

  const handleConnect = () => {
    // Simulate OAuth connection
    setIsConnected(true)
  }

  const handleDisconnect = () => {
    setIsConnected(false)
  }

  const handleTestSync = () => {
    if (!isConnected) return

    setIsSyncing(true)
    setSyncProgress(0)

    // Simulate sync progress
    const interval = setInterval(() => {
      setSyncProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          setIsSyncing(false)
          return 100
        }
        return prev + 10
      })
    }, 300)
  }

  const handleTemplateChange = (template: string) => {
    setSelectedTemplate(template)
    // In a real app, we would load the template YAML here
    setPipelineYaml(pipelineTemplateYaml)
  }

  const handleEditorChange = (value: string | undefined) => {
    if (value) {
      setPipelineYaml(value)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-blue-600/20 shadow-md shadow-blue-600/10">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Git Repository Connection</CardTitle>
          <CardDescription>Connect your Git repository for GitOps-based configuration management</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="git-provider">Git Provider</Label>
                <Select value={gitProvider} onValueChange={setGitProvider}>
                  <SelectTrigger id="git-provider">
                    <SelectValue placeholder="Select Git provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="github">
                      <div className="flex items-center gap-2">
                        <Github className="h-4 w-4" />
                        <span>GitHub</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="gitlab">
                      <div className="flex items-center gap-2">
                        <Gitlab className="h-4 w-4" />
                        <span>GitLab</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="bitbucket">
                      <div className="flex items-center gap-2">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M0.81,12a11.21,11.21,0,0,0,11.4,11.2,11.21,11.21,0,0,0,11.4-11.2A11.21,11.21,0,0,0,12.21.8,11.21,11.21,0,0,0,.81,12Zm9.6,3.2-1.2-6,3,4Zm5.6-2-4.8,4.8,3-8Zm-.8-1.6a1.25,1.25,0,0,0-1.6,0,1.28,1.28,0,0,0,0,1.6,1.31,1.31,0,0,0,1.6,0,1.28,1.28,0,0,0,0-1.6Z" />
                        </svg>
                        <span>Bitbucket</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="repo-url">Repository URL</Label>
                <Input
                  id="repo-url"
                  placeholder="https://github.com/your-org/your-repo"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  disabled={isConnected}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="branch">Branch</Label>
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-muted-foreground" />
                    <Input
                      id="branch"
                      placeholder="main"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      disabled={isConnected}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sync-interval">Sync Interval (minutes)</Label>
                  <Input
                    id="sync-interval"
                    type="number"
                    min="1"
                    max="60"
                    value={syncInterval}
                    onChange={(e) => setSyncInterval(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-between gap-4 rounded-md border p-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Connection Status</h3>
                  {isConnected ? (
                    <Badge variant="outline" className="bg-green-500/10 text-green-500">
                      <Check className="mr-1 h-3 w-3" />
                      Connected
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500">
                      Disconnected
                    </Badge>
                  )}
                </div>

                <div className="text-sm text-muted-foreground">
                  {isConnected
                    ? `Connected to ${gitProvider === "github" ? "GitHub" : gitProvider === "gitlab" ? "GitLab" : "Bitbucket"} repository. Syncing every ${syncInterval} minutes.`
                    : "Connect your Git repository to enable GitOps-based configuration management."}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {isConnected ? (
                  <>
                    <Button variant="outline" className="gap-1.5" onClick={handleDisconnect}>
                      Disconnect Repository
                    </Button>
                    <Button className="gap-1.5" onClick={handleTestSync} disabled={isSyncing}>
                      <RotateCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                      {isSyncing ? "Syncing..." : "Test Sync"}
                    </Button>

                    {isSyncing && (
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span>Syncing repository...</span>
                          <span>{syncProgress}%</span>
                        </div>
                        <Progress value={syncProgress} className="h-1" />
                      </div>
                    )}
                  </>
                ) : (
                  <Button className="gap-1.5" onClick={handleConnect} disabled={!repoUrl}>
                    <ArrowRight className="h-4 w-4" />
                    Connect Repository
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-blue-600/20 shadow-md shadow-blue-600/10">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Pipeline Templates</CardTitle>
          <CardDescription>Manage CI/CD pipeline templates for your applications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Tabs defaultValue="templates">
            <TabsList>
              <TabsTrigger value="templates">Prebuilt Templates</TabsTrigger>
              <TabsTrigger value="custom">Custom Template</TabsTrigger>
            </TabsList>

            <TabsContent value="templates" className="space-y-4 pt-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Card
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedTemplate === "security-scan-deploy" ? "ring-2 ring-primary" : ""
                  }`}
                  onClick={() => handleTemplateChange("security-scan-deploy")}
                >
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <h3 className="font-medium">Security Scan + Deploy</h3>
                      <p className="text-sm text-muted-foreground">
                        Scans for vulnerabilities before building and deploying
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">Security</Badge>
                        <Badge variant="outline">Deploy</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedTemplate === "build-test-deploy" ? "ring-2 ring-primary" : ""
                  }`}
                  onClick={() => handleTemplateChange("build-test-deploy")}
                >
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <h3 className="font-medium">Build + Test + Deploy</h3>
                      <p className="text-sm text-muted-foreground">Standard CI/CD pipeline with testing stage</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">Build</Badge>
                        <Badge variant="outline">Test</Badge>
                        <Badge variant="outline">Deploy</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedTemplate === "canary-deployment" ? "ring-2 ring-primary" : ""
                  }`}
                  onClick={() => handleTemplateChange("canary-deployment")}
                >
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <h3 className="font-medium">Canary Deployment</h3>
                      <p className="text-sm text-muted-foreground">Gradually rolls out changes to a subset of users</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">Canary</Badge>
                        <Badge variant="outline">Progressive</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="rounded-md border">
                <div className="flex items-center justify-between border-b p-4">
                  <h3 className="font-medium">Template Preview</h3>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                      <Copy className="h-3.5 w-3.5" />
                      Copy
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </Button>
                  </div>
                </div>
                <div className="h-[300px] overflow-auto p-0">
                  <Editor
                    height="300px"
                    defaultLanguage="yaml"
                    value={pipelineYaml}
                    options={{
                      readOnly: true,
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      fontSize: 14,
                      tabSize: 2,
                    }}
                    theme="vs-dark"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button className="gap-1.5">
                      <ArrowRight className="h-4 w-4" />
                      Use Template
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Apply Pipeline Template</DialogTitle>
                      <DialogDescription>
                        This will create a new pipeline using the selected template.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="pipeline-name">Pipeline Name</Label>
                        <Input id="pipeline-name" placeholder="my-app-pipeline" />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="pipeline-target">Target Application</Label>
                        <Select defaultValue="frontend">
                          <SelectTrigger id="pipeline-target">
                            <SelectValue placeholder="Select application" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="frontend">Frontend</SelectItem>
                            <SelectItem value="backend">Backend</SelectItem>
                            <SelectItem value="api">API Service</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <DialogFooter>
                      <Button variant="outline">Cancel</Button>
                      <Button>Create Pipeline</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </TabsContent>

            <TabsContent value="custom" className="space-y-4 pt-4">
              <div className="rounded-md border">
                <div className="flex items-center justify-between border-b p-4">
                  <h3 className="font-medium">Custom Pipeline Template</h3>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                      <Upload className="h-3.5 w-3.5" />
                      Import
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                      <Download className="h-3.5 w-3.5" />
                      Export
                    </Button>
                  </div>
                </div>
                <div className="h-[400px] overflow-auto p-0">
                  <Editor
                    height="400px"
                    defaultLanguage="yaml"
                    value={pipelineYaml}
                    onChange={handleEditorChange}
                    options={{
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      fontSize: 14,
                      tabSize: 2,
                    }}
                    theme="vs-dark"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" className="gap-1.5">
                  <RotateCw className="h-4 w-4" />
                  Reset
                </Button>
                <Button className="gap-1.5">
                  <Save className="h-4 w-4" />
                  Save Template
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
