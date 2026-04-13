"""
Script to import products from CCWonline.com.au into ERP database.

Usage:
    python scripts/import_ccwonline_products.py --limit 100 --clear --dry-run

Options:
    --limit N       Import only first N products (default: 100)
    --dry-run       Preview import without writing to database
    --clear         Clear existing demo products before importing
"""

import asyncio
import random
import sys
from decimal import Decimal
from pathlib import Path
from typing import Any, Dict, List

import httpx
from sqlalchemy import delete

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.config.database import get_async_db
from src.db.demo_models import OrderItem, Product, ProductCategory, QuoteItem


async def fetch_shopify_products(limit: int = 250) -> List[Dict[str, Any]]:
    """Fetch products from Shopify store."""
    url = "https://ccwonline.com.au/products.json"
    params = {"limit": limit}

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(url, params=params)
        if response.status_code == 200:
            return response.json()["products"]
        else:
            raise Exception(f"Failed to fetch products: {response.status_code}")


def map_category(product_type: str, tags: List[str]) -> ProductCategory:
    """Map CCWonline category to ERP ProductCategory."""
    product_type_lower = product_type.lower() if product_type else ""
    tags_lower = [t.lower() for t in tags] if tags else []

    # Heavy machinery: Large equipment, extractors, vacuums
    if any(keyword in product_type_lower for keyword in [
        "extractor", "vacuum", "machine", "truckmount", "portable",
        "scrubber", "polisher", "buffer", "burnisher"
    ]):
        return ProductCategory.HEAVY_MACHINERY

    # Power tools: Wands, tools, accessories with power/mechanical function
    elif any(keyword in product_type_lower for keyword in [
        "wand", "tool", "sprayer", "pump", "motor", "blower", "fan"
    ]):
        return ProductCategory.POWER_TOOLS

    # Hand tools: Manual tools, meters, gauges
    elif any(keyword in product_type_lower for keyword in [
        "meter", "gauge", "sensor", "thermometer", "hygrometer"
    ]):
        return ProductCategory.HAND_TOOLS

    # Safety equipment: Protective gear
    elif any(keyword in product_type_lower for keyword in [
        "safety", "protective", "gloves", "mask", "respirator"
    ]):
        return ProductCategory.SAFETY_EQUIPMENT

    # Accessories: Hoses, fittings, adapters, nozzles, parts
    elif any(keyword in product_type_lower for keyword in [
        "hose", "fitting", "adapter", "nozzle", "tip", "jet", "valve",
        "bush", "connector", "coupling", "part"
    ]):
        return ProductCategory.ACCESSORIES

    # Electrical: Electrical components
    elif any(keyword in product_type_lower for keyword in [
        "electrical", "wire", "cord", "plug", "switch", "light"
    ]):
        return ProductCategory.ELECTRICAL

    # Plumbing: Plumbing related
    elif any(keyword in product_type_lower for keyword in [
        "plumbing", "pipe", "drain"
    ]):
        return ProductCategory.PLUMBING

    # Chemicals: Detergents, chemicals (map to BUILDING_MATERIALS as proxy)
    elif any(keyword in product_type_lower for keyword in [
        "chemical", "detergent", "cleaner", "deodorizer", "enzyme",
        "prespray", "rinse", "neutralizer", "spotter"
    ]):
        return ProductCategory.BUILDING_MATERIALS  # Using as "Supplies"

    # Default fallback
    else:
        return ProductCategory.ACCESSORIES


