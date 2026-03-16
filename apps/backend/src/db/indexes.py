"""
Composite database indexes for query performance optimization.

These indexes are defined separately from demo_models.py (locked file) and
imported in main.py to register them with SQLAlchemy metadata.

Alembic will pick them up automatically when generating migrations.
"""
from sqlalchemy import Index

from src.db.demo_models import Order, OrderItem, Product

# Composite index: order_items(order_id, product_id)
# Critical for line item queries joining orders to their products
ix_order_items_order_product = Index(
    "ix_order_items_order_product",
    OrderItem.order_id,
    OrderItem.product_id,
)

# Composite index: orders(customer_id, status)
# Speeds up customer order history filtering (e.g. all PENDING orders for a customer)
ix_orders_customer_status = Index(
    "ix_orders_customer_status",
    Order.customer_id,
    Order.status,
)

# Composite index: products(category, is_active)
# Speeds up category browse queries that filter active products only
ix_products_category_active = Index(
    "ix_products_category_active",
    Product.category,
    Product.is_active,
)
