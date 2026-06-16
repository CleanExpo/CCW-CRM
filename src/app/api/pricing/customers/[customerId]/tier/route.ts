/**
 * GET    /api/pricing/customers/[customerId]/tier  — fetch the customer's current price tier
 * PUT    /api/pricing/customers/[customerId]/tier  — assign (upsert) a price tier to the customer
 * DELETE /api/pricing/customers/[customerId]/tier  — remove the customer's price tier assignment
 *
 * The customer detail page already calls GET on this endpoint and shows the result
 * in a badge (src/app/(dashboard)/customers/[id]/page.tsx line ~182).
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';

type RouteParams = { params: Promise<{ customerId: string }> };

function tierToApi(tier: {
  id: string;
  customerId: string;
  priceListId: string;
  expiresAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  priceList: {
    name: string;
    isActive: boolean;
    priceOverrides: unknown;
    volumeBreaks: unknown;
  };
}) {
  const isExpired = tier.expiresAt !== null && tier.expiresAt < new Date();
  return {
    id: tier.id,
    customer_id: tier.customerId,
    tier_id: tier.priceListId,
    price_list_id: tier.priceListId,
    tier_name: tier.priceList.name,
    // Legacy field — the customer detail page badge reads this.
    discount_pct: '0',
    is_active: tier.priceList.isActive && !isExpired,
    is_expired: isExpired,
    expires_at: tier.expiresAt ? tier.expiresAt.toISOString() : null,
    effective_date: tier.createdAt.toISOString(),
    notes: tier.notes,
    price_overrides: tier.priceList.priceOverrides,
    volume_breaks: tier.priceList.volumeBreaks,
    created_at: tier.createdAt,
    updated_at: tier.updatedAt,
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const { customerId } = await params;
    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);

    const tier = await prisma.customerPriceTier.findUnique({
      where: { customerId },
      include: {
        priceList: {
          select: { name: true, isActive: true, priceOverrides: true, volumeBreaks: true },
        },
      },
    });

    if (!tier) return NextResponse.json(null);

    if (!workspaceUserIds.includes(tier.ownerUserId)) {
      return NextResponse.json(null);
    }

    return NextResponse.json(tierToApi(tier));
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const { customerId } = await params;
    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);

    const body = (await request.json()) as {
      price_list_id?: string;
      expires_at?: string | null;
      notes?: string | null;
    };

    const priceListId = String(body.price_list_id ?? '').trim();
    if (!priceListId) {
      return NextResponse.json({ detail: 'price_list_id is required' }, { status: 400 });
    }

    // Verify the customer belongs to this workspace.
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, ownerUserId: { in: workspaceUserIds } },
      select: { id: true },
    });
    if (!customer) {
      return NextResponse.json({ detail: 'Customer not found' }, { status: 404 });
    }

    const priceList = await prisma.priceList.findFirst({
      where: { id: priceListId, ownerUserId: { in: workspaceUserIds }, isActive: true },
      select: { id: true, name: true, isActive: true, priceOverrides: true, volumeBreaks: true },
    });
    if (!priceList) {
      return NextResponse.json({ detail: 'Price list not found or inactive' }, { status: 404 });
    }

    const expiresAt =
      body.expires_at && String(body.expires_at).trim()
        ? new Date(String(body.expires_at))
        : null;

    const upserted = await prisma.customerPriceTier.upsert({
      where: { customerId },
      create: {
        ownerUserId: scope.userId,
        customerId,
        priceListId,
        expiresAt: expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null,
        notes: body.notes ? String(body.notes) : null,
      },
      update: {
        priceListId,
        expiresAt: expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null,
        notes: body.notes !== undefined ? (body.notes ? String(body.notes) : null) : undefined,
      },
      include: {
        priceList: {
          select: { name: true, isActive: true, priceOverrides: true, volumeBreaks: true },
        },
      },
    });

    return NextResponse.json(tierToApi(upserted), { status: 200 });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const { customerId } = await params;
    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);

    const existing = await prisma.customerPriceTier.findUnique({
      where: { customerId },
      select: { id: true, ownerUserId: true },
    });

    if (!existing || !workspaceUserIds.includes(existing.ownerUserId)) {
      return NextResponse.json({ detail: 'Tier not found' }, { status: 404 });
    }

    await prisma.customerPriceTier.delete({ where: { customerId } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
