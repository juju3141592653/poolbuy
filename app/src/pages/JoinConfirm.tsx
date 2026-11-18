/** Screen 4: join confirmation. Shows exactly what will be held before anything happens. */
import { ArrowLeftIcon, ShieldIcon } from '../components/Icons';
import { PageHeading } from '../components/Layout';
import { CostBreakdownTable } from '../components/PoolBits';
import { ProductImage } from '../components/ProductImage';
import { formatCents } from '../logic/money';
import {
  breakdownAlone,
  breakdownForcedMoq,
  breakdownForPool,
  currentHoldCents,
  findMember,
  getJoinedQty,
  getRemainingCapacity,
  getStatus,
  isClosed,
  savingVsAlone,
} from '../logic/pool';
import type { Pool } from '../logic/types';
import { parseQuantity } from '../logic/validation';
import { navigate } from '../state/router';
import { useLookups, useStore } from '../state/context';
import { clockNow, formatDate } from '../logic/format';

export function JoinConfirm({ poolId, qtyRaw }: { poolId: string; qtyRaw: string }) {
  const { state, dispatch, setFlash } = useStore();
  const { product } = useLookups();
  const pool = state.pools.find((p) => p.id === poolId);

  if (!pool || isClosed(pool)) {
    return (
      <div>
        <PageHeading>{pool ? 'This pool has closed' : 'Pool not found'}</PageHeading>
        <a href="#/" className="font-semibold text-primary underline">Back to all pools</a>
      </div>
    );
  }

  const p = product(pool.productId)!;
  // The quantity comes from the URL, so it is validated again here (never trusted).
  const parsed = parseQuantity(qtyRaw, getRemainingCapacity(pool));
  if (!parsed.ok) {
    return (
      <div>
        <PageHeading>Check your quantity</PageHeading>
        <p className="mb-4 font-medium text-danger">{parsed.error}</p>
        <a href={`#/pool/${pool.id}`} className="font-semibold text-primary underline">Back to the pool</a>
      </div>
    );
  }

  const member = findMember(pool, state.currentUserId);
  const totalQty = (member?.qty ?? 0) + parsed.value;
  const preview: Pool = {
    ...pool,
    members: member
      ? pool.members.map((m) => (m.userId === member.userId ? { ...m, qty: totalQty } : m))
      : [...pool.members, { userId: state.currentUserId, qty: totalQty, joinedAt: '', heldAtJoinCents: 0 }],
  };
  const breakdown = breakdownForPool(p, preview, totalQty);
  const alone = breakdownAlone(p, totalQty);
  const saving = savingVsAlone(p, preview, totalQty);
  const fillsPool = getStatus(pool) === 'filling' && getJoinedQty(preview) >= pool.target;
  const extraHold = breakdown.totalCents - (member ? currentHoldCents(p, pool, member) : 0);

  const confirm = () => {
    const res = dispatch({ type: 'JOIN_POOL', poolId: pool.id, qty: parsed.value, now: clockNow() });
    if (!res.ok) {
      setFlash({ kind: 'error', text: res.error });
      return;
    }
    setFlash({
      kind: 'success',
      text: fillsPool
        ? `You filled the pool! “${pool.title}” is Confirmed. ${formatCents(breakdown.totalCents)} is held and will be charged when the pool closes.`
        : `You’re in. ${formatCents(extraHold)} is held, not taken. You’re only charged if the pool fills.`,
    });
    navigate(`/pool/${pool.id}`);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <a href={`#/pool/${pool.id}`} className="mb-4 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary underline-offset-2 hover:underline">
        <ArrowLeftIcon /> Back to the pool
      </a>
      <PageHeading sub="Check the details. Nothing happens until you confirm.">Confirm your hold</PageHeading>

      <section className="rounded-lg border border-line bg-surface p-5" aria-label="Order summary">
        <div className="flex items-center gap-4">
          <ProductImage kind={p.image} className="h-16 w-20 shrink-0 overflow-hidden rounded-lg" />
          <div>
            <p className="font-bold text-ink">{pool.title}</p>
            <p className="text-sm text-muted">
              {member ? `Adding ${parsed.value.toLocaleString()} units (you’ll have ${totalQty.toLocaleString()})` : `${parsed.value.toLocaleString()} units`} ·
              closes {formatDate(pool.deadline)}
            </p>
          </div>
        </div>
        <div className="mt-5">
          <CostBreakdownTable breakdown={breakdown} alone={alone} saving={saving} forcedMoq={breakdownForcedMoq(p)} />
        </div>
      </section>

      <div className="mt-5 flex gap-3 rounded-lg bg-primary-tint p-5 text-ink ring-1 ring-inset ring-primary-soft">
        <ShieldIcon width={28} height={28} className="shrink-0 text-primary" />
        <div>
          <p className="text-lg font-bold">You are only charged if the pool fills.</p>
          <p className="mt-1 text-sm">
            We hold {formatCents(extraHold)} through Trade Assurance. If the pool hasn’t reached {pool.target.toLocaleString()} units by{' '}
            {formatDate(pool.deadline)}, the hold is released automatically and you pay nothing.
            {!fillsPool && getStatus(pool) === 'filling' && ' You can leave at any time before the pool fills.'}
          </p>
          {fillsPool && (
            <p className="mt-2 text-sm font-semibold">Your units take the pool to its target, so the order will be confirmed straight away.</p>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <a href={`#/pool/${pool.id}`} className="inline-flex min-h-12 items-center justify-center rounded-lg border border-line-strong bg-transparent px-5 font-semibold text-ink hover:bg-raised">
          Back
        </a>
        <button
          type="button"
          onClick={confirm}
          data-testid="confirm-join"
          className="min-h-12 rounded-lg bg-primary px-5 text-base font-bold text-on-primary hover:bg-primary-hover"
        >
          Confirm and hold {formatCents(extraHold)}
        </button>
      </div>
    </div>
  );
}
