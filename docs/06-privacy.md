# 06 · Privacy

**Read this before you push.** Within a week of real use, this repository will
contain your phone number, your salary decisions, your visa status, your CV in
full, and the names and email addresses of people who are not you.

That last category is the one people forget, and it is the one that matters
most.

---

## Keep your working fork private

The shipped `.gitignore` already excludes the files that fill up with personal
data:

```
profile/profile.json
profile/resume.json
tracker.json
applications/
.env
```

That is a deliberately cautious default. It means a public fork stays clean
even if you forget this document exists.

**The cost is that your decision history is not in git**, and that history is
genuinely valuable: the tracker's commit log is a searchable record of what
you tried and what happened.

So pick one, on purpose:

- **Public fork** (sharing the tool): leave `.gitignore` exactly as shipped.
  Your data never enters git. Keep a separate private backup of
  `tracker.json`, because losing it loses the memory of your search.
- **Private fork** (running your own search): delete those five lines and
  commit everything. Then never make the repository public, and never accept a
  pull request that would surface those paths.

There is no safe third option. A repository that was private and becomes public
still carries every commit.

---

## Never commit, under any circumstances

Not even to a private repository. If a private repo is later shared, forked,
or backed up to somewhere you forgot, these are the things that cause real
damage.

| | Why |
|---|---|
| **Passport number** | Identity document. Record "HAVE" and nothing else. |
| **National ID / Emirates ID number** | Same. |
| **Date of birth** | Combined with your name and employer it is most of an identity theft. Type it into forms yourself. |
| **Bank details, tax numbers** | No application needs these before an offer. If one asks, that is a scam signal. |
| **API keys and tokens** | `.env` is gitignored. Keep it that way. Never paste a key into a chat, including a chat with the agent. |
| **Scans or photos of documents** | Visa, ID, degree certificate. Keep them outside the repo entirely. |

The example `profile.json` demonstrates the convention: record that you
**have** a document, never its number.

```json
"nationalId": "HAVE - do not store the number in this repo"
```

---

## Other people's data, which is not yours to publish

This is the part that gets overlooked, and the part with actual legal weight in
the EU, the UK and most of the Gulf.

A real tracker accumulates, as a matter of normal operation:

- Recruiters' full names and work email addresses
- Hiring managers' names
- Private LinkedIn message threads
- Internal notes about who replied, who ignored you, and your opinion of them
- Occasionally, a recruiter's mobile number

**Publishing that is publishing their personal data without their knowledge.**
A recruiter who emailed you about a job did not consent to appearing in a
public GitHub repository, and the fact that their address was on a job advert
does not change that.

So:

- If you publish this repo at all, publish it as a **template with no tracker**,
  which is exactly what the shipped `.gitignore` gives you.
- If you want to share an example, **invent one.** The fixtures in
  `scripts/fixtures/` are synthetic for precisely this reason: the regression
  test used to read real postings out of a live queue, which meant the test
  could not be shared without sharing a search history.
- Before any screenshot or paste into an issue, a blog post or a chat, strip
  names and addresses.

---

## Before the first push, run this

```bash
# anything that looks like a key
git grep -nE "(api[_-]?key|secret|token|password)\s*[:=]" -- . ':!*.example.*'

# phone numbers
git grep -nE "\+[0-9]{1,3}[ -]?[0-9]{2,4}[ -]?[0-9]{3,4}[ -]?[0-9]{3,4}"

# email addresses that are not obviously placeholders
git grep -nE "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}" \
  | grep -viE "example|placeholder|your-|noreply|@anthropic"

# what you are actually about to publish
git ls-files | grep -E "profile/(profile|resume)\.json|tracker\.json|^applications/"
```

That last command should print **nothing** for a public repo. If it prints
anything, stop and fix `.gitignore` before pushing. A file that has already
been committed is not removed by adding it to `.gitignore`; it stays in the
history and has to be purged with `git filter-repo` or by starting the history
again.

---

## If you already pushed something

Assume it has been indexed and copied. In order:

1. Rotate any key or token immediately. Removing a commit does not un-leak a
   secret.
2. Purge the file from history (`git filter-repo --path <file> --invert-paths`)
   and force-push. On GitHub, also delete the fork network or contact support,
   because cached views survive a force-push.
3. If it was someone else's personal data, tell them. It is the right thing and
   in some jurisdictions it is the required thing.

The cheaper path is the `git ls-files` check above, before the first push.
