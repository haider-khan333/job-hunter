# 05 · Handoff

The operator's manual. What runs without you, what needs you, what to do each
day, and how to tell whether the search is working.

---

## Who does what

| | Runs unattended | Needs Claude Code open | Needs you personally |
|---|---|---|---|
| Finding postings | hourly task, tier 1 sources | browser sweep for Bayt/Indeed | nothing |
| Reading a posting properly | no | yes | nothing |
| Scoring and ranking | yes | yes | nothing |
| Building a tailored CV | no | yes | nothing |
| Writing the email or letter | no | yes | reviewing it, if you kept the gate |
| Submitting by email | no | yes | nothing, if the gate is lifted |
| Submitting a web form | no | mostly | the CAPTCHA click |
| Anything behind a login or signup | no | no | all of it |
| Deciding a salary figure | no | no | all of it |
| Reviewing outcomes | no | yes, it can do the counting | the conclusion |

---

## The daily loop

**Five minutes, and most days there is nothing to do.** That is the system
working.

1. Open `applications/_watch/LATEST.md`. It is rewritten every hour.
2. Read the top table only. Anything scoring 60+ with a years bar you clear.
3. If nothing is there, stop. Do not go looking for something to apply to; see
   the review section below for why volume is not the lever.
4. If something is there, open Claude Code and say **"work the queue"**. It
   will read the real posting, not the card, build the CV, write the email or
   fill the form, submit what it can, and stop where it must.
5. Answer whatever it stops on. Then ask it to **write the answer into
   `profile/profile.json`** so it never has to ask again.

### Weekly

- `node scripts/track.mjs followups` — anything applied 7+ days ago with no
  reply. Send the follow-up. In the original run a follow-up sent 38 days late
  still got a reply; one sent on time would have been better.
- A browser sweep for the tier 2 boards, in one batch. See
  [02-portal-access.md](02-portal-access.md).
- `Get-ScheduledTaskInfo -TaskName JobWatcher` and a glance at
  `applications/_watch/watch.log`. A source that silently dies looks exactly
  like a quiet market from the digest.

### When Claude Code has been closed for days

Nothing is lost. `queue.json` is additive and `seen.json` is pruned at 60 days.
Say "work the queue" and the backlog gets handled in one pass. The only thing
that expires is the postings themselves, which is a real cost: one role in the
original run ran out the clock while staged and ready to send.

---

## The review, which matters more than the daily loop

**Every 30 to 40 applications, stop applying and count.** This is the single
highest-value thing in this document and it is the thing nobody does.

Count five numbers:

1. Applications sent
2. Replies of any kind
3. Screening calls
4. Interviews
5. Offers

Then break the reply rate down **by channel**: portal form, direct email to a
named human, recruiter conversation, referral.

### What the original review found

75 applications over five weeks. **One screening call.** Broken down:

- **41 of 52 portal applications in one market produced total silence.** Not
  rejection. Nothing at all.
- Every reply in the entire search came from direct email to a named person, or
  from a recruiter conversation.
- **24 of the 75 carried a "Senior" title** against 4 years 7 months of
  experience. Those 24 returned **zero** interviews.

Three conclusions followed, and all three were changes to strategy rather than
to code:

1. **Target mid-level, not senior.** The grade mismatch is invisible in a score
   and fatal in a shortlist.
2. **Stop relying on portal applications.** Prefer any posting that carries an
   email address and a human name, even at a lower score.
3. **The watcher was not the bottleneck, so improving it would not have
   helped.** This is the one worth internalising. Volume felt like progress
   because it was measurable. It was not the constraint.

### What to do with your own numbers

Write the conclusion into `profile/profile.json` under `strategy`, with the
date and the evidence. Then act on it. A measured finding you do not act on is
worse than no measurement, because it tells you the search is broken while you
keep doing the same thing.

If your numbers say the same as the original ones, the implication is
uncomfortable and clear: the hours are better spent on ten careful emails to
named people than on a hundred portal submissions, and this repo's job is to
find you those ten.

---

## What the agent will interrupt you for

Roughly one application in four. This is designed, not a shortfall.

| Interruption | Why it is yours |
|---|---|
| A salary field with no decided figure | Cannot be renegotiated upward after submission |
| A CAPTCHA | Absolute rule |
| An account signup | Absolute rule |
| Third-party terms and conditions | A contract with a company that is not the employer |
| A privacy or recording consent | Your decision about your own data |
| A passport or national ID number | Should not be in the repo at all |
| A cover letter in a language you do not speak | Writing one misrepresents an ability |
| A grade or title judgement | "Should I apply to a Lead role" is strategy |
| Two near-identical roles at one employer | Applying to both reads as scattershot |

**When one of these comes up, the answer is worth more than the application.**
Answer it once, get it written into `profile/profile.json` with the reason, and
the next fifty applications do not stop.

---

## Keeping the record useful

`tracker.json` is the memory of the search, and it is the reason this works
over months rather than days. Two habits keep it worth having:

- **Every status change gets a note explaining the decision**, not just the
  outcome. "skipped" tells you nothing in six weeks. "skipped 2026-10-14: body
  is Oracle EBS throughout, invisible from the title" stops you reading the
  same advert again.
- **Commit after each session.** The git history of the tracker is a
  searchable record of what you tried and what happened, and it has settled
  more than one argument about whether something was ever actually sent.

A warning from experience: **check the mailbox before writing an email.** One
tracker row claimed an application was a draft awaiting approval for three
days when the email had in fact been sent, with the CV attached, on the day it
was written. The system nearly sent it twice. The record is only as good as
the care taken writing it.
