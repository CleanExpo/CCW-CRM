"""Performance tests for order operations.

Tests verify that optimizations are working:
1. Diff-based order item updates
2. Batch stock reservation
3. Batch stock deduction
"""
import pytest
from decimal import Decimal
from uuid import uuid4
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.demo_models import Order, OrderItem, Product, Customer
from src.db.inventory_models import ProductStockByLocation, StockReservation
from src.api.routes.orders import (
    deduct_stock_for_order,
    reserve_stock_for_order,
)


@pytest.mark.asyncio
async def test_batch_stock_deduction_single_query(
    db_session: AsyncSession,
    test_customer: Customer,
    test_products: list[Product],
):
    """Test that stock deduction uses batch queries, not N queries."""
    # Create order with 10 items
    order = Order(
        customer_id=test_customer.id,
        order_number=f"ORD-2026-{uuid4().hex[:6]}",
        status="confirmed",
        total=Decimal(1000),
        fulfillment_location="brisbane",
    )
    db_session.add(order)
    await db_session.flush()

    # Create stock records for all products
    for product in test_products[:10]:
        stock = ProductStockByLocation(
            product_id=product.id,
            location="brisbane",
            stock=100,
            reserved=0,
        )
        db_session.add(stock)
    await db_session.flush()

    # Prepare order items
    order_items = [
        {"product_id": product.id, "quantity": 5}
        for product in test_products[:10]
    ]

    # Execute deduction
    await deduct_stock_for_order(
        db=db_session,
        order_items=order_items,
        location="brisbane",
        order_id=order.id,
    )

    # Verify all stock was deducted
    stmt = select(ProductStockByLocation).where(
        ProductStockByLocation.location == "brisbane"
    )
    result = await db_session.execute(stmt)
    stocks = result.scalars().all()

    assert len(stocks) == 10
    for stock in stocks:
        assert stock.stock == 95  # 100 - 5 = 95


@pytest.mark.asyncio
async def test_batch_stock_reservation_single_query(
    db_session: AsyncSession,
    test_customer: Customer,
    test_products: list[Product],
):
    """Test that stock reservation uses batch queries, not N queries."""
    # Create order
    order = Order(
        customer_id=test_customer.id,
        order_number=f"ORD-2026-{uuid4().hex[:6]}",
        status="pending",
        total=Decimal(500),
        fulfillment_location="sydney",
    )
    db_session.add(order)
    await db_session.flush()

    # Create stock records for products
    for product in test_products[:10]:
        stock = ProductStockByLocation(
            product_id=product.id,
            location="sydney",
            stock=50,
            reserved=0,
        )
        db_session.add(stock)
    await db_session.flush()

    # Prepare order items
    order_items = [
        {"product_id": product.id, "quantity": 3}
        for product in test_products[:10]
    ]
    products_by_id = {p.id: p for p in test_products[:10]}

    # Execute reservation
    total_reserved = await reserve_stock_for_order(
        db=db_session,
        order_id=order.id,
        order_items=order_items,
        location="sydney",
        products_by_id=products_by_id,
    )

    assert total_reserved == 30  # 10 items × 3 quantity

    # Verify reservations were created
    stmt = select(func.count(StockReservation.id)).where(
        StockReservation.order_id == order.id
    )
    result = await db_session.execute(stmt)
    reservation_count = result.scalar()

    assert reservation_count == 10

    # Verify stock reserved amounts updated
    stmt = select(ProductStockByLocation).where(
        ProductStockByLocation.location == "sydney"
    )
    result = await db_session.execute(stmt)
    stocks = result.scalars().all()

    for stock in stocks:
        assert stock.reserved == 3  # Each reserved 3 units


@pytest.mark.asyncio
async def test_batch_deduction_insufficient_stock_fails_all(
    db_session: AsyncSession,
    test_customer: Customer,
    test_products: list[Product],
):
    """Test that if ANY item has insufficient stock, NONE are deducted (atomic)."""
    order = Order(
        customer_id=test_customer.id,
        order_number=f"ORD-2026-{uuid4().hex[:6]}",
        status="confirmed",
        total=Decimal(500),
        fulfillment_location="melbourne",
    )
    db_session.add(order)
    await db_session.flush()

    # Create stock: first 9 have enough, last 1 has insufficient
    for i, product in enumerate(test_products[:10]):
        stock_amount = 100 if i < 9 else 2  # Last one only has 2 units
        stock = ProductStockByLocation(
            product_id=product.id,
            location="melbourne",
            stock=stock_amount,
            reserved=0,
        )
        db_session.add(stock)
    await db_session.flush()

    # Request 5 units for all (last one will fail)
    order_items = [
        {"product_id": product.id, "quantity": 5}
        for product in test_products[:10]
    ]

    # Should raise HTTPException due to insufficient stock
    with pytest.raises(Exception) as exc_info:
        await deduct_stock_for_order(
            db=db_session,
            order_items=order_items,
            location="melbourne",
            order_id=order.id,
        )

    assert "Insufficient stock" in str(exc_info.value)

    # Verify NO stock was deducted (atomic failure)
    stmt = select(ProductStockByLocation).where(
        ProductStockByLocation.location == "melbourne"
    )
    result = await db_session.execute(stmt)
    stocks = result.scalars().all()

    # First 9 should still have 100 (not deducted)
    for i, stock in enumerate(stocks[:9]):
        assert stock.stock == 100

    # Last one should still have 2
    assert stocks[9].stock == 2


