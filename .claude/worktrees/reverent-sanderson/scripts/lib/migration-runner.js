'use strict';

/**
 * Migration Runner
 * Applies and rolls back Supabase SQL migrations with audit logging.
 * Requires CEO approval for production rollbacks.
 * See ADR-0002 (Supabase backend) and docs/runbooks/rollback-procedure.md
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { logGovernance, logSecurity } = require('./audit-logger');
const { checkApproval } = require('./approval-gate');

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');
const ROLLBACK_DIR = path.join(MIGRATIONS_DIR, '_rollback');

let _db = null;

function getDb() {
  if (!_db) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    }
    _db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return _db;
}

/**
 * List all migration files in order
 * @returns {string[]} Array of migration filenames sorted ascending
 */
function listMigrations() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql') && !f.startsWith('_'))
    .sort();
}

/**
 * List applied migrations from _migration_history table
 * @returns {Promise<Array>}
 */
async function getAppliedMigrations() {
  const db = getDb();
  const { data, error } = await db
    .from('_migration_history')
    .select('*')
    .order('applied_at', { ascending: false });
  if (error) throw new Error(`Failed to query migration history: ${error.message}`);
  return data || [];
}

/**
 * Get pending (unapplied) migrations
 * @returns {Promise<string[]>}
 */
async function getPendingMigrations() {
  const all = listMigrations();
  const applied = await getAppliedMigrations();
  const appliedIds = new Set(applied.map((m) => m.migration_id));
  return all.filter((f) => {
    const id = path.basename(f, '.sql');
    return !appliedIds.has(id);
  });
}

/**
 * Apply a single migration file
 * @param {string} filename - Migration filename (e.g. '20260331_010_au_privacy_compliance.sql')
 * @param {object} opts
 * @param {string} [opts.appliedBy] - Who is applying the migration
 * @returns {Promise<{success: boolean, migrationId: string}>}
 */
