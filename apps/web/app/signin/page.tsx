import { redirect } from "next/navigation"

import { auth, signIn } from "@/auth"

export const dynamic = "force-dynamic"

const ERRORS: Record<string, string> = {
  NotInvited:
    "That account is not a member of any organisation. Ask an owner to invite you — the first account created owns this deployment, and everyone after joins by invitation.",
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

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h1 className="text-lg font-semibold tracking-tight">Orchestr8</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            GPU and inference observability. Sign in to continue.
          </p>
        </div>

        {message && (
          <div className="mb-5 rounded-md border border-crit/30 bg-crit/5 px-4 py-3 text-[13px] leading-relaxed text-foreground/90">
            {message}
          </div>
        )}

        <div className="space-y-2.5">
          {[
            { id: "google", label: "Continue with Google" },
            { id: "github", label: "Continue with GitHub" },
          ].map((p) => (
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

        <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
          Telemetry stays scoped to your organisation. Collectors authenticate
          separately with an ingest token, issued per cluster.
        </p>
      </div>
    </main>
  )
}
