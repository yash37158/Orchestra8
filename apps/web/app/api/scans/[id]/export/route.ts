import { apiFetch } from "@/lib/api/fetch"

/**
 * Streams a stored scan's CSV or SBOM out through the app.
 *
 * The browser cannot call the Go API directly: in production it is not on a
 * routable address, and pointing an <a href> at it would mean publishing the
 * API's URL to every page and relying on a cross-origin cookie. Proxying keeps
 * the session cookie handling in one place — apiFetch — and keeps the download
 * on the same origin as the page that offered it.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const format = new URL(request.url).searchParams.get("format") === "sbom" ? "sbom" : "csv"

  const res = await apiFetch(`/v1/scans/${encodeURIComponent(id)}/export?format=${format}`)
  if (!res.ok) {
    return new Response(await res.text(), { status: res.status })
  }

  // Content-Disposition carries the filename the API chose, so the two cannot
  // drift apart.
  const headers = new Headers()
  for (const h of ["content-type", "content-disposition"]) {
    const v = res.headers.get(h)
    if (v) headers.set(h, v)
  }
  return new Response(res.body, { status: 200, headers })
}
