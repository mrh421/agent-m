---
id: ITM-648
title: An opened requirement shows the open proposals that touch it
level: module
realises:
  - UC-020
  - OPEN PROPOSALS ARE SHOWN IN THE BROWSER
modules:
  - MOD-trace-pages
builds_on:
  - ITM-597
  - ITM-677
tests:
  - unit
  - system
origin:
  - ITM-597's gate on pull request #690 (docs/gates/20261017-0533-development-release-testing-7f40.md)
---
# ITM-648 An opened requirement shows the open proposals that touch it

**REGISTER**

## Outcome

Cut from ITM-597 at its gate. UC-020 step 5, "Open proposals touching it", and 5c, "Both are listed; the browser notes
that accepting one makes the other stale".

ITM-597's code decided by itself what an open entry changes and withdraws: it read the proposal as a SPEC section and
compared it with the section of the entry's anchor, ignoring `until`. MOD-spec-changes already states that rule:
`entryView` gives an entry's `impact`, each name `changed`, `withdrawn` or `added`. A second copy in MOD-trace-pages
would diverge from it, and already did on `until` (sprint 60's agreement).

So the view takes each open entry's `impact` from `entryView`. It waits for akmaier's acceptance of the draft committed
with ITM-597's gate, which adds `MOD-spec-changes.entryView` to MOD-trace-pages' Uses.

**Settled at sprint team1/69's start. Selectable.**
- **The module whose files it changes:** MOD-trace-pages, `flow.mjs`. An opened requirement on the default branch lists
  every open entry whose `impact` names it, with the entry's state, the impact's kind and a link to the entry. Two such
  entries carry 5c's note. At a tag, no proposal is shown (UC-020 1a). No topic is added.
- **The rule is MOD-spec-changes'** `entryView(queue, entry, snapshot).impact`, in MOD-trace-pages' accepted Uses
  (`b43da779`). The view classifies nothing itself, as the cut from ITM-597 asks.
- **The grep, full output read:** `grep -rn "Open proposals\|queues(\|entryView" src/trace-pages tests` finds three
  tests whose expected results change:
  - `tests/trace-pages-specification.test.mjs:478-487`: no Open proposals section, known positive its use cases;
  - `:492-503` (TST-597015): no section, no stale note and no queue read;
  - `tests/system-itm-597-spec-traces.test.mjs:107`: no "Open proposals" in the page.
  No release test is among them.
- **Reads, against the token budget** (sprint 66). On the first opening at the default branch, `queues` and one
  `entryView` per open entry read through the version's snapshot.
  - ITM-597's first draft measured the queues' files at 110 raw reads without a token, with a token batched.
  - **The measurement asked** (sprint 67): a committed test counting the snapshot's reads on a fixture with two open
    entries. It shows one `queues` read per version, one `entryView` per open entry, and none on reopening.
- **No error is added**, so sprint 68's reading of error fields has nothing to check.
- **Reachable:** the live `#spec`.
- **Sprint 68:** no release test is among the tests it is known to change. If the draft run finds one, the developer stops
  and reports it, and a separate item by another participant changes it first.
- **Sprint 64:** the developer's draft run over the modules' tests and their callers' lists every changed test before the
  tests-only commit.
- **Sprints 65 to 67:** DOM assertions compare booleans or strings, each shell command does one action, no refusal is
  worked around, and a module header the item touches loses its item history.

## Acceptance

- An opened requirement lists every open entry whose `impact` names it, with the entry's state, the impact's kind and a link to the entry.
- Two such entries carry the note that accepting one makes the other stale.
- No rule of what an entry changes is written in MOD-trace-pages.
- Its tests in `tests/trace-pages-specification.test.mjs` guard `OPEN PROPOSALS ARE SHOWN IN THE BROWSER` by name.
- The first commit holds only the tests, and CI is red on it. No stub is committed.

**The draft it waited for is accepted** (akmaier, `b43da779`): MOD-trace-pages' Uses with `MOD-spec-changes.entryView` (accepted blob 5c9248d32c4f). It is free of drafts; its readings are read at its start.

**At its gate on #715 (2026-10-17, po-opus): MOD-spec-changes joins its modules.** `queues` (`src/spec-changes/queues.mjs`)
reads each queue's `index.md` and `entscheidungen.md`, each record, proposal and target one by one through
`snapshot.read`, without `readMany`. On this repository's 56 queues that is over 112 requests per first opening of a
requirement at a version, with a token API calls on the person's budget. `queues` gathers the paths it will read and
reads them through the snapshot's `readMany` first. `Snapshot.readMany` is MOD-repository-hosts' interface, in
MOD-spec-changes' Uses, so no draft is needed. A committed test with a fixture of many queues counts the reads.

**ITM-677 is merged (#732).** Its rework's draft of the batching showed that `queues` is MOD-spec-changes' shared
reader, so the batching was cut out into ITM-677, and this item took MOD-spec-changes out of its modules again. Pull
request #715 is still open, its gate rejected (`docs/gates/20261017-0930-development-release-testing-91e4.md`); it is
brought up to `main` in new commits, and the gate is decided again with the committed count. On `main` an opened
requirement still shows no Open proposals section: `tests/trace-pages-specification.test.mjs:487` and `:503` assert its
absence.
