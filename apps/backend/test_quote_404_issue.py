"""Diagnostic test to reproduce quote 404 errors."""
import asyncio
import uuid

import httpx


async def test_quote_conversion_404():
    """Test the quote conversion scenario that's failing with 404."""
    base_url = "http://localhost:8000"

    async with httpx.AsyncClient(timeout=30.0) as client:
        print("=== Testing Quote Conversion Scenario ===\n")

        # Step 1: Create a customer
        print("Step 1: Creating customer...")
        customer_data = {
            'customer_number': f'CUST-{uuid.uuid4().hex[:8].upper()}',
            'company_name': 'Test Company',
            'contact_name': 'Test Contact',
            'email': 'test@example.com',
            'phone': '555-1234',
            'address': '123 Test St',
            'city': 'Test City',
            'state': 'CA',
            'postal_code': '12345',
            'country': 'USA',
        }

        response = await client.post(f"{base_url}/api/customers", json=customer_data)
        if response.status_code != 201:
            print(f"❌ Customer creation failed: {response.status_code}")
            print(f"Response: {response.text}")
            return False
        customer_id = response.json()['id']
        print(f"✅ Customer created: {customer_id}")

        # Step 2: Create a product
        print("\nStep 2: Creating product...")
        product_data = {
            'sku': f'SKU-{uuid.uuid4().hex[:8].upper()}',
            'name': 'Test Product',
            'category': 'HAND_TOOLS',
            'price': 99.99,
            'cost': 50.00,
            'stock': 1000,
        }

        response = await client.post(f"{base_url}/api/products", json=product_data)
        if response.status_code != 201:
            print(f"❌ Product creation failed: {response.status_code}")
            return False
        product_id = response.json()['id']
        print(f"✅ Product created: {product_id}")

        # Step 3: Create a quote
        print("\nStep 3: Creating quote...")
        from datetime import datetime, timedelta
        quote_data = {
            'customer_id': customer_id,
            'status': 'draft',
            'valid_until': (datetime.now() + timedelta(days=30)).date().isoformat(),
            'notes': 'Test quote',
            'items': [
                {
                    'product_id': product_id,
                    'quantity': 2,
                }
            ],
        }

        response = await client.post(f"{base_url}/api/quotes", json=quote_data)
        if response.status_code != 201:
            print(f"❌ Quote creation failed: {response.status_code}")
            print(f"Response: {response.text}")
            return False

        quote_response = response.json()
        quote_id = quote_response.get('id')
        if not quote_id:
            print("❌ Quote created but no ID in response")
            print(f"Response keys: {quote_response.keys()}")
            return False

        print(f"✅ Quote created: {quote_id}")

        # Step 4: Verify quote exists immediately
        print("\nStep 4: Verifying quote exists...")
        response = await client.get(f"{base_url}/api/quotes/{quote_id}")
        if response.status_code != 200:
            print(f"❌ Quote GET failed: {response.status_code}")
            print(f"Response: {response.text}")
            return False
        print(f"✅ Quote verified: {response.json()['quote_number']}")

        # Step 5: Update quote to accepted
        print("\nStep 5: Updating quote status to accepted...")
        response = await client.put(
            f"{base_url}/api/quotes/{quote_id}",
            json={'status': 'accepted'}
        )
        if response.status_code != 200:
            print(f"❌ Quote update failed: {response.status_code}")
            print(f"Response: {response.text}")
            return False
        print("✅ Quote updated to accepted")

        # Step 6: Convert quote to order
        print("\nStep 6: Converting quote to order...")
        response = await client.post(f"{base_url}/api/quotes/{quote_id}/convert-to-order")

        if response.status_code == 404:
            print("❌ REPRODUCED THE BUG: Got 404 when converting quote")
            print(f"Response: {response.text}")

            # Try to fetch the quote again
            print("\nDiagnostic: Checking if quote still exists...")
            check_response = await client.get(f"{base_url}/api/quotes/{quote_id}")
            print(f"Quote lookup: {check_response.status_code}")
            if check_response.status_code == 200:
                print(f"Quote exists! Data: {check_response.json()}")

            return False
        elif response.status_code == 201:
            print("✅ Quote converted to order successfully")
            order = response.json()
            print(f"Order number: {order['order_number']}")
            return True
        else:
            print(f"⚠️  Unexpected status code: {response.status_code}")
            print(f"Response: {response.text}")
            return False

if __name__ == "__main__":
    result = asyncio.run(test_quote_conversion_404())
    print(f"\n{'='*50}")
    print(f"Test result: {'PASSED ✅' if result else 'FAILED ❌'}")
    print(f"{'='*50}")
    exit(0 if result else 1)
