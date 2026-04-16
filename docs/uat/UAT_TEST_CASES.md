# CCW-Online ERP - UAT Test Cases

**Date Prepared**: February 5, 2026
**UAT Version**: 1.0
**Total Test Cases**: 35 (Products: 8, Customers: 7, Orders: 10, Quotes: 10)
**Business Workflows**: 5

---

## Test Case Legend

**Status Options**:

- ☐ Not Started
- 🔄 In Progress
- ✅ Passed
- ❌ Failed

**Priority Levels**:

- 🔴 Critical - Must pass for production deployment
- 🟠 High - Important for user experience
- 🟡 Medium - Desirable functionality
- 🟢 Low - Nice-to-have features

---

## Products Module Test Cases (8 test cases)

### TC-P001: Create New Product

**Priority**: 🔴 Critical
**Module**: Products
**Workflow**:

1. Navigate to Products page
2. Click "Add Product" button
3. Fill in product form with test data
4. Click "Submit" or "Save"

**Test Data**:

```
SKU: TEST-UAT-001
Name: UAT Test Product - Power Drill
Description: Professional grade power drill for testing
Category: Power Tools
Price: $99.99
Cost: $45.00
Stock: 100
Warehouse Location: Aisle-1-Bay-5
Status: Active
```

**Expected Result**:

- Product created successfully
- Success message displayed
- Product appears in product list
- All fields saved correctly

**Validation Steps**:

1. Search for SKU "TEST-UAT-001"
2. Verify product appears in search results
3. Click product to view details
4. Confirm all fields match test data

**Status**: ☐ Not Started
**Tested By**: **\*\*\*\***\_**\*\*\*\***
**Date Tested**: \***\*\_\_\*\***
**Notes**:

---

### TC-P002: Search Products by Name

**Priority**: 🟠 High
**Module**: Products
**Workflow**:

1. Navigate to Products page
2. Locate search field
3. Enter search term "drill"
4. Press Enter or click Search button

**Test Data**: Search term "drill"

**Expected Result**:

- Results display all products containing "drill" in name
- Results update in real-time or after pressing Enter
- Pagination works if results exceed page size

**Validation Steps**:

1. Count total results
2. Verify each result contains "drill" (case-insensitive)
3. Test pagination if more than one page of results

**Status**: ☐ Not Started
**Tested By**: **\*\*\*\***\_**\*\*\*\***
**Date Tested**: \***\*\_\_\*\***
**Notes**:

---

### TC-P003: Search Products by SKU

**Priority**: 🟠 High
**Module**: Products
**Workflow**:

1. Navigate to Products page
2. Enter an existing SKU in search field
3. Press Enter or click Search

**Test Data**: Use an existing product SKU from the system

**Expected Result**:

- Exact match product displayed
- Only one result shown (SKUs are unique)
- Product details are correct

**Validation Steps**:

1. Note SKU before searching
2. Search for that SKU
3. Verify only one result
4. Confirm SKU matches search term exactly

**Status**: ☐ Not Started
**Tested By**: **\*\*\*\***\_**\*\*\*\***
**Date Tested**: \***\*\_\_\*\***
**Notes**:

---

### TC-P004: Filter Products by Category

**Priority**: 🟡 Medium
**Module**: Products
**Workflow**:

1. Navigate to Products page
2. Locate category filter dropdown
3. Select "Power Tools"
4. Apply filter

**Test Data**: Category "Power Tools"

**Expected Result**:

- Only products with category "Power Tools" displayed
- Filter persists across pagination
- Clear filter option available

**Validation Steps**:

1. Verify all results show "Power Tools" category
2. Check multiple pages if applicable
3. Test filter clear functionality

**Status**: ☐ Not Started
**Tested By**: **\*\*\*\***\_**\*\*\*\***
**Date Tested**: \***\*\_\_\*\***
**Notes**:

---

### TC-P005: Update Product Information

**Priority**: 🔴 Critical
**Module**: Products
**Workflow**:

1. Navigate to Products page
2. Click on TEST-UAT-001 product
3. Click Edit button
4. Change Price from $99.99 to $89.99
5. Change Stock from 100 to 150
6. Click Save

**Test Data**:

- Original Price: $99.99 → New Price: $89.99
- Original Stock: 100 → New Stock: 150

**Expected Result**:

- Product updated successfully
- Success message displayed
- New price and stock displayed immediately
- Changes persist after page refresh

**Validation Steps**:

1. Verify success message appears
2. Refresh the page
3. Confirm price shows $89.99
4. Confirm stock shows 150

**Status**: ☐ Not Started
**Tested By**: **\*\*\*\***\_**\*\*\*\***
**Date Tested**: \***\*\_\_\*\***
**Notes**:

---

### TC-P006: Update Product Stock

**Priority**: 🔴 Critical
**Module**: Products
**Workflow**:

