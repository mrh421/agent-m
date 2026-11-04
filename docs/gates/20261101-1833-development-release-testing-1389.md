---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 8af25d7682057991ba994f5c5bcf35d77451200b
  - https://github.com/akmaier/agent-m/pull/1686
date: 2026-11-01 18:33 UTC
---
# Development → Release testing: ITM-1389, #1686

**REGISTER**

## Reason

ITM-1389 (a changed source is named on the drafting page) may go on. The pull request is #1686 into `sprint/team1/142`, at
`8af25d768`, with these commits (`Agent-M-Participant` on each):
- developer-opus-f: the tests-only commit `63f39ed4b`, the code `98b9542b8`, and `83d8a0a43`, a counter-proof added to its
  own case after the code;
- developer-sonnet-l: `7d22207be`, the lift of TST-579204's `todo`, and `8af25d768`, a change of release TST-1297301.

I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `63f39ed4b` changes
   `tests/review-pages-draft-requirements.test.mjs` (MOD-review-pages). In run 41327960738, apart from the `todo` cases that
   name a finding, three cases fail:
   - the new TST-1389001;
   - TST-1297301, whose fixed count of that file's declarations the new declaration moved (below);
   - TST-1240031 of `checkout-tools-bash`, which the commit does not touch and which passes on the head, counted below.
2. **CI is green on the head:** run 41329522146 (`8af25d768`), at attempt 2. Attempt 1 failed only TST-367004 of
   `desktop-shell-bridge-jobs`, which the pull request does not touch. `git merge-tree` with the sprint branch's head is
   clean.
3. **Only the item's module changes:** `src/review-pages/jobs.mjs`.
   - The requirements' drafting route gives the run panel a `problemOf`, which turns MOD-source-register's `HashMismatch`
     into "The content of <file> of <source> <version> changed: … Nothing is sent. A new version must be registered
     (UC-016)", linking `#library/source=<source>`.
   - Every other failure still goes to MOD-site-frame's `readProblem`, which does not change.
4. **The Acceptance holds:**
   - Four planted faults fail TST-1389001.
   - `83d8a0a43` adds the counter-proof that a failure other than a changed file is not named as one, which planted fault 3
     showed missing. It strengthens the case and weakens nothing.
   - TST-579204 loses its `todo` in sonnet-l's commit: red at `63f39ed4b`, green on `83d8a0a43`. sonnet-j wrote the case,
     and sonnet-l built none of the route.

## Ruled

- **TST-1297301** (`tests/release-itm-1297-dash-declarations-read.test.mjs`, release) held a copy of each file's number of
  declarations. One more declaration in `review-pages-draft-requirements` moved it, though no declaration of ITM-1297's
  form changed.
  - sonnet-l wrote that release file and built none of ITM-1297 (sonnet-j did). In a commit of its own, after the code, it
    reads the number from the file's own `// TST-` heads.
  - It keeps every assertion of the stated form, the 28 identifiers recovered, and the known positive and counter-proof.
    Its planted fault, one declaration dropped from the reader, fails 10 ≠ 11.
  - Read as the move of a release expectation by another participant after the code (the brief), not as a weakened
    counter-proof.
- **sonnet-l's reading of `SPEC.md` (lines 1-400) for that change.** AGENTS.md §1 asks an agent to read `SPEC.md` "in the
  original" and does not say "in full". The brief's "in full" is a team agreement. The change touches no sentence of the
  SPEC, and its content is checked here. It stands; the brief's agreement holds for the next change.

## Reading taken

- The `<k>/draft` route names a `HashMismatch` itself and links registering a new version. The words are opus-f's.
  MOD-review-pages assigns the route but not these words, which stays noted for akmaier (ITM-579's gate).

## Flips counted

- `desktop-shell-bridge-jobs` (TST-367004): first flip, in run 41329522146 at attempt 1.
- `checkout-tools-bash` (TST-1240031): first flip, in run 41327960738.
