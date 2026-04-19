/**
 * Mobile nav parity test — UNI-1788
 * Asserts that the mobile nav renders the same top-level group labels as the desktop config.
 */
import { describe, it, expect } from 'vitest';
import { navGroups } from '@/components/layout/sidebar';

describe('navGroups (shared nav config)', () => {
  const expectedGroupIds = ['operations', 'crm', 'workshop', 'inventory', 'finance', 'ai', 'admin'];

  it('exports all expected nav groups', () => {
    const ids = navGroups.map((g) => g.id);
    for (const id of expectedGroupIds) {
      expect(ids).toContain(id);
    }
  });

  it('has the correct group count', () => {
    expect(navGroups.length).toBe(expectedGroupIds.length);
  });

  it('every group has at least one item', () => {
    for (const group of navGroups) {
      expect(group.items.length).toBeGreaterThan(0);
    }
  });

  it('group labels match expected display names', () => {
    const labelMap: Record<string, string> = {
      operations: 'Operations',
      crm: 'CRM',
      workshop: 'Workshop',
      inventory: 'Inventory',
      finance: 'Finance',
      ai: 'AI & Reports',
      admin: 'Admin',
    };
    for (const group of navGroups) {
      expect(group.label).toBe(labelMap[group.id]);
    }
  });
});
