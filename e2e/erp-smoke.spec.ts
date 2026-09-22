import { expect, test } from '@playwright/test';
import { getCredentials, login, MISSING_CREDENTIALS_MESSAGE } from './auth';

/**
 * UNI-2108: one create/read/update pass per core ERP module.
 * Never skips. Missing credentials or a dead database fail this file.
 */
const POS_TERMINAL_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1';

async function json(res: { status: () => number; text: () => Promise<string>; ok: () => boolean }) {
  const text = await res.text();
  if (!res.ok()) {
    throw new Error(`HTTP ${res.status()}: ${text.slice(0, 400)}`);
  }
  return text ? JSON.parse(text) : {};
}

test.describe('UNI-2108 ERP smoke pack', () => {
  test('login then products, customers, quotes, orders, stock, POS, invoice export', async ({
    page,
  }) => {
    const creds = getCredentials();
    expect(creds, MISSING_CREDENTIALS_MESSAGE).not.toBeNull();
    if (!creds) throw new Error(MISSING_CREDENTIALS_MESSAGE);

    const registerProbe = await page.request.post('/api/auth/register', {
      data: {
        email: `closed-${Date.now()}@example.invalid`,
        password: 'ClosedPass12ab',
        full_name: 'Closed',
      },
      failOnStatusCode: false,
    });
    expect(
      registerProbe.status(),
      'Public signup stays closed; this pack logs in a seeded owner, it does not open registration.'
    ).toBe(403);

    await login(page, creds.email, creds.password);
    const api = page.request;

    const stamp = Date.now();
    const sku = `SMOKE-${stamp}`;

    const product = await json(
      await api.post('/api/products', {
        data: { name: 'Smoke pump', sku, price: 50, stock: 15, warehouse_location: 'brisbane' },
      })
    );
    expect(product.id).toBeTruthy();
    const gotProduct = await json(await api.get(`/api/products/${product.id}`));
    expect(gotProduct.sku).toBe(sku);
    const patchedProduct = await json(
      await api.patch(`/api/products/${product.id}`, { data: { name: 'Smoke pump updated' } })
    );
    expect(patchedProduct.name).toContain('updated');

    const customer = await json(
      await api.post('/api/customers', {
        data: { company_name: `Smoke Co ${stamp}`, email: `smoke.${stamp}@example.com` },
      })
    );
    expect(customer.id).toBeTruthy();
    const gotCustomer = await json(await api.get(`/api/customers/${customer.id}`));
    expect(gotCustomer.company_name).toContain('Smoke Co');
    const patchedCustomer = await json(
      await api.patch(`/api/customers/${customer.id}`, {
        data: { company_name: `Smoke Co ${stamp} Pty` },
      })
    );
    expect(patchedCustomer.company_name).toContain('Pty');

    const quote = await json(
      await api.post('/api/quotes', {
        data: {
          customer_id: customer.id,
          items: [{ product_id: product.id, quantity: 1 }],
        },
      })
    );
    expect(quote.id).toBeTruthy();
    await json(await api.get(`/api/quotes/${quote.id}`));
    const quoteUpdate = await json(
      await api.put(`/api/quotes/${quote.id}`, {
        data: {
          customer_id: customer.id,
          status: 'sent',
          items: [{ product_id: product.id, quantity: 2 }],
        },
      })
    );
    expect(quoteUpdate.status || quoteUpdate.id).toBeTruthy();

    const order = await json(
      await api.post('/api/orders', {
        data: {
          customer_id: customer.id,
          status: 'draft',
          items: [{ product_id: product.id, quantity: 1 }],
        },
      })
    );
    expect(order.id).toBeTruthy();
    await json(await api.get(`/api/orders/${order.id}`));
    await json(await api.put(`/api/orders/${order.id}/status`, { data: { status: 'confirmed' } }));

    const reserved = await api.post('/api/inventory/reserve', {
      data: {
        product_id: product.id,
        order_id: order.id,
        location: 'brisbane',
        quantity: 1,
      },
    });
    expect(reserved.ok(), await reserved.text()).toBeTruthy();

    const adjusted = await api.post('/api/inventory/adjust', {
      data: { product_id: product.id, location: 'brisbane', quantity_change: 2 },
    });
    expect(adjusted.ok(), await adjusted.text()).toBeTruthy();

    const transferred = await api.post('/api/inventory/transfer', {
      data: {
        product_id: product.id,
        from_location: 'brisbane',
        to_location: 'sydney',
        quantity: 1,
      },
    });
    expect(transferred.ok(), await transferred.text()).toBeTruthy();

    const pos = await json(
      await api.post('/api/pos/transactions', {
        data: {
          terminal_id: POS_TERMINAL_ID,
          payment_method: 'cash',
          items: [{ product_id: product.id, quantity: 1, unit_price: 50 }],
        },
      })
    );
    expect(pos.id || pos.transaction_number).toBeTruthy();

    const invoice = await json(await api.post(`/api/invoices/from-order/${order.id}`));
    expect(invoice.id).toBeTruthy();
    const csv = await api.get('/api/invoices?format=csv');
    expect(csv.ok(), await csv.text()).toBeTruthy();
    expect(csv.headers()['content-type'] || '').toMatch(/csv/);

    await page.goto('/products', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Smoke pump updated').first()).toBeVisible({ timeout: 15_000 });
    await page.goto('/customers', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(`Smoke Co ${stamp} Pty`).first()).toBeVisible({ timeout: 15_000 });
    for (const path of ['/quotes', '/orders', '/invoices']) {
      const pageRes = await page.goto(path, { waitUntil: 'domcontentloaded' });
      expect(pageRes?.status(), path).toBeLessThan(400);
    }
  });
});
