// MOD-trace-pages' tests view lists a test whose declaration names no `TST-` identifier under Incomplete, with the identifier as what is missing (ITM-1414; UC-029 1a: "A test declares no `TST-`
// identifier, no level or no guarded identifier. It is listed under **Incomplete**, with what is missing; the page still works for all others.").
//
// Run: node --test tests/trace-pages-tests-unidentified.test.mjs
//
// Module: MOD-trace-pages
// Guards: UC-029; EVERY ARTIFACT HAS AN IDENTIFIER
// Level: unit
//
// The route is called through its public Route.render with the key "tests", over the Host of tests/trace-pages-harness.mjs, which has no write method. The fixture is one test file holding a header, a
// complete declaration packed on its first line, a complete declaration whose keys stand on lines of their own, a declaration without its level, a comment block of prose whose first line has the form
// `key: value` and declares neither level nor guards, and a comment block that declares a level and a guarded requirement and names no identifier. Each case states its expected texts; none is read
// from a document. Readings the cases take, each from the sentence quoted:
// - "1a's missing identifier is a comment block with a level and guards whose first line names no `TST-` identifier" (docs/gates/20261102-0823-development-release-testing-0774.md, Readings taken):
//   such a block is listed; a block of comment lines that declares no level or no guards is no test declaration and is not listed; the lines of a declaration that names its identifier are its own.
// - "with what is missing" (UC-029 1a): the text `identifier`, in the element of class `tests-missing`, as the other incomplete tests show `level` or `guards` there.
// - "each test shows its `TST-` identifier, a one-line title and its outcome" (UC-029 1): a test without an identifier has no identifier to show or to open, and no record names it; it is shown by its
//   title and its place, `<path>:<line>` of its block's first line, in an element of class `tests-unidentified`, and not as a `tests-case`, whose identifier is the link that opens it.

import test from "node:test";
import assert from "node:assert/strict";
import { document, find, treeHost } from "./trace-pages-harness.mjs";

const { view } = await import("../src/trace-pages/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "trace");

const SPEC = ["# Library — Specification", "", "## Lending", "", "**LOANS ARE RECORDED** *(Vibe Coding)*", "Every loan is recorded.", "*Check:* at review.", ""].join("\n");

// Line numbers, from 1: the header 1-5, the import 7, TST-201 9-14, TST-202 16-23, TST-203 25-29, the prose block 31-32, the block without an identifier 35-39, its test case 40.
const LOANS = [
  "// The loans' tests.",
  "//",
  "// Module: MOD-loans",
  "// Guards: LOANS ARE RECORDED",
  "// Level: unit",
  "",
  'import test from "node:test";',
  "",
  "// TST-201 · level: unit · module: MOD-loans",
  "// guards: LOANS ARE RECORDED",
  "// given: a library",
  "// input: a book is lent",
  "// expect: one open loan",
  'test("a loan is recorded", () => {});',
  "",
  "// TST-202",
  "// level: unit",
  "// module: MOD-loans",
  "// guards: LOANS ARE RECORDED",
  "// given: a library with a loan",
  "// input: the loan is renewed",
  "// expect: the loan's due date moves",
  'test("a loan is renewed", () => {});',
  "",
  "// TST-203 · module: MOD-loans",
  "// guards: LOANS ARE RECORDED",
  "// given: a library",
  "// input: a loan is printed",
  'test("a loan is printed", () => {});',
  "",
  "// note: a reader may hold several loans",
  "// see: the lending rules",
  "const reader = 1;",
  "",
  "// level: unit · module: MOD-loans",
  "// guards: LOANS ARE RECORDED",
  "// given: a library",
  "// input: a call",
  "// expect: a result",
  'test("a loan without its identifier", () => {});',
  "",
].join("\n");

const FILES = { "SPEC.md": SPEC, "tests/loans.test.mjs": LOANS };

async function render() {
  const host = treeHost({ trees: { main: FILES, "test-results": {} } });
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, { product: { address: "https://github.com/acme/library", host } }, { key: "tests", ref: "main" });
  return target;
}
const withClass = (root, name) => find(root, (node) => String(node.className).split(" ").includes(name));
const textOf = (root, name) => withClass(root, name)[0]?.textContent;
const idsOf = (root) => withClass(root, "tests-case").map((node) => textOf(node, "tests-id"));
const unidentifiedOf = (root) => withClass(root, "tests-unidentified").map((node) => [textOf(node, "tests-title"), textOf(node, "tests-place"), textOf(node, "tests-missing")]);

// TST-1414010 · level: unit · module: MOD-trace-pages
// guards: UC-029; EVERY ARTIFACT HAS AN IDENTIFIER
// given: tests/loans.test.mjs of the fixture: TST-201 and TST-202 complete, TST-203 without its level, and on lines 35-39 a comment block that declares level unit and LOANS ARE RECORDED and names no TST- identifier, before the test case "a loan without its identifier"
// input: Route.render with the key "tests" at main
// expect: known positive — Incomplete lists TST-203 as a case with "level"; it also holds one row of class tests-unidentified: title "a loan without its identifier", place "tests/loans.test.mjs:35", missing "identifier"; the cases drawn are TST-201, TST-202 and TST-203 as before, and the row is none of them
test("TST-1414010: a test whose declaration names no TST- identifier is listed under Incomplete with the identifier missing", async () => {
  const page = await render();
  const [incomplete] = withClass(page, "tests-incomplete");
  assert.ok(incomplete, "an Incomplete group is drawn");
  const cases = withClass(incomplete, "tests-case").map((node) => [textOf(node, "tests-id"), textOf(node, "tests-missing")]);
  assert.deepEqual(cases, [["TST-203", "level"]], "known positive: the test without its level is listed with what it lacks");
  assert.deepEqual(unidentifiedOf(incomplete), [["a loan without its identifier", "tests/loans.test.mjs:35", "identifier"]]);
  assert.deepEqual(idsOf(page), ["TST-201", "TST-202", "TST-203"], "the other tests are listed as before");
});

// TST-1414011 · level: unit · module: MOD-trace-pages
// guards: UC-029
// given: the same file; its header (Module, Guards, Level), the prose block of lines 31-32 whose first line is "note: …" and which declares no level and no guards, and TST-202, whose level, module and guards stand on lines 17-19 below its identifier
// input: Route.render with the key "tests" at main
// expect: known positive — the block of lines 35-39 is the one row of class tests-unidentified on the page; neither the header, nor the prose block, nor a line of TST-202 is listed as such a row; TST-202 stands in the tree under unit with its title "a loan is renewed", and not under Incomplete
test("TST-1414011: only a comment block with a level and guards and no identifier is listed as such; a header, prose and a declaration's own lines are not", async () => {
  const page = await render();
  assert.deepEqual(withClass(page, "tests-unidentified").map((node) => textOf(node, "tests-place")), ["tests/loans.test.mjs:35"]);
  const [unit] = withClass(page, "tests-group").filter((group) => textOf(group, "tests-group-name") === "unit");
  assert.deepEqual(withClass(unit, "tests-case").map((node) => [textOf(node, "tests-id"), textOf(node, "tests-title")]), [["TST-201", "a loan is recorded"], ["TST-202", "a loan is renewed"]]);
  assert.equal(idsOf(withClass(page, "tests-incomplete")[0]).includes("TST-202"), false);
});
