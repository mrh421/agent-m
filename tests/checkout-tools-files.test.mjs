// Module: MOD-checkout-tools
// Level: unit
// Guards: UC-049; RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS
// The tools read and write of a model endpoint in a job's checkout, in the forms opencode's read and write tools give (MIT, ported). The checkouts are
// temporary folders of the test; every expected text is stated here, none is read from a document.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkoutStrategies } from "../src/checkout-tools/index.mjs";

const { tools } = checkoutStrategies({ hidden: [] });
const contextOf = (checkout, places = { sources: {}, contents: [] }, place = "eu") => ({ product: { checkout }, places, exchange: { drafter: { place } } });

function checkout(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "agent-m-files-")));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}
const lines = (count, text = (n) => `line ${n}`) => Array.from({ length: count }, (_, i) => text(i + 1));

// TST-1240010 · level: unit · module: MOD-checkout-tools
// guards: UC-049
// given: a file long.txt of 2500 lines "line 1" … "line 2500", each ended by a newline
// input: read long.txt; read it with offset 2001; read it with offset 5 and limit 10
// expect: the first begins "<path><root>/long.txt</path>\n<type>file</type>\n<content>\n1: line 1\n", ends "2000: line 2000\n\n(Showing lines 1-2000 of 2500. Use
//   offset=2001 to continue.)\n</content>" and holds no line 2001; the second ends "2500: line 2500\n\n(End of file - total 2500 lines)\n</content>"; the third holds
//   lines 5 to 14 and "(Showing lines 5-14 of 2500. Use offset=15 to continue.)"
test("TST-1240010: read pages through a long file", async (t) => {
  const root = checkout(t);
  writeFileSync(join(root, "long.txt"), `${lines(2500).join("\n")}\n`);
  const context = contextOf(root);
  const first = await tools.read({ path: "long.txt" }, context);
  assert.ok(first.startsWith(`<path>${root}/long.txt</path>\n<type>file</type>\n<content>\n1: line 1\n`), first.slice(0, 200));
  assert.ok(first.endsWith("2000: line 2000\n\n(Showing lines 1-2000 of 2500. Use offset=2001 to continue.)\n</content>"), first.slice(-200));
  assert.equal(first.includes("2001: line 2001"), false);
  const second = await tools.read({ path: "long.txt", offset: 2001 }, context);
  assert.match(second, /<content>\n2001: line 2001\n/);
  assert.ok(second.endsWith("2500: line 2500\n\n(End of file - total 2500 lines)\n</content>"), second.slice(-200));
  const third = await tools.read({ path: "long.txt", offset: 5, limit: 10 }, context);
  assert.match(third, /<content>\n5: line 5\n6: line 6\n[\s\S]*\n14: line 14\n\n\(Showing lines 5-14 of 2500\. Use offset=15 to continue\.\)\n<\/content>$/);
  assert.equal(third.includes("15: line 15"), false);
});

// TST-1240011 · level: unit · module: MOD-checkout-tools
// guards: UC-049
// given: wide.txt of 100 lines of 1000 "a" each; one.txt with one line of 2500 "b"
// input: read wide.txt; read one.txt
// expect: wide.txt shows lines 1 to 51 — 50 KB is 51200 bytes, each line counts its bytes and one for the newline before it — and ends "(Output capped at 50 KB.
//   Showing lines 1-51. Use offset=52 to continue.)\n</content>"; one.txt shows "1: " and 2000 "b" followed by "... (line truncated to 2000 chars)"
test("TST-1240011: read caps its output at 50 KB and a line at 2000 characters", async (t) => {
  const root = checkout(t);
  writeFileSync(join(root, "wide.txt"), `${lines(100, () => "a".repeat(1000)).join("\n")}\n`);
  writeFileSync(join(root, "one.txt"), `${"b".repeat(2500)}\n`);
  const context = contextOf(root);
  const wide = await tools.read({ path: "wide.txt" }, context);
  assert.match(wide, /\n51: a{1000}\n\n\(Output capped at 50 KB\. Showing lines 1-51\. Use offset=52 to continue\.\)\n<\/content>$/);
  assert.equal(wide.includes("52: "), false);
  const one = await tools.read({ path: "one.txt" }, context);
  assert.ok(one.includes(`1: ${"b".repeat(2000)}... (line truncated to 2000 chars)\n`));
});

