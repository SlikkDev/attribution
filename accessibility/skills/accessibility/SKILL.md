---
name: slikk-accessibility
description: Add or update the Slikk.Dev accessibility-report widget and its email route in a client site per the canonical kit.
---

# Slikk.Dev accessibility kit — apply the kit to a client site

Install the `<slikk-a11y>` report widget and its delivery route in the
current repo exactly per the canonical kit (this repo's root). Ad-hoc
feedback forms and "accessibility overlay" scripts are rejected — the widget
plus the route is the kit's entire mandate; do not invent extras (toolbars,
font-size switchers, contrast overlays, floating buttons).

## Procedure

### 1. Read the canon

Read the kit files (`slikk-a11y.webcomponent.js`, `SlikkA11y.jsx`,
`api/route.js`) and the top-level `README.md` sections **"The fixed rules
(never change these)"** and **"What MAY adapt per site"**. Those two sections
are the contract; do not improvise beyond what the adaptable list permits.
`docs/KIT-REFERENCE.md` holds the per-stack installs, the endpoint contract,
and the theming table.

### 2. Audit the repo

- Any existing `slikk-a11y` (grep case-insensitively; if one exists, this is
  an update — keep its established placement and attributes unless they
  violate the rules).
- The stack: React/Next (use the wrapper) vs. anything else (script tag +
  element). For the route: Next App Router (paste `api/route.js`) vs. a
  non-Next backend (implement the endpoint contract from the reference).
- The **real** footer file that renders on every page.
- The site's theme mechanics (dark/light switch? which tokens?) — decide
  between the `theme` attribute and `--slikk-a11y-*` overrides.
- Site language(s) and RTL: bilingual sites pass `lang` from the site's i18n
  layer, per locale.
- The site's register: hosts that can't take a question mark get
  `label="quiet"`.
- How the deploy manages env (`.env`, platform dashboard, compose file).

### 3. Place the widget

- Exactly **one** `<slikk-a11y>` per page, in the footer flow — never
  `position:fixed`, never auto-injected.
- React/Next: copy `SlikkA11y.jsx` + `slikk-a11y.webcomponent.js`, render the
  wrapper from the footer (server component stays server; the wrapper is the
  island). Otherwise: self-host the `.js` file and add the script tag + tag.
- Set `theme` to match the host (wire it to the host's theme switch if one
  exists), and `--slikk-a11y-*` tokens only if the host palette demands it —
  then recompute AA contrast against the real values, don't eyeball.

### 4. Install the route

- Next: copy `api/route.js` to `app/api/a11y-report/route.js`; ensure `zod`
  and `nodemailer` exist in the host's dependencies.
- Non-Next: implement the endpoint contract (`docs/KIT-REFERENCE.md`) —
  same anti-spam checks, same generic responses — and point the widget at it
  via `endpoint`.
- Wire env from `.env.example`: the `SMTP_*` transport vars and
  `A11Y_REPORT_TO`. Recipients live in env only; never hardcode them
  anywhere the client controls, never accept them from the request.
- If SMTP credentials are not available yet, ship anyway — the route logs
  reports and answers ok without them — and flag the seam explicitly in the
  PR body as the open item.

### 5. Verify

- Keyboard-only pass: Tab to the trigger, Enter, fill, submit, Esc — no
  mouse. Focus lands in the dialog on open, on the confirmation heading on
  success, back on the trigger on close.
- axe scan of the page and the open dialog: **zero violations**, both
  locales the site ships.
- AA contrast (4.5:1 text, 3:1 focus ring) computed against the **real**
  host theme(s), not assumed.
- Hebrew/RTL sites: `dir` flips, arrows flip (`← דווחו`), the Latin wordmark
  stays LTR.
- Hash-verify the two SVG path `d` strings and the `viewBox` against the kit
  files (diff, don't eyeball).
- Reduced motion collapses everything; the honeypot is `aria-hidden` and
  unfocusable; the credit link keeps `rel="nofollow noopener noreferrer"`.
- The endpoint answers `{ ok: true }` to a valid POST (curl it), and the
  report reaches the inbox — or the `[a11y-report]` log line, pre-SMTP.
- Repo checks pass (lint, i18n parity where the repo has one, build).

### 6. Ship

- Vendor the kit into the client repo at `.references/accessibility-kit/`,
  byte-identical (hash-verify after copy).
- Open a **draft PR** with a Before/After body (footer screenshot with the
  badge, dialog screenshot in the host theme) and the env vars the deploy
  still needs, including the SMTP seam status.
- No AI identifiers anywhere — commit messages, PR body, code comments.
