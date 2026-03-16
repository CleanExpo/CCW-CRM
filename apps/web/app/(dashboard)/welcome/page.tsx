"use client";

import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import { Typewriter } from "@/components/ui/typewriter-text";
import { GlassButton } from "@/components/ui/glass-button";
import { BentoGrid, BentoCard, BentoCardHeader, BentoCardTitle, BentoCardDescription, BentoCardContent } from "@/components/ui/bento-grid";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  ShoppingCart,
  Users,
  TrendingUp,
  Sparkles,
  FileText,
  BarChart3,
  Zap,
  Shield,
  Rocket,
  CheckCircle2,
  ArrowRight
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

const features = [
  {
    icon: Package,
    title: "Inventory Management",
    description: "Track stock levels across multiple warehouses in real-time with automated reorder points and low-stock alerts.",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10"
  },
  {
    icon: ShoppingCart,
    title: "Order Processing",
    description: "Streamline your entire order lifecycle from quote generation to delivery with automated workflows.",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10"
  },
  {
    icon: Users,
    title: "Customer Portal",
    description: "Give your customers 24/7 access to order history, invoices, and real-time shipment tracking.",
    color: "text-teal-500",
    bgColor: "bg-teal-500/10"
  },
  {
    icon: TrendingUp,
    title: "AI-Powered Analytics",
    description: "Get actionable insights from your business data with advanced AI analytics and forecasting.",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10"
  },
  {
    icon: Sparkles,
    title: "Quote Generation",
    description: "Generate professional quotes in seconds with AI-powered pricing recommendations and product suggestions.",
    color: "text-pink-500",
    bgColor: "bg-pink-500/10"
  },
  {
    icon: BarChart3,
    title: "Real-Time Reporting",
    description: "Monitor business performance with live dashboards, custom reports, and automated email digests.",
    color: "text-green-500",
    bgColor: "bg-green-500/10"
  }
];

const benefits = [
  { icon: Zap, text: "5x faster order processing" },
  { icon: Shield, text: "99.99% uptime guarantee" },
  { icon: Rocket, text: "Deploy in less than 1 hour" },
  { icon: CheckCircle2, text: "No credit card required" }
];

