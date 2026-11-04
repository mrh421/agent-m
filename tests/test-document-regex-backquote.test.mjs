// A backquote inside a regular-expression literal opens no template string for the declaration reader (ITM-1435).
// Run: node --test tests/test-document-regex-backquote.test.mjs
//
// Module: MOD-test-document
// Guards: A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS
// Level: unit
//
// Each case puts a line in front of a declaration. The first five hold a regular-expression literal with a backquote, where a regular
// expression may stand (after `=`, `(`, `return`, opening a character class that holds a slash, or with an escaped slash). The last
// two are the known positives: a `/` that divides hides nothing, and a backquote that does open a template string still hides the
// comment-shaped lines inside it. Every case also compares the file with the same file without the literal.

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

// TST-1435001 · level: unit · module: MOD-test-document
// guards: A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS
// given: a file whose line `const RE = /`/g;` holds a regular-expression literal with one backquote after `=`, followed by a declaration
// input: that file's text, and the same file without that line
// expect: the declaration TST-900001 is read, as it is in the file without the literal
test("a regular expression holding a backquote after = opens no template string — MOD-test-document", () => {
  assert.deepEqual(idsAfter(), ["TST-900001"]);
  assert.deepEqual(idsAfter("const RE = /`/g;"), ["TST-900001"]);
});

// TST-1435002 · level: unit · module: MOD-test-document
// guards: A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS
// given: a file whose line `const out = text.replace(/`/g, "");` passes a regular-expression literal with one backquote as an argument, followed by a declaration
// input: that file's text, and the same file without that line
// expect: the declaration TST-900001 is read, as it is in the file without the literal
test("a regular expression holding a backquote as an argument opens no template string — MOD-test-document", () => {
  assert.deepEqual(idsAfter(), ["TST-900001"]);
  assert.deepEqual(idsAfter('const out = text.replace(/`/g, "");'), ["TST-900001"]);
});

// TST-1435003 · level: unit · module: MOD-test-document
// guards: A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS
// given: a file whose function returns a regular-expression literal with one backquote, `function re() { return /`+/; }`, followed by a declaration
// input: that file's text, and the same file without that line
// expect: the declaration TST-900001 is read, as it is in the file without the literal
test("a regular expression holding a backquote after return opens no template string — MOD-test-document", () => {
  assert.deepEqual(idsAfter(), ["TST-900001"]);
  assert.deepEqual(idsAfter("function re() { return /`+/; }"), ["TST-900001"]);
});

// TST-1435004 · level: unit · module: MOD-test-document
// guards: A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS
// given: a file whose line `const RE = /[/`"]\/x/;` holds a regular expression with a character class that holds a slash, a backquote and a double quote, and an escaped slash after the class, followed by a declaration
// input: that file's text, and the same file without that line
// expect: the declaration TST-900001 is read, as it is in the file without the literal
test("a slash in a character class does not end the regular expression early — MOD-test-document", () => {
  assert.deepEqual(idsAfter(), ["TST-900001"]);
  assert.deepEqual(idsAfter("const RE = /[/`\"]\\/x/;"), ["TST-900001"]);
});

// TST-1435005 · level: unit · module: MOD-test-document
// guards: A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS
// given: a file whose line `const RE = /\/`/;` holds a regular expression with an escaped slash before its backquote, followed by a declaration
// input: that file's text, and the same file without that line
// expect: the declaration TST-900001 is read, as it is in the file without the literal
test("an escaped slash does not end the regular expression early — MOD-test-document", () => {
  assert.deepEqual(idsAfter(), ["TST-900001"]);
  assert.deepEqual(idsAfter("const RE = /\\/`/;"), ["TST-900001"]);
});

// TST-1435006 · level: unit · module: MOD-test-document
// guards: A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS
// given: a file whose line `const v = a / b + `${c}/d`;` divides by `b` and holds a balanced template string with a slash in it, followed by a declaration
// input: that file's text, and the same file without that line
// expect: the declaration TST-900001 is read, as it is in the file without the line: a `/` after a name is a division, not the start of a regular expression
test("a slash after a name divides and starts no regular expression — MOD-test-document", () => {
  assert.deepEqual(idsAfter(), ["TST-900001"]);
  assert.deepEqual(idsAfter("const v = a / b + `${c}/d`;"), ["TST-900001"]);
});

// TST-1435007 · level: unit · module: MOD-test-document
// guards: A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS
// given: a file whose line opens a template string that spans lines and holds a comment-shaped declaration, after a line `const RE = /x/;` with a regular expression without a backquote
// input: that file's text
// expect: the declaration inside the template string is not read; the declaration after the closed template string is
test("a backquote outside any regular expression still opens a template string — MOD-test-document", () => {
  const inside = ["const RE = /x/;", "const T = `", "// TST-900002 · level: unit", "`;"];
  assert.deepEqual(idsAfter(...inside), ["TST-900001"]);
});
