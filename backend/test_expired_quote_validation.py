"""Test to reproduce 422 validation error on expired quotes."""
import asyncio
import httpx
import uuid
from datetime import datetime, timedelta

async def test_expired_quote_validation():
    """Test creating a quote with past valid_until date."""
    base_url = "http://localhost:8000"
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        print("=== Testing Expired Quote Validation ===\n")
        
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
        
        # Step 3: Create a quote with EXPIRED valid_until date
        print("\nStep 3: Creating quote with EXPIRED date...")
        expired_date = (datetime.now() - timedelta(days=30)).date().isoformat()
        print(f"Using expired date: {expired_date}")
        
        quote_data = {
            'customer_id': customer_id,
            'status': 'draft',
            'valid_until': expired_date,  # PAST DATE
            'notes': 'Test expired quote',
            'items': [
                {
                    'product_id': product_id,
                    'quantity': 2,
                }
            ],
        }
        
        print(f"Request data: {quote_data}")
        
        response = await client.post(f"{base_url}/api/quotes", json=quote_data)
        
        print(f"\nResponse status: {response.status_code}")
        
        if response.status_code == 422:
            print(f"❌ Got 422 Validation Error (reproducing the bug)")
            print(f"Error details:")
            try:
                error_data = response.json()
                import json
                print(json.dumps(error_data, indent=2))
            except:
                print(response.text)
            return False
        elif response.status_code == 201:
            print(f"✅ Quote created successfully (expired dates are allowed)")
            quote = response.json()
            print(f"Quote number: {quote['quote_number']}")
            print(f"Valid until: {quote['valid_until']}")
            return True
        else:
            print(f"⚠️  Unexpected status code: {response.status_code}")
            print(f"Response: {response.text}")
            return False

if __name__ == "__main__":
    result = asyncio.run(test_expired_quote_validation())
    print(f"\n{'='*50}")
    print(f"Test result: {'PASSED ✅' if result else 'FAILED ❌'}")
    print(f"{'='*50}")
    exit(0 if result else 1)
