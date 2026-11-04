// Release tests of ITM-1309 — UC-029 step 1 on the tests tree: each test shows its outcome on the commit of the version shown, read from the records of that commit alone, through one snapshot of the branch `test-results` narrowed to
// `runs/<commit>` and never through the branch's whole tree. The behaviour is docs/use-cases/UC-029-browse-the-tests-of-a-product.md (step 1: "each test shows its `TST-` identifier, a one-line title and its outcome on the latest commit of the default
// branch"; alternative flow 5b: "they are read from the result records on the branch `test-results`") as docs/architecture/MOD-trace-pages.md (Files: "the result records on the branch `test-results`") and SPEC.md (A PAGE LOAD READS THE
// REPOSITORY IN BATCHES) state it.
// Run: node --test tests/release-itm-1309-tests-tree-commit-records.test.mjs
//
// Module: MOD-trace-pages
// Guards: UC-029; A PAGE LOAD READS THE REPOSITORY IN BATCHES; EVERY TEST RUN LEAVES A RESULT RECORD; A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY
// Level: release
//
// Written for the release testing of sprint 116 by a participant who implemented none of ITM-1309 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The implementers' cases (tests/trace-pages-tests-tree-commit-records.test.mjs) take one branch of three
// records; these cases take branches of their own — twelve commits with several records each, a version whose commit has no record, a branch that cannot be read — and meet the route `tests` from the outside through its public Route.render:
// what the product's host was asked for the branch `test-results`, which paths the snapshot it handed out held, which files were read, and the outcomes the page shows. The host is the one of tests/trace-pages-harness.mjs, whose snapshot of a
// branch narrowed to folders holds only the files of those folders and refuses a read of any other path (OutsideSnapshot), and which notes every readSnapshot with the folders it was given and every read. Each count is first shown to count: the first
// assertion of a case is the page drawn from the records (a count of no read of another commit stands for a page that read the right one). The outcomes the cases expect are written out from the records they hold, by the rules of
// MOD-result-records (a test with no row is not run; passed and failed rows of a deterministic test are flaky; a model-dependent test is failed if any row failed), not read from the code. Readings the texts leave open, which the cases state:
//   - "no whole tree" is read as no readSnapshot of the branch `test-results` without folders, however many commits the branch holds.
//   - "narrowed to `runs/<version commit>`" is read as the one folder `runs/` followed by the commit of the version's own snapshot, so that a tag's version is read from the tag's commit and not from the default branch's.
//   - "a record of another commit is not held" is read of the snapshot: none of its paths lies under another commit's folder.
//   - the comparison of two releases (UC-029 step 6) draws each release's tests tree with the same function, so each release is read from its own commit's folder; its outcomes are "changed in outcome" between them.

import test from "node:test";
import assert from "node:assert/strict";
import { document, find, treeHost, until } from "./trace-pages-harness.mjs";

