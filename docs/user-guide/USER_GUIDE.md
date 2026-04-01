# CCW-Online ERP - User Guide

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Products Module](#products-module)
4. [Customers Module](#customers-module)
5. [Orders Module](#orders-module)
6. [Quotes Module](#quotes-module)
7. [Common Tasks](#common-tasks)
8. [Tips and Best Practices](#tips-and-best-practices)

---

## Introduction

CCW-Online ERP is a comprehensive equipment supplier ERP system designed to streamline your daily operations including product management, customer relationships, order processing, and quote generation. This guide will walk you through all major features and workflows.

**Target Audience**: This guide is for end users including sales representatives, warehouse staff, and customer service personnel.

**What You'll Learn**:
- How to navigate the system
- Managing products, customers, orders, and quotes
- End-to-end workflows from quote to delivery
- Common tasks and best practices

---

## Getting Started

### Logging In

1. **Navigate to the application**
   - Production: `https://ccw-online.com`
   - Or use the URL provided by your administrator

2. **Enter your credentials**
   - **Email**: Your company email address
   - **Password**: Your password (case-sensitive)

3. **Click "Sign In"**
   - You'll be redirected to the dashboard

**First Time Login:**
- You'll receive an email with your initial password
- Change your password immediately after first login
- Click your name (top right) → **My Profile** → **Change Password**

**Forgot Password:**
- Click "Forgot Password?" link on login page
- Enter your email address
- Check email for password reset link (expires in 1 hour)
- Check spam folder if email not received within 5 minutes

### Dashboard Overview

After logging in, you'll see the dashboard with three main sections:

**1. Quick Stats (Top Cards)**
- **Total Products**: Number of active products in catalog
- **Total Customers**: Number of active customers
- **Active Orders**: Orders in pending/confirmed/processing status
- **Total Revenue**: Sum of all delivered orders (current month)

**2. Recent Activity Feed (Center)**
- Latest orders created/updated
- Recent quotes sent to customers
- Product stock alerts (low inventory)
- System notifications

**3. Quick Actions (Right Sidebar)**
- **Create Order** - Start a new order
- **Create Quote** - Generate a customer quote
- **Add Product** - Add new product to catalog
- **Add Customer** - Register new customer

### Navigation

The sidebar (left side) provides access to all modules:

- **Dashboard** (🏠) - Overview and metrics
- **Products** (📦) - Product catalog management
- **Customers** (👥) - Customer directory
- **Orders** (📋) - Order processing and tracking
- **Quotes** (💵) - Quote generation and management

**Collapsed Sidebar**: Click the hamburger icon (☰) to collapse/expand the sidebar for more screen space.

---

## Products Module

The Products module allows you to manage your complete product catalog including pricing, stock levels, categorization, and warehouse locations.

### Viewing Products

1. **Navigate to Products** - Click **Products** in the sidebar
2. **Product list displays** - Shows all active products with:
   - SKU (Stock Keeping Unit - unique identifier)
   - Product name
   - Category
   - Price
   - Stock level
   - Warehouse location

**List Features**:
- **Pagination**: 50 products per page (use page navigation at bottom)
- **Search**: Type in search bar to filter by product name or SKU
- **Category Filter**: Dropdown to filter by category
- **Sort**: Click column headers to sort (name, price, stock)

### Searching for Products

**Search Bar** (top of product list):

1. **Search by name**: Type "drill" to find all drill products
2. **Search by SKU**: Type "DRILL-001" for exact match
3. **Wildcards**: Use partial matches like "drill*" to find all drill-related SKUs

**Category Filter** (dropdown next to search):

Available categories:
- Heavy Machinery
- Hand Tools
- Power Tools
- Safety Equipment
- Building Materials
- Electrical
- Plumbing
- Accessories

**Example Searches**:
- Find all power tools: Select "Power Tools" category
- Find cordless drills: Type "cordless drill" in search + select "Power Tools"
- Find product by SKU: Type exact SKU like "DRILL-XR18"

### Creating a Product

1. **Click "Create Product" button** (top right of product list)

2. **Fill in required fields** (marked with *):

   **Product Identification:**
   - **SKU***: Unique identifier (e.g., "DRILL-001", "HAMMER-050")
     - Must be unique across all products
     - Use consistent naming: CATEGORY-NUMBER
     - Max 50 characters, alphanumeric with hyphens

   - **Name***: Product name (e.g., "Cordless Drill 18V 2-Speed")
     - Clear, descriptive name
     - Max 200 characters
     - Include key specifications in name

   - **Category***: Select from dropdown
     - Choose the most appropriate category
     - Impacts product filtering and reports

   **Pricing:**
   - **Price***: Selling price in dollars (e.g., 149.99)
     - Must be positive number
     - Up to 2 decimal places
     - Exclude dollar sign or commas

   - **Cost**: Your cost/wholesale price (optional)
     - Used for profit margin calculations
     - Not visible to customers

   **Inventory:**
   - **Stock***: Current inventory count (e.g., 100)
     - Whole number only (no decimals)
     - Can be 0 if out of stock
     - Updates automatically when orders ship

   - **Warehouse Location**: Bin/shelf location (e.g., "A-12-3", "Aisle 5 Shelf 2")
     - Helps warehouse staff locate products quickly
     - Max 50 characters
     - Use consistent location format

   **Description:**
   - **Description**: Detailed product description (optional)
     - Supports multiple lines
     - Include features, specifications, dimensions
     - Up to 1000 characters

3. **Click "Save"**
   - Product created and added to catalog
   - Success message displays
   - Redirected to product list

**Validation Errors:**
- "SKU already exists" - Choose a different SKU
- "Price must be positive" - Enter value greater than 0
- "Name is required" - Cannot be blank

### Editing a Product

1. **Find the product** - Use search or browse product list

2. **Click "Edit" button** (pencil icon) next to the product

3. **Modify fields** - Change any field except SKU
   - SKU cannot be changed after creation (data integrity)
   - All other fields are editable

4. **Common edits**:
   - **Update price**: Change selling price
   - **Adjust stock**: Reflect inventory changes (use positive number for new count)
   - **Change location**: Update warehouse location if moved
   - **Update description**: Add more details or specifications

5. **Click "Update"**
   - Changes saved immediately
   - Success message displays
   - Product list refreshes with updated info

**Best Practices**:
- Don't change price if there are pending quotes (quote prices become outdated)
- Document significant price changes in notes
- Stock adjustments should reflect actual physical inventory

### Deleting a Product

**Important**: Products are "soft deleted" (marked inactive) rather than permanently removed. This preserves historical data for orders and quotes.

1. **Find the product** to delete

2. **Click "Delete" button** (trash icon)

3. **Confirmation dialog appears**
   - Warning: "Are you absolutely sure?"
   - Message: "This will mark the product as inactive. Historical orders will not be affected."

4. **Click "Delete"** to confirm (or "Cancel" to abort)

**Result**:
- Product marked as inactive (is_active = false)
- No longer appears in product list by default
- Existing orders/quotes retain product information
- Cannot be ordered in new quotes/orders

**Cannot Delete If**:
- Product has pending orders (complete or cancel orders first)
- Product is referenced in active quotes (convert or expire quotes first)

**Restoring Deleted Products**:
- Contact your administrator to reactivate deleted products
- Admins can change is_active flag back to true

### Product Details View

Click on any product row (anywhere except Edit/Delete buttons) to view full details:

**Product Details Page Shows**:
- All product information (SKU, name, category, price, cost, stock, location, description)
- Stock history (adjustments over time)
- Active quotes containing this product
- Order history for this product
- Profit margin (if cost entered): `(Price - Cost) / Price × 100%`

**Actions Available**:
- **Edit Product** - Same as Edit button on list
- **Adjust Stock** - Quick stock adjustment modal
- **View Orders** - See all orders containing this product

---

## Customers Module

The Customers module manages your customer directory including contact information, addresses, and order history.

### Viewing Customers

1. **Navigate to Customers** - Click **Customers** in the sidebar

2. **Customer list displays** - Shows all active customers with:
   - Customer number (auto-generated, format: CUST-0001)
   - Company name
   - Contact person
   - Email address
   - Phone number
   - Location (City, State)

**List Features**:
- **Pagination**: 50 customers per page
- **Search**: Filter by company name or email
- **Sort**: Click column headers to sort
- **Status Filter**: Show active/inactive customers

### Searching for Customers

**Search Bar**:
- Type company name: "Acme Corp"
- Type email: "john@acme.com"
- Partial matches work: "acme" finds "Acme Corp", "Acme Industries", etc.

### Creating a Customer

1. **Click "Create Customer" button** (top right)

2. **Fill in required fields**:

   **Company Information:**
   - **Company Name***: Business name (e.g., "Acme Corporation")
     - Max 200 characters
     - Must be unique if you want to distinguish between customers

   - **Contact Name***: Primary contact person (e.g., "John Smith")
     - Full name of person you communicate with
     - Max 100 characters

   **Contact Information:**
   - **Email***: Contact email address (e.g., "john@acme.com")
     - Must be valid email format
     - Must be unique (each customer needs different email)
     - Used for quote/order notifications

   - **Phone**: Contact phone number (e.g., "+1-555-0100")
     - Optional but recommended
     - Format: +[country]-[area]-[number]
     - Can include extensions

   **Address:**
   - **Address***: Street address (e.g., "123 Main Street, Suite 100")
     - Shipping/billing address
     - Max 200 characters

   - **City***: City name (e.g., "New York")
   - **State***: State/province (e.g., "NY")
     - Use 2-letter abbreviation for US states
   - **Postal Code***: ZIP/postal code (e.g., "10001")
   - **Country**: Country name (default: "USA")

3. **Click "Save"**
   - Customer created with auto-generated customer number
   - Success message displays
   - Redirected to customer list

**Validation Errors**:
- "Email already exists" - This email is registered to another customer
- "Invalid email format" - Check email format (must include @)
- "Required fields cannot be empty" - Fill all required fields (marked with *)

### Editing Customer Information

1. **Find the customer** - Search or browse customer list

2. **Click "Edit" button** (pencil icon)

3. **Update information**:
   - **Contact changes**: New contact person, email, phone
   - **Address changes**: Moving to new location
   - **Company name**: Rare but possible (e.g., after acquisition)

4. **Click "Update"**
   - Changes saved
   - All future orders/quotes use updated information
   - Historical orders retain original information

**Common Edit Scenarios**:
- **Contact person changed**: Update Contact Name and Email
- **Company moved**: Update Address, City, State, Postal Code
- **New phone number**: Update Phone field
- **Company renamed**: Update Company Name

### Viewing Customer Details

Click on a customer row to view full customer profile:

**Customer Profile Shows**:
- Complete contact information
- Full address
- Customer number
- Account status (active/inactive)
- **Order History**:
  - List of all orders from this customer
  - Order numbers, dates, statuses, totals
  - Click order to view details
- **Quote History**:
  - All quotes sent to this customer
  - Quote numbers, dates, statuses, totals
  - Click quote to view details
- **Total Revenue**: Sum of all delivered orders
- **Average Order Value**: Total revenue / number of orders

**Actions Available**:
- **Edit Customer** - Update information
- **Create Order** - New order for this customer (auto-fills customer)
- **Create Quote** - New quote for this customer (auto-fills customer)
- **View All Orders** - Full order history
- **View All Quotes** - Full quote history

### Deleting a Customer

**Important**: Customers are soft deleted to preserve order/quote history.

1. **Find the customer** to delete

2. **Click "Delete" button** (trash icon)

3. **Confirmation dialog**
   - Warning: "Are you absolutely sure?"
   - Message: "Customer will be marked inactive. Historical orders will be preserved."

4. **Click "Delete"** to confirm

**Result**:
- Customer marked inactive
- No longer appears in customer list by default
- Cannot create new orders/quotes for this customer
- Historical orders/quotes remain intact

**Cannot Delete If**:
- Customer has active orders (complete or cancel orders first)
- Customer has pending quotes (convert or expire quotes first)

---

## Orders Module

The Orders module handles the complete order lifecycle from creation to delivery.

### Viewing Orders

1. **Navigate to Orders** - Click **Orders** in the sidebar

2. **Order list displays** - Shows all orders with:
   - Order number (format: ORD-2026-001)
   - Customer name
   - Order date
   - Status (color-coded badge)
   - Total amount
   - Actions (Edit, Delete)

**List Features**:
- **Status Filter**: Dropdown to filter by status
- **Search**: Filter by order number or customer name
- **Sort**: By order date (newest first) or total amount
- **Pagination**: 50 orders per page

**Status Color Indicators**:
- **Gray**: Draft - Initial creation, editable
- **Yellow**: Pending - Awaiting approval
- **Blue**: Confirmed - Approved, ready for processing
- **Purple**: Processing - Being prepared for shipment
- **Orange**: Shipped - En route to customer
- **Green**: Delivered - Successfully delivered
- **Red**: Cancelled - Order cancelled

### Creating an Order

Creating an order is a multi-step process:

#### Step 1: Select Customer

1. **Click "Create Order" button** (top right)

2. **Select customer**:
   - **Existing customer**: Click "Select Existing Customer"
     - Search by company name or email
     - Click customer to select
   - **New customer**: Click "Create New Customer"
     - Fills in customer creation form
     - Save customer, then continue with order

3. **Customer details display**
   - Company name
   - Contact person
   - Shipping address
   - Verify information is correct

4. **Click "Next"** to continue

#### Step 2: Add Line Items

1. **Click "Add Item" button**

2. **Search for product**:
   - Type product name or SKU
   - Dropdown shows matching products
   - Click product to add

3. **Enter quantity**:
   - Default: 1
   - Enter desired quantity (whole number)
   - Cannot exceed available stock (warning if you try)

4. **Unit price auto-populates**:
   - Default: Product's selling price
   - Editable (for discounts or special pricing)

5. **Subtotal calculates automatically**:
   - Subtotal = Quantity × Unit Price
   - Updates when quantity or price changes

6. **Add more items**:
   - Click "Add Item" again to add more products
   - Repeat until all items added

7. **Remove items**:
   - Click "Remove" (X icon) next to item to remove

**Line Items Summary**:
- List of all items with quantities and prices
- Subtotal for each line item
- **Order Total**: Sum of all line item subtotals (displayed at bottom)

#### Step 3: Review and Save

1. **Review order details**:
   - Customer information
   - All line items
   - Order total

2. **Add notes** (optional):
   - Special instructions
   - Shipping requirements
   - Customer requests
   - Internal notes (not visible to customer)

3. **Choose save option**:
   - **Save as Draft**: Saves order but doesn't commit (status: Draft)
     - Can be edited later
     - Not visible to customer
     - Not counted in inventory
   - **Save and Confirm**: Saves and confirms order (status: Confirmed)
     - Ready for processing
     - Reduces product stock
     - Customer notification sent (if configured)

**Validation**:
- At least one line item required
- All quantities must be positive
- Total must be greater than $0

### Editing an Order

**Editable Statuses**: Draft, Pending only

1. **Find the order** - Search or browse order list

2. **Click "Edit" button** (pencil icon)
   - Only available for Draft/Pending orders
   - Grayed out for Confirmed or later status orders

3. **Edit Items** section allows:
   - **Change quantities**: Update quantity for any item
   - **Change prices**: Adjust unit price (discounts)
   - **Add items**: Click "Add Item" to include more products
   - **Remove items**: Click "Remove" (X icon) to delete line items

4. **Order total recalculates** automatically as you edit

5. **Update notes** if needed

6. **Click "Update Order"**
   - Changes saved
   - Status remains same (Draft or Pending)

**Cannot Edit After Confirmation**:
- Once order status is "Confirmed" or later, items cannot be edited
- Reason: Order is in fulfillment process, inventory already adjusted
- Solution: Cancel order and create new one with corrections

### Updating Order Status

Orders progress through these statuses in sequence:

**Order Status Workflow**:

```
Draft → Pending → Confirmed → Processing → Shipped → Delivered
  ↓         ↓          ↓           ↓          ↓
  └─────────────→ Cancelled ←──────────────────┘
```

**Status Transitions**:

1. **Draft → Pending**
   - User: Submits order for approval
   - Action: Click "Submit for Approval"

2. **Pending → Confirmed**
   - User: Sales manager or admin
   - Action: Click "Confirm Order"
   - System: Reduces product stock quantities

3. **Confirmed → Processing**
   - User: Warehouse staff
   - Action: Click "Start Processing"
   - Meaning: Warehouse begins picking and packing

4. **Processing → Shipped**
   - User: Warehouse staff
   - Action: Click "Mark as Shipped"
   - Optional: Add tracking number
   - System: Sends customer notification (if configured)

5. **Shipped → Delivered**
   - User: Warehouse staff or auto (from carrier API)
   - Action: Click "Mark as Delivered"
   - System: Updates metrics, revenue calculations

6. **Any Status → Cancelled**
   - User: Anyone with cancel permission
   - Action: Click "Cancel Order"
   - Reason: Customer cancellation, out of stock, etc.
   - System: Restores product stock (if was confirmed)

**How to Change Status**:

1. **Open order** - Click on order in list
2. **Click "Change Status" button** (top right)
3. **Select new status** from dropdown
   - Only valid next statuses are shown
   - Cannot skip statuses (e.g., Draft → Shipped not allowed)
4. **Add notes** (optional) - Explain reason for status change
5. **Click "Update Status"**
   - Status updates immediately
   - Notification sent (if configured)
   - Order history logged

### Deleting an Order

**Important**: Only Draft orders can be deleted.

1. **Find the Draft order** to delete

2. **Click "Delete" button** (trash icon)
   - Only visible for Draft orders
   - Grayed out for all other statuses

3. **Confirmation dialog**
   - Warning: "Are you absolutely sure?"
   - "This action cannot be undone."

4. **Click "Delete"** to confirm

**Result**: Order permanently deleted

**Alternative for Non-Draft Orders**:
- Cannot delete Confirmed or later orders
- Must "Cancel" instead (preserves audit trail)
- Cancelled orders remain in system for reporting

### Order Details View

Click on order row to view complete order details:

**Order Details Page Shows**:
- **Order Information**:
  - Order number
  - Order date
  - Current status
  - Customer information (company, contact, address)
  - Notes

- **Line Items Table**:
  - Product SKU and name
  - Quantity ordered
  - Unit price
  - Subtotal
  - Order total (sum of all subtotals)

- **Order History**:
  - Status change log
  - Timestamps for each status
  - User who made each change
  - Notes added during status changes

- **Actions Available**:
  - **Change Status** - Progress order through workflow
  - **Print Order** - Printable order form (for warehouse)
  - **Email Customer** - Send order confirmation email
  - **Cancel Order** - Cancel this order (if not delivered)

---

## Quotes Module

The Quotes module enables you to create professional quotes for customers and convert them to orders upon acceptance.

### Viewing Quotes

1. **Navigate to Quotes** - Click **Quotes** in the sidebar

2. **Quote list displays** - Shows all quotes with:
   - Quote number (format: Q-2026-001)
   - Customer name
   - Quote date
   - Valid until date
   - Status (color-coded badge)
   - Total amount
   - Actions (Edit, Delete, Convert)

**List Features**:
- **Status Filter**: Filter by quote status
- **Search**: Filter by quote number or customer
- **Sort**: By quote date or total
- **Pagination**: 50 quotes per page

**Status Color Indicators**:
- **Gray**: Draft - Not sent to customer
- **Yellow**: Pending - Awaiting internal approval
- **Blue**: Sent - Delivered to customer, awaiting response
- **Green**: Accepted - Customer accepted, ready to convert
- **Red**: Rejected - Customer declined
- **Orange**: Expired - Past valid until date

### Creating a Quote

Quote creation is similar to order creation:

#### Step 1: Select Customer

1. **Click "Create Quote" button** (top right)

2. **Select customer**:
   - Existing customer (search and select)
   - Or create new customer

3. **Click "Next"**

#### Step 2: Add Line Items

1. **Add products** - Same as order creation:
   - Click "Add Item"
   - Search and select product
   - Enter quantity
   - Unit price defaults to product price (editable)

2. **Pricing flexibility**:
   - Adjust unit prices for quotes
   - Offer volume discounts
   - Special pricing for quotes
   - Prices don't affect product catalog

3. **Add multiple items** as needed

#### Step 3: Set Validity Period

1. **Valid Until date** - When quote expires:
   - Default: 30 days from quote date
   - Editable: Select custom date from calendar
   - Recommendation: 15-45 days depending on product/customer

2. **Why validity period matters**:
   - Protects against price fluctuations
   - Encourages timely customer decision
   - After expiry, quote status changes to "Expired"

#### Step 4: Review and Save

1. **Add notes for customer** (optional):
   - Special terms or conditions
   - Payment terms (e.g., "Net 30")
   - Shipping details
   - Other relevant information
   - **Note**: These notes are visible to customer (if quote is sent via email)

2. **Choose save option**:
   - **Save as Draft**: Save without sending (status: Draft)
     - Can be edited later
     - Not visible to customer
   - **Save and Send**: Save and mark as sent (status: Sent)
     - Marks quote as sent to customer
     - If email configured, sends quote email automatically
     - Cannot be edited after sending (create revised version instead)

### Editing a Quote

**Editable Statuses**: Draft, Pending only

1. **Find the quote** - Search or browse

2. **Click "Edit" button** (pencil icon)
   - Only available for Draft/Pending quotes
   - Cannot edit Sent/Accepted/Rejected quotes

3. **Edit line items**:
   - Change quantities
   - Adjust prices
   - Add or remove items

4. **Update validity date** if needed

5. **Update notes**

6. **Click "Update Quote"**

**Cannot Edit Sent Quotes**:
- Once quote is sent to customer, it's locked
- Reason: Customer has already seen original quote
- Solution: Create a "Revised Quote" as new quote

**Creating Revised Quote**:
1. Open original quote
2. Click "Create Revision" button
3. New quote created with:
   - Same customer
   - Same line items (editable)
   - New quote number (incremented)
   - New quote date
   - Notes: "Revision of Q-2026-001"
4. Edit as needed
5. Send revised quote to customer

### Converting Quote to Order

**Most Important Quote Feature**: Converting an accepted quote into an order.

**Prerequisites**:
- Quote status must be "Accepted" (manually set after customer accepts)
- Quote must not be expired
- All products in quote must still be active
- Sufficient stock must be available (warning if not, but conversion still allowed)

**Conversion Steps**:

1. **Update quote status to "Accepted"**:
   - Open quote
   - Click "Change Status"
   - Select "Accepted"
   - Add note: "Customer accepted via email on 2/2/2026"

2. **Click "Convert to Order" button** (top right of quote details)

3. **Review order details** - Pre-filled from quote:
   - Customer (same as quote)
   - Line items (same products, quantities, prices)
   - Notes (copied from quote)

4. **Modify if needed**:
   - Usually no changes needed
   - Can adjust quantities or prices if customer requested changes
   - Can add or remove items

5. **Click "Create Order"**

**Result**:
- New order created with status "Confirmed"
- Order number assigned (e.g., ORD-2026-015)
- Product stock reduced
- Quote status remains "Accepted" (link to order added)
- Success message: "Quote successfully converted to order ORD-2026-015"

**What Happens**:
- Quote and order are now linked
- Quote details page shows link to order: "Converted to Order: ORD-2026-015"
- Order details page shows origin: "Created from Quote: Q-2026-001"
- Stock levels update immediately
- Order ready for fulfillment workflow

### Quote Status Management

**Status Workflow**:

```
Draft → Pending → Sent → Accepted → (Converted to Order)
  ↓       ↓        ↓
  └───────────→ Rejected
               (or Expired)
```

**How to Change Quote Status**:

1. **Open quote**
2. **Click "Change Status" button**
3. **Select new status**:
   - Draft → Pending: Submit for approval
   - Pending → Sent: Send to customer
   - Sent → Accepted: Customer accepted
   - Sent → Rejected: Customer declined
   - Any → Expired: Past valid until date (or manual expiry)
4. **Add notes** (required for Accepted/Rejected) - Document customer response
5. **Click "Update Status"**

**Automatic Status Changes**:
- **Expired**: System automatically changes status to "Expired" after Valid Until date passes
  - Check runs daily at midnight
  - Can manually expire before date if needed

### Deleting a Quote

**Important**: Only Draft quotes can be deleted.

1. **Find the Draft quote**

2. **Click "Delete" button** (trash icon)

3. **Confirmation dialog**

4. **Click "Delete"**

**Result**: Quote permanently deleted

**Alternative for Sent Quotes**:
- Cannot delete Sent/Accepted/Rejected quotes
- Mark as "Expired" instead
- Preserves quote history for customer relationship

### Quote Details View

Click on quote row to view full details:

**Quote Details Shows**:
- Quote number, date, valid until date
- Current status
- Customer information
- Line items with quantities and prices
- Quote total
- Notes for customer
- Status history
- If converted: Link to order

**Actions Available**:
- **Change Status** - Update quote status
- **Convert to Order** - Convert to order (if accepted)
- **Print Quote** - Printable quote for customer
- **Email Quote** - Send quote via email
- **Create Revision** - Create revised version
- **Delete** - Delete quote (Draft only)

---

## Common Tasks

### Task 1: Complete Quote-to-Order Workflow

**Scenario**: Customer requests a quote, accepts it, and you convert to an order.

**Steps**:

1. **Create customer** (if new)
   - Customers → Create Customer
   - Enter company info, contact details, address
   - Save

2. **Create quote**
   - Quotes → Create Quote
   - Select customer
   - Add products with quantities
   - Set valid until date (30 days)
   - Add notes (payment terms, shipping, etc.)
   - Save and Send

3. **Send quote to customer** (external - email, phone, in person)

4. **Customer accepts**

5. **Update quote status**
   - Open quote
   - Change Status → Accepted
   - Add note: "Customer accepted via email on [date]"

6. **Convert to order**
   - Click "Convert to Order"
   - Review and confirm
   - Create Order

7. **Order is now confirmed**
   - Ready for fulfillment
   - Stock reduced automatically

**Time**: 5-10 minutes

### Task 2: Process Order Through Fulfillment

**Scenario**: Confirmed order needs to be fulfilled and delivered.

**Steps**:

1. **Find confirmed order**
   - Orders → Filter: Status = Confirmed

2. **Start processing**
   - Open order
   - Change Status → Processing
   - Warehouse begins picking items

3. **Print order** (for warehouse)
   - Click "Print Order" button
   - Gives warehouse staff order details

4. **Items picked and packed**

5. **Mark as shipped**
   - Change Status → Shipped
   - Add tracking number (if available)
   - Customer notification sent (if configured)

6. **Customer receives order**

7. **Mark as delivered**
   - Change Status → Delivered
   - Order complete

**Time**: Varies (1-5 days depending on shipping)

### Task 3: Adjust Product Stock

**Scenario**: Physical inventory count shows different stock than system.

**Steps**:

1. **Find product**
   - Products → Search by SKU or name

2. **Two methods**:

   **Method A: Edit Product**
   - Click "Edit" button
   - Update Stock field with new count
   - Save

   **Method B: Quick Stock Adjustment** (from product details)
   - Click on product to view details
   - Click "Adjust Stock" button
   - Enter new stock count
   - Add note explaining adjustment
   - Save

3. **Stock updated**
   - New count shows in product list
   - Adjustment logged in stock history

**Best Practice**: Add note explaining adjustment ("Annual inventory count" or "Received new shipment")

### Task 4: Search Across Modules

**Scenario**: Customer calls asking about "their drill order."

**Steps**:

1. **Find customer first**
   - Customers → Search: Customer company name or contact name
   - Click on customer to view profile

2. **View customer order history**
   - Customer details page shows order list
   - Filter: Search "drill" in order items
   - Click on order to view details

3. **Alternative: Search orders directly**
   - Orders → Search: Customer name
   - Browse order list for drill products
   - Look at line items in each order

**Result**: Find the specific order customer is asking about.

### Task 5: Handle Out of Stock Product

**Scenario**: Customer wants to order product that's out of stock.

**Options**:

1. **Backorder** (if you plan to restock):
   - Create order normally
   - Add note: "Backorder - estimated ship date [date]"
   - Change status to Pending (not Confirmed)
   - Once stock arrives, update stock count
   - Confirm order and ship

2. **Alternative product**:
   - Search for similar products in same category
   - Suggest alternative to customer
   - Create quote/order with alternative product

3. **Wait for restock**:
   - Don't create order yet
   - Note customer interest
   - Contact customer when product back in stock
   - Create order at that time

---

## Tips and Best Practices

### General Tips

1. **Use search liberally**
   - Faster than scrolling through lists
   - Works across all modules
   - Supports partial matches

2. **Save drafts frequently**
   - Don't lose work
   - Save orders and quotes as drafts while building
   - Confirm/send only when ready

3. **Add meaningful notes**
   - Future you will thank you
   - Notes help other team members
   - Document customer requests, special instructions, issues

4. **Use consistent naming**
   - Product SKUs: CATEGORY-NUMBER format
   - Notes: Include dates and names
   - Locations: Standardize format (A-12-3 vs. Aisle A Shelf 12)

### Products Best Practices

1. **SKU naming conventions**
   - Use consistent format: DRILL-001, HAMMER-050, SAW-010
   - Group related products (DRILL-XR001, DRILL-XR002)
   - Don't use special characters (avoid /, \, &)

2. **Stock management**
   - Regular inventory counts (quarterly minimum)
   - Adjust stock after physical counts
   - Set low stock alerts (contact admin to configure)
   - Document all adjustments with notes

3. **Pricing**
   - Review prices regularly (quarterly)
   - Document price changes
   - Consider existing pending quotes before changing prices
   - Use Cost field to track profit margins

### Customers Best Practices

1. **Contact information**
   - Keep email addresses up to date (used for notifications)
   - Update contact person when they change
   - Maintain accurate shipping addresses
   - Add phone extension if needed

2. **Communication**
   - Use customer notes for special requirements
   - Document preferred shipping carrier
   - Note billing terms (Net 30, prepay, etc.)
   - Record sales rep assignments

### Orders Best Practices

1. **Order accuracy**
   - Double-check customer address before confirming
   - Verify quantities with customer
   - Confirm pricing matches quote (if applicable)
   - Review order total before confirming

2. **Status updates**
   - Update status promptly (keeps customer informed)
   - Add notes when changing status (explains what happened)
   - Don't skip statuses (breaks workflow)
   - Mark as delivered only after confirmation

3. **Inventory awareness**
   - Check stock before creating large orders
   - Warn customer if stock is low
   - Don't promise delivery dates without checking stock
   - Coordinate with warehouse on availability

### Quotes Best Practices

1. **Quote creation**
   - Use realistic validity periods (15-45 days)
   - Be specific in notes (payment terms, shipping, lead time)
   - Consider volume discounts
   - Price quotes competitively but profitably

2. **Quote follow-up**
   - Track quote status (Sent → Accepted/Rejected)
   - Follow up with customer before expiry
   - Create revised quotes if needed (not expired)
   - Document customer responses in notes

3. **Quote-to-order conversion**
   - Always update status to Accepted before converting
   - Review order details before finalizing
   - Verify stock availability
   - Check if customer requested changes

### Troubleshooting Tips

1. **Page won't load**
   - Refresh page (F5)
   - Clear browser cache
   - Check internet connection
   - Contact support if persistent

2. **Data not appearing**
   - Check filters (may be hiding data)
   - Verify search terms (typos)
   - Look at all pages (pagination)
   - Refresh page

3. **Cannot edit**
   - Check record status (may be locked)
   - Verify permissions (contact admin)
   - Check if record is in use (orders/quotes)

4. **Errors on save**
   - Read error message (tells you what's wrong)
   - Check required fields (marked with *)
   - Verify unique constraints (SKU, email, etc.)
   - Contact support if unclear

### Keyboard Shortcuts

- **Ctrl + K**: Global search (search anything)
- **Alt + N**: Create new (context-aware)
- **Esc**: Close dialog/modal
- **Tab**: Navigate between form fields
- **Enter**: Submit form (when focused on field)

### Mobile Usage

- **Supported**: System works on tablets (iPad, Android tablets)
- **Recommended**: 10" or larger screen
- **Limited**: Phone usage (can view, limited editing)
- **Best**: Desktop/laptop for data entry

---

## Next Steps

Now that you've learned the basics, you can:

1. **Practice**: Create test products, customers, orders, and quotes
2. **Explore**: Click around and explore all features
3. **Admin Guide**: If you're an administrator, see [ADMIN_GUIDE.md](ADMIN_GUIDE.md)
4. **Troubleshooting**: For issues, see [TROUBLESHOOTING_GUIDE.md](TROUBLESHOOTING_GUIDE.md)
5. **API**: For developers, see [API_DOCUMENTATION.md](API_DOCUMENTATION.md)

**Questions?** Contact support@ccw-online.com or call +1-555-CCW-HELP

---

**Last Updated**: February 2, 2026
**Version**: 1.0.0
**Feedback**: documentation@ccw-online.com
