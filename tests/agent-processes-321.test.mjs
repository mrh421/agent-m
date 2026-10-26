// Module: MOD-agent-processes
// Level: unit
// Guards: A LOCAL AGENT USES THE PERSON'S OWN LOGIN; A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET; A CANCELLED JOB WRITES NOTHING MORE; ONE DEFINITION, THREE DRIVERS; UC-010; UC-011

import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after } from "node:test";
import { agentDriver } from "../src/agent-processes/index.mjs";
import { formatFinding } from "../src/text-tools/index.mjs";

const node = process.execPath;
const fixture = () => realpathSync(mkdtempSync(join(tmpdir(), "agent-m-321-")));
const PARTICIPANT = {
  name: "fixture-cli-agent",
  type: "CLI agent",
  model: "fixture-model",
  context: 200000,
  price: null,
  capabilities: ["draft text"],
  place: "fixture",
  route: "bridge fixture agent claude",
};
const INPUT = {
  prompt: "The prepared prompt stays unchanged.",
  parts: [],
  output: null,
  findings: [],
  previous: null,
  workdir: null,
};
const CLAUDE = {
  name: "claude",
  installed: true,
  version: "2.1.300",
  loggedIn: true,
  install: {
    macos: "https://code.claude.com/docs/en/setup",
    windows: "https://code.claude.com/docs/en/setup",
    linux: "https://code.claude.com/docs/en/setup",
  },
};
const OPENCODE = {
  name: "opencode",
  installed: true,
  version: "1.19.0",
  loggedIn: true,
  install: {
    macos: "https://opencode.ai/docs/#install",
    windows: "https://opencode.ai/docs/#windows",
    linux: "https://opencode.ai/docs/#install",
  },
};
const FAULTS = {
  "TST-321001": [
    "return { text: helpers.answer(row.task, result.stdout), usage: helpers.usage(row.task, result.stdout) };",
    "return { text: \"\", usage: helpers.usage(row.task, result.stdout) };",
  ],
  "TST-321002": [
    "return ownLoginEnvironment();",
    "return process.env;",
  ],
  "TST-321003": [
    "process.kill(-child.pid, \"SIGKILL\");",
    "child.kill(\"SIGTERM\");",
  ],
  "TST-321004": [
    "throw failure(\"AgentNotLoggedIn\", \"the selected agent is not logged in\");",
    "throw failure(\"AgentMissing\", \"the selected agent is not logged in\");",
  ],
};

function executable(folder, name, program) {
  const script = join(folder, `${name}-fixture.mjs`);
  const command = join(folder, name);
  writeFileSync(script, program);
  writeFileSync(command, `#!/bin/sh\nexec '${node}' '${script}' \"$@\"\n`, { mode: 0o755 });
}

async function withPath(folder, work) {
  const previous = process.env.PATH;
  process.env.PATH = folder;
  try {
    return await work();
  } finally {
    process.env.PATH = previous;
  }
}

