import { ClustersResponse } from "@orchestr8/contracts"

const API_URL = process.env.ORCHESTR8_API_URL ?? "http://localhost:8088"

export type ClustersResult =
  | { ok: true; data: ClustersResponse }
  | { ok: false; error: string }

export async function getClusters(): Promise<ClustersResult> {
  try {
    const res = await fetch(`${API_URL}/v1/clusters`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    })
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
    const parsed = ClustersResponse.safeParse(json)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return { ok: false, error: `Response violated the contract at "${first.path.join(".")}": ${first.message}` }
    }
    return { ok: true, data: parsed.data }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? `Cannot reach orchestr8-api at ${API_URL}: ${err.message}` : "Unknown error",
    }
  }
}
