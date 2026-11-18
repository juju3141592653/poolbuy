/** Store context and the hooks screens use to read it. */
import { createContext, useContext, useMemo } from 'react';
import type { Action, ActionResult } from '../logic/actions';
import type { AppState } from '../logic/types';

export interface Flash {
  kind: 'success' | 'info' | 'error';
  text: string;
}

export interface StoreValue {
  state: AppState;
  now: number;
  dispatch: (action: Action) => ActionResult;
  reset: () => void;
  flash: Flash | null;
  setFlash: (flash: Flash | null) => void;
  /** Free-text filter for the pool list (kept in memory only). */
  search: string;
  setSearch: (search: string) => void;
}

export const StoreContext = createContext<StoreValue | null>(null);

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}

/** Convenience lookups used across pages. */
export function useLookups() {
  const { state } = useStore();
  return useMemo(() => {
    const product = (id: string) => state.products.find((p) => p.id === id);
    const supplier = (id: string) => state.suppliers.find((s) => s.id === id);
    const user = (id: string) => state.users.find((u) => u.id === id);
    const currentUser = state.users.find((u) => u.id === state.currentUserId)!;
    return { product, supplier, user, currentUser };
  }, [state]);
}
