export type AdvanceStatus = 'open' | 'drawn' | 'due' | 'overdue' | 'repaid' | 'closed';

export function computeAdvanceBalance(principal: number, repaid: number) {
  return Math.max(0, principal - repaid);
}

export function deriveAdvanceStatus(input: {
  principalAmount: number;
  repaidAmount: number;
  maturityDate: Date;
  status?: string;
  now?: Date;
}): AdvanceStatus {
  const now = input.now ?? new Date();
  const balance = computeAdvanceBalance(input.principalAmount, input.repaidAmount);

  if (balance <= 0.005) return 'repaid';
  if (input.status === 'closed') return 'closed';

  const maturityEnd = new Date(input.maturityDate);
  maturityEnd.setHours(23, 59, 59, 999);

  if (now.getTime() > maturityEnd.getTime()) return 'overdue';

  const daysToMaturity = (maturityEnd.getTime() - now.getTime()) / 86400000;
  if (daysToMaturity <= 14) return 'due';

  return input.repaidAmount > 0 ? 'drawn' : 'open';
}

export type LcStatus =
  | 'issued'
  | 'amended'
  | 'presented'
  | 'accepted'
  | 'paid'
  | 'expired'
  | 'cancelled';

export function deriveLcStatus(input: {
  status: string;
  expiryDate: Date;
  now?: Date;
}): LcStatus {
  const now = input.now ?? new Date();
  if (input.status === 'cancelled' || input.status === 'paid') {
    return input.status as LcStatus;
  }
  const expiryEnd = new Date(input.expiryDate);
  expiryEnd.setHours(23, 59, 59, 999);
  if (now.getTime() > expiryEnd.getTime() && input.status !== 'accepted') {
    return 'expired';
  }
  return (input.status as LcStatus) || 'issued';
}
