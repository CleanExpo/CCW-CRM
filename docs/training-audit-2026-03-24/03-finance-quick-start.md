# Finance / Accounts Quick-Start Guide

**Time to Complete**: 30 minutes
**Role**: Accounts / Finance
**Daily Modules**: Invoices, POS Reconciliation, Reports, Bank Feeds, Reconciliation, Settings (Xero)

---

## Your Daily Workflow

```
1. Review open invoices (unpaid, overdue)
2. Generate invoices from completed orders
3. Record incoming payments
4. Reconcile POS end-of-day
5. Run revenue or tax report
6. Monitor Xero sync status
```

---

## Step 1: Getting Oriented — Invoices Module (5 min)

### Navigate to Invoices
1. Click **Invoices** in the sidebar → `/invoices`
2. The page opens with two tabs:
   - **Invoices** — the main list with pagination and filters
   - **Financial Reports** — revenue, tax, and period summary reports

### Reading the invoice list
Each row shows:
- Invoice number (format: INV-YYYY-NNN)
- Customer name
- Invoice date and due date
- Total amount (GST inclusive)
- Status badge

### Invoice status meanings
| Status | Meaning |
|---|---|
| Draft | Created, not yet sent to customer |
| Sent | Delivered to customer, awaiting payment |
| Paid | Payment recorded in full |
| Partial | Part payment received |
| Overdue | Due date passed, no full payment |
| Void | Cancelled invoice |

### View an individual invoice
Click the **Eye** icon on any row to open the full invoice detail at `/invoices/[id]`.
The detail page shows: line items, tax breakdown, payment history, and a print-ready view.

---

## Step 2: Generating an Invoice from an Order (10 min)

The most common finance workflow is converting a completed order into an invoice.

### Method 1: From the Orders page
1. Navigate to `/orders`
2. Find an order with status **Shipped** or **Delivered**
3. Click the **Invoice** icon (document icon) on that row
4. The system generates a draft invoice pre-populated with:
   - Customer details from the order
   - All line items and unit prices
   - Tax (GST 10%) calculated automatically
   - Invoice date set to today
5. Review the pre-populated data and adjust if needed (e.g. payment terms, notes)
6. Click **Save** to store as Draft, or change status to **Sent** to mark as issued

### Method 2: Create invoice manually
1. Navigate to `/invoices`
2. Click **+ New Invoice** (top right)
3. Fill in:
   - **Customer** — search and select
   - **Invoice Date** — defaults to today
   - **Due Date** — set payment terms (e.g. 30 days)
   - **Line Items** — add products or free-text lines
4. Tax is calculated as the line items are entered (10% GST on each line)
5. Click **Save**

### Direct invoice URL from order
You can also navigate directly to `/orders/[id]/invoice` to create an invoice for a specific order.

---

## Step 3: Recording a Payment (5 min)

### Record payment against an invoice
1. On `/invoices`, find the invoice (status: Sent or Partial)
2. Click the **$ Record Payment** button (DollarSign icon) on that row
3. The Record Payment dialog opens — fill in:
   - **Amount** — payment amount received
   - **Payment Method** — Cash / Card / EFT / Cheque / Other
   - **Payment Date** — date funds received
   - **Reference** — bank reference or receipt number (optional)
4. Click **Record Payment**

### Partial payments
If the customer pays less than the full amount:
- Enter the partial amount received
- The invoice status changes to **Partial**
- Repeat the process when the balance arrives
- Status automatically changes to **Paid** when the full amount is covered

### What happens after recording
- Invoice status updates immediately
- The payment is logged in the invoice's payment history (visible on the detail page)
- If Xero sync is active, the payment syncs to Xero automatically within 1–2 minutes

---

## Step 4: POS Reconciliation (5 min)

The POS reconciliation process matches POS terminal sales against expected receipts.

### Run end-of-day reconciliation
1. Navigate to `/pos/reconciliation`
2. Select the **Date** for reconciliation (defaults to today)
3. Select the **Terminal/Location** if you have multiple POS locations
4. The page shows:
   - **Expected receipts** — total from POS transactions for the period
   - **Recorded cash** — amount physically counted in the till
   - **Card totals** — card payment totals from POS
   - **Variance** — difference between expected and recorded
5. Enter the **Physical Cash Count** in the input field
6. Click **Submit Reconciliation**

### Bank feeds reconciliation
1. Navigate to `/bank-feeds` for automated bank feed matching
2. Or navigate to `/reconciliation` for the full reconciliation module
3. Unmatched transactions appear at the top — match them to invoices or payments manually if they weren't auto-matched

---

## Step 5: Running Revenue and Tax Reports (5 min)

### Financial Reports tab (on /invoices)
1. Navigate to `/invoices`
2. Click the **Financial Reports** tab (BarChart3 icon)
3. Select report parameters:
   - **Period** — This Month / Last Month / Quarter / Custom Date Range
   - **Report Type** — Revenue Summary or Tax (GST) Report
4. Click **Generate Report**
5. The report shows: total invoiced, total paid, outstanding, GST collected, GST by period

### KPI Reports
1. Navigate to `/reports`
2. The Reports page has two tabs:
   - **Sales KPI Dashboard** — revenue trends, top customers, order volumes
   - **Inventory Health Dashboard** — stock value, turnover rates, low-stock counts
3. Use the date range pickers to select the period

### Export reports
- Every report table has a **Download CSV** button for Excel-compatible export
- The Financial Reports tab also has a **Print** option for PDF output

---

## Step 6: Xero Sync Monitoring (5 min)

### Check Xero integration status
1. Navigate to `/settings/integrations`
2. Find the **Xero** card
3. Status shows: Connected / Disconnected / Sync Error
4. The last sync timestamp is displayed

### What syncs to Xero
- Invoices (when status changes to Sent or Paid)
- Payments recorded in the system
- Customer records

### If sync shows an error
1. Click **View Error Details** on the Xero card
2. Common errors: token expired (reconnect), invoice already exists in Xero (duplicate), customer not found in Xero (needs manual match)
3. For token expiry: click **Reconnect Xero** and follow the OAuth flow

---

## Quick Reference

| Task | Where | Action |
|---|---|---|
| Invoice list | `/invoices` | Sidebar: Invoices |
| View invoice detail | `/invoices` | Eye icon on row |
| New invoice | `/invoices` | + New Invoice |
| Invoice from order | `/orders` | Invoice icon on row |
| Record payment | `/invoices` | $ icon on row |
| POS reconciliation | `/pos/reconciliation` | Select date, enter cash count |
| Bank feeds | `/bank-feeds` | Match unreconciled transactions |
| Revenue report | `/invoices` → Financial Reports tab | Select period → Generate |
| KPI reports | `/reports` | Sales KPI / Inventory Health tabs |
| Xero status | `/settings/integrations` | Xero card |

---

## AI Features for Finance

| Feature | Location | How to use |
|---|---|---|
| AI Assistant | `/ai-assistant` | "Show me all unpaid invoices over 60 days" or "What is our average debtor days?" |
| Anomaly Detection | `/alerts` | Flags unusual payment patterns or revenue drops |
| Forecasting | `/reports` | AI-driven revenue predictions in the KPI dashboard |

**Pro tip**: Use the AI Assistant at month-end. Ask "Summarise this month's revenue and outstanding receivables" for an instant narrative you can paste into your management report.
