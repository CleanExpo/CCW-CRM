import { describe, expect, it } from 'vitest';

import {
  CCW_ROADSHOW_BOOKING_URL,
  CCW_ROADSHOW_DISTRIBUTION_EMAIL,
  CCW_ROADSHOW_OWNER_EMAIL,
  buildCcwRoadshowReadiness,
  ccwRoadshowEventSeeds,
  ccwRoadshowInternalDrafts,
  ccwRoadshowTrustedSources,
  defaultCcwRoadshowComplianceState,
  normaliseCcwRoadshowComplianceState,
} from '../roadshow-campaign';

describe('CARSI x CCW roadshow campaign gate', () => {
  it('hard-codes the approved booking URL and internal recipients', () => {
    expect(CCW_ROADSHOW_BOOKING_URL).toBe('https://www.carsi.com.au/events/ccw-roadshow');
    expect(CCW_ROADSHOW_OWNER_EMAIL).toBe('toby.b@ccwarehouse.com.au');
    expect(CCW_ROADSHOW_DISTRIBUTION_EMAIL).toBe('annef@ccwarehouse.com.au');
    expect(ccwRoadshowInternalDrafts.map((draft) => draft.recipient_ref)).toEqual([
      'toby.b@ccwarehouse.com.au',
      'annef@ccwarehouse.com.au',
    ]);
  });

  it('seeds both roadshow city records and the approved knowledge sources', () => {
    expect(ccwRoadshowEventSeeds.map((event) => event.slug)).toEqual(['melbourne', 'sydney']);
    expect(ccwRoadshowEventSeeds[0].venue).toContain('Bayswater North');
    expect(ccwRoadshowEventSeeds[1].venue).toContain('Seven Hills');
    expect(ccwRoadshowTrustedSources.map((source) => source.url)).toContain(
      'https://www.carsi.com.au/events/ccw-roadshow'
    );
  });

  it('blocks client-list send until compliance and approval gates are confirmed', () => {
    const readiness = buildCcwRoadshowReadiness({
      saved_events: ccwRoadshowEventSeeds.length,
      internal_test_drafts: ccwRoadshowInternalDrafts.length,
      trusted_sources: ccwRoadshowTrustedSources.length,
    });

    expect(readiness.ready_for_client_list_send).toBe(false);
    expect(readiness.items.find((item) => item.key === 'consent_basis')?.ready).toBe(false);
    expect(readiness.items.find((item) => item.key === 'final_approval')?.ready).toBe(false);
  });

  it('only marks the campaign send-ready when every hard gate is green', () => {
    const readiness = buildCcwRoadshowReadiness({
      saved_events: ccwRoadshowEventSeeds.length,
      internal_test_drafts: ccwRoadshowInternalDrafts.length,
      trusted_sources: ccwRoadshowTrustedSources.length,
      client_list_source_confirmed: true,
      consent_basis_confirmed: true,
      suppression_rules_confirmed: true,
      unsubscribe_url_confirmed: true,
      sender_footer_confirmed: true,
      seat_capacity_confirmed: true,
      final_approval_confirmed: true,
    });

    expect(readiness.ready_for_client_list_send).toBe(true);
    expect(readiness.ready_count).toBe(readiness.total_count);
  });

  it('normalises missing persisted compliance state to blocked gates', () => {
    const state = normaliseCcwRoadshowComplianceState(null);

    expect(state).toEqual(defaultCcwRoadshowComplianceState());
    expect(
      buildCcwRoadshowReadiness({
        saved_events: ccwRoadshowEventSeeds.length,
        internal_test_drafts: ccwRoadshowInternalDrafts.length,
        trusted_sources: ccwRoadshowTrustedSources.length,
        ...state,
      }).ready_for_client_list_send
    ).toBe(false);
  });

  it('keeps saved compliance confirmations and notes when reading persisted state', () => {
    const state = normaliseCcwRoadshowComplianceState({
      client_list_source_confirmed: 'true',
      consent_basis_confirmed: true,
      suppression_rules_confirmed: true,
      unsubscribe_url_confirmed: true,
      sender_footer_confirmed: true,
      seat_capacity_confirmed: true,
      final_approval_confirmed: false,
      notes: 'CCW Shopify export checked, suppression count recorded.',
      updated_by: 'user-1',
      updated_at: '2026-06-17T04:00:00.000Z',
    });

    expect(state.client_list_source_confirmed).toBe(true);
    expect(state.final_approval_confirmed).toBe(false);
    expect(state.notes).toContain('suppression count');
  });
});