1. Navigate to Products page
2. Click on a product with stock
3. Click Edit button
4. Change Stock quantity
5. Save changes

**Test Data**: Change stock from current value to current + 50

**Expected Result**:

- Stock updated successfully
- New stock level displayed
- Changes reflected across the system

**Validation Steps**:

1. Note original stock level
2. Update stock
3. Verify new stock level displays
4. Refresh page and confirm persistence

**Status**: ☐ Not Started
**Tested By**: **\*\*\*\***\_**\*\*\*\***
**Date Tested**: \***\*\_\_\*\***
**Notes**:

---

### TC-P007: Delete Product (Soft Delete)

**Priority**: 🟡 Medium
**Module**: Products
**Workflow**:

1. Navigate to Products page
2. Click on TEST-UAT-001 product
3. Click Delete button
4. Confirm deletion in dialog

**Test Data**: Delete TEST-UAT-001 created in TC-P001

**Expected Result**:

- Confirmation dialog appears
- After confirming, product marked inactive
- Product no longer visible in active product list
- Product searchable with "show inactive" filter (if available)

**Validation Steps**:

1. Search for TEST-UAT-001 after deletion
2. Verify product not in active list
3. Check if product appears in inactive filter

**Status**: ☐ Not Started
**Tested By**: **\*\*\*\***\_**\*\*\*\***
**Date Tested**: \***\*\_\_\*\***
**Notes**:

---

### TC-P008: View Product Details

**Priority**: 🟠 High
**Module**: Products
**Workflow**:

1. Navigate to Products page
2. Click on any product name

**Expected Result**:

- Product detail page loads
- All product information displayed:
  - SKU
  - Name
  - Description
  - Category
  - Price
  - Cost
  - Stock level
  - Warehouse location
  - Status (Active/Inactive)
  - Created date
  - Updated date

**Validation Steps**:

1. Verify all fields are visible
2. Check formatting is correct
3. Confirm data matches product list

**Status**: ☐ Not Started
**Tested By**: **\*\*\*\***\_**\*\*\*\***
**Date Tested**: \***\*\_\_\*\***
**Notes**:

---

## Customers Module Test Cases (7 test cases)

### TC-C001: Create New Customer

**Priority**: 🔴 Critical
**Module**: Customers
**Workflow**:

1. Navigate to Customers page
2. Click "Add Customer" button
3. Fill in customer form
4. Submit

**Test Data**:

```
Customer Number: CUST-UAT-001
Company Name: UAT Test Company LLC
Contact Name: John Doe
Email: john.doe.uat@example.com
Phone: +1 (555) 123-4567
Address: 123 Test Street
City: Test City
State: CA
Postal Code: 90210
Country: USA
```

**Expected Result**:

- Customer created successfully
- Customer appears in customer list
- All fields saved correctly

**Validation Steps**:

1. Search for "CUST-UAT-001"
2. Verify customer in results
3. Click customer to view details
4. Confirm all fields match test data

**Status**: ☐ Not Started
**Tested By**: **\*\*\*\***\_**\*\*\*\***
**Date Tested**: \***\*\_\_\*\***
**Notes**:

---

### TC-C002: Search Customers by Company Name

**Priority**: 🟠 High
**Module**: Customers
**Workflow**:

1. Navigate to Customers page
2. Enter "Acme" in search field
3. Press Enter or click Search

**Test Data**: Search term "Acme"

**Expected Result**:

- All customers with "Acme" in company name displayed
- Search is case-insensitive
- Results update correctly

**Validation Steps**:

1. Verify each result contains "Acme"
2. Test with different search terms
3. Check pagination if applicable

**Status**: ☐ Not Started
**Tested By**: **\*\*\*\***\_**\*\*\*\***
**Date Tested**: \***\*\_\_\*\***
**Notes**:

---

### TC-C003: Search Customers by Email

**Priority**: 🟠 High
**Module**: Customers
**Workflow**:

1. Navigate to Customers page
2. Enter email address in search
3. Press Enter or click Search

**Test Data**: Use existing customer email

**Expected Result**:

- Customer with matching email displayed
- Search returns exact or partial match
- Customer details correct

**Validation Steps**:

1. Note customer email before search
2. Search for that email
3. Verify correct customer appears
4. Check email in results matches search

**Status**: ☐ Not Started
**Tested By**: **\*\*\*\***\_**\*\*\*\***
**Date Tested**: \***\*\_\_\*\***
**Notes**:

---

### TC-C004: Update Customer Contact Information

**Priority**: 🔴 Critical
**Module**: Customers
**Workflow**:

1. Navigate to Customers page
2. Click on CUST-UAT-001
3. Click Edit button
4. Change phone number to +1 (555) 987-6543
5. Change email to john.doe.updated@example.com
6. Save changes

**Test Data**:

- Original Phone: +1 (555) 123-4567 → New: +1 (555) 987-6543
- Original Email: john.doe.uat@example.com → New: john.doe.updated@example.com

