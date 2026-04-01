# CCW Online ERP - User Training Guide

## Overview

Welcome to the CCW Online ERP system! This guide will help you get started with the system and understand its key features.

**Training Duration**: 2-3 hours
**Prerequisites**: Basic computer skills, familiarity with web applications

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Dashboard Overview](#2-dashboard-overview)
3. [Product Management](#3-product-management)
4. [Customer Management](#4-customer-management)
5. [Order Processing](#5-order-processing)
6. [Quote Management](#6-quote-management)
7. [Inventory Management](#7-inventory-management)
8. [AI-Powered Search](#8-ai-powered-search)
9. [Multi-Language Support](#9-multi-language-support)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Getting Started

### 1.1 Accessing the System

**URL**: https://erp.ccw-example.com

**Browsers Supported**:
- Google Chrome (recommended)
- Microsoft Edge
- Firefox
- Safari

### 1.2 Logging In

1. Go to https://erp.ccw-example.com
2. Enter your email address
3. Enter your password
4. Click "Sign In"

**Demo Credentials** (for training):
- Email: `admin@demo.com`
- Password: `demo123`

### 1.3 First Time Login

When you log in for the first time:
1. You'll see a welcome screen
2. Click "Get Started" to view the dashboard
3. Take a quick tour of the interface

### 1.4 Interface Layout

The system has three main areas:

**Sidebar** (left):
- Navigation menu
- Quick access to all modules
- Language selector at bottom

**Main Content** (center):
- Module content
- Forms and tables
- Action buttons

**Top Bar** (top right):
- Search
- Notifications
- User profile menu
- Logout

---

## 2. Dashboard Overview

The dashboard provides an at-a-glance view of your business metrics.

### 2.1 Key Metrics

**Top Row Cards**:
- **Total Revenue**: Current month revenue
- **Active Orders**: Orders in processing
- **Inventory Value**: Total stock value
- **Customers**: Total active customers

### 2.2 Charts

**Revenue Chart**:
- Shows daily/weekly/monthly revenue trends
- Click date range to adjust timeframe
- Hover for detailed numbers

**Category Sales**:
- Top-selling product categories
- Shows quantity and revenue
- Updated in real-time

**Order Status Breakdown**:
- Visual breakdown of order statuses
- Click segment to view details
- Shows draft, pending, confirmed, shipped

### 2.3 Recent Activity

**Recent Orders**:
- Last 10 orders
- Click order number to view details
- Shows customer, date, status, total

**Low Stock Alerts**:
- Products below reorder point
- Click to create purchase order
- Auto-refreshes every 5 minutes

---

## 3. Product Management

### 3.1 Viewing Products

1. Click "Products" in sidebar
2. Use search bar to find products
3. Filter by category using dropdown
4. Click product name to view details

### 3.2 Adding a New Product

1. Click "+ Add Product" button
2. Fill in required fields:
   - **SKU**: Unique product code (e.g., "PD-2000")
   - **Name**: Product name
   - **Category**: Select from dropdown
   - **Price**: Selling price (AUD)
   - **Cost**: Purchase cost (for margin calculation)
   - **Stock**: Current quantity
   - **Warehouse Location**: Physical location code

3. Optional fields:
   - **Description**: Detailed product information
   - **Specifications**: Technical specs (JSON format)
   - **Images**: Upload product images

4. Click "Create Product"
5. Confirmation message appears
6. Product is added to catalog

### 3.3 Editing a Product

1. Find product using search
2. Click product name
3. Click "Edit" button
4. Modify fields as needed
5. Click "Update Product"
6. Changes are saved immediately

### 3.4 Deleting a Product

⚠️ **Warning**: Deleting a product is permanent!

1. Find product
2. Click product name
3. Click "Delete" button
4. Confirm deletion in popup
5. Product is removed from catalog

**Note**: Products with existing orders cannot be deleted. Mark as "inactive" instead.

### 3.5 Bulk Operations

**Import Products**:
1. Click "Import" button
2. Download CSV template
3. Fill in product data
4. Upload completed CSV
5. Review preview
6. Click "Import" to add products

**Export Products**:
1. Click "Export" button
2. Select format (CSV/Excel)
3. Choose filters (optional)
4. Click "Download"
5. File downloads automatically

---

## 4. Customer Management

### 4.1 Viewing Customers

1. Click "Customers" in sidebar
2. View customer list with:
   - Company name
   - Contact person
   - Email
   - Phone
   - Status (active/inactive)

### 4.2 Adding a New Customer

1. Click "+ Add Customer" button
2. Fill in details:
   - **Customer Number**: Auto-generated (e.g., "CUST-001")
   - **Company Name**: Business name
   - **Contact Name**: Primary contact person
   - **Email**: Primary email address
   - **Phone**: Contact number

3. Address Information:
   - **Street Address**
   - **City**
   - **State** (select from dropdown)
   - **Postal Code**
   - **Country** (default: Australia)

4. Click "Create Customer"

### 4.3 Customer Details

Click a customer name to view:
- Contact information
- Order history
- Quotes history
- Payment history
- Service requests
- Notes and communications

### 4.4 Customer Portal

Customers can access a self-service portal:
- Track orders
- Download invoices
- Submit service requests
- View quotes

**Enabling Portal Access**:
1. Go to customer details
2. Click "Enable Portal"
3. System sends welcome email
4. Customer sets password
5. Customer can now login at portal.ccw-example.com

---

## 5. Order Processing

### 5.1 Creating an Order

**Method 1: From Scratch**

1. Click "Orders" → "+ New Order"
2. Select customer (or create new)
3. Add line items:
   - Search for product
   - Enter quantity
   - Price auto-fills
   - Adjust price if needed (discount)
   - Click "Add"

4. Add more items as needed
5. Review order summary:
   - Subtotal
   - Tax (10% GST for AU)
   - Shipping (if applicable)
   - Total

6. Add notes (optional)
7. Click "Create Order"

**Method 2: Convert from Quote**

1. Open quote
2. Click "Convert to Order"
3. Verify details
4. Adjust if needed
5. Click "Create Order"

### 5.2 Order Statuses

Orders progress through these statuses:

**Draft**: Not yet confirmed
- Edit freely
- Customer not notified
- Not committed in inventory

**Pending**: Awaiting confirmation
- Sent to customer
- Awaiting payment/approval
- Not committed in inventory

**Confirmed**: Approved and ready
- Payment received or approved
- Committed in inventory
- Ready for picking

**Processing**: Being prepared
- Warehouse picking items
- Packing in progress
- Cannot be cancelled easily

**Shipped**: Out for delivery
- Tracking number assigned
- Customer notified
- Awaiting delivery confirmation

**Delivered**: Completed
- Customer received goods
- Ready for invoicing
- Order history only

**Cancelled**: Void order
- Customer cancelled
- Items returned to stock
- Order history only

### 5.3 Managing Orders

**Updating Status**:
1. Open order
2. Click "Update Status"
3. Select new status
4. Add note (why status changed)
5. Click "Update"
6. Customer notified automatically

**Adding Items**:
- Only possible in Draft/Pending status
- Click "Add Item"
- Search and select product
- Enter quantity
- Click "Add"

**Removing Items**:
- Only possible in Draft/Pending status
- Click "×" next to item
- Confirm deletion

**Printing Order**:
1. Open order
2. Click "Print" button
3. Choose format:
   - Order Confirmation (for customer)
   - Picking List (for warehouse)
   - Packing Slip (for shipment)
4. Print or download PDF

### 5.4 Order Search

**Quick Search**:
- Enter order number, customer name, or product
- Results appear instantly

**Advanced Search**:
1. Click "Advanced" button
2. Filter by:
   - Date range
   - Status
   - Customer
   - Total amount
   - Product
3. Click "Search"

---

## 6. Quote Management

### 6.1 Creating a Quote

1. Click "Quotes" → "+ New Quote"
2. Select customer
3. Add line items (same as orders)
4. Set quote validity period:
   - Default: 30 days
   - Adjust as needed
5. Add terms and conditions
6. Click "Create Quote"

### 6.2 Quote Statuses

**Draft**: Work in progress
**Pending**: Awaiting review
**Sent**: Sent to customer
**Accepted**: Customer accepted
**Rejected**: Customer declined
**Expired**: Past valid date

### 6.3 Sending a Quote

1. Open quote
2. Verify all details
3. Click "Send Quote"
4. Choose delivery method:
   - Email (default)
   - Download PDF (manual send)
5. Add email message (optional)
6. Click "Send"
7. Customer receives email with PDF attachment

### 6.4 Converting Quote to Order

1. Open accepted quote
2. Click "Convert to Order"
3. System creates draft order
4. Review and adjust if needed
5. Confirm order creation

---

## 7. Inventory Management

### 7.1 Stock Overview

View current stock levels:
- Available quantity
- Reserved (for orders)
- On order (from suppliers)
- Reorder point
- Warehouse location

### 7.2 Stock Adjustments

**Adding Stock**:
1. Open product
2. Click "Stock Adjustment"
3. Select "Increase"
4. Enter quantity
5. Select reason:
   - Purchase received
   - Found items
   - Correction
6. Add note
7. Click "Save"

**Removing Stock**:
1. Same process as above
2. Select "Decrease"
3. Select reason:
   - Damaged
   - Lost
   - Correction
   - Sample
4. Add note
5. Click "Save"

### 7.3 Stock Transfers

Moving stock between warehouses:

1. Click "Inventory" → "Transfers"
2. Click "+ New Transfer"
3. Select product
4. Enter quantity
5. From location → To location
6. Click "Create Transfer"
7. Status: Pending
8. Warehouse confirms receipt
9. Status: Completed

### 7.4 Low Stock Alerts

System alerts when stock falls below reorder point:

1. Dashboard shows alerts
2. Click alert to view product
3. Options:
   - Create purchase order
   - Adjust reorder point
   - Dismiss alert

---

## 8. AI-Powered Search

### 8.1 Semantic Search

The system understands natural language queries:

**Examples**:
- "power drill for concrete"
- "safety equipment for heights"
- "heavy duty lifting gear"

**How to Use**:
1. Type natural language query
2. Results appear instantly
3. Sorted by relevance
4. Includes similar products

### 8.2 Multilingual Search

Search in any supported language:

1. Switch language using selector
2. Search in that language
3. Results show translated content
4. Switch back to English anytime

**Supported Languages**:
- English
- Chinese (Simplified)
- Chinese (Traditional)
- Spanish
- Portuguese
- Arabic
- Vietnamese
- Hindi
- Tamil
- Telugu

### 8.3 Product Recommendations

**"Similar Products"**:
- Shown on product page
- Based on specifications
- Helps cross-selling

**"Frequently Bought Together"**:
- Shown on product and cart pages
- Based on order history
- Increases average order value

**"Personalized for You"**:
- Shown on dashboard
- Based on browsing/purchase history
- Updates regularly

---

## 9. Multi-Language Support

### 9.1 Switching Languages

1. Click language selector (bottom of sidebar)
2. Choose from 10 languages
3. Interface updates immediately
4. Product content shows in selected language

### 9.2 Managing Translations

**Viewing Translation Status**:
1. Click "Translations" in sidebar
2. View products by translation status:
   - ✅ Complete (all languages)
   - ⚠️ Partial (some languages)
   - ❌ Missing (no translations)

**Translating Products** (Admin only):

1. Open product
2. Click "Translations" tab
3. Select language
4. Options:
   - **AI Translate**: Auto-generate
   - **Manual Entry**: Type translation
   - **Copy from**: Copy from another language

5. Review AI-generated translations
6. Edit if needed
7. Click "Approve" to publish

**Bulk Translation**:
1. Go to Translations page
2. Select multiple products
3. Click "Translate"
4. Choose target languages
5. Click "Start Translation"
6. AI generates translations
7. Review queue shows progress

### 9.3 Translation Quality

**AI-Generated**:
- Fast (seconds per product)
- Good for technical content
- Needs review for marketing copy

**Human-Reviewed**:
- High quality
- Culturally appropriate
- Recommended for customer-facing content

**Best Practice**:
1. Use AI to generate drafts
2. Have native speaker review
3. Approve for publishing
4. Monitor customer feedback

---

## 10. Troubleshooting

### 10.1 Common Issues

**"Cannot login"**
- Check email and password
- Clear browser cache
- Reset password if needed
- Contact IT support

**"Product not found"**
- Check spelling
- Try broader search terms
- Use semantic search
- Check if product is inactive

**"Cannot create order"**
- Verify customer selected
- Check required fields completed
- Ensure products in stock
- Try refreshing page

**"Page loading slowly"**
- Check internet connection
- Clear browser cache
- Try different browser
- Report to IT if persistent

### 10.2 Getting Help

**In-App Help**:
- Click "?" icon anywhere
- Context-sensitive help appears
- Links to relevant documentation

**Support Email**:
- support@ccw-example.com
- Include:
  - Your name and email
  - What you were trying to do
  - Error message (if any)
  - Screenshot (helpful)

**IT Support**:
- Phone: +61 XXX XXX XXX
- Hours: Mon-Fri 9am-5pm AEST
- Response time: <4 hours

### 10.3 Keyboard Shortcuts

**Global**:
- `Ctrl/Cmd + K`: Quick search
- `Ctrl/Cmd + S`: Save current form
- `Esc`: Close dialog/modal
- `/`: Focus search box

**Navigation**:
- `G then D`: Go to dashboard
- `G then P`: Go to products
- `G then O`: Go to orders
- `G then C`: Go to customers

**Actions**:
- `N`: New (product/order/quote)
- `E`: Edit current item
- `?`: Show keyboard shortcuts

---

## 11. Best Practices

### 11.1 Daily Tasks

- [ ] Check dashboard for alerts
- [ ] Review pending orders
- [ ] Process new quotes
- [ ] Respond to customer inquiries
- [ ] Update order statuses

### 11.2 Weekly Tasks

- [ ] Review low stock alerts
- [ ] Create purchase orders
- [ ] Check quote expiry dates
- [ ] Review sales reports
- [ ] Update product pricing

### 11.3 Monthly Tasks

- [ ] Inventory audit
- [ ] Review inactive customers
- [ ] Archive old orders
- [ ] Review AI search relevance
- [ ] Update translation content

---

## 12. Training Exercises

### Exercise 1: Create a Product

1. Navigate to Products
2. Create new product:
   - SKU: TRAIN-001
   - Name: Training Product
   - Category: Hand Tools
   - Price: $99.99
   - Stock: 100
3. Save and verify it appears in list

### Exercise 2: Create an Order

1. Navigate to Orders
2. Create new order:
   - Customer: Training Customer (create if needed)
   - Add 2 products
   - Verify total calculates correctly
3. Save as Draft
4. Update status to Pending
5. Print order confirmation

### Exercise 3: Use AI Search

1. Go to Products
2. Search: "tool for cutting metal"
3. Review results
4. Click top result
5. View recommendations

### Exercise 4: Translate a Product

1. Go to product TRAIN-001
2. Click Translations tab
3. Select Chinese (Simplified)
4. Click "AI Translate"
5. Review translation
6. Approve if accurate

---

## 13. Certification

After completing this training:

1. Complete all exercises
2. Take online assessment
3. Score 80%+ to pass
4. Receive certificate

**Assessment Link**: https://erp.ccw-example.com/training/assessment

**Questions**: 20 multiple choice
**Time Limit**: 30 minutes
**Pass Mark**: 80%

---

## 14. Additional Resources

### Documentation

- **User Guide**: https://docs.ccw-example.com/user-guide
- **API Documentation**: https://docs.ccw-example.com/api
- **Video Tutorials**: https://videos.ccw-example.com

### Training Videos

- Getting Started (10 min)
- Product Management (15 min)
- Order Processing (20 min)
- Multi-Language Features (15 min)
- Advanced Search (10 min)

### Quick Reference Cards

Download printable quick reference:
- Keyboard Shortcuts
- Order Status Flowchart
- Translation Workflow
- Common Tasks Checklist

---

## Contact

For training questions or to schedule additional training:

**Training Coordinator**: training@ccw-example.com
**Phone**: +61 XXX XXX XXX
**Office Hours**: Mon-Fri 9am-5pm AEST

---

**Version**: 1.0
**Last Updated**: January 2026
**Next Review**: April 2026
