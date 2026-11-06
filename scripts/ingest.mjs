#!/usr/bin/env node
// Turn a fetched _jds.json into scored application folders.
//   node scripts/ingest.mjs applications/_jds.json

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanJd, COVERAGE, WEIGHT } from './lib/keywords.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const raw = JSON.parse(fs.readFileSync(process.argv[2] || path.join(ROOT, 'applications/_jds.json'), 'utf8'));
const jobs = (raw.result || raw).jobs || [];

const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 44);

function score(text) {
  const hits = scanJd(text);
  let earned = 0, possible = 0; const gaps = [], strong = [], have = [];
  for (const c of Object.keys(hits)) {
    const w = WEIGHT[c] ?? 1; possible += w;
    const cov = COVERAGE[c] ?? 'GAP';
    if (cov === 'STRONG') { earned += w; strong.push(c); }
    else if (cov === 'HAVE') { earned += w * 0.6; have.push(c); }
    else gaps.push(c);
  }
  return { score: possible ? Math.round(earned / possible * 100) : 0, strong, have, gaps };
}

const rows = [];
for (const j of jobs) {
  if (!j.desc || j.desc.length < 200) { rows.push({ ...j, score: null, note: j.error ? `fetch ${j.error}` : 'no description' }); continue; }
  const full = `${j.title}\n${j.criteria?.join('\n') || ''}\n${j.desc}`;
  const s = score(full);
  const dir = path.join(ROOT, 'applications', `${slug(j.company || 'unknown')}-${slug(j.title)}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'jd.txt'), `${j.title}\n${j.company} — ${j.location}\n${j.url}\n${(j.criteria||[]).join(' | ')}\n\n${j.desc}\n`);
  fs.writeFileSync(path.join(dir, 'job.json'), JSON.stringify({
    company: j.company, role: j.title, location: j.location, source: 'linkedin',
    url: j.url, linkedinId: j.id, criteria: j.criteria, ...s,
    scannedAt: new Date().toISOString().slice(0, 10),
  }, null, 2) + '\n');
  rows.push({ ...j, ...s, dir: path.basename(dir) });
}

rows.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
const pad = (s, n) => String(s ?? '').slice(0, n).padEnd(n);
console.log('\n  ' + pad('FIT', 5) + pad('COMPANY', 24) + pad('ROLE', 42) + 'GAPS');
console.log('  ' + '-'.repeat(112));
for (const r of rows) {
  if (r.score === null) { console.log('  ' + pad('—', 5) + pad(r.company || r.id, 24) + pad(r.title || '', 42) + (r.note || '')); continue; }
  console.log('  ' + pad(r.score, 5) + pad(r.company, 24) + pad(r.title, 42) + (r.gaps.slice(0, 5).join(' ') || '—'));
}
console.log(`\n  ${rows.filter(r => r.score !== null).length} staged into applications/\n`);
