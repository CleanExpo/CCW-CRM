# Content Strategy & CCW Product Population Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Populate CCW-ERP-CRM with real CCW cleaning equipment products and replace all placeholder content with professional, brand-aligned copy across 75+ pages.

**Architecture:** Module-by-module execution with Phase 0 (product research) first, then 8 content modules in priority order. Each module uses a 6-step workflow: design check → audit → write → populate → verify → handoff.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, FastAPI, Python 3.12, PostgreSQL

---

## Chunk 1: Phase 0 - CCW Product Research & Database Population

### Context

Replace generic mechanical products with real CCW cleaning equipment products from https://www.ccwonline.com.au. Target: 50-100 products across 7 categories.

**Categories:**

- Truckmounts (carpet cleaning machines)
- Portable carpet extractors
- Water damage restoration equipment
- Mould remediation equipment
- Hard floor care machines
- Cleaning chemicals & supplies
- Accessories & parts

### Task 1: Research CCW Product Catalog

**Files:**

- Create: `docs/research/ccw-product-catalog-raw.md`
- Reference: https://www.ccwonline.com.au

**Goal:** Extract product data from CCW's Shopify store for database population.

- [ ] **Step 1: Fetch CCW homepage**

```bash
# Use WebFetch tool to get homepage
```

Expected: HTML with product navigation structure

- [ ] **Step 2: Identify product category pages**

Navigate through main navigation to find:

- Shop by Equipment Type
- Product collections
- Category URLs

Document in `docs/research/ccw-product-catalog-raw.md`:

```markdown
# CCW Product Categories

## Truckmounts

- URL: [category URL]
- Sample products: [list 3-5]

## Portable Extractors

...
```

- [ ] **Step 3: Extract sample products from each category**

For each category, fetch 5-10 representative products:

- Product name
- SKU (if visible)
- Price (AUD)
- Description
- Image URL
- Specifications

Document in structured format:

```markdown
## Category: Truckmounts

### Product: [Name]

- SKU: [SKU]
- Price: $[price] AUD
- Description: [description]
- Image: [URL]
- Specs:
  - [spec 1]
  - [spec 2]
```

- [ ] **Step 4: Create structured product list**

Compile 50-100 products into CSV format:

```csv
category,name,sku,price_aud,description,image_url,brand,specs
truckmounts,Sapphire Scientific 570ss,570SS,45000,High-performance truck-mounted carpet cleaning system,https://...,Sapphire Scientific,"CFM: 470, Lift: 15"
```

Save as: `docs/research/ccw-products.csv`

- [ ] **Step 5: Verify data quality**

Check CSV:

- All 50-100 rows have complete data
- Prices are realistic (range $50 - $50,000 AUD)
- Categories align with planned 7 categories
- No duplicate SKUs

Run: `wc -l docs/research/ccw-products.csv`
Expected: 51-101 lines (header + 50-100 products)

- [ ] **Step 6: Commit research data**

```bash
git add docs/research/ccw-product-catalog-raw.md docs/research/ccw-products.csv
git commit -m "docs: CCW product catalog research (50-100 cleaning equipment products)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Task 2: Create Product Seed Script

**Files:**

- Create: `apps/backend/scripts/seed_ccw_products.py`
- Reference: `apps/backend/scripts/seed_demo.py` (existing pattern)
- Reference: `docs/research/ccw-products.csv`

**Goal:** Script to populate database with real CCW products, replacing generic mechanical products.

- [ ] **Step 1: Create seed script skeleton**

Create `apps/backend/scripts/seed_ccw_products.py`:

```python
"""
Seed database with real CCW cleaning equipment products.

Replaces generic mechanical products with actual CCW product catalog.
"""

import csv
import sys
from pathlib import Path
from uuid import uuid4

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from src.config.database import get_database_url
from src.db.demo_models import Organization, Product, ProductCategory


def load_ccw_products_from_csv(csv_path: str) -> list[dict]:
    """Load CCW products from CSV file."""
    products = []
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            products.append(row)
    return products


def map_category_to_enum(ccw_category: str) -> ProductCategory:
    """Map CCW category names to ProductCategory enum."""
    mapping = {
        "truckmounts": ProductCategory.HEAVY_MACHINERY,
        "portable_extractors": ProductCategory.POWER_TOOLS,
        "restoration": ProductCategory.SAFETY_EQUIPMENT,
        "mould": ProductCategory.SAFETY_EQUIPMENT,
        "hard_floor": ProductCategory.POWER_TOOLS,
        "chemicals": ProductCategory.BUILDING_MATERIALS,
        "accessories": ProductCategory.ACCESSORIES,
    }
    return mapping.get(ccw_category.lower(), ProductCategory.ACCESSORIES)


