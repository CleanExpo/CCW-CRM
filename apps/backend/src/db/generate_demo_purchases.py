"""Generate demonstration purchases using real Shopify data.

This script:
1. Connects to CCWonline.com.au Shopify store
2. Fetches real product data
3. Creates 5 realistic purchase scenarios:
   - Large equipment order (delivered)
   - Medium order with multiple items (shipped)
   - Small order (processing)
   - Quote converted to order (confirmed)
   - Recent quote awaiting customer approval (sent)

Usage:
    Set environment variables first:
    - SHOPIFY_MODE=live
    - SHOPIFY_SHOP_DOMAIN=ccwonline.myshopify.com (or your actual domain)
    - SHOPIFY_ACCESS_TOKEN=<your_access_token>

    Then run:
    cd apps/backend
    uv run python -m src.db.generate_demo_purchases
"""

import asyncio
import random
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import AsyncSessionLocal, async_engine
from src.config.shopify_settings import get_shopify_settings
from src.db.demo_models import (
    Customer,
    Order,
    OrderItem,
    OrderStatus,
    Product,
    ProductCategory,
    Quote,
    QuoteItem,
    QuoteStatus,
)
from src.db.models_base import Base
from src.integrations.shopify.client import get_shopify_client

# Demonstration customer profiles
DEMO_CUSTOMERS = [
    {
        "company_name": "Brisbane Construction Co",
        "contact_name": "Sarah Mitchell",
        "email": "sarah.mitchell@brisbaneconstruction.com.au",
        "phone": "0412 345 678",
        "address": "45 Industrial Drive",
        "city": "Brisbane",
        "state": "QLD",
        "postcode": "4000",
        "scenario": "Large equipment purchase for new project",
    },
    {
        "company_name": "Gold Coast Electrical Services",
        "contact_name": "James Chen",
        "email": "james.chen@gcelectrical.com.au",
        "phone": "0423 456 789",
        "address": "12 Marina Boulevard",
        "city": "Gold Coast",
        "state": "QLD",
        "postcode": "4217",
        "scenario": "Regular stock replenishment",
    },
    {
        "company_name": "Sunshine Coast Plumbing",
        "contact_name": "Emma Roberts",
        "email": "emma.roberts@scplumbing.com.au",
        "phone": "0434 567 890",
        "address": "78 Coastal Way",
        "city": "Maroochydore",
        "state": "QLD",
        "postcode": "4558",
        "scenario": "Urgent replacement parts",
    },
    {
        "company_name": "Toowoomba Building Supplies",
        "contact_name": "Michael Thompson",
        "email": "michael.thompson@toowoombabuild.com.au",
        "phone": "0445 678 901",
        "address": "156 Range Street",
        "city": "Toowoomba",
        "state": "QLD",
        "postcode": "4350",
        "scenario": "Quote for bulk order - converted to purchase",
    },
    {
        "company_name": "Cairns Industrial Equipment",
        "contact_name": "Lisa Anderson",
        "email": "lisa.anderson@cairnsindustrial.com.au",
        "phone": "0456 789 012",
        "address": "34 Port Road",
        "city": "Cairns",
        "state": "QLD",
        "postcode": "4870",
        "scenario": "Quote pending customer approval",
    },
]


async def fetch_shopify_products(limit: int = 50) -> list[dict]:
    """Fetch real products from Shopify store.

    Args:
        limit: Maximum number of products to fetch

    Returns:
        List of product dictionaries from Shopify
    """
    settings = get_shopify_settings()

    if settings.is_demo_mode:
        print("WARNING: Running in DEMO mode. No real Shopify data will be fetched.")
        print("   Set SHOPIFY_MODE=live to fetch real products from CCWonline.com.au")
        return []

    print(f"\n[SHOPIFY] Connecting to {settings.shop_domain}...")

    async with get_shopify_client(settings) as client:
        try:
            # Fetch shop info to verify connection
            shop_info = await client.get_shop_info()
            print(f"[SHOPIFY] Connected to: {shop_info.get('shop', {}).get('name', 'Unknown')}")

            # Fetch products
            print(f"[SHOPIFY] Fetching up to {limit} products...")
            response = await client.get_products(limit=limit, published_status="any")
            products = response.get("products", [])

            print(f"[SHOPIFY] Successfully fetched {len(products)} products")

            if len(products) == 0:
                print("WARNING: No products found in Shopify store.")
                print("   Please ensure products exist in your CCWonline.com.au store.")

            return products

        except Exception as e:
            print(f"[ERROR] Failed to fetch Shopify products: {e}")
            print("   Please check:")
            print("   1. SHOPIFY_SHOP_DOMAIN is correct (e.g., ccwonline.myshopify.com)")
            print("   2. SHOPIFY_ACCESS_TOKEN is valid")
            print("   3. API access is enabled for your store")
            return []


