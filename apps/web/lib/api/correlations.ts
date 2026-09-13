import { Correlation } from "@orchestr8/contracts"
import { z } from "zod"
import { API_URL, apiFetch, describeStatus } from "@/lib/api/fetch"


const SeriesResponse = z.object({
  metric: z.string(),
  subject: z.string(),
  from: z.string(),
  to: z.string(),
  points: z.array(z.object({ t: z.string(), v: z.number() })).nullable(),
})
export type Series = z.infer<typeof SeriesResponse>

export type Result<T> = { ok: true; data: T } | { ok: false; error: string }

async function get<T>(path: string, schema: z.ZodType<T>): Promise<Result<T>> {
  try {
    const res = await apiFetch(`${path}`, { cache: "no-store", signal: AbortSignal.timeout(5000) })
    if (res.status === 404) return { ok: false, error: "not-found" }
    if (!res.ok) return { ok: false, error: `orchestr8-api returned ${res.status}` }
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

export const getCorrelation = (id: string) =>
  get(`/v1/correlations/${encodeURIComponent(id)}`, Correlation)

export const getCorrelations = () =>
  get("/v1/correlations", z.object({ correlations: z.array(Correlation) }))

/**
 * Fetches the metric behind one piece of evidence, over the window the engine
 * examined — not a window relative to when this page happens to load.
 */
export const getSeries = (metric: string, subject: string, from: string, to: string) =>
  get(
    `/v1/series?metric=${encodeURIComponent(metric)}&subject=${encodeURIComponent(subject)}` +
      `&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    SeriesResponse,
  )

export async function setCorrelationStatus(id: string, status: "open" | "acknowledged" | "suppressed") {
  const res = await apiFetch(`/v1/correlations/${encodeURIComponent(id)}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`Could not update status: ${res.status} ${await res.text()}`)
}
