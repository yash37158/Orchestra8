import { z } from "zod"
import { API_URL, apiFetch, describeStatus, rethrowRedirect } from "@/lib/api/fetch"


export const AuditEntry = z.object({
  seq: z.number(),
  at: z.string(),
  actor: z.string(),
  action: z.string(),
  subject: z.string(),
  clusterId: z.string(),
  outcome: z.string(),
  detail: z.record(z.unknown()).nullable(),
  prevHash: z.string(),
  hash: z.string(),
})
export type AuditEntry = z.infer<typeof AuditEntry>

const Verification = z.object({
  entries: z.number(),
  intact: z.boolean(),
  brokenAt: z.number().optional(),
  reason: z.string().optional(),
})
export type Verification = z.infer<typeof Verification>

export type AuditView = { entries: AuditEntry[]; verification: Verification | null; error: string | null }

export async function getAudit(): Promise<AuditView> {
  try {
    const [listRes, verifyRes] = await Promise.all([
      apiFetch(`/v1/audit?limit=100`, { cache: "no-store", signal: AbortSignal.timeout(5000) }),
      apiFetch(`/v1/audit/verify`, { cache: "no-store", signal: AbortSignal.timeout(5000) }),
    ])
    if (!listRes.ok) return { entries: [], verification: null, error: `orchestr8-api returned ${listRes.status}` }
    const list = z.object({ entries: z.array(AuditEntry).nullable() }).parse(await listRes.json())
    const verification = verifyRes.ok ? Verification.parse(await verifyRes.json()) : null
    return { entries: list.entries ?? [], verification, error: null }
  } catch (e) {
    rethrowRedirect(e)
    return { entries: [], verification: null, error: e instanceof Error ? e.message : "Unknown error" }
  }
}
