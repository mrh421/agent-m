// Release tests of ITM-654 — the page of an issue (`issue/<number>`) shows, while the fix's pull request is open, each existing test whose expected result the fix changes, with the requirement it now checks, the old
// expectation beside the new, and shows nothing of the kind for a pull request that is merged or closed. The behaviour is UC-012, alternative flow 5a ("The test was wrong, not the code. The fix changes the test; the
// pull request says which requirement the test now checks correctly, and the author sees the old and the new expectation side by side before merging.") and docs/architecture/MOD-maintenance-pages.md (`issues`, `issue/<number>`:
// "before its pull request is merged, for each existing test whose expected result the fix changes, the requirement it now checks correctly with the old and the new expectation side by side"; Uses: `pullRequestFacts` —
// "that pull request before it is merged, with the texts of its changed files on both sides" —, `isTestFile` and `testDeclarations` — "the existing tests among those files, and each one's requirement and expected result, old and new").
// Run: node --test tests/release-itm-654-fix-expectations-old-beside-new.test.mjs
//
// Module: MOD-maintenance-pages
// Guards: UC-012
// Level: release
//
// Written for the release testing of sprint 113 by a participant who implemented none of ITM-654 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The implementer's cases (tests/maintenance-pages-expectations-654.test.mjs) take one
// modified test file, one added test file and a merged pull request; these cases take the boundaries that file leaves out: a pull request that is closed without a merge, test files that are added, deleted or renamed, a source file whose
// text looks like a declaration, a test that is a new identifier, a requirement that changes between the sides, several files, and the open pull requests that change no expected result for each of the ways they can. The world is the one of
// tests/maintenance-pages-world.mjs with the product's host answering listPullRequests, readHistory and pullRequestFacts as this file states; the route is the real route `issue`. Readings the texts leave open, taken here:
//   - "an existing test": a declaration read under the same identifier in the same test file on both sides. A declaration whose identifier stands on one side only is a new or a removed test, and has no old expectation.
//   - "the requirement it now checks": what the declaration of the head side guards, joined by "; ", whatever the base side guarded.
//   - "the expected result changes": its `expect` differs between the sides; a change of any other key does not count. Every `expect` here is one line, since a value continued onto a further line is cut at its first line by the reader.
//   - the comparison is the table of class fix-expectations (a row of data-test="<TST id>" for each test, cells: test, requirement, old, new), and "says so" the paragraph of class fix-no-expectation.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { PRODUCT_URL, draw } from "./main-page-home-harness.mjs";
import { startRecord } from "../src/job-ledger/index.mjs";
import { connect, parseAddress } from "../src/repository-hosts/index.mjs";
import { registerStrategies } from "../src/job-runner/index.mjs";
import { byClass, one, restoreWorld, textOf, waitFor, walk, world, routeNamed, pages } from "./maintenance-pages-world.mjs";

for (const [at, strategies] of (pages.view?.strategies ?? []).entries()) {
  try { registerStrategies(`tests/release-itm-654-fix-expectations-old-beside-new.test.mjs#${at}`, strategies); } catch { /* registered by the page's own view */ }
}

afterEach(restoreWorld);

const ADDRESS = `${PRODUCT_URL}/issues/6`;
const FIX_JOB = "JOB-20261029-0900-c3d4";
const FIX_RECORD = startRecord({ id: FIX_JOB, kind: "fix-bug", worksOn: [ADDRESS], participant: "ci-bot", model: "fixture-llm", route: "ci hosted", run: null, retries: null, startedBy: "alice", start: new Date("2026-10-29T09:00:00Z"),
  agentM: { version: "unreleased", commit: "f".repeat(40) }, inputs: [], limit: 2, destinations: [{ participant: "ci-bot", place: "GitHub's hosted runners", parts: [] }], params: { issue: 6 } });

// A test file's text from declarations [id, guards, expect, given]; built by join, so that no line of this file is a declaration.
const declared = (id, guards, expect, given = "a store of three pages") => [`// ${id} · level: unit · module: MOD-store`, `// guards: ${guards}`, `// given: ${given}`, "// input: the export", `// expect: ${expect}`, `test("${id}", () => {});`, ""].join("\n");
const fileOf = (...tests) => tests.map((one) => declared(...one)).join("\n");

