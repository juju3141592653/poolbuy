/** Screen 1: browse open pools. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckIcon, ClockIcon, LockIcon, ShieldIcon, UndoIcon, UsersIcon } from '../components/Icons';
import { ProgressBar, StatusBadge } from '../components/PoolBits';
import { ProductImage } from '../components/ProductImage';
import { statusDetail } from '../logic/format';
import { formatCents, formatPercent } from '../logic/money';
import {
  findMember,
  formatTimeLeft,
  getCurrentUnitPrice,
  getStatus,
  isClosed,
  isClosingSoon,
  rankPools,
} from '../logic/pool';
import type { Category, Pool } from '../logic/types';
import { useLookups, useStore } from '../state/context';

const CATEGORIES: (Category | 'All')[] = ['All', 'Packaging', 'Apparel', 'Accessories'];

function PoolCard({ pool }: { pool: Pool }) {
  const { now, state } = useStore();
  const { product, supplier, user } = useLookups();
  const p = product(pool.productId)!;
  const s = supplier(p.supplierId)!;
  const organiser = user(pool.organiserId);
  const status = getStatus(pool);
  const price = getCurrentUnitPrice(p, pool);
  const aloneFrom = p.tiers[0];
  const soon = isClosingSoon(pool, now);
  const mine = findMember(pool, state.currentUserId);

  return (
    <li>
      <a
        href={`#/pool/${pool.id}`}
        className="group flex h-full flex-col overflow-hidden rounded-lg border border-line bg-surface transition hover:-translate-y-0.5 hover:border-primary-soft hover:shadow-[0_10px_28px_rgba(0,0,0,0.45)]"
        data-testid={`pool-card-${pool.id}`}
      >
        <div className="relative border-b border-line">
          <ProductImage kind={p.image} className="aspect-[4/3] w-full" />
          <div className="absolute left-2.5 top-2.5"><StatusBadge status={status} size="sm" /></div>
          <div className="absolute right-2.5 top-2.5 flex flex-col items-end gap-1">
            {mine && <span className="rounded-md bg-primary px-1.5 py-0.5 text-xs font-semibold text-on-primary">You’re in</span>}
            {soon && <span className="rounded-md bg-danger-solid px-1.5 py-0.5 text-xs font-semibold text-white">Closing soon</span>}
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-2.5 p-3 sm:p-3.5">
          <div>
            <h2 className="text-sm font-semibold leading-snug text-ink group-hover:text-primary sm:text-[15px]">{pool.title}</h2>
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted">
              {s.tradeAssurance && <ShieldIcon width={12} height={12} className="shrink-0 text-primary" />}
              {s.name}
            </p>
          </div>
          <div>
            <p className="flex flex-wrap items-baseline gap-x-1">
              <span className="text-lg font-bold tabular-nums text-ink sm:text-xl">{formatCents(price)}</span>
              <span className="text-xs text-muted">/ unit</span>
              <span className="ml-auto text-xs text-muted">
                Alone <span className="line-through">{formatCents(aloneFrom.unitPriceCents)}</span>
              </span>
            </p>
            <p className="text-xs text-muted">Pool target {pool.target.toLocaleString()} units · {p.category}</p>
          </div>
          <ProgressBar pool={pool} compact />
          <div className="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-line pt-2.5 text-xs">
            <span className={`inline-flex items-center gap-1 font-medium ${soon ? 'text-danger' : 'text-ink'}`}>
              <ClockIcon width={13} height={13} />
              {formatTimeLeft(pool, now)}
            </span>
            <span className="inline-flex items-center gap-1 text-muted">
              <UsersIcon width={13} height={13} /> {pool.members.length} {pool.members.length === 1 ? 'seller' : 'sellers'}
            </span>
          </div>
          <p className="sr-only">
            {statusDetail(pool)}
            {organiser ? `. Started by ${organiser.displayName}` : ''}
          </p>
        </div>
      </a>
    </li>
  );
}

function Hero() {
  const { state } = useStore();
  const open = state.pools.filter((p) => !isClosed(p));
  const sellers = new Set(open.flatMap((p) => p.members.map((m) => m.userId))).size;
  const savings = open.map((pool) => {
    const product = state.products.find((x) => x.id === pool.productId)!;
    return 1 - getCurrentUnitPrice(product, pool) / product.tiers[0].unitPriceCents;
  });
  const avg = savings.length ? savings.reduce((a, b) => a + b, 0) / savings.length : 0;

  return (
    <section aria-label="About PoolBuy" className="mb-8 overflow-hidden rounded-lg bg-[linear-gradient(115deg,#1b1d22_0%,#24262c_55%,#66331f_100%)] text-ink ring-1 ring-inset ring-line">
      <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Group buying on Alibaba.com</p>
          <p className="mt-2 text-2xl font-bold leading-tight sm:text-[32px]">Bulk prices without bulk quantities</p>
          <p className="mt-2 max-w-xl text-[15px] text-muted">
            Join other small sellers to reach a supplier’s minimum order. Your payment is held, not taken, until the pool fills.
          </p>
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink [&_svg]:text-primary" aria-label="How pools protect you">
            <li className="inline-flex items-center gap-1.5"><LockIcon width={15} height={15} /> Held, not taken</li>
            <li className="inline-flex items-center gap-1.5"><CheckIcon width={15} height={15} /> All or nothing: no fill, no charge</li>
            <li className="inline-flex items-center gap-1.5"><UndoIcon width={15} height={15} /> Leave any time before it fills</li>
          </ul>
        </div>
        <dl className="grid grid-cols-3 gap-2 sm:gap-3">
          {[
            [String(open.length), 'open pools'],
            [String(sellers), 'sellers pooling'],
            [formatPercent(avg), 'typical unit saving'],
          ].map(([value, label]) => (
            <div key={label} className="min-w-24 rounded-md bg-black/25 px-3 py-3 text-center ring-1 ring-inset ring-white/10">
              <dt className="sr-only">{label}</dt>
              <dd className="text-2xl font-bold tabular-nums text-primary">{value}</dd>
              <dd className="text-xs text-[#E6DFD6]">{label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

export function PoolList() {
  const { state, search } = useStore();
  const [tab, setTab] = useState<'open' | 'closed'>('open');
  const [category, setCategory] = useState<Category | 'All'>('All');
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus({ preventScroll: true }), []);

  const ranked = useMemo(() => rankPools(state.pools), [state.pools]);
  const productOf = (pool: Pool) => state.products.find((p) => p.id === pool.productId);
  const q = search.trim().toLowerCase();
  const matches = (pool: Pool) => {
    if (!q) return true;
    const p = productOf(pool);
    return [pool.title, p?.name, p?.shortName, p?.category].some((t) => t?.toLowerCase().includes(q));
  };
  const visible = ranked.filter(
    (p) => (tab === 'open' ? !isClosed(p) : isClosed(p)) && (category === 'All' || productOf(p)?.category === category) && matches(p),
  );
  const openCount = state.pools.filter((p) => !isClosed(p)).length;
  const closedCount = state.pools.length - openCount;

  return (
    <div>
      <Hero />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-line">
        <div>
          <h1 ref={headingRef} tabIndex={-1} className="text-xl font-bold text-ink outline-none">
            {q ? `Pools matching “${search.trim()}”` : 'Buy small, pay bulk prices'}
          </h1>
          <div role="tablist" aria-label="Pool status" className="mt-2 flex">
            {(['open', 'closed'] as const).map((t) => (
              <button
                key={t}
                role="tab"
                type="button"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`relative -mb-px min-h-11 px-3 text-sm font-semibold ${
                  tab === t ? 'border-b-[3px] border-primary text-primary' : 'border-b-[3px] border-transparent text-muted hover:text-ink'
                }`}
              >
                {t === 'open' ? `Open (${openCount})` : `Closed (${closedCount})`}
              </button>
            ))}
          </div>
        </div>
        <fieldset className="mb-2 flex flex-wrap gap-1.5">
          <legend className="sr-only">Category</legend>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
              className={`min-h-9 rounded-md border px-3 text-sm font-medium ${
                category === c ? 'border-primary bg-primary text-on-primary' : 'border-line-strong bg-surface text-ink hover:border-primary hover:text-primary'
              }`}
            >
              {c}
            </button>
          ))}
        </fieldset>
      </div>
      <p className="mb-4 text-xs text-muted">
        Ranked by an open rule: closest to filling first, then soonest deadline. There are no paid placements.
      </p>

      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line-strong bg-surface p-10 text-center">
          <p className="font-semibold text-ink">No {tab} pools {q ? `match “${search.trim()}”` : 'in this category'}.</p>
          <a href="#/start" className="mt-2 inline-block font-semibold text-primary underline underline-offset-2">Start a pool</a>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4" aria-label={`${tab} pools`}>
          {visible.map((p) => (
            <PoolCard key={p.id} pool={p} />
          ))}
        </ul>
      )}
    </div>
  );
}
