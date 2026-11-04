// A job of the kind `write-tests` that a CI agent ran records the cases it did not write, as docs/architecture/MOD-workflow-entries.md and SPEC.md state it: "Every job other than a conversation
// held in a browser tab has a record `docs/jobs/JOB-<id>.md` in the repository of the product it works on … naming its inputs, participant, runtime and start, and, once it has ended, its end
// state and results." (A JOB IS RECORDED IN ITS PRODUCT REPOSITORY), and onRecordsChanged: "a kind that hands its draft back leaves it in the record's end as `draft:`, from which the page shows it."
// UC-026 8b: "A test stays green with the planted fault. It checks nothing. The participant reports it, it is not written, and the review panel shows it again for the author to sharpen or drop."
// The page reads the cases not written from `end.draft.notWritten` of the record of a `write-tests` job (MOD-test-pages, generate).
// Run: node --test tests/workflow-entries-write-tests-not-written.test.mjs
//
// Module: MOD-workflow-entries
// Guards: A JOB IS RECORDED IN ITS PRODUCT REPOSITORY; UC-026
// Level: unit
//
// The product and the instance are the git repositories of tests/uc-026-harness.mjs (over tests/uc-010-harness.mjs); the participant is the fake model endpoint behind `fetch` that does a coding agent's
// work in the job's checkout — it pushes a branch and reports it —, and the job is queued as MOD-test-pages' *Write tests* queues it (the kind write-tests, the reviewed cases in its parameters).
// Where the texts leave a reading open, the tests state the one they take, and the pull request names it:
//   - The report of the kind is the answer its schema gives: `{ branch, commits, pullRequest, tests: [{ identifier, outcome, counterProof, notWritten }] }`, where `notWritten` of a test is the reason it is
//     not written. The cases the end record names as not written are those tests of the report, each with that reason.
//   - The record names them as the page reads them: `draft: { notWritten: [{ identifier, reason }] }`, in the order of the report.
//   - A job whose report names no test it did not write ends with no draft, as before.
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { battery, ciRun, participant, proposed, pushBranch, ENDPOINT, OTHER_RULE } from "./uc-026-harness.mjs";
import { PRODUCT_URL, RULE } from "./uc-010-harness.mjs";
import { listJobs } from "../src/job-ledger/index.mjs";
import { queueJob } from "../src/runtimes/index.mjs";

const JOB = "JOB-20261102-0900-c1d2";
const CASES = [proposed("TST-902", "unit", [RULE]), proposed("TST-903", "unit", [OTHER_RULE])];

// The job of the kind write-tests for the reviewed cases, queued on the route `ci hosted` as MOD-test-pages' Write tests queues it: MOD-runtimes' queueJob on the head the page read.
async function queue(w) {
  const host = w.dashboardHost();
  await queueJob(host, { id: JOB, kind: "write-tests", worksOn: ["UC-001"], participant: "test-bot", model: "fixture-llm", route: "ci hosted", run: null, retries: null, startedBy: "alice",
    start: new Date("2026-11-02T09:00:00Z"), agentM: { version: w.instanceHead, commit: w.instanceHead }, inputs: [], limit: 5, destinations: [],
    params: { requirements: [RULE], useCases: ["UC-001"], modules: [], levels: ["unit"], route: "ci hosted", endpoint: ENDPOINT, draft: { cases: CASES } } }, { kind: "ci", runner: "hosted" }, (await host.readSnapshot("main")).commit);
}

// The end of the job's record in the product's repository, as the page reads it.
async function endOf(w) {
  const rows = await listJobs([{ address: PRODUCT_URL, snapshot: await w.snapshot() }], new Map());
  return rows.find((row) => row.record.id === JOB).record.end;
}

