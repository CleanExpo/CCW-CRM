# 90-Day Training Improvement Roadmap

**Document Date**: 2026-03-24
**Owner**: Senior PM / Training Lead
**Goal**: Reduce time-to-productivity from 2 weeks to 3 days

---

## Current State vs Target State

| Metric | Current | 90-Day Target |
|--------|---------|--------------|
| Training guides | 1 generic (2-3 hr) | 7 role-specific (30 min each) |
| Time to first productive task | 2-5 days | 4 hours |
| AI feature adoption | ~5% of users | 40%+ |
| Training materials up to date | Partially | Auto-updated with releases |
| New feature discovery | Manual / word of mouth | In-app tooltips + changelog |
| Onboarding support time | 4-8 hrs/new hire | < 1 hr/new hire |

---

## Month 1 (Days 1-30): Quick Wins

### Week 1: Role-Specific Guides Live
- [x] ✅ Create 6 quick-start guides (this audit)
- [ ] Add link to role guide in welcome email sent at account creation
- [ ] Add "Training Resources" link to dashboard sidebar
- [ ] Create role selector on first login ("What is your role?")

**Success Metric**: New hires complete relevant guide in < 45 minutes

### Week 2: Surface Existing AI Features
The biggest ROI opportunity — 23 agents exist, ~5% adoption.

**Immediate actions (1-2 days each)**:

| AI Feature | Current Status | Action Needed |
|-----------|---------------|---------------|
| Form Autofill (AGENT-012) | Built ✅ | Add "✨ Auto-fill with AI" button to quote form |
| Staff Copilot | Built ✅ | Add "AI Draft Reply" button to service requests |
| Demand Forecasting | Built ✅ | Add forecast widget to inventory dashboard |
| Product Copy | Built ✅ | Add "Generate Description" button to product form |
| AI Chat | Built ✅ | Add persistent chat button in bottom-right corner |
| Anomaly Detection | Built ✅ | Add anomaly alerts to dashboard notifications |

**Expected result**: AI adoption rises from 5% → 25% in Month 1

### Week 3: Friction Point Fixes (Quick)
Low-effort high-impact UI improvements:

1. **GRN Navigation**: Add "Receive Goods" shortcut button to Inventory dashboard
2. **Invoice from Order**: Move "Generate Invoice" button to order list actions (currently buried in detail view)
3. **Tax Report Discovery**: Add "Reports" quick-link to Invoices sidebar
4. **Reorder Alerts**: Add badge/count to Inventory sidebar item when reorder rules triggered
5. **AI Features Page**: Create `/ai-features` page listing all 23 agents with one-sentence descriptions

### Week 4: Measurement Baseline
- Add simple feedback widget to each module (👍/👎 + freetext)
- Create training completion tracking (who has read which guides)
- Measure: time-on-page for training guides, AI feature click-through rates

---

## Month 2 (Days 31-60): Depth Improvements

### Role-Specific Onboarding Flow
Build a guided onboarding checklist per role:

```
New Sales Rep First Login:
Day 1: [ ] Complete Sales Rep Quick-Start Guide (30 min)
       [ ] Create your first customer
       [ ] Create your first quote
Day 2: [ ] Explore AI Chat assistant
       [ ] Try form autofill on a quote
Day 3: [ ] Convert a quote to order
       [ ] Set up your notification preferences
```

**Implementation**: Simple checklist in dashboard (localStorage-tracked, no DB required)

### Video Walkthrough Shorts (3-5 min each)
Priority: Top 3 features staff struggle with most (from feedback data)

Suggested topics:
1. "Quote to Order in Under 2 Minutes" (Sales)
2. "Process a GRN with Barcode Scanner" (Warehouse)
3. "Generate and Send an Invoice" (Finance)
4. "Using the AI Chat Assistant" (All Roles)

### Workflow Troubleshooting Guides
Create 3 guides for the most common error scenarios:
- "Invoice shows wrong amount — what to check"
- "Cin7 sync stopped — step-by-step recovery"
- "Order stuck in 'Processing' — how to resolve"

---

## Month 3 (Days 61-90): Sustainability

### Auto-Update Training on Release
When a new feature is deployed, training should update automatically:

1. Add `training_note` field to feature PRs (one-sentence description)
2. Auto-append to relevant role guide's "What's New" section
3. Notify affected role users via in-app notification

### Advanced AI Feature Guide
For power users — deeper guides on:
- How to configure the demand forecasting agent parameters
- Using the anomaly detection thresholds
- Creating custom workflow triggers
- Staff copilot prompt engineering tips

### Training Success Metrics Review
Review 90-day outcomes:

| KPI | Baseline | 30-day | 60-day | 90-day |
|-----|---------|--------|--------|--------|
| Time-to-first-task | 2-5 days | 1 day | 4 hrs | 3 hrs |
| AI adoption rate | 5% | 25% | 40% | 50%+ |
| Training support calls | 8 hrs/hire | 4 hrs | 2 hrs | < 1 hr |
| NPS (ease of use) | Unknown | +Baseline | +5 | +15 |

---

## Role-Specific Training Gaps Summary

| Role | Current Coverage | Gap | Priority |
|------|-----------------|-----|----------|
| Sales Rep | Generic guide | No quote templates, AI upsell | 🔴 Critical |
| Warehouse | Generic guide | Barcode scanner docs, GRN guide | 🔴 Critical |
| Finance | Generic guide | Order-to-invoice, Xero sync guide | 🔴 Critical |
| Workshop Tech | None | Entire workflow | 🔴 Critical |
| Customer Service | None | CRM activities, AI copilot | 🟠 High |
| Admin | Partial (API guide) | Integrations setup, agent mgmt | 🟠 High |

---

## Resource Requirements

| Initiative | Effort | Owner | Timeline |
|-----------|--------|-------|----------|
| Role-specific guides | ✅ Done (this audit) | PM | Complete |
| AI feature surfacing | 1-2 days dev each (6 features) | Developer | Week 2-3 |
| GRN/invoice quick-links | 1 day dev | Developer | Week 2 |
| Onboarding checklist | 2 days dev | Developer | Month 2 |
| Video walkthroughs | 3 hrs recording each | Training Lead | Month 2 |
| Troubleshooting guides | 4 hrs writing each | PM | Month 2 |
| Auto-update system | 1 week dev | Developer | Month 3 |

**Total developer effort**: ~15 days
**Total PM/Training effort**: ~10 days
**Expected ROI**: 680+ staff-hours saved annually

---

## Appendix: AI Features Ready to Surface (Zero Development)

These AI features are **already built and deployed** but require zero-code or minimal-code changes to make discoverable:

1. `/ai-assistant` — Full AI chat for any question
2. `/insights` — AI insights on business trends
3. `/marketing` — AI product description generator
4. `/agents` — Agent dashboard with performance metrics
5. Anomaly detection — Already running, results in insights page

These require 1-3 hours of UI work to surface:
6. Form autofill button on quote/order forms
7. Staff copilot button on service request forms
8. Forecast widget on inventory dashboard

---

**Document Owner**: CCW Training Team
**Next Review**: 2026-06-24 (90 days)
