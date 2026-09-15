import { ScanRun, ScanTargetsResponse, type ScanTarget } from "@orchestr8/contracts"

import { apiFetch, describeStatus, rethrowRedirect } from "./fetch"

export type ScanInput = { target: string; kind: "filesystem" | "image" }
export type ScanOutcome = { ok: true; run: ScanRun } | { ok: false; error: string }

/**
 * A real Trivy run takes ~20s for a lockfile and minutes for a container image
 * it has to pull. apiFetch's 8s default would abort the request while the API
 * carried on scanning, storing a result the caller never saw. The API caps
 * Trivy at 4 minutes, so waiting slightly past that is what lets the timeout
 * come back as a real error instead of a severed connection.
 */
const SCAN_TIMEOUT_MS = 4 * 60_000 + 15_000

export async function runScan(input: ScanInput): Promise<ScanOutcome> {
  try {
    const res = await apiFetch("/v1/scans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(SCAN_TIMEOUT_MS),
    })
    if (!res.ok) {
      // The API sends a plain-text reason on 4xx (an empty target, a bad
      // kind). Preferred over the status line, which says nothing actionable.
      const detail = (await res.text()).trim()
      return { ok: false, error: detail || describeStatus(res.status, res.statusText) }
    }
    const parsed = ScanRun.safeParse(await res.json())
    if (!parsed.success) return { ok: false, error: "The API returned a scan in an unexpected shape." }
    return { ok: true, run: parsed.data }
  } catch (err) {
    rethrowRedirect(err)
    if (err instanceof Error && err.name === "TimeoutError") {
      return {
        ok: false,
        error: "The scan ran past four minutes and was cut off. Large container images can exceed it.",
      }
    }
    return {
      ok: false,
      error: err instanceof Error ? `Cannot reach orchestr8-api: ${err.message}` : "Unknown error",
    }
  }
}

export type TargetsOutcome =
  | { ok: true; targets: ScanTarget[] }
  | { ok: false; error: string }

/** Images this organisation has deployed — the list of things worth scanning. */
export async function getScanTargets(): Promise<TargetsOutcome> {
  try {
    const res = await apiFetch("/v1/scan-targets")
    if (!res.ok) return { ok: false, error: describeStatus(res.status, res.statusText) }
    const parsed = ScanTargetsResponse.safeParse(await res.json())
    if (!parsed.success) return { ok: false, error: "The API returned targets in an unexpected shape." }
    return { ok: true, targets: parsed.data.targets }
  } catch (err) {
    rethrowRedirect(err)
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" }
  }
}
