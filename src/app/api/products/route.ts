import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { productToApi } from '@/lib/db/api-serialize';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import type { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('page_size') || '50');
    const search = searchParams.get('search');
    const category = searchParams.get('category');
    const includeInactive =
      searchParams.get('include_inactive') === 'true' ||
      searchParams.get('include_inactive') === '1';

    const where: Prisma.ProductWhereInput = { ownerUserId: { in: workspaceUserIds } };
    if (!includeInactive) {
      where.isActive = true;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (category) {
      where.category = category;
    }

    const [rows, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.product.count({ where }),
    ]);

    return NextResponse.json({
      items: rows.map(productToApi),
      total,
      page,
      page_size: pageSize,
      total_pages: Math.ceil(total / pageSize),
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const body = (await request.json()) as Record<string, unknown>;
    const row = await prisma.product.create({
      data: {
        ownerUserId: scope.userId,
        name: String(body.name ?? ''),
        sku: String(body.sku ?? ''),
        category: (body.category as string) ?? null,
        price: Number(body.price ?? 0),
        stock: Number(body.stock ?? 0),
        isActive: (body.is_active as boolean) ?? (body.isActive as boolean) ?? true,
        warehouseLocation:
          (body.warehouse_location as string) ?? (body.warehouseLocation as string) ?? null,
      },
    });
    return NextResponse.json(productToApi(row), { status: 201 });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
