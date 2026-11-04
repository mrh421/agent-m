// Before a fix's pull request is merged, each existing test whose expected result the fix changes is shown with its requirement, the old and the new expectation side by side (ITM-654) — MOD-maintenance-pages'
// route `issue/<number>`, as docs/architecture/MOD-maintenance-pages.md states it: "and, before its pull request is merged, for each existing test whose expected result the fix changes, the requirement it now checks
// correctly with the old and the new expectation side by side (UC-012 5a)" (Interfaces), over "MOD-repository-hosts.pullRequestFacts — that pull request before it is merged, with the texts of its changed files on
// both sides; MOD-test-document.isTestFile, MOD-test-document.testDeclarations — the existing tests among those files, and each one's requirement and expected result, old and new, side by side (UC-012 5a)" (Uses).
// Run: node --test tests/maintenance-pages-expectations-654.test.mjs
//
// Module: MOD-maintenance-pages
// Guards: UC-012
// Level: unit
//
// The world is tests/maintenance-pages-world.mjs: its fake GitHub holds the issues of alice/product and the fix job's record; the product's host is the real one, with the interfaces of MOD-repository-hosts this page
// reads for the fix's pull request — listPullRequests, readHistory and pullRequestFacts — answered by this file. Readings the texts leave open, which the tests state (the pull request names them):
//   - An existing test is a declaration (MOD-test-document's TestDeclaration) of a changed test file that stands, under the same identifier, on both sides of the pull request; a test file the pull request adds
//     holds none, and a file that is no test file is not read.
//   - The requirement it now checks correctly is what its declaration on the head side guards (`guards`, joined by "; ").
//   - The comparison is a table <table class="fix-expectations">, one row <tr data-test="<TST id>"> per test whose `expect` differs, its cells in this order: the test, the requirement, the old expectation, the new
//     expectation. A pull request that changes no expected result says so, <p class="fix-no-expectation">. A merged pull request shows no comparison: the text asks for it before the merge.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { PRODUCT_URL, draw } from "./main-page-home-harness.mjs";
import { startRecord } from "../src/job-ledger/index.mjs";
import { connect, parseAddress } from "../src/repository-hosts/index.mjs";
import { registerStrategies } from "../src/job-runner/index.mjs";
import { byClass, one, restoreWorld, textOf, waitFor, walk, world, routeNamed, pages } from "./maintenance-pages-world.mjs";

for (const [at, strategies] of (pages.view?.strategies ?? []).entries()) {
  try { registerStrategies(`tests/maintenance-pages-expectations-654.test.mjs#${at}`, strategies); } catch { /* registered by the page's own view */ }
}

afterEach(restoreWorld);

const ADDRESS = `${PRODUCT_URL}/issues/6`;
const FIX_JOB = "JOB-20261029-0900-c3d4";
const FIX_RECORD = startRecord({ id: FIX_JOB, kind: "fix-bug", worksOn: [ADDRESS], participant: "ci-bot", model: "fixture-llm", route: "ci hosted", run: null, retries: null, startedBy: "alice", start: new Date("2026-10-29T09:00:00Z"),
  agentM: { version: "unreleased", commit: "f".repeat(40) }, inputs: [], limit: 2, destinations: [{ participant: "ci-bot", place: "GitHub's hosted runners", parts: [] }], params: { issue: 6 } });

const declared = (id, guards, expect) => [`// ${id} · level: unit · module: MOD-store`, `// guards: ${guards}`, "// given: a store of three pages", "// input: the export", `// expect: ${expect}`, `test("${id}", () => {});`, ""].join("\n");
// The test file the fix changes: TST-100's expected result changes, TST-101's does not; and a test file it adds.
const STORE_BASE = [declared("TST-100", "FIRST RULE", "the export holds two pages"), declared("TST-101", "SECOND RULE", "the export names its pages")].join("\n");
const STORE_HEAD = [declared("TST-100", "FIRST RULE", "the export holds three pages"), declared("TST-101", "SECOND RULE", "the export names its pages")].join("\n");
const ADDED = declared("TST-102", "FIRST RULE", "a regression test of the third page");
const TEXTS = {
  base: { "tests/store.test.mjs": STORE_BASE, "src/store/read.mjs": "export const pages = 2;\n" },
  head: { "tests/store.test.mjs": STORE_HEAD, "tests/export.test.mjs": ADDED, "src/store/read.mjs": "export const pages = 3;\n" },
};
const FILES = [{ path: "src/store/read.mjs", change: "modified" }, { path: "tests/store.test.mjs", change: "modified" }, { path: "tests/export.test.mjs", change: "added" }];

const pullOf = (state) => ({ number: 9, title: `${FIX_JOB}: fix-bug`, branch: FIX_JOB, base: "main", head: "2".repeat(40), mergeCommit: state === "merged" ? "3".repeat(40) : null, state, draft: false,
  url: `${PRODUCT_URL}/pull/9`, opened: "2026-10-29T09:10:00Z", merged: state === "merged" ? "2026-10-29T09:50:00Z" : null, closed: state === "merged" ? "2026-10-29T09:50:00Z" : null, body: `Job: ${FIX_JOB}` });

