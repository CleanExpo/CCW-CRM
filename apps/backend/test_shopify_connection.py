"""Test Shopify API connection."""
import asyncio
import sys
from pathlib import Path

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent / "src"))

from src.config.shopify_settings import get_shopify_settings
from src.integrations.shopify.client import ShopifyLiveClient


async def test_connection():
    """Test Shopify API connection."""
    print("Testing Shopify API Connection...")
    print("=" * 60)

    # Get settings
    settings = get_shopify_settings()

    print(f"Shop Domain: {settings.shop_domain}")
    print(f"API Version: {settings.api_version}")
    print(f"Mode: {settings.mode}")
    print(f"Access Token: {'*' * 20}{settings.access_token[-8:]}")
    print("=" * 60)

    # Test connection
    try:
        async with ShopifyLiveClient(settings) as client:
            print("\n[TEST 1] Getting shop information...")
            shop_info = await client.get_shop_info()

            if shop_info and "shop" in shop_info:
                shop = shop_info["shop"]
                print(f"✅ SUCCESS: Connected to {shop.get('name')}")
                print(f"   Shop ID: {shop.get('id')}")
                print(f"   Email: {shop.get('email')}")
                print(f"   Domain: {shop.get('domain')}")
                print(f"   Currency: {shop.get('currency')}")
                print(f"   Timezone: {shop.get('timezone')}")
            else:
                print("❌ FAILED: Unexpected response format")
                return False

            print("\n[TEST 2] Getting products (first 5)...")
            products_response = await client.get_products(limit=5)

            if products_response and "products" in products_response:
                products = products_response["products"]
                print(f"✅ SUCCESS: Retrieved {len(products)} products")
                for i, product in enumerate(products, 1):
                    print(f"   {i}. {product.get('title')} (ID: {product.get('id')})")
            else:
                print("⚠️  WARNING: No products found or unexpected format")

            print("\n[TEST 3] Getting orders (first 5)...")
            orders_response = await client.get_orders(limit=5)

            if orders_response and "orders" in orders_response:
                orders = orders_response["orders"]
                print(f"✅ SUCCESS: Retrieved {len(orders)} orders")
                for i, order in enumerate(orders, 1):
                    print(f"   {i}. Order #{order.get('name')} - {order.get('financial_status')}")
            else:
                print("⚠️  WARNING: No orders found or unexpected format")

            print("\n" + "=" * 60)
            print("✅ ALL TESTS PASSED - Shopify connection is working!")
            print("=" * 60)
            return True

    except ValueError as e:
        print(f"\n❌ FAILED: {str(e)}")
        print("\nPossible causes:")
        print("1. Invalid access token")
        print("2. Incorrect shop domain")
        print("3. Missing API permissions")
        print("\nPlease verify credentials in .env file")
        return False
    except Exception as e:
        print(f"\n❌ FAILED: Unexpected error: {str(e)}")
        return False


if __name__ == "__main__":
    result = asyncio.run(test_connection())
    sys.exit(0 if result else 1)
