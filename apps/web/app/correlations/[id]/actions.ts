"use server"

import { revalidatePath } from "next/cache"
import { setCorrelationStatus } from "@/lib/api/correlations"

/**
 * Records a human decision about a correlation. A user's judgement outranks
 * the engine's: once acknowledged or suppressed, re-detecting the same
 * condition must not flip it back to open and re-page them.
 */
export async function updateStatus(id: string, status: "open" | "acknowledged" | "suppressed") {
  await setCorrelationStatus(id, status)
  revalidatePath(`/correlations/${id}`)
  revalidatePath("/dashboard")
}
