x# Linear Issues - Frontend/Backend Connector Gaps

**Analysis Date**: February 2, 2026  
**Analyst**: Claude Code - Autonomous Development Framework  
**Team Key**: CCW  
**Project**: ERP Deployment  

Copy and paste each issue below into Linear to create the full task list for connector implementation.

---

## EPIC: Frontend/Backend Connector Framework Completion

**Status**: To Do  
**Priority**: High 🟠  
**Labels**: connectors, frontend, backend, api, architecture  
**Start Date**: TBD  
**Target Completion**: TBD  

### Description

Complete the missing connectors between frontend and backend. The scaffold exists but many API clients and dashboard pages are missing, causing frontend components to use ad-hoc API calls instead of centralized, typed clients.

### Current State

- ✅ Backend API routes: 40+ endpoints implemented
- ✅ Frontend pages: 8 major modules connected
- ⚠️ API Clients: Only 5 of 10 needed clients exist
- ❌ Missing dashboard pages: 3 critical modules
- ❌ Type sharing: Inconsistent between frontend/backend

### Success Criteria

- [ ] All backend routes have corresponding frontend API clients
- [ ] All major modules have dedicated dashboard pages
- [ ] Type definitions consolidated in shared package
- [ ] Consistent error handling across all API calls
- [ ] 100% TypeScript coverage for API layer

---

## ISSUE #1: Create Orders API Client

**Status**: To Do  
**Priority**: High 🟠  
**Labels**: frontend, api-client, orders, typescript  
**Estimate**: 2 hours  
**Blocked By**: None  
**Blocks**: None  

### Problem

Orders page uses `apiClient` directly instead of a typed, dedicated orders API client. This leads to:
- No centralized type definitions for order operations
- Inconsistent error handling
- Duplicate code across order-related components

### Current Implementation

**File**: `apps/web/app/(dashboard)/orders/page.tsx` (lines 47-57)
```typescript
const response = await apiClient.get<PaginatedResponse>(
  `/api/orders?page=${page}&page_size=${pageSize}`
);
```

**Backend Route**: `apps/backend/src/api/routes/orders.py`
- GET `/api/orders` - List orders
- POST `/api/orders` - Create order
- GET `/api/orders/{id}` - Get single order
- PUT `/api/orders/{id}` - Update order
- DELETE `/api/orders/{id}` - Delete order
- GET `/api/orders/{id}/activity` - Get order activity
- PUT `/api/orders/{id}/status` - Update order status

### Acceptance Criteria

- [ ] Create `apps/web/lib/api/orders.ts`
- [ ] Define TypeScript interfaces: `Order`, `OrderCreate`, `OrderUpdate`, `OrderItem`
- [ ] Implement methods:
  - `listOrders(params)` - List with pagination
  - `getOrder(id)` - Get single order
  - `createOrder(data)` - Create new order
  - `updateOrder(id, data)` - Update order
  - `deleteOrder(id)` - Delete order
  - `getOrderActivity(id)` - Get activity log
  - `updateOrderStatus(id, status)` - Update status
- [ ] Export from `apps/web/lib/api/index.ts`
- [ ] Refactor Orders page to use new client
- [ ] Refactor OrderForm to use new client
- [ ] Add JSDoc comments for all methods

### Type Definitions

```typescript
interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name: string;
  status: 'draft' | 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  total: string;
  order_date: string;
  fulfillment_location: string;
  tracking_number?: string;
  carrier_name?: string;
  shipped_date?: string;
  estimated_delivery_date?: string;
  notes?: string;
  items: OrderItem[];
}

interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: string;
  line_total: string;
}
```

---

## ISSUE #2: Create Quotes API Client

**Status**: To Do  
**Priority**: High 🟠  
**Labels**: frontend, api-client, quotes, typescript  
**Estimate**: 2 hours  
**Blocked By**: None  
**Blocks**: None  

### Problem

Quotes page uses `apiClient` directly instead of a typed, dedicated quotes API client.

### Current Implementation

**File**: `apps/web/app/(dashboard)/quotes/page.tsx` (lines 32-38)
```typescript
const response = await apiClient.get<PaginatedResponse>(
  "/api/quotes?page=1&page_size=50"
);
```

**Backend Route**: `apps/backend/src/api/routes/quotes.py`
- GET `/api/quotes` - List quotes
- POST `/api/quotes` - Create quote
- GET `/api/quotes/{id}` - Get single quote
- PUT `/api/quotes/{id}` - Update quote
- DELETE `/api/quotes/{id}` - Delete quote
- POST `/api/quotes/{id}/convert-to-order` - Convert to order
- POST `/api/quotes/generate` - AI-generated quote

