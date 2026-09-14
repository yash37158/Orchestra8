"use server"

import { redirect } from "next/navigation"
import { Pool } from "pg"

import { auth } from "@/auth"
import { registerOrg } from "@/lib/auth/org"

const pool = new Pool({
  connectionString: process.env.ORCHESTR8_CONTROL_DSN ?? "postgres://localhost:5432/orchestr8",
  max: 3,
})

export async function createOrganisation(_prev: unknown, form: FormData) {
  // The user comes from the session, never from the form. A hidden field here
  // would let anyone make themselves the owner of an organisation by editing
  // the page they were served.
  const session = await auth()
  if (!session?.user?.id) redirect("/signin")

  const result = await registerOrg(
    pool,
    session.user.id,
    String(form.get("name") ?? ""),
    String(form.get("slug") ?? ""),
  )
  if (!result.ok) return { error: result.error }

  // Straight into connecting a cluster: an organisation with no telemetry is
  // an empty product, and the next step is the only one that changes that.
  redirect("/onboarding")
}