const pullOf = (state) => ({ number: 9, title: `${FIX_JOB}: fix-bug`, branch: FIX_JOB, base: "main", head: "2".repeat(40), mergeCommit: state === "merged" ? "3".repeat(40) : null, state, draft: false,
  url: `${PRODUCT_URL}/pull/9`, opened: "2026-10-29T09:10:00Z", merged: state === "merged" ? "2026-10-29T09:50:00Z" : null, closed: state === "open" ? null : "2026-10-29T09:50:00Z", body: `Job: ${FIX_JOB}` });

/** The world with the fix job of issue 6 and its pull request #9 in `state`, whose facts hold `files` and the texts of the two sides; returns the world and what pullRequestFacts was asked: the numbers, and every side and path read. */
function start({ state = "open", files, base, head }) {
  const w = world({ mails: [], issues: [{ number: 6, title: "Export loses pages 6", body: "FIRST RULE is broken.", state: "open", labels: ["defect"], comments: [] }], product: { [FIX_RECORD.path]: FIX_RECORD.text } });
  const asked = { facts: [], reads: [] };
  const real = connect(parseAddress(PRODUCT_URL), { token: "github_pat_HOME827PRODUCT0123456789abcdefg" });
  const host = { ...real,
    readHistory: async () => [],
    listPullRequests: async ({ branch }) => (branch === FIX_JOB ? [pullOf(state)] : []),
    pullRequestFacts: async (number) => {
      asked.facts.push(number);
      return { pullRequest: pullOf(state), commits: [], files, reviews: [], checks: [],
        read: async (path, side) => { asked.reads.push(`${side}:${path}`); return (side === "base" ? base : head)[path] ?? null; } };
    } };
  w.context.product = { address: PRODUCT_URL, kind: "github", host, tokenStored: true };
  return { w, asked };
}
// `drawn` false: the pull request is not open, so that nothing follows its line and the page is waited for no longer.
const open = async (w, { drawn = true } = {}) => {
  assert.ok(routeNamed("issue"), `the route issue: ${pages.error?.message}`);
  const detail = await draw(routeNamed("issue"), w.context, { number: "6" });
  await waitFor(() => byClass(detail, "fix-pull").length > 0 || byClass(detail, "issue-problem").length > 0);
  if (!drawn) return detail;
  await waitFor(() => byClass(detail, "fix-expectations").length > 0 || byClass(detail, "fix-no-expectation").length > 0 || byClass(detail, "close-with-links").length > 0 || byClass(detail, "issue-problem").length > 0);
  return detail;
};
const cellsOf = (row) => walk(row, (node) => node.localName === "td").map(textOf).map((text) => text.trim());
const rowsOf = (detail) => walk(one(detail, "fix-expectations"), (node) => node.localName === "tr" && node.getAttribute?.("data-test")).map((row) => cellsOf(row));
const modified = (path) => ({ path, change: "modified" });

// The two sides of the first case. tests/store.test.mjs: TST-200 changes its expectation and its requirement; TST-201 changes its expectation; TST-202 changes its precondition and its requirement, not its expectation; TST-203 is a
// test of the base that the head names TST-204, with another expectation. tests/export.test.mjs: TST-210 changes its expectation. tests/gone.test.mjs is deleted, tests/new.test.mjs is added, and src/store/read.mjs holds
// lines that look like a declaration and an expectation that changes.
const LOOKS_LIKE = (expect) => `${declared("TST-300", "FIRST RULE", expect)}export const pages = 3;\n`;
const BASE = {
  "tests/store.test.mjs": fileOf(["TST-200", "OLD RULE", "the export holds two pages"], ["TST-201", "SECOND RULE", "the export names its pages"], ["TST-202", "THIRD RULE", "the export is sorted", "a store of two pages"],
    ["TST-203", "FOURTH RULE", "the export is empty"]),
  "tests/export.test.mjs": fileOf(["TST-210", "FIRST RULE; SECOND RULE", "the page counts three"]),
  "tests/gone.test.mjs": fileOf(["TST-220", "FIRST RULE", "the export holds two pages"]),
  "src/store/read.mjs": LOOKS_LIKE("the export holds two pages"),
};
const HEAD = {
  "tests/store.test.mjs": fileOf(["TST-200", "NEW RULE", "the export holds three pages"], ["TST-201", "SECOND RULE", "the export names every page"], ["TST-202", "THIRD RULE; FIFTH RULE", "the export is sorted", "a store of three pages"],
    ["TST-204", "FOURTH RULE", "the export is not empty"]),
  "tests/export.test.mjs": fileOf(["TST-210", "FIRST RULE; SECOND RULE", "the page counts four"]),
  "tests/new.test.mjs": fileOf(["TST-230", "FIRST RULE", "a regression test of the third page"]),
  "src/store/read.mjs": LOOKS_LIKE("the export holds three pages"),
};
const FILES = [{ path: "src/store/read.mjs", change: "modified" }, modified("tests/store.test.mjs"), modified("tests/export.test.mjs"), { path: "tests/gone.test.mjs", change: "deleted" }, { path: "tests/new.test.mjs", change: "added" }];