**Expected Result**:

- Customer updated successfully
- New contact information displayed
- Changes persist after refresh

**Validation Steps**:

1. Verify success message
2. Refresh page
3. Confirm phone and email updated

**Status**: ☐ Not Started
**Tested By**: **\*\*\*\***\_**\*\*\*\***
**Date Tested**: \***\*\_\_\*\***
**Notes**:

---

### TC-C005: Update Customer Address

**Priority**: 🟠 High
**Module**: Customers
**Workflow**:

1. Navigate to Customers page
2. Click on CUST-UAT-001
3. Click Edit button
4. Update address fields
5. Save changes

**Test Data**:

```
New Address: 456 Updated Avenue
New City: New Test City
New State: NY
New Postal Code: 10001
```

**Expected Result**:

- Address updated successfully
- All address fields reflect new values
- Changes persist

**Validation Steps**:

1. Verify all address fields updated
2. Refresh page to confirm persistence
3. Check address displays correctly in customer details

**Status**: ☐ Not Started
**Tested By**: **\*\*\*\***\_**\*\*\*\***
**Date Tested**: \***\*\_\_\*\***
**Notes**:

---

### TC-C006: View Customer Orders

**Priority**: 🟠 High
**Module**: Customers
**Workflow**:

1. Navigate to Customers page
2. Click on a customer with existing orders
3. Navigate to "Orders" tab or section

**Expected Result**:

- All orders for customer displayed
- Orders sorted by date (newest first)
- Order details visible (order number, date, total, status)

**Validation Steps**:

1. Verify orders belong to selected customer
2. Check order count matches expected
3. Confirm sorting is correct

**Status**: ☐ Not Started
**Tested By**: **\*\*\*\***\_**\*\*\*\***
**Date Tested**: \***\*\_\_\*\***
**Notes**:

---

### TC-C007: Delete Customer

**Priority**: 🟡 Medium
**Module**: Customers
**Workflow**:

1. Navigate to Customers page
2. Click on CUST-UAT-001
3. Click Delete button
4. Confirm deletion

**Test Data**: Delete CUST-UAT-001 created in TC-C001

**Expected Result**:

- Confirmation dialog appears
- Customer deleted or marked inactive
- Customer no longer in active customer list

**Validation Steps**:

1. Search for CUST-UAT-001 after deletion
2. Verify customer not in active list
3. Check if referential integrity maintained (orders still accessible if any)

**Status**: ☐ Not Started
**Tested By**: **\*\*\*\***\_**\*\*\*\***
**Date Tested**: \***\*\_\_\*\***
**Notes**:

---

## Orders Module Test Cases (10 test cases)

### TC-O001: Create Order with Single Line Item

**Priority**: 🔴 Critical
**Module**: Orders
**Workflow**:

1. Navigate to Orders page
2. Click "Create Order" button
3. Select customer from dropdown
4. Add one product line item
5. Enter quantity
6. Submit order

**Test Data**:

- Customer: Select any existing customer
- Product: Select product with stock > 0
- Quantity: 2

**Expected Result**:

- Order created with status "draft"
- Order number auto-generated (ORD-YYYY-NNN format)
- Line item added with correct subtotal
- Order total = quantity × unit price

**Validation Steps**:

1. Verify order appears in orders list
2. Check order number format
3. Verify line item quantity and price
4. Confirm total = 2 × unit price

**Status**: ☐ Not Started
**Tested By**: **\*\*\*\***\_**\*\*\*\***
**Date Tested**: \***\*\_\_\*\***
**Notes**:

---

### TC-O002: Create Order with Multiple Line Items

**Priority**: 🔴 Critical (ISS-001 Regression Test)
**Module**: Orders
**Workflow**:

1. Navigate to Orders page
2. Click "Create Order"
3. Select customer
4. Add 3 different products with quantities
5. Submit order

**Test Data**:

- Product 1: Quantity 2, Unit Price $50.00 → Subtotal $100.00
- Product 2: Quantity 1, Unit Price $100.00 → Subtotal $100.00
- Product 3: Quantity 3, Unit Price $25.00 → Subtotal $75.00
- **Expected Order Total: $275.00**

**Expected Result**:

- Order created with 3 line items
- Each subtotal calculated correctly (quantity × unit price)
- Order total = sum of all subtotals ($275.00)
- **This validates ISS-001 fix (quote/order total calculation)**

**Validation Steps**:

1. Verify 3 line items visible
2. Check each subtotal calculation
3. **Manually calculate: $100 + $100 + $75 = $275**
4. **Confirm order total shows exactly $275.00**
5. Refresh page and verify total persists

**Status**: ☐ Not Started
**Tested By**: **\*\*\*\***\_**\*\*\*\***
**Date Tested**: \***\*\_\_\*\***
**Notes**:

