// Find a headless-capable Chrome or Edge, on any platform.
//
// The PDF pipeline shells out to a browser that is already installed rather
// than pulling in Puppeteer, which keeps this repo at zero npm dependencies.
// The cost is that the binary has to be located, and that is platform
// specific.
//
// Order of preference:
//   1. CHROME_PATH, if you set it. Always wins, so an unusual install or a
//      Chromium build can be pointed at directly.
//   2. The usual install locations for the current platform.
//   3. Anything on PATH.

import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const CANDIDATES = {
  win32: [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    `${process.env.LOCALAPPDATA ?? ''}/Google/Chrome/Application/chrome.exe`,
  ],
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    `${process.env.HOME ?? ''}/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`,
  ],
  linux: [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/microsoft-edge',
    '/snap/bin/chromium',
    '/opt/google/chrome/chrome',
  ],
};

const ON_PATH = ['google-chrome', 'google-chrome-stable', 'chromium',
                 'chromium-browser', 'microsoft-edge', 'chrome'];

function fromPath() {
  const which = process.platform === 'win32' ? 'where' : 'which';
  for (const name of ON_PATH) {
    try {
      const out = execFileSync(which, [name], { stdio: ['ignore', 'pipe', 'ignore'] })
        .toString().split(/\r?\n/)[0].trim();
      if (out && fs.existsSync(out)) return out;
    } catch { /* not on PATH, try the next */ }
  }
  return null;
}

/** Absolute path to a usable browser, or null. */
export function findBrowser() {
  if (process.env.CHROME_PATH) {
    if (fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
    process.stderr.write(
      `  CHROME_PATH is set to "${process.env.CHROME_PATH}" but nothing is there. Ignoring it.\n`);
  }
  const hit = (CANDIDATES[process.platform] ?? []).find(p => p && fs.existsSync(p));
  return hit ?? fromPath();
}

/** One paragraph telling the user what to do about it. */
export function noBrowserMessage() {
  return [
    'No Chrome, Chromium or Edge found, so the PDF cannot be rendered.',
    'Install one, or point CHROME_PATH at the binary you already have:',
    process.platform === 'win32'
      ? '    set CHROME_PATH=C:\\path\\to\\chrome.exe'
      : '    export CHROME_PATH=/path/to/chrome',
  ].join('\n');
}

/** Render a local HTML file to PDF. Returns the pdf path, or null if no browser. */
export function htmlToPdf(htmlPath, pdfPath) {
  const browser = findBrowser();
  if (!browser) return null;
  execFileSync(browser, [
    '--headless', '--disable-gpu', '--no-sandbox', '--no-pdf-header-footer',
    `--print-to-pdf=${pdfPath}`,
    `file://${htmlPath.replace(/\\/g, '/').replace(/^([A-Za-z]:)/, '/$1')}`,
  ], { stdio: 'pipe', timeout: 60000 });
  return pdfPath;
}
