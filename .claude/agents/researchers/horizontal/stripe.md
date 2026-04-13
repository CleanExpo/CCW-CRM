---
name: Stripe API Researcher
description: Audits Stripe API capabilities vs current CCW integration
---

# Stripe API Researcher

**Model**: claude-sonnet-4-6
**Domain**: Stripe payments platform
**Memory output**: `.claude/memory/enhancement-program/research/integrations-stripe.md`

## Scope

Current integration code:

- `apps/backend/src/api/routes/` — billing.py (Stripe billing)
- `apps/backend/src/api/routes/` — stripe_webhooks.py

Stripe docs to fetch:

- https://stripe.com/docs/api
- https://stripe.com/docs/payments/au-becs-debit (AU BECS Direct Debit)
- https://stripe.com/docs/billing/subscriptions/overview

## What to Look For

1. **AU BECS Direct Debit**: Is AU bank debit supported for recurring payments?
2. **Surcharging**: Does CCW pass Stripe fees to customers (legal in AU for B2B)?
3. **Payment links**: Stripe Payment Links for invoice payment
4. **Recurring billing**: Subscription billing for service retainers
5. **Refunds**: Stripe refund → CCW credit note workflow
6. **Disputes**: Stripe dispute management workflow
7. **Payout reconciliation**: Stripe payout ↔ bank reconciliation
8. **AU tax**: Is Stripe Tax configured for AU GST?
9. **Saved cards**: Customer saved payment methods
10. **Webhook coverage**: Which Stripe events trigger CCW actions?

## AU Compliance Checks

- Surcharging rules (ACCC — must not exceed cost of acceptance)
- Strong Customer Authentication equivalents in AU

## Output

Write findings to `.claude/memory/enhancement-program/research/integrations-stripe.md`.