---

### TC-O003: Update Order Status (Draft → Pending)

**Priority**: 🔴 Critical
**Module**: Orders
**Workflow**:

1. Navigate to Orders page
2. Click on order with status "draft"
3. Click Edit or Change Status
4. Change status to "pending"
5. Save

**Expected Result**:

- Order status updated to "pending"
- Status change persists
- Order appears in "pending" filter

**Validation Steps**:

1. Verify success message
2. Check status displays "pending"
3. Filter orders by "pending" status
4. Confirm order appears in filtered results

**Status**: ☐ Not Started
**Tested By**: **\*\*\*\***\_**\*\*\*\***
**Date Tested**: \***\*\_\_\*\***
**Notes**:

---

### TC-O004: Update Order Status (Pending → Confirmed)

**Priority**: 🔴 Critical
**Module**: Orders
**Workflow**:

1. Navigate to Orders page
2. Click on order with status "pending"
3. Change status to "confirmed"
4. Save

**Expected Result**:

- Order status updated to "confirmed"
- Status workflow validated (draft → pending → confirmed)
- Order in "confirmed" filter

**Validation Steps**:

1. Verify status progression allowed
2. Check status displays "confirmed"
3. Filter by "confirmed" status
4. Confirm order in results

**Status**: ☐ Not Started
**Tested By**: **\*\*\*\***\_**\*\*\*\***
**Date Tested**: \***\*\_\_\*\***
**Notes**:

---

### TC-O005: Update Order Item Quantity

**Priority**: 🔴 Critical (ISS-002 Regression Test)
**Module**: Orders
**Workflow**:

1. Navigate to Orders page
2. Click on an existing order
3. Click Edit on a line item
4. Change quantity from 2 to 5
5. Save changes

**Test Data**:

- Original: Quantity 2, Unit Price $50 → Subtotal $100
- Updated: Quantity 5, Unit Price $50 → **Expected Subtotal $250**

**Expected Result**:

- Quantity updated to 5
- **Subtotal recalculated: 5 × $50 = $250**
- **Order total recalculated (adds difference of $150)**
- **This validates ISS-002 fix (order item update errors)**
- No 500 errors (validates ISS-005 fix)

**Validation Steps**:

1. Note original order total before update
2. Update quantity to 5
3. **Verify subtotal shows $250.00**
4. **Verify order total increased by $150 ($250 - $100)**
5. Refresh page and confirm changes persist
6. **Check browser console for no 500 errors**

**Status**: ☐ Not Started
**Tested By**: **\*\*\*\***\_**\*\*\*\***
**Date Tested**: \***\*\_\_\*\***
**Notes**:

---

### TC-O006: Update Order Item Unit Price

**Priority**: 🟠 High (ISS-002 Regression Test)
**Module**: Orders
**Workflow**:

1. Navigate to Orders page
2. Click on an existing order
3. Click Edit on a line item
4. Change unit price from $50.00 to $45.00
5. Save changes

**Test Data**:

- Original: Quantity 2, Unit Price $50 → Subtotal $100
- Updated: Quantity 2, Unit Price $45 → **Expected Subtotal $90**

**Expected Result**:

- Unit price updated to $45.00
- **Subtotal recalculated: 2 × $45 = $90**
- **Order total recalculated (decreases by $10)**
- **This validates ISS-002 fix**
- No 500 errors (validates ISS-005 fix)

**Validation Steps**:

1. Note original order total
2. Update unit price to $45
3. **Verify subtotal shows $90.00**
4. **Verify order total decreased by $10**
5. Refresh and confirm persistence
6. **Check for no 500 errors in console**

**Status**: ☐ Not Started
**Tested By**: **\*\*\*\***\_**\*\*\*\***
**Date Tested**: \***\*\_\_\*\***
**Notes**:

---

### TC-O007: Add Order Item to Existing Order

**Priority**: 🟠 High
**Module**: Orders
**Workflow**:

1. Navigate to Orders page
2. Click on existing order
3. Click "Add Item" button
4. Select product
5. Enter quantity
6. Save

**Test Data**: Add new product with quantity 1

**Expected Result**:

- New line item added to order
- Line item count increases by 1
- Order total recalculated (includes new item)
- New item visible in order details

**Validation Steps**:

1. Note original line item count and total
2. Add new item
3. Verify line item count increased
4. Verify total includes new item price
5. Refresh and confirm persistence

**Status**: ☐ Not Started
**Tested By**: **\*\*\*\***\_**\*\*\*\***
**Date Tested**: \***\*\_\_\*\***
**Notes**:

---

### TC-O008: Remove Order Item from Order

**Priority**: 🟠 High
**Module**: Orders
**Workflow**:

1. Navigate to Orders page
2. Click on order with multiple line items
3. Click "Remove" or delete icon on a line item
4. Confirm removal

**Expected Result**:

