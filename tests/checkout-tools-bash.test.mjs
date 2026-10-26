// Module: MOD-checkout-tools
// Level: unit
// Guards: UC-049; A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET
// The tool bash of a model endpoint in a job's checkout: a command run by the shell in the checkout, its combined output's tail and its exit code in the text
// the model reads, a timeout that ends the command's whole process group, and no environment variable a CI secret fills. Real processes of this
// machine, in temporary folders; every expected text is stated here.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkoutStrategies } from "../src/checkout-tools/index.mjs";

function checkout(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "agent-m-bash-")));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return { root, context: { product: { checkout: root }, places: { sources: {}, contents: [] }, exchange: { drafter: { place: "eu" } } } };
}
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const bash = checkoutStrategies({ hidden: [] }).tools.bash;

// TST-1240030 · level: unit · module: MOD-checkout-tools
// guards: UC-049
// given: a checkout with a folder sub/
// input: bash "echo out; echo err >&2; exit 3"; bash "pwd" with workdir "sub"
// expect: the first text holds "out" and "err" and, in its <shell_metadata> block, "exit code: 3"; the second holds "<root>/sub" and "exit code: 0"
test("TST-1240030: the exit code and the combined output are in the text the model reads", async (t) => {
  const { root, context } = checkout(t);
  mkdirSync(join(root, "sub"));
  const failed = await bash({ command: "echo out; echo err >&2; exit 3" }, context);
  assert.match(failed, /out\n/);
  assert.match(failed, /err\n/);
  assert.match(failed, /<shell_metadata>\n(?:.*\n)*exit code: 3\n<\/shell_metadata>$/);
  const there = await bash({ command: "pwd", workdir: "sub" }, context);
  assert.ok(there.startsWith(`${root}/sub\n`), there);
  assert.match(there, /exit code: 0\n<\/shell_metadata>$/);
});

// TST-1240031 · level: unit · module: MOD-checkout-tools
// guards: UC-049
// given: two commands that each start a background sleep of 30 s and write its process id to a file, then wait; the second ignores SIGTERM
// input: bash of each with timeout 500 ms
// expect: each text holds "shell tool terminated command after exceeding timeout 500 ms. If this command is expected to take longer and is not waiting for
//   interactive input, retry with a larger timeout value in milliseconds."; afterwards neither sleep is alive; the second took at least 3 s, the time
//   SIGTERM is given before SIGKILL; known positive: the first sleep is alive while its command runs
test("TST-1240031: a timeout ends the command's whole process tree, SIGKILL 3 s after SIGTERM", async (t) => {
  const { root, context } = checkout(t);
  const message = "shell tool terminated command after exceeding timeout 500 ms. If this command is expected to take longer and is not waiting for interactive input, retry with a larger timeout value in milliseconds.";
  const running = bash({ command: "sleep 30 & echo $! > pid1; wait", timeout: 500 }, context);
  for (let i = 0; i < 100 && !existsSync(join(root, "pid1")); i++) await new Promise((resolve) => setTimeout(resolve, 10));
  const first = Number(readFileSync(join(root, "pid1"), "utf8"));
  assert.equal(alive(first), true, "known positive: the background sleep runs while its command runs");
  assert.ok((await running).includes(message));
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(alive(first), false, "the background sleep is ended with its command");
  const started = Date.now();
  const stubborn = await bash({ command: "trap '' TERM; sleep 30 & echo $! > pid2; wait", timeout: 500 }, context);
  assert.ok(stubborn.includes(message));
  assert.ok(Date.now() - started >= 3000, "SIGKILL follows SIGTERM after 3 s");
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(alive(Number(readFileSync(join(root, "pid2"), "utf8"))), false, "a sleep that ignores SIGTERM is killed");
});

// TST-1240032 · level: unit · module: MOD-checkout-tools
// guards: UC-049
// given: a command that prints the numbers 1 to 3000, one per line
// input: bash "seq 1 3000"
// expect: the text begins "...output truncated...\n\nFull output saved to: <file>\n\n" with <file> outside the checkout; it holds the last 2000 lines, "1001" to
//   "3000", and not the line "1000"; the saved file holds all 3000 lines
test("TST-1240032: a long output is cut to its tail, the whole saved outside the checkout", async (t) => {
  const { root, context } = checkout(t);
  const text = await bash({ command: "seq 1 3000" }, context);
  const saved = /^\.\.\.output truncated\.\.\.\n\nFull output saved to: (.+)\n\n/.exec(text);
  assert.ok(saved, text.slice(0, 200));
  const file = saved[1];
  t.after(() => rmSync(file, { force: true }));
  assert.equal(file.startsWith(`${root}/`), false, "the saved file lies outside the checkout");
  const shown = text.slice(saved[0].length).split("\n");
  assert.equal(shown[0], "1001");
  assert.ok(shown.includes("3000"));
  assert.equal(shown.includes("1000"), false);
  assert.equal(readFileSync(file, "utf8").trim().split("\n").length, 3000);
});

// TST-1240033 · level: unit · module: MOD-checkout-tools
// guards: A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET
// given: this process's environment holds FIXTURE_ENDPOINT_KEY "sk-fixture-1240033" and FIXTURE_VISIBLE "seen"
// input: bash "echo key=$FIXTURE_ENDPOINT_KEY visible=$FIXTURE_VISIBLE" with the tools made hiding FIXTURE_ENDPOINT_KEY; the same with tools hiding nothing
// expect: hidden: the text holds "key= visible=seen" and not the key; known positive: hiding nothing, it holds "key=sk-fixture-1240033"
test("TST-1240033: a variable a CI secret fills is not in the command's environment", async (t) => {
  const { context } = checkout(t);
  process.env.FIXTURE_ENDPOINT_KEY = "sk-fixture-1240033";
  process.env.FIXTURE_VISIBLE = "seen";
  t.after(() => { delete process.env.FIXTURE_ENDPOINT_KEY; delete process.env.FIXTURE_VISIBLE; });
  const command = "echo key=$FIXTURE_ENDPOINT_KEY visible=$FIXTURE_VISIBLE";
  assert.match(await bash({ command }, context), /key=sk-fixture-1240033/, "known positive: an unhidden variable reaches the command");
  const hidden = await checkoutStrategies({ hidden: ["FIXTURE_ENDPOINT_KEY"] }).tools.bash({ command }, context);
  assert.match(hidden, /key= visible=seen/);
  assert.equal(hidden.includes("sk-fixture-1240033"), false);
});
