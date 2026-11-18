/**
 * State transitions. `applyAction` is a pure function: it returns either the
 * next state or an error message, and never mutates its input. The React
 * store calls it; the unit tests call it directly.
 */
import { MAX_DEADLINE_DAYS, MIN_DEADLINE_DAYS } from './config';
import {
  breakdownForPool,
  canJoin,
  canLeave,
  findMember,
  getRemainingCapacity,
  getStatus,
  isClosed,
} from './pool';
import type { AppState, Pool, Product } from './types';
import { parseOrganiserQuantity, parseQuantity, sanitizeNote, sanitizeTitle } from './validation';

export type Action =
  | {
      type: 'START_POOL';
      id: string;
      productId: string;
      target: number;
      deadlineDays: number;
      organiserQty: string | number;
      title?: string;
      note?: string;
      now: number;
    }
  | { type: 'JOIN_POOL'; poolId: string; qty: string | number; now: number }
  | { type: 'LEAVE_POOL'; poolId: string }
  | { type: 'SIMULATE_DEADLINE'; poolId: string; now: number }
  | { type: 'CLOSE_EXPIRED'; now: number }
  | { type: 'SWITCH_USER'; userId: string }
  | { type: 'RESET'; state: AppState };

export type ActionResult = { ok: true; state: AppState } | { ok: false; error: string; state: AppState };

const DAY_MS = 24 * 3600_000;

function updatePool(state: AppState, poolId: string, fn: (p: Pool) => Pool): AppState {
  return { ...state, pools: state.pools.map((p) => (p.id === poolId ? fn(p) : p)) };
}

function getProduct(state: AppState, productId: string): Product | undefined {
  return state.products.find((p) => p.id === productId);
}

export function applyAction(state: AppState, action: Action): ActionResult {
  const fail = (error: string): ActionResult => ({ ok: false, error, state });
  const done = (next: AppState): ActionResult => ({ ok: true, state: next });

  switch (action.type) {
    case 'START_POOL': {
      const product = getProduct(state, action.productId);
      if (!product) return fail('Choose a product from the catalogue.');
      const supplier = state.suppliers.find((s) => s.id === product.supplierId);
      if (!supplier?.verified || !supplier.tradeAssurance) {
        return fail('Pools can only be started with verified suppliers covered by Trade Assurance.');
      }
      const tier = product.tiers.find((t) => t.minQty === action.target);
      if (!tier) return fail('Choose a target from the supplier’s price tiers.');
      if (
        !Number.isInteger(action.deadlineDays) ||
        action.deadlineDays < MIN_DEADLINE_DAYS ||
        action.deadlineDays > MAX_DEADLINE_DAYS
      ) {
        return fail(`A pool must stay open for ${MIN_DEADLINE_DAYS} to ${MAX_DEADLINE_DAYS} days.`);
      }
      const qty = parseOrganiserQuantity(action.organiserQty, action.target);
      if (!qty.ok) return fail(qty.error);
      const title = sanitizeTitle(action.title);
      if (!title.ok) return fail(title.error);
      const note = sanitizeNote(action.note);
      if (!note.ok) return fail(note.error);
      if (state.pools.some((p) => p.id === action.id)) return fail('Pool id already exists.');

      const draft: Pool = {
        id: action.id,
        productId: product.id,
        organiserId: state.currentUserId,
        title: title.value || product.shortName,
        note: note.value,
        target: action.target,
        cap: product.maxOrderQty,
        createdAt: new Date(action.now).toISOString(),
        deadline: new Date(action.now + action.deadlineDays * DAY_MS).toISOString(),
        closedAt: null,
        members: [],
      };
      const held = breakdownForPool(product, draft, qty.value).totalCents;
      const pool: Pool = {
        ...draft,
        members: [
          { userId: state.currentUserId, qty: qty.value, joinedAt: draft.createdAt, heldAtJoinCents: held },
        ],
      };
      // New pools go to the front; the list view applies the ranking rule.
      return done({ ...state, pools: [pool, ...state.pools] });
    }

    case 'JOIN_POOL': {
      const pool = state.pools.find((p) => p.id === action.poolId);
      if (!pool) return fail('Pool not found.');
      const product = getProduct(state, pool.productId);
      if (!product) return fail('Product not found.');
      if (isClosed(pool)) return fail('This pool has closed.');
      if (!canJoin(pool)) return fail('This pool is full.');
      const qty = parseQuantity(action.qty, getRemainingCapacity(pool));
      if (!qty.ok) return fail(qty.error);

      const existing = findMember(pool, state.currentUserId);
      const newQty = (existing?.qty ?? 0) + qty.value;
      // Price after this join (may unlock a deeper tier, so it can only be <= before).
      const after: Pool = {
        ...pool,
        members: existing
          ? pool.members.map((m) => (m.userId === existing.userId ? { ...m, qty: newQty } : m))
          : [...pool.members, { userId: state.currentUserId, qty: newQty, joinedAt: '', heldAtJoinCents: 0 }],
      };
      const held = breakdownForPool(product, after, newQty).totalCents;
      const joinedAt = new Date(action.now).toISOString();
      const next: Pool = {
        ...after,
        members: after.members.map((m) =>
          m.userId === state.currentUserId
            ? { ...m, joinedAt: existing?.joinedAt || joinedAt, heldAtJoinCents: held }
            : m,
        ),
      };
      return done(updatePool(state, pool.id, () => next));
    }

    case 'LEAVE_POOL': {
      const pool = state.pools.find((p) => p.id === action.poolId);
      if (!pool) return fail('Pool not found.');
      if (!findMember(pool, state.currentUserId)) return fail('You are not in this pool.');
      if (!canLeave(pool, state.currentUserId)) {
        return fail(
          getStatus(pool) === 'confirmed'
            ? 'This pool has filled, so the order is confirmed and can’t be left.'
            : 'This pool has closed.',
        );
      }
      return done(
        updatePool(state, pool.id, (p) => ({
          ...p,
          members: p.members.filter((m) => m.userId !== state.currentUserId),
        })),
      );
    }

    case 'SIMULATE_DEADLINE': {
      const pool = state.pools.find((p) => p.id === action.poolId);
      if (!pool) return fail('Pool not found.');
      if (isClosed(pool)) return fail('This pool has already closed.');
      const closedAt = new Date(action.now).toISOString();
      return done(updatePool(state, pool.id, (p) => ({ ...p, closedAt, deadline: closedAt })));
    }

    case 'CLOSE_EXPIRED': {
      let changed = false;
      const pools = state.pools.map((p) => {
        if (!isClosed(p) && new Date(p.deadline).getTime() <= action.now) {
          changed = true;
          return { ...p, closedAt: p.deadline };
        }
        return p;
      });
      return done(changed ? { ...state, pools } : state);
    }

    case 'SWITCH_USER': {
      const user = state.users.find((u) => u.id === action.userId && u.isDemoUser);
      if (!user) return fail('Unknown demo user.');
      return done({ ...state, currentUserId: user.id });
    }

    case 'RESET':
      return done(action.state);
  }
}
