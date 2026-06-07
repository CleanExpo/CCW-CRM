export type TaxLineInput = {
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate?: number;
};

export type TaxLineResult = {
  description: string;
  quantity: number;
  unit_price: number;
  line_subtotal: number;
  tax_rate: number;
  tax_amount: number;
  line_total: number;
};

export type TaxCalculationResult = {
  lines: TaxLineResult[];
  subtotal: number;
  tax_total: number;
  total: number;
};

export function calculateInvoiceTax(
  lines: TaxLineInput[],
  defaultTaxRate = 10
): TaxCalculationResult {
  const computed: TaxLineResult[] = lines.map((line) => {
    const qty = Math.max(0, Number(line.quantity) || 0);
    const unitPrice = Math.max(0, Number(line.unit_price) || 0);
    const lineSubtotal = qty * unitPrice;
    const taxRate = Number(line.tax_rate ?? defaultTaxRate);
    const taxAmount = lineSubtotal * (taxRate / 100);
    return {
      description: line.description,
      quantity: qty,
      unit_price: unitPrice,
      line_subtotal: lineSubtotal,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      line_total: lineSubtotal + taxAmount,
    };
  });

  const subtotal = computed.reduce((s, l) => s + l.line_subtotal, 0);
  const taxTotal = computed.reduce((s, l) => s + l.tax_amount, 0);

  return {
    lines: computed,
    subtotal,
    tax_total: taxTotal,
    total: subtotal + taxTotal,
  };
}
