// MOD-progress-measures' productFacts reads a product's files in batches of a hundred (A PAGE LOAD READS THE REPOSITORY IN BATCHES:
// "With a token on GitHub, one load of a dashboard page reads its commit and that commit's tree once, and the texts of the files it
// shows in requests of at most 100 files each; a file whose blob the page has read already is not read again"). Both scopes, the
// scope `work` that MOD-prompt-bar asks before a hand-over and the scope `all`, tell the snapshot the files they read before the first
// read (Snapshot.readMany). The counts are taken through the real MOD-repository-hosts host over a counting fake of GitHub
// (tests/progress-measures-load.mjs) serving a product of 600 backlog items, 400 job records, a SPEC.md of two requirements and one
// test file, and an instance of a participant list. The caller's own two requests, the instance's commit and tree, are not counted.
// Run: node --test tests/progress-measures-batches.test.mjs
//
// Module: MOD-progress-measures
// Guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// Level: unit
//
// Each test states its input and its expected values in its own text (given / input / expect); no expected value is read from a
// document. Nothing reaches the network: `fetch` is the fake for every test and is put back when the test ends. The counter-proofs
// are recorded in the pull request.

import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { productFacts } from "../src/progress-measures/index.mjs";
import { INSTANCE, PRODUCT, githubServer, hosts, instanceFiles, productFiles, summary } from "./progress-measures-load.mjs";

const NOW = new Date("2026-10-17T12:00:00Z");
let server;

beforeEach(() => {
  server = githubServer({ [PRODUCT]: productFiles({ items: 600, jobs: 400 }), [INSTANCE]: instanceFiles() });
  server.install();
});
afterEach(() => server.restore());

async function facts(scope, token) {
  const { host, instance, instanceAt } = await hosts(server, { token });
  const result = await productFacts(host, instance, instanceAt, NOW, { scope });
  return { result, seen: summary(server.log) };
}

const hundreds = (n) => Array.from({ length: n }, () => 100);
const bySize = (sizes) => [...sizes].sort((a, b) => b - a);

// TST-826001 · level: unit · module: MOD-progress-measures
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: a product of 600 backlog items, 400 job records, SPEC.md and one test file, an instance holding its participant list; a token
// input: productFacts(…, { scope: "all" })
// expect: 21 requests in all — the repository 1 with the GraphQL request of greenToMerge beside it 1 (ITM-1170; the fake logs it as a batch of no file), the commits of main and of test-results 2, the tree of main 1, the pull requests 1, the tags 1, the CI runs of the head 1, and 13 batch requests; the batches hold 100 files ten times and 1 file three times (the 1,001 files productFacts itself reads — the 600 items, the 400 job records and SPEC.md — are 10 full batches and a batch of 1; the trace graph's batch is the one test file; the instance's batch is its participant list); no file is read by a request of its own — no `<commit>.facts.json` is asked for
test("productFacts, scope all, with a token — 600 items and 400 job records are read in 13 batches of at most a hundred, 21 requests in all", async () => {
  const { seen } = await facts("all", true);
  // ITM-1170: the fake logs every POST /graphql as a batch; the 14th, of no file, is greenToMerge's beside repositoryInfo.
  assert.equal(seen.total, 21);
  assert.deepEqual(seen.kinds, { repository: 1, commit: 2, tree: 1, "pull requests": 1, tags: 1, "ci runs": 1, batch: 14 });
  assert.deepEqual(bySize(seen.batches), [...hundreds(10), 1, 1, 1, 0]);
  assert.deepEqual(seen.singles, [], "no file is read by a request of its own");
  assert.deepEqual(seen.allFiles.filter((path) => path.endsWith(".facts.json")), [], "no facts file is asked for");
});

// TST-826002 · level: unit · module: MOD-progress-measures
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the product and instance of TST-826001; a token
// input: productFacts(…, { scope: "work" })
// expect: 17 requests in all (before the read-ahead, with the same token, the same product cost 1,006: see TST-826003) — the repository 1 with the GraphQL request of greenToMerge beside it 1 (ITM-1170; a batch of no file in the fake's log), the commit 1, the tree 1, the pull requests 1, and 12 batch requests: 100 files ten times (the 600 items and 400 job records) and 1 file twice (SPEC.md and the instance's participant list); no file request — no `<commit>.facts.json` is asked for; no tags, no branch test-results, no test file read
test("productFacts, scope work, with a token — 600 items and 400 job records are read in 12 batches, 17 requests in all", async () => {
  const { seen } = await facts("work", true);
  // ITM-1170: the 13th batch, of no file, is greenToMerge's beside repositoryInfo.
  assert.equal(seen.total, 17);
  assert.deepEqual(seen.kinds, { repository: 1, commit: 1, tree: 1, "pull requests": 1, batch: 13 });
  assert.deepEqual(bySize(seen.batches), [...hundreds(10), 1, 1, 0]);
  assert.deepEqual(seen.singles, [], "no file is read by a request of its own");
  assert.deepEqual(seen.allFiles.filter((path) => path.endsWith(".facts.json")), [], "no facts file is asked for");
  assert.ok(!seen.allFiles.includes("tests/unit.test.mjs"), "the scope work reads no test file");
});