def map_shopify_product_to_erp(shopify_product: dict) -> dict:
    """Map Shopify product to ERP product format.

    Args:
        shopify_product: Product data from Shopify API

    Returns:
        Dictionary with ERP product fields
    """
    # Extract first variant (most Shopify products have at least one variant)
    variants = shopify_product.get("variants", [])
    first_variant = variants[0] if variants else {}

    # Map product category based on product type or tags
    product_type = shopify_product.get("product_type", "").lower()
    tags = [tag.lower() for tag in shopify_product.get("tags", "").split(",")]

    # Category mapping logic
    category = ProductCategory.ACCESSORIES  # Default
    if any(keyword in product_type for keyword in ["machinery", "excavator", "loader", "forklift"]):
        category = ProductCategory.HEAVY_MACHINERY
    elif any(keyword in product_type for keyword in ["power tool", "drill", "saw", "grinder"]):
        category = ProductCategory.POWER_TOOLS
    elif any(keyword in product_type for keyword in ["hand tool", "hammer", "wrench", "screwdriver"]):
        category = ProductCategory.HAND_TOOLS
    elif any(keyword in product_type for keyword in ["safety", "ppe", "helmet", "gloves"]):
        category = ProductCategory.SAFETY_EQUIPMENT
    elif any(keyword in product_type for keyword in ["building", "lumber", "cement", "concrete"]):
        category = ProductCategory.BUILDING_MATERIALS
    elif any(keyword in product_type for keyword in ["electrical", "wire", "cable", "outlet"]):
        category = ProductCategory.ELECTRICAL
    elif any(keyword in product_type for keyword in ["plumbing", "pipe", "faucet", "valve"]):
        category = ProductCategory.PLUMBING

    # Get pricing (Shopify prices are strings)
    price = Decimal(first_variant.get("price", "0.00"))
    compare_at_price = first_variant.get("compare_at_price")
    cost = Decimal(compare_at_price) if compare_at_price else price * Decimal("0.6")  # Estimate 40% margin

    # Get inventory
    inventory_quantity = first_variant.get("inventory_quantity", 0)

    # SKU (use variant SKU or generate from product ID)
    sku = first_variant.get("sku") or f"SHOP-{shopify_product.get('id')}"

    return {
        "sku": sku,
        "name": shopify_product.get("title", "Unknown Product"),
        "description": shopify_product.get("body_html", "")[:500],  # Limit description length
        "category": category,
        "price": price,
        "cost": cost,
        "stock": max(0, inventory_quantity),  # Ensure non-negative
        "warehouse_location": "Brisbane Main",  # Default warehouse
        "is_active": shopify_product.get("status") == "active",
        "shopify_id": shopify_product.get("id"),  # Store for reference
        "shopify_variant_id": first_variant.get("id"),
    }


async def sync_shopify_products_to_erp(db: AsyncSession, shopify_products: list[dict]) -> list[Product]:
    """Sync Shopify products to ERP database.

    Args:
        db: Database session
        shopify_products: List of Shopify product dictionaries

    Returns:
        List of created/updated Product objects
    """
    if not shopify_products:
        print("[PRODUCTS] No Shopify products to sync. Using existing ERP products.")
        # Return existing products from database
        result = await db.execute(select(Product).where(Product.is_active == True).limit(50))  # noqa: E712
        return list(result.scalars().all())

    print(f"\n[PRODUCTS] Syncing {len(shopify_products)} products to ERP...")

    synced_products = []

    for shopify_product in shopify_products:
        erp_data = map_shopify_product_to_erp(shopify_product)

        # Check if product already exists by SKU
        result = await db.execute(select(Product).where(Product.sku == erp_data["sku"]))
        existing_product = result.scalar_one_or_none()

        if existing_product:
            # Update existing product
            for key, value in erp_data.items():
                if key != "shopify_id" and key != "shopify_variant_id":  # Don't overwrite IDs
                    setattr(existing_product, key, value)
            synced_products.append(existing_product)
            print(f"   [OK] Updated: {erp_data['sku']} - {erp_data['name'][:50]}")
        else:
            # Create new product
            product = Product(**{k: v for k, v in erp_data.items() if k not in ["shopify_id", "shopify_variant_id"]})
            db.add(product)
            synced_products.append(product)
            print(f"   [OK] Created: {erp_data['sku']} - {erp_data['name'][:50]}")

    await db.commit()
    print(f"[PRODUCTS] Successfully synced {len(synced_products)} products")

    return synced_products


