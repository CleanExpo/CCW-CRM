# Demonstration Purchase Setup Guide

This guide explains how to generate 5 automated demonstration purchases using real product data from your CCWonline.com.au Shopify store.

## Overview

The `generate_demo_purchases.py` script will:
1. Connect to your CCWonline.com.au Shopify store
2. Fetch real product data (up to 50 products)
3. Sync products to your ERP database
4. Create 5 demonstration customers (Queensland-based businesses)
5. Generate 5 realistic purchase scenarios:
   - **Scenario 1**: Large equipment order (DELIVERED) - Brisbane Construction Co
   - **Scenario 2**: Medium stock replenishment (SHIPPED) - Gold Coast Electrical
   - **Scenario 3**: Urgent replacement parts (PROCESSING) - Sunshine Coast Plumbing
   - **Scenario 4**: Quote converted to order (CONFIRMED) - Toowoomba Building
   - **Scenario 5**: Quote pending approval (SENT) - Cairns Industrial

## Prerequisites

1. **Shopify Admin Access**: You need admin access to CCWonline.com.au Shopify store
2. **Shopify Access Token**: Create a custom app or use existing API credentials
3. **Python Environment**: Ensure backend is set up (uv installed)
4. **Database Running**: PostgreSQL must be running (Docker Compose)

---

## Step 1: Get Shopify API Credentials

### Option A: Create a Custom App (Recommended)

1. Log in to your Shopify admin: `https://ccwonline.myshopify.com/admin`
2. Go to **Settings** → **Apps and sales channels** → **Develop apps**
3. Click **Allow custom app development** (if prompted)
4. Click **Create an app**
5. Name it: "CCW ERP Integration"
6. Click **Configure Admin API scopes**
7. Select the following scopes:
   - `read_products` - Read products
   - `read_orders` - Read orders
   - `read_customers` - Read customers
   - `read_inventory` - Read inventory
