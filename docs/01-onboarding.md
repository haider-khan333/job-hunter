# 01 · Onboarding

**The agent is useless until it knows who you are.** This document is both the
checklist for you and the script the agent follows when you say
`read docs/01-onboarding.md and interview me`.

Do not skip to the search. A watcher tuned to the wrong years of experience
will bury the roles you can actually win underneath the ones you cannot, and
you will conclude the market is empty when it is your config that is wrong.

---

## The interview

If you are the agent reading this: ask these in order, one at a time, in
plain language. Write each answer into the file named beside it, **with the
date you were told and the reason if one was given.** Do not ask a question
whose answer is already in the files. Do not invent an answer to move on; a
blank field is recoverable, a wrong salary figure in a sent email is not.

### Block 1 — Identity and reachability → `profile/profile.json`

1. Full name as it should appear on a CV.
2. Email and phone you want on applications. A second number if you have one.
3. LinkedIn URL. GitHub only if it holds work a stranger should read.
4. City and country you are in **right now**.

### Block 2 — Work authorisation → `profile/profile.json`

This block decides which countries are worth searching at all, so it comes
before anything about skills.

5. Citizenship.
6. Where can you work **without** a new visa?
7. Where would you need sponsorship, and are you willing to go through it?
8. Visa type and expiry if you are on one. Passport expiry, exact day.
9. Notice period. Be real: "immediate" and "three months" produce different
   searches.

> **The single most expensive mistake this system can make** is carrying a
> local advantage into a foreign application. "Already resident, no permit
> needed" is worth a great deal in the country you are resident in and reads as
> carelessness everywhere else. Record which country it applies to, in
> `location._nonLocalRelocationRule`, and it will never leak.

### Block 3 — Experience, precisely → `profile/resume.json` and `config/search.config.mjs`

10. **Total professional experience in years and months.** Not "about five".
    The exact figure, because it goes into `yearsExperience` and it is the
    filter that drops more roles than every missing technology combined.
11. Current title and employer. Then, going back: every role, with real start
    and end months.
12. For each role, what did you actually build? Push for specifics and numbers.
    "Worked on the mobile app" is not a bullet. "Built an offline-first sync
    system with Room and WorkManager that kept the app usable for 2,000+ field
    users with no connectivity" is.
13. Degree, institution, year.
14. Anything public a stranger can click: a live site, a shipped app in a
    store, a repository worth reading. **Verify it returns 200 before it goes
    on a CV.** A dead portfolio link is worse than no link.

### Block 4 — Skills, graded honestly → `config/skills.config.mjs`

15. Go through the taxonomy in `scripts/lib/keywords.mjs` and grade every
    skill: **STRONG** (you would be comfortable in an hour-long interview on
    it), **HAVE** (shipped something, not an expert), **GAP** (not yours).
16. Push back on inflation. If everything is STRONG, nothing ranks, and the
    score becomes noise. Ask: "could you be interviewed on this for an hour by
    someone who does it daily?"
17. Ask specifically about the lines people blur, because these are the ones
    that come apart in an interview:
    - **Databases.** Using PostgreSQL daily is not owning schema design,
      migrations, constraints or query tuning. If you have only consumed a
      schema someone else designed, that is a GAP, and the agent will list SQL
      as a skill while never claiming design ownership.
    - **Leadership.** How many people, actually? Were you their manager or
      their most senior engineer? Those are different claims and a reference
      check tells them apart.
    - **Cloud.** EC2 and S3 is not "AWS". Name the services.
    - **Testing.** Most CVs claim it. Can you name the framework you used?

### Block 5 — Money → `profile/profile.json`

18. What do you earn now, and separately: what are you willing to **disclose**
    when a form demands a current figure?
19. What do you want? One range per currency you will apply in.
20. **Many forms reject a range and demand one integer.** Which end do you
    enter? Decide now, in writing, so it is never guessed at submit time.
21. What does the market actually pay for your years in your city? Fill this
    in from real adverts. It is the only thing that stops you asking under the
    market by accident.
22. If you are applying anywhere with a visa salary floor (the German Blue
    Card, for one), any figure you name must clear it or the sponsorship cannot
    happen at all.

> Salary is the one field that cannot be renegotiated upward after submission.
> Anything you have not decided stays as `CONFIRM` and the agent surfaces it
> instead of filling it.

### Block 6 — Scope of the search → `config/search.config.mjs`

23. Which job titles are you actually going for? Be specific; "software" is not
    a target.
24. Which countries or regions? Only ones you can be hired in.
25. Remote: are you open to it, and can you legally work for a company in
    another country from where you sit?
26. Anything to exclude outright, and why. Locations, industries, employer
    types. **Record the reason with the date**, or in two months you will
    re-litigate a decision you cannot remember making.
27. Contract and freelance postings: in or out, and under what conditions?
    Without a rule the agent either skips good contract work or floods you
    with three-month onsite gigs. The original rule: worth it only if the
    posting says remote **or** says extension is possible.
28. Grade. Are you targeting mid-level, senior, or lead? Read
    `strategy.titleGrade` in the example profile before answering: 24 Senior
    applications against 4y7m of experience returned zero interviews.

### Block 7 — Voice → `profile/profile.json`

29. Do you want to read every email before it sends, or should the agent send
    them? **Decide this explicitly.** In the original run the review gate was
    the bottleneck: five emails sat unsent for up to five and a half weeks and
    one posting expired while waiting. Both answers are defensible; an
    undecided answer is not.
30. Any writing rules? The original had two hard ones: no em dashes, ever, and
    no HTML underline tags. Add your own. Anything that reads as generated gets
    ignored, so this matters more than it sounds.

---

## When the interview is done

Write it all down, then prove the config is live rather than assumed:

```bash
node scripts/test-title-filter.mjs
node scripts/test-stack-veto.mjs
node scripts/watch.mjs --hours 24 --no-ats
```

Read the digest it prints and check three things:

- Are the **titles** roles you would actually take? If not, the title filters
  in `scripts/watch.mjs` need editing, not the score.
- Is the **years bar** labelling things correctly against your real number?
- Are the **"why the rest were dropped"** reasons ones you agree with? That
  list is the most useful output of the first run, because it shows you the
  filter working rather than the filter's conclusion.

Then build one CV and look at it as a stranger would:

```bash
node scripts/build.mjs applications/example-android-role
```

If the PDF says something you would not defend in an interview, fix
`profile/resume.json` now. Everything downstream is generated from it.

---

## What to do when the agent asks you something

It will. Roughly one application in four hits a question no rule covers: a
consent checkbox that is a privacy decision, a form demanding a number you
have not chosen, a posting that wants a cover letter in a language you do not
speak. That is the system working rather than failing.

Answer it **in the file, not in the chat**, or at least ask the agent to record
it. An answer given in a conversation is gone when the conversation is. An
answer written into `profile/profile.json` with its date and reason is the
difference between a search that accumulates judgement and one that asks you
the same thing every week.
