"use server"

import { revalidatePath } from "next/cache"

import { runScan, type ScanInput, type ScanOutcome } from "@/lib/api/scans"

export async function runScanAction(input: ScanInput): Promise<ScanOutcome> {
  const result = await runScan(input)
  if (result.ok) {
    // The API stores every run, failures included. Revalidating is what makes
    // the stored history show up without a manual reload.
    revalidatePath("/security")
    revalidatePath("/audit")
  }
  return result
}
