import type { Phase2AreaReport } from '@/lib/phase2/types';

export function evidenceCsv(report: Phase2AreaReport): string {
  const header = 'area,as_of,classification,sku,warehouse,document,cin7,optix,difference,note';
  const rows = report.sample.map((row) =>
    [
      report.area,
      report.as_of,
      row.classification,
      csvCell(row.sku),
      csvCell(row.warehouse),
      csvCell(row.document),
      row.cin7,
      row.optix,
      row.difference,
      csvCell(row.note),
    ].join(',')
  );
  return [header, ...rows].join('\n');
}

function csvCell(value: string | undefined): string {
  const raw = value ?? '';
  if (/[",\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}
