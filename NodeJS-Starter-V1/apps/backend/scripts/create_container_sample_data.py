"""Create sample data for container tracking and backorder system.

Run this script after running the migration:
    cd apps/backend
    uv run alembic upgrade head
    uv run python scripts/create_container_sample_data.py
"""

import asyncio
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import get_settings
from src.db.container_models import (
    Backorder,
    BackorderStatus,
    Container,
    ContainerItem,
    ContainerStatus,
)
# Import all model files first to ensure relationships are resolved
from src.db import models  # Base models # noqa: F401
from src.db import erp_models  # ERP models # noqa: F401
from src.db import inventory_models  # Inventory models # noqa: F401
from src.db import container_models  # Container models # noqa: F401

# Now import specific models we need
from src.db.erp_models import Customer, Order, Product
from src.db.inventory_models import PurchaseOrder, Supplier
from src.db.models import User
from src.config.database import async_engine, AsyncSessionLocal

settings = get_settings()


async def get_or_create_supplier(db: AsyncSession) -> Supplier:
    """Get existing supplier or create a test supplier."""
    result = await db.execute(select(Supplier).limit(1))
    supplier = result.scalar_one_or_none()

    if supplier:
        print(f" Using existing supplier: {supplier.company_name}")
        return supplier

    # Create test supplier
    supplier = Supplier(
        id=uuid4(),
        supplier_code="SUP-TEST-001",
        company_name="Global Equipment Supplies Ltd",
        contact_name="John Smith",
        email="john@globalequip.com",
        phone="+86 21 1234 5678",
        address="123 Manufacturing Road",
        city="Shanghai",
        state="Shanghai",
        postal_code="200000",
        country="CN",
        payment_terms="Net 60",
        preferred_carrier="Maersk",
        is_active=True,
    )
    db.add(supplier)
    await db.flush()
    print(f" Created test supplier: {supplier.company_name}")
    return supplier


async def get_or_create_products(db: AsyncSession, count: int = 5) -> list[Product]:
    """Get existing products or create test products."""
    result = await db.execute(select(Product).limit(count))
    products = list(result.scalars().all())

    if len(products) >= count:
        print(f" Using {len(products)} existing products")
        return products[:count]

    # Need to create more products
    needed = count - len(products)
    print(f" Creating {needed} additional test products...")

    test_products = [
        ("EXCAVATOR-320", "CAT 320 Excavator", 125000.00),
        ("LOADER-950", "Wheel Loader 950H", 95000.00),
        ("DOZER-D6T", "Bulldozer D6T", 155000.00),
        ("GRADER-140M", "Motor Grader 140M", 185000.00),
        ("COMPACTOR-CS56", "Soil Compactor CS56", 45000.00),
    ]

    for sku, name, cost in test_products[:needed]:
        product = Product(
            id=uuid4(),
            sku=sku,
            name=name,
            description=f"Heavy-duty {name.lower()} for construction and mining operations",
            category="HEAVY_MACHINERY",
            cost=Decimal(str(cost)),
            price=Decimal(str(cost * 1.3)),  # 30% markup
            stock_quantity=0,  # Will be updated when container arrives
            reorder_point=1,
            reorder_quantity=2,
            is_active=True,
        )
        db.add(product)
        products.append(product)

    await db.flush()
    print(f" Total products available: {len(products)}")
    return products


async def get_or_create_purchase_order(
    db: AsyncSession, supplier: Supplier
) -> PurchaseOrder:
    """Get existing PO or create a test purchase order."""
    result = await db.execute(
        select(PurchaseOrder).where(PurchaseOrder.supplier_id == supplier.id).limit(1)
    )
    po = result.scalar_one_or_none()

    if po:
        print(f" Using existing purchase order: {po.po_number}")
        return po

    # Create test PO
    po = PurchaseOrder(
        id=uuid4(),
        po_number=f"PO-2026-001",
        supplier_id=supplier.id,
        delivery_location="brisbane",
        status="approved",
        order_date=datetime.now(UTC) - timedelta(days=30),
        expected_delivery_date=datetime.now(UTC) + timedelta(days=14),
        subtotal=Decimal("550000.00"),
        tax=Decimal("55000.00"),
        shipping_cost=Decimal("15000.00"),
        total=Decimal("620000.00"),
        notes="Large equipment order for Brisbane warehouse expansion",
    )
    db.add(po)
    await db.flush()
    print(f" Created test purchase order: {po.po_number}")
    return po


