# SaaS Billing & Monetization Guide for CCW-Online ERP

## Research Report: Modern SaaS Monetization Patterns for ERP Systems (2026)

**Research Date:** 16 March 2026
**Expiration:** 14 June 2026 (90-day review cycle)
**Researcher:** Research Analyst (Synthex)
**Aggregate Confidence:** 0.85/1.0 (Tier: V2 - Corroborated)

---

## SCOPE

### Question
What are the most effective billing, subscription management, and monetization strategies for a B2B ERP SaaS platform in 2026, and how should CCW-Online ERP implement them?

### In Scope
- SaaS pricing models (freemium, tiered, usage-based, hybrid)
- Billing infrastructure providers (Stripe, Paddle, LemonSqueezy)
- Subscription management features and self-service portals
- Revenue operations metrics (MRR, ARR, churn, LTV)
- Tax compliance and international billing
- Payment failure handling and dunning strategies
- Integration architecture for Next.js 15 + FastAPI

### Out of Scope
- Enterprise custom contracts (requires legal review)
- Cryptocurrency payment options (market too volatile in 2026)
- Complex multi-currency hedging strategies
- White-label reseller models (future consideration)

---

## EXECUTIVE SUMMARY

In 2026, successful B2B SaaS companies use hybrid pricing models that combine base subscription tiers with usage-based components. For ERP systems specifically, the optimal approach is **seat-based tiers with usage overages** for features like AI translations, API calls, or document storage.

**Key Findings:**
1. **Hybrid pricing** (base + usage) grows revenue 2x faster than seat-only models
2. **Stripe** remains the best choice for developers building custom billing infrastructure, while **Paddle** wins for zero-tax-work global sales
3. **Self-service portals** reduce support tickets by 40-60% and improve customer satisfaction
4. **Smart dunning** can recover 56% of failed payments automatically
5. **Proration is table stakes** — customers expect immediate upgrades with fair billing

The recommended implementation: Start with Stripe for maximum flexibility, implement 3-4 pricing tiers with clear differentiation, add a customer portal for self-service, and plan for usage-based features in Phase 2.

---

## FINDINGS

### Finding 1: Hybrid Pricing Models Dominate B2B SaaS in 2026

**Confidence:** 0.9 (Tier: V1 - Verified)

**Evidence:**
Hybrid SaaS pricing combines a base subscription fee with usage-based overages. Companies that incorporated a usage-based element grew revenue nearly 2x faster than those that relied only on per-seat models. By 2022, 61% of SaaS companies were using some form of usage-based model, and this has accelerated in 2026 with AI-driven features creating natural usage metrics.

For ERP systems specifically, the base subscription covers core modules (inventory, orders, customers, quotes) while usage charges apply to:
- AI-powered translations beyond included quota
- API calls for integrations
- Document storage beyond base allowance
- Advanced analytics queries
- AI search and recommendations

**Rationale:** Predictable base revenue for financial planning + upside capture as customers scale their usage. Aligns pricing with value delivery — heavy users pay more, light users don't feel overcharged.

**Sources:** [S1], [S2], [S8], [S14]

**Relevance to CCW-Online ERP:**
The existing i18n system with Ollama integration creates a perfect usage metric. Offer 100-500 translations/month in base tier, then charge per 1,000 translations beyond that. Future AI features (Phase 4: semantic search, recommendations) also lend themselves to usage-based pricing.

---

### Finding 2: Stripe vs Paddle vs LemonSqueezy — Choose Based on Business Stage

**Confidence:** 0.85 (Tier: V2 - Corroborated)

**Evidence:**
After processing $10K through each platform, real-world testing reveals:

| Platform | Best For | Fees | Tax Handling | Onboarding |
|----------|----------|------|--------------|------------|
| **Stripe** | Custom billing, API-first, scale | 2.9% + $0.30 (but add 2-3% for intl + tax tools) | Manual (or +$0.50/txn for Stripe Tax) | Instant for developers |
| **Paddle** | Global SaaS, zero tax work | 5% + $0.50 | Fully automated (MoR) | 2-5 day approval |
| **LemonSqueezy** | Indie hackers, MVPs, digital products | 5% + $0.50 | Fully automated (MoR) | Instant |

**2026 Update:** Stripe acquired LemonSqueezy in July 2024, and while it operates independently, long-term roadmap is uncertain. Stripe also announced a private beta Merchant of Record solution at 3.5% fee on top of standard rates.

**Decision Matrix:**
- **Choose Stripe if:** You have engineering resources, want maximum customization, plan to build complex billing logic, or expect $100K+ MRR where lower fees matter.
- **Choose Paddle if:** You're selling globally, want zero tax compliance work, and the 5% fee is worth avoiding VAT nightmares across 200+ jurisdictions.
- **Choose LemonSqueezy if:** You're an indie hacker launching an MVP and want to ship fast (but watch for acquisition impacts).

**Sources:** [S3], [S4], [S5], [S11], [S12]

**Relevance to CCW-Online ERP:**
**Recommendation: Start with Stripe.** CCW has the technical capability (Next.js + FastAPI stack), already handles auth/DB complexity, and will benefit from Stripe's flexibility for custom ERP billing (per-module pricing, usage metering, complex proration). Tax compliance can start with Stripe Tax ($0.50/txn) and migrate to Paddle if international sales exceed 40% of revenue.

---

### Finding 3: ERP SaaS Pricing Benchmarks for Small-to-Medium Businesses

**Confidence:** 0.75 (Tier: V2 - Corroborated)

**Evidence:**
Analysis of 10+ manufacturing and equipment ERP systems reveals:

**Pricing Ranges (2026):**
- **Entry Tier (Small Business):** $40-125/user/month or $1,500-2,500/month flat
- **Professional Tier (Growing Business):** $125-250/user/month or $3,000-6,000/month flat
- **Enterprise Tier (Scale):** Custom pricing, typically $10K-50K minimum annual contract

**Examples:**
- Cetec ERP: $40/user/month (SaaS model, manufacturing-focused)
- NetSuite: $125/user/month minimum + $10K implementation
- Acumatica: $1,800/month base (unlimited users) — innovative pricing
- Epicor Kinetic: $125/user/month + $50K implementation

**Key Insight:** The market is split between **per-user pricing** (simpler to understand, easier to budget) and **flat-rate pricing** (appeals to teams that want to add users freely). Unlimited user models like Acumatica's are gaining traction for collaborative environments.

**Sources:** [S9], [S10]

**Relevance to CCW-Online ERP:**
Since CCW is building for internal use first (equipment supplier operations), the pricing model should optimize for **future commercialization**. Recommended approach:

**Suggested Tiers:**
1. **Starter** (1-5 users, core modules): $199/month flat
2. **Professional** (6-25 users, + integrations): $599/month flat
3. **Business** (26-100 users, + AI features): $1,499/month flat
4. **Enterprise** (unlimited users, custom modules): Custom pricing

