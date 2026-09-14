import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { AcceptInvite } from "@/components/accept-invite"

export const dynamic = "force-dynamic"

const API_URL = process.env.ORCHESTR8_API_URL ?? "http://localhost:8088"

/**
 * Accepting an invitation.
 *
 * Reachable without an account, which is the whole point — the person holding
 * the link does not belong to the organisation yet. The token is the
 * credential: single-use, expiring, and bound to one address, all enforced by
 * the API when it is spent.
 *
 * The preview is deliberately thin. Anyone who ends up holding this link sees
 * it, so it carries the organisation's name and the role offered, and nothing
 * about its size, its people or its fleet.
 */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const res = await fetch(`${API_URL}/v1/invite/${encodeURIComponent(token)}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  }).catch(() => null)

  if (!res?.ok) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <h1 className="text-lg font-semibold tracking-tight">Invitation not valid</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            This link has expired, been used already, or been revoked. Ask whoever sent it for a
            new one.
          </p>
          <a href="/signin" className="mt-5 inline-block text-sm text-primary hover:underline">
            Go to sign in
          </a>
        </div>
      </main>
    )
  }

  const invite = (await res.json()) as { org: string; name: string; email: string; role: string }
  const session = await auth()

  // Already a member of the organisation being offered: nothing to accept.
  if (session?.user?.org === invite.org) redirect("/dashboard")

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-7">
          <h1 className="text-lg font-semibold tracking-tight">
            Join {invite.name}
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            You have been invited as <span className="text-foreground">{invite.role}</span>, at{" "}
            <span className="font-mono text-foreground">{invite.email}</span>.
          </p>
        </div>

        <AcceptInvite
          token={token}
          invitedEmail={invite.email}
          signedInAs={session?.user?.email ?? null}
          alreadyElsewhere={!!session?.user?.org}
        />

        <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
          This invitation only works for {invite.email}. Signing in with a different account will
          be refused, so forwarding the link does not pass on the access.
        </p>
      </div>
    </main>
  )
}
