/**
 * UNI-2747: the customer price list Shopify would need so a logged-in buyer
 * sees the same price as Optix. Builds the payload only. Nothing here calls
 * Shopify: pushing prices into the live store is a separate, human-approved step
 * (it also needs Shopify B2B catalogues, which have not been confirmed on this store).
 */
import { prisma } from '@/lib/db/prisma';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { resolvePrice } from '@/lib/pricing/resolve-price';

export async function buildShopifyPriceListPreview(workspaceUserIds: string[], customerId: string) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, ownerUserId: { in: workspaceUserIds } },
    select: { id: true, companyName: true, email: true, ownerUserId: true },
  });
  if (!customer) return null;
  const ids = await getWorkspaceMemberUserIds(customer.ownerUserId);
  const products = await prisma.product.findMany({
    where: { ownerUserId: { in: ids }, isActive: true },
    select: { id: true, sku: true, price: true },
    orderBy: { sku: 'asc' },
  });
  const prices = [];
  for (const p of products) {
    const r = await resolvePrice(customer.id, p.id, 1, ids);
    if (r.source !== 'catalogue' && r.unitPrice !== p.price) {
      prices.push({
        sku: p.sku,
        catalogue_price: p.price,
        customer_price: r.unitPrice,
        source: r.source,
      });
    }
  }
  return {
    dry_run: true,
    customer: { id: customer.id, company_name: customer.companyName, email: customer.email },
    currency: 'AUD',
    prices,
    note: 'Preview only. Nothing was sent to Shopify.',
  };
}
