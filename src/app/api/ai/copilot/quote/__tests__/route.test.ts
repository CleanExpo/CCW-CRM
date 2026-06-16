import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';

const originalFetch = global.fetch;
const originalOpenAiKey = process.env.OPENAI_API_KEY;

function req(message = 'Create a quote for Acme') {
  return new NextRequest('http://localhost/api/ai/copilot/quote', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message }),
  });
}

function mockOpenAi(content: unknown) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify(content),
          },
        },
      ],
    }),
  } as Response);
}

describe('POST /api/ai/copilot/quote', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-openai-key';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalOpenAiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalOpenAiKey;
    }
    vi.restoreAllMocks();
  });

  it('recomputes quote totals and allows create_quote only for a ready normalized preview', async () => {
    mockOpenAi({
      message: 'Ready to create this quote.',
      suggestions: [
        { label: 'Create quote', action: 'create_quote' },
        { label: 'Review', action: 'review_quote' },
      ],
      quote_preview: {
        customer: 'Acme Cleaning',
        products: [
          { name: 'Scrubber', quantity: 2, price: 1500 },
          { name: 'Pads', quantity: 3, price: 25 },
        ],
        total: 1,
        ready: true,
      },
      action: 'create_quote',
    });

    const res = await POST(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      message: 'Ready to create this quote.',
      action: 'create_quote',
      quote_preview: {
        customer: 'Acme Cleaning',
        total: 3075,
        ready: true,
      },
    });
    expect(body.suggestions).toEqual([
      { label: 'Create quote', action: 'create_quote' },
      { label: 'Review', action: 'review_quote' },
    ]);
  });

  it('downgrades unsafe create_quote actions when the preview is incomplete', async () => {
    mockOpenAi({
      message: 'I can create that now.',
      suggestions: [
        { label: 'Create quote', action: 'create_quote' },
        { label: '', action: 'ignore_empty_label' },
        { label: 'A'.repeat(120), action: 'B'.repeat(120) },
        { label: 'Extra 1', action: 'extra_1' },
        { label: 'Extra 2', action: 'extra_2' },
        { label: 'Extra 3', action: 'extra_3' },
      ],
      quote_preview: {
        customer: '',
        products: [{ name: 'Scrubber', quantity: 1, price: 1500 }],
        total: 1500,
        ready: true,
      },
      action: 'create_quote',
    });

    const res = await POST(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.action).toBeNull();
    expect(body.quote_preview).toMatchObject({
      customer: null,
      total: 1500,
      ready: false,
    });
    expect(body.suggestions).toHaveLength(4);
    expect(body.suggestions[1].label).toHaveLength(80);
    expect(body.suggestions[1].action).toHaveLength(80);
  });

  it('rejects malformed assistant JSON as a provider failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'not-json' } }],
      }),
    } as Response);

    const res = await POST(req());

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ detail: 'Assistant returned invalid JSON.' });
  });
});

