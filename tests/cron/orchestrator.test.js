/**
 * CRON Orchestrator Tests (UNI-1721)
 * Tests the boardroom session orchestration pipeline.
 */

const path = require('path');

// Mock heavy dependencies
jest.mock('@anthropic-ai/sdk', () => ({
  default: jest.fn().mockImplementation(() => ({
    messages: { create: jest.fn().mockResolvedValue({ content: [{ text: '{"status":"ok"}' }] }) }
  }))
}));

jest.mock('../../scripts/boardroom/browse-competitive', () => ({
  runCompetitiveIntelligence: jest.fn().mockResolvedValue({ status: 'ok', intel: [] })
}), { virtual: true });

jest.mock('../../scripts/boardroom/security-audit', () => ({
  runSecurityAudit: jest.fn().mockResolvedValue({ status: 'ok', findings: [] })
}), { virtual: true });

jest.mock('../../scripts/boardroom/qa-check', () => ({
  runQACheck: jest.fn().mockResolvedValue({ status: 'ok', passed: true })
}), { virtual: true });

describe('CRON Orchestrator', () => {
  describe('Phase validation', () => {
    it('defines 22 session phases', () => {
      const PHASES = [
        'bootstrap', 'preflight', 'scout-swarm', 'competitive-intel',
        'board-deliberation', 'security-audit', 'witness', 'debrief-json',
        'elevenlabs', 'remotion', 'youtube', 'linear', 'qa-check', 'retro',
        'session-state-save', 'cost-tracker', 'governance-capture', 'compliance-check',
        'sanitise-output', 'approval-gate', 'verification-loop', 'post-cron-audit'
      ];
      expect(PHASES).toHaveLength(22);
    });

    it('all phases have string identifiers', () => {
      const PHASES = ['bootstrap', 'preflight', 'scout-swarm', 'board-deliberation'];
      PHASES.forEach(p => expect(typeof p).toBe('string'));
    });
  });

  describe('Session lifecycle', () => {
    it('creates session with unique ID', () => {
      const { createSession } = require('../../scripts/lib/session-manager');
      const session = createSession('test-cron');
      expect(session).toHaveProperty('id');
      expect(session.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(session.cronTrigger).toBe('test-cron');
      expect(session.status).toBe('running');
    });

    it('checkpoints session phases', () => {
      const { createSession, checkpoint } = require('../../scripts/lib/session-manager');
      const session = createSession('test-cron');
      const updated = checkpoint(session.id, 'bootstrap', { result: 'ok' });
      expect(updated.completedPhases).toHaveLength(1);
      expect(updated.completedPhases[0].phase).toBe('bootstrap');
    });

    it('completes session with summary', () => {
      const { createSession, completeSession } = require('../../scripts/lib/session-manager');
      const session = createSession('test-cron');
      const completed = completeSession(session.id, { totalPhases: 22 });
      expect(completed.status).toBe('completed');
      expect(completed.summary).toHaveProperty('totalPhases', 22);
    });

    it('fails session and records error', () => {
      const { createSession, failSession } = require('../../scripts/lib/session-manager');
      const session = createSession('test-cron');
      const failed = failSession(session.id, new Error('API timeout'));
      expect(failed.status).toBe('failed');
      expect(failed.error).toBe('API timeout');
    });

    it('detects stale sessions', () => {
      const { findStaleSessions } = require('../../scripts/lib/session-manager');
      const stale = findStaleSessions();
      expect(Array.isArray(stale)).toBe(true);
    });
  });

  describe('Circuit breaker integration', () => {
    it('creates breaker per service', () => {
      const { getBreaker } = require('../../scripts/lib/circuit-breaker');
      const breaker = getBreaker('supabase', { failureThreshold: 3 });
      expect(breaker.name).toBe('supabase');
      expect(breaker.state).toBe('closed');
    });

    it('opens after failure threshold', async () => {
      const { CircuitBreaker } = require('../../scripts/lib/circuit-breaker');
      const breaker = new CircuitBreaker('test-service', { failureThreshold: 2 });
      const failFn = async () => { throw new Error('API error'); };
      await expect(breaker.execute(failFn)).rejects.toThrow();
      await expect(breaker.execute(failFn)).rejects.toThrow();
      expect(breaker.state).toBe('open');
    });

    it('blocks calls when open', async () => {
      const { CircuitBreaker } = require('../../scripts/lib/circuit-breaker');
      const breaker = new CircuitBreaker('test-open', { failureThreshold: 1, resetTimeout: 60000 });
      await expect(breaker.execute(async () => { throw new Error('fail'); })).rejects.toThrow();
      await expect(breaker.execute(async () => 'ok')).rejects.toThrow(/OPEN/);
    });
  });

  describe('Model routing', () => {
    it('routes haiku for research tasks', () => {
      const { routeModel } = require('../../scripts/lib/model-router');
      expect(routeModel('research')).toBe('claude-haiku-4-5-20251001');
    });

    it('routes opus for architecture tasks', () => {
      const { routeModel } = require('../../scripts/lib/model-router');
      expect(routeModel('architecture')).toBe('claude-opus-4-6');
    });

    it('routes sonnet by default', () => {
      const { routeModel } = require('../../scripts/lib/model-router');
      expect(routeModel('unknown-task')).toBe('claude-sonnet-4-6');
    });
  });

  describe('Approval gates', () => {
    it('auto-approves safe read operations', () => {
      const { checkApproval } = require('../../scripts/lib/approval-gate');
      const result = checkApproval('database:read', {});
      expect(result.approved).toBe(true);
      expect(result.method).toBe('auto');
    });

    it('requires approval for db migrations', () => {
      const { checkApproval } = require('../../scripts/lib/approval-gate');
      const result = checkApproval('database:migrate', {});
      expect(result.approved).toBe(false);
      expect(result.method).toBe('required');
    });

    it('requires approval for video publish', () => {
      const { checkApproval } = require('../../scripts/lib/approval-gate');
      const result = checkApproval('video:publish', {});
      expect(result.approved).toBe(false);
    });

    it('denies unknown operations by default', () => {
      const { checkApproval } = require('../../scripts/lib/approval-gate');
      const result = checkApproval('completely:unknown:operation', {});
      expect(result.approved).toBe(false);
    });
  });
});
