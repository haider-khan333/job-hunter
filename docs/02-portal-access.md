# 02 · Portal access

**Read this before you wonder why a job board returns nothing.** Access is the
single biggest practical constraint on this system, it is not evenly
distributed across job boards, and no amount of better code fixes it.

There are three tiers, and which tier a board sits in decides who does the
work: the hourly script, your browser, or you.

---

## Tier 1 — readable by a plain HTTP request, no login

These the hourly watcher reads on its own, unattended, forever.

| Source | How it is reached | Notes |
|---|---|---|
| **LinkedIn job search** | the `jobs-guest` search endpoint | No login. Returns the card: title, company, location, posting id. ~3,000 postings a sweep across eight geos. |
| **Greenhouse, Lever, Ashby, Recruitee, Workable** | each board's public JSON API | The most reliable sources in the system. Full description text, structured, no bot protection. ~140 companies in `profile/companies.json`. |
| **NaukriGulf** | internal search API | Works, Gulf only. |

This tier is where the volume comes from, and it is why the watcher can run
every hour on a machine with nothing open.

### Two things the watcher had to learn to read here

**LinkedIn's structured requirements block beats its prose.** A posting's
skills paragraph listed React, Python, FastAPI, WebSockets and Azure, which
read as a strong match. The structured "Requirements added by the job poster"
block underneath said: 5+ years Python, **4+ years Angular**, 1+ years MCP, 2+
years React. Three of the four were gaps and one was a zero. Always read that
block, and it is only in the full posting, never on the card.

**LinkedIn sometimes serves a sign-in wall instead of the job body.** The wall
is long enough to pass a "description too thin" check, so the posting then gets
**scored on the login boilerplate**. One aviation-maintenance role came back as
score 100 with "gaps: none" that way, while its actual requirement was 15+
years on aircraft. `cleanLinkedInDesc()` in `watch.mjs` strips the wall first
so the thin-description check can catch it honestly.

---

## Tier 2 — needs YOUR logged-in browser

These refuse scripted requests outright. A Claude session can drive them, but
only through a real Chrome carrying your real sessions.

| Source | What blocks it |
|---|---|
| **Bayt** | 403 to anything without a browser session |
| **Indeed** | Cloudflare |
| **NaukriGulf's own search pages** | bot protection (the API in tier 1 still works) |
| **LinkedIn recruiter posts and content search** | needs a logged-in session |
| **Most "Easy Apply" style flows** | your identity has to already be in the session |

**This is a real hole, not an oversight.** In the Gulf especially, Bayt carries
inventory that LinkedIn sweeps never surface, including plain Java and
mobile roles at large employers. The hourly digest ends with a reminder to run
a browser sweep for exactly this reason.

### Setting up the browser, and the order that matters

```
start-chrome-for-claude.bat     <-- run this FIRST
then start Claude Code
```

The script launches Chrome with remote debugging on port 9222 under a
dedicated profile at `%USERPROFILE%\chrome-claude-profile`, because Chrome 136+
refuses remote debugging on your default profile.

**The order is not a suggestion.** The `chrome-devtools` MCP server attaches to
an existing Chrome at boot. If port 9222 is not already listening when Claude
Code starts, the server dies with `CONNECT_TIMEOUT` and **cannot be revived
for the rest of the session**. Restarting Claude Code is the only fix. A whole
working session was lost to this before it was understood.

Log into LinkedIn, Bayt, Indeed and any ATS you use **once** in that profile.
Those sessions persist, and they are the only reason portal applications work
at all.

### Two failure modes you will meet

- **A tab left open for days gets a hung renderer.** Symptoms:
  `evaluate_script` hangs until it times out, `take_snapshot` fails with
  "Timed out waiting for the accessibility tree". Navigating to the same URL
  again recovers it. Beware: a form you had filled is gone, because the fill
  only ever lived in that tab.
- **Chrome dies and takes an unsubmitted form with it.** Nothing is saved
  server-side on most application forms unless you have an account. If a form
  was filled but not submitted and the browser went away, it has to be filled
  again from scratch. Submit the same day you fill.

---

## Tier 3 — needs YOU, and always will

The agent stops here on purpose. These are not technical limits, they are
limits on what anyone should automate under your name.

### Absolute, no exceptions

1. **Never solve a CAPTCHA.** hCaptcha, reCAPTCHA, Cloudflare Turnstile,
   DataDome. The agent fills the form completely, validates it, and hands it to
   you one click from sent. You tick the box and press send.
2. **Never enter credentials.** No usernames, no passwords, no OTP codes.
3. **Never create an account.** Six applications in the original run were
   blocked on exactly this: Workday and Taleo instances at large employers
   that require registration before the form opens. Those are yours to make.
4. **Never agree to a third party's commercial terms on your behalf.** An
   employer's own applicant-privacy acknowledgement is part of the act of
   submitting and the agent can tick it. "Do you accept the terms and
   conditions of [the ATS vendor]" is a contract with a different company and
   that stays yours. Two applications sat blocked on precisely this
   distinction, and it is the right place to stop.

### Where the agent should stop and ask

- A consent checkbox that is a **privacy decision** rather than an
  acknowledgement. One form made interview-transcript recording a required
  field.
- A **salary field** when your profile still says `CONFIRM`.
- A **video question**, a timed assessment, or a condition you must personally
  accept (one employer required a declaration of no AI tool use).
- A **health or disability declaration**, or a request for a passport number or
  national ID number.
- A **cover letter in a language you do not speak.** Writing one would
  misrepresent an ability you do not have. Writing in English and naming the
  gap in the first line is defensible, but it is your call, not the agent's,
  and it should be recorded as a standing rule once you make it.

---

## What this means for where your hours go

The original search measured it: **41 of 52 portal applications in one market
produced total silence.** Every reply came from direct email to a named human,
or from a recruiter conversation.

Portals are tier 1 and tier 2, and they are where the automation is strongest,
which makes them feel like progress. They are also where the response rate was
indistinguishable from zero. The highest-value thing this system does is not
submitting more forms; it is finding the posting that carries an email address
and a name, and writing to that person properly.

So:

- Let the hourly watcher own tier 1. It costs you nothing.
- Use the browser for tier 2 in **batches**, when you are at the machine
  anyway, not as a daily ritual.
- Spend your actual attention on anything with a human attached to it.
