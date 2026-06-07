import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const ownerIds = await getWorkspaceMemberUserIds(scope.userId);

    const [total, active, withEmail, byCustomer] = await Promise.all([
      prisma.crmContact.count({ where: { ownerUserId: { in: ownerIds } } }),
      prisma.crmContact.count({ where: { ownerUserId: { in: ownerIds }, isActive: true } }),
      prisma.crmContact.count({
        where: { ownerUserId: { in: ownerIds }, email: { not: null } },
      }),
      prisma.crmContact.groupBy({
        by: ['customerId'],
        where: { ownerUserId: { in: ownerIds }, customerId: { not: null } },
        _count: { _all: true },
      }),
    ]);

    return NextResponse.json({
      total_contacts: total,
      active_contacts: active,
      contacts_with_email: withEmail,
      contacts_by_customer: byCustomer.length,
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
