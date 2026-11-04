---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 330a6d7bd35eb1ba2d35f618b6851b0ddabfe5c0
  - https://github.com/akmaier/agent-m/pull/1494
date: 2026-10-30 05:02 UTC
---
# Development → Release testing: ITM-1190, the Jobs page holds what waits for a person, and the main page links it

**REGISTER**

## Reason

ITM-1190, pull request #1494 into `sprint/team1/124`, passes on `330a6d7b`, its head when this was decided.

The condition is "CI is green on it and the Definition of Done holds" (`docs/process-models/scrum-wip.md:53`). The
Definition of Done is the default (SPEC.md:1869-1874).

1. **CI.**
   - **Tests-only commit `f1c0985e`:** run 41003676717 fails, only on the item's new and changed cases:
     - TST-1190001 to TST-1190004;
     - TST-827004, 827009, 847005, 943001 and 943007 of `main-page-home`;
     - TST-1280004;
     - TST-904002 and TST-905001, for `/`;
     - `test_main_page`'s `test_what_waits_for_a_person_is_listed_with_the_page_where_it_is_decided`.
     That is the item's reason: what waits is still on `home`, and `jobs` reads no overview.
   - **Implementation commit `8174fd0d`:** run 41003808908 fails only on TST-1280305 and TST-1280306. Those are
     developer-sonnet-l's release cases, whose fixtures served no overview. The rest of its failures are `# FINDING` todo
     marks that fail alike on the base.
   - **Head `330a6d7b`,** developer-sonnet-l's commit, which changes only `tests/release-itm-1280-jobs-list-batches.test.mjs`:
     run 41004124294.
     - Attempt 1 failed only on TST-291007 of `tests/mod-desktop-shell-settings.test.mjs`, a file the item does not
       touch.
     - Attempt 2 on the same commit is green.
     - Two outcomes on one commit make TST-291007 a flaky test (A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY), not a
       failure of this item.
2. **Only the item's files change.**
   - `src/main-page/home.mjs`, `jobs.mjs` and `waits.mjs`, all MOD-main-page's.
     - `home` draws the button *Jobs*, which calls `go("jobs")`, and no list of what waits.
     - `jobs` draws what waits, then the list. It reads each source's list through `waits.mjs`'s `waitingOf`: the overview
       stored for the head, else the one stored last, else `waitingForAPerson` of the scope `all`. That reads through the
       head the route has read already.
     - `storedOf` is the one reading of the stored overview, which the cards of `home` now call too, so the rule stands
       once.
   - The tests the planning run named: `main-page-home`, `main-page-jobs`, `main-page-jobs-reads`,
     `site-usability.d/routes.mjs` (the text `/` shows, for TST-904002 and TST-905001), `test_main_page.py`, and the new
     `tests/main-page-jobs-waits.test.mjs`.
   - The release file, changed in a commit of its own by developer-sonnet-l, who implemented none of the item
     (SPEC.md:1537-1541).
   - The developer counted 19 Node cases, not the planning run's 20. `main-page-jobs-explanations` still passes: its
     fixture refuses the overview read, and the page then names the source as unreadable, which that test does not check.
     No other test changed beyond the plan's list.
3. **No expectation is weakened.**
   - **TST-1280004** keeps its batches and its one listing of runs per repository. Its fixture now stores each head's
     overview, and it gains two assertions: one read of `<head>.json` per repository, and no listing of pull requests.
   - **TST-1280305 and TST-1280306** change only in `given` and in the world, `listWorld`, which gives each repository the
     overview of its head with nothing waiting. Their batch and state expectations are unchanged.
   - **`main-page-jobs`:** its fixtures store each head's overview, so what waits costs one request there. Each case
     keeps its expectations.
   - **`test_main_page`:** now asserts the item on the route `jobs` ("use case: UC-002 · alice/product"), and that `home`
     lists none.
   - **The cases of `home`** move. TST-827004 now asserts the link *Jobs* and no list. TST-827011, each item's *Open*
     calling `go`, is removed. It guarded THE MAIN PAGE SHOWS WHAT GOES ON IN THE INSTANCE and UC-046, and TST-1190003
     keeps guarding both on `jobs`, with the same three kinds of item and the same calls of `go`.
4. **It builds the item's Acceptance.**
   - "`home` draws the link *Jobs*, and no list of what waits": TST-827004.
   - "`jobs` draws what waits above the list of jobs, each item with its link … with and without a stored overview":
     TST-1190001 with none stored, TST-1190002 with stored ones, and TST-1190003 for the links.
   - "Counter-proof: a product with nothing waiting adds no entry": TST-1190001.
   - The tests that pinned what waits on the main page are named, as listed above. No new kind of waiting thing, and no
     route beyond `jobs`.
   - It uses only MOD-progress-measures' `storedOverview`, `latestOverview`, `waitingForAPerson` and `productFacts`,
     which MOD-main-page's Uses name (MOD-main-page.md:19-26). No interface changes.
5. **The readings are those the item records.**
   - "Across the instance" is the instance and each kept product, each read as its card on `home` reads it.
   - *Jobs* is a button calling `go`, as *+ Add product* is.
   - A source whose list cannot be read is named above the list (TST-1190004), as the route names an unreadable source.
6. **Reads, against the planning count.** TST-1190002 counts the reads of `overview-cache` per repository:
   - one, `<head>.json`, where the head's overview is stored;
   - two more, `latest.json` and the older commit's, where only an earlier one is;
   - the scope `all` where none is: the instance, which lists its pull requests once.
   That is the planning count, line for line. TST-1280004 shows that a stored overview costs one request per repository
   and lists no pull request.
7. **Counter-proofs, made on the head and restored after.**
   - Taking out the section of what waits from `jobs` fails all four cases of `main-page-jobs-waits`.
   - Letting `waitingOf` pass over the stored overview, so that it always derives, fails TST-1190002 and TST-1280004.
   - Restored, 5 of 5 pass.
8. **MOD-test-document's reader:**
   - `main-page-jobs-waits`: 4 declarations, 0 findings.
   - `main-page-home`: 41 declarations, 0 findings.
   - `main-page-jobs`: 13 declarations, 0 findings.
   - `main-page-jobs-reads`: 1 declaration, 0 findings.
   - `release-itm-1280-jobs-list-batches`: 7 declarations, 0 findings.
   - No header has a finding.
   - The control, `tests/release-itm-1254-issue-move.test.mjs`: 4 declarations, 0 findings.
   - Each value stands on one line, and `tests/test-document-one-line.test.mjs` passes. The new declarations' `given`,
     `input` and `expect` are those of `tests/main-page-jobs-waits.test.mjs:50-134`, as the reader reads them.
9. **Locally on the head:** the five main-page files, the release file and `test-document-one-line` give 70 pass, 0 fail.

## Noted

- TST-291007 (`tests/mod-desktop-shell-settings.test.mjs`) flipped on `330a6d7b`. The Scrum Master notes it at the close.
- The section of what waits stands under the heading "Every job", after a source named unreadable. MOD-main-page's `jobs`
  gives "first, what waits … then every job". The order of the two is kept; the heading above both is the page's wording.
- `main-page-jobs-explanations` passes with its overview read refused. It checks no unreadable line, so it does not show
  the extra one.
