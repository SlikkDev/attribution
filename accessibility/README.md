# Slikk.Dev Accessibility Kit

**The canonical public home of the Slikk.Dev accessibility-report kit** — the
`<slikk-a11y>` widget that lets visitors of a client site report accessibility
problems ("something here doesn't work with my screen reader"), plus the email
route that puts every report in a human inbox, and the rules for using it all.

A small button that lets visitors tell you what's in their way — and is,
itself, the most accessible thing on the page.

> **Cardinal rule** — inherited from the attribution kit: never harm the host
> site. This kit adds a second, its own: never be the barrier you exist to
> catch.

> **Agent skill:** [`skills/accessibility/SKILL.md`](skills/accessibility/SKILL.md)
> is a Claude Code skill that applies this kit to a client repo — copy it into
> the client repo's `.claude/skills/` (or `.agent/skills/`) directory.

> **Note on the detailed reference:** the attribution kit ships its original
> README unchanged as its detailed reference; this kit is net-new, so its
> detailed reference is written fresh at
> [`docs/KIT-REFERENCE.md`](docs/KIT-REFERENCE.md) (per-stack installs, full
> attribute/theming tables, the endpoint contract, i18n rules). This file is
> the canonical top-level summary and index.

---

## Why this exists

Engineers shorten "accessibility" to "a11y" — eleven letters compressed into a
puzzle. We kept all eleven everywhere a person has to read it; the machines
can have the numeronym. It seemed like the wrong word to make harder to read.

> We build software people are supposed to use. All of the people. When someone
> hits a wall on a site we built, we want to be the first to know — not to find
> out on Twitter. This kit is that commitment, in code: a reporting channel
> that works with a screen reader, a keyboard, a switch device, voice control,
> and whatever patience the visitor has left — because the team building the
> apps has to be at least as accessible as the apps. Every report is free QA
> from the one expert who matters: the person the page failed. It lands in a
> human inbox, gets read by a human, and gets fixed. One button, one form, zero
> excuses.

---

## What's in the kit — the drop-in formats

