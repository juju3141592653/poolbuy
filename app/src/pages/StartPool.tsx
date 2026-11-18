/** Screen 3: start a pool. Product, target tier (= supplier MOQ), deadline and your own quantity. */
import { useState } from 'react';
import { PageHeading } from '../components/Layout';
import { SupplierBadges } from '../components/PoolBits';
import { ProductImage } from '../components/ProductImage';
import { DEFAULT_DEADLINE_DAYS, MAX_DEADLINE_DAYS, MAX_NOTE_LENGTH, MAX_TITLE_LENGTH, MIN_DEADLINE_DAYS } from '../logic/config';
import { formatCents, formatPercent } from '../logic/money';
import { computeCostBreakdown, priceForQty } from '../logic/pool';
import { parseOrganiserQuantity, sanitizeNote, sanitizeTitle } from '../logic/validation';
import { clockNow, formatDate } from '../logic/format';
import { navigate } from '../state/router';
import { useLookups, useStore } from '../state/context';

const DAY_OPTIONS = Array.from({ length: MAX_DEADLINE_DAYS - MIN_DEADLINE_DAYS + 1 }, (_, i) => MIN_DEADLINE_DAYS + i);

function FieldError({ id, text }: { id: string; text?: string }) {
  if (!text) return null;
  return <p id={id} className="mt-1 text-sm font-medium text-danger">{text}</p>;
}

