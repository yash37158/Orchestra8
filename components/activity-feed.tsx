import { Activity, AlertTriangle, CheckCircle2, XCircle } from "lucide-react"

const activities = [
  {
    type: "deployment",
    title: "Frontend deployment successful",
    description: "v2.1.0 deployed to production",
    timestamp: "3 min ago",
    icon: CheckCircle2,
    iconColor: "text-green-500",
  },
  {
    type: "ai",
    title: "AI scaled frontend pods",
    description: "Scaled to 10 replicas due to increased traffic",
    timestamp: "15 min ago",
    icon: Activity,
    iconColor: "text-blue-500",
  },
  {
    type: "security",
    title: "Security alert detected",
    description: "Suspicious activity in pod orchestr8-backend-5d4f8",
    timestamp: "1 hour ago",
    icon: AlertTriangle,
    iconColor: "text-yellow-500",
  },
  {
    type: "error",
    title: "Database connection failed",
    description: "Connection timeout in us-east-1",
    timestamp: "2 hours ago",
    icon: XCircle,
    iconColor: "text-red-500",
  },
]

export function ActivityFeed() {
  return (
    <div className="space-y-8">
      {activities.map((activity, index) => (
        <div key={index} className="flex items-start gap-4">
          <activity.icon className={`mt-1 h-5 w-5 ${activity.iconColor}`} />
          <div className="space-y-1">
            <p className="text-sm font-medium leading-none">{activity.title}</p>
            <p className="text-sm text-muted-foreground">{activity.description}</p>
            <p className="text-xs text-muted-foreground">{activity.timestamp}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
