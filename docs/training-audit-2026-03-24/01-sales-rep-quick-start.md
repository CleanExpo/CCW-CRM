# Sales Representative Quick-Start Guide

**Time to Complete**: 30 minutes
**Role**: Sales Representative
**Daily Modules**: Dashboard, Customers, Quotes, Orders, Products, AI Assistant

---

## Your Daily Workflow

```
1. Check Dashboard (metrics + pending quotes)
2. Look up or create Customer
3. Build Quote with line items
4. Send Quote → wait for approval
5. Convert accepted Quote to Order
6. Monitor Order status through fulfilment
```

---

## Step 1: Getting Oriented (5 min)

### Login
Navigate to the app URL and sign in with your credentials. You land on the **Dashboard** at `/dashboard`.

### Dashboard at a glance
The dashboard shows:
- **Revenue metrics** — today's sales, month-to-date totals
- **Recent orders** — last 10 orders with status badges
- **Pending quotes** — quotes awaiting customer response
- **Low-stock alerts** — products you may not be able to promise

### Sidebar navigation (left panel)
Key sections for sales reps:
| Section | URL | What it does |
|---|---|---|
| Dashboard | `/dashboard` | Daily overview |
| Customers | `/customers` | Customer database |
| Quotes | `/quotes` | Quote management |
| Orders | `/orders` | Order management |
| Products | `/products` | Product catalogue |
| AI Assistant | `/ai-assistant` | AI chat for help |

---

## Step 2: Finding and Creating Customers (5 min)

### Search for an existing customer
1. Click **Customers** in the sidebar → `/customers`
2. Use the search bar at the top to search by company name, contact name, or email
3. Click on a customer row to open their profile at `/customers/[id]`
4. The customer profile shows: contact details, activity timeline, all quotes and orders

### Create a new customer
1. On `/customers`, click the **+ New Customer** button (top right)
2. Fill in the form:
   - **Company Name** (required)
   - **Contact Name**
   - **Email** (used for quote delivery)
   - **Phone**
   - **Billing Address**
3. Click **Create** — the customer is saved and you are returned to the list

**Tip**: Search before creating to avoid duplicates. The system uses company name + email to identify unique customers.

---

## Step 3: Creating a Quote with Line Items (10 min)

### Open the Quotes module
1. Click **Quotes** in the sidebar → `/quotes`
2. Click **+ New Quote** (top right)

### Fill in quote details
- **Customer** — start typing to search and select from dropdown
- **Valid Until** — set an expiry date (default: 30 days)
- **Notes** — internal notes or customer-facing terms

### Add line items
1. In the **Line Items** section, click **Add Item**
2. Search for a product by SKU or name
3. Set **Quantity** and confirm the **Unit Price** (pre-populated from product catalogue, editable)
4. Repeat for all items
5. Totals (subtotal, GST, total) calculate automatically

### Quote statuses
| Status | Meaning |
|---|---|
| Draft | Not yet sent, still editing |
| Pending | Awaiting internal review |
| Sent | Delivered to customer |
| Accepted | Customer confirmed |
| Rejected | Customer declined |
| Expired | Past valid-until date |

### Save and send
1. Click **Save** to store as Draft
2. Use the **Edit** button (pencil icon) to reopen and modify
3. When ready, change status to **Sent** to mark as delivered to customer

### Export a quote
- Click the **Download** icon to export as CSV
- Click the **PDF** icon to export a print-ready PDF

---

## Step 4: Converting a Quote to an Order (5 min)

Once a customer accepts a quote:

1. On `/quotes`, find the accepted quote in the list
2. Click the **Convert** button (arrow icon — "Convert to Order") on that row
3. A confirmation dialog appears — review the line items
4. Click **Convert to Order**
5. The system creates an order with status **Draft** and links it back to the quote
6. You are redirected to the new order at `/orders`

**What carries over**: customer, all line items, pricing, notes.

**After conversion**: Update the order status to **Confirmed** to trigger fulfilment workflow.

---

## Step 5: Using AI Assistant for Product Copy (5 min)

### Quote Copilot (in-page, on /quotes)
1. On the Quotes page, click the **Sparkles** icon on any quote row
2. The **Quote Copilot Chat** panel opens on the right
3. Ask it to: "Write a professional covering note for this quote" or "Suggest upsells for a truckmount cleaning system"
4. Copy the generated text into your quote notes or email

### General AI Assistant
1. Navigate to `/ai-assistant`
2. Use free-text chat to ask any question about products, customers, or process
3. Example prompts:
   - "What are the specs for the [Product Name]?"
   - "Draft a follow-up email for a quote that expires in 3 days"
   - "What is the margin on SKU CCW-1234?"

---

## Quick Reference

| Task | Where | Button/Action |
|---|---|---|
| Search customers | `/customers` | Search bar at top |
| New customer | `/customers` | + New Customer |
| New quote | `/quotes` | + New Quote |
| Add line item | Quote form | Add Item |
| Convert quote to order | `/quotes` | Arrow icon on row |
| View order detail | `/orders` | Eye icon on row |
| Export CSV | `/quotes` or `/orders` | Download icon |
| Export PDF | `/quotes` or `/orders` | PDF icon |
| AI copilot | `/quotes` | Sparkles icon on row |
| AI assistant chat | `/ai-assistant` | Sidebar link |

---

## AI Features for Sales Representatives

| Feature | Location | How to use |
|---|---|---|
| Quote Copilot Chat | `/quotes` (Sparkles icon per row) | Generate covering notes, upsell suggestions |
| AI Assistant | `/ai-assistant` | Product research, email drafts, process questions |
| Generate Quote | `/quotes/generate` | AI-assisted quote creation from brief |
| Marketing AI | `/marketing` | Generate product descriptions for customer communications |

**Pro tip**: Use the AI Assistant to research a product before a customer call. Ask "What are the key selling points of [product name]?" for instant talking points.
