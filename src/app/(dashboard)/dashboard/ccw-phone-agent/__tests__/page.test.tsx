import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import CcwPhoneAgentPage from '../page';

const fetchMock = vi.fn();

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

const CONFIG = {
  status: 'draft',
  effective_safety: {
    approved_knowledge_only: true,
    outbound_ai_calling_enabled: false,
    call_recording_enabled: false,
    recording_requested: false,
    outbound_requested: false,
    human_handoff_required_for: [],
  },
  pilot_status: {
    ready_for_inbound_pilot: false,
    mode: 'pilot',
    provider_config: {
      missing_env: [],
      webhook_urls: { twilio_voice_url: null, elevenlabs_callback_url: null },
    },
  },
};

/** Every read succeeds: config plus empty lists. */
function allEmpty() {
  fetchMock.mockImplementation(async (url: string) =>
    url.startsWith('/api/phone-agent/config') ? jsonResponse(CONFIG) : jsonResponse({ items: [] })
  );
}

describe('CcwPhoneAgentPage load failure', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows an error state, not zero counts and "No calls captured yet.", when the load fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    render(<CcwPhoneAgentPage />);

    expect(await screen.findByText("Couldn't load phone agent data")).toBeInTheDocument();
    expect(screen.queryByText('No calls captured yet.')).not.toBeInTheDocument();
    expect(screen.queryByText('0 conversations captured.')).not.toBeInTheDocument();
    expect(screen.queryByText('Draft Follow-Ups')).not.toBeInTheDocument();
  });

  it('still shows the genuine empty state when every read succeeds with no rows', async () => {
    allEmpty();

    render(<CcwPhoneAgentPage />);

    expect(await screen.findByText('No calls captured yet.')).toBeInTheDocument();
    expect(screen.getByText('0 conversations captured.')).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load phone agent data")).not.toBeInTheDocument();
  });

  it('re-runs the load when Retry is pressed', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    render(<CcwPhoneAgentPage />);
    await screen.findByText("Couldn't load phone agent data");
    const callsBefore = fetchMock.mock.calls.length;

    allEmpty();
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore));
    expect(await screen.findByText('No calls captured yet.')).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load phone agent data")).not.toBeInTheDocument();
  });
});
