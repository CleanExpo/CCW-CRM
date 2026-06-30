import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScopeOrCronIntegrationJob } from '@/lib/auth/data-scope';
import {
  fetchCin7CustomerPage,
  fetchCin7ProductPage,
  fetchCin7SaleTotal,
  getCin7CoreCredentials,
  pingCin7Core,
} from '@/lib/integrations/cin7-core';
import {
  fetchOmniContactsPage,
  fetchOmniProductPage,
  fetchOmniSalesOrderCount,
  getCin7OmniCredentials,
  pingCin7Omni,
} from '@/lib/integrations/cin7-omni';

const MAX_PAGES = Math.max(1, Math.min(50, Number(process.env.CIN7_SYNC_MAX_PAGES || 10)));

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ entityType: string }> }
) {
  const scope = await requireAuthScopeOrCronIntegrationJob(request);
  if (!scope) {
    return NextResponse.json(
      {
        detail:
          'Not authenticated. For cron, send Authorization: Bearer CRON_SECRET and set CRON_INTEGRATION_USER_ID.',
      },
      { status: 401 }
    );
  }

  const { entityType } = await context.params;
  const allowed = ['products', 'customers', 'orders', 'inventory'] as const;
  if (!allowed.includes(entityType as (typeof allowed)[number])) {
    return NextResponse.json({ detail: 'Unsupported entity type' }, { status: 400 });
  }

  const coreCreds = getCin7CoreCredentials(request);
  const omniCreds = getCin7OmniCredentials(request);

  const coreLive = coreCreds ? await pingCin7Core(coreCreds) : false;
  const omniLive = omniCreds ? await pingCin7Omni(omniCreds) : false;

  const useCore = coreLive;
  const useOmni = !coreLive && omniLive;

  if (!useCore && !useOmni) {
    return NextResponse.json(
      {
        detail:
          'Cin7 is not reachable. Configure Cin7 Core and/or Omni and ensure at least one API accepts your credentials.',
      },
      { status: 401 }
    );
  }

  let recordsProcessed = 0;

  if (entityType === 'products' || entityType === 'inventory') {
    if (useCore && coreCreds) {
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const { rows, total } = await fetchCin7ProductPage(coreCreds, page, 100);
        if (rows.length === 0) break;
        for (const row of rows) {
          const sku = String(row.Sku ?? '').trim();
          if (!sku) continue;
          const name = String(row.Name ?? sku).trim() || sku;
          const price = Number(row.Price ?? row.SellPrice ?? 0) || 0;
          const stock = Math.max(0, Math.floor(Number(row.Available ?? 0)));
          const existing = await prisma.product.findFirst({
            where: { ownerUserId: scope.userId, sku },
            select: { id: true },
          });
          if (existing) {
            await prisma.product.update({
              where: { id: existing.id },
              data: { name, price, stock },
            });
          } else {
            await prisma.product.create({
              data: {
                ownerUserId: scope.userId,
                sku,
                name,
                price,
                stock,
                category: 'Cin7',
                isActive: true,
              },
            });
          }
          recordsProcessed += 1;
        }
        if (page * pageSize >= total) break;
      }
    } else if (useOmni && omniCreds) {
      const pageSize = 100;
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const { rows, total, sourceRowCount } = await fetchOmniProductPage(
          omniCreds,
          page,
          pageSize
        );
        if (sourceRowCount === 0) break;
        for (const row of rows) {
          const sku = row.sku.trim();
          if (!sku) continue;
          const name = row.name.trim() || sku;
          const price = row.price;
          const stock = row.stock;
          const existing = await prisma.product.findFirst({
            where: { ownerUserId: scope.userId, sku },
            select: { id: true },
          });
          if (existing) {
            await prisma.product.update({
              where: { id: existing.id },
              data: { name, price, stock },
            });
          } else {
            await prisma.product.create({
              data: {
                ownerUserId: scope.userId,
                sku,
                name,
                price,
                stock,
                category: 'Cin7 Omni',
                isActive: true,
              },
            });
          }
          recordsProcessed += 1;
        }
        if (total != null && total > 0 && page * pageSize >= total) break;
        if (sourceRowCount < pageSize) break;
      }
    }
  } else if (entityType === 'customers') {
    if (useCore && coreCreds) {
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const { rows, total } = await fetchCin7CustomerPage(coreCreds, page, 100);
        if (rows.length === 0) break;
        for (const row of rows) {
          const companyName = String(row.Name ?? 'Cin7 customer').trim() || 'Cin7 customer';
          const email = row.Email ? String(row.Email).trim() : '';
          const phone = row.Phone ? String(row.Phone).trim() : undefined;
          const city = row.City ? String(row.City).trim() : undefined;
          if (email) {
            const existing = await prisma.customer.findFirst({
              where: { ownerUserId: scope.userId, email },
            });
            if (existing) {
              await prisma.customer.update({
                where: { id: existing.id },
                data: { companyName, phone, city },
              });
            } else {
              await prisma.customer.create({
                data: { ownerUserId: scope.userId, companyName, email, phone, city },
              });
            }
          } else {
            await prisma.customer.create({
              data: { ownerUserId: scope.userId, companyName, phone, city },
            });
          }
          recordsProcessed += 1;
        }
        if (page * 100 >= total) break;
      }
    } else if (useOmni && omniCreds) {
      const pageSize = 100;
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const { rows, total, sourceRowCount } = await fetchOmniContactsPage(omniCreds, page, pageSize);
        if (sourceRowCount === 0) break;
        for (const row of rows) {
          const companyName = row.companyName;
          const email = row.email;
          const phone = row.phone;
          const city = row.city;
          if (email) {
            const existing = await prisma.customer.findFirst({
              where: { ownerUserId: scope.userId, email },
            });
            if (existing) {
              await prisma.customer.update({
                where: { id: existing.id },
                data: { companyName, phone, city },
              });
            } else {
              await prisma.customer.create({
                data: { ownerUserId: scope.userId, companyName, email, phone, city },
              });
            }
          } else {
            await prisma.customer.create({
              data: { ownerUserId: scope.userId, companyName, phone, city },
            });
          }
          recordsProcessed += 1;
        }
        if (total != null && total > 0 && page * pageSize >= total) break;
        if (sourceRowCount < pageSize) break;
      }
    }
  } else if (entityType === 'orders') {
    if (useCore && coreCreds) {
      recordsProcessed = await fetchCin7SaleTotal(coreCreds);
    } else if (useOmni && omniCreds) {
      recordsProcessed = await fetchOmniSalesOrderCount(omniCreds);
    }
  }

  return NextResponse.json({
    status: 'ok',
    records_processed: recordsProcessed,
  });
}
