#!/usr/bin/env python
"""Test Shopify API connection with live credentials."""
import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from src.config.shopify_settings import get_shopify_settings
from src.integrations.shopify.client import get_shopify_client


async def test_connection():
    """Test Shopify API connection."""
    print("="*80)
    print("SHOPIFY CONNECTION TEST")
    print("="*80)

    # Get settings
    settings = get_shopify_settings()

    print(f"\nConfiguration:")
    print(f"  Mode: {settings.mode}")
    print(f"  Shop Domain: {settings.shop_domain}")
    print(f"  API Version: {settings.api_version}")
    print(f"  Admin API URL: {settings.admin_api_url}")
    print(f"  Access Token: {settings.access_token[:15]}...")

    if settings.is_demo_mode:
        print("\n[WARNING] Running in DEMO mode")
        print("   Set SHOPIFY_MODE=live in .env to use live API")
        return

    print(f"\n[SUCCESS] Running in LIVE mode")
    print(f"\nTesting connection to Shopify...\n")

    try:
        async with get_shopify_client() as client:
            # Test 1: Get shop info
            print("[Test 1] Fetching shop information...")
            shop_response = await client.get_shop_info()
            shop_info = shop_response.get('shop', {})
            print(f"[OK] Shop Name: {shop_info.get('name', 'N/A')}")
            print(f"   Shop Owner: {shop_info.get('shop_owner', 'N/A')}")
            print(f"   Email: {shop_info.get('email', 'N/A')}")
            print(f"   Currency: {shop_info.get('currency', 'N/A')}")

            # Test 2: List products (first 10)
            print(f"\n[Test 2] Fetching products (first 10)...")
            products_response = await client.get_products(limit=10)
            products = products_response.get('products', [])
            product_count = len(products)
            print(f"[OK] Found {product_count} products")

            if product_count > 0:
                print(f"\n   Sample products:")
                for i, product in enumerate(products[:3], 1):
                    print(f"   {i}. {product.get('title', 'N/A')} (ID: {product.get('id', 'N/A')})")

            # Test 3: List orders (first 10)
            print(f"\n[Test 3] Fetching orders (first 10)...")
            orders_response = await client.get_orders(limit=10)
            orders = orders_response.get('orders', [])
            order_count = len(orders)
            print(f"[OK] Found {order_count} orders")

            if order_count > 0:
                print(f"\n   Sample orders:")
                for i, order in enumerate(orders[:3], 1):
                    print(f"   {i}. Order #{order.get('order_number', 'N/A')} - ${order.get('total_price', 'N/A')}")

            # Test 4: Get inventory locations
            print(f"\n[Test 4] Fetching inventory locations...")
            locations_response = await client.get_locations()
            locations = locations_response.get('locations', [])
            location_count = len(locations)
            print(f"[OK] Found {location_count} location(s)")

            if location_count > 0:
                print(f"\n   Locations:")
                for i, location in enumerate(locations, 1):
                    print(f"   {i}. {location.get('name', 'N/A')} (ID: {location.get('id', 'N/A')})")

            print(f"\n" + "="*80)
            print("[SUCCESS] ALL TESTS PASSED - Shopify connection successful!")
            print("="*80)
            print(f"\nNext steps:")
            print(f"  1. Set up webhooks for real-time sync")
            print(f"  2. Configure inventory location ID in .env")
            print(f"  3. Start syncing products, orders, and inventory")

            return True

    except Exception as e:
        print(f"\n" + "="*80)
        print(f"[FAILED] CONNECTION FAILED")
        print(f"="*80)
        print(f"\nError: {e}")
        print(f"\nTroubleshooting:")
        print(f"  1. Verify credentials in .env file")
        print(f"  2. Check API access scopes in Shopify admin")
        print(f"  3. Ensure the app is installed on the store")
        print(f"  4. Verify shop domain is correct: {settings.shop_domain}")
        return False


if __name__ == "__main__":
    success = asyncio.run(test_connection())
    sys.exit(0 if success else 1)
