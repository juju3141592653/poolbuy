/**
 * Input validation and sanitisation (security check 1).
 *
 * React already escapes text when rendering, which blocks most injected HTML.
 * These checks are a second layer: they reject bad input at the edge so that
 * nothing unexpected is ever stored, and give users a clear message.
 */
import {
  MAX_DEADLINE_DAYS,
  MAX_NOTE_LENGTH,
  MAX_QUANTITY_DIGITS,
  MAX_TITLE_LENGTH,
  MIN_DEADLINE_DAYS,
} from './config';

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = <T>(error: string): Result<T> => ({ ok: false, error });

/**
 * Parse a quantity typed by the user (or read from the URL).
 * Accepts only a whole number between 1 and `max`. Rejects decimals,
 * negatives, exponents ("1e3"), spaces inside, scripts and empty input.
 */
export function parseQuantity(raw: unknown, max: number): Result<number> {
  if (typeof raw !== 'string' && typeof raw !== 'number') return fail('Enter a quantity.');
  const text = String(raw).trim();
  if (text === '') return fail('Enter a quantity.');
  if (!/^\d+$/.test(text)) return fail('Quantity must be a whole number, like 100.');
  if (text.length > MAX_QUANTITY_DIGITS) return fail(`Quantity can't be more than ${max.toLocaleString()}.`);
  const qty = Number.parseInt(text, 10);
  if (qty < 1) return fail('Quantity must be at least 1.');
  if (max < 1) return fail('This pool has no units left.');
  if (qty > max) return fail(`Only ${max.toLocaleString()} units are left in this pool.`);
  return ok(qty);
}

/**
 * The organiser's own quantity when starting a pool. They must commit at least
 * one unit, and less than the target (if they need the full MOQ they can order alone).
 */
export function parseOrganiserQuantity(raw: unknown, target: number): Result<number> {
  const parsed = parseQuantity(raw, Math.max(0, target - 1));
  if (!parsed.ok && /^\d+$/.test(String(raw).trim()) && Number(String(raw).trim()) >= target) {
    return fail(`You need fewer than ${target.toLocaleString()} units to start a pool. At ${target.toLocaleString()} or more you can order directly.`);
  }
  return parsed;
}

/** Characters and patterns we never accept in free text. */
const FORBIDDEN = [
  { re: /[<>]/, why: 'angle brackets (< >)' },
  { re: /javascript\s*:/i, why: '"javascript:"' },
  { re: /data\s*:\s*text\/html/i, why: '"data:text/html"' },
  { re: /\bon[a-z]+\s*=/i, why: 'HTML event attributes' },
  // eslint-disable-next-line no-control-regex
  { re: /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/, why: 'control characters' },
];

/**
 * Clean a free-text field (pool title or note).
 * Trims, collapses repeated whitespace, enforces a length limit and rejects
 * anything that looks like markup or script.
 */
export function sanitizeText(raw: unknown, maxLength: number, fieldName: string, required = false): Result<string> {
  if (raw === undefined || raw === null) raw = '';
  if (typeof raw !== 'string') return fail(`${fieldName} must be text.`);
  const text = raw.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (required && text === '') return fail(`${fieldName} is required.`);
  if (text.length > maxLength) return fail(`${fieldName} must be ${maxLength} characters or fewer.`);
  for (const rule of FORBIDDEN) {
    if (rule.re.test(text)) return fail(`${fieldName} can't contain ${rule.why}.`);
  }
  return ok(text);
}

export const sanitizeTitle = (raw: unknown) => sanitizeText(raw, MAX_TITLE_LENGTH, 'Pool title');
export const sanitizeNote = (raw: unknown) => sanitizeText(raw, MAX_NOTE_LENGTH, 'Note');

/** Pool length must be a whole number of days from 3 to 14 (user story 1). */
export function parseDeadlineDays(raw: unknown): Result<number> {
  const text = String(raw ?? '').trim();
  if (!/^\d+$/.test(text)) return fail('Choose how many days the pool stays open.');
  const days = Number.parseInt(text, 10);
  if (days < MIN_DEADLINE_DAYS || days > MAX_DEADLINE_DAYS) {
    return fail(`A pool must stay open for ${MIN_DEADLINE_DAYS} to ${MAX_DEADLINE_DAYS} days.`);
  }
  return ok(days);
}

/** IDs from the URL must match our own format before we look anything up. */
export function isSafeId(raw: unknown): raw is string {
  return typeof raw === 'string' && /^[a-z0-9-]{1,40}$/.test(raw);
}
