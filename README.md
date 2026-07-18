# Slikk.Dev Attribution Kit

**The canonical public home of the Slikk.Dev client-attribution kit** — the
SlikkCredit badge that appears in the footer of every site Slikk.Dev builds,
plus the rules for using it.

The badge is a quiet maker's mark: a short credit line that reads into the
**Slikk.Dev** wordmark, rendered as outlined vector paths (the real Outfit-800
brand mark) so it looks identical everywhere with no font dependency.

> **Cardinal rule: never harm the client's site.** Everything here is built for
> that — total style isolation, zero network requests, no JS required, no
> tracking, accessible, and SEO-safe (the link is deliberately `nofollow`).

> **Note on the kit's original README:** the kit's own README ships unchanged as
> [`docs/KIT-README-original.md`](docs/KIT-README-original.md). It remains the
> detailed reference (per-stack quick starts, email/native recipes, credit-line
> copywriting tiers, wordmark regeneration procedure). This file is the
> canonical top-level summary and index.

---

## What's in the kit — the four drop-in formats

| File | Use it for |
|------|------------|
| [`slikk-credit.html`](slikk-credit.html) | **Default.** Self-contained snippet (markup + scoped `<style>`) for any HTML footer — static sites, Vue, Svelte, Angular, WordPress, Shopify, no-code embeds. |
| [`SlikkCredit.jsx`](SlikkCredit.jsx) | React / Next.js / Remix / Gatsby. Pure presentational, no hooks, no `'use client'` — safe as a React Server Component, prerenders to static HTML. |
| [`slikk-credit.webcomponent.js`](slikk-credit.webcomponent.js) | **Hostile-CSS hosts only.** Shadow-DOM `<slikk-credit>` custom element for sites with aggressive `* { … !important }` resets. Needs JS. |
| [`slikk-credit.svg`](slikk-credit.svg) | Standalone vector asset (`<img>`, CSS backgrounds, design tools, native apps). Baked neutral-grey letters + pink dot. |

Plus two raster fallbacks for media that can't inherit color (email, native,
legacy): [`slikk-credit-on-dark.png`](slikk-credit-on-dark.png) (light ink
`#F0EDE8` for dark backgrounds) and
[`slikk-credit-on-light.png`](slikk-credit-on-light.png) (dark ink `#374151`
for light backgrounds), both transparent.

In the HTML / React / web-component variants the lettering is `currentColor`
(it adopts the footer's text color automatically) and the period is always
brand accent `#FF2D6B`.

---

## The fixed rules (never change these)

Every port of the badge, in any stack, keeps all of the following verbatim:

1. **Wordmark SVG** — both path `d` attributes and
   `viewBox="25 -738 3844 756"`, byte-identical to the kit files. Never
   re-draw, never substitute a text node set in Outfit, never approximate.
2. **Accent dot color `#FF2D6B`** — locked. The focus ring is the same pink.
3. **Letters `fill="currentColor"`** — the lettering color flows from the
   anchor's `color`.
4. **Link** — `href="https://slikk.dev/"`, `target="_blank"`,
   `rel="nofollow noopener noreferrer"` (**all three**; `nofollow` is never
   removed — a repeated dofollow footer backlink across client domains is a
   link-scheme footprint; `noopener noreferrer` guards against
   reverse-tabnabbing).
5. **Structure and order** — one `<a class="dsk-credit">` containing the text
   `<span>` first, then the inline wordmark `<svg>` (the line reads *into*
   "Slikk.Dev"); `display:inline-flex; align-items:center; gap:.5em`.
6. **A11y set** — descriptive `aria-label` on the link; the SVG gets
   `aria-hidden="true"` + `focusable="false"` (no double-announcement);
   visible `:focus-visible` ring (`2px solid #FF2D6B`, offset `3px`, radius
   `4px`); AA-contrast resting ink.
7. **Reduced motion** —
   `@media (prefers-reduced-motion: reduce) { transition: none }`. The only
   animation is the hover/focus color transition; nothing else moves.
8. **No fixed positioning** — the badge lives in the footer flow. Never
   `position:fixed` floating over content.

---

## What MAY adapt per site

- **Lettering ink.** Pin the resting/hover colors to the site's palette by
  setting `color` on `.dsk-credit` (design tokens with hex fallbacks work —
  custom properties survive the `all:revert` isolation). Rest ink must hold
  AA contrast against the actual footer background; hover/focus goes brighter.
- **Mark size.** `.dsk-credit__mark { height: 15px }` by default; live sites
  use ~14–15px with 12–13px text. Stay in that neighborhood.
- **Placement / spacing.** Via the `className` prop or the host footer's own
  CSS (e.g. `margin-inline-start: auto`).
- **Font token for the lettering.** The kit hardcodes the system-UI stack;
  sites may prepend their body-font token **with the system stack as
  fallback** (`var(--font-sans), system-ui, …`). The wordmark itself never
  depends on a font.
- **Localized `aria-label` and `dir`.** On Hebrew/RTL sites, localize the
  credit line *and* the accessible label, and set `dir="rtl"` on the `<a>`.
  The Latin wordmark stays LTR (it's an image; it doesn't reorder).

---

## Writing the credit line

The line before the wordmark is a signature, not an ad. Binding rules:

1. **2–5 words.** If it wraps to two lines, it's too long.
2. **It ends on "by"** (English) or the full **"על־ידי"** maqaf form (Hebrew) —
   **never the ע"י abbreviation** — so it reads naturally into "Slikk.Dev".
3. **No trailing punctuation** after the line.
4. **One line per site, kept stable.** Pick one and keep it; no rotating copy.
5. **Register-matched to the site** — understated for law/finance/health,
   signature voice as the default, playful for startups/creative.
6. **Distinct across sites** — each client gets its own line, rooted in that
   site's own copy.
7. **Match the site's language** (Hebrew line on Hebrew sites; wordmark stays
   Latin). Use a non-breaking hyphen (`&#8209;`) in words like
   "over‑engineered" so the line never breaks.

