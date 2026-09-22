import { productToApi } from '@/lib/db/api-serialize';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const { id } = await context.params;
    const row = await prisma.product.findFirst({
      where: { id, ownerUserId: { in: workspaceUserIds } },
    });
    if (!row) return NextResponse.json({ detail: 'Not found' }, { status: 404 });
    return NextResponse.json(productToApi(row));
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const { id } = await context.params;
    const existing = await prisma.product.findFirst({
      where: { id, ownerUserId: { in: workspaceUserIds } },
    });
    if (!existing) return NextResponse.json({ detail: 'Not found' }, { status: 404 });

    const body = (await request.json()) as Record<string, unknown>;
    const row = await prisma.product.update({
      where: { id },
      data: {
        name: body.name !== undefined ? String(body.name) : undefined,
        sku: body.sku !== undefined ? String(body.sku) : undefined,
        category: body.category !== undefined ? (body.category as string | null) : undefined,
        price: body.price !== undefined ? Number(body.price) : undefined,
        isActive:
          body.is_active !== undefined
            ? Boolean(body.is_active)
            : body.isActive !== undefined
              ? Boolean(body.isActive)
              : undefined,
      },
    });
    return NextResponse.json(productToApi(row));
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