/** The world with the fix job of issue 6 and its pull request #9 in `state`, whose facts hold `files` and `texts`; returns the world and what pullRequestFacts was asked: the numbers, and every path and side read. */
function start({ state = "open", files = FILES, texts = TEXTS } = {}) {
  const w = world({ mails: [], issues: [{ number: 6, title: "Export loses pages 6", body: "FIRST RULE is broken.", state: "open", labels: ["defect"], comments: [] }], product: { [FIX_RECORD.path]: FIX_RECORD.text } });
  const asked = { facts: [], reads: [] };
  const real = connect(parseAddress(PRODUCT_URL), { token: "github_pat_HOME827PRODUCT0123456789abcdefg" });
  const host = { ...real,
    readHistory: async () => [],
    listPullRequests: async ({ branch }) => (branch === FIX_JOB ? [pullOf(state)] : []),
    pullRequestFacts: async (number) => {
      asked.facts.push(number);
      return { pullRequest: pullOf(state), commits: [], files, reviews: [], checks: [],
        read: async (path, side) => { asked.reads.push(`${side}:${path}`); return texts[side][path] ?? null; } };
    } };
  w.context.product = { address: PRODUCT_URL, kind: "github", host, tokenStored: true };
  return { w, asked };
}
const open = async (w) => {
  assert.ok(routeNamed("issue"), `the route issue: ${pages.error?.message}`);
  const detail = await draw(routeNamed("issue"), w.context, { number: "6" });
  await waitFor(() => byClass(detail, "fix-pull").length > 0 || byClass(detail, "issue-problem").length > 0);
  await waitFor(() => byClass(detail, "fix-expectations").length > 0 || byClass(detail, "fix-no-expectation").length > 0 || byClass(detail, "close-with-links").length > 0
    || byClass(detail, "issue-problem").length > 0);
  return detail;
};
const cellsOf = (row) => walk(row, (node) => node.localName === "td").map(textOf).map((text) => text.trim());

// TST-654001 · level: unit · module: MOD-maintenance-pages
// guards: UC-012
// given: the issue 6 labelled defect; the fix job of the issue and its open pull request #9, which changes src/store/read.mjs, changes the test file tests/store.test.mjs — in which the test TST-100 (guards FIRST RULE) expected "the export holds two pages" before and "the export holds three pages" after, and the test TST-101 (guards SECOND RULE) keeps its expected result — and adds the test file tests/export.test.mjs with the test TST-102
// input: the route issue 6
// expect: known positive first — the trail links pull request #9 as open; the page asks pullRequestFacts for #9 once and reads only test files, src/store/read.mjs on neither side; it shows one table with exactly one row, the test TST-100, whose cells are, in order, "TST-100", "FIRST RULE", "the export holds two pages", "the export holds three pages" — the old expectation before the new; the tests TST-101 and TST-102 have no row
test("issue — before its pull request is merged, the fix shows each existing test whose expected result it changes, with its requirement, old beside new", async () => {
  const { w, asked } = start();
  const detail = await open(w);
  assert.equal(byClass(detail, "issue-problem").length, 0, textOf(one(detail, "issue-problem") ?? detail));
  assert.match(textOf(one(detail, "fix-pull")), /pull request #9 is open/);
  assert.deepEqual(asked.facts, [9]);
  assert.ok(asked.reads.every((read) => read.endsWith(".test.mjs")), asked.reads.join(", "));
  const table = one(detail, "fix-expectations");
  assert.ok(table, `the comparison is shown: ${textOf(one(detail, "issue-fix-trail") ?? detail)}`);
  const rows = walk(table, (node) => node.localName === "tr" && node.getAttribute?.("data-test"));
  assert.deepEqual(rows.map((row) => row.getAttribute("data-test")), ["TST-100"]);
  assert.deepEqual(cellsOf(rows[0]), ["TST-100", "FIRST RULE", "the export holds two pages", "the export holds three pages"]);
});

// TST-654002 · level: unit · module: MOD-maintenance-pages
// guards: UC-012
// given: known positive first (TST-654001's open pull request shows the comparison); then the same pull request merged; then an open pull request whose test file keeps every expected result
// input: the route issue 6 in each world
// expect: the merged pull request shows no table of expectations and is not asked for its facts; the open pull request that changes no expected result shows no table and says that the fix changes no expected result of an existing test
test("issue — a merged fix shows no comparison, and a fix that changes no expected result says so", async () => {
  assert.ok(one(await open(start().w), "fix-expectations"), "known positive");
  restoreWorld();

  const merged = start({ state: "merged" });
  const after = await open(merged.w);
  assert.match(textOf(one(after, "fix-pull")), /pull request #9 is merged/);
  assert.equal(byClass(after, "fix-expectations").length, 0);
  assert.deepEqual(merged.asked.facts, []);
  restoreWorld();

  const kept = start({ texts: { base: TEXTS.base, head: { ...TEXTS.head, "tests/store.test.mjs": STORE_BASE } } });
  const same = await open(kept.w);
  assert.equal(byClass(same, "fix-expectations").length, 0);
  assert.match(textOf(one(same, "fix-no-expectation")), /changes no expected result of an existing test/);
});
