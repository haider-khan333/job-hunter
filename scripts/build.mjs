#!/usr/bin/env node
// Build a tailored resume PDF for one application.
//   node scripts/build.mjs applications/<slug>
// Reads profile/resume.json + <slug>/tailor.json, writes <slug>/resume.html
// and <slug>/<Your-Name>-<Role>.pdf via headless Chrome/Edge. The name comes
// from profile/resume.json -> basics.name, so there is nothing to edit here.
//
// tailor.json controls ONLY selection/ordering/emphasis. It can override a
// bullet's wording, but the underlying fact must already exist in resume.json.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireSetup } from './lib/setup-check.mjs';
import { htmlToPdf, noBrowserMessage } from './lib/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
requireSetup(ROOT, ["profile/resume.json"]);
const dir = process.argv[2];
if (!dir) { console.error('usage: node scripts/build.mjs applications/<slug>'); process.exit(1); }
const appDir = path.resolve(ROOT, dir);

const resume = JSON.parse(fs.readFileSync(path.join(ROOT, 'profile/resume.json'), 'utf8'));
const tailorPath = path.join(appDir, 'tailor.json');
const t = fs.existsSync(tailorPath) ? JSON.parse(fs.readFileSync(tailorPath, 'utf8')) : {};

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

// ---- summary ---------------------------------------------------------------
const summary = t.summaryOverride || resume.summaryVariants[t.summaryVariant || 'default'] || resume.summaryVariants.default;

// ---- skills: reorder so JD-relevant groups come first, keep all ------------
// Optional "dropSkills": [groupId, ...] hides whole groups to hold 2 pages (added 2026-11-06).
let skills = resume.skills.filter(g => !(t.dropSkills || []).includes(g.id));
if (t.skillOrder?.length) {
  const rank = new Map(t.skillOrder.map((id, i) => [id, i]));
  skills.sort((a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99));
}
// Optional per-group item reordering (surface the JD's exact terms first).
if (t.skillItemOrder) {
  skills = skills.map(g => {
    const want = t.skillItemOrder[g.id];
    if (!want) return g;
    const rest = g.items.filter(i => !want.includes(i));
    const front = want.filter(i => g.items.includes(i));
    return { ...g, items: [...front, ...rest] };
  });
}

// ---- experience: reorder + optional rewording + optional drop -------------
const experience = resume.experience.map(job => {
  const ov = t.bulletOverrides?.[job.id] || {};
  const drop = new Set(t.dropBullets || []);
  let bullets = job.bullets.filter(b => !drop.has(b.id))
    .map(b => ({ ...b, text: ov[b.id] || b.text }));
  const order = t.bulletOrder?.[job.id];
  if (order?.length) {
    const rank = new Map(order.map((id, i) => [id, i]));
    bullets.sort((a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99));
  }
  return { ...job, title: t.titleOverrides?.[job.id] || job.title, bullets };
});

const role = t.targetRole || 'Mobile Developer';
const b = resume.basics;
const contactLine2 = [b.phoneUae, b.phone].filter(Boolean).join(' · ');

// ---- optional header photo ------------------------------------------------
// OPT-IN per application via tailor.json "includePhoto": true. Default is OFF:
// Gulf employers often expect a photo (some reject CVs without one), while many
// European and ATS-driven processes prefer none, so this is a per-job decision.
// "photoFocus" shifts the crop vertically if the face sits high or low.
let photoTag = '';
if (t.includePhoto) {
  const photoPath = path.resolve(ROOT, t.photo || resume.basics.photo || 'my_profile_pic.jpeg');
  if (!fs.existsSync(photoPath)) {
    console.error(`  !  includePhoto is set but no photo found at ${photoPath}`);
    process.exit(1);
  }
  const ext = path.extname(photoPath).toLowerCase().replace('.', '');
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  const b64 = fs.readFileSync(photoPath).toString('base64');
  photoTag = `<img class="photo" src="data:${mime};base64,${b64}" alt="${esc(b.name)}">`;
}