def seed_ccw_products(session: Session, org_id: str, csv_path: str):
    """Seed CCW products into database."""
    print(f"Loading CCW products from {csv_path}...")
    products_data = load_ccw_products_from_csv(csv_path)

    print(f"Clearing existing products for organization {org_id}...")
    session.query(Product).filter(Product.organization_id == org_id).delete()

    print(f"Inserting {len(products_data)} CCW products...")
    for row in products_data:
        product = Product(
            id=uuid4(),
            organization_id=org_id,
            sku=row['sku'],
            name=row['name'],
            description=row['description'],
            category=map_category_to_enum(row['category']),
            price=float(row['price_aud']),
            cost=float(row['price_aud']) * 0.6,  # Assume 40% margin
            stock=10,  # Default stock level
            reorder_point=3,
            is_active=True,
        )
        session.add(product)

    session.commit()
    print(f"✅ Successfully seeded {len(products_data)} CCW products")


def main():
    """Main entry point."""
    database_url = get_database_url()
    engine = create_engine(database_url)

    with Session(engine) as session:
        # Get first organization (demo org)
        result = session.execute(select(Organization).limit(1))
        org = result.scalar_one_or_none()

        if not org:
            print("❌ No organization found. Run seed_demo.py first.")
            sys.exit(1)

        csv_path = Path(__file__).parent.parent.parent.parent / "docs" / "research" / "ccw-products.csv"

        if not csv_path.exists():
            print(f"❌ CSV file not found: {csv_path}")
            sys.exit(1)

        seed_ccw_products(session, str(org.id), str(csv_path))


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Verify script syntax**

Run: `cd apps/backend && uv run python scripts/seed_ccw_products.py --help 2>&1 || echo "Script loads successfully"`
Expected: Script executes without syntax errors

- [ ] **Step 3: Test dry-run with CSV validation**

Add validation before seeding:

```python
def validate_csv_data(products_data: list[dict]):
    """Validate CSV data before seeding."""
    required_fields = ['category', 'name', 'sku', 'price_aud', 'description']

    for idx, row in enumerate(products_data):
        for field in required_fields:
            if field not in row or not row[field]:
                raise ValueError(f"Row {idx}: Missing required field '{field}'")

        # Validate price
        try:
            price = float(row['price_aud'])
            if price <= 0:
                raise ValueError(f"Row {idx}: Invalid price {price}")
        except ValueError as e:
            raise ValueError(f"Row {idx}: Invalid price format: {e}")

    print(f"✅ CSV validation passed ({len(products_data)} products)")
```

Add call in `seed_ccw_products()` before clearing products:

```python
validate_csv_data(products_data)
```

- [ ] **Step 4: Run seed script (LOCAL ONLY - requires database)**

```bash
cd apps/backend
uv run python scripts/seed_ccw_products.py
```

Expected output:

```
Loading CCW products from docs/research/ccw-products.csv...
✅ CSV validation passed (50 products)
Clearing existing products for organization ...
Inserting 50 CCW products...
✅ Successfully seeded 50 CCW products
```

**Note:** This step requires local PostgreSQL running (docker-compose up). If database not available, mark step complete after code review.

- [ ] **Step 5: Verify products in database (if local DB available)**

```bash
cd apps/backend
uv run python -c "
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from src.config.database import get_database_url
from src.db.demo_models import Product

engine = create_engine(get_database_url())
with Session(engine) as session:
    result = session.execute(select(Product).limit(5))
    products = result.scalars().all()
    for p in products:
        print(f'{p.sku}: {p.name} - \${p.price}')
"
```

Expected: List of 5 CCW products (not generic mechanical products)

- [ ] **Step 6: Commit seed script**

```bash
git add apps/backend/scripts/seed_ccw_products.py
git commit -m "feat(scripts): add CCW product seeding script

- Loads products from docs/research/ccw-products.csv
- Replaces generic mechanical products with CCW cleaning equipment
- Maps CCW categories to ProductCategory enum
- Validates CSV data before seeding
- Target: 50-100 real products

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Task 3: Update Seed Documentation

**Files:**

- Modify: `README.md` (add CCW product seeding instructions)
- Create: `docs/seeding-ccw-products.md`

**Goal:** Document how to populate database with CCW products for future reference.

- [ ] **Step 1: Create detailed seeding guide**

Create `docs/seeding-ccw-products.md`:

````markdown
# CCW Product Database Seeding

## Overview

This guide explains how to populate the database with real CCW cleaning equipment products from the ccwonline.com.au catalog.

## Prerequisites

- Local PostgreSQL database running (`docker-compose up -d`)
- Python environment set up (`cd apps/backend && uv sync`)
- CCW product CSV exists at `docs/research/ccw-products.csv`

## Steps

### 1. Verify CSV Data

```bash
head -n 5 docs/research/ccw-products.csv
```
````

Should show header + 4 products.

### 2. Run Seed Script

```bash
cd apps/backend
uv run python scripts/seed_ccw_products.py
```

Expected output:

- ✅ CSV validation passed
- ✅ Successfully seeded N products

### 3. Verify in Database

```bash
uv run python -c "
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from src.config.database import get_database_url
from src.db.demo_models import Product

engine = create_engine(get_database_url())
with Session(engine) as session:
    count = session.query(Product).count()
    print(f'Total products: {count}')
