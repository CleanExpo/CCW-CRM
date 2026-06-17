import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';

import {
  ccwWorkspaceRecordOwnerId,
  resolveCcwWorkspaceContext,
} from '@/lib/auth/ccw-workspace-context';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { prisma } from '@/lib/db/prisma';
import {
  CCW_ROADSHOW_CAMPAIGN_SLUG,
  CCW_ROADSHOW_FEATURE_SLUG,
  buildCcwRoadshowReadiness,
  ccwRoadshowEventSeeds,
  ccwRoadshowInternalDrafts,
  ccwRoadshowTrustedSources,
  normaliseCcwRoadshowComplianceState,
} from '@/lib/phone-agent/roadshow-campaign';

const EVENT_TYPE = 'carsi_ccw_roadshow';
const TRUST_LEVEL = 'approved_campaign_source';

function text(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function date(value: string) {
  return new Date(value);
}

async function campaignSnapshot(ownerUserIds: string[], flags: unknown = {}) {
  const complianceState = normaliseCcwRoadshowComplianceState(flags);
  const [events, sources, drafts] = await Promise.all([
    prisma.ccwIndustryEvent.findMany({
      where: { ownerUserId: { in: ownerUserIds }, eventType: EVENT_TYPE },
      orderBy: { startsAt: 'asc' },
    }),
    prisma.ccwAiKnowledgeSource.findMany({
      where: {
        ownerUserId: { in: ownerUserIds },
        trustLevel: TRUST_LEVEL,
        metadata: { path: ['campaign_slug'], equals: CCW_ROADSHOW_CAMPAIGN_SLUG },
      },
      orderBy: { label: 'asc' },
    }),
    prisma.ccwFollowUpAction.findMany({
      where: {
        ownerUserId: { in: ownerUserIds },
        payload: { path: ['campaign_slug'], equals: CCW_ROADSHOW_CAMPAIGN_SLUG },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    ...buildCcwRoadshowReadiness({
      saved_events: events.length,
      internal_test_drafts: drafts.length,
      trusted_sources: sources.length,
      ...complianceState,
    }),
    compliance_state: complianceState,
    saved_events: events.map((event) => ({
      id: event.id,
      name: event.name,
      status: event.status,
      starts_at: event.startsAt?.toISOString() ?? null,
      venue: event.venue,
    })),
    trusted_sources: sources.map((source) => ({
      id: source.id,
      label: source.label,
      url: source.url,
      status: source.status,
    })),
    internal_test_drafts: drafts.map((draft) => ({
      id: draft.id,
      recipient_ref: draft.recipientRef,
      subject: draft.subject,
      status: draft.status,
      created_at: draft.createdAt.toISOString(),
    })),
  };
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const ctx = await resolveCcwWorkspaceContext(scope.userId);
    if (!ctx) return NextResponse.json({ detail: 'No workspace found for this user' }, { status: 403 });

    const workspaceOwnerUserId = ccwWorkspaceRecordOwnerId(ctx);
    const ownerUserIds = [workspaceOwnerUserId, ...ctx.workspaceUserIds];
    const config = await prisma.ccwAddonFeatureConfig.findFirst({
      where: {
        featureSlug: CCW_ROADSHOW_FEATURE_SLUG,
        ownerUserId: { in: ownerUserIds },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json(await campaignSnapshot(ownerUserIds, config?.config));
  } catch (e) {
    return NextResponse.json({ detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const ctx = await resolveCcwWorkspaceContext(scope.userId);
    if (!ctx) return NextResponse.json({ detail: 'No workspace found for this user' }, { status: 403 });

    const workspaceOwnerUserId = ccwWorkspaceRecordOwnerId(ctx);
    const ownerUserIds = [workspaceOwnerUserId, ...ctx.workspaceUserIds];
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const seedEvents = body.seed_events !== false;
    const seedSources = body.seed_sources !== false;
    const seedInternalDrafts = body.seed_internal_drafts !== false;

    if (seedEvents) {
      for (const event of ccwRoadshowEventSeeds) {
        const existing = await prisma.ccwIndustryEvent.findFirst({
          where: { ownerUserId: { in: ownerUserIds }, eventType: EVENT_TYPE, name: event.name },
          select: { id: true },
        });

        const data = {
          status: 'draft_campaign',
          startsAt: date(event.starts_at),
          endsAt: date(event.ends_at),
          venue: event.venue,
          description: event.description,
          agenda: {
            campaign_slug: CCW_ROADSHOW_CAMPAIGN_SLUG,
            topics: ['carpet cleaning', 'rug cleaning', 'stain removal', 'tile cleaning', 'business growth'],
            course_material_includes: ['course outline', 'chemical decision details'],
          } satisfies Prisma.InputJsonValue,
          speakerPlan: {
            presenter: 'Phil McGurk',
            host: 'Carpet Cleaners Warehouse',
            needs_toby_approval: true,
          } satisfies Prisma.InputJsonValue,
          marketingPlan: {
            campaign_slug: CCW_ROADSHOW_CAMPAIGN_SLUG,
            channels: ['CCW client-list email', 'CARSI social', 'CCW social', 'Australian carpet cleaner groups'],
            send_requires_approval: true,
            paid_ads_require_separate_approval: true,
          } satisfies Prisma.InputJsonValue,
        };

        if (existing) {
          await prisma.ccwIndustryEvent.update({ where: { id: existing.id }, data });
        } else {
          await prisma.ccwIndustryEvent.create({
            data: {
              ownerUserId: workspaceOwnerUserId,
              eventType: EVENT_TYPE,
              name: event.name,
              ...data,
            },
          });
        }
      }
    }

    if (seedSources) {
      for (const source of ccwRoadshowTrustedSources) {
        const existing = await prisma.ccwAiKnowledgeSource.findFirst({
          where: { ownerUserId: { in: ownerUserIds }, label: source.label },
          select: { id: true },
        });
        const data = {
          sourceType: source.source_type,
          url: source.url,
          trustLevel: TRUST_LEVEL,
          refreshCadence: 'weekly_until_roadshow',
          status: 'active',
          metadata: {
            campaign_slug: CCW_ROADSHOW_CAMPAIGN_SLUG,
            approved_for_phone_answers: true,
            approved_for_follow_up_drafts: true,
            seeded_from: 'roadshow_campaign_api',
          } satisfies Prisma.InputJsonValue,
        };

        if (existing) {
          await prisma.ccwAiKnowledgeSource.update({ where: { id: existing.id }, data });
        } else {
          await prisma.ccwAiKnowledgeSource.create({
            data: {
              ownerUserId: workspaceOwnerUserId,
              label: source.label,
              ...data,
            },
          });
        }
      }
    }

    if (seedInternalDrafts) {
      for (const draft of ccwRoadshowInternalDrafts) {
        const existing = await prisma.ccwFollowUpAction.findFirst({
          where: {
            ownerUserId: { in: ownerUserIds },
            recipientRef: draft.recipient_ref,
            subject: draft.subject,
          },
          select: { id: true },
        });
        const data = {
          actionType: 'email',
          channel: 'email',
          status: 'draft',
          body: draft.body,
          payload: {
            campaign_slug: CCW_ROADSHOW_CAMPAIGN_SLUG,
            source: 'roadshow_campaign_api',
            internal_test_only: true,
            send_requires_approval: true,
            client_list_send_blocked_until_compliance_confirmed: true,
          } satisfies Prisma.InputJsonValue,
        };

        if (existing) {
          await prisma.ccwFollowUpAction.update({ where: { id: existing.id }, data });
        } else {
          await prisma.ccwFollowUpAction.create({
            data: {
              ownerUserId: workspaceOwnerUserId,
              recipientRef: draft.recipient_ref,
              subject: draft.subject,
              ...data,
            },
          });
        }
      }
    }

    const existingConfig = await prisma.ccwAddonFeatureConfig.findFirst({
      where: {
        featureSlug: CCW_ROADSHOW_FEATURE_SLUG,
        ownerUserId: { in: ownerUserIds },
      },
      orderBy: { updatedAt: 'desc' },
    });
    const nextComplianceState = normaliseCcwRoadshowComplianceState(
      {
        ...normaliseCcwRoadshowComplianceState(existingConfig?.config),
        ...body,
        updated_by: scope.userId,
        updated_at: new Date().toISOString(),
      },
      normaliseCcwRoadshowComplianceState(existingConfig?.config)
    );

    await prisma.ccwAddonFeatureConfig.upsert({
      where: {
        ownerUserId_featureSlug: {
          ownerUserId: workspaceOwnerUserId,
          featureSlug: CCW_ROADSHOW_FEATURE_SLUG,
        },
      },
      create: {
        ownerUserId: workspaceOwnerUserId,
        featureSlug: CCW_ROADSHOW_FEATURE_SLUG,
        status: nextComplianceState.final_approval_confirmed ? 'approval_recorded' : 'draft',
        config: nextComplianceState,
      },
      update: {
        status: nextComplianceState.final_approval_confirmed ? 'approval_recorded' : 'draft',
        config: nextComplianceState,
      },
    });

    return NextResponse.json(
      await campaignSnapshot(ownerUserIds, nextComplianceState),
      { status: 201 }
    );
  } catch (e) {
    return NextResponse.json({ detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
