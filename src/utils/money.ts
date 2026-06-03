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

