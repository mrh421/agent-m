// A backquote inside a quoted string or a `//` comment opens no template string for the declaration reader (ITM-1285).
// Run: node --test tests/test-document-backquote-in-string.test.mjs
//
// Module: MOD-test-document
// Guards: A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS
// Level: unit
//
// Each case puts a line holding one backquote that is no template string in front of a declaration. The last case is the known
// positive: a backquote that does open a template string still hides the comment-shaped lines inside it.

import test from "node:test";
import assert from "node:assert/strict";
import { testDeclarations } from "../src/test-document/index.mjs";

const DECLARATION = [
  "// TST-900001 · level: unit · module: MOD-sample",
  "// guards: A SAMPLE REQUIREMENT",
  "// given: a sample precondition",
  "// input: a sample input",
  "// expect: a sample expected result",
  'test("the sample case", () => {});',
  "",
];

// The ids a file reads when `lines` stand before the declaration above.
const idsAfter = (...lines) => testDeclarations("tests/sample.test.mjs", [...lines, ...DECLARATION].join("\n")).map((d) => d.id);

// TST-1285001 · level: unit · module: MOD-test-document
// guards: A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS
// given: a file whose line `const TICK = "`";` holds one backquote inside a double-quoted string, followed by a declaration
// input: that file's text
// expect: the declaration TST-900001 is read
test("a backquote inside a double-quoted string opens no template string — MOD-test-document", () => {
  assert.deepEqual(idsAfter('const TICK = "`";'), ["TST-900001"]);
});

// TST-1285002 · level: unit · module: MOD-test-document
// guards: A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS
// given: a file whose line `const TICK = '`';` holds one backquote inside a single-quoted string, followed by a declaration
// input: that file's text
// expect: the declaration TST-900001 is read
test("a backquote inside a single-quoted string opens no template string — MOD-test-document", () => {
  assert.deepEqual(idsAfter("const TICK = '`';"), ["TST-900001"]);
});

// TST-1285003 · level: unit · module: MOD-test-document
// guards: A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS
// given: a file whose code line ends in a `//` comment holding one backquote, followed by a declaration
// input: that file's text
// expect: the declaration TST-900001 is read
test("a backquote inside a trailing // comment opens no template string — MOD-test-document", () => {
  assert.deepEqual(idsAfter("const x = 1; // the ` here"), ["TST-900001"]);
});

// TST-1285004 · level: unit · module: MOD-test-document
// guards: A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS
// given: a file whose line holds a double-quoted string with an escaped quote before its backquote, `const S = "say \"hi\" `";`, followed by a declaration
// input: that file's text
// expect: the declaration TST-900001 is read
test("an escaped quote does not end the string that holds the backquote — MOD-test-document", () => {
  assert.deepEqual(idsAfter('const S = "say \\"hi\\" `";'), ["TST-900001"]);
});

// TST-1285005 · level: unit · module: MOD-test-document
// guards: A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS
// given: a file whose line opens a template string that spans lines and holds a comment-shaped declaration, then a line `const U = "a" + `x`;` whose backquotes are balanced
// input: that file's text
// expect: the declaration inside the template string is not read; the declaration after the closed template string is
test("a backquote outside any quoted string still opens a template string — MOD-test-document", () => {
  const inside = ["const T = `", "// TST-900002 · level: unit", "`;", 'const U = "a" + `x`;'];
  assert.deepEqual(idsAfter(...inside), ["TST-900001"]);
});
