from datetime import datetime
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.routes.customer_orders import (
    OrderHistoryResponse,
    get_customer_order_history,
)
from src.db.demo_models import Customer, Order, OrderItem, Product


@pytest.fixture
def mock_db():
    """Mock database session."""
    return AsyncMock(spec=AsyncSession)


@pytest.fixture
def mock_current_user():
    """Mock authenticated user."""
    return {"user_id": str(uuid4()), "username": "testuser"}


@pytest.fixture
def sample_customer_id():
    """Sample customer UUID."""
    return uuid4()


@pytest.fixture
def sample_customer(sample_customer_id):
    """Sample customer object."""
    customer = Customer()
    customer.id = sample_customer_id
    customer.name = "Test Customer"
    customer.email = "test@example.com"
    return customer


@pytest.fixture
def sample_product():
    """Sample product object."""
    product = Product()
    product.id = uuid4()
    product.name = "Industrial Pump"
    product.sku = "PUMP-001"
    product.unit_price = 500.00
    return product


@pytest.fixture
def sample_order(sample_customer_id):
    """Sample order object."""
    order = Order()
    order.id = uuid4()
    order.customer_id = sample_customer_id
    order.order_number = "ORD-2024-001"
    order.status = "completed"
    order.order_date = datetime(2024, 1, 15, 10, 30, 0)
    order.total_amount = 1000.00
    return order


@pytest.fixture
def sample_order_item(sample_order, sample_product):
    """Sample order item object."""
    order_item = OrderItem()
    order_item.id = uuid4()
    order_item.order_id = sample_order.id
    order_item.product_id = sample_product.id
    order_item.quantity = 2
    order_item.unit_price = 500.00
    return order_item


@pytest.mark.asyncio
async def test_get_customer_order_history_success(
    mock_db, mock_current_user, sample_customer_id, sample_customer,
    sample_order, sample_order_item, sample_product
):
    """Test successful retrieval of customer order history."""
    # Arrange
    mock_customer_result = MagicMock()
    mock_customer_result.scalar_one_or_none.return_value = sample_customer

    mock_count_result = MagicMock()
    mock_count_result.scalar.return_value = 1

    mock_orders_result = MagicMock()
    mock_orders_result.scalars.return_value.all.return_value = [sample_order]

    mock_items_result = MagicMock()
    mock_items_result.all.return_value = [(sample_order_item, sample_product)]

    mock_db.execute.side_effect = [
        mock_customer_result,
        mock_count_result,
        mock_orders_result,
        mock_items_result
    ]

    # Act
    result = await get_customer_order_history(
        customer_id=sample_customer_id,
        db=mock_db,
        current_user=mock_current_user
    )

    # Assert
    assert isinstance(result, OrderHistoryResponse)
    assert len(result.orders) == 1
    assert result.total_count == 1
    assert result.page == 1
    assert result.page_size == 50
    assert result.total_pages == 1

    order = result.orders[0]
    assert order.id == sample_order.id
    assert order.order_number == sample_order.order_number
    assert order.status == sample_order.status
    assert order.total_amount == sample_order.total_amount
    assert len(order.items) == 1

    item = order.items[0]
    assert item.id == sample_order_item.id
    assert item.quantity == sample_order_item.quantity
    assert item.unit_price == sample_order_item.unit_price
    assert item.total_price == 1000.00
    assert item.product.id == sample_product.id
    assert item.product.name == sample_product.name


@pytest.mark.asyncio
async def test_get_customer_order_history_customer_not_found(
    mock_db, mock_current_user, sample_customer_id
):
    """Test error when customer does not exist."""
    # Arrange
    mock_customer_result = MagicMock()
    mock_customer_result.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = mock_customer_result

    # Act & Assert
    with pytest.raises(HTTPException) as exc_info:
        await get_customer_order_history(
            customer_id=sample_customer_id,
            db=mock_db,
            current_user=mock_current_user
        )

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Customer not found"


