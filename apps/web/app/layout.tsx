import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  // Named for what it is. The previous title described a different product
  // and credited the tool that scaffolded the prototype.
  title: {
    default: "Orchestr8 — GPU and inference observability",
    template: "%s · Orchestr8",
  },
  description:
    "Correlates GPU telemetry with inference latency, so a slow model points at a cause rather than a symptom. For teams serving their own models on their own hardware.",
  robots: { index: true, follow: true },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} dark`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