async def create_demo_customers(db: AsyncSession) -> list[Customer]:
    """Create demonstration customers.

    Args:
        db: Database session

    Returns:
        List of created Customer objects
    """
    print("\n[CUSTOMERS] Creating demonstration customers...")

    customers = []
    customer_number = 5000  # Start from 5000 for demo customers

    for customer_data in DEMO_CUSTOMERS:
        # Check if customer already exists
        result = await db.execute(select(Customer).where(Customer.email == customer_data["email"]))
        existing_customer = result.scalar_one_or_none()

        if existing_customer:
            customers.append(existing_customer)
            print(f"   [OK] Using existing: {existing_customer.company_name}")
            continue

        customer = Customer(
            customer_number=f"DEMO-{customer_number:05d}",
            company_name=customer_data["company_name"],
            contact_name=customer_data["contact_name"],
            email=customer_data["email"],
            phone=customer_data["phone"],
            address=customer_data["address"],
            city=customer_data["city"],
            state=customer_data["state"],
            postcode=customer_data["postcode"],
            is_active=True,
        )
        db.add(customer)
        customers.append(customer)
        customer_number += 1
        print(f"   [OK] Created: {customer.company_name} ({customer.contact_name})")

    await db.commit()
    print(f"[CUSTOMERS] Successfully created {len(customers)} demonstration customers")

    return customers


async def create_purchase_scenario_1(
    db: AsyncSession,
    customer: Customer,
    products: list[Product],
    quote_num: int,
    order_num: int,
) -> tuple[Quote, Order]:
    """Scenario 1: Large equipment order (delivered).

    High-value order with multiple items. Quote was sent 3 weeks ago,
    converted to order 2 weeks ago, and delivered last week.
    """
    print("\n[SCENARIO 1] Large equipment purchase - DELIVERED")
    print(f"   Customer: {customer.company_name}")

    now = datetime.now(UTC)

    # Select high-value products (5-7 items)
    selected_products = random.sample([p for p in products if p.price > 100], min(7, len(products)))

    # Create Quote (3 weeks ago)
    quote_date = now - timedelta(days=21)
    valid_until = quote_date + timedelta(days=30)

    quote = Quote(
        quote_number=f"QT-DEMO-{quote_num:06d}",
        customer_id=customer.id,
        status=QuoteStatus.ACCEPTED,  # Quote was accepted
        quote_date=quote_date,
        valid_until=valid_until,
        total=Decimal(0),
        notes="Large equipment order for new construction project. 10% bulk discount applied.",
    )
    db.add(quote)
    await db.flush()

    # Add quote items with bulk discount
    quote_total = Decimal(0)
    for product in selected_products:
        quantity = random.randint(2, 5)
        discount = Decimal("0.90")  # 10% bulk discount
        unit_price = (product.price * discount).quantize(Decimal("0.01"))
        line_total = (Decimal(quantity) * unit_price).quantize(Decimal("0.01"))

        quote_item = QuoteItem(
            quote_id=quote.id,
            product_id=product.id,
            quantity=quantity,
            unit_price=unit_price,
            line_total=line_total,
        )
        db.add(quote_item)
        quote_total += line_total

    # Prices include GST (10% Australian tax is already in the price)
    quote.total = quote_total

    print(f"   [OK] Quote {quote.quote_number}: ${quote.total:,.2f} (ACCEPTED)")

    # Create Order (2 weeks ago, converted from quote)
    order_date = now - timedelta(days=14)

    order = Order(
        order_number=f"SO-DEMO-{order_num:06d}",
        customer_id=customer.id,
        status=OrderStatus.DELIVERED,
        order_date=order_date,
        total=quote.total,
        notes=f"Converted from quote {quote.quote_number}. Delivered on schedule.",
    )
    db.add(order)
    await db.flush()

    # Copy quote items to order items
    for product in selected_products:
        quantity = random.randint(2, 5)
        unit_price = (product.price * Decimal("0.90")).quantize(Decimal("0.01"))
        line_total = (Decimal(quantity) * unit_price).quantize(Decimal("0.01"))

        order_item = OrderItem(
            order_id=order.id,
            product_id=product.id,
            quantity=quantity,
            unit_price=unit_price,
            line_total=line_total,
        )
        db.add(order_item)

    print(f"   [OK] Order {order.order_number}: ${order.total:,.2f} (DELIVERED)")
    print(f"   -> Items: {len(selected_products)}, Total: ${order.total:,.2f}")

    await db.commit()
    return quote, order


