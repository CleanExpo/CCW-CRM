"""Create multi-store inventory tables.

This script creates the necessary tables for multi-store inventory management.
"""

import asyncio

from sqlalchemy.ext.asyncio import create_async_engine

from src.config.database import get_database_url
from src.db.inventory_models import (
    ProductStockByLocation,
    StockAdjustment,
    StockReservation,
    StockTransfer,
)
from src.db.models import Base


async def create_tables():
    """Create inventory tables in the database."""
    database_url = get_database_url(async_mode=True)
    engine = create_async_engine(database_url, echo=True)

    print("Creating multi-store inventory tables...")

    async with engine.begin() as conn:
        # Create only inventory tables (not all tables)
        await conn.run_sync(
            lambda sync_conn: Base.metadata.create_all(
                sync_conn,
                tables=[
                    ProductStockByLocation.__table__,
                    StockTransfer.__table__,
                    StockReservation.__table__,
                    StockAdjustment.__table__,
                ],
                checkfirst=True,
            )
        )

    await engine.dispose()

    print("\n✅ Multi-store inventory tables created successfully!")
    print("Tables created:")
    print("  - product_stock_by_location")
    print("  - stock_transfers")
    print("  - stock_reservations")
    print("  - stock_adjustments")


if __name__ == "__main__":
    print("=" * 60)
    print("Multi-Store Inventory Table Creation")
    print("=" * 60)
    asyncio.run(create_tables())
