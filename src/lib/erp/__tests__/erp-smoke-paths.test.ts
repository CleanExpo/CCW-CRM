import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(process.cwd(), 'src/app/api');

const REQUIRED = [
  'products/route.ts',
  'products/[id]/route.ts',
  'customers/route.ts',
  'customers/[customerId]/route.ts',
  'quotes/route.ts',
  'quotes/[id]/route.ts',
  'orders/route.ts',
  'orders/[id]/route.ts',
  'orders/[id]/status/route.ts',
  'inventory/reserve/route.ts',
  'inventory/adjust/route.ts',
  'inventory/transfer/route.ts',
  'pos/transactions/route.ts',
  'invoices/route.ts',
  'invoices/from-order/[orderId]/route.ts',
];

describe('UNI-2108 route surface', () => {
  it('keeps a handler for every module the smoke pack walks', () => {
    const missing = REQUIRED.filter((rel) => !existsSync(join(ROOT, rel)));
    expect(missing, `missing API routes:\n${missing.join('\n')}`).toEqual([]);
  });
});
