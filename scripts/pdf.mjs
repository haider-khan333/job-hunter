#!/usr/bin/env node
// Print any local HTML file to PDF with headless Chrome. Factored out of
// build.mjs so cover letters and one-off documents use the same pipeline.
//
//   node scripts/pdf.mjs <input.html> [output.pdf]
//
// Browser discovery is in lib/browser.mjs: Windows, macOS and Linux, with
// CHROME_PATH as an override.

import fs from 'node:fs';
import path from 'node:path';
import { htmlToPdf, noBrowserMessage } from './lib/browser.mjs';

const input = process.argv[2];
if (!input) { console.error('usage: node scripts/pdf.mjs <input.html> [output.pdf]'); process.exit(1); }
const htmlPath = path.resolve(input);
if (!fs.existsSync(htmlPath)) { console.error(`no such file: ${htmlPath}`); process.exit(1); }

const pdfPath = path.resolve(process.argv[3] || htmlPath.replace(/\.html?$/i, '.pdf'));

if (!htmlToPdf(htmlPath, pdfPath)) {
  console.error(noBrowserMessage());
  process.exit(1);
}

console.log(`  PDF  ${pdfPath}  (${(fs.statSync(pdfPath).size / 1024).toFixed(1)} KB)`);