@pytest.mark.asyncio
async def test_get_customer_order_history_with_pagination(
    mock_db, mock_current_user, sample_customer_id, sample_customer
):
    """Test pagination parameters are applied correctly."""
    # Arrange
    orders = []
    for i in range(5):
        order = Order()
        order.id = uuid4()
        order.customer_id = sample_customer_id
        order.order_number = f"ORD-2024-{i:03d}"
        order.status = "completed"
        order.order_date = datetime(2024, 1, i + 1, 10, 30, 0)
        order.total_amount = 100.00 * (i + 1)
        orders.append(order)

    mock_customer_result = MagicMock()
    mock_customer_result.scalar_one_or_none.return_value = sample_customer

    mock_count_result = MagicMock()
    mock_count_result.scalar.return_value = len(orders)

    mock_orders_result = MagicMock()
    mock_orders_result.scalars.return_value.all.return_value = orders[:2]

    mock_items_result = MagicMock()
    mock_items_result.all.return_value = []

    mock_db.execute.side_effect = [
        mock_customer_result,
        mock_count_result,
        mock_orders_result,
        mock_items_result,
        mock_items_result
    ]

    # Act
    result = await get_customer_order_history(
        customer_id=sample_customer_id,
        db=mock_db,
        current_user=mock_current_user,
        page=1,
        page_size=2
    )

    # Assert
    assert result.total_count == 5
    assert result.page == 1
    assert result.page_size == 2
    assert result.total_pages == 3
    assert len(result.orders) == 2


@pytest.mark.asyncio
async def test_get_customer_order_history_with_status_filter(
    mock_db, mock_current_user, sample_customer_id, sample_customer, sample_order
):
    """Test filtering by order status."""
    # Arrange
    sample_order.status = "pending"

    mock_customer_result = MagicMock()
    mock_customer_result.scalar_one_or_none.return_value = sample_customer

    mock_count_result = MagicMock()
    mock_count_result.scalar.return_value = 1

    mock_orders_result = MagicMock()
    mock_orders_result.scalars.return_value.all.return_value = [sample_order]

    mock_items_result = MagicMock()
    mock_items_result.all.return_value = []

    mock_db.execute.side_effect = [
        mock_customer_result,
        mock_count_result,
        mock_orders_result,
        mock_items_result
    ]

    # Act
    result = await get_customer_order_history(
        customer_id=sample_customer_id,
        db=mock_db,
        current_user=mock_current_user,
        status="pending"
    )

    # Assert
    assert result.total_count == 1
    assert len(result.orders) == 1
    assert result.orders[0].status == "pending"


@pytest.mark.asyncio
async def test_get_customer_order_history_with_date_filters(
    mock_db, mock_current_user, sample_customer_id, sample_customer, sample_order
):
    """Test filtering by date range."""
    # Arrange
    start_date = datetime(2024, 1, 1)
    end_date = datetime(2024, 1, 31)

    mock_customer_result = MagicMock()
    mock_customer_result.scalar_one_or_none.return_value = sample_customer

    mock_count_result = MagicMock()
    mock_count_result.scalar.return_value = 1

    mock_orders_result = MagicMock()
    mock_orders_result.scalars.return_value.all.return_value = [sample_order]

    mock_items_result = MagicMock()
    mock_items_result.all.return_value = []

    mock_db.execute.side_effect = [
        mock_customer_result,
        mock_count_result,
        mock_orders_result,
        mock_items_result
    ]

    # Act
    result = await get_customer_order_history(
        customer_id=sample_customer_id,
        db=mock_db,
        current_user=mock_current_user,
        start_date=start_date,
        end_date=end_date
    )

    # Assert
    assert result.total_count == 1
    assert len(result.orders) == 1


