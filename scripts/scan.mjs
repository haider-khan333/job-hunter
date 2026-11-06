#!/usr/bin/env node
// Sweep every verified ATS board for mobile roles, score them against the
// resume, and stage the good ones as application folders.
//
//   node scripts/scan.mjs                 UAE-only mobile roles (default)
//   node scripts/scan.mjs --anywhere      include non-UAE (remote/relocation)
//   node scripts/scan.mjs --all-titles    any engineering role, not just mobile
//   node scripts/scan.mjs --backend       backend / full-stack roles instead of mobile
//   node scripts/scan.mjs --stage         write applications/<slug>/ for hits >= minScore
//   node scripts/scan.mjs --min 50        override minimum score

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanJd, COVERAGE, WEIGHT } from './lib/keywords.mjs';
import CFG from '../config/search.config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'profile/companies.json'), 'utf8'));
const profile = JSON.parse(fs.readFileSync(path.join(ROOT, 'profile/profile.json'), 'utf8'));

const argv = process.argv.slice(2);
const OPT = {
  anywhere: argv.includes('--anywhere'),
  allTitles: argv.includes('--all-titles'),
  backend: argv.includes('--backend'),
  stage: argv.includes('--stage'),
  min: argv.includes('--min') ? +argv[argv.indexOf('--min') + 1] : profile.preferences.minMatchScoreToStage,
};

const MOBILE_TITLE = /android|\bios\b|mobile|flutter|kotlin|swift|react.?native|app developer/i;
const ENG_TITLE = /engineer|developer|software|programmer/i;
// Backend / full-stack titles. Added 2026-09-22 once backend became claimable.
const BACKEND_TERMS = [
  'backend', 'back end', 'back-end', 'fullstack', 'full stack', 'full-stack',
  'api', 'java', 'spring', 'python', 'node', 'software engineer',
  'software developer', 'platform engineer', 'integration engineer', 'microservice',
];
const BACKEND_EXCLUDE_TERMS = [
  '.net', 'c#', 'php', 'laravel', 'ruby', 'golang', 'go developer', 'devops',
  'sre', 'data engineer', 'data scientist', 'machine learning engineer',
  'salesforce', 'sap', 'oracle', 'odoo', 'dynamics', 'sharepoint', 'wordpress',
  'qa', 'tester', 'embedded', 'firmware',
];
// Wrap each term so it only matches as a whole word. Prevents 'java' matching
// 'javascript', 'qa' matching 'qatar', 'sap' matching 'sapient'.
const wholeWord = terms => new RegExp(
  '(^|[^a-z0-9])(' + terms.map(t => t.split('.').join('[.]')).join('|') + ')([^a-z0-9]|$)', 'i');
const BACKEND_TITLE = wholeWord(BACKEND_TERMS);
// Titles that read as backend but sit on a stack you do not have.
const BACKEND_EXCLUDE = wholeWord(BACKEND_EXCLUDE_TERMS);
// Locations to drop outright. Mirrors config/search.config.mjs.
// The '(?!)' fallback is a regex that can never match, for an empty list.
const EXCLUDE_LOC = new RegExp((CFG.excludeLocations ?? []).map(r => r.source).join('|') || '(?!)', 'i');
const UAE_LOC = /dubai|abu ?dhabi|sharjah|u\.?a\.?e|united arab emirates|emirates|ajman|middle east|mena|gulf/i;
const REMOTE_LOC = /remote|anywhere|global|worldwide|distributed/i;

const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' };
const get = async (url, ms = 20000) => {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, { signal: c.signal, headers: UA }); return r.ok ? await r.json() : null; }
  catch { return null; } finally { clearTimeout(t); }
};

// ---- normalize each ATS into { company, title, location, url, id, desc? } ----
const LOADERS = {
  greenhouse: async s => (await get(`https://boards-api.greenhouse.io/v1/boards/${s}/jobs`))?.jobs
    ?.map(j => ({ company: s, title: j.title, location: j.location?.name || '', url: j.absolute_url, id: j.id })) || [],
  lever: async s => (await get(`https://api.lever.co/v0/postings/${s}?mode=json`))
    ?.map(j => ({ company: s, title: j.text, location: j.categories?.location || '', url: j.hostedUrl, id: j.id, desc: j.descriptionPlain })) || [],
  ashby: async s => (await get(`https://api.ashbyhq.com/posting-api/job-board/${s}`))?.jobs
    ?.map(j => ({ company: s, title: j.title, location: j.location || '', url: j.jobUrl, id: j.id, desc: j.descriptionPlain })) || [],
  recruitee: async s => (await get(`https://${s}.recruitee.com/api/offers/`))?.offers
    ?.map(j => ({ company: s, title: j.title, location: [j.city, j.country].filter(Boolean).join(', '), url: j.careers_url, id: j.id, desc: j.description })) || [],
  workable: async s => (await get(`https://apply.workable.com/api/v1/widget/accounts/${s}?details=true`))?.jobs
    ?.map(j => ({ company: s, title: j.title, location: [j.city, j.country].filter(Boolean).join(', '), url: j.url || j.application_url, id: j.shortcode, desc: j.description })) || [],
};

