import type { Pool } from "pg"

/**
 * Organisation membership, resolved against the control plane.
 *
 * This is the only place a membership is created. Keeping it out of the Auth.js
 * config keeps the rule testable without standing up an OAuth provider.
 */

export type Membership = { orgSlug: string; role: string }

export async function membershipOf(pool: Pool, userId: string): Promise<Membership | null> {
  const { rows } = await pool.query(
    `SELECT o.slug AS "orgSlug", m.role
       FROM memberships m
       JOIN organizations o ON o.id = m.org_id
      WHERE m.user_id = $1
      ORDER BY m.created_at, o.slug
      LIMIT 1`,
    [userId],
  )
  return rows[0] ?? null
}

/**
 * Decides whether a user may sign in, and founds the organisation if they are
 * the first person ever to arrive.
 *
 * Returns false for someone with no membership once an organisation exists —
 * the invite-only rule. The whole thing runs in one transaction so two people
 * signing in at the same instant cannot both found an organisation.
 */
export async function claimOrCreateOrg(
  pool: Pool,
  userId: string,
  email: string | null,
): Promise<boolean> {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    const existing = await client.query(`SELECT 1 FROM memberships WHERE user_id = $1 LIMIT 1`, [userId])
    if (existing.rowCount && existing.rowCount > 0) {
      await client.query("COMMIT")
      return true
    }

    // Lock the table so the "is anyone here yet" check and the insert that
    // answers it cannot interleave with another sign-in.
    await client.query("LOCK TABLE organizations IN EXCLUSIVE MODE")
    const anyOrg = await client.query(`SELECT 1 FROM organizations LIMIT 1`)
    if (anyOrg.rowCount && anyOrg.rowCount > 0) {
      await client.query("ROLLBACK")
      return false // invite-only from here on
    }

    const slug = slugFromEmail(email)
    const org = await client.query(
      `INSERT INTO organizations (slug, name) VALUES ($1, $2) RETURNING id`,
      [slug, email?.split("@")[1] ?? slug],
    )
    await client.query(
      `INSERT INTO memberships (org_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [org.rows[0].id, userId],
    )
    await client.query("COMMIT")
    return true
  } catch (e) {
    await client.query("ROLLBACK")
    throw e
  } finally {
    client.release()
  }
}

/**
 * A slug from the email domain: acme.com -> "acme".
 *
 * Constrained to the shape the database CHECK enforces and telemetry carries,
 * because an org slug ends up as a Kubernetes label value. A domain that
 * cannot be reduced to that shape falls back rather than failing the insert.
 */
export function slugFromEmail(email: string | null): string {
  const domain = email?.split("@")[1]?.split(".")[0] ?? ""
  const slug = domain.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/^-+|-+$/g, "").slice(0, 40)
  return /^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$/.test(slug) ? slug : "orchestr8"
}
