import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';

function serializeTaxRate(row: {
  id: string;
  name: string;
  rate: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    name: row.name,
    rate: row.rate,
    is_default: row.isDefault,
    is_active: row.isActive,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const ownerIds = await getWorkspaceMemberUserIds(scope.userId);
    const rows = await prisma.taxRate.findMany({
      where: { ownerUserId: { in: ownerIds }, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });

    if (rows.length === 0) {
      return NextResponse.json([
        {
          id: 'default-gst',
          name: 'GST (Australia)',
          rate: 10,
          is_default: true,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);
    }

    return NextResponse.json(rows.map(serializeTaxRate));
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const body = (await request.json()) as {
      name?: string;
      rate?: number;
      is_default?: boolean;
    };

    if (!body.name?.trim() || body.rate == null) {
      return NextResponse.json({ detail: 'name and rate are required' }, { status: 400 });
    }

    if (body.is_default) {
      await prisma.taxRate.updateMany({
        where: { ownerUserId: scope.userId },
        data: { isDefault: false },
      });
    }

    const row = await prisma.taxRate.create({
      data: {
        ownerUserId: scope.userId,
        name: body.name.trim(),
        rate: Number(body.rate),
        isDefault: body.is_default ?? false,
      },
    });

    return NextResponse.json(serializeTaxRate(row), { status: 201 });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
