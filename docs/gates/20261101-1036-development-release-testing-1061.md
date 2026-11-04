---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - c69b63ade864bb2ea7ee4cc4eef026af41c885e8
  - https://github.com/akmaier/agent-m/pull/1650
date: 2026-11-01 10:36 UTC
---
# Development → Release testing: ITM-1061, #1650, the system and release tests of UC-045

**REGISTER**

## Reason

ITM-1061 was written by developer-sonnet-j (`Agent-M-Participant` on `1f8d6433b` and `c69b63ade`). By the developer's
reading of the trailers, UC-045's code was built by opus-a, opus-e, opus-f, sonnet-e and sonnet-k, never sonnet-j. I wrote
none of it.
1. **No failing first commit:** a battery adds no behaviour (141.md, *Readings taken*).
2. **CI is green on the head:** run 41297857744 (`c69b63ade`), at the first attempt. `git merge-tree` with the sprint
   branch's head is clean.
3. **Only new test files:**
   - `tests/uc-045-harness.mjs`;
   - `tests/system-uc-045-plan-the-implementation.test.mjs`;
   - `tests/release-uc-045-plan-the-implementation.test.mjs`;
   - `tests/test_implementation_plan.py` with `tests/test_implementation_plan.md`, and `tests/test_plan_layout.py`, the
     checks SPEC.md names for `AN IMPLEMENTATION PLAN ASSEMBLES THE SYSTEM FROM ITS MODULES`, `A PLAN STEP NAMES THE TESTS
     OF ITS LEVEL` and `THE IMPLEMENTATION PLAN LIVES IN THE PRODUCT REPOSITORY`.
4. **MOD-test-document's reader:**
   - `testDeclarations` reads 22 system cases (TST-1061001 to 1061022), 20 release cases (TST-1061100 to 1061119), and
     2 each in the two Python files (TST-1061201, 202, 301, 302). Each case of level `system` or `release` declares
     `module: system`, and `testFindings` reports none.
   - `testHeader` gives MOD-implementation-pages and MOD-work-plans for every file, with no finding.
5. **The Acceptance holds:**
   - Every requirement UC-045 realises has a release case (TST-1061100 maps them).
   - The system file walks the main flow and the alternative flows. Its four `todo`s are the findings below.
   - The pull request records a planted fault for every case that is not a `todo`.

## Findings, ruled

Each is registered in this commit.
- **UC045-F1 (TST-1061004) → ITM-1367 (MOD-work-plans).** The recipe `architecture-and-model` sends `docs/process.md`
  and not the model's phases and gates, which MOD-work-plans.md:264-265 gives it. It is a defect against accepted texts.
- **UC045-F2 (TST-1061019) and UC045-F4 (TST-1061022) → ITM-1368 (MOD-implementation-pages).**
  - F4: a step written by hand with an empty level or phase ends in a `TypeError` or a raw `DocumentError`. `savePlan`
    checks with `planFindings` first (MOD-work-plans.md:215-217), so this is a defect.
  - F2: UC-045 3a links a cycle to the change of the architecture, and the `plan` route draws the finding as text only.
  - Both concern how the plan page shows the findings of a plan, so they make one item.
- **UC045-F3 (TST-1061021) → ITM-1369 (MOD-work-plans).** The SPEC's rule states the order modules, integrations, system,
  and `planFindings` checks only the modules' order among themselves.

The reading for F2 and F3 is general: **where an accepted use case or the SPEC gives behaviour to a route or function
that an accepted module text already assigns to one module, and no text contradicts it, that module's item builds it.**
That the module text does not list the behaviour is noted for akmaier, and nothing waits on it. Where no module text
assigns the route or function, the item stays with akmaier, as ITM-1341 and ITM-1342 do.

- **The declarations of 13 test files → ITM-1370.** They are written `TST-<nnn> - level: … - module: …`, and MOD-test-
  document's reader takes the ` · ` form (MOD-test-document.md:42-53). So it reads none of their 32 cases. The reader reads
  0 cases in `tests/test_job_preconditions.py` and `tests/test_no_history.py`, and 3 in `tests/test_architecture_review.py`,
  the known positive. The reader keeps its one documented form. The files take it, with the modules of their headers
  named for those tests only.

## Not findings

- The explanation topics `plan-draft`, `plan-save` and `plan-step-states` are drawn by no route, and UC-045 1d's second
  sentence names no page behaviour. Neither is behaviour a use case asks of a page. Noted.

## Readings taken

- The state label, as the pull request reads it.
- 1b and 3a link to `#arc`.
- 1d "under its name" is the commit's trailers.
- "Written anywhere else" (`THE IMPLEMENTATION PLAN LIVES IN THE PRODUCT REPOSITORY`) is another folder of the product, and
  the instance's repository.
- `RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER` is covered by the plan's system step, which names system and release
  tests.
- The harness holds the product and the instance as separate fake repositories.

All are taken.
