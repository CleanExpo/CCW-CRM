import { NextResponse } from 'next/server';
import { PAYMENT_METHOD_TYPES } from '@/lib/billing/workspace-billing';

export async function GET() {
  return NextResponse.json({
    payment_method_types: PAYMENT_METHOD_TYPES,
    card_brands: ['visa', 'mastercard', 'amex'],
  });
}
