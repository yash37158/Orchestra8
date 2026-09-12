"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowRight,
  Cloud,
  Shield,
  Zap,
  BarChart3,
  Globe,
  Database,
  Code2,
  Menu,
  X,
  CheckCircle2,
  ChevronRight,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"

export default function LandingPage() {
  const router = useRouter()
  const [isScrolled, setIsScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Handle scroll effect for navbar
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setIsScrolled(true)
      } else {
        setIsScrolled(false)
      }
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Handle dashboard navigation
  const navigateToDashboard = () => {
    router.push("/dashboard")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-gray-100 antialiased">
      {/* Ambient background effects */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/20 blur-3xl"></div>
        <div className="absolute top-1/3 -left-20 h-60 w-60 rounded-full bg-purple-900/20 blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 h-60 w-60 rounded-full bg-blue-900/20 blur-3xl"></div>
      </div>

      {/* Header */}
      <header
        className={cn(
          "fixed top-0 z-50 w-full transition-all duration-300",
          isScrolled ? "bg-gray-950/80 backdrop-blur-lg border-b border-gray-800/50 shadow-lg" : "bg-transparent",
        )}
      >
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/90 shadow-glow">
              <Cloud className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">Orchestr8</span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <Link href="#features" className="text-sm font-medium text-gray-300 transition-colors hover:text-white">
              Features
            </Link>
            <Link href="#benefits" className="text-sm font-medium text-gray-300 transition-colors hover:text-white">
              Benefits
            </Link>
            <Link href="#testimonials" className="text-sm font-medium text-gray-300 transition-colors hover:text-white">
              Testimonials
            </Link>
            <Link href="#pricing" className="text-sm font-medium text-gray-300 transition-colors hover:text-white">
              Pricing
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={navigateToDashboard}
              className="hidden md:inline-flex text-gray-300 hover:text-white hover:bg-gray-800/50"
            >
              Log In
            </Button>
            <Button
              size="sm"
              onClick={navigateToDashboard}
              className="hidden md:inline-flex bg-primary hover:bg-primary/90 shadow-glow-sm"
            >
              Dashboard
            </Button>

            {/* Mobile menu button */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:w-80 bg-gray-900/95 backdrop-blur-xl border-gray-800">
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between border-b border-gray-800 pb-4">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
                        <Cloud className="h-4 w-4 text-white" />
                      </div>
                      <span className="text-lg font-semibold">Orchestr8</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)}>
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                  <nav className="flex flex-col gap-6 py-8">
                    <Link
                      href="#features"
                      className="text-base font-medium text-gray-300 transition-colors hover:text-white"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Features
                    </Link>
                    <Link
                      href="#benefits"
                      className="text-base font-medium text-gray-300 transition-colors hover:text-white"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Benefits
                    </Link>
                    <Link
                      href="#testimonials"
                      className="text-base font-medium text-gray-300 transition-colors hover:text-white"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Testimonials
                    </Link>
                    <Link
                      href="#pricing"
                      className="text-base font-medium text-gray-300 transition-colors hover:text-white"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Pricing
                    </Link>
                  </nav>
                  <div className="mt-auto flex flex-col gap-4 border-t border-gray-800 pt-6">
                    <Button
                      variant="outline"
                      className="w-full border-gray-700 hover:bg-gray-800"
                      onClick={() => {
                        navigateToDashboard()
                        setMobileMenuOpen(false)
                      }}
                    >
                      Log In
                    </Button>
                    <Button
                      className="w-full bg-primary hover:bg-primary/90 shadow-glow-sm"
                      onClick={() => {
                        navigateToDashboard()
                        setMobileMenuOpen(false)
                      }}
                    >
                      Dashboard
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative pt-24 pb-20 md:pt-32 md:pb-32 overflow-hidden">
          <div className="container mx-auto px-4 relative z-10">
            <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
              <div className="inline-flex items-center rounded-full border border-gray-700 bg-gray-800/50 backdrop-blur-sm px-3 py-1 text-sm mb-8">
                <span className="bg-primary/20 text-primary rounded-full px-2 py-0.5 text-xs font-semibold mr-2">
                  NEW
                </span>
                <span className="text-gray-300">Announcing our next-gen platform</span>
                <ChevronRight className="h-4 w-4 ml-1 text-gray-500" />
              </div>

              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-100 to-gray-300">
                  AI-Powered Multi-Environment
                </span>
                <br />
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-400">
                  Orchestration Platform
                </span>
              </h1>

              <p className="text-lg md:text-xl text-gray-300 max-w-2xl mb-10">
                Seamlessly manage, monitor, and optimize your infrastructure across clouds, edge, and on-prem with our
                intelligent orchestration platform powered by advanced AI.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                <Button
                  size="lg"
                  onClick={navigateToDashboard}
                  className="bg-primary hover:bg-primary/90 shadow-glow-sm w-full sm:w-auto"
                >
                  Get Started <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-gray-700 bg-gray-900/50 backdrop-blur-sm hover:bg-gray-800 w-full sm:w-auto"
                >
                  Watch Demo
                </Button>
              </div>
            </div>

            {/* Dashboard Preview */}
            <div className="mt-16 md:mt-24 max-w-5xl mx-auto">
              <div className="relative">
                {/* Glow effect behind the image */}
                <div className="absolute inset-0 bg-primary/10 rounded-xl blur-2xl transform scale-105"></div>

                {/* Glass card containing the dashboard image */}
                <div className="relative rounded-xl overflow-hidden border border-gray-800/50 bg-gray-900/30 backdrop-blur-md shadow-2xl">
                  <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-transparent"></div>

                  {/* Browser-like header */}
                  <div className="flex items-center gap-1.5 px-4 py-3 border-b border-gray-800/50 bg-gray-900/50">
                    <div className="flex gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-full bg-gray-700"></div>
                      <div className="h-2.5 w-2.5 rounded-full bg-gray-700"></div>
                      <div className="h-2.5 w-2.5 rounded-full bg-gray-700"></div>
                    </div>
                    <div className="ml-4 flex-1 rounded-md bg-gray-800/50 h-6"></div>
                  </div>

                  {/* Dashboard image */}
                  <img
                    src="/placeholder.svg?height=600&width=1200"
                    alt="Orchestr8 Platform Dashboard"
                    className="w-full h-auto"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Decorative elements */}
          <div className="absolute top-1/3 right-0 w-1/3 h-1/3 bg-primary/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-1/4 w-1/4 h-1/4 bg-blue-500/5 rounded-full blur-3xl"></div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20 md:py-32 relative">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-400">
                  Powerful Orchestration Features
                </span>
              </h2>
              <p className="text-gray-300 text-lg">
                Everything you need to manage complex multi-environment deployments with confidence
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* Feature Card 1 */}
              <div className="group">
                <div className="h-full rounded-xl border border-gray-800/50 bg-gray-900/30 backdrop-blur-md p-6 transition-all duration-300 hover:border-primary/50 hover:bg-gray-900/50 hover:shadow-glow-sm">
                  <div className="mb-5 inline-flex items-center justify-center rounded-lg bg-primary/10 p-3 text-primary group-hover:bg-primary/20">
                    <Globe className="h-6 w-6" />
                  </div>
                  <h3 className="mb-2 text-xl font-bold">Multi-Cluster Topology</h3>
                  <p className="mb-4 text-gray-400">
                    Visualize and manage relationships between clusters across environments with our interactive
                    topology map.
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-sm text-gray-300">
                      <CheckCircle2 className="h-4 w-4 text-primary/70" />
                      <span>Real-time health monitoring</span>
                    </li>
                    <li className="flex items-center gap-2 text-sm text-gray-300">
                      <CheckCircle2 className="h-4 w-4 text-primary/70" />
                      <span>Drag-and-drop resource management</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Feature Card 2 */}
              <div className="group">
                <div className="h-full rounded-xl border border-gray-800/50 bg-gray-900/30 backdrop-blur-md p-6 transition-all duration-300 hover:border-primary/50 hover:bg-gray-900/50 hover:shadow-glow-sm">
                  <div className="mb-5 inline-flex items-center justify-center rounded-lg bg-primary/10 p-3 text-primary group-hover:bg-primary/20">
                    <Shield className="h-6 w-6" />
                  </div>
                  <h3 className="mb-2 text-xl font-bold">Security Policies</h3>
                  <p className="mb-4 text-gray-400">
                    Enforce security best practices across all environments with our comprehensive policy engine.
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-sm text-gray-300">
                      <CheckCircle2 className="h-4 w-4 text-primary/70" />
                      <span>Runtime threat detection</span>
                    </li>
                    <li className="flex items-center gap-2 text-sm text-gray-300">
                      <CheckCircle2 className="h-4 w-4 text-primary/70" />
                      <span>Compliance tracking & reporting</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Feature Card 3 */}
              <div className="group">
                <div className="h-full rounded-xl border border-gray-800/50 bg-gray-900/30 backdrop-blur-md p-6 transition-all duration-300 hover:border-primary/50 hover:bg-gray-900/50 hover:shadow-glow-sm">
                  <div className="mb-5 inline-flex items-center justify-center rounded-lg bg-primary/10 p-3 text-primary group-hover:bg-primary/20">
                    <Zap className="h-6 w-6" />
                  </div>
                  <h3 className="mb-2 text-xl font-bold">Edge Node Management</h3>
                  <p className="mb-4 text-gray-400">
                    Deploy and manage applications at the edge with our comprehensive geo-distribution tools.
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-sm text-gray-300">
                      <CheckCircle2 className="h-4 w-4 text-primary/70" />
                      <span>Offline-first workflows</span>
                    </li>
                    <li className="flex items-center gap-2 text-sm text-gray-300">
                      <CheckCircle2 className="h-4 w-4 text-primary/70" />
                      <span>Bandwidth optimization</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Feature Card 4 */}
              <div className="group">
                <div className="h-full rounded-xl border border-gray-800/50 bg-gray-900/30 backdrop-blur-md p-6 transition-all duration-300 hover:border-primary/50 hover:bg-gray-900/50 hover:shadow-glow-sm">
                  <div className="mb-5 inline-flex items-center justify-center rounded-lg bg-primary/10 p-3 text-primary group-hover:bg-primary/20">
                    <BarChart3 className="h-6 w-6" />
                  </div>
                  <h3 className="mb-2 text-xl font-bold">AI Recommendations</h3>
                  <p className="mb-4 text-gray-400">
                    Leverage AI to optimize resource allocation and predict scaling needs before they occur.
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-sm text-gray-300">
                      <CheckCircle2 className="h-4 w-4 text-primary/70" />
                      <span>Predictive scaling</span>
                    </li>
                    <li className="flex items-center gap-2 text-sm text-gray-300">
                      <CheckCircle2 className="h-4 w-4 text-primary/70" />
                      <span>Anomaly detection & remediation</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Feature Card 5 */}
              <div className="group">
                <div className="h-full rounded-xl border border-gray-800/50 bg-gray-900/30 backdrop-blur-md p-6 transition-all duration-300 hover:border-primary/50 hover:bg-gray-900/50 hover:shadow-glow-sm">
                  <div className="mb-5 inline-flex items-center justify-center rounded-lg bg-primary/10 p-3 text-primary group-hover:bg-primary/20">
                    <Database className="h-6 w-6" />
                  </div>
                  <h3 className="mb-2 text-xl font-bold">Unified Data Plane</h3>
                  <p className="mb-4 text-gray-400">
                    Manage data across environments with our unified data plane, ensuring consistency and reliability.
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-sm text-gray-300">
                      <CheckCircle2 className="h-4 w-4 text-primary/70" />
                      <span>Cross-cluster data replication</span>
                    </li>
                    <li className="flex items-center gap-2 text-sm text-gray-300">
                      <CheckCircle2 className="h-4 w-4 text-primary/70" />
                      <span>Automated backup & recovery</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Feature Card 6 */}
              <div className="group">
                <div className="h-full rounded-xl border border-gray-800/50 bg-gray-900/30 backdrop-blur-md p-6 transition-all duration-300 hover:border-primary/50 hover:bg-gray-900/50 hover:shadow-glow-sm">
                  <div className="mb-5 inline-flex items-center justify-center rounded-lg bg-primary/10 p-3 text-primary group-hover:bg-primary/20">
                    <Code2 className="h-6 w-6" />
                  </div>
                  <h3 className="mb-2 text-xl font-bold">GitOps Automation</h3>
                  <p className="mb-4 text-gray-400">
                    Declarative infrastructure as code with automatic drift detection and reconciliation.
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-sm text-gray-300">
                      <CheckCircle2 className="h-4 w-4 text-primary/70" />
                      <span>Multi-repo support</span>
                    </li>
                    <li className="flex items-center gap-2 text-sm text-gray-300">
                      <CheckCircle2 className="h-4 w-4 text-primary/70" />
                      <span>Automated CI/CD integration</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section id="benefits" className="py-20 md:py-32 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-gray-950 via-gray-900/50 to-gray-950"></div>
          <div className="container mx-auto px-4 relative z-10">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-400">
                  Why Choose Orchestr8
                </span>
              </h2>
              <p className="text-gray-300 text-lg">
                Our platform delivers measurable improvements to your infrastructure management
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* Benefit 1 */}
              <Card className="border-gray-800/50 bg-gray-900/30 backdrop-blur-md shadow-xl hover:border-primary/30 transition-all duration-300">
                <CardHeader>
                  <div className="mb-2 rounded-full bg-primary/20 p-2 w-fit">
                    <Zap className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-white">40% Faster Deployments</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-400">
                    Streamlined CI/CD pipelines and intelligent caching reduce deployment times by an average of 40%.
                  </p>
                </CardContent>
              </Card>

              {/* Benefit 2 */}
              <Card className="border-gray-800/50 bg-gray-900/30 backdrop-blur-md shadow-xl hover:border-primary/30 transition-all duration-300">
                <CardHeader>
                  <div className="mb-2 rounded-full bg-primary/20 p-2 w-fit">
                    <Shield className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-white">99.9% Security Compliance</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-400">
                    Automated security scanning and policy enforcement ensure near-perfect compliance with industry
                    standards.
                  </p>
                </CardContent>
              </Card>

              {/* Benefit 3 */}
              <Card className="border-gray-800/50 bg-gray-900/30 backdrop-blur-md shadow-xl hover:border-primary/30 transition-all duration-300">
                <CardHeader>
                  <div className="mb-2 rounded-full bg-primary/20 p-2 w-fit">
                    <BarChart3 className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-white">30% Cost Reduction</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-400">
                    AI-driven resource optimization and intelligent scaling reduce cloud infrastructure costs.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section id="testimonials" className="py-20 md:py-32 relative">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-400">
                  Trusted by Industry Leaders
                </span>
              </h2>
              <p className="text-gray-300 text-lg">See what our customers are saying about Orchestr8</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Testimonial 1 */}
              <div className="rounded-xl border border-gray-800/50 bg-gray-900/30 backdrop-blur-md p-6 shadow-xl">
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-12 w-12 overflow-hidden rounded-full bg-gray-800 ring-2 ring-primary/20">
                    <img
                      src="/placeholder.svg?height=48&width=48"
                      alt="Sarah Johnson"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold">Sarah Johnson</h4>
                    <p className="text-sm text-gray-400">CTO, TechNova</p>
                  </div>
                </div>
                <p className="text-gray-300 italic">
                  "Orchestr8 has transformed how we manage our multi-cloud infrastructure. The AI-driven recommendations
                  alone saved us over $200K in cloud costs last quarter."
                </p>
              </div>

              {/* Testimonial 2 */}
              <div className="rounded-xl border border-gray-800/50 bg-gray-900/30 backdrop-blur-md p-6 shadow-xl">
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-12 w-12 overflow-hidden rounded-full bg-gray-800 ring-2 ring-primary/20">
                    <img
                      src="/placeholder.svg?height=48&width=48"
                      alt="Michael Chen"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold">Michael Chen</h4>
                    <p className="text-sm text-gray-400">VP Engineering, DataFlow</p>
                  </div>
                </div>
                <p className="text-gray-300 italic">
                  "The edge node management capabilities are unmatched. We've deployed to 50+ edge locations with
                  minimal configuration and zero downtime."
                </p>
              </div>

              {/* Testimonial 3 */}
              <div className="rounded-xl border border-gray-800/50 bg-gray-900/30 backdrop-blur-md p-6 shadow-xl">
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-12 w-12 overflow-hidden rounded-full bg-gray-800 ring-2 ring-primary/20">
                    <img
                      src="/placeholder.svg?height=48&width=48"
                      alt="Priya Sharma"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold">Priya Sharma</h4>
                    <p className="text-sm text-gray-400">CISO, SecureBank</p>
                  </div>
                </div>
                <p className="text-gray-300 italic">
                  "Security compliance used to take weeks. With Orchestr8's policy engine, we're continuously compliant
                  with financial regulations across all environments."
                </p>
              </div>
            </div>

            {/* Logos */}
            <div className="mt-16 flex flex-wrap items-center justify-center gap-8 opacity-50">
              <div className="h-8 w-24 bg-gray-700 rounded"></div>
              <div className="h-8 w-24 bg-gray-700 rounded"></div>
              <div className="h-8 w-24 bg-gray-700 rounded"></div>
              <div className="h-8 w-24 bg-gray-700 rounded"></div>
              <div className="h-8 w-24 bg-gray-700 rounded"></div>
              <div className="h-8 w-24 bg-gray-700 rounded"></div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-20 md:py-32 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-gray-950 via-gray-900/50 to-gray-950"></div>
          <div className="container mx-auto px-4 relative z-10">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-400">
                  Simple, Transparent Pricing
                </span>
              </h2>
              <p className="text-gray-300 text-lg">Choose the plan that fits your organization's needs</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {/* Starter Plan */}
              <div className="rounded-xl border border-gray-800/50 bg-gray-900/30 backdrop-blur-md overflow-hidden transition-all duration-300 hover:border-gray-700/70 hover:shadow-xl">
                <div className="p-6 border-b border-gray-800/50">
                  <h3 className="text-xl font-bold mb-4">Starter</h3>
                  <div className="flex items-baseline">
                    <span className="text-4xl font-extrabold">$99</span>
                    <span className="ml-1 text-gray-400">/month</span>
                  </div>
                </div>
                <div className="p-6">
                  <ul className="space-y-4 mb-6">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary/70" />
                      <span>Up to 5 clusters</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary/70" />
                      <span>Basic security scanning</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary/70" />
                      <span>Email support</span>
                    </li>
                  </ul>
                  <Button className="w-full bg-gray-800 hover:bg-gray-700 text-white" onClick={navigateToDashboard}>
                    Get Started
                  </Button>
                </div>
              </div>

              {/* Professional Plan */}
              <div className="rounded-xl border border-primary/30 bg-gray-900/40 backdrop-blur-md overflow-hidden shadow-glow-sm relative transform scale-105 z-10">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-medium text-white shadow-glow-sm">
                  Most Popular
                </div>
                <div className="p-6 border-b border-gray-800/50">
                  <h3 className="text-xl font-bold mb-4">Professional</h3>
                  <div className="flex items-baseline">
                    <span className="text-4xl font-extrabold">$299</span>
                    <span className="ml-1 text-gray-400">/month</span>
                  </div>
                </div>
                <div className="p-6">
                  <ul className="space-y-4 mb-6">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      <span>Up to 20 clusters</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      <span>Advanced security policies</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      <span>Edge node management</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      <span>24/7 priority support</span>
                    </li>
                  </ul>
                  <Button
                    className="w-full bg-primary hover:bg-primary/90 shadow-glow-sm"
                    onClick={navigateToDashboard}
                  >
                    Get Started
                  </Button>
                </div>
              </div>

              {/* Enterprise Plan */}
              <div className="rounded-xl border border-gray-800/50 bg-gray-900/30 backdrop-blur-md overflow-hidden transition-all duration-300 hover:border-gray-700/70 hover:shadow-xl">
                <div className="p-6 border-b border-gray-800/50">
                  <h3 className="text-xl font-bold mb-4">Enterprise</h3>
                  <div className="flex items-baseline">
                    <span className="text-4xl font-extrabold">Custom</span>
                  </div>
                </div>
                <div className="p-6">
                  <ul className="space-y-4 mb-6">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary/70" />
                      <span>Unlimited clusters</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary/70" />
                      <span>Full AI capabilities</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary/70" />
                      <span>Custom integrations</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary/70" />
                      <span>Dedicated support team</span>
                    </li>
                  </ul>
                  <Button
                    variant="outline"
                    className="w-full border-gray-700 hover:bg-gray-800"
                    onClick={navigateToDashboard}
                  >
                    Contact Sales
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 md:py-32">
          <div className="container mx-auto px-4">
            <div className="rounded-2xl overflow-hidden relative">
              {/* Gradient background */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-gray-900 to-gray-900"></div>

              {/* Glass effect overlay */}
              <div className="absolute inset-0 backdrop-blur-sm bg-gray-900/30"></div>

              {/* Content */}
              <div className="relative z-10 p-8 md:p-12 text-center max-w-3xl mx-auto">
                <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to transform your infrastructure?</h2>
                <p className="text-lg text-gray-300 mb-8">
                  Join thousands of companies using Orchestr8 to manage their multi-environment infrastructure with
                  confidence.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Button
                    size="lg"
                    className="bg-primary hover:bg-primary/90 shadow-glow-sm w-full sm:w-auto"
                    onClick={navigateToDashboard}
                  >
                    Start Free Trial
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-gray-600 bg-gray-900/50 hover:bg-gray-800 w-full sm:w-auto"
                  >
                    Schedule Demo
                  </Button>
                </div>
              </div>

              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl"></div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800/50 bg-gray-900/30 backdrop-blur-md py-12 relative">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
                  <Cloud className="h-4 w-4 text-white" />
                </div>
                <span className="text-xl font-bold">Orchestr8</span>
              </div>
              <p className="text-sm text-gray-400 mb-4">
                AI-Driven Multi-Environment Orchestration Platform for modern infrastructure teams.
              </p>
              <div className="flex space-x-4">
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                  </svg>
                </a>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fillRule="evenodd"
                      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                      clipRule="evenodd"
                    />
                  </svg>
                </a>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fillRule="evenodd"
                      d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"
                      clipRule="evenodd"
                    />
                  </svg>
                </a>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium uppercase tracking-wider text-gray-400 mb-4">Product</h3>
              <ul className="space-y-3 text-sm">
                <li>
                  <Link href="#features" className="text-gray-300 hover:text-white transition-colors">
                    Features
                  </Link>
                </li>
                <li>
                  <Link href="#pricing" className="text-gray-300 hover:text-white transition-colors">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-gray-300 hover:text-white transition-colors">
                    Integrations
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-gray-300 hover:text-white transition-colors">
                    Changelog
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-medium uppercase tracking-wider text-gray-400 mb-4">Resources</h3>
              <ul className="space-y-3 text-sm">
                <li>
                  <Link href="#" className="text-gray-300 hover:text-white transition-colors">
                    Documentation
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-gray-300 hover:text-white transition-colors">
                    API Reference
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-gray-300 hover:text-white transition-colors">
                    Blog
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-gray-300 hover:text-white transition-colors">
                    Community
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-medium uppercase tracking-wider text-gray-400 mb-4">Company</h3>
              <ul className="space-y-3 text-sm">
                <li>
                  <Link href="#" className="text-gray-300 hover:text-white transition-colors">
                    About
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-gray-300 hover:text-white transition-colors">
                    Careers
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-gray-300 hover:text-white transition-colors">
                    Contact
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-gray-300 hover:text-white transition-colors">
                    Partners
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-gray-800/50 flex flex-col md:flex-row items-center justify-between">
            <p className="text-sm text-gray-500">© {new Date().getFullYear()} Orchestr8, Inc. All rights reserved.</p>
            <div className="mt-4 md:mt-0 flex space-x-6">
              <Link href="#" className="text-sm text-gray-500 hover:text-gray-300">
                Privacy Policy
              </Link>
              <Link href="#" className="text-sm text-gray-500 hover:text-gray-300">
                Terms of Service
              </Link>
              <Link href="#" className="text-sm text-gray-500 hover:text-gray-300">
                Cookie Policy
              </Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Add custom styles for shadow glow effects */}
      <style jsx global>{`
        .shadow-glow {
          box-shadow: 0 0 15px 2px rgba(14, 165, 233, 0.3);
        }
        .shadow-glow-sm {
          box-shadow: 0 0 10px 1px rgba(14, 165, 233, 0.2);
        }
      `}</style>
    </div>
  )
}
