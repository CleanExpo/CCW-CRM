"""
Demo data seeder script.

Generates realistic sample data for overnight demo:
- 50+ products (equipment supplier)
- 30+ customers
- 25+ orders with line items
- 15+ quotes
- Demo admin user
- 6 months of sales history
"""
# ruff: noqa: E501

import asyncio
import random
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# from src.auth.jwt import get_password_hash  # Temporarily disabled due to bcrypt compatibility issue
from src.config.database import AsyncSessionLocal, async_engine
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
from src.db.models import Base, User

# Sample data pools
EQUIPMENT_NAMES = {
    ProductCategory.HEAVY_MACHINERY: [
        "Excavator 320D", "Bulldozer D6", "Backhoe Loader 580", "Wheel Loader 950",
        "Motor Grader 140", "Skid Steer 272D", "Compact Track Loader 289D", "Articulated Truck A40",
        "Telehandler TH514", "Mini Excavator 305", "Forklift FG25", "Boom Lift Z-60",
    ],
    ProductCategory.POWER_TOOLS: [
        "Cordless Drill 18V", "Impact Driver 20V", "Circular Saw 7-1/4\"", "Angle Grinder 4-1/2\"",
        "Reciprocating Saw", "Jigsaw Variable Speed", "Rotary Hammer Drill", "Belt Sander 3\"x21\"",
        "Random Orbital Sander", "Miter Saw 10\"", "Table Saw 15A", "Nail Gun Pneumatic",
        "Heat Gun 1500W", "Planer 6A", "Router 2HP", "Oscillating Multi-Tool",
    ],
    ProductCategory.HAND_TOOLS: [
        "Hammer Claw 16oz", "Screwdriver Set 11pc", "Pliers Set 3pc", "Wrench Set SAE",
        "Socket Set 1/2\" Drive", "Level Torpedo 9\"", "Tape Measure 25ft", "Utility Knife Heavy Duty",
        "Allen Key Set Metric", "Chisel Set 4pc", "File Set 6pc", "Hacksaw 12\"",
        "Wire Cutters 8\"", "Bolt Cutters 24\"", "Pipe Wrench 14\"", "Adjustable Wrench 12\"",
    ],
    ProductCategory.SAFETY_EQUIPMENT: [
        "Hard Hat Class E", "Safety Glasses Clear", "Work Gloves Leather", "Ear Plugs Disposable",
        "Dust Mask N95", "Safety Vest Hi-Vis", "Steel Toe Boots", "Knee Pads Heavy Duty",
        "Fall Protection Harness", "Safety Goggles", "Face Shield Clear", "Respirator Half Mask",
        "First Aid Kit 150pc", "Fire Extinguisher 5lb", "Lockout Tagout Kit", "Spill Kit 20gal",
    ],
    ProductCategory.BUILDING_MATERIALS: [
        "Cement Portland 94lb", "Sand Masonry 50lb", "Gravel 3/4\" 50lb", "Concrete Mix 80lb",
        "Lumber 2x4x8", "Plywood 4x8 1/2\"", "Drywall 4x8 1/2\"", "Insulation R-13",
        "Roofing Shingles Bundle", "Siding Vinyl 12ft", "Deck Boards 16ft", "Fence Post 4x4x8",
    ],
    ProductCategory.ELECTRICAL: [
        "Wire Romex 12/2 250ft", "Conduit EMT 1/2\" 10ft", "Junction Box 4x4", "Outlet 15A Duplex",
        "Switch Single Pole", "Breaker 20A Single", "Panel 200A Main", "GFCI Outlet 20A",
        "Light Fixture LED 4ft", "Motion Sensor Switch", "Dimmer Switch", "Extension Cord 50ft",
    ],
    ProductCategory.PLUMBING: [
        "PVC Pipe 2\" 10ft", "Copper Pipe 3/4\" 10ft", "PEX Tubing 1/2\" 100ft", "Faucet Kitchen Single",
        "Toilet 1.6GPF", "Sink Undermount", "Shower Head Multi", "Water Heater 50gal",
        "Pipe Wrench 18\"", "Pipe Cutter 1/2\"-2\"", "Plunger Heavy Duty", "Snake Drain 25ft",
    ],
    ProductCategory.ACCESSORIES: [
        "Tool Belt Leather", "Tool Box 26\"", "Work Light LED 1000lm", "Ladder 6ft Step",
        "Wheelbarrow 6cu ft", "Bucket 5gal", "Tarp 10x12", "Rope 1/2\" 50ft",
        "Bungee Cord Set", "Zip Ties 100pc", "Duct Tape 2\" 60yd", "Spray Paint Black",
    ],
}

