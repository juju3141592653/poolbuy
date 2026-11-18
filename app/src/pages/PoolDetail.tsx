/** Screen 2: pool detail, with price tiers, progress, full cost breakdown and the Join panel. */
import { useState } from 'react';
import { ArrowLeftIcon, CheckIcon, ChevronRightIcon, ClockIcon, LinkIcon, TrendDownIcon, TruckIcon } from '../components/Icons';
import { PageHeading } from '../components/Layout';
import { CostBreakdownTable, ProgressBar, StatusBadge, SupplierBadges, TierStrip } from '../components/PoolBits';
import { clockNow, formatDate, statusDetail } from '../logic/format';
import { ProductImage } from '../components/ProductImage';
import { formatCents, formatPercent } from '../logic/money';
import {
  breakdownAlone,
  breakdownForcedMoq,
  breakdownForPool,
  canJoin,
  canLeave,
  currentHoldCents,
  findMember,
  formatTimeLeft,
  getCurrentUnitPrice,
  getJoinedQty,
  getNextTier,
  getRemainingCapacity,
  getStatus,
  getUnitsToNextTier,
  getUnitsToTarget,
  isClosed,
  isClosingSoon,
  priceForQty,
  savingVsAlone,
} from '../logic/pool';
import type { Pool, Product } from '../logic/types';
import { parseQuantity } from '../logic/validation';
import { navigate } from '../state/router';
import { useLookups, useStore } from '../state/context';


function Card({ title, children, className = '' }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-line bg-surface p-5 ${className}`} aria-label={title}>
      {title && <h2 className="mb-3 text-base font-semibold text-ink">{title}</h2>}
      {children}
    </section>
  );
}

function InviteButton({ pool }: { pool: Pool }) {
  const { state } = useStore();
  const [copied, setCopied] = useState<'idle' | 'copied' | 'manual'>('idle');
  const link = `${window.location.href.split('#')[0]}#/pool/${pool.id}?ref=${state.currentUserId}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied('copied');
    } catch {
      setCopied('manual'); // Clipboard blocked (e.g. embedded preview): show the link to copy by hand.
    }
  };
  return (
    <div>
      <button
        type="button"
        onClick={copy}
        className="inline-flex min-h-11 items-center gap-2 rounded-md border border-primary bg-transparent px-3 text-sm font-semibold text-primary hover:bg-primary-tint"
      >
        <LinkIcon /> {copied === 'copied' ? 'Invite link copied' : 'Copy invite link'}
      </button>
      {copied === 'manual' && (
        <label className="mt-2 block text-xs text-muted">
          Copy this link:
          <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="mt-1 w-full rounded border border-line-strong bg-canvas px-2 py-1 text-xs text-ink" />
        </label>
      )}
    </div>
  );
}

