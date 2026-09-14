"use client"

import { useActionState, useState } from "react"
import { Check, Copy, X } from "lucide-react"

import { inviteTeammate, revokeInvitation } from "@/app/settings/team-actions"
import type { Team } from "@/lib/api/team"

const ROLE_MEANS: Record<string, string> = {
  owner: "Members, billing, everything below",
  admin: "Override a blocked deploy, edit SLOs and tokens",
  operator: "Deploy, scan, acknowledge incidents",
  viewer: "Read only",
}

const STATE_TONE: Record<string, string> = {
  pending: "text-warn",
  accepted: "text-ok",
  revoked: "text-muted-foreground",
  expired: "text-muted-foreground",
}

function InviteLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="mt-3 rounded-md border border-ok/30 bg-ok/5 px-3 py-2.5">
      <p className="text-[13px]">Invitation created. Send them this link — it is shown once.</p>
      <div className="mt-2 flex items-center gap-2">
        <code className="flex-1 overflow-x-auto whitespace-nowrap rounded bg-muted px-2 py-1.5 font-mono text-[11px]">
          {link}
        </code>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link)
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            } catch {
              /* clipboard blocked; the link is on screen to select by hand */
            }
          }}
          className="shrink-0 rounded-md border px-2.5 py-1.5 text-xs transition-colors hover:border-foreground/20"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-ok" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Expires in 7 days, works once, and only for the address it was issued to — a forwarded
        link will not let anyone else in.
      </p>
    </div>
  )
}

export function TeamPanel({ team }: { team: Team }) {
  const [state, action] = useActionState(
    inviteTeammate,
    null as { error?: string; link?: string; email?: string } | null,
  )
  const mayInvite = team.canInvite.length > 0
  const pending = team.invitations.filter((i) => i.state === "pending")

  return (
    <div className="space-y-5">
      <div className="rounded-md border bg-card">
        <div className="flex items-baseline justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold tracking-tight">Team</h2>
          <span className="text-xs text-muted-foreground">
            {team.members.length} member{team.members.length === 1 ? "" : "s"}
          </span>
        </div>
        <table className="w-full text-[13px]">
          <tbody>
            {team.members.map((m) => (
              <tr key={m.email} className="border-b border-border/50 last:border-0">
                <td className="px-4 py-2.5">
                  <div className="font-mono text-xs">{m.email}</div>
                  {m.name && <div className="text-[11px] text-muted-foreground">{m.name}</div>}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <span className="text-xs">{m.role}</span>
                  <div className="text-[11px] text-muted-foreground">{ROLE_MEANS[m.role]}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pending.length > 0 && (
        <div className="rounded-md border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold tracking-tight">Pending invitations</h2>
          </div>
          <table className="w-full text-[13px]">
            <tbody>
              {pending.map((i) => (
                <tr key={i.id} className="border-b border-border/50 last:border-0">
                  <td className="px-4 py-2.5">
                    <div className="font-mono text-xs">{i.email}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {i.role} · invited by {i.invitedBy || "unknown"} · expires{" "}
                      {new Date(i.expiresAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={`text-[11px] ${STATE_TONE[i.state]}`}>{i.state}</span>
                    {mayInvite && (
                      <form action={revokeInvitation.bind(null, i.id)} className="mt-1 inline-block">
                        <button
                          type="submit"
                          className="flex items-center gap-1 rounded border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-crit/40 hover:text-crit"
                        >
                          <X className="h-3 w-3" /> revoke
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-md border bg-card px-4 py-3.5">
        <h2 className="text-sm font-semibold tracking-tight">Invite someone</h2>
        {!mayInvite ? (
          /* The API would refuse this caller, so the form is not offered.
             Showing a control that always fails is worse than not showing it. */
          <p className="mt-1.5 text-xs text-muted-foreground">
            Your role ({team.role}) cannot invite people. Ask an owner or admin.
          </p>
        ) : (
          <>
            <p className="mt-1 text-xs text-muted-foreground">
              They get a link. Sending it is up to you — there is no mail server here.
            </p>
            <form action={action} className="mt-3 flex flex-wrap items-start gap-2">
              <input
                name="email"
                type="email"
                required
                placeholder="colleague@company.com"
                className="min-w-[200px] flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/30"
              />
              <select
                name="role"
                defaultValue={team.canInvite[team.canInvite.length - 1]}
                className="rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/30"
              >
                {team.canInvite.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Create invitation
              </button>
            </form>
            {/* Owner is absent from the list on purpose: ownership is a
                transfer, not something to hand over by pasting a link. */}
            {state?.error && (
              <p className="mt-3 rounded-md border border-crit/30 bg-crit/5 px-3 py-2 text-[13px]">
                {state.error}
              </p>
            )}
            {state?.link && <InviteLink link={state.link} />}
          </>
        )}
      </div>
    </div>
  )
}
