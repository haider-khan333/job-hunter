#!/usr/bin/env node
// Score a job description against your profile in profile/resume.json, using
// the coverage map in config/skills.config.mjs.
//   node scripts/score.mjs applications/<slug>/jd.txt
// Prints a fit score, which resume variant to use, which bullets to lead with,
// and an honest gap list (things the JD wants that are NOT on the resume).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanJd, COVERAGE, WEIGHT, HARD_GAPS } from './lib/keywords.mjs';
import CFG from '../config/search.config.mjs';
import { requireSetup } from './lib/setup-check.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
requireSetup(ROOT, ["profile/resume.json","profile/profile.json"]);
const resume = JSON.parse(fs.readFileSync(path.join(ROOT, 'profile/resume.json'), 'utf8'));

const jdPath = process.argv[2];
if (!jdPath) { console.error('usage: node scripts/score.mjs <path-to-jd.txt>'); process.exit(1); }
const jd = fs.readFileSync(jdPath, 'utf8');

const hits = scanJd(jd);
const canon = Object.keys(hits);

// ---- fit score -------------------------------------------------------------
let earned = 0, possible = 0;
const strong = [], have = [], gaps = [];
for (const c of canon) {
  const w = WEIGHT[c] ?? 1;
  possible += w;
  const cov = COVERAGE[c] ?? 'GAP';
  if (cov === 'STRONG') { earned += w; strong.push(c); }
  else if (cov === 'HAVE') { earned += w * 0.6; have.push(c); }
  else { gaps.push(c); }
}
const score = possible ? Math.round((earned / possible) * 100) : 0;

