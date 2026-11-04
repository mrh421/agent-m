---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 2b946cf10282b5001835fdc44497e271c0080f24
  - https://github.com/akmaier/agent-m/pull/1622
date: 2026-11-01 12:00 UTC
---
# Development → Release testing: ITM-1349, #1622

**REGISTER**

## Reason

ITM-1349 (only a file the reviewer has read gets a tick on the list) may go on. The pull request is #1622 into
`sprint/team1/141`, at `2b946cf10`. developer-sonnet-k wrote the code and the unit tests. developer-sonnet-l wrote the
system and release cases (`Agent-M-Participant` on each commit). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `bf7687946` is red in run 41285462556
   (pull_request). Only the new TST-1349001, 002, 003 and 005 fail, and the moved list cases: TST-879001, TST-879004,
   and the use-case, decision-and-module and spec-entry lists.
2. **CI is green on the head:** run 41287695495 (pull_request, `2b946cf10`), at the first attempt. `git merge-tree` with
   the sprint branch's current head is clean.
3. **Only the item's modules and their tests change.**
   - The code is `src/review-pages/flow.mjs`.
   - The tests changed are those the Acceptance names (`78b4000da`): the MOD-review-pages unit files,
     `dashboard-review-flows` (MOD-settings-pages), `site-accessibility` and `release-sprint-01-dashboard-app`
     (MOD-site-frame), and the system and release cases.
4. **The Acceptance holds:**
   - The list offers a tick only for a file this tab has shown, and the tick names the blob that was shown
     (TST-1349001 to 1349003).
   - What one product's page showed gives no tick in another product's list (TST-1349005).
   - TST-372212 loses its `todo` in sonnet-l's commit, written from the pushed code before the gate. Against the base,
     TST-372212 alone of sonnet-l's cases fails.

## Rulings

- **The unit tests adapted in `560f831e5`, after the code.** The binding rule is met: the first commit holds only tests
  and is red (SPEC.md:1466-1469), as ruled before this gate. I read every assertion line the commit changes. Each only
  hands the harness the host that the memory is keyed by, or gives the second product a host of its own. No expected value
  changes, and none is weakened. The pull request lists each change with file:line, old → new. Allowed.
- **`9d3e8369e` and `2b946cf10`** open a file's page, or `<k>/id=all`, before they tick it. The lines they remove are the
  old inputs "tick … on the list". No assertion is removed. Allowed.
- **UC008-S1 moves from `FLOW_FINDINGS` to `FLOW_EVIDENCE`** in `tests/system-uc-008-review-and-accept-a-use-case.test.mjs`,
  with TST-372212 as its evidence. A finding that is built becomes evidence, so TST-372201 (every finding carries a `todo`)
  stays true. This follows from lifting the `todo`. Allowed.
- **The memory is keyed by the frame's host, in this tab's memory only.** "What was shown is kept on the screen only." A
  replaced host forgets what was shown, so no tick is offered: this fails safe. In the UC-008 harness, pages are read
  through the same page with `page.go`. Taken.

## Open

TST-372216 (UC008-S2) keeps its `todo` for ITM-1350.