async def get_customers_and_orders(db: AsyncSession) -> list[tuple[Customer, Order]]:
    """Get existing customers and orders."""
    result = await db.execute(
        select(Customer, Order).join(Order, Order.customer_id == Customer.id).limit(3)
    )
    pairs = [(customer, order) for customer, order in result.all()]

    if pairs:
        print(f" Found {len(pairs)} customer-order pairs for backorders")
    else:
        print(" No existing orders found - backorders will be created without customers")

    return pairs


async def create_arriving_soon_container(
    db: AsyncSession,
    supplier: Supplier,
    po: PurchaseOrder,
    products: list[Product],
) -> Container:
    """Create a container arriving in 7 days."""
    eta = datetime.now(UTC) + timedelta(days=7)

    container = Container(
        id=uuid4(),
        container_number="MAEU1234567",
        purchase_order_id=po.id,
        supplier_id=supplier.id,
        vessel_name="MSC Diana",
        voyage_number="V2026-01A",
        origin_port="Shanghai, China",
        destination_port="Port of Brisbane",
        destination_warehouse="brisbane",
        booking_date=datetime.now(UTC) - timedelta(days=25),
        departure_date=datetime.now(UTC) - timedelta(days=21),
        estimated_arrival_date=eta,
        status=ContainerStatus.IN_TRANSIT,
        tracking_number="TRACK-MAEU-001",
        carrier="Maersk Line",
        tracking_url="https://www.maersk.com/tracking/MAEU1234567",
        shipping_cost=Decimal("12000.00"),
        customs_duty=Decimal("8500.00"),
        other_charges=Decimal("1500.00"),
        notes="Priority shipment - heavy equipment for new project",
        tracking_events={
            "events": [
                {
                    "timestamp": "2026-01-08T10:30:00Z",
                    "status": "departed",
                    "location": "Shanghai, China",
                    "description": "Container departed origin port",
                },
                {
                    "timestamp": "2026-01-12T15:45:00Z",
                    "status": "in_transit",
                    "location": "Pacific Ocean",
                    "description": "Container in transit",
                },
            ]
        },
    )
    db.add(container)
    await db.flush()

    # Add items to container
    items_data = [
        (products[0], 2, Decimal("125000.00"), 1),  # 1 unit pre-allocated
        (products[1], 2, Decimal("95000.00"), 0),
        (products[2], 1, Decimal("155000.00"), 1),  # 1 unit pre-allocated
    ]

    for product, qty, cost, preallocated in items_data:
        item = ContainerItem(
            id=uuid4(),
            container_id=container.id,
            product_id=product.id,
            quantity_ordered=qty,
            quantity_preallocated=preallocated,
            unit_cost=cost,
        )
        db.add(item)

    print(
        f" Created container {container.container_number} - arriving in 7 days with {len(items_data)} products"
    )
    return container


async def create_at_port_container(
    db: AsyncSession,
    supplier: Supplier,
    po: PurchaseOrder,
    products: list[Product],
) -> Container:
    """Create a container currently at port."""
    eta = datetime.now(UTC) - timedelta(days=2)

    container = Container(
        id=uuid4(),
        container_number="COSCO9876543",
        purchase_order_id=po.id,
        supplier_id=supplier.id,
        vessel_name="COSCO Shipping Universe",
        voyage_number="V2026-02B",
        origin_port="Ningbo, China",
        destination_port="Port of Sydney",
        destination_warehouse="sydney",
        booking_date=datetime.now(UTC) - timedelta(days=35),
        departure_date=datetime.now(UTC) - timedelta(days=28),
        estimated_arrival_date=eta,
        actual_arrival_date=datetime.now(UTC) - timedelta(days=1),
        status=ContainerStatus.AT_PORT,
        tracking_number="TRACK-COSCO-002",
        carrier="COSCO Shipping",
        tracking_url="https://elines.coscoshipping.com/ebtracking/COSCO9876543",
        shipping_cost=Decimal("10500.00"),
        customs_duty=Decimal("6200.00"),
        other_charges=Decimal("800.00"),
        notes="Awaiting customs clearance - documents submitted",
        tracking_events={
            "events": [
                {
                    "timestamp": "2025-12-17T08:00:00Z",
                    "status": "departed",
                    "location": "Ningbo, China",
                    "description": "Container departed origin port",
                },
                {
                    "timestamp": "2026-01-13T06:30:00Z",
                    "status": "arrived",
                    "location": "Port of Sydney",
                    "description": "Container arrived at destination port",
                },
            ]
        },
    )
    db.add(container)
    await db.flush()

    # Add items to container
    items_data = [
        (products[3], 1, Decimal("185000.00"), 0),
        (products[4], 3, Decimal("45000.00"), 2),  # 2 units pre-allocated
    ]

    for product, qty, cost, preallocated in items_data:
        item = ContainerItem(
            id=uuid4(),
            container_id=container.id,
            product_id=product.id,
            quantity_ordered=qty,
            quantity_preallocated=preallocated,
            unit_cost=cost,
        )
        db.add(item)

    print(
        f" Created container {container.container_number} - at port (Sydney) with {len(items_data)} products"
    )
    return container


