---
name: slikk-attribution
description: Add or update the Slikk.Dev attribution badge in a client site per the canonical kit.
---

# Slikk.Dev attribution badge — apply the kit to a client site

Apply the SlikkCredit footer badge to the current repo exactly per the
canonical kit (this repo's root). Ad-hoc text links are rejected — the badge
is the kit's entire mandate; do not invent extras (humans.txt, meta tags,
JSON-LD credits, console eggs).

## Procedure

### 1. Read the canon

Read the kit assets (`SlikkCredit.jsx`, `slikk-credit.html`,
`slikk-credit.svg`) and the top-level `README.md` sections **"The fixed rules
(never change these)"** and **"What MAY adapt per site"**. Those two sections
are the contract; do not improvise beyond what the adaptable list permits.
`docs/KIT-README-original.md` holds the detailed per-stack quick starts.

### 2. Audit the repo

- Any existing "slikk" credit (grep case-insensitively; if one exists, this is
  an update — keep its established credit line unless it violates the rules).
- The stack (React/RSC, CSS Modules, inline-token, plain SPA, non-React).
- The **real** footer file that renders on every page.
- The footer's actual background color and the site's muted/hover ink tokens.
- Site language(s) and RTL: bilingual sites need localized `text`,
  `aria-label`, and `dir`.
- The site's voice/register, from its own copy — the line must sound like a
  credit *this* site would carry.

### 3. Write the credit line

Follow README **"Writing the credit line"**: 2–5 words; ends on "by" (EN) or
the full maqaf form **"על־ידי"** (HE — never the ע"י abbreviation); no
trailing punctuation; register-matched to the site's own copy; **distinct
from every line in the README's "Live examples" table** (check it); one wink
max; quiet surfaces (content rendered on end-users' shared pages) get quiet
lines. One line per site, kept stable.

### 4. Port the component

Pick the matching recipe from README **"Porting recipes by stack"**:

- **React / Next.js RSC** — copy `SlikkCredit.jsx` (add `dir` + `ariaLabel`
  props on bilingual sites); keep the embedded scoped `<style>`, never convert
  it to utility classes.
- **CSS Modules** — component as-is, or the `.dsk-credit` rules in a
  **global** stylesheet (never a `.module.css` — hashing breaks the selectors).
- **Inline-token sites** — keep the scoped `<style>` block and reference the
  site's tokens inside it; `:hover`/`:focus-visible`/reduced-motion cannot be
  expressed as inline style objects.
- **Plain SPA** — same component; wire `text` through the app's i18n (both
  locales, keys in sync) or hardcode it on single-language sites.
- **Non-React** — paste `slikk-credit.html` verbatim (markup into the footer
  partial, rules into a global stylesheet).

Keep every FIXED item **byte-identical** — hash-verify the two SVG path `d`
strings and the `viewBox` against the kit files (diff, don't eyeball). Adapt
only: lettering ink, mark size (~14–15px), placement, font token (site token
with system-stack fallback), localized `aria-label` + `dir`.

**Dark backgrounds:** muted, AA-passing rest ink (the footer's existing muted
text color) that brightens on hover/focus; the dot and focus ring stay
`#FF2D6B`.

### 5. Verify

- AA contrast (4.5:1) computed against the **real** footer background, not
  assumed — the badge text is 12–13px.
- `aria-label` localized and includes the new-tab hint ("opens slikk.dev in a
  new tab" or localized equivalent); SVG `aria-hidden="true"` +
  `focusable="false"`.
- `rel="nofollow noopener noreferrer"` — all three; `target="_blank"`;
  `href="https://slikk.dev/"`.
- Reduced-motion media query present; focus ring `2px solid #FF2D6B`, offset
  3px, radius 4px; not `position:fixed`.
- Exactly **one** credit per site.
- Repo checks pass (lint, i18n parity where the repo has one, build).

### 6. Ship

- Vendor the kit into the client repo at `.references/attribution-kit/`,
  byte-identical (hash-verify after copy).
- Open a **draft PR** with a Before/After body (screenshot or rendered markup
  of the footer before and after).
- No AI identifiers anywhere — commit messages, PR body, code comments.