Flat-rate pricing avoids the "seat sprawl" problem where teams resist adding users to save costs. Usage charges apply for AI translations, API calls, and storage beyond base allowances.

---

### Finding 4: Self-Service Customer Portal Reduces Support Burden by 40-60%

**Confidence:** 0.85 (Tier: V2 - Corroborated)

**Evidence:**
A customer portal assists users in managing subscriptions, updating payment details, viewing billing history, and independently upgrading or downgrading plans, which lowers support inquiries and increases customer satisfaction.

**Essential Portal Features:**
1. **Subscription Management**
   - View current plan and usage
   - Upgrade/downgrade with immediate effect or end-of-period scheduling
   - Cancel subscription (with retention offers)

2. **Billing & Invoices**
   - View and download invoices (PDF, CSV)
   - Update payment method (credit card, bank account)
   - View payment history and failed payment status

3. **Usage Dashboards**
   - Real-time usage metrics (translations used, API calls, storage)
   - Quota warnings before overage charges
   - Historical usage charts

4. **Team Management** (for multi-user plans)
   - Add/remove team members
   - Assign roles and permissions
   - View per-user activity logs

**Implementation Options:**
- **Stripe Customer Portal** (built-in, customizable, free): Covers basics but limited UI customization
- **Custom Portal** (full control): More dev time but better UX integration with existing dashboard

**Sources:** [S6], [S7]

**Relevance to CCW-Online ERP:**
CCW already has a dashboard layout (`apps/web/app/(dashboard)/layout.tsx`) with sidebar navigation. **Recommendation:** Add a new `/dashboard/billing` route with:
- Current plan display (tier, renewal date, billing cycle)
- Usage meters (translations used, API calls, storage)
- Invoice history (list with download links)
- Payment method update (using Stripe Payment Element)
- Upgrade/downgrade flow with proration preview

Use Stripe's pre-built Customer Portal as a fallback/alternative for customers who prefer it.

---

### Finding 5: Smart Dunning Recovers 56% of Failed Payments

**Confidence:** 0.9 (Tier: V1 - Verified)

**Evidence:**
Twenty-five percent of lapsed subscriptions are purely due to payment failures, occurring for reasons such as insufficient funds, expired cards, or technical problems. Dunning (automated payment retry + customer communication) can achieve 38-57% recovery rates, with Stripe's Smart Retries recovering 56% of failed payments on average.

**Stripe Smart Retries:**
Smart Retries use data points (time of day, day of week, card type, customer history) to find the optimal time to retry failed payments. This is more effective than fixed-schedule retries (e.g., every 3 days).

**Best Practices:**
1. **Automated Email Notifications:** Stripe automatically sends emails when a payment fails, card expires, or payment method needs update
2. **Smart Retry Configuration:** Configure in Stripe Dashboard → Billing → Revenue recovery → Retries
3. **Grace Period:** Allow 7-14 day grace period before service suspension to maximize recovery
4. **Update Payment Method Links:** Include one-click links to update card details in dunning emails

**2026 Benchmarks:**
- Industry standard monthly churn: 5% (46% annual)
- Of that 5%, ~25% is involuntary churn (payment failures)
- With proper dunning: reduce involuntary churn to 1-1.5%, saving ~3.5% MRR monthly

**Sources:** [S13], [S14], [S15]

**Relevance to CCW-Online ERP:**
**Implementation Priority: High.** Given that CCW targets small business equipment suppliers, payment failures due to card expiry or insufficient funds are common. Implement:
1. Enable Stripe Smart Retries in Dashboard (takes 5 minutes)
2. Configure automated email templates with brand styling
3. Add webhook handler for `invoice.payment_failed` to trigger in-app notifications
4. Set 10-day grace period before downgrading to read-only mode
5. Track recovery rate as a key metric (target: 50%+ recovery)

**Expected Impact:** For a portfolio of 100 customers at $599/month average, preventing 3% involuntary churn saves ~$1,800/month ($21,600/year).

---

### Finding 6: Proration is Non-Negotiable in 2026

**Confidence:** 0.9 (Tier: V1 - Verified)

**Evidence:**
The most complex aspect of changing existing subscriptions are prorations, where the customer is charged a percentage of a subscription's cost to reflect partial use. If a customer upgrades from a $10/month plan to a $20 option halfway through the billing period, they're charged a prorated amount: -$5 for unused time on the initial price, and $10 for the remaining time on the new price, resulting in a $5 additional charge immediately.

**Stripe Proration Options:**
- `proration_behavior: 'create_prorations'` (default): Prorates both upgrade and downgrade
- `proration_behavior: 'none'`: No proration (free upgrade until next billing cycle)
- `proration_behavior: 'always_invoice'`: Immediately invoices proration amount

**Flexible vs Classic Billing Mode (Stripe):**
Stripe's new **flexible billing mode** (2026) provides more accurate billing for prorations, usage-based pricing, flexible invoicing, and trial settings. Recommended for all new subscriptions.

**Best Practices:**
1. **Preview Prorations:** Show customers the exact charge before they confirm an upgrade
2. **Immediate Upgrades:** Apply upgrades immediately with prorated charge (customers expect instant access)
3. **Scheduled Downgrades:** Offer option to downgrade at end of billing period (avoids negative proration confusion)
4. **Transparent Invoicing:** Always invoice prorations with clear line-item breakdown

**Sources:** [S16], [S17], [S18]

**Relevance to CCW-Online ERP:**
**Implementation Requirements:**
1. Use Stripe's `proration_behavior: 'always_invoice'` for clarity
2. Build a proration preview API endpoint: `POST /api/billing/preview-change`
3. Display proration amount in upgrade/downgrade UI before confirmation
4. Offer two downgrade options:
   - "Downgrade Now" (with prorated credit applied to next invoice)
   - "Downgrade at End of Period" (most common choice)
5. Use Subscription Schedules API for complex multi-step changes

**UI Pattern:**
```
You're upgrading from Professional ($599/month) to Business ($1,499/month)

Current billing period: March 1 - March 31
Upgrade effective: March 16 (16 days remaining)

Prorated charges:
- Unused Professional time: -$290.84 (credit)
- Business time remaining: +$774.84
- Amount due today: $484.00

[Preview Invoice] [Confirm Upgrade]
```

---

### Finding 7: VAT/GST Tax Compliance is a Major Pain Point

**Confidence:** 0.85 (Tier: V2 - Corroborated)

**Evidence:**
Stripe operates as a payment processor where you are the seller and handle tax compliance, while Paddle is a Merchant of Record (MoR) where Paddle legally sells your product and handles global sales tax and VAT in 200+ jurisdictions.

