/** Compact currency for chart axes (e.g. LKR 293K). */
export function formatLKRCompact(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `LKR ${(amount / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `LKR ${(amount / 1_000).toFixed(0)}K`;
  return `LKR ${Math.round(amount)}`;
}
