// Release tests of ITM-1285 — a backquote inside a quoted string opens no template string for the declaration reader, seen in the real test files of this
// repository that hold one. The behaviour is the SPEC's A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS ("Every test case names its input, its precondition
// and its expected result in a form that can be read without running it"), as docs/architecture/MOD-test-document.md states it: "A declaration is a block of
// comment lines directly before a test case" and `testDeclarations(path, text)` returns "every declaration in a test file, in order". A test file that holds
// `const TICK = "`";` and loses every declaration after it reads as a file with none, and the test is then invisible to the checks that read declarations.
// Run: node --test tests/release-itm-1285-backquote-in-string-real-files.test.mjs
//
// Module: MOD-test-document
// Guards: A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS
// Level: release
//
// Written for the release testing of sprint 111 by a participant who implemented none of ITM-1285 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The
// implementers' cases (tests/test-document-backquote-in-string.test.mjs) read small constructed texts; these cases read the files of tests/ as they stand,
// through the interface testDeclarations from src/test-document/index.mjs, and compare with an oracle that does not use the reader: the lines of the file
// whose text is `// TST-<n>` or `// TST-<n> · …`, the first line of a declaration (MOD-test-document, Data). Readings the texts leave open:
//   - "holds a quoted backquote": a line that is only `const|let|var NAME = "…`…";` or `= '…`…';` with the one backquote inside the literal. Other forms of the
//     item's three (a backquote in a `//` comment) are seen on the same real file with its line rewritten, as no real file of tests/ is a closed example.
//   - "keep their declarations": the same identifiers, at the same lines, with the same keys, as the file read when its quoted-backquote line is not there.
//   - the oracle assumes no listed file holds a declaration-shaped line inside a template string; the file read as the known positive of a template that does
//     hide them is tests/job-runner-check-fixes.test.mjs, which does.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { testDeclarations } from "../src/test-document/index.mjs";

const TESTS = fileURLToPath(new URL("./", import.meta.url));
const read = (name) => readFileSync(TESTS + name, "utf8");
const pathOf = (name) => `tests/${name}`;

