# ERP MVP Completion Task

## Goal
Transform the CCW-Online-ERP from read-only list views into a fully functional MVP with complete CRUD operations for Products, Customers, Orders, and Quotes.

## Current State (What Works)
- Dashboard with 6 metrics cards (Total Revenue, Active Orders, Total Products, Total Customers, Low Stock Alerts, Pending Quotes)
- Dashboard with 4 data views (Revenue Trend, Sales by Category, Top 5 Products, Recent Activity)
- Products list page with search and pagination (50 items per page)
- Customers list page with search and pagination
- Orders list page with filtering by status
- Quotes list page with filtering by status
- Backend API endpoints for all CRUD operations (32 total endpoints operational)
- Database schema with 8 tables fully seeded with demo data
- Authentication (JWT-based, working with admin@demo.com / demo123)

## What Needs to Be Built

### 1. Products Module (Priority: HIGH)
**Create/Edit Form Requirements:**
- [ ] Product create form with fields: SKU, Name, Description, Category (dropdown), Price, Cost, Stock, Warehouse Location, Active status (toggle)
- [ ] Product edit form (same fields, pre-populated from existing data)
- [ ] Form validation: SKU required + unique, Name required, Price/Cost must be positive decimals, Stock must be non-negative integer
- [ ] Success toast notification on save ("Product created successfully" / "Product updated successfully")
- [ ] Error handling with user-friendly messages (e.g., "SKU already exists", "Failed to save product")
- [ ] Loading state during form submission (disable button, show spinner)
- [ ] "Add Product" button on products list page
- [ ] Edit icon/button on each table row
- [ ] Form should use Dialog/Modal component from shadcn/ui

**Delete Operation:**
- [ ] Delete button/icon on each table row
- [ ] Confirmation dialog: "Are you sure you want to delete [Product Name]? This action cannot be undone."
- [ ] Success toast on deletion ("Product deleted successfully")
- [ ] Refresh list after deletion
- [ ] Error handling if product is referenced in orders/quotes ("Cannot delete product that is used in orders")

**UI/UX Polish:**
- [ ] Empty state when no products: "No products found. Add your first product to get started." with "Add Product" button
- [ ] Loading skeleton or spinner while fetching data
- [ ] Proper pagination controls (Previous/Next buttons, page numbers, showing "1-50 of 200")
- [ ] Low stock visual indicator (already exists, keep it: red text when stock <= 10)

### 2. Customers Module (Priority: HIGH)
**Create/Edit Form Requirements:**
- [ ] Customer create form: Customer Number (auto-generated or manual), Company Name, Contact Name, Email, Phone, Address, City, State, Postal Code, Active status
- [ ] Customer edit form (same fields, pre-populated)
- [ ] Validation: Email format, Phone format (optional), Company Name required, Contact Name required
- [ ] Success toasts ("Customer created successfully" / "Customer updated successfully")
- [ ] Error handling ("Email already exists", "Invalid email format")
- [ ] Loading states
- [ ] "Add Customer" button on customers list page
- [ ] Edit button on table rows
- [ ] Dialog-based form

**Delete Operation:**
- [ ] Delete button with confirmation dialog
- [ ] Check for existing orders/quotes before allowing deletion
- [ ] Show warning if customer has active orders ("Cannot delete customer with active orders")
- [ ] Success toast on deletion

**UI/UX Polish:**
- [ ] Empty state message ("No customers found. Add your first customer to get started.")
- [ ] Loading states
- [ ] Better pagination controls
- [ ] Search by company name, contact name, or email (already works, keep it)

### 3. Orders Module (Priority: CRITICAL)
**Create/Edit Form Requirements:**
- [ ] Order create form with two sections:
  - **Order Header**: Customer (searchable dropdown), Order Date (date picker), Status (dropdown), Notes (textarea)
  - **Line Items**: Product selection (searchable dropdown), Quantity (number input), Unit Price (auto-filled from product, editable), Subtotal (calculated: quantity × unit price, read-only)
