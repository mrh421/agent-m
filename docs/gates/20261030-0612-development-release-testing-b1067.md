---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - e04e4dfcc1466a501b030c33b6ad061e82beefe9
  - https://github.com/akmaier/agent-m/pull/1501
date: 2026-10-30 06:12 UTC
---
# Development → Release testing: ITM-1067, the review pages find the register's entries through registerPaths

**REGISTER**

## Reason

ITM-1067, pull request #1501 into `sprint/team1/125`, passes on `e04e4dfc`, its head when this was decided.

The condition is "CI is green on it and the Definition of Done holds" (`docs/process-models/scrum-wip.md:53`). The
Definition of Done is the default (SPEC.md:1869-1874).

1. **CI.**
   - **Tests-only commit `e8f85f74`:** run 41010663736 is red in two jobs.
     - `unit-pull-request (11)` fails on the item's three cases, TST-1067001 to TST-1067003, in
       `tests/review-pages-spec-entries-register-paths.test.mjs`. That is the item's reason: the page reads
       `README.md` and `notes.md` under `docs/sources/` as register entries.
     - `unit-pull-request (4)` fails on TST-286004 of `tests/tunnels-runtime.test.mjs`. The tunnel's state there is
       `"failed"` with `"reason":"port-taken"`: the runner's loopback port was already in use. The item touches no file of
       MOD-tunnels, and the case passes on the head.
   - **The run counts as red for the item's reason.** The default Definition of Done asks that "the job's first commit
     held only failing tests" (SPEC.md:1871). That commit holds only the new test file, and its three cases fail for the
     item's reason in a job of their own. An extra failure elsewhere does not take the item's reason away.
   - **Head:** run 41011055582 (`pull_request`, attempt 1) succeeds.
2. **Only the item's files change.**
   - `src/review-pages/spec-entries.mjs`, +5/−6:
     - it imports `registerPaths` beside `sourceSchemas` from MOD-source-register's index;
     - `sourcePaths` and `sourcesOf` call it;
     - the local `isRegisterEntry` goes;
     - the local list in `sourcesOf` is named `entryPaths`, so that it does not hide the import, as the item's planning
       run named it.
   - MOD-review-pages names MOD-source-register among its Uses (MOD-review-pages.md:74-78). The agreement of sprint 124
     reads that at the level of the module. `registerPaths(paths: string[]) -> string[]` is MOD-source-register's
     (MOD-source-register.md:148).
   - The one new test file, whose header names MOD-review-pages. No existing test changes.
3. **It builds the item's Acceptance.**
   - "`spec-entries.mjs` finds the register's entries through `registerPaths`, and keeps no path rule of its own": both
     filters call it, and no pattern of `docs/sources/` stands in the file.
   - "A file under `docs/sources/` that is no `SRC-` entry is not read as one":
     - TST-1067001 covers a product's page, reading the instance's register;
     - TST-1067002 covers the instance's own page;
     - TST-1067003 covers the entry page's batch.
   - No interface changes.
4. **The counter-proofs stand in this record.**
   - The developer recorded the tests-only run and the asserted known positives, and wrote no counter-proof record of its
     own. A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT (SPEC.md:1527-1530) asks for a recorded fault and the test's
     failing result on it. The tests-only run is one: the code as it stood fails all three cases.
   - I planted two more on the head, one in each place the rule stood:
     - the old pattern back in `sourcesOf`'s `entryPaths` fails TST-1067001 and TST-1067002, and TST-1067003 passes;
     - the old pattern back in `sourcePaths` fails TST-1067003, and the other two pass.
   - Restored, 3 of 3. So each place is pinned by its own case.
   - Each case asserts the known positive it names: SRC-alice and SRC-bob are read and come back as the register, and
     `registerPaths` names both over the same paths. That is the agreement of sprint 124.
5. **MOD-test-document's reader:**
   - `tests/review-pages-spec-entries-register-paths.test.mjs`: 3 declarations, 0 findings. The header gives
     MOD-review-pages, level `unit`, and no finding.
   - The control, `tests/release-itm-1254-issue-move.test.mjs`: 4 declarations, 0 findings.
   - The `known positive:` line after each declaration is a note. The reader keeps it out of `expect`.
   - The declarations' `given`, `input` and `expect`, as the reader reads them:
     - **TST-1067001** —
       - given: "a product whose snapshot holds docs/sources.md, and an instance whose snapshot holds the register entries
         SRC-alice and SRC-bob and, under docs/sources/, README.md and notes.md, which are no SRC- entries";
       - input: "sourcesOf of the product's page; the instance's snapshot records its batches and its reads";
       - expect: "the instance's snapshot is asked, by one readMany, for exactly docs/sources/SRC-alice.md and
         docs/sources/SRC-bob.md, and no other file is read; the register comes back as SRC-alice and SRC-bob".
     - **TST-1067002** —
       - given: "the page of the instance itself (no product), whose snapshot holds docs/sources.md, the register entries
         SRC-alice and SRC-bob and, under docs/sources/, README.md and notes.md, which are no SRC- entries";
       - input: "sourcesOf of the instance's page";
       - expect: "README.md and notes.md are not read; docs/sources/SRC-alice.md and docs/sources/SRC-bob.md are, and the
         register comes back as SRC-alice and SRC-bob".
     - **TST-1067003** —
       - given: "the instance's own SPEC with a queue of one entry, and under docs/sources/ the register entries SRC-alice
         and SRC-bob, README.md and notes.md, which are no SRC- entries";
       - input: "queueService.view of the entry, on the instance's own page; the snapshot records its batches";
       - expect: "the batch the entry page asks for holds the register's files that registerPaths names over the
         snapshot's paths (docs/sources/SRC-alice.md, docs/sources/SRC-bob.md) and none of README.md and notes.md".
6. **Locally on the head:** the file, `tests/test-document-one-line.test.mjs` and `tests/tunnels-runtime.test.mjs` give 17
   pass, 0 fail. My planning run of the same change, over 183 files, found no case that fails only with it.
7. **Reads.** The entry page's batch and a product page's batch of the instance's register no longer hold a non-`SRC-`
   file under `docs/sources/`. That is one read fewer per such file. On `main` there is none (2 of 2 are `SRC-`
   entries), so its pages read as before.

## Noted

- TST-286004 (`tests/tunnels-runtime.test.mjs`) failed on `e8f85f74` with a port already taken on the runner. It has
  only the one outcome on that commit, so it is not "flaky" by the SPEC's rule (SPEC.md:1587-1590). Tunnels tests have
  flipped before (ITM-1312, TST-286904). For the close's feedback.
