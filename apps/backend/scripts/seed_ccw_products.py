"""Seed database with real CCW cleaning equipment products from CSV catalog."""

import argparse
import asyncio
import csv
import sys
from decimal import Decimal
from pathlib import Path

# Add parent directory to path so we can import src.*
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.config.database import get_database_url
from src.db.demo_models import Product

# Path to CCW product catalog CSV (relative to repo root)
REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
CSV_PATH = REPO_ROOT / "docs" / "catalog" / "ccw-product-catalog.csv"

# Warehouse bay assignment — deterministic by SKU prefix
BAY_MAP = {
    "CCW-TRK": "Bay A",
    "CCW-FLR": "Bay A",
    "CCW-EXT": "Bay B",
    "CCW-WDE": "Bay B",
    "CCW-PWR": "Bay C",
    "CCW-VAC": "Bay C",
    "CCW-PPE": "Bay D",
    "CCW-ELC": "Bay D",
    "CCW-PLB": "Bay E",
    "CCW-WND": "Bay E",
    "CCW-BON": "Bay F",
    "CCW-FPD": "Bay F",
    "CCW-CHM": "Bay G",
    "CCW-HND": "Bay G",
}


def get_bay(sku: str) -> str:
    prefix = "-".join(sku.split("-")[:2])
    return BAY_MAP.get(prefix, "Bay H")


def load_csv() -> list[dict]:
    """Load and validate the CCW product catalog CSV."""
    if not CSV_PATH.exists():
        raise FileNotFoundError(f"Product catalog CSV not found at: {CSV_PATH}")

    products = []
    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader, 1):
            # Skip empty rows
            if not row.get("sku", "").strip():
                continue
            products.append(
                {
                    "sku": row["sku"].strip(),
                    "name": row["name"].strip(),
                    "category": row["category"].strip(),
                    "price": Decimal(row["price_aud"].strip()),
                    "cost": Decimal(row["cost_aud"].strip()),
                    "description": row["description"].strip(),
                    "stock": int(row["stock"].strip()),
                }
            )

    return products


async def upsert_products(
    session: AsyncSession, products: list[dict], dry_run: bool = False
) -> tuple[int, int]:
    """Upsert products by SKU. Returns (inserted, updated) counts."""
    inserted = 0
    updated = 0

    # Load all existing SKUs in one query
    result = await session.execute(select(Product.sku, Product.id))
    existing_skus = {row.sku: row.id for row in result}

    for product_data in products:
        sku = product_data["sku"]
        bay = get_bay(sku)
        row_num = list(range(1, 30))[hash(sku) % 29 + 1 - 1]  # deterministic 1-29
        location = f"{bay}-{row_num:02d}"

        if sku in existing_skus:
            # UPDATE existing product
            if not dry_run:
                product_id = existing_skus[sku]
                result2 = await session.execute(
                    select(Product).where(Product.id == product_id)
                )
                product = result2.scalar_one()
                product.name = product_data["name"]
                product.description = product_data["description"]
                product.category = product_data["category"]
                product.price = product_data["price"]
                product.cost = product_data["cost"]
                product.stock = product_data["stock"]
                product.warehouse_location = location
            updated += 1
        else:
            # INSERT new product
            if not dry_run:
                product = Product(
                    sku=sku,
                    name=product_data["name"],
                    description=product_data["description"],
                    category=product_data["category"],
                    price=product_data["price"],
                    cost=product_data["cost"],
                    stock=product_data["stock"],
                    warehouse_location=location,
                    is_active=True,
                )
                session.add(product)
            inserted += 1

    if not dry_run:
        await session.commit()

    return inserted, updated


async def run(dry_run: bool = False) -> None:
    """Main seed runner."""
    print(f"CCW Product Catalog Seed {'(DRY RUN)' if dry_run else ''}")
    print(f"CSV: {CSV_PATH}\n")

    products = load_csv()
    print(f"Loaded {len(products)} products from CSV")

    # Category breakdown
    categories: dict[str, int] = {}
    for p in products:
        cat = p["category"].replace("_", " ").title()
        categories[cat] = categories.get(cat, 0) + 1

    print("\nCategory breakdown:")
    for cat, count in sorted(categories.items()):
        print(f"  {cat}: {count}")

    if dry_run:
        print("\n[DRY RUN] No database changes will be made.")
        print("\nSample rows that would be upserted:")
        for p in products[:5]:
            print(f"  {p['sku']} — {p['name']} (${p['price']} AUD, stock: {p['stock']})")
        if len(products) > 5:
            print(f"  ... and {len(products) - 5} more")
        print("\n[DRY RUN] Complete. Exit 0.")
        return

    # Connect to database and run upsert
    db_url = get_database_url(async_mode=True)
    engine = create_async_engine(
        db_url,
        echo=False,
        connect_args={
            "statement_cache_size": 0,
            "prepared_statement_cache_size": 0,
        },
    )

    session_factory = async_sessionmaker(
        bind=engine, class_=AsyncSession, expire_on_commit=False
    )

    try:
        async with session_factory() as session:
            inserted, updated = await upsert_products(session, products)

        print(f"\n[SUCCESS] Upserted {len(products)} CCW products:")
        print(f"  Inserted: {inserted} new products")
        print(f"  Updated:  {updated} existing products")
    except Exception as e:
        print(f"\n[ERROR] {e}")
        raise
    finally:
        await engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed CCW product catalog from CSV.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse CSV and show what would be upserted without touching the database.",
    )
    args = parser.parse_args()

    asyncio.run(run(dry_run=args.dry_run))
