"use client"

import { useActionState, useState } from "react"

import { createOrganisation } from "@/app/welcome/actions"

const field =
  "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/30"

/** Mirrors the CHECK constraint on organizations.slug, so the form rejects what the database would. */
function toSlug(v: string) {
  return v.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40)
}

export function WelcomeForm({ suggestedName, suggestedSlug }: { suggestedName: string; suggestedSlug: string }) {
  const [state, action] = useActionState(createOrganisation, null as { error?: string } | null)
  const [name, setName] = useState(suggestedName)
  // Typed once, then left alone: a slug that keeps rewriting itself while
  // someone edits the name is infuriating, and this one ends up in URLs.
  const [slug, setSlug] = useState(suggestedSlug)
  const [slugTouched, setSlugTouched] = useState(false)

  return (
    <form action={action} className="space-y-4">
      {state?.error && (
        <p className="rounded-md border border-crit/30 bg-crit/5 px-3 py-2 text-[13px] leading-relaxed">
          {state.error}
        </p>
      )}

      <div className="space-y-1.5">
        <label htmlFor="name" className="text-xs font-medium text-muted-foreground">Organisation name</label>
        <input
          id="name" name="name" required autoFocus className={field} placeholder="Acme Inc"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            if (!slugTouched) setSlug(toSlug(e.target.value))
          }}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="slug" className="text-xs font-medium text-muted-foreground">Identifier</label>
        <input
          id="slug" name="slug" required className={`${field} font-mono`} placeholder="acme"
          value={slug}
          onChange={(e) => { setSlugTouched(true); setSlug(toSlug(e.target.value)) }}
        />
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Stamped on every metric your collectors send and used to keep your data apart from
          everyone else&apos;s. Lowercase letters, digits and hyphens. You cannot change it later.
        </p>
      </div>

      <button
        type="submit"
        className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        Create organisation
      </button>
    </form>
  )
}
