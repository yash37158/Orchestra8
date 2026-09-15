import Link from "next/link"

/**
 * Statically rendered, deliberately.
 *
 * An earlier version called auth() here to send signed-in visitors on to the
 * dashboard. That is a small convenience bought at a large price: it forces a
 * server render and a session lookup in Postgres for every anonymous visitor,
 * which is almost all of them, and makes the one page that should sit on a CDN
 * uncacheable. The redirect now happens in middleware, at the edge, on the
 * presence of a cookie and without touching a database.
 */

/**
 * The landing page.
 *
 * At the root, where a visitor actually arrives. It used to live at /landing
 * while / was behind the session check, so anyone who typed the domain was
 * bounced to a sign-in form having never been told what the product is.
 *
 * What is written here is limited to what the product does. The version this
 * replaces carried three testimonials from people who do not exist, a pricing
 * table nobody had decided, and a description of a different product
 * altogether — it called this a "Multi-Environment Orchestration Platform" and
 * never mentioned a GPU. Invented social proof is not a placeholder; it is a
 * claim, and it is the first thing a serious buyer checks.
 */

const CAPABILITIES = [
  {
    title: "Correlation engine",
    body: "Joins GPU telemetry to inference latency and names a cause, with the evidence and a confidence score. Says “unknown” rather than guessing.",
  },
  {
    title: "GPU fleet",
    body: "Per device: utilisation, memory headroom, temperature, power draw, throttle state and XID faults — the readings that explain a latency incident.",
  },
  {
    title: "Cost attribution",
    body: "Spend by GPU model with utilisation beside it, and cost per thousand requests. An idle H100 and a saturated one bill the same per hour.",
  },
  {
    title: "Deploy preflight",
    body: "Checks GPU capacity, SLO budget and image vulnerabilities before a rollout, then commits to Git. It never writes to a cluster directly.",
  },
  {
    title: "Container scanning",
    body: "Trivy findings with stored SBOMs, so a vulnerability published tomorrow is re-matched against what you already shipped.",
  },
  {
    title: "Audit ledger",
    body: "Hash-chained and append-only. Every deploy, scan and threshold change, verifiable end to end rather than trusted.",
  },
]

function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-[1120px] items-center justify-between px-6">
        <div className="flex items-center gap-2.5">
          <div className="grid h-7 w-7 place-items-center rounded-[5px] bg-primary font-mono text-[12px] font-bold text-primary-foreground">
            O
          </div>
          <span className="display text-[15px] font-semibold">Orchestr8</span>
        </div>
        <nav className="flex items-center gap-7">
          <Link href="#how" className="hidden text-[13px] text-muted-foreground transition-colors hover:text-foreground sm:block">
            How it works
          </Link>
          <Link href="#capabilities" className="hidden text-[13px] text-muted-foreground transition-colors hover:text-foreground sm:block">
            Capabilities
          </Link>
          <Link
            href="/signin"
            className="rounded-md border px-3.5 py-1.5 text-[13px] font-medium transition-colors hover:border-foreground/25 hover:bg-secondary/60"
          >
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  )
}

/**
 * The centre of the page, and the only thing worth leading with.
 *
 * Both columns show the same breach. Everything a conventional dashboard
 * displays is identical between them; only the cause differs, and the fixes
 * are opposites. This is the product, stated as a comparison rather than a
 * claim — and it is the case `make verify-engine` asserts on every run.
 */
