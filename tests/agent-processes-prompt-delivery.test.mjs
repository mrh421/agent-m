// Module: MOD-agent-processes
// Level: unit
// Guards: ONE DEFINITION, THREE DRIVERS; UC-010; UC-011; UC-049
// Only controlled executables run. Expected arguments are literals taken from each CLI's own documentation or help.

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { agentDriver } from "../src/agent-processes/index.mjs";

const PARTICIPANT = { name: "fixture-cli-agent", type: "CLI agent", model: "fixture-model", context: 200000, price: null,
  capabilities: ["draft text"], place: "fixture", route: "bridge fixture agent" };
const agent = (name) => ({ name, installed: true, version: "1.0.0", loggedIn: true, login: `${name} login`,
  install: { macos: "https://example.invalid/", windows: "https://example.invalid/", linux: "https://example.invalid/" } });
// 300 KB: more than twice Linux's limit of 128 KB for one command-line argument (MAX_ARG_STRLEN).
const PROMPT = `BEGIN-LARGE-PROMPT\n${"line of a large change-requirements prompt\n".repeat(7300)}END-LARGE-PROMPT`;
const INPUT = { prompt: PROMPT, parts: [], output: null, findings: [], previous: null, workdir: null };
const ARGUMENT_LIMIT = 4096;
const ANSWER = { claude: "fixture answer\n", codex: "fixture answer\n",
  opencode: JSON.stringify({ type: "text", part: { text: "fixture answer" } }) + "\n" };

// The fixture agent records its arguments and its whole standard input; with `reads: false` it never reads its input.
function fixture(name, { reads = true, exitCode = 0 } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "agent-m-prompt-")));
  const bin = join(root, "bin"), workdir = join(root, "work"), record = join(root, "record.json");
  mkdirSync(bin);
  mkdirSync(workdir);
  const script = join(bin, `${name}-fixture.mjs`);
  writeFileSync(script, `
    import { writeFileSync } from "node:fs";
    let stdin = null;
    if (${reads}) {
      stdin = "";
      process.stdin.setEncoding("utf8");
      for await (const chunk of process.stdin) stdin += chunk;
    }
    writeFileSync(${JSON.stringify(record)}, JSON.stringify({ argv: process.argv.slice(2), stdin, cwd: process.cwd() }));
    process.stdout.write(${JSON.stringify(ANSWER[name])});
    process.exit(${exitCode});
  `);
  writeFileSync(join(bin, name), `#!/bin/sh\nexec '${process.execPath}' '${script}' "$@"\n`, { mode: 0o755 });
  return { root, bin, workdir, record: () => JSON.parse(readFileSync(record, "utf8")) };
}

async function withPath(folder, work) {
  const prior = process.env.PATH;
  process.env.PATH = folder;
  try { return await work(); } finally { process.env.PATH = prior; }
}

const CASES = [
  { name: "claude", args: ["-p"] },
  { name: "codex", args: ["exec", "-"] },
  { name: "opencode", args: ["run", "--format", "json"] },
  { name: "claude", args: ["-p", "--model", "fixture-model"], label: "claude with an Anthropic endpoint",
    endpoint: { kind: "anthropic", baseUrl: "https://anthropic.fixture.invalid", model: "fixture-model" } },
];

// TST-1225001
// level: unit
// module: MOD-agent-processes
// guards: ONE DEFINITION, THREE DRIVERS; UC-010; UC-011; UC-049
// given: controlled claude, codex and opencode executables on a fixture-only PATH that record their arguments and their whole standard input; claude also behind an Anthropic endpoint, which starts it through the module's settings wrapper
// input: public agentDriver.send of a DriverInput whose prompt is 300 KB
// expect: claude is started as `claude -p`, codex as `codex exec -` and opencode as `opencode run --format json`, each with the endpoint's options where one is given; each reads the whole prompt once on its standard input; no argument is longer than 4 KB
test("TST-1225001: a 300 KB prompt reaches each coding agent whole on its standard input, never as an argument", async (t) => {
  for (const each of CASES) {
    await t.test(each.label ?? each.name, async () => {
      const { root, bin, workdir, record } = fixture(each.name);
      try {
        const driver = agentDriver(agent(each.name), { workdir, keyVariable: null, endpoint: each.endpoint ?? null }, PARTICIPANT);
        const result = await withPath(bin, () => driver.send({ ...INPUT, workdir }));
        assert.equal(result.text, "fixture answer");
        const call = record();
        assert.equal(call.cwd, workdir);
        for (const arg of call.argv) assert.ok(arg.length <= ARGUMENT_LIMIT, `an argument of ${arg.length} characters`);
        assert.deepEqual(call.argv, each.args);
        assert.equal(call.stdin, PROMPT, "the whole prompt arrives on standard input, once");
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  }
});

// TST-1225002
// level: unit
// module: MOD-agent-processes
// guards: A REMOTE INTERFACE NAMES HOW IT FAILS; UC-010; UC-011
// given: a controlled claude executable that never reads its standard input; once it answers and exits 0, once it exits 7
// input: public agentDriver.send of the 300 KB DriverInput
// expect: the first send returns the agent's answer; the second throws AgentFailed with exitCode 7; neither fails on the unread input
test("TST-1225002: an agent that does not read its input is judged by its exit, not by the unread prompt", async (t) => {
  for (const exitCode of [0, 7]) {
    await t.test(`agent exits ${exitCode}`, async () => {
      const { root, bin, workdir, record } = fixture("claude", { reads: false, exitCode });
      try {
        const sent = withPath(bin, () => agentDriver(agent("claude"), { workdir, keyVariable: null }, PARTICIPANT)
          .send({ ...INPUT, workdir }));
        if (exitCode === 0) assert.deepEqual(await sent, { text: "fixture answer", usage: null });
        else await assert.rejects(sent, (error) => error?.name === "AgentFailed" && error.exitCode === 7);
        assert.equal(record().stdin, null, "known positive: the fixture did not read its input");
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  }
});
