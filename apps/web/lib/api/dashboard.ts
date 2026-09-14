import { DashboardResponse } from "@orchestr8/contracts"
import { API_URL, apiFetch, describeStatus, rethrowRedirect } from "@/lib/api/fetch"


export type DashboardResult =
  | { ok: true; data: DashboardResponse }
  | { ok: false; error: string }

/**
 * Fetches the dashboard from orchestr8-api and validates it against the
 * contract before any component sees it.
 *
 * The parse is not ceremony: it is the trust boundary. An API that starts
 * returning a string where a number belongs should fail here, loudly, with
 * the offending path — not three layers deep inside a chart library.
 */
export async function getDashboard(): Promise<DashboardResult> {
  try {
    const res = await apiFetch(`/v1/dashboard`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) {
      return { ok: false, error: `orchestr8-api returned ${res.status} ${res.statusText}` }
    }
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
    const parsed = DashboardResponse.safeParse(json)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return {
        ok: false,
        error: `Response violated the contract at "${first.path.join(".")}": ${first.message}`,
      }
    }
    return { ok: true, data: parsed.data }
  } catch (err) {
    rethrowRedirect(err)
    // Deliberately no mock fallback. Silently serving fake data when the
    // backend is down is the exact failure mode this refactor exists to end.
    return {
      ok: false,
      error: err instanceof Error ? `Cannot reach orchestr8-api at ${API_URL}: ${err.message}` : "Unknown error",
    }
  }
}
