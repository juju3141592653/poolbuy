import { describe, expect, it } from 'vitest';
import {
  breakdownAlone,
  breakdownForcedMoq,
  canJoin,
  canLeave,
  computeCostBreakdown,
  estimatedSavingCents,
  formatTimeLeft,
  getCurrentUnitPrice,
  getJoinedQty,
  getNextTier,
  getRemainingCapacity,
  getStatus,
  getUnitsToNextTier,
  getUnitsToTarget,
  isClosingSoon,
  priceForQty,
  rankPools,
  savingVsAlone,
} from './pool';
import type { Pool, Product } from './types';

const NOW = Date.parse('2026-11-18T06:00:00Z');
const HOUR = 3600_000;

// The tote bag example from the project guide: 100 @ $3.00, 500 @ $1.50, 1000 @ $1.00.
const tote: Product = {
  id: 'p-tote',
  name: 'Tote',
  shortName: 'Tote',
  category: 'Accessories',
  image: 'tote',
  supplierId: 's1',
  description: '',
  tiers: [
    { minQty: 100, unitPriceCents: 300 },
    { minQty: 500, unitPriceCents: 150 },
    { minQty: 1000, unitPriceCents: 100 },
  ],
  shippingPerUnitCents: 25,
  maxOrderQty: 3000,
};

function pool(qtys: number[], overrides: Partial<Pool> = {}): Pool {
  return {
    id: 'pool-1',
    productId: 'p-tote',
    organiserId: 'u0',
    title: 'Tote pool',
    note: '',
    target: 500,
    cap: 3000,
    createdAt: new Date(NOW - 24 * HOUR).toISOString(),
    deadline: new Date(NOW + 72 * HOUR).toISOString(),
    closedAt: null,
    members: qtys.map((qty, i) => ({ userId: `u${i}`, qty, joinedAt: '', heldAtJoinCents: 0 })),
    ...overrides,
  };
}

describe('status (all-or-nothing rule)', () => {
  it('is Filling while open and below target', () => {
    expect(getStatus(pool([150, 120, 150]))).toBe('filling');
  });
  it('is Confirmed as soon as joined quantity reaches the target', () => {
    expect(getStatus(pool([300, 200]))).toBe('confirmed');
    expect(getStatus(pool([300, 250]))).toBe('confirmed');
  });
  it('is Refunded when closed below target', () => {
    expect(getStatus(pool([100], { closedAt: new Date(NOW).toISOString() }))).toBe('refunded');
  });
  it('stays Confirmed when closed at or above target (order placed)', () => {
    expect(getStatus(pool([500], { closedAt: new Date(NOW).toISOString() }))).toBe('confirmed');
  });
  it('derives joined quantity from members so it cannot drift', () => {
    expect(getJoinedQty(pool([150, 120, 150]))).toBe(420);
    expect(getUnitsToTarget(pool([150, 120, 150]))).toBe(80);
    expect(getUnitsToTarget(pool([600]))).toBe(0);
  });
});

describe('pricing and tiers', () => {
  it('finds the price for a quantity, or null below the MOQ', () => {
    expect(priceForQty(tote.tiers, 99)).toBeNull();
    expect(priceForQty(tote.tiers, 100)).toBe(300);
    expect(priceForQty(tote.tiers, 499)).toBe(300);
    expect(priceForQty(tote.tiers, 500)).toBe(150);
    expect(priceForQty(tote.tiers, 2500)).toBe(100);
  });
  it('quotes the target-tier price while filling, even with few units joined', () => {
    expect(getCurrentUnitPrice(tote, pool([50]))).toBe(150);
  });
  it('drops the price for everyone when a deeper tier unlocks (growth loop)', () => {
    expect(getCurrentUnitPrice(tote, pool([600, 400]))).toBe(100);
  });
  it('shows units to the next tier, e.g. "200 more units: everyone pays $1.00" (story 5)', () => {
    const p = pool([500, 300]);
    expect(getNextTier(tote, p)).toEqual({ minQty: 1000, unitPriceCents: 100 });
    expect(getUnitsToNextTier(tote, p)).toBe(200);
  });
  it('has no next tier once the best tier is reached, or if the tier is above capacity', () => {
    expect(getNextTier(tote, pool([1000]))).toBeNull();
    expect(getNextTier(tote, pool([400], { cap: 800 }))).toBeNull();
  });
});

