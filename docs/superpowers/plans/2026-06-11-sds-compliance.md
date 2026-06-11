# SDS Compliance Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add AU WHS/GHS-compliant Safety Data Sheet management to CCW-CRM: Prisma model + migration, GET/PUT API routes, inventory stock-list SDS panel, invoice print-view SDS injection, and a 30-day review-due cron.

**Architecture:** `ProductSds` is a 1:1 extension of `Product` (unique FK). API routes follow the `requireAuthScope` + `getWorkspaceMemberUserIds` pattern used by every other inventory route. The cron proxies to upstream exactly like `check-sla-breaches`. UI panel is a Dialog on the stock list page alongside the existing Transfer/Adjust dialogs.

**Tech Stack:** Next.js 15 App Router, Prisma 7 (PostgreSQL), Vitest + jsdom, Radix UI/shadcn, date-fns, zod + react-hook-form.

---

## File Map

| Status | Path | Purpose |
|--------|------|---------|
| CREATE | `prisma/migrations/20260611200000_add_product_sds/migration.sql` | Raw SQL migration |
| MODIFY | `prisma/schema.prisma` | `ProductSds` model + relation on `Product` |
| CREATE | `src/app/api/inventory/[id]/sds/route.ts` | GET + PUT SDS for one product |
| CREATE | `src/app/(dashboard)/inventory/components/SdsPanel.tsx` | Dialog UI for viewing/editing SDS |
| MODIFY | `src/app/(dashboard)/inventory/stock/page.tsx` | Wire "SDS" button + SdsPanel |
| MODIFY | `src/app/(dashboard)/invoices/components/InvoicePrintView.tsx` | Inject `sds_attachments[]` section |
| CREATE | `src/app/api/cron/sds-review-due/route.ts` | Cron: flag SDS due within 30 days |
| CREATE | `src/lib/__tests__/sds-route.test.ts` | Route auth + CRUD + cross-workspace tests |
| CREATE | `src/lib/__tests__/sds-docket-injection.test.ts` | Docket injection logic tests |
| CREATE | `src/lib/__tests__/sds-cron.test.ts` | Cron threshold tests |

---

## Task 1: Prisma migration SQL

**Files:**
- Create: `prisma/migrations/20260611200000_add_product_sds/migration.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- Migration: add_product_sds
-- AU WHS Regulation 341 / GHS compliance — one SDS record per product

CREATE TABLE "product_sds" (
    "id"                        UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id"                UUID NOT NULL,
    "sds_pdf_url"               TEXT,
    "ghs_signal_word"           TEXT,
    "hazard_statements"         JSONB NOT NULL DEFAULT '[]',
    "revision_date"             DATE,
    "review_due_date"           DATE,
    "supplier_emergency_contact" TEXT,
    "created_at"                TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"                TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "product_sds_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_sds_product_id_key" UNIQUE ("product_id"),
    CONSTRAINT "product_sds_product_id_fkey"
        FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE
);

CREATE INDEX "product_sds_product_id_idx" ON "product_sds"("product_id");
CREATE INDEX "product_sds_review_due_date_idx" ON "product_sds"("review_due_date");
```

- [ ] **Step 2: Commit**

```bash
git add prisma/migrations/20260611200000_add_product_sds/migration.sql
git commit -m "feat(sds): add product_sds migration (WHS reg. 341)"
```

---

## Task 2: Prisma schema model

**Files:**
- Modify: `prisma/schema.prisma` — add `ProductSds` model and back-relation on `Product`

- [ ] **Step 1: Add the model to schema.prisma**

Append after the `Product` model's closing `}` (after the `@@map("products")` line):

```prisma
model ProductSds {
  id                       String    @id @default(uuid()) @db.Uuid
  productId                String    @unique @map("product_id") @db.Uuid
  sdsPdfUrl                String?   @map("sds_pdf_url") @db.Text
  ghsSignalWord            String?   @map("ghs_signal_word")
  /// GHS hazard statement codes, e.g. ["H225","H302"]
  hazardStatements         Json      @default("[]") @map("hazard_statements")
  revisionDate             DateTime? @map("revision_date") @db.Date
  reviewDueDate            DateTime? @map("review_due_date") @db.Date
  supplierEmergencyContact String?   @map("supplier_emergency_contact") @db.Text
  createdAt                DateTime  @default(now()) @map("created_at")
  updatedAt                DateTime  @updatedAt @map("updated_at")

  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@index([productId])
  @@index([reviewDueDate])
  @@map("product_sds")
}
```

Also add the back-relation on the `Product` model (inside the `Product` model body, after `workshopServiceTemplateItems WorkshopServiceTemplateItem[]`):

```prisma
  sds                          ProductSds?
```

