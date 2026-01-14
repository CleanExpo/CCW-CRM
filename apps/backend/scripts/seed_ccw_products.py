"""Seed database with 100 realistic CCW equipment products."""

import asyncio
import random
from decimal import Decimal
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.db.demo_models import Product

DATABASE_URL = "postgresql+asyncpg://starter_user:local_dev_password@localhost:5433/starter_db"

# Product data organized by category
PRODUCTS_DATA = [
    # Heavy Machinery (15 items)
    {"sku": "CCW-HM-001", "name": "Excavator 20T Hitachi ZX200", "category": "heavy_machinery", "price": 185000, "cost": 145000, "stock": 2},
    {"sku": "CCW-HM-002", "name": "Skid Steer Loader Bobcat S570", "category": "heavy_machinery", "price": 65000, "cost": 52000, "stock": 3},
    {"sku": "CCW-HM-003", "name": "Wheel Loader CAT 950M", "category": "heavy_machinery", "price": 275000, "cost": 220000, "stock": 1},
    {"sku": "CCW-HM-004", "name": "Bulldozer Komatsu D65PX", "category": "heavy_machinery", "price": 385000, "cost": 310000, "stock": 1},
    {"sku": "CCW-HM-005", "name": "Backhoe Loader JCB 3CX", "category": "heavy_machinery", "price": 95000, "cost": 76000, "stock": 2},
    {"sku": "CCW-HM-006", "name": "Motor Grader CAT 140M", "category": "heavy_machinery", "price": 425000, "cost": 340000, "stock": 1},
    {"sku": "CCW-HM-007", "name": "Telehandler JLG 3614", "category": "heavy_machinery", "price": 85000, "cost": 68000, "stock": 4},
    {"sku": "CCW-HM-008", "name": "Forklift Toyota 8FG25", "category": "heavy_machinery", "price": 35000, "cost": 28000, "stock": 5},
    {"sku": "CCW-HM-009", "name": "Compactor Bomag BW211D", "category": "heavy_machinery", "price": 125000, "cost": 100000, "stock": 2},
    {"sku": "CCW-HM-010", "name": "Trencher Ditch Witch RT80", "category": "heavy_machinery", "price": 95000, "cost": 76000, "stock": 2},
    {"sku": "CCW-HM-011", "name": "Mini Excavator Kubota KX040", "category": "heavy_machinery", "price": 55000, "cost": 44000, "stock": 6},
    {"sku": "CCW-HM-012", "name": "Track Loader CAT 963K", "category": "heavy_machinery", "price": 165000, "cost": 132000, "stock": 2},
    {"sku": "CCW-HM-013", "name": "Scissor Lift Genie GS3246", "category": "heavy_machinery", "price": 28000, "cost": 22400, "stock": 8},
    {"sku": "CCW-HM-014", "name": "Boom Lift JLG 600S", "category": "heavy_machinery", "price": 75000, "cost": 60000, "stock": 3},
    {"sku": "CCW-HM-015", "name": "Pallet Jack Manual 2500kg", "category": "heavy_machinery", "price": 850, "cost": 680, "stock": 25},

    # Power Tools (20 items)
    {"sku": "CCW-PT-001", "name": "Makita Cordless Drill Driver 18V", "category": "power_tools", "price": 285, "cost": 228, "stock": 45},
    {"sku": "CCW-PT-002", "name": "DeWalt Circular Saw 7-1/4in", "category": "power_tools", "price": 195, "cost": 156, "stock": 38},
    {"sku": "CCW-PT-003", "name": "Bosch Rotary Hammer SDS-Plus", "category": "power_tools", "price": 425, "cost": 340, "stock": 22},
    {"sku": "CCW-PT-004", "name": "Milwaukee Angle Grinder 4-1/2in", "category": "power_tools", "price": 165, "cost": 132, "stock": 52},
    {"sku": "CCW-PT-005", "name": "Hilti Impact Wrench 18V", "category": "power_tools", "price": 495, "cost": 396, "stock": 18},
    {"sku": "CCW-PT-006", "name": "Ryobi Reciprocating Saw 18V", "category": "power_tools", "price": 155, "cost": 124, "stock": 35},
    {"sku": "CCW-PT-007", "name": "Festool Track Saw TS 55", "category": "power_tools", "price": 685, "cost": 548, "stock": 12},
    {"sku": "CCW-PT-008", "name": "Makita Jigsaw 18V Cordless", "category": "power_tools", "price": 225, "cost": 180, "stock": 28},
    {"sku": "CCW-PT-009", "name": "DeWalt Nail Gun Framing 18V", "category": "power_tools", "price": 545, "cost": 436, "stock": 15},
    {"sku": "CCW-PT-010", "name": "Bosch Router 1/4in Cordless", "category": "power_tools", "price": 295, "cost": 236, "stock": 24},
    {"sku": "CCW-PT-011", "name": "Milwaukee Multi-Tool Oscillating", "category": "power_tools", "price": 245, "cost": 196, "stock": 32},
    {"sku": "CCW-PT-012", "name": "Makita Belt Sander 3x21in", "category": "power_tools", "price": 185, "cost": 148, "stock": 20},
    {"sku": "CCW-PT-013", "name": "DeWalt Mitre Saw 12in Sliding", "category": "power_tools", "price": 625, "cost": 500, "stock": 14},
    {"sku": "CCW-PT-014", "name": "Bosch Planer 82mm Electric", "category": "power_tools", "price": 265, "cost": 212, "stock": 18},
    {"sku": "CCW-PT-015", "name": "Hitachi Brad Nailer 18GA", "category": "power_tools", "price": 385, "cost": 308, "stock": 16},
    {"sku": "CCW-PT-016", "name": "Ryobi Orbital Sander 5in", "category": "power_tools", "price": 125, "cost": 100, "stock": 42},
    {"sku": "CCW-PT-017", "name": "Milwaukee Heat Gun Variable Temp", "category": "power_tools", "price": 145, "cost": 116, "stock": 28},
    {"sku": "CCW-PT-018", "name": "Makita Vacuum Extractor 10L", "category": "power_tools", "price": 385, "cost": 308, "stock": 12},
    {"sku": "CCW-PT-019", "name": "DeWalt Work Light LED 20V", "category": "power_tools", "price": 95, "cost": 76, "stock": 65},
    {"sku": "CCW-PT-020", "name": "Bosch Laser Level Self-Leveling", "category": "power_tools", "price": 295, "cost": 236, "stock": 22},

    # Hand Tools (15 items)
    {"sku": "CCW-HT-001", "name": "Stanley Hammer Claw 16oz", "category": "hand_tools", "price": 35, "cost": 28, "stock": 125},
    {"sku": "CCW-HT-002", "name": "Bahco Adjustable Wrench Set 3pc", "category": "hand_tools", "price": 85, "cost": 68, "stock": 78},
    {"sku": "CCW-HT-003", "name": "Irwin Pliers Set 5pc", "category": "hand_tools", "price": 65, "cost": 52, "stock": 92},
    {"sku": "CCW-HT-004", "name": "Stanley Screwdriver Set 10pc", "category": "hand_tools", "price": 45, "cost": 36, "stock": 105},
    {"sku": "CCW-HT-005", "name": "Crescent Socket Set 1/2in 42pc", "category": "hand_tools", "price": 195, "cost": 156, "stock": 45},
    {"sku": "CCW-HT-006", "name": "Stanley Tape Measure 8m Professional", "category": "hand_tools", "price": 28, "cost": 22, "stock": 150},
    {"sku": "CCW-HT-007", "name": "Irwin Quick-Grip Clamps Set 4pc", "category": "hand_tools", "price": 75, "cost": 60, "stock": 62},
    {"sku": "CCW-HT-008", "name": "Stanley Utility Knife Retractable", "category": "hand_tools", "price": 18, "cost": 14, "stock": 200},
    {"sku": "CCW-HT-009", "name": "Bahco Hacksaw Adjustable Frame", "category": "hand_tools", "price": 42, "cost": 34, "stock": 88},
    {"sku": "CCW-HT-010", "name": "Stanley Level Spirit 600mm", "category": "hand_tools", "price": 55, "cost": 44, "stock": 72},
    {"sku": "CCW-HT-011", "name": "Irwin Chisel Set 6pc Wood", "category": "hand_tools", "price": 95, "cost": 76, "stock": 48},
    {"sku": "CCW-HT-012", "name": "Stanley Toolbox Pro 24in", "category": "hand_tools", "price": 125, "cost": 100, "stock": 35},
    {"sku": "CCW-HT-013", "name": "Bahco File Set Assorted 5pc", "category": "hand_tools", "price": 58, "cost": 46, "stock": 55},
    {"sku": "CCW-HT-014", "name": "Irwin Vise-Grip Locking Pliers 10in", "category": "hand_tools", "price": 48, "cost": 38, "stock": 82},
    {"sku": "CCW-HT-015", "name": "Stanley Combination Square 12in", "category": "hand_tools", "price": 65, "cost": 52, "stock": 45},

    # Safety Equipment (15 items)
    {"sku": "CCW-SE-001", "name": "Hard Hat Safety Helmet Class E", "category": "safety_equipment", "price": 28, "cost": 22, "stock": 250},
    {"sku": "CCW-SE-002", "name": "Safety Glasses Clear Lens ANSI Z87", "category": "safety_equipment", "price": 12, "cost": 10, "stock": 450},
    {"sku": "CCW-SE-003", "name": "Work Gloves Leather Palm Size L", "category": "safety_equipment", "price": 18, "cost": 14, "stock": 320},
    {"sku": "CCW-SE-004", "name": "Hi-Vis Vest Class 2 Orange", "category": "safety_equipment", "price": 22, "cost": 18, "stock": 280},
    {"sku": "CCW-SE-005", "name": "Safety Boots Steel Toe Size 10", "category": "safety_equipment", "price": 125, "cost": 100, "stock": 85},
    {"sku": "CCW-SE-006", "name": "Ear Muffs Noise Reduction 33dB", "category": "safety_equipment", "price": 35, "cost": 28, "stock": 165},
    {"sku": "CCW-SE-007", "name": "Respirator Half Face P100 Filter", "category": "safety_equipment", "price": 65, "cost": 52, "stock": 95},
    {"sku": "CCW-SE-008", "name": "Fall Protection Harness Full Body", "category": "safety_equipment", "price": 185, "cost": 148, "stock": 42},
    {"sku": "CCW-SE-009", "name": "First Aid Kit Workplace 50-Person", "category": "safety_equipment", "price": 95, "cost": 76, "stock": 55},
    {"sku": "CCW-SE-010", "name": "Fire Extinguisher ABC 10lb", "category": "safety_equipment", "price": 75, "cost": 60, "stock": 68},
    {"sku": "CCW-SE-011", "name": "Safety Goggles Anti-Fog Sealed", "category": "safety_equipment", "price": 25, "cost": 20, "stock": 185},
    {"sku": "CCW-SE-012", "name": "Face Shield Clear Polycarbonate", "category": "safety_equipment", "price": 32, "cost": 26, "stock": 125},
    {"sku": "CCW-SE-013", "name": "Knee Pads Professional Foam", "category": "safety_equipment", "price": 42, "cost": 34, "stock": 95},
    {"sku": "CCW-SE-014", "name": "Reflective Tape 2in x 30ft Roll", "category": "safety_equipment", "price": 18, "cost": 14, "stock": 220},
    {"sku": "CCW-SE-015", "name": "Safety Cones 28in Traffic Orange 6pk", "category": "safety_equipment", "price": 85, "cost": 68, "stock": 75},

    # Building Materials (15 items)
    {"sku": "CCW-BM-001", "name": "Plywood Sheet 4x8ft 18mm Marine", "category": "building_materials", "price": 95, "cost": 76, "stock": 125},
    {"sku": "CCW-BM-002", "name": "Timber Pine 90x45mm 5.4m Treated", "category": "building_materials", "price": 28, "cost": 22, "stock": 450},
    {"sku": "CCW-BM-003", "name": "Cement Bag 20kg General Purpose", "category": "building_materials", "price": 12, "cost": 10, "stock": 850},
    {"sku": "CCW-BM-004", "name": "Gyprock Plasterboard 2400x1200x13mm", "category": "building_materials", "price": 18, "cost": 14, "stock": 380},
    {"sku": "CCW-BM-005", "name": "Insulation Batts R2.5 430mm 8pk", "category": "building_materials", "price": 85, "cost": 68, "stock": 95},
    {"sku": "CCW-BM-006", "name": "Roofing Iron Colorbond 0.42mm 6m", "category": "building_materials", "price": 125, "cost": 100, "stock": 165},
    {"sku": "CCW-BM-007", "name": "Bricks Red Common 230x110x76mm Pallet", "category": "building_materials", "price": 850, "cost": 680, "stock": 25},
    {"sku": "CCW-BM-008", "name": "Concrete Blocks 200mm Standard Pallet", "category": "building_materials", "price": 425, "cost": 340, "stock": 32},
    {"sku": "CCW-BM-009", "name": "Timber Hardwood 140x19mm Decking 5.4m", "category": "building_materials", "price": 65, "cost": 52, "stock": 185},
    {"sku": "CCW-BM-010", "name": "Steel RHS 50x50x3mm 6m Galvanised", "category": "building_materials", "price": 95, "cost": 76, "stock": 78},
    {"sku": "CCW-BM-011", "name": "Sarking Foil Insulation 60m2 Roll", "category": "building_materials", "price": 145, "cost": 116, "stock": 42},
    {"sku": "CCW-BM-012", "name": "Mesh Reinforcement SL92 6x2.4m Sheet", "category": "building_materials", "price": 75, "cost": 60, "stock": 95},
    {"sku": "CCW-BM-013", "name": "Gravel 20mm Blue Metal Tonne Bag", "category": "building_materials", "price": 125, "cost": 100, "stock": 55},
    {"sku": "CCW-BM-014", "name": "Sand River Washed Tonne Bag", "category": "building_materials", "price": 85, "cost": 68, "stock": 68},
    {"sku": "CCW-BM-015", "name": "Screws Deck Stainless 10g x 75mm 1kg", "category": "building_materials", "price": 45, "cost": 36, "stock": 125},

    # Electrical (10 items)
    {"sku": "CCW-EL-001", "name": "Cable Extension Lead 20m Heavy Duty", "category": "electrical", "price": 85, "cost": 68, "stock": 65},
    {"sku": "CCW-EL-002", "name": "LED Work Light 50W Portable", "category": "electrical", "price": 125, "cost": 100, "stock": 48},
    {"sku": "CCW-EL-003", "name": "Power Board 6 Outlet Surge Protected", "category": "electrical", "price": 45, "cost": 36, "stock": 125},
    {"sku": "CCW-EL-004", "name": "Cable Ties Black 200mm 100pk", "category": "electrical", "price": 12, "cost": 10, "stock": 285},
    {"sku": "CCW-EL-005", "name": "Conduit PVC 20mm 3m Orange Heavy Duty", "category": "electrical", "price": 18, "cost": 14, "stock": 195},
    {"sku": "CCW-EL-006", "name": "Switch Socket Double PowerPoint 10A", "category": "electrical", "price": 25, "cost": 20, "stock": 165},
    {"sku": "CCW-EL-007", "name": "Wire Electrical 2.5mm Twin+Earth 100m", "category": "electrical", "price": 185, "cost": 148, "stock": 35},
    {"sku": "CCW-EL-008", "name": "Junction Box Weatherproof IP66", "category": "electrical", "price": 32, "cost": 26, "stock": 95},
    {"sku": "CCW-EL-009", "name": "Circuit Breaker MCB 20A Single Pole", "category": "electrical", "price": 28, "cost": 22, "stock": 145},
    {"sku": "CCW-EL-010", "name": "LED Bulb A60 9W E27 Cool White 10pk", "category": "electrical", "price": 55, "cost": 44, "stock": 88},

    # Plumbing (10 items)
    {"sku": "CCW-PL-001", "name": "PVC Pipe 100mm x 3m Stormwater", "category": "plumbing", "price": 28, "cost": 22, "stock": 285},
    {"sku": "CCW-PL-002", "name": "Copper Pipe 15mm x 3m Type B", "category": "plumbing", "price": 45, "cost": 36, "stock": 165},
    {"sku": "CCW-PL-003", "name": "Tap Basin Mixer Chrome Watermark", "category": "plumbing", "price": 125, "cost": 100, "stock": 42},
    {"sku": "CCW-PL-004", "name": "Toilet Suite Close Coupled P-Trap", "category": "plumbing", "price": 385, "cost": 308, "stock": 18},
    {"sku": "CCW-PL-005", "name": "Sink Laundry Tub 45L Plastic", "category": "plumbing", "price": 95, "cost": 76, "stock": 32},
    {"sku": "CCW-PL-006", "name": "Hose Garden 18mm x 30m Fitted", "category": "plumbing", "price": 55, "cost": 44, "stock": 85},
    {"sku": "CCW-PL-007", "name": "Fitting Elbow 90° 25mm PVC 10pk", "category": "plumbing", "price": 18, "cost": 14, "stock": 195},
    {"sku": "CCW-PL-008", "name": "Sealant Silicone Clear 300ml Cartridge", "category": "plumbing", "price": 12, "cost": 10, "stock": 245},
    {"sku": "CCW-PL-009", "name": "Valve Ball 25mm Brass Full Bore", "category": "plumbing", "price": 35, "cost": 28, "stock": 125},
    {"sku": "CCW-PL-010", "name": "Tape Thread PTFE 12mm x 12m Roll", "category": "plumbing", "price": 8, "cost": 6, "stock": 385},
]


