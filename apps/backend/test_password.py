"""Debug password verification."""
import asyncio
import bcrypt
from sqlalchemy import select
from src.config.database import AsyncSessionLocal
from src.db.models import User


async def test_password():
    """Test if password 'demo123' matches the stored hash."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(User).where(User.email == "admin@demo.com")
        )
        user = result.scalar_one_or_none()

        if not user:
            print("ERROR: User admin@demo.com not found!")
            return

        print(f"\nUser found: {user.email}")
        print(f"Full name: {user.full_name}")
        print(f"Is active: {user.is_active}")
        print(f"Password hash: {user.password_hash[:60]}...")

        # Test password verification
        test_password = "demo123"
        password_bytes = test_password.encode('utf-8')
        hash_bytes = user.password_hash.encode('utf-8')

        is_valid = bcrypt.checkpw(password_bytes, hash_bytes)
        print(f"\nPassword 'demo123' verification: {'VALID' if is_valid else 'INVALID'}")

        if not is_valid:
            print("\nTrying to hash 'demo123' and compare:")
            new_hash = bcrypt.hashpw(password_bytes, bcrypt.gensalt())
            print(f"New hash would be: {new_hash.decode('utf-8')[:60]}...")
        else:
            print("\nPassword verification successful! The test should work.")


if __name__ == "__main__":
    asyncio.run(test_password())
