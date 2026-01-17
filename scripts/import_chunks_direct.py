#!/usr/bin/env python3
"""
Import data chunks to Supabase using direct PostgreSQL connection.
"""

import psycopg2
import sys
from pathlib import Path
import time

# Supabase connection details
DB_HOST = "db.vwfgksqkajnpfjospbpe.supabase.co"
DB_PORT = "5432"
DB_NAME = "postgres"
DB_USER = "postgres"
DB_PASSWORD = "lIEI5gV4OkSV5WV3"

def connect_to_db():
    """Connect to Supabase PostgreSQL database."""
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            connect_timeout=30
        )
        print("[OK] Connected to Supabase database")
        return conn
    except Exception as e:
        print(f"[ERROR] Connection failed: {e}")
        return None

def execute_sql_file(conn, file_path, chunk_name):
    """Execute SQL from a file."""
    try:
        print(f"\n[INFO] Reading {chunk_name}...")
        with open(file_path, 'r', encoding='utf-8') as f:
            sql = f.read()

        print(f"[INFO] Executing {chunk_name} ({len(sql)} characters)...")
        cursor = conn.cursor()

        # Execute with progress indicator
        start_time = time.time()
        cursor.execute(sql)
        conn.commit()
        elapsed = time.time() - start_time

        cursor.close()

        print(f"[OK] Successfully executed {chunk_name} in {elapsed:.1f} seconds")
        return True
    except Exception as e:
        print(f"[ERROR] Error executing {chunk_name}: {e}")
        conn.rollback()
        return False

def verify_data(conn):
    """Verify that data was imported."""
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT
                'organizations' as table_name, COUNT(*) as row_count FROM organizations
            UNION ALL SELECT 'users', COUNT(*) FROM users
            UNION ALL SELECT 'products', COUNT(*) FROM products
            UNION ALL SELECT 'customers', COUNT(*) FROM customers
            UNION ALL SELECT 'orders', COUNT(*) FROM orders
            UNION ALL SELECT 'order_items', COUNT(*) FROM order_items
            UNION ALL SELECT 'quotes', COUNT(*) FROM quotes
            UNION ALL SELECT 'quote_items', COUNT(*) FROM quote_items
            UNION ALL SELECT 'payments', COUNT(*) FROM payments
            UNION ALL SELECT 'invoices', COUNT(*) FROM invoices
            ORDER BY table_name;
        """)
        results = cursor.fetchall()
        cursor.close()

        print(f"\n[OK] Data Verification Results:")
        print(f"{'Table Name':<20} {'Row Count':<10}")
        print("-" * 30)
        total_rows = 0
        for table_name, row_count in results:
            print(f"{table_name:<20} {row_count:<10}")
            total_rows += row_count

        print("-" * 30)
        print(f"{'TOTAL':<20} {total_rows:<10}")

        return total_rows > 0
    except Exception as e:
        print(f"[ERROR] Error verifying data: {e}")
        return False

def main():
    """Main import process."""
    base_path = Path(__file__).parent.parent / "backup"
    chunks = ["aa", "ab", "ac", "ad", "ae"]

    print("=" * 60)
    print("Supabase Data Import - Chunk by Chunk")
    print("=" * 60)
    print(f"Backup path: {base_path}")
    print(f"Chunks to import: {len(chunks)}")
    print()

    # Check all chunk files exist
    missing_files = []
    for chunk in chunks:
        chunk_file = base_path / f"data_chunk_{chunk}"
        if not chunk_file.exists():
            missing_files.append(str(chunk_file))

    if missing_files:
        print(f"[ERROR] Missing chunk files:")
        for f in missing_files:
            print(f"  - {f}")
        return 1

    # Connect to database
    print("Connecting to Supabase...")
    conn = connect_to_db()
    if not conn:
        print("\n[ERROR] Failed to connect to database.")
        print("This might be due to:")
        print("  - Network/DNS issues")
        print("  - Incorrect credentials")
        print("  - Firewall blocking connection")
        return 1

    try:
        # Import each chunk
        for i, chunk in enumerate(chunks, 1):
            chunk_file = base_path / f"data_chunk_{chunk}"
            chunk_name = f"Chunk {i}/5 (data_chunk_{chunk})"

            print(f"\n{'=' * 60}")
            print(f"Importing {chunk_name}")
            print(f"{'=' * 60}")

            if not execute_sql_file(conn, chunk_file, chunk_name):
                print(f"\n[ERROR] Failed to import {chunk_name}")
                print("Stopping import process.")
                return 1

            # Brief pause between chunks
            if i < len(chunks):
                print(f"[INFO] Pausing 2 seconds before next chunk...")
                time.sleep(2)

        # Verify data was imported
        print(f"\n{'=' * 60}")
        print("Verifying Data Import")
        print(f"{'=' * 60}")

        if not verify_data(conn):
            print("\n[WARNING] Verification found issues - check the results above")
            return 1

        print("\n" + "=" * 60)
        print("[SUCCESS] All chunks imported successfully!")
        print("=" * 60)
        print(f"\nView your data at:")
        print(f"https://supabase.com/dashboard/project/vwfgksqkajnpfjospbpe/editor")

        return 0

    finally:
        conn.close()
        print("\nDatabase connection closed")

if __name__ == "__main__":
    sys.exit(main())
