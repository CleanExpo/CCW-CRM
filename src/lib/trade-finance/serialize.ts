import { computeAdvanceBalance, deriveAdvanceStatus, deriveLcStatus } from '@/lib/trade-finance/status';

export function serializeAdvance(row: {
  id: string;
  advanceNumber: string;
  principalAmount: number;
  repaidAmount: number;
  drawdownDate: Date;
  maturityDate: Date;
  fees: number;
  interest: number;
  currency: string;
  status: string;
  securityRef: string | null;
  supplier?: { companyName: string } | null;
  purchaseOrder?: { poNumber: string } | null;
  letterOfCredit?: { lcNumber: string } | null;
}) {
  const balance = computeAdvanceBalance(row.principalAmount, row.repaidAmount);
  const status = deriveAdvanceStatus({
    principalAmount: row.principalAmount,
    repaidAmount: row.repaidAmount,
    maturityDate: row.maturityDate,
    status: row.status,
  });

  return {
    id: row.id,
    advance_number: row.advanceNumber,
    supplier: row.supplier?.companyName ?? null,
    shipment: row.purchaseOrder?.poNumber ?? null,
    lc_number: row.letterOfCredit?.lcNumber ?? null,
    drawn: row.principalAmount,
    repaid: row.repaidAmount,
    balance,
    fees: row.fees,
    interest: row.interest,
    currency: row.currency,
    drawdown_date: row.drawdownDate.toISOString().slice(0, 10),
    due: row.maturityDate.toISOString().slice(0, 10),
    security_ref: row.securityRef,
    status,
  };
}

export function serializeLetterOfCredit(row: {
  id: string;
  lcNumber: string;
  bankRef: string | null;
  amount: number;
  currency: string;
  lcType: string;
  issueDate: Date;
  expiryDate: Date;
  status: string;
  notes: string | null;
  beneficiary?: { companyName: string } | null;
  purchaseOrder?: { poNumber: string } | null;
  facility?: { name: string } | null;
  _count?: { documents: number; advances: number };
}) {
  return {
    id: row.id,
    lc_number: row.lcNumber,
    bank_ref: row.bankRef,
    amount: row.amount,
    currency: row.currency,
    lc_type: row.lcType,
    issue_date: row.issueDate.toISOString().slice(0, 10),
    expiry_date: row.expiryDate.toISOString().slice(0, 10),
    status: deriveLcStatus({ status: row.status, expiryDate: row.expiryDate }),
    notes: row.notes,
    beneficiary: row.beneficiary?.companyName ?? null,
    purchase_order: row.purchaseOrder?.poNumber ?? null,
    facility: row.facility?.name ?? null,
    document_count: row._count?.documents ?? 0,
    advance_count: row._count?.advances ?? 0,
  };
}

export function serializeFacilityUtilisation(f: {
  id: string;
  provider: string;
  name: string;
  facilityLimit: number;
  currency: string;
  status: string;
  advances: Array<{ principalAmount: number; repaidAmount: number }>;
}) {
  const drawn = f.advances.reduce((s, a) => s + a.principalAmount, 0);
  const repaid = f.advances.reduce((s, a) => s + a.repaidAmount, 0);
  return {
    id: f.id,
    provider: f.provider,
    name: f.name,
    facility_limit: f.facilityLimit,
    currency: f.currency,
    status: f.status,
    drawn_total: drawn,
    repaid_total: repaid,
    outstanding: Math.max(drawn - repaid, 0),
    available: Math.max(f.facilityLimit - drawn + repaid, 0),
  };
}
