/**
 * UNI-2107: Cross-workspace POS store isolation tests.
 *
 * These tests verify that:
 * - Two distinct workspaces cannot read each other's POS data.
 * - Two users in the SAME workspace share the same store.
 * They operate purely on in-process store logic using relative imports.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getPosStore, _resetAllPosStores } from '../mock-store';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStore(workspaceId: string) {
  return getPosStore(workspaceId);
}

// ---------------------------------------------------------------------------
// Store isolation tests
// ---------------------------------------------------------------------------

describe('POS mock-store: per-workspace isolation', () => {
  beforeEach(() => {
    _resetAllPosStores();
  });

  it('seeds each workspace with its own independent data', () => {
    const wsA = makeStore('ws-a');
    const wsB = makeStore('ws-b');

    // Both start with the same seed, but are independent objects
    expect(wsA).not.toBe(wsB);
    expect(wsA.locations).not.toBe(wsB.locations);
    expect(wsA.staff).not.toBe(wsB.staff);
    expect(wsA.terminals).not.toBe(wsB.terminals);
  });

  it('same workspaceId always returns the same store instance (same-workspace sharing)', () => {
    // User 1 in workspace A seeds a location
    const storeViaUser1 = makeStore('ws-shared');
    storeViaUser1.locations.push({
      id: 'shared-loc-id',
      code: 'shared-site',
      name: 'Shared Site',
      location_type: 'physical',
      address: null,
      city: null,
      state: null,
      postal_code: null,
      country: 'Australia',
      timezone: 'Australia/Brisbane',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // User 2 in the same workspace sees it
    const storeViaUser2 = makeStore('ws-shared');
    expect(storeViaUser2.locations.find((l) => l.code === 'shared-site')).toBeDefined();
    expect(storeViaUser2).toBe(storeViaUser1);
  });

  it('mutations in workspace A do NOT appear in workspace B (locations)', () => {
    const wsA = makeStore('ws-a');
    const wsB = makeStore('ws-b');

    const initialBCount = wsB.locations.length;

    // Mutate workspace A
    wsA.locations.push({
      id: 'test-loc-id',
      code: 'secret-site',
      name: 'Secret Site — WS-A only',
      location_type: 'physical',
      address: null,
      city: null,
      state: null,
      postal_code: null,
      country: 'Australia',
      timezone: 'Australia/Brisbane',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Workspace B must be unchanged
    expect(wsB.locations.length).toBe(initialBCount);
    expect(wsB.locations.find((l) => l.code === 'secret-site')).toBeUndefined();
  });

  it('mutations in workspace A do NOT appear in workspace B (staff)', () => {
    const wsA = makeStore('ws-a');
    const wsB = makeStore('ws-b');

    const initialBCount = wsB.staff.length;

    wsA.staff.push({
      id: 'staff-secret-id',
      staff_code: 'SECRET',
      full_name: 'WS-A Secret Employee',
      email: null,
      phone: null,
      primary_location_code: 'brisbane',
      can_sell_at_locations: ['brisbane'],
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    expect(wsB.staff.length).toBe(initialBCount);
    expect(wsB.staff.find((s) => s.staff_code === 'SECRET')).toBeUndefined();
  });

  it('mutations in workspace A do NOT appear in workspace B (terminals)', () => {
    const wsA = makeStore('ws-a');
    const wsB = makeStore('ws-b');

    const initialBCount = wsB.terminals.length;

    wsA.terminals.push({
      id: 'term-secret-id',
      terminal_id: 'TERM-SECRET-01',
      location_code: 'brisbane',
      terminal_type: 'counter',
      is_active: true,
      merchant_id: null,
      last_ping_at: null,
    });

    expect(wsB.terminals.length).toBe(initialBCount);
    expect(wsB.terminals.find((t) => t.terminal_id === 'TERM-SECRET-01')).toBeUndefined();
  });

  it('deletions in workspace A do NOT affect workspace B (locations)', () => {
    const wsA = makeStore('ws-a');
    const wsB = makeStore('ws-b');

    const brisbaneInB = wsB.locations.find((l) => l.code === 'brisbane');
    expect(brisbaneInB).toBeDefined();

    // Delete all of workspace A's locations
    wsA.locations.splice(0, wsA.locations.length);
    expect(wsA.locations).toHaveLength(0);

    // Workspace B still has its Brisbane location
    const stillThere = wsB.locations.find((l) => l.code === 'brisbane');
    expect(stillThere).toBeDefined();
  });

  it('same workspaceId always returns the same store instance (persistence)', () => {
    const first = makeStore('ws-stable');
    first.locations.push({
      id: 'x',
      code: 'marker',
      name: 'Marker',
      location_type: 'virtual',
      address: null,
      city: null,
      state: null,
      postal_code: null,
      country: 'Australia',
      timezone: 'Australia/Brisbane',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const second = makeStore('ws-stable');
    expect(second.locations.find((l) => l.code === 'marker')).toBeDefined();
  });

  it('three concurrent workspaces all remain isolated', () => {
    const a = makeStore('ws-alpha');
    const b = makeStore('ws-beta');
    const c = makeStore('ws-gamma');

    // Add unique staff to each workspace
    a.staff.push({ id: 'sa', staff_code: 'A-ONLY', full_name: 'A', email: null, phone: null, primary_location_code: 'brisbane', can_sell_at_locations: [], is_active: true, created_at: '', updated_at: '' });
    b.staff.push({ id: 'sb', staff_code: 'B-ONLY', full_name: 'B', email: null, phone: null, primary_location_code: 'sydney', can_sell_at_locations: [], is_active: true, created_at: '', updated_at: '' });
    c.staff.push({ id: 'sc', staff_code: 'C-ONLY', full_name: 'C', email: null, phone: null, primary_location_code: 'melbourne', can_sell_at_locations: [], is_active: true, created_at: '', updated_at: '' });

    // Re-fetch to ensure persistence, and verify cross-workspace blindness
    expect(makeStore('ws-alpha').staff.find((s) => s.staff_code === 'A-ONLY')).toBeDefined();
    expect(makeStore('ws-alpha').staff.find((s) => s.staff_code === 'B-ONLY')).toBeUndefined();
    expect(makeStore('ws-alpha').staff.find((s) => s.staff_code === 'C-ONLY')).toBeUndefined();

    expect(makeStore('ws-beta').staff.find((s) => s.staff_code === 'B-ONLY')).toBeDefined();
    expect(makeStore('ws-beta').staff.find((s) => s.staff_code === 'A-ONLY')).toBeUndefined();
    expect(makeStore('ws-beta').staff.find((s) => s.staff_code === 'C-ONLY')).toBeUndefined();

    expect(makeStore('ws-gamma').staff.find((s) => s.staff_code === 'C-ONLY')).toBeDefined();
    expect(makeStore('ws-gamma').staff.find((s) => s.staff_code === 'A-ONLY')).toBeUndefined();
    expect(makeStore('ws-gamma').staff.find((s) => s.staff_code === 'B-ONLY')).toBeUndefined();
  });

  it('interleaved writes across two workspaces never bleed data', () => {
    // Simulate interleaved operations: WS-A writes, WS-B reads, WS-A writes more, WS-B reads again
    const a = makeStore('ws-interleave-a');
    const b = makeStore('ws-interleave-b');

    // WS-A seeds a private terminal
    a.terminals.push({ id: 't-a-1', terminal_id: 'TERM-A-PRIVATE', location_code: 'brisbane', terminal_type: 'counter', is_active: true, merchant_id: null, last_ping_at: null });

    // WS-B reads — should not see WS-A's terminal
    expect(b.terminals.find((t) => t.terminal_id === 'TERM-A-PRIVATE')).toBeUndefined();

    // WS-B seeds its own terminal
    b.terminals.push({ id: 't-b-1', terminal_id: 'TERM-B-PRIVATE', location_code: 'sydney', terminal_type: 'virtual', is_active: true, merchant_id: null, last_ping_at: null });

    // WS-A reads — should not see WS-B's terminal
    expect(makeStore('ws-interleave-a').terminals.find((t) => t.terminal_id === 'TERM-B-PRIVATE')).toBeUndefined();
    // WS-A still has its own
    expect(makeStore('ws-interleave-a').terminals.find((t) => t.terminal_id === 'TERM-A-PRIVATE')).toBeDefined();
  });
});
