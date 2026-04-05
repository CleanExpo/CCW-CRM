import json
import sys

data = json.load(sys.stdin)
demo_orders = [o for o in data['items'] if 'DEMO' in o['order_number']]

print('\n' + '='*80)
print('DEMO ORDERS - CARPET CLEANING & WATER DAMAGE RESTORATION BUSINESS')
print('='*80 + '\n')

for i, order in enumerate(demo_orders, 1):
    print(f'{i}. ORDER: {order["order_number"]}')
    print(f'   Status: {order["status"].upper()}')
    print(f'   Total: ${order["total"]}')
    print(f'   Date: {order["order_date"][:10]}')
    print(f'   Items: {len(order["items"])} products')
    if order.get('notes'):
        notes = order['notes'][:100]
        print(f'   Notes: {notes}...')
    print()

print(f'\nTotal Demo Orders: {len(demo_orders)}')
print('='*80)
