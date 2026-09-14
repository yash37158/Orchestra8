import NextAuth from "next-auth"
import GitHub from "next-auth/providers/github"
import Google from "next-auth/providers/google"
import PostgresAdapter from "@auth/pg-adapter"
import { Pool } from "pg"

import { admit, membershipOf } from "@/lib/auth/org"

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

/**
 * Any OpenID Connect provider, configured by environment.
 *
 * Google and GitHub cover a hosted deployment. They cover nothing at all for
 * the customers most likely to self-host — a bank runs Entra or Okta or
 * Keycloak, and "we support Google" is a no. One issuer URL and a client pair
 * is the whole integration for all of them.
 */
const oidc = process.env.AUTH_OIDC_ISSUER
  ? [{
      id: "oidc",
      name: process.env.AUTH_OIDC_NAME ?? "single sign-on",
      type: "oidc" as const,
      issuer: process.env.AUTH_OIDC_ISSUER,
      clientId: process.env.AUTH_OIDC_ID,
      clientSecret: process.env.AUTH_OIDC_SECRET,
      // Some providers only return email in the userinfo response, and the
      // adapter needs one: a user row without an email cannot be invited,
      // named in the audit ledger, or matched to a second sign-in.
      profile(profile: Record<string, unknown>) {
        return {
          id: String(profile.sub),
          name: (profile.name ?? profile.preferred_username ?? profile.email) as string,
          email: profile.email as string,
          image: (profile.picture as string) ?? null,
        }
      },
    }]
  : []

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PostgresAdapter(pool),
  providers: [
    ...(process.env.AUTH_GOOGLE_ID ? [Google] : []),
    ...(process.env.AUTH_GITHUB_ID ? [GitHub] : []),
    ...oidc,
  ],

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
     * Who gets through the door.
     *
     * Somebody with no organisation is let in and sent to register one — the
     * account exists at this point either way, and refusing here would leave
     * a user row nobody can ever use. The organisation they land in is their
     * own, and every read is scoped by it, so an unknown arrival sees an empty
     * product rather than anyone else's fleet.
     *
     * With signup closed, they are turned away instead and told why.
     */
    async signIn({ user }) {
      if (!user?.id) return true // first pass, before the adapter has an id
      const verdict = await admit(pool, user.id)
      return verdict === "refused" ? "/signin?error=NotInvited" : true
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
