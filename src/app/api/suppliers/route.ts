import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import type { Prisma } from '@prisma/client';

function supplierToJson(s: {
  id: string;
  supplierCode: string;
  companyName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  isActive: boolean;
}) {
  return {
    id: s.id,
    supplier_code: s.supplierCode,
    company_name: s.companyName,
    contact_name: s.contactName,
    email: s.email,
    phone: s.phone,
    is_active: s.isActive,
  };
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('page_size') || '50');
    const activeOnly = searchParams.get('is_active');

    const where: Prisma.SupplierWhereInput = { ownerUserId: scope.userId };
    if (activeOnly === 'true') where.isActive = true;

    const [rows, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        orderBy: { companyName: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.supplier.count({ where }),
    ]);

    return NextResponse.json({
      items: rows.map(supplierToJson),
      total,
      page,
      page_size: pageSize,
      total_pages: Math.ceil(total / pageSize) || 1,
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
    const row = await prisma.supplier.create({
      data: {
        ownerUserId: scope.userId,
        supplierCode: String(body.supplier_code ?? body.supplierCode ?? 'SUP-NEW'),
        companyName: String(body.company_name ?? body.companyName ?? 'New Supplier'),
        contactName: body.contact_name != null ? String(body.contact_name) : null,
        email: body.email != null ? String(body.email) : null,
        phone: body.phone != null ? String(body.phone) : null,
        isActive: body.is_active !== false,
      },
    });
    return NextResponse.json(supplierToJson(row), { status: 201 });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
