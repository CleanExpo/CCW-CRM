import { prisma } from '@/lib/db/prisma';

export type Cin7DuplicateCleanupResult = {
  email_duplicates_removed: number;
  orphan_no_id_removed: number;
  kept: number;
};

/** Remove duplicate CRM customers created before Cin7 id upserts (safe: no related records). */
export async function cleanupDuplicateCustomers(
  ownerUserId: string
): Promise<Cin7DuplicateCleanupResult> {
  let emailDuplicatesRemoved = 0;
  let orphanNoIdRemoved = 0;

  const withEmail = await prisma.customer.findMany({
    where: { ownerUserId, email: { not: null } },
    select: {
      id: true,
      email: true,
      cin7ContactId: true,
      createdAt: true,
      _count: { select: { orders: true, quotes: true, invoices: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const byEmail = new Map<string, typeof withEmail>();
  for (const row of withEmail) {
    const key = row.email!.trim().toLowerCase();
    const list = byEmail.get(key) ?? [];
    list.push(row);
    byEmail.set(key, list);
  }

  for (const group of byEmail.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => {
      if (a.cin7ContactId && !b.cin7ContactId) return -1;
      if (!a.cin7ContactId && b.cin7ContactId) return 1;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
    for (const row of sorted.slice(1)) {
      const hasRelations =
        row._count.orders > 0 || row._count.quotes > 0 || row._count.invoices > 0;
      if (hasRelations) continue;
      await prisma.customer.delete({ where: { id: row.id } });
      emailDuplicatesRemoved += 1;
    }
  }

  const orphans = await prisma.customer.findMany({
    where: {
      ownerUserId,
      cin7ContactId: null,
      OR: [{ email: null }, { email: '' }],
    },
    select: {
      id: true,
      _count: { select: { orders: true, quotes: true, invoices: true } },
    },
  });

  for (const row of orphans) {
    const hasRelations =
      row._count.orders > 0 || row._count.quotes > 0 || row._count.invoices > 0;
    if (hasRelations) continue;
    await prisma.customer.delete({ where: { id: row.id } });
    orphanNoIdRemoved += 1;
  }

  const kept = await prisma.customer.count({ where: { ownerUserId } });

  return {
    email_duplicates_removed: emailDuplicatesRemoved,
    orphan_no_id_removed: orphanNoIdRemoved,
    kept,
  };
}
