#!/usr/bin/env node
// Application tracker. Single JSON file, no database.
//   node scripts/track.mjs add       --slug careem-android --company Careem --role "Senior Android Engineer" --source linkedin --url https://... --score 82
//   node scripts/track.mjs status    --slug careem-android --status applied
//   node scripts/track.mjs note      --slug careem-android --note "Recruiter replied, call Thursday"
//   node scripts/track.mjs list      [--status staged]
//   node scripts/track.mjs stats
//   node scripts/track.mjs followups
//   node scripts/track.mjs seen      --url https://...     (dedupe check; exits 1 if already tracked)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireSetup } from './lib/setup-check.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
requireSetup(ROOT, ["tracker.json"]);
const FILE = path.join(ROOT, 'tracker.json');

const STATUSES = ['found', 'staged', 'applied', 'acknowledged', 'screening', 'interview', 'offer', 'rejected', 'skipped', 'expired'];

const load = () => fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : [];
const save = d => fs.writeFileSync(FILE, JSON.stringify(d, null, 2) + '\n', 'utf8');
const today = () => new Date().toISOString().slice(0, 10);

const args = {};
process.argv.slice(3).forEach((a, i, arr) => { if (a.startsWith('--')) args[a.slice(2)] = arr[i + 1]?.startsWith('--') ? true : arr[i + 1]; });

const cmd = process.argv[2];
const db = load();
const find = slug => db.find(r => r.slug === slug);

// normalize a URL for dedupe (strip tracking params, trailing slash)
const norm = u => { try { const x = new URL(u); return (x.origin + x.pathname).replace(/\/$/, '').toLowerCase(); } catch { return String(u).toLowerCase(); } };

switch (cmd) {
  case 'add': {
    if (find(args.slug)) { console.log(`exists: ${args.slug}`); break; }
    db.push({
      slug: args.slug, company: args.company, role: args.role,
      source: args.source, url: args.url, urlNorm: norm(args.url || ''),
      score: args.score ? +args.score : null,
      status: args.status || 'found',
      foundDate: today(), appliedDate: null, lastUpdate: today(),
      notes: [],
    });
    save(db);
    console.log(`added: ${args.slug} — ${args.company} / ${args.role}`);
    break;
  }
  case 'status': {
    const r = find(args.slug);
    if (!r) { console.error(`not found: ${args.slug}`); process.exit(1); }
    if (!STATUSES.includes(args.status)) { console.error(`status must be one of: ${STATUSES.join(', ')}`); process.exit(1); }
    r.status = args.status;
    r.lastUpdate = today();
    if (args.status === 'applied' && !r.appliedDate) r.appliedDate = today();
    save(db);
    console.log(`${args.slug} → ${args.status}`);
    break;
  }
  case 'note': {
    const r = find(args.slug);
    if (!r) { console.error(`not found: ${args.slug}`); process.exit(1); }
    r.notes.push({ date: today(), text: args.note });
    r.lastUpdate = today();
    save(db);
    console.log(`noted on ${args.slug}`);
    break;
  }
  case 'seen': {
    const hit = db.find(r => r.urlNorm && r.urlNorm === norm(args.url));
    if (hit) { console.log(`DUPLICATE — already tracked as ${hit.slug} (${hit.status})`); process.exit(1); }
    console.log('NEW'); break;
  }
  case 'list': {
    const rows = args.status ? db.filter(r => r.status === args.status) : db;
    if (!rows.length) { console.log('(none)'); break; }
    const pad = (s, n) => String(s ?? '').slice(0, n).padEnd(n);
    console.log('\n  ' + pad('SLUG', 26) + pad('COMPANY', 20) + pad('ROLE', 30) + pad('SCORE', 7) + pad('STATUS', 14) + 'APPLIED');
    console.log('  ' + '-'.repeat(105));
    rows.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).forEach(r =>
      console.log('  ' + pad(r.slug, 26) + pad(r.company, 20) + pad(r.role, 30) + pad(r.score ?? '—', 7) + pad(r.status, 14) + (r.appliedDate || '—')));
    console.log('');
    break;
  }
  case 'stats': {
    const by = {};
    db.forEach(r => by[r.status] = (by[r.status] || 0) + 1);
    const applied = db.filter(r => r.appliedDate).length;
    const responded = db.filter(r => ['acknowledged', 'screening', 'interview', 'offer', 'rejected'].includes(r.status)).length;
    const positiveResponses = db.filter(r => ['acknowledged', 'screening', 'interview', 'offer'].includes(r.status)).length;
    console.log(`\n  Total tracked : ${db.length}`);
    console.log(`  Applied       : ${applied}`);
    console.log(`  Responses     : ${responded}${applied ? `  (${Math.round(responded / applied * 100)}% of applications answered)` : ''}`);
    console.log(`  ├ positive    : ${positiveResponses}`);
    console.log(`  └ rejections  : ${db.filter(r => r.status === 'rejected').length}`);
    console.log(`  Interviews    : ${db.filter(r => ['interview', 'offer'].includes(r.status)).length}`);
    console.log('\n  By status:');
    Object.entries(by).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`    ${k.padEnd(14)} ${v}`));
    console.log('');
    break;
  }
  case 'followups': {
    const due = db.filter(r => {
      if (!r.appliedDate) return false;
      if (!['applied', 'acknowledged'].includes(r.status)) return false;
      const days = Math.floor((Date.now() - new Date(r.appliedDate)) / 864e5);
      return days >= 7;
    });
    if (!due.length) { console.log('  No follow-ups due.'); break; }
    console.log('\n  FOLLOW-UP DUE (applied 7+ days ago, no response):');
    due.forEach(r => {
      const days = Math.floor((Date.now() - new Date(r.appliedDate)) / 864e5);
      console.log(`    ${r.company} — ${r.role}  (${days}d ago)  ${r.url || ''}`);
    });
    console.log('');
    break;
  }
  default:
    console.log('commands: add | status | note | seen | list | stats | followups');
}
