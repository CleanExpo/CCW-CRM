/**
 * UNI-2107: Cross-tenant POS store isolation tests.
 *
 * These tests verify that two distinct orgs (users) cannot read each other's
 * POS data through the mock store. They operate purely on in-process store
 * logic using relative imports — no alias resolution needed.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getPosStore, _resetAllPosStores } from '../mock-store';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStore(userId: string) {
  return getPosStore(userId);
}

// ---------------------------------------------------------------------------
// Store isolation tests
// ---------------------------------------------------------------------------

describe('POS mock-store: per-org isolation', () => {
  beforeEach(() => {
    _resetAllPosStores();
  });

  it('seeds each org with its own independent data', () => {
    const orgA = makeStore('user-org-a');
    const orgB = makeStore('user-org-b');

    // Both start with the same seed, but are independent objects
    expect(orgA).not.toBe(orgB);
    expect(orgA.locations).not.toBe(orgB.locations);
    expect(orgA.staff).not.toBe(orgB.staff);
    expect(orgA.terminals).not.toBe(orgB.terminals);
  });

  it('mutations in org A do NOT appear in org B (locations)', () => {
    const orgA = makeStore('user-org-a');
    const orgB = makeStore('user-org-b');

    const initialBCount = orgB.locations.length;

    // Mutate org A
    orgA.locations.push({
      id: 'test-loc-id',
      code: 'secret-site',
      name: 'Secret Site — Org A only',
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

    // Org B must be unchanged
    expect(orgB.locations.length).toBe(initialBCount);
    expect(orgB.locations.find((l) => l.code === 'secret-site')).toBeUndefined();
  });

  it('mutations in org A do NOT appear in org B (staff)', () => {
    const orgA = makeStore('user-org-a');
    const orgB = makeStore('user-org-b');

    const initialBCount = orgB.staff.length;

    orgA.staff.push({
      id: 'staff-secret-id',
      staff_code: 'SECRET',
      full_name: 'Org A Secret Employee',
      email: null,
      phone: null,
      primary_location_code: 'brisbane',
      can_sell_at_locations: ['brisbane'],
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    expect(orgB.staff.length).toBe(initialBCount);
    expect(orgB.staff.find((s) => s.staff_code === 'SECRET')).toBeUndefined();
  });

  it('mutations in org A do NOT appear in org B (terminals)', () => {
    const orgA = makeStore('user-org-a');
    const orgB = makeStore('user-org-b');

    const initialBCount = orgB.terminals.length;

    orgA.terminals.push({
      id: 'term-secret-id',
      terminal_id: 'TERM-SECRET-01',
      location_code: 'brisbane',
      terminal_type: 'counter',
      is_active: true,
      merchant_id: null,
      last_ping_at: null,
    });

    expect(orgB.terminals.length).toBe(initialBCount);
    expect(orgB.terminals.find((t) => t.terminal_id === 'TERM-SECRET-01')).toBeUndefined();
  });

  it('deletions in org A do NOT affect org B (locations)', () => {
    const orgA = makeStore('user-org-a');
    const orgB = makeStore('user-org-b');

    const brisbaneInB = orgB.locations.find((l) => l.code === 'brisbane');
    expect(brisbaneInB).toBeDefined();

    // Delete all of org A's locations
    orgA.locations.splice(0, orgA.locations.length);
    expect(orgA.locations).toHaveLength(0);

    // Org B still has its Brisbane location
    const stillThere = orgB.locations.find((l) => l.code === 'brisbane');
    expect(stillThere).toBeDefined();
  });

  it('same userId always returns the same store instance', () => {
    const first = makeStore('user-stable');
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

    const second = makeStore('user-stable');
    expect(second.locations.find((l) => l.code === 'marker')).toBeDefined();
  });

  it('three concurrent orgs all remain isolated', () => {
    const a = makeStore('org-a');
    const b = makeStore('org-b');
    const c = makeStore('org-c');

    // Add unique staff to each
    a.staff.push({ id: 'sa', staff_code: 'A-ONLY', full_name: 'A', email: null, phone: null, primary_location_code: 'brisbane', can_sell_at_locations: [], is_active: true, created_at: '', updated_at: '' });
    b.staff.push({ id: 'sb', staff_code: 'B-ONLY', full_name: 'B', email: null, phone: null, primary_location_code: 'sydney', can_sell_at_locations: [], is_active: true, created_at: '', updated_at: '' });
    c.staff.push({ id: 'sc', staff_code: 'C-ONLY', full_name: 'C', email: null, phone: null, primary_location_code: 'melbourne', can_sell_at_locations: [], is_active: true, created_at: '', updated_at: '' });

    // Re-fetch to ensure persistence, and verify cross-org blindness
    expect(makeStore('org-a').staff.find((s) => s.staff_code === 'A-ONLY')).toBeDefined();
    expect(makeStore('org-a').staff.find((s) => s.staff_code === 'B-ONLY')).toBeUndefined();
    expect(makeStore('org-a').staff.find((s) => s.staff_code === 'C-ONLY')).toBeUndefined();

    expect(makeStore('org-b').staff.find((s) => s.staff_code === 'B-ONLY')).toBeDefined();
    expect(makeStore('org-b').staff.find((s) => s.staff_code === 'A-ONLY')).toBeUndefined();
    expect(makeStore('org-b').staff.find((s) => s.staff_code === 'C-ONLY')).toBeUndefined();

    expect(makeStore('org-c').staff.find((s) => s.staff_code === 'C-ONLY')).toBeDefined();
    expect(makeStore('org-c').staff.find((s) => s.staff_code === 'A-ONLY')).toBeUndefined();
    expect(makeStore('org-c').staff.find((s) => s.staff_code === 'B-ONLY')).toBeUndefined();
  });

  it('interleaved writes across two orgs never bleed data', () => {
    // Simulate interleaved operations: A writes, B reads, A writes more, B reads again
    const a = makeStore('org-interleave-a');
    const b = makeStore('org-interleave-b');

    // A seeds a private terminal
    a.terminals.push({ id: 't-a-1', terminal_id: 'TERM-A-PRIVATE', location_code: 'brisbane', terminal_type: 'counter', is_active: true, merchant_id: null, last_ping_at: null });

    // B reads — should not see A's terminal
    expect(b.terminals.find((t) => t.terminal_id === 'TERM-A-PRIVATE')).toBeUndefined();

    // B seeds its own terminal
    b.terminals.push({ id: 't-b-1', terminal_id: 'TERM-B-PRIVATE', location_code: 'sydney', terminal_type: 'virtual', is_active: true, merchant_id: null, last_ping_at: null });

    // A reads — should not see B's terminal
    expect(makeStore('org-interleave-a').terminals.find((t) => t.terminal_id === 'TERM-B-PRIVATE')).toBeUndefined();
    // A still has its own
    expect(makeStore('org-interleave-a').terminals.find((t) => t.terminal_id === 'TERM-A-PRIVATE')).toBeDefined();
  });
});