- [ ] Add/Remove line items dynamically (+ button to add row, × button to remove row)
- [ ] Order total calculation (sum of all line item subtotals, displayed at bottom)
- [ ] Order edit form (same structure, load existing order and line items)
- [ ] Validation: At least 1 line item required, Customer required, Quantity must be positive integer, Check stock availability (warn if quantity > available stock)
- [ ] Success toasts ("Order created successfully" / "Order updated successfully")
- [ ] Error handling ("Insufficient stock for product X", "Failed to save order")
- [ ] Loading states
- [ ] "Create Order" button on orders list
- [ ] Edit button on table rows

**Status Management:**
- [ ] Status dropdown to transition between: Draft → Pending → Confirmed → Processing → Shipped → Delivered
- [ ] Status can also transition to Cancelled from any state
- [ ] Visual status indicator with color coding (already exists for list view, ensure consistency)
- [ ] Confirmation when changing status: "Change order status to [New Status]?"
- [ ] Update order status via PUT /api/orders/{id}/status endpoint

**Delete Operation:**
- [ ] Delete only allowed for Draft or Cancelled orders
- [ ] Confirmation dialog with order number ("Delete order ORD-2026-001?")
- [ ] Error message if trying to delete non-draft/cancelled order ("Cannot delete orders that are in progress or delivered")
- [ ] Success toast on deletion

**UI/UX Polish:**
- [ ] Empty state for no orders ("No orders found. Create your first order to get started.")
- [ ] Loading skeleton for table
- [ ] Pagination with page size options (10, 25, 50, 100 items per page)
- [ ] Click order number to view order details (nice-to-have, optional)

### 4. Quotes Module (Priority: CRITICAL)
**Create/Edit Form Requirements:**
- [ ] Quote create form (similar to orders):
  - **Quote Header**: Customer (searchable dropdown), Quote Date (date picker), Valid Until (date picker), Status (dropdown), Notes (textarea)
  - **Line Items**: Product (searchable dropdown), Quantity (number input), Unit Price (auto-filled, editable), Subtotal (calculated, read-only)
- [ ] Add/Remove line items dynamically
- [ ] Total calculation (sum of line items)
- [ ] Quote edit form (load existing quote and line items)
- [ ] Validation: At least 1 line item required, Customer required, Valid Until must be after Quote Date
- [ ] Success toasts ("Quote created successfully" / "Quote updated successfully")
- [ ] Error handling
- [ ] Loading states
- [ ] "Create Quote" button on quotes list
- [ ] Edit button on rows

**Status Management:**
- [ ] Status transitions: Draft → Pending → Sent → Accepted / Rejected / Expired
- [ ] Status change confirmation ("Change quote status to Sent?")
- [ ] Visual status indicators (color-coded badges)
- [ ] Update quote status via PUT /api/quotes/{id}/status endpoint

**Convert Quote to Order:**
- [ ] "Convert to Order" button (only visible/enabled for Accepted quotes)
- [ ] Creates a new order with same customer and line items
- [ ] Confirmation: "Convert quote Q-2026-001 to an order?"
- [ ] Use POST /api/quotes/{id}/convert-to-order endpoint
- [ ] Success toast ("Quote converted to order successfully. Order number: ORD-2026-XXX")
- [ ] Redirect to orders list or new order detail page after conversion

**Delete Operation:**
- [ ] Delete only allowed for Draft status
- [ ] Confirmation dialog ("Delete quote Q-2026-001?")
- [ ] Error if trying to delete non-draft quote ("Cannot delete quotes that have been sent")
- [ ] Success toast on deletion

**UI/UX Polish:**
- [ ] Empty state ("No quotes found. Create your first quote to get started.")
- [ ] Loading states
- [ ] Pagination
- [ ] Expired quotes visual indicator (red badge or expired label if Valid Until < today)

### 5. Global UI/UX Improvements
- [ ] Consistent toast notification system across all modules (use shadcn/ui Toast)
- [ ] Consistent error handling:
  - Network errors: "Unable to connect to server. Please try again."
  - Validation errors: Show field-specific errors
  - Authorization errors: "You don't have permission to perform this action"
