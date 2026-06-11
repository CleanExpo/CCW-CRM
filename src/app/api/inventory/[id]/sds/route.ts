import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';

function sdsToApi(row: {
  id: string;
  productId: string;
  sdsPdfUrl: string | null;
  ghsSignalWord: string | null;
  hazardStatements: unknown;
  revisionDate: Date | null;
  reviewDueDate: Date | null;
  supplierEmergencyContact: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    product_id: row.productId,
    sds_pdf_url: row.sdsPdfUrl,
    ghs_signal_word: row.ghsSignalWord,
    hazard_statements: Array.isArray(row.hazardStatements) ? row.hazardStatements : [],
    revision_date: row.revisionDate?.toISOString().slice(0, 10) ?? null,
    review_due_date: row.reviewDueDate?.toISOString().slice(0, 10) ?? null,
    supplier_emergency_contact: row.supplierEmergencyContact,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function emptySds(productId: string) {
  return {
    product_id: productId,
    sds_pdf_url: null,
    ghs_signal_word: null,
    hazard_statements: [],
    revision_date: null,
    review_due_date: null,
    supplier_emergency_contact: null,
  };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const { id } = await context.params;

    const product = await prisma.product.findFirst({
      where: { id, ownerUserId: { in: workspaceUserIds } },
      select: { id: true },
    });
    if (!product) return NextResponse.json({ detail: 'Not found' }, { status: 404 });

    const sds = await prisma.productSds.findUnique({ where: { productId: id } });
    if (!sds) return NextResponse.json(emptySds(id));

    return NextResponse.json(sdsToApi(sds));
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const { id } = await context.params;

    const product = await prisma.product.findFirst({
      where: { id, ownerUserId: { in: workspaceUserIds } },
      select: { id: true },
    });
    if (!product) return NextResponse.json({ detail: 'Not found' }, { status: 404 });

    const body = await request.json();

    const data = {
      sdsPdfUrl: body.sds_pdf_url ?? null,
      ghsSignalWord: body.ghs_signal_word ?? null,
      hazardStatements: Array.isArray(body.hazard_statements) ? body.hazard_statements : [],
      revisionDate: body.revision_date ? new Date(body.revision_date) : null,
      reviewDueDate: body.review_due_date ? new Date(body.review_due_date) : null,
      supplierEmergencyContact: body.supplier_emergency_contact ?? null,
    };

    const sds = await prisma.productSds.upsert({
      where: { productId: id },
      create: { productId: id, ...data },
      update: data,
    });

    return NextResponse.json(sdsToApi(sds));
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
