# Demo Purchase Generation - Quick Start

Generate 5 automated demonstration purchases using real CCWonline.com.au products in **under 10 minutes**.

## TL;DR - Quick Commands

```bash
# 1. Set up Shopify credentials (see below)
nano apps/backend/.env  # Add SHOPIFY_MODE=live and your token

# 2. Start database
docker compose up -d

# 3. Generate demo purchases
cd apps/backend
uv run python -m src.db.generate_demo_purchases

# 4. Start ERP system
pnpm dev  # or: cd apps/web && pnpm dev

# 5. Log in and present
# Open http://localhost:3000
# Login: admin@demo.com / demo123
```

---

## Step 1: Get Shopify Access Token (5 minutes)

1. Go to: https://ccwonline.myshopify.com/admin/settings/apps/development
2. Click **"Create an app"**
3. Name: "CCW ERP Demo"
4. Click **"Configure Admin API scopes"**
5. Check these scopes:
   - ☑ `read_products`
   - ☑ `read_orders`
   - ☑ `read_customers`
6. Click **"Save"** → **"Install app"**
7. Copy the **Admin API access token** (starts with `shpat_`)

---

## Step 2: Configure Environment (1 minute)

Edit `apps/backend/.env` (create if it doesn't exist):

```bash
# Add these lines:
SHOPIFY_MODE=live
SHOPIFY_SHOP_DOMAIN=ccwonline.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_your_token_from_step_1
SHOPIFY_API_VERSION=2024-01
```

**Example**:
```bash
SHOPIFY_MODE=live
SHOPIFY_SHOP_DOMAIN=ccwonline.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_abc123def456ghi789
SHOPIFY_API_VERSION=2024-01
```

---

## Step 3: Run Script (2 minutes)

```bash
# Start database (if not running)
docker compose up -d

# Run demo purchase generator
cd apps/backend
uv run python -m src.db.generate_demo_purchases
```

**Expected Output**:
```
✓ Synced 42 products from CCWonline.com.au
✓ Created 5 demonstration customers
✓ Generated 3 quotes (2 accepted, 1 sent)
✓ Generated 4 orders (1 delivered, 1 shipped, 1 processing, 1 confirmed)
```

---

## Step 4: Start ERP & Present (2 minutes)

```bash
# Start both frontend and backend
pnpm dev

# Or start separately:
cd apps/backend && uv run uvicorn src.api.main:app --reload
cd apps/web && pnpm dev
```

Open: http://localhost:3000
Login: **admin@demo.com** / **demo123**

---

## What You'll See

### 5 Demonstration Scenarios

1. **Brisbane Construction Co** → Large equipment order ($12,450) - **DELIVERED**
   - Quote QT-DEMO-030000 → Order SO-DEMO-040000
   - 7 items, 10% bulk discount
   - Delivered 1 week ago

2. **Gold Coast Electrical Services** → Stock replenishment ($2,345) - **SHIPPED**
   - Order SO-DEMO-040001
   - 4 items, express shipping
   - Currently in transit

3. **Sunshine Coast Plumbing** → Urgent parts ($345) - **PROCESSING**
   - Order SO-DEMO-040002
   - 2 items, expedited shipping
   - Being prepared for shipment

4. **Toowoomba Building Supplies** → Quote converted ($5,678) - **CONFIRMED**
   - Quote QT-DEMO-030001 → Order SO-DEMO-040003
   - 6 items, 5% volume discount
   - Confirmed yesterday, ready to ship

5. **Cairns Industrial Equipment** → Quote pending ($8,234) - **SENT**
   - Quote QT-DEMO-030002
   - 8 items, awaiting customer approval
   - Sent 2 days ago

### All Using Real CCWonline.com.au Products! 🎉

---

## Presentation Flow

1. **Dashboard** → Show metrics (total revenue, orders, customers)
2. **Customers** → Show 5 Queensland businesses
3. **Products** → Show real CCWonline.com.au catalog
4. **Quotes** → Show 3 quotes (2 accepted, 1 pending)
5. **Orders** → Show 4 orders with different statuses
6. **Live Demo** → Create new quote and convert to order

---

## Troubleshooting

### "Failed to fetch Shopify products"
- Check `SHOPIFY_ACCESS_TOKEN` in `.env`
- Verify token has `read_products` scope
- Test: `curl -H "X-Shopify-Access-Token: YOUR_TOKEN" https://ccwonline.myshopify.com/admin/api/2024-01/shop.json`

### "Not enough products available"
- Add more products to CCWonline.com.au Shopify store
- Or edit script to reduce products per scenario

### "Database connection failed"
- Run: `docker compose up -d`
- Verify: `docker compose ps` shows postgres running

---

## Need More Details?

See full documentation: `docs/DEMO_PURCHASE_SETUP.md`

---

**Time to complete**: ~10 minutes
**Result**: Fully automated demo with real products ready to present!