// TST-826003 · level: unit · module: MOD-progress-measures
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the product and instance of TST-826001; no token, so that the host has no batch request and every file is read by its own request, as every file was read with a token before the read-ahead
// input: productFacts(…, { scope: "work" })
// expect: 1,006 requests — the repository 1, the commit 1, the tree 1, the pull requests 1, and 1,002 files each by a request of its own (the 600 items, the 400 job records, SPEC.md and the instance's participant list); no batch request; no `<commit>.facts.json` is asked for
test("productFacts, scope work, without a token — every file is read by a request of its own, 1,006 requests (the count before the read-ahead)", async () => {
  const { seen } = await facts("work", false);
  assert.equal(seen.total, 1006);
  assert.deepEqual(seen.kinds, { repository: 1, commit: 1, tree: 1, "pull requests": 1, file: 1002 });
  assert.equal(seen.singles.length, 1002);
  assert.deepEqual(seen.singles.filter((path) => path.endsWith(".facts.json")), [], "no facts file is asked for");
});

// TST-826004 · level: unit · module: MOD-progress-measures
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the product and instance of TST-826001; a token
// input: productFacts(…, { scope: "all" }) and productFacts(…, { scope: "work" })
// expect: in each, no file is asked for twice by the server, however the file was read — by a batch or by a request of its own — and the host's cache serves every later read of a file it holds
test("productFacts — a file the page has read is not read again, in either scope", async () => {
  for (const scope of ["all", "work"]) {
    server.log.length = 0;
    const { seen } = await facts(scope, true);
    assert.deepEqual(seen.allFiles.filter((path, at) => seen.allFiles.indexOf(path) !== at), [], scope);
  }
});

// TST-826005 · level: unit · module: MOD-progress-measures
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: the product and instance of TST-826001; a token
// input: productFacts(…, { scope: "all" })
// expect: the facts — the 600 items (plan.items), 400 jobs, requirements ["FIRST RULE", "SECOND RULE"], tests of one declaration TST-001 at tests/unit.test.mjs, tags [] (the product has none), results null (the product has no branch test-results), graph "unknown" (the scope builds none); info with the default branch main; modelSince null (the product declares no model); schedule the book's default (marked default); ci with no run, the configuration not present, the job workflow not present and, as drift, the one generated file missing; resourceNeeds [] (the product has no docs/resources.md)
test("productFacts, scope all — the facts the scope adds are read, including modelSince, schedule, ci and resourceNeeds", async () => {
  const { result } = await facts("all", true);
  assert.equal(result.plan.items.length, 600);
  assert.equal(result.jobs.length, 400);
  assert.deepEqual(result.requirements, ["FIRST RULE", "SECOND RULE"]);
  assert.deepEqual(result.tests.map((t) => [t.id, t.path]), [["TST-001", "tests/unit.test.mjs"]]);
  assert.deepEqual(result.tags, []);
  assert.equal(result.results, null);
  assert.equal(result.graph, "unknown");
  assert.equal(result.info.defaultBranch, "main");
  assert.equal(result.modelSince, null);
  assert.equal(result.schedule.default, true);
  assert.deepEqual(result.ci, { runs: [], configured: false, jobWorkflow: false,
    drift: [{ path: ".github/workflows/agent-m-tests.yml", difference: "the file is missing; the schedule generates it" }] });
  assert.deepEqual(result.resourceNeeds, []);
});

// TST-826006 · level: unit · module: MOD-progress-measures
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the product and instance of TST-826001, and the product has a branch test-results of two files (runs/aaaa/r1.md, runs/aaaa/r2.md); a token
// input: productFacts(…, { scope: "all" })
// expect: results is the Snapshot of that branch — its ref "test-results", its two paths, a commit other than main's — and not null; 23 requests in all: the commits are 2, the trees 2 and the batches 13 as before, greenToMerge's GraphQL request beside the repository 1 (ITM-1170), the CI runs of the head 1, and one more, the default branch's history that resultCommits are told from (readHistory, one request for a page of commits); no file of the branch is read
test("productFacts, scope all — a branch test-results is read as a Snapshot, by its commit and its tree, and no file of it", async () => {
  server.restore();
  const results = { "runs/aaaa/r1.md": "run one\n", "runs/aaaa/r2.md": "run two\n" };
  server = githubServer({ [PRODUCT]: productFiles({ items: 600, jobs: 400 }), [INSTANCE]: instanceFiles() }, { results });
  server.install();
  const { result, seen } = await facts("all", true);
  assert.equal(result.results.ref, "test-results");
  assert.deepEqual([...result.results.paths], ["runs/aaaa/r1.md", "runs/aaaa/r2.md"]);
  assert.notEqual(result.results.commit, result.snapshot.commit);
  assert.equal(seen.total, 23);
  assert.deepEqual(seen.kinds, { repository: 1, commit: 2, tree: 2, "pull requests": 1, tags: 1, "ci runs": 1, batch: 14, other: 1 });
  assert.ok(!seen.allFiles.some((path) => path.startsWith("runs/")), "no file of the branch is read");
});
