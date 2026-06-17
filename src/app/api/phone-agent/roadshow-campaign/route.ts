import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';

import {
  ccwWorkspaceRecordOwnerId,
  resolveCcwWorkspaceContext,
} from '@/lib/auth/ccw-workspace-context';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { prisma } from '@/lib/db/prisma';
import {
  getSendGridSendReadiness,
  resolveSendGridFromEmail,
  sendMailViaSendGrid,
} from '@/lib/integrations/sendgrid-mail';
import {
  createOutboundEmailDraft,
  finalizeOutboundEmail,
  markOutboundEmailFailed,
} from '@/lib/integrations/sendgrid-persistence';
import {
  CCW_ROADSHOW_CAMPAIGN_SLUG,
  CCW_ROADSHOW_CURRENCY,
  CCW_ROADSHOW_FIVE_PACK_PRICE,
  CCW_ROADSHOW_FIVE_PACK_QUANTITY,
  CCW_ROADSHOW_FEATURE_SLUG,
  CCW_ROADSHOW_SINGLE_TICKET_PRICE,
  buildCcwRoadshowInternalTestEmail,
  buildCcwRoadshowReadiness,
  ccwRoadshowEventSeeds,
  ccwRoadshowInternalDrafts,
  ccwRoadshowTrustedSources,
  isCcwRoadshowInternalRecipient,
  normaliseCcwRoadshowComplianceState,
} from '@/lib/phone-agent/roadshow-campaign';

const EVENT_TYPE = 'carsi_ccw_roadshow';
const TRUST_LEVEL = 'approved_campaign_source';

