import { describe, expect, it } from 'vitest';

import { memberMayAccessPath } from '../member-settings-access';

describe('memberMayAccessPath', () => {
  it('lets a member reach account settings and first-run onboarding', () => {
    expect(memberMayAccessPath('/dashboard/settings/account')).toBe(true);
    expect(memberMayAccessPath('/settings/account')).toBe(true);
    expect(memberMayAccessPath('/onboarding')).toBe(true);
  });

  it('does not open the rest of workspace settings', () => {
    expect(memberMayAccessPath('/dashboard/settings/team')).toBe(false);
    expect(memberMayAccessPath('/dashboard/settings/integrations')).toBe(false);
  });
});
