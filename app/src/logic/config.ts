/**
 * Business rules for PoolBuy, kept in one place so the team can change them
 * without touching the logic. Every value here is a product decision that is
 * explained in Section 8 of the report.
 */

/** Singapore GST rate (9% since 1 Jan 2024), applied to goods + shipping + fee. */
export const GST_RATE = 0.09;

/**
 * Platform service fee on the goods subtotal.
 * Pricing option B from the GTM plan (2% per pool). Set to 0 for option A
 * ("free for buyers"). The fee is always shown before joining and can never
 * be added after joining (ethical user story 4).
 */
export const SERVICE_FEE_RATE = 0.02;

/** Allowed pool lengths in days (user story 1 acceptance criterion). */
export const MIN_DEADLINE_DAYS = 3;
export const MAX_DEADLINE_DAYS = 14;
export const DEFAULT_DEADLINE_DAYS = 7;

/** Text field limits (input sanitisation, security check 1). */
export const MAX_TITLE_LENGTH = 60;
export const MAX_NOTE_LENGTH = 200;

/** Largest quantity any single input may contain (guards against absurd values). */
export const MAX_QUANTITY_DIGITS = 6;

/** A pool closing within this many hours is labelled "Closing soon". */
export const CLOSING_SOON_HOURS = 24;

/** localStorage key for the demo state (bump the version to force a reset). */
export const STORAGE_KEY = 'poolbuy-demo-v1';
