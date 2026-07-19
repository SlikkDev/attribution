/**
 * <slikk-a11y> — the Slikk.Dev accessibility-report widget (Shadow DOM).
 *
 * A small inline badge that opens a native <dialog> where a visitor can report
 * an accessibility problem on the page. Reports POST as JSON to the host's
 * report endpoint (see api/route.js and the endpoint contract in
 * docs/KIT-REFERENCE.md).
 *
 * Unlike the attribution kit, Shadow DOM is the DEFAULT here, not the
 * hostile-CSS fallback: this widget is interactive (dialog, form, states), so
 * hard style isolation in both directions is the baseline, not a trade-off.
 *
 * The cardinal rule still governs: never harm the host site. Styles never
 * leak in either direction, colors are explicit, there is zero network
 * activity until the visitor submits, no cookies, no storage, no tracking,
 * no eval, no remote code. The only global side effect is the custom-element
 * registration below.
 *
 * Usage (the :not(:defined) rule reserves the trigger's height before the
 * deferred script lands, so the upgrade never shifts the host's layout):
 *   <script src="slikk-a11y.webcomponent.js" defer></script>
 *   <style>slikk-a11y:not(:defined){ display:inline-block; min-block-size:40px }</style>
 *   <footer> … <slikk-a11y></slikk-a11y> </footer>
 *
 * Attributes:
 *   lang      — "en" (default) or "he" (native Hebrew, full RTL)
 *   endpoint  — report endpoint (default: "/api/a11y-report")
 *   page      — override the reported page URL (default: location.href)
 *   theme     — "dark" | "light"; omit to follow prefers-color-scheme
 *   label     — "quiet" swaps the trigger line for the understated variant
 *
 * Theming: every color reads from a --slikk-a11y-* custom property on the
 * host element, falling back to the brand tokens. See docs/KIT-REFERENCE.md.
 */