// TST-654301 · level: release · module: MOD-maintenance-pages
// guards: UC-012
// given: the issue 6, its fix job and the open pull request #9, whose changed files are src/store/read.mjs (which holds a declaration-shaped TST-300 whose expectation changes), tests/store.test.mjs (TST-200 changes its expectation "the export holds two pages" to "the export holds three pages" and its requirement OLD RULE to NEW RULE; TST-201 changes its expectation; TST-202 changes its precondition and its requirement and keeps its expectation; TST-203 is gone and TST-204, with another expectation, is new), tests/export.test.mjs (TST-210, guarding FIRST RULE and SECOND RULE, changes its expectation), tests/gone.test.mjs (deleted) and tests/new.test.mjs (added); known positive first — the same page shows a table
// input: the route issue 6
// expect: one table whose rows are, in the order of the files and of the tests, TST-200 with NEW RULE, "the export holds two pages", "the export holds three pages"; TST-201 with SECOND RULE, "the export names its pages", "the export names every page"; TST-210 with "FIRST RULE; SECOND RULE", "the page counts three", "the page counts four" — and no row for TST-202, TST-203, TST-204, TST-220, TST-230 or TST-300; pullRequestFacts is asked for #9 once; nothing is read of src/store/read.mjs; counter-proof: the old expectation stands in the third cell and the new in the fourth, never the other way
// Planted fault: a comparison that takes a test of a file that is added or deleted, or of a file that is no test file, for an existing test (the filter on isTestFile or the pair of reads in changedExpectations, src/maintenance-pages/issues.mjs, left out) adds a row for TST-230, TST-220 or TST-300, and the case fails on the rows; one that compares the requirement of the base side shows OLD RULE for TST-200.
test("TST-654301 an open fix shows the changed expectation of each existing test, with the requirement, old beside new, and nothing for added, deleted or non-test files", async () => {
  const { w, asked } = start({ files: FILES, base: BASE, head: HEAD });
  const detail = await open(w);
  assert.equal(byClass(detail, "issue-problem").length, 0, textOf(one(detail, "issue-problem") ?? detail));
  assert.match(textOf(one(detail, "fix-pull")), /pull request #9 is open/, "known positive: the pull request is open");
  assert.ok(one(detail, "fix-expectations"), "known positive: the comparison is shown");
  assert.deepEqual(rowsOf(detail), [
    ["TST-200", "NEW RULE", "the export holds two pages", "the export holds three pages"],
    ["TST-201", "SECOND RULE", "the export names its pages", "the export names every page"],
    ["TST-210", "FIRST RULE; SECOND RULE", "the page counts three", "the page counts four"],
  ]);
  assert.equal(byClass(detail, "fix-no-expectation").length, 0, "a comparison with rows does not say that there is none");
  assert.deepEqual(asked.facts, [9]);
  assert.equal(asked.reads.some((read) => read.endsWith("src/store/read.mjs")), false, "a file that is no test file is not read");
});

// TST-654302 · level: release · module: MOD-maintenance-pages
// guards: UC-012
// given: the same changes as TST-654301 in three worlds — the pull request open (the known positive), merged, and closed without a merge
// input: the route issue 6 in each world
// expect: the open pull request shows its table, and the page says it is open; the merged one is named as merged and the closed one as closed, each shows no table of expectations and no sentence that the fix changes no expected result — nothing is said of expectations —, and pullRequestFacts is asked for neither
// Planted fault: the comparison drawn for any pull request that is not merged (the test `pullRequest.state === "open"` in fixTrail, src/maintenance-pages/issues.mjs, loosened to `!== "merged"`) shows the table of a closed pull request, and the case fails on the closed world.
test("TST-654302 a merged or a closed fix shows no comparison of expectations", async () => {
  const same = { files: FILES, base: BASE, head: HEAD };
  assert.equal(rowsOf(await open(start(same).w)).length, 3, "known positive: an open pull request shows its three rows");
  restoreWorld();

  for (const state of ["merged", "closed"]) {
    const { w, asked } = start({ ...same, state });
    const detail = await open(w, { drawn: false });
    assert.equal(byClass(detail, "issue-problem").length, 0, `${state}: ${textOf(one(detail, "issue-problem") ?? detail)}`);
    assert.match(textOf(one(detail, "fix-pull")), new RegExp(`pull request #9 is ${state}`), state);
    assert.equal(byClass(detail, "fix-expectations").length, 0, `${state}: no table`);
    assert.equal(byClass(detail, "fix-no-expectation").length, 0, `${state}: no sentence about expectations`);
    assert.deepEqual(asked.facts, [], `${state}: the facts of the pull request are not asked for`);
    restoreWorld();
  }
});

// TST-654303 · level: release · module: MOD-maintenance-pages
// guards: UC-012
// given: known positive first (TST-654301's open pull request shows rows); then four open pull requests that change no expected result of an existing test — one that changes a source file only, one that only adds a test file and deletes another, one whose test file changes the precondition and the requirement of a test and keeps its expectation, and one whose test file changes the identifier of its only test
// input: the route issue 6 in each world
// expect: each says that the fix changes no expected result of an existing test, shows no table of expectations and no row, and is not shown a problem
// Planted fault: a comparison that takes every changed key for a changed expectation (the test `old.expect !== after.expect` in changedExpectations, src/maintenance-pages/issues.mjs, widened to the declaration) shows a row for the third world; one that takes a new identifier for an existing test shows a row for the fourth, and the case fails on the tables.
test("TST-654303 an open fix that changes no expected result of an existing test says so", async () => {
  assert.ok(one(await open(start({ files: FILES, base: BASE, head: HEAD }).w), "fix-expectations"), "known positive");
  restoreWorld();

  const worlds = {
    "a source file only": { files: [modified("src/store/read.mjs")], base: BASE, head: HEAD },
    "a test file added and another deleted": { files: [{ path: "tests/gone.test.mjs", change: "deleted" }, { path: "tests/new.test.mjs", change: "added" }], base: BASE, head: HEAD },
    "the precondition and the requirement changed, the expectation kept": {
      files: [modified("tests/store.test.mjs")],
      base: { "tests/store.test.mjs": fileOf(["TST-202", "THIRD RULE", "the export is sorted", "a store of two pages"]) },
      head: { "tests/store.test.mjs": fileOf(["TST-202", "THIRD RULE; FIFTH RULE", "the export is sorted", "a store of three pages"]) } },
    "the identifier of the only test changed": {
      files: [modified("tests/store.test.mjs")],
      base: { "tests/store.test.mjs": fileOf(["TST-203", "FOURTH RULE", "the export is empty"]) },
      head: { "tests/store.test.mjs": fileOf(["TST-204", "FOURTH RULE", "the export is not empty"]) } },
  };
  for (const [what, world_] of Object.entries(worlds)) {
    const { w } = start(world_);
    const detail = await open(w);
    assert.equal(byClass(detail, "issue-problem").length, 0, `${what}: ${textOf(one(detail, "issue-problem") ?? detail)}`);
    assert.match(textOf(one(detail, "fix-pull")), /pull request #9 is open/, what);
    assert.match(textOf(one(detail, "fix-no-expectation")), /changes no expected result of an existing test/, what);
    assert.equal(byClass(detail, "fix-expectations").length, 0, `${what}: no table`);
    restoreWorld();
  }
});
