export function formatLKR(amount: number, fractionDigits: 0 | 2 = 2): string {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount);
}

/** Whole rupees — used on public event landing ticket prices */
export function formatLKRWhole(amount: number): string {
  return formatLKR(amount, 0);
}

/**
 * Buyer handling fee in LKR, matching server cents rounding:
 * round(ticketTotalCents * pct / 100) / 100
 */
export function computeBuyerHandlingFeeLkr(ticketTotalLkr: number, feePct: number): number {
  const pct = Number.isFinite(feePct) ? Math.min(100, Math.max(0, feePct)) : 0;
  if (pct <= 0 || ticketTotalLkr <= 0) return 0;
  const ticketCents = Math.round(ticketTotalLkr * 100);
  const feeCents = Math.round((ticketCents * pct) / 100);
  return feeCents / 100;
}