- [ ] Consistent loading states:
  - Skeleton loaders for tables (shimmer effect)
  - Spinner for buttons during submission ("Saving..." text)
  - Disable form during submission
- [ ] Consistent empty states with call-to-action (icon, message, button)
- [ ] Responsive design: Forms work on mobile/tablet (already mostly responsive, verify it works)
- [ ] Keyboard navigation:
  - Tab order makes sense (flows top to bottom, left to right)
  - Enter submits forms
  - Escape closes dialogs
- [ ] Accessibility:
  - Proper ARIA labels for form fields
  - Focus management in dialogs (focus first input when opened, return focus when closed)
  - Screen reader friendly (all buttons have descriptive labels)

## Technical Patterns to Follow

### Frontend
- **Form Library**: React Hook Form + Zod validation (see `apps/web/components/auth/login-form.tsx` for exact pattern)
- **UI Components**: shadcn/ui (already installed):
  - Button, Dialog, Form, Input, Label, Select, Table, Toast, Skeleton, Badge, AlertDialog
  - Command (for searchable dropdowns)
  - Calendar + Popover (for date pickers)
- **API Client**: Use `apiClient` from `apps/web/lib/api/client.ts`:
  - `apiClient.get("/api/products")` for GET
  - `apiClient.post("/api/products", data)` for POST
  - `apiClient.put("/api/products/${id}", data)` for PUT
  - `apiClient.delete("/api/products/${id}")` for DELETE
- **File Structure**: Place forms in `apps/web/app/(dashboard)/[module]/components/[ModuleName]Form.tsx`
  - Example: `apps/web/app/(dashboard)/products/components/ProductForm.tsx`
  - Line item components: `apps/web/app/(dashboard)/orders/components/OrderLineItems.tsx`
