import json
import sys

data = json.load(sys.stdin)

print('\n' + '='*80)
print('PRODUCTS IN DATABASE')
print('='*80 + '\n')

print(f'Total Products: {data["total"]:,}')
print(f'Page {data["page"]} of {data["total_pages"]:,}\n')

for i, product in enumerate(data['items'], 1):
    category = product.get('category', 'N/A')
    if category != 'N/A':
        category = category.replace('_', ' ').title()

    print(f'{i}. {product["name"]}')
    print(f'   SKU: {product["sku"]}')
    print(f'   Category: {category}')
    print(f'   Price: ${product["price"]} | Cost: ${product["cost"]}')
    print(f'   Stock: {product["stock"]} units')

    if product.get('warehouse_location'):
        print(f'   Warehouse: {product["warehouse_location"]}')

    print()

print('='*80)
print(f'\nShowing {len(data["items"])} of {data["total"]:,} products')
