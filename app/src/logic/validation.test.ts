/** Security check 1 (input sanitisation): every bad input is rejected with a clear message. */
import { describe, expect, it } from 'vitest';
import { isSafeId, parseDeadlineDays, parseOrganiserQuantity, parseQuantity, sanitizeNote, sanitizeTitle } from './validation';

describe('parseQuantity: whole number from 1 to units remaining', () => {
  it.each([
    ['1', 1],
    ['80', 80],
    ['  200 ', 200],
    [150, 150],
  ])('accepts %j', (raw, expected) => {
    expect(parseQuantity(raw, 500)).toEqual({ ok: true, value: expected });
  });

  it.each([
    [''],
    ['   '],
    ['0'],
    ['-5'],
    ['1.5'],
    ['1e3'],
    ['0x10'],
    ['12abc'],
    ['1 000'],
    ['<script>alert(1)</script>'],
    ['NaN'],
    ['Infinity'],
    [null],
    [undefined],
    [{}],
    [[]],
  ])('rejects %j', (raw) => {
    expect(parseQuantity(raw, 500).ok).toBe(false);
  });

  it('rejects more than the units remaining', () => {
    const r = parseQuantity('81', 80);
    expect(r).toEqual({ ok: false, error: 'Only 80 units are left in this pool.' });
  });
  it('rejects absurdly long numbers before parsing', () => {
    expect(parseQuantity('99999999999999999999', 500).ok).toBe(false);
  });
  it('rejects any quantity when nothing is left', () => {
    expect(parseQuantity('1', 0).ok).toBe(false);
  });
});

describe('parseOrganiserQuantity', () => {
  it('needs at least 1 and fewer than the target', () => {
    expect(parseOrganiserQuantity('300', 1000)).toEqual({ ok: true, value: 300 });
    expect(parseOrganiserQuantity('999', 1000).ok).toBe(true);
    expect(parseOrganiserQuantity('0', 1000).ok).toBe(false);
  });
  it('explains that a full-MOQ buyer can order directly', () => {
    const r = parseOrganiserQuantity('1000', 1000);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/order directly/);
  });
});

describe('sanitizeText: text fields reject scripts', () => {
  it('trims and collapses whitespace', () => {
    expect(sanitizeTitle('  Kraft   boxes \n for bakers ')).toEqual({ ok: true, value: 'Kraft boxes for bakers' });
  });
  it('allows ordinary punctuation and non-English text', () => {
    expect(sanitizeNote('Pick-up at Jurong East, 10am–6pm. Café & bakery owners welcome! 你好').ok).toBe(true);
  });
  it.each([
    ['<script>alert("x")</script>'],
    ['<img src=x onerror=alert(1)>'],
    ['hello onclick=steal()'],
    ['javascript:alert(1)'],
    ['JaVaScRiPt :alert(1)'],
    ['data:text/html;base64,PHNjcmlwdD4='],
    ['a > b'],
    ['bell\u0007'],
  ])('rejects %j', (raw) => {
    expect(sanitizeNote(raw).ok).toBe(false);
  });
  it('enforces length limits', () => {
    expect(sanitizeTitle('x'.repeat(60)).ok).toBe(true);
    expect(sanitizeTitle('x'.repeat(61)).ok).toBe(false);
    expect(sanitizeNote('x'.repeat(201)).ok).toBe(false);
  });
  it('rejects non-text values', () => {
    expect(sanitizeTitle(42).ok).toBe(false);
    expect(sanitizeTitle(undefined)).toEqual({ ok: true, value: '' });
  });
});

describe('other inputs', () => {
  it('deadline must be 3 to 14 whole days', () => {
    expect(parseDeadlineDays('3').ok).toBe(true);
    expect(parseDeadlineDays('14').ok).toBe(true);
    expect(parseDeadlineDays('2').ok).toBe(false);
    expect(parseDeadlineDays('15').ok).toBe(false);
    expect(parseDeadlineDays('7.5').ok).toBe(false);
  });
  it('ids from the URL must match our own format', () => {
    expect(isSafeId('pool-tote')).toBe(true);
    expect(isSafeId('../../etc/passwd')).toBe(false);
    expect(isSafeId('<script>')).toBe(false);
    expect(isSafeId('a'.repeat(41))).toBe(false);
  });
});