// The job runs on CI; the participant pushes a branch that holds no test and reports `tests`.
async function ran(tests) {
  let ended;
  await battery({}, async (w) => {
    await queue(w);
    const asked = participant(async (request, n, { folder }) => {
      const commit = pushBranch(folder, "tests/none", { "docs/notes.md": "# Notes\n" });
      return { branch: "tests/none", commits: [commit], pullRequest: "", tests };
    });
    const { status } = await ciRun(w);
    assert.equal(status.outcome, "done", status.summary);
    assert.equal(asked.length, 1, "known positive: the participant was asked once");
    ended = await endOf(w);
  });
  return ended;
}

// TST-1427001 · level: unit · module: MOD-workflow-entries
// guards: A JOB IS RECORDED IN ITS PRODUCT REPOSITORY; UC-026
// given: a queued job of the kind write-tests for the reviewed cases TST-902 and TST-903; test-bot, a CI agent, pushes a branch and reports TST-902 as not written because it stays green with the fault planted
// input: onRecordsChanged on the push that holds the job's record
// expect: known positive — the job ends done; the end record's draft is { notWritten: [{ identifier: "TST-902", reason: "it stays green with the fault planted" }] }
test("the end record of a write-tests job on CI names the case it did not write, and why", async () => {
  const end = await ran([{ identifier: "TST-902", notWritten: "it stays green with the fault planted" }]);
  assert.equal(end.state, "done", "known positive: the job ended done");
  assert.deepEqual(end.draft, { notWritten: [{ identifier: "TST-902", reason: "it stays green with the fault planted" }] });
});

// TST-1427002 · level: unit · module: MOD-workflow-entries
// guards: A JOB IS RECORDED IN ITS PRODUCT REPOSITORY; UC-026
// given: the job of TST-1427001, whose report names both reviewed cases as not written, each for a reason of its own
// input: onRecordsChanged on the push that holds the job's record
// expect: known positive — the job ends done; the end record's draft names TST-902 with its reason and TST-903 with its reason, in the order of the report
test("the end record of a write-tests job on CI names each case it did not write with its own reason", async () => {
  const end = await ran([{ identifier: "TST-902", notWritten: "it stays green with the fault planted" }, { identifier: "TST-903", notWritten: "the behaviour is not reachable without a paid service" }]);
  assert.equal(end.state, "done", "known positive: the job ended done");
  assert.deepEqual(end.draft, { notWritten: [{ identifier: "TST-902", reason: "it stays green with the fault planted" }, { identifier: "TST-903", reason: "the behaviour is not reachable without a paid service" }] });
});

// TST-1427003 · level: unit · module: MOD-workflow-entries
// guards: A JOB IS RECORDED IN ITS PRODUCT REPOSITORY; UC-026
// given: the job of TST-1427001, whose report names no test as not written
// input: onRecordsChanged on the push that holds the job's record
// expect: known positive — the job ends done; the end record holds no draft
test("the end record of a write-tests job on CI with every case written holds no draft", async () => {
  const end = await ran([]);
  assert.equal(end.state, "done", "known positive: the job ended done");
  assert.equal(end.draft ?? null, null);
});

// TST-1427004 · level: unit · module: MOD-workflow-entries
// guards: A JOB IS RECORDED IN ITS PRODUCT REPOSITORY; UC-026
// given: the job of TST-1427001, whose report names TST-902 as not written and TST-903 as failing on the current code, which awaits its implementation (UC-026 8a), with no reason of not being written
// input: onRecordsChanged on the push that holds the job's record
// expect: known positive — the job ends done; the end record's draft names TST-902 with its reason and not TST-903
test("the end record of a write-tests job on CI names only the cases the report says it did not write", async () => {
  const end = await ran([{ identifier: "TST-902", notWritten: "it stays green with the fault planted" }, { identifier: "TST-903", outcome: "failed" }]);
  assert.equal(end.state, "done", "known positive: the job ended done");
  assert.deepEqual(end.draft, { notWritten: [{ identifier: "TST-902", reason: "it stays green with the fault planted" }] });
});
