"""Monitor database index usage and performance."""
import asyncio
import sys
from pathlib import Path
from typing import List, Dict, Any

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from src.config.database import AsyncSessionLocal


async def check_index_usage() -> List[Dict[str, Any]]:
    """Check which indexes are being used and how frequently."""
    async with AsyncSessionLocal() as session:
        query = text("""
            SELECT
                schemaname,
                relname as tablename,
                indexrelname as indexname,
                idx_scan as scans,
                idx_tup_read as tuples_read,
                idx_tup_fetch as tuples_fetched,
                pg_size_pretty(pg_relation_size(indexrelid)) as size
            FROM pg_stat_user_indexes
            WHERE schemaname = 'public'
            AND indexrelname LIKE 'idx_%'
            ORDER BY idx_scan DESC, relname, indexrelname;
        """)
        result = await session.execute(query)
        return [dict(row._mapping) for row in result.fetchall()]


async def check_table_stats() -> List[Dict[str, Any]]:
    """Check table statistics and sizes."""
    async with AsyncSessionLocal() as session:
        query = text("""
            SELECT
                schemaname,
                relname as tablename,
                n_tup_ins as inserts,
                n_tup_upd as updates,
                n_tup_del as deletes,
                n_live_tup as live_rows,
                n_dead_tup as dead_rows,
                pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname)) as total_size
            FROM pg_stat_user_tables
            WHERE schemaname = 'public'
            AND relname IN ('customers', 'products', 'orders', 'quotes', 'order_items', 'quote_items')
            ORDER BY n_live_tup DESC;
        """)
        result = await session.execute(query)
        return [dict(row._mapping) for row in result.fetchall()]


async def check_unused_indexes() -> List[Dict[str, Any]]:
    """Find indexes that are never used (candidates for removal)."""
    async with AsyncSessionLocal() as session:
        query = text("""
            SELECT
                schemaname,
                relname as tablename,
                indexrelname as indexname,
                pg_size_pretty(pg_relation_size(indexrelid)) as wasted_size
            FROM pg_stat_user_indexes
            WHERE schemaname = 'public'
            AND idx_scan = 0
            AND indexrelname LIKE 'idx_%'
            ORDER BY pg_relation_size(indexrelid) DESC;
        """)
        result = await session.execute(query)
        return [dict(row._mapping) for row in result.fetchall()]


async def check_missing_indexes() -> List[Dict[str, Any]]:
    """Find tables with sequential scans that might benefit from indexes."""
    async with AsyncSessionLocal() as session:
        query = text("""
            SELECT
                schemaname,
                relname as tablename,
                seq_scan as sequential_scans,
                seq_tup_read as tuples_read,
                idx_scan as index_scans,
                n_live_tup as live_rows,
                CASE
                    WHEN seq_scan > 0
                    THEN round(100.0 * idx_scan / (seq_scan + idx_scan), 2)
                    ELSE 0
                END as index_usage_pct
            FROM pg_stat_user_tables
            WHERE schemaname = 'public'
            AND n_live_tup > 100  -- Only tables with data
            AND seq_scan > idx_scan  -- More seq scans than index scans
            ORDER BY seq_scan DESC;
        """)
        result = await session.execute(query)
        return [dict(row._mapping) for row in result.fetchall()]


async def main():
    """Run all monitoring checks and display results."""
    print("\n" + "="*80)
    print(" DATABASE INDEX MONITORING")
    print("="*80 + "\n")

    # Index usage
    print("INDEX USAGE STATISTICS")
    print("-" * 80)
    index_usage = await check_index_usage()
    if index_usage:
        print(f"{'Table':<20} {'Index':<40} {'Scans':<10} {'Size':<10}")
        print("-" * 80)
        for row in index_usage:
            print(f"{row['tablename']:<20} {row['indexname']:<40} {row['scans']:<10} {row['size']:<10}")
    else:
        print("No custom indexes found.")
    print()

    # Table statistics
    print("\nTABLE STATISTICS")
    print("-" * 80)
    table_stats = await check_table_stats()
    if table_stats:
        print(f"{'Table':<20} {'Live Rows':<12} {'Dead Rows':<12} {'Total Size':<12}")
        print("-" * 80)
        for row in table_stats:
            print(f"{row['tablename']:<20} {row['live_rows']:<12} {row['dead_rows']:<12} {row['total_size']:<12}")
    else:
        print("No tables found.")
    print()

    # Unused indexes
    print("\nUNUSED INDEXES (Never scanned)")
    print("-" * 80)
    unused = await check_unused_indexes()
    if unused:
        print(f"{'Table':<20} {'Index':<40} {'Wasted Size':<12}")
        print("-" * 80)
        for row in unused:
            print(f"{row['tablename']:<20} {row['indexname']:<40} {row['wasted_size']:<12}")
        print(f"\nWARNING: {len(unused)} unused indexes found. Consider removing if they remain unused.")
    else:
        print("All indexes are being used.")
    print()

    # Missing indexes
    print("\nTABLES WITH HIGH SEQUENTIAL SCANS")
    print("-" * 80)
    missing = await check_missing_indexes()
    if missing:
        print(f"{'Table':<20} {'Seq Scans':<12} {'Index Scans':<12} {'Live Rows':<12} {'Index %':<10}")
        print("-" * 80)
        for row in missing:
            print(f"{row['tablename']:<20} {row['sequential_scans']:<12} {row['index_scans']:<12} {row['live_rows']:<12} {row['index_usage_pct']:<10}")
        print(f"\nNOTE: {len(missing)} tables may benefit from additional indexes.")
    else:
        print("All tables are using indexes effectively.")
    print()

    print("="*80 + "\n")


if __name__ == "__main__":
    asyncio.run(main())