async def create_overdue_container(
    db: AsyncSession,
    supplier: Supplier,
    po: PurchaseOrder,
    products: list[Product],
) -> Container:
    """Create an overdue container."""
    eta = datetime.now(UTC) - timedelta(days=5)  # 5 days overdue

    container = Container(
        id=uuid4(),
        container_number="EVERGREEN5678901",
        purchase_order_id=po.id,
        supplier_id=supplier.id,
        vessel_name="Ever Given",
        voyage_number="V2025-12C",
        origin_port="Shenzhen, China",
        destination_port="Port of Melbourne",
        destination_warehouse="melbourne",
        booking_date=datetime.now(UTC) - timedelta(days=40),
        departure_date=datetime.now(UTC) - timedelta(days=35),
        estimated_arrival_date=eta,
        status=ContainerStatus.IN_TRANSIT,
        tracking_number="TRACK-EVER-003",
        carrier="Evergreen Marine",
        tracking_url="https://www.shipmentlink.com/servlet/TDB1_CargoTracking.do",
        shipping_cost=Decimal("11000.00"),
        customs_duty=Decimal("7000.00"),
        other_charges=Decimal("1200.00"),
        notes="OVERDUE - Delayed due to weather conditions",
        internal_notes="Customer has been notified of delay. New ETA: 3 days",
        tracking_events={
            "events": [
                {
                    "timestamp": "2025-12-10T14:00:00Z",
                    "status": "departed",
                    "location": "Shenzhen, China",
                    "description": "Container departed origin port",
                },
                {
                    "timestamp": "2025-12-28T10:00:00Z",
                    "status": "delayed",
                    "location": "Pacific Ocean",
                    "description": "Vessel delayed due to severe weather",
                },
                {
                    "timestamp": "2026-01-10T16:00:00Z",
                    "status": "in_transit",
                    "location": "Approaching Australian waters",
                    "description": "Vessel resumed journey, approaching destination",
                },
            ]
        },
    )
    db.add(container)
    await db.flush()

    # Add items to container
    items_data = [
        (products[0], 1, Decimal("125000.00"), 1),  # Pre-allocated to backorder
        (products[1], 2, Decimal("95000.00"), 1),  # Partially pre-allocated
    ]

    for product, qty, cost, preallocated in items_data:
        item = ContainerItem(
            id=uuid4(),
            container_id=container.id,
            product_id=product.id,
            quantity_ordered=qty,
            quantity_preallocated=preallocated,
            unit_cost=cost,
        )
        db.add(item)

    print(
        f" Created container {container.container_number} - OVERDUE (5 days) with {len(items_data)} products"
    )
    return container


