// MOD-test-document's unidentifiedDeclarations, as docs/architecture/MOD-test-document.md states it: "every block of comment lines in a test file that is written as a declaration but whose first
// line names no identifier — in its place, `key: value` parts with keys of the declaration, such as `// level: unit · module: MOD-text-tools` —, in order, each read as a declaration is read, with
// `id` `null`, its `path` and its `line`; `testDeclarations` gives none of them" (ITM-1414; UC-029 1a).
//
// Run: node --test tests/test-document-unidentified.test.mjs
//
// Module: MOD-test-document
// Guards: EVERY ARTIFACT HAS AN IDENTIFIER; UC-029
// Level: unit
//
// The fixture is one test file: a header, a declaration whose keys are packed on its identifier's line, a declaration whose keys stand on lines of their own, a declaration whose block goes on past a
// line not of the form `key: value` with a `key: value` line, a comment block of prose whose first line
// has the form `key: value` with a key that is none of the declaration's, and a comment block whose first line declares a level and a module and names no identifier. Each case states its expected
// result; none is read from a document. The reading the cases take: "a block of comment lines … whose first line names no identifier" — the block's first line is the first comment line after a line
// that is none, so the `key: value` lines below a declaration's identifier are that declaration's own, and no block of their own.

import test from "node:test";
import assert from "node:assert/strict";
import { testDeclarations, unidentifiedDeclarations } from "../src/test-document/index.mjs";

const PATH = "tests/loans.test.mjs";

// Line numbers, from 1: the header 1-4, TST-301 6-10 before its case on 11, TST-302 13-19 before its case on 20, TST-303's block 22-24 before its case on 25, the prose block 27-28, the block without
// an identifier 31-35 before its case on 36.
const LOANS = [
  "// The loans' tests.",
  "// Module: MOD-loans",
  "// Guards: LOANS ARE RECORDED",
  "// Level: unit",
  "",
  "// TST-301 · level: unit · module: MOD-loans",
  "// guards: LOANS ARE RECORDED",
  "// given: a library",
  "// input: a book is lent",
  "// expect: one open loan",
  'test("a loan is recorded", () => {});',
  "",
  "// TST-302",
  "// level: unit",
  "// module: MOD-loans",
  "// guards: LOANS ARE RECORDED",
  "// given: a library with a loan",
  "// input: the loan is renewed",
  "// expect: the loan's due date moves",
  'test("a loan is renewed", () => {});',
  "",
  "// TST-303 · level: unit · module: MOD-loans",
  "// Planted fault: the loan is not counted",
  "// guards: LOANS ARE RECORDED",
  'test("a loan is counted", () => {});',
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

// TST-1414003 · level: unit · module: MOD-test-document
// guards: EVERY ARTIFACT HAS AN IDENTIFIER; UC-029
// given: tests/loans.test.mjs of the fixture: a header, TST-301 packed on its first line, TST-302 with its keys on lines 14-19, TST-303 whose block goes on after a line "Planted fault: …" with the line "guards: …" on line 24, a prose block whose first line is "note: …", and on lines 31-35 a block whose first line is "level: unit · module: MOD-loans", before the case "a loan without its identifier"
// input: unidentifiedDeclarations of the fixture's path and text
// expect: exactly one declaration: id null, title "a loan without its identifier", level "unit", module "MOD-loans", guards ["LOANS ARE RECORDED"], given "a library", input "a call", expect "a result", runs, phrasings and paid null, path "tests/loans.test.mjs", line 31; no line of the header, of TST-302, of TST-303's block or of the prose block is one
test("TST-1414003: a block written as a declaration whose first line names no identifier is read with id null, its path and its line", () => {
  assert.deepEqual(unidentifiedDeclarations(PATH, LOANS), [{
    id: null, title: "a loan without its identifier", level: "unit", module: "MOD-loans", guards: ["LOANS ARE RECORDED"], given: "a library", input: "a call", expect: "a result",
    runs: null, phrasings: null, paid: null, path: PATH, line: 31,
  }]);
});

// TST-1414002 · level: unit · module: MOD-test-document
// guards: EVERY ARTIFACT HAS AN IDENTIFIER
// given: the same fixture
// input: testDeclarations of the fixture's path and text
// expect: known positive — TST-301 on line 6, TST-302 on line 13 and TST-303 on line 22, each with level "unit" and module "MOD-loans"; the block of lines 31-35 is none of them, and no declaration with id null is given
test("TST-1414002: testDeclarations gives the declarations that name their identifier, and none of the blocks that name none", () => {
  const read = testDeclarations(PATH, LOANS);
  assert.deepEqual(read.map((each) => [each.id, each.line, each.level, each.module]), [["TST-301", 6, "unit", "MOD-loans"], ["TST-302", 13, "unit", "MOD-loans"], ["TST-303", 22, "unit", "MOD-loans"]]);
});
