# Split Schema Import Instructions

The schema has been split into smaller files for easier import through the Supabase SQL Editor.

## Import Order (IMPORTANT: Run in this exact order!)

### Step 1: Cleanup (01_cleanup.sql)

- **File**: `01_cleanup.sql`
- **Purpose**: Removes all existing tables, types, and objects from the public schema
- **Expected Result**: "Cleanup complete"

### Step 2: Create Types (02_types.sql)

- **File**: `02_types.sql` (122 lines)
- **Purpose**: Creates all ENUM types (order_status, quote_status, product_category, etc.)
- **Expected Result**: "Success. No rows returned" (this is normal for DDL)

### Step 3: Create Tables (03_tables.sql)

- **File**: `03_tables.sql` (553 lines)
- **Purpose**: Creates all table structures WITHOUT foreign key constraints
- **Expected Result**: "Success. No rows returned"

### Step 4: Add Constraints (04_constraints.sql)

- **File**: `04_constraints.sql` (91 lines)
- **Purpose**: Adds foreign key constraints between tables
- **Expected Result**: "Success. No rows returned"

### Step 5: Create Indexes (05_indexes.sql)

- **File**: `05_indexes.sql` (125 lines)
- **Purpose**: Creates all indexes for performance
- **Expected Result**: "Success. No rows returned"

### Step 6: Verify Import (06_verify.sql)

- **File**: `06_verify.sql`
- **Purpose**: Verifies that all objects were created successfully
- **Expected Results**:
  - Tables: ~40 (should see organizations, users, products, customers, orders, quotes, etc.)
  - Types: 8 (enum types)
  - Indexes: ~125

## How to Import

For each file (in order):

1. Open the file in a text editor (Notepad, VS Code, etc.)
2. Select All (Ctrl+A) and Copy (Ctrl+C)
3. Go to Supabase SQL Editor: https://supabase.com/dashboard/project/vwfgksqkajnpfjospbpe/sql/new
4. Paste the SQL (Ctrl+V)
5. Click "Run" (or press Ctrl+Enter)
6. Wait for "Success" message
7. Proceed to next file

## If You Encounter Errors

- **"type already exists"**: Run 01_cleanup.sql again, then continue from Step 2
- **"table already exists"**: Run 01_cleanup.sql again, then continue from Step 2
- **"relation already exists"**: Run 01_cleanup.sql again, then continue from Step 2
- **Foreign key errors in Step 4**: Make sure Step 3 completed successfully

## After Successful Import

Once all 6 steps complete successfully:

1. Your schema is ready!
2. Next step: Import the data file (`data_20260117_110545.sql`)
3. Then set up Row Level Security policies

## Files Created

- `01_cleanup.sql` - Database cleanup script
- `02_types.sql` - CREATE TYPE statements (ENUM types)
- `03_tables.sql` - CREATE TABLE statements (table structure)
- `04_constraints.sql` - ALTER TABLE statements (foreign keys)
- `05_indexes.sql` - CREATE INDEX statements
- `06_verify.sql` - Verification queries

Total lines: ~900 (much more manageable than the original 2,557-line file)
