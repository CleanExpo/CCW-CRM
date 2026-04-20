import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, ArrowRight, HelpCircle } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export const metadata: Metadata = {
  title: 'Pricing - CCW Online ERP',
  description:
    'Transparent pricing for growing equipment supplier businesses. Start free, scale as you grow.',
};

const plans = [
  {
    tier: 'starter',
    name: 'Starter',
    monthlyPrice: 79,
    annualPrice: 790,
    description: 'Perfect for solo operators and small businesses',
    features: [
      '1 location',
      '2 users',
      '500 products',
      'Shopify + Xero integration',
      'Mobile POS (1 terminal)',
      'Email support (24h response)',
      '30-day free trial',
    ],
    cta: 'Start Free Trial',
    popular: false,
  },
  {
    tier: 'professional',
    name: 'Professional',
    monthlyPrice: 299,
    annualPrice: 2990,
    description: 'For growing businesses with multiple locations',
    features: [
      '3 locations',
      '5 users',
      'Unlimited products',
      'Multi-location stock transfers',
      'AI Quote Generation (100/month)',
      'POS (3 terminals)',
      'Priority support (12h response)',
      'Advanced analytics dashboard',
    ],
    cta: 'Start Free Trial',
    popular: true,
  },
  {
    tier: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 999,
    annualPrice: 9990,
    description: 'For established enterprises with advanced needs',
    features: [
      '10 locations',
      'Unlimited users',
      'Unlimited products',
      'AI features (unlimited)',
      'White-label branding',
      'API access (10K calls/hour)',
      'Priority support (4h) + CSM',
      'Custom integrations',
    ],
    cta: 'Start Free Trial',
    popular: false,
  },
  {
    tier: 'custom',
    name: 'Custom',
    monthlyPrice: 2999,
    annualPrice: 29990,
    description: 'Tailored solution for franchises and multi-brand operations',
    features: [
      'Unlimited everything',
      'Enterprise SSO (SAML)',
      '99.9% SLA',
      '24/7 support (1h response)',
      'Dedicated infrastructure',
      'Custom integrations',
      'Onboarding + training',
    ],
    cta: 'Contact Sales',
    popular: false,
  },
];

const faqs = [
  {
    question: 'What happens after my free trial ends?',
    answer:
      'Your 30-day free trial gives you full access to all Starter plan features. After the trial, you can choose to subscribe to any plan or downgrade to our free tier (coming soon). No credit card required to start.',
  },
  {
    question: 'Can I change plans at any time?',
    answer:
      "Yes! You can upgrade or downgrade your plan at any time. When you upgrade, you'll be charged a prorated amount for the remainder of your billing cycle. When you downgrade, you'll receive a credit for your next bill.",
  },
  {
    question: 'What payment methods do you accept?',
    answer:
      'We accept all major credit cards (Visa, Mastercard, American Express) and bank transfers for annual plans. All payments are securely processed through Stripe.',
  },
  {
    question: 'Is there a setup fee?',
    answer:
      'No setup fees. Ever. We believe in transparent pricing. The only cost is your monthly or annual subscription fee.',
  },
  {
    question: 'What if I exceed my plan limits?',
    answer:
      "You'll receive notifications when you approach 80% and 90% of your limits. If you exceed limits, we'll proactively reach out to help you upgrade to a plan that better fits your needs.",
  },
  {
    question: 'Do you offer refunds?',
    answer:
      "We offer a 14-day money-back guarantee on all plans. If you're not satisfied, contact us within 14 days of your first payment for a full refund.",
  },
  {
    question: 'Can I cancel anytime?',
    answer:
      "Yes, you can cancel your subscription at any time. You'll retain access until the end of your current billing period. No cancellation fees.",
  },
  {
    question: 'Do you offer discounts for non-profits or education?',
    answer:
      'Yes! We offer 20% discounts for registered non-profits and educational institutions. Contact sales@ccw-erp.com with your documentation.',
  },
];

