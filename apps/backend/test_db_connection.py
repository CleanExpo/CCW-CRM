"""Test database connection and list tables."""
from src.config.database import sync_engine
from sqlalchemy import text

try:
    conn = sync_engine.connect()
    result = conn.execute(text("SELECT tablename FROM pg_tables WHERE schemaname='public'"))
    tables = [row[0] for row in result]
    print(f"✓ Database connected successfully!")
    print(f"✓ Found {len(tables)} tables: {', '.join(tables) if tables else '(none)'}")

    if tables:
        # Check if ERP tables exist
        erp_tables = ['organizations', 'users', 'products', 'customers', 'orders', 'quotes']
        found_erp = [t for t in erp_tables if t in tables]
        print(f"✓ ERP tables found: {', '.join(found_erp) if found_erp else '(none)'}")

    conn.close()
except Exception as e:
    print(f"✗ Database connection failed: {e}")
    exit(1)
