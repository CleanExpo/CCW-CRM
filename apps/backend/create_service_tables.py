"""Create service_requests table in the database."""

import asyncio

from sqlalchemy.ext.asyncio import create_async_engine

from src.config.database import get_database_url
from src.db.models import Base
from src.db.service_models import ServiceRequest


async def create_tables():
    """Create service-related tables."""
    database_url = get_database_url(async_mode=True)
    print(f"[INFO] Connecting to database: {database_url}")

    engine = create_async_engine(database_url, echo=True)

    print("[INFO] Creating service_requests table...")
    async with engine.begin() as conn:
        await conn.run_sync(
            lambda sync_conn: Base.metadata.create_all(
                sync_conn,
                tables=[ServiceRequest.__table__],
                checkfirst=True,
            )
        )

    print("[OK] Service tables created successfully!")
    await engine.dispose()


if __name__ == "__main__":
    print("=" * 70)
    print("Service Tables Initialization")
    print("=" * 70)
    asyncio.run(create_tables())
    print("[OK] Initialization complete!")
