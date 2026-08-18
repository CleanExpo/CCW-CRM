import { describe, expect, it } from 'vitest';

import { shouldShowSidebarGroup } from '../sidebar-visibility';

describe('shouldShowSidebarGroup', () => {
  it('shows Workspace and Finance before the role request finishes', () => {
    expect(shouldShowSidebarGroup('admin', null, false)).toBe(true);
    expect(shouldShowSidebarGroup('finance', null, false)).toBe(true);
    expect(shouldShowSidebarGroup('operations', null, false)).toBe(true);
  });

  it('keeps Workspace visible for owners and admins', () => {
    expect(shouldShowSidebarGroup('admin', 'owner', true)).toBe(true);
    expect(shouldShowSidebarGroup('admin', 'admin', true)).toBe(true);
  });

  it('hides Workspace from members after the role is known', () => {
    expect(shouldShowSidebarGroup('admin', 'member', true)).toBe(false);
    expect(shouldShowSidebarGroup('finance', 'member', true)).toBe(false);
    expect(shouldShowSidebarGroup('operations', 'member', true)).toBe(true);
  });
});
