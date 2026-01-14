# CCW-Online ERP Demo Script

**Version:** 1.0
**Date:** January 13, 2026
**Duration:** ~10-15 minutes

---

## Prerequisites

- **Backend:** Running at http://localhost:8000
- **Frontend:** Running at http://localhost:3005
- **Database:** PostgreSQL with seed data loaded

---

## Login Credentials

- **Email:** admin@demo.com
- **Password:** demo123

---

## Demo Scenario 1: Complete Sales Workflow (5 minutes)

### Step 1: Browse Product Catalog

1. Navigate to **Products** page
2. **Search** for "drill" to demonstrate search functionality
3. **Observe:**
   - Multi-location stock display (Brisbane, Sydney, Melbourne)
   - Low stock indicators (red for ≤10 units)
   - Category badges
   - Pricing information

### Step 2: Create a Quote

1. Navigate to **Quotes** page
2. Click **"Create Quote"**
3. Fill in quote details:
   - **Customer:** Select "Acme Corp" from dropdown
   - **Quote Date:** Today's date
   - **Valid Until:** 30 days from now
   - **Add Line Items:**
     - Cordless Drill - Qty: 5
     - Safety Goggles - Qty: 10
4. **Observe:**
   - Real-time price calculation
   - Line item totals
   - Quote total with tax
5. Click **"Create Quote"**
6. **Result:** Quote created with number Q-2026-XXX

### Step 3: Convert Quote to Order

1. From Quotes list, find the quote just created
2. Click **"View Details"** (Eye icon)
3. Click **"Convert to Order"** button
4. **Observe:**
   - Quote data copied to new order form
   - Order number auto-generated (ORD-2026-XXX)
   - Status set to "draft"
5. Select **Fulfillment Location:** Brisbane
6. Click **"Create Order"**
7. **Result:** Order created, inventory reserved at Brisbane location

### Step 4: Track Order Status

1. Navigate to **Orders** page
2. Find the order just created
3. Click **"View Details"** (Eye icon)
4. **Observe Order Status Timeline:**
   - Draft → Pending → Confirmed → Processing → Shipped → Delivered
   - Current status highlighted
   - Timestamps shown
5. **Progress the Order:**
   - Click **"Confirm Order"** (stock deducted)
   - Click **"Start Processing"**
   - Click **"Mark as Shipped"**
   - Click **"Mark as Delivered"**
6. **Result:** Order progresses through full lifecycle

### Step 5: Print Order and Generate Invoice

1. From Order Detail Dialog, click **"Print"** button
2. **Observe:**
   - Professional print layout
   - Company letterhead
   - Order details and line items
   - Terms and conditions
3. Click **"Invoice"** button
4. **Observe:**
   - Invoice page with payment instructions
   - Bank details (BSB, Account Number)
   - 30-day payment terms
   - GST (10%) calculation
5. Click **"Print Invoice"** from invoice page

---

## Demo Scenario 2: Inventory Management (3 minutes)

### Step 1: Check Inventory Health

1. Navigate to **Inventory** page
2. **Observe:**
   - Critical Stock alerts (≤5 units) - Red badges
   - Low Stock warnings (6-10 units) - Orange badges
   - Stock levels across all 3 locations
   - Available vs Reserved quantities

### Step 2: Transfer Stock Between Locations

1. From Inventory page, find product with low stock in Brisbane
2. Click **"Transfer Stock"** button
3. Fill in transfer details:
   - **From Location:** Sydney (has surplus)
   - **To Location:** Brisbane (has low stock)
   - **Quantity:** 20
   - **Reason:** "Restock low inventory location"
4. Click **"Transfer"**
5. **Result:** Stock moved from Sydney to Brisbane
6. **Verify:** Check transfer history at bottom of page

### Step 3: Manual Stock Adjustment

1. Click **"Adjust Stock"** tab
2. Select product and location
3. Enter adjustment:
   - **Type:** Add or Remove
   - **Quantity:** e.g., -5 (damaged units)
   - **Reason:** "Damaged in warehouse"
4. Click **"Adjust"**
5. **Result:** Stock level updated with audit trail

### Step 4: Stock Transfer from Products Page

1. Navigate to **Products** page
2. Find any product, click **"Transfer Stock"** button (arrows icon)
3. Perform transfer as above
4. **Observe:** Transfer initiated from multiple entry points

---

## Demo Scenario 3: Customer Management (2 minutes)

### Step 1: View Customer Details

1. Navigate to **Customers** page
2. Search for "BuildCorp"
3. Click **"View Details"** (Eye icon)
4. **Observe Customer Detail Page:**
   - Total revenue from customer
   - Number of orders
   - Quote conversion rate
   - Contact information
   - **Order History Tab:**
     - All orders from this customer
     - Status, dates, totals
   - **Quotes Tab:**
     - All quotes for this customer

### Step 2: Quick Customer Add During Order Creation

1. Navigate to **Orders** page
2. Click **"Create Order"**
3. Next to customer dropdown, click **"Quick Add"** button
4. Fill in minimal details:
   - **Company Name:** TechCo Pty Ltd
   - **Contact Name:** John Doe
   - **Email:** john@techco.com.au
   - **Phone:** +61 400 000 000
5. Click **"Add Customer"**
6. **Result:**
   - Customer created instantly
   - Auto-selected in order form
   - No need to navigate away