async def create_purchase_scenario_2(
    db: AsyncSession,
    customer: Customer,
    products: list[Product],
    order_num: int,
) -> Order:
    """Scenario 2: Medium order with multiple items (shipped).

    Regular stock replenishment order. No quote, direct order placed 5 days ago,
    currently in transit.
    """
    print("\n[SCENARIO 2] Regular stock replenishment - SHIPPED")
    print(f"   Customer: {customer.company_name}")

    now = datetime.now(UTC)

    # Select medium-value products (3-4 items)
    selected_products = random.sample([p for p in products if 50 < p.price < 500], min(4, len(products)))

    # Create Order (5 days ago)
    order_date = now - timedelta(days=5)

    order = Order(
        order_number=f"SO-DEMO-{order_num:06d}",
        customer_id=customer.id,
        status=OrderStatus.SHIPPED,
        order_date=order_date,
        total=Decimal(0),
        notes="Regular stock replenishment. Express shipping requested.",
    )
    db.add(order)
    await db.flush()

    # Add order items
    order_total = Decimal(0)
    for product in selected_products:
        quantity = random.randint(1, 3)
        unit_price = product.price
        line_total = (Decimal(quantity) * unit_price).quantize(Decimal("0.01"))

        order_item = OrderItem(
            order_id=order.id,
            product_id=product.id,
            quantity=quantity,
            unit_price=unit_price,
            line_total=line_total,
        )
        db.add(order_item)
        order_total += line_total

    # Prices include GST (10% Australian tax is already in the price)
    order.total = order_total

    print(f"   [OK] Order {order.order_number}: ${order.total:,.2f} (SHIPPED)")
    print(f"   -> Items: {len(selected_products)}, Total: ${order.total:,.2f}")

    await db.commit()
    return order


async def create_purchase_scenario_3(
    db: AsyncSession,
    customer: Customer,
    products: list[Product],
    order_num: int,
) -> Order:
    """Scenario 3: Small urgent order (processing).

    Urgent replacement parts order. Placed 2 days ago, currently being processed
    for expedited shipping.
    """
    print("\n[SCENARIO 3] Urgent replacement parts - PROCESSING")
    print(f"   Customer: {customer.company_name}")

    now = datetime.now(UTC)

    # Select low-value products (1-2 items)
    selected_products = random.sample([p for p in products if p.price < 200], min(2, len(products)))

    # Create Order (2 days ago)
    order_date = now - timedelta(days=2)

    order = Order(
        order_number=f"SO-DEMO-{order_num:06d}",
        customer_id=customer.id,
        status=OrderStatus.PROCESSING,
        order_date=order_date,
        total=Decimal(0),
        notes="URGENT: Replacement parts needed ASAP. Expedited shipping.",
    )
    db.add(order)
    await db.flush()

    # Add order items
    order_total = Decimal(0)
    for product in selected_products:
        quantity = random.randint(1, 2)
        unit_price = product.price
        line_total = (Decimal(quantity) * unit_price).quantize(Decimal("0.01"))

        order_item = OrderItem(
            order_id=order.id,
            product_id=product.id,
            quantity=quantity,
            unit_price=unit_price,
            line_total=line_total,
        )
        db.add(order_item)
        order_total += line_total

    # Prices include GST (10% Australian tax is already in the price)
    order.total = order_total

    print(f"   [OK] Order {order.order_number}: ${order.total:,.2f} (PROCESSING)")
    print(f"   -> Items: {len(selected_products)}, Total: ${order.total:,.2f}")

    await db.commit()
    return order


