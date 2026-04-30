import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';

const DEFAULT_TAX_RATE = 0.1;
const DEFAULT_TAX_NAME = 'GST';
const DEFAULT_QUOTE_VALIDITY_DAYS = 30;

function parseTaxRate(raw: string | undefined): number {
  if (!raw) return DEFAULT_TAX_RATE;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_TAX_RATE;
  }

  return parsed > 1 ? parsed / 100 : parsed;
}

function parseQuoteValidityDays(raw: string | undefined): number {
  if (!raw) return DEFAULT_QUOTE_VALIDITY_DAYS;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_QUOTE_VALIDITY_DAYS;
  }

  return parsed;
}

export async function GET(request: NextRequest) {
  await requireAuthScope(request);

  return NextResponse.json({
    taxRate: parseTaxRate(process.env.BUSINESS_TAX_RATE),
    taxName: process.env.BUSINESS_TAX_NAME?.trim() || DEFAULT_TAX_NAME,
    quoteValidityDays: parseQuoteValidityDays(process.env.BUSINESS_QUOTE_VALIDITY_DAYS),
  });
}