const { view } = await import("../src/trace-pages/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "trace");

const SPEC = ["# Ledger — Specification", "", "## Rules", "", "**BOOKS BALANCE** *(PO)*", "The books balance.", "*Check:* at review.", ""].join("\n");
const declared = (id, title) => [`// ${id} · level: unit · module: system`, "// guards: BOOKS BALANCE", "// given: a ledger", "// input: a posting", "// expect: a balanced ledger", `test("${title}", () => {});`, ""].join("\n");
const FILES = { "SPEC.md": SPEC, "tests/ledger.test.mjs": ["TST-11", "TST-12", "TST-13", "TST-14", "TST-15"].map((id) => declared(id, `${id} holds`)).join("\n") };

// The commit of the nth commit of the branch: n in hex, twice, forty digits.
const commitOf = (n) => n.toString(16).padStart(2, "0").repeat(20);
const MAIN = commitOf(0x20), TAG = commitOf(0x21), OLDER_TAG = commitOf(0x22);
const COMMITS = { main: MAIN, "v2026.2.0": TAG, "v2026.1.0": OLDER_TAG };

// A record of `commit`: rows are [test, outcome, runs]; `extra` is more front matter.
function record(commit, rows, extra = []) {
  const front = ["---", `commit: ${commit}`, "levels:", "  - unit", "occasion: commit", "participant: ci", "date: 2026-10-07 10:00 UTC", ...extra, "---"].join("\n");
  return `${front}\n## Outcomes\n\n| Test | Level | Outcome | Runs |\n|---|---|---|---|\n${rows.map(([id, outcome, runs]) => `| ${id} | unit | ${outcome} | ${runs ?? ""} |`).join("\n")}\n`;
}
const pathOf = (commit, name) => `runs/${commit}/20261007-1000-commit-${name}.md`;

// Main's commit holds three records: TST-11 passed in all (passed), TST-12 passed in one and failed in another (flaky), TST-13 failed (failed), TST-14 model-dependent, "3 of 5", passed (passed (3 of 5)); an uncommitted record says TST-11
// failed, which does not count; TST-15 has no row (not run). Eleven other commits hold records that say the opposite.
const MAIN_RECORDS = {
  [pathOf(MAIN, "a")]: record(MAIN, [["TST-11", "passed"], ["TST-12", "passed"], ["TST-13", "failed"], ["TST-14", "passed", "3 of 5"]]),
  [pathOf(MAIN, "b")]: record(MAIN, [["TST-11", "passed"], ["TST-12", "failed"]]),
  [pathOf(MAIN, "c")]: record(MAIN, [["TST-11", "failed"]], ["uncommitted: true"]),
};
const MAIN_SHOWN = [["TST-11", "passed"], ["TST-12", "flaky"], ["TST-13", "failed"], ["TST-14", "passed (3 of 5)"], ["TST-15", "not run"]];
const OTHER_COMMITS = Array.from({ length: 11 }, (_, at) => commitOf(at + 1));
const OTHERS = Object.fromEntries(OTHER_COMMITS.flatMap((commit, at) => ["a", "b"].map((name) => [pathOf(commit, name),
  record(commit, ["TST-11", "TST-12", "TST-13", "TST-14", "TST-15"].map((id) => [id, (at + id.length) % 2 ? "failed" : "passed"]))])));
const TAG_RECORDS = { [pathOf(TAG, "a")]: record(TAG, [["TST-11", "failed"], ["TST-12", "passed"], ["TST-13", "passed"], ["TST-14", "failed", "1 of 5"], ["TST-15", "passed"]]) };
const TAG_SHOWN = [["TST-11", "failed"], ["TST-12", "passed"], ["TST-13", "passed"], ["TST-14", "failed (1 of 5)"], ["TST-15", "passed"]];
const OLDER_RECORDS = { [pathOf(OLDER_TAG, "a")]: record(OLDER_TAG, [["TST-11", "passed"], ["TST-12", "passed"], ["TST-13", "passed"], ["TST-14", "passed", "5 of 5"]]) };
const ALL_RECORDS = { ...MAIN_RECORDS, ...OTHERS, ...TAG_RECORDS, ...OLDER_RECORDS };

/** The product's host over the harness: the version snapshots of the refs carry the commits of COMMITS; `held` notes the paths each snapshot of the branch test-results was handed with. */
function hostOf(records = ALL_RECORDS, { branch = true } = {}) {
  const base = treeHost({ trees: { main: FILES, "v2026.2.0": FILES, "v2026.1.0": FILES, ...(branch ? { "test-results": records } : {}) }, tags: ["v2026.2.0", "v2026.1.0"] });
  const held = [];
  return { ...base, held, async readSnapshot(ref, options) {
    const snapshot = await base.readSnapshot(ref, options);
    if (ref === "test-results") held.push([...snapshot.paths]);
    return ref in COMMITS ? { ...snapshot, commit: COMMITS[ref] } : snapshot;
  } };
}
const withClass = (root, name) => find(root, (node) => String(node.className).split(" ").includes(name));
const outcomesOf = (target) => withClass(target, "tests-case").map((node) => [withClass(node, "tests-id")[0].textContent, withClass(node, "tests-outcome")[0].textContent]);
async function render(host, params = {}) {
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, { product: { address: "https://github.com/acme/ledger", host } }, { key: "tests", ref: "main", ...params });
  await until(() => outcomesOf(target).length >= 5);
  return target;
}
const ofResults = (host) => host.log.narrowed.filter(([ref]) => ref === "test-results");
const recordsRead = (host) => host.log.reads.filter((path) => path.startsWith("runs/"));
const commitsOfPaths = (paths) => [...new Set(paths.map((path) => /^runs\/([^/]+)\//.exec(path)?.[1]))].sort();

// TST-1309301 · level: release · module: MOD-trace-pages
// guards: UC-029; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: a branch test-results holding the records of fourteen commits — main's (three records, one of them marked uncommitted), eleven other commits' (two each), the tag v2026.2.0's and the older tag's — and a Host that refuses a read outside the folders a snapshot was narrowed to
// input: Route.render with the key "tests" at main
// expect: known positive first — the page shows TST-11 passed, TST-12 flaky, TST-13 failed, TST-14 "passed (3 of 5)" and TST-15 not run, which main's records say and the records of every other commit contradict; exactly one readSnapshot of test-results, narrowed to the one folder runs/<main's commit>, and no readSnapshot of it without folders, however many commits the branch holds
// Planted fault: the whole tree of the branch read (`host.readSnapshot(RESULTS_BRANCH)` without `folders` in outcomesOf, src/trace-pages/tests.mjs) fails the folders and the count of whole trees; a snapshot narrowed to every record's folder (`runs/`) fails the one folder.
test("TST-1309301 the tests tree of main reads one snapshot of test-results narrowed to the folder of main's commit, whatever the branch holds, and shows main's outcomes", async () => {
  const host = hostOf();
  const target = await render(host);
  assert.deepEqual(outcomesOf(target), MAIN_SHOWN, "known positive: main's outcomes are shown");
  const read = ofResults(host);
  assert.equal(read.length, 1, "one snapshot of the branch");
  assert.deepEqual(read[0][1], [`runs/${MAIN}`]);
  assert.equal(read.filter(([, folders]) => folders === null).length, 0, "no whole tree of the branch");
});

// TST-1309302 · level: release · module: MOD-trace-pages
// guards: UC-029; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the branch of TST-1309301
// input: Route.render with the key "tests" at main
// expect: counter-proof — the snapshot of the branch holds main's three records (known positive: they are held) and no path under the folder of any other commit, the tags' and the eleven others'; the files read are main's records alone, and each of them once at most
// Planted fault: a snapshot narrowed to every commit's folder (`folders: ["runs"]` in outcomesOf, src/trace-pages/tests.mjs) holds the records of the other commits and fails the paths held; a count of reads alone would pass it, since resultsAt reads only the version's commit's records.
test("TST-1309302 the snapshot of test-results holds the records of main's commit and none of another commit, and only those are read", async () => {
  const host = hostOf();
  await render(host);
  assert.equal(host.held.length, 1, "known positive: the host noted the snapshot of the branch");
  assert.deepEqual([...host.held[0]].sort(), Object.keys(MAIN_RECORDS).sort(), "main's three records and nothing else");
  assert.deepEqual(commitsOfPaths(host.held[0]), [MAIN], "no record of another commit is held");
  assert.deepEqual([...new Set(recordsRead(host))].sort(), Object.keys(MAIN_RECORDS).sort(), "the records read are main's");
  assert.equal(recordsRead(host).length, new Set(recordsRead(host)).size, "each read once");
});

// TST-1309303 · level: release · module: MOD-trace-pages
// guards: UC-029; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the branch of TST-1309301, and the tag v2026.2.0 at a commit that is not main's
// input: Route.render with the key "tests" at the tag v2026.2.0
// expect: the page shows the tag's outcomes (TST-11 failed, TST-12 passed, TST-13 passed, TST-14 "failed (1 of 5)", TST-15 passed), none of main's; one readSnapshot of test-results, narrowed to the one folder runs/<the tag's commit>, none without folders; the snapshot holds the tag's one record and no record of main or of another commit
// Planted fault: a tests tree that reads the default branch's commit whatever the version (the folder made `runs/` plus the commit of `await host.readSnapshot("main")` in outcomesOf, src/trace-pages/tests.mjs) shows main's outcomes at the tag and fails the outcomes and the folder.
test("TST-1309303 at a tag the tests tree reads the folder of the tag's commit alone and shows the tag's outcomes", async () => {
  const host = hostOf();
  const target = await render(host, { ref: "v2026.2.0" });
  assert.deepEqual(outcomesOf(target), TAG_SHOWN, "known positive: the tag commit's outcomes are shown, not main's");
  const read = ofResults(host);
  assert.equal(read.length, 1, "one snapshot of the branch");
  assert.deepEqual(read[0][1], [`runs/${TAG}`]);
  assert.deepEqual(host.held, [Object.keys(TAG_RECORDS)], "the tag's record alone is held");
  assert.deepEqual(commitsOfPaths(recordsRead(host)), [TAG]);
});

// TST-1309304 · level: release · module: MOD-trace-pages
// guards: UC-029; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the branch of TST-1309301, and the tags v2026.2.0 and v2026.1.0, the older one with four rows and none for TST-15
// input: Route.render with the key "tests" at v2026.2.0 and the param compare v2026.1.0
// expect: the page shows the tag's outcomes as in TST-1309303; the comparison lists the outcomes changed between the releases — TST-11 "passed → failed", TST-14 "passed (5 of 5) → failed (1 of 5)", TST-15 "not run → passed" — and TST-12 and TST-13 as unchanged (not listed); the snapshots of test-results read are two, narrowed to runs/<the tag's commit> and runs/<the older tag's commit> each, and none without folders
// Planted fault: the older release read through the version shown (`host.readSnapshot(other)` made `host.readSnapshot(shown.ref)` in compareReleases, src/trace-pages/tests.mjs) lists no change in outcome and reads the newer folder twice, and the case fails the list and the folders; a whole tree read for either release fails the folders.
test("TST-1309304 comparing two releases reads each release's records from the folder of its own commit and lists the outcomes that changed", async () => {
  const host = hostOf();
  const target = await render(host, { ref: "v2026.2.0", compare: "v2026.1.0" });
  await until(() => withClass(target, "tests-compare-outcome").length > 0);
  assert.deepEqual(outcomesOf(target), TAG_SHOWN, "known positive: the tag's outcomes are shown");
  const changed = withClass(withClass(target, "tests-compare-outcome")[0], "tests-compared").map((node) => node.textContent);
  assert.deepEqual(withClass(withClass(target, "tests-compare-outcome")[0], "tests-compared-id").map((node) => node.textContent), ["TST-11", "TST-14", "TST-15"]);
  assert.ok(changed[0].includes("passed → failed"), changed[0]);
  assert.ok(changed[1].includes("passed (5 of 5) → failed (1 of 5)"), changed[1]);
  assert.ok(changed[2].includes("not run → passed"), changed[2]);
  const read = ofResults(host);
  assert.deepEqual(read.map(([, folders]) => folders).sort(), [[`runs/${TAG}`], [`runs/${OLDER_TAG}`]].sort(), "each release from the folder of its own commit, none whole");
});

// TST-1309305 · level: release · module: MOD-trace-pages
// guards: UC-029; EVERY TEST RUN LEAVES A RESULT RECORD
// given: the product of TST-1309301 whose main commit has no record on the branch test-results (the folder runs/<main's commit> does not exist), and a product with no branch test-results
// input: Route.render with the key "tests" at main, for each
// expect: with the branch and no record of the commit, the five tests are shown "not run", the snapshot is narrowed to runs/<main's commit> and holds nothing, and no problem is shown (a commit that CI has not run yet is not a failure to read); with no branch the five are "not run" too and the page says "The results could not be read"
// Planted fault: an empty narrowed snapshot taken as a failure (`if (!results.paths.length) throw new Error("no records")` after the readSnapshot in outcomesOf, src/trace-pages/tests.mjs) shows the problem for the commit without records and fails the first half; a failure to read the branch swallowed (`problem = null` in the catch) fails the second.
test("TST-1309305 a version whose commit has no record shows every test not run without a problem, and a branch that cannot be read says so", async () => {
  const withoutMain = Object.fromEntries(Object.entries(ALL_RECORDS).filter(([path]) => !path.startsWith(`runs/${MAIN}/`)));
  const host = hostOf(withoutMain);
  const target = await render(host);
  assert.deepEqual(outcomesOf(target), MAIN_SHOWN.map(([id]) => [id, "not run"]), "every test is not run");
  assert.deepEqual(ofResults(host).map(([, folders]) => folders), [[`runs/${MAIN}`]]);
  assert.deepEqual(host.held, [[]], "the narrowed snapshot holds nothing");
  assert.equal(withClass(target, "traces-problem").length, 0, "no problem is shown");
  const gone = hostOf(ALL_RECORDS, { branch: false });
  const bare = await render(gone);
  assert.deepEqual(outcomesOf(bare), MAIN_SHOWN.map(([id]) => [id, "not run"]));
  assert.match(withClass(bare, "traces-problem").map((node) => node.textContent).join(" "), /The results could not be read/);
});
