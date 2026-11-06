// Regression check: the stack veto must catch the roles that slip past on
// their titles, and must NOT touch any role actually worth applying to.
//
// WHY THIS TEST EXISTS. Four roles in the original run cleared the title
// filter while being built entirely on a stack the candidate did not have,
// because the title never said so: a "Senior Backend Developer (L3)" that was
// .NET, a "Senior Software Engineer" that was Oracle EBS, a "Senior GCS
// Software Engineer" that was UAV firmware, and a "Full Stack Engineer" that
// was C# and Angular. Every one of them scored well on keywords. The body has
// to be read, and the veto is what reads it.
//
// The stack groups are IMPORTED from config/search.config.mjs rather than
// copied here. A copy had already drifted once, and a passing test over a
// stale copy is worse than no test at all.
//
// The job descriptions are synthetic fixtures in fixtures/stack-veto-cases.json.
// They were synthetic on purpose: the original test read real postings out of
// a live queue, which meant the test could not be shared without sharing
// someone's search history.
//
//   node scripts/test-stack-veto.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import CFG from '../config/search.config.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STACKS = CFG.stackVeto.stacks;
const HITS = CFG.stackVeto.hits ?? 3;

function stackVeto(desc) {
  const found = [];
  for (const [name, re] of Object.entries(STACKS)) {
    const n = (desc.match(re) || []).length;
    if (n >= HITS) found.push(`${name} x${n}`);
  }
  return found.length ? found.join(', ') : null;
}

const fixture = JSON.parse(
  fs.readFileSync(path.join(HERE, 'fixtures', 'stack-veto-cases.json'), 'utf8'));

let pass = 0;
const failures = [];

for (const c of fixture.cases) {
  const verdict = stackVeto(c.desc);
  const vetoed = verdict !== null;
  const ok = vetoed === c.shouldVeto;
  if (ok) pass++; else failures.push({ c, verdict });
  console.log(`  ${ok ? 'pass' : 'FAIL'}  want ${c.shouldVeto ? 'veto' : 'keep'}  ${c.label}`);
}

console.log('');
if (failures.length) {
  for (const { c, verdict } of failures) {
    console.log(`  FAILED: ${c.label}`);
    console.log(`     got:  ${verdict ?? 'no veto'}`);
    console.log(`     why it matters: ${c.why}`);
  }
  console.log('');
  console.log(`  ${failures.length} of ${pass + failures.length} cases behaved wrongly.`);
  console.log('  A failure on a "keep" case is the serious one: it means the veto is');
  console.log('  now blocking roles you should be applying to. Narrow the group that');
  console.log('  fired, or raise stackVeto.hits in config/search.config.mjs.');
  process.exit(1);
}
console.log(`  all ${pass} cases behave as intended`);
