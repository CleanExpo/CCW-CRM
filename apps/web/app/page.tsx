"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { BentoGrid, BentoCard, BentoCardHeader, BentoCardTitle, BentoCardDescription, BentoCardContent } from "@/components/ui/bento-grid";
import { BorderBeam } from "@/components/ui/border-beam";
import {
  Sparkles,
  Users,
  Package,
  BarChart3,
  Zap,
  Globe
} from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-black">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-24 md:py-32">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center space-y-6 max-w-5xl mx-auto"
        >
          <h1 className="text-5xl md:text-7xl font-semibold tracking-tight">
            <span className="text-gradient bg-gradient-brand bg-clip-text text-transparent">
              iBaaS ERP/CRM
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
            High-end ERP system for Australian & New Zealand SMBs.
            <br className="hidden md:block" />
            AI-powered marketing, intelligent CRM, and streamlined operations.
          </p>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="flex flex-col sm:flex-row gap-4 justify-center pt-4"
          >
            <Button
              variant="gradient"
              size="lg"
              className="text-base"
              asChild
            >
              <Link href="/login">Get Started</Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="text-base"
              asChild
            >
              <Link href="/dashboard">View Demo</Link>
            </Button>
          </motion.div>
        </motion.div>
      </section>

      {/* Feature Bento Grid */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <BentoGrid columns={3} gap="lg">
            {/* AI Marketing Engine - Large Featured Card */}
            <BorderBeam>
              <BentoCard
                span={2}
                variant="glass"
                glowOnHover
                className="min-h-[300px]"
              >
                <BentoCardHeader>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 rounded-lg bg-gradient-brand/10 border border-white/10">
                      <Sparkles className="w-6 h-6 text-brand-primary" />
                    </div>
                    <BentoCardTitle className="text-2xl">AI Marketing Engine</BentoCardTitle>
                  </div>
                  <BentoCardDescription className="text-base">
                    Generate professional marketing assets directly within your CRM.
                    Create images, copy, and campaigns with AI-powered tools.
                  </BentoCardDescription>
                </BentoCardHeader>
                <BentoCardContent>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-brand-secondary" />
                      <span>DALL-E 3 image generation</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-brand-secondary" />
                      <span>GPT-4 powered copywriting</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-brand-secondary" />
                      <span>Asset library management</span>
                    </div>
                  </div>
                </BentoCardContent>
              </BentoCard>
            </BorderBeam>

            {/* Smart CRM */}
            <BentoCard variant="gradient" className="min-h-[300px]">
              <BentoCardHeader>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-lg bg-white/10">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <BentoCardTitle className="text-white">Smart CRM</BentoCardTitle>
                </div>
                <BentoCardDescription className="text-white/80">
                  Manage customers, track interactions, and close deals faster with intelligent insights.
                </BentoCardDescription>
              </BentoCardHeader>
            </BentoCard>

            {/* ERP Operations */}
            <BentoCard variant="glass" className="min-h-[280px]">
              <BentoCardHeader>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-lg bg-gradient-brand/10 border border-white/10">
                    <Package className="w-6 h-6 text-brand-accent" />
                  </div>
                  <BentoCardTitle>ERP Operations</BentoCardTitle>
                </div>
                <BentoCardDescription>
                  Inventory, orders, purchasing, and warehouse management in one platform.
                </BentoCardDescription>
              </BentoCardHeader>
            </BentoCard>

            {/* Real-time Analytics */}
            <BentoCard variant="elevated" span={2} className="min-h-[280px]">
              <BentoCardHeader>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-lg bg-gradient-brand/10">
                    <BarChart3 className="w-6 h-6 text-brand-primary" />
                  </div>
                  <BentoCardTitle className="text-2xl">Real-time Analytics</BentoCardTitle>
                </div>
                <BentoCardDescription className="text-base">
                  Comprehensive dashboards with live data. Track sales, inventory, and performance metrics
                  across all your operations in Australia and New Zealand.
                </BentoCardDescription>
              </BentoCardHeader>
              <BentoCardContent>
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-brand-primary">99.9%</div>
                    <div className="text-xs text-muted-foreground mt-1">Uptime</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-brand-secondary">&lt; 200ms</div>
                    <div className="text-xs text-muted-foreground mt-1">Response Time</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-brand-accent">AU/NZ</div>
                    <div className="text-xs text-muted-foreground mt-1">Data Centers</div>
                  </div>
                </div>
              </BentoCardContent>
            </BentoCard>

            {/* Regional Focus */}
            <BentoCard variant="glass" glowOnHover className="min-h-[280px]">
              <BentoCardHeader>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-lg bg-gradient-brand/10 border border-white/10">
                    <Globe className="w-6 h-6 text-success" />
                  </div>
                  <BentoCardTitle>Built for AU/NZ</BentoCardTitle>
                </div>
                <BentoCardDescription>
                  Local currency, GST compliance, and Australia Post integration out of the box.
                </BentoCardDescription>
              </BentoCardHeader>
            </BentoCard>
          </BentoGrid>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-12 border-t border-white/10">
        <div className="text-center text-sm text-muted-foreground">
          <p>© 2026 iBaaS ERP/CRM. Built for SMBs in Australia & New Zealand.</p>
        </div>
      </footer>
    </div>
  );
}