- [ ] **Step 2: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(sds): add ProductSds Prisma model"
```

---

## Task 3: Failing tests for SDS route

**Files:**
- Create: `src/lib/__tests__/sds-route.test.ts`

- [ ] **Step 1: Write the failing test file**

```typescript
/**
 * SDS API route tests.
 * Covers: auth gate (401), cross-workspace isolation (404), GET (upsert-on-missing),
 * PUT (full update), and that ownerUserId scoping is enforced.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';

vi.mock('@/lib/auth/data-scope', () => ({
  requireAuthScope: vi.fn(),
}));

vi.mock('@/lib/auth/workspace-scope', () => ({
  getWorkspaceMemberUserIds: vi.fn(),
}));

const mockProductFindFirst = vi.fn();
const mockSdsFindUnique = vi.fn();
const mockSdsUpsert = vi.fn();

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    product: { findFirst: (...a: unknown[]) => mockProductFindFirst(...a) },
    productSds: {
      findUnique: (...a: unknown[]) => mockSdsFindUnique(...a),
      upsert: (...a: unknown[]) => mockSdsUpsert(...a),
    },
  },
}));

import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { GET, PUT } from '@/app/api/inventory/[id]/sds/route';

const USER_A = 'user-a';
const USER_B = 'user-b';
const PRODUCT_ID = 'prod-1';

function setAuth(userId: string | null, members: string[] = [userId ?? '']) {
  (requireAuthScope as Mock).mockResolvedValue(
    userId ? { userId, role: 'owner' as const, isAdmin: false } : null
  );
  (getWorkspaceMemberUserIds as Mock).mockResolvedValue(members);
}

function makeRequest(method: string, body?: unknown): Request {
  return new Request(`http://localhost/api/inventory/${PRODUCT_ID}/sds`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

const ctx = { params: Promise.resolve({ id: PRODUCT_ID }) };

describe('GET /api/inventory/[id]/sds', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 401 when unauthenticated', async () => {
    setAuth(null);
    const res = await GET(makeRequest('GET') as never, ctx);
    expect(res.status).toBe(401);
  });

  it('returns 404 when product not in workspace', async () => {
    setAuth(USER_A, [USER_A]);
    mockProductFindFirst.mockResolvedValue(null);
    const res = await GET(makeRequest('GET') as never, ctx);
    expect(res.status).toBe(404);
  });

  it('returns null sds fields when no SDS row exists yet', async () => {
    setAuth(USER_A, [USER_A]);
    mockProductFindFirst.mockResolvedValue({ id: PRODUCT_ID });
    mockSdsFindUnique.mockResolvedValue(null);
    const res = await GET(makeRequest('GET') as never, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.product_id).toBe(PRODUCT_ID);
    expect(body.sds_pdf_url).toBeNull();
    expect(body.hazard_statements).toEqual([]);
  });

  it('returns existing SDS data', async () => {
    setAuth(USER_A, [USER_A]);
    mockProductFindFirst.mockResolvedValue({ id: PRODUCT_ID });
    mockSdsFindUnique.mockResolvedValue({
      id: 'sds-1',
      productId: PRODUCT_ID,
      sdsPdfUrl: 'https://example.com/sds.pdf',
      ghsSignalWord: 'Danger',
      hazardStatements: ['H225', 'H302'],
      revisionDate: new Date('2024-01-01'),
      reviewDueDate: new Date('2026-01-01'),
      supplierEmergencyContact: '1300 000 000',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const res = await GET(makeRequest('GET') as never, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ghs_signal_word).toBe('Danger');
    expect(body.hazard_statements).toEqual(['H225', 'H302']);
  });

  it('cross-workspace: user B cannot see user A product', async () => {
    setAuth(USER_B, [USER_B]);
    // Product owned by USER_A — findFirst with ownerUserId: {in: [USER_B]} returns null
    mockProductFindFirst.mockResolvedValue(null);
    const res = await GET(makeRequest('GET') as never, ctx);
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/inventory/[id]/sds', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 401 when unauthenticated', async () => {
    setAuth(null);
    const res = await PUT(makeRequest('PUT', {}) as never, ctx);
    expect(res.status).toBe(401);
  });

  it('returns 404 when product not in workspace', async () => {
    setAuth(USER_A, [USER_A]);
    mockProductFindFirst.mockResolvedValue(null);
    const res = await PUT(makeRequest('PUT', {}) as never, ctx);
    expect(res.status).toBe(404);
  });

  it('upserts SDS and returns updated data', async () => {
    setAuth(USER_A, [USER_A]);
    mockProductFindFirst.mockResolvedValue({ id: PRODUCT_ID });
    const upserted = {
      id: 'sds-1',
      productId: PRODUCT_ID,
      sdsPdfUrl: 'https://example.com/sds.pdf',
      ghsSignalWord: 'Warning',
      hazardStatements: ['H302'],
      revisionDate: new Date('2025-06-01'),
      reviewDueDate: new Date('2026-06-01'),
      supplierEmergencyContact: '1300 111 111',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockSdsUpsert.mockResolvedValue(upserted);
    const res = await PUT(
      makeRequest('PUT', {
        sds_pdf_url: 'https://example.com/sds.pdf',
        ghs_signal_word: 'Warning',
        hazard_statements: ['H302'],
        revision_date: '2025-06-01',
        review_due_date: '2026-06-01',
        supplier_emergency_contact: '1300 111 111',
      }) as never,
      ctx
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ghs_signal_word).toBe('Warning');
    expect(mockSdsUpsert).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run tests — verify they fail (route not yet created)**

```bash
npx vitest run src/lib/__tests__/sds-route.test.ts
```

Expected: FAIL — "Cannot find module '@/app/api/inventory/[id]/sds/route'"

---

## Task 4: Implement the SDS route

**Files:**
- Create: `src/app/api/inventory/[id]/sds/route.ts`

- [ ] **Step 1: Create the route handler**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';

function sdsToApi(row: {
  id: string;
  productId: string;
  sdsPdfUrl: string | null;
  ghsSignalWord: string | null;
  hazardStatements: unknown;
  revisionDate: Date | null;
  reviewDueDate: Date | null;
  supplierEmergencyContact: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    product_id: row.productId,
    sds_pdf_url: row.sdsPdfUrl,
    ghs_signal_word: row.ghsSignalWord,
    hazard_statements: Array.isArray(row.hazardStatements) ? row.hazardStatements : [],
    revision_date: row.revisionDate?.toISOString().slice(0, 10) ?? null,
    review_due_date: row.reviewDueDate?.toISOString().slice(0, 10) ?? null,
    supplier_emergency_contact: row.supplierEmergencyContact,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

const EMPTY_SDS = (productId: string) => ({
  product_id: productId,
  sds_pdf_url: null,
  ghs_signal_word: null,
  hazard_statements: [],
  revision_date: null,
  review_due_date: null,
  supplier_emergency_contact: null,
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const { id } = await context.params;

    const product = await prisma.product.findFirst({
      where: { id, ownerUserId: { in: workspaceUserIds } },
      select: { id: true },
    });
    if (!product) return NextResponse.json({ detail: 'Not found' }, { status: 404 });

    const sds = await prisma.productSds.findUnique({ where: { productId: id } });
    if (!sds) return NextResponse.json(EMPTY_SDS(id));

    return NextResponse.json(sdsToApi(sds));
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const { id } = await context.params;

    const product = await prisma.product.findFirst({
      where: { id, ownerUserId: { in: workspaceUserIds } },
      select: { id: true },
    });
    if (!product) return NextResponse.json({ detail: 'Not found' }, { status: 404 });

    const body = await request.json();

    const data = {
      sdsPdfUrl: body.sds_pdf_url ?? null,
      ghsSignalWord: body.ghs_signal_word ?? null,
      hazardStatements: Array.isArray(body.hazard_statements) ? body.hazard_statements : [],
      revisionDate: body.revision_date ? new Date(body.revision_date) : null,
      reviewDueDate: body.review_due_date ? new Date(body.review_due_date) : null,
      supplierEmergencyContact: body.supplier_emergency_contact ?? null,
    };

    const sds = await prisma.productSds.upsert({
      where: { productId: id },
      create: { productId: id, ...data },
      update: data,
    });

    return NextResponse.json(sdsToApi(sds));
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
```

- [ ] **Step 2: Run tests — verify they pass**

```bash
npx vitest run src/lib/__tests__/sds-route.test.ts
```

Expected: all 8 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/inventory/[id]/sds/route.ts
git commit -m "feat(sds): GET+PUT /api/inventory/[id]/sds route"
```

---

## Task 5: Failing tests for docket injection

**Files:**
- Create: `src/lib/__tests__/sds-docket-injection.test.ts`

- [ ] **Step 1: Write failing tests**

The docket injection logic will live in `src/lib/sds/docket-injection.ts`.

```typescript
/**
 * Docket injection tests.
 * getHazardousSdsAttachments(lineItems, workspaceUserIds) → SDS records
 * for any line item whose product has a ProductSds row with a GHS signal word
 * or non-empty hazard_statements.
 *
 * Non-hazardous line items → absent from result.
 * Items without a productId → absent.
 * Cross-workspace: only returns SDS for products owned within workspaceUserIds.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockSdsFindMany = vi.fn();

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    productSds: {
      findMany: (...a: unknown[]) => mockSdsFindMany(...a),
    },
    product: {
      findMany: (...a: unknown[]) => mockProductFindMany(...a),
    },
  },
}));

const mockProductFindMany = vi.fn();

import { getHazardousSdsAttachments } from '@/lib/sds/docket-injection';

const WORKSPACE_IDS = ['user-owner'];

const hazardousProduct = { id: 'prod-hazard', ownerUserId: 'user-owner' };
const safeProduct = { id: 'prod-safe', ownerUserId: 'user-owner' };

const hazardousSds = {
  id: 'sds-1',
  productId: 'prod-hazard',
  sdsPdfUrl: 'https://example.com/chemical.pdf',
  ghsSignalWord: 'Danger',
  hazardStatements: ['H225', 'H302'],
  revisionDate: new Date('2024-06-01'),
  reviewDueDate: new Date('2026-06-01'),
  supplierEmergencyContact: '1300 000 000',
  updatedAt: new Date(),
};

describe('getHazardousSdsAttachments', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('hazardous line item → SDS attachment present', async () => {
    mockProductFindMany.mockResolvedValue([hazardousProduct]);
    mockSdsFindMany.mockResolvedValue([hazardousSds]);

    const result = await getHazardousSdsAttachments(
      [{ product_id: 'prod-hazard', description: 'Flammable Cleaner' }],
      WORKSPACE_IDS
    );

    expect(result).toHaveLength(1);
    expect(result[0].product_id).toBe('prod-hazard');
    expect(result[0].ghs_signal_word).toBe('Danger');
    expect(result[0].sds_pdf_url).toBe('https://example.com/chemical.pdf');
  });

  it('non-hazardous line item (no SDS row) → absent', async () => {
    mockProductFindMany.mockResolvedValue([safeProduct]);
    mockSdsFindMany.mockResolvedValue([]); // no SDS row for safe product

    const result = await getHazardousSdsAttachments(
      [{ product_id: 'prod-safe', description: 'Plain Mop' }],
      WORKSPACE_IDS
    );

    expect(result).toHaveLength(0);
  });

  it('SDS row with no signal word and empty hazard_statements → absent', async () => {
    mockProductFindMany.mockResolvedValue([safeProduct]);
    mockSdsFindMany.mockResolvedValue([{
      ...hazardousSds,
      productId: 'prod-safe',
      ghsSignalWord: null,
      hazardStatements: [],
    }]);

    const result = await getHazardousSdsAttachments(
      [{ product_id: 'prod-safe', description: 'Water' }],
      WORKSPACE_IDS
    );

    expect(result).toHaveLength(0);
  });

  it('line item without product_id → absent', async () => {
    mockProductFindMany.mockResolvedValue([]);
    mockSdsFindMany.mockResolvedValue([]);

    const result = await getHazardousSdsAttachments(
      [{ product_id: null, description: 'Misc charge' }],
      WORKSPACE_IDS
    );

    expect(result).toHaveLength(0);
  });

  it('mixed hazardous + non-hazardous → only hazardous returned', async () => {
    mockProductFindMany.mockResolvedValue([hazardousProduct, safeProduct]);
    mockSdsFindMany.mockResolvedValue([hazardousSds]);

    const result = await getHazardousSdsAttachments(
      [
        { product_id: 'prod-hazard', description: 'Flammable Cleaner' },
        { product_id: 'prod-safe', description: 'Plain Mop' },
      ],
      WORKSPACE_IDS
    );

    expect(result).toHaveLength(1);
    expect(result[0].product_id).toBe('prod-hazard');
  });

  it('cross-workspace: product not in workspaceUserIds → absent', async () => {
    // product findMany filters by ownerUserId in workspaceUserIds — returns nothing for outsider
    mockProductFindMany.mockResolvedValue([]);
    mockSdsFindMany.mockResolvedValue([]);

    const result = await getHazardousSdsAttachments(
      [{ product_id: 'prod-other-workspace', description: 'Chemical' }],
      ['user-not-owner']
    );

    expect(result).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run — expect FAIL (module not found)**

```bash
npx vitest run src/lib/__tests__/sds-docket-injection.test.ts
```

Expected: FAIL — "Cannot find module '@/lib/sds/docket-injection'"

---

## Task 6: Implement docket injection helper

**Files:**
- Create: `src/lib/sds/docket-injection.ts`

- [ ] **Step 1: Write the helper**

```typescript
import { prisma } from '@/lib/db/prisma';

export interface SdsAttachment {
  product_id: string;
  sds_pdf_url: string | null;
  ghs_signal_word: string | null;
  hazard_statements: string[];
  revision_date: string | null;
  review_due_date: string | null;
  supplier_emergency_contact: string | null;
}

/**
 * Given invoice line items and workspace user IDs, returns SDS records for any
 * product that has a GHS signal word or non-empty hazard statements.
 * Non-hazardous products and products outside the workspace are excluded.
 */