@pytest.mark.asyncio
async def test_get_customer_order_history_empty_results(
    mock_db, mock_current_user, sample_customer_id, sample_customer
):
    """Test handling of empty order results."""
    # Arrange
    mock_customer_result = MagicMock()
    mock_customer_result.scalar_one_or_none.return_value = sample_customer

    mock_count_result = MagicMock()
    mock_count_result.scalar.return_value = 0

    mock_orders_result = MagicMock()
    mock_orders_result.scalars.return_value.all.return_value = []

    mock_db.execute.side_effect = [
        mock_customer_result,
        mock_count_result,
        mock_orders_result
    ]

    # Act
    result = await get_customer_order_history(
        customer_id=sample_customer_id,
        db=mock_db,
        current_user=mock_current_user
    )

    # Assert
    assert result.total_count == 0
    assert len(result.orders) == 0
    assert result.page == 1
    assert result.page_size == 50
    assert result.total_pages == 0


@pytest.mark.asyncio
async def test_get_customer_order_history_database_error(
    mock_db, mock_current_user, sample_customer_id
):
    """Test handling of database errors."""
    # Arrange
    mock_db.execute.side_effect = Exception("Database connection error")

    # Act & Assert
    with pytest.raises(HTTPException) as exc_info:
        await get_customer_order_history(
            customer_id=sample_customer_id,
            db=mock_db,
            current_user=mock_current_user
        )

    assert exc_info.value.status_code == 500
    assert "Internal server error" in exc_info.value.detail


@pytest.mark.asyncio
async def test_get_customer_order_history_multiple_items_per_order(
    mock_db, mock_current_user, sample_customer_id, sample_customer, sample_order
):
    """Test order with multiple items."""
    # Arrange
    product1 = Product()
    product1.id = uuid4()
    product1.name = "Product 1"
    product1.sku = "PROD-001"
    product1.unit_price = 100.00

    product2 = Product()
    product2.id = uuid4()
    product2.name = "Product 2"
    product2.sku = "PROD-002"
    product2.unit_price = 200.00

    item1 = OrderItem()
    item1.id = uuid4()
    item1.order_id = sample_order.id
    item1.product_id = product1.id
    item1.quantity = 2
    item1.unit_price = 100.00

    item2 = OrderItem()
    item2.id = uuid4()
    item2.order_id = sample_order.id
    item2.product_id = product2.id
    item2.quantity = 1
    item2.unit_price = 200.00

    mock_customer_result = MagicMock()
    mock_customer_result.scalar_one_or_none.return_value = sample_customer

    mock_count_result = MagicMock()
    mock_count_result.scalar.return_value = 1

    mock_orders_result = MagicMock()
    mock_orders_result.scalars.return_value.all.return_value = [sample_order]

    mock_items_result = MagicMock()
    mock_items_result.all.return_value = [(item1, product1), (item2, product2)]

    mock_db.execute.side_effect = [
        mock_customer_result,
        mock_count_result,
        mock_orders_result,
        mock_items_result
    ]

    # Act
    result = await get_customer_order_history(
        customer_id=sample_customer_id,
        db=mock_db,
        current_user=mock_current_user
    )

    # Assert
    assert len(result.orders) == 1
    order = result.orders[0]
    assert len(order.items) == 2

    assert order.items[0].total_price == 200.00  # 2 * 100.00
    assert order.items[1].total_price == 200.00  # 1 * 200.00


@pytest.mark.asyncio
async def test_get_customer_order_history_pagination_edge_cases(
    mock_db, mock_current_user, sample_customer_id, sample_customer
):
    """Test pagination edge cases and total pages calculation."""
    # Arrange - 7 total orders, page size 3
    mock_customer_result = MagicMock()
    mock_customer_result.scalar_one_or_none.return_value = sample_customer

    mock_count_result = MagicMock()
    mock_count_result.scalar.return_value = 7

    mock_orders_result = MagicMock()
    mock_orders_result.scalars.return_value.all.return_value = []

    mock_db.execute.side_effect = [
        mock_customer_result,
        mock_count_result,
        mock_orders_result
    ]

    # Act
    result = await get_customer_order_history(
        customer_id=sample_customer_id,
        db=mock_db,
        current_user=mock_current_user,
        page_size=3
    )

    # Assert - 7 orders / 3 per page = 3 pages (ceiling division)
    assert result.total_count == 7
    assert result.page_size == 3
    assert result.total_pages == 3
