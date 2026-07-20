import { requireAuthScope } from '@/lib/auth/data-scope';
import {
  buildCin7ExceptionReport,
  type Cin7ExceptionEntity,
  type Cin7ExceptionRecord,
} from '@/lib/integrations/cin7-reconciliation';
import { NextRequest, NextResponse } from 'next/server';

const ENTITIES: Cin7ExceptionEntity[] = [
  'products',
  'customers',
  'suppliers',
  'branches',
  'internal-customers',
  'product-categories',
  'brands',
  'price-lists',
  'tax-codes',
  'units-of-measure',
  'stock-levels',
  'warehouses',
];

export const maxDuration = 300;

function toCsv(items: Cin7ExceptionRecord[]): string {
  const header = 'cin7_id,label,reason,fields,skipped_reason';
  const rows = items.map((row) => {
    const fields =
      row.fields?.map((f) => `${f.field}:${f.cin7_value}->${f.optix_value}`).join('; ') ?? '';
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
    return [
      escape(row.cin7_id),
      escape(row.label),
      escape(row.reason),
      escape(fields),
      escape(row.skipped_reason ?? ''),
    ].join(',');
  });
  return [header, ...rows].join('\n');
}

export async function GET(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const entity = request.nextUrl.searchParams.get('entity') as Cin7ExceptionEntity | null;
  if (!entity || !ENTITIES.includes(entity)) {
    return NextResponse.json(
      { detail: `entity is required (${ENTITIES.join(', ')})` },
      { status: 400 }
    );
  }

  const limit = Math.min(
    Math.max(Number(request.nextUrl.searchParams.get('limit')) || 100, 1),
    2_000
  );
  const offset = Math.max(Number(request.nextUrl.searchParams.get('offset')) || 0, 0);
  const format = request.nextUrl.searchParams.get('format')?.toLowerCase();

  try {
    const report = await buildCin7ExceptionReport(scope.userId, entity, limit, offset);

    if (format === 'csv') {
      const csv = toCsv(report.items);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="cin7-exceptions-${entity}.csv"`,
        },
      });
    }

    return NextResponse.json(report);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Exception report failed';
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
