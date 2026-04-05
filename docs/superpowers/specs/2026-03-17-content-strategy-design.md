# Content Strategy & Normalization Design

**Date:** 2026-03-17
**Status:** Approved
**Project:** CCW-ERP-CRM Content Population & Brand Alignment

## Executive Summary

Replace placeholder/demo content with realistic, polished, brand-aligned content across 75+ pages of the CCW-ERP-CRM application. Populate the system with real CCW cleaning equipment products from ccwonline.com.au to create a production-ready prototype for demonstrating to the CCW owner.

## Context

**Current State:**

- Application has comprehensive design system (CSS variables, shadcn/ui components)
- 75+ pages with generic mechanical products and placeholder content
- Mixed code from multiple projects (SaaS subscription, customer portal) - now cleaned
- Built as internal ERP for CCW staff, not multi-tenant SaaS

**User Requirements:**

- Demo to CCW owner showing how system outperforms current internal tools
- Real CCW product catalog (cleaning equipment, not mechanical parts)
- Professional content reflecting CCW's business
- No design overhaul needed - design system is solid

**Business Context:**

- **Target Market:** Small businesses (1-50 employees) + mid-market (50-500 employees)
- **Business Model:** SaaS product being built to sell/license
- **Differentiators:** AI-powered, industry-specialized, modern UX, all-in-one platform
- **Brand Voice:** Adaptive - depends on content context

## Scope

### In Scope

- Replacing placeholder/demo content with real, brand-aligned copy
- Populating database with real CCW cleaning equipment products
- Light design consistency fixes (spacing/sizing mismatches)
- Ensuring proper supporting information in all sections
- Adaptive voice/tone per module

### Out of Scope

- Major visual redesign (design system is solid)
- Changing component structure or layouts
- Adding new features or functionality
- Rewriting code unless necessary for content integration

## Architecture

### Phase 0: CCW Product Research & Population (2-3 days)

**Data Source:** https://www.ccwonline.com.au (CCW Online Shopify store)

**Extraction:**

- Product names, SKUs, categories
- Pricing (AUD)
- Specifications and descriptions
- Product images (URLs)
- Inventory structure (categories/subcategories)

**Implementation:**

- Create `apps/backend/scripts/seed_ccw_products.py`
- Replace generic mechanical products with real CCW cleaning equipment
- Maintain realistic inventory levels, customer orders, quotes
- Target: 50-100 real CCW products

**Product Categories:**

- Truckmounts (carpet cleaning machines)
- Portable carpet extractors
- Water damage restoration equipment
- Mould remediation equipment
- Hard floor care machines
- Cleaning chemicals & supplies
- Accessories & parts

### Module-by-Module Content Strategy (Phases 1-8)

Execute in priority order, completing each module fully before moving to next:

#### Module 1: Core Business (8 pages)

**Pages:** Dashboard, Products, Customers, Orders, Quotes
**Voice:** Empowering & action-oriented
**Priority:** Highest - first impression, most visible
**Duration:** 1.5-2 days

#### Module 2: Inventory & Warehouse (6 pages)

**Pages:** Inventory, Stock, Transfers, Locations, Reorder
**Voice:** Technical precision + operational efficiency
**Priority:** High - product differentiator
**Duration:** 1.5-2 days

#### Module 3: CRM (5 pages)

**Pages:** Contacts, Health, Onboarding, Personas, Activities
**Voice:** Friendly & professional
**Priority:** High - relationship management
**Duration:** 1.5-2 days

#### Module 4: Financial (5 pages)

**Pages:** Invoicing, Billing, Reconciliation, Reports
**Voice:** Professional & corporate
**Priority:** High - trust critical
**Duration:** 1.5-2 days

#### Module 5: Workshop & Service (6 pages)

**Pages:** Equipment, Bookings, Templates, Reminders, Service Requests
**Voice:** Expert & practical
**Priority:** Medium - industry specialization
**Duration:** 1.5-2 days

#### Module 6: Integrations (5 pages)

**Pages:** Cin7, Shopify, Xero, AP2, Webhooks
**Voice:** Technical & precise
**Priority:** Medium - technical credibility
**Duration:** 1.5-2 days

#### Module 7: Operations (7 pages)

**Pages:** POS, Contractors, Workflows, Approvals, Alerts, Tasks
**Voice:** Action-oriented & clear
**Priority:** Medium - workflow efficiency
**Duration:** 1.5-2 days

#### Module 8: AI & Analytics (4 pages)

**Pages:** Marketing, Forecasting, Agents, Anomaly Detection
**Voice:** Innovative but accessible
**Priority:** Medium - innovation positioning
**Duration:** 1-1.5 days

## Content Development Workflow

**Per-Module Process:**

### Step 1: Design Consistency Check (30 min)

- Scan all pages in the module
- Note spacing/font/button/border inconsistencies
- Fix minor issues immediately, flag major ones
- Run `pnpm run check`

### Step 2: Content Audit & Research (1-2 hours)

- Document current content (placeholder vs real)
- Identify section needs (headings, descriptions, CTAs, help text, empty states, errors)
- Research domain-specific terminology
- Create content requirements checklist

### Step 3: Content Writing (2-4 hours)

- Write all new content following module voice/tone
- Ensure messaging hits 4 differentiators
- Adapt complexity for small business + mid-market
- Include realistic examples, proper terminology, actionable guidance

### Step 4: Content Population (1-2 hours)

- Replace placeholder content in components
- Update page copy, headings, descriptions
- Add proper empty states, error messages, help text
- Ensure clear, action-oriented button/CTA labels

### Step 5: Verification (30 min)

- Visual review of all pages
- Test user flows (navigation, forms, error states)
- Run full test suite: `pnpm run check:all`
- Screenshot key pages for documentation

