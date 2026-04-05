import json
import sys

data = json.load(sys.stdin)

print('\n' + '='*80)
print('CUSTOMERS IN DATABASE')
print('='*80 + '\n')

print(f'Total Customers: {data["total"]:,}')
print(f'Page {data["page"]} of {data["total_pages"]:,}\n')

# Find demo customers
demo_customers = []
regular_customers = []

for customer in data['items']:
    company = customer.get('company_name', '').lower()
    if any(keyword in company for keyword in ['carpet', 'water damage', 'flood', 'restoration']):
        demo_customers.append(customer)
    else:
        regular_customers.append(customer)

if demo_customers:
    print('*** DEMO CUSTOMERS (Carpet Cleaning & Water Damage Restoration):')
    print('-' * 80)
    for i, customer in enumerate(demo_customers, 1):
        print(f'\n{i}. {customer["company_name"]}')
        print(f'   Contact: {customer["contact_name"]}')
        print(f'   Email: {customer["email"]}')
        print(f'   Phone: {customer.get("phone", "N/A")}')
        city = customer.get("city", "N/A")
        state = customer.get("state", "N/A")
        postcode = customer.get("postcode", "")
        print(f'   Location: {city}, {state} {postcode}')
        status = "Active" if customer.get("is_active", True) else "Inactive"
        print(f'   Status: {status}')
    print()

if regular_customers:
    print('\nFIRST 5 REGULAR CUSTOMERS:')
    print('-' * 80)
    for i, customer in enumerate(regular_customers[:5], 1):
        print(f'\n{i}. {customer["company_name"]}')
        print(f'   Contact: {customer["contact_name"]}')
        print(f'   Email: {customer["email"]}')
        city = customer.get("city", "N/A")
        state = customer.get("state", "N/A")
        print(f'   Location: {city}, {state}')

print('\n' + '='*80)
print(f'Showing {len(data["items"])} of {data["total"]:,} customers')
print(f'Demo Customers: {len(demo_customers)} | Regular Customers: {len(regular_customers)}')
