---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: rejected
on:
  - 9cf8e9c910e5644acbd1b06fae5a17066510b03d
  - https://github.com/akmaier/agent-m/pull/1484
date: 2026-10-30 00:23 UTC
---
# Development → Release testing: ITM-987, closing a sprint adds the feedback's new items to the backlog

**REGISTER**

## Reason

ITM-987, pull request #1484 into `sprint/team1/123`, is returned on `9cf8e9c9`, its head when this was decided.
- Its new behaviour holds. But a close **without** new items now reads every item of the backlog, one request per file,
  where it read only the sprint's record before.
- My planning stand-in called the shared function only for a close with new items. No case of my run counts a close's
  reads, so the run did not show the difference. The rest holds, as listed below.

The condition is "CI is green on it and the Definition of Done holds" (`docs/process-models/scrum-wip.md:53`). The
Definition of Done is the default (SPEC.md:1869-1874).

1. **The open point: a close without new items reads the whole backlog.**
   - The path:
     - `src/work-plans/saves.mjs` `closeSprint` → `itemFiles(host, snapshot, { items: close.newItems ?? [], removed: [] }, …)`,
       called for every close.
     - → `itemFiles`: `staying` reads every held item (`snapshot.read(path)` for each path that `ITEM_FILE` matches), and
       `readDocument` parses each.
     - → `backlogFindings` runs over all of them. Its findings are filtered to the items of the change, and with none,
       nothing is kept.
   - My probe, on a fake host whose snapshot counts `read`s: a close with `newItems: []`, a sprint record and 50 items.
     - On the head: 51 reads, the record and all 50 items.
     - On `b65cefcc9`, the base: 1 read, the record.
     - The calls `readSnapshot`, `repositoryInfo` and `commitFiles` are the same.
   - Why this matters:
     - The writer `sprint-record` runs this close for an agent, in CI or on a Bridge.
     - A `read` that `readMany` did not name before is one request per file (MOD-repository-hosts.md:112-121, 198).
     - On this product's backlog of 1,073 items, every close would cost over a thousand requests that give nothing.
   - This goes beyond the item. Its Outcome changes the close **with** new items. The brief's YAGNI clause holds: "build only
     the accepted text and the item's Acceptance".
2. **What holds, checked by me on `9cf8e9c9`.**
   - **CI.**
     - Tests-only commit `fc7b594c`: run 40978289566 (`pull_request`, attempt 1) fails. Only `unit-pull-request (8)`
       fails, on TST-987001 and TST-987002, each with `NotSupported`, the item's reason.
     - TST-987003 passes there, as the check's own counter-proof.
     - Head: run 40978496152 (`pull_request`, attempt 1) succeeds, 58 jobs, 17 skipped, none failed.
   - **The first commit holds only the tests:** `tests/work-plans-close-new-items.test.mjs`. The second commit changes
     `src/work-plans/saves.mjs` and `src/work-plans/index.mjs`, MOD-work-plans' own files.
   - **No other module's file or test changes, and no expected result.**
   - **The interface stays as accepted.** `closeSprint` keeps `Promise<{ commit, written }>`, and `written` names the item
     files beside the record. `ItemsRefused { findings }` is among the errors MOD-work-plans.md:261-271 names.
   - **The developer's two readings are right.**
     - The counter-proof the Acceptance names can stand in the tests-only commit only as a case of the check: no code
       exists there to plant a fault into.
     - `saveItems`' warnings are not returned by `closeSprint`, whose type has no place for them.
   - **Counter-proofs made by me on the head, each restored after:**
     - Committing the items in a second `commitFiles` after the record's commit fails TST-987001. The check reads
       `[[record],[ITM-1401…, ITM-1402…]]`.
     - Skipping the `ItemsRefused` throw for an error finding fails TST-987002. A `DocumentError` comes out of the write
       in its place.
     - Restored, the file gives 3 pass, 0 fail.
   - **MOD-test-document's reader:**
     - `tests/work-plans-close-new-items.test.mjs` gives 3 declarations, 0 findings, and a header without findings.
     - The control, `tests/release-itm-1254-issue-move.test.mjs`, gives 4 declarations, 0 findings.
     - Each value stands on one line. Their `given`, `input` and `expect`, as the reader reads them:
       - **TST-987001** —
         - given: "team1's open sprint 01; the backlog's files ITM-001 and ITM-003, and a history that holds the withdrawn
           ITM-1400; a close with two feedback lines going to new items and two new items without an identifier, "Count
           the stored rows" and "Warn on a full store", both realising UC-032 and changing MOD-pages";
         - input: "closeSprint(host, the close, context at HEAD with the job's trailers)";
         - expect: "the inOneCommit check holds: one commit on main at HEAD of the sprint's record,
           docs/backlog/ITM-1401-count-the-stored-rows.md and docs/backlog/ITM-1402-warn-on-a-full-store.md; the record is
           only appended to, its ## Review first; each item file reads back with its identifier, ITM-1401 and ITM-1402,
           which no history holds; the history was asked for the default branch; repositoryInfo was asked once; the
           result is { commit, written } with written naming the three files".
       - **TST-987002** —
         - given: "team1's open sprint 01 and the same backlog; a close with two new items, "Count the stored rows"
           realising UC-032 and "Warn on a full store" realising nothing";
         - input: "closeSprint(host, the close, context at HEAD)";
         - expect: "refused with ItemsRefused, whose findings hold an error of the rule A BACKLOG ITEM NAMES WHAT IT
           REALISES saying that the item realises nothing; nothing is committed — neither the record nor the first item".
       - **TST-987003** —
         - given: "the commits a close makes, as commitFiles receives them: (a) one commit of the record and both item
           files; (b) the record in a first commit and both item files in a second";
         - input: "inOneCommit(commits, [the record, both item files]) on each";
         - expect: "(a) holds, the known positive; (b) fails — the counter-proof: a close that wrote the items in a second
           commit fails the one-commit check of TST-987001".
   - **Locally on the head:** the new file and `tests/test-document-one-line.test.mjs` give 5 pass, 0 fail.

## The mend

- A commit of tests of its own, red on its CI run: a case in `tests/work-plans-close-new-items.test.mjs` with its
  declaration on one line each. Its input is a close with `newItems: []` over a backlog of items. Its expectation is that
  the snapshot is asked to `read` the sprint's record and no item file, and that `readHistory` is not asked. Its known
  positive is TST-987001's close, which reads the items.
- Then a commit that calls `itemFiles` from `closeSprint` only when `close.newItems` holds an item.
- No force-push. The pull request names the case and both runs.

## Noted

- Nothing of the open draft of MOD-work-plans is built. `closeSprint`'s accepted sentence is the one the draft leaves as
  it was.
