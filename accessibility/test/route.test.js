/**
 * Unit suite for the a11y-report route logic (api/route.js).
 *
 * Every test injects a fake transport via handleReport(request, send) — no
 * real email is ever sent. Rate-limit isolation comes from unique per-test
 * IPs (the limiter keys on x-forwarded-for).
 */
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { handleReport, POST } from '../api/route.js';

let ipCounter = 0;
const uniqueIp = () => `10.9.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`;

function request(body, { ip = uniqueIp(), raw = false } = {}) {
  return new Request('http://localhost/api/a11y-report', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: raw ? body : JSON.stringify(body),
  });
}

function report(extra = {}) {
  return {
    description: 'The screen reader skips the main menu.',
    page: 'https://example.com/pricing',
    tech: 'screen_reader',
    email: '',
    lang: 'en',
    company_url: '',
    elapsed_ms: 5000,
    ...extra,
  };
}

function fakeSend() {
  const calls = [];
  const send = async (message) => {
    calls.push(message);
  };
  return { send, calls };
}

const savedEnv = {};
beforeEach(() => {
  savedEnv.A11Y_REPORT_TO = process.env.A11Y_REPORT_TO;
  savedEnv.SMTP_HOST = process.env.SMTP_HOST;
  savedEnv.A11Y_REPORT_LOG_BODY = process.env.A11Y_REPORT_LOG_BODY;
  delete process.env.A11Y_REPORT_TO;
  delete process.env.SMTP_HOST;
  delete process.env.A11Y_REPORT_LOG_BODY;
});
afterEach(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

// --- Happy path --------------------------------------------------------------

test('delivers a valid report and answers ok', async () => {
  const { send, calls } = fakeSend();
  const res = await handleReport(request(report()), send);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(calls.length, 1);
  assert.match(calls[0].subject, /example\.com/);
  assert.match(calls[0].text, /The screen reader skips the main menu\./);
  assert.match(calls[0].text, /Assistive tech: Screen reader/);
});

test('optional email becomes the reply-to', async () => {
  const { send, calls } = fakeSend();
  await handleReport(request(report({ email: 'visitor@example.com' })), send);
  assert.equal(calls[0].replyTo, 'visitor@example.com');
});

// --- Recipient lockdown ------------------------------------------------------

test('recipients default to the three Slikk.Dev inboxes', async () => {
  const { send, calls } = fakeSend();
  await handleReport(request(report()), send);
  assert.deepEqual(calls[0].to, ['we@slikk.dev', 'accessibility@slikk.dev', 'i@yarin.io']);
});

test('recipients come from A11Y_REPORT_TO when set', async () => {
  process.env.A11Y_REPORT_TO = 'qa@slikk.dev, second@slikk.dev';
  const { send, calls } = fakeSend();
  await handleReport(request(report()), send);
  assert.deepEqual(calls[0].to, ['qa@slikk.dev', 'second@slikk.dev']);
});

test('a smuggled "to" field is rejected, not delivered', async () => {
  const { send, calls } = fakeSend();
  const res = await handleReport(request(report({ to: 'attacker@evil.example' })), send);
  assert.equal(res.status, 400);
  assert.equal(calls.length, 0);
});

// --- Honeypot ----------------------------------------------------------------

test('filled honeypot: success-shaped answer, nothing sent', async () => {
  const { send, calls } = fakeSend();
  const res = await handleReport(request(report({ company_url: 'https://spam.example' })), send);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(calls.length, 0);
});

test('non-string honeypot values get the same success-shaped drop (no type oracle)', async () => {
  const { send, calls } = fakeSend();
  for (const company_url of [1, ['x'], { a: 1 }, true, null]) {
    const res = await handleReport(request(report({ company_url })), send);
    assert.equal(res.status, 200, `company_url=${JSON.stringify(company_url)}`);
    assert.deepEqual(await res.json(), { ok: true });
  }
  assert.equal(calls.length, 0);
});

// --- Time trap ---------------------------------------------------------------

for (const [label, elapsed_ms] of [
  ['too fast', 150],
  ['missing', undefined],
  ['not a number', 'soon'],
  ['negative', -5],
]) {
  test(`time trap (${label}): success-shaped answer, nothing sent`, async () => {
    const { send, calls } = fakeSend();
    const body = report();
    if (elapsed_ms === undefined) delete body.elapsed_ms;
    else body.elapsed_ms = elapsed_ms;
    const res = await handleReport(request(body), send);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
    assert.equal(calls.length, 0);
  });
}

// --- Validation --------------------------------------------------------------

test('empty description is a 400', async () => {
  const { send, calls } = fakeSend();
  const res = await handleReport(request(report({ description: '   ' })), send);
  assert.equal(res.status, 400);
  assert.equal(calls.length, 0);
});

test('description over 2000 characters is a 400', async () => {
  const { send, calls } = fakeSend();
  const res = await handleReport(request(report({ description: 'x'.repeat(2001) })), send);
  assert.equal(res.status, 400);
  assert.equal(calls.length, 0);
});

test('malformed email is a 400; empty email is fine', async () => {
  const { send, calls } = fakeSend();
  const bad = await handleReport(request(report({ email: 'not-an-email' })), send);
  assert.equal(bad.status, 400);
  const good = await handleReport(request(report({ email: '' })), send);
  assert.equal(good.status, 200);
  assert.equal(calls.length, 1);
});

test('unknown tech value is a 400', async () => {
  const { send } = fakeSend();
  const res = await handleReport(request(report({ tech: 'telepathy' })), send);
  assert.equal(res.status, 400);
});

test('non-JSON body is a 400', async () => {
  const { send, calls } = fakeSend();
  const res = await handleReport(request('definitely not json', { raw: true }), send);
  assert.equal(res.status, 400);
  assert.equal(calls.length, 0);
});

test('a body over the 32 KB cap is a 413, never delivered', async () => {
  const { send, calls } = fakeSend();
  const huge = JSON.stringify(report({ description: 'x'.repeat(64 * 1024) }));
  const res = await handleReport(request(huge, { raw: true }), send);
  assert.equal(res.status, 413);
  assert.equal(calls.length, 0);
});

// --- Rate limit --------------------------------------------------------------

test('sixth report from one IP inside the window is a 429', async () => {
  const { send, calls } = fakeSend();
  const ip = uniqueIp();
  for (let i = 0; i < 5; i++) {
    const res = await handleReport(request(report(), { ip }), send);
    assert.equal(res.status, 200, `report ${i + 1} should pass`);
  }
  const sixth = await handleReport(request(report(), { ip }), send);
  assert.equal(sixth.status, 429);
  assert.equal(calls.length, 5);

  // A different IP is unaffected.
  const other = await handleReport(request(report()), send);
  assert.equal(other.status, 200);
});

test('limiter keys on the RIGHTMOST x-forwarded-for hop — a rotated leftmost value is no bypass', async () => {
  const { send } = fakeSend();
  const realIp = uniqueIp();
  for (let i = 0; i < 5; i++) {
    // The client fabricates a fresh leftmost entry each time; the trusted
    // proxy appends the real address last. The limiter must see the real one.
    const res = await handleReport(request(report(), { ip: `203.0.113.${i}, ${realIp}` }), send);
    assert.equal(res.status, 200, `report ${i + 1} should pass`);
  }
  const sixth = await handleReport(request(report(), { ip: `203.0.113.99, ${realIp}` }), send);
  assert.equal(sixth.status, 429);
});

// --- Sanitization ------------------------------------------------------------

test('subject is CRLF-sanitized (no header injection)', async () => {
  const { send, calls } = fakeSend();
  await handleReport(
    request(report({ page: 'not a url\r\nBcc: attacker@evil.example' })),
    send
  );
  assert.equal(calls.length, 1);
  assert.doesNotMatch(calls[0].subject, /[\r\n]/);
  assert.match(calls[0].subject, /^Accessibility report — /);
});

test('html body is escaped; text body stays raw', async () => {
  const { send, calls } = fakeSend();
  const description = 'Broken: <script>alert("x")</script> & "quotes"';
  await handleReport(request(report({ description })), send);
  assert.match(calls[0].html, /&lt;script&gt;/);
  assert.doesNotMatch(calls[0].html, /<script>/);
  assert.match(calls[0].text, /<script>/);
});

// --- Delivery failure --------------------------------------------------------

test('a throwing transport becomes a 500', async () => {
  const send = async () => {
    throw new Error('SMTP down');
  };
  const res = await handleReport(request(report()), send);
  assert.equal(res.status, 500);
  assert.deepEqual(await res.json(), {
    error: 'Failed to send the report. Please try again later.',
  });
});

// --- The SMTP seam -----------------------------------------------------------

test('without SMTP env, POST logs metadata and still answers ok — bodies stay out of the logs', async (t) => {
  const warn = t.mock.method(console, 'warn');
  const log = t.mock.method(console, 'log');
  const res = await POST(request(report({ email: 'visitor@example.com' })));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(warn.mock.callCount(), 1);
  assert.match(warn.mock.calls[0].arguments[0], /SMTP is not configured/);
  assert.equal(log.mock.callCount(), 1);
  const logged = log.mock.calls[0].arguments[1];
  assert.match(logged, /Accessibility report/); // subject survives
  // The reporter's email and free text are PII — redacted by default.
  assert.doesNotMatch(logged, /visitor@example\.com/);
  assert.doesNotMatch(logged, /The screen reader skips the main menu\./);
});

test('A11Y_REPORT_LOG_BODY=true opts in to full-body seam logging', async (t) => {
  process.env.A11Y_REPORT_LOG_BODY = 'true';
  t.mock.method(console, 'warn');
  const log = t.mock.method(console, 'log');
  const res = await POST(request(report()));
  assert.equal(res.status, 200);
  assert.match(log.mock.calls[0].arguments[1], /The screen reader skips the main menu\./);
});
