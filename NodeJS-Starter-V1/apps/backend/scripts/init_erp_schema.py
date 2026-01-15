"""
Initialize ERP database schema by creating all tables.

This script creates all tables defined in the ORM models.
"""
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

# Import all models to register them with Base.metadata
from src.db.models import Base
from src.db.demo_models import *
from src.db.inventory_models import *
from src.db.container_models import *
from src.db.ai_models import *
from src.db.email_models import *
from src.db.service_models import *
from src.db.shopify_models import *
from src.db.xero_models import *
from src.db.portal_forms_models import *
from src.db.submission_notes_models import *
from src.db.prd_models import *
from src.db.erp_models import *

def init_schema():
    """Create all tables in the database."""
    # Get DATABASE_URL from environment, convert asyncpg to psycopg2
    database_url = os.getenv("DATABASE_URL", "")
    if not database_url:
        print("ERROR: DATABASE_URL environment variable not set")
        return False

    # Convert async driver to sync driver for schema creation
    sync_url = database_url.replace("postgresql+asyncpg://", "postgresql+psycopg2://")

    print(f"Connecting to database...")
    print(f"URL: {sync_url.split('@')[0]}@****")  # Hide password in logs

    try:
        # Create engine
        engine = create_engine(sync_url, echo=True)

        # Test connection
        with engine.connect() as conn:
            result = conn.execute(text("SELECT current_database(), current_user"))
            db, user = result.fetchone()
            print(f"\nConnected to database: {db} as user: {user}")

        print("\n" + "="*80)
        print("Creating all tables...")
        print("="*80 + "\n")

        # Create all tables
        Base.metadata.create_all(engine)

        print("\n" + "="*80)
        print("✅ Schema initialization complete!")
        print("="*80 + "\n")

        # List created tables
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                ORDER BY table_name
            """))
            tables = [row[0] for row in result.fetchall()]
            print(f"\nTotal tables created: {len(tables)}")
            print("\nTables:")
            for table in tables:
                print(f"  ✅ {table}")

        return True

    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = init_schema()
    exit(0 if success else 1)
