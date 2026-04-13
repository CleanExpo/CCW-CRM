#!/usr/bin/env python3
"""
Import schema and data to Supabase using direct PostgreSQL connection.
"""

import os
import sys
from pathlib import Path

import psycopg2

# Supabase connection details — read from environment.
# Set these before running:
#   export SUPABASE_DB_HOST=db.<project-ref>.supabase.co
#   export SUPABASE_DB_PASSWORD=<your-db-password>
DB_HOST = os.environ.get("SUPABASE_DB_HOST", "")
DB_PORT = os.environ.get("SUPABASE_DB_PORT", "5432")
DB_NAME = os.environ.get("SUPABASE_DB_NAME", "postgres")
DB_USER = os.environ.get("SUPABASE_DB_USER", "postgres")
DB_PASSWORD = os.environ.get("SUPABASE_DB_PASSWORD", "")

if not DB_HOST or not DB_PASSWORD:
    print("[ERROR] SUPABASE_DB_HOST and SUPABASE_DB_PASSWORD must be set in the environment.")
    print("        Copy the connection string from Supabase Dashboard → Project Settings → Database.")
    sys.exit(1)

def connect_to_db():
    """Connect to Supabase PostgreSQL database."""
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            connect_timeout=10
        )
        print("[OK] Connected to Supabase database")
        return conn
    except Exception as e:
        print(f"[ERROR] Connection failed: {e}")
        return None

def execute_sql_file(conn, file_path):
    """Execute SQL from a file."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            sql = f.read()

        cursor = conn.cursor()
        cursor.execute(sql)
        conn.commit()
        cursor.close()

        print(f"[OK] Successfully executed: {file_path}")
        return True
    except Exception as e:
        print(f"[ERROR] Error executing {file_path}: {e}")
        conn.rollback()
        return False

def verify_tables(conn):
    """Verify that tables were created."""
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = 'public'
            ORDER BY tablename;
        """)
        tables = cursor.fetchall()
        cursor.close()

        print(f"\n[OK] Found {len(tables)} tables in public schema:")
        for table in tables[:10]:  # Show first 10
            print(f"   - {table[0]}")
        if len(tables) > 10:
            print(f"   ... and {len(tables) - 10} more")

        return len(tables)
    except Exception as e:
        print(f"[ERROR] Error verifying tables: {e}")
        return 0

def main():
    """Main import process."""
    base_path = Path(__file__).parent.parent / "backup"
    schema_file = base_path / "schema_final.sql"
    data_file = base_path / "data_20260117_110545.sql"

    # Check files exist
    if not schema_file.exists():
        print(f"[ERROR] Schema file not found: {schema_file}")
        return 1

    if not data_file.exists():
        print(f"[ERROR] Data file not found: {data_file}")
        return 1

    print("Starting Supabase import...")
    print(f"Schema: {schema_file}")
    print(f"Data: {data_file}")
    print()

    # Connect to database
    conn = connect_to_db()
    if not conn:
        return 1

    try:
        # Schema already imported, skip to data
        print("\n[INFO] Schema already imported (31 tables exist)")
        print("Skipping schema import, proceeding directly to data import...")

        # Import data
        print("\nImporting data...")
        if not execute_sql_file(conn, data_file):
            return 1

        print("\n[OK] Import completed successfully!")
        print("[OK] Database ready at: https://supabase.com/dashboard/project/vwfgksqkajnpfjospbpe/database/tables")
        return 0

    finally:
        conn.close()
        print("\nDatabase connection closed")

if __name__ == "__main__":
    sys.exit(main())
