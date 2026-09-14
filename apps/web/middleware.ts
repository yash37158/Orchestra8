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
// "/" is the landing page and has to be reachable by somebody who has never
// heard of the product. It used to sit behind this check, so every visitor was
// redirected to a sign-in form before being told what they would be signing
// into. The page itself sends anyone already signed in on to the dashboard.
// /landing is kept public so its redirect to / can run; gating it sent old
// links to a sign-in form instead of the page they were asking for.
const PUBLIC = ["/signin", "/api/auth", "/invite", "/landing"]

function isPublic(pathname: string) {
  return pathname === "/" || PUBLIC.some((p) => pathname.startsWith(p))
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const hasSessionCookie =
    req.cookies.has("authjs.session-token") || req.cookies.has("__Secure-authjs.session-token")

  // The landing page is always the landing page.
  //
  // It used to redirect to the dashboard whenever a session cookie was
  // present, which reads as helpful and is not: this check can only see that a
  // cookie EXISTS, not that it still means anything. A cookie left behind by a
  // session that has since expired, been revoked, or been signed out elsewhere
  // sent a visitor "/" -> "/dashboard" -> 401 -> "/signin", so the front page
  // of the product was unreachable for exactly the people most likely to have
  // an old cookie lying around.
  //
  // Somebody already signed in is one click away regardless: the sign-in page
  // resolves their session for real and forwards them on.
  if (isPublic(pathname)) return NextResponse.next()

  if (hasSessionCookie) return NextResponse.next()

  const url = req.nextUrl.clone()
  url.pathname = "/signin"
  url.searchParams.set("callbackUrl", pathname)
  return NextResponse.redirect(url)
}

export const config = {
  // Everything except Next's own assets and the favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|placeholder.svg).*)"],
}
