# PoolBuy prototype: the 5 security checks

The Smarter MVP lecture lists five non-negotiable checks for AI-generated code. This file records how each was run on the PoolBuy prototype and what it found. Checks run on 18 Nov 2026 with Node.js 22.

## 1. Input sanitisation

**Rule.** A quantity must be a whole number from 1 to the units remaining. Text fields reject scripts.

**What the code does** (`app/src/logic/validation.ts`):

| Input | Rule | Rejected examples |
|---|---|---|
| Quantity (join, top-up) | Digits only, at most 6 digits, 1 to remaining capacity | `""`, `0`, `-5`, `1.5`, `1e3`, `0x10`, `1 000`, `NaN`, `<script>…` |
| Organiser's quantity | 1 to target − 1 (at the MOQ you can order alone) | `0`, `1000` for a 1,000-unit target |
| Pool title (60 chars) and note (200 chars) | Trimmed, whitespace collapsed, length-limited; rejects `<` `>`, `javascript:`, `data:text/html`, `on…=` event attributes, control characters | `<img src=x onerror=alert(1)>`, `JaVaScRiPt :alert(1)` |
| Deadline | Whole days, 3 to 14 | `2`, `15`, `7.5` |
| IDs and quantity in the URL | IDs must match `^[a-z0-9-]{1,40}$`; the quantity in `#/pool/…/join?qty=` is validated again on the confirmation screen | `../../etc/passwd`, `qty=<script>` |

**Defence in depth.** React escapes all text it renders, so stored text cannot become HTML. The production build (`npm run build`) also sets a Content-Security-Policy:

```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;
connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'
```

**Evidence.**
- `validation.test.ts`: 39 tests pass, covering every example above.
- `actions.test.ts`: the state layer refuses invalid quantities and leaves state unchanged; it refuses scripts in title and note.
- `ui.test.tsx`: typing `2.5` shows "Quantity must be a whole number, like 100." and disables Join; a URL with `qty=<script>` shows "Check your quantity" and no Confirm button; a note containing `<img onerror>` shows an error.
- Browser test of the production build: the app renders normally, and a script injected into the page at runtime is blocked: *"Executing inline script violates the following Content Security Policy directive 'script-src 'self''… The action has been blocked."*

## 2. Secrets management

**Rule.** No API keys in the code; any `.env` file stays out of GitHub.

- The prototype has no back end, no API calls and no keys.
- `app/.gitignore` excludes `.env`, `.env.*` (except `.env.example`), `*.pem` and `*.key`.
- `detect-secrets` 1.5.0 scan of `app/` (excluding `node_modules`, build output and the lockfile), 27 detectors: **0 findings**.
- Manual search of `src/` for `api_key`, `secret`, `token`, `password`, AWS and OpenAI-style key patterns and `import.meta.env`: **no matches**.

```bash
pip install detect-secrets
detect-secrets scan --exclude-files 'node_modules|dist|dist-single|coverage|package-lock\.json' app
```

## 3. Auth enforcement

**Rule.** The demo user switcher stands in for login; state that a real version needs authentication.

- The switcher (`SWITCH_USER`) only accepts the three demo accounts; other user IDs are refused (tested).
- Members can only leave a pool they belong to, only while it is filling, and nobody can change another member's quantity (tested).
- **A real version needs**: Alibaba.com sign-in; every join, leave and payment action checked on the server against the signed-in account; Trade Assurance performing the actual holds and refunds; rate limits on pool creation to stop fake pools.

## 4. Data privacy

**Rule.** Only made-up names and data; no real personal information.

- All sellers, businesses, suppliers and prices in `seed.json` are invented.
- Sellers see each other by display name (first name + initial) and quantity only. Delivery addresses would be shared with the Singapore hub alone (PDPA data minimisation; matches the ethics risk register).
- `seed.test.ts` fails if the seed data ever contains an email address, a Singapore phone number, a 6-digit postal code or a street address, and checks every display name is first name + initial.
- The demo saves state in the viewer's own browser (`localStorage`) only; nothing is sent anywhere.

## 5. Dependency audit

**Rule.** Run `npm audit` or turn on Dependabot; fix high-severity issues.

- Runtime dependencies are only `react` and `react-dom`. `npm audit --omit=dev`: **found 0 vulnerabilities**.
- Full `npm audit` (including build and test tools): 8 high-severity entries, **all from one advisory**, [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) (picomatch ReDoS through repeated extglobs), affecting every picomatch version up to 4.0.7, the latest release. No patched version exists yet. picomatch is used only by the build tools (Vite, Vitest, Tailwind) to match file paths written by us, never on user input, and it is not part of the app users download. `npm audit fix --force` would only downgrade Vite and Vitest to older major versions, so we did not run it.
- What we fixed: the first scaffold used Tailwind CSS 3 and Vitest 2, which pulled in more affected packages (15 findings). Upgrading to Tailwind CSS 4 and Vitest 5 brought it down to the one upstream advisory.
- Dependabot (`.github/dependabot.yml`) checks `app/` weekly and will open a pull request when picomatch ships a fix. The CI workflow fails on any high-severity issue in production dependencies (`npm audit --omit=dev --audit-level=high`).

## Accessibility check (bonus)

The prompt asked for WCAG 2.1 AA, so we tested it rather than assuming it. axe-core 4.14.1 run on all 7 screens (list, three pool details, start, my pools, join confirmation) at 1280 px and 390 px widths, with the WCAG 2.0/2.1 A and AA rules plus best practice: **0 violations** on all 14 runs.

The one design change it forced: the brand orange `#FF6A00` has a contrast ratio of only 2.87:1 with white, so it is used only for decoration. The first version used `#B84A00` (5.23:1) for text and buttons; the redesign moved them to the team deck’s navy `#15418E` (9.6:1). The audit was re-run after the redesign: still 0 violations. The final restyle to the team deck’s dark theme was checked the same way: cream on near-black is 16.5:1, dark text on the orange buttons 7.4:1, and the lowest text pair 5.8:1. Still 0 violations.
