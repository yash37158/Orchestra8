import { API_URL, apiFetch, describeStatus } from "@/lib/api/fetch"

export type PreflightCheck = {
  id: string
  name: string
  status: "pass" | "fail" | "warn" | "skipped"
  detail: string
  blocking: boolean
}

export type Preflight = {
  checks: PreflightCheck[]
  diff: string
  canApply: boolean
  blockers: number
}

export type Deployment = {
  id: string
  at: string
  app: string
  clusterId: string
  image: string
  replicas: number
  strategy: string
  branch: string
  commit: string
  diff: string
}

export type DeployInput = {
  app: string
  clusterId: string
  image: string
  replicas: number
  strategy: string
  approved?: boolean
}

async function post(path: string, body: unknown, actor: string) {
  const res = await apiFetch(`${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Orchestr8-Actor": actor },
    body: JSON.stringify(body),
    cache: "no-store",
  })
  return res
}

export async function runPreflight(input: DeployInput, actor: string): Promise<Preflight> {
  const res = await post("/v1/deployments/preflight", input, actor)
  if (!res.ok) throw new Error((await res.text()) || `preflight failed (${res.status})`)
  return res.json()
}

/**
 * Requests a deploy. A 412 is not an error condition — it is the preflight gate
 * doing its job, and it returns the reasons so the caller can fix them or
 * override deliberately.
 */
export async function requestDeploy(
  input: DeployInput,
  actor: string,
): Promise<{ ok: true; deployment: Deployment } | { ok: false; preflight: Preflight }> {
  const res = await post("/v1/deployments", input, actor)
  if (res.status === 412) return { ok: false, preflight: (await res.json()).preflight }
  if (!res.ok) throw new Error((await res.text()) || `deploy failed (${res.status})`)
  return { ok: true, deployment: await res.json() }
}