### Acceptance Criteria

- [ ] Create `apps/web/lib/api/quotes.ts`
- [ ] Define TypeScript interfaces: `Quote`, `QuoteCreate`, `QuoteUpdate`, `QuoteItem`
- [ ] Implement methods:
  - `listQuotes(params)` - List with pagination
  - `getQuote(id)` - Get single quote
  - `createQuote(data)` - Create new quote
  - `updateQuote(id, data)` - Update quote
  - `deleteQuote(id)` - Delete quote
  - `convertToOrder(id)` - Convert quote to order
  - `generateQuote(requirements)` - AI-generated quote
- [ ] Export from `apps/web/lib/api/index.ts`
- [ ] Refactor Quotes page to use new client
- [ ] Refactor QuoteForm to use new client

---

## ISSUE #3: Create Customers API Client

**Status**: To Do  
**Priority**: High 🟠  
**Labels**: frontend, api-client, customers, typescript  
**Estimate**: 2 hours  
**Blocked By**: None  
**Blocks**: None  

### Problem

No dedicated customers API client exists. Customer data is fetched inline in OrderForm component.

### Current Implementation

**File**: `apps/web/app/(dashboard)/orders/components/OrderForm.tsx` (lines 92-99)
```typescript
const response = await apiClient.get<{ items: Customer[] }>(
  "/api/customers?page=1&page_size=100"
);
```

**Backend Route**: `apps/backend/src/api/routes/customers.py`
- GET `/api/customers` - List customers
- POST `/api/customers` - Create customer
- GET `/api/customers/{id}` - Get single customer
- PUT `/api/customers/{id}` - Update customer
- DELETE `/api/customers/{id}` - Soft delete customer

### Acceptance Criteria

- [ ] Create `apps/web/lib/api/customers.ts`
- [ ] Define TypeScript interfaces: `Customer`, `CustomerCreate`, `CustomerUpdate`
- [ ] Implement methods:
  - `listCustomers(params)` - List with pagination/search
  - `getCustomer(id)` - Get single customer
  - `createCustomer(data)` - Create new customer
  - `updateCustomer(id, data)` - Update customer
  - `deleteCustomer(id)` - Soft delete customer
