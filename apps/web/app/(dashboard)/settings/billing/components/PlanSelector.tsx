"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import type { SubscriptionTier, BillingInterval } from "@/lib/api/billing";

export interface PlanConfig {
  tier: SubscriptionTier;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  description: string;
  features: string[];
  limits: {
    locations: number;  // -1 = unlimited
    users: number;      // -1 = unlimited
    products: number;   // -1 = unlimited
    aiQuotes: number;   // -1 = unlimited
  };
  popular?: boolean;
}

const PLANS: PlanConfig[] = [
  {
    tier: "starter",
    name: "Starter",
    monthlyPrice: 79,
    annualPrice: 790,
    description: "Perfect for solo operators and small businesses",
    features: [
      "1 location",
      "2 users",
      "500 products",
      "Shopify + Xero integration",
      "Mobile POS (1 terminal)",
      "Email support (24h response)",
    ],
    limits: {
      locations: 1,
      users: 2,
      products: 500,
      aiQuotes: 0,
    },
  },
  {
    tier: "professional",
    name: "Professional",
    monthlyPrice: 299,
    annualPrice: 2990,
    description: "For growing businesses with multiple locations",
    features: [
      "3 locations",
      "5 users",
      "Unlimited products",
      "Multi-location stock transfers",
      "AI Quote Generation (100/month)",
      "POS (3 terminals)",
      "Priority support (12h response)",
    ],
    limits: {
      locations: 3,
      users: 5,
      products: -1,  // Unlimited
      aiQuotes: 100,
    },
    popular: true,
  },
  {
    tier: "enterprise",
    name: "Enterprise",
    monthlyPrice: 999,
    annualPrice: 9990,
    description: "For established enterprises with advanced needs",
    features: [
      "10 locations",
      "Unlimited users",
      "Unlimited products",
      "AI features (unlimited)",
      "White-label branding",
      "API access (10K calls/hour)",
      "Priority support (4h) + CSM",
    ],
    limits: {
      locations: 10,
      users: -1,      // Unlimited
      products: -1,   // Unlimited
      aiQuotes: -1,   // Unlimited
    },
  },
  {
    tier: "custom",
    name: "Custom",
    monthlyPrice: 2999,
    annualPrice: 29990,
    description: "Tailored solution for franchises and multi-brand operations",
    features: [
      "Unlimited everything",
      "Enterprise SSO (SAML)",
      "99.9% SLA",
      "24/7 support (1h response)",
      "Dedicated infrastructure",
      "Custom integrations",
    ],
    limits: {
      locations: -1,  // Unlimited
      users: -1,      // Unlimited
      products: -1,   // Unlimited
      aiQuotes: -1,   // Unlimited
    },
  },
];

interface PlanSelectorProps {
  currentTier?: SubscriptionTier;
  currentInterval?: BillingInterval;
  onSelectPlan: (tier: SubscriptionTier, interval: BillingInterval) => void;
}

export function PlanSelector({ currentTier, currentInterval = "monthly", onSelectPlan }: PlanSelectorProps) {
  const [billingInterval, setBillingInterval] = useState<BillingInterval>(currentInterval);

  const getPrice = (plan: PlanConfig) => {
    return billingInterval === "monthly" ? plan.monthlyPrice : plan.annualPrice;
  };

  const getSavingsPercent = () => {
    return 20; // 20% savings on annual billing
  };

  return (
    <div className="space-y-6">
      {/* Billing interval toggle */}
      <div className="flex items-center justify-center gap-4">
        <span className={billingInterval === "monthly" ? "font-medium" : "text-muted-foreground"}>
          Monthly
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setBillingInterval(billingInterval === "monthly" ? "annual" : "monthly")}
          className="relative"
        >
          {billingInterval === "monthly" ? "Switch to Annual" : "Switch to Monthly"}
          {billingInterval === "monthly" && (
            <Badge variant="secondary" className="ml-2">
              Save {getSavingsPercent()}%
            </Badge>
          )}
        </Button>
        <span className={billingInterval === "annual" ? "font-medium" : "text-muted-foreground"}>
          Annual
        </span>
      </div>

      {/* Plans grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((plan) => {
          const price = getPrice(plan);
          const isCurrentPlan = plan.tier === currentTier && billingInterval === currentInterval;

          return (
            <Card
              key={plan.tier}
              className={`relative ${plan.popular ? "border-primary shadow-lg" : ""} ${
                isCurrentPlan ? "ring-2 ring-primary" : ""
              }`}
            >
              {plan.popular && (
                <Badge className="absolute -top-2 left-1/2 -translate-x-1/2">Most Popular</Badge>
              )}
              {isCurrentPlan && (
                <Badge variant="secondary" className="absolute -top-2 right-4">
                  Current Plan
                </Badge>
              )}

              <CardHeader>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Pricing */}
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">${price}</span>
                    <span className="text-muted-foreground">/{billingInterval === "monthly" ? "mo" : "yr"}</span>
                  </div>
                  {billingInterval === "annual" && (
                    <p className="text-sm text-muted-foreground">
                      ${(price / 12).toFixed(0)}/month when billed annually
                    </p>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-2 text-sm">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter>
                <Button
                  className="w-full"
                  variant={plan.popular ? "default" : "outline"}
                  onClick={() => onSelectPlan(plan.tier, billingInterval)}
                  disabled={isCurrentPlan}
                >
                  {isCurrentPlan ? "Current Plan" : `Select ${plan.name}`}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
