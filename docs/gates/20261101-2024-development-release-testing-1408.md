---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 0b4a9535f1bb1ef9f2703427dda48de9ab7b5962
  - https://github.com/akmaier/agent-m/pull/1703
date: 2026-11-01 20:24 UTC
---
# Development → Release testing: ITM-1408, #1703

**REGISTER**

## Reason

ITM-1408 (the backlog starts the sprint's ready items in one click) may go on. The pull request is #1703 into
`sprint/team1/142`, at `0b4a9535f`. developer-sonnet-k wrote the tests-only commit `35b4344bf` and the code `a313a5773`;
developer-sonnet-l wrote `0b4a9535f`, the lift of TST-805204's `todo`, after the code was pushed (`Agent-M-Participant` on
each). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `35b4344bf` adds
   `tests/implementation-pages-start-sprint-work.test.mjs` (MOD-implementation-pages). In run 41345155174 its three cases
   are the only failing ones: neither page offers the link.
2. **CI is green on the head:** run 41345910563 (`0b4a9535f`), at the first attempt. No job failed or was cancelled.
   `git merge-tree` with the sprint branch's head is clean.
3. **Only the item's module changes:** `src/implementation-pages/backlog.mjs` and `progress.mjs`.
   - Before, `teamPanel` drew only *Change the selection*, and nothing linked the route `implement` with a sprint.
   - Now `startWorkLink`, defined once in `progress.mjs`, draws *Start sprint work* in the panel of each team with a
     running sprint, on the progress page and the backlog.
   - Its address encodes the slash (`#implement/sprint=team1%2F03`). The frame splits at every slash before decoding, so
     a bare `team1/03` would be read as the sprint `team1`; TST-1408003 shows that with `routeOf`.
4. **The Acceptance holds:** both pages open Implement for each running sprint, and the frame reads each address as that
   sprint. The four planted faults each fail a named case.

## Ruled

- **TST-1408003's last assertion changed in the code commit.** It looked for the sprint file's path, which a team's panel
  does not show. It now looks for the sprint's name, "team1/03", which the panel shows. The tests-only commit was red for
  the item's reason, the link missing, whatever that assertion held. The change corrects a known positive that could
  never hold, and it weakens no counter-proof.
- **TST-805204's lift changes two of its expectations.**
  - It now expects one link per running sprint: two for the fixture's two sprints, as its known positive *Change the
    selection* counts two.
  - It compares the address the frame reads (`routeOf`) instead of a string with a bare slash.

  The case was a `todo` that had never passed, and its first form named an address the frame cannot read. sonnet-l
  checked both against the code, built none of it, and the case is red at `35b4344bf` and green at `a313a5773`. It is
  read as the lift settling a `todo`'s expectation, not as a moved expectation of a passing test.

## Reading taken

- The link stands in each running team's panel on the backlog and on the progress page. TST-805204 looks on both; the
  item names the backlog.

## Noted for akmaier

- MOD-implementation-pages names no control *Start sprint work*. This stands as in the record of ITM-805's gate.
