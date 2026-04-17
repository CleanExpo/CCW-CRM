/**
 * Shared JSON responses and body parsing for `/api/auth/*` Route Handlers.
 * Keeps response shapes consistent (`detail` for errors, optional `errors` for Zod).
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { ZodError } from 'zod';

export async function readJsonBody(
  request: NextRequest
): Promise<{ ok: true; body: unknown } | { ok: false; response: NextResponse }> {
  try {
    const body: unknown = await request.json();
    return { ok: true, body };
  } catch {
    return { ok: false, response: jsonDetail('Invalid JSON body', 400) };
  }
}

export function jsonDetail(
  detail: string,
  status: number,
  extra?: Record<string, unknown>
): NextResponse {
  return NextResponse.json(extra ? { detail, ...extra } : { detail }, { status });
}

export function jsonValidationError(zodError: ZodError): NextResponse {
  return NextResponse.json(
    {
      detail: 'Validation failed',
      errors: zodError.flatten().fieldErrors,
    },
    { status: 422 }
  );
}

export function jsonOk(data: unknown, init?: { status?: number }): NextResponse {
  return NextResponse.json(data, { status: init?.status ?? 200 });
}