const html = `<meta charset="utf-8">
<title>${esc(b.name)} · ${esc(role)}</title>
<style>
  @page { size: letter; margin: 13mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10.2pt; line-height: 1.34;
         color: #1a1a1a; margin: 0; }
  h1 { font-size: 21pt; color: #1F4E79; text-align: center; margin: 0 0 5px; letter-spacing: .4px; }
  .contact { text-align: center; font-size: 9.2pt; color: #333; line-height: 1.5; margin-bottom: 3px; }
  .contact a { color: #1F4E79; text-decoration: none; }
  .avail { text-align: center; font-size: 9.2pt; color: #1F4E79; font-weight: bold; margin-bottom: 11px; }
  /* Header photo sits top-right so the centred name and contact block are
     untouched. Fixed square keeps every build identical regardless of the
     source image's aspect ratio. */
  .hdr { position: relative; }
  .hdr .photo { position: absolute; top: 0; right: 0; width: 78px; height: 78px;
                object-fit: cover; object-position: center ${t.photoFocus || '20%'};
                border-radius: 50%; border: 2px solid #1F4E79; }
  .hdr.has-photo h1, .hdr.has-photo .contact, .hdr.has-photo .avail {
    padding-left: 86px; padding-right: 86px; }
  h2 { font-size: 11.5pt; color: #1F4E79; text-transform: uppercase; letter-spacing: .6px;
       border-bottom: 1.3px solid #1F4E79; padding-bottom: 2px; margin: 13px 0 7px;
       page-break-after: avoid; break-after: avoid; }
  p.summary { margin: 0; text-align: justify; }
  ul { margin: 0; padding-left: 15px; }
  li { margin-bottom: 3.2px; text-align: justify; orphans: 2; widows: 2; }
  /* Let jobs flow across the page break so page 1 fills, but never strand a
     job heading at the bottom of a page away from its first bullets. */
  .job { margin-bottom: 9px; }
  .job-title { font-weight: bold; font-size: 10.6pt; margin-bottom: 1px;
               page-break-after: avoid; break-after: avoid; }
  .job-meta { color: #1F4E79; font-weight: bold; font-size: 9.6pt; margin-bottom: 4px;
              page-break-after: avoid; break-after: avoid; }
  .job-meta .dates { color: #555; font-weight: normal; font-style: italic; }
  .skills li { margin-bottom: 2.6px; }
</style>

<div class="hdr${photoTag ? ' has-photo' : ''}">
${photoTag}
<h1>${esc(b.name)}</h1>
<div class="contact">
  ${esc(t.headlineOverride || b.headline)}<br>
  ${esc(b.location)} &nbsp;|&nbsp; ${esc(contactLine2)} &nbsp;|&nbsp; <a href="mailto:${esc(b.email)}">${esc(b.email)}</a><br>
  ${[b.linkedin, b.website, b.github, b.portfolio].filter(Boolean).map(u => `<a href="https://${esc(u)}">${esc(u)}</a>`).join(' &nbsp;|&nbsp; ')}
</div>
<div class="avail">${esc(t.availabilityOverride || b.availability)}</div>
</div>

<h2>Professional Summary</h2>
<p class="summary">${md(summary)}</p>

<h2>Core Skills &amp; Technologies</h2>
<ul class="skills">
${skills.map(g => `  <li><strong>${esc(g.label)}:</strong> ${esc(g.items.join(', '))}</li>`).join('\n')}
</ul>

<h2>Work Experience</h2>
${experience.map(j => `<div class="job">
  <div class="job-title">${esc(j.title)}</div>
  <div class="job-meta">${esc(j.company)}${j.locationNote ? ` (${esc(j.locationNote)})` : ''} &nbsp;•&nbsp; <span class="dates">${esc(j.start)} – ${esc(j.end)}</span></div>
  <ul>
${j.bullets.map(x => `    <li>${md(x.text)}</li>`).join('\n')}
  </ul>
</div>`).join('\n')}

${(() => {
  const all = resume.projects || [];
  const keep = t.dropProjects ? all.filter(p => !t.dropProjects.includes(p.id)) : all;
  const order = t.projectOrder;
  const list = order ? [...keep].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)) : keep;
  if (!list.length) return '';
  return `<h2>Projects</h2>
${list.map(p => `<div class="job">
  <div class="job-title">${esc(p.name)}${p.url ? ` &nbsp;•&nbsp; <a href="https://${esc(p.url)}">${esc(p.url)}</a>` : ''}</div>
  <div class="job-meta">${esc(p.role)}${p.end ? ` &nbsp;•&nbsp; <span class="dates">${esc([p.start, p.end].filter(Boolean).join(' – '))}</span>` : ''}</div>
  <ul>
${p.bullets.filter(x => !(t.dropBullets || []).includes(x.id)).map(x => `    <li>${md(x.text)}</li>`).join('\n')}
  </ul>
</div>`).join('\n')}
`;
})()}
<h2>Education</h2>
${resume.education.map(e => `<div class="job">
  <div class="job-title">${esc(e.degree)}</div>
  <div class="job-meta">${esc(e.institution)} &nbsp;•&nbsp; <span class="dates">${esc(e.start)} – ${esc(e.end)}</span></div>
  <ul>
${e.bullets.map(x => `    <li>${md(x.text)}</li>`).join('\n')}
  </ul>
</div>`).join('\n')}
`;

fs.mkdirSync(appDir, { recursive: true });
const htmlPath = path.join(appDir, 'resume.html');
fs.writeFileSync(htmlPath, html, 'utf8');

// ---- render to PDF ---------------------------------------------------------
const safeRole = role.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '');
const safeName = String(resume.basics.name || 'Resume')
  .trim().split(/\s+/)
  .map(w => w[0].toUpperCase() + w.slice(1).toLowerCase())
  .join('-').replace(/[^A-Za-z0-9-]/g, '');
const pdfPath = path.join(appDir, `${safeName}-${safeRole}.pdf`);

// Browser discovery lives in lib/browser.mjs and covers Windows, macOS and
// Linux, with CHROME_PATH as an override. If nothing is found the HTML is
// still written, so the CV is never lost to a missing browser.
if (!htmlToPdf(htmlPath, pdfPath)) {
  console.log(`  HTML  ${htmlPath}`);
  console.log('');
  console.log('  ' + noBrowserMessage().split('\n').join('\n  '));
  console.log('  The HTML above is complete; you can also just print it to PDF yourself.');
  process.exit(0);
}

const kb = (fs.statSync(pdfPath).size / 1024).toFixed(1);
console.log(`  PDF   ${pdfPath}  (${kb} KB)`);
console.log(`  HTML  ${htmlPath}`);
console.log(`  Role  ${role}   Variant  ${t.summaryVariant || 'default'}`);