async def create_purchase_scenario_4(
    db: AsyncSession,
    customer: Customer,
    products: list[Product],
    quote_num: int,
    order_num: int,
) -> tuple[Quote, Order]:
    """Scenario 4: Quote converted to order (confirmed).

    Bulk order quote sent 1 week ago, accepted and converted to order yesterday.
    Order is confirmed and awaiting processing.
    """
    print("\n[SCENARIO 4] Quote converted to order - CONFIRMED")
    print(f"   Customer: {customer.company_name}")

    now = datetime.now(UTC)

    # Select mix of products (4-6 items)
    selected_products = random.sample(products, min(6, len(products)))

    # Create Quote (1 week ago)
    quote_date = now - timedelta(days=7)
    valid_until = quote_date + timedelta(days=30)

    quote = Quote(
        quote_number=f"QT-DEMO-{quote_num:06d}",
        customer_id=customer.id,
        status=QuoteStatus.ACCEPTED,
        quote_date=quote_date,
        valid_until=valid_until,
        total=Decimal(0),
        notes="Bulk order for ongoing project. Volume discount applied.",
    )
    db.add(quote)
    await db.flush()

    # Add quote items with volume discount
    quote_total = Decimal(0)
    for product in selected_products:
        quantity = random.randint(3, 8)
        discount = Decimal("0.95")  # 5% volume discount
        unit_price = (product.price * discount).quantize(Decimal("0.01"))
        line_total = (Decimal(quantity) * unit_price).quantize(Decimal("0.01"))

        quote_item = QuoteItem(
            quote_id=quote.id,
            product_id=product.id,
            quantity=quantity,
            unit_price=unit_price,
            line_total=line_total,
        )
        db.add(quote_item)
        quote_total += line_total

    # Prices include GST (10% Australian tax is already in the price)
    quote.total = quote_total

    print(f"   [OK] Quote {quote.quote_number}: ${quote.total:,.2f} (ACCEPTED)")

    # Create Order (yesterday, converted from quote)
    order_date = now - timedelta(days=1)

    order = Order(
        order_number=f"SO-DEMO-{order_num:06d}",
        customer_id=customer.id,
        status=OrderStatus.CONFIRMED,
        order_date=order_date,
        total=quote.total,
        notes=f"Converted from quote {quote.quote_number}. Ready for processing.",
    )
    db.add(order)
    await db.flush()

    # Copy quote items to order items
    for product in selected_products:
        quantity = random.randint(3, 8)
        unit_price = (product.price * Decimal("0.95")).quantize(Decimal("0.01"))
        line_total = (Decimal(quantity) * unit_price).quantize(Decimal("0.01"))

        order_item = OrderItem(
            order_id=order.id,
            product_id=product.id,
            quantity=quantity,
            unit_price=unit_price,
            line_total=line_total,
        )
        db.add(order_item)

    print(f"   [OK] Order {order.order_number}: ${order.total:,.2f} (CONFIRMED)")
    print(f"   -> Items: {len(selected_products)}, Total: ${order.total:,.2f}")

    await db.commit()
    return quote, order


async def create_purchase_scenario_5(
    db: AsyncSession,
    customer: Customer,
    products: list[Product],
    quote_num: int,
) -> Quote:
    """Scenario 5: Recent quote awaiting approval (sent).

    Quote sent 2 days ago, awaiting customer decision. Still within valid period.
    """
    print("\n[SCENARIO 5] Quote pending customer approval - SENT")
    print(f"   Customer: {customer.company_name}")

    now = datetime.now(UTC)

    # Select various products (5-8 items)
    selected_products = random.sample(products, min(8, len(products)))

    # Create Quote (2 days ago)
    quote_date = now - timedelta(days=2)
    valid_until = quote_date + timedelta(days=30)

    quote = Quote(
        quote_number=f"QT-DEMO-{quote_num:06d}",
        customer_id=customer.id,
        status=QuoteStatus.SENT,
        quote_date=quote_date,
        valid_until=valid_until,
        total=Decimal(0),
        notes="Quote for upcoming project. Customer reviewing with team. Follow-up scheduled.",
    )
    db.add(quote)
    await db.flush()

    # Add quote items
    quote_total = Decimal(0)
    for product in selected_products:
        quantity = random.randint(2, 6)
        unit_price = product.price
        line_total = (Decimal(quantity) * unit_price).quantize(Decimal("0.01"))

        quote_item = QuoteItem(
            quote_id=quote.id,
            product_id=product.id,
            quantity=quantity,
            unit_price=unit_price,
            line_total=line_total,
        )
        db.add(quote_item)
        quote_total += line_total

    # Prices include GST (10% Australian tax is already in the price)
    quote.total = quote_total

    print(f"   [OK] Quote {quote.quote_number}: ${quote.total:,.2f} (SENT - Awaiting Customer)")
    print(f"   -> Items: {len(selected_products)}, Total: ${quote.total:,.2f}")

    await db.commit()
    return quote


