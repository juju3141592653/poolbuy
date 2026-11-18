/**
 * App-wide state: wraps the pure `applyAction` in React state, persists the
 * demo to localStorage (if the browser allows it) and ticks a clock so that
 * time-left labels update and expired pools close on their own.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { buildSeedState } from '../data/seed';
import { applyAction } from '../logic/actions';
import type { Action, ActionResult } from '../logic/actions';
import { STORAGE_KEY } from '../logic/config';
import type { AppState } from '../logic/types';
import { StoreContext } from './context';
import type { Flash } from './context';

/** Read saved demo state. Storage can be missing or blocked, so every access is guarded. */
function loadState(): AppState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppState;
    if (!parsed || !Array.isArray(parsed.pools) || typeof parsed.currentUserId !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveState(state: AppState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable (private mode, sandboxed preview): the demo still works in memory.
  }
}

export function StoreProvider({ children, initialState }: { children: ReactNode; initialState?: AppState }) {
  const [state, setState] = useState<AppState>(() => {
    const start = initialState ?? loadState() ?? buildSeedState();
    // Close anything whose deadline passed while the tab was shut.
    return applyAction(start, { type: 'CLOSE_EXPIRED', now: Date.now() }).state;
  });
  const [now, setNow] = useState(() => Date.now());
  const [flash, setFlash] = useState<Flash | null>(null);
  const [search, setSearch] = useState('');
  // Latest state for dispatch; updated synchronously in dispatch/reset so rapid actions never read stale state.
  const stateRef = useRef(state);

  const dispatch = useCallback((action: Action): ActionResult => {
    const result = applyAction(stateRef.current, action);
    if (result.ok && result.state !== stateRef.current) {
      stateRef.current = result.state;
      setState(result.state);
    }
    return result;
  }, []);

  const reset = useCallback(() => {
    const fresh = buildSeedState();
    stateRef.current = fresh;
    setState(fresh);
    setFlash({ kind: 'info', text: 'Demo data reset.' });
  }, []);

  useEffect(() => {
    if (!initialState) saveState(state);
  }, [state, initialState]);

  // Clock: refresh labels and auto-close pools every 30 seconds.
  useEffect(() => {
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      dispatch({ type: 'CLOSE_EXPIRED', now: t });
    }, 30_000);
    return () => window.clearInterval(id);
  }, [dispatch]);

  const value = useMemo(
    () => ({ state, now, dispatch, reset, flash, setFlash, search, setSearch }),
    [state, now, dispatch, reset, flash, search],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
