---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - b6d5c0bdf62774a62067952bdb3b37a09e0fdebe
  - https://github.com/akmaier/agent-m/pull/1516
date: 2026-10-30 09:27 UTC
---
# Development → Release testing: ITM-782, items are proposed and added by hand on the backlog page

**REGISTER**

## Reason

ITM-782, pull request #1516 into `sprint/team1/127`, passes on `b6d5c0bd`, its head when this was decided.

The condition is "CI is green on it and the Definition of Done holds" (`docs/process-models/scrum-wip.md:53`). The
Definition of Done is the default (SPEC.md:1869-1874).

1. **CI.**
   - **Tests-only commit `bb508cec`:** run 41031298275 (`pull_request`, attempt 1) fails in one job, 123981491135. Its
     only failing cases are the four of the new file `tests/implementation-pages-backlog-propose.test.mjs`, TST-782001 to
     TST-782004. That is the item's reason: the route `backlog` drew neither *Propose items* nor *+ Item*
     (`uncoveredPanel` and `backlogPanel` of the base's `backlog.mjs`).
   - **Head `b6d5c0bd`:** run 41031399954 (`pull_request`, attempt 1) succeeds: 41 jobs succeed, 17 are skipped, none
     failed.
2. **Only the item's files change.**
   - MOD-implementation-pages only: `backlog.mjs`, `implement.mjs`, and one comment line of `index.mjs`. The module's
     interface (`index.mjs`'s exports) does not change. Both commits are developer-opus-f's: `bb508cec` holds only the
     new test file, `b6d5c0bd` only code. No existing test changes, as the planning run said. No architecture file
     changes.
   - **The move asked about.** `personOf`, `placesOf` and the Bridge lookup move from `implement.mjs` into `backlog.mjs`.
     `backlog.mjs` gives them, with the endpoints a tab job needs, as `connectionsOf`, and `implement.mjs` imports them
     from it, as it already imported `contextOf`, `participantsIn` and `viewOf`.
     - It holds: both files are parts of MOD-implementation-pages (MOD-implementation-pages.md, Parts), so the move
       crosses no module boundary and changes no interface. `index.mjs` exports none of them.
     - "Nothing twice" (AGENTS.md §2): the route `backlog` now needs the same three, and one copy stands in the module.
     - `backlog.mjs` does not import `implement.mjs`, so no cycle is added.
     - The functions keep their bodies and types: `personOf(context) -> string`, `placesOf(instanceSnapshot, address)`
       giving `restrictedPlaces`' result, and the Bridges by `bridgeAt(settingsOf(…))`. `implement.mjs`' `bridgesOf` is
       now `connectionsOf(…).bridges`.
   - **Imports, read at the level of the module as TST-106805 reads it.** `backlog.mjs` now imports MOD-browser-store,
     MOD-bridge-client, MOD-job-catalogue, MOD-job-ledger, MOD-job-runner, MOD-runtimes, MOD-site-frame and
     MOD-source-register, each named in MOD-implementation-pages' Uses. By function, all are named but `settingsOf` of
     MOD-bridge-client, which `implement.mjs` imported before the move. TST-106805 passes in a checkout at `b6d5c0bd`,
     5 of 5.
   - No top-level await is added.
3. **Interface types.**
   - `queueJob(host, start, route, head, bridge?)` is called with the tab's route and the head that was read
     (MOD-runtimes.md:249-252).
   - `runOnTab(prepared, context, connections, { host, record })` is called with the committed start and its `path`
     (MOD-runtimes.md:265-268), as MOD-review-pages and MOD-maintenance-pages call it for a tab job.
   - `writeResult(prepared, draft, { result, context })` is called with the context read at the click, on the head then
     (MOD-job-runner.md:356-364).
   - `saveItems(host, { items, removed: [] }, { architecture, head, trailers })` is used for *+ Item*
     (MOD-work-plans.md:222-228). `schemaForm(schema, document, { onSave, extraChecks })` takes `backlogFindings` as its
     extra checks (MOD-site-frame.md:268-274).
4. **It builds the accepted text and the item's Acceptance** (MOD-implementation-pages.md:167-171; ITM-782).
   - TST-782001: the page offers *Propose items* where something is not realised and *+ Item* below the backlog. It reads
     nothing for them before the person's click, and a script's click does nothing.
   - TST-782002: *Propose items* runs the job from its run panel. Its drafts wait with their findings, and only drafts
     without an error can be added. That covers "a drafted item that realises nothing, names no module … is shown with its
     finding and cannot be added".
   - TST-782003: *Add to backlog* writes the drafts kept, as edited, in one commit of item files under `docs/backlog/`.
   - TST-782004: *+ Item* opens the item's form, and its *Add* commits the item as the person's own input in one commit.
   - "Drawing the route reads nothing more" is asserted in TST-782001. The planning stand-in moved no existing test, and
     no existing test changes here.
5. **The pull request's readings hold.**
   - **The participants offered are those `eligible` admits for the kind's `needs`, with their places.** This is how the
     other run panels of the instance offer a kind (MOD-participant-list's `eligible`), and the route names no other
     rule.
   - **The person is the name of the product's stored token,** as the route `implement` names the person who starts jobs.
     It is the same function, moved.
   - **The job record's `works_on` holds the requirements and use cases no item realises.** MOD-job-ledger names
     requirements and use cases among what a job works on, and the kind's `rests-on-accepted` checks them.
   - **Provisional identifiers are never written:** for `saveItems`, "a new item gets an identifier that no history holds"
     (MOD-work-plans.md:226).
6. **Counter-proofs.**
   - The Acceptance's counter-proof is the red tests-only run of point 1. The pull request lists six faults the Developer
     planted, each failing its case.
   - Planted on the head in an export, each restored after:
     - *Add to backlog* enabled while a kept draft has an error: TST-782002 fails.
     - *Add to backlog* acting on a script's click: TST-782003 fails.
     - Drafts drawn without `backlogFindings`: TST-782002 fails.
   - Restored, on Node 26: 58 files — the new one, `test-document-one-line`, and every test file that names
     `implementation-pages`, `#backlog` or `dashboard-backlog`, the machine-bound ones of the brief left out. 544 cases:
     543 pass, 1 `todo`, 0 fail. `site-usability` alone, in a checkout at the head: 211 of 211 pass.
7. **MOD-test-document's reader:**
   - `tests/implementation-pages-backlog-propose.test.mjs`: 4 declarations, 0 findings, TST-782001 to TST-782004, each
     of level `unit` and module MOD-implementation-pages.
   - The control, `tests/release-itm-1254-issue-move.test.mjs`: 4 declarations, 0 findings.
8. **Reads, against the planning count** (`team1/127.md`): drawing the route sends no request more. TST-782001 asserts
   it, and TST-1260406, which counts the route's requests, passes on the head.

## Noted

- The pull request's description names no `JOB-` identifier. The green run's id is the one the Scrum Master gave.
- `settingsOf` is named in MOD-implementation-pages' Uses only through its module, as before the move. TST-106805 reads
  Uses at the level of the module, which the team's agreement follows.
