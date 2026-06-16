import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_MODEL = 'gpt-4o-mini';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_RETRIES = 2;
const MAX_SUGGESTIONS = 4;

type ParsedQuotePreview = {
  customer?: string;
  products?: Array<{ name?: string; quantity?: number; price?: number }>;
  total?: number;
  ready?: boolean;
};

type NormalizedQuotePreview = {
  customer: string | null;
  products: Array<{ name: string; quantity: number; price: number }>;
  total: number;
  ready: boolean;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestOpenAiWithRetry(apiKey: string, payload: Record<string, unknown>) {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;
      // Retry transient network/socket/timeout failures.
      if (attempt < MAX_RETRIES) {
        await sleep(400 * (attempt + 1));
        continue;
      }
    }
  }

  throw lastError;
}

function normalizeSuggestions(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is { label: unknown; action: unknown } => {
      return !!item && typeof item === 'object' && 'label' in item && 'action' in item;
    })
    .map((item) => ({
      label: String(item.label).trim().slice(0, 80),
      action: String(item.action).trim().slice(0, 80),
    }))
    .filter((item) => item.label.length > 0 && item.action.length > 0)
    .slice(0, MAX_SUGGESTIONS);
}

function normalizeQuotePreview(value: ParsedQuotePreview | undefined): NormalizedQuotePreview | null {
  if (!value || typeof value !== 'object') return null;

  const customer =
    typeof value.customer === 'string' && value.customer.trim().length > 0
      ? value.customer.trim()
      : null;

  const products = Array.isArray(value.products)
    ? value.products
        .map((product) => {
          const name = typeof product.name === 'string' ? product.name.trim() : '';
          const quantity = Number(product.quantity);
          const price = Number(product.price);
          if (!name || !Number.isFinite(quantity) || !Number.isFinite(price)) return null;
          if (quantity <= 0 || price < 0) return null;
          return {
            name,
            quantity,
            price,
          };
        })
        .filter((product): product is { name: string; quantity: number; price: number } => product !== null)
    : [];

  const total = products.reduce((sum, product) => sum + product.quantity * product.price, 0);
  const ready = value.ready === true && Boolean(customer) && products.length > 0 && total > 0;

  return {
    customer,
    products,
    total: Math.round(total * 100) / 100,
    ready,
  };
}

/**
 * Quote Copilot — conversational assistant for building quotes.
 * Requires OPENAI_API_KEY in server environment.
 */
export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { detail: 'OPENAI_API_KEY is not configured on the server.' },
      { status: 503 }
    );
  }

  let body: {
    session_id?: string;
    message?: string;
    context?: { conversation_history?: unknown[] };
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: 'Invalid JSON body' }, { status: 400 });
  }

  const message = String(body.message ?? '').trim();
  if (!message) {
    return NextResponse.json({ detail: 'message is required' }, { status: 400 });
  }

  const model = process.env.OPENAI_QUOTE_COPILOT_MODEL?.trim() || DEFAULT_MODEL;

  const system = `You are Quote Copilot for CCW Online, an industrial cleaning equipment supplier. Help users build sales quotes through short, clear messages. Ask one focused question when something is missing.

Respond with a single JSON object only (no markdown code fences), using this exact shape:
{
  "message": "Your reply to the user (you may use **bold** in this string)",
  "suggestions": [{"label": "short label", "action": "internal_action_id"}],
  "quote_preview": null OR {
    "customer": "company or person name or null",
    "products": [{"name": "product name", "quantity": 1, "price": 0}],
    "total": 0,
    "ready": false
  },
  "action": null OR "create_quote"
}

Rules:
- Set quote_preview.ready to true only when you know the customer and at least one product with quantity and unit price.
- products[].price is unit price (AUD).
- total should equal sum of quantity * price for all products when ready.
- Use action "create_quote" only when quote_preview.ready is true.
- suggestions: 0–4 items; actions like list_customers, new_customer are fine.`;

  const history = Array.isArray(body.context?.conversation_history)
    ? body.context!.conversation_history!.slice(-5)
    : [];

  const transcript = history
    .map((m: unknown) => {
      const msg = m as { role?: string; content?: string };
      return `${msg.role ?? 'user'}: ${msg.content ?? ''}`;
    })
    .join('\n');

  const userContent = transcript ? `${transcript}\nuser: ${message}` : `user: ${message}`;

  try {
    const res = await requestOpenAiWithRetry(apiKey, {
      model,
      temperature: 0.45,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userContent },
      ],
      response_format: { type: 'json_object' },
    });

    if (!res.ok) {
      await res.text().catch(() => '');
      console.error('OpenAI quote copilot error', res.status);
      return NextResponse.json(
        { detail: `Assistant request failed (${res.status}).` },
        { status: 502 }
      );
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ detail: 'Empty assistant response' }, { status: 502 });
    }

    let parsed: {
      message?: string;
      suggestions?: unknown;
      quote_preview?: ParsedQuotePreview;
      action?: string;
    };
    try {
      parsed = JSON.parse(content) as typeof parsed;
    } catch {
      return NextResponse.json({ detail: 'Assistant returned invalid JSON.' }, { status: 502 });
    }

    const quotePreview = normalizeQuotePreview(parsed.quote_preview);
    const action = parsed.action === 'create_quote' && quotePreview?.ready ? 'create_quote' : null;

    return NextResponse.json({
      message:
        typeof parsed.message === 'string' && parsed.message.length > 0
          ? parsed.message
          : 'Could you tell me which customer this quote is for?',
      suggestions: normalizeSuggestions(parsed.suggestions),
      quote_preview: quotePreview,
      action,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('OpenAI quote copilot network error:', msg);
    return NextResponse.json(
      {
        detail:
          'Could not reach the AI provider right now. Please retry in a few seconds.',
      },
      { status: 502 }
    );
  }
}
