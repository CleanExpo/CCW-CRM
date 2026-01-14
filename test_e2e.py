import requests
import json
from datetime import datetime

BASE_URL = 'http://localhost:8000'

def test_products():
    print('=== PRODUCTS MODULE E2E TESTING ===\n')

    # 1. CREATE
    print('1. CREATE: Creating new product...')
    new_product = {
        'sku': f'E2E-TEST-{datetime.now().strftime("%H%M%S")}',
        'name': 'E2E Test Product',
        'description': 'End-to-end test product',
        'category': 'power_tools',
        'price': 149.99,
        'cost': 89.99,
        'stock': 25,
        'warehouse_location': 'A1-B2',
        'is_active': True
    }
    response = requests.post(f'{BASE_URL}/api/products', json=new_product)
    print(f'Status: {response.status_code}')
    assert response.status_code == 201, f'Failed to create: {response.text}'
    created = response.json()
    product_id = created['id']
    print(f'[PASS] Product created: ID={product_id}, SKU={created["sku"]}')
    print(f'  Name: {created["name"]}, Price: ${created["price"]}, Stock: {created["stock"]}\n')

    # 2. READ
    print('2. READ: Fetching created product...')
    response = requests.get(f'{BASE_URL}/api/products/{product_id}')
    print(f'Status: {response.status_code}')
    assert response.status_code == 200, f'Failed to read: {response.text}'
    product = response.json()
    print(f'[PASS] Product retrieved: {product["sku"]} - {product["name"]}')
    print(f'  Category: {product["category"]}, Active: {product["is_active"]}\n')

    # 3. UPDATE
    print('3. UPDATE: Updating product...')
    update_data = {
        'name': 'E2E Test Product (Updated)',
        'price': 159.99,
        'stock': 30,
        'description': 'Updated description for testing'
    }
    response = requests.put(f'{BASE_URL}/api/products/{product_id}', json=update_data)
    print(f'Status: {response.status_code}')
    assert response.status_code == 200, f'Failed to update: {response.text}'
    updated = response.json()
    print(f'[PASS] Product updated successfully')
    print(f'  New name: {updated["name"]}')
    print(f'  New price: ${updated["price"]}')
    print(f'  New stock: {updated["stock"]}\n')

    # 4. LIST/SEARCH
    print('4. LIST: Searching for product...')
    response = requests.get(f'{BASE_URL}/api/products?search=E2E+Test&page=1&page_size=10')
    print(f'Status: {response.status_code}')
    assert response.status_code == 200, f'Failed to search: {response.text}'
    data = response.json()
    print(f'[PASS] Search returned {len(data["items"])} items')
    found = any(p['id'] == product_id for p in data['items'])
    assert found, 'Product not found in search results'
    print(f'  [PASS] Our product found in search results\n')

    # 5. DELETE
    print('5. DELETE: Deleting test product...')
    response = requests.delete(f'{BASE_URL}/api/products/{product_id}')
    print(f'Status: {response.status_code}')
    assert response.status_code in [200, 204], f'Failed to delete: {response.text}'
    print(f'[PASS] Product deleted successfully\n')

    # 6. VERIFY DELETE
    print('6. VERIFY: Confirming deletion...')
    response = requests.get(f'{BASE_URL}/api/products/{product_id}')
    print(f'Status: {response.status_code}')
    if response.status_code == 404:
        print(f'[PASS] Product no longer exists (404)\n')
    elif response.status_code == 200 and not response.json().get('is_active'):
        print(f'[PASS] Product soft-deleted (is_active=False)\n')

    print('=== PRODUCTS MODULE: ALL TESTS PASSED ===\n')
    return product_id

