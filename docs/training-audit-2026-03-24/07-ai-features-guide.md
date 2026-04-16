# AI Features Guide

**Audience**: All users
**Purpose**: Understand what AI features exist, where to find them, and how to get the most from them

---

## Overview

The CCW-ERP-CRM system includes several AI-powered features built into the normal workflow. You do not need a separate AI subscription or technical knowledge — these features are integrated into the pages you already use.

### AI features at a glance

| Feature            | Where to find it             | Who benefits most         |
| ------------------ | ---------------------------- | ------------------------- |
| AI Chat Assistant  | `/ai-assistant`              | Everyone                  |
| Quote Copilot Chat | `/quotes` (Sparkles icon)    | Sales                     |
| Inventory Forecast | `/inventory/forecast`        | Warehouse                 |
| Anomaly Detection  | `/alerts`                    | Warehouse, Finance, Admin |
| Staff Copilot      | `/ai-assistant` (contextual) | Customer Service          |
| Marketing AI       | `/marketing`                 | Sales, Marketing          |
| Quote Generator    | `/quotes/generate`           | Sales                     |
| PRD Generator      | `/prd/generate`              | Product/Admin             |
| Form autofill      | Various forms                | Everyone                  |

---

## Feature 1: AI Chat Assistant

**URL**: `/ai-assistant`
**Available to**: All users

### What it does

A general-purpose AI chat interface connected to the system's data. You can ask questions in plain English about customers, orders, products, stock levels, and business metrics.

### How to use it

1. Navigate to `/ai-assistant` from the sidebar
2. Type your question in the message box
3. Press Enter or click Send
4. The AI responds using live data from your ERP

### Example prompts by role

**Sales**

- "What is the current selling price and stock level for [SKU]?"
- "Draft a follow-up email for a quote sent 5 days ago that has not been accepted"
- "Who are our top 10 customers by revenue this quarter?"

**Warehouse**

- "Which products are below reorder point right now?"
- "How much stock of [product name] do we have across all locations?"
- "What is the average lead time for our top supplier?"

**Finance**

- "What is our total outstanding accounts receivable today?"
- "List all invoices overdue by more than 30 days"
- "What was our revenue for the last financial quarter?"

**Customer Service**

- "Give me a summary of customer [company name]'s last 3 months"
- "How many open service requests do we have right now?"
- "What is the resolution rate for warranty claims this month?"

**Admin**

- "Which integrations have had sync failures in the last 24 hours?"
- "How many pending approvals are over their SLA?"
- "What is the current agent error rate?"

### Tips for better results

- Be specific: "invoices overdue by 30+ days" is better than "overdue invoices"
- Include context: "for customer ABC Cleaning Services" narrows results
- Ask for formats: "as a bullet list" or "as a table" to get structured output
- Iterate: if the first answer is incomplete, ask a follow-up question

---

## Feature 2: Quote Copilot Chat

**URL**: `/quotes` → Sparkles icon on any quote row
**Available to**: Sales Representatives

### What it does

An in-page AI assistant specifically for quotes. It has full context of the selected quote (customer, line items, pricing) and can generate customer-facing text and sales suggestions.

### How to use it

1. Navigate to `/quotes`
2. Find the quote you are working on
3. Click the **Sparkles** icon on that quote's row
4. The Quote Copilot Chat panel slides in from the right
5. Ask it questions or give it tasks related to that quote

### Useful prompts

- "Write a professional covering email for this quote"
- "Suggest 3 complementary products to upsell alongside the items on this quote"
- "Summarise this quote in 2 sentences for a phone call"
- "What objections might this customer have, and how should I address them?"
- "Translate the technical product names into plain language for the customer"

---

## Feature 3: Inventory Forecast

**URL**: `/inventory/forecast`
**Available to**: Warehouse Managers, Purchasing, Finance

### What it does

Uses historical sales data and seasonal patterns to predict future demand for each SKU. Shows predicted stock-out dates and recommended reorder quantities.

### How to use it

1. Navigate to `/inventory/forecast`
2. Select a **Time Horizon** (14 days / 30 days / 90 days)
3. Filter by **Location** or **Category** if needed
4. The forecast table shows:
   - Current stock on hand
   - Predicted demand over the period
   - Predicted stock-out date (if no reorder)
   - Suggested reorder quantity
   - Confidence level (Low / Medium / High based on historical data volume)

### How the forecast works

The AI model analyses:

- 12 months of sales history for each SKU
- Seasonal patterns (e.g. higher demand for water extractors in summer)
- Current open orders and reservations
- Lead times from suppliers

### Acting on a forecast

- Click **Create Purchase Order** next to any SKU with a predicted stock-out to generate a draft PO
- Export the full forecast to CSV for review in Excel
- Share the forecast with your supplier for forward planning

---

## Feature 4: Anomaly Detection

**URL**: `/alerts` (anomaly alerts appear automatically)
**Available to**: Warehouse, Finance, Admin

### What it does

Runs continuously in the background and flags unusual patterns that may indicate errors, fraud, theft, or data integrity issues.

### Types of anomalies detected

| Anomaly Type           | Example                                                |
| ---------------------- | ------------------------------------------------------ |
| Stock level drop       | SKU loses 40% stock in 1 hour with no sales            |
| Unusual payment        | Invoice paid twice, or payment amount doesn't match    |
| Revenue spike/drop     | Revenue 3x higher or lower than the same day last week |
| Supplier price change  | Purchase price 20%+ above historical average           |
| Order frequency change | Customer who orders weekly has not ordered in 30 days  |

### How to respond to an anomaly alert

