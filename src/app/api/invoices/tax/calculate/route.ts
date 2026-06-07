import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { calculateInvoiceTax } from '@/lib/invoicing/tax-calculator';

export async function POST(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const body = (await request.json()) as {
      lines?: Array<{
        description: string;
        quantity: number;
        unit_price: number;
        tax_rate?: number;
      }>;
      default_tax_rate?: number;
    };

    if (!Array.isArray(body.lines) || body.lines.length === 0) {
      return NextResponse.json({ detail: 'lines array is required' }, { status: 400 });
    }

    const result = calculateInvoiceTax(body.lines, body.default_tax_rate ?? 10);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
