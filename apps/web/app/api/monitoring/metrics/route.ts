import { NextRequest, NextResponse } from "next/server";

const PROMETHEUS_URL = process.env.PROMETHEUS_URL || "http://localhost:9090";

/**
 * GET /api/monitoring/metrics
 *
 * Queries Prometheus for system metrics and returns formatted data
 * for the monitoring dashboard charts and stat cards.
 */
export async function GET(request: NextRequest) {
  try {
    const queries: Record<string, string> = {
      // PostgreSQL
      pg_connections: "sum(pg_stat_activity_count)",
      pg_max_connections: "pg_settings_max_connections",
      pg_database_size: 'pg_database_size_bytes{datname="starter_db"}',
      pg_commits_rate: 'rate(pg_stat_database_xact_commit{datname="starter_db"}[5m])',
      pg_rollbacks_rate: 'rate(pg_stat_database_xact_rollback{datname="starter_db"}[5m])',
      pg_inserts_rate: 'rate(pg_stat_database_tup_inserted{datname="starter_db"}[5m])',
      pg_updates_rate: 'rate(pg_stat_database_tup_updated{datname="starter_db"}[5m])',
      pg_deletes_rate: 'rate(pg_stat_database_tup_deleted{datname="starter_db"}[5m])',
      pg_locks: "pg_locks_count",

      // Redis
      redis_memory_used: "redis_memory_used_bytes",
      redis_memory_max: "redis_memory_max_bytes",
      redis_connected_clients: "redis_connected_clients",
      redis_commands_rate: "rate(redis_commands_processed_total[5m])",
      redis_hit_rate:
        "rate(redis_keyspace_hits_total[5m]) / (rate(redis_keyspace_hits_total[5m]) + rate(redis_keyspace_misses_total[5m]))",
      redis_evicted_keys_rate: "rate(redis_evicted_keys_total[5m])",
      redis_total_keys: "sum(redis_db_keys)",
      redis_uptime: "redis_uptime_in_seconds",
      redis_net_input_rate: "rate(redis_net_input_bytes_total[5m])",
      redis_net_output_rate: "rate(redis_net_output_bytes_total[5m])",
    };

    // Execute all queries in parallel
    const entries = Object.entries(queries);
    const results = await Promise.allSettled(
      entries.map(([, query]) => queryPrometheus(query))
    );

    const metrics: Record<string, number | null> = {};
    entries.forEach(([key], index) => {
      const result = results[index];
      if (result.status === "fulfilled" && result.value) {
        const val = result.value?.data?.result?.[0]?.value;
        metrics[key] = val ? parseFloat(val[1]) : null;
      } else {
        metrics[key] = null;
      }
    });

    return NextResponse.json({
      metrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error fetching monitoring metrics:", error);
    return NextResponse.json(
      { error: "Failed to fetch metrics", metrics: {} },
      { status: 500 }
    );
  }
}

async function queryPrometheus(query: string): Promise<any> {
  const res = await fetch(
    `${PROMETHEUS_URL}/api/v1/query?query=${encodeURIComponent(query)}`,
    { cache: "no-store" }
  );
  if (!res.ok) return null;
  return res.json();
}