COMPANY_TYPES = ["Construction", "Electrical", "Plumbing", "HVAC", "Landscaping", "General Contracting"]
COMPANY_NAMES = [
    "Smith Brothers", "Johnson & Sons", "Williams Co", "Brown Industries", "Jones Enterprises",
    "Miller Group", "Davis Corp", "Garcia LLC", "Rodriguez & Partners", "Wilson Holdings",
    "Martinez Inc", "Anderson Construction", "Taylor Services", "Thomas Industries", "Hernandez Group",
    "Moore Contractors", "Martin Supply", "Jackson Co", "Thompson LLC", "White Enterprises",
    "Lopez Brothers", "Lee Industries", "Harris Group", "Clark Services", "Lewis Corp",
    "Robinson LLC", "Walker Holdings", "Young Contractors", "Hall Supply", "Allen Industries",
]

AUSTRALIAN_STATES = ["QLD", "NSW", "VIC", "SA", "WA", "TAS", "NT", "ACT"]
AUSTRALIAN_CITIES = {
    "QLD": ["Brisbane", "Gold Coast", "Sunshine Coast", "Townsville", "Cairns"],
    "NSW": ["Sydney", "Newcastle", "Wollongong", "Central Coast", "Coffs Harbour"],
    "VIC": ["Melbourne", "Geelong", "Ballarat", "Bendigo", "Shepparton"],
    "SA": ["Adelaide", "Mount Gambier", "Whyalla", "Murray Bridge", "Port Augusta"],
    "WA": ["Perth", "Bunbury", "Geraldton", "Kalgoorlie", "Albany"],
    "TAS": ["Hobart", "Launceston", "Devonport", "Burnie", "Ulverstone"],
    "NT": ["Darwin", "Alice Springs", "Palmerston", "Katherine", "Nhulunbuy"],
    "ACT": ["Canberra", "Belconnen", "Tuggeranong", "Woden", "Gungahlin"],
}

WAREHOUSES = ["Brisbane Main", "Sydney Metro", "Melbourne Central"]