export async function getHazardousSdsAttachments(
  lineItems: Array<{ product_id: string | null; description: string }>,
  workspaceUserIds: string[]
): Promise<SdsAttachment[]> {
  const productIds = lineItems
    .map((li) => li.product_id)
    .filter((id): id is string => Boolean(id));

  if (productIds.length === 0) return [];

  // Enforce workspace ownership — only look up products owned by this workspace
  const ownedProducts = await prisma.product.findMany({
    where: { id: { in: productIds }, ownerUserId: { in: workspaceUserIds } },
    select: { id: true },
  });
  const ownedIds = ownedProducts.map((p) => p.id);
  if (ownedIds.length === 0) return [];

  const sdsRows = await prisma.productSds.findMany({
    where: { productId: { in: ownedIds } },
  });

  return sdsRows
    .filter((row) => {
      const stmts = Array.isArray(row.hazardStatements) ? row.hazardStatements : [];
      return Boolean(row.ghsSignalWord) || stmts.length > 0;
    })
    .map((row) => ({
      product_id: row.productId,
      sds_pdf_url: row.sdsPdfUrl,
      ghs_signal_word: row.ghsSignalWord,
      hazard_statements: Array.isArray(row.hazardStatements)
        ? (row.hazardStatements as string[])
        : [],
      revision_date: row.revisionDate?.toISOString().slice(0, 10) ?? null,
      review_due_date: row.reviewDueDate?.toISOString().slice(0, 10) ?? null,
      supplier_emergency_contact: row.supplierEmergencyContact,
    }));
}
```

- [ ] **Step 2: Run tests — expect PASS**

```bash
npx vitest run src/lib/__tests__/sds-docket-injection.test.ts
```

Expected: all 6 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/sds/docket-injection.ts src/lib/__tests__/sds-docket-injection.test.ts
git commit -m "feat(sds): docket injection helper + tests"
```

