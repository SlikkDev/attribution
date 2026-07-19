'use client';

/**
 * SlikkA11y — React wrapper for the <slikk-a11y> accessibility-report widget.
 *
 * One source of truth: this file only registers the web component (the
 * side-effect import below) and renders the tag. Every behavior — dialog,
 * form, i18n, theming, submission — lives in slikk-a11y.webcomponent.js;
 * nothing is duplicated here.
 *
 * This is a client island by necessity (the widget is interactive), which is
 * the deliberate divergence from SlikkCredit's zero-JS server component. It
 * stays RSC-compatible the Next.js way: render <SlikkA11y /> from any server
 * component and only this island's JS ships.
 *
 * Usage:
 *   import SlikkA11y from './SlikkA11y';
 *   <footer> … <SlikkA11y lang={lang} /> </footer>
 *
 * Props (mirroring the element's attributes 1:1):
 *   lang      — "en" (default) or "he"
 *   endpoint  — report endpoint; omit to use the element's own default
 *   page      — override the reported page URL (default: location.href)
 *   theme     — "dark" | "light"; omit to follow prefers-color-scheme
 *   label     — "quiet" for the understated trigger line
 *   className — extra class to position/space it inside your footer
 *
 * className renders as the `class` attribute explicitly: React 18 passes
 * `className` to a custom element as a literal className="…" attribute the
 * browser ignores (React 19 fixed the mapping) — so the one layout knob has
 * to be spelled `class` here to work on both.
 */
import './slikk-a11y.webcomponent.js';

export default function SlikkA11y({ lang = 'en', endpoint, page, theme, label, className }) {
  return (
    <slikk-a11y
      lang={lang}
      endpoint={endpoint}
      page={page}
      theme={theme}
      label={label}
      {...(className ? { class: className } : {})}
    />
  );
}
