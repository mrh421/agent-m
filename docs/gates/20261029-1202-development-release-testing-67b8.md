---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 7c450c3a9daf38bb50dfb3703254e475db0817f2
  - https://github.com/akmaier/agent-m/pull/1446
  - docs/backlog/ITM-1180-the-specification-view-links-no-list-of-all-spec-change-entries.md@315a90ca0
date: 2026-10-29 12:02 UTC
---
# Development → Release testing: ITM-1180, the specification view links no list of all SPEC change entries

**REGISTER**

## Reason

ITM-1180, pull request #1446 into `sprint/team1/117`, passes on `7c450c3a`, its head when this was decided. The item is
read as edited at its stop (`team1/117.md`, "ITM-1180's stop").

The Definition of Done is the default (SPEC.md:1869-1874).

1. **CI is green.** Run 40869462910, `pull_request`, on `7c450c3a` passes 38 of 38 pull-request jobs.
2. **Red first.** The tests-only commit `31220c66` is red in run 40868137083. There fail:
   - TST-878003 and TST-360002, the two expectations the Acceptance names, for the item's reason;
   - TST-1285301, the pinned lines ruled at the stop;
   - the ✖ of ITM-133 in `release-sprint-02-a-dashboard-app`, a `todo`, not a failure.
   - The implementation commit `c469f427` changes only `src/trace-pages/flow.mjs`, and no test.
3. **The changed expectations are the ones the Acceptance names, in the tests-only commit, and none is weakened.**
   - TST-878003 (`trace-pages-waiting-changes`) asserts that the link "All SPEC change entries" is gone, and that no
     anchor leads to `#spec-entry`.
     - Its known positives are the history link and *Arrange*.
     - Its counter-proof is the waiting entry's own link, which stays.
     - At the tag it still asserts none of the links.
   - TST-360002 (`trace-pages-edit-links:110`) counts nine anchors where it counted ten, and names them.
4. **The release test is changed as ruled.** `7c450c3a`, by developer-sonnet-l, who implemented none of this item,
   changes only `tests/release-itm-1285-backquote-in-string-real-files.test.mjs`:
   - TST-1285301 asserts that the oracle `firstLinesOf` finds the six identifiers in order, and that the reader's
     `[id, line]` equal the oracle's.
   - Its known positive and its planted fault stay, and the planted fault is shown failing in the pull request.
5. **Only its modules change.**
   - Code: `src/trace-pages/flow.mjs`, where `specChangeLinks` loses one `reviewLink` and its comment says so.
   - Tests: `trace-pages-waiting-changes` and `trace-pages-edit-links` (MOD-trace-pages), and
     `release-itm-1285-backquote-in-string-real-files` (MOD-test-document, named by the item for that test alone).
   - No code of MOD-test-document changes, and no test is removed.
6. **The Outcome is the accepted text.** MOD-trace-pages' specification row (MOD-trace-pages.md:131) gives the view:
   - first, the waiting entries' links;
   - *Edit*, *+ Requirement* and *Arrange*;
   - *History of SPEC changes*.
   - It gives no list of all entries. akmaier: "Keep as specified."
7. **The reader.** On `7c450c3a`:
   - **Known positive:** `tests/release-itm-1254-issue-move.test.mjs`, 4 declarations and 0 findings.
   - `trace-pages-waiting-changes` 6, `trace-pages-edit-links` 8, `release-itm-1285-backquote-in-string-real-files` 4.
   - All with 0 findings. `test-document-one-line` passes.

## Noted

- **The class of the removed link stays in the frame's style.** `src/site-frame/look.css:76` still names
  `spec-entries-link`, which no page draws any more; a search of `src/` and `tests/` finds only that line. It is
  MOD-site-frame's, outside the item, and registered as **ITM-1310**.
