---
id: ITM-443
title: The derived architecture waiting for the author, and Write proposals
level: module
realises:
  - UC-022
  - AN ARCHITECTURE DRAFT IS CHECKED BEFORE A PERSON SEES IT
  - AN ARCHITECTURE IS CHECKED WHEN IT IS COMPLETE
  - A REVIEWER'S FINDING IS A WARNING
  - A REVIEW FINDING IS WEIGHED BEFORE IT IS ACTED ON
  - THE ROUNDS ARE COUNTED AND SHOWN
  - WHAT A PERSON DECIDES IS NOT SENT BACK
  - A REUSE DECISION RECORDS ITS DUE DILIGENCE
  - A GENERATED ARTIFACT IS A PROPOSAL
  - A REVIEWED ARTIFACT ENTERS THE DEFAULT BRANCH AS OPEN
  - ONE CLICK PER DECISION
modules:
  - MOD-review-pages
builds_on:
  - ITM-442
  - ITM-441
  - ITM-436
  - ITM-336
tests:
  - unit
origin:
  - UC-022 steps 6 to 9, 6a, 6b, 6c, 7a, 7b, 7c, 7d
built_by:
  - 11ece0637b6c2e7f1fad6f987c92f3d2b3afda5b
  - dc643bae1d713285ae9bc59b960b61fbe521c2f0
---
# ITM-443 The derived architecture waiting for the author, and Write proposals

**REGISTER**

## Outcome

MOD-review-pages' route `decision/draft` after *Run*, as its file states it: the architecture the job returns, waiting
for the author, as a whole — the decision that states the system with its views and scenarios, the subsystems'
decisions, the module files and the further decisions —, with its rounds, each finding beside its correction or answer,
the findings left in the compiler form, and a draft for which no reviewer's answer could be read marked *not checked*;
the due-diligence table, a candidate not found shown as *not found — the name may be invented* with the address queried,
a licence not known to be compatible marked, and, without a `LICENSE`, every row *not checked*; the reuse candidates
choosable; a file the author changed checked again as a whole (MOD-job-runner's `from`); *Write proposals*, one click,
writing the draft as the author left it (`writeResult` with the writer `open-files`, ITM-336), and nothing written while
a reuse decision carries the mark of a registry that could not be read — the registry named and the job offered on a
route whose participant can reach the web —; *Start again*. Rewriting a reuse decision whose every alternative the
author rejects (UC-022 8a) is not stated by the accepted texts and is not part of this item.

## Acceptance

- Unit tests that name MOD-review-pages state, before the code exists, in the small DOM with a fixture job result: the
  files in their order with their rounds; an answered finding beside its finding; a draft marked *not checked*; the
  due-diligence table with a candidate not found and a marked licence; a changed file sent back as `from`; *Write
  proposals* writing once; a blocked registry's mark keeping *Write proposals* from writing, with the registry named and
  another route offered.
- The first commit holds only these tests, and CI is red on it; every new test's counter-proof is recorded in the pull
  request.
- The existing tests stay green, with no expected result changed.
- Only `src/review-pages/` and the tests that name MOD-review-pages change.
