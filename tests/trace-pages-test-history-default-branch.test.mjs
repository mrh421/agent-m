// MOD-trace-pages' detail of a test (`trace/tests/<TST>`) draws a history of marks, and UC-029 step 5 says which commits it marks: "one mark per commit of the default branch where it ran". A commit that the branch
// `test-results` holds a record of and that is not a commit of the default branch (the head of a pull request) gets no mark (ITM-1415).
//
// Run: node --test tests/trace-pages-test-history-default-branch.test.mjs
//
// Module: MOD-trace-pages
// Guards: UC-029; EVERY TEST RUN LEAVES A RESULT RECORD; A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY
// Level: unit
//
// The route is called through its public Route.render with the key "tests" and the param row, over the Host of tests/trace-pages-harness.mjs. The product's default branch is named `trunk` by repositoryInfo; the Host
// answers containsCommit for the commits of that branch alone (the harness' `onDefault`) and for no other branch name, so a page that asks about "main" finds none. Each case states its expected marks in its own
// text; none is read from a document. Readings the cases take, each from the sentence quoted:
//   - UC-029 step 5, "one mark per commit of the default branch where it ran": a commit is a commit of the default branch when the history of the default branch that repositoryInfo names holds it; the marks are those
//     of the commits of the pages of the branch `test-results` (the newest ten, then the ten after them for *Earlier runs*) that are commits of that branch, in the order of the pages;
//   - the same sentence for a flaky commit, "A flaky commit is marked as such": a commit of the default branch whose records disagree is marked flaky, and a flaky pull request's head is no mark at all;
//   - a history of the default branch that cannot be read is named in the line `traces-problem` ("The history could not be read: …") and no commit is marked, the page does not mark every commit instead.

import test from "node:test";
import assert from "node:assert/strict";
import { document, find, treeHost, until } from "./trace-pages-harness.mjs";

const { view } = await import("../src/trace-pages/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "trace");

const SPEC = ["# Default fixture — Specification", "", "## Only section", "", "**ALPHA RULE** *(Vibe Coding)*", "Alpha rule.", "*Check:* at review.", ""].join("\n");
const ALPHA = ["// TST-801 · level: unit · module: system", "// guards: ALPHA RULE", "// given: a fixture", "// input: a call", "// expect: a result", "test(\"alpha holds\", () => {});", ""].join("\n");
const FILES = { "SPEC.md": SPEC, "tests/alpha.test.mjs": ALPHA };

// The commit of the nth run: n in hex, twice, forty digits, so that its first seven digits name n (n = 30 is "1e1e1e1").
const commitOf = (n) => n.toString(16).padStart(2, "0").repeat(20);
const shortOf = (n) => commitOf(n).slice(0, 7);
const pathOf = (n, name = "a") => `runs/${commitOf(n)}/20261001-1000-commit-${name}.md`;
function record(n, outcome) {
  const front = ["---", `commit: ${commitOf(n)}`, "levels:", "  - unit", "occasion: commit", "participant: ci", "date: 2026-10-07 10:00 UTC", "---"].join("\n");
  return `${front}\n## Outcomes\n\n| Test | Level | Outcome | Runs |\n|---|---|---|---|\n| TST-801 | unit | ${outcome} | |\n`;
}
/** The records of the branch, newest first: [run number, name of the record, outcome]. */
const resultsOf = (records) => Object.fromEntries(records.map(([n, name, outcome]) => [pathOf(n, name), record(n, outcome)]));

/**
 * hostOf({ records, onDefault, failDefault }) — the product's Host: the default branch `trunk` holds the files and, for the repository's history, the commits of the runs `onDefault`; the branch test-results holds
 * `records`. containsCommit about any other branch is false; with `failDefault` it fails as an unreachable server does.
 */
function hostOf({ records, onDefault, failDefault = false }) {
  const base = treeHost({ trees: { trunk: FILES, "test-results": resultsOf(records) }, onDefault: onDefault.map(commitOf) });
  return { ...base,
    async repositoryInfo() { return { defaultBranch: "trunk", visibility: "public", canWrite: false, archived: false, description: "" }; },
    async containsCommit(branch, commit) {
      if (failDefault) throw Object.assign(new Error("the default branch is unreachable"), { name: "Unreachable" });
      return branch === "trunk" && base.containsCommit(branch, commit);
    },
    async listTags() { return []; } };
}
const hasClass = (name) => (node) => String(node.className).split(" ").includes(name);
const marksOf = (target) => find(target, hasClass("test-history-commit")).map((node) => node.textContent);
const earlierOf = (target) => find(target, hasClass("test-history-earlier"))[0];
const problemsOf = (target) => find(target, hasClass("traces-problem")).map((node) => node.textContent);
async function render(host) {
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, { product: { address: "https://github.com/acme/product", host } }, { key: "tests", ref: "trunk", row: "TST-801" });
  await until(() => find(target, hasClass("test-history")).length > 0 || problemsOf(target).length > 0);
  await new Promise((resolve) => setTimeout(resolve, 30));
  return target;
}
const click = async (button, done) => { button.dispatchEvent(new Event("click")); await until(done); await new Promise((resolve) => setTimeout(resolve, 30)); };

