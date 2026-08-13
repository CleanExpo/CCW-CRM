import { describe, expect, it } from 'vitest';
import { finalizeCatalogWalk, paginateUntilDone } from '../cin7-catalog-fetch';

describe('finalizeCatalogWalk', () => {
  it('marks a short walk against Cin7 Total as truncated', () => {
    const result = finalizeCatalogWalk({
      errors: [],
      sourceRowsFetched: 9805,
      reportedTotal: 10500,
    });
    expect(result.truncated).toBe(true);
    expect(result.errors[0]).toMatch(/9805 of Cin7 Total 10500/);
  });

  it('is complete when fetched rows meet Total', () => {
    const result = finalizeCatalogWalk({
      errors: [],
      sourceRowsFetched: 10500,
      reportedTotal: 10500,
    });
    expect(result.truncated).toBe(false);
    expect(result.errors).toEqual([]);
  });
});

describe('paginateUntilDone Total shortfall', () => {
  it('does not treat a clean empty page as EOF when Cin7 Total is unmet', async () => {
    let page = 0;
    const result = await paginateUntilDone({
      pageGapMs: 0,
      fetchPage: async () => {
        page += 1;
        if (page === 1) {
          return {
            items: Array.from({ length: 50 }, (_, i) => i),
            sourceRowCount: 9805,
            total: 10542,
          };
        }
        return { items: [], sourceRowCount: 0, total: 10542 };
      },
    });
    expect(result.truncated).toBe(true);
    expect(result.source_rows_fetched).toBe(9805);
    expect(result.reported_total).toBe(10542);
    expect(result.errors.some((e) => e.includes('10542'))).toBe(true);
  });

  it('completes when the walk meets Cin7 Total', async () => {
    const result = await paginateUntilDone({
      pageGapMs: 0,
      fetchPage: async () => ({ items: ['a', 'b', 'c'], sourceRowCount: 3, total: 3 }),
    });
    expect(result.truncated).toBe(false);
    expect(result.errors).toEqual([]);
    expect(result.source_rows_fetched).toBe(3);
  });
});
