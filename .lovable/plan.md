# Finish the Frontend Evolution — Waves 3, 4 (remaining), 5

Frontend-only. No backend, no schema. Keep the Paper & Ink identity. Build on what Wave 1/2 + partial Wave 4 already shipped (`motion.ts`, `FlyToCartPortal`, `FreeShippingBar`, `WelcomeModal`, PDP v2, Card v2).

---

## Wave 3 — Search v2 (Cmd-K) + Mobile UX

### Command palette

- New `src/components/search/command-palette.tsx` built on existing `components/ui/command.tsx` (cmdk).
- Trigger: `⌘K` / `Ctrl+K`, navbar search icon, mobile tab-bar search.
- Global open state via new `src/lib/store/command-palette.ts` (zustand).
- Grouped results: **Products** (name/tagline/category/badges match against `lib/data/products`), **Categories** (from `lib/data/categories`), **Collections / Pages** (curated list: Drops, Anime Universe, Lookbook, Studio, Gift Guide, Sale, Membership), **Quick actions** (View cart, Wishlist, Account).
- **Trending searches** (static curated chips) + **Recent searches** persisted in `src/lib/store/recent-searches.ts` (localStorage, capped at 6).
- Keyboard nav (cmdk default) + arrow-key product preview thumb on the right (desktop).
- Empty state: "No matches. Try anime, oversized, hoodie" with trending chips.
- Mount `<CommandPalette />` in `__root.tsx`; wire navbar + bottom-tab-bar buttons to open it.
- `src/routes/search.tsx` rewritten as a thin SSR-friendly fallback: server-renders the same grid but the input click opens the palette (keeps SEO route, single canonical UX).

### Mobile UX pass

- `src/components/plp/filter-sheet.tsx`: bottom Sheet wrapping the existing PLP filters; used on `/shop` and `/c/$category` at `< md`. Desktop keeps the sidebar.
- Animated cart badge in `navbar.tsx` + `bottom-tab-bar.tsx`: spring scale on count change (framer-motion `key={count}`).
- `bottom-tab-bar.tsx`: ink underline morph for active tab using `layoutId="tab-ink"`.
- Tap targets: audit nav, swatches, filter chips → enforce min 44px via utility class.
- `src/components/layout/route-transition.tsx`: `AnimatePresence` + `motion.div` keyed on `location.pathname`, mounted around `<Outlet />` in `__root.tsx`. Uses shared `EASE`. Respects `prefers-reduced-motion`.

---

## Wave 4 (remaining) — Motion identity + remaining psychology

- `src/components/ui/ink-reveal.tsx`: radial clip-path "ink spread" reveal driven by `IntersectionObserver`; used on hero section headings + section titles on home.
- `src/components/ui/paper-grain.tsx`: fixed, low-opacity SVG noise overlay (`pointer-events-none`), mounted once in `__root.tsx`.
- `src/components/ui/shimmer-skeleton.tsx`: paper-toned shimmer; replace raw `<Skeleton>` usages in PLP/PDP loading states.
- **Cart upsell rail** in `cart-drawer.tsx` + `routes/cart.tsx`: "Frequently added with your bag" — 4 products deterministically picked from category overlap.
- **Scarcity / trending pills**: light polish on existing pills using the shared EASE (subtle pulse), wired into product card + PDP via deterministic id hash (already used in trust-row / sticky bar).
- Recently-viewed strip polish on home + PDP (spacing, header treatment, snap scroll on mobile).
- Audit all framer-motion call sites → swap ad-hoc `ease` arrays for `EASE` from `lib/motion.ts`.

---

## Wave 5 — Real-business completeness

### Account dashboard

Upgrade `src/routes/account.tsx` into a tabbed shell using shadcn `Tabs`:

- **Orders**: mock list → click opens `src/components/account/order-detail.tsx` with line items + tracking timeline (5-step vertical stepper).
- **Returns**: 3-step flow component (select item → reason → pickup slot → confirmation).
- **Addresses**: mock cards + add/edit dialog (frontend only).
- **Payment methods**: mock saved cards/UPI cards.
- **Notifications**: toggle list (email/SMS/WhatsApp/push).
- **Preferences**: language, currency, size defaults.

### Policy + support pages

New routes (each with own `head()` meta, editorial layout matching `help-center.tsx`):
`shipping.tsx`, `returns.tsx`, `refund.tsx`, `terms.tsx`, `privacy.tsx`, `faq.tsx` (redirects to help-center anchor or standalone), `contact.tsx`, `careers.tsx`, `rewards.tsx`, `referrals.tsx`. Cross-link from footer.

### Universal state components

`src/components/state/empty.tsx`, `error.tsx`, `loading.tsx`, `offline.tsx` — themed (paper/ink, illustration slot, primary action). Wire into:

- `wishlist.tsx` (empty)
- `cart.tsx` + `cart-drawer.tsx` (empty)
- `search.tsx` (no results)
- `checkout.tsx` (failure state)
- Route `errorComponent` for major routes.

### Studio v2 light polish

In `routes/studio.tsx`:

- Snap-to-center horizontal/vertical guides (visual lines when within 4px).
- Undo/redo stack (last 30 states) with `⌘Z` / `⌘⇧Z`.
- Mobile bottom-sheet toolbar (collapses desktop side toolbar on `< md`).
- 4 design presets (one-click apply: "Anime", "Minimal", "Streetwear Type", "Photo Print").

---

## Out of scope

- Lovable Cloud / auth / real orders / payments / inventory.
- Replacing AI hero image.
- Full Studio rewrite (only the four items above).
- New product taxonomy or data model changes.

---

## Technical notes

- New zustand stores: `command-palette`, `recent-searches` (persist), `studio-history` (in-memory).
- No new deps expected (cmdk, framer-motion, zustand, shadcn already present).
- All new components themed via semantic tokens (`bg-paper`, `text-ink`, `border-line`).
- Reuse `EASE` from `lib/motion.ts` everywhere; respect `prefers-reduced-motion`.
- Each new route defines unique `head()` meta (title + description + og:title + og:description).

---

## Execution order

1. Wave 3 (palette + mobile UX) — biggest perceived "app-like" lift.
2. Wave 4 remaining (ink-reveal, paper-grain, upsell, polish).
3. Wave 5 (account, policies, state components, studio polish).

Approve to start shipping.