- Confirmation dialog appears
- Line item removed from order
- Line item count decreases by 1
- Order total recalculated (excludes removed item)

**Validation Steps**:

1. Note original line item count and total
2. Remove line item
3. Verify line item count decreased
4. Verify total excludes removed item price
5. Refresh and confirm persistence

**Status**: ☐ Not Started
**Tested By**: **\*\*\*\***\_**\*\*\*\***
**Date Tested**: \***\*\_\_\*\***
**Notes**:

---

### TC-O009: Filter Orders by Status

**Priority**: 🟠 High
**Module**: Orders
**Workflow**:

1. Navigate to Orders page
2. Select status filter "confirmed"
3. Apply filter

**Test Data**: Filter status "confirmed"

**Expected Result**:

- Only orders with status "confirmed" displayed
- Filter persists across pagination
- Clear filter option available

**Validation Steps**:

1. Verify all results show "confirmed" status
2. Check multiple pages if applicable
3. Test clear filter functionality

**Status**: ☐ Not Started
**Tested By**: **\*\*\*\***\_**\*\*\*\***
**Date Tested**: \***\*\_\_\*\***
**Notes**:

---

### TC-O010: View Order Details

**Priority**: 🟠 High
**Module**: Orders
**Workflow**:

1. Navigate to Orders page
2. Click on order number

**Expected Result**:

- Order details page displays all information:
  - Order number
  - Order date
  - Customer information
  - Order status
  - Line items (product, quantity, unit price, subtotal)
  - Order total
  - Notes (if any)
  - Created/updated timestamps

**Validation Steps**:

1. Verify all fields visible
2. Check line items display correctly
3. Confirm totals calculated correctly

**Status**: ☐ Not Started
**Tested By**: **\*\*\*\***\_**\*\*\*\***
**Date Tested**: \***\*\_\_\*\***
**Notes**:

---

## Quotes Module Test Cases (10 test cases)

### TC-Q001: Create Quote with Single Line Item

**Priority**: 🔴 Critical (ISS-001 Regression Test)
**Module**: Quotes
**Workflow**:

1. Navigate to Quotes page
2. Click "Create Quote" button
3. Select customer
4. Add one product line item
5. Enter quantity and unit price
6. Submit quote

**Test Data**:

- Customer: Select existing customer
- Product: Select any product
- Quantity: 5
- Unit Price: $100.00
- **Expected Quote Total: $500.00**

**Expected Result**:

- Quote created with status "draft"
- Quote number auto-generated (Q-YYYY-NNN format)
- Line item added
- **Quote total = $500.00 (5 × $100)**
- **This validates ISS-001 fix (quote total calculation)**

**Validation Steps**:

1. Verify quote appears in quotes list
2. Check quote number format
3. **Manually calculate: 5 × $100 = $500**
4. **Confirm quote total shows exactly $500.00**
5. Refresh page and verify total persists

**Status**: ☐ Not Started
**Tested By**: **\*\*\*\***\_**\*\*\*\***
**Date Tested**: \***\*\_\_\*\***
**Notes**:

---

### TC-Q002: Create Quote with Multiple Line Items

**Priority**: 🔴 Critical (ISS-001 Regression Test)
**Module**: Quotes
**Workflow**:

1. Navigate to Quotes page
2. Click "Create Quote"
3. Select customer
4. Add 4 different products with quantities and prices
5. Submit quote

**Test Data**:

- Product 1: Quantity 10, Unit Price $25.00 → Subtotal $250.00
- Product 2: Quantity 5, Unit Price $50.00 → Subtotal $250.00
- Product 3: Quantity 2, Unit Price $100.00 → Subtotal $200.00
- Product 4: Quantity 1, Unit Price $300.00 → Subtotal $300.00
- **Expected Quote Total: $1,000.00**

**Expected Result**:

- Quote created with 4 line items
- Each subtotal calculated correctly
- **Quote total = $250 + $250 + $200 + $300 = $1,000.00**
- **This is PRIMARY regression test for ISS-001 fix**

**Validation Steps**:

1. Verify 4 line items visible
2. Check each subtotal calculation
3. **Manually sum: $250 + $250 + $200 + $300 = $1,000**
4. **Confirm quote total shows exactly $1,000.00**
5. Refresh page and verify total persists
6. **This confirms ISS-001 (quote total calculation) is FIXED**

**Status**: ☐ Not Started
**Tested By**: **\*\*\*\***\_**\*\*\*\***
**Date Tested**: \***\*\_\_\*\***
**Notes**:

---

### TC-Q003: Update Quote Status (Draft → Pending)

**Priority**: 🟠 High
**Module**: Quotes
**Workflow**:

1. Navigate to Quotes page
2. Click on quote with status "draft"
3. Change status to "pending"
4. Save

**Expected Result**:

- Quote status updated to "pending"
- Status change persists
- Quote in "pending" filter

