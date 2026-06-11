import { NextResponse } from "next/server";
import { requireUpstreamBase } from '@/lib/api/upstream-proxy';
import { isDemoMode } from '@/lib/demo-mode';

/**
 * GET /api/agents/stats
 *
 * Bridge endpoint that transforms monitoring data into agent stats format.
 * This allows server components to work without modification.
 *
 * UNI-2116: On API failure, returns a structured error response instead of
 * silently returning zeroed mock data. Mock data is only served when
 * NEXT_PUBLIC_DEMO_MODE=true.
 */
export async function GET() {
  const base = requireUpstreamBase('Agent monitoring system');
  if (base instanceof NextResponse) return base;

  try {
    // Fetch system health from monitoring API
    const healthRes = await fetch(`${base}/api/ai/monitoring/system`, {
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!healthRes.ok) {
      throw new Error(`Failed to fetch system health: ${healthRes.statusText}`);
    }

    const health = await healthRes.json();

    // Fetch agent list to get total count
    const agentsRes = await fetch(`${base}/api/ai/monitoring/agents`, {
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!agentsRes.ok) {
      throw new Error(`Failed to fetch agents: ${agentsRes.statusText}`);
    }

    const agentsData = await agentsRes.json();

    // Transform to expected format
    const stats = {
      total_agents: agentsData.total || 0,
      active_agents: agentsData.total || 0, // All registered agents are considered active
      total_tasks: health.recent_executions || 0,
      successful_tasks: health.completed || 0,
      failed_tasks: health.failed || 0,
      success_rate: health.recent_executions > 0
        ? health.completed / health.recent_executions
        : 0,
      avg_iterations: 1.5, // TODO: Calculate from execution metadata
      avg_duration_seconds: (health.avg_response_time_ms || 0) / 1000,
    };

    return NextResponse.json(stats);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[UNI-2116] Agent stats API failure:", message);

    if (isDemoMode()) {
      // Demo mode: return explicit zeroed placeholder so the UI renders
      console.warn("[UNI-2116] DEMO MODE active — returning demo stats");
      return NextResponse.json({
        total_agents: 0,
        active_agents: 0,
        total_tasks: 0,
        successful_tasks: 0,
        failed_tasks: 0,
        success_rate: 0,
        avg_iterations: 0,
        avg_duration_seconds: 0,
      });
    }

    // Production/staging: surface the error so callers can show an error state
    return NextResponse.json(
      { error: "agent_stats_unavailable", message },
      { status: 503 }
    );
  }
}
