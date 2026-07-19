# Accessibility Kit — detailed reference

The depth behind the top-level [`README.md`](../README.md): per-stack
installs, the full attribute and theming tables, the endpoint contract, email
delivery, and the i18n rules. (The attribution kit keeps its original README
in this slot; this kit is net-new, so this reference is written fresh — same
two-README shape, no "original" to preserve.)

---

## Install by stack

### Next.js / React (the house stack)

1. Copy `slikk-a11y.webcomponent.js` and `SlikkA11y.jsx` into the app
   (e.g. `src/components/islands/` — it's a client island).
2. Render it from any server component:

   ```jsx
   import SlikkA11y from '@/components/islands/SlikkA11y';

   <footer>
     …
     <SlikkA11y lang={lang} theme="dark" />
   </footer>
   ```

   The wrapper is `'use client'`; the page around it stays a server
   component. Only the widget's own JS ships.
3. Add the pre-upgrade rule to the global stylesheet so the widget's arrival
   never shifts layout (the element is 0×0 until the script defines it):

   ```css
   slikk-a11y:not(:defined) { display: inline-block; min-block-size: 40px; }
   ```
4. Copy `api/route.js` to `app/api/a11y-report/route.js`. It imports `zod`
   and `nodemailer` from the host app — `npm i zod nodemailer` if absent.
5. Wire the env from `.env.example` (see [Email delivery](#email-delivery)).
6. On bilingual sites pass `lang` from the site's i18n layer, exactly like
   every other section prop.

### Plain HTML / Vue / Svelte / Angular / WordPress / anything

```html
<script src="/js/slikk-a11y.webcomponent.js" defer></script>
<style>slikk-a11y:not(:defined){ display:inline-block; min-block-size:40px }</style>
<footer>
  …
  <slikk-a11y lang="en"></slikk-a11y>
</footer>
```

Self-host the file with the site's other static assets (no CDN — the family
has none). The element is inert until clicked and renders nothing without JS;
if the host must have a no-JS reporting path, put a `mailto:` link to the
same inboxes in the footer as a fallback.

There is no separate "hostile-CSS" variant because the default already is
one: Shadow DOM blocks host selectors in both directions, and the widget
resets inheritable text properties at its boundary (`all:initial` on the
host element), so even a `footer { text-transform: uppercase }` on the host
can't reach the dialog. Styles attach as a constructable stylesheet, which a
strict CSP `style-src` does not govern; engines without constructable sheets
fall back to an inline `<style>` and need `style-src 'unsafe-inline'`. The
host's `connect-src` must allow the report endpoint.

### Non-Next backends

Serve any endpoint that honors the [contract below](#endpoint-contract) and
point the widget at it with `endpoint="…"`. The widget only ever reads the
HTTP status (`res.ok`); the JSON bodies are for humans and logs.

---

## Attribute reference

| Attribute | Values | Default | Notes |
|-----------|--------|---------|-------|
| `lang` | `en` \| `he` | `en` | Full string table swap + `dir` flip. Live: changing it re-renders without dropping typed input. |
| `endpoint` | URL/path | `/api/a11y-report` | Read at submit time. Trust model: this is host-controlled configuration, same as the host controlling its own page — the widget sends only the form fields, and no ambient credentials cross-origin. |
| `page` | URL | `location.href` | Overrides the auto-filled, visitor-editable page field. |
| `theme` | `dark` \| `light` | *(unset)* | Unset follows `prefers-color-scheme`; set it to match a host with its own theme switch. |
| `label` | `quiet` | *(unset)* | Swaps `Something not accessible?` for `Accessibility feedback` (HE: `משהו לא נגיש?` → `משוב נגישות`). |

React props mirror the attributes 1:1, plus `className`. The wrapper writes
`className` onto the element as the `class` attribute — React 18 passes
`className` to custom elements as a literal (and useless) `className="…"`
attribute; React 19 fixed the mapping, and the explicit `class` works on
both. The wrapper leaves `endpoint` unset unless given, so the element stays
the single owner of the default.

---

## Theming

All colors read from `--slikk-a11y-*` custom properties set on the element
(or any ancestor), falling back to the brand tokens:

| Property | Dark default | Light default | Used for |
|----------|--------------|---------------|----------|
| `--slikk-a11y-surface` | `#111111` | `#ECE5DB` | trigger chip + dialog background (the family surface tokens — one step off each canvas, so the chip reads as a control on the family's own pages) |
| `--slikk-a11y-ink` | `#F0EDE8` | `#17130F` | primary text |
| `--slikk-a11y-ink-soft` | `rgba(240,237,232,.66)` | `rgba(23,19,15,.70)` | intro, trigger line |
| `--slikk-a11y-ink-mute` | `rgba(240,237,232,.55)` | `rgba(23,19,15,.62)` | labels, hints, credit |
| `--slikk-a11y-field` | `rgba(240,237,232,.07)` | `rgba(23,19,15,.05)` | input backgrounds |
| `--slikk-a11y-line` | `rgba(240,237,232,.16)` | `rgba(23,19,15,.18)` | hairlines, input borders |
| `--slikk-a11y-accent` | `#FF2D6B` | `#CC0046` | focus ring, error text, dot stays `#FF2D6B` |
| `--slikk-a11y-accent-strong` | `#E6004E` | `#CC0046` | submit fill (white text on it — AA) |
| `--slikk-a11y-accent-ink` | `#ffffff` | `#ffffff` | text on accent-strong |
| `--slikk-a11y-font` | system-ui stack | system-ui stack | all UI text; wordmark is font-free. With `lang="he"` the default stack leads with **Heebo** — the family's Hebrew face — which document-level `@font-face` rules deliver into the shadow DOM for free on family hosts, and which falls through harmlessly elsewhere |

Example — pinning the widget to a host's tokens:

```css
slikk-a11y {
  --slikk-a11y-surface: var(--card-bg);
  --slikk-a11y-font: var(--font-sans), system-ui, sans-serif;
}
```

Overrides apply in both themes; if you override, recompute AA contrast
against your values (4.5:1 text, 3:1 focus ring). The accent dot in the
wordmark is not themeable — `#FF2D6B` is locked.

---

## Endpoint contract

```
POST {endpoint}
Content-Type: application/json
```

Request body:

| Field | Type | Rules |
|-------|------|-------|
| `description` | string | required, trimmed, 1–2000 chars |
| `page` | string | optional, ≤2048 chars (visitor-editable; treat as untrusted) |
| `tech` | string | one of `screen_reader` `keyboard` `voice` `zoom` `switch` `other` `no_say` or `""` |
| `email` | string | optional; `""` or a valid address, ≤320 chars |
| `lang` | string | `en` \| `he` — the locale the report was written in |
| `company_url` | string | honeypot — humans always send `""` (server-side, any present non-empty value of any type is the trap) |
| `elapsed_ms` | number | ms of interaction time before submit. The clock starts when the widget first renders and never resets on close/reopen, so an interrupted-and-resumed report carries its honest total — the server drops anything under 2000 ms as a bot |

Unknown keys are rejected (strict schema) — a smuggled `to` field is a `400`,
not a delivery instruction. Bodies are read with a hard 32 KB ceiling; the
stream is cancelled the moment it exceeds the cap.

Responses:

| Status | Body | When |
|--------|------|------|
| `200` | `{ "ok": true }` | delivered — **and also** when the honeypot was filled or `elapsed_ms < 2000` (silent drop; success-shaped on purpose, no oracle for bots) |
| `400` | `{ "error": "…" }` | malformed JSON or schema failure |
| `413` | `{ "error": "…" }` | request body over 32 KB |
| `429` | `{ "error": "…" }` | more than 5 reports from one IP in 10 minutes |
| `500` | `{ "error": "…" }` | SMTP delivery failed |

The widget treats any non-2xx (or a network failure) as the error state and
keeps the visitor's text. A `429` gets its own on-screen advice ("give it ten
minutes") instead of the generic "try again" — retrying into a rate-limit
window would be advice that can only fail.

**Rate-limit trust boundary.** The limiter keys on the **rightmost**
`x-forwarded-for` entry — the hop appended by the trusted edge proxy (Traefik
in the family deploys). The route therefore assumes it runs behind a proxy
that appends or overwrites that header; exposed directly to the internet, the
header is client-supplied and the limit is advisory at best. Note also that
visitors behind one NAT (offices, campuses) share a key and can hit the limit
together — the widget's ten-minute message covers them. The in-memory store
is capped (stale entries swept, then oldest evicted), so a flood of unique
addresses cannot grow the heap without bound.

---

## Email delivery

`api/route.js` mirrors the slikk.dev `/api/contact` route: zod validation,
honeypot, time trap, in-memory per-IP rate limit, CRLF-sanitized subject,
HTML-escaped body, nodemailer over SMTP.

Env (see `.env.example`):

| Var | Meaning |
|-----|---------|
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | the transport — same names as the main site |
| `A11Y_REPORT_TO` | comma-separated recipients; defaults to `we@slikk.dev,accessibility@slikk.dev,i@yarin.io` |

Recipients come **only** from env. The reporter's email, when given, becomes
`Reply-To` — never a recipient.

> ⚠️ **The seam.** With `SMTP_HOST` unset, the route warns once per hit,
> logs the report (`console.log`, greppable as `[a11y-report]`), and answers
> `{ ok: true }`. This is deliberate: reports survive in the server logs while
> SMTP credentials and the sending domain's DNS (SPF/DKIM) are being
> provisioned — the kit's one open item. Setting the `SMTP_*` vars flips it
> live; no code change.
>
> By default the seam logs **metadata only** (recipients + subject): report
> bodies carry the reporter's email address and free text that routinely
> reveals assistive-tech use, and server logs often travel further than the
> three inboxes ever would. Set `A11Y_REPORT_LOG_BODY=true` to log full
> bodies during the seam window — an explicit, documented trade of privacy
> for durability; mind your log retention.

---

## Accessibility implementation notes

The README carries the WCAG 2.2 claims; these are the mechanics behind the
less obvious ones:

- **Focus choreography.** Open: `showModal()` + explicit focus to the
  description field (the dialog's `aria-labelledby` title announces on
  entry). Success: focus moves to the confirmation heading
  (`tabindex="-1"`). Close (Esc, ✕, backdrop): focus returns to the trigger,
  explicitly — the native restoration is a should, not a guarantee.
- **`aria-disabled`, not `disabled`, while sending.** Disabling a focused
  button throws focus to `<body>`; a screen-reader user would lose their
  place at the exact moment feedback matters. The button stays focusable,
  re-entry is guarded in code, and `role="status"` announces `Sending…`.
- **No live character counter — and no `maxlength`.** The limit is 2000
  characters; a counter would be polite-announcement chatter for a wall
  almost nobody hits, and `maxlength` would clip a long paste silently (tail
  gone, nothing announced). Instead the submit-time check keeps every
  character and shows the deck's over-limit message (with the number) as a
  `role="alert"` field error; the server enforces the same limit again.
- **The honeypot is invisible to assistive tech** — `aria-hidden` wrapper,
  `tabindex="-1"`, clipped not moved (no RTL scrollbar ghosts), never
  focusable, named `company_url` like the site's contact form.
- **The trigger's name vs. description.** The visible line is the accessible
  name (2.5.3, voice-control friendly); the deck's longer screen-reader
  string is wired as `aria-describedby`, so it still reads on focus without
  overriding the name.
- **`color-scheme`** follows the active theme inside the dialog so the
  native select popup and autofill don't flash the wrong palette.

---

## i18n & RTL

- Both string tables live in `slikk-a11y.webcomponent.js` (`STRINGS`),
  verbatim from the canonical copy deck. EN and HE are siblings in energy,
  never literal mirrors.
- Rules for any future string: second-person-plural Hebrew, arrows flip for
  RTL (`Report it →` / `← דווחו`), no exclamation marks, no "oops", wit
  never enters aria-labels / select options / validation chrome / privacy
  claims, and credit grammar ends on `by` / `על־ידי` (verb phrase) or `של`
  (product name) — the `ע"י` abbreviation stays a flagged anti-pattern.
- Layout is logical-properties-only (`inline`/`block`, `inset-inline-*`,
  `margin-block-*`), so `dir="rtl"` flips everything with almost zero
  RTL-specific rules. The one legitimate exception: the URL and email inputs
  carry `dir="ltr"` even in Hebrew, because URLs and addresses are inherently
  LTR data — inheriting RTL makes the bidi algorithm shuffle a trailing `/`
  or `?` to the wrong visual end and fights the caret mid-edit. `lang`/`dir`
  are stamped on the trigger and the dialog so screen readers switch voices,
  and Hebrew type leads with Heebo (see [Theming](#theming)).
- The Latin wordmark stays LTR inside RTL; the Hebrew credit uses the
  possessive `ערכת הנגישות של` and reads naturally into it.
- The deck's alternate signature credit (`Accessibility, taken personally,
  by` / `נגישות. באופן אישי. על־ידי`) is deck-canon but deliberately not
  shipped in v1 — the primary credit is the only one wired; no attribute
  selects the variant.

---

## Demo & tests

- `node demo/serve.js` — demo at `http://localhost:4173` (dark/light + EN/HE
  toggles, `noindex`, endpoint mocked: logged, never emailed).
- `npm test` — `node:test` unit suite for the route: validation, honeypot,
  time trap, rate limit, sanitization, recipient lockdown, the SMTP seam.
  A fake transport is injected; no email is ever sent.
- `npm run test:e2e` — Chromium e2e: keyboard-only submit (Tab/Enter only),
  axe-core at zero violations on the page and inside the open dialog, and an
  RTL smoke check in Hebrew. Chromium resolves from
  `PLAYWRIGHT_BROWSERS_PATH`; there is no download step.

The kit ships zero dependencies; `devDependencies` are the test rig only.

---

## The wordmark

The two SVG path `d` strings and `viewBox="25 -738 3844 756"` are the same
outlined Outfit-800 mark as the attribution kit, byte-identical, in both the
trigger and the dialog credit. Copy them from a kit file, never retype; the
regeneration procedure (fonttools, shear 0.20, "Dev" scale 0.83) lives in the
attribution kit's detailed README and is not duplicated here.
