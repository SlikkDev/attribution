/**
 * End-to-end suite: boots demo/serve.js, drives the widget in Chromium.
 *
 * - Keyboard-only submit (Tab/Enter — the mouse never moves)
 * - axe-core at zero violations: page + open dialog, EN and HE, dark and light
 * - RTL smoke check in Hebrew (direction, strings, LTR data fields)
 * - Host-inheritance firewall (an uppercased footer must not reach the dialog)
 * - Time-trap honesty across close/reopen (an interrupted report keeps its clock)
 *
 * The context runs with reducedMotion: 'reduce' so axe never scans mid-entrance
 * animation — the widget collapses motion under that preference by contract,
 * and a scan that lands inside a fade reads transient, wrong colors.
 *
 * Chromium is resolved from PLAYWRIGHT_BROWSERS_PATH (no download step).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const PORT = 4519;
const BASE = `http://127.0.0.1:${PORT}`;
const AXE_SOURCE = readFileSync(
  path.join(path.dirname(require.resolve('axe-core')), 'axe.min.js'),
  'utf8'
);

function chromiumExecutable() {
  try {
    const p = chromium.executablePath();
    if (p && existsSync(p)) return p;
  } catch {
    // fall through to the browsers dir scan
  }
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  for (const dir of readdirSync(root)) {
    if (/^chromium-\d+$/.test(dir)) {
      const p = path.join(root, dir, 'chrome-linux', 'chrome');
      if (existsSync(p)) return p;
    }
  }
  throw new Error(`No Chromium found under ${root}`);
}

let server;
let browser;
let context;

before(async () => {
  server = spawn(process.execPath, [path.join(here, '..', 'demo', 'serve.js')], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  // Readiness = the server actually answers, not a substring of its log line.
  const deadline = Date.now() + 10000;
  let up = false;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error('demo server exited early');
    try {
      const res = await fetch(`${BASE}/`);
      if (res.ok) {
        up = true;
        break;
      }
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!up) throw new Error('demo server did not start');
  browser = await chromium.launch({ executablePath: chromiumExecutable() });
  context = await browser.newContext({ reducedMotion: 'reduce' });
});

after(async () => {
  if (browser) await browser.close();
  if (server) server.kill();
});

async function openPage() {
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => !!customElements.get('slikk-a11y'));
  return page;
}

async function openDialog(page) {
  await page.locator('slikk-a11y .trigger').click();
  await page.waitForFunction(
    () => document.getElementById('widget').shadowRoot.querySelector('dialog').open
  );
}

async function runAxe(page, scopeSelector) {
  await page.addScriptTag({ content: AXE_SOURCE });
  const violations = await page.evaluate(async (scope) => {
    const target = scope ? document.querySelector(scope) : document;
    const results = await window.axe.run(target, { resultTypes: ['violations'] });
    return results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => n.target.join(' ')),
    }));
  }, scopeSelector || null);
  return violations;
}

const deepActive = (page) =>
  page.evaluate(() => {
    let el = document.activeElement;
    while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;
    return {
      tag: el ? el.tagName.toLowerCase() : null,
      cls: el ? el.className : null,
      id: el ? el.id : null,
    };
  });

// The full conformance matrix: both locales, both themes, page + open dialog.
// "Run them; don't trust prose" only counts if the suite covers what the
// prose claims — including the light palette.
for (const theme of ['dark', 'light']) {
  for (const lang of ['en', 'he']) {
    test(`axe: ${lang} / ${theme} — page and open dialog have zero violations`, async () => {
      const page = await openPage();
      if (theme === 'light') await page.locator('#t-light').click();
      if (lang === 'he') await page.locator('#l-he').click();

      const pageViolations = await runAxe(page);
      assert.deepEqual(pageViolations, [], JSON.stringify(pageViolations, null, 2));

      await openDialog(page);
      const dialogViolations = await runAxe(page, 'slikk-a11y');
      assert.deepEqual(dialogViolations, [], JSON.stringify(dialogViolations, null, 2));
      await page.close();
    });
  }
}

test('keyboard-only: Tab/Enter submits a report end to end', async () => {
  const page = await openPage();

  // Tab until focus lands on the widget's trigger — no mouse involved.
  let reached = false;
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab');
    const active = await deepActive(page);
    if (active.cls && String(active.cls).includes('trigger')) {
      reached = true;
      break;
    }
  }
  assert.ok(reached, 'Tab never reached the widget trigger');

  await page.keyboard.press('Enter');
  await page.waitForFunction(() => {
    const w = document.getElementById('widget');
    return w && w.shadowRoot.querySelector('dialog').open;
  });

  // Focus lands in the description field; the URL field is pre-filled.
  assert.equal((await deepActive(page)).id, 'f-desc');
  const urlValue = await page.evaluate(
    () => document.getElementById('widget').shadowRoot.querySelector('#f-url').value
  );
  assert.ok(urlValue.startsWith(BASE), `URL not auto-filled: "${urlValue}"`);

  await page.keyboard.type('The demo hero heading is skipped by my screen reader.');
  await page.keyboard.press('Tab'); // → page URL
  await page.keyboard.press('Tab'); // → assistive tech
  await page.keyboard.press('Tab'); // → email
  await page.keyboard.press('Tab'); // → submit
  assert.equal((await deepActive(page)).cls, 'submit');
  await page.keyboard.press('Enter');

  // Success panel appears and focus moves to its heading.
  await page.waitForFunction(() => {
    const w = document.getElementById('widget');
    return !w.shadowRoot.querySelector('.done').hidden;
  });
  const active = await deepActive(page);
  assert.equal(active.cls, 'done-title');
  const successTitle = await page.evaluate(
    () => document.getElementById('widget').shadowRoot.querySelector('.done-title').textContent
  );
  assert.equal(successTitle, 'Got it. Thank you.');

  // Escape still closes, and focus returns to the trigger.
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => {
    const w = document.getElementById('widget');
    return !w.shadowRoot.querySelector('dialog').open;
  });
  assert.equal((await deepActive(page)).cls, 'trigger');
  await page.close();
});

test('RTL smoke: Hebrew flips direction and strings; URL/email fields stay LTR', async () => {
  const page = await openPage();
  await page.locator('#l-he').click();

  assert.equal(await page.getAttribute('html', 'dir'), 'rtl');
  assert.equal(await page.getAttribute('#widget', 'lang'), 'he');

  const trigger = page.locator('slikk-a11y .trigger');
  assert.equal((await trigger.locator('.t').textContent()).trim(), 'משהו לא נגיש?');
  await openDialog(page);

  const dialog = await page.evaluate(() => {
    const d = document.getElementById('widget').shadowRoot.querySelector('dialog');
    return {
      dir: d.getAttribute('dir'),
      lang: d.getAttribute('lang'),
      title: d.querySelector('.title').textContent,
      submit: d.querySelector('.submit').textContent.trim(),
      // URLs and email addresses are LTR data; in the RTL dialog they must
      // not inherit rtl, or the bidi algorithm mangles them on screen.
      urlDir: getComputedStyle(d.querySelector('#f-url')).direction,
      emailDir: getComputedStyle(d.querySelector('#f-email')).direction,
    };
  });
  assert.equal(dialog.dir, 'rtl');
  assert.equal(dialog.lang, 'he');
  assert.equal(dialog.title, 'ספרו לנו מה עומד לכם בדרך.');
  assert.equal(dialog.submit, '← דווחו');
  assert.equal(dialog.urlDir, 'ltr');
  assert.equal(dialog.emailDir, 'ltr');

  const violations = await runAxe(page, 'slikk-a11y');
  assert.deepEqual(violations, [], JSON.stringify(violations, null, 2));
  await page.close();
});

test('host inheritance firewall: hostile footer text styles never reach the dialog', async () => {
  const page = await openPage();
  // A plausible real-world host: uppercased, letter-spaced, shadowed footer.
  // Shadow DOM blocks selectors, but inheritable properties flow through the
  // host element unless the widget resets them at its boundary.
  await page.addStyleTag({
    content: `footer {
      text-transform: uppercase; letter-spacing: .25em; word-spacing: .6em;
      text-align: center; text-indent: 2em; text-shadow: 2px 2px 2px red;
    }`,
  });
  await openDialog(page);
  const styles = await page.evaluate(() => {
    const root = document.getElementById('widget').shadowRoot;
    const pick = (el) => {
      const s = getComputedStyle(el);
      return {
        transform: s.textTransform,
        spacing: s.letterSpacing,
        indent: s.textIndent,
        shadow: s.textShadow,
      };
    };
    return {
      intro: pick(root.querySelector('.intro')),
      trigger: pick(root.querySelector('.trigger .t')),
      privacy: pick(root.querySelector('.privacy')),
    };
  });
  for (const [name, s] of Object.entries(styles)) {
    assert.equal(s.transform, 'none', `${name}: text-transform leaked`);
    assert.equal(s.spacing, 'normal', `${name}: letter-spacing leaked`);
    assert.equal(s.indent, '0px', `${name}: text-indent leaked`);
    assert.equal(s.shadow, 'none', `${name}: text-shadow leaked`);
  }
  await page.close();
});

test('time trap stays honest across close/reopen — an interrupted report keeps its clock', async () => {
  const page = await openPage();
  // Capture what the widget actually POSTs.
  await page.evaluate(() => {
    window.__captured = null;
    const orig = window.fetch;
    window.fetch = (input, init) => {
      if (init && init.body) window.__captured = JSON.parse(init.body);
      return orig(input, init);
    };
  });

  await openDialog(page);
  await page.keyboard.type('The carousel traps focus and never lets go.');
  await page.waitForTimeout(2100); // the visitor thinks, types, re-reads

  // Accidental Esc…
  await page.keyboard.press('Escape');
  await page.waitForFunction(
    () => !document.getElementById('widget').shadowRoot.querySelector('dialog').open
  );
  // …reopen: the text survived, and submitting NOW must not read as a bot.
  await openDialog(page);
  const kept = await page.evaluate(
    () => document.getElementById('widget').shadowRoot.querySelector('#f-desc').value
  );
  assert.equal(kept, 'The carousel traps focus and never lets go.');

  await page.evaluate(() =>
    document.getElementById('widget').shadowRoot.querySelector('.submit').click()
  );
  await page.waitForFunction(() => {
    const w = document.getElementById('widget');
    return !w.shadowRoot.querySelector('.done').hidden;
  });

  const body = await page.evaluate(() => window.__captured);
  assert.ok(body, 'no request was captured');
  assert.ok(
    body.elapsed_ms >= 2000,
    `elapsed_ms must report the real interaction time, got ${body.elapsed_ms}`
  );
  await page.close();
});
