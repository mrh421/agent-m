---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 9e22bedacc7bf4138f86d9913cbf4a9a43eabcf5
  - https://github.com/akmaier/agent-m/pull/1603
date: 2026-11-01 06:13 UTC
---
# Development → Release testing: ITM-779, #1603

**REGISTER**

## Reason

ITM-779 (a process model is adapted or created, validated while typed, and saved) may go on to release testing. The pull
request is #1603 into `sprint/team1/141`, at `9e22bedac`, by developer-opus-e (`Agent-M-Participant` on every commit). I
wrote none of it.
1. **The first commit holds only tests and is red for the item's reason:** `b942ae659` changes only
   `tests/implementation-pages-models.test.mjs`. In run 41277785420 (pull_request) TST-779001 to TST-779013 fail. The
   rework's tests-only commit `64ec0d33e` is red in run 41278388806, on TST-779014 and TST-779015 alone. The code follows
   in `18c580e29`, `77f569b06` and `9e22bedac`.
2. **CI is green on the head:** run 41278581946 (pull_request, `9e22bedac`), at the first attempt.
3. **Only the item's module changes.** The net diff against the sprint branch touches
   `src/implementation-pages/index.mjs`, `src/implementation-pages/process.mjs` and
   `tests/implementation-pages-models.test.mjs`, a test that names MOD-implementation-pages. `docs/index.html` (from
   MOD-site-frame's generator) was written in `b4aa3ee49` and written back in `77f569b06`, so the net diff leaves it
   unchanged: the entries `models` and `process` stay at 16 modules each. TST-779015 guards this.
4. **The Acceptance holds:**
   - *Save* is unavailable while a finding is an error (TST-779004, TST-779006).
   - A saved model is a file of the model schema with `adapted_from`, which `catalogue` reads back (TST-779001, TST-779005,
     TST-779008).
   - The counter-proofs are recorded in the pull request.

## The readings, ruled

- **TST-779014's text was narrowed after its red commit.** In `77f569b06` the needle changed from "the column Condition"
  to "the column Condition is required". The expectation stays the same: the finding is shown exactly once. The shorter
  needle also matched the finding's fix, which names the column too. So the old text counted 2 even when the page was
  right. The new needle is the finding's own words, and without the filter it still counts 2 (the counter-proof in the
  pull request). That corrects the case's text and weakens no counter-proof. Allowed.
- **`documentFindings` is imported from MOD-documents.** MOD-implementation-pages' Uses name MOD-documents
  (MOD-implementation-pages.md:29-32), but not this function. `documentFindings` is in MOD-documents' interface
  (MOD-documents.md:24), so DEVELOP AGAINST INTERFACES holds. The Uses are read at the level of the module, as TST-106805
  reads them (green on the head). Taken.
- **MOD-progress-measures is imported by a relative `import()`** on the preview's first pick, so only the preview loads
  it. NO SERVER needs no entry for it, as ruled at ITM-1345's gate
  (`docs/gates/20261101-0536-development-release-testing-1345.md`). This replaces the planning's line "it adds no
  `import()`" (141.md, *Readings taken*). `productFacts` is among the Uses (MOD-implementation-pages.md:63). Taken.
- **`productFacts` with scope `all`.** The scope `work` holds no requirements, and the preview needs every accepted
  requirement (MOD-implementation-pages.md:157-161). Taken.
- **UC-031 4a:** *Discard* is offered, and the draft is kept on the screen only. The module's Uses name no write to the
  browser's store (141.md, *Readings taken*). This is noted for akmaier as a gap of the architecture. It blocks nothing.

## Next

developer-sonnet-l writes the release tests in a file of their own, from the pushed code. developer-sonnet-l built none of
UC-031's items (141.md, *Readings taken*).
