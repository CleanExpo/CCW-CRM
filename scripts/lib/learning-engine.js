/**
 * learning-engine.js — Session Pattern Extraction & Instinct Registry
 * UNI-1733 [H2] — Continuous Learning
 */

'use strict';

const fs = require('fs');
const path = require('path');

const LEARNING_DIR = path.join(process.cwd(), '.learning');
const REGISTRY_PATH = path.join(LEARNING_DIR, 'instinct-registry.json');
const PATTERNS_DIR = path.join(LEARNING_DIR, 'patterns');

function ensureDirs() {
  for (const dir of [LEARNING_DIR, PATTERNS_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Load the instinct registry from disk.
 * @returns {{ instincts: Array, version: number }}
 */
function loadRegistry() {
  ensureDirs();
  if (!fs.existsSync(REGISTRY_PATH)) {
    return { instincts: [], version: 1, updatedAt: new Date().toISOString() };
  }
  try {
    return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  } catch (_) {
    return { instincts: [], version: 1, updatedAt: new Date().toISOString() };
  }
}

/**
 * Persist the instinct registry atomically.
 */
function saveRegistry(registry) {
  ensureDirs();
  const tmp = `${REGISTRY_PATH}.tmp`;
  registry.updatedAt = new Date().toISOString();
  fs.writeFileSync(tmp, JSON.stringify(registry, null, 2));
  fs.renameSync(tmp, REGISTRY_PATH);
}

/**
 * Estimate model cost for a session.
 */
function calculateCost(model = 'sonnet', tokens = {}) {
  const rates = { opus: 0.075, sonnet: 0.015, haiku: 0.001 };
  const rate = rates[model] ?? 0.015;
  const inputTokens = tokens.input ?? 0;
  const outputTokens = tokens.output ?? 0;
  return (inputTokens * rate + outputTokens * rate * 3) / 1000;
}

/**
 * Extract reusable patterns from a completed session log.
 * @param {object} sessionLog
 * @returns {Array}
 */
function extractPatterns(sessionLog = {}) {
  const patterns = [];

  if (typeof sessionLog.duration === 'number') {
    patterns.push({
      type: 'timing',
      phase: sessionLog.phase || 'unknown',
      duration: sessionLog.duration,
      optimal: sessionLog.duration < 300000,
      timestamp: new Date().toISOString(),
    });
  }

  if (Array.isArray(sessionLog.errors) && sessionLog.errors.length > 0) {
    for (const e of sessionLog.errors) {
      patterns.push({
        type: 'error',
        pattern: typeof e === 'string' ? e : e.message || JSON.stringify(e),
        service: sessionLog.service || e.service || 'unknown',
        frequency: 1,
        timestamp: new Date().toISOString(),
      });
    }
  }

  if (sessionLog.tokenUsage) {
    patterns.push({
      type: 'cost',
      model: sessionLog.model || 'sonnet',
      tokens: sessionLog.tokenUsage,
      estimatedCost: calculateCost(sessionLog.model, sessionLog.tokenUsage),
      timestamp: new Date().toISOString(),
    });
  }

  // Save patterns to disk
  if (patterns.length > 0) {
    try {
      ensureDirs();
      const patternFile = path.join(PATTERNS_DIR, `${Date.now()}.json`);
      fs.writeFileSync(patternFile, JSON.stringify(patterns, null, 2));
    } catch (_) {}
  }

  return patterns;
}

/**
 * Register or reinforce an instinct.
 * @param {string} name - Unique instinct identifier
 * @param {string|object} condition - Context condition that triggers this instinct
 * @param {string} action - Recommended action
 * @param {number} [confidence=0.5] - Initial confidence (0.0–1.0)
 */
function registerInstinct(name, condition, action, confidence = 0.5) {
  const registry = loadRegistry();
  const existing = registry.instincts.find((i) => i.name === name);

  if (existing) {
    existing.confidence = Math.min(1.0, existing.confidence + 0.1);
    existing.lastTriggered = new Date().toISOString();
    existing.triggerCount = (existing.triggerCount || 0) + 1;
    existing.action = action; // Update to latest
  } else {
    registry.instincts.push({
      name,
      condition,
      action,
      confidence: Math.max(0.0, Math.min(1.0, confidence)),
      createdAt: new Date().toISOString(),
      lastTriggered: new Date().toISOString(),
      triggerCount: 1,
    });
  }

  saveRegistry(registry);
  return registry.instincts.find((i) => i.name === name);
}

/**
 * Check if an instinct's condition matches the current context.
 */
function matchesContext(condition, context) {
  if (typeof condition === 'string') {
    if (typeof context === 'string') return context.includes(condition);
    return JSON.stringify(context).includes(condition);
  }
  if (condition && typeof condition === 'object') {
    if (typeof context !== 'object') return false;
    return Object.entries(condition).every(([k, v]) => context[k] === v);
  }
  return false;
}

/**
 * Get relevant instincts for a given context.
 * @param {any} context
 * @param {number} [minConfidence=0.6]
 * @returns {Array}
 */
function getRelevantInstincts(context, minConfidence = 0.6) {
  const registry = loadRegistry();
  return registry.instincts.filter(
    (i) => i.confidence >= minConfidence && matchesContext(i.condition, context)
  );
}

/**
 * Decay confidence of stale instincts (not triggered in 7+ days).
 * Removes instincts with confidence <= 0.1.
 */
function decayConfidence() {
  const registry = loadRegistry();
  const now = Date.now();

  for (const instinct of registry.instincts) {
    const daysSince = (now - new Date(instinct.lastTriggered).getTime()) / 86400000;
    if (daysSince > 7) {
      instinct.confidence = Math.max(0.1, instinct.confidence - 0.05);
    }
  }

  registry.instincts = registry.instincts.filter((i) => i.confidence > 0.1);
  saveRegistry(registry);
  return registry;
}

module.exports = {
  extractPatterns,
  registerInstinct,
  getRelevantInstincts,
  decayConfidence,
  loadRegistry,
  saveRegistry,
  calculateCost,
  REGISTRY_PATH,
  PATTERNS_DIR,
  LEARNING_DIR,
};
