import { NextRequest, NextResponse } from "next/server";
import { requireUpstreamBase } from '@/lib/api/upstream-proxy';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const base = requireUpstreamBase('Workflow detail');
    if (base instanceof NextResponse) return base;

    const { id } = await params;
    const response = await fetch(`${base}/api/workflows/${id}`);
    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Error fetching workflow:", error);
    return NextResponse.json(
      { error: "Failed to fetch workflow" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const base = requireUpstreamBase('Workflow update');
    if (base instanceof NextResponse) return base;

    const { id } = await params;
    const body = await request.json();

    const response = await fetch(`${base}/api/workflows/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Error updating workflow:", error);
    return NextResponse.json(
      { error: "Failed to update workflow" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const base = requireUpstreamBase('Workflow delete');
    if (base instanceof NextResponse) return base;

    const { id } = await params;
    const response = await fetch(`${base}/api/workflows/${id}`, {
      method: "DELETE",
    });

    if (response.status === 204) {
      return new NextResponse(null, { status: 204 });
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Error deleting workflow:", error);
    return NextResponse.json(
      { error: "Failed to delete workflow" },
      { status: 500 }
    );
  }
}
