import { describe, expect, it } from 'vitest';
import {
  CUSTOMER_FK_TABLES,
  applyPlanInMemory,
  buildPlan,
  groupKeyFor,
  planToSql,
  rollbackSql,
} from '../dedupe-customers';

const OWNER = '11111111-1111-1111-1111-111111111111';

function row(over: Partial<Record<string, unknown>> & { id: string }) {
  return {
    ownerUserId: OWNER,
    cin7ContactId: null,
    companyName: 'Acme Cleaning',
    email: null,
    phone: '07 3000 1234',
    city: 'Brisbane',
    createdAt: '2026-01-01T00:00:00Z',
    ...over,
  };
}

describe('groupKeyFor', () => {
  it('prefers email, then the UNI-2252 company|phone|city key, else nothing', () => {
    expect(groupKeyFor({ email: ' Bob@X.com ' })).toBe('email:bob@x.com');
    expect(groupKeyFor(row({ id: 'a' }))).toBe('nat:acme cleaning|0730001234|brisbane');
    expect(groupKeyFor({ companyName: '  ', email: '' })).toBeNull();
  });
});

describe('buildPlan', () => {
  it('merges no-email duplicates into the Cin7-linked survivor and repoints every link', () => {
    const customers = [
      row({ id: 'a', createdAt: '2026-01-01T00:00:00Z' }),
      row({ id: 'b', cin7ContactId: 'C7-1', createdAt: '2026-03-01T00:00:00Z' }),
      row({ id: 'c', phone: '(07) 3000-1234', createdAt: '2026-02-01T00:00:00Z' }),
      row({ id: 'z', companyName: 'Other Pty', email: null }),
    ];
    const linkCounts = { a: { orders: 2, crm_contacts: 1 }, c: { invoices: 1 } };
    const plan = buildPlan({ customers, linkCounts });

    expect(plan.totals).toMatchObject({ customers: 4, groups: 1, losers: 2, expected_after: 2, conflicts: 0 });
    const [merge] = plan.merges;
    expect(merge.survivor).toBe('b');
    expect(merge.losers.sort()).toEqual(['a', 'c']);
    expect(merge.moves).toEqual(
      expect.arrayContaining([
        { table: 'orders', from: 'a', to: 'b', rows: 2, action: 'repoint' },
        { table: 'crm_contacts', from: 'a', to: 'b', rows: 1, action: 'repoint' },
        { table: 'invoices', from: 'c', to: 'b', rows: 1, action: 'repoint' },
      ])
    );
  });

  it('never merges across owners', () => {
    const plan = buildPlan({
      customers: [row({ id: 'a' }), row({ id: 'b', ownerUserId: '22222222-2222-2222-2222-222222222222' })],
      linkCounts: {},
    });
    expect(plan.totals.groups).toBe(0);
  });

  it('reports two Cin7-linked rows as a conflict instead of merging', () => {
    const plan = buildPlan({
      customers: [row({ id: 'a', cin7ContactId: 'C7-1' }), row({ id: 'b', cin7ContactId: 'C7-2' })],
      linkCounts: {},
    });
    expect(plan.merges).toHaveLength(0);
    expect(plan.conflicts).toEqual([{ key: expect.stringContaining('nat:'), ids: ['a', 'b'], reason: 'multiple cin7 ids' }]);
  });

  it('drops a loser 1:1 row when the survivor already has one, repoints it otherwise', () => {
    const plan = buildPlan({
      customers: [row({ id: 'keep' }), row({ id: 'lose', createdAt: '2026-05-01T00:00:00Z' })],
      linkCounts: {
        keep: { orders: 5, customer_personas: 1 },
        lose: { customer_personas: 1, customer_price_tiers: 1 },
      },
    });
    const [merge] = plan.merges;
    expect(merge.survivor).toBe('keep');
    expect(merge.moves).toEqual(
      expect.arrayContaining([
        { table: 'customer_personas', from: 'lose', to: 'keep', rows: 1, action: 'drop' },
        { table: 'customer_price_tiers', from: 'lose', to: 'keep', rows: 1, action: 'repoint' },
      ])
    );
    expect(plan.totals.one_to_one_drops.customer_personas).toBe(1);
  });

  it('fills a survivor 1:1 slot once when several losers carry a row, dropping the rest', () => {
    const plan = buildPlan({
      customers: [row({ id: 'keep' }), row({ id: 'l1', createdAt: '2026-04-01T00:00:00Z' }), row({ id: 'l2', createdAt: '2026-05-01T00:00:00Z' })],
      linkCounts: { keep: { orders: 9 }, l1: { customer_personas: 1 }, l2: { customer_personas: 1 } },
    });
    const [merge] = plan.merges;
    const personaMoves = merge.moves.filter((m) => m.table === 'customer_personas');
    expect(personaMoves.map((m) => m.action).sort()).toEqual(['drop', 'repoint']);
    expect(plan.totals.repoints_by_table.customer_personas).toBe(1);
    expect(plan.totals.one_to_one_drops.customer_personas).toBe(1);
    // Exactly one UPDATE lands on the unique column.
    const updates = planToSql(plan).filter((s) => s.sql.startsWith('UPDATE customer_personas'));
    expect(updates).toHaveLength(1);
  });

  it('is idempotent: applying the plan leaves nothing to plan', () => {
    const customers = [row({ id: 'a' }), row({ id: 'b' }), row({ id: 'c' }), row({ id: 'd', email: 'x@y.z' }), row({ id: 'e', email: 'X@Y.Z' })];
    const linkCounts = { a: { orders: 1 }, e: { quotes: 3 } };
    const plan = buildPlan({ customers, linkCounts });
    expect(plan.totals.losers).toBe(3);
    const after = applyPlanInMemory(plan, { customers, linkCounts });
    expect(after.customers).toHaveLength(2);
    expect(buildPlan(after).totals.groups).toBe(0);
  });
});