async def create_demo_user(db: AsyncSession) -> None:
    """Create demo admin user."""
    # Check if user already exists
    result = await db.execute(select(User).where(User.email == "admin@demo.com"))
    existing_user = result.scalar_one_or_none()

    if existing_user:
        print("[OK] Demo admin user already exists")
        return

    # Use pre-hashed password for "demo123"
    # Generated with: bcrypt.hashpw(b"demo123", bcrypt.gensalt(rounds=12))
    user = User(
        email="admin@demo.com",
        hashed_password="$2b$12$t3c9inySNVTxAI7j56GTze4IO7GMKfaQu.sZ/VdvOytqjFMScBgwe",
        full_name="Demo Administrator",
        is_admin=True,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    print("[OK] Created demo admin user (admin@demo.com / demo123)")


async def create_products(db: AsyncSession, count: int = 60) -> list[Product]:
    """Create product catalog."""
    products = []
    sku_counter = 1000

    for category, names in EQUIPMENT_NAMES.items():
        for name in names:
            # Generate realistic pricing
            base_cost = Decimal(random.uniform(10, 5000))
            markup = Decimal(random.uniform(1.2, 2.5))
            price = (base_cost * markup).quantize(Decimal("0.01"))

            # Stock levels with some low stock items
            stock = random.choices(
                [random.randint(0, 5), random.randint(10, 50), random.randint(51, 200)],
                weights=[0.15, 0.5, 0.35],
            )[0]

            product = Product(
                sku=f"EQ-{sku_counter:05d}",
                name=name,
                description=f"{name} - Professional grade equipment for {category.value.replace('_', ' ')}",
                category=category,
                cost=base_cost.quantize(Decimal("0.01")),
                price=price,
                stock=stock,
                warehouse_location=random.choice(WAREHOUSES),
                is_active=True,
            )
            products.append(product)
            sku_counter += 1

            if len(products) >= count:
                break

        if len(products) >= count:
            break

    db.add_all(products)
    await db.commit()
    print(f"[OK] Created {len(products)} products")
    return products


async def create_customers(db: AsyncSession, count: int = 35) -> list[Customer]:
    """Create customer base."""
    customers = []
    customer_number = 1000

    for i in range(count):
        company_name = f"{random.choice(COMPANY_NAMES)} {random.choice(COMPANY_TYPES)}"
        contact_name = f"{random.choice(['John', 'Jane', 'Mike', 'Sarah', 'David', 'Emma'])} {random.choice(['Smith', 'Johnson', 'Williams', 'Brown', 'Jones'])}"
        state = random.choice(AUSTRALIAN_STATES)
        city = random.choice(AUSTRALIAN_CITIES[state])

        customer = Customer(
            customer_number=f"C-{customer_number:05d}",
            company_name=company_name,
            contact_name=contact_name,
            email=f"{contact_name.lower().replace(' ', '.')}@{company_name.lower().replace(' ', '').replace('&', '')}example.com",
            phone=f"04{random.randint(10, 99)} {random.randint(100, 999)} {random.randint(100, 999)}",
            address=f"{random.randint(1, 999)} {random.choice(['Main', 'High', 'Park', 'Queen'])} Street",
            city=city,
            state=state,
            postcode=f"{random.randint(1000, 9999)}",
            is_active=True,
        )
        customers.append(customer)
        customer_number += 1

    db.add_all(customers)
    await db.commit()
    print(f"[OK] Created {len(customers)} customers")
    return customers


async def create_orders(
    db: AsyncSession, customers: list[Customer], products: list[Product], count: int = 30
) -> list[Order]:
    """Create sales orders with line items (past 6 months)."""
    orders = []
    order_number = 10000
    now = datetime.now(UTC)

    # Generate orders across 6 months
    for i in range(count):
        # Random date within past 6 months
        days_ago = random.randint(0, 180)
        order_date = now - timedelta(days=days_ago)

        customer = random.choice(customers)

        # Order status based on age
        if days_ago < 7:
            status = random.choice([OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PROCESSING])
        elif days_ago < 30:
            status = random.choice([OrderStatus.PROCESSING, OrderStatus.SHIPPED, OrderStatus.DELIVERED])
        else:
            status = random.choices(
                [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
                weights=[0.9, 0.1],
            )[0]

        order = Order(
            order_number=f"SO-{order_number:06d}",
            customer_id=customer.id,
            status=status,
            order_date=order_date,
            subtotal=Decimal(0),
            tax=Decimal(0),
            total=Decimal(0),
        )
        db.add(order)
        await db.flush()

        # Add 2-8 line items per order
        num_items = random.randint(2, 8)
        selected_products = random.sample(products, min(num_items, len(products)))
        subtotal = Decimal(0)

        for product in selected_products:
            quantity = random.randint(1, 10)
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
            subtotal += line_total

        # Calculate tax and total
        tax = (subtotal * Decimal("0.10")).quantize(Decimal("0.01"))  # 10% GST
        total = subtotal + tax

        order.subtotal = subtotal
        order.tax = tax
        order.total = total

        orders.append(order)
        order_number += 1

    await db.commit()
    print(f"[OK] Created {len(orders)} orders with line items")
    return orders


async def create_quotes(
    db: AsyncSession, customers: list[Customer], products: list[Product], count: int = 18
) -> list[Quote]:
    """Create quotes (mix of statuses)."""
    quotes = []
    quote_number = 20000
    now = datetime.now(UTC)

    for i in range(count):
        # Random date within past 3 months
        days_ago = random.randint(0, 90)
        quote_date = now - timedelta(days=days_ago)

        customer = random.choice(customers)

        # Quote status distribution
        status = random.choices(
            [QuoteStatus.DRAFT, QuoteStatus.SENT, QuoteStatus.ACCEPTED, QuoteStatus.REJECTED, QuoteStatus.EXPIRED],
            weights=[0.1, 0.3, 0.3, 0.1, 0.2],
        )[0]

        # Valid until: 30 days from quote date
        valid_until = quote_date + timedelta(days=30)

        quote = Quote(
            quote_number=f"QT-{quote_number:06d}",
            customer_id=customer.id,
            status=status,
            quote_date=quote_date,
            valid_until=valid_until,
            subtotal=Decimal(0),
            tax=Decimal(0),
            total=Decimal(0),
        )
        db.add(quote)
        await db.flush()

        # Add 3-10 line items per quote
        num_items = random.randint(3, 10)
        selected_products = random.sample(products, min(num_items, len(products)))
        subtotal = Decimal(0)

        for product in selected_products:
            quantity = random.randint(1, 15)
            # Quotes may have discounted pricing
            discount = random.choice([Decimal("1.0"), Decimal("0.95"), Decimal("0.90"), Decimal("0.85")])
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
            subtotal += line_total

        # Calculate tax and total
        tax = (subtotal * Decimal("0.10")).quantize(Decimal("0.01"))  # 10% GST
        total = subtotal + tax

        quote.subtotal = subtotal
        quote.tax = tax
        quote.total = total

        quotes.append(quote)
        quote_number += 1

    await db.commit()
    print(f"[OK] Created {len(quotes)} quotes with line items")
    return quotes


async def seed_demo_data() -> None:
    """Main seeding function."""
    print("\n[SEED] Starting demo data seed...\n")

    # Create tables
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("[OK] Database tables created\n")

    # Seed data
    async with AsyncSessionLocal() as db:
        await create_demo_user(db)
        print()

        products = await create_products(db, count=60)
        print()

        customers = await create_customers(db, count=35)
        print()

        orders = await create_orders(db, customers, products, count=30)
        print()

        quotes = await create_quotes(db, customers, products, count=18)
        print()

    print("[SEED] Demo data seeding complete!\n")
    print("Summary:")
    print("   - 1 admin user (admin@demo.com / demo123)")
    print(f"   - {len(products)} products across {len(WAREHOUSES)} warehouses")
    print(f"   - {len(customers)} customers")
    print(f"   - {len(orders)} orders (past 6 months)")
    print(f"   - {len(quotes)} quotes")
    print()


if __name__ == "__main__":
    asyncio.run(seed_demo_data())
