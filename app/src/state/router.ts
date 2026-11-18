/**
 * Minimal hash router (#/pool/abc). Hash routing works on any static host and
 * needs no extra dependency.
 *
 * Navigation also works in memory: when the app is embedded in a sandboxed
 * frame that ignores or restricts hash changes, links still switch screens.
 */
import { useEffect, useState } from 'react';
import { isSafeId } from '../logic/validation';

export type Route =
  | { name: 'list' }
  | { name: 'detail'; poolId: string }
  | { name: 'join'; poolId: string; qty: string }
  | { name: 'start' }
  | { name: 'my' }
  | { name: 'notFound' };

export function parseHash(hash: string): Route {
  const clean = hash.replace(/^#/, '') || '/';
  const [path, query = ''] = clean.split('?');
  const params = new URLSearchParams(query);
  const parts = path.split('/').filter(Boolean);

  if (parts.length === 0) return { name: 'list' };
  if (parts[0] === 'start' && parts.length === 1) return { name: 'start' };
  if (parts[0] === 'my' && parts.length === 1) return { name: 'my' };
  if (parts[0] === 'pool' && isSafeId(parts[1])) {
    if (parts.length === 2) return { name: 'detail', poolId: parts[1] };
    // The quantity stays a raw string here; the page validates it before use.
    if (parts.length === 3 && parts[2] === 'join') return { name: 'join', poolId: parts[1], qty: params.get('qty') ?? '' };
  }
  return { name: 'notFound' };
}

const NAV_EVENT = 'poolbuy:navigate';

/** Go to a path like "/pool/pool-tote". Updates the hash when allowed, and always the in-memory route. */
export function navigate(path: string): void {
  const hash = path.startsWith('#') ? path : `#${path}`;
  try {
    if (window.location.hash !== hash) window.history.pushState(null, '', hash);
  } catch {
    // Sandboxed frame: history may be blocked. The in-memory route below still works.
  }
  window.dispatchEvent(new CustomEvent<string>(NAV_EVENT, { detail: hash }));
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const show = (hash: string) => {
      setRoute(parseHash(hash));
      window.scrollTo({ top: 0 });
    };
    const onHash = () => show(window.location.hash);
    const onNav = (e: Event) => show((e as CustomEvent<string>).detail);
    // Route in-app links ourselves so they work even where hash changes are restricted.
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.('a[href^="#/"], a[href="#"]');
      if (!link) return;
      e.preventDefault();
      navigate(link.getAttribute('href') === '#' ? '/' : link.getAttribute('href')!.slice(1));
    };
    window.addEventListener('hashchange', onHash);
    window.addEventListener('popstate', onHash);
    window.addEventListener(NAV_EVENT, onNav);
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('popstate', onHash);
      window.removeEventListener(NAV_EVENT, onNav);
      document.removeEventListener('click', onClick);
    };
  }, []);
  return route;
}
