# 03 · The hourly watcher

Two layers, because they have genuinely different limits. Layer 1 runs without
you. Layer 2 cannot.

---

## Layer 1 — the sweep. Runs hourly on its own.

A Windows Scheduled Task named `JobWatcher` runs `node scripts/watch.mjs` every
60 minutes. It does not need Claude Code open, it does not need a browser, and
it does not need anyone logged into anything.

Each run:

1. Pulls every source that answers a plain HTTP request (see
   [02-portal-access.md](02-portal-access.md)).
2. Drops anything already in `tracker.json`, by URL **and** by company plus
   role, so the same job listed on LinkedIn and on a company board counts once.
3. Applies the hard skip rules below.
4. Reads the years-of-experience bar out of the description.
5. Scores what survives against `profile/resume.json` and
   `config/skills.config.mjs`.
6. Writes `applications/_watch/LATEST.md` and pops a Windows toast if anything
   cleared the bar.

### Install, check, stop

```powershell
powershell -ExecutionPolicy Bypass -File scripts\watch-install.ps1             # every 60 min
powershell -ExecutionPolicy Bypass -File scripts\watch-install.ps1 -Minutes 30
powershell -ExecutionPolicy Bypass -File scripts\watch-install.ps1 -Remove

Start-ScheduledTask   -TaskName JobWatcher     # run one now
Get-ScheduledTaskInfo -TaskName JobWatcher     # LastTaskResult 0 means it finished clean
```

Not on Windows? The task wrapper is Windows-only; `scripts/watch.mjs` is plain
Node and works anywhere. Use cron:

```cron
0 * * * * cd /path/to/job-hunter && /usr/bin/node scripts/watch.mjs --quiet --notify
```

You lose the toast, which lives in `scripts/notify.ps1`.

### Where it writes

| File | What it is |
|---|---|
| `applications/_watch/LATEST.md` | The digest. **Open this one.** Rewritten every run, in local time. |
| `applications/_watch/queue.json` | Everything found, additive, with the full description. Nothing is lost between runs. |
| `applications/_watch/seen.json` | Posting ids already handled, pruned at 60 days. |
| `applications/_watch/watch.log` | One line per run, for spotting a source that quietly died. |

### What it does NOT write

`tracker.json` is **not** touched by the hourly task. It changes only when a
Claude session makes a decision and records the reasoning with it. So a fresh
`LATEST.md` over an unchanged tracker means the sweep ran and found nothing
worth a decision, which is the normal case rather than a failure.

Watch `watch.log` rather than the digest if you want to know whether the
machinery is healthy. A source that silently starts returning zero rows looks
identical to a quiet job market from the digest alone.

---

## The rules it applies

Every one of these came from a decision already made by hand. Tune them in
`config/search.config.mjs`; the title regexes are edited in place near the top
of `scripts/watch.mjs`, under "hard rules".

- **Years bar.** More than `yearsTolerance` above your `yearsExperience` is
  dropped. Within it is kept and labelled a near miss. **This is the single
  most important filter:** 32 of 144 skips were the years bar, more than every
  stack gap combined.
- **No years bar stated** sorts to the top, above a higher score that carries
  one. That pattern is what actually converted.
- **Excluded locations** are dropped outright, from your config.
- **Geo-locked remote** is dropped. `US-Remote` and `Canada-Remote` are not
  reachable from most places; plain `Remote` is. A posting reading
  `Remote - Bengaluru` is not a remote job, it is a Bengaluru job.
- **Principal, Staff, Director, Head of, VP, Architect** are dropped as two
  grades too senior.
- **Stack veto, read from the body and not the title.** Four roles cleared the
  title filter while being built on a stack the candidate did not have, because
  the title never said so. If a hard-gap stack appears three or more times in
  the description, it **is** the job. One passing mention never vetoes
  anything. The reason is printed, so a wrong veto is visible rather than
  silent. Regression test: `node scripts/test-stack-veto.mjs`.
- **Blocked titles**: QA and test automation, DevOps and SRE, data and ML
  engineering, embedded, games, security engineering, plus non-engineering
  "Team Leader" roles at stores and warehouses.

### The management half

Pure Android and iOS openings went quiet for a day and a half, so the net was
widened to the roles a mobile lead can step into: technical and software lead,
engineering manager, technical project manager, scrum master, product owner,
technical product manager, solutions engineer, implementation engineer or
consultant, integration engineer, technical account manager, technical
consultant.

