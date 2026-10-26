// Module: MOD-checkout-tools
// Level: unit
// Guards: UC-049; RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS
// Every tool of a model endpoint in a job's checkout works on paths inside that checkout only: each path is resolved through every symbolic link and
// refused when it lies outside. The checkouts are temporary folders of the test; nothing leaves the computer. Every expected value is stated here.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkoutStrategies } from "../src/checkout-tools/index.mjs";

const { tools } = checkoutStrategies({ hidden: [] });
const contextOf = (checkout) => ({ product: { checkout }, places: { sources: {}, contents: [] }, exchange: { drafter: { place: "eu" } } });

// A checkout with a.txt, and beside it — outside it — a folder holding secret.txt.
function world(t) {
  const base = realpathSync(mkdtempSync(join(tmpdir(), "agent-m-paths-")));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const root = join(base, "checkout"), outside = join(base, "outside");
  mkdirSync(root);
  mkdirSync(outside);
  writeFileSync(join(root, "a.txt"), "inside text\n");
  writeFileSync(join(outside, "secret.txt"), "outside text\n");
  return { root, outside };
}

// TST-1240001 · level: unit · module: MOD-checkout-tools
// guards: UC-049
// given: a checkout holding a.txt with "inside text"; beside the checkout a folder holding secret.txt with "outside text"
// input: read, write, edit, grep and glob of "../outside/secret.txt" or "../outside", the same by its absolute path, and bash with workdir "../outside"
// expect: each answer starts "refused: " and names the path as outside the checkout; secret.txt is unchanged and no file appears outside;
//   known positive: read of "a.txt" holds "1: inside text"
test("TST-1240001: a path outside the checkout is refused by every tool", async (t) => {
  const { root, outside } = world(t);
  const context = contextOf(root);
  assert.match(await tools.read({ path: "a.txt" }, context), /1: inside text/, "known positive: a path inside is read");
  const calls = [
    ["read", { path: "../outside/secret.txt" }], ["read", { path: join(outside, "secret.txt") }],
    ["write", { path: "../outside/new.txt", content: "x" }], ["write", { path: join(outside, "new.txt"), content: "x" }],
    ["edit", { path: "../outside/secret.txt", oldString: "outside", newString: "changed" }],
    ["grep", { pattern: "text", path: "../outside" }], ["glob", { pattern: "*.txt", path: outside }],
    ["bash", { command: "echo ran > ran.txt", workdir: "../outside" }],
  ];
  for (const [name, args] of calls) {
    const answer = await tools[name](args, context);
    assert.match(answer, /^refused: .* is outside the checkout/, `${name} ${JSON.stringify(args)}`);
  }
  assert.equal(readFileSync(join(outside, "secret.txt"), "utf8"), "outside text\n");
  assert.equal(existsSync(join(outside, "new.txt")), false);
  assert.equal(existsSync(join(outside, "ran.txt")), false);
});

// TST-1240002 · level: unit · module: MOD-checkout-tools
// guards: UC-049
// given: the checkout of TST-1240001 with a symbolic link link.txt to ../outside/secret.txt, a link out/ to the outside folder, and a link inner.txt to a.txt
// input: read link.txt; write out/new.txt; edit link.txt; read inner.txt
// expect: the three through a link that leaves the checkout start "refused: " and name it outside the checkout; secret.txt is unchanged and out/new.txt
//   is not written; known positive: inner.txt, a link that stays inside, is read with "1: inside text"
test("TST-1240002: a symbolic link that leads out of the checkout is refused", async (t) => {
  const { root, outside } = world(t);
  symlinkSync(join(outside, "secret.txt"), join(root, "link.txt"));
  symlinkSync(outside, join(root, "out"));
  symlinkSync(join(root, "a.txt"), join(root, "inner.txt"));
  const context = contextOf(root);
  assert.match(await tools.read({ path: "inner.txt" }, context), /1: inside text/, "known positive: a link inside the checkout is read");
  assert.match(await tools.read({ path: "link.txt" }, context), /^refused: .* is outside the checkout/);
  assert.match(await tools.write({ path: "out/new.txt", content: "x" }, context), /^refused: .* is outside the checkout/);
  assert.match(await tools.edit({ path: "link.txt", oldString: "outside", newString: "changed" }, context), /^refused: .* is outside the checkout/);
  assert.equal(readFileSync(join(outside, "secret.txt"), "utf8"), "outside text\n");
  assert.equal(existsSync(join(outside, "new.txt")), false);
});

// TST-1240003 · level: unit · module: MOD-checkout-tools
// guards: UC-049
// given: a job context whose product has no checkout (null)
// input: read of "a.txt" and bash of "pwd"
// expect: both answer "refused: this job works in no checkout"
test("TST-1240003: a job without a checkout is refused", async () => {
  const context = contextOf(null);
  assert.equal(await tools.read({ path: "a.txt" }, context), "refused: this job works in no checkout");
  assert.equal(await tools.bash({ command: "pwd" }, context), "refused: this job works in no checkout");
});
