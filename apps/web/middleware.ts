import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * Route protection.
 *
 * This only decides what the browser is shown. It is deliberately NOT the
 * security boundary: the Go API resolves the session cookie itself on every
 * request, so a hand-crafted call that skips the browser entirely is still
 * rejected. A middleware that merely hides a page, in front of an API that
 * trusts it, is the pattern this whole change exists to avoid.
 *
 * Checking cookie presence rather than validity keeps this edge-compatible —
 * validity is the API's job, and it does not take our word for it.
 */
// /welcome is reachable by anyone signed in, including someone who does not
// belong to an organisation yet — it is where they go to create one, so
// gating it behind having one would be a loop.
const PUBLIC = ["/signin", "/landing", "/api/auth"]

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next()

  const hasSession =
    req.cookies.has("authjs.session-token") || req.cookies.has("__Secure-authjs.session-token")
  if (hasSession) return NextResponse.next()

  const url = req.nextUrl.clone()
  url.pathname = "/signin"
  url.searchParams.set("callbackUrl", pathname)
  return NextResponse.redirect(url)
}

export const config = {
  // Everything except Next's own assets and the favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|placeholder.svg).*)"],
}
