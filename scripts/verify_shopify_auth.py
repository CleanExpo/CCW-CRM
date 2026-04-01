"""
Shopify Authentication Verification Script

This script tests Shopify API authentication and diagnoses common 401 errors.
Helps troubleshoot ISS-008 (Fix Shopify Authentication 401).

Usage:
    python scripts/verify_shopify_auth.py

Requirements:
    - SHOPIFY_MODE=live in .env
    - SHOPIFY_SHOP_DOMAIN set to your store (e.g., your-store.myshopify.com)
    - SHOPIFY_ACCESS_TOKEN set to a valid Admin API access token
    - SHOPIFY_API_VERSION set (default: 2024-01)
"""

import asyncio
import sys
from pathlib import Path

# Add backend src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "apps" / "backend" / "src"))

try:
    from config.shopify_settings import get_shopify_settings
    from integrations.shopify.client import ShopifyLiveClient
except ImportError as e:
    print(f"❌ Import Error: {e}")
    print("Make sure you're running from the project root and dependencies are installed.")
    sys.exit(1)


async def verify_shopify_authentication():
    """Verify Shopify authentication and diagnose issues."""

    print("=" * 70)
    print("SHOPIFY AUTHENTICATION VERIFICATION")
    print("=" * 70)
    print()

    # Load settings
    settings = get_shopify_settings()

    # Step 1: Check configuration
    print("📋 Step 1: Configuration Check")
    print("-" * 70)

    print(f"Mode: {settings.mode}")
    print(f"Shop Domain: {settings.shop_domain}")
    print(f"API Version: {settings.api_version}")
    print(f"Admin API URL: {settings.admin_api_url}")
    print(f"Access Token: {settings.access_token[:20]}...") # Show first 20 chars
    print()

    if settings.is_demo_mode:
        print("⚠️  WARNING: Running in DEMO mode")
        print("   Set SHOPIFY_MODE=live in .env to test real authentication")
        print()
        return

    # Step 2: Validate configuration
    print("🔍 Step 2: Configuration Validation")
    print("-" * 70)

    issues = []

    if settings.shop_domain == "demo-store.myshopify.com":
        issues.append("Shop domain is set to demo value")

    if settings.access_token == "demo_access_token_abcdef":
        issues.append("Access token is set to demo value")

    if not settings.shop_domain.endswith(".myshopify.com"):
        issues.append("Shop domain should end with .myshopify.com")

    if len(settings.access_token) < 30:
        issues.append("Access token seems too short (should be 40+ characters)")

    if issues:
        print("❌ Configuration Issues Found:")
        for issue in issues:
            print(f"   - {issue}")
        print()
        print("💡 Fix these issues in your .env file:")
        print("   SHOPIFY_MODE=live")
        print("   SHOPIFY_SHOP_DOMAIN=your-store.myshopify.com")
        print("   SHOPIFY_ACCESS_TOKEN=shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")
        print()
        return
    else:
        print("✅ Configuration looks good")
        print()

    # Step 3: Test API connection
    print("🔌 Step 3: Testing API Connection")
    print("-" * 70)

    try:
        async with ShopifyLiveClient(settings) as client:
            print("Attempting to fetch shop information...")

            # Test 1: Get shop info (basic auth test)
            try:
                shop_data = await client.get_shop_info()
                shop_info = shop_data.get("shop", {})

                print("✅ Authentication Successful!")
                print()
                print("Shop Information:")
                print(f"   Name: {shop_info.get('name', 'N/A')}")
                print(f"   Email: {shop_info.get('email', 'N/A')}")
                print(f"   Domain: {shop_info.get('domain', 'N/A')}")
                print(f"   Shop Owner: {shop_info.get('shop_owner', 'N/A')}")
                print(f"   Country: {shop_info.get('country_name', 'N/A')}")
                print(f"   Currency: {shop_info.get('currency', 'N/A')}")
                print(f"   Plan: {shop_info.get('plan_display_name', 'N/A')}")
                print()

            except ValueError as e:
                error_msg = str(e)
                print(f"❌ Authentication Failed: {error_msg}")
                print()

                # Diagnose specific 401 errors
                if "401" in error_msg:
                    print("🔍 401 Unauthorized Error Diagnosis:")
                    print()
                    print("Common Causes:")
                    print("1. Invalid or expired access token")
                    print("   - Generate a new Admin API access token in Shopify")
                    print("   - Path: Shopify Admin > Settings > Apps and sales channels > Develop apps")
                    print()
                    print("2. Insufficient API scopes")
                    print("   - Access token needs 'read_products', 'write_products', 'read_orders'")
                    print("   - Edit your app's API scopes and regenerate token")
                    print()
                    print("3. Wrong shop domain")
                    print("   - Verify SHOPIFY_SHOP_DOMAIN matches your store")
                    print("   - Format: your-store.myshopify.com (not your custom domain)")
                    print()
                    print("4. API access disabled")
                    print("   - Check if your app is installed and active")
                    print("   - Verify API access is enabled for your plan")
                    print()

                elif "404" in error_msg:
                    print("🔍 404 Not Found Error Diagnosis:")
                    print()
                    print("Likely Causes:")
                    print("- Incorrect shop domain")
                    print("- Wrong API version")
                    print(f"  Current version: {settings.api_version}")
                    print("  Try: 2024-01 or 2023-10")
                    print()

                return

            # Test 2: Check API scopes by trying to fetch products
            print("🔐 Step 4: Checking API Scopes")
            print("-" * 70)

            scopes_ok = True

            try:
                print("Testing read_products scope...")
                products_data = await client.get_products(limit=1)
                product_count = len(products_data.get("products", []))
                print(f"✅ read_products: OK (found {product_count} products)")
            except ValueError as e:
                print(f"❌ read_products: FAILED - {e}")
                scopes_ok = False

            try:
                print("Testing read_orders scope...")
                orders_data = await client.get_orders(limit=1)
                order_count = len(orders_data.get("orders", []))
                print(f"✅ read_orders: OK (found {order_count} orders)")
            except ValueError as e:
                print(f"❌ read_orders: FAILED - {e}")
                scopes_ok = False

            try:
                print("Testing read_inventory scope...")
                locations_data = await client.get_locations()
                location_count = len(locations_data.get("locations", []))
                print(f"✅ read_inventory: OK (found {location_count} locations)")
            except ValueError as e:
                print(f"❌ read_inventory: FAILED - {e}")
                scopes_ok = False

            print()

            if not scopes_ok:
                print("⚠️  Some API scopes are missing or insufficient")
                print()
                print("Required Scopes for ERP Integration:")
                print("  - read_products, write_products")
                print("  - read_orders, write_orders")
                print("  - read_inventory, write_inventory")
                print("  - read_locations")
                print()
                print("To fix:")
                print("1. Go to Shopify Admin > Settings > Apps and sales channels")
                print("2. Click 'Develop apps' > Select your app")
                print("3. Click 'Configure Admin API scopes'")
                print("4. Enable the required scopes")
                print("5. Save and reinstall the app")
                print("6. Generate a new access token")
                print()

    except Exception as e:
        print(f"❌ Unexpected Error: {e}")
        print()
        import traceback
        traceback.print_exc()
        return

    # Final Summary
    print("=" * 70)
    print("SUMMARY")
    print("=" * 70)

    if scopes_ok:
        print("✅ All checks passed! Shopify authentication is working correctly.")
        print()
        print("Next Steps:")
        print("1. Test the /api/shopify/test endpoint in your FastAPI app")
        print("2. Configure webhook endpoints for real-time sync")
        print("3. Test bidirectional product sync")
    else:
        print("⚠️  Authentication works but some API scopes are missing.")
        print("   Follow the instructions above to add required scopes.")

    print()


def main():
    """Run verification."""
    try:
        asyncio.run(verify_shopify_authentication())
    except KeyboardInterrupt:
        print("\n\n⚠️  Verification cancelled by user")
    except Exception as e:
        print(f"\n\n❌ Fatal Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
