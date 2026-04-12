"""Minimal diagnostic handler for Vercel debugging."""

import sys
import traceback

from fastapi import FastAPI

app = FastAPI()

# Capture all import errors
errors = []

def try_import(module_name):
    try:
        __import__(module_name)
        return f"OK: {module_name}"
    except Exception as e:
        return f"FAIL: {module_name} - {type(e).__name__}: {e}"


@app.get("/")
async def root():
    return {"status": "ok", "python": sys.version, "message": "Diagnostic handler works"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.get("/debug/imports")
async def debug_imports():
    """Test all critical imports."""
    results = []

    # Test core packages
    for pkg in [
        "fastapi", "uvicorn", "sqlalchemy", "asyncpg", "psycopg2",
        "jose", "passlib", "pydantic", "pydantic_settings",
        "redis", "httpx", "structlog", "slowapi", "stripe",
        "sendgrid", "apscheduler", "anthropic", "sse_starlette",
        "sentry_sdk", "prometheus_client", "yaml", "dotenv",
    ]:
        results.append(try_import(pkg))

    return {"imports": results, "python": sys.version, "path": sys.path[:5]}


@app.get("/debug/app")
async def debug_app():
    """Try to import the real app."""
    try:
        from src.api.main import app as real_app
        return {"status": "ok", "routes": len(real_app.routes)}
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "type": type(e).__name__,
            "traceback": traceback.format_exc()[-2000:],
        }


