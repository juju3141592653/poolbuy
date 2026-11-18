/** Screen 5: my pools, each with a text status label and a Leave button while Filling. */
import { useState } from 'react';
import { PageHeading } from '../components/Layout';
import { StatusBadge } from '../components/PoolBits';
import { statusDetail } from '../logic/format';
import { ProductImage } from '../components/ProductImage';
import { formatCents } from '../logic/money';
import {
  canLeave,
  currentHoldCents,
  estimatedSavingCents,
  findMember,
  formatTimeLeft,
  getJoinedQty,
  getStatus,
  isClosed,
} from '../logic/pool';
import type { Pool, PoolStatus } from '../logic/types';
import { useLookups, useStore } from '../state/context';

const ORDER: Record<PoolStatus, number> = { filling: 0, confirmed: 1, refunded: 2 };

function Row({ pool }: { pool: Pool }) {
  const { state, now, dispatch, setFlash } = useStore();
  const { product } = useLookups();
  const [confirming, setConfirming] = useState(false);
  const p = product(pool.productId)!;
  const member = findMember(pool, state.currentUserId)!;
  const status = getStatus(pool);
  const hold = currentHoldCents(p, pool, member);
  const isOrganiser = pool.organiserId === state.currentUserId;

  const moneyLine =
    status === 'refunded'
      ? `${formatCents(member.heldAtJoinCents)} hold released · nothing charged`
      : status === 'confirmed' && isClosed(pool)
        ? `${formatCents(hold)} charged · order placed`
        : `${formatCents(hold)} held, not taken`;

  const leave = () => {
    const res = dispatch({ type: 'LEAVE_POOL', poolId: pool.id });
    setConfirming(false);
    setFlash(
      res.ok
        ? { kind: 'success', text: `You left “${pool.title}”. Your hold of ${formatCents(hold)} was released straight away.` }
        : { kind: 'error', text: res.error },
    );
  };

  return (
    <li className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4 sm:flex-row sm:items-center" data-testid={`my-pool-${pool.id}`}>
      <ProductImage kind={p.image} className="h-20 w-full shrink-0 overflow-hidden rounded-lg sm:w-28" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={status} />
          {isOrganiser && <span className="rounded bg-raised px-1.5 py-0.5 text-xs font-semibold text-muted">Organiser</span>}
        </div>
        <h2 className="mt-1.5 text-base font-bold text-ink">
          <a href={`#/pool/${pool.id}`} className="hover:text-primary hover:underline hover:underline-offset-2">{pool.title}</a>
        </h2>
        <p className="text-sm text-muted">
          {statusDetail(pool)} · {getJoinedQty(pool).toLocaleString()} / {pool.target.toLocaleString()} units ·{' '}
          {isClosed(pool) ? `closed ${new Date(pool.closedAt!).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}` : formatTimeLeft(pool, now)}
        </p>
        <p className="mt-1 text-sm text-ink">
          <span className="font-semibold">Your {member.qty.toLocaleString()} units:</span> {moneyLine}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <a href={`#/pool/${pool.id}`} className="inline-flex min-h-11 items-center rounded-md border border-line-strong bg-transparent px-3 text-sm font-semibold text-ink hover:bg-raised">
          View
        </a>
        {canLeave(pool, state.currentUserId) &&
          (confirming ? (
            <span className="flex flex-wrap items-center gap-2" role="group" aria-label={`Confirm leaving ${pool.title}`}>
              <button type="button" onClick={leave} className="min-h-11 rounded-md bg-ink px-3 text-sm font-semibold text-canvas hover:bg-white">
                Yes, leave and release {formatCents(hold)}
              </button>
              <button type="button" onClick={() => setConfirming(false)} className="min-h-11 rounded-md px-2 text-sm font-semibold underline">
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="min-h-11 rounded-md border border-line-strong bg-transparent px-3 text-sm font-semibold text-ink hover:border-danger hover:text-danger"
            >
              Leave
            </button>
          ))}
      </div>
    </li>
  );
}

export function MyPools() {
  const { state } = useStore();
  const { product, currentUser } = useLookups();
  const mine = state.pools
    .filter((p) => findMember(p, state.currentUserId))
    .sort((a, b) => ORDER[getStatus(a)] - ORDER[getStatus(b)] || a.deadline.localeCompare(b.deadline));

  const activeHolds = mine
    .filter((p) => !isClosed(p))
    .reduce((sum, p) => sum + currentHoldCents(product(p.productId)!, p, findMember(p, state.currentUserId)!), 0);
  // Refunded pools saved nothing, so only filling and confirmed pools count.
  const saved = mine
    .filter((p) => getStatus(p) !== 'refunded')
    .reduce((sum, p) => sum + estimatedSavingCents(product(p.productId)!, p, findMember(p, state.currentUserId)!), 0);

  return (
    <div>
      <PageHeading sub={`${currentUser.fullName} · ${currentUser.business}`}>My pools</PageHeading>

      <dl className="mb-6 grid gap-3 sm:grid-cols-3">
        {[
          ['Pools you’re in', String(mine.length)],
          ['Held right now (not taken)', formatCents(activeHolds)],
          ['Saved vs buying alone (est.)', formatCents(saved)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-line bg-surface p-4">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="mt-1 text-2xl font-extrabold text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      {mine.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line-strong p-10 text-center">
          <p className="font-semibold text-ink">You haven’t joined any pools yet.</p>
          <a href="#/" className="mt-2 inline-block font-semibold text-primary underline underline-offset-2">Browse open pools</a>
        </div>
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Your pools">
          {mine.map((p) => (
            <Row key={p.id} pool={p} />
          ))}
        </ul>
      )}
    </div>
  );
}
