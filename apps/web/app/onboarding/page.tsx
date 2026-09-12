import { OnboardingFlow } from "@/components/onboarding-flow"

export const dynamic = "force-dynamic"

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex h-14 max-w-[1400px] items-center">
          <span className="text-[15px] font-semibold tracking-tight">Orchestr8</span>
          <span className="ml-3 text-xs text-muted-foreground">Connect your first cluster</span>
        </div>
      </header>
      <main className="container max-w-[1400px] py-10">
        <OnboardingFlow />
      </main>
    </div>
  )
}