@app.post("/debug/create-tables")
async def create_tables():
    """Create demo tables using raw SQL matching exact SQLAlchemy models."""
    import os
    import asyncpg

    db_url = os.environ.get("DATABASE_URL", "")
    raw_url = db_url.replace("postgresql+asyncpg://", "postgresql://")

    try:
        conn = await asyncpg.connect(raw_url, timeout=30, statement_cache_size=0)

        # Drop existing demo tables (in dependency order) to recreate cleanly
        await conn.execute("DROP TABLE IF EXISTS quote_items CASCADE;")
        await conn.execute("DROP TABLE IF EXISTS order_items CASCADE;")
        await conn.execute("DROP TABLE IF EXISTS order_activity CASCADE;")
        await conn.execute("DROP TABLE IF EXISTS quotes CASCADE;")
        await conn.execute("DROP TABLE IF EXISTS orders CASCADE;")
        await conn.execute("DROP TABLE IF EXISTS customers CASCADE;")
        await conn.execute("DROP TABLE IF EXISTS products CASCADE;")
        await conn.execute("DROP TABLE IF EXISTS users CASCADE;")

        # Create users table (matching models_base.py User model)
        await conn.execute("""
            CREATE TABLE users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                email VARCHAR(255) UNIQUE NOT NULL,
                hashed_password VARCHAR(255) NOT NULL,
                full_name VARCHAR(255),
                is_active BOOLEAN DEFAULT true NOT NULL,
                is_admin BOOLEAN DEFAULT false NOT NULL,
                created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
                updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
            );
        """)

        # Create products table (matching demo_models.py Product)
        await conn.execute("""
            CREATE TABLE products (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                organization_id UUID,
                sku VARCHAR(50) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                category VARCHAR(50) NOT NULL,
                price NUMERIC(10,2) NOT NULL DEFAULT 0,
                cost NUMERIC(10,2) NOT NULL DEFAULT 0,
                stock INTEGER NOT NULL DEFAULT 0,
                warehouse_location VARCHAR(100),
                embedding BYTEA,
                is_active BOOLEAN DEFAULT true NOT NULL,
                created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
                updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
            );
        """)

        # Create customers table (matching demo_models.py Customer - uses postcode not postal_code)
        await conn.execute("""
            CREATE TABLE customers (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                organization_id UUID,
                customer_number VARCHAR(50) UNIQUE NOT NULL,
                company_name VARCHAR(255) NOT NULL,
                contact_name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                phone VARCHAR(20),
                address TEXT,
                city VARCHAR(100),
                state VARCHAR(50),
                postcode VARCHAR(10),
                xero_contact_id VARCHAR(255),
                xero_synced_at TIMESTAMPTZ,
                is_active BOOLEAN DEFAULT true NOT NULL,
                created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
                updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
            );
        """)

        # Create orders table (matching demo_models.py Order - includes xero and fulfillment fields)
        await conn.execute("""
            CREATE TABLE orders (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                organization_id UUID,
                order_number VARCHAR(50) UNIQUE NOT NULL,
                customer_id UUID REFERENCES customers(id),
                status VARCHAR(20) DEFAULT 'draft' NOT NULL,
                total NUMERIC(10,2) NOT NULL DEFAULT 0,
                notes TEXT,
                xero_invoice_id VARCHAR(255),
                xero_synced_at TIMESTAMPTZ,
                xero_sync_status VARCHAR(50),
                order_date TIMESTAMPTZ DEFAULT now() NOT NULL,
                created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
                updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
                fulfillment_location VARCHAR(50),
                tracking_number VARCHAR(100),
                carrier_name VARCHAR(100),
                shipped_date TIMESTAMPTZ,
                estimated_delivery_date TIMESTAMPTZ
            );
        """)

        # Create order_items table (uses line_total not subtotal)
        await conn.execute("""
            CREATE TABLE order_items (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
                product_id UUID REFERENCES products(id) NOT NULL,
                quantity INTEGER NOT NULL DEFAULT 1,
                unit_price NUMERIC(10,2) NOT NULL,
                line_total NUMERIC(10,2) NOT NULL,
                created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
                updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
            );
        """)

        # Create order_activity table (event_type + message + meta_data)
        await conn.execute("""
            CREATE TABLE order_activity (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
                event_type VARCHAR(50) NOT NULL,
                message TEXT NOT NULL,
                created_by VARCHAR(255),
                meta_data JSON,
                created_at TIMESTAMPTZ DEFAULT now() NOT NULL
            );
        """)

        # Create quotes table
        await conn.execute("""
            CREATE TABLE quotes (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                organization_id UUID,
                quote_number VARCHAR(50) UNIQUE NOT NULL,
                customer_id UUID REFERENCES customers(id) NOT NULL,
                status VARCHAR(20) DEFAULT 'draft' NOT NULL,
                total NUMERIC(10,2) NOT NULL DEFAULT 0,
                notes TEXT,
                valid_until TIMESTAMPTZ,
                quote_date TIMESTAMPTZ DEFAULT now() NOT NULL,
                created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
                updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
            );
        """)

        # Create quote_items table (uses line_total not subtotal)
        await conn.execute("""
            CREATE TABLE quote_items (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE NOT NULL,
                product_id UUID REFERENCES products(id) NOT NULL,
                quantity INTEGER NOT NULL DEFAULT 1,
                unit_price NUMERIC(10,2) NOT NULL,
                line_total NUMERIC(10,2) NOT NULL,
                created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
                updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
            );
        """)

        # Create indexes
        await conn.execute("CREATE INDEX IF NOT EXISTS ix_products_sku ON products(sku);")
        await conn.execute("CREATE INDEX IF NOT EXISTS ix_customers_customer_number ON customers(customer_number);")
        await conn.execute("CREATE INDEX IF NOT EXISTS ix_customers_email ON customers(email);")
        await conn.execute("CREATE INDEX IF NOT EXISTS ix_orders_order_number ON orders(order_number);")
        await conn.execute("CREATE INDEX IF NOT EXISTS ix_orders_order_date ON orders(order_date);")
        await conn.execute("CREATE INDEX IF NOT EXISTS ix_quotes_quote_number ON quotes(quote_number);")
        await conn.execute("CREATE INDEX IF NOT EXISTS ix_quotes_quote_date ON quotes(quote_date);")

        await conn.close()

        return {"status": "success", "message": "All demo tables created with correct schema"}

    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "type": type(e).__name__,
            "traceback": traceback.format_exc()[-2000:],
        }


