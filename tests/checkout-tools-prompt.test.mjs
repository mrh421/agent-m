// Module: MOD-checkout-tools
// Level: unit
// Guards: UC-049; ONE DEFINITION, THREE DRIVERS
// The prompt a model endpoint reads before a job in a checkout — its environment and how it uses its tools —, and the seven tools as data in the
// catalogue, each with a strategy of the same name. Every expected text is stated here.

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkoutPrompt, checkoutStrategies } from "../src/checkout-tools/index.mjs";
import { toolsOf } from "../src/job-catalogue/index.mjs";

const NAMES = ["read", "write", "edit", "bash", "grep", "glob", "webfetch"];

// TST-1240060 · level: unit · module: MOD-checkout-tools
// guards: UC-049
// given: a git checkout on the branch work-1240060; the date 2026-10-26
// input: checkoutPrompt({ folder: the checkout, now: 2026-10-26T12:00:00Z })
// expect: the prompt names the working folder, the platform (process.platform), the date 2026-10-26 and "git: yes, on the branch work-1240060"; it tells the
//   model to use read, edit, write, grep and glob rather than cat, sed or grep in bash, to give bash a workdir rather than cd, never to put the "N: " prefix of
//   read into an edit, to verify with the project's own tests, and Agent M's git rule; it is at most 60 lines and holds no unfilled "{" placeholder "}"
test("TST-1240060: the prompt names the environment and how the tools are used", async (t) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "agent-m-prompt-")));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  execFileSync("git", ["init", "-q", "-b", "work-1240060"], { cwd: root });
  const prompt = await checkoutPrompt({ folder: root, now: new Date("2026-10-26T12:00:00Z") });
  assert.ok(prompt.includes(`Working folder: ${root}`), prompt);
  assert.ok(prompt.includes(`Platform: ${process.platform}`));
  assert.ok(prompt.includes("Date: 2026-10-26"));
  assert.ok(prompt.includes("Git: yes, on the branch work-1240060"));
  for (const rule of [/rather than `cat`/, /`sed`/, /`workdir`/, /`N: `/, /project's own tests/, /commit/]) assert.match(prompt, rule);
  assert.ok(prompt.split("\n").length <= 60, `${prompt.split("\n").length} lines`);
  assert.equal(/\{[a-z]+\}/.test(prompt), false, "every placeholder is filled");
});

// TST-1240061 · level: unit · module: MOD-checkout-tools
// guards: ONE DEFINITION, THREE DRIVERS
// given: the catalogue's tools.md and the strategies of this module
// input: toolsOf the seven names read, write, edit, bash, grep, glob, webfetch; the names of checkoutStrategies' tools
// expect: seven definitions, each with a description and an input schema of type object; read, grep and glob need "read the repository", write and edit
//   "write to the repository", bash "run code and tests", webfetch "reach the web"; the strategies' names are exactly the seven
test("TST-1240061: the seven tools are data in the catalogue, each with a strategy of its name", async () => {
  const definitions = await toolsOf(NAMES);
  assert.deepEqual(definitions.map((each) => each.name), NAMES);
  for (const each of definitions) {
    assert.ok(each.description.length > 20, each.name);
    assert.equal(each.input.type, "object", each.name);
  }
  assert.deepEqual(Object.fromEntries(definitions.map((each) => [each.name, each.needs])), {
    read: "read the repository", write: "write to the repository", edit: "write to the repository", bash: "run code and tests",
    grep: "read the repository", glob: "read the repository", webfetch: "reach the web" });
  assert.deepEqual(Object.keys(checkoutStrategies({ hidden: [] }).tools).sort(), [...NAMES].sort());
});
