# scripts/

What each one is, and which ones you will actually use. Three of these are
legacy and are kept because they still work, not because you need them.

## The ones that matter

| Script | What it does |
|---|---|
| **`watch.mjs`** | The hourly sweep. The core of the system. Pulls every source that answers a plain HTTP request, dedupes against `tracker.json`, applies the hard rules, scores the survivors, writes `applications/_watch/LATEST.md`. See [../docs/03-watcher.md](../docs/03-watcher.md). |
| **`score.mjs`** | Scores one job description against your profile and prints the fit, the gaps and which bullets to lead with. `node scripts/score.mjs applications/<slug>/jd.txt` |
| **`build.mjs`** | Turns `profile/resume.json` plus a per-application `tailor.json` into a tailored PDF, through headless Chrome or Edge. Nothing to install. The PDF is named from `basics.name`. |
| **`track.mjs`** | The tracker. `list`, `stats`, `followups`, `seen --url`, `add`, `status`, `note`. |
| **`watch-install.ps1`** | Installs, reschedules or removes the `JobWatcher` Windows Scheduled Task. Windows only; use cron elsewhere. |
| **`notify.ps1`** | The Windows toast the sweep fires when something clears the bar. |

## lib/

| Module | What it does |
|---|---|
| **`lib/keywords.mjs`** | The skill taxonomy: each canonical skill and the surface forms a posting might use for it. Generic; you should rarely edit it. Re-exports your grading from `config/skills.config.mjs`. |
| **`lib/browser.mjs`** | Finds a headless-capable Chrome, Chromium or Edge on Windows, macOS or Linux, honouring `CHROME_PATH` first and falling back to PATH. This is why the repo has no npm dependencies: the PDF pipeline shells out to a browser you already have rather than pulling in Puppeteer. |
| **`lib/setup-check.mjs`** | The preflight. A fresh clone has no `profile/resume.json`, because those files are gitignored on purpose, and without this the first command anyone runs dies on a raw `ENOENT` that explains nothing. |

## Tests

Run both after editing any filter. They exist because each one caught a real
failure.

| Script | What it protects |
|---|---|
| **`test-title-filter.mjs`** | 47 real job titles, the ones that must pass and the ones that must not. Stops a widened filter from letting in "Design Team Lead (Aluminum Manufacturing)" or "Technical Manager - Landscape & Swimming Pool". |
| **`test-stack-veto.mjs`** | 16 synthetic descriptions in `fixtures/`. Stops the body-level stack veto from either missing a .NET job wearing a neutral title or blocking a role you should apply to. It is how the broken C++ pattern was found. |

## Optional

| Script | What it does |
|---|---|
| **`whatsapp.mjs`** | Sends the digest over the Meta WhatsApp Cloud API. Needs `.env`. Off unless `notify.whatsapp` is true. Read the warnings in `.env.example` first: the token the dashboard hands you expires in 24 hours, and Meta fails silently outside a 24-hour messaging window. |
| **`pdf.mjs`** | Standalone HTML to PDF, used by `build.mjs`. |
| **`discover.mjs`** / **`discover2.mjs`** | Probe candidate company slugs against the public ATS APIs and record which ones actually serve a board. Run occasionally to refresh `profile/companies.json`. This is how the ~140 shipped boards were found, and it is the right tool when you move into a new market. |

## Legacy

| Script | Status |
|---|---|
| **`scan.mjs`** | An earlier, simpler ATS-only sweep that stages application folders directly. Superseded by `watch.mjs`, and **its location filter is still hardcoded to the Gulf** (`UAE_LOC`), unlike `watch.mjs` which reads your config. Kept because `--backend` and `--all-titles` are occasionally handy. Edit the regex before trusting it elsewhere. |
| **`ingest.mjs`** | Turns a hand-assembled `_jds.json` into scored application folders. Useful if you paste in postings from somewhere the watcher cannot reach. |

## A note on reading the code

The comments carry the history. Where a filter looks oddly specific, there is
usually a named posting in the comment above it explaining what got through and
why the rule is shaped that way. Those comments are the most valuable part of
this repository and they are worth reading before you simplify anything.
