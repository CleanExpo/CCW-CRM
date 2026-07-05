import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { prisma } from '@/lib/db/prisma';

export async function GET(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const page = Math.max(Number(searchParams.get('page')) || 1, 1);
  const pageSize = Math.min(Math.max(Number(searchParams.get('page_size')) || 50, 1), 200);
  const search = searchParams.get('search')?.trim();

  const where = {
    ownerUserId: scope.userId,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { city: { contains: search, mode: 'insensitive' as const } },
            { cin7BranchId: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.cin7Branch.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.cin7Branch.count({ where }),
  ]);

  return NextResponse.json({
    items: rows.map((row) => ({
      id: row.id,
      cin7_branch_id: row.cin7BranchId,
      name: row.name,
      branch_type: row.branchType,
      email: row.email,
      phone: row.phone,
      city: row.city,
      state: row.state,
      post_code: row.postCode,
      is_active: row.isActive,
      updated_at: row.updatedAt.toISOString(),
    })),
    total,
    page,
    page_size: pageSize,
    total_pages: Math.ceil(total / pageSize) || 1,
  });
}