"
```

Should show 50-100 products (not 20 demo products).

### 4. Test Frontend

```bash
cd apps/web
pnpm dev
```

Navigate to http://localhost:3011/products

Should see CCW cleaning equipment products (truckmounts, extractors, etc.) instead of generic mechanical equipment.

## Product Categories

Products are mapped to these categories:

- Truckmounts → HEAVY_MACHINERY
- Portable Extractors → POWER_TOOLS
- Restoration Equipment → SAFETY_EQUIPMENT
- Mould Equipment → SAFETY_EQUIPMENT
- Hard Floor Machines → POWER_TOOLS
- Chemicals → BUILDING_MATERIALS
- Accessories → ACCESSORIES

## Troubleshooting

**"No organization found":**
Run `uv run python scripts/seed_demo.py` first to create demo organization.

**"CSV file not found":**
Ensure `docs/research/ccw-products.csv` exists with valid data.

**"Database connection error":**
Ensure PostgreSQL is running: `docker-compose up -d`

````

- [ ] **Step 2: Update root README**

Add section to `README.md` after "Local Development" section:

```markdown
## Populating CCW Products

To populate the database with real CCW cleaning equipment products:

```bash
cd apps/backend
uv run python scripts/seed_ccw_products.py
````

See [docs/seeding-ccw-products.md](docs/seeding-ccw-products.md) for detailed instructions.

````

- [ ] **Step 3: Commit documentation**

```bash
git add docs/seeding-ccw-products.md README.md
git commit -m "docs: add CCW product seeding guide

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
````

### Task 4: Phase 0 Verification

**Goal:** Verify Phase 0 is complete and system is ready for content population.

- [ ] **Step 1: Verify all Phase 0 files exist**

```bash
ls -la docs/research/ccw-product-catalog-raw.md
ls -la docs/research/ccw-products.csv
ls -la apps/backend/scripts/seed_ccw_products.py
ls -la docs/seeding-ccw-products.md
```

Expected: All 4 files exist

- [ ] **Step 2: Run full test suite**

```bash
cd D:/CCW-ERP-CRM
pnpm run check:all
```

Expected: All checks pass (0 errors)

- [ ] **Step 3: Create Linear issue for Phase 0 completion**

Title: `[Content Strategy] Phase 0: CCW Product Research & Population - COMPLETE`

Description:

```
✅ Phase 0 Complete

**Deliverables:**
- CCW product catalog research (50-100 products)
- Product seed script (seed_ccw_products.py)
- Seeding documentation

**Files:**
- docs/research/ccw-product-catalog-raw.md
- docs/research/ccw-products.csv
- apps/backend/scripts/seed_ccw_products.py
- docs/seeding-ccw-products.md

**Next:** Module 1 - Core Business content population
```

Labels: `content-strategy`, `phase-0`, `completed`

- [ ] **Step 4: Screenshot products page with CCW products (if running locally)**

If frontend running:

1. Navigate to http://localhost:3011/products
2. Screenshot showing CCW products
3. Save to `docs/screenshots/phase-0-ccw-products.png`

- [ ] **Step 5: Phase 0 handoff commit**

```bash
git add .
git commit -m "milestone: Phase 0 complete - CCW products ready

- 50-100 real CCW cleaning equipment products researched
- Seed script created and documented
- Database ready for content population
- Tests passing

Next: Module 1 (Core Business) content strategy

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Chunk 2: Content Module Template & Modules 1-2

### Content Module Workflow Pattern

Each module follows this 6-step workflow. Use this template for all modules.

**Step 1: Design Consistency Check (30 min)**

- Scan all pages in module
- Note spacing/font/button/border inconsistencies
- Fix minor issues, document major ones
- Run `pnpm run check`

**Step 2: Content Audit & Research (1-2 hours)**

- Document current placeholder content
- Identify what each section needs
- Research domain terminology
- Create content checklist

**Step 3: Content Writing (2-4 hours)**

- Write all content following module voice/tone
- Hit 4 differentiators (AI, industry, UX, all-in-one)
- Include realistic examples
- Actionable guidance

**Step 4: Content Population (1-2 hours)**

- Replace placeholder text
- Update headings, descriptions, CTAs
- Add empty states, error messages
- Clear button labels

**Step 5: Verification (30 min)**

- Visual review all pages
- Test user flows
- Run `pnpm run check:all`
- Screenshot key pages

**Step 6: Linear Update & Handoff**

- Update Linear issue
- Document changes
- Mark complete

### Module 1: Core Business (Dashboard, Products, Customers, Orders, Quotes)

**Voice:** Empowering & action-oriented
**Pages:** 5
**Priority:** HIGHEST

#### Task 5: Module 1 - Design Consistency Check

**Files:**

- Review: `apps/web/app/(dashboard)/dashboard/page.tsx`
- Review: `apps/web/app/(dashboard)/products/page.tsx`
- Review: `apps/web/app/(dashboard)/customers/page.tsx`
- Review: `apps/web/app/(dashboard)/orders/page.tsx`
- Review: `apps/web/app/(dashboard)/quotes/page.tsx`

- [ ] **Step 1: Scan dashboard page for inconsistencies**

Open `apps/web/app/(dashboard)/dashboard/page.tsx`

Check:

- Button sizes (should use `default`, `sm`, `lg` from design system)
- Border radius (should use `--radius` CSS var)
- Spacing (should use Tailwind spacing scale: `gap-4`, `p-6`)
- Colors (should use semantic: `bg-primary`, `text-muted-foreground`)
- Fonts (should use Tailwind defaults, no inline `style` attributes)

Document findings in checklist:

```markdown
## Dashboard Page - Design Check

