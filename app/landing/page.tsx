import Link from "next/link"
import { ArrowRight, BarChart3, Cloud, Code2, Database, Globe, Shield, Zap } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Navigation */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
              <Cloud className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">Orchestr8</span>
          </div>
          <nav className="hidden gap-6 md:flex">
            <Link
              href="#features"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Features
            </Link>
            <Link
              href="#benefits"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Benefits
            </Link>
            <Link
              href="#testimonials"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Testimonials
            </Link>
            <Link
              href="#pricing"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Pricing
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="outline" size="sm">
                Log In
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="bg-primary hover:bg-primary/90">
                Sign Up Free
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden py-20 md:py-32">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/20 via-background to-background"></div>
          <div className="container relative z-10 mx-auto px-4 text-center">
            <h1 className="mb-6 text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
              AI-Driven Multi-Environment
              <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
                {" "}
                Orchestration
              </span>
            </h1>
            <p className="mx-auto mb-10 max-w-2xl text-xl text-muted-foreground">
              Seamlessly manage, monitor, and optimize your infrastructure across clouds, edge, and on-prem with our
              intelligent orchestration platform.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/signup">
                <Button size="lg" className="bg-primary hover:bg-primary/90">
                  Get Started <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/demo">
                <Button size="lg" variant="outline">
                  Request Demo
                </Button>
              </Link>
            </div>

            <div className="mt-16 rounded-lg border border-border/50 bg-card/50 p-1 shadow-xl backdrop-blur">
              <img
                src="/placeholder.svg?height=600&width=1200"
                alt="Orchestr8 Platform Dashboard"
                className="rounded-md shadow-lg"
              />
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20">
          <div className="container">
            <div className="mb-16 text-center">
              <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">Powerful Orchestration Features</h2>
              <p className="mx-auto max-w-2xl text-muted-foreground">
                Everything you need to manage complex multi-environment deployments with confidence
              </p>
            </div>

            <Tabs defaultValue="clusters" className="mx-auto max-w-4xl">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="clusters">Clusters</TabsTrigger>
                <TabsTrigger value="edge">Edge Nodes</TabsTrigger>
                <TabsTrigger value="security">Security</TabsTrigger>
                <TabsTrigger value="ai">AI Insights</TabsTrigger>
              </TabsList>
              <TabsContent value="clusters" className="mt-6">
                <div className="overflow-hidden rounded-lg border">
                  <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <h3 className="text-xl font-bold">Multi-Cluster Topology</h3>
                      <p className="text-muted-foreground">
                        Visualize and manage relationships between clusters across environments with our interactive
                        topology map.
                      </p>
                      <ul className="mt-2 space-y-2">
                        <li className="flex items-center gap-2">
                          <div className="rounded-full bg-green-500/20 p-1">
                            <Zap className="h-4 w-4 text-green-500" />
                          </div>
                          <span>Real-time health monitoring</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="rounded-full bg-green-500/20 p-1">
                            <Zap className="h-4 w-4 text-green-500" />
                          </div>
                          <span>Drag-and-drop resource management</span>
                        </li>
                      </ul>
                    </div>
                    <div className="rounded-md border bg-card p-1">
                      <img src="/placeholder.svg?height=200&width=400" alt="Cluster Topology" className="rounded" />
                    </div>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="edge" className="mt-6">
                <div className="overflow-hidden rounded-lg border">
                  <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <h3 className="text-xl font-bold">Edge Node Management</h3>
                      <p className="text-muted-foreground">
                        Deploy and manage applications at the edge with our comprehensive geo-distribution tools.
                      </p>
                      <ul className="mt-2 space-y-2">
                        <li className="flex items-center gap-2">
                          <div className="rounded-full bg-green-500/20 p-1">
                            <Zap className="h-4 w-4 text-green-500" />
                          </div>
                          <span>Offline-first workflows</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="rounded-full bg-green-500/20 p-1">
                            <Zap className="h-4 w-4 text-green-500" />
                          </div>
                          <span>Bandwidth optimization</span>
                        </li>
                      </ul>
                    </div>
                    <div className="rounded-md border bg-card p-1">
                      <img src="/placeholder.svg?height=200&width=400" alt="Edge Node Map" className="rounded" />
                    </div>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="security" className="mt-6">
                <div className="overflow-hidden rounded-lg border">
                  <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <h3 className="text-xl font-bold">Security Policies</h3>
                      <p className="text-muted-foreground">
                        Enforce security best practices across all environments with our policy engine.
                      </p>
                      <ul className="mt-2 space-y-2">
                        <li className="flex items-center gap-2">
                          <div className="rounded-full bg-green-500/20 p-1">
                            <Zap className="h-4 w-4 text-green-500" />
                          </div>
                          <span>Runtime threat detection</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="rounded-full bg-green-500/20 p-1">
                            <Zap className="h-4 w-4 text-green-500" />
                          </div>
                          <span>Compliance tracking</span>
                        </li>
                      </ul>
                    </div>
                    <div className="rounded-md border bg-card p-1">
                      <img src="/placeholder.svg?height=200&width=400" alt="Security Dashboard" className="rounded" />
                    </div>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="ai" className="mt-6">
                <div className="overflow-hidden rounded-lg border">
                  <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <h3 className="text-xl font-bold">AI Recommendations</h3>
                      <p className="text-muted-foreground">
                        Leverage AI to optimize resource allocation and predict scaling needs.
                      </p>
                      <ul className="mt-2 space-y-2">
                        <li className="flex items-center gap-2">
                          <div className="rounded-full bg-green-500/20 p-1">
                            <Zap className="h-4 w-4 text-green-500" />
                          </div>
                          <span>Predictive scaling</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="rounded-full bg-green-500/20 p-1">
                            <Zap className="h-4 w-4 text-green-500" />
                          </div>
                          <span>Anomaly detection</span>
                        </li>
                      </ul>
                    </div>
                    <div className="rounded-md border bg-card p-1">
                      <img
                        src="/placeholder.svg?height=200&width=400"
                        alt="AI Insights Dashboard"
                        className="rounded"
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </section>

        {/* Benefits Section */}
        <section id="benefits" className="bg-card/30 py-20">
          <div className="container">
            <div className="mb-16 text-center">
              <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">Why Choose Orchestr8</h2>
              <p className="mx-auto max-w-2xl text-muted-foreground">
                Our platform delivers measurable improvements to your infrastructure management
              </p>
            </div>

            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              <Card className="border-border/50 bg-card/50 backdrop-blur">
                <CardHeader>
                  <div className="mb-2 rounded-full bg-primary/20 p-2 w-fit">
                    <Zap className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>40% Faster Deployments</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Streamlined CI/CD pipelines and intelligent caching reduce deployment times by an average of 40%.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/50 backdrop-blur">
                <CardHeader>
                  <div className="mb-2 rounded-full bg-primary/20 p-2 w-fit">
                    <Shield className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>99.9% Security Compliance</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Automated security scanning and policy enforcement ensure near-perfect compliance with industry
                    standards.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/50 backdrop-blur">
                <CardHeader>
                  <div className="mb-2 rounded-full bg-primary/20 p-2 w-fit">
                    <BarChart3 className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>30% Cost Reduction</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    AI-driven resource optimization and intelligent scaling reduce cloud infrastructure costs.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/50 backdrop-blur">
                <CardHeader>
                  <div className="mb-2 rounded-full bg-primary/20 p-2 w-fit">
                    <Globe className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Global Edge Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Deploy to 200+ edge locations worldwide with a single click, reducing latency by up to 80%.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/50 backdrop-blur">
                <CardHeader>
                  <div className="mb-2 rounded-full bg-primary/20 p-2 w-fit">
                    <Database className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Unified Data Plane</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Manage data across environments with our unified data plane, ensuring consistency and reliability.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/50 backdrop-blur">
                <CardHeader>
                  <div className="mb-2 rounded-full bg-primary/20 p-2 w-fit">
                    <Code2 className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>GitOps Automation</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Declarative infrastructure as code with automatic drift detection and reconciliation.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section id="testimonials" className="py-20">
          <div className="container">
            <div className="mb-16 text-center">
              <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">Trusted by Industry Leaders</h2>
              <p className="mx-auto max-w-2xl text-muted-foreground">
                See what our customers are saying about Orchestr8
              </p>
            </div>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              <Card className="border-border/50 bg-card/50 backdrop-blur">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 overflow-hidden rounded-full bg-muted">
                      <img
                        src="/placeholder.svg?height=40&width=40"
                        alt="Sarah Johnson"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div>
                      <CardTitle className="text-base">Sarah Johnson</CardTitle>
                      <CardDescription>CTO, TechNova</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    "Orchestr8 has transformed how we manage our multi-cloud infrastructure. The AI-driven
                    recommendations alone saved us over $200K in cloud costs last quarter."
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/50 backdrop-blur">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 overflow-hidden rounded-full bg-muted">
                      <img
                        src="/placeholder.svg?height=40&width=40"
                        alt="Michael Chen"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div>
                      <CardTitle className="text-base">Michael Chen</CardTitle>
                      <CardDescription>VP Engineering, DataFlow</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    "The edge node management capabilities are unmatched. We've deployed to 50+ edge locations with
                    minimal configuration and zero downtime."
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/50 backdrop-blur">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 overflow-hidden rounded-full bg-muted">
                      <img
                        src="/placeholder.svg?height=40&width=40"
                        alt="Priya Sharma"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div>
                      <CardTitle className="text-base">Priya Sharma</CardTitle>
                      <CardDescription>CISO, SecureBank</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    "Security compliance used to take weeks. With Orchestr8's policy engine, we're continuously
                    compliant with financial regulations across all environments."
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="mt-16 flex flex-wrap items-center justify-center gap-8 opacity-70">
              <div className="h-8 w-24 bg-muted"></div>
              <div className="h-8 w-24 bg-muted"></div>
              <div className="h-8 w-24 bg-muted"></div>
              <div className="h-8 w-24 bg-muted"></div>
              <div className="h-8 w-24 bg-muted"></div>
              <div className="h-8 w-24 bg-muted"></div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="bg-card/30 py-20">
          <div className="container">
            <div className="mb-16 text-center">
              <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">Simple, Transparent Pricing</h2>
              <p className="mx-auto max-w-2xl text-muted-foreground">
                Choose the plan that fits your organization's needs
              </p>
            </div>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              <Card className="border-border/50 bg-card/50 backdrop-blur">
                <CardHeader>
                  <CardTitle>Starter</CardTitle>
                  <div className="mt-4 flex items-baseline">
                    <span className="text-4xl font-extrabold">$99</span>
                    <span className="ml-1 text-muted-foreground">/month</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    <li className="flex items-center gap-2">
                      <div className="rounded-full bg-green-500/20 p-1">
                        <Zap className="h-3 w-3 text-green-500" />
                      </div>
                      <span>Up to 5 clusters</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="rounded-full bg-green-500/20 p-1">
                        <Zap className="h-3 w-3 text-green-500" />
                      </div>
                      <span>Basic security scanning</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="rounded-full bg-green-500/20 p-1">
                        <Zap className="h-3 w-3 text-green-500" />
                      </div>
                      <span>Email support</span>
                    </li>
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button className="w-full">Get Started</Button>
                </CardFooter>
              </Card>

              <Card className="relative border-primary/50 bg-card/50 backdrop-blur">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                  Most Popular
                </div>
                <CardHeader>
                  <CardTitle>Professional</CardTitle>
                  <div className="mt-4 flex items-baseline">
                    <span className="text-4xl font-extrabold">$299</span>
                    <span className="ml-1 text-muted-foreground">/month</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    <li className="flex items-center gap-2">
                      <div className="rounded-full bg-green-500/20 p-1">
                        <Zap className="h-3 w-3 text-green-500" />
                      </div>
                      <span>Up to 20 clusters</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="rounded-full bg-green-500/20 p-1">
                        <Zap className="h-3 w-3 text-green-500" />
                      </div>
                      <span>Advanced security policies</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="rounded-full bg-green-500/20 p-1">
                        <Zap className="h-3 w-3 text-green-500" />
                      </div>
                      <span>Edge node management</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="rounded-full bg-green-500/20 p-1">
                        <Zap className="h-3 w-3 text-green-500" />
                      </div>
                      <span>24/7 priority support</span>
                    </li>
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button className="w-full bg-primary hover:bg-primary/90">Get Started</Button>
                </CardFooter>
              </Card>

              <Card className="border-border/50 bg-card/50 backdrop-blur">
                <CardHeader>
                  <CardTitle>Enterprise</CardTitle>
                  <div className="mt-4 flex items-baseline">
                    <span className="text-4xl font-extrabold">Custom</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    <li className="flex items-center gap-2">
                      <div className="rounded-full bg-green-500/20 p-1">
                        <Zap className="h-3 w-3 text-green-500" />
                      </div>
                      <span>Unlimited clusters</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="rounded-full bg-green-500/20 p-1">
                        <Zap className="h-3 w-3 text-green-500" />
                      </div>
                      <span>Full AI capabilities</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="rounded-full bg-green-500/20 p-1">
                        <Zap className="h-3 w-3 text-green-500" />
                      </div>
                      <span>Custom integrations</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="rounded-full bg-green-500/20 p-1">
                        <Zap className="h-3 w-3 text-green-500" />
                      </div>
                      <span>Dedicated support team</span>
                    </li>
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button variant="outline" className="w-full">
                    Contact Sales
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20">
          <div className="container">
            <div className="rounded-xl bg-gradient-to-r from-primary/20 to-blue-900/20 p-8 md:p-12">
              <div className="mx-auto max-w-3xl text-center">
                <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
                  Ready to transform your infrastructure?
                </h2>
                <p className="mb-8 text-lg text-muted-foreground">
                  Join thousands of companies using Orchestr8 to manage their multi-environment infrastructure with
                  confidence.
                </p>
                <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                  <Button size="lg" className="bg-primary hover:bg-primary/90">
                    Start Free Trial
                  </Button>
                  <Button size="lg" variant="outline">
                    Schedule Demo
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-card/30 py-12">
        <div className="container">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-5">
            <div className="col-span-2 lg:col-span-1">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
                  <Cloud className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="text-xl font-bold">Orchestr8</span>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                AI-Driven Multi-Environment Orchestration Platform for modern infrastructure teams.
              </p>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-medium">Product</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="#" className="text-muted-foreground hover:text-foreground">
                    Features
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-muted-foreground hover:text-foreground">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-muted-foreground hover:text-foreground">
                    Integrations
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-muted-foreground hover:text-foreground">
                    Changelog
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-medium">Resources</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="#" className="text-muted-foreground hover:text-foreground">
                    Documentation
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-muted-foreground hover:text-foreground">
                    API Reference
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-muted-foreground hover:text-foreground">
                    Blog
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-muted-foreground hover:text-foreground">
                    Community
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-medium">Company</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="#" className="text-muted-foreground hover:text-foreground">
                    About
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-muted-foreground hover:text-foreground">
                    Careers
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-muted-foreground hover:text-foreground">
                    Contact
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-muted-foreground hover:text-foreground">
                    Partners
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center justify-between border-t border-border/40 pt-8 md:flex-row">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Orchestr8, Inc. All rights reserved.
            </p>
            <div className="mt-4 flex space-x-6 md:mt-0">
              <Link href="#" className="text-muted-foreground hover:text-foreground">
                <span className="sr-only">Twitter</span>
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                </svg>
              </Link>
              <Link href="#" className="text-muted-foreground hover:text-foreground">
                <span className="sr-only">GitHub</span>
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fillRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    clipRule="evenodd"
                  />
                </svg>
              </Link>
              <Link href="#" className="text-muted-foreground hover:text-foreground">
                <span className="sr-only">LinkedIn</span>
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fillRule="evenodd"
                    d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"
                    clipRule="evenodd"
                  />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
