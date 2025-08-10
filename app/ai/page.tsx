import { MainLayout } from "@/components/main-layout"
import { ScrollArea } from "@/components/ui/scroll-area"
import { PredictiveScalingDashboard } from "@/components/ai/predictive-scaling-dashboard"
import { CostOptimizationPanel } from "@/components/ai/cost-optimization-panel"
import { AnomalyDetection } from "@/components/ai/anomaly-detection"
import { AIModelPerformance } from "@/components/ai/ai-model-performance"
import { CollaborativeDecisionLog } from "@/components/ai/collaborative-decision-log"

export default function AIPage() {
  return (
    <MainLayout>
      <ScrollArea className="h-[calc(100vh-4rem)]">
        <div className="container space-y-6 py-6">
          <h1 className="text-3xl font-bold tracking-tight">AI Recommendations</h1>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="col-span-3 md:col-span-2">
              <PredictiveScalingDashboard />
            </div>
            <div className="col-span-3 md:col-span-1">
              <CostOptimizationPanel />
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="col-span-3 md:col-span-2">
              <AnomalyDetection />
            </div>
            <div className="col-span-3 md:col-span-1">
              <div className="space-y-6">
                <AIModelPerformance />
                <CollaborativeDecisionLog />
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </MainLayout>
  )
}
