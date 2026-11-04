// MOD-trace-pages' detail of a test (`trace/tests/<TST>`) draws a history of the newest ten runs and reads the next ten on request (ITM-1276). The behaviour is docs/architecture/MOD-trace-pages.md's (Files): "The history
// reads the records that the newest ten commits of the branch `test-results` added (`readHistory` with their changes) and those of the release tags' commits, through a snapshot of that branch narrowed to them
// (`readSnapshot` with `folders`), in one batch; *Earlier runs* reads the next ten."
//
// Run: node --test tests/trace-pages-test-history-newest.test.mjs
//
// Module: MOD-trace-pages
// Guards: UC-029; EVERY TEST RUN LEAVES A RESULT RECORD; A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY
// Level: component
//
// The route is called through its public Route.render with the key "tests" and the param row. The product's Host is the one of tests/trace-pages-harness.mjs, whose branch `test-results` holds the records of
// the cases and has a history of its own: one commit for each record file, in the order of the tree taken as newest first, each adding that file; it notes every readHistory, every readSnapshot with the folders it was
// given and every readMany. Each case states its expected requests in its own text; none is read from a document. Readings the cases take, each from the sentence quoted:
//   - "the records that the newest ten commits of the branch `test-results` added": the commits are the ten first of that branch's history, newest first; the history is read once, with `ref: "test-results"`, `limit: 10`
//     and the changes of each commit.
//   - "through a snapshot of that branch narrowed to them (`readSnapshot` with `folders`), in one batch": one snapshot of the branch is read for the page, its folders the record files those ten commits added and the folder
//     `runs/<commit>` of each release tag's commit, and no other; the records the snapshot holds are fetched by one readMany, and a record outside the snapshot is never read.
//   - "*Earlier runs* reads the next ten": the control reads the ten commits that come after the ten shown (a history read from the parent of the last commit shown, as the review pages' *Older* reads one) with their
//     changes, one snapshot narrowed to the files they added, one readMany; the marks of the ten are added below the others. The control is offered while the ten read were the last of a history that goes on.
//   - "no recursive tree of `test-results`" is read of the history of a test and of the tests tree drawn beside the detail: the tests tree reads the branch through a snapshot narrowed to `runs/<commit>` of the version
//     shown (ITM-1309), which the history's own snapshot is told from by its folders; the cases count no whole tree of the branch at all.
//   - the marks are the commits those histories name; a release tag's commit that is not among them gives its row among the releases and no mark.

import test from "node:test";
import assert from "node:assert/strict";
import { document, find, treeHost, until } from "./trace-pages-harness.mjs";

const { view } = await import("../src/trace-pages/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "trace");

const SPEC = ["# Newest fixture — Specification", "", "## Only section", "", "**ALPHA RULE** *(Vibe Coding)*", "Alpha rule.", "*Check:* at review.", ""].join("\n");
const ALPHA = ["// TST-801 · level: unit · module: system", "// guards: ALPHA RULE", "// given: a fixture", "// input: a call", "// expect: a result", "test(\"alpha holds\", () => {});", ""].join("\n");
const MAIN_FILES = { "SPEC.md": SPEC, "tests/alpha.test.mjs": ALPHA };

// The commit of the nth run: n in hex, twice, forty digits, so that its first seven digits name n (n = 30 is "1e1e1e1").
const commitOf = (n) => n.toString(16).padStart(2, "0").repeat(20);
const shortOf = (n) => commitOf(n).slice(0, 7);
const TAG_COMMIT = commitOf(12);

function record(commit, outcome) {
  const front = ["---", `commit: ${commit}`, "levels:", "  - unit", "occasion: commit", "participant: ci", "date: 2026-10-07 10:00 UTC", "---"].join("\n");
  return `${front}\n## Outcomes\n\n| Test | Level | Outcome | Runs |\n|---|---|---|---|\n| TST-801 | unit | ${outcome} | |\n`;
}
const pathOf = (n, name = "a") => `runs/${commitOf(n)}/20261001-1000-commit-${name}.md`;
// The records of the branch, newest first: [run number, name of the record, outcome]. TST-801 passed on the odd runs and failed on the even ones.
const outcomeOf = (n) => (n % 2 ? "passed" : "failed");
const RUNS = Array.from({ length: 30 }, (_, at) => [30 - at, "a", outcomeOf(30 - at)]);
const resultsOf = (records) => Object.fromEntries(records.map(([n, name, outcome]) => [pathOf(n, name), record(commitOf(n), outcome)]));

function hostOf(records = RUNS) {
  const base = treeHost({ trees: { main: MAIN_FILES, "test-results": resultsOf(records) }, onDefault: records.map(([n]) => commitOf(n)) });
  return { ...base, async listTags() { return [{ name: "v2026.1.0", commit: TAG_COMMIT }]; }, webLinks: () => ({ file: (path, ref) => `https://example.test/blob/${ref}/${path}`, run: (id) => `https://example.test/actions/runs/${id}` }) };
}
const hasClass = (name) => (node) => String(node.className).split(" ").includes(name);
const marksOf = (target) => find(target, hasClass("test-history-commit")).map((node) => node.textContent);
const earlierOf = (target) => find(target, hasClass("test-history-earlier"))[0];
async function render(host, expected) {
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, { product: { address: "https://github.com/acme/product", host }, }, { key: "tests", ref: "main", row: "TST-801" });
  await until(() => marksOf(target).length >= expected);
  await new Promise((resolve) => setTimeout(resolve, 30));
  return target;
}
const click = async (button, done) => { button.dispatchEvent(new Event("click")); await until(done); await new Promise((resolve) => setTimeout(resolve, 30)); };
const ofResults = (host) => host.log.histories.filter(([, options]) => options?.ref === "test-results" || /^[0-9a-f]{40}$/.test(options?.ref ?? ""));
// The tests tree's snapshot of the branch, narrowed to the folder of the version's commit, and the history's, narrowed to the record files of its commits.
const treeFoldersOf = (host) => [`runs/${host.commitOf("main")}`];
const isTreeReading = (host, folders) => folders.length === 1 && folders[0] === treeFoldersOf(host)[0];
const narrowedOfTree = (host) => host.log.narrowed.filter(([ref, folders]) => ref === "test-results" && folders !== null && isTreeReading(host, folders));
const narrowedOfResults = (host) => host.log.narrowed.filter(([ref, folders]) => ref === "test-results" && folders !== null && !isTreeReading(host, folders));
// The snapshots of the branch read without folders: neither the tests tree nor the history reads one.
const wholeTrees = (host) => host.log.narrowed.filter(([ref, folders]) => ref === "test-results" && folders === null);
const manyOfRecords = (host) => host.log.manys.filter((paths) => paths.every((path) => path.startsWith("runs/")));