async def seed_products():
    """Seed the database with CCW products."""
    engine = create_async_engine(DATABASE_URL, echo=False)

    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with async_session() as session:
        try:
            # Check if products already exist
            result = await session.execute(select(Product).limit(1))
            existing = result.scalar_one_or_none()

            if existing:
                print("[WARNING] Products already exist in database. Skipping seed.")
                print(f"Run 'DELETE FROM products;' to clear existing products first.")
                return

            # Add all products
            products = []
            for i, product_data in enumerate(PRODUCTS_DATA, 1):
                product = Product(
                    sku=product_data["sku"],
                    name=product_data["name"],
                    description=f"Professional grade {product_data['name'].lower()} for commercial and industrial use. High quality equipment from trusted manufacturers.",
                    category=product_data["category"],
                    price=Decimal(str(product_data["price"])),
                    cost=Decimal(str(product_data["cost"])),
                    stock=product_data["stock"],
                    warehouse_location=f"Bay {random.choice(['A', 'B', 'C', 'D'])}-{random.randint(1, 20):02d}",
                    is_active=True,
                )
                products.append(product)

                if i % 20 == 0:
                    print(f"[*] Prepared {i}/{len(PRODUCTS_DATA)} products...")

            session.add_all(products)
            await session.commit()

            print(f"\n[SUCCESS] Seeded {len(products)} CCW products!")
            print(f"\nCategory breakdown:")

            # Count by category
            categories = {}
            for p in PRODUCTS_DATA:
                cat = p["category"].replace("_", " ").title()
                categories[cat] = categories.get(cat, 0) + 1

            for cat, count in sorted(categories.items()):
                print(f"  - {cat}: {count} items")

        except Exception as e:
            await session.rollback()
            print(f"[ERROR] Error seeding products: {e}")
            raise
        finally:
            await engine.dispose()


if __name__ == "__main__":
    print("Seeding CCW Equipment Products...\n")
    asyncio.run(seed_products())