Two rules make that safe rather than noisy:

- **Ambiguous titles must carry a technology word.** "Delivery Manager" is a
  courier job at a food-delivery company and a software job at an IT services
  firm. So `project manager`, `delivery manager`, `programme manager`,
  `account manager`, `consultant`, `team lead` and `product manager` are
  accepted **only** when the title itself says software, technical, digital,
  IT, mobile, app, platform, cloud, API, web, fintech, payments, banking or
  e-commerce.
- **That technology word overrides the non-engineering list.** "Technical
  Account Manager" survives. "Design Team Lead (Aluminum Manufacturing)" and
  "Mechanical Engineer" still do not. `engineer` and `engineering` are
  deliberately **not** technology words here, because that is the one word
  that makes a mechanical role look like a software one.

Regression test: `node scripts/test-title-filter.mjs`, 47 real titles, the ones
that must pass and the ones that must not.

**What the first widened run cost and bought.** 3,189 postings over 48 hours:
41 cleared the card filters against 1 or 2 an hour before, 24 cleared the years
bar, 16 scored 60 or over. **Three were worth applying to.** The four highest
scores in the whole run were an aluminium facade drafting lead (88), a
brewery-hygiene consultant (89 and 84, on two copies of the same advert) and an
airline role wanting four years of a specific revenue-management product (93).

---

## Why the score is only a ranking

It has been wrong in both directions, measurably, and the fixes are in the code
with their reasons. Two worth knowing about:

**It used to reward thin postings.** The score was a percentage with no floor
under the denominator, so a posting matching almost nothing scored 100 for
covering the little it did match. Measured on a live queue: "Technical Manager
- Landscape & Swimming Pool" scored **100** off two matched categories worth 5
points. So did "Fire Fighting & Plumbing Team Leader" and "Team Lead - Aviation
Maintenance". A real Android role in the same queue scored **67** off ten
categories worth 19 points. The entire top of the list was thin non-software
adverts, which is why the operator kept asking whether there were any jobs at
all: there were, ranked underneath swimming pools.

The fix is `thresholds.evidenceFloor`: the raw percentage is multiplied by how
much evidence it rests on, capped at 1. The floor of 10 was chosen by
measurement over 2,257 stored descriptions, not taste. It discounts 9% of them,
and 12 starts demoting genuine engineering roles.

**It missed the one good role.** On the first run three postings scored above
threshold and all three were wrong: a "Senior Backend Developer (L3)" that was
C# and .NET, a "Senior Software Engineer" that was entirely Oracle EBS, and
three roles that were US-Remote and needed sponsorship. Meanwhile the one role
genuinely worth applying to scored **53** and sat below the threshold, because
the scorer counted Kafka and GraphQL as gaps when the posting listed them under
"what would amaze us" rather than as requirements.

A bot applying on score alone would have sent three bad applications and missed
the good one. **The score ranks the queue. It does not decide.**

---

## Tuning it

```bash
node scripts/watch.mjs --hours 24 --no-ats   # fast, LinkedIn only
node scripts/watch.mjs --dry                 # change nothing on disk
node scripts/watch.mjs --rescan              # ignore seen.json
```

`--rescan` re-judges postings an earlier run dropped on their title, which is
what you want after widening a filter. **Never put `--rescan` on the hourly
task**; it defeats the deduplication and re-reads everything.

The most useful part of the digest is the bottom: the **"why the rest were
dropped"** counts. If `title not a target role` is eating 80% of a sweep, your
title filters and your actual target have drifted apart, and that is worth more
attention than the scores at the top.

---

## Layer 2 — applying. Needs a person or a live Claude session.

The sweep stops at a ranked queue. Submitting is the part that does not
automate safely, and that is a measured conclusion rather than caution. The
reasoning, the three access tiers and the absolute rules are in
[02-portal-access.md](02-portal-access.md); the loop around it is in
[05-handoff.md](05-handoff.md).

In short: **while Claude Code is open**, say "work the queue" and it reads each
candidate's real posting, builds the tailored CV, writes the email or fills the
form, submits what it can and stops where it must. **When it is not open**, the
toast and `LATEST.md` are waiting, and nothing is lost: `queue.json` is
additive.
