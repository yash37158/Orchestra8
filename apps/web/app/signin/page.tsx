import { Pool } from "pg"

import { redirect } from "next/navigation"

import { auth, signIn } from "@/auth"
import { BootstrapForm, PasswordForm } from "@/components/signin-form"
import { needsBootstrap } from "@/lib/auth/password"

export const dynamic = "force-dynamic"

const pool = new Pool({
  connectionString: process.env.ORCHESTR8_CONTROL_DSN ?? "postgres://localhost:5432/orchestr8",
  max: 2,
})

const ERRORS: Record<string, string> = {
  NotInvited:
    "That account is not a member of any organisation. Ask an owner to invite you — the first account created owns this deployment, and everyone after joins by invitation.",
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
  ].filter((p) => p.on)

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
              ? "Nobody owns this deployment yet. Create the first account."
              : "GPU and inference observability. Sign in to continue."}
          </p>
        </div>

        {message && (
          <div className="mb-5 rounded-md border border-crit/30 bg-crit/5 px-4 py-3 text-[13px] leading-relaxed text-foreground/90">
            {message}
          </div>
        )}

        {bootstrap ? (
          <>
            <BootstrapForm />
            <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
              The setup token is in the cluster, not on this page:
              <code className="mt-1.5 block overflow-x-auto rounded bg-muted px-2 py-1.5 font-mono text-[11px]">
                kubectl -n orchestr8 get secret orchestr8-orchestr8-auth -o jsonpath=&#123;.data.ORCHESTR8_BOOTSTRAP_TOKEN&#125; | base64 -d
              </code>
              This account owns the organisation. Everyone after joins by invitation.
            </p>
          </>
        ) : (
          <>
            <PasswordForm />

            {oauth.length > 0 && (
              <>
                <div className="my-5 flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">or</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
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
                        className="w-full rounded-md border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:border-foreground/20"
                      >
                        {p.label}
                      </button>
                    </form>
                  ))}
                </div>
              </>
            )}

            <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
              {oauth.length === 0 && "No single sign-on provider is configured on this deployment. "}
              Telemetry stays scoped to your organisation. Collectors authenticate separately with an
              ingest token, issued per cluster.
            </p>
          </>
        )}
      </div>
    </main>
  )
}
