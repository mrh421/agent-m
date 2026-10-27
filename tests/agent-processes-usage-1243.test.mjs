// ITM-1243: an agent's usage is the sum of what each step reported — opencode prints one `step_finish` per step.
// Module: MOD-agent-processes
// Guards: NO COST IS GUESSED; A RUN HAS LIMITS FIXED AT ITS START
// Level: unit
// Run: node --test tests/agent-processes-usage-1243.test.mjs

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { agentDriver } from "../src/agent-processes/index.mjs";

const node = process.execPath;
// opencode 2.1.4's `opencode run --format json` for a task of two tool-calling steps and an answer, in its event
// shapes; ids, paths and values are synthetic. The steps report input 1200 and 1500, output 30 and 45.
const STEPS_FILE = new URL("./fixtures/agent-processes/opencode-steps.jsonl", import.meta.url);
const STEP_LINES = readFileSync(STEPS_FILE, "utf8").split("\n").filter(Boolean);
// Claude Code's `claude -p --output-format json` result line, as TST-1239001 uses it: input 17, output 9.
const RESULT_LINE = readFileSync(new URL("./fixtures/agent-processes/claude-result.json", import.meta.url), "utf8");
const PARTICIPANT = {
  name: "fixture-cli-agent", type: "CLI agent", model: "fixture-model", context: 200000, price: null,
  capabilities: ["draft text"], place: "fixture", route: "bridge fixture agent",
};
const INPUT = { prompt: "Name one colour.", parts: [], output: null, findings: [], previous: null, workdir: null };
const agent = (name) => ({ name, installed: true, version: "1.0.0", loggedIn: true, login: `${name} auth login`,
  install: { macos: "https://example.invalid/", windows: "https://example.invalid/", linux: "https://example.invalid/" } });

const typeOf = (line) => JSON.parse(line).type;
const finishes = (lines) => lines.filter((line) => typeOf(line) === "step_finish");
const joined = (lines) => `${lines.join("\n")}\n`;

// A fixture `name` alone on the PATH that reads its task on standard input and prints `output`.
function fixture(folder, name, output) {
  const script = join(folder, `${name}-fixture.mjs`);
  writeFileSync(script, `
    process.stdin.setEncoding("utf8");
    for await (const chunk of process.stdin) void chunk;
    process.stdout.write(${JSON.stringify(output)});
  `);
  writeFileSync(join(folder, name), `#!/bin/sh\nexec '${node}' '${script}' "$@"\n`, { mode: 0o755 });
}

async function sent(name, output) {
  const folder = realpathSync(mkdtempSync(join(tmpdir(), "agent-m-1243-")));
  const prior = process.env.PATH;
  try {
    fixture(folder, name, output);
    process.env.PATH = folder;
    return await agentDriver(agent(name), { workdir: folder, keyVariable: null, endpoint: null }, PARTICIPANT)
      .send({ ...INPUT, workdir: folder });
  } finally {
    process.env.PATH = prior;
    rmSync(folder, { recursive: true, force: true });
  }
}

// TST-1243101
// level: unit
// module: MOD-agent-processes
// guards: NO COST IS GUESSED; A RUN HAS LIMITS FIXED AT ITS START
// given: a fixture `opencode` alone on the PATH that prints opencode 2.1.4's JSON events for two tool-calling steps — `step_finish` with `tokens` input 1200 / output 30, then input 1500 / output 45 — and a `text` "Blue".
// input: agentDriver(the logged-in opencode Agent, no key variable, no endpoint).send(a DriverInput in the fixture folder).
// expect: send returns text "Blue" with usage { inputTokens: 2700, outputTokens: 75, minutes: null, cost: null }, the sum of both steps; counter-proof: before ITM-1243 the usage is the last step's, 1500 and 45.
test("TST-1243101: opencode's usage is the sum of the tokens each step reported", async () => {
  assert.equal(finishes(STEP_LINES).length, 2, "known positive: the fixture reports two steps");
  const result = await sent("opencode", joined(STEP_LINES));
  assert.equal(result.text, "Blue");
  assert.deepEqual(result.usage, { inputTokens: 2700, outputTokens: 75, minutes: null, cost: null },
    "every step's tokens count, not only the last step's");
});