export default function PricingPage() {
  return (
    <div className="from-background to-muted/20 min-h-screen bg-gradient-to-b">
      {/* Header */}
      <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 border-b backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="text-xl font-bold">
            CCW Online ERP
          </Link>
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
            <Button asChild>
              <Link href="/login">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container py-20 text-center">
        <Badge variant="secondary" className="mb-4">
          No credit card required
        </Badge>
        <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-6xl">
          Transparent Pricing for Growing Businesses
        </h1>
        <p className="text-muted-foreground mx-auto mb-8 max-w-2xl text-xl">
          Start free, scale as you grow. All plans include 30-day free trial. Cancel anytime.
        </p>
        <div className="text-muted-foreground flex items-center justify-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-green-500" />
            No setup fees
          </div>
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-green-500" />
            Cancel anytime
          </div>
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-green-500" />
            14-day money-back guarantee
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="container pb-20">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <Card
              key={plan.tier}
              className={`relative flex flex-col ${
                plan.popular ? 'border-primary scale-105 shadow-xl' : ''
              }`}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Most Popular</Badge>
              )}

              <CardHeader>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription className="min-h-[48px]">{plan.description}</CardDescription>
              </CardHeader>

              <CardContent className="flex-1 space-y-4">
                {/* Pricing */}
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">${plan.monthlyPrice}</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    or ${plan.annualPrice}/year (save 20%)
                  </p>
                </div>

                {/* Features */}
                <ul className="space-y-2 text-sm">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="text-primary mt-0.5 h-4 w-4 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter>
                <Button className="w-full" variant={plan.popular ? 'default' : 'outline'} asChild>
                  <Link href={plan.tier === 'custom' ? '/contacts' : '/login'}>
                    {plan.cta}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-muted-foreground text-sm">
            All prices in AUD (Australian Dollars). Prices exclude GST where applicable.
          </p>
        </div>
      </section>

      {/* Feature Comparison Table */}
      <section className="container pb-20">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold">Compare Plans</h2>
          <p className="text-muted-foreground">Detailed feature comparison across all plans</p>
        </div>

        <Card>
          <CardContent className="p-8">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-4 text-left font-semibold">Feature</th>
                    <th className="py-4 text-center font-semibold">Starter</th>
                    <th className="bg-primary/5 py-4 text-center font-semibold">Professional</th>
                    <th className="py-4 text-center font-semibold">Enterprise</th>
                    <th className="py-4 text-center font-semibold">Custom</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-4">Locations</td>
                    <td className="text-center">1</td>
                    <td className="bg-primary/5 text-center">3</td>
                    <td className="text-center">10</td>
                    <td className="text-center">Unlimited</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-4">Users</td>
                    <td className="text-center">2</td>
                    <td className="bg-primary/5 text-center">5</td>
                    <td className="text-center">Unlimited</td>
                    <td className="text-center">Unlimited</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-4">Products</td>
                    <td className="text-center">500</td>
                    <td className="bg-primary/5 text-center">Unlimited</td>
                    <td className="text-center">Unlimited</td>
                    <td className="text-center">Unlimited</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-4">AI Quote Generation</td>
                    <td className="text-center">-</td>
                    <td className="bg-primary/5 text-center">100/month</td>
                    <td className="text-center">Unlimited</td>
                    <td className="text-center">Unlimited</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-4">API Access</td>
                    <td className="text-center">-</td>
                    <td className="bg-primary/5 text-center">-</td>
                    <td className="text-center">
                      <Check className="inline h-4 w-4 text-green-500" />
                    </td>
                    <td className="text-center">
                      <Check className="inline h-4 w-4 text-green-500" />
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-4">White-label Branding</td>
                    <td className="text-center">-</td>
                    <td className="bg-primary/5 text-center">-</td>
                    <td className="text-center">
                      <Check className="inline h-4 w-4 text-green-500" />
                    </td>
                    <td className="text-center">
                      <Check className="inline h-4 w-4 text-green-500" />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-4">Support Response Time</td>
                    <td className="text-center">24h</td>
                    <td className="bg-primary/5 text-center">12h</td>
                    <td className="text-center">4h + CSM</td>
                    <td className="text-center">1h + 24/7</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* FAQ */}
      <section className="container pb-20">
        <div className="mb-12 text-center">
          <HelpCircle className="text-primary mx-auto mb-4 h-12 w-12" />
          <h2 className="mb-4 text-3xl font-bold">Frequently Asked Questions</h2>
          <p className="text-muted-foreground">
            Everything you need to know about pricing and billing
          </p>
        </div>

        <Card className="mx-auto max-w-3xl">
          <CardContent className="p-6">
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`}>
                  <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>

        <div className="mt-12 text-center">
          <p className="text-muted-foreground mb-4">Still have questions?</p>
          <Button variant="outline" asChild>
            <Link href="/contacts">
              Contact Sales
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* CTA */}
      <section className="container pb-20">
        <Card className="bg-primary text-primary-foreground">
          <CardContent className="p-12 text-center">
            <h2 className="mb-4 text-3xl font-bold">
              Ready to streamline your equipment business?
            </h2>
            <p className="mb-8 text-xl opacity-90">
              Start your 30-day free trial today. No credit card required.
            </p>
            <Button size="lg" variant="secondary" asChild>
              <Link href="/login">
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="text-muted-foreground container text-center text-sm">
          <p>&copy; 2026 CCW Online ERP. All rights reserved.</p>
          <div className="mt-4 flex items-center justify-center gap-6">
            <Link href="/privacy" className="hover:text-foreground">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Terms of Service
            </Link>
            <Link href="/contacts" className="hover:text-foreground">
              Contact
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
