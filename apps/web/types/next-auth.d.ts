import type { DefaultSession } from "next-auth"

/**
 * The org and role a signed-in user acts with, carried on the session so the
 * UI can render them without a second query.
 *
 * Display only. The Go API resolves the same two values from the session row
 * itself on every request and never reads them from here — if the UI were the
 * authority, editing what the browser holds would change what the API returns.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string
      org: string | null
      role: string | null
    } & DefaultSession["user"]
  }
}
