// Module: MOD-checkout-tools
// Level: unit
// Guards: UC-049
// The tools grep and glob of a model endpoint in a job's checkout: the files git lists — tracked and untracked, not ignored —, matched in JavaScript, at
// most 100 results, in the forms of opencode's grep and glob tools (MIT, ported). Temporary git checkouts; every expected text is stated here.

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkoutStrategies } from "../src/checkout-tools/index.mjs";

const { tools } = checkoutStrategies({ hidden: [] });

// A git checkout with the files given as { path: text }; those named in `tracked` are added to the index, the others stay untracked.
function checkout(t, files, tracked = []) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "agent-m-search-")));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  execFileSync("git", ["init", "-q"], { cwd: root });
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  if (tracked.length) execFileSync("git", ["add", ...tracked], { cwd: root });
  return { root, context: { product: { checkout: root }, places: { sources: {}, contents: [] }, exchange: { drafter: { place: "eu" } } } };
}

// TST-1240040 · level: unit · module: MOD-checkout-tools
// guards: UC-049
// given: a git checkout with a.txt tracked ("needle one\nhay\n"), b.md untracked ("hay\na needle\n"), c.log ignored by .gitignore ("needle in log\n")
// input: grep "needle"; grep "needle" with include "*.md"; grep "absent"
// expect: "Found 2 matches\n<root>/a.txt:\n  Line 1: needle one\n\n<root>/b.md:\n  Line 2: a needle"; with include only b.md: "Found 1 matches\n<root>/b.md:\n  Line 2: a needle"; "No files found"
test("TST-1240040: grep searches the files git lists, in opencode's form", async (t) => {
  const { root, context } = checkout(t, { "a.txt": "needle one\nhay\n", "b.md": "hay\na needle\n", "c.log": "needle in log\n", ".gitignore": "*.log\n" }, ["a.txt", ".gitignore"]);
  assert.equal(await tools.grep({ pattern: "needle" }, context), `Found 2 matches\n${root}/a.txt:\n  Line 1: needle one\n\n${root}/b.md:\n  Line 2: a needle`);
  assert.equal(await tools.grep({ pattern: "needle", include: "*.md" }, context), `Found 1 matches\n${root}/b.md:\n  Line 2: a needle`);
  assert.equal(await tools.grep({ pattern: "absent" }, context), "No files found");
});

// TST-1240041 · level: unit · module: MOD-checkout-tools
// guards: UC-049
// given: a git checkout with many.txt holding 150 lines "hit 1" … "hit 150"
// input: grep "hit"
// expect: the text begins "Found 100 matches (more matches available)\n<root>/many.txt:\n  Line 1: hit 1", holds "  Line 100: hit 100" and not "  Line 101:", and ends "\n\n(Results truncated. Consider using a more specific path or pattern.)"
test("TST-1240041: grep stops at 100 matches and says so", async (t) => {
  const { root, context } = checkout(t, { "many.txt": `${Array.from({ length: 150 }, (_, i) => `hit ${i + 1}`).join("\n")}\n` });
  const found = await tools.grep({ pattern: "hit" }, context);
  assert.ok(found.startsWith(`Found 100 matches (more matches available)\n${root}/many.txt:\n  Line 1: hit 1\n`), found.slice(0, 200));
  assert.ok(found.includes("  Line 100: hit 100\n"));
  assert.equal(found.includes("  Line 101:"), false);
  assert.ok(found.endsWith("\n\n(Results truncated. Consider using a more specific path or pattern.)"));
});

// TST-1240042 · level: unit · module: MOD-checkout-tools
// guards: UC-049
// given: a git checkout with f/1.txt … f/150.txt, f/deep/x.md and top.md, all untracked
// input: glob "*.md"; glob "f/**/*.md"; glob "*.txt"; glob "*.none"; glob "*.md" with path "top.md"
// expect: "*.md" lists "<root>/f/deep/x.md" and "<root>/top.md"; "f/**/*.md" lists only "<root>/f/deep/x.md"; "*.txt" lists 100 paths and ends "\n\n(Results are truncated: showing first 100 results. Consider using a more specific path or pattern.)"; "*.none" answers "No files found"; a file as path answers "glob path must be a directory: <root>/top.md"
test("TST-1240042: glob matches the files git lists and stops at 100", async (t) => {
  const files = { "f/deep/x.md": "x\n", "top.md": "top\n" };
  for (let n = 1; n <= 150; n++) files[`f/${n}.txt`] = `${n}\n`;
  const { root, context } = checkout(t, files);
  assert.deepEqual((await tools.glob({ pattern: "*.md" }, context)).split("\n").sort(), [`${root}/f/deep/x.md`, `${root}/top.md`]);
  assert.equal(await tools.glob({ pattern: "f/**/*.md" }, context), `${root}/f/deep/x.md`);
  const many = await tools.glob({ pattern: "*.txt" }, context);
  assert.ok(many.endsWith("\n\n(Results are truncated: showing first 100 results. Consider using a more specific path or pattern.)"));
  assert.equal(many.split("\n").filter((line) => line.startsWith(`${root}/f/`)).length, 100);
  assert.equal(await tools.glob({ pattern: "*.none" }, context), "No files found");
  assert.equal(await tools.glob({ pattern: "*.md", path: "top.md" }, context), `glob path must be a directory: ${root}/top.md`);
});
