/** Reusable pieces of pool UI: status, progress, supplier badges, tier strip, cost breakdown. */
import { GST_RATE, SERVICE_FEE_RATE } from '../logic/config';
import { formatCents, formatPercent, formatUnitCents } from '../logic/money';
import type { CostBreakdown } from '../logic/pool';
import { getJoinedQty, getStatus } from '../logic/pool';
import type { Pool, PoolStatus, PriceTier, Supplier } from '../logic/types';
import { CheckIcon, ClockIcon, ShieldIcon, UndoIcon } from './Icons';

/* ---------- Status ---------- */

const STATUS_STYLE: Record<PoolStatus, { label: string; cls: string; Icon: typeof CheckIcon }> = {
  filling: { label: 'Filling', cls: 'bg-warn-tint text-warn ring-warn-line', Icon: ClockIcon },
  confirmed: { label: 'Confirmed', cls: 'bg-success-tint text-success ring-success-line', Icon: CheckIcon },
  refunded: { label: 'Refunded', cls: 'bg-raised text-[#D3D7DF] ring-line-strong', Icon: UndoIcon },
};

/** Status is always a text label plus an icon, never colour alone (WCAG 1.4.1). */
export function StatusBadge({ status, size = 'md' }: { status: PoolStatus; size?: 'sm' | 'md' }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md font-semibold ring-1 ring-inset ${s.cls} ${
        size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-sm'
      }`}
    >
      <s.Icon width={size === 'sm' ? 12 : 14} height={size === 'sm' ? 12 : 14} />
      {s.label}
    </span>
  );
}

/* ---------- Progress ---------- */

export function ProgressBar({ pool, compact = false }: { pool: Pool; compact?: boolean }) {
  const joined = getJoinedQty(pool);
  const pct = Math.min(100, Math.round((joined / pool.target) * 100));
  const status = getStatus(pool);
  const fill = status === 'refunded' ? 'bg-line-strong' : status === 'confirmed' ? 'bg-success-solid' : 'bg-gradient-to-r from-accent to-primary';
  return (
    <div>
      <div className={`flex items-baseline justify-between ${compact ? 'text-xs' : 'text-sm'}`}>
        <span className="font-semibold tabular-nums text-ink">
          {joined.toLocaleString()} / {pool.target.toLocaleString()} <span className="font-normal text-muted">units</span>
        </span>
        <span className="tabular-nums text-muted">{pct}% filled</span>
      </div>
      <div
        role="progressbar"
        aria-label={`${joined} of ${pool.target} units filled`}
        aria-valuemin={0}
        aria-valuemax={pool.target}
        aria-valuenow={Math.min(joined, pool.target)}
        className={`mt-1.5 w-full overflow-hidden rounded-full bg-line ${compact ? 'h-1.5' : 'h-2.5'}`}
      >
        <div className={`h-full rounded-full ${fill} transition-[width] duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ---------- Supplier ---------- */

export function SupplierBadges({ supplier }: { supplier: Supplier }) {
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {supplier.verified ? (
        <span className="inline-flex items-center gap-1 rounded bg-success-tint px-1.5 py-0.5 text-xs font-semibold text-success">
          <CheckIcon width={12} height={12} /> Verified supplier
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 rounded bg-raised px-1.5 py-0.5 text-xs font-semibold text-muted">Not verified</span>
      )}
      {supplier.tradeAssurance && (
        <span className="inline-flex items-center gap-1 rounded bg-primary-tint px-1.5 py-0.5 text-xs font-semibold text-primary">
          <ShieldIcon width={12} height={12} /> Trade Assurance
        </span>
      )}
    </span>
  );
}

/* ---------- Tiers (horizontal strip, like a marketplace listing) ---------- */

