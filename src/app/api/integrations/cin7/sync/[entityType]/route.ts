import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import {
  fetchCin7CustomerPage,
  fetchCin7ProductPage,
  fetchCin7SaleTotal,
  getCin7CoreCredentials,
} from '@/lib/integrations/cin7-core';

const MAX_PAGES = Math.max(1, Math.min(50, Number(process.env.CIN7_SYNC_MAX_PAGES || 10)));

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ entityType: string }> }
) {
  const { entityType } = await context.params;
  const allowed = ['products', 'customers', 'orders', 'inventory'] as const;
  if (!allowed.includes(entityType as (typeof allowed)[number])) {
    return NextResponse.json({ detail: 'Unsupported entity type' }, { status: 400 });
  }

  const creds = getCin7CoreCredentials(request);
  if (!creds) {
    return NextResponse.json({ detail: 'Cin7 credentials not configured.' }, { status: 401 });
  }

  let recordsProcessed = 0;

  if (entityType === 'products' || entityType === 'inventory') {
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const { rows, total } = await fetchCin7ProductPage(creds, page, 100);
      if (rows.length === 0) break;
      for (const row of rows) {
        const sku = String(row.Sku ?? '').trim();
        if (!sku) continue;
        const name = String(row.Name ?? sku).trim() || sku;
        const price = Number(row.Price ?? row.SellPrice ?? 0) || 0;
        const stock = Math.max(0, Math.floor(Number(row.Available ?? 0)));
        await prisma.product.upsert({
          where: { sku },
          create: {
            sku,
            name,
            price,
            stock,
            category: 'Cin7',
            isActive: true,
          },
          update: {
            name,
            price,
            stock,
          },
        });
        recordsProcessed += 1;
      }
      if (page * 100 >= total) break;
    }
  } else if (entityType === 'customers') {
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const { rows, total } = await fetchCin7CustomerPage(creds, page, 100);
      if (rows.length === 0) break;
      for (const row of rows) {
        const companyName = String(row.Name ?? 'Cin7 customer').trim() || 'Cin7 customer';
        const email = row.Email ? String(row.Email).trim() : '';
        const phone = row.Phone ? String(row.Phone).trim() : undefined;
        const city = row.City ? String(row.City).trim() : undefined;
        if (email) {
          const existing = await prisma.customer.findFirst({ where: { email } });
          if (existing) {
            await prisma.customer.update({
              where: { id: existing.id },
              data: { companyName, phone, city },
            });
          } else {
            await prisma.customer.create({
              data: { companyName, email, phone, city },
            });
          }
        } else {
          await prisma.customer.create({
            data: { companyName, phone, city },
          });
        }
        recordsProcessed += 1;
      }
      if (page * 100 >= total) break;
    }
  } else if (entityType === 'orders') {
    recordsProcessed = await fetchCin7SaleTotal(creds);
  }

  return NextResponse.json({
    status: 'ok',
    records_processed: recordsProcessed,
  });
}
