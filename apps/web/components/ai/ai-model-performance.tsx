"use client"

import { useState } from "react"
import { AlertTriangle, BarChart3, RefreshCw, ThumbsDown, ThumbsUp } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"

export function AIModelPerformance() {
  const [feedbackMode, setFeedbackMode] = useState<"none" | "positive" | "negative">("none")
  const [feedbackText, setFeedbackText] = useState("")
  const [isRetraining, setIsRetraining] = useState(false)

  const handleRetrain = () => {
    setIsRetraining(true)
    // Simulate retraining
    setTimeout(() => {
      setIsRetraining(false)
    }, 3000)
  }

  const handleFeedbackSubmit = () => {
    // Reset feedback state
    setFeedbackMode("none")
    setFeedbackText("")
  }

  return (
    <Card className="border-purple-600/20 shadow-md shadow-purple-600/10">
      <CardHeader>
        <CardTitle className="text-sm font-semibold tracking-tight">AI Model Performance</CardTitle>
        <CardDescription>Model health metrics and feedback</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs defaultValue="metrics">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
            <TabsTrigger value="feedback">Feedback</TabsTrigger>
          </TabsList>

          <TabsContent value="metrics" className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>Accuracy</span>
                  <span className="font-medium">94%</span>
                </div>
                <Progress value={94} className="h-2" />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>Precision</span>
                  <span className="font-medium">91%</span>
                </div>
                <Progress value={91} className="h-2" />
              </div>
            </div>

            <div className="rounded-md bg-yellow-500/10 p-3 text-sm text-yellow-500">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4" />
                <div>
                  <p className="font-medium">Data Drift Detected</p>
                  <p className="mt-1">5% feature drift detected in last 7 days</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm">
                <div className="text-muted-foreground">Last Trained</div>
                <div>3 days ago</div>
              </div>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={handleRetrain} disabled={isRetraining}>
                <RefreshCw className={`h-3.5 w-3.5 ${isRetraining ? "animate-spin" : ""}`} />
                {isRetraining ? "Retraining..." : "Retrain Model"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="feedback" className="space-y-4 pt-4">
            {feedbackMode === "none" ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">How helpful are the AI recommendations?</p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={() => setFeedbackMode("positive")}
                  >
                    <ThumbsUp className="h-4 w-4" />
                    Helpful
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={() => setFeedbackMode("negative")}
                  >
                    <ThumbsDown className="h-4 w-4" />
                    Not Helpful
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {feedbackMode === "positive"
                    ? "What was most helpful about the recommendations?"
                    : "How could the recommendations be improved?"}
                </p>
                <Textarea
                  placeholder="Your feedback..."
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  className="h-20 resize-none"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setFeedbackMode("none")}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleFeedbackSubmit} disabled={!feedbackText.trim()}>
                    Submit Feedback
                  </Button>
                </div>
              </div>
            )}

            <div className="rounded-md bg-muted p-3 text-center text-sm text-muted-foreground">
              <BarChart3 className="mx-auto mb-2 h-5 w-5" />
              <p>Your feedback helps improve the AI model</p>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