**Tax Complexity Reality (2026):**
- **200+ tax jurisdictions** globally with different VAT/GST rules
- **Digital services tax** varies by country (EU: 19-27% VAT, Australia: 10% GST, UK: 20% VAT)
- **Tax filing frequency:** Monthly or quarterly depending on jurisdiction and revenue thresholds
- **Penalty for non-compliance:** 5-25% of unpaid tax + fines + potential criminal charges

**Solutions:**
1. **Stripe Tax:** Automatically calculates and collects sales tax, VAT, and GST in 100+ countries for $0.50/transaction. You still handle filing and remittance.
2. **Paddle as MoR:** Handles all tax calculation, collection, filing, and remittance for 5% + $0.50 per transaction. You never file a tax return.
3. **Manual Compliance:** Use tax consultants and accounting software. Only viable if you're selling in 1-3 countries max.

**Decision Point:**
- **Before $50K MRR:** Use Stripe Tax ($0.50/txn). Manageable tax burden, lower fees.
- **After $50K MRR with 40%+ international sales:** Consider Paddle. The 5% fee is worth it to avoid tax headaches.
- **Above $500K MRR:** In-house tax team + Stripe Tax becomes cost-effective again.

**Sources:** [S11], [S12], [S19], [S20]

**Relevance to CCW-Online ERP:**
**Recommendation:** Start with **Stripe Tax** ($0.50/transaction) to automatically handle tax calculation and collection. Configure tax settings in Stripe Dashboard:
1. Enable Stripe Tax
2. Register tax IDs for your jurisdiction
3. Set tax behavior: `inclusive` (tax included in price) or `exclusive` (tax added at checkout)
4. Configure customer tax ID collection for B2B sales (VAT exemptions)

**Implementation:**
- Add tax calculation to checkout flow: `automatic_tax: { enabled: true }`
- Display tax breakdown in invoices and customer portal
- Store tax receipts for 7 years (most jurisdictions require this)
- If international sales exceed 40% by 2027, re-evaluate Paddle migration

**Cost Analysis (Example):**
- 100 customers × $599/month × $0.50 tax fee = $50/month ($600/year)
- Alternative (Paddle): 100 customers × $599 × 2% additional fee = $1,198/month ($14,376/year)
- Breakeven: When tax compliance burden exceeds $1,100/month in accounting fees

---

### Finding 8: Revenue Metrics — What to Track and Why

**Confidence:** 0.85 (Tier: V2 - Corroborated)

**Evidence:**
Modern SaaS companies track a core set of financial metrics to guide growth decisions. Based on 2026 benchmarks:

**Core Metrics:**

1. **Monthly Recurring Revenue (MRR)**
   - Formula: Number of Active Subscribers × Average Revenue Per Account (ARPA)
   - Target Growth: 10-20% MoM for early-stage, 5-10% MoM for scale stage

2. **Annual Recurring Revenue (ARR)**
   - Formula: MRR × 12
   - Use for: Annual planning, investor reporting, sales quotas

3. **Net Revenue Retention (NRR)**
   - Formula: (Starting MRR + Expansion - Contraction - Churn) / Starting MRR × 100
   - Benchmark: NRR above 100% means existing customers generate more revenue over time
   - 2026 Target: 110-120% NRR for healthy B2B SaaS

4. **Customer Churn Rate**
   - Formula: (Customers Lost / Starting Customers) × 100
   - 2026 Benchmarks:
     - Early stage ($1-8M ARR): 5-7% monthly
     - Scale stage ($8M+ ARR): 3.1% monthly
     - Large scale ($15M+ ARR): 1.8% monthly (net MRR churn)

5. **Customer Lifetime Value (LTV)**
   - Formula: ARPA / Monthly Churn Rate
   - Example: $599 ARPA / 5% churn = $11,980 LTV
   - Target: LTV:CAC ratio of 3:1 or higher

6. **Expansion Revenue**
   - Upgrades + upsells + usage overages from existing customers
   - Target: 20-30% of monthly revenue should come from expansion

**Tools for Tracking:**
- **ChartMogul:** Free under $120K ARR, connects to Stripe, calculates all metrics automatically
- **ProfitWell:** Free for early-stage, connects to Stripe/Paddle, includes churn analysis
- **Baremetrics:** Real-time metrics dashboard, $50-250/month depending on MRR
- **Maxio:** Enterprise-grade, 30+ pre-built reports, $500+/month

**Sources:** [S21], [S22], [S23]

**Relevance to CCW-Online ERP:**
**Recommendation:** Start with **ChartMogul** (free tier) connected to Stripe. Track these metrics on a monthly basis:

**Dashboard Priorities:**
1. **MRR:** Primary growth metric
2. **NRR:** Indicates product stickiness and expansion opportunity
3. **Churn Rate:** Early warning system for product-market fit issues
4. **ARPA by Tier:** Shows which tier drives most revenue
5. **Expansion Revenue %:** Validates usage-based pricing strategy

**Implementation:**
- Connect ChartMogul to Stripe (5-minute setup)
- Create monthly reporting dashboard (can build custom in CCW admin panel)
- Set up Slack/email alerts for:
  - MRR drops below growth target
  - Churn rate exceeds 7%
  - High-value customer cancels (>$1K/month)

---

### Finding 9: Seat-Based vs Usage-Based Pricing Trade-offs

**Confidence:** 0.80 (Tier: V2 - Corroborated)

**Evidence:**
The pricing model debate continues in 2026, with data showing both approaches have trade-offs:

**Per-Seat (Seat-Based) Pricing:**

**Pros:**
- Simple and easy to understand
- Predictable costs for customers (makes budgeting easier)
- Steady revenue for the company

**Cons:**
- Can't capture value from heavy users (they pay the same as light users)
- Hard to roll out pilots in new business units (requires seat commitment)
- Encourages seat-sharing and login-sharing behavior to reduce costs
- Growth limited by headcount growth

**Usage-Based Pricing:**

**Pros:**
- Aligns pricing with value delivered (heavy users pay more)
- Flexible for customers with variable needs
- Companies using UBP grew revenue 2x faster than seat-only models
- No barrier to adding new users (drives adoption)

**Cons:**
- **Unpredictable costs:** 78% of IT leaders experienced unexpected charges tied to consumption-based pricing in the past 12 months
- **Budget overruns:** 61% cut projects due to unexpected SaaS cost increases
- **Billing complexity:** Customers struggle to map usage metrics to business value
- **Engineering burden:** Requires real-time metering, accurate tracking, transparent dashboards

**2026 Market Trend:**
After the UBP surge in 2020-2023, there's a **seat-price resurgence** in 2026. Some SaaS CEOs discovered customers "didn't want innovative pricing" — they wanted familiar, budgetable models. In complex enterprise sales, per-seat proposals are easier to approve than metered usage contracts with unpredictable bills.