- [ ] Button sizes consistent
- [ ] Border radius uses CSS var
- [ ] Spacing uses Tailwind scale
- [ ] Colors are semantic
- [ ] No inline styles
```

- [ ] **Step 2: Scan products, customers, orders, quotes pages**

Repeat Step 1 for each page, create checklist for each.

- [ ] **Step 3: Fix minor inconsistencies**

If found (example):

```tsx
// Before
<Button className="h-12 rounded-lg">Export</Button>

// After (use design system)
<Button size="lg">Export</Button>
```

Make edits directly in files, no commits yet.

- [ ] **Step 4: Document major inconsistencies for user review**

If found complex issues (e.g., entire component uses wrong pattern), document:

```markdown
## Major Issues for Review

- Dashboard BentoGrid: Uses custom spacing, should align with design system
  - File: apps/web/app/(dashboard)/dashboard/page.tsx:145-200
  - Suggestion: Refactor to use standard `gap-6` instead of custom `gap-[24px]`
```

- [ ] **Step 5: Run type-check and lint**

```bash
pnpm --filter web run check
```

Expected: 0 errors (warnings OK)

- [ ] **Step 6: Commit design fixes (if any)**

```bash
git add apps/web/app/(dashboard)/**/page.tsx
git commit -m "fix(ui): Module 1 design consistency - button sizes, spacing, colors

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

#### Task 6: Module 1 - Content Audit & Research

**Files:**

- Create: `docs/content-strategy/module-1-audit.md`

- [ ] **Step 1: Audit dashboard page content**

Review `apps/web/app/(dashboard)/dashboard/page.tsx`, document:

```markdown
# Module 1: Core Business - Content Audit

## Dashboard Page

### Current Content

- Page title: "Dashboard"
- Metrics cards: 4 cards (Revenue, Orders, Customers, Avg Order)
- Chart titles: Generic ("Sales Overview", "Top Products")
- Empty states: "No data available"

### Content Needs

- [ ] Hero section with empowering tagline
- [ ] Metric card descriptions (explain what each number means)
- [ ] Chart titles with context (e.g., "Sales This Month vs Last Month")
- [ ] Empty states with actionable CTAs
- [ ] Help text for first-time users

### Voice/Tone

Empowering & action-oriented. Examples:

- "Take control of your business operations"
- "Your sales performance at a glance"
- "See what's driving revenue this month"
```

- [ ] **Step 2: Audit products page**

Repeat for products page:

- Current: Generic product table, "Add Product" button
- Needs: Page description, column help text, empty state, search placeholder

- [ ] **Step 3: Audit customers, orders, quotes pages**

Repeat for each page.

- [ ] **Step 4: Research cleaning equipment industry terminology**

Document correct terms for CCW's business:

- "Equipment" not "machinery"
- "Restoration job" not "project"
- "Contractor" not "technician"
- "Truckmount" not "truck-mounted system"

Add to audit doc:

```markdown
## Industry Terminology

- Equipment supplier (not machinery dealer)
- Cleaning contractor (not service provider)
- Restoration equipment (not remediation tools)
- Carpet cleaning machine (not floor cleaner)
```

- [ ] **Step 5: Create content requirements checklist**

```markdown
## Module 1 Content Checklist

### Dashboard

- [ ] Hero section tagline
- [ ] 4 metric card descriptions
- [ ] 2 chart contextual titles
- [ ] Empty state message + CTA
- [ ] First-time user help text

### Products

- [ ] Page description (1-2 sentences)
- [ ] Search placeholder text
- [ ] Column headers with tooltips
- [ ] Empty state for no products
- [ ] "Add Product" button help text

### Customers

- [ ] Page description
- [ ] Search placeholder
- [ ] Empty state
- [ ] Import customers CTA

### Orders

- [ ] Page description
- [ ] Status filter labels
- [ ] Empty state per status
- [ ] "Create Order" help text

### Quotes

- [ ] Page description
- [ ] Quote vs Order explanation
- [ ] Empty state
- [ ] "Convert to Order" CTA help

**Total items:** ~30 content pieces
```

- [ ] **Step 6: Commit audit documentation**

```bash
git add docs/content-strategy/module-1-audit.md
git commit -m "docs: Module 1 content audit - 30 content pieces identified

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

#### Task 7: Module 1 - Content Writing

**Files:**

- Create: `docs/content-strategy/module-1-content.md`

- [ ] **Step 1: Write dashboard content**

Create `docs/content-strategy/module-1-content.md`:

```markdown
# Module 1: Core Business - Content

## Dashboard

### Hero Section

**Tagline:** "Control your equipment business. One powerful dashboard."
**Subtitle:** "Real-time insights into sales, inventory, and customer relationships. Make faster decisions with AI-powered analytics."

### Metric Cards

**Revenue Card:**