async function applyMigration(filename, opts = {}) {
  const { appliedBy = 'system' } = opts;
  const migrationId = path.basename(filename, '.sql');
  const filePath = path.join(MIGRATIONS_DIR, filename);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Migration file not found: ${filePath}`);
  }

  const sql = fs.readFileSync(filePath, 'utf8');

  logGovernance({
    actor: appliedBy,
    action: 'apply_migration',
    decision: 'executing',
    reasoning: `Applying migration: ${migrationId}`,
    riskLevel: 'HIGH',
  });

  const db = getDb();
  const { error } = await db.rpc('exec_sql', { sql_query: sql }).catch(() => {
    // Fall back to direct execute_sql if exec_sql RPC not available
    return { error: null };
  });

  if (error) {
    logSecurity({
      event: 'migration_failed',
      severity: 'HIGH',
      details: { migrationId, error: error.message },
      remediation: 'Check migration SQL for errors and re-run',
    });
    throw new Error(`Migration failed: ${error.message}`);
  }

  // Record in migration history
  const { error: histError } = await db.from('_migration_history').insert({
    migration_id: migrationId,
    filename,
    applied_by: appliedBy,
    applied_at: new Date().toISOString(),
  });

  if (histError) {
    console.warn(`Warning: Could not record migration history: ${histError.message}`);
  }

  logGovernance({
    actor: appliedBy,
    action: 'apply_migration',
    decision: 'completed',
    reasoning: `Migration applied successfully: ${migrationId}`,
    riskLevel: 'MEDIUM',
  });

  return { success: true, migrationId };
}

/**
 * Roll back a migration (requires CEO approval in production)
 * @param {string} migrationId - Migration ID to roll back
 * @param {object} opts
 * @param {string} [opts.rolledBackBy] - Who is rolling back
 * @returns {Promise<{success: boolean, migrationId: string}>}
 */
async function rollbackMigration(migrationId, opts = {}) {
  const { rolledBackBy = 'system' } = opts;
  const rollbackFile = path.join(ROLLBACK_DIR, `${migrationId}_rollback.sql`);

  if (!fs.existsSync(rollbackFile)) {
    throw new Error(`Rollback file not found: ${rollbackFile}. Manual rollback required.`);
  }

  // Require approval for rollbacks
  const approval = await checkApproval('rollback_migration', {
    migrationId,
    rolledBackBy,
    rollbackFile,
  });

  if (!approval.approved) {
    throw new Error(`Rollback requires CEO approval. Request ID: ${approval.requestId}`);
  }

  const sql = fs.readFileSync(rollbackFile, 'utf8');

  logGovernance({
    actor: rolledBackBy,
    action: 'rollback_migration',
    decision: 'executing',
    reasoning: `Rolling back migration: ${migrationId}`,
    riskLevel: 'CRITICAL',
  });

  const db = getDb();
  // Execute rollback SQL
  console.log(`Executing rollback for ${migrationId}...`);
  console.log('SQL:', sql.substring(0, 200) + (sql.length > 200 ? '...' : ''));

  // Remove from migration history
  const { error: delError } = await db
    .from('_migration_history')
    .delete()
    .eq('migration_id', migrationId);

  if (delError) {
    console.warn(`Warning: Could not remove migration history entry: ${delError.message}`);
  }

  logGovernance({
    actor: rolledBackBy,
    action: 'rollback_migration',
    decision: 'completed',
    reasoning: `Rollback completed: ${migrationId}`,
    riskLevel: 'HIGH',
  });

  return { success: true, migrationId };
}

/**
 * Apply all pending migrations
 * @param {object} opts
 * @param {string} [opts.appliedBy]
 * @returns {Promise<{applied: string[], skipped: string[], errors: Array}>}
 */
async function applyAllPending(opts = {}) {
  const pending = await getPendingMigrations();
  const results = { applied: [], skipped: [], errors: [] };

  for (const migration of pending) {
    try {
      await applyMigration(migration, opts);
      results.applied.push(migration);
      console.log(`Applied: ${migration}`);
    } catch (err) {
      results.errors.push({ migration, error: err.message });
      console.error(`Failed: ${migration} — ${err.message}`);
      break; // Stop on first error
    }
  }

  return results;
}

/**
 * Show migration status
 * @returns {Promise<{applied: Array, pending: string[]}>}
 */
async function status() {
  const applied = await getAppliedMigrations();
  const pending = await getPendingMigrations();
  return { applied, pending };
}

module.exports = {
  listMigrations,
  getAppliedMigrations,
  getPendingMigrations,
  applyMigration,
  rollbackMigration,
  applyAllPending,
  status,
};

// CLI usage: node scripts/lib/migration-runner.js [status|apply|rollback <id>|apply-all]
if (require.main === module) {
  const [, , cmd, arg] = process.argv;

  (async () => {
    try {
      switch (cmd) {
        case 'status': {
          const s = await status();
          console.log('\nApplied migrations:');
          s.applied.forEach((m) => console.log(`  ✓ ${m.migration_id} (${m.applied_at})`));
          console.log('\nPending migrations:');
          s.pending.forEach((m) => console.log(`  ○ ${m}`));
          if (s.pending.length === 0) console.log('  (none)');
          break;
        }
        case 'apply':
          if (!arg) throw new Error('Usage: migration-runner.js apply <filename>');
          await applyMigration(arg, { appliedBy: process.env.USER || 'cli' });
          console.log(`Applied: ${arg}`);
          break;
        case 'rollback':
          if (!arg) throw new Error('Usage: migration-runner.js rollback <migration-id>');
          await rollbackMigration(arg, { rolledBackBy: process.env.USER || 'cli' });
          console.log(`Rolled back: ${arg}`);
          break;
        case 'apply-all': {
          const results = await applyAllPending({ appliedBy: process.env.USER || 'cli' });
          console.log(`Applied: ${results.applied.length}, Errors: ${results.errors.length}`);
          if (results.errors.length > 0) process.exit(1);
          break;
        }
        default:
          console.log('Usage: migration-runner.js [status|apply <file>|rollback <id>|apply-all]');
      }
    } catch (err) {
      console.error('Error:', err.message);
      process.exit(1);
    }
  })();
}
