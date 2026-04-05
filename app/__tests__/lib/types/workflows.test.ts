import { describe, it, expect } from 'vitest';
import type {
  WorkflowTemplate,
  WorkflowInstance,
  SLARule,
  SLAInstance,
  SLAEscalationPayload,
} from '@/lib/types/workflows';
import { WorkflowStatus, SLAStatus } from '@/lib/types/workflows';

describe('Workflow Types', () => {
  describe('Enums', () => {
    it('should have correct WorkflowStatus values', () => {
      expect(WorkflowStatus.RUNNING).toBe('running');
      expect(WorkflowStatus.COMPLETED).toBe('completed');
      expect(WorkflowStatus.FAILED).toBe('failed');
    });

    it('should have correct SLAStatus values', () => {
      expect(SLAStatus.PENDING).toBe('pending');
      expect(SLAStatus.IN_PROGRESS).toBe('in_progress');
      expect(SLAStatus.MET).toBe('met');
      expect(SLAStatus.BREACHED).toBe('breached');
      expect(SLAStatus.ESCALATED).toBe('escalated');
    });
  });

  describe('WorkflowTemplate Type', () => {
    it('should match backend contract', () => {
      const mockTemplate: WorkflowTemplate = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Order Confirmation Workflow',
        trigger_event: 'order.created',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      expect(mockTemplate.id).toBeDefined();
      expect(mockTemplate.name).toBe('Order Confirmation Workflow');
      expect(mockTemplate.is_active).toBe(true);
    });
  });

  describe('WorkflowInstance Type', () => {
    it('should match backend contract', () => {
      const mockInstance: WorkflowInstance = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        template_id: '123e4567-e89b-12d3-a456-426614174000',
        trigger_entity_type: 'order',
        trigger_entity_id: '123e4567-e89b-12d3-a456-426614174002',
        status: WorkflowStatus.RUNNING,
        started_at: '2024-01-01T00:00:00Z',
      };

      expect(mockInstance.id).toBeDefined();
      expect(mockInstance.status).toBe(WorkflowStatus.RUNNING);
      expect(mockInstance.trigger_entity_type).toBe('order');
    });
  });

  describe('SLARule Type', () => {
    it('should match backend contract', () => {
      const mockRule: SLARule = {
        id: '123e4567-e89b-12d3-a456-426614174003',
        name: 'Order Response SLA',
        entity_type: 'order',
        sla_hours: 24,
        escalation_action: 'send_email',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
      };

      expect(mockRule.id).toBeDefined();
      expect(mockRule.sla_hours).toBe(24);
      expect(mockRule.escalation_action).toBe('send_email');
    });
  });

  describe('SLAInstance Type', () => {
    it('should match backend contract', () => {
      const mockInstance: SLAInstance = {
        id: '123e4567-e89b-12d3-a456-426614174004',
        rule_id: '123e4567-e89b-12d3-a456-426614174003',
        entity_type: 'order',
        entity_id: '123e4567-e89b-12d3-a456-426614174002',
        status: SLAStatus.IN_PROGRESS,
        deadline: '2024-01-02T00:00:00Z',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      expect(mockInstance.id).toBeDefined();
      expect(mockInstance.status).toBe(SLAStatus.IN_PROGRESS);
      expect(mockInstance.deadline).toBeDefined();
    });
  });

  describe('SLAEscalationPayload Type', () => {
    it('should match backend contract', () => {
      const mockPayload: SLAEscalationPayload = {
        sla_instance_id: '123e4567-e89b-12d3-a456-426614174004',
        escalation_notes: 'Customer waiting for response',
        escalation_action: 'send_email',
        notify_users: ['user-123', 'user-456'],
      };

      expect(mockPayload.sla_instance_id).toBeDefined();
      expect(mockPayload.escalation_notes).toBe('Customer waiting for response');
      expect(mockPayload.notify_users).toHaveLength(2);
    });
  });
});
