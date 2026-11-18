/** Display helpers shared by several screens. */
import { getStatus, isClosed } from './pool';
import type { Pool } from './types';

const dateFmt = new Intl.DateTimeFormat('en-SG', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

/** "Sun, 22 Nov, 7:41 pm" */
export const formatDate = (iso: string | number | Date) => dateFmt.format(new Date(iso));

/** One-line explanation of where a pool is in its life. */
export function statusDetail(pool: Pool): string {
  const status = getStatus(pool);
  if (status === 'filling') return 'Payments held, not taken';
  if (status === 'refunded') return 'Missed target, every hold released';
  return isClosed(pool) ? 'Order placed with supplier' : 'Target reached, order will go ahead';
}

/** Wall-clock time for event handlers (kept out of render so components stay pure). */
export const clockNow = () => Date.now();