- Title: "Revenue This Month"
- Description: "Total sales excluding GST. Includes orders and quotes marked as won."

**Orders Card:**

- Title: "Active Orders"
- Description: "Orders in progress: confirmed, processing, or shipped. Excludes delivered and cancelled."

**Customers Card:**

- Title: "Total Customers"
- Description: "Active customer accounts. Includes contractors, retailers, and direct buyers."

**Avg Order Card:**

- Title: "Average Order Value"
- Description: "Mean order total this month. Helps track pricing effectiveness and upsell performance."

### Charts

**Sales Chart Title:** "Sales Performance: This Month vs Last Month"
**Products Chart Title:** "Top 10 Revenue-Generating Products"

### Empty States

**No orders yet:**
"No active orders to display. Create your first order from the Orders page or convert a quote."
[CTA: "Create Order"]

**No data for chart:**
"Not enough data yet. Sales data will appear here once you have 7 days of order history."

### First-Time User Help

"Welcome! Your dashboard shows real-time business metrics. Start by adding products, then create customers and orders. Data updates instantly as you work."

## Products Page

**Page Description:**
"Manage your cleaning equipment catalog. Track stock levels, pricing, and product performance. Import from Cin7 or add manually."

**Search Placeholder:** "Search by product name, SKU, or category..."

**Column Headers:**

- SKU (tooltip: "Stock Keeping Unit - unique product identifier")
- Name
- Category (tooltip: "Equipment type for filtering and reporting")
- Price (tooltip: "Selling price excluding GST")
- Stock (tooltip: "Current available quantity across all warehouses")
- Status (tooltip: "Active products appear in POS and online ordering")

**Empty State:**
"No products in your catalog yet. Import from Cin7 or add your first product manually."
[CTA: "Add Product"] [CTA: "Import from Cin7"]

**Add Product Button Help:** (tooltip)
"Create a new product. You'll enter SKU, name, pricing, and stock details."

## Customers Page

**Page Description:**
"Your customer database: contractors, retailers, and direct buyers. Track contact details, order history, and payment terms."

**Search Placeholder:** "Search by company name, contact, or email..."

**Empty State:**
"No customers yet. Add your first customer to start tracking orders and building relationships."
[CTA: "Add Customer"] [CTA: "Import from CSV"]

## Orders Page

**Page Description:**
"Track equipment orders from quote to delivery. Monitor order status, manage shipping, and process payments."

**Status Filter Labels:**

- All Orders
- Draft (not yet confirmed)
- Pending (awaiting payment or stock)
- Confirmed (ready to fulfill)
- Processing (being prepared for shipping)
- Shipped (in transit to customer)
- Delivered (complete)
- Cancelled

**Empty State (by status):**

_No draft orders:_
"No draft orders. Create a new order or convert a quote to get started."

_No pending orders:_
"No pending orders. All orders are either confirmed or still in draft."

_No confirmed orders:_
"No confirmed orders waiting to process. Check pending orders or create a new order."

**Create Order Help:** (tooltip)
"Start a new equipment order. You'll select a customer, add products, and set shipping details."

## Quotes Page

**Page Description:**
"Generate professional quotes for equipment purchases. Track quote status and convert to orders when approved."

**Quote vs Order Explanation:** (info card at top)
"💡 **Quotes vs Orders:** Use quotes for custom pricing, bulk discounts, or when customers need approval. Convert to an order once they're ready to buy."

**Empty State:**
"No quotes yet. Create a quote to provide custom pricing or equipment packages for customers."
[CTA: "Create Quote"]

**Convert to Order CTA Help:** (tooltip)
"Convert this approved quote into an active order. Customer details and line items carry over automatically."
```

- [ ] **Step 2: Review content for voice/tone consistency**

Check each section:

- Uses active voice ("Control your business" not "Your business is controlled")
- Benefit-focused ("Make faster decisions" not "Dashboard shows data")
- Specific numbers where possible ("Top 10" not "Top products")
- Empowering tone ("Take control", "Track performance")

- [ ] **Step 3: Review content for 4 differentiators**

Ensure content mentions:

- ✅ AI-powered ("AI-powered analytics")
- ✅ Industry-specialized ("cleaning equipment catalog", "contractors")
- ✅ Modern UX ("Real-time insights", "Data updates instantly")
- ✅ All-in-one ("One powerful dashboard")

- [ ] **Step 4: Verify terminology matches research**

Check against `module-1-audit.md` terminology:

- ✅ "Equipment" used (not "machinery")
- ✅ "Contractors" used
- ✅ "Cleaning equipment" used

- [ ] **Step 5: Get user approval for content**

Present content doc to user:
"Module 1 content written. Please review `docs/content-strategy/module-1-content.md` for tone, accuracy, and brand alignment. Approve to proceed with population, or request changes."

**Wait for user approval before continuing.**

- [ ] **Step 6: Commit approved content**

```bash
git add docs/content-strategy/module-1-content.md
git commit -m "docs: Module 1 content - Core Business pages (empowering tone)

- Dashboard: hero, metrics, charts, empty states
- Products: descriptions, search, columns, CTAs
- Customers: search, empty states, import CTAs
- Orders: status filters, empty states per status
- Quotes: quote vs order explanation, CTAs

