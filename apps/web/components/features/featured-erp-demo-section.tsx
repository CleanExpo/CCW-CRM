"use client";

import { Card, CardContent } from "@/components/ui/card";
import { GlassButton } from "@/components/ui/glass-button";
import Image from "next/image";
import { useState } from "react";
import { PlayCircle, Package, TrendingUp, FileText, Users } from "lucide-react";
import Link from "next/link";

const erpFeatures = [
  {
    title: "Inventory Tracking",
    subtitle: "Monitor stock levels across multiple locations in real-time with automated alerts for low stock and reorder points.",
    icon: Package
  },
  {
    title: "AI-Powered Insights",
    subtitle: "Leverage advanced analytics to forecast demand, identify trends, and optimize your inventory and pricing strategies.",
    icon: TrendingUp
  },
  {
    title: "Quote Generation",
    subtitle: "Create professional quotes in seconds with AI recommendations, automated pricing, and product suggestions.",
    icon: FileText
  },
  {
    title: "Customer Portal",
    subtitle: "Provide 24/7 access for customers to view orders, track shipments, download invoices, and request quotes online.",
    icon: Users
  }
];

const integrations = [
  { name: "Xero", subtitle: "Accounting software", domain: "xero.com" },
  { name: "Shopify", subtitle: "E-commerce platform", domain: "shopify.com" },
  { name: "Stripe", subtitle: "Payment processing", domain: "stripe.com" },
  { name: "Square", subtitle: "POS & payments", domain: "squareup.com" },
  { name: "QuickBooks", subtitle: "Accounting platform", domain: "quickbooks.intuit.com" },
  { name: "WooCommerce", subtitle: "WordPress e-commerce", domain: "woocommerce.com" },
  { name: "Mailchimp", subtitle: "Email marketing", domain: "mailchimp.com" },
  { name: "Zendesk", subtitle: "Customer support", domain: "zendesk.com" },
];

export default function FeaturedErpDemoSection() {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className="max-w-7xl mx-auto bg-background">
      {/* Header */}
      <header className="text-left py-12 space-y-4">
        <h1 className="text-5xl md:text-6xl font-semibold tracking-tight leading-tight">
          Equipment ERP
          <br />
          Built for Modern Distributors
        </h1>
        <p className="text-xl text-muted-foreground max-w-3xl">
          Streamline your operations with intelligent inventory management, automated workflows, and AI-powered insights.
        </p>
      </header>

      {/* Demo Grid */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-12">
        {/* Main video/image card */}
        <Card className="lg:col-span-2 bg-muted/50 p-2 overflow-hidden relative min-h-[500px] flex flex-col">
          <CardContent className="p-0 relative flex-grow group">
            {isPlaying ? (
              <div className="w-full h-full rounded-lg bg-zinc-900 flex items-center justify-center">
                <p className="text-muted-foreground text-sm">
                  Video demo would play here
                  <br />
                  <span className="text-xs">(Video integration pending)</span>
                </p>
              </div>
            ) : (
              <>
                <Image
                  width={800}
                  height={600}
                  src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=600&fit=crop&q=80"
                  alt="CCW-Online ERP Dashboard Preview"
                  className="w-full h-full object-cover rounded-lg"
                  priority
                />

                {/* Play button overlay */}
                <button
                  onClick={() => setIsPlaying(true)}
                  className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20"
                  aria-label="Play demo video"
                >
                  <div className="bg-brand-primary/90 rounded-full p-4 hover:bg-brand-primary transition-colors">
                    <PlayCircle className="w-12 h-12 sm:w-16 sm:h-16 text-white" />
                  </div>
                </button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
          {erpFeatures.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <div
                key={i}
                className="flex flex-col border border-border rounded-xl p-4 hover:shadow-lg hover:border-brand-primary/50 cursor-pointer transition-all group"
              >
                {/* Icon Card */}
                <div className="bg-gradient-brand/10 rounded-lg p-6 flex items-center justify-center flex-grow mb-3 group-hover:bg-gradient-brand/20 transition-colors">
                  <Icon className="w-8 h-8 text-brand-primary" />
                </div>

                {/* Title + Subtitle */}
                <div>
                  <h3 className="text-sm font-semibold mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {feature.subtitle}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 border-y border-border">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-2xl font-semibold mb-2">
              Ready to Transform Your Operations?
            </h2>
            <p className="text-muted-foreground">
              Start managing your equipment business with modern tools built for growth.
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/dashboard">
              <GlassButton size="lg">Get Started</GlassButton>
            </Link>
            <Link href={"/welcome" as any}>
              <GlassButton size="lg">Learn More</GlassButton>
            </Link>
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section className="py-12">
        <h2 className="text-2xl font-semibold mb-6">Integrations</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {integrations.map((integration) => (
            <div
              key={integration.name}
              className="p-4 flex items-center gap-3 hover:bg-muted rounded-xl transition-colors border border-transparent hover:border-border"
            >
              <Image
                src={`https://logo.clearbit.com/${integration.domain}`}
                alt={`${integration.name} logo`}
                width={40}
                height={40}
                className="w-10 h-10 object-contain rounded-lg bg-white p-1"
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{integration.name}</div>
                <div className="text-xs text-muted-foreground truncate">{integration.subtitle}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-12 border-t border-border">
        <p className="text-muted-foreground mb-4">
          Trusted by equipment suppliers across Australia and New Zealand
        </p>
        <Link href="/dashboard">
          <GlassButton>Start Your Free Trial</GlassButton>
        </Link>
      </footer>
    </div>
  );
}
