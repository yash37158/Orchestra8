"use client"

import { useState } from "react"
import { MessageSquare, Send, Zap } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"

// Mock data for activity feed
const initialActivities = [
  {
    id: 1,
    user: {
      name: "Yash",
      avatar: "/placeholder.svg?height=32&width=32",
      role: "DevOps Engineer",
    },
    action: "applied AI scaling suggestion",
    timestamp: "2:30 PM",
    details: "Scaled payment-service from 10 to 15 replicas",
  },
  {
    id: 2,
    user: {
      name: "AI",
      avatar: "/placeholder.svg?height=32&width=32",
      role: "Orchestration AI",
    },
    action: "auto-rolled back payment-service",
    timestamp: "1:45 PM",
    details: "Detected anomalies after deployment v2.3.1",
  },
  {
    id: 3,
    user: {
      name: "Maria",
      avatar: "/placeholder.svg?height=32&width=32",
      role: "SRE Lead",
    },
    action: "commented",
    timestamp: "12:15 PM",
    details: "The AI recommendation for database scaling worked perfectly. Let's apply this to other services as well.",
    comments: [],
  },
]

export function CollaborativeDecisionLog() {
  const [activities, setActivities] = useState(initialActivities)
  const [newComment, setNewComment] = useState("")

  const handleAddComment = (activityId: number) => {
    if (!newComment.trim()) return

    setActivities((prev) =>
      prev.map((activity) =>
        activity.id === activityId
          ? {
              ...activity,
              comments: [
                ...(activity.comments || []),
                {
                  id: Date.now(),
                  user: {
                    name: "You",
                    avatar: "/placeholder.svg?height=32&width=32",
                    role: "Admin",
                  },
                  text: newComment,
                  timestamp: "Just now",
                },
              ],
            }
          : activity,
      ),
    )

    setNewComment("")
  }

  return (
    <Card className="border-blue-600/20 shadow-md shadow-blue-600/10">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">Team Activity</CardTitle>
        <CardDescription>Collaborative decision log</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4">
          {activities.map((activity) => (
            <div key={activity.id} className="space-y-2">
              <div className="flex items-start gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={activity.user.avatar} alt={activity.user.name} />
                  <AvatarFallback>
                    {activity.user.name === "AI" ? <Zap className="h-4 w-4" /> : activity.user.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium">{activity.user.name}</span>
                    <span className="text-xs text-muted-foreground">{activity.user.role}</span>
                  </div>

                  <p className="mt-1 text-sm">
                    <span className="text-muted-foreground">{activity.action} </span>
                    {activity.details}
                  </p>

                  <div className="mt-1 text-xs text-muted-foreground">{activity.timestamp}</div>

                  {/* Comments section */}
                  {activity.comments && activity.comments.length > 0 && (
                    <div className="mt-2 space-y-2 pl-4">
                      {activity.comments.map((comment) => (
                        <div key={comment.id} className="flex items-start gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={comment.user.avatar} alt={comment.user.name} />
                            <AvatarFallback>{comment.user.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-baseline gap-2">
                              <span className="text-xs font-medium">{comment.user.name}</span>
                              <span className="text-xs text-muted-foreground">{comment.timestamp}</span>
                            </div>
                            <p className="text-xs">{comment.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Comment input */}
                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      placeholder="Add comment or @mention..."
                      className="h-7 text-xs"
                      value={activity.id === 3 ? newComment : ""}
                      onChange={(e) => activity.id === 3 && setNewComment(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && activity.id === 3) {
                          handleAddComment(activity.id)
                        }
                      }}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => activity.id === 3 && handleAddComment(activity.id)}
                      disabled={activity.id !== 3 || !newComment.trim()}
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span className="sr-only">Send</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
          <MessageSquare className="h-3.5 w-3.5" />
          View All Activity
        </Button>
      </CardContent>
    </Card>
  )
}
