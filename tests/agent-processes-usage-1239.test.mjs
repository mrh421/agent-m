// ITM-1239: Claude Code reports its usage — the claude row asks for its JSON result and reads answer and usage from it.
// Module: MOD-agent-processes
// Guards: NO COST IS GUESSED; A RUN HAS LIMITS FIXED AT ITS START; A LOCAL AGENT USES THE PERSON'S OWN LOGIN
// Level: unit
// Run: node --test tests/agent-processes-usage-1239.test.mjs

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { agentDriver } from "../src/agent-processes/index.mjs";

const node = process.execPath;
// Claude Code's `claude -p --output-format json` prints one line of this shape; the values are synthetic.
const RESULT_FILE = new URL("./fixtures/agent-processes/claude-result.json", import.meta.url);
const RESULT_LINE = readFileSync(RESULT_FILE, "utf8");
const PARTICIPANT = {
  name: "fixture-cli-agent", type: "CLI agent", model: "fixture-model", context: 200000, price: null,
  capabilities: ["draft text"], place: "fixture", route: "bridge fixture agent claude",
};
const INPUT = { prompt: "Name one colour.", parts: [], output: null, findings: [], previous: null, workdir: null };
const CLAUDE = {
  name: "claude", installed: true, version: "2.1.292", loggedIn: true, login: "claude auth login",
  install: { macos: "https://code.claude.com/docs/en/setup", windows: "https://code.claude.com/docs/en/setup", linux: "https://code.claude.com/docs/en/setup" },
};

// A fixture `claude` alone on the PATH: it records its arguments, standard input and folder, and prints `line`.
function claude(folder, record, line) {
  const script = join(folder, "claude-fixture.mjs");
  writeFileSync(script, `
    import { writeFileSync } from "node:fs";
    let stdin = "";
    process.stdin.setEncoding("utf8");
    for await (const chunk of process.stdin) stdin += chunk;
    writeFileSync(${JSON.stringify(record)}, JSON.stringify({ argv: process.argv.slice(2), stdin, cwd: process.cwd() }));
    process.stdout.write(${JSON.stringify(line)});
  `);
  writeFileSync(join(folder, "claude"), `#!/bin/sh\nexec '${node}' '${script}' "$@"\n`, { mode: 0o755 });
}

async function sent(line) {
  const folder = realpathSync(mkdtempSync(join(tmpdir(), "agent-m-1239-")));
  const record = join(folder, "record.json");
  const prior = process.env.PATH;
  try {
    claude(folder, record, line);
    const output = [];
    process.env.PATH = folder;
    const result = await agentDriver(CLAUDE, { workdir: folder, keyVariable: null, endpoint: null }, PARTICIPANT)
      .send({ ...INPUT, workdir: folder }, { onOutput: (chunk) => output.push(chunk) });
    return { result, call: JSON.parse(readFileSync(record, "utf8")), output: output.join(""), folder };
  } finally {
    process.env.PATH = prior;
    rmSync(folder, { recursive: true, force: true });
  }
}

// TST-1239001
// level: unit
// module: MOD-agent-processes
// guards: NO COST IS GUESSED; A RUN HAS LIMITS FIXED AT ITS START; A LOCAL AGENT USES THE PERSON'S OWN LOGIN
// given: a fixture `claude` alone on the PATH that reads its task on standard input and prints Claude Code's one JSON result line: `result` "Blue", `usage.input_tokens` 17, `usage.output_tokens` 9, cache tokens and `total_cost_usd` 0.0421.
// input: agentDriver(the logged-in claude Agent, no key variable, no endpoint).send(a DriverInput in the fixture folder).
// expect: the arguments are `-p --output-format json`, the prompt arrives on standard input, the line is streamed, and send returns text "Blue" with usage { inputTokens: 17, outputTokens: 9, minutes: null, cost: null }; counter-proof: with the claude row before ITM-1239 the usage is null.
test("TST-1239001: Claude Code's JSON result gives the driver its answer and the tokens it reported", async () => {
  const { result, call, output, folder } = await sent(RESULT_LINE);
  assert.deepEqual(result.usage, { inputTokens: 17, outputTokens: 9, minutes: null, cost: null },
    "the tokens Claude Code reported reach the job; its cost stays unknown");
  assert.equal(result.text, "Blue");
  assert.deepEqual(call, { argv: ["-p", "--output-format", "json"], stdin: INPUT.prompt, cwd: folder });
  assert.equal(output, RESULT_LINE, "the agent's output is streamed as it printed it");
});

// TST-1239002
// level: unit
// module: MOD-agent-processes
// guards: NO COST IS GUESSED
// given: a fixture `claude` alone on the PATH that prints Claude Code's JSON result line with `result` "Blue" and no `usage`.
// input: agentDriver(the logged-in claude Agent, no key variable, no endpoint).send(a DriverInput in the fixture folder).
// expect: send returns text "Blue" and usage null, nothing guessed.
test("TST-1239002: a Claude Code result without usage gives the answer and null usage", async () => {
  const { usage, ...withoutUsage } = JSON.parse(RESULT_LINE);
  assert.equal(typeof usage, "object", "known positive: the fixture line carries usage");
  const { result } = await sent(`${JSON.stringify(withoutUsage)}\n`);
  assert.deepEqual(result, { text: "Blue", usage: null });
});
