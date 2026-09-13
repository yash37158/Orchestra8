import { cookies } from "next/headers"

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

  return fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
    signal: init.signal ?? AbortSignal.timeout(8000),
  })
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
