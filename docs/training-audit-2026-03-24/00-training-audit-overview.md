# Senior PM Training Audit — 2026-03-24

**Audit Date**: 2026-03-24
**Auditor**: Senior Project Manager / UX Researcher
**Scope**: New employee journey mapping, friction point analysis, AI automation opportunities
**Methodology**: Walkthrough-based persona analysis across 6 employee roles

---

## Executive Summary

The current training approach is a **single 2-3 hour generic guide** that does not differentiate by role. This creates significant onboarding friction — a Warehouse Manager must read through invoicing modules irrelevant to their daily work, while a Sales Rep gets lost in the Cin7 integration settings.

**Key Findings**:
- 1 generic training guide for 6 distinct employee roles
- Average time-to-productivity estimate: **2 weeks** (target: **3 days**)
- 23 AI agents exist with **zero user-facing documentation**
- Form autofill agent (AGENT-012) ready but undiscovered by users
- 5 major friction points identified across all roles
- 8 high-value AI automation opportunities mapped

**Business Impact**:
- Each new hire wasting ~2 hours/day first week due to wrong module navigation
- AI features adopted by ~5% of users despite being built and deployed
- Warehouse team using manual stock counts when barcode scanner exists
- Finance team re-entering invoice data manually instead of using order-to-invoice generation

---

## 6 Employee Personas Defined

### PERSONA-1: Sales Representative
**Daily Mission**: Convert enquiries to quotes to confirmed orders
**System Modules**: Customers, Contacts, Quotes, Orders, Products, AI Assistant
**Experience Level**: Moderate computer literacy, sales-focused

### PERSONA-2: Warehouse Manager
**Daily Mission**: Manage stock accuracy, process incoming goods, transfer stock
**System Modules**: Inventory, Purchase Orders, GRN Receiving, Warehouse, Stock Take
**Experience Level**: Variable — some tech-savvy, some prefer physical processes

### PERSONA-3: Accounts / Finance Officer
**Daily Mission**: Issue invoices, record payments, reconcile POS, sync to Xero
**System Modules**: Invoices, POS Reconciliation, Bank Feeds, Reports, Xero
**Experience Level**: Moderate, familiar with accounting software

### PERSONA-4: Workshop Technician
**Daily Mission**: Book equipment services, record maintenance, track parts
**System Modules**: Workshop, Equipment, Bookings, Service Templates, Reminders
**Experience Level**: Low-moderate, prefers simple workflows

### PERSONA-5: Customer Service Representative
**Daily Mission**: Handle enquiries, manage service requests, update customer records
**System Modules**: Customers, Contacts, Activities, Service Requests, Emails
**Experience Level**: Good computer literacy, customer-focused

### PERSONA-6: System Administrator
**Daily Mission**: Manage integrations, approvals, user access, system health
**System Modules**: Settings, Integrations, Approvals, Workflows, Monitoring, Agents
**Experience Level**: Technical, comfortable with API concepts

---

## Journey Maps

### PERSONA-1: Sales Representative Journey

**Day 1 Friction Points**:
1. ❌ **Login → Dashboard confusion**: Dashboard shows all metrics (inventory, POS, workshop) — overwhelming for sales-only role
2. ❌ **Finding customers**: Customers list has no quick-filter by assigned rep
3. ❌ **Quote creation complexity**: 6 form fields before first line item — sales reps want to start with product selection
4. ❌ **Quote to Order conversion**: Button is buried in quote detail dialog
5. ⚠️ **No quote templates**: Every quote starts blank — reps recreate similar quotes manually

**Key Tasks & Current Click Paths**:
```
New Quote: Quotes → + New Quote → Fill 6 header fields → Add Line Items → Save → Send
Current: 12 clicks | Target: 6 clicks (AI pre-fill customer address + terms)

Order Status Check: Orders → Search by order number → Open detail
Current: 3-4 clicks | Could be: Dashboard widget showing "my orders"

Customer History: Customers → Search → Click Customer → Activities tab
Current: 4 clicks | Could be: Customer profile with inline summary
```

**AI Opportunities (PERSONA-1)**:
- 🤖 **Quote auto-generation**: AI reads email enquiry → generates draft quote (form_autofill agent)
- 🤖 **Upsell suggestions**: When adding product to quote, AI suggests complementary products
- 🤖 **Email drafts**: AI writes follow-up email for sent quotes approaching expiry

---