async def generate_demo_purchases() -> None:
    """Main function to generate demonstration purchases."""
    print("\n" + "=" * 80)
    print("GENERATE DEMONSTRATION PURCHASES")
    print("Using Real CCWonline.com.au Shopify Product Data")
    print("=" * 80)

    # Check Shopify settings
    settings = get_shopify_settings()
    print(f"\nShopify Mode: {settings.mode.upper()}")
    print(f"Shop Domain: {settings.shop_domain}")

    if settings.is_demo_mode:
        print("\nWARNING: Running in DEMO mode!")
        print("   Set SHOPIFY_MODE=live to fetch real Shopify products.")
        print("   Will use existing ERP products instead.")
        proceed = input("\n   Continue anyway? (y/N): ")
        if proceed.lower() != "y":
            print("\nExiting. Please set SHOPIFY_MODE=live and try again.")
            return

    # Create tables if needed
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Fetch Shopify products
    shopify_products = await fetch_shopify_products(limit=50)

    # Sync products to ERP
    async with AsyncSessionLocal() as db:
        products = await sync_shopify_products_to_erp(db, shopify_products)

        if len(products) < 5:
            print("\nERROR: Not enough products available.")
            print(f"   Found: {len(products)} products")
            print("   Need: At least 5 products to generate scenarios")
            return

        # Create demo customers
        customers = await create_demo_customers(db)

        # Generate 5 purchase scenarios
        print("\n" + "=" * 80)
        print("GENERATING 5 PURCHASE SCENARIOS")
        print("=" * 80)

        quote_num = 30000
        order_num = 40000

        # Scenario 1: Large order (delivered)
        quote1, order1 = await create_purchase_scenario_1(
            db, customers[0], products, quote_num, order_num
        )
        quote_num += 1
        order_num += 1

        # Scenario 2: Medium order (shipped)
        order2 = await create_purchase_scenario_2(db, customers[1], products, order_num)
        order_num += 1

        # Scenario 3: Small order (processing)
        order3 = await create_purchase_scenario_3(db, customers[2], products, order_num)
        order_num += 1

        # Scenario 4: Quote to order (confirmed)
        quote4, order4 = await create_purchase_scenario_4(
            db, customers[3], products, quote_num, order_num
        )
        quote_num += 1
        order_num += 1

        # Scenario 5: Quote pending (sent)
        quote5 = await create_purchase_scenario_5(db, customers[4], products, quote_num)

    # Print summary
    print("\n" + "=" * 80)
    print("DEMONSTRATION PURCHASES GENERATED SUCCESSFULLY!")
    print("=" * 80)
    print("\nSummary:")
    print(f"   [OK] Synced {len(products)} products from CCWonline.com.au")
    print(f"   [OK] Created 5 demonstration customers")
    print(f"   [OK] Generated 3 quotes (2 accepted, 1 sent)")
    print(f"   [OK] Generated 4 orders (1 delivered, 1 shipped, 1 processing, 1 confirmed)")
    print("\nScenarios Created:")
    print("   1. Brisbane Construction Co - Large order DELIVERED ($X,XXX)")
    print("   2. Gold Coast Electrical - Medium order SHIPPED ($X,XXX)")
    print("   3. Sunshine Coast Plumbing - Urgent order PROCESSING ($XXX)")
    print("   4. Toowoomba Building - Quote -> Order CONFIRMED ($X,XXX)")
    print("   5. Cairns Industrial - Quote SENT awaiting approval ($X,XXX)")
    print("\nYou can now:")
    print("   - Log in to the ERP system (admin@demo.com / demo123)")
    print("   - View customers, quotes, and orders in the dashboard")
    print("   - Demonstrate the quote-to-order conversion workflow")
    print("   - Show different order statuses and tracking")
    print("   - Present the system to the business owner")
    print("\n" + "=" * 80 + "\n")


if __name__ == "__main__":
    asyncio.run(generate_demo_purchases())
