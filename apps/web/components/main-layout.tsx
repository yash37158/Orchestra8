"use client"

import type React from "react"

import { Bell, Frame, Menu } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { MainNav } from "@/components/main-nav"
import { UserNav } from "@/components/user-nav"
import { MainSidebar } from "@/components/main-sidebar"

export function MainLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 flex h-14 items-center border-b bg-background px-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <Menu className="h-5 w-5" />
          </Button>
          <Link href="/dashboard" className="flex items-center gap-2">
            <Frame className="h-[18px] w-[18px] text-primary" />
            <span className="text-[15px] font-semibold tracking-tight">Orchestr8</span>
          </Link>
          <span className="h-4 w-px bg-border" aria-hidden="true" />
        </div>
        <MainNav className="mx-6" />
        <div className="ml-auto flex items-center gap-4">
          <Button variant="ghost" size="icon">
            <Bell className="h-5 w-5" />
          </Button>
          <UserNav />
        </div>
      </header>
      <div className="flex flex-1">
        <MainSidebar open={sidebarOpen} />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