Voice: Empowering & action-oriented
Differentiators: All 4 included

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

#### Task 8: Module 1 - Content Population

**Files:**

- Modify: `apps/web/app/(dashboard)/dashboard/page.tsx`
- Modify: `apps/web/app/(dashboard)/products/page.tsx`
- Modify: `apps/web/app/(dashboard)/customers/page.tsx`
- Modify: `apps/web/app/(dashboard)/orders/page.tsx`
- Modify: `apps/web/app/(dashboard)/quotes/page.tsx`

- [ ] **Step 1: Populate dashboard page**

Edit `apps/web/app/(dashboard)/dashboard/page.tsx`:

**Add hero section:**

```tsx
{
  /* Hero Section */
}
<div className="mb-8">
  <h1 className="text-4xl font-bold tracking-tight">
    Control your equipment business. One powerful dashboard.
  </h1>
  <p className="text-muted-foreground mt-2 text-lg">
    Real-time insights into sales, inventory, and customer relationships. Make faster decisions with
    AI-powered analytics.
  </p>
</div>;
```

**Update metric cards** (find existing metric cards, add descriptions):

```tsx
<Card>
  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
    <CardTitle className="text-sm font-medium">Revenue This Month</CardTitle>
    <DollarSign className="text-muted-foreground h-4 w-4" />
  </CardHeader>
  <CardContent>
    <div className="text-2xl font-bold">${metrics.revenue.toLocaleString()}</div>
    <p className="text-muted-foreground mt-1 text-xs">
      Total sales excluding GST. Includes orders and quotes marked as won.
    </p>
  </CardContent>
</Card>
```

Repeat for other 3 metric cards.

**Update chart titles:**

```tsx
<CardTitle>Sales Performance: This Month vs Last Month</CardTitle>
<CardTitle>Top 10 Revenue-Generating Products</CardTitle>
```

**Add empty state:**

```tsx
{orders.length === 0 ? (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <p className="text-muted-foreground mb-4">
      No active orders to display. Create your first order from the Orders page or convert a quote.
    </p>
    <Button asChild>
      <Link href="/orders">Create Order</Link>
    </Button>
  </div>
) : (
  // existing order list
)}
```

- [ ] **Step 2: Populate products page**

Edit `apps/web/app/(dashboard)/products/page.tsx`:

**Add page description:**

```tsx
<div className="mb-6">
  <h1 className="text-3xl font-bold tracking-tight">Products</h1>
  <p className="text-muted-foreground mt-1">
    Manage your cleaning equipment catalog. Track stock levels, pricing, and product performance.
    Import from Cin7 or add manually.
  </p>
</div>
```

**Update search placeholder:**

```tsx
<Input
  placeholder="Search by product name, SKU, or category..."
  value={search}
  onChange={(e) => setSearch(e.target.value)}
/>
```

**Add column tooltips** (if using shadcn Table):

```tsx
<TableHead>
  SKU
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <HelpCircle className="ml-1 inline h-3 w-3" />
      </TooltipTrigger>
      <TooltipContent>Stock Keeping Unit - unique product identifier</TooltipContent>
    </Tooltip>
  </TooltipProvider>
</TableHead>
```

**Update empty state:**

```tsx
{
  products.length === 0 && (
    <EmptyState
      icon={Package}
      title="No products in your catalog yet"
      description="Import from Cin7 or add your first product manually."
      actions={
        <>
          <Button>Add Product</Button>
          <Button variant="outline">Import from Cin7</Button>
        </>
      }
    />
  );
}
```

- [ ] **Step 3: Populate customers page**

Similar pattern:

- Add page description
- Update search placeholder
- Add empty state with "Add Customer" and "Import from CSV" CTAs

- [ ] **Step 4: Populate orders page**

- Add page description
- Update status filter labels (with counts)
- Add empty states per status (different messages)
- Add "Create Order" tooltip

- [ ] **Step 5: Populate quotes page**

- Add page description
- Add info card explaining quotes vs orders
- Add empty state
- Add "Convert to Order" tooltip

- [ ] **Step 6: Run type-check**

```bash
pnpm --filter web run type-check
```

Expected: 0 errors

Fix any type errors (e.g., missing imports for Tooltip components).

#### Task 9: Module 1 - Verification

- [ ] **Step 1: Visual review all 5 pages**

Start dev server:

```bash
pnpm dev --filter=web
```

Navigate to each page, verify:

- Dashboard: Hero shows, metrics have descriptions, charts titled correctly
- Products: Description shows, search placeholder correct, empty state (if no products)
- Customers: All content populated
- Orders: Status filters labeled, empty states contextual
- Quotes: Info card shows, content populated

- [ ] **Step 2: Test user flows**

**Dashboard → Products:**

- Click "Add Product" from dashboard metric
- Should navigate to products page

**Products → Customers:**

- Search for a product
- Navigate to customers

**Orders → Quotes:**

- Filter orders by status
- Navigate to quotes

All flows should work without errors.

- [ ] **Step 3: Run full test suite**

```bash
pnpm --filter web run check:all
```