// Greenhouse needs a second call for the description.
async function fetchDesc(job, provider) {
  if (job.desc) return stripHtml(job.desc);
  if (provider === 'greenhouse') {
    const d = await get(`https://boards-api.greenhouse.io/v1/boards/${job.company}/jobs/${job.id}`);
    if (d?.content) return stripHtml(d.content);
  }
  return '';
}
const stripHtml = h => String(h)
  .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<li>/gi, '\n• ').replace(/<\/(p|div|li|h\d|ul)>/gi, '\n').replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n)).replace(/&[a-z]+;/gi, ' ')
  .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

function scoreJd(text) {
  const hits = scanJd(text);
  let earned = 0, possible = 0; const gaps = [], strong = [];
  for (const c of Object.keys(hits)) {
    const w = WEIGHT[c] ?? 1; possible += w;
    const cov = COVERAGE[c] ?? 'GAP';
    if (cov === 'STRONG') { earned += w; strong.push(c); }
    else if (cov === 'HAVE') earned += w * 0.6;
    else gaps.push(c);
  }
  return { score: possible ? Math.round(earned / possible * 100) : 0, gaps, strong };
}

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);

// ---- run -------------------------------------------------------------------
console.log(`\nScanning ${reg.companies.length} boards…\n`);

const all = [];
await Promise.all(reg.companies.map(async c => {
  const jobs = await LOADERS[c.provider]?.(c.slug) || [];
  jobs.forEach(j => all.push({ ...j, provider: c.provider }));
}));

console.log(`  ${all.length} total openings pulled`);

const titleFilter = OPT.allTitles ? ENG_TITLE : OPT.backend ? BACKEND_TITLE : MOBILE_TITLE;
let matches = all.filter(j => titleFilter.test(j.title));
if (OPT.backend) matches = matches.filter(j => !BACKEND_EXCLUDE.test(j.title));
console.log(`  ${matches.length} match title filter (${OPT.allTitles ? 'any engineering' : OPT.backend ? 'backend/full-stack' : 'mobile'})`);

if (!OPT.anywhere) {
  const before = matches.length;
  matches = matches.filter(j => (UAE_LOC.test(j.location) || REMOTE_LOC.test(j.location)) && !EXCLUDE_LOC.test(j.location));
  console.log(`  ${matches.length} in UAE/MENA or remote  (filtered out ${before - matches.length})`);
}

if (!matches.length) {
  console.log('\n  Nothing matched. Try --anywhere or --all-titles.\n');
  process.exit(0);
}

console.log(`  Fetching descriptions and scoring…\n`);
const scored = [];
for (const j of matches) {
  const desc = await fetchDesc(j, j.provider);
  const { score, gaps, strong } = scoreJd(`${j.title}\n${desc}`);
  scored.push({ ...j, desc, score, gaps, strong, uae: UAE_LOC.test(j.location) });
}
scored.sort((a, b) => (b.uae - a.uae) || (b.score - a.score));

const pad = (s, n) => String(s ?? '').slice(0, n).padEnd(n);
console.log('  ' + pad('SCORE', 7) + pad('COMPANY', 16) + pad('TITLE', 42) + 'LOCATION');
console.log('  ' + '-'.repeat(108));
for (const j of scored) {
  const flag = j.uae ? '' : ' (non-UAE)';
  console.log('  ' + pad(j.score, 7) + pad(j.company, 16) + pad(j.title, 42) + j.location + flag);
}

// ---- stage -----------------------------------------------------------------
if (OPT.stage) {
  const keep = scored.filter(j => j.score >= OPT.min && j.desc.length > 200);
  console.log(`\n  Staging ${keep.length} roles scoring >= ${OPT.min}…`);
  for (const j of keep) {
    const dir = path.join(ROOT, 'applications', `${slug(j.company)}-${slug(j.title)}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'jd.txt'), `${j.title}\n${j.company} — ${j.location}\n${j.url}\n\n${j.desc}\n`);
    fs.writeFileSync(path.join(dir, 'job.json'), JSON.stringify({
      company: j.company, role: j.title, location: j.location, source: j.provider,
      url: j.url, score: j.score, strong: j.strong, gaps: j.gaps,
      scannedAt: new Date().toISOString().slice(0, 10),
    }, null, 2) + '\n');
    console.log(`    → applications/${path.basename(dir)}  (${j.score})`);
  }
  console.log(`\n  Next: review each jd.txt, write tailor.json, then node scripts/build.mjs applications/<slug>`);
}
console.log('');