export function TierStrip({
  tiers,
  activeMinQty,
  targetMinQty,
  caption,
}: {
  tiers: PriceTier[];
  activeMinQty: number;
  targetMinQty: number;
  caption: string;
}) {
  return (
    <ul aria-label={caption} className="grid overflow-hidden rounded-md border border-line" style={{ gridTemplateColumns: `repeat(${tiers.length}, minmax(0, 1fr))` }}>
      {tiers.map((t, i) => {
        const next = tiers.at(i + 1);
        const range = next ? `${t.minQty.toLocaleString()}–${(next.minQty - 1).toLocaleString()} units` : `${t.minQty.toLocaleString()}+ units`;
        const active = t.minQty === activeMinQty;
        const isTarget = t.minQty === targetMinQty;
        return (
          <li
            key={t.minQty}
            className={`relative px-3 py-2.5 ${i > 0 ? 'border-l border-line' : ''} ${active ? 'bg-primary-tint shadow-[inset_0_0_0_2px_#FF8A3D]' : 'bg-surface'}`}
          >
            <span className="block text-xs text-muted">{range}</span>
            <span className={`block text-lg font-bold tabular-nums ${active ? 'text-primary' : 'text-ink'}`}>{formatCents(t.unitPriceCents)}</span>
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-primary">
              {active ? 'Pool price now' : isTarget ? 'Pool target' : <span className="text-muted">{i === 0 ? 'Buying alone' : 'Next tier'}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- Cost breakdown ---------- */

export function CostBreakdownTable({
  breakdown,
  alone,
  saving,
  forcedMoq,
}: {
  breakdown: CostBreakdown;
  alone?: CostBreakdown | null;
  saving?: number | null;
  /** What buying alone would force: the supplier's whole minimum order. */
  forcedMoq?: CostBreakdown;
}) {
  const row = (label: string, value: string, strong = false) => (
    <tr className={strong ? 'border-t border-ink/40' : ''}>
      <th scope="row" className={`py-1.5 text-left ${strong ? 'pt-2.5 font-bold text-ink' : 'font-normal text-muted'}`}>{label}</th>
      <td className={`py-1.5 text-right tabular-nums ${strong ? 'pt-2.5 text-base font-bold text-ink' : 'text-ink'}`}>{value}</td>
    </tr>
  );
  return (
    <div>
      <table className="w-full text-sm">
        <caption className="sr-only">Full cost breakdown before joining</caption>
        <tbody>
          {row(`${breakdown.qty.toLocaleString()} units × ${formatCents(breakdown.unitPriceCents)}`, formatCents(breakdown.goodsCents))}
          {row('Shipping share (to Singapore hub, split and delivered)', formatCents(breakdown.shippingCents))}
          {row(`PoolBuy service fee (${formatPercent(SERVICE_FEE_RATE)})`, formatCents(breakdown.serviceFeeCents))}
          {row(`GST (${formatPercent(GST_RATE)})`, formatCents(breakdown.gstCents))}
          {row('Total held', formatCents(breakdown.totalCents), true)}
        </tbody>
      </table>
      <p className="mt-1 text-right text-xs text-muted">
        All-in cost per unit: <span className="font-semibold text-ink">{formatUnitCents(Math.round(breakdown.perUnitCents * 10) / 10)}</span>
      </p>
      {alone !== undefined && (
        <p className="mt-3 rounded-md border border-success-line bg-success-tint px-3 py-2 text-sm text-ink">
          {alone === null ? (
            forcedMoq ? (
              <>
                Alone, you’d have to buy at least <span className="font-semibold">{forcedMoq.qty.toLocaleString()} units</span> for{' '}
                <span className="font-semibold">{formatCents(forcedMoq.totalCents)}</span>. In the pool you buy only the{' '}
                {breakdown.qty.toLocaleString()} you need.
              </>
            ) : (
              <>Buying {breakdown.qty.toLocaleString()} alone isn’t possible: it’s below this supplier’s minimum order.</>
            )
          ) : saving !== null && saving !== undefined && saving > 0 ? (
            <>
              Buying alone would cost <span className="font-semibold">{formatCents(alone.totalCents)}</span>. You save{' '}
              <span className="font-semibold text-success">{formatPercent(saving)}</span> ({formatCents(alone.totalCents - breakdown.totalCents)}).
            </>
          ) : (
            <>This is the same price you’d get buying alone.</>
          )}
        </p>
      )}
    </div>
  );
}
