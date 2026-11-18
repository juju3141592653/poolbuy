# PoolBuy app: developer notes

The project overview, demo script and security checklist are in the [main README](../README.md). This file explains how the code is organised.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm test` | Runs all unit and screen tests once (Vitest + Testing Library) |
| `npm run coverage` | Tests plus a coverage report for the logic layer |
| `npm run lint` | Lints `src` with oxlint |
| `npm run typecheck` | TypeScript check |
| `npm run build` | Static production build in `dist/` with a Content-Security-Policy |
| `npm run build:single` | One self-contained `dist-single/index.html` for sharing |
| `npm run audit:prod` | `npm audit` on runtime dependencies only |

## Structure

```
src/
  logic/            Pure business rules: no React, fully unit-tested
    config.ts       Every tunable rule: GST, service fee, deadline limits, text limits
    types.ts        Pool, Product, Member, Supplier, User (money in integer cents)
    pool.ts         Status, tiers, current price, cost breakdown, savings, ranking
    actions.ts      State transitions: START_POOL, JOIN_POOL, LEAVE_POOL, SIMULATE_DEADLINE, ...
    validation.ts   Input sanitisation (security check 1)
    format.ts       Dates and status wording
  data/
    seed.json       Mock data: 7 supplier listings, 8 sellers (3 selectable), 5 pools
    seed.ts         Turns relative seed times into dates so the demo always looks current
  state/
    store.tsx       React provider: wraps applyAction, saves to localStorage if allowed, ticks a clock
    context.ts      useStore / useLookups hooks
    router.ts       Hash router with an in-memory fallback for sandboxed frames
  components/       Layout, status badge, progress bar, tier table, cost breakdown, illustrations
  pages/            The five screens from the wireframes
    PoolList.tsx    1. Pool list
    PoolDetail.tsx  2. Pool detail (order panel, invite link, demo controls)
    StartPool.tsx   3. Start a pool
    JoinConfirm.tsx 4. Join confirmation
    MyPools.tsx     5. My pools
  test/ui.test.tsx  Screen-level tests for the acceptance criteria
```

## The rules, in one place

- **Joined quantity is derived** from the members list, never stored, so it cannot drift.
- **Status** (`pool.ts › getStatus`): joined ≥ target → *Confirmed*; closed below target → *Refunded*; otherwise *Filling*.
- **Price** (`getCurrentUnitPrice`): the tier price for `max(joined, target)`. While filling, everyone is quoted the target tier; once a deeper tier is reached, everyone pays less.
- **Join limit**: a whole number from 1 to the pool's remaining capacity (the supplier's maximum order), so a filled pool can keep growing to unlock the next tier (story 5).
- **Leave**: only while Filling. Once Confirmed, leaving could drop the pool back below a tier and raise other members' prices, which would break "nothing is added after joining" (story 4). The property test in `actions.test.ts` checks this over 200 random join and leave sequences.
- **Holds**: each member's `heldAtJoinCents` records what the confirmation screen showed; the live hold can only be equal or lower.
- **Money** is integer US$ cents. Fee and GST are rounded half-up to the cent.
- **Pricing option**: `SERVICE_FEE_RATE` in `config.ts` is 2% (option B in the GTM plan). Set it to `0` for option A, free for buyers.

## Changing the demo data

Edit `src/data/seed.json`. Times are in hours relative to page load (`deadlineInHours`, `createdHoursAgo`). A pool's `target` must equal one of its product's tier `minQty` values; `seed.test.ts` checks this.
