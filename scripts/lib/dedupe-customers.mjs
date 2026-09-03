/**
 * Duplicate-customer merge planner for UNI-2255.
 *
 * Pure functions only: nothing here touches a database. The CLI in
 * scripts/cin7-dedupe-customers.mjs feeds it rows and link counts, and turns
 * the plan into SQL. Keeping the planner pure is what makes the dry run an
 * exact preview of the execute step rather than a different code path.
 *
 * Cin7 is the source of truth and the client has asked that no record be
 * merged or deleted before go-live approval. This module plans; it never
 * decides to run.
 */

/**
 * Every table with a foreign key to customers.id, with its Prisma onDelete
 * rule. Restrict tables would abort a blind DELETE; SetNull tables would
 * silently orphan rows; the two Cascade tables are 1:1 (unique customer_id)
 * and cannot simply be repointed when the survivor already has a row.
 */
export const CUSTOMER_FK_TABLES = [
  { table: 'orders', onDelete: 'Restrict', unique: false },
  { table: 'quotes', onDelete: 'Restrict', unique: false },
  { table: 'invoices', onDelete: 'Restrict', unique: false },
  { table: 'workshop_equipment', onDelete: 'Restrict', unique: false },
  { table: 'workshop_service_reminders', onDelete: 'Restrict', unique: false },
  { table: 'crm_contacts', onDelete: 'SetNull', unique: false },
  { table: 'crm_activities', onDelete: 'SetNull', unique: false },
  { table: 'email_threads', onDelete: 'SetNull', unique: false },
  { table: 'operational_events', onDelete: 'SetNull', unique: false },
  { table: 'customer_personas', onDelete: 'Cascade', unique: true },
  { table: 'customer_price_tiers', onDelete: 'Cascade', unique: true },
  // A uuid pointer with no database foreign key and no Prisma relation
  // (CcwAiCallSession.customerId). Nothing stops a loser delete from leaving
  // it dangling, so it is repointed like the rest.
  { table: 'ccw_ai_call_sessions', onDelete: 'None', unique: false },
];

/** The only table names any generated SQL may name. */
const ALLOWED_TABLES = new Set(['customers', ...CUSTOMER_FK_TABLES.map((t) => t.table)]);

function assertAllowedTable(table) {
  if (!ALLOWED_TABLES.has(table)) throw new Error(`Refusing unknown table in backup: ${String(table)}`);
  return table;
}