8. Click **Save**
9. Click **Install app**
10. Copy the **Admin API access token** (you'll need this below)

### Option B: Use Existing Private App

If you already have a private app with the necessary scopes, you can use those credentials.

---

## Step 2: Configure Environment Variables

### Backend .env File

Navigate to `apps/backend/` and update your `.env` file (or create it from `.env.example`):

```bash
# Shopify Integration Settings

# Mode: "demo" for testing, "live" for real Shopify data
SHOPIFY_MODE=live

# Your Shopify store domain (WITHOUT https://)
SHOPIFY_SHOP_DOMAIN=ccwonline.myshopify.com

# Admin API access token (from Step 1)
SHOPIFY_ACCESS_TOKEN=shpat_abcdefghijklmnopqrstuvwxyz123456

# API version (use 2024-01 or later)
SHOPIFY_API_VERSION=2024-01

# Optional: Webhook secret (if you're using webhooks)
SHOPIFY_WEBHOOK_SECRET=your_webhook_secret_here

# Optional: Inventory settings
SHOPIFY_SYNC_INVENTORY=true
# SHOPIFY_INVENTORY_LOCATION_ID=12345678
```

**Important Notes**:
- Replace `ccwonline.myshopify.com` with your actual Shopify domain
- Replace `shpat_abc...` with your actual Admin API access token
- Keep these credentials **SECRET** - never commit them to Git
- The `.env` file is already in `.gitignore`

---

## Step 3: Start Required Services

### Start Database

```bash
# From project root
docker compose up -d
```

This starts PostgreSQL on port 5432.

### Verify Database Connection

```bash
# From project root
cd apps/backend
uv run python -c "from src.config.database import async_engine; print('✓ Database connection OK')"
```

---

## Step 4: Run the Demonstration Script

```bash
# From apps/backend directory
cd apps/backend

# Run the script
uv run python -m src.db.generate_demo_purchases
```

### Expected Output

```
================================================================================
GENERATE DEMONSTRATION PURCHASES
Using Real CCWonline.com.au Shopify Product Data
================================================================================

Shopify Mode: LIVE
Shop Domain: ccwonline.myshopify.com

[SHOPIFY] Connecting to ccwonline.myshopify.com...
[SHOPIFY] Connected to: CCW Online
[SHOPIFY] Fetching up to 50 products...
[SHOPIFY] Successfully fetched 42 products

[PRODUCTS] Syncing 42 products to ERP...
   ✓ Created: SHOP-12345 - Heavy Duty Excavator Bucket
   ✓ Created: SHOP-12346 - Professional Cordless Drill Kit
   ✓ Updated: SHOP-12347 - Safety Hard Hat Class E
   ... (more products)
[PRODUCTS] Successfully synced 42 products

[CUSTOMERS] Creating demonstration customers...
   ✓ Created: Brisbane Construction Co (Sarah Mitchell)
   ✓ Created: Gold Coast Electrical Services (James Chen)
   ✓ Created: Sunshine Coast Plumbing (Emma Roberts)
   ✓ Created: Toowoomba Building Supplies (Michael Thompson)
   ✓ Created: Cairns Industrial Equipment (Lisa Anderson)
[CUSTOMERS] Successfully created 5 demonstration customers

================================================================================
GENERATING 5 PURCHASE SCENARIOS
================================================================================

[SCENARIO 1] Large equipment purchase - DELIVERED
   Customer: Brisbane Construction Co
   ✓ Quote QT-DEMO-030000: $12,450.50 (ACCEPTED)
   ✓ Order SO-DEMO-040000: $12,450.50 (DELIVERED)
   → Items: 7, Total: $12,450.50

[SCENARIO 2] Regular stock replenishment - SHIPPED
   Customer: Gold Coast Electrical Services
   ✓ Order SO-DEMO-040001: $2,345.80 (SHIPPED)
   → Items: 4, Total: $2,345.80

[SCENARIO 3] Urgent replacement parts - PROCESSING
   Customer: Sunshine Coast Plumbing
   ✓ Order SO-DEMO-040002: $345.60 (PROCESSING)
   → Items: 2, Total: $345.60

[SCENARIO 4] Quote converted to order - CONFIRMED
   Customer: Toowoomba Building Supplies
   ✓ Quote QT-DEMO-030001: $5,678.90 (ACCEPTED)
   ✓ Order SO-DEMO-040003: $5,678.90 (CONFIRMED)
   → Items: 6, Total: $5,678.90

[SCENARIO 5] Quote pending customer approval - SENT
   Customer: Cairns Industrial Equipment
   ✓ Quote QT-DEMO-030002: $8,234.70 (SENT - Awaiting Customer)
   → Items: 8, Total: $8,234.70

================================================================================
DEMONSTRATION PURCHASES GENERATED SUCCESSFULLY!
================================================================================

Summary:
   ✓ Synced 42 products from CCWonline.com.au
   ✓ Created 5 demonstration customers
   ✓ Generated 3 quotes (2 accepted, 1 sent)
   ✓ Generated 4 orders (1 delivered, 1 shipped, 1 processing, 1 confirmed)

Scenarios Created:
   1. Brisbane Construction Co - Large order DELIVERED ($12,450.50)
   2. Gold Coast Electrical - Medium order SHIPPED ($2,345.80)
   3. Sunshine Coast Plumbing - Urgent order PROCESSING ($345.60)
   4. Toowoomba Building - Quote → Order CONFIRMED ($5,678.90)
   5. Cairns Industrial - Quote SENT awaiting approval ($8,234.70)

You can now:
   • Log in to the ERP system (admin@demo.com / demo123)
   • View customers, quotes, and orders in the dashboard
   • Demonstrate the quote-to-order conversion workflow
   • Show different order statuses and tracking
   • Present the system to the business owner

================================================================================
```

---

## Step 5: Start the ERP System

### Start Backend

```bash
# From apps/backend
uv run uvicorn src.api.main:app --reload
```

Backend will be available at: http://localhost:8000

### Start Frontend

```bash
# From apps/web (or from project root: pnpm dev)
cd apps/web
pnpm dev
```

Frontend will be available at: http://localhost:3000

---

## Step 6: Present to Business Owner

### Login Credentials

- **Email**: admin@demo.com
- **Password**: demo123

### Demonstration Flow

1. **Dashboard Overview**
   - Navigate to: http://localhost:3000/dashboard
   - Show total revenue, order count, customer count metrics
   - Point out charts showing sales trends

2. **View Customers**
   - Navigate to: http://localhost:3000/customers
   - Show 5 Queensland-based businesses
   - Click on any customer to see their details and order history

3. **View Products**
   - Navigate to: http://localhost:3000/products
   - Show real products from CCWonline.com.au
   - Demonstrate search and filtering
   - Show stock levels and pricing

4. **View Quotes**
   - Navigate to: http://localhost:3000/quotes
   - Show 3 quotes:
     - QT-DEMO-030000: Brisbane Construction (ACCEPTED)
     - QT-DEMO-030001: Toowoomba Building (ACCEPTED)
     - QT-DEMO-030002: Cairns Industrial (SENT - awaiting approval)
   - Click on a quote to see line items
   - Demonstrate quote-to-order conversion (if quote is ACCEPTED)

5. **View Orders**
   - Navigate to: http://localhost:3000/orders
   - Show 4 orders with different statuses:
     - SO-DEMO-040000: DELIVERED (Brisbane Construction - $12,450)
     - SO-DEMO-040001: SHIPPED (Gold Coast Electrical - $2,345)
     - SO-DEMO-040002: PROCESSING (Sunshine Coast Plumbing - $345)
     - SO-DEMO-040003: CONFIRMED (Toowoomba Building - $5,678)
   - Click on an order to see line items and status history
   - Demonstrate status update workflow

6. **Create New Quote** (Live Demo)
   - Click "Create Quote"
   - Select customer: Cairns Industrial Equipment
   - Add products from real CCWonline.com.au catalog
   - Show automatic pricing and tax calculation
   - Save quote
   - Show quote in list

7. **Convert Quote to Order** (Live Demo)
   - Select the quote you just created
   - Click "Convert to Order"
   - Show order created with all line items copied
   - Demonstrate order confirmation workflow

---

## Troubleshooting

### Error: "Failed to fetch Shopify products"

**Possible causes**:
1. Invalid `SHOPIFY_ACCESS_TOKEN`
2. Incorrect `SHOPIFY_SHOP_DOMAIN`
3. Missing API scopes

**Solution**:
- Verify your Shopify credentials in `.env`
- Check that the custom app has `read_products`, `read_orders`, `read_customers` scopes
- Test API access manually:
  ```bash
  curl -X GET "https://ccwonline.myshopify.com/admin/api/2024-01/shop.json" \
       -H "X-Shopify-Access-Token: YOUR_TOKEN_HERE"
  ```

### Error: "Not enough products available"

**Cause**: Less than 5 products in your Shopify store

**Solution**:
- Add more products to your CCWonline.com.au Shopify store
- Or modify the script to use fewer products per scenario

### Error: "Database connection failed"

**Cause**: PostgreSQL is not running

**Solution**:
```bash
# From project root
docker compose up -d
```

### Warning: "Running in DEMO mode"

**Cause**: `SHOPIFY_MODE` is set to `demo` instead of `live`

**Solution**:
- Update `apps/backend/.env`:
  ```bash
  SHOPIFY_MODE=live
  ```

---

## Re-running the Script

### To Generate Fresh Demonstration Data

If you want to regenerate the demonstration purchases (e.g., after adding new products):

1. **Clear existing demo data** (optional):
   ```bash
   # From apps/backend
   uv run python -c "
   import asyncio
   from src.config.database import AsyncSessionLocal, async_engine
   from src.db.models_base import Base

   async def reset():
       async with async_engine.begin() as conn:
           await conn.run_sync(Base.metadata.drop_all)
           await conn.run_sync(Base.metadata.create_all)
       print('✓ Database reset complete')

   asyncio.run(reset())
   "
   ```

2. **Re-seed admin user** (if you reset the database):
   ```bash
   uv run python -m src.db.seed_demo
   ```

3. **Re-run demonstration script**:
   ```bash
   uv run python -m src.db.generate_demo_purchases
   ```

### To Keep Demo Data and Add More

The script checks for existing customers by email. If you run it again without clearing:
- Existing customers will be reused
- New products will be added/updated
- New quotes and orders will be created with incremented numbers

---

## Security Notes

⚠️ **IMPORTANT**: Keep your Shopify credentials secure!

- **Never commit** `.env` files to Git (already in `.gitignore`)
- **Never share** your `SHOPIFY_ACCESS_TOKEN` publicly
- **Use custom app tokens** (not private app tokens) for production
- **Rotate tokens** if you suspect they've been compromised
- **Limit scopes** to only what the integration needs (`read_products`, `read_orders`, `read_customers`)

---

## Next Steps

After successfully generating demonstration purchases:

1. **Present to Business Owner**
   - Walk through the 5 purchase scenarios
   - Demonstrate quote-to-order workflow
   - Show real CCWonline.com.au products in the system
   - Highlight different order statuses and tracking

2. **Gather Feedback**
   - Note any requested features or changes
   - Document workflow improvements
   - Identify integration requirements

3. **Plan Production Deployment**
   - See: `docs/GO_LIVE_SIGNOFF.md`
   - Follow staging deployment procedures
   - Schedule production launch

4. **Configure Real Workflows**
   - Set up email notifications
   - Configure Shopify webhooks for real-time sync
   - Train staff on system usage
   - Migrate real customer and product data

---

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review Shopify API documentation: https://shopify.dev/docs/api/admin
3. Check application logs:
   ```bash
   # Backend logs
   cd apps/backend && uv run uvicorn src.api.main:app --reload

   # Docker logs
   docker compose logs -f
   ```

4. Verify environment variables are correct:
   ```bash
   cd apps/backend
   cat .env | grep SHOPIFY
   ```

---

**Last Updated**: 2026-02-02
**Script Version**: 1.0.0
**Compatible with**: CCW-Online ERP v1.0.0
