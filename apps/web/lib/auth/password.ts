import "server-only"

import bcrypt from "bcryptjs"
import { randomBytes } from "node:crypto"
import type { Pool } from "pg"

import { slugFromEmail } from "@/lib/auth/org"

/**
 * Email and password sign-in.
 *
 * This exists because an OAuth provider is an external dependency, and a
 * deployment with none configured had a sign-in page with two dead buttons and
 * no way in at all. A self-hosted install — the regulated customers who cannot
 * send telemetry out are the same ones who cannot use Google — needs a path
 * that depends on nothing.
 *
 * Sessions are written into the same table Auth.js uses, through the same
 * adapter, so the Go API resolves them exactly as it resolves an OAuth
 * session: one row, revocable by deleting it. Auth.js's own Credentials
 * provider forces JWT sessions, which would have been unrevocable — that is
 * why this issues the session directly rather than going through it.
 */

// Work factor. 12 is roughly 250ms on current hardware: slow enough to make
// offline cracking expensive, fast enough that a login does not feel broken.
const COST = 12

// A real hash of a throwaway value, compared against when no user is found so
// that a missing account takes the same time as a wrong password. Without it,
// response time tells an attacker which emails are registered.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", COST)

export const SESSION_COOKIE = "authjs.session-token"
export const SESSION_DAYS = 30

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST)
}

/** Rejects with a deliberately vague reason: which half was wrong is not the caller's business. */
export async function verifyCredentials(
  pool: Pool,
  email: string,
  password: string,
): Promise<{ userId: string } | null> {
  const { rows } = await pool.query(
    `SELECT id, password_hash FROM users WHERE lower(email) = lower($1) LIMIT 1`,
    [email.trim()],
  )
  const row = rows[0]
  const ok = await bcrypt.compare(password, row?.password_hash ?? DUMMY_HASH)
  // row?.password_hash can be null for an account created through OAuth; the
  // compare above still runs, against the dummy, and still fails.
  return ok && row?.password_hash ? { userId: row.id } : null
}

/**
 * Issues a session row and returns the token for the cookie.
 *
 * Same shape the Auth.js adapter writes, because the API reads both.
 */
export async function issueSession(pool: Pool, userId: string): Promise<{ token: string; expires: Date }> {
  const token = randomBytes(32).toString("hex")
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000)
  await pool.query(
    `INSERT INTO sessions ("sessionToken", "userId", expires) VALUES ($1, $2, $3)`,
    [token, userId, expires],
  )
  return { token, expires }
}

/** True while nobody has claimed this deployment. */
export async function needsBootstrap(pool: Pool): Promise<boolean> {
  const { rows } = await pool.query(`SELECT NOT EXISTS (SELECT 1 FROM users) AS empty`)
  return rows[0]?.empty === true
}

/**
 * Creates the first account and the organisation it owns.
 *
 * Guarded by a token the operator reads out of the cluster, not left open to
 * whoever finds the URL first. A fresh deployment is reachable before its owner
 * has signed in, and without this the window between `helm install` and that
 * first login is a window in which a stranger becomes the owner.
 *
 * Returns null when the guard fails, deliberately without saying which guard.
 */
export async function bootstrapOwner(
  pool: Pool,
  email: string,
  password: string,
  token: string,
): Promise<{ userId: string } | null> {
  const expected = process.env.ORCHESTR8_BOOTSTRAP_TOKEN ?? ""
  if (!expected || !timingSafeEqual(token, expected)) return null
  if (password.length < 12) return null

  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    // Serialises with the OAuth path's founding check, so two people arriving
    // at once cannot both become owner.
    await client.query("LOCK TABLE organizations IN EXCLUSIVE MODE")
    const taken = await client.query(`SELECT 1 FROM users LIMIT 1`)
    if (taken.rowCount && taken.rowCount > 0) {
      await client.query("ROLLBACK")
      return null
    }
    const hash = await hashPassword(password)
    const user = await client.query(
      `INSERT INTO users (email, name, password_hash, "emailVerified") VALUES ($1, $2, $3, now()) RETURNING id`,
      [email.trim(), email.split("@")[0], hash],
    )
    // An unusable domain still needs a slug the database will accept.
    const slug = slugFromEmail(email) || "orchestr8"
    const org = await client.query(
      `INSERT INTO organizations (slug, name) VALUES ($1, $2) RETURNING id`,
      [slug, email.split("@")[1] ?? slug],
    )
    await client.query(
      `INSERT INTO memberships (org_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [org.rows[0].id, user.rows[0].id],
    )
    await client.query("COMMIT")
    return { userId: user.rows[0].id }
  } catch (e) {
    await client.query("ROLLBACK")
    throw e
  } finally {
    client.release()
  }
}

/** Length-independent comparison, so the token cannot be guessed a character at a time. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