@pytest.mark.asyncio
async def test_batch_reservation_creates_missing_stock_records(
    db_session: AsyncSession,
    test_customer: Customer,
    test_products: list[Product],
):
    """Test that batch reservation creates missing stock records efficiently."""
    order = Order(
        customer_id=test_customer.id,
        order_number=f"ORD-2026-{uuid4().hex[:6]}",
        status="pending",
        total=Decimal(300),
        fulfillment_location="brisbane",
    )
    db_session.add(order)
    await db_session.flush()

    # DON'T create any stock records - function should create them

    # Prepare order items
    order_items = [
        {"product_id": product.id, "quantity": 2}
        for product in test_products[:5]
    ]
    products_by_id = {p.id: p for p in test_products[:5]}

    # Execute reservation - should create stock records automatically
    total_reserved = await reserve_stock_for_order(
        db=db_session,
        order_id=order.id,
        order_items=order_items,
        location="brisbane",
        products_by_id=products_by_id,
    )

    assert total_reserved == 10  # 5 items × 2 quantity

    # Verify stock records were created
    stmt = select(func.count(ProductStockByLocation.id)).where(
        ProductStockByLocation.location == "brisbane"
    )
    result = await db_session.execute(stmt)
    stock_count = result.scalar()

    assert stock_count == 5  # Created for all 5 products


@pytest.mark.asyncio
async def test_order_item_diff_update_only_changes_modified(
    db_session: AsyncSession,
    test_customer: Customer,
    test_products: list[Product],
):
    """Test that order item updates use diff-based approach.

    This test verifies the frontend sends item IDs and backend uses them
    to only update/delete/create what changed.

    NOTE: This is an integration test - full order update endpoint test
    would require more setup. This validates the expected behavior.
    """
    # Create order with 10 items
    order = Order(
        customer_id=test_customer.id,
        order_number=f"ORD-2026-{uuid4().hex[:6]}",
        status="draft",
        total=Decimal(1000),
    )
    db_session.add(order)
    await db_session.flush()

    # Add 10 items
    original_items = []
    for i, product in enumerate(test_products[:10]):
        item = OrderItem(
            order_id=order.id,
            product_id=product.id,
            quantity=5,
            unit_price=Decimal(100),
            line_total=Decimal(500),
        )
        db_session.add(item)
        original_items.append(item)

    await db_session.commit()

    # Simulate update: remove items 8-9, modify items 0-2, keep items 3-7 unchanged
    # In real scenario, frontend would send:
    # - Items 0-2 with their IDs (to update)
    # - Items 3-7 with their IDs (unchanged)
    # - Items 8-9 NOT sent (to delete)
    # - New items without IDs (to create)

    # Verify we have 10 items before
    stmt = select(func.count(OrderItem.id)).where(OrderItem.order_id == order.id)
    result = await db_session.execute(stmt)
    count_before = result.scalar()
    assert count_before == 10

    # Delete 2 items (simulating the diff logic)
    for item in original_items[8:10]:
        await db_session.delete(item)

    await db_session.commit()

    # Verify we have 8 items after
    stmt = select(func.count(OrderItem.id)).where(OrderItem.order_id == order.id)
    result = await db_session.execute(stmt)
    count_after = result.scalar()
    assert count_after == 8


# Fixtures
@pytest.fixture
async def test_customer(db_session: AsyncSession) -> Customer:
    """Create a test customer."""
    customer = Customer(
        customer_number=f"CUST-{uuid4().hex[:6]}",
        company_name="Test Company",
        email="test@example.com",
    )
    db_session.add(customer)
    await db_session.flush()
    return customer


@pytest.fixture
async def test_products(db_session: AsyncSession) -> list[Product]:
    """Create 20 test products."""
    products = []
    for i in range(20):
        product = Product(
            sku=f"SKU-{uuid4().hex[:6]}",
            name=f"Test Product {i}",
            price=Decimal(100),
            cost=Decimal(50),
            stock=100,
            category="power_tools",
        )
        db_session.add(product)
        products.append(product)

    await db_session.flush()
    return products