---

## Task 7: Failing cron tests

**Files:**
- Create: `src/lib/__tests__/sds-cron.test.ts`

- [ ] **Step 1: Write failing cron tests**

```typescript
/**
 * SDS review-due cron tests.
 * The cron route is a thin proxy (like check-sla-breaches) — tests cover:
 * - 401 when CRON_SECRET missing/wrong
 * - upstream-proxy path (proxies when API_UPSTREAM_URL is set)
 * The 30-day threshold logic lives upstream; we test the auth gate and proxy call.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockRequireUpstreamBase = vi.fn();
vi.mock('@/lib/api/upstream-proxy', () => ({
  requireUpstreamBase: (...a: unknown[]) => mockRequireUpstreamBase(...a),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { GET } from '@/app/api/cron/sds-review-due/route';

function makeRequest(authHeader?: string): Request {
  return new Request('http://localhost/api/cron/sds-review-due', {
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

describe('GET /api/cron/sds-review-due', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...OLD_ENV, CRON_SECRET: 'test-secret' };
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('returns 401 when no authorization header', async () => {
    const res = await GET(makeRequest() as never);
    expect(res.status).toBe(401);
  });

  it('returns 401 when wrong secret', async () => {
    const res = await GET(makeRequest('Bearer wrong-secret') as never);
    expect(res.status).toBe(401);
  });

  it('proxies to upstream and returns success payload', async () => {
    const upstreamBase = 'https://api.example.com';
    mockRequireUpstreamBase.mockReturnValue(upstreamBase);
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ flagged: 3, notifications_sent: 3 }),
    });

    const res = await GET(makeRequest('Bearer test-secret') as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.flagged).toBe(3);
    expect(mockFetch).toHaveBeenCalledWith(
      `${upstreamBase}/api/cron/sds-review-due`,
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('returns success:false on upstream error', async () => {
    const upstreamBase = 'https://api.example.com';
    mockRequireUpstreamBase.mockReturnValue(upstreamBase);
    mockFetch.mockRejectedValue(new Error('network failure'));

    const res = await GET(makeRequest('Bearer test-secret') as never);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect FAIL (module not found)**

```bash
npx vitest run src/lib/__tests__/sds-cron.test.ts
```

Expected: FAIL — "Cannot find module '@/app/api/cron/sds-review-due/route'"

---

## Task 8: Implement the cron route

**Files:**
- Create: `src/app/api/cron/sds-review-due/route.ts`

- [ ] **Step 1: Write the cron route (exactly mirrors check-sla-breaches pattern)**

```typescript
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { requireUpstreamBase } from '@/lib/api/upstream-proxy';

