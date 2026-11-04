---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 1f4befc5f821f7ad6d6e496c277c8baefa3612c9
  - https://github.com/akmaier/agent-m/pull/1427
date: 2026-10-29 09:55 UTC
---
# Development → Release testing: ITM-1269, the job page reads its own job

**REGISTER**

## Reason

ITM-1269, pull request #1427 into `sprint/team1/115`, passes on `1f4befc5`, its head when this was decided.

The Definition of Done is the default (SPEC.md:1869-1874).

1. **CI is green.** Run 40852137762, `pull_request`, on `1f4befc5` passes in its attempt 2: 38 of 38 pull-request jobs
   and `agent-m done`.
   - Attempt 1 failed only `agent-m done`, with "Pull request #1427 names the job JOB-20261016-1000-0000, which has no
     record in docs/jobs/".
   - The description had quoted a fixture's job identifier. `onDoneCheck` checks "the job its title or description
     names" (`src/workflow-entries/product.mjs:900-902`), so it read that identifier as the pull request's job, as its
     text says.
   - The line was reworded, and the rerun passed. No code and no test of the pull request changed in between.
2. **Red first.** The tests-only commit `9e50f748` is red in run 40851968979, in component shard 5, and there only in
   TST-1269001 and 002. Both fail for the item's reason:
   - the route read every job record of alice/product, where one record of bob/other is expected;
   - it read no narrowed tree, where those of the instance and the three products are expected.
   - Its `agent-m done` failed for the same description line.
3. **The fixture commit after the tests-only commit changes no expectation.**
   - `cc0f5aab` changes `tests/main-page-job-revert.test.mjs` (MOD-main-page), a test the Acceptance names among the
     route's. Its own fake of GitHub's GraphQL now answers only the `f<n>` batches. It hands the query of named files,
     `e<n>`, on to the harness, which answers it since `9e50f748`.
   - No `assert` line changes.
   - The implementation commit `1f4befc5` changes only `src/main-page/jobs.mjs`, and no test.
4. **Only its module changes.**
   - Code: `src/main-page/jobs.mjs`.
   - Tests: `tests/main-page-job-one-record.test.mjs`, the helper `tests/main-page-home-harness.mjs` and
     `tests/main-page-job-revert.test.mjs`, all named MOD-main-page.
   - As its Acceptance says, no test of another module changes, and no test is removed.
   - The code adds no import. It calls `readSnapshot` (with `folders`), `listJobs` and `liveState`, which MOD-main-page's
     Uses name (MOD-main-page.md:24, :36, :40).
5. **The Outcome is the accepted text** (MOD-main-page.md:153-155): "The route reads the one record `docs/jobs/<id>.md`
   — of the product the address names, else of the first repository among the instance and the kept products whose tree
   holds it — and asks the live state of that job alone; it reads no other job's record".
   - `oneJob` narrows each source's tree to that one path.
   - It takes the first holder in `sourcesOf`'s order, the instance and then the products as kept.
   - It hands that one snapshot to `jobsOf`, whose `listJobs` and `liveStatesOf` then see one record.
   - The route `jobs` keeps `everyJob`, unchanged in what it reads.
6. **The counter-proof stands.** The same job identifier is planted in alice/product and in bob/other.
   - TST-1269001, for bob/other, reads bob/other's record alone.
   - TST-1269002, without a product, takes alice/product's, the first holder, and reads one record.
7. **The readings in the pull request hold.**
   - **One record** is one file under `docs/jobs/` read, with the trees narrowed to it.
   - **One live state** is one request to the Bridge's `/v1/jobs`, as `liveState` asks a Bridge job's.
   - **Without a product,** the narrowed trees of every source are read in parallel, and the first holder is taken.
     The text's "the first repository … whose tree holds it" names the order, not that the trees be read one after
     another.
8. **The reader.** On `1f4befc5`:
   - **Known positive:** `tests/release-itm-1254-issue-move.test.mjs`, 4 declarations and 0 findings.
   - `main-page-job-one-record`: 2, TST-1269001 and 002. `main-page-job-revert`: 3.
   - Both with 0 findings.
   - `main-page-home-harness` is a helper, with no declaration of its own.

## Noted

- **A description that quotes a job's identifier names that job to `agent-m done`.**
  - That follows the check's text, so it is no defect, and no item is registered.
  - For the review: a pull request's description names only its own job, and a fixture's identifier is quoted without
    its `JOB-` prefix.
