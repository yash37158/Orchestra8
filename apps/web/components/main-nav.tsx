"use client"

import { Zap } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DeployDialog } from "@/components/deploy-dialog"
import { SecurityScan } from "@/components/security-scan"
import { cn } from "@/lib/utils"

export function MainNav({ className }: { className?: string }) {
  return (
    <nav className={cn("hidden items-center space-x-4 md:flex", className)}>
      <DeployDialog />
      <SecurityScan />

      {/* ponytail: still a placeholder. Left inert rather than wired to a
          simulation — a button that pretends to test resilience is worse than
          one that plainly does not work yet. */}
      <Button variant="ghost" size="sm" className="text-muted-foreground" disabled title="Not built yet">
        <Zap className="mr-2 h-4 w-4" />
        Resilience test
      </Button>
    </nav>
  )
}
