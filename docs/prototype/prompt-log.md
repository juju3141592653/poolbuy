# PoolBuy prototype: prompt log and design changes

The prototype was generated with an AI app builder (**Claude**, Anthropic) and then improved in small follow-up prompts, as the Smarter MVP lecture recommends ("iterate in small prompts rather than regenerating everything"). This log is the evidence for the 70/30 split in the README and Section 8 of the report.

## Prompt 1: the build prompt

The team's prompt from the project guide, written to the lecture's *Anatomy of a Perfect Prompt* (named libraries, colours, layout rules and logic rules):

```
Build a responsive web app called PoolBuy: a student concept for an Alibaba.com feature that lets
small sellers combine orders to reach a supplier's minimum order quantity (MOQ).

Tech: React + Tailwind, front-end only, mock data in a JSON file, no real payments. Orange accent
(#FF6A00), white background, rounded cards. Footer: "Student concept prototype for SC4025. Not
affiliated with Alibaba."

Screens:
1. Pool list: cards with product photo, unit price, progress bar (joined / target), time left.
2. Pool detail: price tiers table, progress bar, "X more units unlocks $Y per unit", cost breakdown
   (units x unit price + estimated shipping share + 9% GST), Join button.
3. Start a pool: form for product, supplier, target quantity (= MOQ), unit price, deadline (3 to 14 days).
4. Join confirmation: quantity, held amount, text "You are only charged if the pool fills".
5. My pools: each pool with a text status label: Filling, Confirmed or Refunded. Leave button while Filling.

Logic:
- A pool has product, supplier, price tiers [{minQty, unitPrice}], target, joinedQty, deadline, members.
- Joining adds quantity (whole number, 1 to units remaining). When joinedQty >= target, status = Confirmed.
- A "Simulate deadline" demo button: if joinedQty < target, status = Refunded and every hold is released.
- Members can leave while Filling; their hold is released immediately.
- No fee may be added after joining.

Seed data: 4 pools (custom tote bags with tiers 100: $3.00, 500: $1.50, 1000: $1.00; kraft packaging
boxes; blank T-shirts; phone cases) and 3 demo users selectable from a dropdown.

Quality: semantic HTML, WCAG 2.1 AA colour contrast, unit tests for the pool status logic, modular
commented code, a README with run instructions.
```

## Follow-up prompts: what changed and why

| # | Follow-up prompt (summarised) | Why: the "brain" decision |
|---|---|---|
| 2 | Keep `#FF6A00` for decoration only; use `#B84A00` for text, links and buttons. | The prompt's own colour fails its own WCAG AA requirement: white on `#FF6A00` is 2.87:1 (needs 4.5:1). `#B84A00` gives 5.23:1. |
| 3 | Let a pool keep taking units after it reaches the target, up to the supplier's maximum order; quote everyone the target-tier price until then. | The original logic ("1 to units remaining" until target) made user story 5 impossible: a pool capped at its target can never unlock the next tier. "Units remaining" now means remaining supplier capacity. |
| 4 | Lock **Leave** once a pool is Confirmed. | A property test showed that letting members leave a filled pool can drop it below a tier and raise everyone else's price, breaking "no fee after joining" (story 4). |
| 5 | Pick the product from verified supplier listings; take the unit price from the chosen tier instead of a free-text price field. | Prevents organisers mistyping or inflating prices (ethics register: fraud and trust). Listings from unverified suppliers are shown but can't be pooled. |
| 6 | Store money as integer cents; show shipping share, a 2% service fee and 9% GST, and the saving against buying alone. | Avoids floating-point rounding errors in money. The fee follows pricing option B and is one setting in `config.ts`. The saving line backs KR3 (members pay at least 35% less per unit). |
| 7 | When a seller needs fewer than the MOQ, show what buying alone would force on them. | The first version showed "US$0.00 saved" for a 50-unit order, which hid the real pain: the persona would have to buy the full 100. |
| 8 | Organisers must commit 1 to target − 1 units; a pool appears in the list immediately. | A pool with no committed organiser invites fake pools; at the full MOQ a seller can order alone. |
| 9 | Show other sellers by display name (first name + initial) and quantity only. | PDPA data minimisation, as in the ethics risk register. |
| 10 | Rank pools by an open rule (closest to filling, then soonest deadline) and say so on the page. | Ethics register: fairness. No hidden or paid ranking. |
| 11 | On phones, put the Join panel right under the progress bar. | Heuristic review: on a 390 px screen the Join button was below six cards of content. |
| 12 | Leave the "Add more units" box empty for existing members. | A pre-filled top-up quantity nudges members to buy more (ethics register: nothing pre-ticked). |
| 13 | Make navigation work inside a sandboxed frame; add a CSP to the production build; add CI, Dependabot and a GitHub Pages deploy. | Security checks 1 and 5, and a reliable live demo link. |
| 14 | Redesign the look to match the team deck: navy `#15418E` palette, Inter font, marketplace header with search, a hero with live figures, a price-tier strip like a supplier listing, shaded product images, two-column cards on phones. | Team feedback: the first look felt generic and “AI-styled”, and it did not match the team’s slides. Navy also lifts button contrast from 5.23:1 to 9.6:1. The WCAG audit was re-run: 0 violations. |
| 15 | Stop the order panel sticking to the screen. | Found while re-recording the demo: once the panel grew taller than a laptop screen, a sticky panel could hide its own Join button below the fold. |
| 16 | Restyle to the team’s final deck: near-black background, charcoal cards, cream text, orange `#FF8A3D` accent with dark text on buttons. Keep amber, green and grey for the three statuses; put product images on a dark studio background; make the header solid. | The team deck moved to a dark orange-and-black theme, and the prototype should look like the slides. Every text pair was re-checked (lowest 5.8:1) and the WCAG audit re-run: 0 violations. A blurred see-through header slowed screen recording, so it is solid. |

## Matching the wireframes

Tick each item against Person 4's wireframes. Where the prototype differs, keep the change and give the reason in Section 8, or change the prototype.

| Screen | Wireframe element | Prototype | Match? |
|---|---|---|---|
| 1. Pool list | Product photo, unit price, progress bar, time left | Yes, plus status label, seller count, "Closing soon" and an Open/Closed toggle | ☐ |
| 2. Pool detail | Price tiers, progress, full cost breakdown, Join button | Yes, plus next-tier callout with invite link, sellers list, "What happens next" | ☐ |
| 3. Start a pool | Product, quantity target, deadline | Product chosen from listings; target chosen from tiers (price fixed by tier); your quantity; optional title and note | ☐ |
| 4. Join confirmation | Quantity, held amount, "you'll only be charged if the pool fills" | Yes, with the full breakdown and the deadline | ☐ |
| 5. My pools | Each pool's status (filling, confirmed, refunded) | Yes, plus held/charged/released amount, Leave while Filling, and summary tiles | ☐ |

## Changes after the usability test

Person 2 and Person 4 run the think-aloud test. Record the top two issues and what changed here:

| Issue seen in testing | How many participants | Change made |
|---|---|---|
| 1. | | |
| 2. | | |

Already fixed before testing, from a heuristic walkthrough: the Join panel position on phones (row 11), the pre-filled top-up box (row 12), the misleading "US$0.00 saved" figure (row 7), a confirmed pool still saying "you're only charged if the pool fills", and the sticky order panel hiding its Join button (row 15).
