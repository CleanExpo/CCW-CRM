"""Test to reproduce 500 error when updating order items."""
import asyncio
import uuid

import httpx


async def test_order_update_items():
    """Reproduce the 500 error from order_update_items scenario."""
    base_url = "http://localhost:8000"

    async with httpx.AsyncClient(timeout=30.0) as client:
        print("=== Testing Order Update Items (Issue #5) ===\n")

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
            print(f"Customer creation failed: {response.status_code}")
            print(f"Response: {response.text}")
            return False
        customer_id = response.json()['id']
        print(f"Customer created: {customer_id}")

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
            print(f"Product creation failed: {response.status_code}")
            print(f"Response: {response.text}")
            return False
        product_id = response.json()['id']
        print(f"Product created: {product_id}")

        # Step 3: Create an order
        print("\nStep 3: Creating order...")
        order_data = {
            'customer_id': customer_id,
            'status': 'draft',
            'notes': 'Test order for item update',
            'items': [
                {
                    'product_id': product_id,
                    'quantity': 2,
                }
            ],
        }

        response = await client.post(f"{base_url}/api/orders", json=order_data)
        if response.status_code != 201:
            print(f"Order creation failed: {response.status_code}")
            print(f"Response: {response.text}")
            return False
        order_id = response.json()['id']
        order_number = response.json()['order_number']
        print(f"Order created: {order_number} (ID: {order_id})")

        # Step 4: Update order items (this is where the 500 error occurs)
        print("\nStep 4: Updating order items...")
        update_data = {
            'items': [
                {
                    'product_id': product_id,
                    'quantity': 5,  # Change quantity
                }
            ]
        }

        print(f"Request data: {update_data}")

        response = await client.put(f"{base_url}/api/orders/{order_id}", json=update_data)

        print(f"\nResponse status: {response.status_code}")

        if response.status_code == 500:
            print("GOT 500 ERROR (reproducing the bug)")
            print("Error details:")
            try:
                error_data = response.json()
                import json
                print(json.dumps(error_data, indent=2))
            except:
                print(response.text)
            return False
        elif response.status_code == 200:
            print("Order updated successfully")
            order = response.json()
            print(f"Order number: {order['order_number']}")
            print(f"Total: {order['total']}")
            print(f"Items: {len(order.get('items', []))}")
            return True
        else:
            print(f"Unexpected status code: {response.status_code}")
            print(f"Response: {response.text}")
            return False


if __name__ == "__main__":
    result = asyncio.run(test_order_update_items())
    print(f"\n{'='*50}")
    print(f"Test result: {'PASSED' if result else 'FAILED'}")
    print(f"{'='*50}")
    exit(0 if result else 1)
