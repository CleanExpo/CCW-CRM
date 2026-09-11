/**
 * Duplicate-customer merge planner (UNI-2255). Pure planning logic shared
 * between the CLI in scripts/cin7-dedupe-customers.mjs and the tests.
 */

export {
  CUSTOMER_FK_TABLES,
  applyPlanInMemory,
  buildPlan,
  chooseSurvivor,
  groupKeyFor,
  normalisePart,
  normalisePhone,
  planToSql,
  rollbackSql,
} from '../../../scripts/lib/dedupe-customers.mjs';
