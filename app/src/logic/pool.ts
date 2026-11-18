/**
 * Pure pool logic: status, pricing, tiers and cost breakdowns.
 * Nothing here touches React or storage, so every rule is unit-tested
 * in pool.test.ts.
 */
import { CLOSING_SOON_HOURS, GST_RATE, SERVICE_FEE_RATE } from './config';
import { roundCents } from './money';
import type { Member, Pool, PoolStatus, PriceTier, Product } from './types';

/** Total units committed by all members. Derived, never stored, so it can't drift. */
export function getJoinedQty(pool: Pool): number {
  return pool.members.reduce((sum, m) => sum + m.qty, 0);
}

export function isClosed(pool: Pool): boolean {
  return pool.closedAt !== null;
}

/**
 * All-or-nothing status rule:
 * - reached the target (open or closed)  -> Confirmed
 * - closed below the target              -> Refunded (every hold released)
 * - otherwise                            -> Filling
 */
export function getStatus(pool: Pool): PoolStatus {
  if (getJoinedQty(pool) >= pool.target) return 'confirmed';
  if (isClosed(pool)) return 'refunded';
  return 'filling';
}

/** Units still needed to reach the target (0 once confirmed). */
export function getUnitsToTarget(pool: Pool): number {
  return Math.max(0, pool.target - getJoinedQty(pool));
}

/** Units that can still be added before the supplier's capacity is hit. */
export function getRemainingCapacity(pool: Pool): number {
  return Math.max(0, pool.cap - getJoinedQty(pool));
}

/** Price per unit for a given order size, or null if below the supplier MOQ. */
export function priceForQty(tiers: PriceTier[], qty: number): number | null {
  let price: number | null = null;
  for (const tier of tiers) {
    if (qty >= tier.minQty) price = tier.unitPriceCents;
  }
  return price;
}

/** The tier a pool is pooling for (its target tier). */
export function getTargetTier(product: Product, pool: Pool): PriceTier {
  const tier = product.tiers.find((t) => t.minQty === pool.target);
  if (!tier) throw new Error(`Pool ${pool.id} target ${pool.target} is not a tier of ${product.id}`);
  return tier;
}

/**
 * The unit price everyone in the pool pays right now.
 * Before the target is reached, members are quoted the target tier price
 * (the pool only goes ahead at that size). After it, the price can only fall
 * as deeper tiers unlock, which is the growth loop.
 */
export function getCurrentUnitPrice(product: Product, pool: Pool): number {
  const effectiveQty = Math.max(getJoinedQty(pool), pool.target);
  const price = priceForQty(product.tiers, effectiveQty);
  if (price === null) throw new Error('Target is below the supplier MOQ');
  return price;
}

/** The next cheaper tier the pool could still unlock, if any (within capacity). */
export function getNextTier(product: Product, pool: Pool): PriceTier | null {
  const effectiveQty = Math.max(getJoinedQty(pool), pool.target);
  const next = product.tiers.find((t) => t.minQty > effectiveQty && t.minQty <= pool.cap);
  return next ?? null;
}

/** "X more units unlocks $Y per unit" (user story 5). */
export function getUnitsToNextTier(product: Product, pool: Pool): number | null {
  const next = getNextTier(product, pool);
  return next ? next.minQty - getJoinedQty(pool) : null;
}

export interface CostBreakdown {
  qty: number;
  unitPriceCents: number;
  goodsCents: number;
  shippingCents: number;
  serviceFeeCents: number;
  gstCents: number;
  totalCents: number;
  /** All-in cost per unit (goods + shipping + fee + GST). */
  perUnitCents: number;
}

/**
 * Full landed cost for a quantity at a unit price (user story 4).
 * goods + shipping share + service fee, then 9% GST on the lot.
 */
export function computeCostBreakdown(
  qty: number,
  unitPriceCents: number,
  shippingPerUnitCents: number,
  feeRate: number = SERVICE_FEE_RATE,
  gstRate: number = GST_RATE,
): CostBreakdown {
  const goodsCents = qty * unitPriceCents;
  const shippingCents = qty * shippingPerUnitCents;
  const serviceFeeCents = roundCents(goodsCents * feeRate);
  const gstCents = roundCents((goodsCents + shippingCents + serviceFeeCents) * gstRate);
  const totalCents = goodsCents + shippingCents + serviceFeeCents + gstCents;
  return {
    qty,
    unitPriceCents,
    goodsCents,
    shippingCents,
    serviceFeeCents,
    gstCents,
    totalCents,
    perUnitCents: qty > 0 ? totalCents / qty : 0,
  };
}