- [ ] Export from `apps/web/lib/api/index.ts`
- [ ] Refactor OrderForm to use new client
- [ ] Create `/customers` dashboard page (see Issue #9)

---

## ISSUE #4: Create Products API Client

**Status**: To Do  
**Priority**: High 🟠  
**Labels**: frontend, api-client, products, typescript  
**Estimate**: 2 hours  
**Blocked By**: None  
**Blocks**: None  

### Problem

No dedicated products API client exists. Products are fetched ad-hoc in line item components.

### Backend Route

`apps/backend/src/api/routes/products.py`
- GET `/api/products` - List products
- POST `/api/products` - Create product
- GET `/api/products/{id}` - Get single product
- PUT `/api/products/{id}` - Update product
- DELETE `/api/products/{id}` - Soft delete product

### Acceptance Criteria

- [ ] Create `apps/web/lib/api/products.ts`
- [ ] Define TypeScript interfaces: `Product`, `ProductCreate`, `ProductUpdate`
- [ ] Implement methods:
  - `listProducts(params)` - List with pagination/search/category filter
  - `getProduct(id)` - Get single product
  - `createProduct(data)` - Create new product
  - `updateProduct(id, data)` - Update product
  - `deleteProduct(id)` - Soft delete product
- [ ] Export from `apps/web/lib/api/index.ts`
- [ ] Refactor OrderLineItems to use new client
- [ ] Refactor QuoteLineItems to use new client
- [ ] Create `/products` dashboard page enhancements

---

## ISSUE #5: Create Inventory API Client

**Status**: To Do  
**Priority**: Medium 🟡  
**Labels**: frontend, api-client, inventory, typescript  
**Estimate**: 2 hours  
**Blocked By**: None  
**Blocks**: None  

### Problem

Inventory page uses `apiClient` directly for complex inventory operations.

### Current Implementation

**File**: `apps/web/app/(dashboard)/inventory/page.tsx` (lines 45-51)
```typescript
const data = await apiClient.get<{
  critical: StockHealthItem[];
  low: StockHealthItem[];
  warning: StockHealthItem[];
}>("/api/inventory/stock-health?threshold=20");
```

**Backend Route**: `apps/backend/src/api/routes/inventory.py`
- GET `/api/inventory` - List all inventory
- GET `/api/inventory/by-location` - Get stock by location
- GET `/api/inventory/low-stock` - Get low stock products
- GET `/api/inventory/stock-health` - Get stock health analysis
- GET `/api/inventory/transfer-suggestions` - Get transfer suggestions
- GET `/api/inventory/product/{id}/locations` - Get product stock by location
- POST `/api/inventory/transfer` - Create stock transfer
- GET `/api/inventory/transfers` - Get transfer history
- POST `/api/inventory/reserve` - Reserve stock
- POST `/api/inventory/release/{id}` - Release reservation
- POST `/api/inventory/adjust` - Adjust stock

### Acceptance Criteria

- [ ] Create `apps/web/lib/api/inventory.ts`
- [ ] Define TypeScript interfaces for all inventory types
- [ ] Implement methods:
  - `listInventory(params)` - List inventory
  - `getStockByLocation(location, params)` - Get stock by location
  - `getLowStock(threshold)` - Get low stock items
  - `getStockHealth(threshold)` - Get stock health
  - `getTransferSuggestions()` - Get transfer suggestions
  - `getProductStock(productId)` - Get product stock by location
  - `createTransfer(data)` - Create stock transfer
  - `getTransfers(params)` - Get transfer history
  - `reserveStock(data)` - Reserve stock
  - `releaseReservation(id)` - Release reservation
  - `adjustStock(data)` - Adjust stock
- [ ] Export from `apps/web/lib/api/index.ts`
- [ ] Refactor Inventory page to use new client
- [ ] Refactor StockTransferDialog to use new client
- [ ] Refactor StockAdjustmentDialog to use new client

---

## ISSUE #6: Create Purchase Orders API Client

**Status**: To Do  
**Priority**: Medium 🟡  
**Labels**: frontend, api-client, purchase-orders, typescript  
**Estimate**: 2 hours  
**Blocked By**: None  
**Blocks**: Issue #11 (Purchase Orders Dashboard Page)  

### Problem

Backend has full purchase orders API but no frontend client exists.

### Backend Route

`apps/backend/src/api/routes/purchase_orders.py`
- GET `/api/purchase-orders` - List purchase orders
- POST `/api/purchase-orders` - Create purchase order
- GET `/api/purchase-orders/{id}` - Get single PO
- PUT `/api/purchase-orders/{id}` - Update PO
- DELETE `/api/purchase-orders/{id}` - Delete PO
- PUT `/api/purchase-orders/{id}/status` - Update PO status
- GET `/api/purchase-orders/{id}/receipts` - Get receipts
- POST `/api/purchase-orders/{id}/receive` - Receive stock

### Acceptance Criteria

- [ ] Create `apps/web/lib/api/purchase-orders.ts`
- [ ] Define TypeScript interfaces: `PurchaseOrder`, `PurchaseOrderCreate`, `PurchaseOrderItem`, etc.
- [ ] Implement all CRUD methods
- [ ] Export from `apps/web/lib/api/index.ts`

---

## ISSUE #7: Create Suppliers API Client

**Status**: To Do  
**Priority**: Medium 🟡  
**Labels**: frontend, api-client, suppliers, typescript  
**Estimate**: 1.5 hours  
**Blocked By**: None  
**Blocks**: Issue #12 (Suppliers Dashboard Page)  

### Problem

Backend has suppliers API but no frontend client exists.

### Backend Route

`apps/backend/src/api/routes/suppliers.py`
- GET `/api/suppliers` - List suppliers
- POST `/api/suppliers` - Create supplier
- GET `/api/suppliers/{id}` - Get single supplier
- PUT `/api/suppliers/{id}` - Update supplier
- DELETE `/api/suppliers/{id}` - Delete supplier

### Acceptance Criteria

- [ ] Create `apps/web/lib/api/suppliers.ts`
- [ ] Define TypeScript interfaces: `Supplier`, `SupplierCreate`, `SupplierUpdate`
- [ ] Implement all CRUD methods
- [ ] Export from `apps/web/lib/api/index.ts`

---

## ISSUE #8: Refactor Contractors Route to Use SQLAlchemy

**Status**: To Do  
**Priority**: High 🟠  
**Labels**: backend, database, sqlalchemy, refactoring  
**Estimate**: 4 hours  
**Blocked By**: None  
**Blocks**: None  

### Problem

Contractors route uses Supabase client directly instead of SQLAlchemy ORM like all other routes. This creates inconsistency and bypasses connection pooling, caching, and transaction management.

### Current Implementation

**File**: `apps/backend/src/api/routes/contractors.py`
```python
from src.utils.supabase_client import supabase

# Uses supabase.table() directly
response = supabase.table("contractors").select("*, availability_slots(*)").execute()
```

### Other Routes (Correct Pattern)

**File**: `apps/backend/src/api/routes/customers.py`
```python
from sqlalchemy.ext.asyncio import AsyncSession
from src.config.database import get_db

async def list_customers(db: AsyncSession = Depends(get_db)):
    query = select(CustomerModel)
    result = await db.execute(query)
```

### Acceptance Criteria

- [ ] Create `src/db/models/contractor.py` with SQLAlchemy models:
  - `Contractor` model
  - `AvailabilitySlot` model
- [ ] Create Alembic migration for contractor tables
- [ ] Refactor `contractors.py` to use SQLAlchemy
- [ ] Update all CRUD operations to use async SQLAlchemy
- [ ] Add proper transaction handling
- [ ] Add database-level constraints (ABN format, mobile format)
- [ ] Update tests to work with SQLAlchemy
- [ ] Verify all existing functionality still works

### Database Schema

```python
class Contractor(Base):
    __tablename__ = "contractors"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    mobile = Column(String(20), nullable=False)
    abn = Column(String(14), nullable=True)
    email = Column(String(255), nullable=True)
    specialisation = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    availability_slots = relationship("AvailabilitySlot", back_populates="contractor")

class AvailabilitySlot(Base):
    __tablename__ = "availability_slots"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contractor_id = Column(UUID(as_uuid=True), ForeignKey("contractors.id"), nullable=False)
    date = Column(Date, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    suburb = Column(String(100), nullable=False)
    state = Column(String(3), nullable=False)
    postcode = Column(String(4), nullable=True)
    status = Column(String(20), default="available")
    notes = Column(Text, nullable=True)
    
    contractor = relationship("Contractor", back_populates="availability_slots")
```

---

## ISSUE #9: Create Customers Dashboard Page

**Status**: To Do  
**Priority**: Medium 🟡  
**Labels**: frontend, dashboard, customers, ui  
**Estimate**: 4 hours  
**Blocked By**: Issue #3 (Customers API Client)  
**Blocks**: None  

### Problem

No dashboard page exists for customer management despite backend having full CRUD API.

### Backend API

- GET `/api/customers` - List with pagination, search, filters
- POST `/api/customers` - Create customer
- GET `/api/customers/{id}` - Get customer details
- PUT `/api/customers/{id}` - Update customer
- DELETE `/api/customers/{id}` - Soft delete

### Acceptance Criteria

- [ ] Create `apps/web/app/(dashboard)/customers/page.tsx`
- [ ] Implement customer list view with:
  - Responsive table
  - Pagination
  - Search by company name, contact name, email
  - Filter by active status
  - Sort by created date
- [ ] Create `CustomerForm` component for create/edit
- [ ] Create `DeleteCustomerDialog` component
- [ ] Add customer details view
- [ ] Use customers API client (Issue #3)
- [ ] Add to navigation menu
- [ ] Add breadcrumb navigation

### UI Components

- Search input with debounce
- Status filter dropdown
- Responsive table with columns:
  - Customer Number
  - Company Name
  - Contact Name
  - Email
  - Phone
  - Status (Active/Inactive)
  - Actions (Edit, Delete, View)
- Pagination controls
- "Add Customer" button

---

## ISSUE #10: Create Products Dashboard Page

**Status**: To Do  
**Priority**: Medium 🟡  
**Labels**: frontend, dashboard, products, ui  
**Estimate**: 4 hours  
**Blocked By**: Issue #4 (Products API Client)  
**Blocks**: None  

### Problem

Products page exists but needs enhancement and should use dedicated API client.

### Acceptance Criteria

- [ ] Create `apps/web/app/(dashboard)/products/page.tsx` (enhanced)
- [ ] Implement product list view with:
  - Responsive table
  - Pagination
  - Search by name, SKU, description
  - Filter by category, active status
  - Sort by created date, price
- [ ] Create `ProductForm` component for create/edit
- [ ] Create `DeleteProductDialog` component
- [ ] Add product details view
- [ ] Use products API client (Issue #4)
- [ ] Add category filter dropdown

---

## ISSUE #11: Create Purchase Orders Dashboard Page

**Status**: To Do  
**Priority**: Medium 🟡  
**Labels**: frontend, dashboard, purchase-orders, ui  
**Estimate**: 5 hours  
**Blocked By**: Issue #6 (Purchase Orders API Client)  
**Blocks**: None  

### Problem

No dashboard page exists for purchase order management despite backend having full API.

### Acceptance Criteria

- [ ] Create `apps/web/app/(dashboard)/purchase-orders/page.tsx`
- [ ] Implement PO list view with:
  - Responsive table
  - Pagination
  - Search by PO number
  - Filter by status, supplier
  - Sort by order date, status
- [ ] Create `PurchaseOrderForm` component
- [ ] Create `PurchaseOrderLineItems` component
- [ ] Create `ReceiveStockDialog` component
- [ ] Add PO status workflow (draft → sent → partial → received)
- [ ] Use purchase orders API client (Issue #6)
- [ ] Add to navigation menu

---

## ISSUE #12: Create Suppliers Dashboard Page

**Status**: To Do  
**Priority**: Medium 🟡  
**Labels**: frontend, dashboard, suppliers, ui  
**Estimate**: 4 hours  
**Blocked By**: Issue #7 (Suppliers API Client)  
**Blocks**: None  

### Problem

No dashboard page exists for supplier management despite backend having full API.

### Acceptance Criteria

- [ ] Create `apps/web/app/(dashboard)/suppliers/page.tsx`
- [ ] Implement supplier list view with:
  - Responsive table
  - Pagination
  - Search by name, email
  - Filter by active status
- [ ] Create `SupplierForm` component
- [ ] Create `DeleteSupplierDialog` component
- [ ] Add supplier details view
- [ ] Use suppliers API client (Issue #7)
- [ ] Add to navigation menu

---

## ISSUE #13: Create Shipments Dashboard Page

**Status**: To Do  
**Priority**: Low 🟢  
**Labels**: frontend, dashboard, shipments, ui  
**Estimate**: 4 hours  
**Blocked By**: None  
**Blocks**: None  

### Problem

No dashboard page exists for shipment tracking despite backend having full API.

### Backend API

`apps/backend/src/api/routes/shipments.py`
- GET `/api/shipments` - List shipments
- POST `/api/shipments` - Create shipment
- GET `/api/shipments/{id}` - Get shipment details
- PUT `/api/shipments/{id}` - Update shipment
- DELETE `/api/shipments/{id}` - Delete shipment
- POST `/api/shipments/{id}/track` - Update tracking

### Acceptance Criteria

- [ ] Create `apps/web/app/(dashboard)/shipments/page.tsx`
- [ ] Implement shipment list view
- [ ] Create `ShipmentForm` component
- [ ] Create tracking status display
- [ ] Add carrier integration display
- [ ] Use shipments API client
- [ ] Add to navigation menu

---

## ISSUE #14: Consolidate Type Definitions in Shared Package

**Status**: To Do  
**Priority**: Medium 🟡  
**Labels**: types, shared-package, typescript, architecture  
**Estimate**: 3 hours  
**Blocked By**: None  
**Blocks**: None  

### Problem

Type definitions are scattered and duplicated:
- Frontend defines types locally in each feature folder
- Shared package has incomplete types
- Backend Pydantic schemas are not shared with frontend
- Inconsistent naming (page_size vs pageSize)

### Current State

**Shared Package**: `packages/shared/src/types/api.ts`
```typescript
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;  // camelCase
  hasMore: boolean;
}
```

**Backend**: Returns `page_size` (snake_case)
```python
return {
  "items": items,
  "total": total,
  "page": page,
  "page_size": page_size,  # snake_case
}
```

### Acceptance Criteria

- [ ] Audit all type definitions across frontend/backend
- [ ] Expand `packages/shared/src/types/` with:
  - `orders.ts` - Order types
  - `quotes.ts` - Quote types
  - `customers.ts` - Customer types
  - `products.ts` - Product types
  - `inventory.ts` - Inventory types
  - `purchase-orders.ts` - Purchase order types
  - `suppliers.ts` - Supplier types
- [ ] Standardize pagination naming to `page_size` (snake_case)
- [ ] Update frontend to use shared types
- [ ] Export all types from `packages/shared/src/index.ts`
- [ ] Update all API clients to use shared types

---

## ISSUE #15: Update API Index Exports

**Status**: To Do  
**Priority**: Medium 🟡  
**Labels**: frontend, api, exports, typescript  
**Estimate**: 1 hour  
**Blocked By**: Issues #1-7 (API Clients)  
**Blocks**: None  

### Problem

`apps/web/lib/api/index.ts` only exports auth and client types. Missing exports for all domain API clients.

### Current State

**File**: `apps/web/lib/api/index.ts`
```typescript
export { apiClient, createClient, ApiClientError } from "./client";
export { serverApiClient, createClient as createServerClient } from "./server";
export { authApi } from "./auth";
export { updateSession } from "./middleware";

export type { User, LoginRequest, LoginResponse, RegisterRequest, RegisterResponse } from "./auth";
export type { ApiError } from "./client";
```

### Acceptance Criteria

- [ ] Update `apps/web/lib/api/index.ts` to export:
  - `ordersApi` from `./orders`
  - `quotesApi` from `./quotes`
  - `customersApi` from `./customers`
  - `productsApi` from `./products`
  - `inventoryApi` from `./inventory`
  - `purchaseOrdersApi` from `./purchase-orders`
  - `suppliersApi` from `./suppliers`
- [ ] Export all type definitions
- [ ] Add JSDoc comments for each export
- [ ] Ensure barrel export pattern is complete

### Expected Result

```typescript
// Single import for all API functionality
import { 
  apiClient, 
  authApi, 
  ordersApi, 
  quotesApi, 
  customersApi,
  productsApi,
  inventoryApi 
} from "@/lib/api";
```

---

## ISSUE #16: Verify Auth Routes Implementation

**Status**: To Do  
**Priority**: High 🟠  
**Labels**: backend, auth, api, verification  
**Estimate**: 2 hours  
**Blocked By**: None  
**Blocks**: None  

### Problem

Frontend expects auth routes at `/api/auth/*` but backend may only have `demo_auth.py` with limited functionality.

### Frontend Expectations

**File**: `apps/web/lib/api/auth.ts`
```typescript
async login(credentials: LoginRequest): Promise<LoginResponse> {
  return apiClient.post<LoginResponse>("/api/auth/login", credentials);
}

async getCurrentUser(): Promise<User | null> {
  return apiClient.get<User>("/api/auth/me");
}
```

### Required Backend Routes

- POST `/api/auth/login` - JWT login
- POST `/api/auth/register` - User registration
- POST `/api/auth/logout` - Logout
- GET `/api/auth/me` - Get current user
- PATCH `/api/auth/me` - Update profile
- POST `/api/auth/change-password` - Change password
- POST `/api/auth/forgot-password` - Request reset
- POST `/api/auth/reset-password` - Reset with token

### Acceptance Criteria

- [ ] Verify all auth routes exist in backend
- [ ] Check if `demo_auth.py` needs enhancement
- [ ] Create full auth router if missing
- [ ] Ensure JWT token handling is consistent
- [ ] Add proper password hashing (bcrypt)
- [ ] Test all auth flows end-to-end

---

## Summary - Implementation Order

### Phase 1: API Clients (Week 1)
1. Issue #1: Orders API Client (2h)
2. Issue #2: Quotes API Client (2h)
3. Issue #3: Customers API Client (2h)
4. Issue #4: Products API Client (2h)
5. Issue #5: Inventory API Client (2h)
6. Issue #6: Purchase Orders API Client (2h)
7. Issue #7: Suppliers API Client (1.5h)
8. Issue #15: Update API Index Exports (1h)

**Total**: 14.5 hours

### Phase 2: Backend Consistency (Week 1-2)
9. Issue #8: Refactor Contractors to SQLAlchemy (4h)
10. Issue #16: Verify Auth Routes (2h)

**Total**: 6 hours

### Phase 3: Dashboard Pages (Week 2)
11. Issue #9: Customers Dashboard Page (4h)
12. Issue #10: Products Dashboard Page (4h)
13. Issue #11: Purchase Orders Dashboard Page (5h)
14. Issue #12: Suppliers Dashboard Page (4h)
15. Issue #13: Shipments Dashboard Page (4h)

**Total**: 21 hours

### Phase 4: Type Consolidation (Week 2-3)
16. Issue #14: Consolidate Type Definitions (3h)

**Total**: 3 hours

---

## Grand Total

**Estimated Effort**: 44.5 hours (approximately 2-3 weeks of focused development)

**Critical Path**:
1. API Clients → Dashboard Pages (can parallelize)
2. Backend Consistency → Type Consolidation

**Dependencies**:
- Dashboard pages depend on API clients
- Type consolidation should happen after API clients are stable

---

**Document Generated**: February 2, 2026  
**Purpose**: Import all connector issues into Linear for tracking  
**Next Review**: After Phase 1 completion