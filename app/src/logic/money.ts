/** Money helpers. All amounts are integer US$ cents. */

const usd = new Intl.NumberFormat('en-SG', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 150 -> "US$1.50" */
export function formatCents(cents: number): string {
  // en-SG renders USD as "US$1.50"
  return usd.format(cents / 100);
}

/** Unit prices can be fractional cents after division, so keep 3 decimals when needed. */
export function formatUnitCents(cents: number): string {
  if (Number.isInteger(cents)) return formatCents(cents);
  const fmt = new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  });
  return fmt.format(cents / 100);
}

/** Round half up to the nearest cent (used for fee and GST). */
export function roundCents(value: number): number {
  return Math.round(value + Number.EPSILON);
}

/** 0.4733 -> "47%" */
export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}
