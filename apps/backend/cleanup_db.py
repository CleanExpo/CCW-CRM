"""Clean up existing database tables before running migrations."""
import os

import asyncpg
from dotenv import load_dotenv

load_dotenv()

async def cleanup_database():
    """Drop all existing tables and types from the database."""
    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        raise ValueError("DATABASE_URL not found in environment")

    conn = await asyncpg.connect(database_url)

    try:
        print("Checking existing tables...")

        # Get all tables in the public schema
        tables = await conn.fetch("""
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = 'public'
        """)

        print(f"Found {len(tables)} tables:")
        for table in tables:
            print(f"  - {table['tablename']}")

        if tables:
            print("\nDropping tables...")
            for table in tables:
                table_name = table['tablename']
                print(f"  Dropping {table_name}...")
                await conn.execute(f'DROP TABLE IF EXISTS "{table_name}" CASCADE')

        # Get all custom types
        print("\nChecking existing types...")
        types = await conn.fetch("""
            SELECT typname
            FROM pg_type
            WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
            AND typtype = 'e'
        """)

        print(f"Found {len(types)} custom types:")
        for type_row in types:
            print(f"  - {type_row['typname']}")

        if types:
            print("\nDropping custom types...")
            for type_row in types:
                type_name = type_row['typname']
                print(f"  Dropping {type_name}...")
                await conn.execute(f'DROP TYPE IF EXISTS "{type_name}" CASCADE')

        print("\n✓ Database cleaned successfully!")

    finally:
        await conn.close()

if __name__ == "__main__":
    import asyncio
    asyncio.run(cleanup_database())
