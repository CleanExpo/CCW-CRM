import { prisma } from '@/lib/db/prisma';

export interface SdsAttachment {
  product_id: string;
  sds_pdf_url: string | null;
  ghs_signal_word: string | null;
  hazard_statements: string[];
  revision_date: string | null;
  review_due_date: string | null;
  supplier_emergency_contact: string | null;
}

/**
 * Given invoice line items and workspace user IDs, returns SDS records for any
 * product that has a GHS signal word or non-empty hazard statements.
 * Non-hazardous products and products outside the workspace are excluded.
 */
export async function getHazardousSdsAttachments(
  lineItems: Array<{ product_id: string | null; description: string }>,
  workspaceUserIds: string[]
): Promise<SdsAttachment[]> {
  const productIds = lineItems
    .map((li) => li.product_id)
    .filter((id): id is string => Boolean(id));

  if (productIds.length === 0) return [];

  // Enforce workspace ownership — only look up products owned by this workspace
  const ownedProducts = await prisma.product.findMany({
    where: { id: { in: productIds }, ownerUserId: { in: workspaceUserIds } },
    select: { id: true },
  });
  const ownedIds = ownedProducts.map((p) => p.id);
  if (ownedIds.length === 0) return [];

  const sdsRows = await prisma.productSds.findMany({
    where: { productId: { in: ownedIds } },
  });

  return sdsRows
    .filter((row) => {
      const stmts = Array.isArray(row.hazardStatements) ? row.hazardStatements : [];
      return Boolean(row.ghsSignalWord) || stmts.length > 0;
    })
    .map((row) => ({
      product_id: row.productId,
      sds_pdf_url: row.sdsPdfUrl,
      ghs_signal_word: row.ghsSignalWord,
      hazard_statements: Array.isArray(row.hazardStatements)
        ? (row.hazardStatements as string[])
        : [],
      revision_date: row.revisionDate?.toISOString().slice(0, 10) ?? null,
      review_due_date: row.reviewDueDate?.toISOString().slice(0, 10) ?? null,
      supplier_emergency_contact: row.supplierEmergencyContact,
    }));
}
