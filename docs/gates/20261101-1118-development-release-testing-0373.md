---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - c752c830c6a1294d5dc275d28f95b6cf11b1bd86
  - https://github.com/akmaier/agent-m/pull/1654
date: 2026-11-01 11:18 UTC
---
# Development → Release testing: ITM-373, #1654, the system and release tests of UC-010

**REGISTER**

## Reason

ITM-373 was written by developer-sonnet-k (`Agent-M-Participant` on `d906e3558` and `c752c830c`). By the developer's
reading of the trailers, none of ITM-311 to 390 is sonnet-k's; its one commit in those paths is ITM-1259 (UC-012). I wrote
none of it.
1. **No failing first commit:** a battery adds no behaviour (141.md, *Readings taken*).
2. **CI is green on both heads:** run 41300165074 (`d906e3558`) and run 41300885760 (`c752c830c`), each at the first
   attempt. `git merge-tree` with the sprint branch's head is clean.
3. **Only new test files:** `tests/uc-010-harness.mjs`, `tests/system-uc-010-run-a-job-in-github-actions.test.mjs`,
   `tests/release-uc-010-run-a-job-in-github-actions.test.mjs`.
4. **MOD-test-document's reader** reads 11 system cases (TST-373201 to 373211) and 10 release cases (TST-373301 to 373310),
   each `module: system`, with no finding. TST-373001, 002, 101 and 102 of the history are not reused.
5. **The two minutes.** On CI the system file ran 9.7 s and the release file 10.2 s; their jobs, `system-pull-request (6)`
   and `release-pull-request (7)`, took 38 s and 82 s. The local times (41 s, 50 s) are the machine's. No risk to the limit
   is seen; a job that nears it is a finding of the next gate.
6. **The Acceptance holds:** every requirement UC-010 realises has a release case; the system file walks the main flow and
   the alternative flows; the pull request records a planted fault for every case that is not a `todo`.

## Findings, ruled

- **UC010-F1 (TST-373211) → ITM-1378 (MOD-runtimes), ready.** A start queued on the CI route for a model endpoint carries
  no endpoint, and the entry, which runs "from its record alone … with the driver of its participant", throws `NoDriver`.
  `queueJob`, through which every page queues, puts the endpoint and its secret's name into the record.
- **UC010-F2 (TST-373210) → ITM-1379 (MOD-review-pages), ready.** MOD-site-frame leaves the route beside the run panel to
  the view (MOD-site-frame.md:256-257), so the drafting page says there that the calls are billed per use.
- **UC010-F4 (TST-373209) → ITM-1380, for akmaier.** MOD-repository-hosts states that a clone without a token throws
  `NotSupported` for every function but reading and committing files, `readHistory` among them, while the writer runs on
  the agent's machine, which reads no token. The item names the general change: a clone reads its own history through
  `git`.
- **UC010-F3, withdrawn by the developer:** the start from the server's page follows MOD-runtimes' accepted text, and
  TST-373205 walks it. The gap between UC-010 step 1 and that text is noted for akmaier; nothing waits on it.

## Readings taken

- A dashboard's CI start is `queueJob` on `ci hosted`.
- The endpoint comes from the record's parameters.
- "Together with the end record" means in the same run.
- The tab stands in for the Bridge's driver.
- `A JOB RECORD STARTS NO CI RUN` is not tested here, as the item says.

All are taken.
