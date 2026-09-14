"use client"

import { useActionState } from "react"

import { acceptInvitation } from "@/app/invite/actions"

export function AcceptInvite({
  token,
  invitedEmail,
  signedInAs,
  alreadyElsewhere,
}: {
  token: string
  invitedEmail: string
  signedInAs: string | null
  alreadyElsewhere: boolean
}) {
  const [state, action] = useActionState(acceptInvitation, null as { error?: string } | null)

  // Not signed in: they have to authenticate first, because the API takes who
  // is accepting from the session and never from the page.
  if (!signedInAs) {
    return (
      <>
        <a
          href={`/signin?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`}
          className="block w-full rounded-md bg-primary px-4 py-2.5 text-center text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Sign in to accept
        </a>
        <p className="mt-3 text-xs text-muted-foreground">
          Sign in as {invitedEmail}. You will come straight back here.
        </p>
      </>
    )
  }

  const wrongAccount = signedInAs.toLowerCase() !== invitedEmail.toLowerCase()

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      {state?.error && (
        <p className="rounded-md border border-crit/30 bg-crit/5 px-3 py-2 text-[13px] leading-relaxed">
          {state.error}
        </p>
      )}

      {wrongAccount ? (
        /* Said here rather than after a failed attempt: the API will refuse
           this, and finding that out by clicking is a worse way to learn it. */
        <div className="rounded-md border border-warn/30 bg-warn/5 px-3 py-2.5 text-[13px] leading-relaxed">
          You are signed in as <span className="font-mono">{signedInAs}</span>, but this invitation
          was issued to <span className="font-mono">{invitedEmail}</span>. Sign out and sign back in
          with that address.
        </div>
      ) : alreadyElsewhere ? (
        <div className="rounded-md border border-warn/30 bg-warn/5 px-3 py-2.5 text-[13px] leading-relaxed">
          This account already belongs to another organisation. An account can only be in one for
          now, so this invitation cannot be accepted with it.
        </div>
      ) : (
        <button
          type="submit"
          className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Accept invitation
        </button>
      )}
    </form>
  )
}