**Hybrid Approach Wins:**
SaaS providers rarely employ strict per-seat, flat-rate, or usage pricing. Instead, they hybridize the models by introducing tiered pricing with base seats + usage overages.

**Sources:** [S24], [S25], [S26]

**Relevance to CCW-Online ERP:**
**Recommendation:** Hybrid model with **flat-rate tiers + usage overages**.

**Structure:**
- **Base Subscription:** Flat monthly rate includes:
  - User seats (unlimited within tier limits)
  - Core modules (products, customers, orders, quotes)
  - Base quotas (500 translations/month, 10GB storage, 10K API calls/month)

- **Usage Overages:**
  - AI translations: $10 per 1,000 translations beyond quota
  - Storage: $0.10/GB/month beyond quota
  - API calls: $5 per 10,000 calls beyond quota
  - AI search queries: $20 per 1,000 queries (Phase 4 feature)

**Why This Works:**
1. **Predictability:** Base tier provides stable budget for customers
2. **Flexibility:** No penalty for adding users, encourages adoption
3. **Value Capture:** Heavy AI/API users pay proportionally more
4. **Upsell Path:** Natural upgrade trigger when customers hit quotas consistently

**Implementation Notes:**
- Display usage meters in dashboard: "You've used 450/500 translations this month"
- Send warning emails at 80%, 90%, 100% of quota
- Offer "Buy More" button to upgrade tier or purchase one-time top-ups
- Make overages transparent in invoices: line-item breakdown

---

## SOURCE REGISTRY

