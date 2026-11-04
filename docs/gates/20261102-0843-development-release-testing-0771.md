---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: rejected
on:
  - ed6b03077082c025d46738fe980f6386bbe11082
  - https://github.com/akmaier/agent-m/pull/1718
date: 2026-11-02 08:43 UTC
---
# Development → Release testing: ITM-771, #1718, the system and release tests of UC-026, rejected

**REGISTER**

## Reason

ITM-771 was written by developer-sonnet-j (`Agent-M-Participant` on `ed6b03077`). I wrote none of it. CI is green on the
head (run 41414085410), and the pull request adds only new test files. It does not pass yet, for one reason.

**Counter-proofs are missing for 13 passing cases.** The item's Acceptance says: "each new test's counter-proof — a fault
planted in the code it guards, and the test failing on it — is recorded in the pull request". `A NEW TEST IS SHOWN TO FAIL
ON A PLANTED FAULT` says the same. The pull request records seven planted faults, and none for these cases:
- system: TST-771207, 771208, 771212 and 771213;
- release: TST-771302, 771304, 771306, 771307, 771308, 771310, 771311, 771312 and 771313.

The six cases that are `todo` with a finding need none until they are lifted. One fault may serve several cases, as long as
each case is named as failing on it.

## What passes it

Planted faults that fail each of the 13 cases, recorded in the pull request with the case each one fails. No test needs to
change unless a fault shows that a case cannot fail; such a case is then strengthened in a commit of its own. Then the gate
is requested again on the new head, and the findings UC026-F1 to F6 are ruled in that record.

## Noted

- The authors were checked against the trailers of UC-026's code. sonnet-j's one commit on these modules (ITM-1351,
  `moduleRows`) lies off the use case's flow.
- The readings and the unwalked steps the pull request names are judged with the findings at the next gate.
