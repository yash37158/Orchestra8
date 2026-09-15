"use server"

import { revalidatePath } from "next/cache"

import {
  getScanTargets,
  pollScan,
  startScan,
  type PollOutcome,
  type ScanInput,
  type StartOutcome,
} from "@/lib/api/scans"

export async function startScanAction(input: ScanInput): Promise<StartOutcome> {
  return startScan(input)
}

export async function pollScanAction(id: string): Promise<PollOutcome> {
  const result = await pollScan(id)
  // Revalidate once the scan has actually landed, so the stored history and
  // the ledger show it without a manual reload.
  if (result.ok && result.progress.status !== "running") {
    revalidatePath("/security")
    revalidatePath("/audit")
  }
  return result
}

export async function getScanTargetsAction() {
  return getScanTargets()
}
