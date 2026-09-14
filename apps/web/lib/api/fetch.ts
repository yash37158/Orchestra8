import { cookies } from "next/headers"
import { redirect } from "next/navigation"

/**
 * Calls the Go API as the signed-in user.
 *
 * Server components run on the server, so the browser's cookie is not attached
 * to their outbound requests automatically — it has to be forwarded. Every
 * read in this app goes through here, because an unforwarded cookie means the
 * API sees an anonymous request and (correctly) refuses it.
 *
 * The session cookie is the ONLY thing forwarded. Passing the whole jar on
 * would hand the API every unrelated cookie the browser happens to hold.
 */

export const API_URL = process.env.ORCHESTR8_API_URL ?? "http://localhost:8088"

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const jar = await cookies()
  const token =
    jar.get("__Secure-authjs.session-token")?.value ?? jar.get("authjs.session-token")?.value

  const headers = new Headers(init.headers)
  if (token) {
    const name = jar.get("__Secure-authjs.session-token")
      ? "__Secure-authjs.session-token"
      : "authjs.session-token"
    headers.set("cookie", `${name}=${token}`)
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
    signal: init.signal ?? AbortSignal.timeout(8000),
  })

  // A 401 means the session went away underneath a rendered page: signed out
  // elsewhere, expired, or the membership revoked. The browser still holds the
  // cookie, so the middleware — which only checks that one is present — waves
  // it through, and every page then rendered "orchestr8-api returned 401" over
  // advice to start a server that was running the whole time.
  //
  // The stale cookie is left alone: Next.js only permits cookie writes from a
  // Server Action or Route Handler, and this runs during a render. It does not
  // need clearing — signing in again overwrites it, and until then every
  // protected page lands back here and redirects to the same place.
  if (res.status === 401) {
    // Two different people get a 401 here, and sending both to sign in is
    // wrong for one of them. Somebody who just authenticated but has not
    // registered an organisation yet has a perfectly good session — the API
    // refuses them because there is no organisation to scope the read to, and
    // bouncing them to a login page they have already passed is a loop.
    const { auth } = await import("@/auth")
    const session = await auth()
    redirect(session?.user && !session.user.org ? "/welcome" : "/signin?error=SessionEnded")
  }
  return res
}

/**
 * Re-throws Next's redirect signal.
 *
 * redirect() works by throwing, so a `catch (err)` meant for network failures
 * swallows it and the page renders an error instead of navigating. Every
 * catch around apiFetch has to let this one through.
 */
export function rethrowRedirect(err: unknown): void {
  const digest = (err as { digest?: unknown } | null)?.digest
  if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) throw err
}

/**
 * A 401 from the API means the session went away underneath a rendered page —
 * signed out elsewhere, expired, or membership revoked. Saying so beats
 * "internal error", which sends people to check a server that is fine.
 */
export const SIGNED_OUT = "Your session has ended. Sign in again."

export function describeStatus(status: number, statusText: string): string {
  if (status === 401) return SIGNED_OUT
  if (status === 503) return "The control plane is unavailable. This is usually brief."
  return `orchestr8-api returned ${status} ${statusText}`
}
