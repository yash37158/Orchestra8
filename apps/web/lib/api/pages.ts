import { z } from "zod"
import { ScansResponse, ScanFinding, InferenceResponse, ConfigResponse, SeriesResponse, type SeriesPoint } from "@orchestr8/contracts"
import { API_URL, apiFetch, describeStatus } from "@/lib/api/fetch"


export type Result<T> = { ok: true; data: T } | { ok: false; error: string }

async function get<T>(path: string, schema: z.ZodType<T>): Promise<Result<T>> {
  try {
    const res = await apiFetch(`${path}`, { cache: "no-store", signal: AbortSignal.timeout(8000) })
    if (!res.ok) return { ok: false, error: `orchestr8-api returned ${res.status} ${res.statusText}` }
    const body = await res.text()
    let json: unknown
    try {
      json = JSON.parse(body)
    } catch {
      return {
        ok: false,
        error: body.trim() === ""
          ? "orchestr8-api returned an empty response"
          : `orchestr8-api returned something that is not JSON: ${body.slice(0, 120)}`,
      }
    }
    const parsed = schema.safeParse(json)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return { ok: false, error: `Response violated the contract at "${first.path.join(".")}": ${first.message}` }
    }
    return { ok: true, data: parsed.data }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? `Cannot reach orchestr8-api: ${err.message}` : "Unknown error" }
  }
}

export const getScans = () => get("/v1/scans?limit=25", ScansResponse)
export const getInference = () => get("/v1/inference", InferenceResponse)
export const getConfig = () => get("/v1/config", ConfigResponse)
export const getScanFindings = (id: string) =>
  get(`/v1/scans/${encodeURIComponent(id)}`, z.object({ id: z.string(), findings: z.array(ScanFinding).nullable() }))

/**
 * One metric over a window. `subject` selects a GPU UUID or a model name and
 * `cluster` narrows it further; omitting both averages across the whole fleet,
 * which is what the overview KPIs want. Without `cluster`, a model served in
 * two places returns one blended line — right for a KPI, wrong for a row.
 *
 * Failure returns an empty series rather than an error: a missing sparkline
 * should not take down a page whose numbers are all still correct.
 */
export async function getSeries(metric: string, subject: string, cluster = "", hours = 1): Promise<SeriesPoint[]> {
  const to = new Date()
  const from = new Date(to.getTime() - hours * 3600_000)
  const q = new URLSearchParams({ metric, subject, cluster, from: from.toISOString(), to: to.toISOString() })
  const r = await get(`/v1/series?${q}`, SeriesResponse)
  return r.ok ? (r.data.points ?? []) : []
}
