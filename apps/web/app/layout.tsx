import type React from "react"
import type { Metadata } from "next"
import { Inter, Inter_Tight, JetBrains_Mono } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"

/**
 * Three faces, one system.
 *
 * Inter for reading, Inter Tight for headlines — same skeleton, tighter
 * apertures, so a heading reads as emphasis rather than as a different voice.
 *
 * JetBrains Mono is the one that matters. Nothing was loading a monospace at
 * all, so every GPU id, temperature and latency figure rendered in whatever
 * the visitor's operating system happened to supply — the numbers are the
 * content in this product, and they were the least controlled thing on the
 * page.
 */
const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" })
const display = Inter_Tight({ subsets: ["latin"], variable: "--font-display", display: "swap" })
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" })

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
      <body className={`${sans.variable} ${display.variable} ${mono.variable} font-sans dark`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
