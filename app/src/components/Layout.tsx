/** Page chrome: utility bar with the demo-user switcher, main header with search and navigation, flash banner, footer. */
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { findMember, isClosed } from '../logic/pool';
import { useLookups, useStore } from '../state/context';
import type { Route } from '../state/router';
import { navigate } from '../state/router';
import { CheckIcon, InfoIcon, SearchIcon } from './Icons';

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="7" fill="#B66335" />
      <circle cx="12.5" cy="16" r="6.5" fill="#F8F5F1" />
      <circle cx="19.5" cy="16" r="6.5" fill="#FF8A3D" fillOpacity=".95" />
    </svg>
  );
}

function Logo() {
  return (
    <a href="#/" className="flex shrink-0 items-center gap-2 rounded-md focus-visible:outline-offset-4" aria-label="PoolBuy home">
      <LogoMark />
      <span className="text-[22px] font-extrabold tracking-tight text-ink">PoolBuy</span>
    </a>
  );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <a
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`relative inline-flex min-h-11 items-center gap-1.5 px-3 text-sm font-semibold ${
        active ? 'text-primary after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:rounded-full after:bg-primary' : 'text-ink hover:text-primary'
      }`}
    >
      {children}
    </a>
  );
}

function SearchBox({ route }: { route: Route }) {
  const { search, setSearch } = useStore();
  return (
    <form
      role="search"
      className="order-last flex w-full md:order-none md:max-w-md md:flex-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (route.name !== 'list') navigate('/');
      }}
    >
      <label htmlFor="pool-search" className="sr-only">Search pools</label>
      <input
        id="pool-search"
        type="search"
        value={search}
        maxLength={60}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search pools: tote bags, mailers, T-shirts"
        className="min-h-11 w-full rounded-l-md border border-r-0 border-line-strong bg-canvas px-3 text-sm text-ink placeholder:text-[#a8a29a]"
      />
      <button type="submit" className="inline-flex min-h-11 items-center gap-1.5 rounded-r-md bg-primary px-4 text-sm font-semibold text-on-primary hover:bg-primary-hover">
        <SearchIcon /> Search
      </button>
    </form>
  );
}

export function Header({ route }: { route: Route }) {
  const { state, dispatch, setFlash } = useStore();
  const { currentUser } = useLookups();
  const demoUsers = state.users.filter((u) => u.isDemoUser);
  const isList = route.name === 'list' || route.name === 'detail' || route.name === 'join';
  const myOpen = state.pools.filter((p) => !isClosed(p) && findMember(p, state.currentUserId)).length;

  return (
    <header className="sticky top-0 z-20">
      <div className="border-b border-line bg-[#0d0e11] text-[13px] text-muted">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-1.5">
          <p className="hidden sm:block">Group buying for small sellers · a student concept for Alibaba.com</p>
          <div className="ml-auto flex items-center gap-2">
            <label htmlFor="demo-user" className="font-medium">Demo user</label>
            <select
              id="demo-user"
              value={currentUser.id}
              onChange={(e) => {
                const res = dispatch({ type: 'SWITCH_USER', userId: e.target.value });
                const u = res.state.users.find((x) => x.id === e.target.value);
                if (res.ok && u) setFlash({ kind: 'info', text: `You are now ${u.fullName} (${u.business}).` });
              }}
              className="min-h-9 rounded-md border border-line-strong bg-raised px-2 text-sm font-semibold text-ink"
              data-testid="user-switcher"
            >
              {demoUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.fullName}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <div className="border-b border-line bg-canvas shadow-[0_1px_0_rgba(0,0,0,0.4)]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
          <Logo />
          <SearchBox route={route} />
          <nav aria-label="Main" className="ml-auto flex">
            <NavLink href="#/" active={isList}>Browse pools</NavLink>
            <NavLink href="#/start" active={route.name === 'start'}>Start a pool</NavLink>
            <NavLink href="#/my" active={route.name === 'my'}>
              My pools
              {myOpen > 0 && (
                <span className="rounded-full bg-primary px-1.5 text-xs font-bold text-on-primary" aria-label={`${myOpen} open`}>{myOpen}</span>
              )}
            </NavLink>
          </nav>
        </div>
      </div>
    </header>
  );
}

export function FlashBanner() {
  const { flash, setFlash } = useStore();
  useEffect(() => {
    if (!flash) return;
    const id = window.setTimeout(() => setFlash(null), 9000);
    return () => window.clearTimeout(id);
  }, [flash, setFlash]);

  const style =
    flash?.kind === 'success'
      ? 'border-success-line bg-success-tint text-ink'
      : flash?.kind === 'error'
        ? 'border-danger-line bg-danger-tint text-ink'
        : 'border-primary-soft bg-primary-tint text-ink';

  return (
    <div aria-live="polite" role="status" className="mx-auto max-w-7xl px-4">
      {flash && (
        <div className={`mt-4 flex items-start gap-2 rounded-md border px-4 py-3 text-sm font-medium ${style}`} data-testid="flash">
          {flash.kind === 'success' ? <CheckIcon className="mt-0.5 shrink-0 text-success" /> : <InfoIcon className={`mt-0.5 shrink-0 ${flash.kind === 'error' ? 'text-danger' : 'text-primary'}`} />}
          <span className="flex-1">{flash.text}</span>
          <button type="button" onClick={() => setFlash(null)} className="-my-1 rounded px-2 py-1 text-xs font-semibold underline underline-offset-2">
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

export function Footer() {
  const { reset } = useStore();
  return (
    <footer className="mt-16 border-t border-line bg-[#111317]">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <LogoMark size={24} />
          <div>
            <p className="font-semibold text-ink">Student concept prototype for SC4025. Not affiliated with Alibaba.</p>
            <p>Mock data only: all suppliers, sellers and prices are made up, and no real payment is taken.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={reset}
          className="min-h-11 self-start rounded-md border border-line-strong bg-transparent px-3 font-semibold text-ink hover:border-primary hover:text-primary sm:self-auto"
        >
          Reset demo data
        </button>
      </div>
    </footer>
  );
}

/** Moves focus to the page heading after navigation so screen-reader users hear the new page. */
export function PageHeading({ children, sub, eyebrow, compact = false }: { children: ReactNode; sub?: ReactNode; eyebrow?: ReactNode; compact?: boolean }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div className={compact ? 'mb-3 mt-1' : 'mb-6'}>
      {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">{eyebrow}</p>}
      <h1 ref={ref} tabIndex={-1} className="text-2xl font-bold tracking-tight text-ink outline-none sm:text-[28px]">
        {children}
      </h1>
      {sub && <p className="mt-1 text-[15px] text-muted">{sub}</p>}
    </div>
  );
}
