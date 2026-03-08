#!/usr/bin/env python
"""Test asyncpg connection to verify database credentials."""

import asyncio
import asyncpg
import os
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent / "apps" / "backend"))

from dotenv import load_dotenv

# Load environment variables from the correct location
env_path = Path(__file__).parent / "apps" / "backend" / ".env"
print(f"Loading .env from: {env_path}")
print(f".env exists: {env_path.exists()}")
load_dotenv(env_path)

async def test_connection():
    """Test database connection with asyncpg."""
    database_url = os.getenv("DATABASE_URL", "")
    print(f"Testing connection to: {database_url}")

    # Parse the URL to get connection parameters
    # Format: postgresql+asyncpg://starter_user:local_dev_password@localhost:5434/starter_db
    url = database_url.replace("postgresql+asyncpg://", "")

    try:
        # Split into user:password@host:port/database
        auth_and_location = url.split("@")
        user_pass = auth_and_location[0].split(":")
        host_port_db = auth_and_location[1].split("/")
        host_port = host_port_db[0].split(":")

        user = user_pass[0]
        password = user_pass[1]
        host = host_port[0]
        port = int(host_port[1])
        database = host_port_db[1]

        print(f"Connecting with:")
        print(f"  User: {user}")
        print(f"  Host: {host}")
        print(f"  Port: {port}")
        print(f"  Database: {database}")
        print(f"  Password: {'*' * len(password)}")

        # Try to connect
        conn = await asyncpg.connect(
            user=user,
            password=password,
            host=host,
            port=port,
            database=database
        )

        # Run a simple query
        result = await conn.fetchval('SELECT 1')
        print(f"[SUCCESS] Connection successful! Query result: {result}")

        await conn.close()
        return True

    except Exception as e:
        print(f"[ERROR] Connection failed: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(test_connection())
    exit(0 if success else 1)
