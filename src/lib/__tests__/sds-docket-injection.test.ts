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
const mockProductFindMany = vi.fn();

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
  updatedAt: new Date('2024-06-01'),
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
    mockSdsFindMany.mockResolvedValue([]);

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
    mockProductFindMany.mockResolvedValue([]);
    mockSdsFindMany.mockResolvedValue([]);

    const result = await getHazardousSdsAttachments(
      [{ product_id: 'prod-other-workspace', description: 'Chemical' }],
      ['user-not-owner']
    );

    expect(result).toHaveLength(0);
  });
});
