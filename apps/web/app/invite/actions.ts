"use server"

import { redirect } from "next/navigation"

import { apiFetch } from "@/lib/api/fetch"

/**
 * Spends the invitation.
 *
 * Only the token is sent. Who is accepting comes from the session cookie the
 * API reads for itself — passing an identity from here would mean the API
 * trusting its caller to say who they are, which is exactly what makes an
 * unauthenticated endpoint dangerous.
 */
export async function acceptInvitation(_prev: unknown, form: FormData) {
  const token = String(form.get("token") ?? "")
  if (!token) return { error: "Missing invitation token." }

  const res = await apiFetch("/v1/invite-accept", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  })
  if (!res.ok) return { error: (await res.text()).trim() || "Could not accept the invitation." }

  redirect("/dashboard")
}
