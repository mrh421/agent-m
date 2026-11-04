// Release tests of ITM-1276 — UC-029 step 5 on the detail of a test: the history shows one mark per commit that ran the test, ten runs at a time, and *Earlier runs* reads the next ten. The behaviour is
// docs/architecture/MOD-trace-pages.md's (Files: "The history reads the records that the newest ten commits of the branch `test-results` added (`readHistory` with their changes) and those of the release tags'
// commits, through a snapshot of that branch narrowed to them (`readSnapshot` with `folders`), in one batch; *Earlier runs* reads the next ten.") and UC-029's (step 5: "one mark per commit of the default branch
// where it ran ... A flaky commit is marked as such.").
// Run: node --test tests/release-itm-1276-test-history-ten-at-a-time.test.mjs
//
// Module: MOD-trace-pages
// Guards: UC-029; EVERY TEST RUN LEAVES A RESULT RECORD; A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY
// Level: release
//
// Written for the release testing of sprint 115 by a participant who implemented none of ITM-1276 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The implementers' cases
// (tests/trace-pages-test-history-newest.test.mjs) take a branch of thirty records; these cases take products of their own — twenty-five records, exactly twenty, exactly ten, and one whose flaky commits stand on
// both pages — and meet the page from the outside through the route `tests`: what the product's host was asked while the history was drawn and after each click on *Earlier runs*, which record files were read, and what
// the marks read. The host is the one of tests/trace-pages-harness.mjs, whose branch `test-results` has a history of its own (one commit for each record file, newest first), refuses a read of a file outside the folders
// a snapshot was narrowed to, and notes every readHistory, every readSnapshot with its folders, every read and every readMany. Each count is first shown to count: the first assertion of a case is that the page is drawn
// and the host noted the reads (a count of zero stands for nothing read, not for a log that sees nothing). Readings the texts leave open, which the cases state:
//   - "in one batch": one readMany of the record files for a page of ten, and no read of a record outside it; the tag commit's record is read with the first page.
//   - "Earlier runs reads the next ten": a history read from the parent of the last commit shown, with `limit: 10`, one snapshot narrowed to those commits' records and one batch; the control is offered while the ten read
//     were a full page whose last commit has a parent, and it is gone once the history ends — after a page of fewer than ten, or of ten whose last commit has none.
//   - "records of runs not asked for are not read": over a branch of twenty-five records, nothing but the pages clicked is read.
//   - a mark is the commit's, so a commit with two records, one passed and one failed, is one mark, read flaky by the page that holds its records.

import test from "node:test";
import assert from "node:assert/strict";
import { document, find, treeHost, until } from "./trace-pages-harness.mjs";

