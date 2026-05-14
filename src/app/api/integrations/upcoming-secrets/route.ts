import { NextRequest, NextResponse } from 'next/server';
import { readJsonBody } from '@/lib/auth/http';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceIdForUser } from '@/lib/auth/workspace-scope';
import { prisma } from '@/lib/db/prisma';

type Body = {
  google_ai_api_key?: string | null;
  anthropic_api_key?: string | null;
  heygen_api_key?: string | null;
  ap2_client_secret?: string | null;
};

function configured(v: string | null | undefined): boolean {
  return Boolean(v?.trim());
}

function toResponse(row: {
  googleAiApiKey: string | null;
  anthropicApiKey: string | null;
  heygenApiKey: string | null;
  ap2ClientSecret: string | null;
}) {
  return {
    google_ai: { configured: configured(row.googleAiApiKey) },
    anthropic: { configured: configured(row.anthropicApiKey) },
    heygen: { configured: configured(row.heygenApiKey) },
    ap2: { configured: configured(row.ap2ClientSecret) },
  };
}

export async function GET(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  const workspaceId = await getWorkspaceIdForUser(scope.userId);
  if (!workspaceId) return NextResponse.json({ detail: 'Workspace not found' }, { status: 404 });

  const row = await prisma.workspaceUpcomingIntegrationSecret.findUnique({
    where: { workspaceId },
  });
  if (!row) {
    return NextResponse.json({
      google_ai: { configured: false },
      anthropic: { configured: false },
      heygen: { configured: false },
      ap2: { configured: false },
    });
  }
  return NextResponse.json(toResponse(row));
}

export async function PUT(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  const workspaceId = await getWorkspaceIdForUser(scope.userId);
  if (!workspaceId) return NextResponse.json({ detail: 'Workspace not found' }, { status: 404 });

  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body as Body;

  const existing = await prisma.workspaceUpcomingIntegrationSecret.findUnique({
    where: { workspaceId },
  });

  const pick = (key: keyof Body, prev: string | null | undefined) => {
    if (!(key in body)) return prev ?? null;
    const v = body[key];
    if (v === null) return null;
    if (v === undefined) return prev ?? null;
    const t = String(v).trim();
    return t.length > 0 ? t : null;
  };

  const nextRow = {
    workspaceId,
    googleAiApiKey: pick('google_ai_api_key', existing?.googleAiApiKey),
    anthropicApiKey: pick('anthropic_api_key', existing?.anthropicApiKey),
    heygenApiKey: pick('heygen_api_key', existing?.heygenApiKey),
    ap2ClientSecret: pick('ap2_client_secret', existing?.ap2ClientSecret),
  };

  const saved = await prisma.workspaceUpcomingIntegrationSecret.upsert({
    where: { workspaceId },
    create: nextRow,
    update: {
      googleAiApiKey: nextRow.googleAiApiKey,
      anthropicApiKey: nextRow.anthropicApiKey,
      heygenApiKey: nextRow.heygenApiKey,
      ap2ClientSecret: nextRow.ap2ClientSecret,
    },
  });

  return NextResponse.json(toResponse(saved));
}