// TST-1276001 · level: component · module: MOD-trace-pages
// guards: UC-029; EVERY TEST RUN LEAVES A RESULT RECORD
// given: a branch test-results of 30 records, one for each of the runs 1 to 30 (the 30th the newest), TST-801 passing on the odd runs and failing on the even ones; one release tag, v2026.1.0, at the commit of the 12th run; a counting Host
// input: the detail of TST-801 opened
// expect: one readHistory of the branch (path null, ref test-results, limit 10, with changes); one readSnapshot of the branch, narrowed to the ten record files of the runs 30 to 21 and the folder of the 12th run's commit, no other; one readMany of those ten files and the tag commit's one record; ten marks, "1e1e1e1 failed" down to "1515151 passed" (the runs 30 to 21), newest first; one row "v2026.1.0 failed" (the 12th run) and no mark for the 12th run
test("opening a test reads one history, one narrowed snapshot and one batch, and shows the marks of the newest ten runs", async () => {
  const host = hostOf();
  const target = await render(host, 10);
  const histories = ofResults(host);
  assert.equal(histories.length, 1, "one history of the branch");
  assert.equal(histories[0][0], null);
  assert.equal(histories[0][1].ref, "test-results");
  assert.equal(histories[0][1].limit, 10);
  assert.notEqual(histories[0][1].changes, false, "with the files each commit added");
  const newest = [30, 29, 28, 27, 26, 25, 24, 23, 22, 21];
  const narrowed = narrowedOfResults(host);
  assert.equal(narrowed.length, 1, "one snapshot of the branch");
  assert.deepEqual([...narrowed[0][1]].sort(), [...newest.map((n) => pathOf(n)), `runs/${TAG_COMMIT}`].sort());
  const batches = manyOfRecords(host);
  assert.equal(batches.length, 1, "one batch of records");
  assert.deepEqual([...batches[0]].sort(), [...newest.map((n) => pathOf(n)), pathOf(12)].sort());
  assert.deepEqual(marksOf(target), newest.map((n) => `${shortOf(n)} ${outcomeOf(n)}`));
  assert.deepEqual(find(target, hasClass("test-history-release")).map((node) => node.textContent), ["v2026.1.0 failed"]);
  assert.ok(earlierOf(target), "known positive: the control to read earlier runs is offered, the history goes on");
});