### Step 6: Linear Update & Handoff

- Create/update Linear issue for module
- Document changes
- Mark complete, ready for review

## Voice & Tone Framework

### Core Business Module

**Tone:** Empowering & action-oriented
**Example:** "Take control of your inventory. Automate reordering. Never run out of stock."
**Why:** First impression needs to inspire confidence and demonstrate value

### Inventory & Warehouse Module

**Tone:** Technical precision + operational clarity
**Example:** "Real-time stock synchronization across all locations. Multi-warehouse transfer tracking with audit trails."
**Why:** Users need to trust accuracy and understand complex workflows

### CRM Module

**Tone:** Friendly & professional
**Example:** "Build stronger relationships. Track every interaction, from first contact to long-term partnership."
**Why:** Relationship management feels personal, not transactional

### Financial Module

**Tone:** Professional & corporate
**Example:** "Ensure compliance with automated tax calculations. Generate audit-ready financial reports instantly."
**Why:** Money and compliance demand serious, trustworthy language

### Workshop & Service Module

**Tone:** Expert & practical
**Example:** "Schedule preventive maintenance before breakdowns happen. Track service history for every piece of equipment."
**Why:** Showcases industry expertise, speaks to operational needs

### Integrations Module

**Tone:** Technical & precise
**Example:** "Bi-directional sync with Cin7 Core API. Real-time webhook notifications for inventory updates."
**Why:** Technical audience evaluating integration capabilities

### Operations Module

**Tone:** Action-oriented & clear
**Example:** "Approve purchase orders in seconds. Route workflows automatically based on custom rules."
**Why:** Focus on efficiency and removing friction

### AI & Analytics Module

**Tone:** Innovative but accessible
**Example:** "AI-powered demand forecasting learns from your sales patterns. Get smarter reorder suggestions every week."
**Why:** Cutting-edge features explained in practical terms

### Consistent Principles (All Modules)

- Active voice (not passive)
- Benefit-focused (what it does for them, not what it is)
- Specific numbers when possible ("3-click approvals" vs "quick approvals")
- Avoid jargon unless standard industry terminology

## Quality Standards

### Completeness Criteria

- ✅ Zero placeholder text (no "Lorem ipsum", "demo", "test", "placeholder")
- ✅ No generic CTAs ("Click here" → specific action)
- ✅ All example data is realistic (no "John Doe" or "test@test.com")
- ✅ Every heading has supporting description
- ✅ All empty states have icon + message + CTA
- ✅ All error messages are specific and actionable
- ✅ All form fields have clear labels and help text
- ✅ All buttons explain what happens when clicked

### Brand Alignment

- ✅ Content reflects 4 differentiators (AI-powered, industry-specialized, modern UX, all-in-one)
- ✅ Voice/tone matches module framework
- ✅ Targets small-to-mid-market businesses
- ✅ Industry terminology accurate for equipment suppliers

### Technical Quality

- ✅ No TypeScript errors (`pnpm run type-check`)
- ✅ No ESLint warnings (`pnpm run lint`)
- ✅ All tests pass (`pnpm run test`)
- ✅ No broken layouts or visual regressions

### Accessibility

- ✅ All images have descriptive alt text
- ✅ All interactive elements have clear labels
- ✅ Color contrast meets WCAG AA (design system compliant)
- ✅ Screen reader friendly (semantic HTML maintained)

### Verification Evidence

- ✅ Screenshots of key pages (before/after)
- ✅ Test output logs showing all checks pass
- ✅ Linear issue updated with completion checklist

## Deliverables

### Per Module

- All pages have production-ready content
- Design consistency verified
- All tests passing
- Linear issue updated
- Screenshots captured
- Ready for review

### Final Deliverables (End of All Modules)

- Complete, production-ready content across all 75+ pages
- Real CCW product catalog in system (50-100 products)
- Full test suite passing
- Documentation of all changes
- Demo-ready prototype for CCW owner

## Timeline

**Phase 0:** 2-3 days (product research + population)
**Modules 1-8:** 12-16 days (~1.5-2 days per module)
**Total:** ~3 weeks (including product research)

## Success Criteria

1. **Zero Placeholder Content** - Every page has real, professional copy
2. **Real Product Catalog** - CCW cleaning equipment products throughout system
3. **Brand Consistency** - All content reflects CCW's business and positioning
4. **Technical Quality** - All tests passing, no TypeScript/lint errors
5. **Demo-Ready** - CCW owner can see fully populated, production-quality system
6. **Modular Completion** - Each module independently reviewable and shippable

## Acceptance Process

After each module completion:

1. Agent presents completed module
2. User reviews content and functionality
3. User either approves or requests specific changes
4. Once approved, proceed to next module

## Risks & Mitigation

**Risk:** CCW website doesn't have structured product data
**Mitigation:** Manual data entry for key products, supplement with industry-standard specs

**Risk:** Content voice inconsistencies between modules
**Mitigation:** Module-by-module review ensures each section is cohesive before moving forward

**Risk:** Breaking existing functionality during content updates
**Mitigation:** Full test suite after each module, isolated changes per module

**Risk:** Scope creep (adding features vs replacing content)
**Mitigation:** Clear scope definition, focus on content replacement only

## References

- Design System: `apps/web/app/globals.css` (comprehensive design tokens)
- Component Library: `apps/web/components/ui/` (shadcn/ui with 35+ components)
- Current Products: Generic mechanical equipment → Replace with cleaning equipment
- Target Audience: Small to mid-market businesses (1-500 employees)

## Notes

- Phase -1 (Codebase Cleanup) completed - removed SaaS subscription and portal code
- All tests must pass before module marked complete
- Linear issues created/updated continuously for tracking
- Each module is independently shippable
- Content strategy focuses on quality over speed