// TST-1415001 · level: unit · module: MOD-trace-pages
// guards: UC-029; EVERY TEST RUN LEAVES A RESULT RECORD
// given: the branch test-results holds, newest first, one record of the run 3 (TST-801 failed), the run 2 (passed) and the run 1 (failed); the default branch trunk holds the commits of the runs 2 and 1, and not the commit of the run 3, the head of a pull request
// input: the detail of TST-801 opened
// expect: known positive — two marks, "0202020 passed" and "0101010 failed", in that order; no mark for the commit of the run 3, which is no commit of the default branch
test("a commit that is no commit of the default branch gets no mark, and the commits of the default branch do", async () => {
  const target = await render(hostOf({ records: [[3, "a", "failed"], [2, "a", "passed"], [1, "a", "failed"]], onDefault: [2, 1] }));
  assert.deepEqual(marksOf(target), [`${shortOf(2)} passed`, `${shortOf(1)} failed`], "known positive: the commits of the default branch are marked, in the order of the records");
  assert.ok(!marksOf(target).some((mark) => mark.startsWith(shortOf(3))), "the head of a pull request is no commit of the default branch");
});

// TST-1415002 · level: unit · module: MOD-trace-pages
// guards: UC-029; EVERY TEST RUN LEAVES A RESULT RECORD
// given: a branch test-results of 12 records, one for each of the runs 12 to 1 (the 12th the newest), TST-801 passing on the odd runs and failing on the even ones; the default branch trunk holds the commits of every run but the 11th and the 2nd, the heads of pull requests
// input: the detail of TST-801 opened; Earlier runs clicked
// expect: nine marks at first, the runs 12, 10, 9, 8, 7, 6, 5, 4 and 3 ("0c0c0c0 failed", "0a0a0a0 failed", "0909090 passed", …, "0303030 passed") and none for the run 11; Earlier runs is offered; after the click ten marks, the same and "0101010 passed", and none for the run 2; the control is gone, the history ends
test("Earlier runs adds the commits of the default branch among the next ten runs and leaves out a pull request's head", async () => {
  const outcomeOf = (n) => (n % 2 ? "passed" : "failed");
  const records = Array.from({ length: 12 }, (_, at) => [12 - at, "a", outcomeOf(12 - at)]);
  const host = hostOf({ records, onDefault: [12, 10, 9, 8, 7, 6, 5, 4, 3, 1] });
  const target = await render(host);
  const first = [12, 10, 9, 8, 7, 6, 5, 4, 3].map((n) => `${shortOf(n)} ${outcomeOf(n)}`);
  assert.deepEqual(marksOf(target), first, "the 11th run, a pull request's head, is not marked");
  assert.ok(earlierOf(target), "known positive: the history goes on after the tenth run");
  await click(earlierOf(target), () => marksOf(target).length >= 10);
  assert.deepEqual(marksOf(target), [...first, `${shortOf(1)} ${outcomeOf(1)}`], "the 2nd run, a pull request's head, is not marked");
  assert.equal(earlierOf(target), undefined, "the history ends with the first run");
});

