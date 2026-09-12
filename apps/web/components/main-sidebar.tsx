"use client"

import { BarChart3, Cog, Globe2, History, LayoutDashboard, Lock, Network } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"

const sidebarItems = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    href: "/dashboard",
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
        "fixed inset-y-0 left-0 z-40 flex w-[228px] -translate-x-full flex-col border-r bg-background transition-transform md:sticky md:translate-x-0",
        open && "translate-x-0",
      )}
    >
      <ScrollArea className="flex-1 px-3 py-5">
        <p className="mb-2 px-3 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/70">
          Monitor
        </p>
        <nav className="space-y-0.5">
          {sidebarItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/")
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] transition-colors",
                  // Active state is carried by the accent rail plus weight, not
                  // by a filled block — a filled row competes with the data.
                  active
                    ? "bg-accent font-medium text-foreground shadow-[inset_2px_0_0_0_hsl(var(--primary))]"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                <item.icon className={cn("h-4 w-4 shrink-0", active && "text-primary")} />
                {item.title}
              </Link>
            )
          })}
        </nav>
      </ScrollArea>
    </aside>
  )
}
