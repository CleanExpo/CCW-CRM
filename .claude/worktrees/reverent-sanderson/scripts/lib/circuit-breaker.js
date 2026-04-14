/**
 * circuit-breaker.js — API Failure Protection
 * UNI-1732 [H1] — Circuit Breaker
 *
 * States:
 *   CLOSED    — Normal operation. Failures are counted.
 *   OPEN      — Blocking all requests after failureThreshold exceeded.
 *   HALF_OPEN — Testing recovery: allows one request through.
 */

'use strict';

const STATES = {
  CLOSED: 'closed',
  OPEN: 'open',
  HALF_OPEN: 'half_open',
};

class CircuitBreaker {
  /**
   * @param {string} name - Service name identifier
   * @param {object} options
   * @param {number} [options.failureThreshold=3]
   * @param {number} [options.resetTimeout=600000] - 10 minutes in ms
   * @param {number} [options.halfOpenMax=1]
   */
  constructor(name, options = {}) {
    this.name = name;
    this.state = STATES.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.failureThreshold = options.failureThreshold ?? 3;
    this.resetTimeout = options.resetTimeout ?? 600000;
    this.halfOpenMax = options.halfOpenMax ?? 1;
    this.lastFailure = null;
    this.openedAt = null;
    this.errors = [];
  }

  /**
   * Execute a function with circuit breaker protection.
   * @param {Function} fn - Async function to execute
   * @returns {Promise<any>}
   */
  async execute(fn) {
    if (this.state === STATES.OPEN) {
      if (Date.now() - this.openedAt >= this.resetTimeout) {
        this.state = STATES.HALF_OPEN;
        this.successCount = 0;
        this._logTransition('OPEN → HALF_OPEN');
      } else {
        const retryAfter = new Date(this.openedAt + this.resetTimeout).toISOString();
        throw new Error(`Circuit breaker [${this.name}] is OPEN. Retry after ${retryAfter}`);
      }
    }

    try {
      const result = await fn();
      this._onSuccess();
      return result;
    } catch (error) {
      this._onFailure(error);
      throw error;
    }
  }

  _onSuccess() {
    if (this.state === STATES.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.halfOpenMax) {
        this.state = STATES.CLOSED;
        this.failureCount = 0;
        this.errors = [];
        this._logTransition('HALF_OPEN → CLOSED (recovered)');
      }
    } else {
      this.failureCount = 0;
    }
  }

  _onFailure(error) {
    this.failureCount++;
    this.lastFailure = Date.now();
    this.errors.push({
      message: error.message || String(error),
      timestamp: new Date().toISOString(),
    });
    if (this.errors.length > 10) this.errors.shift();

    if (this.failureCount >= this.failureThreshold || this.state === STATES.HALF_OPEN) {
      this.state = STATES.OPEN;
      this.openedAt = Date.now();
      this._logTransition(`→ OPEN (${this.failureCount} failures)`);
    }
  }

  _logTransition(msg) {
    console.warn(`[CIRCUIT-BREAKER] [${this.name}] ${msg}`);
    try {
      const { logGovernance } = require('./audit-logger');
      logGovernance({
        actor: 'circuit-breaker',
        action: `circuit_breaker:${this.name}`,
        decision: this.state,
        reasoning: msg,
        riskLevel: this.state === STATES.OPEN ? 'HIGH' : 'MEDIUM',
      });
    } catch (_) {}
  }

  /**
   * Get current circuit breaker status.
   */
  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      lastFailure: this.lastFailure ? new Date(this.lastFailure).toISOString() : null,
      openedAt: this.openedAt ? new Date(this.openedAt).toISOString() : null,
      retryAfter: this.openedAt ? new Date(this.openedAt + this.resetTimeout).toISOString() : null,
      recentErrors: this.errors.slice(-5),
    };
  }

  /**
   * Manually reset the circuit breaker.
   */
  reset() {
    this.state = STATES.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.errors = [];
    this.openedAt = null;
    this._logTransition('MANUALLY RESET → CLOSED');
  }
}

// --- Global registry of circuit breakers per service ---
const breakers = new Map();

// Pre-configure breakers for known services
const KNOWN_SERVICES = [
  'supabase',
  'xero',
  'cin7',
  'shopify',
  'sendgrid',
  'creatomate',
  'linear',
  'perplexity',
  'openai',
  'anthropic',
];

for (const service of KNOWN_SERVICES) {
  breakers.set(service, new CircuitBreaker(service));
}

/**
 * Get or create a circuit breaker for a service.
 * @param {string} name
 * @param {object} [options]
 * @returns {CircuitBreaker}
 */
function getBreaker(name, options = {}) {
  if (!breakers.has(name)) {
    breakers.set(name, new CircuitBreaker(name, options));
  }
  return breakers.get(name);
}

/**
 * Get health status of all registered circuit breakers.
 * @returns {Array}
 */
function getAllStatus() {
  return Array.from(breakers.values()).map((b) => b.getStatus());
}

/**
 * Get only open/degraded circuit breakers.
 * @returns {Array}
 */
function getOpenBreakers() {
  return Array.from(breakers.values())
    .filter((b) => b.state !== STATES.CLOSED)
    .map((b) => b.getStatus());
}

module.exports = {
  CircuitBreaker,
  getBreaker,
  getAllStatus,
  getOpenBreakers,
  STATES,
};