- **Styling**: Tailwind CSS v4 with design tokens (no inline hex colors like #FF0000)
  - Use: `bg-primary`, `text-destructive`, `bg-muted`, `text-muted-foreground`
  - Use spacing scale: `space-y-4`, `gap-6`, `p-4`, `mt-2`
- **Component Pattern**:
  - Use `"use client"` directive at top of file
  - Use async/await for API calls
  - Proper TypeScript types for all props, state, and API responses

### Backend
- **Existing Endpoints**: Use existing CRUD endpoints in `apps/backend/src/api/routes/demo_lists.py` and related files
- **No Schema Changes**: Do NOT modify database models in `apps/backend/src/db/demo_models.py` unless explicitly approved
- **Validation**: Backend already has Pydantic validation in place, leverage it for error messages

### Code Quality
- **TypeScript**: All new components must have proper type definitions (interfaces for props, typed state)
- **Error Handling**: Every API call wrapped in try-catch with meaningful error messages
- **Loading States**: Every async operation needs loading state (useState for isLoading)
- **Testing**: Write basic tests for new components using Vitest for frontend, Pytest for backend if adding new endpoints

## Completion Criteria

### The MVP is complete when:
1. All 4 modules (Products, Customers, Orders, Quotes) have full CRUD operations (Create, Read, Update, Delete)
2. All forms have validation and error handling (both frontend Zod validation and backend Pydantic validation)
3. All delete operations have confirmation dialogs (AlertDialog component)
4. Orders and Quotes have line item management (add/remove products with quantities and prices)
5. Orders and Quotes have status management (dropdown to change status with confirmation)
6. All pages have loading, error, and empty states
7. Quote-to-Order conversion works (button visible for Accepted quotes, creates new order)
8. All tests pass: `pnpm turbo run test`
9. No TypeScript errors: `pnpm turbo run type-check`
10. No linting errors: `pnpm turbo run lint`

### Success Marker
When all the above is complete, add this marker to the bottom of this file:

---
## ✅ CCW_ERP_MVP_COMPLETE

**Completion Date**: [YYYY-MM-DD]
**Completed By**: Ralph
**Status**: All CRUD operations implemented, tested, and verified.

**Module Checklist:**
- [x] Products: Create, Read, Update, Delete
- [x] Customers: Create, Read, Update, Delete
- [x] Orders: Create, Read, Update, Delete, Status Management, Line Items
- [x] Quotes: Create, Read, Update, Delete, Status Management, Line Items, Convert to Order
- [x] UI/UX: Loading, Error, Empty states
- [x] Validation: All forms validated
- [x] Tests: All passing
- [x] Type Safety: No TypeScript errors
---

## How to Verify Completion

### Manual Testing Steps:
1. Start the application: `pnpm dev` (starts frontend on :3000 and backend on :8000)
2. Login with demo credentials: **admin@demo.com** / **demo123**
3. **Test Products Module:**
   - Click "Add Product" button
   - Fill in form: SKU="TEST-001", Name="Test Product", Category=select one, Price=99.99, Stock=10
   - Click Save - verify success toast appears
   - Verify new product appears in list
   - Click Edit on the product you just created
   - Change the name to "Updated Product", click Save
   - Verify update toast and name changed in list
   - Click Delete, confirm in dialog
   - Verify product removed from list
   - Try to create a product with invalid data (empty SKU, negative price) - verify validation errors show
4. **Test Customers Module:**
   - Create a customer with valid data
   - Edit the customer
   - Delete the customer
   - Try invalid email format (should show validation error)
5. **Test Orders Module:**
   - Click "Create Order"
   - Select a customer from dropdown
   - Click "+ Add Item" to add line items
   - Select Product, enter Quantity
   - Verify Unit Price auto-fills, Subtotal calculates automatically
   - Add at least 2 line items
   - Verify Total calculates correctly (sum of subtotals)
   - Click Save - verify order created
   - Edit the order - change quantity on a line item, verify total updates
   - Change order status from Draft → Pending (verify confirmation dialog)
   - Try to create order without line items (should show validation: "At least 1 item required")
   - Create a draft order, then delete it (should work)
   - Try to delete a confirmed order (should fail with error message)
6. **Test Quotes Module:**
   - Create a quote with customer and line items
   - Change quote status from Draft → Sent
   - Change quote status to Accepted
   - Click "Convert to Order" button
   - Verify confirmation dialog appears
   - Confirm conversion
   - Verify new order is created with same customer and items
   - Verify success toast shows order number
   - Delete a draft quote (should work)
   - Try to delete a sent quote (should fail)

### Automated Testing:
```bash
# Run all checks (from project root)
pnpm turbo run type-check lint test

# Expected output:
# ✓ Type checking passed (no TypeScript errors)
# ✓ Linting passed (no ESLint errors)
# ✓ All tests passed (Vitest + Pytest)
```

### Visual Checklist:
- [ ] All pages have loading skeletons while fetching data
- [ ] All pages show empty states when no data exists
- [ ] All forms show loading state during submission (button disabled, spinner visible)
- [ ] All forms show validation errors inline (red text under fields)
- [ ] All delete operations show confirmation dialog before executing
- [ ] All successful operations show toast notification
- [ ] All failed operations show error toast with clear message
- [ ] Pagination controls work and show correct page numbers
- [ ] Search functionality works and filters results
- [ ] Tables are responsive and usable on mobile

## Notes for Ralph
- **Incremental Approach**: Build one module at a time in this order: Products → Customers → Orders → Quotes
- **Test As You Go**: After completing each module, manually test it works before moving to next module
- **Reuse Components**: Once you build ProductForm, you can use same pattern for CustomerForm, OrderForm, QuoteForm
- **Check Existing Code**: Look at `apps/web/components/auth/login-form.tsx` for the form validation pattern to follow
- **Backend Ready**: API endpoints already exist at `/api/products`, `/api/customers`, `/api/orders`, `/api/quotes` - you just need to call them from frontend
- **Design System**: Use shadcn/ui components (already installed), don't build form components from scratch
- **Commit Often**: Make small, atomic commits for each feature (e.g., "Add product create form", "Add product delete functionality")
- **Environment**: Database is already set up, seeded with demo data, and backend is running - just focus on frontend CRUD forms