export default function WelcomePage() {
  return (
    <div className="space-y-0">
      {/* Hero Section with Scroll Animation */}
      <div className="relative -mt-8 -mx-8">
        <ContainerScroll
          titleComponent={
            <div className="space-y-6 max-w-4xl mx-auto text-center px-4">
              <Badge variant="outline" className="mb-2">
                <Sparkles className="w-3 h-3 mr-2" />
                Welcome to CCW-Online ERP
              </Badge>

              <h1 className="text-5xl md:text-7xl font-semibold tracking-tight leading-tight">
                Modern ERP for
                <br />
                <span className="text-gradient">Equipment Suppliers</span>
              </h1>

              <div className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
                <Typewriter
                  text={[
                    "Inventory Management • Order Processing • AI Insights",
                    "Real-time Analytics • Customer Portal • POS Integration",
                    "Quote Generation • Shipment Tracking • Multi-Location"
                  ]}
                  speed={50}
                  loop={true}
                  className="block"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                <Link href="/dashboard">
                  <GlassButton size="lg" contentClassName="flex items-center gap-2">
                    Get Started
                    <ArrowRight className="w-5 h-5" />
                  </GlassButton>
                </Link>
                <Link href={"/demo-showcase" as any}>
                  <GlassButton size="lg" contentClassName="flex items-center gap-2">
                    View Demo
                    <Sparkles className="w-5 h-5" />
                  </GlassButton>
                </Link>
              </div>
            </div>
          }
        >
          <Image
            src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1400&h=800&fit=crop&q=80"
            alt="CCW-Online ERP Dashboard"
            width={1400}
            height={800}
            className="mx-auto rounded-2xl object-cover h-full object-left-top"
            draggable={false}
            priority
          />
        </ContainerScroll>
      </div>

      {/* Features Section */}
      <div className="py-24 px-4 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-7xl mx-auto space-y-16"
        >
          {/* Section Header */}
          <div className="text-center space-y-4">
            <Badge variant="outline" className="mb-2">
              <Zap className="w-3 h-3 mr-2" />
              Powerful Features
            </Badge>
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight">
              Everything You Need to Run
              <br />
              Your Equipment Business
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Built specifically for equipment suppliers and distributors who demand speed, reliability, and intelligence.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <Card className="h-full border-white/10 bg-card/50 hover:bg-card/80 transition-all hover:scale-105 hover:shadow-xl">
                    <CardContent className="p-6 space-y-4">
                      <div className={`p-3 rounded-lg w-fit ${feature.bgColor}`}>
                        <Icon className={`w-6 h-6 ${feature.color}`} />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {feature.description}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* Benefits Bar */}
      <div className="py-12 px-4 md:px-8 bg-gradient-brand/5 border-y border-brand-primary/20">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon;
              return (
                <motion.div
                  key={benefit.text}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  className="flex items-center gap-3 justify-center"
                >
                  <Icon className="w-5 h-5 text-brand-primary flex-shrink-0" />
                  <span className="text-sm font-medium">{benefit.text}</span>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Quick Start Section */}
      <div className="py-24 px-4 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-4xl mx-auto"
        >
          <Card className="border-brand-primary/20 bg-gradient-brand/5 overflow-hidden">
            <CardContent className="p-8 md:p-12 space-y-6">
              <div className="text-center space-y-4">
                <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
                  Ready to Get Started?
                </h2>
                <p className="text-lg text-muted-foreground">
                  Jump right into your dashboard or explore our features with a guided tour.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-4 pt-4">
                <Link href="/dashboard" className="block">
                  <Card className="h-full border-white/10 hover:border-brand-primary/50 transition-all hover:scale-105 cursor-pointer group">
                    <CardContent className="p-6 text-center space-y-3">
                      <div className="w-12 h-12 rounded-full bg-brand-primary/10 flex items-center justify-center mx-auto group-hover:bg-brand-primary/20 transition-colors">
                        <BarChart3 className="w-6 h-6 text-brand-primary" />
                      </div>
                      <h3 className="font-semibold">Dashboard</h3>
                      <p className="text-sm text-muted-foreground">
                        View your business metrics
                      </p>
                    </CardContent>
                  </Card>
                </Link>

                <Link href="/products" className="block">
                  <Card className="h-full border-white/10 hover:border-brand-primary/50 transition-all hover:scale-105 cursor-pointer group">
                    <CardContent className="p-6 text-center space-y-3">
                      <div className="w-12 h-12 rounded-full bg-brand-primary/10 flex items-center justify-center mx-auto group-hover:bg-brand-primary/20 transition-colors">
                        <Package className="w-6 h-6 text-brand-primary" />
                      </div>
                      <h3 className="font-semibold">Products</h3>
                      <p className="text-sm text-muted-foreground">
                        Manage your inventory
                      </p>
                    </CardContent>
                  </Card>
                </Link>

                <Link href="/orders" className="block">
                  <Card className="h-full border-white/10 hover:border-brand-primary/50 transition-all hover:scale-105 cursor-pointer group">
                    <CardContent className="p-6 text-center space-y-3">
                      <div className="w-12 h-12 rounded-full bg-brand-primary/10 flex items-center justify-center mx-auto group-hover:bg-brand-primary/20 transition-colors">
                        <ShoppingCart className="w-6 h-6 text-brand-primary" />
                      </div>
                      <h3 className="font-semibold">Orders</h3>
                      <p className="text-sm text-muted-foreground">
                        Process customer orders
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              </div>

              <div className="flex justify-center pt-4">
                <Link href={"/demo-showcase" as any}>
                  <GlassButton size="lg" contentClassName="flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    View Full Demo
                  </GlassButton>
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
