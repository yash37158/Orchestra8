import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { WelcomeForm } from "@/components/welcome-form"
import { slugFromEmail } from "@/lib/auth/org"

export const dynamic = "force-dynamic"

/**
 * The one-time step between authenticating and having somewhere to put data.
 *
 * Only reachable by someone signed in who belongs to no organisation. Anyone
 * who already has one is sent on, so a bookmark to this page cannot be used to
 * collect a second.
 */
export default async function WelcomePage() {
  const session = await auth()
  if (!session?.user) redirect("/signin")
  if (session.user.org) redirect("/dashboard")

  const email = session.user.email ?? ""
  const domain = email.split("@")[1] ?? ""
  // Suggested, not imposed: most people signing in with a work address are
  // registering the company that address belongs to.
  const suggestedName = domain ? domain.split(".")[0].replace(/^./, (c) => c.toUpperCase()) : ""
  const suggestedSlug = slugFromEmail(email || null)

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-7">
          <h1 className="text-lg font-semibold tracking-tight">Set up your organisation</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Signed in as <span className="text-foreground">{email}</span>. One step, once — this is
            where your clusters, costs and incidents live, and nobody outside it can see them.
          </p>
        </div>

        <WelcomeForm suggestedName={suggestedName} suggestedSlug={suggestedSlug} />

        <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
          You will be the owner. Teammates join by invitation, and your telemetry never leaves this
          organisation.
        </p>
      </div>
    </main>
  )
}
