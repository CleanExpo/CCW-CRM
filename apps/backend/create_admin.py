"""Quick script to create admin@demo.com user for E2E testing."""
import asyncio
import uuid

from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

# Import models
from src.auth.models import User

# Database URL
DATABASE_URL = "postgresql+asyncpg://starter_user:local_dev_password@localhost:5433/starter_db"

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def create_admin_user():
    """Create admin@demo.com user if it doesn't exist."""
    # Create async engine
    engine = create_async_engine(DATABASE_URL, echo=True)
    async_session_maker = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with async_session_maker() as session:
        # Check if admin user exists
        result = await session.execute(
            select(User).where(User.email == "admin@demo.com")
        )
        existing_user = result.scalar_one_or_none()

        if existing_user:
            print("✅ Admin user already exists")
            return

        # Create admin user
        hashed_password = pwd_context.hash("demo123")
        admin_user = User(
            id=uuid.uuid4(),
            email="admin@demo.com",
            hashed_password=hashed_password,
            full_name="Admin User",
            is_active=True,
            is_admin=True,
        )

        session.add(admin_user)
        await session.commit()
        print("✅ Admin user created: admin@demo.com / demo123")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(create_admin_user())
