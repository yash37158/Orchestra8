"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Menu, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

export function MobileNav() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex flex-col">
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold">Orchestr8</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <nav className="flex flex-col gap-4 py-4">
          <Link
            href="#features"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => setOpen(false)}
          >
            Features
          </Link>
          <Link
            href="#benefits"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => setOpen(false)}
          >
            Benefits
          </Link>
          <Link
            href="#testimonials"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => setOpen(false)}
          >
            Testimonials
          </Link>
          <Link
            href="#pricing"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => setOpen(false)}
          >
            Pricing
          </Link>
        </nav>
        <div className="mt-auto flex flex-col gap-2">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              router.push("/dashboard")
              setOpen(false)
            }}
          >
            Dashboard
          </Button>
          <Button className="w-full bg-primary hover:bg-primary/90" onClick={() => setOpen(false)}>
            Sign Up Free
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