**Validation Steps**:

1. Verify success message
2. Check status displays "pending"
3. Filter by "pending" status
4. Confirm quote in results

**Status**: ☐ Not Started
**Tested By**: **\*\*\*\***\_**\*\*\*\***
**Date Tested**: \***\*\_\_\*\***
**Notes**:

---

### TC-Q004: Update Quote Status (Pending → Sent)

**Priority**: 🟠 High
**Module**: Quotes
**Workflow**:

1. Navigate to Quotes page
2. Click on quote with status "pending"
3. Change status to "sent"
4. Save

**Expected Result**:

- Quote status updated to "sent"
- Status workflow validated
- Quote in "sent" filter

**Validation Steps**:

1. Verify status changed to "sent"
2. Filter by "sent" status
3. Confirm quote in results

**Status**: ☐ Not Started
**Tested By**: **\*\*\*\***\_**\*\*\*\***
**Date Tested**: \***\*\_\_\*\***
**Notes**:

---

### TC-Q005: Calculate Quote Total (Multiple Items)

**Priority**: 🔴 Critical (ISS-001 Regression Test)
**Module**: Quotes
**Workflow**:

1. Create or edit quote with 3 items
2. Verify total calculation

**Test Data**:

- Item 1: Quantity 3, Price $50 → $150
- Item 2: Quantity 2, Price $75 → $150
- Item 3: Quantity 5, Price $40 → $200
- **Expected Total: $500**

**Expected Result**:

- **Total = $150 + $150 + $200 = $500.00**
- **Manual calculation matches system calculation**
- **ISS-001 regression test PASSED**

**Validation Steps**:

1. Note quantities and prices for all items
2. **Manually calculate each subtotal**
3. **Manually sum all subtotals**
4. **Compare manual calculation to system total**
5. **They must match exactly**

**Status**: ☐ Not Started
**Tested By**: **\*\*\*\***\_**\*\*\*\***
**Date Tested**: \***\*\_\_\*\***
**Notes**:

---

### TC-Q006: Convert Quote to Order

**Priority**: 🔴 Critical
**Module**: Quotes
**Workflow**:

1. Navigate to Quotes page
2. Click on quote with status "sent"
3. Click "Convert to Order" button
4. Confirm conversion

**Expected Result**:

- New order created
- Order has same customer as quote
- Order has all quote line items (same products, quantities, prices)
- Order totals match quote totals
- Quote status updated to "accepted"
- Link between quote and order established

**Validation Steps**:

1. Note quote number, customer, line items, and total before conversion
2. Convert quote to order
3. Navigate to Orders page
4. Find newly created order
5. Verify order customer matches quote customer
6. Verify all line items match quote
7. Verify order total = quote total
8. Go back to quote and verify status is "accepted"

**Status**: ☐ Not Started
**Tested By**: **\*\*\*\***\_**\*\*\*\***
**Date Tested**: \***\*\_\_\*\***
**Notes**:

---

### TC-Q007: Update Quote Item Quantity

**Priority**: 🟠 High
**Module**: Quotes
**Workflow**:

1. Navigate to Quotes page
2. Click on existing quote
3. Edit line item quantity from 5 to 8
4. Save

**Test Data**:

- Original: Quantity 5, Unit Price $100 → Subtotal $500
- Updated: Quantity 8, Unit Price $100 → **Expected Subtotal $800**

**Expected Result**:

- Quantity updated to 8
- **Subtotal recalculated: 8 × $100 = $800**
- **Quote total recalculated (increases by $300)**

**Validation Steps**:

1. Note original quote total
2. Update quantity to 8
3. **Verify subtotal shows $800.00**
4. **Verify quote total increased by $300**
5. Refresh and confirm persistence

**Status**: ☐ Not Started
**Tested By**: **\*\*\*\***\_**\*\*\*\***
**Date Tested**: \***\*\_\_\*\***
**Notes**:

---

### TC-Q008: Delete Quote

**Priority**: 🟡 Medium
**Module**: Quotes
**Workflow**:

1. Navigate to Quotes page
2. Click on quote
3. Click Delete button
4. Confirm deletion

**Expected Result**:

- Confirmation dialog appears
- Quote deleted or marked inactive
- Quote not in active quotes list

**Validation Steps**:

1. Note quote number before deletion
2. Delete quote
3. Search for quote number
4. Verify quote not in active list

**Status**: ☐ Not Started
**Tested By**: **\*\*\*\***\_**\*\*\*\***
**Date Tested**: \***\*\_\_\*\***
**Notes**:

---

### TC-Q009: Duplicate Quote Number Validation

**Priority**: 🟠 High (ISS-003 Regression Test)
**Module**: Quotes
**Workflow**:

1. Navigate to Quotes page
2. Note an existing quote number (e.g., Q-2026-001)
3. Attempt to create new quote with same quote number
4. Submit

