"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GlassButton } from "@/components/ui/glass-button";
import {
  Settings,
  User,
  CreditCard,
  Building2,
  Plug,
  Users,
  Globe,
  Bell,
  Shield,
  Palette,
  ArrowRight
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import Image from "next/image";

const settingsSections = [
  {
    title: "Account Settings",
    description: "Manage your personal profile, password, and preferences",
    icon: User,
    href: "/settings/account",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    span: 1,
  },
  {
    title: "Company Profile",
    description: "Update company information, logo, and business details",
    icon: Building2,
    href: "/settings/company",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    span: 1,
  },
  {
    title: "Team Management",
    description: "Invite team members, manage roles, and set permissions",
    icon: Users,
    href: "/settings/team",
    color: "text-teal-500",
    bgColor: "bg-teal-500/10",
    span: 1,
  },
  {
    title: "Billing & Subscription",
    description: "View invoices, update payment methods, and manage your plan",
    icon: CreditCard,
    href: "/settings/billing",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    span: 1,
  },
  {
    title: "Integrations",
    description: "Connect with Xero, Shopify, Stripe, and other tools",
    icon: Plug,
    href: "/settings/integrations",
    color: "text-pink-500",
    bgColor: "bg-pink-500/10",
    span: 2,
    featured: true,
  },
  {
    title: "Translations",
    description: "Manage multi-language support and AI-powered translations",
    icon: Globe,
    href: "/settings/translations",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    span: 1,
  },
];

const integrations = [
  { name: "Xero", domain: "xero.com", connected: true },
  { name: "Shopify", domain: "shopify.com", connected: true },
  { name: "Stripe", domain: "stripe.com", connected: false },
  { name: "Square", domain: "squareup.com", connected: false },
];

export default function SettingsPage() {
  return (
    <div className="space-y-8 pb-12">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="space-y-2">
            <Badge variant="outline">
              <Settings className="w-3 h-3 mr-2" />
              Settings
            </Badge>
            <h1 className="text-4xl font-semibold tracking-tight">
              System Settings
            </h1>
            <p className="text-muted-foreground text-lg">
              Configure your account, team, integrations, and system preferences
            </p>
          </div>
        </div>
      </motion.div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {settingsSections.map((section, index) => {
          const Icon = section.icon;

          return (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`${section.span === 2 ? "md:col-span-2" : ""}`}
            >
              <Link href={section.href as any}>
                <Card className="h-full border-border hover:border-brand-primary/50 transition-all hover:scale-[1.02] hover:shadow-xl cursor-pointer group">
                  <CardHeader>
                    <div className="flex items-start justify-between mb-3">
                      <div className={`p-3 rounded-lg ${section.bgColor}`}>
                        <Icon className={`w-6 h-6 ${section.color}`} />
                      </div>
                      <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-brand-primary group-hover:translate-x-1 transition-all" />
                    </div>
                    <CardTitle className="text-xl">{section.title}</CardTitle>
                    <CardDescription className="text-sm leading-relaxed">
                      {section.description}
                    </CardDescription>
                  </CardHeader>

                  {/* Featured Section - Show integrations */}
                  {section.featured && (
                    <CardContent>
                      <div className="space-y-3">
                        <p className="text-sm font-medium text-muted-foreground">
                          Connected Services
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {integrations.map((integration) => (
                            <div
                              key={integration.name}
                              className="flex items-center gap-2 p-2 rounded-lg border border-border bg-background/50"
                            >
                              <Image
                                src={`https://logo.clearbit.com/${integration.domain}`}
                                alt={integration.name}
                                width={24}
                                height={24}
                                className="w-6 h-6 rounded"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">
                                  {integration.name}
                                </p>
                              </div>
                              <div
                                className={`w-2 h-2 rounded-full ${
                                  integration.connected
                                    ? "bg-green-500"
                                    : "bg-muted"
                                }`}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              </Link>
            </motion.div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
      >
        <Card className="border-brand-primary/20 bg-gradient-brand/5">
          <CardContent className="p-6">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="space-y-3">
                <div className="p-2 rounded-lg bg-brand-primary/10 w-fit">
                  <Bell className="w-5 h-5 text-brand-primary" />
                </div>
                <h3 className="text-lg font-semibold">Notifications</h3>
                <p className="text-sm text-muted-foreground">
                  Configure email alerts, system notifications, and real-time updates
                </p>
                <GlassButton size="sm">Configure</GlassButton>
              </div>

              <div className="space-y-3">
                <div className="p-2 rounded-lg bg-brand-primary/10 w-fit">
                  <Shield className="w-5 h-5 text-brand-primary" />
                </div>
                <h3 className="text-lg font-semibold">Security</h3>
                <p className="text-sm text-muted-foreground">
                  Manage two-factor authentication, API keys, and access logs
                </p>
                <GlassButton size="sm">View Security</GlassButton>
              </div>

              <div className="space-y-3">
                <div className="p-2 rounded-lg bg-brand-primary/10 w-fit">
                  <Palette className="w-5 h-5 text-brand-primary" />
                </div>
                <h3 className="text-lg font-semibold">Appearance</h3>
                <p className="text-sm text-muted-foreground">
                  Customize theme, logo, colors, and branding for your account
                </p>
                <GlassButton size="sm">Customize</GlassButton>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