function JoinPanel({ pool, product }: { pool: Pool; product: Product }) {
  const { state, dispatch, setFlash } = useStore();
  const member = findMember(pool, state.currentUserId);
  const remaining = getRemainingCapacity(pool);
  // New joiners see a starting quantity so the full cost shows before Join (story 4).
  // Existing members get an empty box: no nudge to buy more (ethics register: nothing pre-filled).
  const [qtyText, setQtyText] = useState(() => (member ? '' : String(Math.min(100, Math.max(1, remaining)))));
  const [confirmLeave, setConfirmLeave] = useState(false);
  const status = getStatus(pool);

  if (isClosed(pool)) {
    return (
      <Card title={status === 'confirmed' ? 'Order placed' : 'Pool closed'}>
        <p className="text-sm text-ink">
          {status === 'confirmed'
            ? 'This pool reached its target. Holds were captured and one order went to the supplier.'
            : 'This pool missed its target, so every hold was released. Nobody was charged.'}
        </p>
        {member && (
          <p className="mt-3 rounded-lg bg-raised p-3 text-sm text-ink ring-1 ring-inset ring-line">
            Your {member.qty.toLocaleString()} units:{' '}
            <span className="font-semibold">
              {status === 'confirmed'
                ? `${formatCents(currentHoldCents(product, pool, member))} charged`
                : `${formatCents(member.heldAtJoinCents)} hold released`}
            </span>
          </p>
        )}
        <a href="#/" className="mt-4 inline-block font-semibold text-primary underline underline-offset-2">Browse open pools</a>
      </Card>
    );
  }

  const parsed = parseQuantity(qtyText, remaining);
  const qty = parsed.ok ? parsed.value : 0;
  // For a top-up, price the member's new total so the breakdown is the real hold.
  const totalQty = (member?.qty ?? 0) + qty;
  const previewPool: Pool = parsed.ok
    ? {
        ...pool,
        members: member
          ? pool.members.map((m) => (m.userId === member.userId ? { ...m, qty: totalQty } : m))
          : [...pool.members, { userId: state.currentUserId, qty, joinedAt: '', heldAtJoinCents: 0 }],
      }
    : pool;
  const breakdown = parsed.ok ? breakdownForPool(product, previewPool, totalQty) : null;
  const alone = parsed.ok ? breakdownAlone(product, totalQty) : undefined;
  const saving = parsed.ok ? savingVsAlone(product, previewPool, totalQty) : null;
  const errorId = 'qty-error';
  const showError = !parsed.ok && qtyText.trim() !== '';

  const leave = () => {
    const hold = member ? currentHoldCents(product, pool, member) : 0;
    const res = dispatch({ type: 'LEAVE_POOL', poolId: pool.id });
    setConfirmLeave(false);
    setFlash(
      res.ok
        ? { kind: 'success', text: `You left “${pool.title}”. Your hold of ${formatCents(hold)} was released straight away.` }
        : { kind: 'error', text: res.error },
    );
  };

  return (
    <Card title={member ? 'You’re in this pool' : 'Join this pool'}>
      <div className="-mt-1 mb-4 border-b border-line pb-3">
        <p className="flex items-baseline gap-1.5">
          <span className="text-[28px] font-bold leading-none tabular-nums text-ink">{formatCents(getCurrentUnitPrice(product, pool))}</span>
          <span className="text-sm text-muted">/ unit</span>
          <span className="ml-auto rounded bg-success-tint px-1.5 py-0.5 text-xs font-bold text-success ring-1 ring-inset ring-success-line">
            {formatPercent(1 - getCurrentUnitPrice(product, pool) / product.tiers[0].unitPriceCents)} off
          </span>
        </p>
        <p className="mt-1 text-xs text-muted">
          Pool price · buying alone from <span className="line-through">{formatCents(product.tiers[0].unitPriceCents)}</span>
        </p>
      </div>
      {member && (
        <div className="mb-4 rounded-lg bg-primary-tint p-3 text-sm text-ink ring-1 ring-inset ring-primary-soft" data-testid="member-summary">
          <p>
            <span className="font-semibold">{member.qty.toLocaleString()} units</span> · hold{' '}
            <span className="font-semibold">{formatCents(currentHoldCents(product, pool, member))}</span>
            {currentHoldCents(product, pool, member) < member.heldAtJoinCents && (
              <span className="text-success"> (down from {formatCents(member.heldAtJoinCents)})</span>
            )}
          </p>
          <p className="mt-1 text-muted">
            {status === 'filling'
              ? 'You’re only charged if the pool fills.'
              : `The pool has filled. Your hold is charged when it closes on ${formatDate(pool.deadline)}.`}
          </p>
          {canLeave(pool, state.currentUserId) ? (
            confirmLeave ? (
              <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Confirm leaving">
                <span className="font-medium">Leave and release your hold?</span>
                <button type="button" onClick={leave} className="min-h-11 rounded-md bg-ink px-3 font-semibold text-canvas hover:bg-white">
                  Yes, leave
                </button>
                <button type="button" onClick={() => setConfirmLeave(false)} className="min-h-11 rounded-md px-3 font-semibold underline">
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmLeave(true)}
                className="mt-3 min-h-11 rounded-md border border-line-strong bg-transparent px-3 font-semibold text-ink hover:bg-raised"
              >
                Leave pool
              </button>
            )
          ) : (
            <p className="mt-2 text-xs text-muted">Leaving is closed because the order is now locked in for everyone. If more sellers join, your price can still go down.</p>
          )}
        </div>
      )}

      {canJoin(pool) ? (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (parsed.ok) navigate(`/pool/${pool.id}/join?qty=${parsed.value}`);
          }}
        >
          <label htmlFor="qty" className="block font-semibold text-ink">
            {member ? 'Add more units' : 'How many units do you need?'}
          </label>
          <p id="qty-help" className="text-sm text-muted">
            Whole number from 1 to {remaining.toLocaleString()}.
          </p>
          <input
            id="qty"
            name="qty"
            inputMode="numeric"
            autoComplete="off"
            value={qtyText}
            onChange={(e) => setQtyText(e.target.value)}
            aria-invalid={showError}
            aria-describedby={`qty-help${showError ? ` ${errorId}` : ''}`}
            className={`mt-2 min-h-11 w-full rounded-md border bg-canvas px-3 text-lg font-semibold text-ink ${
              showError ? 'border-danger ring-1 ring-danger' : 'border-line-strong'
            }`}
          />
          {showError && !parsed.ok && (
            <p id={errorId} className="mt-1 text-sm font-medium text-danger">
              {parsed.error}
            </p>
          )}

          <div className="mt-4">
            {breakdown ? (
              <CostBreakdownTable breakdown={breakdown} alone={alone} saving={saving} forcedMoq={breakdownForcedMoq(product)} />
            ) : (
              <p className="rounded-lg bg-raised p-3 text-sm text-muted">Enter a quantity to see the full cost.</p>
            )}
          </div>

          <p className="mt-4 text-sm text-ink">
            <span className="font-semibold">Payment held, not taken.</span> If the pool hasn’t reached{' '}
            {pool.target.toLocaleString()} units by {formatDate(pool.deadline)}, your hold is released automatically.
            {status === 'filling' && ' You can leave any time before it fills.'}
          </p>
          <button
            type="submit"
            disabled={!parsed.ok}
            className="mt-4 min-h-12 w-full rounded-lg bg-primary px-4 text-base font-bold text-on-primary hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-raised disabled:text-muted"
          >
            {breakdown ? `${member ? 'Add units' : 'Join pool'}: hold ${formatCents(breakdown.totalCents - (member ? currentHoldCents(product, pool, member) : 0))}` : 'Join pool'}
          </button>
          <p className="mt-2 text-center text-xs text-muted">Nothing is added after you join. The price can only go down.</p>
        </form>
      ) : (
        <p className="text-sm text-muted">This pool has reached the supplier’s maximum order size.</p>
      )}
    </Card>
  );
}