describe('cost breakdown (story 4: full cost before joining)', () => {
  it('adds goods, shipping share, 2% fee and 9% GST in integer cents', () => {
    const b = computeCostBreakdown(100, 150, 25);
    expect(b.goodsCents).toBe(15000);
    expect(b.shippingCents).toBe(2500);
    expect(b.serviceFeeCents).toBe(300);
    expect(b.gstCents).toBe(1602); // 9% of 17,800 cents
    expect(b.totalCents).toBe(19402);
    expect(b.perUnitCents).toBeCloseTo(194.02);
  });
  it('can switch the fee off (pricing option A)', () => {
    const b = computeCostBreakdown(100, 150, 25, 0);
    expect(b.serviceFeeCents).toBe(0);
    expect(b.totalCents).toBe(17500 + 1575);
  });
  it('never produces fractional cents', () => {
    for (const qty of [1, 7, 33, 101, 999]) {
      const b = computeCostBreakdown(qty, 37, 3);
      expect(Number.isInteger(b.totalCents)).toBe(true);
      expect(b.totalCents).toBe(b.goodsCents + b.shippingCents + b.serviceFeeCents + b.gstCents);
    }
  });
  it('compares against buying alone: Mei saves 46% on 100 tote bags (KR3: at least 35%)', () => {
    const saving = savingVsAlone(tote, pool([420]), 100)!;
    expect(saving).toBeGreaterThan(0.35);
    expect(Math.round(saving * 100)).toBe(46);
  });
  it('reports that buying alone is impossible below the MOQ, and what the forced order costs', () => {
    expect(breakdownAlone(tote, 50)).toBeNull();
    expect(breakdownForcedMoq(tote).qty).toBe(100);
    expect(breakdownForcedMoq(tote).unitPriceCents).toBe(300);
  });
  it('estimates savings against the single-buyer price, never below zero', () => {
    const p = pool([50, 450]);
    expect(estimatedSavingCents(tote, p, p.members[0])).toBeGreaterThan(0);
  });
});

describe('join and leave rules', () => {
  it('lets members leave only while filling (story 6)', () => {
    expect(canLeave(pool([100, 100]), 'u0')).toBe(true);
    expect(canLeave(pool([300, 200]), 'u0')).toBe(false); // confirmed
    expect(canLeave(pool([100], { closedAt: new Date(NOW).toISOString() }), 'u0')).toBe(false);
    expect(canLeave(pool([100]), 'not-a-member')).toBe(false);
  });
  it('lets sellers join while open and below capacity', () => {
    expect(canJoin(pool([100]))).toBe(true);
    expect(canJoin(pool([3000]))).toBe(false);
    expect(canJoin(pool([100], { closedAt: new Date(NOW).toISOString() }))).toBe(false);
    expect(getRemainingCapacity(pool([2900]))).toBe(100);
  });
});

describe('time and ranking', () => {
  it('formats time left', () => {
    expect(formatTimeLeft(pool([1], { deadline: new Date(NOW + 102 * HOUR).toISOString() }), NOW)).toBe('4d 6h left');
    expect(formatTimeLeft(pool([1], { deadline: new Date(NOW + 20 * HOUR + 5 * 60_000).toISOString() }), NOW)).toBe('20h 5m left');
    expect(formatTimeLeft(pool([1], { closedAt: new Date(NOW).toISOString() }), NOW)).toBe('Closed');
  });
  it('flags pools closing within 24 hours', () => {
    expect(isClosingSoon(pool([1], { deadline: new Date(NOW + 20 * HOUR).toISOString() }), NOW)).toBe(true);
    expect(isClosingSoon(pool([1], { deadline: new Date(NOW + 30 * HOUR).toISOString() }), NOW)).toBe(false);
  });
  it('ranks by the open rule: closest to filling, then soonest deadline, then filled, then closed', () => {
    const a = pool([100], { id: 'a' }); // 20%
    const b = pool([400], { id: 'b' }); // 80%
    const c = pool([400], { id: 'c', deadline: new Date(NOW + 10 * HOUR).toISOString() }); // 80%, sooner
    const d = pool([600], { id: 'd' }); // confirmed, open
    const e = pool([10], { id: 'e', closedAt: new Date(NOW).toISOString() }); // closed
    expect(rankPools([e, d, a, b, c]).map((p) => p.id)).toEqual(['c', 'b', 'a', 'd', 'e']);
  });
});