function text(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function date(value: string) {
  return new Date(value);
}

function findInternalDraft(recipientRef: string, subject: string | null, body: string | null) {
  const seed = ccwRoadshowInternalDrafts.find((draft) => draft.recipient_ref === recipientRef);
  return {
    recipient_ref: recipientRef,
    subject: subject || seed?.subject || 'CARSI x CCW Roadshow internal test',
    body: body || seed?.body || 'Please review the CARSI x CCW Roadshow campaign proof.',
  };
}

async function sendInternalTests(input: {
  request: NextRequest;
  actingUserId: string;
  workspaceOwnerUserId: string;
  ownerUserIds: string[];
}) {
  const readiness = await getSendGridSendReadiness(input.request, input.actingUserId);
  if (!readiness.ok) {
    return {
      status: readiness.status,
      payload: {
        internal_test_send: {
          status: 'blocked',
          detail: readiness.detail,
          sendgrid: readiness.payload,
        },
      },
    };
  }

  const apiKey = readiness.creds.apiKey;
  if (!apiKey) {
    return {
      status: 503,
      payload: {
        internal_test_send: {
          status: 'blocked',
          detail: 'SendGrid API key is missing.',
          sendgrid: readiness.payload,
        },
      },
    };
  }

  const fromEmail = resolveSendGridFromEmail(input.request, readiness.creds);
  if (!fromEmail) {
    return {
      status: 503,
      payload: {
        internal_test_send: {
          status: 'blocked',
          detail: 'SendGrid from email is missing.',
          sendgrid: readiness.payload,
        },
      },
    };
  }

  const drafts = await prisma.ccwFollowUpAction.findMany({
    where: {
      ownerUserId: { in: input.ownerUserIds },
      payload: { path: ['campaign_slug'], equals: CCW_ROADSHOW_CAMPAIGN_SLUG },
      recipientRef: {
        in: ccwRoadshowInternalDrafts.map((draft) => draft.recipient_ref),
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  if (drafts.length === 0) {
    return {
      status: 409,
      payload: {
        internal_test_send: {
          status: 'blocked',
          detail: 'Seed Toby and Anne internal drafts before sending tests.',
        },
      },
    };
  }

  const sentAt = new Date();
  const results = [];
  for (const draft of drafts) {
    const payload = asRecord(draft.payload);
    const recipientRef = text(draft.recipientRef);
    const isInternalOnly = payload.internal_test_only === true;
    if (!isInternalOnly || !isCcwRoadshowInternalRecipient(recipientRef)) {
      results.push({
        action_id: draft.id,
        recipient_ref: recipientRef || null,
        status: 'blocked',
        detail: 'Skipped because this action is not an approved internal roadshow test recipient.',
      });
      continue;
    }

    const email = findInternalDraft(recipientRef, draft.subject, draft.body);
    const bodyText = buildCcwRoadshowInternalTestEmail(email);
    const outbound = await createOutboundEmailDraft({
      ownerUserId: input.workspaceOwnerUserId,
      workspaceUserIds: input.ownerUserIds,
      toEmail: recipientRef,
      fromEmail,
      subject: email.subject,
      bodyText,
      wasAiGenerated: false,
    });
    const result = await sendMailViaSendGrid(apiKey, fromEmail, readiness.creds.fromName, {
      to_email: recipientRef,
      subject: email.subject,
      body_text: bodyText,
      template_id: readiness.creds.templateIdGeneral ?? undefined,
      custom_args: {
        campaign_slug: CCW_ROADSHOW_CAMPAIGN_SLUG,
        follow_up_action_id: draft.id,
        email_message_id: outbound.messageId,
      },
    });

    if (!result.ok) {
      await markOutboundEmailFailed(outbound.messageId, result.detail);
      await prisma.ccwFollowUpAction.update({
        where: { id: draft.id },
        data: {
          status: 'internal_test_failed',
          payload: {
            ...payload,
            internal_test_failed_at: sentAt.toISOString(),
            internal_test_error: result.detail,
            email_thread_id: outbound.threadId,
            email_message_id: outbound.messageId,
          },
        },
      });
      results.push({
        action_id: draft.id,
        recipient_ref: recipientRef,
        status: 'failed',
        detail: result.detail,
      });
      continue;
    }

    await finalizeOutboundEmail(outbound.messageId, result.message_id || null);
    await prisma.ccwFollowUpAction.update({
      where: { id: draft.id },
      data: {
        status: 'sent_internal_test',
        sentAt,
        payload: {
          ...payload,
          internal_test_sent_at: sentAt.toISOString(),
          internal_test_sent_by: input.actingUserId,
          email_thread_id: outbound.threadId,
          email_message_id: outbound.messageId,
          sendgrid_message_id: result.message_id,
          sendgrid_mode: result.mode,
          client_list_send_still_blocked: true,
        },
      },
    });
    results.push({
      action_id: draft.id,
      recipient_ref: recipientRef,
      status: 'sent',
      mode: result.mode,
      message_id: result.message_id,
    });
  }

  const failed = results.filter((result) => result.status === 'failed' || result.status === 'blocked');
  return {
    status: failed.length ? 502 : 200,
    payload: {
      internal_test_send: {
        status: failed.length ? 'partial_or_failed' : 'sent',
        results,
        sendgrid: readiness.payload,
      },
    },
  };
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
      sent_at: draft.sentAt?.toISOString() ?? null,
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
    const shouldSendInternalTests = body.send_internal_tests === true;

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
            pricing: {
              currency: CCW_ROADSHOW_CURRENCY,
              single_ticket_price: CCW_ROADSHOW_SINGLE_TICKET_PRICE,
              five_pack_price: CCW_ROADSHOW_FIVE_PACK_PRICE,
              five_pack_quantity: CCW_ROADSHOW_FIVE_PACK_QUANTITY,
            },
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
            payment_link_required_before_publish: true,
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

    let internalTestSend: Record<string, unknown> = {};
    if (shouldSendInternalTests) {
      const sendResult = await sendInternalTests({
        request,
        actingUserId: scope.userId,
        workspaceOwnerUserId,
        ownerUserIds,
      });
      internalTestSend = sendResult.payload;
      if (sendResult.status >= 400) {
        return NextResponse.json(
          {
            ...(await campaignSnapshot(ownerUserIds, nextComplianceState)),
            ...internalTestSend,
          },
          { status: sendResult.status }
        );
      }
    }

    return NextResponse.json(
      {
        ...(await campaignSnapshot(ownerUserIds, nextComplianceState)),
        ...internalTestSend,
      },
      { status: 201 }
    );
  } catch (e) {
    return NextResponse.json({ detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
