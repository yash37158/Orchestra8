"use client"

import { useState, useTransition } from "react"
import { Check, Link2, BellOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import { updateStatus } from "@/app/correlations/[id]/actions"

/**
 * The four exits from a correlation (PRD §4). Every one of them gets the
 * engineer out of the tool with the matter settled — for an incident product,
 * time in app is a cost, not engagement.
 */
export function CorrelationActions({ id, status }: { id: string; status: string }) {
  const [pending, startTransition] = useTransition()
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (next: "open" | "acknowledged" | "suppressed") =>
    startTransition(async () => {
      setError(null)
      try {
        await updateStatus(id, next)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not update status")
      }
    })

  // The window is already pinned in the URL, so a shared link shows the
  // recipient exactly what the sender saw rather than "the last 15 minutes".
  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError("Clipboard blocked. Copy the URL from the address bar.")
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {status === "open" ? (
          <Button size="sm" onClick={() => set("acknowledged")} disabled={pending}>
            <Check className="mr-2 h-4 w-4" />
            Acknowledge
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => set("open")} disabled={pending}>
            Reopen
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={share}>
          <Link2 className="mr-2 h-4 w-4" />
          {copied ? "Link copied" : "Share"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => set("suppressed")} disabled={pending || status === "suppressed"}>
          <BellOff className="mr-2 h-4 w-4" />
          Suppress
        </Button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {status !== "open" && (
        <p className="text-xs text-muted-foreground">
          Status is <span className="font-medium text-foreground">{status}</span>. The engine will keep this
          decision even while the condition persists.
        </p>
      )}
    </div>
  )
}
