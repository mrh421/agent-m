// Module: MOD-checkout-tools
// Level: unit
// Guards: UC-049
// The tool edit of a model endpoint in a job's checkout: opencode 2.1.4's matcher (MIT, ported) — exact, then typographic quotes, dashes and spaces made
// plain, then each line without its trailing whitespace — on the LF view of a file, keeping the file's own line endings, and its error messages. Every
// expected text is stated here.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkoutStrategies } from "../src/checkout-tools/index.mjs";

const { tools } = checkoutStrategies({ hidden: [] });

// A checkout holding a.txt with the given bytes; edit(args) edits a.txt and returns [answer, the file's bytes afterwards].
function fileWith(t, text) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "agent-m-edit-")));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, "a.txt"), text);
  const context = { product: { checkout: root }, places: { sources: {}, contents: [] }, exchange: { drafter: { place: "eu" } } };
  return async (args) => [await tools.edit({ path: "a.txt", ...args }, context), readFileSync(join(root, "a.txt"), "utf8")];
}

// TST-1240020 · level: unit · module: MOD-checkout-tools
// guards: UC-049
// given: a.txt holding "alpha\nbeta\ngamma\n"
// input: edit oldString "beta", newString "BETA"
// expect: "Edited a.txt (1 replacement)"; a.txt holds "alpha\nBETA\ngamma\n"
test("TST-1240020: an exact match is replaced", async (t) => {
  const edit = fileWith(t, "alpha\nbeta\ngamma\n");
  assert.deepEqual(await edit({ oldString: "beta", newString: "BETA" }), ["Edited a.txt (1 replacement)", "alpha\nBETA\ngamma\n"]);
});

// TST-1240021 · level: unit · module: MOD-checkout-tools
// guards: UC-049
// given: a.txt holding "say “hello” — it’s fine\nnext\n" — curly quotes, an em dash, a curly apostrophe and a no-break space
// input: edit oldString "say \"hello\" - it's fine", the plain spelling, newString "say hi"
// expect: "Edited a.txt (1 replacement)"; a.txt holds "say hi\nnext\n"
test("TST-1240021: typographic quotes, dashes and spaces match their plain spelling", async (t) => {
  const edit = fileWith(t, "say “hello” — it’s fine\nnext\n");
  assert.deepEqual(await edit({ oldString: "say \"hello\" - it's fine", newString: "say hi" }), ["Edited a.txt (1 replacement)", "say hi\nnext\n"]);
});

// TST-1240022 · level: unit · module: MOD-checkout-tools
// guards: UC-049
// given: a.txt holding "  one  \n  two\t\nthree\n" — trailing spaces and a trailing tab
// input: edit oldString "  one\n  two\n", newString "  ONE\n  TWO\n"
// expect: "Edited a.txt (1 replacement)"; a.txt holds "  ONE\n  TWO\nthree\n"
test("TST-1240022: lines match without their trailing whitespace", async (t) => {
  const edit = fileWith(t, "  one  \n  two\t\nthree\n");
  assert.deepEqual(await edit({ oldString: "  one\n  two\n", newString: "  ONE\n  TWO\n" }), ["Edited a.txt (1 replacement)", "  ONE\n  TWO\nthree\n"]);
});

// TST-1240023 · level: unit · module: MOD-checkout-tools
// guards: UC-049
// given: a.txt holding "a\r\nb\r\nc\r\n", with Windows line endings
// input: edit oldString "a\nb\n", newString "a\nB\n", written with LF as read shows the file
// expect: "Edited a.txt (1 replacement)"; a.txt holds "a\r\nB\r\nc\r\n" — the file's CRLF endings kept
test("TST-1240023: an edit on the LF view of a CRLF file keeps the file's endings", async (t) => {
  const edit = fileWith(t, "a\r\nb\r\nc\r\n");
  assert.deepEqual(await edit({ oldString: "a\nb\n", newString: "a\nB\n" }), ["Edited a.txt (1 replacement)", "a\r\nB\r\nc\r\n"]);
});

// TST-1240024 · level: unit · module: MOD-checkout-tools
// guards: UC-049
// given: a.txt holding "alpha\nbeta\n"
// input: edit oldString "delta"; edit oldString "" with newString "x"; edit oldString "beta" with newString "beta"
// expect: "Could not find oldString in a.txt. It must match exactly, including whitespace and indentation."; "oldString must not be empty. Use write to create
//   or overwrite a file."; "No changes to apply: oldString and newString are identical."; a.txt unchanged after each
test("TST-1240024: a text not found, an empty oldString and an edit without change are refused in opencode's words", async (t) => {
  const edit = fileWith(t, "alpha\nbeta\n");
  assert.deepEqual(await edit({ oldString: "delta", newString: "x" }),
    ["Could not find oldString in a.txt. It must match exactly, including whitespace and indentation.", "alpha\nbeta\n"]);
  assert.deepEqual(await edit({ oldString: "", newString: "x" }), ["oldString must not be empty. Use write to create or overwrite a file.", "alpha\nbeta\n"]);
  assert.deepEqual(await edit({ oldString: "beta", newString: "beta" }), ["No changes to apply: oldString and newString are identical.", "alpha\nbeta\n"]);
});

// TST-1240025 · level: unit · module: MOD-checkout-tools
// guards: UC-049
// given: a.txt holding "x = 1\nx = 1\n"
// input: edit oldString "x = 1", newString "x = 2"; then the same with replaceAll true
// expect: first "Found 2 matches for oldString, but expected exactly one. Add more surrounding context to make oldString unique, or set replaceAll to true to
//   replace every occurrence." with a.txt unchanged; then "Edited a.txt (2 replacements)" and a.txt holds "x = 2\nx = 2\n"
test("TST-1240025: an oldString that matches twice is refused unless replaceAll is set", async (t) => {
  const edit = fileWith(t, "x = 1\nx = 1\n");
  assert.deepEqual(await edit({ oldString: "x = 1", newString: "x = 2" }), ["Found 2 matches for oldString, but expected exactly one. Add more surrounding context to make oldString unique, or set replaceAll to true to replace every occurrence.", "x = 1\nx = 1\n"]);
  assert.deepEqual(await edit({ oldString: "x = 1", newString: "x = 2", replaceAll: true }), ["Edited a.txt (2 replacements)", "x = 2\nx = 2\n"]);
});

// TST-1240026 · level: unit · module: MOD-checkout-tools
// guards: UC-049
// given: a.txt holding a byte-order mark and "keep\nme\n"
// input: edit oldString "me", newString "you"
// expect: "Edited a.txt (1 replacement)"; a.txt holds the byte-order mark and "keep\nyou\n"
test("TST-1240026: an edit keeps the file's byte-order mark", async (t) => {
  const edit = fileWith(t, "﻿keep\nme\n");
  assert.deepEqual(await edit({ oldString: "me", newString: "you" }), ["Edited a.txt (1 replacement)", "﻿keep\nyou\n"]);
});
