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
 * Whether someone who just authenticated may proceed.
 *
 * Three outcomes, and the middle one is the interesting one:
 *
 *   member      already belongs somewhere — straight to their dashboard
 *   newcomer    authenticated but belongs nowhere — send them to register an
 *               organisation, a one-time step
 *   refused     signup is closed and nobody invited them
 *
 * "Newcomer" used to be "refused", which meant a stranger with a perfectly
 * good Google account hit a dead end. Letting them found their own
 * organisation is safe because it is *their own*: every read is scoped by it,
 * so a new tenant starts empty and stays that way until they connect a cluster.
 */
export type Admission = "member" | "newcomer" | "refused"

export async function admit(pool: Pool, userId: string): Promise<Admission> {
  const { rowCount } = await pool.query(`SELECT 1 FROM memberships WHERE user_id = $1 LIMIT 1`, [userId])
  if (rowCount && rowCount > 0) return "member"
  return allowSignup() ? "newcomer" : "refused"
}

/**
 * Open registration.
 *
 * On for a hosted deployment, where every arrival is a prospective customer
 * founding their own tenant. Off for a self-hosted one, where the people who
 * belong are a known list and an open door is a way for anyone inside the
 * network to create accounts. It costs nothing to make explicit and is the
 * kind of default nobody should have to infer.
 */
export function allowSignup(): boolean {
  return (process.env.ORCHESTR8_ALLOW_SIGNUP ?? "true") !== "false"
}

/**
 * Registers an organisation and makes this user its owner.
 *
 * The slug is what ends up in telemetry, in URLs, and as a Kubernetes label
 * value, so it is checked against the same shape the database enforces rather
 * than being trusted from a form. A collision is reported as one — two
 * companies can both be called "acme" and neither should be told the other
 * exists, so the message says the name is taken and nothing more.
 */
export type RegisterResult =
  | { ok: true; slug: string }
  | { ok: false; error: string }

const SLUG_RE = /^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$/

export async function registerOrg(
  pool: Pool,
  userId: string,
  name: string,
  slug: string,
): Promise<RegisterResult> {
  const cleanName = name.trim()
  const cleanSlug = slug.trim().toLowerCase()
  if (cleanName.length < 2) return { ok: false, error: "Give the organisation a name." }
  if (!SLUG_RE.test(cleanSlug)) {
    return { ok: false, error: "The identifier must be lowercase letters, digits and hyphens (max 40)." }
  }

  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    // Someone signing in twice quickly must not end up owning two
    // organisations, so an existing membership wins over the form.
    const existing = await client.query(
      `SELECT o.slug FROM memberships m JOIN organizations o ON o.id = m.org_id
        WHERE m.user_id = $1 ORDER BY m.created_at LIMIT 1`,
      [userId],
    )
    if (existing.rowCount && existing.rowCount > 0) {
      await client.query("COMMIT")
      return { ok: true, slug: existing.rows[0].slug }
    }

    const org = await client.query(
      `INSERT INTO organizations (slug, name) VALUES ($1, $2)
       ON CONFLICT (slug) DO NOTHING RETURNING id`,
      [cleanSlug, cleanName],
    )
    if (!org.rowCount) {
      await client.query("ROLLBACK")
      return { ok: false, error: `The identifier "${cleanSlug}" is already taken. Try another.` }
    }
    await client.query(
      `INSERT INTO memberships (org_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [org.rows[0].id, userId],
    )
    await client.query("COMMIT")
    return { ok: true, slug: cleanSlug }
  } catch (e) {
    await client.query("ROLLBACK")
    throw e
  } finally {
    client.release()
  }
}

/**
 * A slug suggestion from the email domain: acme.com -> "acme".
 *
 * Constrained to the shape the database CHECK enforces and telemetry carries,
 * because an org slug ends up as a Kubernetes label value.
 *
 * Returns "" when no usable slug can be derived, rather than a stand-in name.
 * It used to return "orchestr8", which callers then had to treat as "nothing"
 * — and silently blanked the suggestion for anyone whose company genuinely is
 * on that domain.
 */
export function slugFromEmail(email: string | null): string {
  const domain = email?.split("@")[1]?.split(".")[0] ?? ""
  const slug = domain.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/^-+|-+$/g, "").slice(0, 40)
  return SLUG_RE.test(slug) ? slug : ""
}