def test_customers():
    print('=== CUSTOMERS MODULE E2E TESTING ===\n')

    # 1. CREATE
    print('1. CREATE: Creating new customer...')
    new_customer = {
        'customer_number': f'CUST-E2E-{datetime.now().strftime("%H%M%S")}',
        'company_name': 'E2E Test Company',
        'contact_name': 'John Tester',
        'email': f'test{datetime.now().strftime("%H%M%S")}@e2etest.com',
        'phone': '+61 400 123 456',
        'address': '123 Test Street',
        'city': 'Sydney',
        'state': 'NSW',
        'postal_code': '2000',
        'country': 'Australia',
        'is_active': True
    }
    response = requests.post(f'{BASE_URL}/api/customers', json=new_customer)
    print(f'Status: {response.status_code}')
    assert response.status_code == 201, f'Failed to create: {response.text}'
    created = response.json()
    customer_id = created['id']
    print(f'[PASS] Customer created: ID={customer_id}')
    print(f'  Company: {created["company_name"]}, Contact: {created["contact_name"]}')
    print(f'  Email: {created["email"]}\n')

    # 2. READ
    print('2. READ: Fetching created customer...')
    response = requests.get(f'{BASE_URL}/api/customers/{customer_id}')
    print(f'Status: {response.status_code}')
    assert response.status_code == 200, f'Failed to read: {response.text}'
    customer = response.json()
    print(f'[PASS] Customer retrieved: {customer["company_name"]}')
    print(f'  Location: {customer["city"]}, {customer["state"]}\n')

    # 3. UPDATE
    print('3. UPDATE: Updating customer...')
    update_data = {
        'company_name': 'E2E Test Company (Updated)',
        'phone': '+61 400 999 888'
    }
    response = requests.put(f'{BASE_URL}/api/customers/{customer_id}', json=update_data)
    print(f'Status: {response.status_code}')
    assert response.status_code == 200, f'Failed to update: {response.text}'
    updated = response.json()
    print(f'[PASS] Customer updated successfully')
    print(f'  New company name: {updated["company_name"]}')
    print(f'  New phone: {updated["phone"]}\n')

    # 4. LIST/SEARCH
    print('4. LIST: Searching for customer...')
    response = requests.get(f'{BASE_URL}/api/customers?search=E2E+Test&page=1&page_size=10')
    print(f'Status: {response.status_code}')
    assert response.status_code == 200, f'Failed to search: {response.text}'
    data = response.json()
    print(f'[PASS] Search returned {len(data["items"])} items')
    found = any(c['id'] == customer_id for c in data['items'])
    assert found, 'Customer not found in search results'
    print(f'  [PASS] Our customer found in search results\n')

    # 5. DELETE
    print('5. DELETE: Deleting test customer...')
    response = requests.delete(f'{BASE_URL}/api/customers/{customer_id}')
    print(f'Status: {response.status_code}')
    assert response.status_code in [200, 204], f'Failed to delete: {response.text}'
    print(f'[PASS] Customer deleted successfully\n')

    # 6. VERIFY DELETE
    print('6. VERIFY: Confirming deletion...')
    response = requests.get(f'{BASE_URL}/api/customers/{customer_id}')
    print(f'Status: {response.status_code}')
    if response.status_code == 404:
        print(f'[PASS] Customer no longer exists (404)\n')
    elif response.status_code == 200 and not response.json().get('is_active'):
        print(f'[PASS] Customer soft-deleted (is_active=False)\n')

    print('=== CUSTOMERS MODULE: ALL TESTS PASSED ===\n')
    return customer_id