function Distinction() {
  const cases = [
    {
      verdict: "GPU thermal throttle",
      tone: "crit" as const,
      rows: [
        ["p95 time-to-first-token", "1,240 ms", "over"],
        ["GPU temperature", "91 °C", "over"],
        ["SM clock", "−23 % below boost", "over"],
        ["Request rate", "flat", "ok"],
      ],
      action: "Traffic has not moved. Fix the cooling, or move the model off that card.",
    },
    {
      verdict: "Traffic surge",
      tone: "warn" as const,
      rows: [
        ["p95 time-to-first-token", "1,240 ms", "over"],
        ["GPU temperature", "68 °C", "ok"],
        ["SM clock", "at boost", "ok"],
        ["Request rate", "+180 %", "over"],
      ],
      action: "The hardware is healthy. Add replicas, or raise the target.",
    },
  ]

  return (
    <section className="border-b bg-card/25 py-20">
      <div className="mx-auto w-full max-w-[1120px] px-6">
        <h2 className="display text-[26px] font-semibold sm:text-[30px]">Same symptom. Opposite fix.</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Two incidents. Identical latency, identical SLO breach, identical alert. A dashboard that
          stops at the first row sends you to argue with the wrong team.
        </p>

        <div className="mt-7 grid gap-4 md:grid-cols-2">
          {cases.map((c) => (
            <div
              key={c.verdict}
              className={`overflow-hidden rounded-lg border bg-card shadow-[0_1px_2px_hsl(0_0%_0%/0.4)] ${
                c.tone === "crit" ? "state-rail-crit" : "state-rail-warn"
              }`}
            >
              <div className="flex items-center justify-between border-b bg-background/40 px-5 py-2.5">
                <span className="font-mono text-[11px] text-muted-foreground">
                  {c.tone === "crit" ? "incident A" : "incident B"}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.07em] ${
                    c.tone === "crit" ? "bg-crit/15 text-crit" : "bg-warn/15 text-warn"
                  }`}
                >
                  SLO breached
                </span>
              </div>
              <table className="w-full text-[13.5px]">
                <tbody>
                  {c.rows.map(([label, value, state]) => (
                    <tr key={label} className="border-b border-border/40">
                      <td className="px-5 py-3 text-muted-foreground">{label}</td>
                      <td
                        className={`tnum px-5 py-3 text-right font-mono ${
                          state === "over" ? "font-medium text-crit" : "text-foreground/80"
                        }`}
                      >
                        {value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="bg-background/30 px-5 py-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
                  Cause
                </div>
                <div className="mt-1.5 font-mono text-[14px] text-foreground">{c.verdict}</div>
                <p className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground">{c.action}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Nav />

      <main className="flex-1">
        <section className="relative isolate border-b">
          <div className="hero-ground hero-fade absolute inset-0 -z-10" aria-hidden="true" />
          <div className="mx-auto w-full max-w-[1120px] px-6 pb-24 pt-24 sm:pt-28">
            <div className="inline-flex items-center gap-2 rounded-full border bg-card/60 py-1 pl-1.5 pr-3">
              <span className="rounded-full bg-primary/15 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-primary">
                DCGM + vLLM
              </span>
              <span className="text-[11px] text-muted-foreground">Correlated, not just collected</span>
            </div>

            <h1 className="display mt-7 max-w-4xl text-[40px] font-semibold leading-[1.06] sm:text-[58px] lg:text-[64px]">
              Inference is slow.
              <br className="hidden sm:block" />{" "}
              <span className="text-muted-foreground">Is it the model, the traffic,</span>{" "}
              or the silicon?
            </h1>

            <p className="mt-7 max-w-[34rem] text-[16px] leading-[1.7] text-muted-foreground">
              Orchestr8 reads your GPUs and your inference engines together and tells you which one,
              with the measurements behind it. Every other tool tells you latency is high.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="/signin"
                className="rounded-md bg-primary px-5 py-2.5 text-[14px] font-medium text-primary-foreground shadow-[0_1px_0_0_hsl(0_0%_100%/0.12)_inset] transition-opacity hover:opacity-90"
              >
                Get started
              </Link>
              <Link
                href="#how"
                className="rounded-md border bg-card/60 px-5 py-2.5 text-[14px] font-medium transition-colors hover:border-foreground/25 hover:bg-secondary/60"
              >
                How it works
              </Link>
            </div>

            <p className="mt-7 text-[13px] text-muted-foreground">
              Self-hosted or hosted. Your telemetry never leaves your organisation.
            </p>
          </div>
        </section>

        <Distinction />

        <section id="how" className="border-b py-20">
          <div className="mx-auto w-full max-w-[1120px] px-6">
            <h2 className="display text-[26px] font-semibold sm:text-[30px]">How it works</h2>
            <div className="mt-7 grid gap-8 md:grid-cols-3">
              {[
                {
                  n: "01",
                  t: "Install one collector",
                  b: "A read-only agent on your GPU nodes, by Helm. It sends outward only — nothing reaches into your cluster, and it authenticates with a token scoped to that cluster alone.",
                },
                {
                  n: "02",
                  t: "It reads what you already run",
                  b: "NVIDIA DCGM for the silicon, vLLM for the serving engine, over OpenTelemetry. No agents in your model server, no code changes, no vendor format.",
                },
                {
                  n: "03",
                  t: "The engine correlates",
                  b: "Every thirty seconds it compares the two against your latency target, and when it can evidence both a symptom and a cause it says so — and pages once per incident, not once per hypothesis.",
                },
              ].map((s) => (
                <div key={s.n} className="border-t pt-5">
                  <div className="font-mono text-[12px] font-medium text-primary">{s.n}</div>
                  <h3 className="mt-2.5 text-[15px] font-semibold tracking-tight">{s.t}</h3>
                  <p className="mt-2.5 text-[13.5px] leading-[1.7] text-muted-foreground">{s.b}</p>
                </div>
              ))}
            </div>

            <div className="mt-12 overflow-hidden rounded-lg border bg-card shadow-[0_1px_2px_hsl(0_0%_0%/0.4)]">
              <div className="flex items-center gap-2 border-b bg-background/40 px-5 py-2.5">
                <span className="h-2 w-2 rounded-full bg-ok/60" />
                <span className="font-mono text-[11px] text-muted-foreground">connect a cluster</span>
              </div>
              <pre className="overflow-x-auto px-5 py-4 text-[12.5px] leading-[1.75]">
                <code className="font-mono text-foreground/85">{`helm install orchestr8 orchestr8/collector \\
  --namespace orchestr8 --create-namespace \\
  --set clusterId=prod-us-east \\
  --set endpoint=https://ingest.your-orchestr8/ \\
  --set token=$ORCHESTR8_TOKEN`}</code>
              </pre>
              <p className="border-t bg-background/30 px-5 py-3 text-[12.5px] text-muted-foreground">
                The onboarding screen generates this with a token already in it. First GPU reading
                usually lands within a minute.
              </p>
            </div>
          </div>
        </section>

        <section id="capabilities" className="border-b bg-card/25 py-20">
          <div className="mx-auto w-full max-w-[1120px] px-6">
            <h2 className="display text-[26px] font-semibold sm:text-[30px]">Capabilities</h2>
            <div className="mt-7 grid gap-x-10 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
              {CAPABILITIES.map((c) => (
                <div key={c.title}>
                  <h3 className="text-sm font-semibold tracking-tight">{c.title}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{c.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Saying who this is not for is not modesty. A prospect who finds out
            on day three costs far more than one who leaves on the landing page,
            and the boundary here is genuinely sharp: no GPUs, no causes to
            correlate to. */}
        <section className="border-b py-20">
          <div className="mx-auto grid w-full max-w-[1120px] gap-12 px-6 md:grid-cols-2">
            <div>
              <h2 className="display text-[26px] font-semibold sm:text-[30px]">Built for</h2>
              <ul className="mt-6 space-y-3 text-[13.5px] leading-[1.7] text-muted-foreground">
                <li className="border-l-2 border-ok/60 pl-4">
                  Teams serving their own models on their own GPUs, on Kubernetes
                </li>
                <li className="border-l-2 border-ok/60 pl-4">
                  Latency-sensitive inference — chat, search, embeddings on a hot path
                </li>
                <li className="border-l-2 border-ok/60 pl-4">
                  Fleets large enough that nobody can hold them in their head, roughly eight GPUs up
                </li>
                <li className="border-l-2 border-ok/60 pl-4">
                  Regulated environments that cannot send telemetry out — it runs entirely in your cluster
                </li>
              </ul>
            </div>
            <div>
              <h2 className="display text-[26px] font-semibold text-muted-foreground/70 sm:text-[30px]">
                Not built for
              </h2>
              <ul className="mt-6 space-y-3 text-[13.5px] leading-[1.7] text-muted-foreground/75">
                <li className="border-l-2 border-border pl-4">
                  Calling a model API. Without hardware there is no cause to correlate a symptom to.
                </li>
                <li className="border-l-2 border-border pl-4">
                  Training and fine-tuning runs. Those turn on job completion, not latency targets.
                </li>
                <li className="border-l-2 border-border pl-4">
                  One or two cards. An engineer can hold that fleet in their head, and Grafana is free.
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Bookends the hero: same faint light, same grid, so the page closes
            where it opened rather than trailing off. */}
        <section className="relative isolate border-b py-24">
          <div className="hero-ground hero-fade absolute inset-0 -z-10" aria-hidden="true" />
          <div className="mx-auto w-full max-w-[1120px] px-6">
            <h2 className="display text-[30px] font-semibold leading-[1.15] sm:text-[38px]">
              Start with one cluster.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Connect it, set one latency target, and wait for something to go wrong. That is the
              only honest way to find out whether the engine is right about your fleet.
            </p>
            <Link
              href="/signin"
              className="mt-6 inline-block rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Get started
            </Link>
          </div>
        </section>
      </main>

      <footer className="py-10">
        <div className="mx-auto flex w-full max-w-[1120px] flex-wrap items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-2.5">
            <div className="grid h-5 w-5 place-items-center rounded-[4px] bg-muted font-mono text-[10px] font-bold text-muted-foreground">
              O
            </div>
            <span className="text-[13px] text-muted-foreground">
              Orchestr8 — GPU and inference observability
            </span>
          </div>
          <Link href="/signin" className="text-[13px] text-muted-foreground transition-colors hover:text-foreground">
            Sign in
          </Link>
        </div>
      </footer>
    </div>
  )
}
