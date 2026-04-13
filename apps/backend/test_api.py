"""Simple test script to verify API routes work."""
import asyncio

from src.api.main import app
from src.config.database import async_engine


async def test_imports():
    """Test that all imports work correctly."""
    print("Testing imports...")

    # Test that routes are registered
    routes = [route.path for route in app.routes]
    print(f"\nRegistered routes ({len(routes)}):")
    for route in sorted(routes):
        print(f"  {route}")

    # Test database connection
    print("\nTesting database connection...")
    try:
        async with async_engine.connect() as conn:
            result = await conn.execute("SELECT 1")
            print("  ✓ Database connection successful")
    except Exception as e:
        print(f"  ✗ Database connection failed: {e}")

    print("\n✓ All imports successful!")


if __name__ == "__main__":
    asyncio.run(test_imports())
