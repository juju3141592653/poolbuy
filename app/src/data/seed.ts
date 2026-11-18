/**
 * Turns seed.json (relative times) into an AppState (absolute ISO dates).
 * Seed holds are the amounts members were quoted at the target tier price.
 */
import { computeCostBreakdown } from '../logic/pool';
import type { AppState, Pool, Product, Supplier, User } from '../logic/types';
import seed from './seed.json';

interface SeedMember { userId: string; qty: number; joinedHoursAgo: number }
interface SeedPool {
  id: string;
  productId: string;
  organiserId: string;
  title: string;
  note: string;
  target: number;
  createdHoursAgo: number;
  deadlineInHours: number;
  closedHoursAgo: number | null;
  members: SeedMember[];
}

const HOUR = 3600_000;

export function buildSeedState(now: number = Date.now()): AppState {
  const products = seed.products as Product[];
  const iso = (hoursFromNow: number) => new Date(now + hoursFromNow * HOUR).toISOString();

  const pools: Pool[] = (seed.pools as SeedPool[]).map((sp) => {
    const product = products.find((p) => p.id === sp.productId);
    if (!product) throw new Error(`Seed pool ${sp.id} has unknown product ${sp.productId}`);
    const tier = product.tiers.find((t) => t.minQty === sp.target);
    if (!tier) throw new Error(`Seed pool ${sp.id} target is not a tier`);
    return {
      id: sp.id,
      productId: sp.productId,
      organiserId: sp.organiserId,
      title: sp.title,
      note: sp.note,
      target: sp.target,
      cap: product.maxOrderQty,
      createdAt: iso(-sp.createdHoursAgo),
      deadline: iso(sp.deadlineInHours),
      closedAt: sp.closedHoursAgo === null ? null : iso(-sp.closedHoursAgo),
      members: sp.members.map((m) => ({
        userId: m.userId,
        qty: m.qty,
        joinedAt: iso(-m.joinedHoursAgo),
        heldAtJoinCents: computeCostBreakdown(m.qty, tier.unitPriceCents, product.shippingPerUnitCents).totalCents,
      })),
    };
  });

  return {
    pools,
    products,
    suppliers: seed.suppliers as Supplier[],
    users: seed.users as User[],
    currentUserId: 'u-mei',
  };
}