/** Breakdown for a member (or a would-be member) of a pool at today's pool price. */
export function breakdownForPool(product: Product, pool: Pool, qty: number): CostBreakdown {
  return computeCostBreakdown(qty, getCurrentUnitPrice(product, pool), product.shippingPerUnitCents);
}

/**
 * What the same seller would pay ordering this quantity alone.
 * Returns null when the quantity is below the supplier's MOQ (can't buy alone at all).
 */
export function breakdownAlone(product: Product, qty: number): CostBreakdown | null {
  const price = priceForQty(product.tiers, qty);
  if (price === null) return null;
  return computeCostBreakdown(qty, price, product.shippingPerUnitCents);
}

/**
 * When a seller needs fewer units than the supplier's MOQ, buying alone means
 * buying the whole MOQ. This is that forced order (the persona's pain point).
 */
export function breakdownForcedMoq(product: Product): CostBreakdown {
  const moq = product.tiers[0];
  return computeCostBreakdown(moq.minQty, moq.unitPriceCents, product.shippingPerUnitCents);
}

/**
 * Estimated saving for a member versus the single-buyer unit price for the
 * same units (uses the MOQ price when they need fewer than the MOQ).
 * A conservative figure: it ignores the extra stock a solo buyer would be forced to take.
 */
export function estimatedSavingCents(product: Product, pool: Pool, member: Member): number {
  const solePrice = priceForQty(product.tiers, Math.max(member.qty, product.tiers[0].minQty))!;
  const alone = computeCostBreakdown(member.qty, solePrice, product.shippingPerUnitCents).totalCents;
  return Math.max(0, alone - currentHoldCents(product, pool, member));
}

/** Fraction saved per unit versus buying alone (KR3 in the OKRs), or null. */
export function savingVsAlone(product: Product, pool: Pool, qty: number): number | null {
  const alone = breakdownAlone(product, qty);
  if (!alone || qty <= 0) return null;
  const pooled = breakdownForPool(product, pool, qty);
  return 1 - pooled.totalCents / alone.totalCents;
}

/** The live hold for a member: today's breakdown total. */
export function currentHoldCents(product: Product, pool: Pool, member: Member): number {
  return breakdownForPool(product, pool, member.qty).totalCents;
}

export function findMember(pool: Pool, userId: string): Member | undefined {
  return pool.members.find((m) => m.userId === userId);
}

/** Members can leave only while the pool is open and still filling (user story 6). */
export function canLeave(pool: Pool, userId: string): boolean {
  return !isClosed(pool) && getStatus(pool) === 'filling' && !!findMember(pool, userId);
}

/** New quantity can be added while the pool is open and has capacity left. */
export function canJoin(pool: Pool): boolean {
  return !isClosed(pool) && getRemainingCapacity(pool) > 0;
}

export function msLeft(pool: Pool, now: number): number {
  return new Date(pool.deadline).getTime() - now;
}

export function isClosingSoon(pool: Pool, now: number): boolean {
  const left = msLeft(pool, now);
  return !isClosed(pool) && left > 0 && left <= CLOSING_SOON_HOURS * 3600_000;
}

/** "4d 6h left", "21h 14m left", "Closed". */
export function formatTimeLeft(pool: Pool, now: number): string {
  if (isClosed(pool)) return 'Closed';
  const left = msLeft(pool, now);
  if (left <= 0) return 'Closing now';
  const mins = Math.floor(left / 60_000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const minutes = mins % 60;
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

/**
 * Open, transparent ranking rule (ethics register: fairness).
 * Filling pools first, closest to filling first, then soonest deadline.
 * Then filled pools still open for a deeper tier, then closed pools.
 * No paid placement exists.
 */
export function rankPools(pools: Pool[]): Pool[] {
  const group = (p: Pool) => (isClosed(p) ? 2 : getStatus(p) === 'filling' ? 0 : 1);
  return [...pools].sort((a, b) => {
    const g = group(a) - group(b);
    if (g !== 0) return g;
    const pa = getJoinedQty(a) / a.target;
    const pb = getJoinedQty(b) / b.target;
    if (group(a) === 0 && pa !== pb) return pb - pa;
    if (group(a) === 2) return (b.closedAt ?? '').localeCompare(a.closedAt ?? '');
    return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
  });
}