async function withEnvironment(values, work) {
  const prior = Object.fromEntries(Object.keys(values).map((name) => [name, process.env[name]]));
  try {
    for (const [name, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    return await work();
  } finally {
    for (const [name, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

function driver(agent, workdir, keyVariable = null) {
  return agentDriver(agent, { workdir, keyVariable }, PARTICIPANT);
}

const CONTEXT_PART = { name: "source", text: "AGENT_RECIPE_CONTEXT", size: 0, sources: [], required: true, recipe: "fixture", artifacts: [] };
const CONTEXT_INPUT = { ...INPUT, prompt: `Write the correction.\n\n### source\n\n${CONTEXT_PART.text}`, parts: [CONTEXT_PART] };
const CURRENT_DRAFT = JSON.stringify({ text: "AGENT_CURRENT_DRAFT" }, null, 2);
const CONTEXT_FINDINGS = [
  { artifact: "UC-019", line: 7, kind: "error", rule: "A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT", what: "AGENT_MISSING_CHECK", fix: "include the check" },
  { artifact: "SPEC", line: 8, kind: "warning", rule: "ONE STATEMENT PER REQUIREMENT", what: "AGENT_TWO_STATEMENTS", fix: "split or justify the rule" },
];
const occurrences = (text, value) => text.split(value).length - 1;

async function contextTasks(t, extra, verify) {
  for (const [name, prefix] of [["claude", ["-p"]], ["codex", ["exec", "-"]], ["opencode", ["run", "--format", "json"]]]) {
    await t.test(name, async () => {
      const folder = realpathSync(fixture()), record = join(folder, "tasks.jsonl");
      try {
        executable(folder, name, `
          import { appendFileSync } from "node:fs";
          let stdin = "";
          process.stdin.setEncoding("utf8");
          for await (const chunk of process.stdin) stdin += chunk;
          appendFileSync(${JSON.stringify(record)}, JSON.stringify({ argv: process.argv.slice(2), stdin, cwd: process.cwd() }) + "\\n");
          process.stdout.write(${JSON.stringify(name === "opencode" ? JSON.stringify({ type: "text", part: { text: "fixture answer" } }) + "\n" : "fixture answer\n")});
        `);
        const agent = { ...CLAUDE, name };
        const actualDriver = driver(agent, folder);
        const send = async (input, expectedCalls) => {
          assert.equal((await withPath(folder, () => actualDriver.send({ ...input, workdir: folder }))).text, "fixture answer");
          const calls = readFileSync(record, "utf8").trim().split("\n").map((line) => JSON.parse(line));
          assert.equal(calls.length, expectedCalls, "one send starts one fixture task");
          const call = calls.at(-1);
          assert.equal(call.cwd, folder);
          assert.deepEqual(call.argv, prefix, "the register's task arguments reach the fixture");
          const text = call.stdin;
          assert.equal(occurrences(text, CONTEXT_INPUT.prompt), 1, "ordinary prompt reaches the coding agent once");
          assert.equal(occurrences(text, CONTEXT_PART.text), 1, "recipe parts already in prompt are not added again");
          return text;
        };
        assert.equal(await send(CONTEXT_INPUT, 1), CONTEXT_INPUT.prompt, "known positive: ordinary DriverInput is unchanged");
        if (extra !== null) verify(await send({ ...CONTEXT_INPUT, ...extra }, 2), name);
      } finally {
        rmSync(folder, { recursive: true, force: true });
      }
    });
  }
}

// TST-398017
// level: unit
// module: MOD-agent-processes
// guards: ONE DEFINITION, THREE DRIVERS; UC-010; UC-011; UC-019
// given: controlled Claude, Codex and OpenCode executables on a fixture-only PATH
// input: each public agentDriver sends ordinary DriverInput whose prompt already holds its recipe part
// expect: each fixture records one task, the exact prompt once and the part once, in the requested workdir
test("TST-398017: coding agents receive ordinary DriverInput exactly once", async (t) => {
  await contextTasks(t, null);
});

// TST-398018
// level: unit
// module: MOD-agent-processes
// guards: UC-019; A DRAFTED CHANGE IS SHOWN AGAINST THE CURRENT TEXT
// given: each controlled supported coding agent after its known-positive ordinary task
// input: a second public agentDriver send with the complete current draft in previous and no findings
// expect: one additional task carries the current draft once and does not append recipe parts again
test("TST-398018: coding agents receive previous current draft exactly once", async (t) => {
  await contextTasks(t, { previous: CURRENT_DRAFT }, (text, name) => {
    assert.equal(occurrences(text, CURRENT_DRAFT), 1, `${name} receives the complete previous current draft once`);
  });
});

// TST-398019
// level: unit
// module: MOD-agent-processes
// guards: A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT; A FINDING READS LIKE A COMPILER MESSAGE
// given: each controlled supported coding agent after its known-positive ordinary task
// input: a second public agentDriver send with a previous draft and one error and one warning
// expect: each full canonical formatFinding line and the complete current draft reach one additional task exactly once
test("TST-398019: coding agents receive canonical correction findings exactly once", async (t) => {
  await contextTasks(t, { previous: CURRENT_DRAFT, findings: CONTEXT_FINDINGS }, (text, name) => {
    for (const finding of CONTEXT_FINDINGS) assert.equal(occurrences(text, formatFinding(finding)), 1, `${name} receives canonical ${finding.kind} once`);
    assert.equal(occurrences(text, CURRENT_DRAFT), 1, "the findings travel with the draft they concern");
  });
});

// TST-321001
// level: unit
// module: MOD-agent-processes
// guards: ONE DEFINITION, THREE DRIVERS; UC-010; UC-011
// given: controlled Claude and OpenCode executables on PATH: Claude emits a text final answer without usage and OpenCode emits published raw JSON text and step-finish usage events.
// input: a DriverInput whose prompt has already been assembled and whose workdir is the fixture folder.
// expect: each send gives the agent the unchanged prompt on its standard input in that workdir and streams output; Claude returns null for unreported usage and OpenCode maps its reported token counts while leaving undocumented currencyless cost null.
test("TST-321001: agent driver streams answers with reported or null usage", async () => {
  const folder = fixture();
  const record = join(folder, "record.json");
  try {
    executable(folder, "claude", `
      import { writeFileSync } from "node:fs";
      let stdin = "";
      process.stdin.setEncoding("utf8");
      for await (const chunk of process.stdin) stdin += chunk;
      writeFileSync(${JSON.stringify(record)}, JSON.stringify({ argv: process.argv.slice(2), stdin, cwd: process.cwd() }));
      process.stdout.write("final answer\\n");
    `);
    executable(folder, "opencode", `
      process.stdout.write(JSON.stringify({ type: "text", part: { text: "reported answer" } }) + "\\n");
      process.stdout.write(JSON.stringify({ type: "step_finish", part: { tokens: { input: 13, output: 5 } } }) + "\\n");
    `);
    const output = [];
    const result = await withPath(folder, () => driver(CLAUDE, folder).send(
      { ...INPUT, workdir: folder },
      { onOutput: (chunk) => output.push(chunk) },
    ));

    assert.deepEqual(result, { text: "final answer", usage: null });
    assert.deepEqual(JSON.parse(readFileSync(record, "utf8")), {
      argv: ["-p"],
      stdin: INPUT.prompt,
      cwd: folder,
    });
    assert.equal(output.join(""), "final answer\n");
    assert.deepEqual(await withPath(folder, () => driver(OPENCODE, folder).send({ ...INPUT, workdir: folder })), {
      text: "reported answer",
      usage: { inputTokens: 13, outputTokens: 5, minutes: null, cost: null },
    });
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

// TST-321002
// level: unit
// module: MOD-agent-processes
// guards: A LOCAL AGENT USES THE PERSON'S OWN LOGIN; A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET; UC-011
// given: a controlled Claude executable; a locally logged-in Agent; and an installed Agent that has no saved login but has a CI credential name.
// input: one local driver with no key variable and one CI driver for the installed-but-logged-out Agent, naming ANTHROPIC_API_KEY while the fixture environment supplies its value.
// expect: neither command contains a key; local invocation has no credential variable, while CI invocation still succeeds and receives the named CI variable without the module reading or placing its value in command arguments.
test("TST-321002: local and CI invocations keep credentials out of command arguments", async () => {
  const folder = fixture();
  const localRecord = join(folder, "local.json");
  const ciRecord = join(folder, "ci.json");
  try {
    executable(folder, "claude", `
      import { appendFileSync } from "node:fs";
      const target = process.env.CI === "true" ? ${JSON.stringify(ciRecord)} : ${JSON.stringify(localRecord)};
      let stdin = "";
      process.stdin.setEncoding("utf8");
      for await (const chunk of process.stdin) stdin += chunk;
      appendFileSync(target, JSON.stringify({ argv: process.argv.slice(2), stdin, key: process.env.ANTHROPIC_API_KEY ?? null }) + "\\n");
      process.stdout.write("ok\\n");
    `);
    await withEnvironment({ CI: undefined, GITHUB_ACTIONS: undefined, ANTHROPIC_API_KEY: "local-parent-key" }, () =>
      withPath(folder, () => driver(CLAUDE, folder).send({ ...INPUT, workdir: folder })));
    await withEnvironment({ CI: "true", ANTHROPIC_API_KEY: "ci-secret-fixture" }, () =>
      withPath(folder, () => driver({ ...CLAUDE, loggedIn: false }, folder, "ANTHROPIC_API_KEY").send({ ...INPUT, workdir: folder })));

    assert.deepEqual(JSON.parse(readFileSync(localRecord, "utf8")), {
      argv: ["-p"],
      stdin: INPUT.prompt,
      key: null,
    });
    assert.deepEqual(JSON.parse(readFileSync(ciRecord, "utf8")), {
      argv: ["-p"],
      stdin: INPUT.prompt,
      key: "ci-secret-fixture",
    });
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

// TST-321003
// level: unit
// module: MOD-agent-processes
// guards: A CANCELLED JOB WRITES NOTHING MORE; UC-010
// given: a controlled Claude executable whose child first installs a SIGTERM handler that remains alive, signals readiness over IPC with no inherited stdio, then schedules a later marker.
// input: send a prepared DriverInput with an AbortSignal aborted after the announced output.
// expect: send throws Cancelled and stops the fixture and its child before the child can write the later marker.
test("TST-321003: abort stops the agent and its child before later output", async () => {
  const folder = fixture();
  const marker = join(folder, "later-marker");
  try {
    executable(folder, "claude", `
      import { spawn } from "node:child_process";
      const child = spawn(${JSON.stringify(node)}, ["-e", ${JSON.stringify(`
        process.on("SIGTERM", () => {});
        process.send("ready");
        setTimeout(() => require("node:fs").writeFileSync(${JSON.stringify(marker)}, "later"), 250);
      `)}], { stdio: ["ignore", "ignore", "ignore", "ipc"] });
      child.once("message", (message) => {
        if (message === "ready") process.stdout.write("started\\n");
      });
      setInterval(() => {}, 1_000);
    `);
    const controller = new AbortController();
    const sent = withPath(folder, () => driver(CLAUDE, folder).send(
      { ...INPUT, workdir: folder },
      { signal: controller.signal, onOutput: () => controller.abort() },
    ));
    await assert.rejects(sent, { name: "Cancelled" });
    await new Promise((resolve) => setTimeout(resolve, 350));
    assert.throws(() => readFileSync(marker, "utf8"), { code: "ENOENT" }, "child marker is not written after cancellation");
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

// TST-321004
// level: unit
// module: MOD-agent-processes
// guards: A REMOTE INTERFACE NAMES HOW IT FAILS; UC-011
// given: a missing agent, an installed but logged-out agent, a controlled Claude executable that exits 23 after output, and an already-aborted signal.
// input: construct a driver for each condition and call send with the same prepared DriverInput.
// expect: the four conditions throw AgentMissing, AgentNotLoggedIn, AgentFailed with its exitCode and lastOutput, and Cancelled.
test("TST-321004: agent driver names each accepted failure", async () => {
  const folder = fixture();
  try {
    executable(folder, "claude", "process.stdout.write('last output\\n'); process.exit(23);");
    await assert.rejects(driver({ ...CLAUDE, installed: false }, folder).send({ ...INPUT, workdir: folder }), { name: "AgentMissing" });
    await assert.rejects(driver({ ...CLAUDE, loggedIn: false }, folder).send({ ...INPUT, workdir: folder }), { name: "AgentNotLoggedIn" });
    await withPath(folder, async () => {
      await assert.rejects(driver(CLAUDE, folder).send({ ...INPUT, workdir: folder }), (error) =>
        error?.name === "AgentFailed" && error.exitCode === 23 && error.lastOutput === "last output");
    });
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(driver(CLAUDE, folder).send({ ...INPUT, workdir: folder }, { signal: controller.signal }), { name: "Cancelled" });
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

after(() => {
  if (process.env.GITHUB_ACTIONS !== "true" || process.env.AGENT_M_321_FAULT_CHILD) return;
  const temporary = mkdtempSync(join(tmpdir(), "agent-m-321-fault-"));
  const copied = join(temporary, "repo");
  const digest = (value) => createHash("sha256").update(value).digest("hex");
  try {
    cpSync(process.cwd(), copied, {
      recursive: true,
      filter: (path) => !path.includes("/.git") && !path.includes("/node_modules"),
    });
    for (const [id, [needle, replacement]] of Object.entries(FAULTS)) {
      const source = join(copied, "src", "agent-processes", "processes.mjs");
      const original = readFileSync(source);
      const testPath = join(copied, "tests", "agent-processes-321.test.mjs");
      const argv = [process.execPath, "--test", "--test-name-pattern", id, "tests/agent-processes-321.test.mjs"];
      assert.equal(original.toString().split(needle).length - 1, 1, `${id}: unique fault target`);
      const invoke = () => {
        const env = { ...process.env, AGENT_M_321_FAULT_CHILD: "1" };
        delete env.NODE_TEST_CONTEXT;
        return spawnSync(argv[0], argv.slice(1), { cwd: copied, encoding: "utf8", timeout: 15_000, env });
      };
      const sourceHash = digest(original);
      const testHash = digest(readFileSync(testPath));
      const faultStarted = new Date().toISOString();
      let failed, passed, faultHash, restoredHash, faultEnded, restoreStarted, restoredEnded, positiveEnded;
      try {
        writeFileSync(source, original.toString().replace(needle, replacement));
        faultHash = digest(readFileSync(source));
        failed = invoke();
        faultEnded = new Date().toISOString();
      } finally {
        restoreStarted = new Date().toISOString();
        writeFileSync(source, original);
        restoredHash = digest(readFileSync(source));
        restoredEnded = new Date().toISOString();
      }
      passed = invoke();
      positiveEnded = new Date().toISOString();
      console.log("TST321-counterproof " + JSON.stringify({
        id,
        file: "src/agent-processes/processes.mjs",
        needle,
        replacement,
        sourceHash,
        testHash,
        faultHash,
        restoredHash,
        faultStarted,
        faultEnded,
        restoreStarted,
        restoredEnded,
        positiveEnded,
        argv,
        cwd: copied,
        childflag: "AGENT_M_321_FAULT_CHILD=1",
        failed: {
          status: failed.status,
          signal: failed.signal,
          error: failed.error?.message ?? null,
          stdout: failed.stdout,
          stderr: failed.stderr,
        },
        passed: {
          status: passed.status,
          signal: passed.signal,
          error: passed.error?.message ?? null,
          stdout: passed.stdout,
          stderr: passed.stderr,
        },
      }));
      assert.equal(failed.status, 1, id);
      assert.equal(failed.signal, null, id);
      assert.equal(failed.error, undefined, id);
      assert.match(`${failed.stdout}\n${failed.stderr}`, new RegExp(`not ok \\d+ - ${id}\\b`));
      assert.equal(restoredHash, sourceHash, `${id}: exact restoration`);
      assert.equal(passed.status, 0, id);
      assert.equal(passed.signal, null, id);
      assert.equal(passed.error, undefined, id);
      assert.match(`${passed.stdout}\n${passed.stderr}`, new RegExp(`ok \\d+ - ${id}\\b`));
    }
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});