async def import_products(limit: int = 100, dry_run: bool = False, clear_existing: bool = False):
    """Import products into database."""

    # Step 1: Clear existing demo products if requested
    if clear_existing and not dry_run:
        async for db in get_async_db():
            try:
                # Delete order_items and quote_items first (foreign key constraints)
                await db.execute(delete(OrderItem))
                await db.execute(delete(QuoteItem))
                # Delete existing demo products
                result = await db.execute(delete(Product).where(Product.sku.like("EQ-%")))
                await db.commit()
                print(f"[-]  Cleared {result.rowcount} existing demo products\n")
            finally:
                await db.close()
            break  # Only need first iteration

    # Step 2: Fetch products from Shopify
    print("[>] Fetching products from CCWonline.com.au...")
    shopify_products = await fetch_shopify_products(limit)
    print(f"[>] Fetched {len(shopify_products)} products from CCWonline.com.au\n")

    # Step 3: Import products
    async for db in get_async_db():
        try:
            imported_count = 0
            skipped_count = 0

            for sp in shopify_products:
                try:
                    # Extract variant data (first variant)
                    variant = sp.get("variants", [{}])[0]
                    sku = variant.get("sku") or f"CCW-{sp['id']}"

                    # Skip if no price (invalid product)
                    price_str = variant.get("price", "0")
                    if not price_str or price_str == "0":
                        skipped_count += 1
                        continue

                    # Extract data
                    name = sp["title"][:255]  # Truncate to fit schema
                    description = sp.get("body_html", "") or "No description available"
                    price = Decimal(price_str)
                    category = map_category(sp.get("product_type", ""), sp.get("tags", []))

                    # Get first image URL if available
                    images = sp.get("images", [])
                    image_url = images[0]["src"] if images else None

                    # Calculate cost (estimate 60% of retail price)
                    cost = price * Decimal("0.6")

                    # Random stock between 5-100 (realistic inventory)
                    stock = random.randint(5, 100)

                    # Random warehouse
                    warehouse = random.choice(["Brisbane Main", "Sydney Metro", "Melbourne Central"])

                    product = Product(
                        sku=sku,
                        name=name,
                        description=description,
                        category=category,
                        price=price,
                        cost=cost,
                        stock=stock,
                        warehouse_location=warehouse,
                        is_active=True
                    )

                    if not dry_run:
                        db.add(product)

                        # Store image URL in description for now
                        if image_url:
                            product.description = f"<!-- IMAGE: {image_url} -->\n{product.description}"

                        # Encode output for Windows console
                        safe_name = name[:50].encode('ascii', 'replace').decode('ascii')
                        safe_sku = sku[:20].encode('ascii', 'replace').decode('ascii')
                        print(f"[+] Imported: {safe_name:<50} SKU: {safe_sku:<20} ${price:>8.2f}")
                    else:
                        img_indicator = "[IMG]" if image_url else "[   ]"
                        # Encode output for Windows console
                        safe_name = name[:50].encode('ascii', 'replace').decode('ascii')
                        safe_sku = sku[:20].encode('ascii', 'replace').decode('ascii')
                        safe_category = category.value.encode('ascii', 'replace').decode('ascii')
                        print(f"{img_indicator} [DRY RUN] Would import: {safe_name:<50} SKU: {safe_sku:<20} ${price:>8.2f} -> {safe_category}")

                    imported_count += 1

                except Exception as e:
                    safe_title = sp.get('title', 'Unknown').encode('ascii', 'replace').decode('ascii')
                    safe_error = str(e).encode('ascii', 'replace').decode('ascii')
                    print(f"[X] Error importing {safe_title}: {safe_error}")
                    skipped_count += 1

            if not dry_run:
                await db.commit()
                print(f"\n[OK] Successfully imported {imported_count} products")
                if skipped_count > 0:
                    print(f"[!]  Skipped {skipped_count} products (errors or invalid data)")
            else:
                print(f"\n[DRY RUN] Would import {imported_count} products ({skipped_count} would be skipped)")

        finally:
            await db.close()
        break  # Only need first iteration


if __name__ == "__main__":
    limit = 100  # Default: 100 products
    dry_run = False
    clear_existing = False

    if "--limit" in sys.argv:
        idx = sys.argv.index("--limit")
        limit = int(sys.argv[idx + 1])

    if "--dry-run" in sys.argv:
        dry_run = True

    if "--clear" in sys.argv:
        clear_existing = True

    print(f"{'='*80}")
    print("CCWonline.com.au Product Import Script")
    print(f"{'='*80}")
    print(f"Mode: {'DRY RUN (no changes)' if dry_run else 'LIVE IMPORT'}")
    print(f"Limit: {limit} products")
    print(f"Clear existing: {'Yes' if clear_existing else 'No'}")
    print(f"{'='*80}\n")

    if not dry_run:
        confirm = input("[!]  This will modify the database. Continue? (yes/no): ")
        if confirm.lower() != "yes":
            print("[X] Import cancelled")
            sys.exit(0)

    asyncio.run(import_products(limit, dry_run, clear_existing))