| File | Use it for |
|------|------------|
| [`slikk-a11y.webcomponent.js`](slikk-a11y.webcomponent.js) | **Default.** Shadow-DOM `<slikk-a11y>` custom element — the trigger badge, the report dialog, both locales, both themes, in one dependency-free file. |
| [`SlikkA11y.jsx`](SlikkA11y.jsx) | React / Next.js. A thin `'use client'` wrapper that registers the web component and renders the tag — zero duplicated logic. |
| [`api/route.js`](api/route.js) | The delivery half: a paste-in Next.js App Router route (zod + nodemailer) that emails reports to humans. Non-Next backends implement the same [endpoint contract](docs/KIT-REFERENCE.md#endpoint-contract). |
| [`.env.example`](.env.example) | The route's env surface — SMTP transport + recipients. Placeholders only. |
| [`demo/`](demo/) | A local demo page in the family look (`node demo/serve.js`) with a mocked endpoint. |

Two formats, not four, and that is deliberate: unlike the credit badge, this
widget is *interactive* — a dialog, a form, four states — so Shadow DOM is the
default rather than the hostile-CSS fallback, and there is no meaningful
static HTML/SVG/PNG port of a thing that must accept input.

---

## The 30-second embed

```html
<script src="slikk-a11y.webcomponent.js" defer></script>
<style>slikk-a11y:not(:defined){ display:inline-block; min-block-size:40px }</style>
<footer>
  …
  <slikk-a11y></slikk-a11y>
</footer>
```

The one-line `:not(:defined)` rule reserves the trigger's height before the
deferred script lands, so the upgrade never shifts the host's layout. The
whole widget is one file — ~11 KB gzipped, zero dependencies.

React / Next.js (from any server component):

```jsx
import SlikkA11y from './SlikkA11y';
<footer> … <SlikkA11y lang={lang} /> </footer>
```

Then copy [`api/route.js`](api/route.js) to `app/api/a11y-report/route.js` and
set the env from [`.env.example`](.env.example). That's the whole install.

---

## The fixed rules (never change these)

1. **Wordmark SVG** — both path `d` attributes and `viewBox="25 -738 3844 756"`,
   byte-identical to the attribution kit. Never re-draw, never substitute a
   text node set in Outfit, never approximate.
2. **Accent `#FF2D6B`** — locked. The dot is always this pink. The focus ring
   is the accent token, 2px, offset 3px: `#FF2D6B` on dark, and — a deliberate,
   documented divergence from the attribution canon's "the focus ring is the
   same pink" rule — the site's own `#CC0046` on light, because `#FF2D6B`
   cannot hold the required 3:1 against the paper canvas. Contrast outranks
   the constant; the parent canon should adopt the same carve-out.
3. **White text only ever sits on accent-strong** (`#E6004E` dark / `#CC0046`
   light) — the submit button keeps WCAG AA this way. Never white on `#FF2D6B`.
4. **Copy ships verbatim from the canonical deck**, both locales. No
   improvised user-facing strings, and wit never enters an `aria-label`.
5. **Credit link** — `href="https://slikk.dev/"`, `target="_blank"`,
   `rel="nofollow noopener noreferrer"` (all three, same reasoning as the
   attribution kit).
6. **The a11y set** — dialog labelled by its title; focus moves into the
   dialog on open and back to the trigger on close; Esc closes; every field
   has a real `<label>`; errors are text, associated via `aria-describedby`,
   never color-only; visible focus ring; every target ≥24×24 CSS px.
7. **Reduced motion** — `prefers-reduced-motion: reduce` collapses every
   transition and animation. Nothing moves that doesn't have to.
8. **Developer-placed, inert by default** — no auto-injection, no
   `position:fixed`, no global config object, zero network activity until the
   visitor submits, no cookies, no storage, no trackers, no eval.
9. **Recipients are env-driven server-side only** (`A11Y_REPORT_TO`). Nothing
   in the request body can choose where reports go. No open relay.

---

## What MAY adapt per site

- **Theme.** `theme="dark"` / `theme="light"`, or omit to follow
  `prefers-color-scheme`. Colors pin to the host palette via the
  `--slikk-a11y-*` custom properties ([reference](docs/KIT-REFERENCE.md#theming)).
- **Trigger register.** `label="quiet"` swaps the line for the understated
  variant on hosts whose register can't take a question mark.
- **Endpoint & page.** `endpoint="…"` if the route lives elsewhere;
  `page="…"` to override the auto-filled URL.
- **Placement / spacing.** The element is `inline-block` in the footer flow;
  position it with the host's own CSS.
- **Font token.** `--slikk-a11y-font` may prepend the site's body font,
  keeping the system stack as fallback. The wordmark never depends on a font.

---

## Reports → email

The widget POSTs JSON to `/api/a11y-report`; the route validates (zod, strict
shape), filters spam (honeypot + time trap + per-IP rate limit), sanitizes
(CRLF-stripped subject, HTML-escaped body), and emails the report via SMTP to
the humans in `A11Y_REPORT_TO` — default
`we@slikk.dev, accessibility@slikk.dev, i@yarin.io`. Spam-check failures get
the same success-shaped `200` as real submissions: no oracle for bots. Full
contract in [`docs/KIT-REFERENCE.md`](docs/KIT-REFERENCE.md#endpoint-contract).

> ⚠️ **The one open item: SMTP is not wired yet.** Until `SMTP_HOST` (+ creds
> and the sending domain's DNS) exists in the deploy env, the route **logs each
> report server-side and still answers ok**, and a `console.warn` says so on
> every hit. By default the log line carries metadata only — report bodies
> hold the reporter's email and assistive-tech details, which don't belong in
> shipped-off logs; set `A11Y_REPORT_LOG_BODY=true` to keep full bodies
> through the seam window, knowingly. Set the `SMTP_*` vars from
> [`.env.example`](.env.example) to go live. Everything else ships done.

---

## The widget's own accessibility statement

Every decision here exists so a screen-reader user finishes this form exactly
as fast as a mouse user. That's the entire spec.

Specifically, against **WCAG 2.2 AA** (and AAA where it was cheap):

- **1.3.1 Info and Relationships** — native `<dialog>`, `<form>`, `<label for>`
  on every field, hints and errors bound via `aria-describedby`.
- **1.4.3 Contrast (Minimum)** — every text pair holds ≥4.5:1 in *both*
  themes (e.g. muted ink on dark surface ≈ 5.6:1; accent text `#FF2D6B` on
  `#111111` ≈ 5.3:1; white on accent-strong `#E6004E` ≈ 4.7:1).
- **1.4.11 Non-text Contrast** — the focus indicator holds ≥3:1 against both
  canvases; state changes are never conveyed by hue alone.
- **2.1.1 / 2.1.2 Keyboard, No Trap** — the whole flow is Tab/Enter/Esc
  operable; the modal trap is the dialog contract and Esc is always the exit.
- **2.4.3 Focus Order / 2.4.7 Focus Visible** — focus goes trigger → dialog
  (description field) → back to trigger on close; the 2px accent ring is on
  every stop. **2.4.11 Focus Not Obscured** — a centered modal hides nothing
  it gave focus to.
- **2.5.3 Label in Name** — the trigger's visible line *is* its accessible
  name; the longer screen-reader string rides as the accessible description.
- **2.5.8 Target Size (Minimum)** — every target ≥24×24 (close 32×32; the
  submit is ≥44px tall, which happens to meet the AAA 2.5.5 size).
- **3.1.2 Language of Parts** — `lang` and `dir` are set on the trigger and
  the dialog per locale, so screen readers switch voices for Hebrew.
- **3.2.1 / 3.2.2 On Focus, On Input** — no surprise context changes, ever.
- **3.3.1 / 3.3.2 / 3.3.3 Errors and Labels** — errors are identified in
  text, programmatically associated, and tell the visitor what would help.
- **3.3.7 Redundant Entry** — the page URL is auto-filled; nothing is asked
  twice.
- **4.1.2 Name, Role, Value** — native elements throughout; no ARIA
  re-implementations of things HTML already does. **4.1.3 Status Messages** —
  sending/success announce via `role="status"`, failure via `role="alert"`,
  and success also moves focus to its heading.
- The error state keeps everything the visitor typed. The success state
  thanks them like they just did us a favor — because they did.

The e2e suite enforces the load-bearing parts: a keyboard-only submit,
axe-core scans of the page and the open dialog at zero violations, and an RTL
smoke check. Run them; don't trust prose.

---

## i18n / RTL

`lang="en"` (default) or `lang="he"`. The Hebrew is native and idiomatic, not
translated — plural address, flipped arrows (`Report it →` / `← דווחו`), and
it ships from the same canonical deck as the English. Layout uses logical CSS
properties only, so RTL is automatic; the Latin wordmark stays LTR inside RTL
(it's an image; it doesn't reorder). Attribute changes re-render live and
never drop the visitor's text.

---

## Never harm the host

- **Style isolation both ways** — Shadow DOM blocks host selectors, and an
  `all:initial` firewall at the host boundary stops inheritable text styles
  too (an uppercased, letter-spaced footer can't reach the dialog). Explicit
  colors everywhere; nothing leaks out.
- **No layout shift** — the trigger reserves its height via the one-line
  `:not(:defined)` rule in the embed snippet, so even the pre-upgrade moment
  is shift-free; once defined it has intrinsic size, and the dialog is a
  native top-layer element.
- **Zero network activity until the visitor submits.** No cookies, no
  storage, no trackers, no third-party calls, ever.
- **CSP-safe** — one same-origin script file, no eval, no remote code, and
  styles attach as a constructable stylesheet, which a strict `style-src`
  does not strip. (Engines without constructable sheets fall back to an
  inline `<style>`, which needs `style-src 'unsafe-inline'`; `connect-src`
  must allow the report endpoint.)
- **Clean teardown** — `disconnectedCallback` closes the dialog and drops
  every listener; an in-flight report was sent `keepalive`, so even an SPA
  unmount mid-send can't lose it.
- The only global side effect is the guarded `customElements.define`.
- The server half extends the rule: recipients locked to env, generic
  responses, rate-limited, nothing logged beyond what you'd want in an inbox.

---

## Demo & tests

```sh
node demo/serve.js        # demo at http://localhost:4173, mocked endpoint
npm test                  # unit suite for the route (fake transport)
npm run test:e2e          # keyboard-only + axe + RTL, in Chromium
```

The kit itself has **zero dependencies** — `package.json` and its
devDependencies exist only for the test rig.

---

## Rights

These are **Slikk.Dev brand assets**, not an open-source library. All rights
reserved. Sites built by Slikk.Dev embed them under the rules above; no other
use is granted.
