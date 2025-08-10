"use client"

import { BarChart3, Cog, Globe2, History, LayoutDashboard, Lock, Network } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

const sidebarItems = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    href: "/",
  },
  {
    title: "Multi-Cluster View",
    icon: Network,
    href: "/clusters",
  },
  {
    title: "AI Recommendations",
    icon: BarChart3,
    href: "/ai",
  },
  {
    title: "Security Policies",
    icon: Lock,
    href: "/security",
  },
  {
    title: "Edge Nodes",
    icon: Globe2,
    href: "/edge",
  },
  {
    title: "Audit Ledger",
    icon: History,
    href: "/audit",
  },
  {
    title: "Settings",
    icon: Cog,
    href: "/settings",
  },
]

export function MainSidebar({ open }: { open: boolean }) {
  const pathname = usePathname()
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex w-64 -translate-x-full flex-col border-r bg-background transition-transform md:sticky md:translate-x-0",
        open && "translate-x-0",
      )}
    >
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {sidebarItems.map((item) => (
            <Button
              key={item.href}
              variant={pathname === item.href ? "secondary" : "ghost"}
              className="w-full justify-start"
              asChild
            >
              <Link href={item.href}>
                <item.icon className="mr-2 h-5 w-5" />
                {item.title}
              </Link>
            </Button>
          ))}
        </nav>
      </ScrollArea>
    </aside>
  )
}
