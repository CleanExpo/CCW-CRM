import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/agents/tasks/recent?limit=10
 *
 * Bridge endpoint that transforms monitoring executions into task history format.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = searchParams.get("limit") || "10";

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

    // Fetch recent executions from monitoring API
    const executionsRes = await fetch(
      `${backendUrl}/api/ai/monitoring/executions?limit=${limit}`,
      {
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!executionsRes.ok) {
      throw new Error(`Failed to fetch executions: ${executionsRes.statusText}`);
    }

    const executionsData = await executionsRes.json();

    // Transform to expected format
    const tasks = executionsData.executions.map((execution: any) => ({
      task_id: execution.execution_id,
      agent_type: execution.agent_name,
      description: execution.task,
      status: execution.status,
      verified: execution.metadata?.verified || false,
      iterations: execution.metadata?.iterations || 1,
      duration_seconds: execution.duration_ms ? execution.duration_ms / 1000 : null,
      created_at: execution.started_at,
      error: execution.error || null,
    }));

    return NextResponse.json(tasks);
  } catch (error: any) {
    console.error("Error fetching recent tasks:", error);
    return NextResponse.json([]);
  }
}
