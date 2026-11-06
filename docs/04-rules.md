# 04 · Standing rules

Two kinds of rule live in this repo. The first kind is not yours to change. The
second kind is the whole point of the system.

---

## Part 1 — the honesty rules

These are built into the agent definition and the engine. They are not
preferences and the agent will not be argued out of them.

### Never invent a fact

`profile/resume.json` is the only thing the agent may say about you. Tailoring
means **selecting, reordering and rephrasing** facts that are already there.
If a posting wants React Native, GraphQL or eight years and you do not have
it, that is a **gap**: it goes in the gap list, it gets addressed honestly in
the letter as adjacent experience, and it never appears on the CV.

This is not squeamishness. Fabrication on a job application is fraud, it
unravels in the first technical interview, and in a small market it follows you
around.

### Mirror the posting's vocabulary, never its claims

If the posting says MVI and your bullet says MVVM, **do not swap them**. That
changes the fact. If the posting says "declarative UI" and you used Jetpack
Compose, then leading with "Jetpack Compose (declarative UI)" is fair, because
it is the same fact in their words.

### Name your gaps in the first paragraph

Every application this system has sent states its own weak points early, in
plain words, and invites a fast no. That sounds like self-sabotage and is the
opposite: it is what recruiters reply to, it saves everyone a wasted screen,
and it is the only thing separating "tailoring" from lying.

A real example, sent to a staffing firm whose first listed requirement was
cross-platform experience in Xamarin and PhoneGap:

> Let me start with the two places where I do not match, since both sit in your
> skill set list. Your first line asks for cross-platform experience like
> Xamarin and PhoneGap. I have neither. My cross-platform work is Flutter with
> Bloc [...] Second, you ask for 5+ years and I have 4 years and 7 months.
> Five months short.

### Never claim an attachment that is not there

If the tooling cannot attach your CV, the email says so plainly and offers the
file on reply, or pastes the CV as text below the signature. A draft that says
"CV attached" with nothing attached is worse than no email.

### Stop at a CAPTCHA, a login, an account, or someone else's terms

Absolute. See [02-portal-access.md](02-portal-access.md), tier 3.

### Do not mass-apply

Capped by `preferences.maxApplicationsPerDay`. Recruiting markets are small and
spraying near-identical applications is visible from the other side. Two
near-identical roles at the same employer get **one** application, not two,
because applying to both reads as scattershot.

### Record the reasoning, not just the outcome

Every status change in `tracker.json` carries a note saying what was decided
and why. This is the part people skip and it is the part that compounds. The
tracker is the reason the agent can tell you in week six why it skipped a
company in week two, and the reason it does not ask you the same question
twice.

---

## Part 2 — your own standing rules

This is where the system gets good. Every time you answer a question the agent
could not have known, that answer becomes a rule, and the rule goes in
`profile/profile.json` **with its date and its reason**.

An answer given in chat is gone when the chat is. An answer in the file is
permanent.

### What a good rule looks like

Not this:

> Skip Sharjah.

This:

> `excludeLocations: ["Sharjah"]`, `excludeLocationsReason: "2026-09-22:
> listings are largely low quality or scam. Exception: Marc Ellis, who is a
> legitimate agency."`

The date tells you how stale it is. The reason lets you overturn it on purpose
rather than by forgetting. The exception stops the rule being too blunt.

### Real rules from the original run, as examples of the shape

- **The local-advantage rule.** "Already resident, no relocation needed" is
  worth a lot in one country and reads as carelessness in every other. Tagged
  to one country, never emitted outside it.
- **The data-depth rule.** SQL and PostgreSQL may be listed as skills. Schema
  design, migration authorship, constraint design and query tuning may never
  be claimed. Written down after a specific conversation about what the
  candidate had actually done, and it has since kept a dozen applications
  honest where "data modelling" was a named deliverable.
- **The grade rule.** Never claim a title above what was really held, and never
  a team larger than three. Added after a review found 24 Senior-titled
  applications had returned zero interviews.
- **The one-number rule.** Where a form demands a single salary integer rather
  than a range, enter the top of the band. Decided once, applied fifty times,
  never asked again.
- **The contract rule.** A freelance or sub-six-month posting is worth applying
  to **only if** the posting says the role is remote **or** says extension is
  possible. Without this the agent either skipped good contract work or
  surfaced every three-month onsite gig.
- **The writing rules.** No em dashes, ever. No HTML underline tags. Keep
  LinkedIn messages under about 700 characters. Trivial-looking, and they are
  what stops the output reading as generated.
- **The send rule.** Whether email goes out directly or waits for your
  approval. Decide it explicitly; see below.

### The one rule to think hardest about

**Does outbound email send directly, or wait for you?**

Both answers are defensible. An undecided answer is not, and this is the rule
that cost the original search the most.

With a review gate in place, five written emails sat unsent for between nine
days and five and a half weeks. One posting expired while its application was
staged and ready. The applications were not weak; nobody had said go. When the
gate was lifted the backlog went out in a single pass, including a question
that had been waiting 38 days to be asked.

If you keep the gate, put a deadline on your own reviewing. If you lift it, say
so in the file, and keep the narrow exception: the agent still asks before
naming a number that is genuinely yours to choose and that no standing rule
covers.

---

## How to add a rule

Say it to the agent and ask for it to be written down. Or edit
`profile/profile.json` yourself; nothing in there is generated, it is all
hand-written prose organised by topic. Use a leading underscore for a rule
rather than a fact, which is the convention the example file follows:
`_freelanceRule`, `_nonLocalRelocationRule`, `_singleNumberRule`.

Then check it took effect. A rule that the agent cannot see is worse than no
rule, because you will assume it is being applied.
