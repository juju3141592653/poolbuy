/** Seed data integrity, plus the data-privacy check (made-up data only). */
import { describe, expect, it } from 'vitest';
import { getJoinedQty, getStatus } from '../logic/pool';
import { buildSeedState } from './seed';
import raw from './seed.json';

const s = buildSeedState(Date.parse('2026-11-18T06:00:00Z'));

describe('seed data', () => {
  it('has 4 open pools (tote, kraft boxes, T-shirts, phone cases) and 1 closed example', () => {
    const open = s.pools.filter((p) => !p.closedAt).map((p) => p.productId).sort();
    expect(open).toEqual(['p-box', 'p-phone', 'p-tote', 'p-tshirt']);
    expect(s.pools.filter((p) => p.closedAt)).toHaveLength(1);
  });
  it('uses the tote bag tiers from the project guide', () => {
    const tote = s.products.find((p) => p.id === 'p-tote')!;
    expect(tote.tiers).toEqual([
      { minQty: 100, unitPriceCents: 300 },
      { minQty: 500, unitPriceCents: 150 },
      { minQty: 1000, unitPriceCents: 100 },
    ]);
    expect(getJoinedQty(s.pools.find((p) => p.id === 'pool-tote')!)).toBe(420); // "420 / 500 filled"
  });
  it('covers every status for the demo', () => {
    const statuses = new Set(s.pools.map(getStatus));
    expect(statuses).toEqual(new Set(['filling', 'confirmed', 'refunded']));
  });
  it('has exactly 3 selectable demo users', () => {
    expect(s.users.filter((u) => u.isDemoUser).map((u) => u.fullName)).toEqual(['Mei Tan', 'Arjun Nair', 'Siti Rahman']);
  });
  it('has tiers sorted ascending and every pool target equal to a tier (target = MOQ)', () => {
    for (const p of s.products) {
      const mins = p.tiers.map((t) => t.minQty);
      expect([...mins].sort((a, b) => a - b)).toEqual(mins);
    }
    for (const pool of s.pools) {
      const product = s.products.find((p) => p.id === pool.productId)!;
      expect(product.tiers.some((t) => t.minQty === pool.target)).toBe(true);
    }
  });
});

describe('data privacy check: no real personal information', () => {
  const text = JSON.stringify(raw);
  it('contains no email addresses, phone numbers or street addresses', () => {
    expect(text).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/); // email
    expect(text).not.toMatch(/(\+65\s?)?[689]\d{3}\s?\d{4}/); // Singapore phone number
    expect(text).not.toMatch(/\b\d{6}\b/); // Singapore postal code
    expect(text).not.toMatch(/\b(Blk|Block|Street|Avenue|#\d{2}-\d{2,4})\b/i);
  });
  it('shows other sellers by display name only (first name + initial)', () => {
    for (const u of s.users) expect(u.displayName).toMatch(/^[A-Z][a-z]+( [A-Z][a-z]+)? [A-Z]\.$/);
  });
});