(function () {
  // The React wrapper imports this file, so it may be evaluated during SSR.
  if (typeof window === 'undefined' || typeof customElements === 'undefined') return;
  if (customElements.get('slikk-a11y')) return;

  // Slikk.Dev wordmark — outlined Outfit-800 paths, byte-identical to the
  // attribution kit. Never re-draw, never approximate (see README).
  const LETTERS =
    'M282 12Q193 12 134 -16Q74 -43 31 -101L167 -214Q196 -176 234 -156Q272 -135 325 -135Q370 -135 397 -151Q425 -166 430 -193Q435 -218 420 -235Q406 -251 379 -263Q352 -276 318 -287Q285 -299 254 -316Q222 -332 197 -356Q172 -380 161 -416Q151 -452 161 -505Q175 -572 217 -621Q259 -669 322 -695Q385 -720 462 -720Q539 -720 599 -695Q659 -669 692 -623L555 -510Q529 -542 500 -558Q470 -574 430 -574Q394 -574 370 -561Q346 -548 342 -524Q337 -500 352 -485Q367 -470 394 -458Q421 -447 454 -435Q487 -423 519 -407Q551 -390 576 -366Q600 -340 611 -303Q621 -265 610 -210Q589 -105 503 -47Q416 12 282 12Z M602 0 747 -729H922L776 0Z M832 0 930 -489H1104L1006 0ZM1028 -546Q989 -546 968 -572Q948 -599 956 -638Q964 -678 995 -705Q1026 -732 1066 -732Q1106 -732 1126 -705Q1146 -678 1138 -638Q1130 -599 1099 -572Q1069 -546 1028 -546Z M1376 0 1274 -256 1473 -489H1664L1422 -226L1439 -290L1576 0ZM1062 0 1208 -729H1383L1237 0Z M1894 0 1792 -256 1991 -489H2182L1940 -226L1957 -290L2094 0ZM1580 0 1726 -729H1901L1755 0Z M2459 0 2485 -128H2626Q2676 -128 2717 -147Q2757 -166 2785 -204Q2813 -241 2823 -295Q2834 -349 2821 -386Q2808 -422 2775 -442Q2743 -461 2693 -461H2545L2571 -588H2719Q2787 -588 2840 -567Q2894 -546 2928 -507Q2963 -468 2975 -414Q2988 -360 2975 -294Q2961 -228 2927 -174Q2893 -120 2843 -81Q2793 -42 2732 -21Q2670 0 2603 0ZM2359 0 2477 -588H2626L2508 0Z M3147 10Q3078 10 3031 -17Q2984 -44 2964 -93Q2944 -141 2957 -203Q2969 -264 3008 -312Q3046 -360 3102 -388Q3158 -415 3221 -415Q3283 -415 3325 -389Q3367 -363 3385 -317Q3402 -271 3391 -212Q3388 -200 3384 -187Q3381 -175 3374 -158L3015 -156L3034 -249L3335 -251L3262 -211Q3268 -245 3263 -267Q3259 -289 3244 -300Q3228 -312 3202 -312Q3175 -312 3152 -299Q3129 -286 3114 -261Q3098 -237 3091 -203Q3084 -168 3091 -144Q3098 -120 3117 -107Q3136 -95 3168 -95Q3197 -95 3222 -104Q3247 -114 3269 -135L3330 -60Q3293 -25 3246 -8Q3200 10 3147 10Z M3488 0 3404 -406H3559L3595 -64H3536L3709 -406H3862L3615 0Z';
  const DOT =
    'M2200 12Q2157 12 2129 -18Q2100 -47 2100 -90Q2100 -133 2129 -162Q2157 -191 2200 -191Q2244 -191 2272 -162Q2300 -133 2300 -90Q2300 -47 2272 -18Q2244 12 2200 12Z';

  const MAX_DESC = 2000;

  // All copy ships from the canonical deck, verbatim, both locales.
  // No live character counter on the textarea: the limit is generous, and a
  // counter is screen-reader chatter for a wall almost nobody hits. And no
  // maxlength attribute either — maxlength clips a long paste silently, tail
  // gone, nothing announced; the submit-time check keeps every character and
  // says what would help (the deck's over-limit line). The route re-checks.
  //
  // The URL and email inputs carry dir="ltr" even in the Hebrew locale: URLs
  // and addresses are inherently LTR data, and letting them inherit RTL makes
  // the bidi algorithm shuffle trailing "/" and "?" to the wrong end — the
  // one legitimate exception to the logical-properties-do-everything rule.
  const STRINGS = {
    en: {
      dir: 'ltr',
      trigger: 'Something not accessible?',
      triggerQuiet: 'Accessibility feedback',
      triggerAria: 'Report an accessibility problem on this page — opens a short form',
      title: "Tell us what's in the way.",
      intro:
        'Screen reader hit a wall? Keyboard going in circles? We want to hear it — and we actually fix these.',
      rateLimitTitle: "That's a few in a row.",
      rateLimitLine: 'Give it ten minutes and try again. Everything you wrote stays put.',
      descLabel: "What didn't work?",
      descPlaceholder:
        "e.g. the screen reader skips the menu, or a button the keyboard can't reach",
      descRequired: 'An empty box is hard to fix. A word or two is plenty.',
      descTooLong: "That's past {max} characters. Trim a little — we do read everything.",
      urlLabel: 'Where did it happen?',
      urlHint: 'Auto-filled from this page. Edit away.',
      techLabel: 'What were you using? (optional)',
      tech: [
        { v: 'screen_reader', label: 'Screen reader' },
        { v: 'keyboard', label: 'Keyboard only' },
        { v: 'voice', label: 'Voice control' },
        { v: 'zoom', label: 'Magnification or zoom' },
        { v: 'switch', label: 'Switch device' },
        { v: 'other', label: 'Something else' },
        { v: 'no_say', label: 'Prefer not to say' },
      ],
      emailLabel: 'Email (optional)',
      emailHint: "Only so we can tell you when it's fixed. No newsletter. No marketing. Nothing.",
      submit: 'Report it →',
      sending: 'Sending…',
      successTitle: 'Got it. Thank you.',
      successLine:
        "You just made this site better for someone you'll never meet. We'll take it from here.",
      errorTitle: "That didn't send. Not your fault.",
      errorLine: "Everything you wrote is still here. Try again — we'd hate to miss this one.",
      closeAria: 'Close the accessibility report form',
      privacy: 'Straight to humans. No tracking.',
      credit: 'Accessibility Kit by',
      creditAria: 'Accessibility Kit by Slikk.Dev — opens slikk.dev in a new tab',
    },
    he: {
      dir: 'rtl',
      trigger: 'משהו לא נגיש?',
      triggerQuiet: 'משוב נגישות',
      triggerAria: 'דיווח על בעיית נגישות בעמוד הזה — נפתח טופס קצר',
      title: 'ספרו לנו מה עומד לכם בדרך.',
      intro: 'קורא המסך נתקל בקיר? הטאב מסתובב במעגלים? אנחנו רוצים לשמוע — ובאמת מתקנים.',
      rateLimitTitle: 'כמה דיווחים ברצף.',
      rateLimitLine: 'תנו לזה עשר דקות ונסו שוב. כל מה שכתבתם נשאר במקום.',
      descLabel: 'מה לא עבד?',
      descPlaceholder: 'למשל: קורא המסך מדלג על התפריט, או כפתור שאי אפשר להגיע אליו מהמקלדת',
      descRequired: 'בלי תיאור אין לנו מה לתקן. מילה או שתיים מספיקות.',
      descTooLong: 'עברתם את מגבלת {max} התווים. קצרו קצת — אנחנו קוראים הכול.',
      urlLabel: 'איפה זה קרה?',
      urlHint: 'מולא אוטומטית מהעמוד הנוכחי. אפשר לשנות.',
      techLabel: 'במה השתמשתם? (לא חובה)',
      tech: [
        { v: 'screen_reader', label: 'קורא מסך' },
        { v: 'keyboard', label: 'מקלדת בלבד' },
        { v: 'voice', label: 'שליטה קולית' },
        { v: 'zoom', label: 'הגדלה או זום' },
        { v: 'switch', label: 'מתג (Switch)' },
        { v: 'other', label: 'משהו אחר' },
        { v: 'no_say', label: 'מעדיפים לא לציין' },
      ],
      emailLabel: 'אימייל (לא חובה)',
      emailHint: 'רק כדי לעדכן אתכם כשזה יתוקן. בלי ניוזלטר. בלי שיווק. בלי כלום.',
      submit: '← דווחו',
      sending: 'שולחים…',
      successTitle: 'התקבל. תודה.',
      successLine: 'הרגע שיפרתם את האתר בשביל מישהו שלעולם לא תפגשו. מכאן זה עלינו.',
      errorTitle: 'זה לא נשלח. לא באשמתכם.',
      errorLine: 'כל מה שכתבתם עדיין כאן. נסו שוב — חבל לנו לפספס דווקא את הדיווח הזה.',
      closeAria: 'סגירת הטופס לדיווח על בעיית נגישות',
      privacy: 'ישר לבני אדם. בלי מעקב.',
      credit: 'ערכת הנגישות של',
      creditAria: 'ערכת הנגישות של Slikk.Dev — slikk.dev נפתח בכרטיסייה חדשה',
    },
  };

  // Brand tokens (slikk.dev globals.css). Dark is the default, exactly like
  // the site; an explicit theme attribute beats prefers-color-scheme.
  const DARK_TOKENS = `
      --_surface: var(--slikk-a11y-surface, #111111);
      --_ink: var(--slikk-a11y-ink, #F0EDE8);
      --_ink-soft: var(--slikk-a11y-ink-soft, rgba(240, 237, 232, 0.66));
      --_ink-mute: var(--slikk-a11y-ink-mute, rgba(240, 237, 232, 0.55));
      --_field: var(--slikk-a11y-field, rgba(240, 237, 232, 0.07));
      --_line: var(--slikk-a11y-line, rgba(240, 237, 232, 0.16));
      --_accent: var(--slikk-a11y-accent, #FF2D6B);
      --_accent-strong: var(--slikk-a11y-accent-strong, #E6004E);
      --_accent-ink: var(--slikk-a11y-accent-ink, #ffffff);
      --_scheme: dark;`;
  const LIGHT_TOKENS = `
      --_surface: var(--slikk-a11y-surface, #ECE5DB);
      --_ink: var(--slikk-a11y-ink, #17130F);
      --_ink-soft: var(--slikk-a11y-ink-soft, rgba(23, 19, 15, 0.70));
      --_ink-mute: var(--slikk-a11y-ink-mute, rgba(23, 19, 15, 0.62));
      --_field: var(--slikk-a11y-field, rgba(23, 19, 15, 0.05));
      --_line: var(--slikk-a11y-line, rgba(23, 19, 15, 0.18));
      --_accent: var(--slikk-a11y-accent, #CC0046);
      --_accent-strong: var(--slikk-a11y-accent-strong, #CC0046);
      --_accent-ink: var(--slikk-a11y-accent-ink, #ffffff);
      --_scheme: light;`;

  // Layout is logical-properties only (inline/block, no left/right), so the
  // same CSS serves LTR and RTL. The focus ring is the family constant:
  // 2px accent, offset 3px — #FF2D6B on dark, the site's own #CC0046 on light
  // (both hold ≥3:1 non-text contrast against their canvas).
  //
  // `all:initial` on :host is the inheritance firewall: Shadow DOM blocks host
  // *selectors*, but inheritable properties (text-transform, letter-spacing,
  // text-align, text-shadow — an uppercased footer, say) still flow in unless
  // reset at the boundary. `all` leaves direction/unicode-bidi and every
  // custom property alone, so RTL and --slikk-a11y-* theming keep working.
  const CSS = `
    :host{ all:initial; display:inline-block;${DARK_TOKENS}
      --_font: var(--slikk-a11y-font, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);
    }
    @media (prefers-color-scheme: light){ :host{${LIGHT_TOKENS} } }
    :host([theme="dark"]){${DARK_TOKENS} }
    :host([theme="light"]){${LIGHT_TOKENS} }
    /* Hebrew leads with Heebo — the family's Hebrew face. Document-level
       @font-face rules apply inside shadow DOM, so hosts that self-host Heebo
       (every Slikk.Dev build) get it for free; elsewhere the system stack
       stands in with zero network cost. */
    :host([lang="he"]){
      --_font: var(--slikk-a11y-font, "Heebo", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);
    }

    *, *::before, *::after{ box-sizing:border-box }

    .trigger{
      display:inline-flex; align-items:center; gap:.5em;
      min-height:40px; padding:10px 16px;
      background:var(--_surface); color:var(--_ink-soft);
      border:1px solid var(--_line); border-radius:999px;
      font:600 13px/1 var(--_font); cursor:pointer;
      transition:color .18s ease, border-color .18s ease;
    }
    .trigger:hover{ color:var(--_ink); border-color:var(--_ink-mute) }

    :is(button, a, input, select, textarea):focus-visible{
      outline:2px solid var(--_accent); outline-offset:3px;
    }

    dialog{
      background:var(--_surface); color:var(--_ink);
      border:1px solid var(--_line); border-radius:16px;
      width:min(92vw, 30rem); max-height:min(88vh, 46rem);
      padding:clamp(18px, 4vw, 24px); margin:auto;
      box-shadow:0 24px 80px -24px rgba(0, 0, 0, 0.7);
      font:400 15px/1.6 var(--_font);
      color-scheme:var(--_scheme);
    }
    dialog::backdrop{ background:rgba(8, 8, 8, 0.62) }
    dialog[open]{ animation:dsk-rise .28s cubic-bezier(0.16, 1, 0.3, 1) }
    @keyframes dsk-rise{ from{ opacity:0; transform:translateY(14px) } }

    .head{ display:flex; align-items:flex-start; justify-content:space-between; gap:12px }
    .title{ margin:0; font:800 1.35rem/1.15 var(--_font); letter-spacing:-0.02em }
    .close{
      flex:none; inline-size:32px; block-size:32px;
      display:grid; place-items:center;
      margin-block-start:-4px; margin-inline-end:-6px;
      background:none; border:0; border-radius:8px;
      color:var(--_ink-mute); font:400 18px/1 var(--_font);
      cursor:pointer; transition:color .18s ease;
    }
    .close:hover{ color:var(--_ink) }
    .intro{ margin:10px 0 0; color:var(--_ink-soft); font-size:14.5px }

    form{ margin-block-start:4px }
    .fld{ margin-block-start:14px }
    label{
      display:block; margin-block-end:7px;
      font:600 11px/1.2 var(--_font);
      text-transform:uppercase; letter-spacing:.12em;
      color:var(--_ink-mute);
    }
    input, select, textarea{
      width:100%; padding:10px 14px;
      background:var(--_field); color:var(--_ink);
      border:1px solid var(--_line); border-radius:12px;
      font:400 14px/1.5 var(--_font);
      transition:border-color .18s ease;
    }
    :is(input, select, textarea):focus{ border-color:var(--_accent) }
    textarea{ resize:vertical; min-height:84px }
    ::placeholder{ color:var(--_ink-mute); opacity:1 }
    select{ cursor:pointer }
    .hint{ margin:6px 0 0; font-size:13px; color:var(--_ink-mute) }
    .ferr{ margin:6px 0 0; font-size:13px; color:var(--_accent) }

    .fail{
      margin-block-start:16px; padding:12px 14px;
      border:1px solid var(--_accent); border-radius:12px;
      font-size:14px; color:var(--_ink);
    }
    .fail strong{ display:block; margin-block-end:2px }

    .actions{
      margin-block-start:18px;
      display:flex; align-items:center; flex-wrap:wrap; gap:12px 16px;
    }
    .submit{
      display:inline-flex; align-items:center;
      min-height:44px; padding:12px 24px;
      background:var(--_accent-strong); color:var(--_accent-ink);
      /* Transparent, not 0: forced-colors mode paints this border, so the
         primary action keeps a boundary in Windows High Contrast. */
      border:1px solid transparent; border-radius:999px;
      font:600 14px/1 var(--_font); cursor:pointer;
      transition:transform .18s ease, opacity .18s ease;
    }
    .submit:hover{ transform:scale(1.03) }
    .submit[aria-disabled="true"]{ opacity:.6; cursor:wait; transform:none }
    .privacy{ margin:0; font-size:12.5px; color:var(--_ink-mute) }

    .done{ margin-block-start:18px }
    .done-title{ margin:0; font:800 1.2rem/1.2 var(--_font); letter-spacing:-0.02em }
    .done-title:focus{ outline:none }
    .done p{ margin:8px 0 0; color:var(--_ink-soft); font-size:14.5px }

    .credit{
      margin-block-start:18px; padding-block-start:12px;
      border-block-start:1px solid var(--_line);
    }
    .credit a{
      display:inline-flex; align-items:center; gap:.5em;
      padding:6px 2px; border-radius:4px;
      color:var(--_ink-mute); text-decoration:none;
      font:600 12px/1 var(--_font);
      transition:color .18s ease;
    }
    .credit a:hover{ color:var(--_ink) }
    .credit svg{ height:14px; width:auto; display:block }

    .hp{
      position:absolute; width:1px; height:1px;
      overflow:hidden; clip-path:inset(50%);
    }
    .sr-only{
      position:absolute; width:1px; height:1px;
      margin:-1px; padding:0; border:0;
      overflow:hidden; clip:rect(0 0 0 0); clip-path:inset(50%);
      white-space:nowrap;
    }

    @media (prefers-reduced-motion: reduce){
      *, *::before, *::after{ transition:none !important; animation:none !important }
    }
  `;

  // Styles attach as a constructable stylesheet where supported: adopted
  // sheets are CSSOM, not markup, so a host's strict CSP style-src cannot
  // strip them (an inline <style> would be stripped, unstyling the widget and
  // surfacing the honeypot). Engines without the constructor fall back to the
  // inline <style>, which needs style-src 'unsafe-inline' — see the README.
  let SHEET = null;
  try {
    SHEET = new CSSStyleSheet();
    SHEET.replaceSync(CSS);
  } catch {
    SHEET = null;
  }
  const STYLE = SHEET ? '' : `<style>${CSS}</style>`;

  function wordmark(cls) {
    return `<svg${cls ? ` class="${cls}"` : ''} viewBox="25 -738 3844 756" aria-hidden="true" focusable="false">
        <path fill="currentColor" d="${LETTERS}"/>
        <path fill="#FF2D6B" d="${DOT}"/>
      </svg>`;
  }

  function view(t, lang, quiet) {
    const opts = t.tech
      .map((o) => `<option value="${o.v}"${o.v === 'no_say' ? ' selected' : ''}>${o.label}</option>`)
      .join('');
    // The trigger's visible line IS its accessible name (WCAG 2.5.3 Label in
    // Name); the deck's longer screen-reader string rides along as the
    // accessible description instead of overriding the name.
    // The chip is label-only, per the deck — the wordmark lives in the dialog
    // credit, once. A question mark reading straight into a brand name would
    // be two winks and one misreading too many.
    return `
      <button type="button" class="trigger" aria-haspopup="dialog"
        aria-describedby="trigger-hint" lang="${lang}" dir="${t.dir}">
        <span class="t">${quiet ? t.triggerQuiet : t.trigger}</span>
      </button>
      <span id="trigger-hint" class="sr-only" lang="${lang}">${t.triggerAria}</span>
      <dialog aria-labelledby="dlg-title" lang="${lang}" dir="${t.dir}">
        <div class="head">
          <h2 class="title" id="dlg-title">${t.title}</h2>
          <button type="button" class="close" aria-label="${t.closeAria}">
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        <p class="intro">${t.intro}</p>
        <form novalidate>
          <!-- hidden as an attribute, not just CSS: if a strict CSP ever
               strips the fallback stylesheet, the honeypot must still never
               surface for a human to fill. -->
          <div class="hp" aria-hidden="true" hidden>
            <label for="f-hp">Company website</label>
            <input id="f-hp" type="text" name="company_url" tabindex="-1" autocomplete="off">
          </div>
          <div class="fld">
            <label for="f-desc">${t.descLabel}</label>
            <textarea id="f-desc" name="description" required rows="3"
              placeholder="${t.descPlaceholder}"
              aria-describedby="f-desc-err"></textarea>
            <p class="ferr" id="f-desc-err" role="alert" hidden></p>
          </div>
          <div class="fld">
            <label for="f-url">${t.urlLabel}</label>
            <input id="f-url" name="page" type="url" autocomplete="off" dir="ltr"
              aria-describedby="f-url-hint">
            <p class="hint" id="f-url-hint">${t.urlHint}</p>
          </div>
          <div class="fld">
            <label for="f-tech">${t.techLabel}</label>
            <select id="f-tech" name="tech">${opts}</select>
          </div>
          <div class="fld">
            <label for="f-email">${t.emailLabel}</label>
            <input id="f-email" name="email" type="email" autocomplete="email" dir="ltr"
              aria-describedby="f-email-hint">
            <p class="hint" id="f-email-hint">${t.emailHint}</p>
          </div>
          <div class="fail" role="alert" hidden></div>
          <div class="actions">
            <button type="submit" class="submit">${t.submit}</button>
            <p class="privacy">${t.privacy}</p>
          </div>
        </form>
        <div class="done" hidden>
          <h3 class="done-title" tabindex="-1">${t.successTitle}</h3>
          <p>${t.successLine}</p>
        </div>
        <p class="status sr-only" role="status"></p>
        <div class="credit">
          <a href="https://slikk.dev/" target="_blank" rel="nofollow noopener noreferrer"
            aria-label="${t.creditAria}">
            <span class="t">${t.credit}</span>
            ${wordmark('')}
          </a>
        </div>
      </dialog>`;
  }

  class SlikkA11y extends HTMLElement {
    static get observedAttributes() {
      // theme/endpoint/page are read live by CSS or at submit time — only the
      // string-bearing attributes force a re-render.
      return ['lang', 'label'];
    }

    constructor() {
      super();
      this._els = null;
      this._events = null; // AbortController for shadow listeners
      this._inflight = null; // AbortController for an in-flight submit
      this._state = 'idle'; // idle | sending | success | error
      this._openedAt = 0;
      this._urlEdited = false;
      this._pressOutside = false; // was the pointer PRESS on the backdrop too?
      this._was429 = false; // last failure was the rate limit, not a blip
    }

    connectedCallback() {
      if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
      this._render();
      // The time-trap clock starts when the widget first renders and NEVER
      // resets on close/reopen — a visitor who types, accidentally hits Esc,
      // reopens (text intact) and submits must report their real elapsed
      // time, not the two seconds since the reopen; the route silently drops
      // anything under its minimum. Same for the power user pasting a
      // prepared report: the clock has been running since page render.
      if (!this._openedAt) this._openedAt = Date.now();
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue) return;
      if (this.shadowRoot && this.isConnected) this._render();
    }

    disconnectedCallback() {
      // Clean teardown: drop every listener first (so the dialog's close
      // event can't run _onClose, which treats close-while-sending as a user
      // cancel — teardown is not), then close the dialog. The in-flight
      // request is deliberately NOT aborted: it was sent keepalive, so an SPA
      // route change that unmounts the footer mid-send can't lose the report.
      if (this._events) this._events.abort();
      this._events = null;
      if (this._els && this._els.dialog.open) this._els.dialog.close();
    }

    get _lang() {
      return this.getAttribute('lang') === 'he' ? 'he' : 'en';
    }

    get _t() {
      return STRINGS[this._lang];
    }

    _render() {
      const t = this._t;
      const quiet = this.getAttribute('label') === 'quiet';

      // Live language switches must never eat the visitor's text: snapshot
      // input + state, rebuild, restore.
      const prev = this._els
        ? {
            open: this._els.dialog.open,
            desc: this._els.desc.value,
            url: this._els.url.value,
            tech: this._els.tech.value,
            email: this._els.email.value,
          }
        : null;

      if (this._events) this._events.abort();
      this._events = new AbortController();
      const on = { signal: this._events.signal };

      this.shadowRoot.innerHTML = STYLE + view(t, this._lang, quiet);
      if (SHEET) this.shadowRoot.adoptedStyleSheets = [SHEET];

      const $ = (sel) => this.shadowRoot.querySelector(sel);
      const els = (this._els = {
        trigger: $('.trigger'),
        dialog: $('dialog'),
        close: $('.close'),
        intro: $('.intro'),
        form: $('form'),
        hp: $('#f-hp'),
        desc: $('#f-desc'),
        descErr: $('#f-desc-err'),
        url: $('#f-url'),
        tech: $('#f-tech'),
        email: $('#f-email'),
        fail: $('.fail'),
        submit: $('.submit'),
        done: $('.done'),
        doneTitle: $('.done-title'),
        status: $('.status'),
      });

      els.trigger.addEventListener('click', () => this._open(), on);
      els.close.addEventListener('click', () => els.dialog.close(), on);
      els.dialog.addEventListener('close', () => this._onClose(), on);
      els.dialog.addEventListener('pointerdown', (e) => this._trackBackdropPress(e), on);
      els.dialog.addEventListener('click', (e) => this._maybeBackdropClose(e), on);
      els.form.addEventListener('submit', (e) => this._submit(e), on);
      els.desc.addEventListener('input', () => this._clearFieldError(), on);
      els.url.addEventListener('input', () => (this._urlEdited = true), on);

      if (prev) {
        els.desc.value = prev.desc;
        els.url.value = prev.url;
        els.tech.value = prev.tech;
        els.email.value = prev.email;
        if (this._state === 'success') this._showSuccess(false);
        if (this._state === 'error') this._showError();
        if (this._state === 'sending') this._showSending();
        if (prev.open) els.dialog.showModal();
      }
    }

    _open() {
      const els = this._els;
      if (this._state === 'success') this._reset();
      // No clock reset here — see connectedCallback. Reopening an interrupted
      // report keeps the honest elapsed time.
      if (!this._openedAt) this._openedAt = Date.now();
      if (!this._urlEdited || !els.url.value) {
        els.url.value = this.getAttribute('page') || window.location.href;
        this._urlEdited = false;
      }
      els.dialog.showModal();
      els.desc.focus();
    }

    _onClose() {
      if (this._state === 'sending') {
        // Closing mid-send is a cancel: abort the request so a late success
        // can't land against a closed dialog — unseen, unannounced, and then
        // greeting the reopening visitor with an unexplained empty form.
        // Their text is untouched; submitting again is one keystroke.
        if (this._inflight) this._inflight.abort();
        this._setIdleSubmit();
      }
      if (this._state === 'success') this._reset();
      // Native dialogs usually restore focus; make it a guarantee.
      if (this.isConnected) this._els.trigger.focus();
    }

    _isOutsideDialog(e) {
      const r = this._els.dialog.getBoundingClientRect();
      return (
        e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom
      );
    }

    _trackBackdropPress(e) {
      // Remember whether the PRESS itself hit the backdrop. A text-selection
      // drag that starts in the textarea and releases past the edge fires a
      // click on the dialog with outside coordinates — that must not close.
      this._pressOutside = e.target === this._els.dialog && this._isOutsideDialog(e);
    }

    _maybeBackdropClose(e) {
      if (e.target !== this._els.dialog) return;
      if (this._pressOutside && this._isOutsideDialog(e)) this._els.dialog.close();
      this._pressOutside = false;
    }

    async _submit(e) {
      e.preventDefault();
      if (this._state === 'sending') return;
      const t = this._t;
      const els = this._els;
      const description = els.desc.value.trim();

      if (!description) return this._fieldError(t.descRequired);
      if (description.length > MAX_DESC)
        return this._fieldError(t.descTooLong.replace('{max}', String(MAX_DESC)));
      this._clearFieldError();
      els.fail.hidden = true;

      this._showSending();

      const body = {
        description,
        page: els.url.value.trim(),
        tech: els.tech.value,
        email: els.email.value.trim(),
        lang: this._lang,
        company_url: els.hp.value,
        elapsed_ms: Date.now() - this._openedAt,
      };

      this._inflight = new AbortController();
      let ok = false;
      let status = 0;
      try {
        const res = await fetch(this.getAttribute('endpoint') || '/api/a11y-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          // keepalive: the request outlives the element, so an SPA unmount
          // mid-send still delivers the report. Bodies here sit far under
          // the keepalive quota.
          keepalive: true,
          signal: this._inflight.signal,
        });
        ok = res.ok;
        status = res.status;
      } catch (err) {
        if (err && err.name === 'AbortError') {
          // The visitor closed mid-send (cancel) — state is already idle.
          this._inflight = null;
          return;
        }
        ok = false;
      }
      this._inflight = null;
      if (ok) this._showSuccess(true);
      else this._showError(status === 429);
    }

    _fieldError(message) {
      const els = this._els;
      els.descErr.textContent = message;
      els.descErr.hidden = false;
      els.desc.setAttribute('aria-invalid', 'true');
      els.desc.focus();
    }

    _clearFieldError() {
      const els = this._els;
      if (els.descErr.hidden) return;
      els.descErr.hidden = true;
      els.descErr.textContent = '';
      els.desc.removeAttribute('aria-invalid');
    }

    _showSending() {
      const els = this._els;
      this._state = 'sending';
      // aria-disabled instead of disabled: the button stays focusable, so
      // keyboard and screen-reader focus is never dropped mid-flight.
      els.submit.setAttribute('aria-disabled', 'true');
      els.submit.textContent = this._t.sending;
      els.status.textContent = this._t.sending;
    }

    _setIdleSubmit() {
      const els = this._els;
      this._state = 'idle';
      els.submit.removeAttribute('aria-disabled');
      els.submit.textContent = this._t.submit;
      els.status.textContent = '';
    }

    _showSuccess(moveFocus) {
      const els = this._els;
      this._state = 'success';
      els.intro.hidden = true;
      els.form.hidden = true;
      els.done.hidden = false;
      els.status.textContent = this._t.successTitle;
      if (moveFocus && els.dialog.open) els.doneTitle.focus();
    }

    _showError(rateLimited) {
      const els = this._els;
      this._state = 'error';
      if (typeof rateLimited === 'boolean') this._was429 = rateLimited;
      els.submit.removeAttribute('aria-disabled');
      els.submit.textContent = this._t.submit;
      els.status.textContent = '';
      // A 429 gets its own advice — "try again" is exactly wrong against a
      // ten-minute window (WCAG 3.3.3: say what would actually help).
      const title = this._was429 ? this._t.rateLimitTitle : this._t.errorTitle;
      const line = this._was429 ? this._t.rateLimitLine : this._t.errorLine;
      // The visitor's text stays exactly where they left it; only the alert
      // appears. Static kit strings — no user content ever enters innerHTML.
      els.fail.innerHTML = `<strong>${title}</strong>${line}`;
      els.fail.hidden = false;
    }

    _reset() {
      const els = this._els;
      this._state = 'idle';
      this._was429 = false;
      // _openedAt keeps running — elapsed time only ever accumulates, which
      // is honest for humans and no help to bots (bots don't run this code).
      els.form.reset();
      this._urlEdited = false;
      this._clearFieldError();
      els.fail.hidden = true;
      els.fail.innerHTML = '';
      els.form.hidden = false;
      els.intro.hidden = false;
      els.done.hidden = true;
      els.status.textContent = '';
      els.submit.removeAttribute('aria-disabled');
      els.submit.textContent = this._t.submit;
    }
  }

  customElements.define('slikk-a11y', SlikkA11y);
})();