**Test Data**: Use existing quote number

**Expected Result**:

- **Error message displayed (422 Validation Error)**
- **Quote not created**
- **Error message explains duplicate quote number**
- **This validates ISS-003 fix (quote 404 errors due to race conditions)**
- **This validates ISS-004 fix (422 validation error handling)**

**Validation Steps**:

1. Identify existing quote number
2. Try to create quote with same number
3. **Verify 422 error returned (not 404 or 500)**
4. **Verify user-friendly error message shown**
5. **Verify quote was NOT created**
6. **This confirms ISS-003 and ISS-004 fixes working**

**Status**: ☐ Not Started
**Tested By**: **\*\*\*\***\_**\*\*\*\***
**Date Tested**: \***\*\_\_\*\***
**Notes**:

---

### TC-Q010: Invalid Customer Validation

**Priority**: 🟠 High (ISS-004 Regression Test)
**Module**: Quotes
**Workflow**:

1. Navigate to Quotes page
2. Click "Create Quote"
3. Attempt to submit with invalid or missing customer
4. Submit form

**Expected Result**:

- **422 Validation Error displayed**
- **Error message explains customer required**
- **Quote not created**
- **Pydantic validation working correctly**
- **This validates ISS-004 fix (422 validation error handling)**

**Validation Steps**:

1. Try to create quote without selecting customer
2. **Verify 422 error returned**
3. **Verify error message user-friendly**
4. **Verify form highlights customer field error**
5. **This confirms ISS-004 (422 validation) working correctly**

**Status**: ☐ Not Started
**Tested By**: **\*\*\*\***\_**\*\*\*\***
**Date Tested**: \***\*\_\_\*\***
**Notes**:

---

## Business Workflow Test Cases (5 workflows)

### Workflow 1: Quote to Order Conversion

**Priority**: 🔴 Critical
**Business Process**: Sales quote acceptance and order creation

**Steps**:

1. **TC-C001**: Create new customer (UAT Test Company)
2. **TC-Q002**: Create quote with 4 line items, total $1,000
3. **TC-Q004**: Update quote status to "sent"
4. **TC-Q006**: Convert quote to order
5. Verify order created with same items and total
6. **TC-O004**: Update order status to "confirmed"

**Expected Result**:

- Complete workflow from customer creation → quote → order confirmation
- All totals calculated correctly throughout
- Quote marked as "accepted"
- Order ready for fulfillment

**Business Value**:

- Validates primary sales process
- Confirms quote-to-order conversion feature
- Tests ISS-001 fix across quote and order modules

**Validation Steps**:

1. Complete all steps in sequence
2. Verify no errors at any step
3. Confirm quote total = order total
4. Check quote status = "accepted"
5. Verify order status = "confirmed"

**Status**: ☐ Not Started
**Tested By**: **\*\*\*\***\_**\*\*\*\***
**Date Tested**: \***\*\_\_\*\***
**Notes**:

---

### Workflow 2: Order Fulfillment

**Priority**: 🔴 Critical
**Business Process**: Warehouse order fulfillment

**Steps**:

1. Find confirmed order (status = "confirmed")
2. Review order items and quantities
3. Update order status to "processing"
4. **TC-P006**: Update inventory (reduce stock by order quantities)
5. Update order status to "shipped"
6. Update order status to "delivered"

**Expected Result**:

- Order progresses through all fulfillment stages:
  - confirmed → processing → shipped → delivered
- Inventory updated correctly (stock reduced)
- Each status transition allowed and persisted

**Business Value**:

- Validates warehouse/fulfillment process
- Confirms order status workflow
- Tests inventory management integration

**Validation Steps**:

1. Note original stock levels for order products
2. Complete status progression
3. Verify each status change persists
4. Check stock levels decreased by order quantities
5. Confirm final status = "delivered"

**Status**: ☐ Not Started
**Tested By**: **\*\*\*\***\_**\*\*\*\***
**Date Tested**: \***\*\_\_\*\***
**Notes**:

---

### Workflow 3: Customer Registration and First Order

**Priority**: 🔴 Critical
**Business Process**: New customer onboarding

**Steps**:

1. **TC-C001**: Create new customer
2. **TC-C004**: Add customer contact information
3. **TC-C005**: Add customer address
4. **TC-O001**: Create order for new customer (single item)
5. **TC-O007**: Add more items to order
6. **TC-O004**: Confirm order

**Expected Result**:

- New customer can immediately place order
- Customer information complete (contact + address)
- Order created and confirmed for new customer
- All data persists correctly

**Business Value**:

- Validates onboarding process
- Confirms new customer can purchase immediately
- Tests customer-order relationship

**Validation Steps**:

1. Create customer with all details
2. Verify customer searchable
3. Create order for new customer
4. Confirm order appears in customer's order history
5. Verify no errors during workflow