// TST-1240012 · level: unit · module: MOD-checkout-tools
// guards: UC-049
// given: a checkout with data.bin holding a zero byte, a folder docs/ with guide.md and sub/, and short.txt of 3 lines
// input: read data.bin; read docs; read docs/guide, the name without its extension; read short.txt with offset 10
// expect: "Cannot read binary file: <root>/data.bin"; the listing "<path><root>/docs</path>\n<type>directory</type>\n<entries>\nguide.md\nsub/\n\n(2 entries)\n</entries>";
//   "File not found: <root>/docs/guide\n\nDid you mean one of these?\n<root>/docs/guide.md"; "Offset 10 is out of range for this file (3 lines)"
test("TST-1240012: read refuses a binary file, lists a folder and names a near file for a missing one", async (t) => {
  const root = checkout(t);
  writeFileSync(join(root, "data.bin"), Buffer.from([0x41, 0x00, 0x42]));
  mkdirSync(join(root, "docs", "sub"), { recursive: true });
  writeFileSync(join(root, "docs", "guide.md"), "# Guide\n");
  writeFileSync(join(root, "short.txt"), "one\ntwo\nthree\n");
  const context = contextOf(root);
  assert.equal(await tools.read({ path: "data.bin" }, context), `Cannot read binary file: ${root}/data.bin`);
  assert.equal(await tools.read({ path: "docs" }, context), `<path>${root}/docs</path>\n<type>directory</type>\n<entries>\nguide.md\nsub/\n\n(2 entries)\n</entries>`);
  assert.equal(await tools.read({ path: "docs/guide" }, context), `File not found: ${root}/docs/guide\n\nDid you mean one of these?\n${root}/docs/guide.md`);
  assert.equal(await tools.read({ path: "short.txt", offset: 10 }, context), "Offset 10 is out of range for this file (3 lines)");
});

// TST-1240013 · level: unit · module: MOD-checkout-tools
// guards: RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS
// given: a checkout whose folder sources/norm/ holds text.md, the content of the restricted source SRC-norm, which the places allow only at "on-premises"
// input: read sources/norm/text.md and grep "clause" for a drafter at "us-cloud"; the same for a drafter at "on-premises"
// expect: at us-cloud the read answers "refused: sources/norm/text.md holds content of SRC-norm, which may not go to us-cloud" and the grep holds no line of
//   the file and that refusal; known positive: at on-premises the read holds "1: clause one" and the grep "Line 1: clause one"
test("TST-1240013: read and grep give a restricted source's content only where its source permits", async (t) => {
  const root = checkout(t);
  mkdirSync(join(root, "sources", "norm"), { recursive: true });
  writeFileSync(join(root, "sources", "norm", "text.md"), "clause one\n");
  const { execFileSync } = await import("node:child_process");
  execFileSync("git", ["init", "-q"], { cwd: root });
  const places = { sources: { "SRC-norm": ["on-premises"] }, contents: [{ source: "SRC-norm", paths: ["sources/norm/"] }] };
  const allowed = contextOf(root, places, "on-premises"), barred = contextOf(root, places, "us-cloud");
  assert.match(await tools.read({ path: "sources/norm/text.md" }, allowed), /1: clause one/, "known positive: the permitted place reads it");
  assert.match(await tools.grep({ pattern: "clause" }, allowed), /Line 1: clause one/, "known positive: the permitted place finds it");
  const refusal = "refused: sources/norm/text.md holds content of SRC-norm, which may not go to us-cloud";
  assert.equal(await tools.read({ path: "sources/norm/text.md" }, barred), refusal);
  const found = await tools.grep({ pattern: "clause" }, barred);
  assert.equal(found.includes("clause one"), false);
  assert.ok(found.includes(refusal), found);
});

// TST-1240015 · level: unit · module: MOD-checkout-tools
// guards: UC-049
// given: a checkout with crlf.txt holding a byte-order mark and "one\r\ntwo\r\n"
// input: write deep/er/new.txt with "fresh\n"; write crlf.txt with "uno\ndos\n"
// expect: both answer "Wrote file successfully."; deep/er/new.txt exists with "fresh\n"; crlf.txt holds the byte-order mark and "uno\r\ndos\r\n"
test("TST-1240015: write creates folders and keeps a file's byte-order mark and line endings", async (t) => {
  const root = checkout(t);
  writeFileSync(join(root, "crlf.txt"), "﻿one\r\ntwo\r\n");
  const context = contextOf(root);
  assert.equal(await tools.write({ path: "deep/er/new.txt", content: "fresh\n" }, context), "Wrote file successfully.");
  assert.equal(readFileSync(join(root, "deep", "er", "new.txt"), "utf8"), "fresh\n");
  assert.equal(await tools.write({ path: "crlf.txt", content: "uno\ndos\n" }, context), "Wrote file successfully.");
  assert.equal(readFileSync(join(root, "crlf.txt"), "utf8"), "﻿uno\r\ndos\r\n");
});