// TST-1276002 · level: component · module: MOD-trace-pages
// guards: UC-029; EVERY TEST RUN LEAVES A RESULT RECORD
// given: the fixture of TST-1276001, opened
// input: Earlier runs clicked; clicked again; clicked a third time
// expect: after the first click, a second readHistory of the branch from the parent of the 21st run's commit (limit 10, with changes), one more snapshot of the branch narrowed to the files of the runs 20 to 11 and nothing else, one more readMany of those ten files; twenty marks, the runs 30 to 11 in that order, the release row unchanged; the control still offered. After the second click, the runs 10 to 1 are added, thirty marks, and the control is gone: the history ends. The branch's tree is never read whole.
test("Earlier runs reads the next ten runs through one history, one narrowed snapshot and one batch, and ends with the history", async () => {
  const host = hostOf();
  const target = await render(host, 10);
  await click(earlierOf(target), () => marksOf(target).length >= 20);
  const histories = ofResults(host);
  assert.equal(histories.length, 2);
  assert.equal(histories[1][0], null);
  assert.match(histories[1][1].ref, /^[0-9a-f]{40}$/, "from a commit, the parent of the last commit shown, not from the branch's head");
  assert.notEqual(histories[1][1].ref, "test-results");
  assert.equal(histories[1][1].limit, 10);
  assert.notEqual(histories[1][1].changes, false);
  const second = [20, 19, 18, 17, 16, 15, 14, 13, 12, 11];
  const narrowed = narrowedOfResults(host);
  assert.equal(narrowed.length, 2);
  assert.deepEqual([...narrowed[1][1]].sort(), second.map((n) => pathOf(n)).sort());
  const batches = manyOfRecords(host);
  assert.equal(batches.length, 2);
  assert.deepEqual([...batches[1]].sort(), second.map((n) => pathOf(n)).sort());
  assert.deepEqual(marksOf(target), Array.from({ length: 20 }, (_, at) => `${shortOf(30 - at)} ${outcomeOf(30 - at)}`));
  assert.deepEqual(find(target, hasClass("test-history-release")).map((node) => node.textContent), ["v2026.1.0 failed"]);
  assert.ok(earlierOf(target), "the history goes on after the twentieth run");
  await click(earlierOf(target), () => marksOf(target).length >= 30);
  assert.deepEqual(marksOf(target), Array.from({ length: 30 }, (_, at) => `${shortOf(30 - at)} ${outcomeOf(30 - at)}`));
  assert.equal(earlierOf(target), undefined, "the history ends with the first run");
  assert.equal(wholeTrees(host).length, 0, "the branch's tree is never read whole, by the history or by the tests tree");
});

// TST-1276003 · level: component · module: MOD-trace-pages
// guards: UC-029
// given: the fixture of TST-1276001, opened; the harness fails a read of any file outside the folders a snapshot was narrowed to
// input: the detail of TST-801 opened; Earlier runs clicked
// expect: of the snapshots of the branch test-results, none read without folders; one narrowed to the folder of the version's commit (the tests tree's reading of the latest outcomes) and one narrowed to the history's record files, also after Earlier runs one more of the history's; the record files read are the ten newest and the tag commit's record, then the next ten, none of the other ten; no line of a history that could not be read
test("the records of runs not asked for are not read, and the history reads no whole tree of the branch", async () => {
  const host = hostOf();
  const target = await render(host, 10);
  assert.equal(wholeTrees(host).length, 0, "the whole tree of the branch is read for neither the outcomes of the tests tree nor the history");
  assert.equal(narrowedOfTree(host).length, 1, "known positive: the tests tree's own snapshot of the branch is narrowed to its commit's folder");
  assert.equal(narrowedOfResults(host).length, 1, "known positive: the history's own snapshot of the branch is narrowed");
  const readRuns = () => new Set(host.log.reads.filter((path) => path.startsWith("runs/")));
  const first = [30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 12].map((n) => pathOf(n));
  assert.deepEqual([...readRuns()].sort(), first.sort());
  await click(earlierOf(target), () => marksOf(target).length >= 20);
  assert.deepEqual([...readRuns()].sort(), [...first, ...[20, 19, 18, 17, 16, 15, 14, 13, 11].map((n) => pathOf(n))].sort(), "the second ten, of which the run of the tag was read with the first");
  assert.deepEqual(find(target, hasClass("traces-problem")).map((node) => node.textContent), []);
});

// TST-1276004 · level: component · module: MOD-trace-pages
// guards: UC-029; A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY
// given: a branch of 11 records, newest first: the 12th run's record "a" passed; the 11th run's records "a" passed and "b" failed, both among the newest ten commits; the 10th to the 3rd runs, each one record, as in TST-1276001
// input: the detail of TST-801 opened
// expect: one readHistory of the branch; the mark of the 11th run reads "0b0b0b0 flaky" and has the class test-history-flaky; the mark of the 12th run, passed on its only record, reads "0c0c0c0 passed" and is not marked flaky; exactly one mark is flaky
test("a commit that passed and failed among the newest ten is still marked flaky", async () => {
  const records = [[12, "a", "passed"], [11, "a", "passed"], [11, "b", "failed"], ...[10, 9, 8, 7, 6, 5, 4, 3].map((n) => [n, "a", outcomeOf(n)])];
  const host = hostOf(records);
  const target = await render(host, 9);
  assert.equal(ofResults(host).length, 1, "the marks come from the one history read of the newest ten commits");
  const marks = marksOf(target);
  assert.ok(marks.includes(`${shortOf(11)} flaky`), `the 11th run is flaky: ${marks.join("; ")}`);
  assert.ok(marks.includes(`${shortOf(12)} passed`), "the 12th run, one passing record, is passed");
  assert.equal(find(target, hasClass("test-history-flaky")).length, 1, "known positive: only the flipping commit is marked");
});
