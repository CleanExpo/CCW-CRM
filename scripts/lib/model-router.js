/**
 * model-router.js — Haiku/Sonnet/Opus Cost Optimisation
 * UNI-1734 [H4] — Model Routing
 *
 * Routes tasks to the appropriate model tier based on complexity:
 *   haiku  — research, logging, formatting (cheapest, ~95% cheaper than opus)
 *   sonnet — analysis, deliberation, code generation
 *   opus   — architecture decisions, security reviews, final approvals
 */

'use strict';

const MODELS = {
  haiku: 'claude-haiku-3',
  sonnet: 'claude-sonnet-4-5',
  opus: 'claude-opus-4',
};

// Cost per 1M tokens (input/output rates in USD)
const COST_PER_1M = {
  haiku:  { input: 0.25,  output: 1.25  },
  sonnet: { input: 3.00,  output: 15.00 },
  opus:   { input: 15.00, output: 75.00 },
};

// Task types that use haiku (fast/cheap)
const HAIKU_TASKS = new Set([
  'research',
  'search',
  'logging',
  'log',
  'formatting',
  'format',
  'summary',
  'summarise',
  'translate',
  'template',
  'report-generate',
  'cache-read',
  'health-check',
  'status-check',
  'notification',
  'email-draft',
]);

// Task types that use opus (critical/expensive)
const OPUS_TASKS = new Set([
  'architecture',
  'security-review',
  'security',
  'final-approval',
  'production-deploy',
  'rls-change',
  'schema-change',
  'payment',
  'compliance-review',
  'ceo-decision',
  'cto-review',
  'critical-decision',
]);

// Agent-level overrides (take precedence over task type)
const AGENT_MODEL_MAP = {
  // Opus agents
  ceo: 'opus',
  cto: 'opus',
  'security-architect': 'opus',
  orchestrator: 'opus',
  'review-orchestrator': 'opus',
  'review-security': 'opus',

  // Haiku agents
  witness: 'haiku',
  chro: 'haiku',
  'review-infrastructure': 'haiku',
  'review-performance': 'haiku',

  // Sonnet agents (default, explicit for clarity)
  cfo: 'sonnet',
  cmo: 'sonnet',
  coo: 'sonnet',
  clo: 'sonnet',
  'vp-sales': 'sonnet',
  'vp-cx': 'sonnet',
  'vp-product': 'sonnet',
  'data-scientist': 'sonnet',
  'review-database': 'sonnet',
  'review-code-quality': 'sonnet',
  'review-test-coverage': 'sonnet',
  'pr-manager': 'sonnet',
};

/**
 * Route a task to the appropriate model tier.
 *
 * @param {string} taskType - e.g., 'research', 'security-review', 'code-generation'
 * @param {string|null} agentName - Agent override, e.g., 'ceo', 'witness'
 * @returns {{ tier: string, model: string, reason: string }}
 */
function routeModel(taskType = '', agentName = null) {
  const normalizedAgent = agentName ? agentName.toLowerCase().trim() : null;
  const normalizedTask = taskType.toLowerCase().trim();

  // Agent-level overrides take highest priority
  if (normalizedAgent && AGENT_MODEL_MAP[normalizedAgent]) {
    const tier = AGENT_MODEL_MAP[normalizedAgent];
    return {
      tier,
      model: MODELS[tier],
      reason: `agent override: ${normalizedAgent} → ${tier}`,
    };
  }

  // Opus task types
  if (OPUS_TASKS.has(normalizedTask)) {
    return {
      tier: 'opus',
      model: MODELS.opus,
      reason: `task type "${normalizedTask}" requires opus`,
    };
  }

  // Haiku task types
  if (HAIKU_TASKS.has(normalizedTask)) {
    return {
      tier: 'haiku',
      model: MODELS.haiku,
      reason: `task type "${normalizedTask}" uses haiku`,
    };
  }

  // Default to sonnet for unknown/balanced tasks
  return {
    tier: 'sonnet',
    model: MODELS.sonnet,
    reason: `default tier for task type "${normalizedTask}"`,
  };
}

/**
 * Estimate cost for a given number of tokens and model tier.
 *
 * @param {string} tier - 'haiku' | 'sonnet' | 'opus'
 * @param {number} inputTokens
 * @param {number} outputTokens
 * @returns {{ tier: string, inputCost: number, outputCost: number, totalCost: number }}
 */
function estimateCost(tier = 'sonnet', inputTokens = 0, outputTokens = 0) {
  const rates = COST_PER_1M[tier] ?? COST_PER_1M.sonnet;
  const inputCost = (inputTokens / 1_000_000) * rates.input;
  const outputCost = (outputTokens / 1_000_000) * rates.output;
  return {
    tier,
    inputTokens,
    outputTokens,
    inputCost: Math.round(inputCost * 10000) / 10000,
    outputCost: Math.round(outputCost * 10000) / 10000,
    totalCost: Math.round((inputCost + outputCost) * 10000) / 10000,
  };
}

/**
 * Estimate savings vs. running everything on opus.
 *
 * @param {Array<{ taskType: string, agentName?: string, inputTokens: number, outputTokens: number }>} tasks
 * @returns {{ opusCost: number, routedCost: number, savingsPercent: number, breakdown: Array }}
 */
function estimateSavings(tasks = []) {
  let opusCost = 0;
  let routedCost = 0;
  const breakdown = [];

  for (const task of tasks) {
    const routed = routeModel(task.taskType, task.agentName);
    const opusEstimate = estimateCost('opus', task.inputTokens, task.outputTokens);
    const routedEstimate = estimateCost(routed.tier, task.inputTokens, task.outputTokens);

    opusCost += opusEstimate.totalCost;
    routedCost += routedEstimate.totalCost;
    breakdown.push({
      task: task.taskType,
      agent: task.agentName,
      routedTier: routed.tier,
      opusCost: opusEstimate.totalCost,
      routedCost: routedEstimate.totalCost,
      saved: opusEstimate.totalCost - routedEstimate.totalCost,
    });
  }

  const savingsPercent = opusCost > 0
    ? Math.round(((opusCost - routedCost) / opusCost) * 100)
    : 0;

  return {
    opusCost: Math.round(opusCost * 10000) / 10000,
    routedCost: Math.round(routedCost * 10000) / 10000,
    saved: Math.round((opusCost - routedCost) * 10000) / 10000,
    savingsPercent,
    breakdown,
  };
}

module.exports = {
  routeModel,
  estimateCost,
  estimateSavings,
  MODELS,
  COST_PER_1M,
  HAIKU_TASKS,
  OPUS_TASKS,
  AGENT_MODEL_MAP,
};