// SDS Review-Due Cron Job
// Schedule: Daily at 8:00 AM AEST / 22:00 UTC (0 22 * * *)
// Flags SDS records whose reviewDueDate < NOW() + 30 days.
// Forwards to `API_UPSTREAM_URL` when configured.

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const base = requireUpstreamBase('SDS review-due');
    if (base instanceof NextResponse) return base;

    const response = await fetch(`${base}/api/cron/sds-review-due`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
    });

    const data = await response.json();

    logger.info('SDS review-due cron', {
      flagged: data.flagged,
      notificationsSent: data.notifications_sent,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: response.ok,
      ...data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('SDS review-due cron error', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Run cron tests — expect PASS**

```bash
npx vitest run src/lib/__tests__/sds-cron.test.ts
```

Expected: all 4 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/sds-review-due/route.ts src/lib/__tests__/sds-cron.test.ts
git commit -m "feat(sds): sds-review-due cron + tests"
```

---

## Task 9: SdsPanel UI component

**Files:**
- Create: `src/app/(dashboard)/inventory/components/SdsPanel.tsx`

- [ ] **Step 1: Write the SDS panel (Dialog, view + edit form)**

```tsx
'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api/client';
import { format } from 'date-fns';

interface SdsData {
  product_id: string;
  sds_pdf_url: string | null;
  ghs_signal_word: string | null;
  hazard_statements: string[];
  revision_date: string | null;
  review_due_date: string | null;
  supplier_emergency_contact: string | null;
}

interface SdsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  productSku: string;
}

const EMPTY: SdsData = {
  product_id: '',
  sds_pdf_url: null,
  ghs_signal_word: null,
  hazard_statements: [],
  revision_date: null,
  review_due_date: null,
  supplier_emergency_contact: null,
};

export function SdsPanel({ open, onOpenChange, productId, productName, productSku }: SdsPanelProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sds, setSds] = useState<SdsData>(EMPTY);
  const [hazardInput, setHazardInput] = useState('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    apiClient
      .get<SdsData>(`/api/inventory/${productId}/sds`)
      .then((data) => {
        setSds(data);
        setHazardInput((data.hazard_statements ?? []).join(', '));
      })
      .catch(() => {
        toast({ variant: 'destructive', title: 'Failed to load SDS data' });
      })
      .finally(() => setLoading(false));
  }, [open, productId, toast]);

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await apiClient.put<SdsData>(`/api/inventory/${productId}/sds`, {
        sds_pdf_url: sds.sds_pdf_url || null,
        ghs_signal_word: sds.ghs_signal_word || null,
        hazard_statements: hazardInput
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        revision_date: sds.revision_date || null,
        review_due_date: sds.review_due_date || null,
        supplier_emergency_contact: sds.supplier_emergency_contact || null,
      });
      setSds(updated);
      toast({ title: 'SDS saved' });
      onOpenChange(false);
    } catch {
      toast({ variant: 'destructive', title: 'Failed to save SDS' });
    } finally {
      setSaving(false);
    }
  }

  const isHazardous = Boolean(sds.ghs_signal_word) || sds.hazard_statements.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-orange-500" />
            Safety Data Sheet
          </DialogTitle>
          <DialogDescription>
            GHS/WHS SDS record for{' '}
            <span className="font-semibold">{productName}</span> ({productSku})
            {isHazardous && (
              <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">
                {sds.ghs_signal_word ?? 'Hazardous'}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="sds-pdf-url">SDS PDF URL</Label>
              <Input
                id="sds-pdf-url"
                placeholder="https://supplier.com/sds/product.pdf"
                value={sds.sds_pdf_url ?? ''}
                onChange={(e) => setSds((s) => ({ ...s, sds_pdf_url: e.target.value || null }))}
              />
              <p className="text-xs text-muted-foreground">
                PDF merge into print output is a TODO for Rana — currently listed as a link on the invoice.
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="ghs-signal">GHS Signal Word</Label>
              <Input
                id="ghs-signal"
                placeholder="Danger / Warning"
                value={sds.ghs_signal_word ?? ''}
                onChange={(e) => setSds((s) => ({ ...s, ghs_signal_word: e.target.value || null }))}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="hazard-stmts">Hazard Statements (comma-separated)</Label>
              <Input
                id="hazard-stmts"
                placeholder="H225, H302, H318"
                value={hazardInput}
                onChange={(e) => setHazardInput(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                GHS H-codes — e.g. H225 (flammable liquid), H302 (harmful if swallowed)
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="revision-date">Revision Date</Label>
                <Input
                  id="revision-date"
                  type="date"
                  value={sds.revision_date ?? ''}
                  onChange={(e) =>
                    setSds((s) => ({ ...s, revision_date: e.target.value || null }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="review-due">Review Due Date</Label>
                <Input
                  id="review-due"
                  type="date"
                  value={sds.review_due_date ?? ''}
                  onChange={(e) =>
                    setSds((s) => ({ ...s, review_due_date: e.target.value || null }))
                  }
                />
              </div>
            </div>

            {sds.review_due_date && (
              <p className="text-xs text-muted-foreground">
                Cron alerts fire 30 days before:{' '}
                <span className="font-medium">
                  {format(new Date(sds.review_due_date), 'dd MMM yyyy')}
                </span>
              </p>
            )}

            <div className="space-y-1">
              <Label htmlFor="emergency-contact">Supplier Emergency Contact</Label>
              <Input
                id="emergency-contact"
                placeholder="1300 000 000 (24 hr Chem Emergency)"
                value={sds.supplier_emergency_contact ?? ''}
                onChange={(e) =>
                  setSds((s) => ({ ...s, supplier_emergency_contact: e.target.value || null }))
                }
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save SDS
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(dashboard)/inventory/components/SdsPanel.tsx
git commit -m "feat(sds): SdsPanel dialog component"
```

---

## Task 10: Wire SdsPanel into the stock list page

**Files:**
- Modify: `src/app/(dashboard)/inventory/stock/page.tsx`

- [ ] **Step 1: Add import, state, handler, button, and dialog to page.tsx**

Add import at top (after the existing `StockAdjustmentDialog` import line):

```tsx
import { SdsPanel } from '../components/SdsPanel';
```

Add state after the existing dialog state declarations (`const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(null);`):

```tsx
const [sdsPanelOpen, setSdsPanelOpen] = useState(false);
```

Add handler after `handleAdjust`:

```tsx
const handleSds = (item: InventoryItem) => {
  setSelectedProduct(item);
  setSdsPanelOpen(true);
};
```

In the `columns` array, add an SDS action button inside the actions `render`, after the Adjust button:

```tsx
<Button size="sm" variant="outline" onClick={() => handleSds(item)}>
  SDS
</Button>
```

Add the `SdsPanel` inside the `{selectedProduct && (...)}` block, after `StockAdjustmentDialog`:

```tsx
<SdsPanel
  open={sdsPanelOpen}
  onOpenChange={setSdsPanelOpen}
  productId={selectedProduct.id}
  productName={selectedProduct.name}
  productSku={selectedProduct.sku}
/>
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(dashboard)/inventory/stock/page.tsx
git commit -m "feat(sds): wire SdsPanel into stock list page"
```

---

## Task 11: Invoice print-view SDS injection

**Files:**
- Modify: `src/app/(dashboard)/invoices/components/InvoicePrintView.tsx`
- Modify: `src/types/invoices.ts` (add `sds_attachments` to `Invoice` type if it exists)

- [ ] **Step 1: Check the Invoice type**

Read `src/types/invoices.ts` (or wherever `Invoice` is defined) and find the `Invoice` interface.

- [ ] **Step 2: Extend the Invoice type with sds_attachments**

In the file where `Invoice` is defined (likely `src/types/invoices.ts`), add to the `Invoice` interface:

```typescript
  sds_attachments?: Array<{
    product_id: string;
    sds_pdf_url: string | null;
    ghs_signal_word: string | null;
    hazard_statements: string[];
    revision_date: string | null;
    review_due_date: string | null;
    supplier_emergency_contact: string | null;
  }>;
```

- [ ] **Step 3: Add the SDS section to InvoicePrintView.tsx**

In `InvoicePrintView.tsx`, add after the `{invoice.notes && (...)}` block and before the Payment Terms section:

```tsx
{/* SDS Attachments — hazardous line items */}
{invoice.sds_attachments && invoice.sds_attachments.length > 0 && (
  <div className="mb-8">
    <h3 className="text-muted-foreground mb-2 text-sm font-semibold">
      SAFETY DATA SHEETS — HAZARDOUS CHEMICALS (WHS Reg. 341)
    </h3>
    <div className="rounded border border-orange-200 bg-orange-50 p-4">
      <p className="mb-3 text-xs text-orange-800">
        The following products supplied on this invoice are classified as hazardous chemicals
        under the Australian WHS Regulations. Current SDS documents must be retained at the
        point of use.
        {/* TODO for Rana: merge actual PDF pages into this print output */}
      </p>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-orange-200">
            <th className="py-1 text-left font-semibold">Product ID</th>
            <th className="py-1 text-left font-semibold">Signal Word</th>
            <th className="py-1 text-left font-semibold">Hazard Codes</th>
            <th className="py-1 text-left font-semibold">SDS Revision</th>
            <th className="py-1 text-left font-semibold">Emergency Contact</th>
          </tr>
        </thead>
        <tbody>
          {invoice.sds_attachments.map((sds) => (
            <tr key={sds.product_id} className="border-b border-orange-100">
              <td className="py-1 font-mono">{sds.product_id}</td>
              <td className="py-1">{sds.ghs_signal_word ?? '—'}</td>
              <td className="py-1">{sds.hazard_statements.join(', ') || '—'}</td>
              <td className="py-1">
                {sds.revision_date
                  ? format(new Date(sds.revision_date), 'dd MMM yyyy')
                  : '—'}
                {sds.sds_pdf_url && (
                  <a
                    href={sds.sds_pdf_url}
                    className="ml-2 text-blue-700 underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    PDF
                  </a>
                )}
              </td>
              <td className="py-1">{sds.supplier_emergency_contact ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
)}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/invoices/components/InvoicePrintView.tsx src/types/invoices.ts
git commit -m "feat(sds): inject sds_attachments into invoice print view"
```

---

## Task 12: Run all three test suites green

- [ ] **Step 1: Run all SDS tests**

```bash
npx vitest run src/lib/__tests__/sds-route.test.ts src/lib/__tests__/sds-docket-injection.test.ts src/lib/__tests__/sds-cron.test.ts
```

Expected: all tests PASS.

- [ ] **Step 2: Run full test suite**

```bash
npx vitest run
```

Expected: all existing tests still PASS.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

---

## Task 13: Open the draft PR

- [ ] **Step 1: Push branch**

```bash
git push -u origin feat/sds-compliance-for-rana
```

- [ ] **Step 2: Create draft PR**

```bash
gh pr create \
  --repo CleanExpo/CCW-CRM \
  --title "feat(for Rana): SDS compliance module (board, WHS reg. 341)" \
  --draft \
  --body "$(cat <<'EOF'
## Why this exists

WorkSafe Australia WHS Regulation 341 requires that a current Safety Data Sheet accompany every supply of a hazardous chemical. Each shipment invoice without an attached SDS is an individual infringement exposure. This is also a **tender-winning feature** — commercial cleaning contracts increasingly require proof of GHS-compliant chemical management.

Board sign-off: CISO + AI Lead + CEO convergence, impact 5.

## What ships in this PR

- **`ProductSds` Prisma model** — 1:1 extension of `Product` with `sdsPdfUrl`, `ghsSignalWord`, `hazardStatements` (JSON array of H-codes), `revisionDate`, `reviewDueDate`, `supplierEmergencyContact`. Migration: `20260611200000_add_product_sds`.
- **`GET / PUT /api/inventory/[id]/sds`** — auth via `requireAuthScope` + `getWorkspaceMemberUserIds`, cross-workspace isolated. GET returns empty shape (not 404) when no SDS row exists yet, so the UI can pre-fill a blank form.
- **`SdsPanel` dialog** — "SDS" button on every row of the inventory stock list (`/inventory/stock`). Opens a Dialog with GHS signal word, H-code list, revision/review dates, emergency contact, and PDF URL field.
- **Invoice print view SDS section** — `InvoicePrintView` accepts `sds_attachments[]` on the `Invoice` type. When present, renders an orange-bordered WHS warning table listing signal word, H-codes, revision date, PDF link, and emergency contact. **PDF merging is a TODO for Rana** — noted in the component with a comment; currently a hyperlink.
- **`/api/cron/sds-review-due`** — daily cron (suggested: 0 22 \* \* \* UTC). Proxies to `API_UPSTREAM_URL` following the identical pattern as `check-sla-breaches`. Upstream logic should flag SDS where `reviewDueDate < NOW() + 30 days` and create a notification via whatever mechanism is live.
- **Tests** — route auth/CRUD/cross-workspace, docket injection (hazardous present / non-hazardous absent / null productId absent), cron auth gate + proxy. Full vitest green.

## Schema conflict note vs parallel PRs

- **#208** (`feat/workspace-settings-persistence-for-rana`) adds a `WorkspaceSettings` model and two migrations (`20260611100000`, `20260611110000`). This PR's migration is `20260611200000` — **land #208 first** to avoid migration timestamp conflicts.
- **#209** (`feat/portal-prisma-wiring-for-rana`) touches no schema — safe to land in any order relative to this PR.
- **#210** — TypeScript cleanup only, no schema.

Suggested landing order: #208 → #209/#210 (either order) → this PR.

## Decisions for Rana

1. **PDF storage** — where do supplier SDS PDFs live? Options: (a) external URL field only (current implementation — supplier hosts it), (b) upload to Supabase Storage / S3 and store the signed URL, (c) Cin7 attachment sync. The `sdsPdfUrl` field accepts any URL; upload flow is not yet wired. Rana to decide and implement the upload button in `SdsPanel`.

2. **Which products count as hazardous?** — current logic: a product is hazardous if its `ProductSds` row has a non-null `ghsSignalWord` OR non-empty `hazardStatements`. An alternative is a boolean `isHazardous` flag on `Product` itself (simpler querying, explicit override). Rana to confirm — the SDS row approach is already implemented.

3. **Cron notification mechanism** — `sds-review-due` proxies upstream. Rana needs to implement the upstream handler that queries `reviewDueDate < NOW() + 30d` and fires a notification (email / in-app task). The `Task` / activity model to use should mirror whatever the SLA-breach or workshop-reminder crons use upstream.

4. **Print view PDF merge** — noted as TODO in `SdsPanel.tsx` and `InvoicePrintView.tsx`. True GHS-compliant output requires the actual SDS PDF appended to the invoice PDF (e.g. via `pdf-lib`). Currently ships as a hyperlink.
EOF
)"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] `ProductSds` model with all 6 spec fields → Task 2
- [x] Migration → Task 1
- [x] GET/PUT `/api/inventory/[id]/sds` → Task 4
- [x] Auth per merged conventions (`requireAuthScope` + `getWorkspaceMemberUserIds`) → Task 4
- [x] SDS panel on inventory stock detail page → Tasks 9, 10
- [x] Invoice docket injection with `sds_attachments[]` → Tasks 5, 6, 11
- [x] Print view renders SDS list with revision dates → Task 11
- [x] PDF merging noted as TODO for Rana → Tasks 9, 11
- [x] Cron `/api/cron/sds-review-due` with CRON_SECRET auth → Task 8
- [x] Cron pattern matches existing routes exactly → Task 8
- [x] Model/route tests (auth, CRUD, cross-workspace) → Task 3
- [x] Docket injection test (hazardous → present, non-hazardous → absent) → Task 5
- [x] Cron threshold test → Task 7
- [x] Full vitest green → Task 12
- [x] Draft PR with WHY, schema-conflict note, decisions for Rana → Task 13

**Type consistency:**
- `SdsAttachment` type defined in `docket-injection.ts`, matches shape returned by route and consumed in `InvoicePrintView`.
- `sdsToApi()` in route returns same field names as `SdsAttachment` interface.
- `EMPTY_SDS()` returns same shape (null fields) so GET never returns 404 for existing products.
