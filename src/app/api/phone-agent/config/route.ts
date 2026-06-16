import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getCcwPhoneAgentPilotStatus } from '@/lib/phone-agent/ccw-phone-agent-status';
import {
  buildCcwPhoneAgentConfigResponse,
  normaliseCcwPhoneAgentConfigInput,
  type CcwPhoneAgentStoredConfig,
} from '@/lib/phone-agent/phone-agent-config';

const FEATURE_SLUG = 'ccw_ai_phone_agent';

function storedConfig(value: unknown): Partial<CcwPhoneAgentStoredConfig> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Partial<CcwPhoneAgentStoredConfig>)
    : null;
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const row = await prisma.ccwAddonFeatureConfig.findUnique({
      where: { ownerUserId_featureSlug: { ownerUserId: scope.userId, featureSlug: FEATURE_SLUG } },
    });

    return NextResponse.json(
      buildCcwPhoneAgentConfigResponse(row?.status ?? null, storedConfig(row?.config), getCcwPhoneAgentPilotStatus())
    );
  } catch (e) {
    return NextResponse.json({ detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const existing = await prisma.ccwAddonFeatureConfig.findUnique({
      where: { ownerUserId_featureSlug: { ownerUserId: scope.userId, featureSlug: FEATURE_SLUG } },
    });
    const pilotStatus = getCcwPhoneAgentPilotStatus();
    const defaults = buildCcwPhoneAgentConfigResponse(
      existing?.status ?? null,
      storedConfig(existing?.config),
      pilotStatus
    ).config;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const next = normaliseCcwPhoneAgentConfigInput(body, defaults);

    const row = await prisma.ccwAddonFeatureConfig.upsert({
      where: { ownerUserId_featureSlug: { ownerUserId: scope.userId, featureSlug: FEATURE_SLUG } },
      create: {
        ownerUserId: scope.userId,
        featureSlug: FEATURE_SLUG,
        status: next.status,
        config: next.config,
      },
      update: {
        status: next.status,
        config: next.config,
      },
    });

    return NextResponse.json(buildCcwPhoneAgentConfigResponse(row.status, storedConfig(row.config), pilotStatus));
  } catch (e) {
    return NextResponse.json({ detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
