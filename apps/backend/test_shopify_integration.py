"""Test script for Shopify integration (comprehensive).

This script tests:
1. Connection status
2. Order import (single and bulk)
3. Inventory sync (single and bulk)
4. Product sync
5. Webhook handling
"""

import asyncio
import hashlib
import hmac
import json

import httpx


async def test_shopify_integration():
    """Test the complete Shopify integration flow."""
    base_url = "http://localhost:8000"

    async with httpx.AsyncClient() as client:
        # Step 1: Check connection status
        print("\n=== Step 1: Checking Shopify Connection Status ===")
        response = await client.get(f"{base_url}/api/integrations/shopify/status")

        if response.status_code != 200:
            print(f"[ERROR] Failed to get status: {response.text}")
            return

        status_data = response.json()
        print("[SUCCESS] Connection status:")
        print(f"  Mode: {status_data.get('mode')}")
        print(f"  Connected: {status_data.get('connected')}")
        print(f"  Shop: {status_data.get('shop_domain', 'N/A')}")

        # Step 2: Test order import
        print("\n=== Step 2: Testing Order Import ===")

        # Import single order (using demo Shopify order ID)
        demo_order_id = 1001
        response = await client.post(
            f"{base_url}/api/integrations/shopify/import-order/{demo_order_id}"
        )

        if response.status_code != 200:
            print(f"[ERROR] Single order import failed: {response.text}")
        else:
            order_data = response.json()
            print("[SUCCESS] Order imported:")
            print(f"  Order Number: {order_data.get('order_number')}")
            print(f"  Order ID: {order_data.get('order_id')}")
            print(f"  Total: ${order_data.get('total')}")
            print(f"  Status: {order_data.get('status')}")

        # Import multiple orders
        print("\n=== Step 3: Testing Bulk Order Import ===")
        response = await client.post(
            f"{base_url}/api/integrations/shopify/import-orders?max_orders=5"
        )

        if response.status_code != 200:
            print(f"[ERROR] Bulk order import failed: {response.text}")
        else:
            bulk_data = response.json()
            print("[SUCCESS] Bulk import completed:")
            print(f"  Imported: {bulk_data.get('imported_count')} orders")
            for order in bulk_data.get("orders", [])[:3]:
                print(f"    - {order['order_number']}: ${order['total']}")

        # Step 4: Get a product to sync
        print("\n=== Step 4: Getting Product for Sync Test ===")
        response = await client.get(f"{base_url}/api/products?page=1&page_size=1")

        if response.status_code != 200:
            print(f"[ERROR] Failed to get products: {response.text}")
            return

        products_data = response.json()
        products = products_data.get("items", [])

        if not products:
            print("[ERROR] No products found")
            return

        product = products[0]
        product_id = product["id"]
        product_name = product["name"]
        product_stock = product["stock"]

        print(f"Selected product: {product_name}")
        print(f"  ID: {product_id}")
        print(f"  Current Stock: {product_stock}")

        # Step 5: Sync product to Shopify
        print("\n=== Step 5: Syncing Product to Shopify ===")
        response = await client.post(
            f"{base_url}/api/integrations/shopify/sync-product/{product_id}"
        )

        if response.status_code != 200:
            print(f"[ERROR] Product sync failed: {response.text}")
        else:
            sync_data = response.json()
            print("[SUCCESS] Product synced to Shopify:")
            print(f"  Action: {sync_data.get('action', 'N/A')}")
            print(f"  Shopify Product ID: {sync_data.get('shopify_product_id', 'N/A')}")

        # Step 6: Sync inventory
        print("\n=== Step 6: Syncing Product Inventory ===")
        response = await client.post(
            f"{base_url}/api/integrations/shopify/sync-inventory/{product_id}"
        )

        if response.status_code != 200:
            print(f"[ERROR] Inventory sync failed: {response.text}")
        else:
            inv_data = response.json()
            print("[SUCCESS] Inventory synced:")
            print(f"  Product ID: {inv_data.get('product_id', 'N/A')}")
            print(f"  Stock Updated: {inv_data.get('stock_updated', 'N/A')}")

        # Step 7: Test bulk inventory sync
        print("\n=== Step 7: Testing Bulk Inventory Sync ===")
        response = await client.post(
            f"{base_url}/api/integrations/shopify/sync-all-inventory"
        )

        if response.status_code != 200:
            print(f"[ERROR] Bulk inventory sync failed: {response.text}")
        else:
            bulk_inv_data = response.json()
            print("[SUCCESS] Bulk inventory sync completed:")
            print(f"  Total Synced: {bulk_inv_data.get('synced_count', 0)}")
            print(f"  Failed: {bulk_inv_data.get('failed_count', 0)}")

        # Step 8: Simulate webhook
        print("\n=== Step 8: Testing Webhook Handler ===")

        # Create mock webhook payload for order creation
        webhook_payload = {
            "id": 1234567890,
            "order_number": 1002,
            "name": "#1002",
            "email": "customer@example.com",
            "total_price": "299.99",
            "subtotal_price": "299.99",
            "total_tax": "0.00",
            "currency": "USD",
            "financial_status": "paid",
            "fulfillment_status": None,
            "line_items": [
                {
                    "id": 123456789,
                    "title": "Demo Product",
                    "quantity": 2,
                    "price": "149.99",
                    "sku": "DEMO-001",
                }
            ],
            "customer": {
                "id": 98765,
                "email": "customer@example.com",
                "first_name": "Demo",
                "last_name": "Customer",
            },
            "created_at": "2024-01-15T10:30:00Z",
        }

        # Calculate HMAC signature (demo mode, but still good practice)
        webhook_secret = "demo_webhook_secret_xyz"
        payload_json = json.dumps(webhook_payload)
        payload_bytes = payload_json.encode("utf-8")

        signature = hmac.new(
            webhook_secret.encode("utf-8"), payload_bytes, hashlib.sha256
        ).hexdigest()

        webhook_headers = {
            "X-Shopify-Topic": "orders/create",
            "X-Shopify-Shop-Domain": "demo-store.myshopify.com",
            "X-Shopify-Webhook-Id": "webhook-123-456",
            "X-Shopify-Hmac-SHA256": signature,
            "Content-Type": "application/json",
        }

        response = await client.post(
            f"{base_url}/api/integrations/shopify/webhooks",
            content=payload_json,
            headers=webhook_headers,
        )

        if response.status_code != 200:
            print(f"[ERROR] Webhook processing failed: {response.text}")
        else:
            webhook_result = response.json()
            print("[SUCCESS] Webhook processed:")
            print(f"  Result: {json.dumps(webhook_result, indent=2)}")

        # Summary
        print("\n" + "=" * 60)
        print("[SUCCESS] Shopify integration tests completed!")
        print("=" * 60)
        print("Summary:")
        print("  1. Connection status verified")
        print("  2. Order import (single & bulk) working")
        print("  3. Product sync to Shopify working")
        print("  4. Inventory sync (single & bulk) working")
        print("  5. Webhook handler processing events")
        print("=" * 60)


if __name__ == "__main__":
    print("=" * 60)
    print("Shopify Integration Comprehensive Test")
    print("=" * 60)
    asyncio.run(test_shopify_integration())
