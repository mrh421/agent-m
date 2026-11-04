---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 1a3d3f893fd698b0dbcb72f281538bda431578b4
  - https://github.com/akmaier/agent-m/pull/1742
date: 2026-11-02 13:47 UTC
---
# Development → Release testing: ITM-1437, #1742

**REGISTER**

## Reason

ITM-1437 (a participant added from a Bridge or a runner names its model, place and agent as offered) may go on. The pull
request is #1742 into `sprint/team1/142`, at `1a3d3f893`. developer-opus-e wrote the tests-only commit `35deef25d` and the
code `bf1b1abe2`; developer-sonnet-l wrote `1a3d3f893`, the lift of TST-375213's, 375214's and 375216's `todo`, after the
code was pushed (`Agent-M-Participant` on each). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.**
   - In run 41452034252 the failing cases are TST-1437001 to 1437003 and the moved TST-353001 of
     `settings-pages-participants`, and the moved TST-375002 of `system-uc-017-configure-participants`.
   - The other files named in that run fail only their `todo` cases that name a finding.
2. **CI is green on the head:** run 41453865648 (`1a3d3f893`), at attempt 2; attempt 1 was cancelled, and no step failed.
   `git merge-tree` with the sprint branch's head is clean.
3. **Only the item's module changes:** `src/settings-pages/participants.mjs`.
   - **F1:** `addOfferedAgent` (:582) set the model to the agent's name. The Bridge reports no model: its agents give a
     name, a version and whether they are ready and logged in. So *Add* no longer writes the model, and the author names
     it.
   - **F2:** a runner's change (:404, :551) kept "GitHub hosted runner". The place now follows the runner, "self-hosted
     runner <label>", while it is still the preset; a place typed by hand stays.
   - **F4:** the agent was free text (:654-665). Now the page keeps, for each Bridge, the agents its last *List agents*
     offered. An agent not among them is an error under `THE BRIDGE FINDS THE INSTALLED AGENTS` and withholds *Save*.
4. **The Acceptance holds:**
   - The five counter-proofs in the pull request each fail a case.
   - TST-375213, 375214 and 375216 lose their `todo`: each red at `35deef25d`, green at `bf1b1abe2`. sonnet-j wrote them,
     and sonnet-l built none of the page.

## Ruled

- **The moved expectations stand.** Both moved in the tests-only commit and were red there, and both headers name
  MOD-settings-pages.
  - TST-353001's model moves from "codex" to "".
  - TST-375002 now finds the model empty and types it before the test.
- **F1's reading is taken against its Acceptance line "fills the model the Bridge reports".** The Bridge reports none, so
  *Add* fills none, and UC-017 step 3's "the model the agent is configured to use" is named by the author.
  `A PARTICIPANT BASED ON A LANGUAGE MODEL NAMES ITS MODEL` still holds: a row without a model is not saved, as before.
  A Bridge that reports its agents' models would let *Add* fill it. That is a candidate for the review, not registered
  now.

## Readings taken

- The place a self-hosted runner presets is "self-hosted runner <label>"; an empty place would break TST-375314.
- An agent is checked against the page's last *List agents* answer for that Bridge. A Bridge never listed on the page is
  6a's case, as before.

Both are taken.