export function StartPool() {
  const { state, now, dispatch, setFlash } = useStore();
  const { supplier } = useLookups();
  const [productId, setProductId] = useState('');
  const [target, setTarget] = useState<number | null>(null);
  const [days, setDays] = useState(DEFAULT_DEADLINE_DAYS);
  const [qtyText, setQtyText] = useState('');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState('');

  const product = state.products.find((p) => p.id === productId);
  const sup = product ? supplier(product.supplierId) : undefined;
  const eligible = !!sup?.verified && !!sup?.tradeAssurance;
  const tier = product?.tiers.find((t) => t.minQty === target);

  const qty = tier ? parseOrganiserQuantity(qtyText, tier.minQty) : null;
  const titleCheck = sanitizeTitle(title);
  const noteCheck = sanitizeNote(note);
  const errors = {
    product: !product ? 'Choose a product.' : !eligible ? 'This supplier isn’t verified, so pools aren’t available for it yet.' : '',
    target: product && eligible && !tier ? 'Choose a price tier to pool for.' : '',
    qty: tier && qty && !qty.ok ? qty.error : '',
    title: titleCheck.ok ? '' : titleCheck.error,
    note: noteCheck.ok ? '' : noteCheck.error,
  };
  const valid = !errors.product && !errors.target && !!qty?.ok && !errors.title && !errors.note;
  const show = (k: keyof typeof errors) => (submitted || k === 'title' || k === 'note' ? errors[k] : '');

  const deadlinePreview = now + days * 86_400_000; // uses the store's ticking clock, not Date.now() in render
  const myBreakdown = tier && qty?.ok ? computeCostBreakdown(qty.value, tier.unitPriceCents, product!.shippingPerUnitCents) : null;
  const alonePrice = product && qty?.ok ? priceForQty(product.tiers, qty.value) : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setFormError('');
    if (!valid || !product || !tier) return;
    const startedAt = clockNow();
    const id = `pool-${startedAt.toString(36)}`;
    const res = dispatch({
      type: 'START_POOL',
      id,
      productId: product.id,
      target: tier.minQty,
      deadlineDays: days,
      organiserQty: qtyText,
      title,
      note,
      now: startedAt,
    });
    if (!res.ok) {
      setFormError(res.error);
      return;
    }
    setFlash({ kind: 'success', text: 'Your pool is live and listed. Share the invite link so other sellers can join.' });
    navigate(`/pool/${id}`);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeading sub="Pick a listing and the price tier you want. Other sellers fill the rest of the order.">Start a pool</PageHeading>

      <form noValidate onSubmit={submit} className="flex flex-col gap-6">
        {/* Product */}
        <fieldset className="rounded-lg border border-line bg-surface p-5">
          <legend className="px-1 text-base font-bold text-ink">1. Product</legend>
          <p className="mb-3 text-sm text-muted">Only listings from verified suppliers with Trade Assurance can be pooled.</p>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-describedby={show('product') ? 'product-error' : undefined}>
            {state.products.map((p) => {
              const s = supplier(p.supplierId)!;
              const ok = s.verified && s.tradeAssurance;
              const checked = p.id === productId;
              return (
                <label
                  key={p.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-2.5 ${
                    checked ? 'border-primary bg-primary-tint ring-2 ring-primary' : 'border-line-strong'
                  } ${ok ? (checked ? '' : 'bg-surface hover:border-primary') : 'cursor-not-allowed bg-canvas opacity-70'}`}
                >
                  <input
                    type="radio"
                    name="product"
                    value={p.id}
                    checked={checked}
                    disabled={!ok}
                    onChange={() => {
                      setProductId(p.id);
                      setTarget(p.tiers.length > 1 ? p.tiers[1].minQty : p.tiers[0].minQty);
                    }}
                    className="h-4 w-4 accent-[#FF8A3D]"
                  />
                  <ProductImage kind={p.image} className="h-11 w-14 shrink-0 overflow-hidden rounded" />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">{p.shortName}</span>
                    <span className="block truncate text-xs text-muted">
                      {ok ? `${s.name} · from ${p.tiers[0].minQty} units` : 'Supplier not verified: not available'}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          <FieldError id="product-error" text={show('product')} />
          {product && sup && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink">
              <span className="font-semibold">{sup.name}</span> · {sup.location}
              <SupplierBadges supplier={sup} />
            </div>
          )}
        </fieldset>

        {/* Target tier */}
        {product && eligible && (
          <fieldset className="rounded-lg border border-line bg-surface p-5">
            <legend className="px-1 text-base font-bold text-ink">2. Pool target</legend>
            <p className="mb-3 text-sm text-muted">
              The target is the supplier’s minimum order for that price. The unit price is fixed by the supplier’s tier, so nobody can change it.
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {product.tiers.map((t) => (
                <label
                  key={t.minQty}
                  className={`flex cursor-pointer flex-col rounded-lg border p-3 ${
                    target === t.minQty ? 'border-primary bg-primary-tint ring-2 ring-primary' : 'border-line-strong hover:border-primary'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="target"
                      value={t.minQty}
                      checked={target === t.minQty}
                      onChange={() => setTarget(t.minQty)}
                      className="h-4 w-4 accent-[#FF8A3D]"
                    />
                    <span className="font-bold text-ink">{t.minQty.toLocaleString()} units</span>
                  </span>
                  <span className="ml-6 text-sm text-ink">{formatCents(t.unitPriceCents)} per unit</span>
                </label>
              ))}
            </div>
            <FieldError id="target-error" text={show('target')} />
          </fieldset>
        )}

        {tier && product && (
          <>
            <fieldset className="rounded-lg border border-line bg-surface p-5">
              <legend className="px-1 text-base font-bold text-ink">3. Your quantity and deadline</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="org-qty" className="block font-semibold text-ink">How many units do you need?</label>
                  <p id="org-qty-help" className="text-sm text-muted">At least 1, fewer than {tier.minQty.toLocaleString()}.</p>
                  <input
                    id="org-qty"
                    inputMode="numeric"
                    autoComplete="off"
                    value={qtyText}
                    onChange={(e) => setQtyText(e.target.value)}
                    aria-invalid={!!show('qty')}
                    aria-describedby={`org-qty-help${show('qty') ? ' org-qty-error' : ''}`}
                    className="mt-2 min-h-11 w-full rounded-md border border-line-strong bg-canvas px-3 text-lg font-semibold text-ink placeholder:font-normal placeholder:text-[#a8a29a]"
                    placeholder="e.g. 300"
                  />
                  <FieldError id="org-qty-error" text={show('qty')} />
                </div>
                <div>
                  <label htmlFor="days" className="block font-semibold text-ink">Pool stays open for</label>
                  <p id="days-help" className="text-sm text-muted">{MIN_DEADLINE_DAYS} to {MAX_DEADLINE_DAYS} days.</p>
                  <select
                    id="days"
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
                    aria-describedby="days-help"
                    className="mt-2 min-h-11 w-full rounded-md border border-line-strong bg-canvas px-3 text-base font-semibold text-ink"
                  >
                    {DAY_OPTIONS.map((d) => (
                      <option key={d} value={d}>{d} days</option>
                    ))}
                  </select>
                  <p className="mt-1 text-sm text-muted">Closes {formatDate(deadlinePreview)}</p>
                </div>
              </div>
            </fieldset>

            <fieldset className="rounded-lg border border-line bg-surface p-5">
              <legend className="px-1 text-base font-bold text-ink">4. Tell other sellers (optional)</legend>
              <label htmlFor="title" className="block font-semibold text-ink">Pool title</label>
              <input
                id="title"
                value={title}
                maxLength={MAX_TITLE_LENGTH + 20}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={product.shortName}
                aria-invalid={!!show('title')}
                aria-describedby={show('title') ? 'title-error' : undefined}
                className="mt-1 min-h-11 w-full rounded-md border border-line-strong bg-canvas px-3 text-ink placeholder:text-[#a8a29a]"
              />
              <FieldError id="title-error" text={show('title')} />
              <label htmlFor="note" className="mt-4 block font-semibold text-ink">Note</label>
              <textarea
                id="note"
                value={note}
                rows={2}
                maxLength={MAX_NOTE_LENGTH + 50}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. For café and bakery owners. Collection at the Jurong East hub."
                aria-invalid={!!show('note')}
                aria-describedby={show('note') ? 'note-error' : undefined}
                className="mt-1 w-full rounded-md border border-line-strong bg-canvas px-3 py-2 text-ink placeholder:text-[#a8a29a]"
              />
              <FieldError id="note-error" text={show('note')} />
              <p className="mt-1 text-xs text-muted">{note.length}/{MAX_NOTE_LENGTH} characters. Plain text only.</p>
            </fieldset>

            <section aria-label="Summary" className="rounded-lg bg-primary-tint p-5 text-ink ring-1 ring-inset ring-primary-soft">
              <h2 className="font-bold">Your pool</h2>
              <p className="mt-1">
                {tier.minQty.toLocaleString()} × {product.shortName.toLowerCase()} at {formatCents(tier.unitPriceCents)} each, open for {days} days.
              </p>
              {myBreakdown && (
                <p className="mt-1">
                  You commit {myBreakdown.qty.toLocaleString()} units: <span className="font-semibold">{formatCents(myBreakdown.totalCents)} held</span> including
                  shipping, fee and GST
                  {alonePrice !== null && alonePrice > tier.unitPriceCents
                    ? `. Alone you’d pay ${formatCents(alonePrice)} per unit, so the pool cuts your unit price by ${formatPercent(1 - tier.unitPriceCents / alonePrice)}.`
                    : alonePrice === null
                      ? '. That’s too few to buy alone from this supplier.'
                      : '.'}
                </p>
              )}
              <p className="mt-2 text-sm">Your money is held, not taken. If the pool misses its target, every hold is released.</p>
            </section>
          </>
        )}

        {formError && <p role="alert" className="font-medium text-danger">{formError}</p>}
        {submitted && !valid && <p role="alert" className="font-medium text-danger">Please fix the highlighted fields.</p>}

        <div className="flex justify-end">
          <button
            type="submit"
            data-testid="start-pool-submit"
            className="min-h-12 rounded-lg bg-primary px-6 text-base font-bold text-on-primary hover:bg-primary-hover"
          >
            Start pool
          </button>
        </div>
      </form>
    </div>
  );
}
