/**
 * POST /api/a11y-report — email delivery for the Slikk.Dev Accessibility Kit.
 *
 * Paste-in Next.js App Router route: copy this file to
 * app/api/a11y-report/route.js in the host app. It follows the slikk.dev
 * contact-route pattern exactly (zod + nodemailer + honeypot + time trap +
 * per-IP rate limit); `zod` and `nodemailer` come from the HOST app — the
 * widget itself ships zero dependencies.
 *
 * Only web-standard Request/Response are used (no next/server import), so the
 * same handler runs on any fetch-speaking runtime; the plain endpoint
 * contract for non-Next backends is in docs/KIT-REFERENCE.md.
 *
 * Recipients are env-driven ONLY (A11Y_REPORT_TO) — nothing in the request
 * body can choose where reports go. No open relay.
 *
 * ⚠ THE SEAM: when SMTP env is absent the route logs the report server-side
 * and still answers ok, so nothing is lost while credentials/DNS are pending.
 * Wiring real SMTP is the kit's one open item — see README.
 */
import nodemailer from 'nodemailer';
import { z } from 'zod';

// Locked default — reports go to humans at Slikk.Dev. Override via env only.
const DEFAULT_RECIPIENTS = 'we@slikk.dev,accessibility@slikk.dev,i@yarin.io';

const MAX_DESC = 2000;

const ReportSchema = z
  .object({
    description: z.string().trim().min(1, 'Description is required.').max(MAX_DESC),
    page: z.string().trim().max(2048).optional().default(''),
    tech: z
      .enum(['screen_reader', 'keyboard', 'voice', 'zoom', 'switch', 'other', 'no_say', ''])
      .optional()
      .default(''),
    email: z
      .string()
      .trim()
      .max(320)
      .optional()
      .default('')
      .refine(
        (v) => v === '' || z.string().email().safeParse(v).success,
        'Invalid email address.'
      ),
    lang: z.enum(['en', 'he']).optional().default('en'),
    // Anti-spam fields — checked before parsing, listed here so .strict()
    // doesn't reject legitimate submissions.
    company_url: z.string().optional(),
    elapsed_ms: z.number().optional(),
  })
  .strict(); // unknown keys (e.g. a smuggled "to") are rejected outright

const TECH_LABELS = {
  screen_reader: 'Screen reader',
  keyboard: 'Keyboard only',
  voice: 'Voice control',
  zoom: 'Magnification or zoom',
  switch: 'Switch device',
  other: 'Something else',
  no_say: 'Prefer not to say',
};

// --- Spam protection knobs ---------------------------------------------------
// A human can't realistically read, fill, and submit the form this fast; bots do.
const MIN_FILL_MS = 2000;
// Per-IP sliding-window rate limit.
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
// Hard ceiling on the request body — a valid report is ~3 KB; anything bigger
// is refused before it can buffer into memory.
const MAX_BODY_BYTES = 32 * 1024;
// Hard ceiling on tracked rate-limit keys, staleness aside — a flood of
// unique (spoofed) addresses must not grow the heap without bound.
const MAX_TRACKED_IPS = 10000;

// In-memory store. Survives across requests within a single server instance,
// which is enough to blunt automated floods without adding infra.
const hits = new Map();

function clientIp(request) {
  // Web-standard Request has no .ip — the client address only ever arrives
  // via proxy headers. Take the RIGHTMOST x-forwarded-for entry: that is the
  // hop the trusted edge proxy appended (Traefik in our deploys), while the
  // leftmost entries are whatever the client claims. Keying on the left end
  // would let a bot rotate a fabricated header past the limit entirely.
  // Trust boundary: this route assumes it sits behind a proxy that appends
  // (or overwrites) x-forwarded-for — see docs/KIT-REFERENCE.md.
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) {
    const parts = fwd.split(',');
    const last = parts[parts.length - 1].trim();
    if (last) return last;
  }
  return request.headers.get('x-real-ip') || 'unknown';
}

function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) {
    hits.set(ip, recent);
    return true;
  }
  // Bound the store BEFORE inserting a new key: first sweep entries whose
  // window has fully expired, then — if a flood of fresh unique keys is still
  // at the ceiling — evict oldest-inserted (Map order) so memory stays flat.
  // A capped limiter can forget an offender under active flood; unbounded
  // growth would take the whole process down instead. Easy trade.
  if (!hits.has(ip) && hits.size >= MAX_TRACKED_IPS) {
    for (const [key, times] of hits) {
      if (times.every((t) => now - t >= RATE_LIMIT_WINDOW_MS)) hits.delete(key);
    }
    while (hits.size >= MAX_TRACKED_IPS) {
      hits.delete(hits.keys().next().value);
    }
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

// Read the JSON body with a hard byte ceiling: the stream is cancelled the
// moment it exceeds the cap, so an oversized POST cannot buffer first.
// Returns { data } or { tooLarge: true }; malformed JSON throws to the caller.
async function readJson(request, maxBytes) {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) return { tooLarge: true };
  if (!request.body) {
    const text = await request.text();
    if (text.length > maxBytes) return { tooLarge: true };
    return { data: JSON.parse(text) };
  }
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return { tooLarge: true };
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { data: JSON.parse(new TextDecoder().decode(bytes)) };
}

