"use server"

import { apiFetch, describeStatus } from "@/lib/api/fetch"

/**
 * Onboarding, as server actions rather than browser fetches.
 *
 * These used to run in the browser against NEXT_PUBLIC_ORCHESTR8_API_URL,
 * which put the API's address in the page and made the call cross-origin — so
 * the session cookie would only arrive if the app and the API happened to
 * share a site, and silently not otherwise. Running them on the server means
 * the cookie is forwarded the same way every other read forwards it, and the
 * API's address stays server-side. The rest of the app already worked this way.
 */

export type ConnectResponse = {
  clusterId: string
  namespace: string
  endpoint: string
  token: string
  command: string
  chartLocal: string
}

export type ComponentStatus = {
  id: string
  name: string
  state: "waiting" | "ok" | "partial"
  detail: string
  hint?: string
  observed: number
}

export type FirstSignal = {
  nodeName: string
  gpuUuid: string
  model: string
  tempC: number
}

export type OnboardingStatus = {
  clusterId: string
  connected: boolean
  components: ComponentStatus[]
  firstSignal: FirstSignal | null
  checkedAt: string
}

export async function connectCluster(clusterId: string, namespace: string): Promise<ConnectResponse> {
  const res = await apiFetch(`/v1/onboarding/connect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clusterId, namespace }),
  })
  if (!res.ok) throw new Error((await res.text()) || describeStatus(res.status, res.statusText))
  return res.json()
}

export async function onboardingStatus(clusterId: string): Promise<OnboardingStatus> {
  const res = await apiFetch(`/v1/onboarding/status?clusterId=${encodeURIComponent(clusterId)}`)
  if (!res.ok) throw new Error(describeStatus(res.status, res.statusText))
  return res.json()
}

/**
 * Sets a p95 TTFT target. Omitting `model` sets the default that every
 * unlisted model inherits — which is what onboarding wants, since it runs
 * before any inference service has been observed.
 */
export async function setSLO(ttftP95Ms: number, model?: string): Promise<void> {
  const res = await apiFetch(`/v1/slos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: model ?? "", ttftP95Ms, note: model ? "Set during onboarding" : "" }),
  })
  if (!res.ok) throw new Error((await res.text()) || describeStatus(res.status, res.statusText))
}
