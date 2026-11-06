#!/usr/bin/env node
// Print any local HTML file to PDF with headless Chrome. Factored out of
// build.mjs so cover letters and one-off documents use the same pipeline.
//
//   node scripts/pdf.mjs <input.html> [output.pdf]

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const BROWSERS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];

const input = process.argv[2];
if (!input) { console.error('usage: node scripts/pdf.mjs <input.html> [output.pdf]'); process.exit(1); }
const htmlPath = path.resolve(input);
if (!fs.existsSync(htmlPath)) { console.error(`no such file: ${htmlPath}`); process.exit(1); }

const pdfPath = path.resolve(process.argv[3] || htmlPath.replace(/\.html?$/i, '.pdf'));
const browser = BROWSERS.find(p => fs.existsSync(p));
if (!browser) { console.error('no Chrome or Edge found'); process.exit(1); }

execFileSync(browser, [
  '--headless', '--disable-gpu', '--no-sandbox', '--no-pdf-header-footer',
  `--print-to-pdf=${pdfPath}`, `file:///${htmlPath.replace(/\\/g, '/')}`,
], { stdio: 'pipe', timeout: 60000 });

console.log(`  PDF  ${pdfPath}  (${(fs.statSync(pdfPath).size / 1024).toFixed(1)} KB)`);
