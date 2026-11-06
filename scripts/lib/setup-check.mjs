// Fail usefully rather than with a raw ENOENT stack trace.
//
// A fresh clone has no profile/resume.json, because those files hold personal
// data and are gitignored on purpose. Without this check the first command
// anyone runs dies on `Error: ENOENT: no such file or directory`, which tells
// them nothing about what to do next.

import fs from 'node:fs';
import path from 'node:path';

const REQUIRED = [
  ['profile/resume.json',     'profile/resume.example.json',     'your experience, the source of truth for every CV'],
  ['profile/profile.json',    'profile/profile.example.json',    'form answers and your standing decisions'],
  ['profile/companies.json',  'profile/companies.example.json',  'the ATS boards to watch'],
  ['tracker.json',            'tracker.example.json',            'the record of every posting seen'],
];

export function requireSetup(root, needed = REQUIRED.map(r => r[0])) {
  const missing = REQUIRED.filter(([file]) =>
    needed.includes(file) && !fs.existsSync(path.join(root, file)));

  if (!missing.length) return;

  const w = s => process.stderr.write(s + '\n');
  w('');
  w('  SETUP NOT FINISHED');
  w('');
  w(`  ${missing.length === 1 ? 'This file is' : 'These files are'} missing. They hold personal data, so they are`);
  w('  gitignored and never shipped. Copy the examples and fill them in:');
  w('');
  for (const [file, example, why] of missing) {
    w(`      cp ${example}  ${file}`);
    w(`         ${why}`);
  }
  w('');
  w('  Then let the agent walk you through filling them in. Open Claude Code');
  w('  in this directory and say:');
  w('');
  w('      read docs/01-onboarding.md and interview me');
  w('');
  w('  That is faster than editing the files blind, and it will catch the two');
  w('  fields that matter most: your real years of experience, and an honest');
  w('  STRONG / HAVE / GAP grade for every skill.');
  w('');
  process.exit(1);
}
