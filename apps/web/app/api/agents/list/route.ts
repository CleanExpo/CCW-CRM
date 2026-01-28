import { NextResponse } from "next/server";

/**
 * GET /api/agents/list
 *
 * Bridge endpoint that transforms monitoring agents data into agent list format.
 */
export async function GET() {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

    // Fetch agents from monitoring API
    const agentsRes = await fetch(`${backendUrl}/api/ai/monitoring/agents`, {
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!agentsRes.ok) {
      throw new Error(`Failed to fetch agents: ${agentsRes.statusText}`);
    }

    const agentsData = await agentsRes.json();

    // Fetch stats for each agent
    const agentsWithStats = await Promise.all(
      agentsData.agents.map(async (agent: Record<string, unknown>) => {
        try {
          const statsRes = await fetch(
            `${backendUrl}/api/ai/monitoring/stats/${agent.agent_id}`,
            {
              cache: "no-store",
              headers: {
                "Content-Type": "application/json",
              },
            }
          );

          if (!statsRes.ok) {
            // Return agent without stats if fetch fails
            return {
              agent_id: agent.agent_id,
              agent_type: agent.name,
              status: "active",
              task_count: 0,
              success_rate: 0,
              capabilities: agent.capabilities,
            };
          }

          const stats = await statsRes.json();

          // Transform to expected format
          return {
            agent_id: agent.agent_id,
            agent_type: agent.name,
            status: stats.error_rate_percent < 50 ? "active" : "degraded",
            task_count: stats.total_executions,
            success_rate: stats.total_executions > 0
              ? 1 - (stats.error_rate_percent / 100)
              : 0,
            capabilities: agent.capabilities,
          };
        } catch (error) {
          // Return agent without stats on error
          return {
            agent_id: agent.agent_id,
            agent_type: agent.name,
            status: "active",
            task_count: 0,
            success_rate: 0,
            capabilities: agent.capabilities,
          };
        }
      })
    );

    return NextResponse.json(agentsWithStats);
  } catch (error: unknown) {
    console.error("Error fetching agent list:", error);
    return NextResponse.json([]);
  }
}