// TST-1243102
// level: unit
// module: MOD-agent-processes
// guards: NO COST IS GUESSED
// given: a fixture `opencode` alone on the PATH that prints the events of one tool-calling step — one `step_finish` with `tokens` input 1200 / output 30 — and a `text` "Blue".
// input: agentDriver(the logged-in opencode Agent, no key variable, no endpoint).send(a DriverInput in the fixture folder).
// expect: send returns text "Blue" with usage { inputTokens: 1200, outputTokens: 30, minutes: null, cost: null }, that one event's counts.
test("TST-1243102: opencode with one step reports that step's tokens", async () => {
  const second = STEP_LINES.indexOf(finishes(STEP_LINES)[1]);
  const lines = STEP_LINES.filter((line, index) => index !== second);
  assert.equal(finishes(lines).length, 1, "known positive: one step remains");
  const result = await sent("opencode", joined(lines));
  assert.deepEqual(result, { text: "Blue", usage: { inputTokens: 1200, outputTokens: 30, minutes: null, cost: null } });
});

// TST-1243103
// level: unit
// module: MOD-agent-processes
// guards: NO COST IS GUESSED
// given: a fixture `opencode` alone on the PATH that prints opencode's events with no `step_finish` and a `text` "Blue".
// input: agentDriver(the logged-in opencode Agent, no key variable, no endpoint).send(a DriverInput in the fixture folder).
// expect: send returns text "Blue" and usage null, nothing guessed.
test("TST-1243103: opencode without a step_finish reports null usage", async () => {
  const lines = STEP_LINES.filter((line) => typeOf(line) !== "step_finish");
  assert.equal(lines.length, STEP_LINES.length - 2, "known positive: exactly the two step_finish events are gone");
  assert.deepEqual(await sent("opencode", joined(lines)), { text: "Blue", usage: null });
});

// TST-1243104
// level: unit
// module: MOD-agent-processes
// guards: NO COST IS GUESSED
// given: a fixture `opencode` alone on the PATH that prints two `step_finish` events, the first with `tokens` input 1200 and no output, the second with `tokens` input 1500 / output 45, and a `text` "Blue"; and the same with no output in either.
// input: agentDriver(the logged-in opencode Agent, no key variable, no endpoint).send(a DriverInput in the fixture folder), once for each output.
// expect: the first returns usage { inputTokens: 2700, outputTokens: 45, minutes: null, cost: null }; the second { inputTokens: 2700, outputTokens: null, minutes: null, cost: null } — a count is null only where no event reports it.
test("TST-1243104: a count is the sum of the steps that report it, and null only where none does", async () => {
  const withoutOutput = (line) => {
    const event = JSON.parse(line);
    if (event.type !== "step_finish") return line;
    delete event.part.tokens.output;
    return JSON.stringify(event);
  };
  const [first, second] = finishes(STEP_LINES);
  const firstWithout = STEP_LINES.map((line) => line === first ? withoutOutput(line) : line);
  const result = await sent("opencode", joined(firstWithout));
  assert.deepEqual(result.usage, { inputTokens: 2700, outputTokens: 45, minutes: null, cost: null });
  const noneWith = STEP_LINES.map((line) => line === first || line === second ? withoutOutput(line) : line);
  const none = await sent("opencode", joined(noneWith));
  assert.deepEqual(none.usage, { inputTokens: 2700, outputTokens: null, minutes: null, cost: null });
});

// TST-1243105
// level: unit
// module: MOD-agent-processes
// guards: NO COST IS GUESSED
// given: a fixture `claude` alone on the PATH that prints Claude Code's one JSON result line: `result` "Blue", `usage.input_tokens` 17, `usage.output_tokens` 9.
// input: agentDriver(the logged-in claude Agent, no key variable, no endpoint).send(a DriverInput in the fixture folder).
// expect: send returns text "Blue" with usage { inputTokens: 17, outputTokens: 9, minutes: null, cost: null }, as before ITM-1243.
test("TST-1243105: Claude Code's single result line gives its counts as before", async () => {
  const result = await sent("claude", RESULT_LINE);
  assert.deepEqual(result, { text: "Blue", usage: { inputTokens: 17, outputTokens: 9, minutes: null, cost: null } });
});