@app.post("/debug/seed-data")
async def seed_data():
    """Seed demo data into existing tables."""
    try:
        from src.config.database import AsyncSessionLocal
        from src.db.seed_demo import (
            create_demo_user,
            create_products,
            create_customers,
            create_orders,
            create_quotes,
        )

        async with AsyncSessionLocal() as db:
            user = await create_demo_user(db)
            products = await create_products(db, count=60)
            customers = await create_customers(db, count=35)
            orders = await create_orders(db, customers, products, count=30)
            quotes = await create_quotes(db, customers, products, count=18)

        return {
            "status": "success",
            "data_seeded": {
                "users": 1,
                "products": len(products),
                "customers": len(customers),
                "orders": len(orders),
                "quotes": len(quotes),
            }
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "type": type(e).__name__,
            "traceback": traceback.format_exc()[-2000:],
        }


@app.post("/debug/test-login")
async def test_login():
    """Test login flow to find exact error."""
    try:
        import asyncpg, os, bcrypt
        db_url = os.environ.get("DATABASE_URL", "")
        raw_url = db_url.replace("postgresql+asyncpg://", "postgresql://")
        conn = await asyncpg.connect(raw_url, timeout=10, statement_cache_size=0)

        # Find user
        row = await conn.fetchrow("SELECT id, email, hashed_password, is_active, is_admin FROM users WHERE email = $1", "admin@demo.com")
        if not row:
            await conn.close()
            return {"status": "error", "error": "User not found"}

        # Test password
        hash_ok = bcrypt.checkpw(b"demo123", row["hashed_password"].encode("utf-8"))
        await conn.close()

        return {
            "status": "success",
            "user_found": True,
            "email": row["email"],
            "is_active": row["is_active"],
            "is_admin": row["is_admin"],
            "password_valid": hash_ok,
        }
    except Exception as e:
        return {"status": "error", "error": str(e), "type": type(e).__name__, "traceback": traceback.format_exc()[-1000:]}


@app.get("/debug/tables")
async def debug_tables():
    """List all tables in the database."""
    import os
    try:
        import asyncpg
        db_url = os.environ.get("DATABASE_URL", "")
        raw_url = db_url.replace("postgresql+asyncpg://", "postgresql://")
        conn = await asyncpg.connect(raw_url, timeout=10, statement_cache_size=0)
        rows = await conn.fetch("""
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name
        """)
        await conn.close()
        return {"tables": [r["table_name"] for r in rows], "count": len(rows)}
    except Exception as e:
        return {"error": str(e), "type": type(e).__name__}


@app.get("/debug/db")
async def debug_db():
    """Check DATABASE_URL and test connection."""
    import os
    db_url = os.environ.get("DATABASE_URL", "NOT SET")
    # Mask password for security
    masked = db_url
    if "@" in db_url and ":" in db_url:
        # Find password portion between second : and @
        parts = db_url.split("@")
        prefix = parts[0]
        user_pass = prefix.split("://")[1] if "://" in prefix else prefix
        if ":" in user_pass:
            user = user_pass.split(":")[0]
            masked = db_url.replace(user_pass, f"{user}:****")

    result = {
        "database_url_masked": masked,
        "url_length": len(db_url),
        "ends_with_newline": db_url.endswith("\n"),
        "last_char_ord": ord(db_url[-1]) if db_url else None,
    }

    # Try actual connection
    try:
        import asyncpg
        # Convert SQLAlchemy URL to asyncpg format
        raw_url = db_url.replace("postgresql+asyncpg://", "postgresql://")
        conn = await asyncpg.connect(raw_url, timeout=10)
        version = await conn.fetchval("SELECT version()")
        await conn.close()
        result["connection"] = "success"
        result["pg_version"] = version
    except Exception as e:
        result["connection"] = "failed"
        result["error"] = str(e)
        result["error_type"] = type(e).__name__

    return result