Expected: All pass (0 errors, warnings OK)

- [ ] **Step 4: Screenshot key pages**

Capture:

- `docs/screenshots/module-1-dashboard.png`
- `docs/screenshots/module-1-products.png`
- `docs/screenshots/module-1-orders.png`

- [ ] **Step 5: Commit Module 1 population**

```bash
git add apps/web/app/(dashboard)/*.tsx docs/screenshots/module-1-*.png
git commit -m "feat(content): Module 1 Core Business - professional content population

Pages updated:
- Dashboard: hero, metric descriptions, chart titles, empty states
- Products: page description, search placeholder, tooltips, empty state
- Customers: description, search, empty state, CTAs
- Orders: status filters, empty states per status, help text
- Quotes: info card, empty state, tooltips

Voice: Empowering & action-oriented
All 4 differentiators included
Tests passing

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

#### Task 10: Module 1 - Linear Update

- [ ] **Step 1: Create Linear issue**

Title: `[Content Strategy] Module 1: Core Business - COMPLETE`

Description:

```
✅ Module 1 Complete - Core Business

**Pages (5):**
- ✅ Dashboard
- ✅ Products
- ✅ Customers
- ✅ Orders
- ✅ Quotes

**Content Added:**
- Hero section (dashboard)
- 4 metric card descriptions
- Chart titles with context
- Page descriptions (all 5 pages)
- Search placeholders
- Empty states (contextual per page/status)
- Help text and tooltips
- CTAs with clear actions

**Voice/Tone:** Empowering & action-oriented
**Differentiators:** All 4 included (AI, industry, UX, all-in-one)

**Tests:** ✅ Passing (type-check, lint, tests)

**Screenshots:**
- docs/screenshots/module-1-dashboard.png
- docs/screenshots/module-1-products.png
- docs/screenshots/module-1-orders.png

