---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - f3a85313d36f0002884db78f729abe3b5e501172
  - https://github.com/akmaier/agent-m/pull/1616
date: 2026-11-01 10:00 UTC
---
# Development → Release testing: ITM-614, #1616

**REGISTER**

## Reason

ITM-614 (the writer `plan-steps` saves a drafted plan through `savePlan`) may go on. The pull request is #1616 into
`sprint/team1/141`, at `f3a85313d`, by developer-opus-f (`Agent-M-Participant` on every commit). I wrote none of it.
1. **The tests come first, and both tests-only commits are red for the item's reason.** I read the failing lines of both
   runs.
   - `dd7912f4f`, run 41283498880, fails only:
     - TST-572006 and TST-572002 (`draft-plan` still meets UnknownStrategy);
     - "the kind draft-plan prepares with the recipe registered" (TST-610006);
     - the six new cases of `tests/work-plans-plan-steps.test.mjs` (TST-614001 to 614006).
   - `d5c1f068f`, run 41284445085, fails the same, plus "workStrategies — adds the check backlog-checks and changes no
     registration": the writers' list that the commit adds as a moved expectation.

   The code `f3a85313d` follows them.
2. **CI is green on the head:** run 41284709397 (pull_request, `f3a85313d`), at the first attempt. `git merge-tree` with
   the sprint branch's current head is clean.
3. **The item's modules and their tests.**
   - The code is in `src/work-plans/` only (`saves.mjs`, `strategies.mjs`, `index.mjs`). No code of MOD-site-frame or
     MOD-prompt-bar changes, and `preloads.mjs --check` passes.
   - The two tests of MOD-site-frame and MOD-prompt-bar that moved (TST-572006, TST-572002) are allowed by the item's
     modules (141.md, *The items set aside, read again*).
   - The two moved tests of MOD-work-plans are TST-610006 and the writers' list.
4. **The Acceptance holds.**
   - The writer `plan-steps` saves "the drafted plan through `savePlan`, with the job's provenance lines", and `savePlan`
     works as its interface gives it (MOD-work-plans.md:215, :284). TST-614001 to 614006 test this.
   - Counter-proofs: the red runs, and a drafted plan with an error finding refused with nothing written.

## The moved expectations, ruled

- **TST-572006 and TST-572002.** Their known positive was that `draft-plan` meets UnknownStrategy. With the writer
  registered, that no longer holds. The new known positive is a kind whose strategy no module offers: `decide-gate` →
  `gate-inputs`, which no module offers (MOD-job-catalogue). Allowed.
- **TST-610006** no longer registers its own stand-in `plan-steps`, since the module offers it now. Allowed.
- **The writers' list** of `workStrategies` gains `plan-steps`. Allowed.

## Readings, ruled

- **A step without an identifier is new, as in `saveItems`.** Taken.
- **The draft is the whole plan.** A step with the same title keeps its identifier, and a step the draft drops is removed.
  This is `savePlan`'s `removed` (MOD-work-plans.md:215). Taken.
- **A step's `realises` and `origin`** come from the `forced_by` of the decisions behind it, together with a module's own
  `realises`. Taken.
- **`plan-checks` now writes drafted steps with `writeDocument`,** shared with the writer, so a draft it cannot write
  becomes an error finding instead of a throw. The check still gives `planFindings` on the drafted plan
  (MOD-work-plans.md:275-276). A draft that cannot be written is now a finding that goes back to its participant (`A DRAFT
  THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT`) instead of ending the job. That stays within the module's text, and
  no existing expectation of the check changes. Allowed.
