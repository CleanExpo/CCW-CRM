import { NextRequest, NextResponse } from "next/server";
import { requireUpstreamBase } from '@/lib/api/upstream-proxy';

export async function GET(request: NextRequest) {
  try {
    const base = requireUpstreamBase('Workflows list');
    if (base instanceof NextResponse) return base;

    const { searchParams } = new URL(request.url);
    const url = new URL(`${base}/api/workflows`);

    // Forward query parameters
    searchParams.forEach((value, key) => {
      url.searchParams.set(key, value);
    });

    const response = await fetch(url.toString());
    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Error fetching workflows:", error);
    return NextResponse.json(
      { error: "Failed to fetch workflows" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const base = requireUpstreamBase('Workflows create');
    if (base instanceof NextResponse) return base;

    const body = await request.json();

    const response = await fetch(`${base}/api/workflows`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Error creating workflow:", error);
    return NextResponse.json(
      { error: "Failed to create workflow" },
      { status: 500 }
    );
  }
}
