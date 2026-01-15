"""Verify performance indexes were created."""

from sqlalchemy import create_engine, text
from src.config.settings import get_settings

settings = get_settings()
engine = create_engine(settings.database_url.replace('+asyncpg', ''))

query = text("""
    SELECT
        tablename,
        indexname,
        indexdef
    FROM pg_indexes
    WHERE tablename IN ('products', 'customers', 'orders', 'quotes', 'order_items', 'quote_items')
    AND indexname LIKE 'idx_%'
    ORDER BY tablename, indexname
""")

print("\n" + "=" * 80)
print("DATABASE PERFORMANCE INDEXES")
print("=" * 80)

with engine.connect() as conn:
    result = conn.execute(query)

    current_table = None
    for row in result:
        table, index_name, index_def = row

        if table != current_table:
            print(f"\nTable: {table}")
            current_table = table

        # Extract index type from definition
        if 'gin' in index_def.lower():
            idx_type = "(GIN trigram)"
        elif 'DESC' in index_def:
            idx_type = "(composite with sort)"
        else:
            idx_type = "(composite)"

        print(f"  {index_name} {idx_type}")

print("\n" + "=" * 80)
print("Verification complete!")
print("=" * 80 + "\n")