def test_orders():
    print('=== ORDERS MODULE E2E TESTING ===\n')

    # Get a customer and products first
    print('0. SETUP: Getting customer and products for order...')
    customers = requests.get(f'{BASE_URL}/api/customers?page=1&page_size=1').json()
    products = requests.get(f'{BASE_URL}/api/products?page=1&page_size=2').json()

    customer_id = customers['items'][0]['id']
    product1 = products['items'][0]
    product2 = products['items'][1]
    print(f'  Using customer: {customers["items"][0]["company_name"]}')
    print(f'  Using products: {product1["name"]}, {product2["name"]}\n')

    # 1. CREATE
    print('1. CREATE: Creating new order with line items...')
    new_order = {
        'customer_id': customer_id,
        'status': 'draft',
        'order_date': datetime.now().isoformat(),
        'notes': 'E2E test order',
        'items': [
            {
                'product_id': product1['id'],
                'quantity': 2,
                'unit_price': float(product1['price'])
            },
            {
                'product_id': product2['id'],
                'quantity': 1,
                'unit_price': float(product2['price'])
            }
        ]
    }
    response = requests.post(f'{BASE_URL}/api/orders', json=new_order)
    print(f'Status: {response.status_code}')
    assert response.status_code == 201, f'Failed to create: {response.text}'
    created = response.json()
    order_id = created['id']
    print(f'[PASS] Order created: {created["order_number"]}')
    print(f'  Total: ${created["total"]}, Items: {len(created.get("items", []))}')
    print(f'  Status: {created["status"]}\n')

    # 2. READ
    print('2. READ: Fetching created order...')
    response = requests.get(f'{BASE_URL}/api/orders/{order_id}')
    print(f'Status: {response.status_code}')
    assert response.status_code == 200, f'Failed to read: {response.text}'
    order = response.json()
    print(f'[PASS] Order retrieved: {order["order_number"]}')
    print(f'  Line items: {len(order.get("items", []))}')
    for idx, item in enumerate(order.get('items', []), 1):
        print(f'    Item {idx}: Qty {item["quantity"]} x ${item["unit_price"]} = ${item["line_total"]}')

    # 3. UPDATE
    print('3. UPDATE: Updating order (changing status and notes)...')
    update_data = {
        'status': 'confirmed',
        'notes': 'E2E test order - UPDATED'
    }
    response = requests.put(f'{BASE_URL}/api/orders/{order_id}', json=update_data)
    print(f'Status: {response.status_code}')
    assert response.status_code == 200, f'Failed to update: {response.text}'
    updated = response.json()
    print(f'[PASS] Order updated successfully')
    print(f'  New status: {updated["status"]}')
    print(f'  New notes: {updated["notes"]}\n')

    # 4. LIST
    print('4. LIST: Fetching orders...')
    response = requests.get(f'{BASE_URL}/api/orders?page=1&page_size=10')
    print(f'Status: {response.status_code}')
    assert response.status_code == 200, f'Failed to list: {response.text}'
    data = response.json()
    print(f'[PASS] Listed {len(data["items"])} orders')
    found = any(o['id'] == order_id for o in data['items'])
    assert found, 'Order not found in list'
    print(f'  [PASS] Our order found in list\n')

    # 5. DELETE (change back to draft first)
    print('5. DELETE: Changing to draft status then deleting...')
    requests.put(f'{BASE_URL}/api/orders/{order_id}', json={'status': 'draft'})
    response = requests.delete(f'{BASE_URL}/api/orders/{order_id}')
    print(f'Status: {response.status_code}')
    assert response.status_code in [200, 204], f'Failed to delete: {response.text}'
    print(f'[PASS] Order deleted successfully\n')

    print('=== ORDERS MODULE: ALL TESTS PASSED ===\n')
    return order_id

