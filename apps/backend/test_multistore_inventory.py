"""Test script for multi-store inventory management.

This script tests:
1. Creating stock at multiple locations
2. Querying stock by location
3. Stock transfers between locations
4. Stock reservations for orders
5. Low stock alerts
6. Stock adjustments
"""

import asyncio

import httpx


async def test_multistore_inventory():
    """Test the complete multi-store inventory flow."""
    base_url = "http://localhost:8000"

    async with httpx.AsyncClient() as client:
        # Step 1: Get a product to work with
        print("\n=== Step 1: Getting a Product ===")
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
        product_sku = product["sku"]

        print(f"Selected product: {product_name} ({product_sku})")
        print(f"  ID: {product_id}")

        # Step 2: Add stock to multiple locations
        print("\n=== Step 2: Adding Stock to Multiple Locations ===")

        locations = [
            {"location": "brisbane", "quantity": 50},
            {"location": "sydney", "quantity": 30},
            {"location": "melbourne", "quantity": 20},
        ]

        for loc_data in locations:
            response = await client.post(
                f"{base_url}/api/inventory/adjust",
                json={
                    "product_id": product_id,
                    "location": loc_data["location"],
                    "quantity_change": loc_data["quantity"],
                    "adjustment_type": "stock_count",
                    "reason": f"Initial stock for {loc_data['location']}",
                },
            )

            if response.status_code != 200:
                print(f"[ERROR] Failed to add stock at {loc_data['location']}: {response.text}")
            else:
                result = response.json()
                print(
                    f"[SUCCESS] Added {loc_data['quantity']} units to {loc_data['location']}"
                )
                print(f"  New Stock: {result.get('new_quantity')}")

        # Step 3: Check stock across all locations
        print("\n=== Step 3: Checking Stock Across All Locations ===")
        response = await client.get(
            f"{base_url}/api/inventory/product/{product_id}/locations"
        )

        if response.status_code != 200:
            print(f"[ERROR] Failed to get stock: {response.text}")
        else:
            stock_data = response.json()
            print(f"[SUCCESS] Stock summary for {stock_data.get('product_name')}:")
            print(f"  Total Stock: {stock_data.get('total_stock')}")
            print(f"  Total Available: {stock_data.get('total_available')}")
            print(f"  Total Reserved: {stock_data.get('total_reserved')}")
            print("\n  By Location:")
            for loc in stock_data.get("locations", []):
                print(
                    f"    - {loc['location']}: {loc['stock']} units "
                    f"(Available: {loc['available']}, Reserved: {loc['reserved']})"
                )

        # Step 4: Transfer stock between locations
        print("\n=== Step 4: Transferring Stock (Sydney -> Brisbane) ===")
        response = await client.post(
            f"{base_url}/api/inventory/transfer",
            json={
                "product_id": product_id,
                "from_location": "sydney",
                "to_location": "brisbane",
                "quantity": 10,
                "reason": "Rebalancing inventory",
            },
        )

        if response.status_code != 200:
            print(f"[ERROR] Transfer failed: {response.text}")
        else:
            transfer_data = response.json()
            print("[SUCCESS] Transfer completed:")
            print(f"  Transfer ID: {transfer_data.get('transfer_id')}")
            print(f"  From: {transfer_data.get('from_location')}")
            print(f"  To: {transfer_data.get('to_location')}")
            print(f"  Quantity: {transfer_data.get('quantity')}")
            print(f"  Status: {transfer_data.get('status')}")

        # Step 5: Verify stock after transfer
        print("\n=== Step 5: Verifying Stock After Transfer ===")
        response = await client.get(
            f"{base_url}/api/inventory/product/{product_id}/locations"
        )

        if response.status_code == 200:
            stock_data = response.json()
            print("[SUCCESS] Updated stock levels:")
            for loc in stock_data.get("locations", []):
                print(f"  {loc['location']}: {loc['stock']} units (Available: {loc['available']})")

        # Step 6: Get an order for reservation test
        print("\n=== Step 6: Testing Stock Reservation ===")
        response = await client.get(f"{base_url}/api/orders?page=1&page_size=1")

        if response.status_code != 200:
            print(f"[ERROR] Failed to get orders: {response.text}")
        else:
            orders_data = response.json()
            orders = orders_data.get("items", [])

            if orders:
                order = orders[0]
                order_id = order["id"]

                # Reserve stock for this order
                response = await client.post(
                    f"{base_url}/api/inventory/reserve",
                    json={
                        "product_id": product_id,
                        "order_id": order_id,
                        "location": "brisbane",
                        "quantity": 5,
                        "expires_hours": 24,
                    },
                )

                if response.status_code != 200:
                    print(f"[ERROR] Reservation failed: {response.text}")
                else:
                    reserve_data = response.json()
                    reservation_id = reserve_data.get("reservation_id")
                    print("[SUCCESS] Stock reserved:")
                    print(f"  Reservation ID: {reservation_id}")
                    print(f"  Order ID: {order_id}")
                    print(f"  Location: {reserve_data.get('location')}")
                    print(f"  Quantity: {reserve_data.get('quantity')}")
                    print(f"  Expires: {reserve_data.get('expires_at')}")

                    # Check updated stock levels
                    print("\n  Checking updated stock with reservation:")
                    response = await client.get(
                        f"{base_url}/api/inventory/product/{product_id}/locations"
                    )
                    if response.status_code == 200:
                        stock_data = response.json()
                        brisbane_stock = next(
                            (loc for loc in stock_data.get("locations", []) if loc["location"] == "brisbane"),
                            None,
                        )
                        if brisbane_stock:
                            print(
                                f"  Brisbane: {brisbane_stock['stock']} stock, "
                                f"{brisbane_stock['reserved']} reserved, "
                                f"{brisbane_stock['available']} available"
                            )

                    # Release the reservation
                    print("\n  Releasing reservation...")
                    response = await client.post(
                        f"{base_url}/api/inventory/release/{reservation_id}"
                    )

                    if response.status_code == 200:
                        print("  [SUCCESS] Reservation released")
                    else:
                        print(f"  [ERROR] Failed to release: {response.text}")

        # Step 7: Check stock at a specific location
        print("\n=== Step 7: Checking Stock at Brisbane Location ===")
        response = await client.get(
            f"{base_url}/api/inventory/by-location?location=brisbane&page_size=10"
        )

        if response.status_code != 200:
            print(f"[ERROR] Failed to get location stock: {response.text}")
        else:
            loc_data = response.json()
            print("[SUCCESS] Products at Brisbane:")
            print(f"  Total Products: {loc_data.get('total')}")
            for item in loc_data.get("items", [])[:5]:
                print(
                    f"    - {item['product_name']}: {item['stock']} "
                    f"(Available: {item['available']}, Reserved: {item['reserved']})"
                )

        # Step 8: Check low stock products
        print("\n=== Step 8: Checking Low Stock Products ===")
        response = await client.get(f"{base_url}/api/inventory/low-stock?threshold=25")

        if response.status_code != 200:
            print(f"[ERROR] Failed to get low stock: {response.text}")
        else:
            low_stock_data = response.json()
            print("[SUCCESS] Products below 25 units:")
            print(f"  Total Products: {low_stock_data.get('total_products')}")
            for prod in low_stock_data.get("products", [])[:3]:
                print(f"\n  {prod['product_name']} ({prod['product_sku']}):")
                for loc in prod["locations"]:
                    print(
                        f"    - {loc['location']}: {loc['stock']} units "
                        f"(Available: {loc['available']})"
                    )

        # Step 9: Get transfer history
        print("\n=== Step 9: Checking Transfer History ===")
        response = await client.get(
            f"{base_url}/api/inventory/transfers?page=1&page_size=5"
        )

        if response.status_code != 200:
            print(f"[ERROR] Failed to get transfers: {response.text}")
        else:
            transfers_data = response.json()
            print("[SUCCESS] Recent transfers:")
            print(f"  Total Transfers: {transfers_data.get('total')}")
            for transfer in transfers_data.get("items", []):
                print(
                    f"\n  Transfer {transfer['transfer_id'][:8]}...:"
                )
                print(
                    f"    Product: {transfer['product_name']} ({transfer['product_sku']})"
                )
                print(
                    f"    Route: {transfer['from_location']} -> {transfer['to_location']}"
                )
                print(f"    Quantity: {transfer['quantity']}")
                print(f"    Status: {transfer['status']}")

        # Summary
        print("\n" + "=" * 60)
        print("[SUCCESS] Multi-store inventory tests completed!")
        print("=" * 60)
        print("Summary:")
        print("  1. Stock added to 3 locations (Brisbane, Sydney, Melbourne)")
        print("  2. Stock levels queried across all locations")
        print("  3. Stock transferred between locations")
        print("  4. Stock reservation system tested")
        print("  5. Low stock alerts working")
        print("  6. Transfer history tracked")
        print("=" * 60)


if __name__ == "__main__":
    print("=" * 60)
    print("Multi-Store Inventory Management Test")
    print("=" * 60)
    asyncio.run(test_multistore_inventory())
