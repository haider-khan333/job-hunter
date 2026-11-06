# Job Hunter

An agent-driven job search you run yourself, in Claude Code. It watches job
boards every hour without you, scores what it finds against your real CV,
tailors a per-application PDF, drafts the email or fills the form, and keeps a
written record of every decision so the search has a memory longer than yours.

It was built over two months of one person's actual search: 1,089 tracked
postings, 56 applications, dozens of forms. Most of what is in here is a scar.
The comments in the code tell you which posting caused which rule, because the
reason a filter exists is usually more useful than the filter.

**This is not a mass-apply bot and it will refuse to become one.** See
[docs/04-rules.md](docs/04-rules.md).

---

## What it honestly does and does not do

| | |
|---|---|
| **Finds roles unattended** | Yes. An hourly Windows task, no browser, no login. 3,000+ postings a sweep across LinkedIn guest search, ~140 ATS boards and NaukriGulf. |
| **Ranks them** | Yes, and only ranks. The score is a sorting device, not a decision. It has been wrong in both directions and the failures are documented. |
| **Builds a tailored CV per role** | Yes. From one source of truth, by selecting and reordering real facts. It cannot add a skill you do not have. |
| **Writes the email or cover letter** | Yes, in your voice, with your gaps named rather than hidden. |
| **Submits applications** | Partly. Email, yes. Plain web forms, usually. Anything behind a CAPTCHA, a login wall or an account signup, no, by design. See [docs/02-portal-access.md](docs/02-portal-access.md). |
| **Replaces you** | No. Roughly one application in four needs a judgement only you can make, and the system is built to stop and ask rather than guess. |

### The number you should see before you start

In the original run: **75 applications over five weeks produced 1 screening
call.** The system was then measured properly, and the finding was not that it
needed to apply faster. It was that 41 of 52 portal applications in one market
produced total silence while direct email to a named human produced every
reply, and that 24 applications carrying a "Senior" title against 4 years 7
months of experience returned zero interviews.

Volume was never the bottleneck. If you take one thing from this repo, take
that, and read [docs/05-handoff.md](docs/05-handoff.md) before you read the
code.

---

## Setup

You need [Claude Code](https://claude.com/claude-code), Node 18+, and about
forty minutes of honest thinking about your own CV.

```bash
git clone <your-fork-url> job-hunter
cd job-hunter

cp profile/resume.example.json    profile/resume.json
cp profile/profile.example.json   profile/profile.json
cp profile/companies.example.json profile/companies.json
cp tracker.example.json           tracker.json
cp .env.example                   .env        # optional, WhatsApp alerts only
```

Then, in order:

1. **Fill in `profile/resume.json`.** Every fact, true. This is the only thing
   the agent is allowed to say about you.
2. **Fill in `profile/profile.json`.** The answers every application form
   wants, plus the decisions you have already made. Leave `CONFIRM` in place
   anywhere you have not actually decided.
3. **Grade yourself in `config/skills.config.mjs`.** For each skill: STRONG,
   HAVE or GAP. Be stingy with STRONG.
4. **Set your search in `config/search.config.mjs`.** Your real years of
   experience, your regions, your thresholds.
5. **Prove it works:**
   ```bash
   node scripts/test-title-filter.mjs     # 47 real titles, 22 keep / 25 drop
   node scripts/test-stack-veto.mjs       # 16 cases
   node scripts/watch.mjs --hours 24 --no-ats   # one live sweep, LinkedIn only
   node scripts/build.mjs applications/example-android-role   # one PDF
   ```
6. **Start the agent.** Open Claude Code in this directory and say
   `read docs/01-onboarding.md and interview me`. It will walk you through
   anything you left blank or wrong, which is faster than reading every file.

Then install the hourly sweep: [docs/03-watcher.md](docs/03-watcher.md).

**Before you push anything anywhere, read
[docs/06-privacy.md](docs/06-privacy.md).** Your fork will fill up with your
phone number, your salary decisions and other people's email addresses within a
week. The shipped `.gitignore` keeps that out of git; if you deliberately
remove those lines, keep the repository private.

---

## The documentation, in reading order

| | |
|---|---|
| [01 Onboarding](docs/01-onboarding.md) | What the agent needs to know about you before it is any use, and the interview that gets it. **Start here.** |
| [02 Portal access](docs/02-portal-access.md) | Which job boards can be read and submitted to, which need your browser, which need you. The CAPTCHA and account rules and why they are absolute. |
| [03 The hourly watcher](docs/03-watcher.md) | Installing, tuning and reading the unattended sweep. What it cannot reach. |
| [04 Standing rules](docs/04-rules.md) | The honesty constraints, and how to add your own so the agent stops asking. |
| [05 Handoff](docs/05-handoff.md) | The daily and weekly loop, what only you can do, and how to review outcomes instead of counting applications. |
| [06 Privacy](docs/06-privacy.md) | What must never reach a public repository, including other people's data. |

---

## Layout

```
profile/resume.json       SOURCE OF TRUTH about your experience. Facts only.
profile/profile.json      Form answers and standing decisions.
profile/companies.json    ATS boards to watch (~140 shipped).
config/search.config.mjs  Years, regions, thresholds, sources, stack vetoes.
config/skills.config.mjs  What you can honestly claim: STRONG / HAVE / GAP.
tracker.json              Every posting ever seen, with the reasoning. The memory.
applications/<slug>/      One folder per application: jd.txt, tailor.json, CV.
applications/_watch/      Written by the hourly sweep. LATEST.md is the digest.
scripts/                  The engine. See below.
.claude/agents/           The job-hunter subagent definition.
CLAUDE.md                 Instructions Claude Code loads automatically.
```

### Commands

```bash
node scripts/watch.mjs                  # one sweep now, print the digest
node scripts/watch.mjs --hours 24       # look back further (default 2)
node scripts/watch.mjs --no-ats         # LinkedIn only, much faster
node scripts/watch.mjs --rescan         # re-judge postings an earlier run dropped
node scripts/score.mjs applications/<slug>/jd.txt    # fit score and gaps
node scripts/build.mjs applications/<slug>           # tailored PDF
node scripts/track.mjs list | stats | followups      # the tracker
node scripts/track.mjs seen --url <url>              # duplicate check
```

`tracker.json` is **never** written by the hourly task. It changes only when a
decision is made and the reasoning is recorded with it. A fresh digest over an
unchanged tracker means the sweep found nothing worth deciding about, which is
the normal case.

---

## Credit and licence

MIT. Built by Muhammad Haider Khan with Claude Code, and generalised from the
repo that ran his own search. The filters, the scoring floor, the stack vetoes
and most of the warnings in the docs are there because something went wrong
first.