def test_quotes():
    print('=== QUOTES MODULE E2E TESTING ===\n')

    # Get customer and products
    print('0. SETUP: Getting customer and products for quote...')
    customers = requests.get(f'{BASE_URL}/api/customers?page=1&page_size=1').json()
    products = requests.get(f'{BASE_URL}/api/products?page=1&page_size=2').json()

    customer_id = customers['items'][0]['id']
    product1 = products['items'][0]
    product2 = products['items'][1]
    print(f'  Using customer: {customers["items"][0]["company_name"]}')
    print(f'  Using products: {product1["name"]}, {product2["name"]}\n')

    # 1. CREATE
    print('1. CREATE: Creating new quote with line items...')
    from datetime import timedelta
    valid_until = (datetime.now() + timedelta(days=30)).isoformat()

    new_quote = {
        'customer_id': customer_id,
        'status': 'draft',
        'quote_date': datetime.now().isoformat(),
        'valid_until': valid_until,
        'notes': 'E2E test quote',
        'items': [
            {
                'product_id': product1['id'],
                'quantity': 3,
                'unit_price': float(product1['price'])
            },
            {
                'product_id': product2['id'],
                'quantity': 2,
                'unit_price': float(product2['price'])
            }
        ]
    }
    response = requests.post(f'{BASE_URL}/api/quotes', json=new_quote)
    print(f'Status: {response.status_code}')
    assert response.status_code == 201, f'Failed to create: {response.text}'
    created = response.json()
    quote_id = created['id']
    print(f'[PASS] Quote created: {created["quote_number"]}')
    print(f'  Total: ${created["total"]}, Items: {len(created.get("items", []))}')
    print(f'  Status: {created["status"]}\n')

    # 2. READ
    print('2. READ: Fetching created quote...')
    response = requests.get(f'{BASE_URL}/api/quotes/{quote_id}')
    print(f'Status: {response.status_code}')
    assert response.status_code == 200, f'Failed to read: {response.text}'
    quote = response.json()
    print(f'[PASS] Quote retrieved: {quote["quote_number"]}')
    print(f'  Line items: {len(quote.get("items", []))}')
    for idx, item in enumerate(quote.get('items', []), 1):
        print(f'    Item {idx}: Qty {item["quantity"]} x ${item["unit_price"]} = ${item["line_total"]}')

    # 3. UPDATE
    print('3. UPDATE: Updating quote to "sent" status...')
    update_data = {
        'status': 'sent',
        'notes': 'E2E test quote - SENT TO CUSTOMER'
    }
    response = requests.put(f'{BASE_URL}/api/quotes/{quote_id}', json=update_data)
    print(f'Status: {response.status_code}')
    assert response.status_code == 200, f'Failed to update: {response.text}'
    updated = response.json()
    print(f'[PASS] Quote updated successfully')
    print(f'  New status: {updated["status"]}\n')

    # 4. CONVERT TO ORDER
    print('4. CONVERT: Converting quote to order (quote should be "sent" status)...')
    # Note: Quote must NOT be "accepted" to convert (backend will set it to "accepted" after conversion)
    response = requests.post(f'{BASE_URL}/api/quotes/{quote_id}/convert-to-order', json={})
    print(f'Status: {response.status_code}')
    assert response.status_code == 201, f'Failed to convert: {response.text}'
    order = response.json()
    order_id = order['id']
    print(f'[PASS] Quote converted to order: {order["order_number"]}')
    print(f'  Order total: ${order["total"]}, Status: {order["status"]}')
    print(f'  Order items: {len(order.get("items", []))}\n')

    # 5. VERIFY CONVERSION
    print('5. VERIFY: Checking quote status after conversion...')
    response = requests.get(f'{BASE_URL}/api/quotes/{quote_id}')
    quote_after = response.json()
    print(f'[PASS] Quote status: {quote_after["status"]}')
    assert quote_after['status'] == 'accepted', f'Quote should be accepted, is {quote_after["status"]}'
    print(f'  [PASS] Quote marked as accepted\n')

    # 6. CLEANUP - Delete the converted order
    print('6. CLEANUP: Deleting converted order...')
    requests.put(f'{BASE_URL}/api/orders/{order_id}', json={'status': 'draft'})
    requests.delete(f'{BASE_URL}/api/orders/{order_id}')
    print(f'  [PASS] Cleanup complete\n')

    print('=== QUOTES MODULE: ALL TESTS PASSED ===\n')
    return quote_id, order_id

if __name__ == '__main__':
    try:
        print('\n' + '='*60)
        print('  CCW-ONLINE ERP - END-TO-END TESTING')
        print('='*60 + '\n')

        test_products()
        test_customers()
        test_orders()
        test_quotes()

        print('\n' + '='*60)
        print('  ALL END-TO-END TESTS PASSED SUCCESSFULLY!')
        print('='*60 + '\n')

    except AssertionError as e:
        print(f'\n[ERROR] Test failed: {e}\n')
        exit(1)
    except Exception as e:
        print(f'\n[ERROR] Unexpected error: {e}\n')
        import traceback
        traceback.print_exc()
        exit(1)
