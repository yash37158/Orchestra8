import {
  ScanProgress,
  ScanStart,
  ScanTargetsResponse,
  type ScanTarget,
} from "@orchestr8/contracts"

import { apiFetch, describeStatus, rethrowRedirect } from "./fetch"

export type ScanInput = { target: string; kind: "filesystem" | "image" }

export type StartOutcome = { ok: true; id: string } | { ok: false; error: string }
export type PollOutcome =
  | { ok: true; progress: ScanProgress }
  | { ok: false; error: string; gone?: boolean }

/**
 * Asks the API to start a scan. Returns as soon as it has an id.
 *
 * Nothing here waits for Trivy. A model's container image is measured in
 * gigabytes and has to be pulled in full before it can be read, which takes
 * minutes — longer than a browser, a proxy or a load balancer will hold a
 * request open, and the caller who waited used to get nothing for it.
 */
export async function startScan(input: ScanInput): Promise<StartOutcome> {
  try {
    const res = await apiFetch("/v1/scans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
    if (!res.ok) {
      const detail = (await res.text()).trim()
      return { ok: false, error: detail || describeStatus(res.status, res.statusText) }
    }
    const parsed = ScanStart.safeParse(await res.json())
    if (!parsed.success) return { ok: false, error: "The API accepted the scan but did not return an id." }
    return { ok: true, id: parsed.data.id }
  } catch (err) {
    rethrowRedirect(err)
    return {
      ok: false,
      error: err instanceof Error ? `Cannot reach orchestr8-api: ${err.message}` : "Unknown error",
    }
  }
}

/** One poll. `gone` means the scan is neither running nor stored. */
export async function pollScan(id: string): Promise<PollOutcome> {
  try {
    const res = await apiFetch(`/v1/scans/${encodeURIComponent(id)}`)
    if (res.status === 404) {
      return { ok: false, gone: true, error: (await res.text()).trim() }
    }
    if (!res.ok) return { ok: false, error: describeStatus(res.status, res.statusText) }
    const parsed = ScanProgress.safeParse(await res.json())
    if (!parsed.success) return { ok: false, error: "The API returned a scan in an unexpected shape." }
    return { ok: true, progress: parsed.data }
  } catch (err) {
    rethrowRedirect(err)
    return {
      ok: false,
      error: err instanceof Error ? `Cannot reach orchestr8-api: ${err.message}` : "Unknown error",
    }
  }
}

export type TargetsOutcome = { ok: true; targets: ScanTarget[] } | { ok: false; error: string }

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