async def create_backorders(
    db: AsyncSession,
    containers: list[Container],
    products: list[Product],
    customer_order_pairs: list[tuple[Customer, Order]],
) -> list[Backorder]:
    """Create sample backorders linked to containers."""
    backorders = []

    # If we have real customers and orders, use them
    if customer_order_pairs:
        # Backorder 1: Pending (not yet allocated)
        customer1, order1 = customer_order_pairs[0]
        backorder1 = Backorder(
            id=uuid4(),
            order_id=order1.id,
            product_id=products[0].id,
            customer_id=customer1.id,
            quantity_backordered=1,
            fulfillment_location="brisbane",
            original_order_date=datetime.now(UTC) - timedelta(days=10),
            status=BackorderStatus.PENDING,
            priority=3,
            notes="Customer requesting expedited delivery when available",
        )
        db.add(backorder1)
        backorders.append(backorder1)
        print(
            f" Created pending backorder for {customer1.name} - {products[0].name}"
        )

        if len(customer_order_pairs) >= 2:
            # Backorder 2: Allocated to arriving container
            customer2, order2 = customer_order_pairs[1]
            backorder2 = Backorder(
                id=uuid4(),
                order_id=order2.id,
                product_id=products[2].id,
                customer_id=customer2.id,
                quantity_backordered=1,
                fulfillment_location="brisbane",
                container_id=containers[0].id,  # Arriving in 7 days
                expected_availability_date=containers[0].estimated_arrival_date,
                original_order_date=datetime.now(UTC) - timedelta(days=15),
                status=BackorderStatus.ALLOCATED,
                customer_notified=True,
                last_notification_date=datetime.now(UTC) - timedelta(days=2),
                notification_count=1,
                priority=5,
                notes="Customer notified of ETA - equipment critical for project",
            )
            db.add(backorder2)
            backorders.append(backorder2)
            print(
                f" Created allocated backorder for {customer2.name} - {products[2].name}"
            )

        if len(customer_order_pairs) >= 3:
            # Backorder 3: Overdue (linked to delayed container)
            customer3, order3 = customer_order_pairs[2]
            backorder3 = Backorder(
                id=uuid4(),
                order_id=order3.id,
                product_id=products[0].id,
                customer_id=customer3.id,
                quantity_backordered=1,
                fulfillment_location="melbourne",
                container_id=containers[2].id,  # Overdue container
                expected_availability_date=containers[
                    2
                ].estimated_arrival_date,  # Past date
                original_order_date=datetime.now(UTC) - timedelta(days=20),
                status=BackorderStatus.ALLOCATED,
                customer_notified=True,
                last_notification_date=datetime.now(UTC) - timedelta(days=1),
                notification_count=3,
                priority=8,
                notes="URGENT - Customer called multiple times. Provide daily updates.",
                internal_notes="Consider air freight alternative if container delayed further",
            )
            db.add(backorder3)
            backorders.append(backorder3)
            print(
                f" Created OVERDUE backorder for {customer3.name} - {products[0].name}"
            )
    else:
        # Create backorders without customer links (for testing)
        # Get first order if exists
        result = await db.execute(select(Order).limit(1))
        order = result.scalar_one_or_none()

        if order:
            backorder = Backorder(
                id=uuid4(),
                order_id=order.id,
                product_id=products[0].id,
                quantity_backordered=1,
                fulfillment_location="brisbane",
                container_id=containers[0].id,
                expected_availability_date=containers[0].estimated_arrival_date,
                original_order_date=datetime.now(UTC) - timedelta(days=12),
                status=BackorderStatus.ALLOCATED,
                priority=5,
                notes="Test backorder - no customer email available",
            )
            db.add(backorder)
            backorders.append(backorder)
            print(f" Created test backorder (no customer) - {products[0].name}")

    return backorders


async def main():
    """Create sample data for container tracking and backorders."""
    print("\n" + "=" * 70)
    print("  Container Tracking & Backorder Sample Data Generator")
    print("=" * 70 + "\n")

    async with AsyncSessionLocal() as db:
        try:
            # Get or create required entities
            print("[Step 1] Setting up suppliers and products...")
            supplier = await get_or_create_supplier(db)
            products = await get_or_create_products(db, count=5)
            po = await get_or_create_purchase_order(db, supplier)
            customer_order_pairs = await get_customers_and_orders(db)

            print(
                "\n Step 2: Creating containers with different statuses...\n"
            )
            containers = []

            # Container 1: Arriving soon (7 days)
            container1 = await create_arriving_soon_container(db, supplier, po, products)
            containers.append(container1)

            # Container 2: At port (customs clearance)
            container2 = await create_at_port_container(db, supplier, po, products)
            containers.append(container2)

            # Container 3: Overdue
            container3 = await create_overdue_container(db, supplier, po, products)
            containers.append(container3)

            print("\n Step 3: Creating backorders...\n")
            backorders = await create_backorders(
                db, containers, products, customer_order_pairs
            )

            # Commit all changes
            await db.commit()

            print("\n" + "=" * 70)
            print("   Sample Data Created Successfully!")
            print("=" * 70)
            print(f"\n Summary:")
            print(f"    Containers: {len(containers)}")
            print(f"     - Arriving soon: 1 (in 7 days)")
            print(f"     - At port: 1 (Sydney)")
            print(f"     - Overdue: 1 (5 days late)")
            print(f"    Container items: {sum(len(c.items) for c in containers)}")
            print(f"    Backorders: {len(backorders)}")
            print(f"    Products: {len(products)}")
            print(f"\n Next Steps:")
            print(f"   1. Start the backend: cd apps/backend && uv run uvicorn src.api.main:app --reload")
            print(f"   2. Start the frontend: cd apps/web && pnpm dev")
            print(f"   3. Navigate to: http://localhost:3000/containers")
            print(f"   4. Navigate to: http://localhost:3000/backorders")
            print(f"\n")

        except Exception as e:
            await db.rollback()
            print(f"\n Error creating sample data: {e}")
            raise


if __name__ == "__main__":
    asyncio.run(main())