7. Complete order creation with new customer

---

## Demo Scenario 4: Bulk Operations (2 minutes)

### Step 1: Bulk Delete Products

1. Navigate to **Products** page
2. **Select multiple products:**
   - Click checkbox on 3-5 products
   - Or click "Select All" checkbox in header
3. **Observe:**
   - Selected count shown in header
   - **"Delete Selected (X)"** button appears
4. Click **"Delete Selected"** button
5. **Confirm deletion:**
   - Dialog shows count of items to delete
   - Warning about permanent action
6. Click **"Delete"**
7. **Result:** Selected products deleted, list refreshed

### Step 2: Pagination

1. While on Products page, observe pagination controls:
   - **Items count:** "Showing 1-50 of 342 items"
   - **Page size selector:** 25, 50, 100
   - **Page navigation:** First, Prev, 1, 2, 3, ..., Next, Last
2. **Change page size:** Select 25
3. **Observe:** Page resets to 1, shows 25 items
4. **Navigate pages:** Click page 2, then Next, then Last
5. **Observe:** Smooth pagination with current page highlighted

### Step 3: CSV Export

1. From **Products** page, click **"Export CSV"**
2. **Result:** CSV file downloaded with all product data
3. Repeat for **Customers** and **Orders** pages
4. **Observe:** Different export formats for each entity type

---

## Demo Scenario 5: Search and Filtering (1 minute)

### Step 1: Product Search

1. Navigate to **Products** page
2. In search box, type "power"
3. **Observe:**
   - Debounced search (300ms delay)
   - Results filtered to products matching "power"
   - Works on both SKU and product name
4. Clear search to show all products again

### Step 2: Customer Search

1. Navigate to **Customers** page
2. Search for "construction"
3. **Observe:**
   - Filters by company name, contact name, or email
   - Real-time results
4. Try pagination with search active
5. **Observe:** Search persists across pages

---

## Key Features to Highlight

### ✅ Complete CRUD Operations
- All entities (Products, Customers, Orders, Quotes) support Create, Read, Update, Delete

### ✅ Multi-Location Inventory
- 3 warehouse locations (Brisbane, Sydney, Melbourne)
- Real-time stock tracking per location
- Stock transfers with audit trail
- Stock adjustments with reasons

### ✅ Sales Workflow
- Quote creation with line items
- Convert quote to order (one-click)
- Order status progression with timeline
- Fulfillment location selection
- Stock deduction on order confirmation

### ✅ Printing & Export
- Professional print layouts for orders and quotes
- Invoice generation with payment details
- CSV export for all entities
- Print-optimized styles

### ✅ Bulk Operations
- Multi-select with checkboxes
- Bulk delete with confirmation
- "Select All" functionality
- Selected count display

### ✅ Pagination
- Configurable page size (25, 50, 100)
- Page navigation with ellipsis
- Item count display
- Smooth page transitions

### ✅ Customer Insights
- Order history per customer
- Quote history per customer
- Total revenue calculation
- Quote conversion rate

---

## Technical Highlights

- **Frontend:** Next.js 15, React 19, TypeScript 5.7, Tailwind CSS v4, shadcn/ui
- **Backend:** FastAPI (Python 3.12), SQLAlchemy Async, Pydantic v2
- **Database:** PostgreSQL 15
- **State Management:** React hooks (no Redux/Zustand needed)
- **Form Validation:** Zod + React Hook Form
- **Type Safety:** Full end-to-end TypeScript

---

## Common Demo Talking Points

1. **Real-time Updates:**
   - Inventory updates immediately after stock transfers
   - Order totals calculate in real-time as line items are added

2. **User Experience:**
   - Debounced search (reduces API calls)
   - Loading skeletons (perceived performance)
   - Toast notifications (user feedback)
   - Confirmation dialogs (prevent accidental deletions)
   - Empty states with helpful CTAs

3. **Data Integrity:**
   - Stock validation before order confirmation
   - Audit trails for stock movements
   - Order status validation (can't skip steps)
   - Unique SKU/customer number enforcement

4. **Scalability:**
   - Backend pagination (not loading all records)
   - Lazy loading of stock data
   - Efficient database queries

5. **Production-Ready:**
   - Type-safe codebase
   - Error handling throughout
   - Responsive design (mobile-friendly)
   - Print-optimized layouts

---

## Troubleshooting

**Issue:** Can't create order - "Insufficient stock" error
**Solution:** Check inventory levels, transfer stock from another location, or reduce order quantity

**Issue:** Quote/Order not showing
**Solution:** Refresh page, check pagination, or adjust search filters

**Issue:** Print layout looks wrong
**Solution:** Ensure page is fully loaded before printing, use Chrome for best results

---

## Next Steps / Future Enhancements

1. **Advanced Filtering:**
   - Category filter for products
   - Status filter for orders
   - Date range filters

2. **Keyboard Shortcuts:**
   - `Ctrl+K` - Global search
   - `N` - New item
   - `/` - Focus search box

3. **Dashboard Enhancements:**
   - Real-time inventory alerts widget
   - Order fulfillment status breakdown
   - Revenue by location charts

4. **Reporting:**
   - Sales reports by period
   - Inventory turnover reports
   - Customer lifetime value reports

---

**End of Demo Script**

*This script demonstrates the core functionality of the CCW-Online ERP system. For questions or feedback, contact the development team.*