| ID | Source | Tier | Date | Relevance |
|----|--------|------|------|-----------|
| S1 | [SaaS pricing models: Complete 2026 guide (+ expert advice)](https://blog.alguna.com/saas-pricing-models/) | T2 | 2026 | 5/5 |
| S2 | [The SaaS Founder's Guide to Pricing Models That Convert](https://ekofi.substack.com/p/the-saas-founders-guide-to-pricing) | T2 | 2026 | 5/5 |
| S3 | [Stripe vs Paddle vs Lemon Squeezy: I Processed $10K Through Each](https://medium.com/@muhammadwaniai/stripe-vs-paddle-vs-lemon-squeezy-i-processed-10k-through-each-heres-what-actually-matters-27ef04e4cb43) | T3 | 2024 | 5/5 |
| S4 | [Stripe vs Paddle vs Lemon Squeezy: SaaS Billing for AI Products](https://getathenic.com/blog/stripe-vs-paddle-vs-lemon-squeezy-saas-billing) | T2 | 2026 | 5/5 |
| S5 | [Compare SaaS Payment Provider Fees - Stripe vs Paddle vs LemonSqueezy](https://saasfeecalc.com/) | T2 | 2026 | 4/5 |
| S6 | [Choosing a Self-Service Customer Billing Portal](https://prosperstack.com/blog/customer-billing-portal/) | T2 | 2025 | 4/5 |
| S7 | [Self-Serve Billing Portal: Why You Need One as a SaaS Startup](https://www.wingback.com/blog/why-your-saas-startup-needs-self-serve) | T2 | 2026 | 4/5 |
| S8 | [Consumption-based pricing in SaaS: 2026 guide](https://blog.alguna.com/consumption-based-pricing/) | T2 | 2026 | 5/5 |
| S9 | [How Much Does ERP Cost in 2026? A Pricing Guide for All Business Sizes](https://www.top10erp.org/blog/erp-price) | T2 | 2026 | 5/5 |
| S10 | [ERP SaaS Pricing Models Explained](https://sysgenpro.com/resources/erp-saas-pricing-models-guide) | T2 | 2026 | 5/5 |
| S11 | [Paddle Review 2026: Pros, Cons & Pricing Explained](https://dev.to/onsen/paddle-review-2026-pros-cons-pricing-explained-4cgk) | T3 | 2026 | 4/5 |
| S12 | [Tax Compliance Software: Sales Tax, VAT, and GST - Stripe Tax](https://stripe.com/tax) | T1 | 2026 | 5/5 |
| S13 | [Automate payment retries - Stripe Documentation](https://docs.stripe.com/billing/revenue-recovery/smart-retries) | T1 | 2026 | 5/5 |
| S14 | [Revenue recovery - Stripe Documentation](https://docs.stripe.com/billing/revenue-recovery) | T1 | 2026 | 5/5 |
| S15 | [Failed payments? Here's what to do - Stripe](https://stripe.com/resources/more/failed-payment-recovery-101) | T1 | 2026 | 5/5 |
| S16 | [Prorations - Stripe Documentation](https://docs.stripe.com/billing/subscriptions/prorations) | T1 | 2026 | 5/5 |
| S17 | [Change the price of existing subscriptions - Stripe](https://docs.stripe.com/billing/subscriptions/change-price) | T1 | 2026 | 5/5 |
| S18 | [What is prorated billing, and how does it work? - Stripe](https://stripe.com/resources/more/prorated-billing-101-what-it-is-how-it-works-and-how-to-use-it) | T1 | 2026 | 5/5 |
| S19 | [Indirect tax compliance: Sales tax, VAT, and GST - Stripe](https://stripe.com/guides/introduction-to-sales-tax-vat-and-gst-compliance) | T1 | 2026 | 5/5 |
| S20 | [Global VAT for cross-border sales: What to know - Stripe](https://stripe.com/resources/more/global-vat-for-crossborder-sales) | T1 | 2026 | 4/5 |
| S21 | [Stripe Revenue Tracking 2026: MRR, ARR & Re...](https://www.quantledger.app/blog/how-to-track-revenue-stripe) | T2 | 2026 | 4/5 |
| S22 | [SaaS Metrics Benchmarks 2026 - MRR Growth, CAC, LTV, Churn by Stage](https://pmtoolkit.ai/benchmarks/saas-metrics-2026) | T2 | 2026 | 5/5 |
| S23 | [SaaS Churn Rate Benchmarks 2026 — Averages by Size & Industry](https://www.mrrsaver.com/blog/saas-churn-rate-benchmarks) | T2 | 2026 | 5/5 |
| S24 | [Per-seat vs. usage-based pricing: which is right for SaaS?](https://helloadvisr.com/foundation/per-seat-vs-usage-based-pricing-which-is-right-for-saas/) | T2 | 2026 | 5/5 |
| S25 | [Usage-Based Pricing Is Reshaping SaaS: How to Stay in Control](https://zylo.com/blog/a-new-trend-in-saas-pricing-enter-the-usage-based-model/) | T2 | 2026 | 4/5 |
| S26 | [The 2026 Guide to SaaS, AI, and Agentic Pricing Models](https://www.getmonetizely.com/blogs/the-2026-guide-to-saas-ai-and-agentic-pricing-models) | T2 | 2026 | 5/5 |
| S27 | [Building a Stripe Subscription Backend with FastAPI](https://dev.to/fastapier/building-a-stripe-subscription-backend-with-fastapi-3n3) | T3 | 2024 | 5/5 |
| S28 | [The Ultimate Guide to Stripe + Next.js (2026 Edition)](https://dev.to/sameer_saleem/the-ultimate-guide-to-stripe-nextjs-2026-edition-2f33) | T3 | 2026 | 5/5 |
| S29 | [Implementing Stripe Subscriptions with Supabase, Next.js, and FastAPI](https://medium.com/@ojasskapre/implementing-stripe-subscriptions-with-supabase-next-js-and-fastapi-666e1aada1b5) | T3 | 2024 | 4/5 |
| S30 | [Indie Hackers Guide 2026: Bootstrapping Success](https://alignify.co/insights/indie-hackers) | T3 | 2026 | 3/5 |

---

## KNOWLEDGE GAPS

### What Could Not Be Determined

1. **Specific conversion rates for ERP pricing models** — Industry data on B2B ERP conversion rates by tier is not publicly available. Recommendation: Run A/B tests after launch to determine optimal pricing.

2. **Exact churn rates for equipment supplier ERP systems** — Benchmarks available are for generic B2B SaaS, not vertical-specific ERP. Recommendation: Track cohort churn from Day 1 and compare to broader benchmarks (5-7% monthly).

3. **Linear's specific pricing strategy** — Despite searching, I could not find a detailed case study on Linear's pricing evolution. Their current pricing ($8-16/user/month with unlimited tier) is visible but strategic rationale is not documented publicly.

4. **ROI of custom portal vs Stripe's built-in portal** — No data found comparing support ticket reduction or satisfaction scores between custom vs out-of-the-box portals. Recommendation: Start with Stripe's portal, measure support ticket volume, then build custom if needed.

5. **Optimal usage quotas for AI translation features** — No industry benchmarks for "what's a reasonable translation quota." Recommendation: Analyze existing CCW usage data (if available) or start with 500/month and adjust based on customer feedback.

---

## RECOMMENDATIONS FOR CCW-ONLINE ERP

### Priority 1: Implement Core Billing Infrastructure (Phase 1)

**Timeline:** 2-3 weeks
**Confidence:** High (proven patterns)

1. **Integrate Stripe Billing API**
   - Create Stripe account and get API keys
   - Install Stripe SDK: `npm install stripe` (Next.js) and `pip install stripe` (FastAPI)
   - Implement webhook endpoints for subscription events
   - Set up products and prices in Stripe Dashboard

2. **Define Pricing Tiers**
   ```
   Starter: $199/month
   - 1-5 users
   - Core modules (products, customers, orders, quotes)
   - 500 AI translations/month
   - 10GB storage
   - 10K API calls/month
   - Email support

   Professional: $599/month
   - 6-25 users
   - Everything in Starter
   - 2,000 AI translations/month
   - 50GB storage
   - 50K API calls/month
   - Shopify integration (Phase 3)
   - Priority support

   Business: $1,499/month
   - 26-100 users
   - Everything in Professional
   - 10,000 AI translations/month
   - 200GB storage
   - 250K API calls/month
   - AI search & recommendations (Phase 4)
   - Dedicated success manager

   Enterprise: Custom pricing
   - Unlimited users
   - Custom modules
   - Unlimited usage
   - White-label options
   - 24/7 phone support
   - SLA guarantee
   ```

3. **Build Subscription Management Endpoints (FastAPI)**
   ```python
   # apps/backend/src/api/routes/billing.py

   @router.post("/subscriptions/create")
   async def create_subscription(
       price_id: str,
       user_id: UUID,
       db: AsyncSession = Depends(get_async_db)
   ):
       # Create Stripe Customer
       # Create Stripe Subscription
       # Store subscription_id in DB
       pass

   @router.post("/subscriptions/{subscription_id}/upgrade")
   async def upgrade_subscription(
       subscription_id: str,
       new_price_id: str,
       db: AsyncSession = Depends(get_async_db)
   ):
       # Preview proration
       # Update Stripe Subscription
       # Return invoice preview
       pass

   @router.post("/subscriptions/{subscription_id}/cancel")
   async def cancel_subscription(
       subscription_id: str,
       cancel_at_period_end: bool = True,
       db: AsyncSession = Depends(get_async_db)
   ):
       # Cancel in Stripe
       # Update DB status
       pass
   ```

4. **Create Billing Dashboard UI (Next.js)**
   ```
   /dashboard/billing/
   ├── page.tsx              # Overview (current plan, usage, next invoice)
   ├── invoices/page.tsx     # Invoice history
   ├── usage/page.tsx        # Usage dashboard with charts
   └── payment/page.tsx      # Update payment method
   ```

### Priority 2: Implement Usage Metering (Phase 1B)

**Timeline:** 1 week
**Confidence:** High (existing Stripe patterns)

1. **Create Usage Tracking Service**
   ```python
   # apps/backend/src/services/usage_tracking.py

   async def track_translation_usage(
       user_id: UUID,
       translation_count: int,
       db: AsyncSession
   ):
       # Increment usage counter in DB
       # Report to Stripe Metering API
       # Check if quota exceeded
       # Trigger warning if at 80%/90%
       pass
   ```

2. **Add Usage Meters to Stripe**
   - Create metered billing items for:
     - AI translations (per 1,000)
     - Storage (per GB/month)
     - API calls (per 10,000)

3. **Build Usage Dashboard**
   - Real-time usage display
   - Quota progress bars
   - Historical usage charts (Chart.js or Recharts)
   - Overage cost estimates

### Priority 3: Self-Service Customer Portal (Phase 2)

**Timeline:** 1-2 weeks
**Confidence:** High (Stripe provides pre-built components)

1. **Enable Stripe Customer Portal**
   - Configure in Stripe Dashboard → Settings → Customer Portal
   - Customize branding, allowed actions, terms
   - Add "Manage Billing" link in CCW dashboard

2. **Build Custom Portal Features** (enhancements over Stripe's default)
   - Proration preview before upgrade/downgrade
   - Usage-based add-ons (buy extra translations, storage)
   - Team member management (invite/remove users)
   - Billing contact management (separate from account owner)

### Priority 4: Revenue Operations Dashboard (Phase 2B)

**Timeline:** 2-3 days (mostly integration)
**Confidence:** High (ChartMogul handles calculation)

1. **Connect ChartMogul to Stripe**
   - Sign up for ChartMogul (free under $120K ARR)
   - Connect Stripe account
   - Wait 24-48 hours for historical data sync

2. **Create Internal Metrics Dashboard** (optional, for admin panel)
   ```
   /admin/revenue/
   ├── page.tsx              # MRR, ARR, churn, NRR overview
   ├── customers/page.tsx    # Customer list with LTV, MRR contribution
   └── cohorts/page.tsx      # Cohort analysis
   ```

3. **Set Up Alerts**
   - Slack/email alert when:
     - MRR drops >5% MoM
     - Churn rate exceeds 7%
     - High-value customer cancels (>$1K/month)
     - Payment failure on enterprise customer

### Priority 5: Tax Compliance (Phase 2C)

**Timeline:** 1 day (configuration)
**Confidence:** High (Stripe Tax handles complexity)

1. **Enable Stripe Tax**
   - Stripe Dashboard → Settings → Tax
   - Add business tax registration details
   - Set tax behavior (inclusive vs exclusive)

2. **Update Checkout Flow**
   ```typescript
   // Add to subscription creation
   const subscription = await stripe.subscriptions.create({
     customer: customer.id,
     items: [{ price: priceId }],
     automatic_tax: { enabled: true },
   });
   ```

3. **Configure Invoice Display**
   - Show tax breakdown in invoices
   - Add customer tax ID collection for B2B (VAT exemptions)

### Priority 6: Dunning & Failed Payment Recovery (Phase 3)

**Timeline:** 1-2 days (mostly configuration)
**Confidence:** High (Stripe automates most of it)

1. **Enable Smart Retries**
   - Stripe Dashboard → Billing → Revenue recovery → Retries
   - Enable Smart Retries (recommended)
   - Set retry schedule (e.g., 3, 5, 7, 10 days)

2. **Configure Email Templates**
   - Customize failed payment emails with brand voice
   - Include one-click "Update Payment Method" link
   - Add incentive for immediate update (e.g., "Update within 48 hours to avoid service interruption")

3. **Add Webhook Handlers**
   ```python
   # apps/backend/src/api/routes/webhooks.py

   @router.post("/webhooks/stripe")
   async def stripe_webhook(request: Request, db: AsyncSession):
       event = stripe.Webhook.construct_event(
           payload=await request.body(),
           sig_header=request.headers['stripe-signature'],
           secret=WEBHOOK_SECRET
       )

       if event.type == 'invoice.payment_failed':
           # Send in-app notification
           # Downgrade to read-only after grace period
           pass

       if event.type == 'invoice.payment_succeeded':
           # Clear any service restrictions
           # Send thank you email
           pass
   ```

4. **Implement Grace Period Logic**
   - Allow 10 days of full access after payment failure
   - Day 11: Downgrade to read-only mode (can view data, can't edit)
   - Day 21: Archive account (data retained but inaccessible)
   - Day 90: Final warning email before data deletion

---

## IMPLEMENTATION CHECKLIST

### Phase 1: Core Billing (2-3 weeks)

- [ ] Create Stripe account and configure settings
- [ ] Define 4 pricing tiers (Starter, Professional, Business, Enterprise)
- [ ] Set up products and prices in Stripe Dashboard
- [ ] Install Stripe SDK in Next.js and FastAPI
- [ ] Create `billing.py` API routes in FastAPI
- [ ] Create `/dashboard/billing` pages in Next.js
- [ ] Implement subscription creation flow
- [ ] Implement subscription upgrade/downgrade with proration
- [ ] Implement subscription cancellation
- [ ] Add subscription status to user model (if not already present)
- [ ] Test checkout flow end-to-end
- [ ] Test upgrade/downgrade with proration preview
- [ ] Test cancellation (immediate and end-of-period)

### Phase 2: Usage Metering & Customer Portal (1-2 weeks)

- [ ] Create usage tracking service in FastAPI
- [ ] Add usage meters to Stripe (translations, storage, API calls)
- [ ] Hook translation service to track usage
- [ ] Build usage dashboard UI with progress bars
- [ ] Add quota warning emails (80%, 90%, 100%)
- [ ] Enable Stripe Customer Portal
- [ ] Customize portal branding and settings
- [ ] Add "Manage Billing" link to CCW dashboard
- [ ] Build custom proration preview component
- [ ] Test usage tracking accuracy
- [ ] Test overage billing

### Phase 3: Revenue Ops & Tax (1 week)

- [ ] Sign up for ChartMogul (or alternative)
- [ ] Connect ChartMogul to Stripe
- [ ] Verify MRR, ARR, churn calculations
- [ ] Set up Slack/email alerts for key events
- [ ] Enable Stripe Tax in Dashboard
- [ ] Add tax calculation to checkout flow
- [ ] Test tax calculation for multiple jurisdictions
- [ ] Configure invoice tax breakdown display

### Phase 4: Dunning & Recovery (1 week)

- [ ] Enable Stripe Smart Retries
- [ ] Configure retry schedule
- [ ] Customize failed payment email templates
- [ ] Add webhook handler for `invoice.payment_failed`
- [ ] Add webhook handler for `invoice.payment_succeeded`
- [ ] Implement 10-day grace period logic
- [ ] Implement read-only mode downgrade
- [ ] Implement account archival (Day 21)
- [ ] Add final warning before data deletion (Day 90)
- [ ] Test full dunning flow with test card
- [ ] Track recovery rate metric

### Phase 5: Testing & Launch (1 week)

- [ ] End-to-end checkout flow testing (all tiers)
- [ ] Test upgrade path (Starter → Pro → Business)
- [ ] Test downgrade path (Business → Pro → Starter)
- [ ] Test cancellation and reactivation
- [ ] Test failed payment and recovery flow
- [ ] Test usage overage billing
- [ ] Load test payment endpoints (1000 concurrent checkouts)
- [ ] Security audit (webhook signature verification, API key storage)
- [ ] Compliance check (GDPR, PCI DSS via Stripe)
- [ ] Beta test with 5-10 internal users
- [ ] Fix any issues from beta testing
- [ ] Launch publicly with pricing page
- [ ] Monitor first 30 days of subscriptions closely

---

## ARCHITECTURE REFERENCE

### Stripe + Next.js + FastAPI Integration Pattern

```
┌─────────────────┐
│   Next.js UI    │
│  (apps/web)     │
└────────┬────────┘
         │
         │ API Calls
         ▼
┌─────────────────┐      ┌──────────────┐
│  FastAPI        │◄─────┤  Stripe      │
│  (apps/backend) │      │  Webhooks    │
└────────┬────────┘      └──────────────┘
         │
         │ DB Queries
         ▼
┌─────────────────┐
│  PostgreSQL     │
│  (Docker)       │
└─────────────────┘
```

**Flow:**
1. **Subscription Creation:**
   - User clicks "Subscribe" on `/dashboard/billing`
   - Next.js calls `POST /api/billing/subscriptions/create` (FastAPI)
   - FastAPI creates Stripe Customer & Subscription
   - FastAPI stores `subscription_id` in `users` table
   - Returns success, Next.js redirects to dashboard

2. **Subscription Update (Upgrade/Downgrade):**
   - User clicks "Upgrade to Business" on `/dashboard/billing`
   - Next.js calls `POST /api/billing/subscriptions/{id}/preview-change`
   - FastAPI queries Stripe API for proration preview
   - Returns proration amount, Next.js displays confirmation modal
   - User confirms, Next.js calls `POST /api/billing/subscriptions/{id}/update`
   - FastAPI updates Stripe Subscription with `proration_behavior: 'always_invoice'`
   - Stripe immediately invoices proration amount
   - Returns success, Next.js refreshes billing page

3. **Usage Tracking:**
   - User triggers AI translation (e.g., adds product description in Spanish)
   - Backend translation service calls `track_translation_usage(user_id, 1)`
   - Usage tracking service increments counter in `usage_logs` table
   - Every hour, cron job aggregates usage and reports to Stripe Metering API
   - Stripe calculates overage charges at end of billing period
   - Stripe adds line item to next invoice

4. **Failed Payment (Dunning):**
   - Stripe attempts to charge customer on renewal date
   - Payment fails (card declined)
   - Stripe sends webhook: `invoice.payment_failed`
   - FastAPI webhook handler receives event
   - Handler logs failure, sends in-app notification to user
   - Stripe automatically sends "Update Payment Method" email
   - Stripe Smart Retries attempts payment again in 3, 5, 7, 10 days
   - If payment succeeds, webhook: `invoice.payment_succeeded`, service restored
   - If all retries fail, FastAPI downgrades to read-only mode on Day 11

### Database Schema Extensions

**New Tables Required:**

```sql
-- Subscription tracking
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id VARCHAR(255) NOT NULL,
  stripe_subscription_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL, -- active, past_due, canceled, trialing
  tier VARCHAR(50) NOT NULL, -- starter, professional, business, enterprise
  current_period_start TIMESTAMP NOT NULL,
  current_period_end TIMESTAMP NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(stripe_subscription_id)
);

-- Usage tracking
CREATE TABLE usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metric VARCHAR(50) NOT NULL, -- translations, storage_gb, api_calls
  quantity INTEGER NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW(),
  billing_period_start TIMESTAMP NOT NULL,
  billing_period_end TIMESTAMP NOT NULL,
  reported_to_stripe BOOLEAN DEFAULT FALSE,
  reported_at TIMESTAMP
);

-- Usage quotas (monthly reset)
CREATE TABLE usage_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier VARCHAR(50) NOT NULL,
  metric VARCHAR(50) NOT NULL,
  quota_limit INTEGER NOT NULL, -- e.g., 500 for translations
  current_usage INTEGER DEFAULT 0,
  overage_count INTEGER DEFAULT 0,
  billing_period_start TIMESTAMP NOT NULL,
  billing_period_end TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, metric, billing_period_start)
);

-- Invoice history (cached from Stripe)
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_invoice_id VARCHAR(255) NOT NULL,
  amount_total INTEGER NOT NULL, -- in cents
  currency VARCHAR(3) DEFAULT 'AUD',
  status VARCHAR(50) NOT NULL, -- paid, open, void, uncollectible
  invoice_pdf_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(stripe_invoice_id)
);
```

**Note:** These tables should be added via a new migration file, NOT by modifying `demo_models.py`. This requires explicit approval per project rules.

---

## CODE EXAMPLES

### 1. Subscription Creation (FastAPI)

```python
# apps/backend/src/api/routes/billing.py

from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
import stripe

from src.config.database import get_async_db
from src.config.settings import settings

stripe.api_key = settings.STRIPE_SECRET_KEY

router = APIRouter(prefix="/api/billing", tags=["Billing"])

class CreateSubscriptionRequest(BaseModel):
    price_id: str
    payment_method_id: str

@router.post("/subscriptions/create")
async def create_subscription(
    request: CreateSubscriptionRequest,
    user_id: UUID,  # From JWT token
    db: Annotated[AsyncSession, Depends(get_async_db)]
):
    """Create a new Stripe subscription for the user."""

    # Get user from DB
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Create or retrieve Stripe Customer
    if user.stripe_customer_id:
        customer = stripe.Customer.retrieve(user.stripe_customer_id)
    else:
        customer = stripe.Customer.create(
            email=user.email,
            name=user.full_name,
            payment_method=request.payment_method_id,
            invoice_settings={"default_payment_method": request.payment_method_id}
        )
        user.stripe_customer_id = customer.id
        await db.commit()

    # Create Subscription
    subscription = stripe.Subscription.create(
        customer=customer.id,
        items=[{"price": request.price_id}],
        payment_behavior="default_incomplete",
        payment_settings={"save_default_payment_method": "on_subscription"},
        expand=["latest_invoice.payment_intent"],
        automatic_tax={"enabled": True}
    )

    # Store subscription in DB
    new_subscription = Subscription(
        user_id=user_id,
        stripe_customer_id=customer.id,
        stripe_subscription_id=subscription.id,
        status=subscription.status,
        tier=get_tier_from_price_id(request.price_id),
        current_period_start=datetime.fromtimestamp(subscription.current_period_start),
        current_period_end=datetime.fromtimestamp(subscription.current_period_end)
    )
    db.add(new_subscription)
    await db.commit()

    return {
        "subscription_id": subscription.id,
        "status": subscription.status,
        "client_secret": subscription.latest_invoice.payment_intent.client_secret
    }
```

### 2. Proration Preview (FastAPI)

```python
@router.post("/subscriptions/{subscription_id}/preview-change")
async def preview_subscription_change(
    subscription_id: str,
    new_price_id: str,
    db: Annotated[AsyncSession, Depends(get_async_db)]
):
    """Preview proration amount before upgrading/downgrading."""

    # Get current subscription from Stripe
    subscription = stripe.Subscription.retrieve(subscription_id)

    # Preview upcoming invoice with new price
    invoice = stripe.Invoice.upcoming(
        customer=subscription.customer,
        subscription=subscription.id,
        subscription_items=[{
            "id": subscription["items"]["data"][0].id,
            "price": new_price_id
        }],
        subscription_proration_behavior="always_invoice",
        subscription_proration_date=int(datetime.now().timestamp())
    )

    # Calculate proration breakdown
    proration_amount = 0
    current_plan_credit = 0
    new_plan_charge = 0

    for line in invoice.lines.data:
        if line.proration:
            if line.amount < 0:
                current_plan_credit = abs(line.amount / 100)  # Convert cents to dollars
            else:
                new_plan_charge = line.amount / 100

    proration_amount = new_plan_charge - current_plan_credit

    return {
        "current_plan": get_plan_name(subscription.items.data[0].price.id),
        "new_plan": get_plan_name(new_price_id),
        "current_period_end": subscription.current_period_end,
        "days_remaining": (subscription.current_period_end - int(datetime.now().timestamp())) // 86400,
        "proration_breakdown": {
            "current_plan_credit": current_plan_credit,
            "new_plan_charge": new_plan_charge,
            "amount_due_today": proration_amount
        },
        "next_invoice_date": subscription.current_period_end,
        "new_monthly_amount": invoice.lines.data[-1].amount / 100
    }
```

### 3. Usage Tracking (FastAPI)

```python
# apps/backend/src/services/usage_tracking.py

async def track_translation_usage(
    user_id: UUID,
    translation_count: int,
    db: AsyncSession
):
    """Track AI translation usage and check quotas."""

    # Get current billing period
    subscription = await db.execute(
        select(Subscription).where(Subscription.user_id == user_id)
    )
    sub = subscription.scalar_one_or_none()

    if not sub:
        raise ValueError("No active subscription found")

    # Get or create usage quota record
    quota = await db.execute(
        select(UsageQuota).where(
            UsageQuota.user_id == user_id,
            UsageQuota.metric == "translations",
            UsageQuota.billing_period_start == sub.current_period_start
        )
    )
    quota_record = quota.scalar_one_or_none()

    if not quota_record:
        # Create new quota record for this billing period
        quota_limit = get_quota_for_tier(sub.tier, "translations")
        quota_record = UsageQuota(
            user_id=user_id,
            tier=sub.tier,
            metric="translations",
            quota_limit=quota_limit,
            current_usage=0,
            billing_period_start=sub.current_period_start,
            billing_period_end=sub.current_period_end
        )
        db.add(quota_record)

    # Update usage
    quota_record.current_usage += translation_count
    quota_record.updated_at = datetime.now()

    # Check if quota exceeded
    overage = max(0, quota_record.current_usage - quota_record.quota_limit)
    if overage > 0:
        quota_record.overage_count = overage

    # Log usage event
    usage_log = UsageLog(
        user_id=user_id,
        metric="translations",
        quantity=translation_count,
        billing_period_start=sub.current_period_start,
        billing_period_end=sub.current_period_end,
        timestamp=datetime.now()
    )
    db.add(usage_log)

    await db.commit()

    # Send warning if approaching quota
    usage_percentage = (quota_record.current_usage / quota_record.quota_limit) * 100
    if usage_percentage >= 80 and usage_percentage < 90:
        await send_quota_warning(user_id, "translations", 80)
    elif usage_percentage >= 90 and usage_percentage < 100:
        await send_quota_warning(user_id, "translations", 90)
    elif usage_percentage >= 100:
        await send_quota_exceeded(user_id, "translations", overage)

    return {
        "current_usage": quota_record.current_usage,
        "quota_limit": quota_record.quota_limit,
        "overage": overage,
        "usage_percentage": usage_percentage
    }
```

### 4. Billing Dashboard UI (Next.js)

```typescript
// apps/web/app/(dashboard)/billing/page.tsx

"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface Subscription {
  id: string;
  tier: string;
  status: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
}

interface UsageQuota {
  metric: string;
  current_usage: number;
  quota_limit: number;
  overage: number;
  usage_percentage: number;
}

export default function BillingPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<UsageQuota[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBillingData() {
      try {
        const [subData, usageData] = await Promise.all([
          apiClient.get<Subscription>("/api/billing/subscription"),
          apiClient.get<UsageQuota[]>("/api/billing/usage")
        ]);
        setSubscription(subData);
        setUsage(usageData);
      } catch (error) {
        console.error("Failed to fetch billing data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchBillingData();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Billing & Subscription</h1>
        <p className="text-muted-foreground">Manage your subscription and usage</p>
      </div>

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>Your subscription details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold">{subscription?.tier}</p>
              <p className="text-sm text-muted-foreground">
                Status: <Badge variant={subscription?.status === "active" ? "default" : "destructive"}>
                  {subscription?.status}
                </Badge>
              </p>
            </div>
            <Button>Upgrade Plan</Button>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm text-muted-foreground">
              {subscription?.cancel_at_period_end
                ? "Subscription ends on"
                : "Next billing date"
              }: {new Date(subscription?.current_period_end || "").toLocaleDateString()}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Usage Dashboard */}
      <Card>
        <CardHeader>
          <CardTitle>Usage This Month</CardTitle>
          <CardDescription>Track your usage across all metrics</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {usage.map((quota) => (
            <div key={quota.metric} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium capitalize">{quota.metric}</span>
                <span className="text-sm text-muted-foreground">
                  {quota.current_usage.toLocaleString()} / {quota.quota_limit.toLocaleString()}
                  {quota.overage > 0 && (
                    <span className="ml-2 text-destructive">
                      (+{quota.overage.toLocaleString()} overage)
                    </span>
                  )}
                </span>
              </div>
              <Progress value={quota.usage_percentage} />
              {quota.usage_percentage >= 80 && (
                <p className="text-sm text-amber-600">
                  {quota.usage_percentage >= 100
                    ? "Quota exceeded. Overage charges will apply."
                    : `You've used ${quota.usage_percentage.toFixed(0)}% of your quota.`
                  }
                </p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment Method</CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">Update Card</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">View History</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Manage</CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">Customer Portal</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

---

## CONCLUSION

This guide provides a comprehensive roadmap for implementing modern SaaS billing and monetization for CCW-Online ERP. The recommended approach — **hybrid pricing with Stripe, self-service portal, usage metering, and smart dunning** — is based on verified industry patterns and benchmarks from 2026.

**Key Success Metrics to Track:**
1. **Conversion Rate:** Target 2-5% free trial → paid conversion
2. **Monthly Churn:** Target <7% early stage, <3% at scale
3. **Net Revenue Retention:** Target 110-120%
4. **ARPA Growth:** Target 5-10% quarterly increase via upsells
5. **Payment Recovery Rate:** Target 50%+ via smart dunning

**Next Steps:**
1. Review and approve this billing strategy
2. Prioritize implementation phases (recommend Phase 1 first)
3. Set up Stripe account and configure products/pricing
4. Begin integration following the code examples provided
5. Test thoroughly with Stripe test mode before going live

This research will be re-evaluated in 90 days (June 2026) to incorporate new market data and validate assumptions against CCW's actual billing metrics.

---

**Document Metadata:**
- **Author:** Research Analyst (Synthex)
- **Date:** 16 March 2026
- **Version:** 1.0
- **Confidence:** 0.85/1.0 (Tier V2 - Corroborated)
- **Expiration:** 14 June 2026
- **Next Review:** Update pricing benchmarks, re-evaluate Stripe vs Paddle based on CCW's international sales %, validate churn and recovery rates against actual data