### PERSONA-2: Warehouse Manager Journey

**Day 1 Friction Points**:
1. ❌ **GRN Receiving discoverability**: Path is `Purchase Orders → Receiving` — not obvious from Inventory menu
2. ❌ **Stock take workflow**: Multi-step process with no save-progress feature
3. ❌ **Barcode scanner setup**: useBarcodeScanner hook exists but no documentation explaining how to pair scanners
4. ❌ **Transfer creation**: Source/destination location picker unclear for new staff
5. ⚠️ **Reorder alerts**: ReorderRule exists but no push notification — staff must check dashboard manually

**Key Tasks & Current Click Paths**:
```
Receive Goods (GRN): Purchase Orders → Receiving tab → Select PO → Enter quantities
Current: 5-6 clicks | Target: Scan barcode → auto-match PO

Stock Take: Inventory → Stock Take → New Count → Product by Product Entry
Current: Very slow for 500+ SKUs | Could use: Barcode scanner + mobile UI

Check Reorder Alerts: Inventory → Dashboard → Scroll to reorder section
Current: 3 clicks, easy to miss | Could be: Badge in sidebar nav
```

**AI Opportunities (PERSONA-2)**:
- 🤖 **Auto PO suggestion**: When stock hits reorder point, AI drafts purchase order
- 🤖 **Barcode scanner integration**: Point camera at shelf label → AI identifies product → auto-fills stock count
- 🤖 **Demand forecasting**: AI forecasts 30/60/90-day demand based on order history

---

### PERSONA-3: Accounts / Finance Journey

**Day 1 Friction Points**:
1. ❌ **Invoice from order**: Not obvious that orders can auto-generate invoices (feature exists but buried)
2. ❌ **Xero sync status**: No clear indicator when last sync ran or if it failed
3. ❌ **POS reconciliation**: Matching bank transactions to POS sales is manual — no AI suggestion
4. ❌ **Tax report location**: Revenue/tax reports are in Invoices → Reports tab (not obvious)
5. ⚠️ **Payment recording**: "Record Payment" button only visible after opening invoice detail

**Key Tasks & Current Click Paths**:
```
Generate Invoice from Order: Orders → Open Order → "Generate Invoice" button
Current: 3 clicks | Many staff don't know this exists

Run Tax Report: Invoices → Reports tab → Select date range
Current: 2 clicks once discovered | Problem: Reports tab not discovered

POS Daily Reconciliation: POS Reconciliation → Match Transactions
Current: Manual matching, 10-15 min/day | Could use: AI auto-match (confidence score)
```

**AI Opportunities (PERSONA-3)**:
- 🤖 **POS auto-reconciliation**: AI matches bank transactions to POS sales (>90% confidence)
- 🤖 **Invoice anomaly detection**: AI flags invoices with unusual amounts or duplicate customers
- 🤖 **Xero sync status notifications**: AI summary of nightly sync sent to finance email

---

### PERSONA-4: Workshop Technician Journey

**Day 1 Friction Points**:
1. ❌ **Workshop menu location**: Workshop is at the bottom of a very long sidebar
2. ❌ **Equipment booking vs service**: Difference between "Booking" and "Service Schedule" unclear
3. ❌ **Parts/inventory link**: No connection between service job and inventory deductions
4. ❌ **Reminder setup**: Technicians can't set custom reminders on individual equipment
5. ⚠️ **No mobile view**: Workshop pages not optimised for phone/tablet use in workshop environment

**Key Tasks & Current Click Paths**:
```
Create Booking: Workshop → Schedule → + New Booking
Current: Requires equipment ID lookup | Could pre-populate from equipment QR code

Log Service: Workshop → Equipment → [Equipment] → Service History → Add
Current: 4 clicks | Could be: Scan equipment barcode → auto-load

Check Upcoming Reminders: Workshop → Reminders → Filter by this week
Current: Works but no push notification | Should send email/SMS reminder
```

**AI Opportunities (PERSONA-4)**:
- 🤖 **Service due prediction**: AI predicts next service date from usage patterns
- 🤖 **Parts consumption tracking**: AI tracks which parts are used per service type
- 🤖 **Photo-to-service request**: Take photo of broken equipment → AI creates service request

---

### PERSONA-5: Customer Service Representative Journey