const { view } = await import("../src/trace-pages/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "trace");

const SPEC = ["# Ledger — Specification", "", "## Rules", "", "**BOOKS BALANCE** *(PO)*", "The books balance.", "*Check:* at review.", ""].join("\n");
const TEST_FILE = ["// TST-91 · level: unit · module: system", "// guards: BOOKS BALANCE", "// given: a ledger", "// input: a posting", "// expect: a balanced ledger", "test(\"balances\", () => {});", ""].join("\n");
const MAIN_FILES = { "SPEC.md": SPEC, "tests/ledger.test.mjs": TEST_FILE };

// The commit of the nth run: n in hex, twice, forty digits, so that its first seven digits name n.
const commitOf = (n) => n.toString(16).padStart(2, "0").repeat(20);
const shortOf = (n) => commitOf(n).slice(0, 7);
const pathOf = (n, name = "a") => `runs/${commitOf(n)}/20261001-1000-commit-${name}.md`;
function record(n, outcome) {
  const front = ["---", `commit: ${commitOf(n)}`, "levels:", "  - unit", "occasion: commit", "participant: ci", "date: 2026-10-07 10:00 UTC", "---"].join("\n");
  return `${front}\n## Outcomes\n\n| Test | Level | Outcome | Runs |\n|---|---|---|---|\n| TST-91 | unit | ${outcome} | |\n`;
}
const outcomeOf = (n) => (n % 3 === 0 ? "failed" : "passed");
/** The records of runs `count` down to 1, newest first: [run, name, outcome]. */
const runs = (count) => Array.from({ length: count }, (_, at) => [count - at, "a", outcomeOf(count - at)]);
const resultsOf = (records) => Object.fromEntries(records.map(([n, name, outcome]) => [pathOf(n, name), record(n, outcome)]));
const range = (from, to) => Array.from({ length: from - to + 1 }, (_, at) => from - at);

/** The product's host over the harness: the branch `test-results` of `records`, and a release tag at the commit of the run `tagged`. */
function hostOf(records, tagged = null) {
  const base = treeHost({ trees: { main: MAIN_FILES, "test-results": resultsOf(records) }, onDefault: records.map(([n]) => commitOf(n)) });
  return { ...base, async listTags() { return tagged === null ? [] : [{ name: "v2026.2.0", commit: commitOf(tagged) }]; } };
}
const hasClass = (name) => (node) => String(node.className).split(" ").includes(name);
const marksOf = (target) => find(target, hasClass("test-history-commit")).map((node) => node.textContent);
const earlierOf = (target) => find(target, hasClass("test-history-earlier"))[0];
const waitFor = async (done) => { await until(done); await new Promise((resolve) => setTimeout(resolve, 30)); };
async function render(host, expected) {
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, { product: { address: "https://github.com/acme/ledger", host } }, { key: "tests", ref: "main", row: "TST-91" });
  await waitFor(() => marksOf(target).length >= expected);
  return target;
}
const click = async (target, expected) => { earlierOf(target).dispatchEvent(new Event("click")); await waitFor(() => marksOf(target).length >= expected); };
/** The histories of the branch `test-results` the page read: from the branch's head, or from a commit of it. */
const historiesOf = (host) => host.log.histories.filter(([, options]) => options?.ref === "test-results" || /^[0-9a-f]{40}$/.test(options?.ref ?? ""));
// The snapshots of the branch narrowed for the history: the tests tree's own, narrowed to `runs/<version commit>`, is left out.
const narrowedOf = (host) => host.log.narrowed.filter(([ref, folders]) => ref === "test-results" && folders !== null && !(folders.length === 1 && folders[0] === `runs/${host.commitOf("main")}`));
const batchesOf = (host) => host.log.manys.filter((paths) => paths.every((path) => path.startsWith("runs/")));
const readRecords = (host) => host.log.reads.filter((path) => path.startsWith("runs/"));
const marks = (numbers) => numbers.map((n) => `${shortOf(n)} ${outcomeOf(n)}`);

// TST-1276301 · level: release · module: MOD-trace-pages
// guards: UC-029; EVERY TEST RUN LEAVES A RESULT RECORD
// given: TST-91, which ran on twenty-five commits of the branch test-results, one record each, the 25th the newest, passing except on every third run; a release tag, v2026.2.0, at the commit of the 5th run; a counting host that refuses a read outside the folders a snapshot was narrowed to
// input: the detail of TST-91 opened and left alone
// expect: known positive first — the host noted reads of record files and a batch. One readHistory of the branch (path null, ref test-results, limit 10, with changes); one readSnapshot of it for the history, told from the tests tree's own (narrowed to the folder of the version's commit) by its folders, narrowed to the record files of the runs 25 to 16 and the folder of the 5th run's commit, and no other folder; one readMany of those ten files and the tag commit's one; exactly the files of the runs 25 to 16 and 5 read, and none of the runs 15 to 6 and 4 to 1; ten marks, the runs 25 to 16 newest first, with their outcomes; one release row, "v2026.2.0 passed"; the control Earlier runs offered
// Planted fault: a page that reads more than the newest ten (`limit: HISTORY_PAGE` made `limit: 1000` in runsPage of src/trace-pages/test-detail.mjs) fails the limit; a page that reads no batch (`await results.readMany?.(results.paths)` left out) fails the one batch; a snapshot without the tag's folder, or without folders at all (`readSnapshot(RESULTS_BRANCH)`), fails the folders.
test("TST-1276301 opening a test of twenty-five runs reads one history, one narrowed snapshot and one batch of the newest ten records and the tag's, and no other", async () => {
  const host = hostOf(runs(25), 5);
  const target = await render(host, 10);
  assert.equal(readRecords(host).length > 0 && batchesOf(host).length > 0, true, "known positive: the host noted reads and a batch");
  const histories = historiesOf(host);
  assert.equal(histories.length, 1, "one history of the branch");
  assert.deepEqual([histories[0][0], histories[0][1].ref, histories[0][1].limit, histories[0][1].changes], [null, "test-results", 10, true]);
  const narrowed = narrowedOf(host);
  assert.equal(narrowed.length, 1, "one snapshot of the branch, narrowed for the history");
  assert.deepEqual([...narrowed[0][1]].sort(), [...range(25, 16).map((n) => pathOf(n)), `runs/${commitOf(5)}`].sort());
  assert.deepEqual(batchesOf(host).map((paths) => [...paths].sort()), [[...range(25, 16), 5].map((n) => pathOf(n)).sort()], "one batch");
  assert.deepEqual([...new Set(readRecords(host))].sort(), [...range(25, 16), 5].map((n) => pathOf(n)).sort(), "no record of a run not asked for is read");
  assert.deepEqual(marksOf(target), marks(range(25, 16)));
  assert.deepEqual(find(target, hasClass("test-history-release")).map((node) => node.textContent), [`v2026.2.0 ${outcomeOf(5)}`]);
  assert.ok(earlierOf(target), "the history goes on, so Earlier runs is offered");
});

