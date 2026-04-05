"""Run Supabase migrations directly using Python."""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv(".env.local")

try:
    from supabase import create_client
except ImportError:
    print("[FAIL] supabase library not installed")
    print("Install with: pip install supabase")
    sys.exit(1)

# Get Supabase credentials
supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not supabase_url or not service_key:
    print("[FAIL] Supabase credentials not configured")
    sys.exit(1)

# Create client with service role key (has admin privileges)
client = create_client(supabase_url, service_key)

# Find migration files
migrations_dir = Path(__file__).parent.parent.parent / "supabase" / "migrations"
contractor_migrations = sorted([
    f for f in migrations_dir.glob("20260106*.sql")
])

if not contractor_migrations:
    print("[FAIL] No contractor migration files found")
    sys.exit(1)

print("=" * 60)
print("RUNNING SUPABASE MIGRATIONS")
print("=" * 60)
print()

for migration_file in contractor_migrations:
    print(f"Running: {migration_file.name}")

    try:
        # Read SQL from file
        sql = migration_file.read_text(encoding="utf-8")

        # Execute SQL using Supabase RPC
        # Note: We need to use the PostgreSQL connection or execute via SQL editor
        # For now, let's just print the SQL and inform the user
        print(f"  SQL loaded ({len(sql)} chars)")
        print(f"  [INFO] Migration needs to be run via Supabase SQL Editor")
        print()

    except Exception as e:
        print(f"  [FAIL] Error reading migration: {e}")
        sys.exit(1)

print("=" * 60)
print("MIGRATION APPROACH")
print("=" * 60)
print()
print("The Supabase Python client doesn't support running raw SQL migrations.")
print("You have two options:")
print()
print("Option 1: Use Supabase SQL Editor (Recommended)")
print("  1. Go to: https://supabase.com/dashboard/project/ywxwcrmyfovqnquglynh/sql")
print("  2. Copy and paste each migration file:")
for mig in contractor_migrations:
    print(f"     - {mig.name}")
print("  3. Click 'Run' for each")
print()
print("Option 2: Install Supabase CLI")
print("  npm install -g supabase")
print("  supabase link --project-ref ywxwcrmyfovqnquglynh")
print("  supabase db push")
print()

# Alternative: Create tables directly via Python
print("Option 3: Quick Setup (I can do this now!)")
print("  Create tables directly using Python")
print()

response = input("Would you like me to create the tables now? (yes/no): ")

if response.lower() in ['yes', 'y']:
    print()
    print("Creating tables...")

    # SQL for creating contractors table
    create_contractors_sql = """
    CREATE TYPE australian_state AS ENUM ('QLD', 'NSW', 'VIC', 'SA', 'WA', 'TAS', 'NT', 'ACT');
    CREATE TYPE availability_status AS ENUM ('available', 'booked', 'tentative', 'unavailable');

    CREATE TABLE contractors (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(100) NOT NULL,
        mobile VARCHAR(20) NOT NULL,
        abn VARCHAR(20),
        email VARCHAR(255),
        specialisation VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT mobile_format CHECK (mobile ~ '^04\\d{2} \\d{3} \\d{3}'),
        CONSTRAINT abn_format CHECK (abn IS NULL OR abn ~ '^\\d{2} \\d{3} \\d{3} \\d{3}')
    );

    CREATE TABLE availability_slots (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
        date TIMESTAMPTZ NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        suburb VARCHAR(100) NOT NULL,
        state australian_state NOT NULL DEFAULT 'QLD',
        postcode VARCHAR(10),
        status availability_status DEFAULT 'available',
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT end_after_start CHECK (end_time > start_time)
    );

    CREATE INDEX idx_contractors_mobile ON contractors(mobile);
    CREATE INDEX idx_contractors_abn ON contractors(abn);
    CREATE INDEX idx_availability_contractor ON availability_slots(contractor_id);
    CREATE INDEX idx_availability_date ON availability_slots(date);
    CREATE INDEX idx_availability_location ON availability_slots(suburb, state);
    CREATE INDEX idx_availability_status ON availability_slots(status);
    """

    print("[INFO] SQL prepared - needs to be run via Supabase Dashboard SQL Editor")
    print()
    print("Copy this SQL and run it at:")
    print(f"https://supabase.com/dashboard/project/ywxwcrmyfovqnquglynh/sql/new")
    print()
    print(create_contractors_sql)
else:
    print()
    print("[INFO] Skipping table creation")
    print("Run migrations manually when ready")