// TST-1415003 · level: unit · module: MOD-trace-pages
// guards: UC-029; A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY
// given: the branch test-results holds, newest first, two records of the run 3 ("a" passed, "b" failed), two records of the run 2 ("a" passed, "b" failed) and one of the run 1 (passed); the default branch trunk holds the commits of the runs 2 and 1, not the commit of the run 3
// input: the detail of TST-801 opened
// expect: two marks, "0202020 flaky" with the class test-history-flaky, and "0101010 passed"; exactly one mark is flaky — the flaky commit of the pull request's head, the run 3, is no mark
test("a flaky commit of the default branch is marked flaky and a flaky pull request's head is not marked at all", async () => {
  const records = [[3, "a", "passed"], [3, "b", "failed"], [2, "a", "passed"], [2, "b", "failed"], [1, "a", "passed"]];
  const target = await render(hostOf({ records, onDefault: [2, 1] }));
  assert.deepEqual(marksOf(target), [`${shortOf(2)} flaky`, `${shortOf(1)} passed`]);
  assert.equal(find(target, hasClass("test-history-flaky")).length, 1, "known positive: only the flipping commit of the default branch is marked flaky");
});

// TST-1415004 · level: unit · module: MOD-trace-pages
// guards: UC-029
// given: the branch test-results holds the records of the runs 2 and 1, both commits of the default branch trunk; the history of trunk cannot be read (unreachable)
// input: the detail of TST-801 opened
// expect: a line "The history could not be read: the default branch is unreachable" and no mark of any commit, the declaration (its level unit) still drawn; known positive — the same product with a readable trunk marks both commits
test("a default branch whose history cannot be read is named, and no commit is marked in its place", async () => {
  const records = [[2, "a", "passed"], [1, "a", "failed"]];
  const readable = await render(hostOf({ records, onDefault: [2, 1] }));
  assert.deepEqual(marksOf(readable), [`${shortOf(2)} passed`, `${shortOf(1)} failed`], "known positive: with the history of trunk readable both commits are marked");
  const target = await render(hostOf({ records, onDefault: [2, 1], failDefault: true }));
  assert.ok(problemsOf(target).includes("The history could not be read: the default branch is unreachable"), problemsOf(target).join("; "));
  assert.deepEqual(marksOf(target), []);
  assert.equal(find(target, hasClass("test-level"))[0]?.textContent, "unit", "the other parts stay");
});

// TST-1415005 · level: unit · module: MOD-trace-pages
// guards: UC-029; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the branch test-results holds the records of the runs 12 to 1; trunk holds the commits of the runs 12 to 3; a Host that notes every containsCommit and every readHistory
// input: the detail of TST-801 opened; Earlier runs clicked
// expect: containsCommit asked about the branch trunk once for each of the twelve commits, none twice (ten at the opening, two after the click); no readHistory of the branch trunk, and none without a ref
test("which commits are the default branch's is asked once for each commit, and the branch's history is not read", async () => {
  const records = Array.from({ length: 12 }, (_, at) => [12 - at, "a", "passed"]);
  const host = hostOf({ records, onDefault: [12, 11, 10, 9, 8, 7, 6, 5, 4, 3] });
  const target = await render(host);
  await click(earlierOf(target), () => earlierOf(target) === undefined);
  const asked = host.log.contains;
  assert.ok(asked.every(([branch]) => branch === "trunk"), "known positive: the branch asked about is the one repositoryInfo names");
  assert.deepEqual(asked.map(([, commit]) => commit).sort(), records.map(([n]) => commitOf(n)).sort(), "each of the twelve commits once");
  assert.deepEqual(host.log.histories.filter(([path, options]) => path === null && (options?.ref === "trunk" || options?.ref === undefined)), [], "the history of the default branch is not read");
});
