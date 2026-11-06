// WhatsApp notifier for the job watcher.
//
// Reads its config from .env, which is gitignored and must never be committed.
// Copy .env.example to .env and fill it in. If the config is missing this
// module does nothing and says so, so the sweep is never broken by a missing
// key, and a failed send never fails a sweep.
//
// Usage:
//   import { sendWhatsApp, waConfigured } from './whatsapp.mjs';
//   await sendWhatsApp('text here');
//
// Test it on its own:
//   node scripts/whatsapp.mjs "test message"

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Minimal .env reader. No dependency, no npm install, tolerant of comments,
// blank lines, quotes and values containing '='.
function loadEnv() {
  const f = path.join(ROOT, '.env');
  if (!fs.existsSync(f)) return {};
  const out = {};
  for (const raw of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const env = { ...loadEnv(), ...process.env };

export const waConfigured = () =>
  Boolean(env.WHATSAPP_API_URL && env.WHATSAPP_API_KEY && env.WHATSAPP_TO);

// Each provider wants a different body and auth header. Adding a new one means
// adding a case here, nothing else.
function buildRequest(text) {
  const to = String(env.WHATSAPP_TO).replace(/[^\d]/g, '');
  const provider = (env.WHATSAPP_PROVIDER || 'generic').toLowerCase();

  switch (provider) {
    // Meta WhatsApp Cloud API. TWO GOTCHAS WORTH KNOWING:
    // 1. Free-form text only delivers inside a 24-hour window that opens when
    //    HE messages the business number. Outside it Meta silently refuses and
    //    you must send an approved TEMPLATE instead. Set WHATSAPP_TEMPLATE to
    //    a template name to use that path; the body text is passed as {{1}}.
    // 2. The token the dashboard hands you expires in 24 hours. For something
    //    that runs hourly he needs a permanent System User token.
    case 'meta': {
      const tpl = env.WHATSAPP_TEMPLATE;
      const payload = tpl
        ? {
            messaging_product: 'whatsapp',
            to,
            type: 'template',
            template: {
              name: tpl,
              language: { code: env.WHATSAPP_TEMPLATE_LANG || 'en' },
              components: [{ type: 'body', parameters: [{ type: 'text', text }] }],
            },
          }
        : { messaging_product: 'whatsapp', to, type: 'text', text: { preview_url: false, body: text } };
      return {
        headers: { Authorization: `Bearer ${env.WHATSAPP_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      };
    }
    case 'ultramsg':
      return {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: env.WHATSAPP_API_KEY, to: `+${to}`, body: text }),
      };
    case 'green':
      return {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: `${to}@c.us`, message: text }),
      };
    case 'twilio':
      return {
        headers: {
          Authorization: `Basic ${Buffer.from(env.WHATSAPP_API_KEY).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: `whatsapp:+${to}`,
          From: `whatsapp:+${String(env.WHATSAPP_FROM || '').replace(/[^\d]/g, '')}`,
          Body: text,
        }).toString(),
      };
    default:
      return {
        headers: { Authorization: `Bearer ${env.WHATSAPP_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, message: text }),
      };
  }
}

// Never throws. Returns { ok, status, detail } so a caller can log it, and a
// send failure can never take the sweep down with it.
export async function sendWhatsApp(text) {
  if (!waConfigured()) {
    return { ok: false, status: 0, detail: 'not configured - no .env, see .env.example' };
  }
  const { headers, body } = buildRequest(String(text).slice(0, 3500));
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(env.WHATSAPP_API_URL, { method: 'POST', headers, body, signal: ctl.signal });
    const detail = (await r.text().catch(() => '')).slice(0, 300);
    return { ok: r.ok, status: r.status, detail };
  } catch (e) {
    return { ok: false, status: 0, detail: e?.message || String(e) };
  } finally {
    clearTimeout(timer);
  }
}

// Run directly to test: node scripts/whatsapp.mjs "hello"
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const msg = process.argv.slice(2).join(' ') || 'Job watcher test message.';
  if (!waConfigured()) {
    console.log('NOT CONFIGURED. Create .env from .env.example and fill in:');
    console.log('  WHATSAPP_API_URL, WHATSAPP_API_KEY, WHATSAPP_TO, WHATSAPP_PROVIDER');
    process.exit(1);
  }
  const res = await sendWhatsApp(msg);
  console.log(res.ok ? `sent (HTTP ${res.status})` : `FAILED (HTTP ${res.status}): ${res.detail}`);
  process.exit(res.ok ? 0 : 1);
}
