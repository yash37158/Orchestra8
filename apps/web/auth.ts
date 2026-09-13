import NextAuth from "next-auth"
import GitHub from "next-auth/providers/github"
import Google from "next-auth/providers/google"
import PostgresAdapter from "@auth/pg-adapter"
import { Pool } from "pg"

import { claimOrCreateOrg, membershipOf } from "@/lib/auth/org"

/**
 * Sign-in.
 *
 * The adapter writes into the same control plane the Go API reads: users,
 * accounts, sessions, memberships, organizations. Those tables were shaped for
 * Auth.js in the first migration precisely so there would be no translation
 * layer here and no second source of truth for who exists.
 */

const pool = new Pool({
  connectionString: process.env.ORCHESTR8_CONTROL_DSN ?? "postgres://localhost:5432/orchestr8",
  max: 5,
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PostgresAdapter(pool),
  providers: [Google, GitHub],

  // Database sessions, NOT the default JWT.
  //
  // A JWT is verified by signature alone, so the Go API could never check it
  // against anything and a revoked user would keep working until their token
  // expired. A database session is one row: the API resolves it the same way
  // it resolves an ingest token, and revoking either is a DELETE.
  session: { strategy: "database" },

  pages: { signIn: "/signin", error: "/signin" },

  callbacks: {
    /**
     * Invite-only after the first account.
     *
     * Without this, anyone who finds the URL and has a Google account joins —
     * not as a stranger who sees nothing, but as a signed-in user the API will
     * happily resolve an organisation for. The first person to arrive founds
     * the organisation and owns it; everyone after needs a membership that
     * somebody already inside created.
     */
    async signIn({ user }) {
      if (!user?.id) return true // first pass, before the adapter has an id
      const claimed = await claimOrCreateOrg(pool, user.id, user.email ?? null)
      return claimed ? true : "/signin?error=NotInvited"
    },

    async session({ session, user }) {
      const m = await membershipOf(pool, user.id)
      if (session.user) {
        session.user.id = user.id
        session.user.org = m?.orgSlug ?? null
        session.user.role = m?.role ?? null
      }
      return session
    },
  },
})