**Status**: ☐ Not Started
**Tested By**: **\*\*\*\***\_**\*\*\*\***
**Date Tested**: \***\*\_\_\*\***
**Notes**:

---

### Workflow 4: Product Search and Purchase

**Priority**: 🟠 High
**Business Process**: Customer product discovery and purchase

**Steps**:

1. **TC-P004**: Search products by category "Power Tools"
2. Filter results by price range (if available)
3. **TC-P008**: View product details for selected product
4. **TC-O001**: Create order with selected product
5. **TC-O007**: Add additional products to order
6. **TC-O004**: Confirm order

**Expected Result**:

- User can find products via search/filter
- Product details displayed correctly
- Products can be added to order
- Order completed successfully

**Business Value**:

- Validates customer shopping experience
- Confirms search and discovery features
- Tests end-to-end purchase flow

**Validation Steps**:

1. Search returns relevant products
2. Product details accurate
3. Products added to order correctly
4. Order totals calculated correctly
5. Order confirmed successfully

**Status**: ☐ Not Started
**Tested By**: **\*\*\*\***\_**\*\*\*\***
**Date Tested**: \***\*\_\_\*\***
**Notes**:

---

### Workflow 5: Inventory Management

**Priority**: 🔴 Critical
**Business Process**: Product and inventory lifecycle

**Steps**:

1. **TC-P001**: Create new product with initial stock
2. **TC-P006**: Set stock level to 100
3. **TC-O002**: Create order with 10 units of product
4. **TC-P006**: Reduce stock by 10 (manual adjustment or automatic)
5. Verify stock now shows 90
6. Check low stock alert if stock < 10 (if feature exists)
7. **TC-P006**: Replenish stock (add 50 units)
8. Verify stock now shows 140

**Expected Result**:

- Product created with initial stock
- Stock accurately tracked through orders
- Stock adjustments work correctly
- Low stock alerts trigger (if implemented)
- Replenishment updates stock correctly

**Business Value**:

- Validates inventory management
- Confirms stock tracking accuracy
- Tests inventory adjustments

**Validation Steps**:

1. Track stock level through each step
2. Verify stock changes match expected values
3. After order: Stock should decrease
4. After replenishment: Stock should increase
5. All stock levels persist correctly

**Status**: ☐ Not Started
**Tested By**: **\*\*\*\***\_**\*\*\*\***
**Date Tested**: \***\*\_\_\*\***
**Notes**:

---

## Regression Testing Summary

These test cases validate fixes for previously identified critical issues:

| Issue       | Description                          | Test Cases                                     | Expected Outcome                                      |
| ----------- | ------------------------------------ | ---------------------------------------------- | ----------------------------------------------------- |
| **ISS-001** | Quote/Order Total Calculation Errors | TC-O002, TC-Q001, TC-Q002, TC-Q005, Workflow 1 | Totals calculated correctly (sum of all subtotals)    |
| **ISS-002** | Order Item Update Errors             | TC-O005, TC-O006                               | Item updates work, totals recalculated, no 500 errors |
| **ISS-003** | Quote 404 Errors (Race Conditions)   | TC-Q009                                        | Duplicate quote numbers rejected with 422 error       |
| **ISS-004** | Quote 422 Validation Errors          | TC-Q009, TC-Q010                               | Validation errors display user-friendly messages      |
| **ISS-005** | Order Item Update 500 Errors         | TC-O005, TC-O006                               | No 500 errors on order item updates                   |

---

## Test Execution Summary

**Total Test Cases**: 35

- Products: 8 test cases
- Customers: 7 test cases
- Orders: 10 test cases
- Quotes: 10 test cases

**Business Workflows**: 5 workflows

**Regression Tests**: 5 critical issues validated

**Target Pass Rate**: 90%+ (minimum 32/35 test cases passing)

---

## Instructions for Testers

1. **Before Testing**:
   - Ensure UAT environment is running (Frontend on :3000, Backend on :8000)
   - Log in with appropriate test credentials
   - Have this document open for reference

2. **During Testing**:
   - Follow test cases in order (Products → Customers → Orders → Quotes → Workflows)
   - Update **Status** field after each test (✅ Passed or ❌ Failed)
   - Record **Tested By** name and **Date Tested**
   - Add detailed **Notes** for any issues or observations
   - Take screenshots of any errors or unexpected behavior

3. **Reporting Issues**:
   - For failed test cases, document in **UAT_ISSUES.md**
   - Include: steps to reproduce, expected vs actual result, screenshots
   - Assign priority: Critical, High, Medium, or Low
   - Note if issue blocks other test cases

4. **After Testing**:
   - Compile results in **UAT_RESULTS.md**
   - Calculate overall pass rate
   - Report critical issues immediately
   - Participate in sign-off meeting

---

**Document Version**: 1.0
**Last Updated**: February 5, 2026
**Prepared By**: Development Team
**For Questions**: Contact development team lead
