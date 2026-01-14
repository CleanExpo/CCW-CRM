"""Clear mock and test products from database."""
import asyncio
from sqlalchemy import delete, select, or_
from src.db.erp_models import Product, OrderItem, QuoteItem
from src.config.database import get_async_db


async def clear_mock_products():
    """Delete mock products (TEST-SKU, CCW, EQ prefixes)."""
    async for db in get_async_db():
        try:
            # First, get IDs of mock products
            mock_product_ids_result = await db.execute(
                select(Product.id).where(
                    or_(
                        Product.sku.like("TEST-SKU-%"),
                        Product.sku.like("CCW-%"),
                        Product.sku.like("EQ-%")
                    )
                )
            )
            mock_product_ids = [row[0] for row in mock_product_ids_result.fetchall()]

            if not mock_product_ids:
                print("No mock products found to delete")
                return

            print(f"Found {len(mock_product_ids)} mock products to delete")

            # Delete order_items first (foreign key constraint)
            result1 = await db.execute(
                delete(OrderItem).where(OrderItem.product_id.in_(mock_product_ids))
            )
            print(f"Deleted {result1.rowcount} order items")

            # Delete quote_items
            result2 = await db.execute(
                delete(QuoteItem).where(QuoteItem.product_id.in_(mock_product_ids))
            )
            print(f"Deleted {result2.rowcount} quote items")

            # Delete mock products
            result3 = await db.execute(
                delete(Product).where(
                    or_(
                        Product.sku.like("TEST-SKU-%"),
                        Product.sku.like("CCW-%"),
                        Product.sku.like("EQ-%")
                    )
                )
            )
            print(f"Deleted {result3.rowcount} mock products")

            await db.commit()
            print("\nSuccess! All mock/test products cleared")

        finally:
            await db.close()
        break


if __name__ == "__main__":
    asyncio.run(clear_mock_products())
