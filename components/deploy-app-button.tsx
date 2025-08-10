"use client"

import { useState } from "react"
import { Check, Loader2 } from "lucide-react"
import { useForm } from "react-hook-form"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"

interface DeployFormValues {
  environment: string
  version: string
  canaryDeployment: boolean
  autoRollback: boolean
}

export function DeployAppButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [isDeploying, setIsDeploying] = useState(false)
  const { toast } = useToast()

  const form = useForm<DeployFormValues>({
    defaultValues: {
      environment: "",
      version: "",
      canaryDeployment: false,
      autoRollback: true,
    },
  })

  const handleDeploy = async (values: DeployFormValues) => {
    setIsDeploying(true)

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Random success/failure for demo purposes
      const isSuccess = Math.random() > 0.3

      if (isSuccess) {
        toast({
          title: `Deployment initiated to ${values.environment} 🎉`,
          description: `Version ${values.version} is being deployed.`,
          variant: "success",
        })
        setIsOpen(false)
      } else {
        throw new Error("Image pull failed")
      }
    } catch (error) {
      toast({
        title: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        description: "Check your configuration and try again.",
        variant: "destructive",
        action: (
          <Button variant="outline" size="sm" onClick={() => handleDeploy(values)}>
            Retry
          </Button>
        ),
      })
    } finally {
      setIsDeploying(false)
    }
  }

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className="bg-blue-600 hover:bg-blue-700 text-white"
        disabled={isDeploying}
      >
        {isDeploying ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Deploying...
          </>
        ) : (
          <>
            <span className="mr-2" role="img" aria-label="rocket">
              🚀
            </span>
            Deploy App
          </>
        )}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Deploy Application</DialogTitle>
            <DialogDescription>Configure your deployment settings below.</DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(handleDeploy)} className="space-y-6 py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="environment">Environment</Label>
                <Select
                  onValueChange={(value) => form.setValue("environment", value)}
                  defaultValue={form.getValues("environment")}
                >
                  <SelectTrigger id="environment" className="w-full">
                    <SelectValue placeholder="Select environment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aws-prod">AWS Production</SelectItem>
                    <SelectItem value="aws-staging">AWS Staging</SelectItem>
                    <SelectItem value="gcp-prod">GCP Production</SelectItem>
                    <SelectItem value="gcp-staging">GCP Staging</SelectItem>
                    <SelectItem value="edge-network">Edge Network</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="version">Version</Label>
                <Select
                  onValueChange={(value) => form.setValue("version", value)}
                  defaultValue={form.getValues("version")}
                >
                  <SelectTrigger id="version" className="w-full">
                    <SelectValue placeholder="Select version" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="v1.0.0">v1.0.0 (latest)</SelectItem>
                    <SelectItem value="v0.9.5">v0.9.5</SelectItem>
                    <SelectItem value="v0.9.0">v0.9.0</SelectItem>
                    <SelectItem value="main">main (branch)</SelectItem>
                    <SelectItem value="develop">develop (branch)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-4 border-t">
                <h4 className="text-sm font-medium mb-3">Advanced Options</h4>

                <div className="flex items-center justify-between mb-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="canary-deployment">Enable Canary Deployment</Label>
                    <p className="text-sm text-muted-foreground">Gradually roll out to a subset of users</p>
                  </div>
                  <Switch
                    id="canary-deployment"
                    checked={form.watch("canaryDeployment")}
                    onCheckedChange={(checked) => form.setValue("canaryDeployment", checked)}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="auto-rollback"
                    checked={form.watch("autoRollback")}
                    onCheckedChange={(checked) => {
                      if (typeof checked === "boolean") {
                        form.setValue("autoRollback", checked)
                      }
                    }}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <Label htmlFor="auto-rollback">Auto-Rollback on Failure</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically revert to previous version if deployment fails
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-emerald-500 hover:bg-emerald-600" disabled={isDeploying}>
                {isDeploying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deploying...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Confirm Deployment
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