---

## Live examples — credit lines in production

| Site | English | Hebrew / other |
|------|---------|----------------|
| Watson | Lovingly over‑engineered by | פותח בקפידה יתרה על־ידי |
| otok-marketing | Built suspiciously fast by | נבנה במהירות חשודה על־ידי |
| connection | Designed & built by | עוצב ופותח על־ידי |
| otok | Automated into existence by | נבנה באוטומציה מלאה על־ידי |
| sweatpants-life | Built comfortably by | — |
| cnergia | — | נוצר בסינרגיה מלאה על־ידי |
| yarin-barry | — | תוכנת מחדש על־ידי |
| levelllup | — | נבנה שלב אחרי שלב על־ידי |
| retter-college | — | נבנה בקשב מלא על־ידי |
| chesser | Every piece developed by | — |
| israeltimes | — | הובא לדפוס על־ידי |
| inna-gelemb | — | נבנה באור טבעי על־ידי |
| drym | — | נבנה לטווח ארוך על־ידי |
| how-to-fail-in-love | Built without failing by | נבנה בלי להיכשל על־ידי · FR: Construit sans faillir par · IT: Costruito senza fallire da · ES: Construido sin fallar por |
| ottoman | Launched without a waitlist by | שוגר בלי רשימת המתנה על־ידי |
| Aretz | — | הותסס לאט על־ידי |
| ffvsl-pro | Engineered by (deliberately quiet — renders on end-users' shared pages) | — |
| gorillads *(historical)* | — | נבנה עם כמויות מפוקפקות של שאפתנות וקפאין ע"י *(pre-dates these rules; its ע"י abbreviation is a flagged anti-pattern — don't copy)* |

---

## Porting recipes by stack (brief)

In every recipe the SVG paths, link/`rel`, a11y set, focus ring, and
reduced-motion rule are copied verbatim; only lettering color/typography,
size, placement, and the `text` line adapt. Full details in
[`docs/KIT-README-original.md`](docs/KIT-README-original.md).

- **React / Next.js RSC (with or without Tailwind).** Copy `SlikkCredit.jsx`
  (extend with `dir` + `ariaLabel` props on bilingual sites). Keep the
  embedded scoped `<style>` — do **not** convert it to utility classes; the
  component is self-contained by design and RSC-safe. Pass `text` /
  `ariaLabel` / `dir` from the site's i18n layer.
- **CSS Modules, no Tailwind.** Either use the React component as-is (the
  embedded `<style>` string is plain CSS — CSS Modules won't hash it), or put
  the `.dsk-credit` rules from `slikk-credit.html` into a **global**
  stylesheet (never a `.module.css` — class hashing would break the
  selectors) and keep the markup in a component.
- **Inline-style / design-token sites.** Keep the `<style>` block and
  reference the site's tokens inside it
  (`color: var(--token-muted-ink, #6b7280)`) — custom properties survive
  `all:revert`. Don't flatten to `style={{}}` objects: `:hover`,
  `:focus-visible`, and the reduced-motion media query can't be expressed
  inline, and dropping them violates the contract.
- **Plain SPA (Vite / CRA, with or without i18n).** Same component, rendered
  client-side; it ships no extra JS beyond its own markup. Wire `text`
  through the app's i18n (both locales, keys in sync) or hardcode it in the
  site's language on single-language sites.
- **Anything non-React.** Paste `slikk-credit.html` verbatim (markup into the
  footer partial, rules into a global stylesheet). Reach for the web
  component only on hostile-CSS hosts, and the PNG/SVG assets only for
  email/native — never for a normal web footer.

**Dark-background footers:** there is no separate dark variant — pick an
on-dark ink. Keep a **muted, AA-contrast resting ink** (the footer's existing
muted-text color) that **brightens on hover/focus** (near-white, or the
site's accent if contrast holds). The dot and focus ring stay `#FF2D6B` —
they read well on dark.

---

## Rights

These are **Slikk.Dev brand assets**, not an open-source library. All rights
reserved. Sites built by Slikk.Dev embed them under the rules above; no other
use is granted.
