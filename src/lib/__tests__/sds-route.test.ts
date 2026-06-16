/**
 * SDS API route tests.
 * Covers: auth gate (401), cross-workspace isolation (404), GET (empty shape when no row),
 * GET (existing SDS data), PUT (upsert), cross-workspace isolation on PUT.
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

function setAuth(userId: string | null, members: string[] = userId ? [userId] : []) {
  (requireAuthScope as Mock).mockResolvedValue(
    userId ? { userId, role: 'owner' as const, isAdmin: false } : null
  );
  (getWorkspaceMemberUserIds as Mock).mockResolvedValue(members);
}

function makeRequest(method: string, body?: unknown): Request {
  return new Request(`http://localhost/api/inventory/${PRODUCT_ID}/sds`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
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

  it('returns empty SDS shape when no SDS row exists yet', async () => {
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
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    });
    const res = await GET(makeRequest('GET') as never, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ghs_signal_word).toBe('Danger');
    expect(body.hazard_statements).toEqual(['H225', 'H302']);
    expect(body.sds_pdf_url).toBe('https://example.com/sds.pdf');
  });

  it('cross-workspace: user B cannot see user A product (404)', async () => {
    setAuth(USER_B, [USER_B]);
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
      createdAt: new Date('2025-06-01'),
      updatedAt: new Date('2025-06-01'),
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
    expect(body.hazard_statements).toEqual(['H302']);
    expect(mockSdsUpsert).toHaveBeenCalledOnce();
  });

  it('cross-workspace: user B cannot PUT on user A product (404)', async () => {
    setAuth(USER_B, [USER_B]);
    mockProductFindFirst.mockResolvedValue(null);
    const res = await PUT(makeRequest('PUT', { ghs_signal_word: 'Danger' }) as never, ctx);
    expect(res.status).toBe(404);
  });
});