// ---- which track is this role actually on? ---------------------------------
// This profile runs on two tracks: mobile, and backend/full-stack. Scoring a JD
// without knowing which one it is lets whichever skills happen to overlap
// inflate the result. Revised 2026-09-22: the previous version skipped anything
// with no mobile keywords, which wrongly filtered out every backend role he is
// qualified for.
const n = re => (jd.match(re) || []).length;
const mobileHits   = n(/android|\bios\b|flutter|kotlin|swift|mobile app|jetpack|xcode|react native/gi);
const backendHits  = n(/backend|back-end|server-side|spring|\bjava\b|python|fastapi|flask|django|node\.?js|express|\.net|\bc#|golang|microservice|rest api|api development|\bsql\b|database|docker|kubernetes|\baws\b|azure/gi);
const frontendHits = n(/\breact\b|angular|\bvue\b|next\.js|typescript|javascript|\bhtml\b|\bcss\b|tailwind|frontend|front-end/gi);

let track;
if (mobileHits >= 3 && mobileHits >= backendHits) track = 'MOBILE';
else if (backendHits >= 3 && frontendHits >= 3) track = 'FULLSTACK';
else if (backendHits >= 3) track = 'BACKEND';
else if (frontendHits >= 3) track = 'FRONTEND';
else if (mobileHits > 0) track = 'MOBILE-LIGHT';
else track = 'UNCLEAR';

// ---- which summary variant -------------------------------------------------
const lc = jd.toLowerCase();
const platformScore = {
  flutter: (lc.match(/flutter|dart/g) || []).length,
  ios:     (lc.match(/\bios\b|swift|swiftui|uikit/g) || []).length,
  android: (lc.match(/android|kotlin|jetpack/g) || []).length,
};
const isFintech = /fintech|bank|payment|wallet|financial|remittance|trading|neobank/.test(lc);
let variant = 'default';
const topPlatform = Object.entries(platformScore).sort((a, b) => b[1] - a[1])[0];
if (track === 'BACKEND' || track === 'FULLSTACK') variant = 'fullstack';
else if (isFintech && topPlatform[1] > 0) variant = 'fintech';
else if (topPlatform[1] > 0) variant = topPlatform[0];

// Which master CV to start from.
const resumeBase = (track === 'BACKEND' || track === 'FULLSTACK') ? 'master-fullstack' : 'master';

// ---- bullet ranking --------------------------------------------------------
const allBullets = resume.experience.flatMap(e => e.bullets.map(b => ({ ...b, company: e.company })));
const ranked = allBullets.map(b => {
  let s = 0;
  for (const c of canon) {
    const w = WEIGHT[c] ?? 1;
    if (b.tags.includes(c)) s += w * 2;
    if (b.text.toLowerCase().includes(c)) s += w;
  }
  return { ...b, relevance: s };
}).sort((a, b) => b.relevance - a.relevance);

// ---- exclusions ------------------------------------------------------------
const profile = JSON.parse(fs.readFileSync(path.join(ROOT, 'profile/profile.json'), 'utf8'));
const excluded = profile.preferences.excludeKeywords.filter(k => lc.includes(k.toLowerCase()));

// ---- seniority sanity check ------------------------------------------------
const yearsWanted = [...jd.matchAll(/(\d+)\s*\+?\s*(?:to\s*\d+\s*)?year/gi)].map(m => +m[1]);
const minYears = yearsWanted.length ? Math.min(...yearsWanted) : null;
const seniorityFlag = minYears && minYears > 6
  ? `JD asks for ${minYears}+ years; you have ${CFG.yearsExperience}. Borderline, worth applying only if the rest is a strong match.`
  : null;

// ---- verdict ---------------------------------------------------------------
// Gaps that are load-bearing rather than nice-to-have. Two or more means the
// role is built on a stack you do not have, whatever the score says.
const hardGaps = gaps.filter(g => HARD_GAPS.has(g));
const band = sc => sc >= 75 ? 'STRONG - apply'
  : sc >= 60 ? 'GOOD - apply'
  : sc >= 45 ? 'WEAK - apply only on a volume day'
  : 'SKIP - too little overlap';

let verdict;
if (track === 'FRONTEND') {
  verdict = 'SKIP - front-end role; no professional React/Angular/Vue';
} else if (track === 'UNCLEAR') {
  verdict = 'CAUTION - no clear tech stack in the JD; read it before applying';
} else if (hardGaps.length >= 2) {
  verdict = `SKIP - built on a stack he does not have (${hardGaps.join(', ')})`;
} else if (track === 'MOBILE-LIGHT') {
  verdict = `CAUTION - mobile barely mentioned, no clear backend stack; read the JD. ${band(score)}`;
} else {
  verdict = band(score);
  if (hardGaps.length === 1) verdict += ` (one hard gap: ${hardGaps[0]}, address it in the cover letter)`;
}

const out = {
  jdPath,
  score,
  track,
  resumeBase,
  mobileHits,
  backendHits,
  frontendHits,
  hardGaps,
  recommendation: verdict,
  summaryVariant: variant,
  matched: { strong, have },
  gaps,
  gapGuidance: gaps.length
    ? 'These appear in the JD but NOT on the resume. Do NOT add them unless you have confirmed the experience is real. Address in the cover letter as adjacent/transferable instead.'
    : 'No unmet keyword requirements detected.',
  leadBullets: ranked.slice(0, 6).map(b => ({ id: b.id, company: b.company, relevance: b.relevance, text: b.text })),
  demoteBullets: ranked.slice(-3).map(b => b.id),
  excluded,
  seniorityFlag,
  keywordHits: hits,
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(out, null, 2));
} else {
  console.log(`\n  FIT SCORE: ${out.score}/100   ->  ${out.recommendation}`);
  console.log(`  Track: ${out.track}   (mobile ${mobileHits} / backend ${backendHits} / frontend ${frontendHits} mentions)`);
  console.log(`  Start from: ${out.resumeBase}/   Summary variant: "${out.summaryVariant}"`);
  if (hardGaps.length) console.log(`  !  HARD GAPS: ${hardGaps.join(', ')}`);
  if (out.seniorityFlag) console.log(`  !  ${out.seniorityFlag}`);
  if (excluded.length) console.log(`  !  Exclusion keywords present: ${excluded.join(', ')}`);
  console.log(`\n  MATCHED (strong): ${strong.join(', ') || '-'}`);
  console.log(`  MATCHED (have):   ${have.join(', ') || '-'}`);
  console.log(`  GAPS:             ${gaps.join(', ') || '-'}`);
  if (gaps.length) console.log(`  -> ${out.gapGuidance}`);
  console.log(`\n  LEAD WITH:`);
  out.leadBullets.forEach((b, i) => console.log(`   ${i + 1}. [${b.id}] (${b.relevance}) ${b.text.slice(0, 100)}...`));
  console.log('');
}
