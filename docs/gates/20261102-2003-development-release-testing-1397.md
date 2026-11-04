---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - cd51514e8ab6417b604d66528da1c7010c1c8728
  - https://github.com/akmaier/agent-m/pull/1753
date: 2026-11-02 20:03 UTC
---
# Development → Release testing: ITM-1397, #1753

**REGISTER**

## Reason

ITM-1397 (every SPEC change is an entry of its section's queue) may go on. The pull request is #1753 into
`sprint/team1/143`, at `cd51514e8`, and the trailers name each commit's writer:
- developer-opus-f wrote the tests-only commits `9ab594c0e` and `fac21abb9` (the latter in the rework), the code
  `e54179fe0`, `6fb474736`, `75eed37e8`, `8999403c2` and `d89de656d`, and the rework `267920ff7`, `c6b3e8560` and
  `554292e56`;
- developer-sonnet-l wrote `cd51514e8`, the release moves and the lift of TST-376206, after the code.

I wrote none of it.
1. **The tests-only commits hold only tests and are red for the item's reason.** `9ab594c0e` changes 35 test files and
   nothing else, and run 41493165426 is red only in the changed tests. The rework's tests-only `fac21abb9` holds only the
   wording of TST-1301001 and the spec tree's case, TST-1274003's one batch, and `test_derivation_classes`' `01-writing.md`
   (the ruling of 143.md).
2. **CI is green on the head:** run 41513151870 (`cd51514e8`), at attempt 3. At attempts 1 and 2, `release (12)` and
   `unit (3)` were cancelled at the limit with no test failing. Run 41506544100 on `554292e56` was red only in the seven
   release cases that sonnet-l then moved. `git merge-tree` with the sprint branch's head `a8a27908f` is clean.
3. **Only the item's modules change:** MOD-spec-changes, MOD-review-pages, MOD-maintenance-pages, MOD-site-frame
   (`explanations.md`) and MOD-trace-pages (`flow.mjs`). Besides those, only tests change, among them the tests of
   MOD-repository-hosts, MOD-documents and MOD-workflow-entries that the item names, and the 428 deleted queue files.
   - `propose.mjs`'s dated folders (`QUEUE_DAY`, `folderFor`), `openQueueOf`, `openQueueIn`, `creatorOf` and
     `newestFirst` are gone.
   - An entry goes to its section's queue `docs/spec-freigaben/<package>/` and takes a number one more than any its queue
     names.
   - `issue` and `createdBy` lie on each entry.
   - The trace page's mark comes from the last entry that names a requirement, as ruled.
   - `docs/spec-freigaben/` holds only `agent-m-specification` and `review-on-github-pages`. The 72 dated folders held
     144 entries, every one `in SPEC` as `queues` reads them, so no open entry had to move.
4. **The new and moved tests name their requirements and modules.** The pull request's comments record 13 + 3
   counter-proofs. The guards of the withdrawn requirement now guard `A SPEC EDIT IS SAVED AS A PROPOSAL` and
   `A REQUIREMENT SHOWS ITS HISTORY`.
5. **The Acceptance holds:**
   - **The release cases are sonnet-l's.** No release file differs from the sprint branch before `cd51514e8`, since
     opus-f's edits are reverted byte for byte in `c6b3e8560`. sonnet-l, who built none of this, moved TST-1274305,
     1335101, 579320, 579322, 585304, 376308 and the case "gates: the current text…" of `release-sprint-02-c`, each to an
     accepted sentence it names, with no finding.
   - **TST-376206 loses its `todo`.** It passes at the head and fails at `7f17f8c8e` with the `todo` stripped, and its
     flow-map entry moves to the evidence.
   - **The approval-record examples** already stand in `src/approvals/approval-record.schema.md:29, 31` and
     `MOD-approvals.md:92, 94`.

## Ruled

- **sonnet-l's readings stand.** TST-1335101's wording "adds a source to" is taken from the code, since the accepted
  rationale title gives only `<what changes>`. `createdBy.queue` is the folder's path.
- **The reads.** opus-f read the binding documents and chapters in full. sonnet-l did not read SPEC.md in full or
  chapter 13, as he states. That is not a condition of this gate, and every check above holds. It is a point for the
  retrospective, beside ITM-1442, 1444 and 1451.