// --- Message assembly --------------------------------------------------------

// Defense-in-depth against header injection in the Subject line.
const oneLine = (s) => s.replace(/[\r\n]+/g, ' ').trim();

const escapeHtml = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function recipients() {
  return (process.env.A11Y_REPORT_TO || DEFAULT_RECIPIENTS)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function subjectFor(page) {
  let where = '';
  try {
    where = new URL(page).host;
  } catch {
    where = page;
  }
  return oneLine(`Accessibility report — ${where || 'page not given'}`).slice(0, 160);
}

function buildMessage({ description, page, tech, email, lang }) {
  const techLabel = TECH_LABELS[tech] || '—';
  const lines = [
    `Page: ${page || '—'}`,
    `Assistive tech: ${techLabel}`,
    `Report language: ${lang}`,
    `Reporter email: ${email || '—'}`,
    '',
    description,
  ];
  return {
    to: recipients(), // env-driven — never from the request body
    replyTo: email || undefined,
    subject: subjectFor(page),
    text: lines.join('\n'),
    html: [
      `<p><strong>Page:</strong> ${escapeHtml(page || '—')}</p>`,
      `<p><strong>Assistive tech:</strong> ${escapeHtml(techLabel)}</p>`,
      `<p><strong>Report language:</strong> ${escapeHtml(lang)}</p>`,
      `<p><strong>Reporter email:</strong> ${escapeHtml(email || '—')}</p>`,
      `<p style="white-space:pre-wrap">${escapeHtml(description)}</p>`,
    ].join('\n'),
  };
}

// --- Delivery ----------------------------------------------------------------

async function deliver(message) {
  // ⚠ THE SEAM: without SMTP credentials, accept + log instead of emailing,
  // so reports are never dropped while the mailbox is being wired up.
  // Metadata only by default: the body carries the reporter's email and a
  // free-text description that routinely reveals assistive-tech use —
  // sensitive data that doesn't belong in shipped-off server logs. Set
  // A11Y_REPORT_LOG_BODY=true to include it during the seam window,
  // knowingly, log retention and all.
  if (!process.env.SMTP_HOST) {
    console.warn(
      '[a11y-report] SMTP is not configured (SMTP_HOST unset) — logging the report instead of emailing it. See the kit README: wiring SMTP is the one open item.'
    );
    const logBody = process.env.A11Y_REPORT_LOG_BODY === 'true';
    console.log(
      '[a11y-report]',
      JSON.stringify({
        to: message.to,
        subject: message.subject,
        ...(logBody ? { text: message.text } : { text: '[redacted — set A11Y_REPORT_LOG_BODY=true to log report bodies]' }),
      })
    );
    return;
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    ...message,
  });
}

// --- Handler -----------------------------------------------------------------

const json = (body, status = 200) => Response.json(body, { status });

// Exported separately so the test rig can inject a fake transport; POST is
// what the host app serves.
export async function handleReport(request, send) {
  let data;
  try {
    const read = await readJson(request, MAX_BODY_BYTES);
    if (read.tooLarge) return json({ error: 'Request body too large.' }, 413);
    data = read.data;
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  // 1) Honeypot — a hidden field no human fills. Any present, non-empty value
  //    OF ANY TYPE is the trap; only the widget's honest "" (or an absent
  //    field) passes. Typed probes (numbers, arrays) must not get a different
  //    answer than strings — that would be an oracle. Quietly accept and
  //    drop, so the bot believes it succeeded and doesn't retry differently.
  const hp = data?.company_url;
  const hpEmpty = hp === undefined || (typeof hp === 'string' && hp.trim() === '');
  if (!hpEmpty) {
    return json({ ok: true });
  }

  // 2) Time trap — submissions faster than a human could fill the form are
  //    bots. Missing, invalid, or negative values are treated as suspicious.
  //    Same success-shaped answer: no oracle for the sender.
  const elapsed = Number(data?.elapsed_ms);
  if (!Number.isFinite(elapsed) || elapsed < MIN_FILL_MS) {
    return json({ ok: true });
  }

  // 3) Rate limit per IP to blunt automated floods.
  if (rateLimited(clientIp(request))) {
    return json({ error: 'Too many requests. Please try again in a little while.' }, 429);
  }

  const parsed = ReportSchema.safeParse(data);
  if (!parsed.success) {
    return json({ error: parsed.error.issues[0]?.message || 'Invalid submission.' }, 400);
  }

  try {
    await send(buildMessage(parsed.data));
    return json({ ok: true });
  } catch (error) {
    console.error('a11y report error:', error);
    return json({ error: 'Failed to send the report. Please try again later.' }, 500);
  }
}

export async function POST(request) {
  return handleReport(request, deliver);
}
