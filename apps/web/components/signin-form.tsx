"use client"

import { useActionState } from "react"

import { createFirstAccount, signInWithPassword } from "@/app/signin/actions"

const field =
  "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/30"

function Submit({ label }: { label: string }) {
  return (
    <button
      type="submit"
      className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {label}
    </button>
  )
}

function Error({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p className="rounded-md border border-crit/30 bg-crit/5 px-3 py-2 text-[13px] leading-relaxed">
      {message}
    </p>
  )
}

export function PasswordForm() {
  const [state, action] = useActionState(signInWithPassword, null as { error?: string } | null)
  return (
    <form action={action} className="space-y-2.5">
      <Error message={state?.error} />
      <input name="email" type="email" required autoComplete="username" placeholder="you@company.com" className={field} />
      <input name="password" type="password" required autoComplete="current-password" placeholder="Password" className={field} />
      <Submit label="Sign in" />
    </form>
  )
}

/**
 * Shown only while nobody has claimed the deployment. The setup token comes
 * from the cluster, not from the page — otherwise whoever reaches a fresh
 * install first becomes its owner.
 */
export function BootstrapForm() {
  const [state, action] = useActionState(createFirstAccount, null as { error?: string } | null)
  return (
    <form action={action} className="space-y-2.5">
      <Error message={state?.error} />
      <input name="email" type="email" required autoComplete="username" placeholder="you@company.com" className={field} />
      <input name="password" type="password" required autoComplete="new-password" placeholder="Password (12 characters or more)" className={field} />
      <input name="confirm" type="password" required autoComplete="new-password" placeholder="Confirm password" className={field} />
      <input name="token" type="password" required placeholder="Setup token" className={`${field} font-mono`} />
      <Submit label="Create owner account" />
    </form>
  )
}