const QUOTED_BACKQUOTE_LINE = /^\s*(?:const|let|var)\s+\w+\s*=\s*(?:"[^"`]*`[^"`]*"|'[^'`]*`[^'`]*')\s*;?\s*$/;
// The first line of a declaration as MOD-test-document, Data, writes it: the identifier alone or followed by ` · key: value` parts.
const DECLARATION_FIRST_LINE = /^\s*\/\/ (TST-\d+)(?: · .*)?\s*$/;

/** The names of the files of tests/ that hold a line which is only a constant set to a quoted string with one backquote in it. */
const filesHoldingQuotedBackquote = () => readdirSync(TESTS)
  .filter((name) => name.endsWith(".test.mjs"))
  .filter((name) => read(name).split("\n").some((line) => QUOTED_BACKQUOTE_LINE.test(line)))
  .sort();

/** [identifier, line] of every declaration-first line of `text`, in order — the oracle, which does not use the reader. */
const firstLinesOf = (text) => text.split("\n").flatMap((line, i) => {
  const m = DECLARATION_FIRST_LINE.exec(line);
  return m === null ? [] : [[m[1], i + 1]];
});
const readIdsAndLines = (name, text) => testDeclarations(pathOf(name), text).map((d) => [d.id, d.line]);

const WAITING = "trace-pages-waiting-changes.test.mjs";
const TICK_LINE = 'const TICK = "`";';

// TST-1285301 · level: release · module: MOD-test-document
// guards: A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS
// given: tests/trace-pages-waiting-changes.test.mjs as it stands, whose line 25 is `const TICK = "`";` (the file the item names) and whose six declarations TST-878001 to TST-878006 all come after it; known positive first — the same file with that line made a real template opener reads none of them
// input: the file's path and text given to testDeclarations
// expect: the six declarations are read, in order, at the lines that the file's own first-line oracle firstLinesOf finds, each with level unit, module MOD-trace-pages, at least one guarded name, and a given, an input and an expect
// Planted fault: the reader counting every unescaped backquote as before the item (the `quote` tracking of templateOpenAfter in src/test-document/declarations.mjs left out) reads none of them, and the case fails on the line count.
test("TST-1285301 the file the item names keeps all six declarations that come after its quoted backquote", () => {
  const text = read(WAITING);
  const lines = text.split("\n");
  assert.equal(lines[24], TICK_LINE, "the file still holds the line the item names, at line 25");

  const lost = text.replace(TICK_LINE, "const TICK = `;");
  assert.deepEqual(testDeclarations(pathOf(WAITING), lost), [], "known positive: a backquote that does open a template string hides every declaration after it");

  const read1 = testDeclarations(pathOf(WAITING), text);
  const expected = firstLinesOf(text);
  assert.deepEqual(expected.map(([id]) => id), ["TST-878001", "TST-878002", "TST-878003", "TST-878004", "TST-878005", "TST-878006"], "the oracle finds the six identifiers, in order");
  assert.deepEqual(read1.map((d) => [d.id, d.line]), expected);
  for (const d of read1) {
    assert.equal(d.level, "unit", d.id);
    assert.equal(d.module, "MOD-trace-pages", d.id);
    assert.ok(d.guards.length >= 1, `${d.id} guards something`);
    for (const key of ["given", "input", "expect", "title"]) assert.ok(typeof d[key] === "string" && d[key] !== "", `${d.id} ${key}`);
  }
});

// TST-1285302 · level: release · module: MOD-test-document
// guards: A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS
// given: every file of tests/ that holds a line which is only a constant set to a quoted string with one backquote in it — at least the twelve found at the time of writing, tests/trace-pages-waiting-changes.test.mjs among them; known positive first — the finder lists that file and does not list tests/test-document-declarations.test.mjs
// input: each file's text given to testDeclarations
// expect: for each file the identifiers and lines read equal, in order, the identifiers and lines of the declaration-first lines `// TST-<n>` or `// TST-<n> · …` that the file holds, and the file reads at least one
// Planted fault: the reader counting every unescaped backquote (`quote` tracking left out of templateOpenAfter in src/test-document/declarations.mjs) loses the declarations after the quoted backquote in each of those files, and the case fails naming the first file.
test("TST-1285302 every real test file with a quoted backquote reads exactly the declarations its first lines show", () => {
  const files = filesHoldingQuotedBackquote();
  assert.ok(files.includes(WAITING), "known positive: the finder lists the file the item names");
  assert.ok(!files.includes("test-document-declarations.test.mjs"), "known negative: a file with no such line is not listed");
  assert.ok(files.length >= 12, `${files.length} files hold a quoted backquote`);
  for (const name of files) {
    const text = read(name);
    const expected = firstLinesOf(text);
    assert.ok(expected.length >= 1, `${name} holds a declaration`);
    assert.deepEqual(readIdsAndLines(name, text), expected, name);
  }
});

// TST-1285303 · level: release · module: MOD-test-document
// guards: A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS
// given: tests/trace-pages-waiting-changes.test.mjs with its line 25 written in each of the other forms the item names — `const TICK = '`';` (single-quoted), `const TICK = "say \"`";` (an escaped quote before the backquote) and `const TICK = 1; // the ` here` (a backquote after a `//`)
// input: each rewritten text given to testDeclarations
// expect: each reads the same declarations, at the same lines and with the same keys, as the original file does
// Planted fault: the reader with the single-quote branch (`c === '"' || c === "'"`) cut to the double quote only fails the first form; with the escape branch (`c === "\\"`) left out, the second; with the `//` branch left out, the third.
test("TST-1285303 the item's other forms in the file it names read the same declarations as the file", () => {
  const text = read(WAITING);
  const original = testDeclarations(pathOf(WAITING), text);
  assert.equal(original.length, 6, "the original reads six");
  for (const [form, line] of [
    ["single-quoted", "const TICK = '`';"],
    ["an escaped quote before the backquote", 'const TICK = "say \\"`";'],
    ["after a // comment", "const TICK = 1; // the ` here"],
  ]) {
    const rewritten = text.replace(TICK_LINE, line);
    assert.notEqual(rewritten, text, `${form}: the line was rewritten`);
    assert.deepEqual(testDeclarations(pathOf(WAITING), rewritten), original, form);
  }
});

// TST-1285304 · level: release · module: MOD-test-document
// guards: A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS
// given: tests/job-runner-check-fixes.test.mjs, whose line 108 is `const FENCE = "```";` (three backquotes inside one quoted string) and whose `DECLARED` template string, from line 190, spans lines that hold the comment-shaped declaration TST-584001, with the declaration TST-472318 after it; and tests/trace-pages-waiting-changes.test.mjs with its quoted-backquote line rewritten to open a template string (`const TICK = \``) whose next line is the declaration-shaped `// TST-999001 · level: unit · module: MOD-trace-pages` and the line after it closes it (`\`;`)
// input: each text given to testDeclarations
// expect: the first file reads TST-584001 nowhere and reads the four declarations that stand outside a template string, TST-472318 among them; the second reads none of the declarations inside the template string it now holds
// Planted fault: the reader that tracks quotes but never opens a template string (the `open = true` of templateOpenAfter in src/test-document/declarations.mjs left out) reads TST-584001 from inside the template string, and the case fails on it.
test("TST-1285304 a backquote that does open a template string still hides the declarations inside it, in a real file", () => {
  const checkFixes = testDeclarations(pathOf("job-runner-check-fixes.test.mjs"), read("job-runner-check-fixes.test.mjs"));
  assert.ok(!checkFixes.some((d) => d.id === "TST-584001"), "TST-584001 stands inside a template string and is no declaration");
  assert.equal(checkFixes.length, 4, "the four declarations outside a template string are read");
  assert.ok(checkFixes.some((d) => d.id === "TST-472318"), "known positive: a declaration outside the template string, after it (line 204), is read");

  const text = read(WAITING);
  const lines = text.split("\n");
  lines[24] = "const TICK = `";
  lines.splice(25, 0, "// TST-999001 · level: unit · module: MOD-trace-pages", "`;");
  const hidden = testDeclarations(pathOf(WAITING), lines.join("\n")).map((d) => d.id);
  assert.ok(!hidden.includes("TST-999001"), "the declaration-shaped line inside the template string is not read");
  assert.ok(hidden.includes("TST-878006"), "the declarations after the closed template string are read");
});
