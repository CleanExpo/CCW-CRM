import { prisma } from '@/lib/db/prisma';
import { adminApiUrl, shopifyAdminJson } from '@/lib/integrations/shopify';

type ShopifyLineItem = {
  id: number;
  sku?: string | null;
  name?: string;
  quantity: number;
  price?: string;
  grams?: number;
};

type ShopifyAddress = {
  company?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

type ShopifyOrderPayload = {
  id: number;
  name?: string;
  order_number?: number;
  email?: string | null;
  financial_status?: string | null;
  fulfillment_status?: string | null;
  total_price?: string;
  currency?: string;
  customer?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    default_address?: ShopifyAddress | null;
  } | null;
  billing_address?: ShopifyAddress | null;
  shipping_address?: ShopifyAddress | null;
  line_items?: ShopifyLineItem[];
};

function mapFinancialToErpStatus(financial?: string | null): string {
  const s = (financial || '').toLowerCase();
  if (s === 'paid' || s === 'partially_paid') return 'confirmed';
  if (s === 'refunded' || s === 'voided') return 'cancelled';
  return 'pending';
}

function companyFromShopifyOrder(o: ShopifyOrderPayload): string {
  const addr = o.customer?.default_address || o.billing_address || o.shipping_address;
  const company = addr?.company?.trim();
  if (company) return company;
  const cf = o.customer?.first_name || '';
  const cl = o.customer?.last_name || '';
  const name = `${cf} ${cl}`.trim();
  if (name) return name;
  if (o.email) return o.email.split('@')[0] || 'Shopify customer';
  return `Shopify order ${o.name || o.id}`;
}

function contactFromShopifyOrder(o: ShopifyOrderPayload): string | undefined {
  const cf = o.customer?.first_name || '';
  const cl = o.customer?.last_name || '';
  const name = `${cf} ${cl}`.trim();
  return name || undefined;
}

export async function importShopifyOrderToErp(
  adminHost: string,
  accessToken: string,
  shopifyOrderId: string
): Promise<{
  created: boolean;
  order_id: string;
  order_number: string;
  shopify_order_id: number;
  warnings: string[];
}> {
  const { ok, data, status } = await shopifyAdminJson<{ order?: ShopifyOrderPayload }>(
    adminHost,
    accessToken,
    `/orders/${shopifyOrderId}.json?status=any`
  );
  if (!ok || !(data as { order?: ShopifyOrderPayload }).order) {
    throw new Error(`Shopify order not found (${status})`);
  }
  const shopifyOrder = (data as { order: ShopifyOrderPayload }).order;

  const erpOrderNumber = `SHP-${shopifyOrder.id}`;
  const existing = await prisma.order.findFirst({ where: { orderNumber: erpOrderNumber } });
  if (existing) {
    return {
      created: false,
      order_id: existing.id,
      order_number: existing.orderNumber,
      shopify_order_id: shopifyOrder.id,
      warnings: ['Order was already imported.'],
    };
  }

  const email = shopifyOrder.email || shopifyOrder.customer?.email || null;
  const companyName = companyFromShopifyOrder(shopifyOrder);
  const contactName = contactFromShopifyOrder(shopifyOrder);

  let customer = email
    ? await prisma.customer.findFirst({ where: { email } })
    : await prisma.customer.findFirst({ where: { companyName } });

  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        companyName,
        contactName,
        email: email || undefined,
        phone: undefined,
        city: undefined,
      },
    });
  }

  const warnings: string[] = [];
  const lineItems = shopifyOrder.line_items || [];
  const resolved: { productId: string; quantity: number; unitPrice: number; lineTotal: number }[] = [];

  for (const li of lineItems) {
    const sku = (li.sku || '').trim();
    if (!sku) {
      warnings.push(`Line "${li.name || li.id}" has no SKU — skipped.`);
      continue;
    }
    const product = await prisma.product.findFirst({ where: { sku, isActive: true } });
    if (!product) {
      warnings.push(`No ERP product for SKU "${sku}" — line skipped.`);
      continue;
    }
    const qty = Math.max(1, Number(li.quantity) || 1);
    const unit = parseFloat(String(li.price ?? '0')) || product.price;
    const lineTotal = unit * qty;
    resolved.push({ productId: product.id, quantity: qty, unitPrice: unit, lineTotal });
  }

  if (resolved.length === 0) {
    throw new Error(
      'No line items could be matched to ERP products by SKU. Add products with matching SKUs or fix Shopify line items.'
    );
  }

  const subtotal = resolved.reduce((s, l) => s + l.lineTotal, 0);
  const totalWithTax = subtotal * 1.1;
  const statusErp = mapFinancialToErpStatus(shopifyOrder.financial_status);

  const created = await prisma.order.create({
    data: {
      customerId: customer.id,
      orderNumber: erpOrderNumber,
      status: statusErp,
      total: totalWithTax,
      lineItems: {
        create: resolved.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          lineTotal: l.lineTotal,
        })),
      },
    },
  });

  return {
    created: true,
    order_id: created.id,
    order_number: created.orderNumber,
    shopify_order_id: shopifyOrder.id,
    warnings,
  };
}

export async function shopifyGraphql<T>(
  adminHost: string,
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(adminApiUrl(adminHost, '/graphql.json'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    data?: T;
    errors?: { message?: string }[];
  };
  if (!res.ok) {
    throw new Error(`Shopify GraphQL HTTP ${res.status}`);
  }
  if (json.errors?.length) {
    throw new Error(json.errors[0]?.message || 'GraphQL error');
  }
  if (!json.data) throw new Error('Empty GraphQL response');
  return json.data;
}

export function gidToLegacyId(gid: string): string {
  const parts = gid.split('/');
  return parts[parts.length - 1] || gid;
}

export async function findVariantInventoryItemId(
  adminHost: string,
  accessToken: string,
  sku: string
): Promise<{ inventoryItemId: string } | null> {
  const q = `
    query VariantBySku($q: String!) {
      productVariants(first: 1, query: $q) {
        edges {
          node {
            sku
            inventoryItem { id }
          }
        }
      }
    }
  `;
  const data = await shopifyGraphql<{
    productVariants: { edges: { node: { sku?: string; inventoryItem?: { id: string } } }[] };
  }>(adminHost, accessToken, q, { q: `sku:${sku}` });
  const node = data.productVariants?.edges?.[0]?.node;
  const gid = node?.inventoryItem?.id;
  if (!gid) return null;
  return { inventoryItemId: gidToLegacyId(gid) };
}

export async function setInventoryLevel(
  adminHost: string,
  accessToken: string,
  locationId: string,
  inventoryItemId: string,
  available: number
): Promise<void> {
  const { ok, status, data } = await shopifyAdminJson<{ errors?: string }>(
    adminHost,
    accessToken,
    '/inventory_levels/set.json',
    {
      method: 'POST',
      body: JSON.stringify({
        location_id: locationId,
        inventory_item_id: inventoryItemId,
        available: Math.max(0, Math.floor(available)),
      }),
    }
  );
  if (!ok) {
    const err = (data as { errors?: unknown })?.errors;
    throw new Error(typeof err === 'string' ? err : `inventory set failed (${status})`);
  }
}

/** Used when Shopify order number is not passed as id */
