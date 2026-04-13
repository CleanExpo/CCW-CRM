"""Verify supplier and shipment tracking tables exist."""
import asyncio

from sqlalchemy import text

from src.config.database import async_engine


async def verify_tables():
    """Check if new tables were created."""
    table_names = [
        'suppliers',
        'purchase_orders',
        'purchase_order_items',
        'inbound_shipments',
        'outbound_shipments',
        'carrier_configurations'
    ]

    async with async_engine.begin() as conn:
        result = await conn.execute(
            text("""
                SELECT tablename
                FROM pg_tables
                WHERE schemaname='public'
                AND tablename = ANY(:tables)
                ORDER BY tablename
            """),
            {"tables": table_names}
        )

        found_tables = [row[0] for row in result]

        print("[SUCCESS] Tables created successfully:")
        for table in found_tables:
            print(f"   - {table}")

        missing = set(table_names) - set(found_tables)
        if missing:
            print("\n[ERROR] Missing tables:")
            for table in missing:
                print(f"   - {table}")
            return False

        # Check orders table has new columns
        result = await conn.execute(
            text("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'orders'
                AND column_name IN ('fulfillment_location', 'tracking_number', 'carrier_name', 'shipped_date', 'estimated_delivery_date')
                ORDER BY column_name
            """)
        )

        order_columns = [row[0] for row in result]
        print("\n[SUCCESS] Orders table tracking columns added:")
        for col in order_columns:
            print(f"   - {col}")

        return True


if __name__ == "__main__":
    asyncio.run(verify_tables())
