import { NextRequest, NextResponse } from "next/server";
import { requireUpstreamBase } from '@/lib/api/upstream-proxy';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const base = requireUpstreamBase('Workflow execute');
    if (base instanceof NextResponse) return base;

    const { id } = await params;
    const body = await request.json();

    const response = await fetch(
      `${base}/api/workflows/${id}/execute`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Error executing workflow:", error);
    return NextResponse.json(
      { error: "Failed to execute workflow" },
      { status: 500 }
    );
  }
}
