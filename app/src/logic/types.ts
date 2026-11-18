/**
 * Domain types. All money is stored as integer cents (US$) so that sums,
 * fees and GST never suffer from floating-point rounding errors.
 */

export type Category = 'Packaging' | 'Apparel' | 'Accessories';

/** One step in a supplier's volume pricing, e.g. 500+ units at US$1.50. */
export interface PriceTier {
  minQty: number;
  unitPriceCents: number;
}

export interface Supplier {
  id: string;
  name: string;
  location: string;
  yearsOnPlatform: number;
  verified: boolean;
  tradeAssurance: boolean;
}

/** A supplier listing that a pool can be started for (mock catalogue). */
export interface Product {
  id: string;
  name: string;
  shortName: string;
  category: Category;
  image: ProductImageKey;
  supplierId: string;
  description: string;
  /** Sorted ascending by minQty. The first tier is the supplier's MOQ. */
  tiers: PriceTier[];
  /** Estimated freight to the Singapore hub plus split-and-deliver, per unit. */
  shippingPerUnitCents: number;
  /** The most the supplier will make in one run; caps the pool size. */
  maxOrderQty: number;
}

export type ProductImageKey =
  | 'tote'
  | 'box'
  | 'tshirt'
  | 'phonecase'
  | 'mailer'
  | 'jar'
  | 'label';

export interface User {
  id: string;
  /** Shown to other sellers. First name + initial only (privacy by design). */
  displayName: string;
  fullName: string;
  business: string;
  /** Only demo users can be selected in the user switcher. */
  isDemoUser: boolean;
}

export interface Member {
  userId: string;
  qty: number;
  joinedAt: string; // ISO date
  /**
   * The amount shown on the confirmation screen when this member (last) joined.
   * The live hold may fall below this as deeper tiers unlock, but must never
   * rise above it ("no fee may be added after joining").
   */
  heldAtJoinCents: number;
}

export interface Pool {
  id: string;
  productId: string;
  organiserId: string;
  title: string;
  note: string;
  /** Units needed for the pool to go ahead = the supplier MOQ of the chosen tier. */
  target: number;
  /** Maximum units the pool can take (supplier capacity). */
  cap: number;
  createdAt: string; // ISO
  deadline: string; // ISO
  /** Set when the deadline passes (or is simulated). A closed pool takes no changes. */
  closedAt: string | null;
  members: Member[];
}

/** The three statuses users see, always shown as text (WCAG: not colour alone). */
export type PoolStatus = 'filling' | 'confirmed' | 'refunded';

export interface AppState {
  pools: Pool[];
  products: Product[];
  suppliers: Supplier[];
  users: User[];
  currentUserId: string;
}
