/** State transitions, mapped to user stories 1, 2, 3 and 6 and the demo flow. */
import { describe, expect, it } from 'vitest';
import { buildSeedState } from '../data/seed';
import { applyAction } from './actions';
import type { Action } from './actions';
import { currentHoldCents, findMember, getJoinedQty, getStatus } from './pool';
import type { AppState } from './types';

const NOW = Date.parse('2026-11-18T06:00:00Z');
const DAY = 86_400_000;

const seed = () => buildSeedState(NOW);

/** Apply an action and fail the test with the app's own message if it is rejected. */
function run(state: AppState, action: Action): AppState {
  const res = applyAction(state, action);
  if (!res.ok) throw new Error(`Expected ${action.type} to succeed: ${res.error}`);
  return res.state;
}
const as = (state: AppState, userId: string) => run(state, { type: 'SWITCH_USER', userId });
const poolById = (s: AppState, id: string) => s.pools.find((p) => p.id === id)!;

describe('START_POOL (story 1)', () => {
  const start = (overrides: Partial<Extract<Action, { type: 'START_POOL' }>> = {}): Action => ({
    type: 'START_POOL',
    id: 'pool-new',
    productId: 'p-mailer',
    target: 1000,
    deadlineDays: 7,
    organiserQty: '300',
    title: '',
    note: '',
    now: NOW,
    ...overrides,
  });

  it('creates a pool that appears in the list immediately, with the organiser as first member', () => {
    const s = run(seed(), start());
    const p = poolById(s, 'pool-new');
    expect(s.pools[0].id).toBe('pool-new');
    expect(p.target).toBe(1000);
    expect(p.members).toHaveLength(1);
    expect(p.members[0]).toMatchObject({ userId: 'u-mei', qty: 300 });
    expect(new Date(p.deadline).getTime() - NOW).toBe(7 * DAY);
    expect(p.title).toBe('Custom poly mailers'); // default title
    expect(getStatus(p)).toBe('filling');
  });
  it('fixes the unit price to a supplier tier (the target must be a tier)', () => {
    expect(applyAction(seed(), start({ target: 750 })).ok).toBe(false);
  });
  it('only allows a deadline of 3 to 14 days', () => {
    expect(applyAction(seed(), start({ deadlineDays: 2 })).ok).toBe(false);
    expect(applyAction(seed(), start({ deadlineDays: 15 })).ok).toBe(false);
    expect(applyAction(seed(), start({ deadlineDays: 3 })).ok).toBe(true);
    expect(applyAction(seed(), start({ deadlineDays: 14 })).ok).toBe(true);
  });
  it('only allows verified suppliers with Trade Assurance (ethics: fraud and trust)', () => {
    const res = applyAction(seed(), start({ productId: 'p-label', target: 500, organiserQty: '100' }));
    expect(res.ok).toBe(false);
  });
  it('rejects scripts in the title or note', () => {
    expect(applyAction(seed(), start({ title: '<script>x</script>' })).ok).toBe(false);
    expect(applyAction(seed(), start({ note: 'javascript:alert(1)' })).ok).toBe(false);
  });
  it('requires the organiser to commit 1 to target-1 units', () => {
    expect(applyAction(seed(), start({ organiserQty: '0' })).ok).toBe(false);
    expect(applyAction(seed(), start({ organiserQty: '1000' })).ok).toBe(false);
  });
});

describe('JOIN_POOL (story 2) and the confirm-on-target rule', () => {
  it('adds a whole-number quantity and updates progress', () => {
    const s = run(seed(), { type: 'JOIN_POOL', poolId: 'pool-tote', qty: '50', now: NOW });
    expect(getJoinedQty(poolById(s, 'pool-tote'))).toBe(470);
    expect(findMember(poolById(s, 'pool-tote'), 'u-mei')?.heldAtJoinCents).toBeGreaterThan(0);
  });
  it('confirms the pool the moment joined quantity reaches the target', () => {
    const s = run(seed(), { type: 'JOIN_POOL', poolId: 'pool-tote', qty: '80', now: NOW });
    expect(getStatus(poolById(s, 'pool-tote'))).toBe('confirmed');
  });
  it('rejects invalid quantities without changing state', () => {
    const before = seed();
    for (const qty of ['0', '-1', '2.5', 'abc', '<b>', '999999']) {
      const res = applyAction(before, { type: 'JOIN_POOL', poolId: 'pool-tote', qty, now: NOW });
      expect(res.ok).toBe(false);
      expect(res.state).toBe(before);
    }
  });
  it('lets an existing member top up instead of creating a duplicate', () => {
    const s = run(seed(), { type: 'JOIN_POOL', poolId: 'pool-phone', qty: '25', now: NOW });
    const p = poolById(s, 'pool-phone');
    expect(p.members.filter((m) => m.userId === 'u-mei')).toHaveLength(1);
    expect(findMember(p, 'u-mei')?.qty).toBe(75);
  });
  it('rejects joining a closed pool', () => {
    const closed = run(seed(), { type: 'SIMULATE_DEADLINE', poolId: 'pool-box', now: NOW });
    expect(applyAction(closed, { type: 'JOIN_POOL', poolId: 'pool-box', qty: '10', now: NOW }).ok).toBe(false);
  });
});

