const API_URL = process.env.NEXT_PUBLIC_ORCHESTR8_API_URL ?? "http://localhost:8088"

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
  const res = await fetch(`${API_URL}/v1/onboarding/connect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clusterId, namespace }),
  })
  if (!res.ok) throw new Error((await res.text()) || "Could not start onboarding")
  return res.json()
}

export async function onboardingStatus(clusterId: string): Promise<OnboardingStatus> {
  const res = await fetch(`${API_URL}/v1/onboarding/status?clusterId=${encodeURIComponent(clusterId)}`, {
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`status check failed (${res.status})`)
  return res.json()
}

export async function setSLO(model: string, ttftP95Ms: number): Promise<void> {
  const res = await fetch(`${API_URL}/v1/slos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, ttftP95Ms, note: "Set during onboarding" }),
  })
  if (!res.ok) throw new Error((await res.text()) || "Could not save the target")
}