describe('planToSql / rollbackSql', () => {
  it('orders drops and repoints before the loser delete, and rollback restores all three', () => {
    const plan = buildPlan({
      customers: [row({ id: 'keep' }), row({ id: 'lose', createdAt: '2026-05-01T00:00:00Z' })],
      linkCounts: { keep: { customer_personas: 1, orders: 5 }, lose: { customer_personas: 1, orders: 2 } },
    });
    const sql = planToSql(plan);
    expect(sql.map((s) => s.sql)).toEqual([
      'UPDATE orders SET customer_id = $1 WHERE customer_id = $2',
      'DELETE FROM customer_personas WHERE customer_id = $1',
      'DELETE FROM customers WHERE id = ANY($1::uuid[])',
    ]);
    expect(sql[2].params).toEqual([['lose']]);

    const rollback = rollbackSql({
      customers: [{ id: 'lose' }],
      one_to_one_rows: [{ table: 'customer_personas', row: { id: 'p1', customer_id: 'lose' } }],
      fk_rows: [{ table: 'orders', id: 'o1', customer_id: 'lose' }],
    });
    expect(rollback.map((s) => s.sql)).toEqual([
      'INSERT INTO customers SELECT * FROM jsonb_populate_record(NULL::customers, $1::jsonb)',
      'INSERT INTO customer_personas SELECT * FROM jsonb_populate_record(NULL::customer_personas, $1::jsonb)',
      'UPDATE orders SET customer_id = $1 WHERE id = $2',
    ]);
  });

  it('refuses a backup naming a table outside the constant list', () => {
    expect(() =>
      rollbackSql({ customers: [], one_to_one_rows: [], fk_rows: [{ table: 'orders; DROP TABLE customers; --', id: 'o', customer_id: 'c' }] })
    ).toThrow(/unknown table/);
    expect(() =>
      rollbackSql({ customers: [], one_to_one_rows: [{ table: 'pg_shadow', row: {} }], fk_rows: [] })
    ).toThrow(/unknown table/);
  });

  it('covers every Prisma relation on Customer plus the unconstrained call-session pointer', () => {
    // Eleven relations on the model and one bare uuid column; if one is added
    // to prisma/schema.prisma this list must grow.
    expect(CUSTOMER_FK_TABLES).toHaveLength(12);
    expect(CUSTOMER_FK_TABLES.map((t) => t.table)).toContain('ccw_ai_call_sessions');
  });
});