function WhatHappensNext({ pool }: { pool: Pool }) {
  const status = getStatus(pool);
  const closed = isClosed(pool);
  const steps = [
    { label: `Pool reaches ${pool.target.toLocaleString()} units`, done: status === 'confirmed' },
    { label: `Pool closes ${formatDate(pool.deadline)}: holds captured, one order to the supplier`, done: closed && status === 'confirmed' },
    { label: 'One bulk shipment to the Singapore hub', done: false },
    { label: 'Split by quantity: collect at the hub or get it delivered', done: false },
  ];
  if (status === 'refunded') {
    return (
      <Card title="What happened">
        <p className="text-sm text-ink">
          The pool closed on {formatDate(pool.closedAt!)} with {getJoinedQty(pool).toLocaleString()} of {pool.target.toLocaleString()} units.
          Because pools are all-or-nothing, every hold was released and nobody was charged.
        </p>
      </Card>
    );
  }
  return (
    <Card title="What happens next">
      <ol className="space-y-2.5">
        {steps.map((s, i) => (
          <li key={i} className="flex items-start gap-3 text-sm">
            <span
              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                s.done ? 'bg-success-solid text-white' : 'bg-raised text-ink ring-1 ring-inset ring-line-strong'
              }`}
            >
              {s.done ? <CheckIcon width={14} height={14} /> : i + 1}
              <span className="sr-only">{s.done ? ' (done)' : ''}</span>
            </span>
            <span className={s.done ? 'font-semibold text-ink' : 'text-ink'}>{s.label}</span>
          </li>
        ))}
      </ol>
      {status === 'filling' && (
        <p className="mt-3 flex items-start gap-2 text-sm text-muted">
          <TruckIcon className="mt-0.5 shrink-0" />
          If the target isn’t reached by the deadline, every hold is released automatically.
        </p>
      )}
    </Card>
  );
}

function DemoControls({ pool }: { pool: Pool }) {
  const { dispatch, setFlash } = useStore();
  if (isClosed(pool)) return null;
  const willRefund = getStatus(pool) === 'filling';
  return (
    <section aria-label="Demo controls" className="rounded-lg border-2 border-dashed border-line-strong bg-transparent p-4">
      <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Demo controls (not part of the product)</h2>
      <p className="mt-1 text-sm text-ink">
        Jump to the deadline now. {willRefund ? 'This pool is below target, so it will be refunded.' : 'This pool has reached its target, so the order will be placed.'}
      </p>
      <button
        type="button"
        data-testid="simulate-deadline"
        onClick={() => {
          const res = dispatch({ type: 'SIMULATE_DEADLINE', poolId: pool.id, now: clockNow() });
          setFlash(
            !res.ok
              ? { kind: 'error', text: res.error }
              : willRefund
                ? { kind: 'info', text: `Deadline passed below target. “${pool.title}” is Refunded and every hold was released.` }
                : { kind: 'success', text: `Deadline passed. “${pool.title}” is Confirmed and the order was placed.` },
          );
        }}
        className="mt-3 min-h-11 rounded-md border border-line-strong bg-raised px-4 text-sm font-semibold text-ink hover:border-primary hover:text-primary"
      >
        Simulate deadline
      </button>
    </section>
  );
}

export function PoolDetail({ poolId }: { poolId: string }) {
  const { state, now } = useStore();
  const { product, supplier, user } = useLookups();
  const pool = state.pools.find((p) => p.id === poolId);

  if (!pool) {
    return (
      <div>
        <PageHeading>Pool not found</PageHeading>
        <a href="#/" className="font-semibold text-primary underline">Back to all pools</a>
      </div>
    );
  }

  const p = product(pool.productId)!;
  const s = supplier(p.supplierId)!;
  const organiser = user(pool.organiserId);
  const status = getStatus(pool);
  const currentPrice = getCurrentUnitPrice(p, pool);
  const nextTier = getNextTier(p, pool);
  const toNext = getUnitsToNextTier(p, pool);
  const toTarget = getUnitsToTarget(pool);
  const soon = isClosingSoon(pool, now);
  const activeMinQty = [...p.tiers].reverse().find((t) => t.unitPriceCents === currentPrice)?.minQty ?? pool.target;
  const alonePrice = priceForQty(p.tiers, p.tiers[0].minQty)!;

  return (
    <div>
      <nav aria-label="Breadcrumb" className="mb-3 text-sm text-muted">
        <ol className="flex flex-wrap items-center gap-1">
          <li><a href="#/" className="inline-flex min-h-8 items-center gap-1 font-medium text-primary hover:underline"><ArrowLeftIcon width={14} height={14} /> All pools</a></li>
          <li aria-hidden="true"><ChevronRightIcon width={14} height={14} /></li>
          <li>{p.category}</li>
          <li aria-hidden="true"><ChevronRightIcon width={14} height={14} /></li>
          <li aria-current="page" className="font-medium text-ink">{pool.title}</li>
        </ol>
      </nav>

      {/* One grid so the Join panel comes straight after the overview on phones, and sits in a sticky right column on desktop. */}
      <div className="grid gap-5 lg:grid-cols-[1fr_360px] lg:items-start">
        <section aria-label="Pool overview" className="overflow-hidden rounded-lg border border-line bg-surface lg:col-start-1">
          <div className="grid gap-5 p-5 md:grid-cols-[240px_1fr]">
            <ProductImage kind={p.image} className="aspect-[4/3] w-full overflow-hidden rounded-md border border-line" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">{p.category} · {p.name}</p>
              <PageHeading compact>{pool.title}</PageHeading>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={status} />
                <span className="text-sm text-ink">{statusDetail(pool)}</span>
              </div>
              <p className="mt-3 text-sm text-ink">
                <span className="font-semibold">{s.name}</span> · {s.location} · {s.yearsOnPlatform} years on Alibaba.com
              </p>
              <div className="mt-1.5"><SupplierBadges supplier={s} /></div>
              {organiser && <p className="mt-2 text-sm text-muted">Started by {organiser.displayName}{pool.organiserId === state.currentUserId ? ' (you)' : ''}</p>}
            </div>
          </div>

          <div className="border-t border-line px-5 py-4">
            <h2 className="mb-2 text-sm font-semibold text-ink">Price per unit by order size</h2>
            <TierStrip tiers={p.tiers} activeMinQty={activeMinQty} targetMinQty={pool.target} caption={`Price tiers for ${p.shortName}`} />
            <p className="mt-2 text-xs text-muted">
              Buying alone starts at {p.tiers[0].minQty.toLocaleString()} units for {formatCents(alonePrice)} each. Prices in US$.
            </p>
          </div>

          <div className="border-t border-line px-5 py-4">
            <ProgressBar pool={pool} />
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
              {status === 'filling' && (
                <span className="font-semibold text-ink">{toTarget.toLocaleString()} more units to reach the target</span>
              )}
              <span className={`inline-flex items-center gap-1 ${soon ? 'font-semibold text-danger' : 'text-ink'}`}>
                <ClockIcon /> {formatTimeLeft(pool, now)}
                {!isClosed(pool) && <span className="text-muted">· closes {formatDate(pool.deadline)}</span>}
              </span>
            </div>
            {nextTier && toNext !== null && !isClosed(pool) && (
              <div className="mt-4 flex flex-col gap-3 rounded-md border border-success-line bg-success-tint p-4 sm:flex-row sm:items-center" data-testid="next-tier">
                <TrendDownIcon className="hidden shrink-0 text-success sm:block" width={26} height={26} />
                <p className="flex-1 text-sm text-ink">
                  <span className="font-bold text-success">{toNext.toLocaleString()} more units</span> unlocks{' '}
                  <span className="font-bold text-success">{formatCents(nextTier.unitPriceCents)} per unit</span> for everyone in the pool
                  {status === 'filling' ? ' (after the target is reached)' : ''}. Invite other sellers to get there.
                </p>
                <InviteButton pool={pool} />
              </div>
            )}
            {!nextTier && !isClosed(pool) && (
              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-sm text-muted">This pool is at the supplier’s best price.</p>
                <InviteButton pool={pool} />
              </div>
            )}
          </div>
        </section>

        <div className="lg:col-start-2 lg:row-span-5 lg:row-start-1">
          <JoinPanel pool={pool} product={p} />
        </div>

        <div className="lg:col-start-1"><WhatHappensNext pool={pool} /></div>

        <Card title={`Sellers in this pool (${pool.members.length})`} className="lg:col-start-1">
          {pool.members.length === 0 ? (
            <p className="text-sm text-muted">No one has joined yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {pool.members.map((m) => {
                const u = user(m.userId);
                return (
                  <li key={m.userId} className="flex items-center justify-between py-2 text-sm">
                    <span className="inline-flex items-center gap-2 text-ink">
                      <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-tint text-xs font-bold text-primary">
                        {(u?.displayName ?? 'S').slice(0, 1)}
                      </span>
                      {u?.displayName ?? 'Seller'}
                      {m.userId === pool.organiserId && <span className="rounded bg-raised px-1.5 text-xs font-semibold text-muted">Organiser</span>}
                      {m.userId === state.currentUserId && <span className="rounded bg-primary px-1.5 text-xs font-semibold text-on-primary">You</span>}
                    </span>
                    <span className="font-semibold tabular-nums text-ink">{m.qty.toLocaleString()} units</span>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted">Sellers only see each other’s display name and quantity. Addresses go to the Singapore hub alone.</p>
        </Card>

        <Card title="About this listing" className="lg:col-start-1">
          <p className="text-sm text-ink">{p.description}</p>
          {pool.note && (
            <p className="mt-3 rounded-md bg-raised p-3 text-sm text-ink">
              <span className="font-semibold">Note from the organiser:</span> {pool.note}
            </p>
          )}
        </Card>

        <div className="lg:col-start-1">
          <DemoControls pool={pool} />
        </div>
      </div>
    </div>
  );
}
