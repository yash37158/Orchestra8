"use server"

import { revalidatePath } from "next/cache"

import { apiFetch } from "@/lib/api/fetch"

/**
 * The link is returned once, by the API, and never stored. A lost invitation
 * is re-issued rather than recovered — which is the same rule as ingest
 * tokens, and for the same reason.
 */
export async function inviteTeammate(_prev: unknown, form: FormData) {
  const email = String(form.get("email") ?? "").trim()
  const role = String(form.get("role") ?? "viewer")
  if (!email) return { error: "Enter an email address." }

  const res = await apiFetch("/v1/invitations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, role }),
  })
  const body = await res.text()
  if (!res.ok) return { error: body.trim() || "Could not create the invitation." }

  revalidatePath("/settings")
  return { link: (JSON.parse(body) as { link: string }).link, email, role }
}

/**
 * Returns nothing, because a <form action> must.
 *
 * The page is revalidated either way and the list re-renders from the API, so
 * the outcome is visible in the row itself: a revoked invitation disappears
 * from pending, and one that was accepted a second before this click shows as
 * accepted. That is truer feedback than a toast asserting what happened.
 */
export async function revokeInvitation(id: string): Promise<void> {
  const res = await apiFetch(`/v1/invitations/${encodeURIComponent(id)}/revoke`, { method: "POST" })
  if (!res.ok) console.error("revoke invitation:", res.status, (await res.text()).trim())
  revalidatePath("/settings")
}
