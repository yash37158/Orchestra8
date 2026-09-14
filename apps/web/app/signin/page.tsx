import { Pool } from "pg"

import { redirect } from "next/navigation"

import { auth, signIn } from "@/auth"
import { BootstrapForm, PasswordForm } from "@/components/signin-form"
import { allowSignup } from "@/lib/auth/org"
import { needsBootstrap } from "@/lib/auth/password"

export const dynamic = "force-dynamic"

const pool = new Pool({
  connectionString: process.env.ORCHESTR8_CONTROL_DSN ?? "postgres://localhost:5432/orchestr8",
  max: 2,
})

const ERRORS: Record<string, string> = {
  NotInvited:
    "This deployment is invite-only. Ask an owner to add you — they can do it from Settings once invitations ship.",
  SessionEnded:
    "Your session ended — signed out elsewhere, expired, or your access was changed. Sign in again.",
  OAuthAccountNotLinked:
    "That email is already registered through a different sign-in provider. Use the one you signed up with.",
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>
}) {
  const session = await auth()
  if (session?.user) redirect("/dashboard")

  const { error, callbackUrl } = await searchParams
  const message = error ? (ERRORS[error] ?? "Could not sign you in. Try again.") : null

  // Only providers that are actually configured. A button for an app that was
  // never registered goes to a provider error page, which reads as a broken
  // product rather than an unfinished setup — this deployment shipped with two
  // of them.
  const oauth = [
    { id: "google", label: "Continue with Google", on: !!process.env.AUTH_GOOGLE_ID },
    { id: "github", label: "Continue with GitHub", on: !!process.env.AUTH_GITHUB_ID },
    {
      id: "oidc",
      label: `Continue with ${process.env.AUTH_OIDC_NAME ?? "single sign-on"}`,
      on: !!process.env.AUTH_OIDC_ISSUER,
    },
  ].filter((p) => p.on)

  const signupOpen = allowSignup()

  let bootstrap = false
  try {
    bootstrap = await needsBootstrap(pool)
  } catch {
    // The control plane is unreachable. Falling through to the sign-in form is
    // the honest outcome: the attempt will fail with a real message rather than
    // this page claiming the deployment is unclaimed and inviting a takeover.
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-7">
          <h1 className="text-lg font-semibold tracking-tight">Orchestr8</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {bootstrap
              ? "Nobody owns this deployment yet."
              : "GPU and inference observability."}
          </p>
        </div>

        {message && (
          <div className="mb-5 rounded-md border border-crit/30 bg-crit/5 px-4 py-3 text-[13px] leading-relaxed text-foreground/90">
            {message}
          </div>
        )}

        {/* Single sign-on first wherever it is available — including on an
            unclaimed deployment, where with open registration it is the
            shortest route to becoming the owner. Hiding it there was a hole:
            with SSO configured, registration closed and nobody signed up yet,
            the provider refused everyone and the form that could have fixed it
            was not on the page. */}
        {oauth.length > 0 && (
          <div className="space-y-2.5">
            {oauth.map((p) => (
              <form
                key={p.id}
                action={async () => {
                  "use server"
                  await signIn(p.id, { redirectTo: callbackUrl ?? "/dashboard" })
                }}
              >
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2.5 rounded-md border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:border-foreground/20"
                >
                  {p.label}
                </button>
              </form>
            ))}
            <p className="pt-1 text-[11px] leading-relaxed text-muted-foreground">
              {!signupOpen
                ? "This deployment is invite-only. Sign in with an account an owner has already added."
                : bootstrap
                  ? "The first person to sign in becomes the owner."
                  : "New here? Signing in creates your account and walks you through registering an organisation — once."}
            </p>
          </div>
        )}

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {oauth.length > 0 ? "or" : bootstrap ? "set up" : "sign in"}
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {bootstrap ? (
          <>
            <BootstrapForm />
            <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
              The setup token is in the cluster, not on this page:
              <code className="mt-1.5 block overflow-x-auto rounded bg-muted px-2 py-1.5 font-mono text-[11px]">
                kubectl -n orchestr8 get secret orchestr8-orchestr8-auth -o jsonpath=&#123;.data.ORCHESTR8_BOOTSTRAP_TOKEN&#125; | base64 -d
              </code>
              Running locally, it is ORCHESTR8_BOOTSTRAP_TOKEN in apps/web/.env.local.
            </p>
          </>
        ) : (
          <PasswordForm />
        )}

        {/* Named explicitly rather than left as an absence. A page with no
            sign-on button looks like a product that does not support it,
            rather than a deployment that has not been given an issuer. */}
        {oauth.length === 0 && (
          <p className="mt-6 rounded-md border bg-card px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
            No single sign-on provider is configured. Orchestr8 supports Google, GitHub and any
            OpenID Connect provider — Okta, Entra, Keycloak, Auth0. Set
            <code className="mx-1 rounded bg-muted px-1 py-0.5 font-mono">auth.oidc.issuer</code>
            and a client pair, or run <code className="mx-1 rounded bg-muted px-1 py-0.5 font-mono">make sso</code>
            for a local provider to try it against.
          </p>
        )}

        <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
          Telemetry stays scoped to your organisation. Collectors authenticate separately with an
          ingest token, issued per cluster.
        </p>
      </div>
    </main>
  )
}
