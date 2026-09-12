import { z } from "zod"
import { ScansResponse, ScanFinding, InferenceResponse, ConfigResponse } from "@orchestr8/contracts"

const API_URL = process.env.ORCHESTR8_API_URL ?? "http://localhost:8088"

export type Result<T> = { ok: true; data: T } | { ok: false; error: string }

async function get<T>(path: string, schema: z.ZodType<T>): Promise<Result<T>> {
  try {
    const res = await fetch(`${API_URL}${path}`, { cache: "no-store", signal: AbortSignal.timeout(8000) })
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
