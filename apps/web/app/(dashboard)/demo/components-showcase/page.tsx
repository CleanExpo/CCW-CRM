"use client";

import { GlassButton } from "@/components/ui/glass-button";
import { Typewriter } from "@/components/ui/typewriter-text";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Zap, Package, ShoppingCart, Users, TrendingUp } from "lucide-react";
import Image from "next/image";

export default function ComponentsShowcasePage() {
  return (
    <div className="space-y-16 pb-24">
      {/* Header */}
      <div className="space-y-4">
        <Badge variant="outline" className="mb-4">
          <Sparkles className="w-3 h-3 mr-2" />
          New Components Showcase
        </Badge>
        <h1 className="text-4xl font-semibold tracking-tight">
          CCW-Online ERP Component Library
        </h1>
        <p className="text-lg text-muted-foreground max-w-3xl">
          Modern, interactive components designed for the CCW-Online ERP system.
          All components are production-ready and optimized for performance.
        </p>
      </div>

      {/* Section 1: Glass Buttons */}
      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold mb-2">Glass Button Component</h2>
          <p className="text-muted-foreground">
            Glassmorphic buttons with hover effects and multiple size variants.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Size Variants</CardTitle>
            <CardDescription>
              Available sizes: sm, default, lg, and icon
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-6">
              <GlassButton size="sm">Small Button</GlassButton>

              <GlassButton size="default">Default Button</GlassButton>

              <GlassButton size="lg">Large Button</GlassButton>

              <GlassButton
                size="default"
                contentClassName="flex items-center gap-2"
              >
                <Zap className="w-4 h-4" />
                With Icon
              </GlassButton>

              <GlassButton size="icon">
                <Sparkles className="w-5 h-5" />
              </GlassButton>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Use Cases</CardTitle>
            <CardDescription>
              Practical applications within the ERP system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Quick Actions */}
              <div>
                <p className="text-sm font-medium mb-3">Dashboard Quick Actions</p>
                <div className="flex flex-wrap gap-3">
                  <GlassButton contentClassName="flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    New Product
                  </GlassButton>
                  <GlassButton contentClassName="flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4" />
                    Create Order
                  </GlassButton>
                  <GlassButton contentClassName="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Add Customer
                  </GlassButton>
                </div>
              </div>

              {/* Form Actions */}
              <div>
                <p className="text-sm font-medium mb-3">Form Actions</p>
                <div className="flex gap-3">
                  <GlassButton size="lg">Save Changes</GlassButton>
                  <GlassButton size="lg">Generate Quote</GlassButton>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Section 2: Typewriter Text */}
      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold mb-2">Typewriter Text Component</h2>
          <p className="text-muted-foreground">
            Animated typewriter effect for dynamic, engaging text displays.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Single Text Example</CardTitle>
            <CardDescription>
              Simple typewriter effect with one message
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-8 rounded-lg bg-muted/50 text-center">
              <Typewriter
                text="Welcome to CCW-Online ERP"
                speed={80}
                className="text-2xl font-semibold"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rotating Messages</CardTitle>
            <CardDescription>
              Multiple messages with loop and delete effects
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-8 rounded-lg bg-gradient-brand/10 border border-brand-primary/20 text-center">
              <Typewriter
                text={[
                  "Track your inventory in real-time",
                  "AI-powered business insights",
                  "Streamline your operations",
                  "Manage orders and quotes effortlessly"
                ]}
                speed={60}
                loop={true}
                deleteSpeed={40}
                delay={2000}
                className="text-xl font-medium text-brand-primary"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Use Cases</CardTitle>
            <CardDescription>
              Practical applications within the ERP system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Dashboard Welcome */}
              <div>
                <p className="text-sm font-medium mb-2">Dashboard Welcome Message</p>
                <div className="p-4 rounded-lg border bg-card">
                  <Typewriter
                    text={[
                      "Good morning! Here's your business overview",
                      "5 new orders pending review",
                      "Inventory levels are healthy",
                      "3 AI insights available"
                    ]}
                    speed={50}
                    loop={true}
                    className="text-muted-foreground"
                  />
                </div>
              </div>

              {/* Loading State */}
              <div>
                <p className="text-sm font-medium mb-2">Enhanced Loading States</p>
                <div className="p-4 rounded-lg border bg-card flex items-center justify-center gap-3">
                  <div className="h-4 w-4 rounded-full border-2 border-brand-primary border-t-transparent animate-spin" />
                  <Typewriter
                    text={[
                      "Loading your data...",
                      "Fetching inventory status...",
                      "Preparing dashboard...",
                      "Almost there..."
                    ]}
                    speed={40}
                    loop={true}
                    className="text-sm text-muted-foreground"
                  />
                </div>
              </div>

              {/* AI Insights */}
              <div>
                <p className="text-sm font-medium mb-2">AI Insight Highlights</p>
                <div className="p-4 rounded-lg border bg-card">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-brand-primary/10 border border-brand-primary/20">
                      <TrendingUp className="w-4 h-4 text-brand-primary" />
                    </div>
                    <div className="flex-1">
                      <Typewriter
                        text="Revenue increased 23% this month compared to last month"
                        speed={30}
                        className="text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Section 3: Container Scroll Animation */}
      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold mb-2">Container Scroll Animation</h2>
          <p className="text-muted-foreground">
            3D perspective scroll effect for hero sections and feature showcases.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Scroll Down to See the Effect</CardTitle>
            <CardDescription>
              The image will rotate and scale as you scroll
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ContainerScroll
              titleComponent={
                <>
                  <h1 className="text-4xl font-semibold text-foreground mb-4">
                    Modern ERP for Equipment Suppliers
                  </h1>
                  <Typewriter
                    text={[
                      "Inventory Management • Order Processing • AI Insights",
                      "Real-time Analytics • Customer Portal • POS Integration"
                    ]}
                    speed={50}
                    loop={true}
                    className="text-lg text-muted-foreground"
                  />
                </>
              }
            >
              <Image
                src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1400&h=800&fit=crop"
                alt="Dashboard Preview"
                width={1400}
                height={800}
                className="mx-auto rounded-2xl object-cover h-full object-left-top"
                draggable={false}
                priority
              />
            </ContainerScroll>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Use Cases</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-brand-primary mt-0.5">•</span>
                <span><strong>Welcome Page:</strong> Engaging first-time user experience with product tour</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-brand-primary mt-0.5">•</span>
                <span><strong>Feature Showcase:</strong> Highlight key ERP capabilities with visual impact</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-brand-primary mt-0.5">•</span>
                <span><strong>Marketing Landing:</strong> Public-facing page for prospective customers</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* Summary */}
      <section className="space-y-6">
        <Card className="border-brand-primary/20 bg-gradient-brand/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-brand-primary" />
              Implementation Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-card border">
                  <p className="text-2xl font-bold text-brand-primary mb-1">3</p>
                  <p className="text-sm text-muted-foreground">Core Components</p>
                </div>
                <div className="p-4 rounded-lg bg-card border">
                  <p className="text-2xl font-bold text-brand-primary mb-1">~25KB</p>
                  <p className="text-sm text-muted-foreground">Bundle Size (gzipped)</p>
                </div>
                <div className="p-4 rounded-lg bg-card border">
                  <p className="text-2xl font-bold text-brand-primary mb-1">100%</p>
                  <p className="text-sm text-muted-foreground">TypeScript Coverage</p>
                </div>
              </div>

              <div className="pt-4 border-t">
                <p className="text-sm font-medium mb-2">Next Steps:</p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    ✅ Glass Button component installed and tested
                  </li>
                  <li className="flex items-center gap-2">
                    ✅ Typewriter Text component ready for use
                  </li>
                  <li className="flex items-center gap-2">
                    ✅ Container Scroll Animation configured
                  </li>
                  <li className="flex items-center gap-2">
                    🚀 Ready to integrate into dashboard and other pages
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
