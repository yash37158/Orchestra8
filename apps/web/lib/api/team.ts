import { apiFetch, describeStatus, rethrowRedirect } from "@/lib/api/fetch"

/**
 * Team membership. The API owns this rather than the web app, because it is
 * where the session middleware has already established who is asking and with
 * what authority, and where the audit ledger is.
 */

export type Member = { email: string; name: string; role: string; joinedAt: string }
export type Invitation = {
  id: string
  email: string
  role: string
  prefix: string
  invitedBy: string
  createdAt: string
  expiresAt: string
  state: "pending" | "accepted" | "revoked" | "expired"
}
export type Team = {
  members: Member[]
  invitations: Invitation[]
  role: string
  /** Roles this caller may grant. Empty means they may not invite at all. */
  canInvite: string[]
}

export type TeamResult = { ok: true; data: Team } | { ok: false; error: string }

export async function getTeam(): Promise<TeamResult> {
  try {
    const res = await apiFetch("/v1/team")
    if (!res.ok) return { ok: false, error: describeStatus(res.status, res.statusText) }
    return { ok: true, data: (await res.json()) as Team }
  } catch (err) {
    rethrowRedirect(err)
    return { ok: false, error: err instanceof Error ? err.message : "Could not reach orchestr8-api" }
  }
}