export function normalisePart(value) {
  return (value ?? '').toString().trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Digits only, so "(07) 3000 1234" and "0730001234" collide. */
export function normalisePhone(value) {
  return (value ?? '').toString().replace(/\D+/g, '');
}

/**
 * The natural key a customer duplicates on. Same email wins; otherwise the
 * UNI-2252 rule, normalised company|phone|city among no-email rows. A row
 * with neither an email nor a company name has no key and is never merged.
 * @param {{ email?: string | null, companyName?: string | null, phone?: string | null, city?: string | null }} row
 * @returns {string | null}
 */
export function groupKeyFor(row) {
  const email = normalisePart(row.email);
  if (email) return `email:${email}`;
  const company = normalisePart(row.companyName);
  if (!company) return null;
  return `nat:${company}|${normalisePhone(row.phone)}|${normalisePart(row.city)}`;
}

/**
 * @typedef {object} CustomerRow
 * @property {string} id
 * @property {string} ownerUserId
 * @property {string | null} cin7ContactId
 * @property {string} companyName
 * @property {string | null} email
 * @property {string | null} phone
 * @property {string | null} city
 * @property {string | Date} createdAt
 */

/**
 * @typedef {Record<string, Record<string, number>>} LinkCounts
 * customer id -> table -> row count
 */

function totalLinks(counts, id) {
  const byTable = counts[id] ?? {};
  return Object.values(byTable).reduce((sum, n) => sum + n, 0);
}

/**
 * Survivor order: a Cin7-linked row first (it is the one the sync keeps
 * updating), then the row with the most linked records, then the oldest.
 * @param {CustomerRow[]} group
 * @param {LinkCounts} counts
 */
export function chooseSurvivor(group, counts) {
  return [...group].sort((a, b) => {
    const aLinked = a.cin7ContactId ? 1 : 0;
    const bLinked = b.cin7ContactId ? 1 : 0;
    if (aLinked !== bLinked) return bLinked - aLinked;
    const links = totalLinks(counts, b.id) - totalLinks(counts, a.id);
    if (links !== 0) return links;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  })[0];
}

/**
 * Build the merge plan. Groups are scoped by owner so two tenants never
 * merge into each other. A group with two Cin7-linked rows is reported as a
 * conflict and left alone: that is a sync-identity problem, not a duplicate.
 * @param {{ customers: CustomerRow[], linkCounts: LinkCounts }} input
 */
export function buildPlan({ customers, linkCounts }) {
  const groups = new Map();
  let unkeyed = 0;
  for (const row of customers) {
    const key = groupKeyFor(row);
    if (!key) {
      unkeyed += 1;
      continue;
    }
    const scoped = `${row.ownerUserId}::${key}`;
    const list = groups.get(scoped) ?? [];
    list.push(row);
    groups.set(scoped, list);
  }

  const merges = [];
  const conflicts = [];
  const repointsByTable = Object.fromEntries(CUSTOMER_FK_TABLES.map((t) => [t.table, 0]));
  const oneToOneDrops = Object.fromEntries(
    CUSTOMER_FK_TABLES.filter((t) => t.unique).map((t) => [t.table, 0])
  );

  for (const [scoped, group] of groups) {
    if (group.length < 2) continue;
    const key = scoped.slice(scoped.indexOf('::') + 2);
    const linked = group.filter((r) => r.cin7ContactId);
    if (linked.length > 1) {
      conflicts.push({ key, ids: group.map((r) => r.id), reason: 'multiple cin7 ids' });
      continue;
    }
    const survivor = chooseSurvivor(group, linkCounts);
    const losers = group.filter((r) => r.id !== survivor.id);
    const moves = [];
    // A 1:1 slot on the survivor can be filled at most once: by its own row,
    // or by the first loser repointed into it. Every later loser's row drops.
    const filledOneToOne = new Set(
      CUSTOMER_FK_TABLES.filter((t) => t.unique && (linkCounts[survivor.id]?.[t.table] ?? 0) > 0).map((t) => t.table)
    );
    for (const loser of losers) {
      for (const { table, unique } of CUSTOMER_FK_TABLES) {
        const n = linkCounts[loser.id]?.[table] ?? 0;
        if (n === 0) continue;
        if (unique && filledOneToOne.has(table)) {
          moves.push({ table, from: loser.id, to: survivor.id, rows: n, action: 'drop' });
          oneToOneDrops[table] += n;
        } else {
          if (unique) filledOneToOne.add(table);
          moves.push({ table, from: loser.id, to: survivor.id, rows: n, action: 'repoint' });
          repointsByTable[table] += n;
        }
      }
    }
    merges.push({ key, survivor: survivor.id, losers: losers.map((r) => r.id), moves });
  }

  const loserCount = merges.reduce((sum, m) => sum + m.losers.length, 0);
  return {
    version: 'CCW-CUSTOMER-DEDUPE-PLAN-V1',
    totals: {
      customers: customers.length,
      unkeyed,
      groups: merges.length,
      conflicts: conflicts.length,
      losers: loserCount,
      expected_after: customers.length - loserCount,
      repoints_by_table: repointsByTable,
      one_to_one_drops: oneToOneDrops,
    },
    merges,
    conflicts,
  };
}

/**
 * Turn a plan into ordered SQL statements. Order matters: 1:1 drops, then
 * repoints, then the loser deletes. All of it is meant to run inside one
 * transaction so a failure part-way leaves nothing changed.
 * @returns {{ sql: string, params: unknown[] }[]}
 */
export function planToSql(plan) {
  const statements = [];
  for (const merge of plan.merges) {
    for (const move of merge.moves) {
      if (move.action === 'drop') {
        statements.push({
          sql: `DELETE FROM ${move.table} WHERE customer_id = $1`,
          params: [move.from],
        });
      } else {
        statements.push({
          sql: `UPDATE ${move.table} SET customer_id = $1 WHERE customer_id = $2`,
          params: [move.to, move.from],
        });
      }
    }
    statements.push({
      sql: 'DELETE FROM customers WHERE id = ANY($1::uuid[])',
      params: [merge.losers],
    });
  }
  return statements;
}

/**
 * Statements that undo an executed plan from its backup: re-insert the
 * deleted customers, re-insert dropped 1:1 rows, then restore every moved
 * foreign key to its original customer. Runs in one transaction.
 * @param {{ customers: object[], one_to_one_rows: { table: string, row: object }[], fk_rows: { table: string, id: string, customer_id: string }[] }} backup
 */
export function rollbackSql(backup) {
  const statements = [];
  for (const row of backup.customers) {
    statements.push({
      sql: 'INSERT INTO customers SELECT * FROM jsonb_populate_record(NULL::customers, $1::jsonb)',
      params: [JSON.stringify(row)],
    });
  }
  for (const { table, row } of backup.one_to_one_rows) {
    const t = assertAllowedTable(table);
    statements.push({
      sql: `INSERT INTO ${t} SELECT * FROM jsonb_populate_record(NULL::${t}, $1::jsonb)`,
      params: [JSON.stringify(row)],
    });
  }
  for (const { table, id, customer_id } of backup.fk_rows) {
    const t = assertAllowedTable(table);
    statements.push({
      sql: `UPDATE ${t} SET customer_id = $1 WHERE id = $2`,
      params: [customer_id, id],
    });
  }
  return statements;
}

/**
 * Apply a plan to an in-memory copy of the rows and counts, so a test can
 * prove idempotency: planning again after applying must find nothing.
 */
export function applyPlanInMemory(plan, { customers, linkCounts }) {
  const losers = new Set(plan.merges.flatMap((m) => m.losers));
  const counts = structuredClone(linkCounts);
  for (const merge of plan.merges) {
    for (const move of merge.moves) {
      if (move.action === 'repoint') {
        counts[move.to] = counts[move.to] ?? {};
        counts[move.to][move.table] = (counts[move.to][move.table] ?? 0) + move.rows;
      }
      if (counts[move.from]) delete counts[move.from][move.table];
    }
  }
  return {
    customers: customers.filter((c) => !losers.has(c.id)),
    linkCounts: counts,
  };
}
