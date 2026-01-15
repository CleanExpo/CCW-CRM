# Database Schema Reference

**Project**: CCW-Online-ERP
**Database**: PostgreSQL 15
**ORM**: SQLAlchemy 2.0 (Async)
**Location**: `apps/backend/src/db/`

---

## Table of Contents

1. [Core ERP Tables](#core-erp-tables)
2. [Inventory Management Tables](#inventory-management-tables)
3. [System Tables](#system-tables)
4. [Enums](#enums)
5. [Relationships](#relationships)
6. [Cascade Delete Rules](#cascade-delete-rules)
7. [Common Query Patterns](#common-query-patterns)

---

## Core ERP Tables

### organizations
Multi-tenant organization/company data.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique identifier |
| `name` | String(255) | NOT NULL | Organization name |
| `subdomain` | String(100) | UNIQUE | Subdomain for multi-tenancy |
| `is_active` | Boolean | NOT NULL, DEFAULT TRUE | Active status |
| `created_at` | DateTime(TZ) | NOT NULL | Creation timestamp |
| `updated_at` | DateTime(TZ) | NOT NULL | Last update timestamp |

**Relationships**: users, products, customers, orders, quotes

---

### products
Product catalog with pricing and stock information.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique identifier |
| `organization_id` | UUID | FK → organizations, INDEXED | Organization owner |
| `sku` | String(50) | NOT NULL, UNIQUE, INDEXED | Stock keeping unit |
| `name` | String(255) | NOT NULL | Product name |
| `description` | Text | | Detailed description |
| `category` | String(50) | NOT NULL | Product category |
| `price` | Numeric(10,2) | NOT NULL | Selling price |
| `cost` | Numeric(10,2) | | Cost price |
| `stock` | Integer | NOT NULL, DEFAULT 0 | Global stock level (legacy) |
| `warehouse_location` | String(100) | | Warehouse location |
| `is_active` | Boolean | NOT NULL, DEFAULT TRUE | Active status |
| `created_at` | DateTime(TZ) | NOT NULL | Creation timestamp |
| `updated_at` | DateTime(TZ) | NOT NULL | Last update timestamp |

**Valid Categories**: heavy_machinery, hand_tools, power_tools, safety_equipment, building_materials, electrical, plumbing, accessories

**Relationships**: order_items, quote_items, product_stock_by_location, stock_adjustments

---

### customers
Customer directory with contact and address information.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique identifier |
| `organization_id` | UUID | FK → organizations, INDEXED | Organization owner |
| `customer_number` | String(50) | NOT NULL, UNIQUE, INDEXED | Customer reference number |
| `company_name` | String(255) | NOT NULL | Company name |
| `contact_name` | String(255) | | Primary contact name |
| `email` | String(255) | | Contact email |
| `phone` | String(50) | | Contact phone |
| `address` | Text | | Street address |
| `city` | String(100) | | City |
| `state` | String(50) | | State/province |
| `postcode` | String(20) | | Postal code |
| `is_active` | Boolean | NOT NULL, DEFAULT TRUE | Active status |
| `created_at` | DateTime(TZ) | NOT NULL | Creation timestamp |
| `updated_at` | DateTime(TZ) | NOT NULL | Last update timestamp |

**Relationships**: orders, quotes

---

### orders
Sales orders with status tracking.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique identifier |
| `organization_id` | UUID | FK → organizations, INDEXED | Organization owner |
| `order_number` | String(50) | NOT NULL, UNIQUE, INDEXED | Format: ORD-YYYY-NNN |
| `customer_id` | UUID | FK → customers, INDEXED | Customer placing order |
| `status` | String(20) | NOT NULL, DEFAULT 'draft' | Order status |
| `total` | Numeric(10,2) | NOT NULL | Total amount |
| `order_date` | DateTime(TZ) | NOT NULL | Order date |
| `notes` | Text | | Additional notes |
| `created_at` | DateTime(TZ) | NOT NULL | Creation timestamp |
| `updated_at` | DateTime(TZ) | NOT NULL | Last update timestamp |

**Valid Statuses**: draft, pending, confirmed, processing, shipped, delivered, cancelled

**Relationships**: customer, items (order_items), shipments (outbound_shipments), stock_reservations

---

### order_items
Line items for orders.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique identifier |
| `order_id` | UUID | FK → orders (CASCADE DELETE), NOT NULL | Parent order |
| `product_id` | UUID | FK → products | Product reference |
| `quantity` | Integer | NOT NULL | Quantity ordered |
| `unit_price` | Numeric(10,2) | NOT NULL | Price per unit |
| `line_total` | Numeric(10,2) | NOT NULL | Calculated: quantity × unit_price |
| `created_at` | DateTime(TZ) | NOT NULL | Creation timestamp |

**Relationships**: order, product

---

### quotes
Customer quotes/proposals.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique identifier |
| `organization_id` | UUID | FK → organizations, INDEXED | Organization owner |
| `quote_number` | String(50) | NOT NULL, UNIQUE, INDEXED | Format: Q-YYYY-NNN |
| `customer_id` | UUID | FK → customers, INDEXED | Customer receiving quote |
| `status` | String(20) | NOT NULL, DEFAULT 'draft' | Quote status |
| `total` | Numeric(10,2) | NOT NULL | Total amount |
| `quote_date` | DateTime(TZ) | NOT NULL | Quote date |
| `valid_until` | DateTime(TZ) | | Expiration date |
| `notes` | Text | | Additional notes |
| `created_at` | DateTime(TZ) | NOT NULL | Creation timestamp |
| `updated_at` | DateTime(TZ) | NOT NULL | Last update timestamp |

**Valid Statuses**: draft, pending, sent, accepted, rejected, expired

**Relationships**: customer, items (quote_items)

---

### quote_items
Line items for quotes.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique identifier |
| `quote_id` | UUID | FK → quotes (CASCADE DELETE), NOT NULL | Parent quote |
| `product_id` | UUID | FK → products | Product reference |
| `quantity` | Integer | NOT NULL | Quantity quoted |
| `unit_price` | Numeric(10,2) | NOT NULL | Price per unit |
| `line_total` | Numeric(10,2) | NOT NULL | Calculated: quantity × unit_price |
| `created_at` | DateTime(TZ) | NOT NULL | Creation timestamp |

**Relationships**: quote, product

---

## Inventory Management Tables

### product_stock_by_location
Multi-location inventory tracking with reservations.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique identifier |
| `product_id` | UUID | FK → products (CASCADE DELETE), NOT NULL, INDEXED | Product reference |
| `location` | String(50) | NOT NULL, INDEXED | Store location |
| `stock` | Integer | NOT NULL, DEFAULT 0, CHECK ≥0 | Physical stock quantity |
| `reserved` | Integer | NOT NULL, DEFAULT 0, CHECK ≥0 | Reserved for orders |
| `last_counted_at` | DateTime(TZ) | | Last stock count date |
| `last_counted_by` | UUID | | User who counted |
| `reorder_point` | Integer | | Reorder threshold |
| `reorder_quantity` | Integer | | Reorder quantity |
| `created_at` | DateTime(TZ) | NOT NULL | Creation timestamp |
| `updated_at` | DateTime(TZ) | NOT NULL | Last update timestamp |

**Computed Field**: `available` = stock - reserved (property, not stored)

**Constraints**: UNIQUE(product_id, location)

**Valid Locations**: brisbane, sydney, melbourne (StoreLocation enum)

---

### stock_adjustments
Audit trail for all stock changes.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique identifier |
| `product_id` | UUID | FK → products (CASCADE DELETE), NOT NULL, INDEXED | Product reference |
| `location` | String(50) | NOT NULL, INDEXED | Store location |
| `quantity_change` | Integer | NOT NULL | Change amount (+ or -) |
| `previous_quantity` | Integer | NOT NULL | Stock before adjustment |
| `new_quantity` | Integer | NOT NULL | Stock after adjustment |
| `adjustment_type` | String(50) | NOT NULL | Type of adjustment |
| `reason` | String(500) | | Adjustment reason |
| `reference_id` | UUID | | Related order/transfer ID |
| `adjusted_by` | UUID | | User who made adjustment |
| `adjusted_at` | DateTime(TZ) | NOT NULL | Adjustment timestamp |
| `created_at` | DateTime(TZ) | NOT NULL | Creation timestamp |

**Adjustment Types**: stock_count, damage, theft, correction, transfer, sale, return, order_fulfillment

---

### stock_reservations
Temporary stock reservations for pending orders.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique identifier |
| `product_id` | UUID | FK → products (CASCADE DELETE), NOT NULL, INDEXED | Product reference |
| `order_id` | UUID | FK → orders (CASCADE DELETE), NOT NULL, INDEXED | Order reference |
| `location` | String(50) | NOT NULL, INDEXED | Store location |
| `quantity` | Integer | NOT NULL | Reserved quantity |
| `status` | String(50) | NOT NULL, DEFAULT 'active' | Reservation status |
| `expires_at` | DateTime(TZ) | | Auto-release timestamp |
| `reserved_at` | DateTime(TZ) | NOT NULL | Reservation timestamp |
| `fulfilled_at` | DateTime(TZ) | | Fulfillment timestamp |
| `cancelled_at` | DateTime(TZ) | | Cancellation timestamp |
| `created_at` | DateTime(TZ) | NOT NULL | Creation timestamp |
| `updated_at` | DateTime(TZ) | NOT NULL | Last update timestamp |

**Valid Statuses**: active, fulfilled, cancelled, expired

---

### stock_transfers
Inter-location inventory transfers.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique identifier |
| `product_id` | UUID | FK → products (CASCADE DELETE), NOT NULL, INDEXED | Product reference |
| `from_location` | String(50) | NOT NULL, INDEXED | Source location |
| `to_location` | String(50) | NOT NULL, INDEXED | Destination location |
| `quantity` | Integer | NOT NULL | Transfer quantity |
| `status` | String(50) | NOT NULL, DEFAULT 'pending' | Transfer status |
| `reason` | String(500) | | Transfer reason |
| `notes` | String(1000) | | Additional notes |
| `initiated_by` | UUID | | User who initiated |
| `completed_by` | UUID | | User who completed |
| `initiated_at` | DateTime(TZ) | NOT NULL | Initiation timestamp |
| `completed_at` | DateTime(TZ) | | Completion timestamp |
| `created_at` | DateTime(TZ) | NOT NULL | Creation timestamp |
| `updated_at` | DateTime(TZ) | NOT NULL | Last update timestamp |

**Valid Statuses**: pending, in_transit, completed, cancelled

---

### suppliers
Vendor/supplier directory.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique identifier |
| `supplier_code` | String(50) | NOT NULL, UNIQUE, INDEXED | Supplier reference code |
| `company_name` | String(255) | NOT NULL, INDEXED | Company name |
| `contact_name` | String(255) | | Primary contact |
| `email` | String(255) | INDEXED | Contact email |
| `phone` | String(50) | | Contact phone |
| `abn` | String(20) | | Australian Business Number |
| `address` | Text | | Street address |
| `city` | String(100) | | City |
| `state` | String(50) | | State |
| `postal_code` | String(20) | | Postal code |
| `country` | String(2) | NOT NULL, DEFAULT 'AU' | Country code |
| `payment_terms` | String(100) | | Payment terms (e.g., Net 30) |
| `preferred_carrier` | String(100) | | Preferred shipping carrier |
| `xero_contact_id` | String(255) | | Xero integration ID |
| `xero_synced_at` | DateTime(TZ) | | Last Xero sync timestamp |
| `is_active` | Boolean | NOT NULL, DEFAULT TRUE, INDEXED | Active status |
| `notes` | Text | | Additional notes |
| `created_at` | DateTime(TZ) | NOT NULL | Creation timestamp |
| `updated_at` | DateTime(TZ) | | Last update timestamp |

**Relationships**: purchase_orders

---

### purchase_orders
Purchase orders to suppliers.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique identifier |
| `po_number` | String(50) | NOT NULL, UNIQUE, INDEXED | PO reference number |
| `supplier_id` | UUID | FK → suppliers, NOT NULL, INDEXED | Supplier reference |
| `delivery_location` | String(50) | NOT NULL, INDEXED | Delivery location |
| `status` | String(50) | NOT NULL, DEFAULT 'draft', INDEXED | PO status |
| `order_date` | DateTime(TZ) | | Order date |
| `expected_delivery_date` | DateTime(TZ) | | Expected delivery |
| `actual_delivery_date` | DateTime(TZ) | | Actual delivery |
| `subtotal` | Numeric(10,2) | NOT NULL, DEFAULT 0 | Subtotal amount |
| `tax` | Numeric(10,2) | NOT NULL, DEFAULT 0 | Tax amount |
| `shipping_cost` | Numeric(10,2) | | Shipping cost |
| `total` | Numeric(10,2) | NOT NULL, DEFAULT 0 | Total amount |
| `notes` | Text | | Additional notes |
| `xero_purchase_order_id` | String(255) | | Xero integration ID |
| `xero_synced_at` | DateTime(TZ) | | Last Xero sync timestamp |
| `created_at` | DateTime(TZ) | NOT NULL | Creation timestamp |
| `updated_at` | DateTime(TZ) | | Last update timestamp |
| `created_by_id` | UUID | FK → users | User who created |

**Valid Statuses**: draft, pending_approval, approved, ordered, in_transit, received, cancelled

**Relationships**: supplier, items (purchase_order_items), inbound_shipments

---

### purchase_order_items
Line items for purchase orders.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique identifier |
| `purchase_order_id` | UUID | FK → purchase_orders (CASCADE DELETE), NOT NULL, INDEXED | Parent PO |
| `product_id` | UUID | FK → products, NOT NULL, INDEXED | Product reference |
| `quantity` | Integer | NOT NULL | Quantity ordered |
| `quantity_received` | Integer | NOT NULL, DEFAULT 0 | Quantity received |
| `unit_cost` | Numeric(10,2) | NOT NULL | Cost per unit |
| `subtotal` | Numeric(10,2) | NOT NULL | Calculated: quantity × unit_cost |
| `created_at` | DateTime(TZ) | NOT NULL | Creation timestamp |
| `updated_at` | DateTime(TZ) | | Last update timestamp |

**Relationships**: purchase_order, product

---

### inbound_shipments
Inbound shipments from suppliers.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique identifier |
| `shipment_number` | String(50) | NOT NULL, UNIQUE, INDEXED | Shipment reference |
| `purchase_order_id` | UUID | FK → purchase_orders, INDEXED | Related PO |
| `supplier_id` | UUID | FK → suppliers, NOT NULL, INDEXED | Supplier reference |
| `carrier_name` | String(100) | | Carrier name |
| `carrier_service` | String(100) | | Service level |
| `tracking_number` | String(100) | INDEXED | Tracking number |
| `origin_address` | Text | | Origin address |
| `destination_location` | String(50) | NOT NULL, INDEXED | Destination location |
| `status` | String(50) | NOT NULL, DEFAULT 'pending', INDEXED | Shipment status |
| `shipped_date` | DateTime(TZ) | | Ship date |
| `expected_delivery_date` | DateTime(TZ) | | Expected delivery |
| `actual_delivery_date` | DateTime(TZ) | | Actual delivery |
| `tracking_events` | JSON | | Tracking history |
| `last_tracking_update` | DateTime(TZ) | | Last tracking update |
| `notes` | Text | | Additional notes |
| `created_at` | DateTime(TZ) | NOT NULL | Creation timestamp |
| `updated_at` | DateTime(TZ) | | Last update timestamp |

**Valid Statuses**: pending, in_transit, out_for_delivery, delivered, exception, cancelled

**Relationships**: purchase_order, supplier

---

### outbound_shipments
Outbound shipments to customers.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique identifier |
| `shipment_number` | String(50) | NOT NULL, UNIQUE, INDEXED | Shipment reference |
| `order_id` | UUID | FK → orders, NOT NULL, INDEXED | Related order |
| `carrier_name` | String(100) | | Carrier name |
| `carrier_service` | String(100) | | Service level |
| `tracking_number` | String(100) | INDEXED | Tracking number |
| `origin_location` | String(50) | NOT NULL, INDEXED | Origin location |
| `destination_address` | Text | | Destination address |
| `status` | String(50) | NOT NULL, DEFAULT 'pending', INDEXED | Shipment status |
| `shipped_date` | DateTime(TZ) | | Ship date |
| `expected_delivery_date` | DateTime(TZ) | | Expected delivery |
| `actual_delivery_date` | DateTime(TZ) | | Actual delivery |
| `tracking_events` | JSON | | Tracking history |
| `last_tracking_update` | DateTime(TZ) | | Last tracking update |
| `notes` | Text | | Additional notes |
| `created_at` | DateTime(TZ) | NOT NULL | Creation timestamp |
| `updated_at` | DateTime(TZ) | | Last update timestamp |

**Valid Statuses**: pending, in_transit, out_for_delivery, delivered, exception, returned

**Relationships**: order

---

## System Tables

### users
User authentication and authorization.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique identifier |
| `organization_id` | UUID | FK → organizations | Organization membership |
| `email` | String(255) | NOT NULL, UNIQUE, INDEXED | Email address |
| `hashed_password` | String(255) | NOT NULL | Bcrypt hashed password |
| `full_name` | String(255) | | Full name |
| `role` | String(50) | NOT NULL, DEFAULT 'employee' | User role |
| `is_admin` | Boolean | NOT NULL, DEFAULT FALSE | Admin flag |
| `is_active` | Boolean | NOT NULL, DEFAULT TRUE, INDEXED | Active status |
| `created_at` | DateTime(TZ) | NOT NULL | Creation timestamp |
| `updated_at` | DateTime(TZ) | NOT NULL | Last update timestamp |
| `last_login_at` | DateTime(TZ) | | Last login timestamp |

**Relationships**: organization

---

## Enums

### OrderStatus
Valid values for orders.status:
- `draft` - Order being prepared
- `pending` - Awaiting approval
- `confirmed` - Approved and ready
- `processing` - Being fulfilled
- `shipped` - Dispatched to customer
- `delivered` - Received by customer
- `cancelled` - Cancelled order

### QuoteStatus
Valid values for quotes.status:
- `draft` - Quote being prepared
- `pending` - Internal review
- `sent` - Sent to customer
- `accepted` - Customer accepted
- `rejected` - Customer rejected
- `expired` - Validity period expired

### ProductCategory
Valid values for products.category:
- `heavy_machinery` - Heavy machinery
- `hand_tools` - Hand tools
- `power_tools` - Power tools
- `safety_equipment` - Safety equipment
- `building_materials` - Building materials
- `electrical` - Electrical supplies
- `plumbing` - Plumbing supplies
- `accessories` - Accessories

### StoreLocation
Valid values for inventory location fields:
- `brisbane` - Brisbane warehouse
- `sydney` - Sydney warehouse
- `melbourne` - Melbourne warehouse

### PurchaseOrderStatus
Valid values for purchase_orders.status:
- `draft` - Being prepared
- `pending_approval` - Awaiting approval
- `approved` - Approved, not sent
- `ordered` - Sent to supplier
- `in_transit` - Shipment in progress
- `received` - Received at warehouse
- `cancelled` - Cancelled order

### ShipmentStatus (Inbound)
Valid values for inbound_shipments.status:
- `pending` - Awaiting pickup
- `in_transit` - In transit
- `out_for_delivery` - Out for delivery
- `delivered` - Delivered
- `exception` - Delivery exception
- `cancelled` - Cancelled shipment

### ShipmentStatus (Outbound)
Valid values for outbound_shipments.status:
- `pending` - Awaiting pickup
- `in_transit` - In transit
- `out_for_delivery` - Out for delivery
- `delivered` - Delivered
- `exception` - Delivery exception
- `returned` - Returned to sender

---

## Relationships

### One-to-Many

```
organizations
├── users (1:N)
├── products (1:N)
├── customers (1:N)
├── orders (1:N)
└── quotes (1:N)

customers
├── orders (1:N)
└── quotes (1:N)

orders
├── order_items (1:N, cascade delete)
├── stock_reservations (1:N, cascade delete)
└── outbound_shipments (1:N)

quotes
└── quote_items (1:N, cascade delete)

products
├── order_items (1:N)
├── quote_items (1:N)
├── product_stock_by_location (1:N, cascade delete)
├── stock_adjustments (1:N, cascade delete)
├── stock_reservations (1:N, cascade delete)
├── stock_transfers (1:N, cascade delete)
└── purchase_order_items (1:N)

suppliers
├── purchase_orders (1:N)
└── inbound_shipments (1:N)

purchase_orders
├── purchase_order_items (1:N, cascade delete)
└── inbound_shipments (1:N)
```

### Many-to-One

```
order_items → order (M:1)
order_items → product (M:1)

quote_items → quote (M:1)
quote_items → product (M:1)

stock_reservations → order (M:1)
stock_reservations → product (M:1)

stock_adjustments → product (M:1)

product_stock_by_location → product (M:1)
```

---

## Cascade Delete Rules

### ⚠️ CASCADE DELETE (Child deleted when parent deleted)

| Parent Table | Child Table | Relationship |
|-------------|-------------|--------------|
| orders | order_items | When order deleted, all line items deleted |
| quotes | quote_items | When quote deleted, all line items deleted |
| products | order_items | When product deleted, order items deleted |
| products | quote_items | When product deleted, quote items deleted |
| products | product_stock_by_location | When product deleted, stock records deleted |
| products | stock_adjustments | When product deleted, adjustment history deleted |
| products | stock_reservations | When product deleted, reservations deleted |
| products | stock_transfers | When product deleted, transfer records deleted |
| products | purchase_order_items | When product deleted, PO items deleted |
| orders | stock_reservations | When order deleted, reservations deleted |
| purchase_orders | purchase_order_items | When PO deleted, line items deleted |

### ✅ NO CASCADE (Child preserved with NULL reference)

| Parent Table | Child Table | Behavior |
|-------------|-------------|----------|
| organizations | users | User preserved, organization_id set to NULL |
| customers | orders | Order preserved with NULL customer_id (rare) |
| customers | quotes | Quote preserved with NULL customer_id (rare) |

---

## Common Query Patterns

### List with Pagination and Search

```python
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

async def list_products(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 50,
    search: str | None = None,
    category: str | None = None,
):
    query = select(Product)

    # Apply filters
    if search:
        query = query.where(
            or_(
                Product.name.ilike(f"%{search}%"),
                Product.sku.ilike(f"%{search}%"),
            )
        )

    if category:
        query = query.where(Product.category == category)

    # Count total
    count_result = await db.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = count_result.scalar() or 0

    # Apply pagination
    query = query.order_by(Product.name).limit(page_size).offset((page - 1) * page_size)

    # Execute
    result = await db.execute(query)
    products = result.scalars().all()

    return {
        "data": products,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }
```

### Fetch with Related Data (Eager Loading)

```python
from sqlalchemy.orm import selectinload, joinedload

# Load order with items and customer
query = (
    select(Order)
    .options(
        selectinload(Order.items),  # Load all order items
        joinedload(Order.customer),  # Load customer (1:1)
    )
    .where(Order.id == order_id)
)
result = await db.execute(query)
order = result.scalar_one_or_none()
```

### Create with Related Records

```python
# Create order with items in transaction
order = Order(
    order_number="ORD-2026-001",
    customer_id=customer_id,
    status="draft",
    total=Decimal("150.00"),
)
db.add(order)
await db.flush()  # Get order.id without committing

# Create order items
for item_data in items:
    item = OrderItem(
        order_id=order.id,
        product_id=item_data["product_id"],
        quantity=item_data["quantity"],
        unit_price=item_data["unit_price"],
        line_total=item_data["quantity"] * item_data["unit_price"],
    )
    db.add(item)

await db.commit()
await db.refresh(order)  # Reload with relationships
```

### Update with Optimistic Locking

```python
# Get existing record
result = await db.execute(select(Product).where(Product.id == product_id))
product = result.scalar_one_or_none()

if not product:
    raise HTTPException(status_code=404, detail="Product not found")

# Update fields
product.name = "Updated Name"
product.price = Decimal("199.99")
# updated_at is automatically set by onupdate

await db.commit()
await db.refresh(product)
```

### Delete with Cascade Verification

```python
# Delete order (will cascade to order_items)
result = await db.execute(select(Order).where(Order.id == order_id))
order = result.scalar_one_or_none()

if not order:
    raise HTTPException(status_code=404, detail="Order not found")

await db.delete(order)  # order_items automatically deleted
await db.commit()
```

### Multi-Location Stock Check

```python
from sqlalchemy import and_

# Check stock at specific location
result = await db.execute(
    select(ProductStockByLocation, Product)
    .join(Product, ProductStockByLocation.product_id == Product.id)
    .where(
        and_(
            ProductStockByLocation.product_id == product_id,
            ProductStockByLocation.location == "brisbane",
        )
    )
)
stock_record, product = result.first()

if not stock_record or stock_record.available < requested_quantity:
    raise HTTPException(
        status_code=400,
        detail=f"Insufficient stock at {location}. Available: {stock_record.available if stock_record else 0}"
    )
```

### Generate Sequential Number

```python
from datetime import datetime

async def generate_order_number(db: AsyncSession) -> str:
    """Generate next order number based on max existing order number."""
    year = datetime.now().year

    # Get the highest order number for this year
    query = select(func.max(Order.order_number)).where(
        Order.order_number.like(f"ORD-{year}-%")
    )
    result = await db.execute(query)
    max_order_number = result.scalar_one_or_none()

    if max_order_number:
        # Extract the number part and increment
        last_number = int(max_order_number.split("-")[-1])
        next_number = last_number + 1
    else:
        # First order of the year
        next_number = 1

    return f"ORD-{year}-{next_number:03d}"
```

---

## Schema Modification Rules

### 🚨 CRITICAL: NEVER Modify Without Approval

1. **DO NOT** add, remove, or rename columns
2. **DO NOT** change table names
3. **DO NOT** modify enum values
4. **DO NOT** change foreign key relationships
5. **DO NOT** alter indexes or constraints
6. **DO NOT** create new Alembic migrations

**Why**: Database schema changes can:
- Break existing API contracts
- Corrupt production data
- Cause frontend display errors
- Require complex migration strategies

**Exception**: Only with explicit user approval, documented migration strategy, and tested rollback plan.

---

## File Locations

- **Core ERP Models**: `apps/backend/src/db/erp_models.py`
- **Inventory Models**: `apps/backend/src/db/inventory_models.py`
- **System Models**: `apps/backend/src/db/models.py`
- **Pydantic Schemas**: `apps/backend/src/db/schemas.py`

---

*Last Updated: January 14, 2026*
*For code patterns and examples, see [PATTERNS.md](PATTERNS.md)*
*For troubleshooting, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md)*
