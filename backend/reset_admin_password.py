"""Reset admin password to demo123 (matches seed script hash)."""
import asyncio
from sqlalchemy import select, update
from src.config.database import AsyncSessionLocal
from src.db.models import User


async def reset_admin_password():
    """Reset admin@demo.com password to the hash from seed script."""
    # This is the CORRECT pre-hashed password for "demo123"
    # Generated with: bcrypt.hashpw(b"demo123", bcrypt.gensalt(rounds=12))
    correct_hash = "$2b$12$t3c9inySNVTxAI7j56GTze4IO7GMKfaQu.sZ/VdvOytqjFMScBgwe"

    async with AsyncSessionLocal() as session:
        # Update admin user password
        await session.execute(
            update(User)
            .where(User.email == "admin@demo.com")
            .values(password_hash=correct_hash)
        )
        await session.commit()

        # Verify the update
        result = await session.execute(
            select(User).where(User.email == "admin@demo.com")
        )
        user = result.scalar_one()

        print(f"\nReset admin@demo.com password")
        print(f"Email: {user.email}")
        print(f"Password: demo123")
        print(f"Hash: {user.password_hash[:60]}...")
        print("\nPassword has been reset. Tests should now work.")


if __name__ == "__main__":
    asyncio.run(reset_admin_password())