describe('payment holds (story 3) and "no fee after joining" (story 4)', () => {
  it('releases every hold when the deadline passes below target', () => {
    const s = run(seed(), { type: 'SIMULATE_DEADLINE', poolId: 'pool-box', now: NOW });
    const p = poolById(s, 'pool-box');
    expect(getStatus(p)).toBe('refunded');
    expect(p.closedAt).not.toBeNull();
  });
  it('places the order when the deadline passes at or above target', () => {
    const s = run(seed(), { type: 'SIMULATE_DEADLINE', poolId: 'pool-tshirt', now: NOW });
    expect(getStatus(poolById(s, 'pool-tshirt'))).toBe('confirmed');
  });
  it('closes pools whose real deadline has passed', () => {
    const s = run(seed(), { type: 'CLOSE_EXPIRED', now: NOW + 30 * 3600_000 });
    expect(getStatus(poolById(s, 'pool-box'))).toBe('refunded');
    expect(getStatus(poolById(s, 'pool-tote'))).toBe('filling'); // still open
  });
  it('never raises any member’s hold above what they were shown, across random join sequences', () => {
    // Property-style test: 200 random sequences of joins and leaves by the three demo users.
    let seedValue = 42;
    const rand = () => ((seedValue = (seedValue * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const users = ['u-mei', 'u-arjun', 'u-siti'];
    for (let run_ = 0; run_ < 200; run_++) {
      let s = seed();
      for (let step = 0; step < 12; step++) {
        s = as(s, users[Math.floor(rand() * 3)]);
        const action: Action =
          rand() < 0.8
            ? { type: 'JOIN_POOL', poolId: 'pool-tote', qty: String(1 + Math.floor(rand() * 400)), now: NOW }
            : { type: 'LEAVE_POOL', poolId: 'pool-tote' };
        s = applyAction(s, action).state;
        const p = poolById(s, 'pool-tote');
        const product = s.products.find((x) => x.id === p.productId)!;
        for (const m of p.members) {
          expect(currentHoldCents(product, p, m)).toBeLessThanOrEqual(m.heldAtJoinCents);
        }
      }
    }
  });
});

describe('LEAVE_POOL (story 6)', () => {
  it('removes the member and releases their hold while filling', () => {
    const s = run(seed(), { type: 'LEAVE_POOL', poolId: 'pool-phone' });
    expect(findMember(poolById(s, 'pool-phone'), 'u-mei')).toBeUndefined();
    expect(getJoinedQty(poolById(s, 'pool-phone'))).toBe(100);
  });
  it('is refused once the pool has filled (others rely on the order)', () => {
    const s = as(seed(), 'u-siti');
    const res = applyAction(s, { type: 'LEAVE_POOL', poolId: 'pool-tshirt' });
    expect(res.ok).toBe(false);
  });
  it('is refused for non-members', () => {
    expect(applyAction(seed(), { type: 'LEAVE_POOL', poolId: 'pool-tote' }).ok).toBe(false);
  });
});

describe('the 3-minute demo script, end to end', () => {
  it('start a pool, three users join until Confirmed; a second pool is Refunded at the deadline', () => {
    let s = seed();
    s = run(s, {
      type: 'START_POOL', id: 'pool-demo', productId: 'p-mailer', target: 1000, deadlineDays: 7,
      organiserQty: '300', title: 'Eco mailers for online sellers', note: '', now: NOW,
    });
    s = as(s, 'u-arjun');
    s = run(s, { type: 'JOIN_POOL', poolId: 'pool-demo', qty: '400', now: NOW });
    expect(getStatus(poolById(s, 'pool-demo'))).toBe('filling');
    s = as(s, 'u-siti');
    s = run(s, { type: 'JOIN_POOL', poolId: 'pool-demo', qty: '300', now: NOW });
    expect(getStatus(poolById(s, 'pool-demo'))).toBe('confirmed');

    s = run(s, { type: 'SIMULATE_DEADLINE', poolId: 'pool-box', now: NOW });
    expect(getStatus(poolById(s, 'pool-box'))).toBe('refunded');
  });
});

describe('demo user switcher', () => {
  it('only switches to the three demo users', () => {
    expect(applyAction(seed(), { type: 'SWITCH_USER', userId: 'u-arjun' }).ok).toBe(true);
    expect(applyAction(seed(), { type: 'SWITCH_USER', userId: 'u-priya' }).ok).toBe(false);
  });
});