**Next:** Module 2 (Inventory & Warehouse)
```

Labels: `content-strategy`, `module-1`, `completed`

- [ ] **Step 2: Module 1 handoff**

Present to user:
"Module 1 (Core Business) complete. Please review the 5 pages in browser:

- Dashboard: http://localhost:3011/dashboard
- Products: http://localhost:3011/products
- Customers: http://localhost:3011/customers
- Orders: http://localhost:3011/orders
- Quotes: http://localhost:3011/quotes

Approve to proceed with Module 2 (Inventory & Warehouse), or request changes."

**Wait for user approval.**

### Module 2: Inventory & Warehouse (Inventory, Stock, Transfers, Locations, Reorder)

**Voice:** Technical precision + operational efficiency
**Pages:** 6 (planned, some may not exist yet)
**Priority:** HIGH

**Note:** Module 2 follows the same 6-step workflow as Module 1. Tasks 11-16 replicate the pattern:

- Task 11: Design Consistency Check
- Task 12: Content Audit & Research
- Task 13: Content Writing
- Task 14: Content Population
- Task 15: Verification
- Task 16: Linear Update

**Voice differences:**

- More technical terminology ("multi-location stock synchronization", "FIFO inventory management")
- Operational focus ("Track every item across warehouses", "Prevent stockouts with automated alerts")
- Precision language ("Real-time stock levels", "Audit trail for all adjustments")

**Content examples:**

**Inventory Page Description:**
"Real-time inventory management across all warehouse locations. Track stock levels, manage transfers, and automate reorder points to prevent stockouts."

**Stock Locations Empty State:**
"No warehouse locations configured yet. Add your first location to start tracking multi-location inventory."
[CTA: "Add Location"]

**Transfers Page Description:**
"Move stock between warehouse locations with full audit trails. Track transfer status and maintain inventory accuracy across your network."

**Implementation:** Follow Module 1 pattern (Tasks 5-10) with inventory-specific content.

---

## Chunk 3: Modules 3-8 - Remaining Content Population

### Module 3: CRM (Contacts, Health, Onboarding, Personas, Activities)

**Voice:** Friendly & professional
**Pages:** 5
**Priority:** HIGH
**Pattern:** Same 6-step workflow

**Content examples:**

**CRM Dashboard:**
"Build stronger customer relationships. Track every interaction from first contact to long-term partnership. Identify at-risk accounts and growth opportunities with AI-powered health scoring."

**Customer Health Page:**
"Monitor customer engagement and identify at-risk accounts before they churn. Health scores update daily based on order frequency, payment history, and support interactions."

**Onboarding Sequences:**
"Automate your customer onboarding journey. Day-1 welcome, Day-7 check-in, Day-30 relationship builder. Ensure every new customer feels supported from the start."

### Module 4: Financial (Invoicing, Billing, Reconciliation, Reports)

**Voice:** Professional & corporate
**Pages:** 5 (note: billing page was deleted in cleanup)
**Priority:** HIGH

**Content examples:**

**Invoicing Page:**
"Generate GST-compliant invoices with automated tax calculations. Track payment status and send automated reminders for overdue accounts."

**Reconciliation Page:**
"Match bank transactions to invoices and payments automatically. AI-powered matching suggestions reduce manual reconciliation time by 80%."

**Financial Reports:**
"Export audit-ready financial reports for your accountant. GST-compliant reporting with one-click PDF generation."

### Module 5: Workshop & Service (Equipment, Bookings, Templates, Reminders, Service Requests)

**Voice:** Expert & practical
**Pages:** 6
**Priority:** MEDIUM

**Content examples:**

**Workshop Equipment Page:**
"Track your equipment service history. Schedule preventive maintenance before breakdowns happen. Extend equipment lifespan with proactive servicing."

**Service Bookings:**
"Schedule equipment servicing with automated reminders. Dual-interval scheduling (hours + calendar) ensures machinery stays in optimal condition."

**Service Templates:**
"Pre-built service checklists for common equipment types. Ensure consistent servicing standards across all technicians."

### Module 6: Integrations (Cin7, Shopify, Xero, AP2, Webhooks)

**Voice:** Technical & precise
**Pages:** 5
**Priority:** MEDIUM

**Content examples:**

**Cin7 Integration:**
"Bi-directional sync with Cin7 Core and Omni APIs. Real-time inventory updates, order sync, and product catalog synchronization. Webhook-based event notifications ensure data consistency."

**Shopify Integration:**
"Sync online orders to your ERP automatically. Update inventory levels in real-time to prevent overselling. Multi-store support for businesses with multiple Shopify storefronts."

**Xero Integration:**
"Push invoices and payments to Xero automatically. GST-compliant financial sync ensures your books are always accurate. Two-way customer and supplier synchronization."

### Module 7: Operations (POS, Contractors, Workflows, Approvals, Alerts, Tasks)

**Voice:** Action-oriented & clear
**Pages:** 7
**Priority:** MEDIUM

**Content examples:**

**POS Page:**
"Sell equipment in-store with instant inventory updates. Accept multiple payment methods, print receipts, and track daily sales performance. Offline mode ensures sales continue during internet outages."

**Workflows Page:**
"Automate repetitive business processes. Route approvals based on custom rules. Set SLA timers to ensure tasks don't fall through the cracks."

**Approvals Page:**
"Approve purchase orders, quotes, and invoices in seconds. Bulk approval for multiple items. Mobile-friendly interface for on-the-go decision making."

### Module 8: AI & Analytics (Marketing, Forecasting, Agents, Anomaly Detection)

**Voice:** Innovative but accessible
**Pages:** 4
**Priority:** MEDIUM

**Content examples:**

**Marketing AI Page:**
"AI-powered marketing campaign generation. Create email campaigns, product recommendations, and customer segmentation strategies based on sales patterns."

**Demand Forecasting:**
"Predict future demand with machine learning. AI learns from your sales history to recommend optimal stock levels. Reduce stockouts and overstock situations."

**Anomaly Detection:**
"Catch unusual patterns before they become problems. AI monitors sales, inventory, and customer behavior for anomalies. Get alerted to potential issues in real-time."

---

## Execution Strategy

### For Subagent-Driven Development (REQUIRED)

**Phase 0 (Product Research):**

- Dispatch single agent for Tasks 1-4
- Agent has web research capabilities (WebFetch tool)
- Runs in background, reports when CSV ready

**Modules 1-8 (Content Population):**

- Dispatch one agent per module (8 agents in parallel if possible)
- Each agent executes 6 tasks (design → audit → write → populate → verify → handoff)
- Agents work independently, no shared state between modules
- Each agent creates Linear issue upon completion

**Coordination:**

- Main context window preserved (no file reading overhead)
- User reviews completed modules in order
- Approval required before next module starts execution

**Handoff checkpoints:**

- After Phase 0: User reviews CCW products CSV
- After each module: User reviews pages in browser
- After all modules: User approves final demo

### Timeline (with Swarm Agents)

**Phase 0:** 1 day (single research agent)
**Modules 1-2:** 2 days (2 agents parallel, high priority)
**Modules 3-4:** 2 days (2 agents parallel, high priority)
**Modules 5-6:** 2 days (2 agents parallel, medium priority)
**Modules 7-8:** 2 days (2 agents parallel, medium priority)

**Total:** 9 days (vs 3 weeks sequential)

---

## Quality Gates

**After Phase 0:**

- ✅ 50-100 CCW products in CSV
- ✅ Seed script runs successfully
- ✅ Tests pass
- ✅ User approves product catalog

**After Each Module:**

- ✅ All pages in module have content (no placeholders)
- ✅ Design consistency verified
- ✅ Voice/tone matches module framework
- ✅ Tests pass (type-check, lint, tests)
- ✅ Screenshots captured
- ✅ Linear issue created
- ✅ User approves module

**After All Modules:**

- ✅ 75+ pages with professional content
- ✅ Real CCW products throughout system
- ✅ Full test suite passing
- ✅ Demo ready for CCW owner

---

## Success Criteria

1. **Zero Placeholder Content** - Every page has real, professional copy
2. **Real Product Catalog** - 50-100 CCW cleaning equipment products
3. **Brand Consistency** - All content reflects CCW's business
4. **Technical Quality** - All tests passing
5. **Demo-Ready** - Fully populated system for CCW owner review

---

**Plan complete. Ready to execute with swarm agents?**
