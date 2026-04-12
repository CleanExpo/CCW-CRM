# Warehouse Manager Quick-Start Guide

**Time to Complete**: 30 minutes
**Role**: Warehouse Manager
**Daily Modules**: Inventory, Warehouse, Purchase Orders, Stock Takes, Barcode Scanner

---

## Your Daily Workflow

```
1. Check Inventory dashboard (stock alerts, low-stock)
2. Review incoming Purchase Orders → process GRN
3. Conduct or review Stock Takes
4. Adjust reorder points for fast-moving SKUs
5. Transfer stock between locations as needed
6. Use barcode scanner for rapid stock lookup
```

---

## Step 1: Getting Oriented — Inventory Dashboard (5 min)

### Navigate to Inventory

1. Click **Inventory** in the sidebar → `/inventory`
2. The dashboard shows 4 key metric cards:
   - **Total SKUs** — number of distinct products tracked
   - **Total Stock Value** — aggregate cost value of stock on hand
   - **Below Reorder Point** — count of SKUs needing replenishment (shown in red if non-zero)
   - **Active Reservations** — stock reserved for confirmed orders

### Stock health panels

Below the metric cards, three panels group products by urgency:

- **Critical** — zero stock or negative availability
- **Low** — stock below reorder point
- **Warning** — stock approaching reorder point

Click any product row to see its per-location breakdown (Brisbane, Sydney, Melbourne).

### Warehouse Operations tab

1. Navigate to `/warehouse`
2. The Warehouse page has two tabs:
   - **Operations** — pending tasks, incoming shipments, stock movements
   - **Locations & Stock** — stock levels per physical location
   - **Transfers** — inter-location transfer history

---

## Step 2: Checking Stock Levels (5 min)

### Full stock list

1. Go to `/inventory/stock`
2. The stock page lists every product with columns: SKU, name, total stock, reserved, available
3. Use the search bar to find a specific SKU
4. Click a product row to expand per-location stock

### Stock by location

From `/inventory`, use the **Locations & Stock** section to see which warehouse holds which quantities.

### Barcode scanner setup and use

The barcode scanner is built into the Inventory page:

1. On `/inventory`, click the **Scan Barcode** button (barcode icon, top right)
2. The scanner activates your device camera or USB scanner input
3. Scan any product barcode — the system instantly shows that product's stock levels
4. Works with both USB HID barcode scanners (plug in and scan) and camera-based scanning on tablets

**USB scanner tip**: USB HID scanners work automatically — they appear as keyboard input. No driver or setup needed. Scan a barcode and the system detects it within 100ms.

---

## Step 3: Processing a GRN from a Purchase Order (10 min)

A **GRN (Goods Received Note)** records stock arriving from a supplier against a Purchase Order.

### Find the Purchase Order

1. Navigate to `/purchase-orders`
2. Locate the PO with status **Confirmed** or **Ordered** for the delivery you are processing
3. Note the PO number (format: PO-YYYY-NNN)

### Open the Receiving page

1. Navigate to `/purchase-orders/receiving`
2. Select the PO from the dropdown or search by PO number
3. The page shows all line items on the PO with their ordered quantities

### Record received quantities

1. For each line item, enter the **Received Qty** in the input field
2. If a partial delivery: enter only what physically arrived
3. If a discrepancy exists (damaged, short-shipped), enter actual received qty and add a note
4. Select the **Receiving Location** (warehouse/bin)
5. Click **Submit GRN**

### What happens after GRN submission

- Stock levels for those SKUs increase by the received quantities at the selected location
- The PO status updates to **Partially Received** or **Received** depending on quantities
- A sync event fires to Cin7 inventory if the integration is active
- The inventory dashboard "Below Reorder Point" count recalculates automatically

---

## Step 4: Running a Stock Take (5 min)

A **Stock Take** reconciles physical count against system count.

### Start a stock take

1. Navigate to `/inventory` and click the **Stock Take** tab (or the BookOpen icon)
2. Click **New Stock Take**
3. Select the **Location** being counted (or select All Locations for a full count)
4. The system generates a count sheet with all active SKUs

### Record physical counts

1. For each SKU, enter the **Physical Count** you actually counted
2. The **Variance** column shows the difference (system vs. physical)
3. Positive variance = more on shelf than system shows
4. Negative variance = less on shelf (shrinkage, damage, mispicks)

### Finalise the stock take

1. Review all variances
2. Click **Finalise** to apply the adjustments to live stock levels
3. The system creates adjustment records for audit trail
4. Large negative variances (>10 units or >$500 value) trigger an alert to the admin

---

## Step 5: Setting Reorder Points (5 min)

Reorder points trigger automatic purchase order suggestions when stock drops below a threshold.

### Set a reorder point

1. On `/inventory`, find the product in the stock list
2. Click the **Settings** icon (cog) on that product row — opens the Reorder Point Dialog
3. Set:
   - **Reorder Point** — minimum stock level that triggers a reorder alert (e.g. 5 units)
   - **Reorder Quantity** — how many units to order when triggered (e.g. 20 units)
   - **Location** — which warehouse location this rule applies to
4. Click **Save Reorder Rule**

### Viewing and managing all reorder rules

- Reorder rules are visible on the product's location breakdown row
- Products below their reorder point appear in the "Low" or "Critical" panels on the inventory dashboard
- When a reorder is triggered, the system can auto-generate a draft Purchase Order (if auto-reorder is enabled in settings)

---

## Quick Reference

| Task                | Where                        | Action                  |
| ------------------- | ---------------------------- | ----------------------- |
| Inventory dashboard | `/inventory`                 | Sidebar: Inventory      |
| Stock by location   | `/inventory/stock`           | Stock tab               |
| Barcode scan        | `/inventory`                 | Scan Barcode button     |
| Process GRN         | `/purchase-orders/receiving` | Select PO → enter qtys  |
| Stock take          | `/inventory`                 | Stock Take tab → New    |
| Set reorder point   | `/inventory`                 | Cog icon on product row |
| Stock transfer      | `/inventory/transfers`       | New Transfer button     |
| Warehouse ops       | `/warehouse`                 | Sidebar: Warehouse      |
| BOM view            | `/inventory/bom`             | Bills of Materials      |
| Reservations        | `/inventory/reservations`    | Reserved stock list     |

---

## AI Features for Warehouse Managers

| Feature            | Location                                     | How to use                                                          |
| ------------------ | -------------------------------------------- | ------------------------------------------------------------------- |
| Inventory Forecast | `/inventory/forecast`                        | AI-powered demand forecast per SKU; shows predicted stock-out dates |
| Anomaly Detection  | Backend-driven, surfaced in Alerts `/alerts` | Flags unusual stock movements (e.g. sudden 40% drop in a SKU)       |
| AI Assistant       | `/ai-assistant`                              | Ask "What are my top 10 fast-moving SKUs this month?"               |

**Pro tip**: Before a month-end count, navigate to `/inventory/forecast` to see which SKUs the AI predicts will hit zero within 14 days — prioritise those for reordering before the count.
