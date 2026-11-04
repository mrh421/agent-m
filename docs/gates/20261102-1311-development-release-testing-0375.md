---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - c7b8307a645358510eea91a318229027403d37e8
  - https://github.com/akmaier/agent-m/pull/1740
date: 2026-11-02 13:11 UTC
---
# Development → Release testing: ITM-375, #1740, the system and release tests of UC-017

**REGISTER**

## Reason

ITM-375 was written by developer-sonnet-j (`Agent-M-Participant` on `a693a994d` and `c7b8307a6`). I wrote none of it.
1. **No failing first commit:** a battery adds no behaviour (142.md, *Readings taken*).
2. **CI is green on the head:** run 41449816221 (`c7b8307a6`), at the first attempt. No job failed or was cancelled.
   `git merge-tree` with the sprint branch's head is clean.
3. **Only new test files:**
   - `tests/uc-017-harness.mjs`;
   - `system-uc-017-participants-through-the-frame` (TST-375201 to 375217);
   - `release-uc-017-configure-participants` (TST-375301 to 375316).

   They run through the real frame at `#participants`, a fake GitHub server and real Bridges over fixture agents.
4. **Who wrote what it tests.**
   - By the trailers, UC-017's code is by sonnet-a, b, c and d, opus-a and b, terra-a and sol-c.
   - sonnet-j built ITM-1186, which exports the capabilities and presets and took the prompt bar's note off the page. No
     case guards it.
   - The postcondition on the prompt bar's offer is left to UC-049's battery.
5. **The Acceptance holds:**
   - The pull request records 44 planted faults, and every passing case fails on at least one.
   - TST-375203 and 375313 were strengthened in a commit of their own when a first fault failed nothing.

## Findings, ruled

All point at MOD-settings-pages, whose accepted text assigns the Participants page. They are items, registered in this
commit:
- **UC017-F1, F2 and F4, TST-375213, 375214 and 375216 → ITM-1437:** one item for what the form fills from a Bridge or a
  runner. *Add* sets the model to the agent's name, a self-hosted runner's CI agent keeps the hosted runner's place, and
  the agent is free text.
- **UC017-F3, TST-375215 → ITM-1438:** a price written as the field's hint shows it is saved silently and read as none.
  MOD-participant-list judges no row by design, so the page refuses it.
- **UC017-F5, TST-375217 → ITM-1439:** the *Test* step carries no folded explanation, though `agent-test` exists.

Their lifts go to a participant who built none of the page. sonnet-j touched `participants.mjs` with ITM-1186, so it is not
sonnet-j.

## Not walked

- The jobs a participant does are UC-048's and UC-038's.
- The prompt bar's offer is UC-049's.
- A role given is UC-048's.
- The runner's refusal at the routing of a job: TST-375314 calls it over a saved register.

## Readings taken

The pull request names its readings, and all are taken:
- `#participants` is reached through the frame.
- The agent is chosen with *List agents* and *Add*.
- The presets include UC-017's table of types, which says no "only".
- 6a: *Save* is withheld after a failed test until *Save untested*.
- `eligible` takes a size.
- `jobCost` comes from a real Bridge's usage.
- The reverse tunnel is modelled as two forwards of TCP.
- An internal repository is refused as a public one is.
- Licences "may be republished".
- `module: system` is used as at ITM-775's gate.
- `tests/test_participants.py` is the SPEC's existing check.
