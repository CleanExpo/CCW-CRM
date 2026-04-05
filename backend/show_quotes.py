import json
import sys

data = json.load(sys.stdin)
demo_quotes = [q for q in data['items'] if 'DEMO' in q['quote_number']]

print('\n' + '='*80)
print('DEMO QUOTES - CARPET CLEANING & WATER DAMAGE RESTORATION BUSINESS')
print('='*80 + '\n')

for i, quote in enumerate(demo_quotes, 1):
    print(f'{i}. QUOTE: {quote["quote_number"]}')
    print(f'   Status: {quote["status"].upper()}')
    print(f'   Total: ${quote["total"]}')
    print(f'   Quote Date: {quote["quote_date"][:10]}')
    print(f'   Valid Until: {quote["valid_until"][:10]}')
    print(f'   Items: {len(quote["items"])} products')
    if quote.get('notes'):
        notes = quote['notes'][:100]
        print(f'   Notes: {notes}...')
    print()

print(f'\nTotal Demo Quotes: {len(demo_quotes)}')
print('='*80)
