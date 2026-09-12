"use server"

import { revalidatePath } from "next/cache"
import { runPreflight, requestDeploy, type DeployInput, type Preflight, type Deployment } from "@/lib/api/deploy"

// Placeholder identity. Named so it is obvious this is not authentication and
// must be replaced before the audit log is relied on for anything.
const ACTOR = "operator@local"

export async function preflightAction(input: DeployInput): Promise<Preflight> {
  return runPreflight(input, ACTOR)
}

export async function deployAction(
  input: DeployInput,
): Promise<{ ok: true; deployment: Deployment } | { ok: false; preflight: Preflight }> {
  const result = await requestDeploy(input, ACTOR)
  if (result.ok) {
    revalidatePath("/audit")
    revalidatePath("/dashboard")
  }
  return result
}