1. Navigate to `/alerts`
2. Anomaly alerts are labelled with type and severity
3. Click the alert to see the full detail: what was detected, when, and the data behind it
4. Investigate using the linked module (e.g. click through to the affected SKU or customer)
5. Click **Acknowledge** once you have reviewed it
6. Click **Resolve** once the issue is addressed or confirmed as a false positive
7. Add a resolution note for audit trail

---

## Feature 5: Staff Copilot

**URL**: `/ai-assistant` (contextual prompts for customer service scenarios)
**Available to**: Customer Service Representatives

### What it does

A specialised AI assistant tuned for customer service and relationship management. It helps staff respond to difficult situations, draft communications, and navigate complex policies.

### Best use cases

1. **Drafting responses** — give it the customer's complaint and ask for a professional reply
2. **Escalation guidance** — describe an edge case and ask what policy or process applies
3. **Customer history summaries** — paste a customer's name and ask for a plain-English briefing
4. **De-escalation coaching** — "How should I respond to a customer who is very angry about a delivery delay?"

### How to frame prompts for customer service

Use this structure for best results:

```
Context: [Customer name, their issue in 1-2 sentences]
Task: [What you want the AI to produce — e.g. "draft a reply email", "give me talking points", "suggest resolution options"]
Tone: [Professional / Empathetic / Firm / Apologetic]
```

**Example**:

```
Context: Customer John Smith at ABC Cleaning is upset that his truckmount arrived damaged and his service technician is booked in tomorrow.
Task: Draft a reply email acknowledging the damage, explaining next steps, and offering a temporary replacement.
Tone: Empathetic and professional.
```

---

## Feature 6: Marketing AI

**URL**: `/marketing`
**Available to**: Sales, Marketing

### What it does

Generates product descriptions, marketing copy, and promotional content using your product catalogue data.

### How to use it

1. Navigate to `/marketing`
2. Select a product or enter product details
3. Choose the content type:
   - **Product Description** — for website/catalogue
   - **Social Media Post** — for Facebook, Instagram, LinkedIn
   - **Email Promotion** — for customer newsletters
   - **SEO Meta Description** — for search engine optimisation
4. Click **Generate**
5. Edit the output as needed and copy to your destination

---

## Feature 7: Quote Generator

**URL**: `/quotes/generate`
**Available to**: Sales Representatives

### What it does

Generates a draft quote from a brief description. Instead of building line items manually, you describe what the customer needs and the AI suggests the appropriate products and quantities.

### How to use it

1. Navigate to `/quotes/generate`
2. Enter a brief description of what the customer needs, e.g.:
   - "Truckmount setup for a 2-van commercial cleaning business"
   - "Full starter kit for upholstery cleaning"
3. The AI suggests:
   - Products from your catalogue that match
   - Recommended quantities
   - Estimated total
4. Review and adjust the line items
5. Select the customer and click **Create Quote** to save it as a draft

---

## Feature 8: Form Autofill

**Available on**: Quote form, Order form, Customer form
**Available to**: Everyone

### What it does

When creating a new record, the AI can suggest field values based on partial input or context.

### How it works

- Start typing a customer name and the AI suggests the full company and contact details
- When adding line items to a quote, the AI suggests the most likely unit price based on recent quotes for that customer
- On the customer form, entering a business name can suggest industry, typical product categories, and region

### Enabling autofill suggestions

Autofill suggestions appear automatically as you type — look for the greyed-out suggestion text or the dropdown that appears. Press **Tab** to accept a suggestion, or keep typing to override it.

---

## Getting the Most from AI Features

### Do

- Treat AI output as a **draft, not a final product** — always review before sending to customers
- Be specific in your prompts — more context = better results
- Use AI for first drafts of repetitive tasks (emails, descriptions, summaries)
- Iterate — ask follow-up questions to refine the output

### Do not

- Send AI-generated emails to customers without reading them first
- Rely on AI forecasts as the only input to purchasing decisions
- Assume AI anomaly alerts are always correct — they flag possibilities, not certainties
- Enter confidential third-party data (other customers' data, supplier contracts) into the AI chat

### Understanding AI confidence

Some features show a confidence indicator (Low / Medium / High):

- **High confidence** — based on substantial historical data, likely to be accurate
- **Medium confidence** — limited data, treat as a guide
- **Low confidence** — very little data, use for directional insight only

### Feedback and improvement

If the AI gives a clearly wrong or unhelpful response:

1. Use the thumbs-down / feedback button if visible
2. Report significant errors to your system administrator
3. The more the system is used with real data, the more accurate forecasts and suggestions become

---

## AI Feature Summary Table

| Feature            | URL                   | Roles                     | Key Benefit                                     |
| ------------------ | --------------------- | ------------------------- | ----------------------------------------------- |
| AI Chat Assistant  | `/ai-assistant`       | All                       | Plain-English queries across all system data    |
| Quote Copilot      | `/quotes` (Sparkles)  | Sales                     | In-context quote writing and upsell suggestions |
| Inventory Forecast | `/inventory/forecast` | Warehouse, Purchasing     | Predict stock-outs before they happen           |
| Anomaly Detection  | `/alerts`             | Warehouse, Finance, Admin | Auto-flag unusual patterns                      |
| Staff Copilot      | `/ai-assistant`       | Customer Service          | Draft customer responses, escalation guidance   |
| Marketing AI       | `/marketing`          | Sales, Marketing          | Generate product copy and promotional content   |
| Quote Generator    | `/quotes/generate`    | Sales                     | Create draft quotes from a brief description    |
| PRD Generator      | `/prd/generate`       | Product, Admin            | Generate product requirement documents          |
| Form Autofill      | Various forms         | All                       | Speed up data entry with smart suggestions      |
