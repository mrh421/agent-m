---
id: ITM-857
title: A not-ended CI job's state is read without listing every run
level: unit
realises:
  - A PAGE LOAD READS THE REPOSITORY IN BATCHES
modules:
  - MOD-runtimes
  - MOD-main-page
builds_on:
  - ITM-847
tests:
  - unit
origin:
  - ITM-847's draft stop (sprint team1/79), from developer-sonnet-e's findings
---
# ITM-857 A not-ended CI job's state is read without listing every run

**REGISTER**

## Outcome

The listing is done: MOD-runtimes' `liveStates` lists a repository's runs of the job workflow once for all its records
(MOD-runtimes.md:299-301, ITM-1280), and MOD-main-page asks it once per repository (`src/main-page/jobs.mjs:76-88`).

What is left is the note of ITM-847's gate (sprint team1/79): when the run listing meets a used-up limit, the route `jobs`
names it as a used-up limit, through `notice("rate-limit")`, which MOD-main-page's Uses name for "a used-up rate limit"
(MOD-main-page.md:168), and not as an unreachable runtime.

Measured on `main` at `91f10cb22`: with a host whose `listCiRuns` fails with `RateLimited`, `liveStates` gives each CI
record `reachable: false` with MOD-repository-hosts' text as its reason, "github.com's request limit for the account these
requests are made with is used up; it resets at …". The row shows it after "not reachable:". Known positive: an
`Unreachable` host gives the same state with its own text.

## Not ready: what the accepted text does not give

The route `jobs` meets the limit only inside a `LiveState`, and cannot tell it from an unreachable runtime there.
- MOD-runtimes.md:292: "A runtime that cannot be reached gives `reachable: false` and its reason, never an error".
- MOD-job-ledger.md:156: `LiveState` holds `reason: string | null`, a text and no kind.
- `AN INTERFACE STATES ITS TYPES` (SPEC.md:1327-1329) asks for "the errors its caller must handle", so `liveStates`
  cannot let `RateLimited` through unstated, and choosing the notice from the reason's words would read a kind out of a
  message.

No reading of these sentences gives the route the limit's kind. The row already names the limit and the time it resets,
and blames no token (`A USED-UP RATE LIMIT IS NAMED, NOT BLAMED ON THE TOKEN`); what a sentence would add is the notice in
place of "not reachable:".

## Acceptance

- With the run listing at a used-up limit, the route `jobs` shows `notice("rate-limit")` with MOD-repository-hosts'
  text, and no row says "not reachable" for it. Counter-proof: an unreachable runtime is still shown as not reachable.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
