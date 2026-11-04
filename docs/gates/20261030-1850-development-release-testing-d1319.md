---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 20a7a9c16c35c8459017f144649f74aae7554449
  - https://github.com/akmaier/agent-m/pull/1531
date: 2026-10-30 18:50 UTC
---
# Development → Release testing: ITM-1319, accepting a use case puts the modules it changes into the backlog

**REGISTER**

## Reason

ITM-1319, pull request #1531 into `sprint/team1/128`, passes on `20a7a9c1`, its head when this was decided.

The condition is "CI is green on it and the Definition of Done holds" (`docs/process-models/scrum-wip.md:53`). The gate
was rejected at `9e9c87e9` (`docs/gates/20261030-1832-development-release-testing-d1319r.md`). One load of a page of use
cases in a pulled product read its commit three times and its tree twice, against A PAGE LOAD READS THE REPOSITORY IN
BATCHES (SPEC.md:684-687). Everything else read there stands. This decision reads what changed since then.

1. **What changed since `9e9c87e9`.**
   - `c712487e`: a merge of `sprint/team1/128`, which keeps both rows of the stated table in `tests/job-catalogue.test.mjs`,
     ITM-1318's and this item's.
   - `5ef48dac` and `5b9904cb`: tests only. They add TST-1319007 to `tests/load-per-view.test.mjs` and change the folders
     the use-case pages are expected to read.
   - `20a7a9c1`: the fix, in `src/review-pages/affected-modules.mjs` and `kinds.mjs`.
   - All are developer-opus-e's.
2. **CI.**
   - **`5ef48dac`:** run 41108679138 fails in one job. Its only failing cases are three of `load-per-view`: the new
     TST-1319007, and the two folder lists, of `#use-case` and of the start page.
   - **`5b9904cb`:** run 41108878552 fails on the same three cases. That is the finding's reason.
   - **Head `20a7a9c1`:** run 41109697454 (`pull_request`, attempt 1) succeeds: 41 jobs succeed, 17 are skipped, none
     failed.
3. **The reason of the rejection is gone.**
   - **The fix:**
     - At the draw, `affectedCheck` reads only the page's own snapshot, and for a product page the instance at its
       default branch.
     - It reads `docs/process.md`, `SPEC.md`, the architecture and the register with `readMany`.
     - `instanceAt` gives the instance at hand when `model_version` is its commit.
     - Without `docs/process.md` it reads nothing.
     - `wholeHost` is left only for the jobs the click runs.
   - **The same count as at the rejection,** with the same probe: the counting fake of `load-per-view`, the fixture with a
     `scrum-wip` declaration at the fixture's commit, in an export of the head.
     - `#use-case`: 8 requests. That is the commit once, the folders once, no tree, the repository's information once, and
       the batches of 2, 1, 1, 1 and 7. At `9e9c87e9` it was 11, with 3 commits and 2 trees.
     - `#use-case/id=UC-002` and `#use-case/id=all`: 13 requests each, with the commit once and no tree. At `9e9c87e9` it was
       16 each.
     - No file is read by itself beyond what the base reads by itself. The base's file and history reads of
       `#use-case/id=UC-002` stand as they were.
     - Known positive: without the declaration, the head sends what the base sends, 4, 9 and 9.
   - **TST-1319007** asserts this. For each of the three pages, the pulled product sends the commit, the tree, the folders
     and the repository's information as often as the product without a declaration, and the commit once. It reads
     `docs/process.md` and `SPEC.md` in batches and names checker-a beside *Accept*. Its known positive is the base's
     requests for the plain product.
4. **The two points raised.**
   - **The use-case pages name a larger folder list for every product:** `SPEC.md`, `docs/architecture`,
     `docs/process-models`, `src/model-catalogue` and `AGENTS.md`, beside `docs/process.md`.
     - The list is one request whatever it names. Without a declaration, the page reads no text of those folders, as the
       counts above show.
     - `release-itm-1266-review-folders` passes: every page still reads only within its folders. It holds.
   - **After *Accept*, the jobs read the whole tree at the head.** A job's input is the product whole
     (`wholeHost`, read from `dashboard-app.mjs:650`), after the person's click and outside the page's load. The requirement
     counts one load of a page; it holds.
5. **Noted, not a condition.** The draw's reads stand in three batches of one file each beside the batch of 7: the
   declaration, the `SPEC.md`, then the model file, each needed before the next is known. Each is a batch of at most 100
   files, as the requirement asks.
6. **MOD-test-document's reader:**
   - `tests/load-per-view.test.mjs`: 12 declarations, 0 findings. Its header gives MOD-site-frame, level `component`.
   - `tests/review-pages-affected-modules.test.mjs`: 3 declarations, 0 findings.
   - The control, `tests/release-itm-1254-issue-move.test.mjs`: 4 declarations, 0 findings.
   - TST-1319007 is free in the history (`team1/128.md`).
   - In an export of the head, `load-per-view`, `review-pages-affected-modules` and `release-itm-1266-review-folders` pass:
     34 cases, 0 fail.
7. **Read at `9e9c87e9`, and unchanged** (`…-d1319r.md`, "Read, and holding"): the commits' order, the kind with its own
   schema, the step, the pull request's readings, and `startRecord` and `loadStage` within the module.