// TST-1276302 · level: release · module: MOD-trace-pages
// guards: UC-029; EVERY TEST RUN LEAVES A RESULT RECORD
// given: the product of TST-1276301, opened
// input: Earlier runs clicked; clicked again
// expect: after the first click a second readHistory from a commit (not the branch's head; limit 10, with changes), one more snapshot narrowed to exactly the files of the runs 15 to 6, one more batch of those ten, twenty marks (the runs 25 to 6, in that order) and the control still offered; after the second click a third readHistory, a third snapshot narrowed to exactly the files of the runs 5 to 1, a third batch of those five, twenty-five marks in the order of the runs and no control, since the page held fewer than ten; across the three pages the record files read are the twenty-five, and the branch's tree was read whole for nothing
// Planted fault: a second page read from the branch's head again (`runsPage(host, next)` made `runsPage(host, RESULTS_BRANCH)` in historyPart of src/trace-pages/test-detail.mjs) repeats the newest ten and fails the second history; a control offered after a full page whatever the history holds (`entries.at(-1).commit` in place of `entries.at(-1).parents[0] ?? null` in `next` of runsPage) fails the end of the history.
test("TST-1276302 Earlier runs reads the next ten and then the last five through one history, one narrowed snapshot and one batch each, and the control ends with the history", async () => {
  const host = hostOf(runs(25), 5);
  const target = await render(host, 10);
  assert.equal(marksOf(target).length, 10, "known positive: the first page is drawn");
  await click(target, 20);
  const histories = historiesOf(host);
  assert.equal(histories.length, 2);
  assert.match(histories[1][1].ref, /^[0-9a-f]{40}$/, "from the parent of the last commit shown, not from the branch's head");
  assert.deepEqual([histories[1][1].limit, histories[1][1].changes], [10, true]);
  assert.deepEqual([...narrowedOf(host)[1][1]].sort(), range(15, 6).map((n) => pathOf(n)).sort());
  assert.deepEqual([...batchesOf(host)[1]].sort(), range(15, 6).map((n) => pathOf(n)).sort());
  assert.deepEqual(marksOf(target), marks(range(25, 6)));
  assert.ok(earlierOf(target), "ten more may follow");
  await click(target, 25);
  assert.equal(historiesOf(host).length, 3);
  assert.deepEqual([...narrowedOf(host)[2][1]].sort(), range(5, 1).map((n) => pathOf(n)).sort());
  assert.deepEqual([...batchesOf(host)[2]].sort(), range(5, 1).map((n) => pathOf(n)).sort());
  assert.deepEqual(marksOf(target), marks(range(25, 1)));
  assert.equal(earlierOf(target), undefined, "a page of five ends the history");
  assert.deepEqual([...new Set(readRecords(host))].sort(), range(25, 1).map((n) => pathOf(n)).sort(), "the records read are the twenty-five of the three pages, no other");
  assert.equal(host.log.narrowed.filter(([ref, folders]) => ref === "test-results" && folders === null).length, 0, "the whole tree of the branch is read for nothing");
});

