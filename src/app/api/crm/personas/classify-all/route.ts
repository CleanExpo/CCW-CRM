import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuthScope } from "@/lib/auth/data-scope";
import { getWorkspaceMemberUserIds } from "@/lib/auth/workspace-scope";
import { classifyCustomerPersona } from "@/lib/crm/classify-persona";

export async function POST(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope)
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);

    const customers = await prisma.customer.findMany({
      where: {
        isActive: true,
        ownerUserId: { in: workspaceUserIds },
      },
      include: {
        orders: {
          where: { status: { not: "cancelled" } },
          include: {
            lineItems: {
              include: {
                product: { select: { name: true, category: true } },
              },
            },
          },
        },
      },
    });

    let classified = 0;
    for (const c of customers) {
      const orders = c.orders.map((o) => ({
        status: o.status,
        createdAt: o.createdAt,
        total: o.total,
        lineItems: o.lineItems.map((li) => ({
          quantity: li.quantity,
          lineTotal: li.lineTotal,
          product: {
            name: li.product.name,
            category: li.product.category,
          },
        })),
      }));

      const result = classifyCustomerPersona(c, orders);

      await prisma.customerPersona.upsert({
        where: { customerId: c.id },
        create: {
          customerId: c.id,
          persona: result.persona,
          confidence: result.confidence,
          reason: result.reason,
        },
        update: {
          persona: result.persona,
          confidence: result.confidence,
          reason: result.reason,
          classifiedAt: new Date(),
        },
      });
      classified++;
    }

    const personaRows = await prisma.customerPersona.findMany({
      where: {
        customer: {
          isActive: true,
          ownerUserId: { in: workspaceUserIds },
        },
      },
      select: { persona: true },
    });

    const summary: Record<string, number> = {};
    for (const row of personaRows) {
      summary[row.persona] = (summary[row.persona] ?? 0) + 1;
    }

    return NextResponse.json({ classified, summary });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
