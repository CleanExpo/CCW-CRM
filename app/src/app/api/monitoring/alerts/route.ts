import { NextResponse } from 'next/server';

const PROMETHEUS_URL = process.env.PROMETHEUS_URL;

interface PrometheusAlert {
  labels: Record<string, string>;
  annotations: Record<string, string>;
  state: 'firing' | 'pending' | 'inactive';
  activeAt: string;
  value: string;
}

interface AlertRule {
  name: string;
  query: string;
  state: string;
  health: string;
  alerts: PrometheusAlert[];
  labels: Record<string, string>;
  annotations: Record<string, string>;
}

/**
 * GET /api/monitoring/alerts
 *
 * Returns active alerts from Prometheus alert rules.
 */
export async function GET() {
  if (!PROMETHEUS_URL) {
    return NextResponse.json({ error: 'Prometheus not configured in this environment', rules: [], alerts: [] }, { status: 503 });
  }
  try {
    const res = await fetch(`${PROMETHEUS_URL}/api/v1/rules`, {
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error(`Prometheus unreachable: ${res.statusText}`);
    }

    const json = await res.json();
    const groups = json?.data?.groups || [];

    const alerts: Array<{
      name: string;
      severity: string;
      state: string;
      summary: string;
      description: string;
      activeAt: string;
      value: string;
    }> = [];

    let totalRules = 0;
    let firingCount = 0;
    let pendingCount = 0;

    for (const group of groups) {
      for (const rule of group.rules || []) {
        if (rule.type !== 'alerting') continue;
        totalRules++;

        for (const alert of rule.alerts || []) {
          if (alert.state === 'firing') firingCount++;
          if (alert.state === 'pending') pendingCount++;

          alerts.push({
            name: rule.name,
            severity: alert.labels?.severity || rule.labels?.severity || 'unknown',
            state: alert.state,
            summary: alert.annotations?.summary || rule.annotations?.summary || '',
            description: alert.annotations?.description || rule.annotations?.description || '',
            activeAt: alert.activeAt || '',
            value: alert.value || '',
          });
        }
      }
    }

    return NextResponse.json({
      alerts,
      summary: {
        total_rules: totalRules,
        firing: firingCount,
        pending: pendingCount,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error('Error fetching alerts:', error);
    return NextResponse.json({
      alerts: [],
      summary: { total_rules: 0, firing: 0, pending: 0 },
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