// TST-1276303 · level: release · module: MOD-trace-pages
// guards: UC-029
// given: two products of their own, one whose branch test-results holds exactly twenty records (the runs 20 to 1) and one exactly ten (the runs 10 to 1), no release tag
// input: of the first, the detail of TST-91 opened, Earlier runs clicked; of the second, the detail opened
// expect: of the ten-record product, ten marks and no control (the history ended with the page); of the twenty-record product, ten marks and the control, then after one click twenty marks (the runs 20 to 1) and no control, and no page read after the second
// Planted fault: a second page read from the branch's head again (`runsPage(host, next)` made `runsPage(host, RESULTS_BRANCH)` in historyPart of src/trace-pages/test-detail.mjs) fails the history of twenty, which repeats its newest ten.
test("TST-1276303 a history of exactly ten runs offers no Earlier runs, and one of exactly twenty ends after one click", async () => {
  const ten = hostOf(runs(10));
  const first = await render(ten, 10);
  assert.deepEqual(marksOf(first), marks(range(10, 1)), "known positive: the ten marks are drawn");
  assert.equal(earlierOf(first), undefined, "the ten runs are the whole history");
  assert.equal(historiesOf(ten).length, 1);
  const twenty = hostOf(runs(20));
  const target = await render(twenty, 10);
  assert.equal(marksOf(target).length, 10);
  assert.ok(earlierOf(target), "ten runs more may follow");
  await click(target, 20);
  assert.deepEqual(marksOf(target), marks(range(20, 1)));
  assert.equal(earlierOf(target), undefined, "the twentieth run is the first");
  assert.equal(historiesOf(twenty).length, 2, "no page is read after the last");
});

// TST-1276304 · level: release · module: MOD-trace-pages
// guards: UC-029; A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY
// given: a branch of seventeen record files, newest first: the 15th run's, the 14th run's two (passed and failed), the 13th to 7th runs' one each — the first ten — then the 6th to 5th runs' one each, the 4th run's two (passed and failed) and the 3rd to 1st runs' one each; no release tag
// input: the detail of TST-91 opened; Earlier runs clicked
// expect: first page: the 14th run's mark reads "<7 hex> flaky" with the class test-history-flaky and no other mark is flaky, the 15th run's reads passed, nine marks; after the click: fifteen marks, the 4th run's mark reads flaky too, two flaky marks in all, the 14th run's still flaky, and the control gone
// Planted fault: a mark that is not marked flaky (`outcome === "flaky"` made `outcome === "flakyx"` in addMarks of src/trace-pages/test-detail.mjs) fails the flaky marks of both pages.
test("TST-1276304 a commit that passed and failed is marked flaky on the page that holds it, among the newest ten and among the earlier ones", async () => {
  const records = [[15, "a", "passed"], [14, "a", "passed"], [14, "b", "failed"], ...range(13, 7).map((n) => [n, "a", "passed"]),
    [6, "a", "passed"], [5, "a", "passed"], [4, "a", "passed"], [4, "b", "failed"], ...range(3, 1).map((n) => [n, "a", "passed"])];
  const host = hostOf(records);
  const target = await render(host, 9);
  const flakyOf = () => find(target, hasClass("test-history-flaky")).map((node) => node.textContent);
  assert.equal(marksOf(target).length, 9, "known positive: nine commits stand on the first page of ten record files");
  assert.deepEqual(flakyOf(), [`${shortOf(14)} flaky`]);
  assert.ok(marksOf(target).includes(`${shortOf(15)} passed`));
  await click(target, 15);
  assert.deepEqual(flakyOf(), [`${shortOf(14)} flaky`, `${shortOf(4)} flaky`]);
  assert.equal(marksOf(target).length, 15);
  assert.equal(earlierOf(target), undefined, "seven record files ended the history");
});
