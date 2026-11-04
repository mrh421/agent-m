---
id: ITM-1331
title: A sprint's closer other than a participant is accepted
level: system
realises:
  - UC-032
  - CLOSING A SPRINT CAN BE ASSIGNED TO A PARTICIPANT
modules:
  - MOD-implementation-pages
builds_on:
tests:
  - release
origin:
  - akmaier's ruling on finding UC032-S9 of ITM-803's battery ("S9 no"), relayed by scrum-master-opus-c in sprint team1/130
---
# ITM-1331 A sprint's closer other than a participant is accepted

**REGISTER**

## Outcome

TST-803113 (`tests/release-uc-032-derived-state-and-sprints.test.mjs:122-127`) stands `todo` with the finding UC032-S9. It
asserts that *Start sprint* with the closer "nobody", a name no participant has, is refused. akmaier ruled that a closer
need not be a participant. So the case asserts the wrong thing, and the page as built is right.

With this item, TST-803113 is an ordinary case. It asserts that *Start sprint* with a closer that is no participant is
accepted, and that the record names that closer. The finding's entry `6-closer-is-a-participant` leaves `FLOW_FINDINGS` of
`tests/system-uc-032-maintain-the-backlog.test.mjs`.

## Readiness

It is ready. Only tests change, and no code. It is written by developer-sonnet-l, who implemented none of UC-032's
behaviour. Its identifier is free: `git log --all -E -G 'ITM-1331[^0-9]' -- docs src tests` finds no commit; the same
search for ITM-1330 finds `d3f5fe134`, its known positive.

It shares `tests/system-uc-032-maintain-the-backlog.test.mjs` with ITM-1330 and ITM-1326 of sprint 130, which change
`FLOW_FINDINGS` too. It is merged after them, and merges the sprint branch before its gate.

## Acceptance

- TST-803113 has no `todo`. Its known positive stays: with the closer dev-b, one commit writes team2's record. With the
  closer "nobody", one commit writes the record, and its `closer` is "nobody". Its `given`, `expect` and title say so.
- `6-closer-is-a-participant` is no longer in `FLOW_FINDINGS`. If TST-803001 needs the passage among the evidence, it
  stands in `FLOW_EVIDENCE` with TST-803113.
- TST-803113 is checked against a planted fault: a refusal of a closer no participant has, added to *Start sprint*, makes
  it fail. The fault is recorded in the pull request.
- One commit, which holds only the two test files. CI is green on it, since no expected behaviour of the code changes.