**Day 1 Friction Points**:
1. ❌ **Finding customer + recent activity**: Must check Customers AND Activities — no unified view
2. ❌ **Service request creation**: Form requires technical fields (category, priority) not known initially
3. ❌ **Email history**: Sent emails aren't linked to customer profile by default
4. ❌ **Submission tracking**: Demo form submissions in separate "Submissions" section — staff don't check
5. ⚠️ **No customer communication template**: Every response written from scratch

**Key Tasks & Current Click Paths**:
```
Check Customer History: Customers → Search → Customer Detail → Activities Tab
Current: 4 clicks, comprehensive | Good but slow

Create Service Request: Service Requests → + New → Fill 8 fields
Current: Technical fields confuse new staff | Could pre-fill from AI

Reply to Enquiry: Emails section (if integrated) or external
Current: No CRM-linked email sending | Major gap
```

**AI Opportunities (PERSONA-5)**:
- 🤖 **AI reply drafts**: Customer service agent reads enquiry → drafts response (staff_copilot)
- 🤖 **Auto-priority assignment**: AI assigns service request priority based on issue keywords
- 🤖 **Customer health score**: AI flags at-risk customers before they churn

---

### PERSONA-6: System Administrator Journey

**Day 1 Friction Points**:
1. ⚠️ **Cin7 sync monitoring**: Must know to check Settings → Integrations → Shadow for sync gaps
2. ⚠️ **23 AI agents exist but no dashboard**: No central view showing which agents are active/healthy
3. ⚠️ **Approval workflow complexity**: Creating templates requires technical knowledge of trigger conditions
4. ⚠️ **Environment variable management**: 40+ env vars with no in-app documentation
5. ✅ **Monitoring page works well**: Good metrics but no alerting threshold configuration

---

## Friction Point Priority Matrix

| Friction Point | Personas Affected | Frequency | Effort to Fix | Priority |
|---------------|-------------------|-----------|---------------|----------|
| No role-specific onboarding | All 6 | Once (but high impact) | Medium | 🔴 Critical |
| AI features undiscovered | All 6 | Daily | Low | 🔴 Critical |
| GRN Receiving discoverability | P2 | Daily | Low | 🟠 High |
| Invoice from order hidden | P3 | Daily | Low | 🟠 High |
| Barcode scanner documentation | P2 | Weekly | Low | 🟠 High |
| No customer rep assignment | P1 P5 | Daily | Medium | 🟠 High |
| Workshop mobile UX | P4 | Daily | High | 🟡 Medium |
| Xero sync status indicator | P3 | Daily | Low | 🟡 Medium |
| Approval template complexity | P6 | Weekly | Medium | 🟡 Medium |
| No email CRM integration | P5 | Daily | High | 🟡 Medium |

---

## AI Automation Opportunity Matrix

| Opportunity | Agent Available | Effort to Expose | Annual Time Saved |
|-------------|----------------|-----------------|-------------------|
| Quote auto-generation from email | form_autofill (AGENT-012) ✅ | 1 day (UI only) | ~240 hrs/yr |
| POS auto-reconciliation | ai_chat + rules | 2 weeks | ~60 hrs/yr |
| Demand forecasting display | cin7_forecast ✅ | 1 day (UI) | ~40 hrs/yr |
| AI reply drafts (customer service) | staff_copilot ✅ | 1 day (UI) | ~120 hrs/yr |
| Auto PO from reorder rules | reorder_automation (built) | 2 days | ~80 hrs/yr |
| Service request priority | anomaly agent | 1 week | ~30 hrs/yr |
| Product copy generation | generate agent ✅ | Already done | ~60 hrs/yr |
| Barcode → product lookup | AI + scanner hook | 1 week | ~50 hrs/yr |

**Total potential: ~680 staff-hours saved per year** from activating already-built AI features.

---

## Next Documents in This Audit

- `01-sales-rep-quick-start.md` — 30-min guide for Sales Representatives
- `02-warehouse-quick-start.md` — 30-min guide for Warehouse Managers
- `03-finance-quick-start.md` — 30-min guide for Accounts/Finance
- `04-workshop-quick-start.md` — 30-min guide for Workshop Technicians
- `05-customer-service-quick-start.md` — 30-min guide for Customer Service
- `06-admin-quick-start.md` — 30-min guide for System Administrators
- `07-ai-features-guide.md` — Guide to all 23 AI agents (for all roles)
- `08-90-day-roadmap.md` — Training improvement roadmap

---

**Audit completed**: 2026-03-24
