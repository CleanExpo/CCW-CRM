#!/usr/bin/env python
"""Test database connection to verify credentials work."""

import asyncio
import asyncpg

async def test_connection():
    """Test database connection with asyncpg."""
    print("Testing asyncpg connection...")
    print("="*50)

    # Test with hardcoded credentials matching .env
    configs = [
        {
            "name": "localhost:5434 with password",
            "user": "starter_user",
            "password": "local_dev_password",
            "host": "localhost",
            "port": 5434,
            "database": "starter_db"
        },
        {
            "name": "127.0.0.1:5434 with password",
            "user": "starter_user",
            "password": "local_dev_password",
            "host": "127.0.0.1",
            "port": 5434,
            "database": "starter_db"
        },
        {
            "name": "::1:5434 (IPv6) with password",
            "user": "starter_user",
            "password": "local_dev_password",
            "host": "::1",
            "port": 5434,
            "database": "starter_db"
        }
    ]

    for config in configs:
        print(f"\nTrying: {config['name']}")
        print(f"  User: {config['user']}")
        print(f"  Host: {config['host']}")
        print(f"  Port: {config['port']}")
        print(f"  Database: {config['database']}")

        try:
            conn = await asyncpg.connect(
                user=config["user"],
                password=config["password"],
                host=config["host"],
                port=config["port"],
                database=config["database"],
                timeout=5
            )

            # Run a simple query
            result = await conn.fetchval('SELECT current_database()')
            print(f"  [SUCCESS] Connected to database: {result}")

            await conn.close()
        except Exception as e:
            print(f"  [FAILED] {type(e).__name__}: {str(e)[:100]}")

if __name__ == "__main__":
    asyncio.run(test_connection())
