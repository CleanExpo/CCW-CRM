import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuthScope } from "@/lib/auth/data-scope";
import { getWorkspaceMemberUserIds } from "@/lib/auth/workspace-scope";

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope)
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(
      200,
      Math.max(1, parseInt(searchParams.get("page_size") || "50", 10)),
    );
    const personaFilter = searchParams.get("persona_filter");

    const customers = await prisma.customer.findMany({
      where: {
        isActive: true,
        ownerUserId: { in: workspaceUserIds },
      },
      include: { persona: true },
      orderBy: { companyName: "asc" },
    });

    const allRows = customers.map((c) => {
      const p = c.persona;
      return {
        customer_id: c.id,
        company_name: c.companyName,
        persona: p?.persona ?? "unclassified",
        confidence: p?.confidence ?? "low",
        reason:
          p?.reason ??
          "Not classified yet — run Re-classify All.",
        classified_at: p?.classifiedAt.toISOString() ?? null,
      };
    });

    const summary: Record<string, number> = {};
    for (const row of allRows) {
      summary[row.persona] = (summary[row.persona] ?? 0) + 1;
    }

    const filtered =
      personaFilter && personaFilter !== "all"
        ? allRows.filter((r) => r.persona === personaFilter)
        : allRows;

    const total = filtered.length;
    const total_pages = Math.ceil(total / pageSize) || 1;
    const items = filtered.slice((page - 1) * pageSize, page * pageSize);

    return NextResponse.json({
      items,
      total,
      page,
      page_size: pageSize,
      total_pages,
      summary,
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
