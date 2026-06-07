import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { workspaceOwnerIds } from '@/lib/bank-reconciliation/scope';

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const ownerIds = await workspaceOwnerIds(scope.userId);
    const rules = await prisma.bankReconciliationRule.findMany({
      where: { ownerUserId: { in: ownerIds } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(
      rules.map((r) => ({
        id: r.id,
        name: r.name,
        match_pattern: r.matchPattern,
        match_field: r.matchField,
        action_type: r.actionType,
        account_code: r.accountCode,
        gst_category: r.gstCategory,
        is_active: r.isActive,
      }))
    );
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const body = (await request.json()) as {
      name?: string;
      match_pattern?: string;
      match_field?: string;
      action_type?: string;
      account_code?: string;
      gst_category?: string;
    };

    if (!body.name?.trim() || !body.match_pattern?.trim() || !body.action_type?.trim()) {
      return NextResponse.json(
        { detail: 'name, match_pattern, and action_type are required' },
        { status: 400 }
      );
    }

    const rule = await prisma.bankReconciliationRule.create({
      data: {
        ownerUserId: scope.userId,
        name: body.name.trim(),
        matchPattern: body.match_pattern.trim(),
        matchField: body.match_field?.trim() || 'description',
        actionType: body.action_type.trim(),
        accountCode: body.account_code?.trim() || null,
        gstCategory: body.gst_category?.trim() || null,
      },
    });

    return NextResponse.json({ id: rule.id, name: rule.name }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
