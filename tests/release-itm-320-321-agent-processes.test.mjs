// Independent release coverage for ITM-320 and ITM-321 through MOD-agent-processes' public interface.
// Run: node --test tests/release-itm-320-321-agent-processes.test.mjs
//
// Module: MOD-agent-processes
// Level: release
// Guards: THE BRIDGE FINDS THE INSTALLED AGENTS; A LOCAL AGENT USES THE PERSON'S OWN LOGIN
// Guards: A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET; A CANCELLED JOB WRITES NOTHING MORE; ONE DEFINITION, THREE DRIVERS
// Guards: A REMOTE INTERFACE NAMES HOW IT FAILS; UC-010; UC-011
//
// Every executable is a temporary controlled fixture. The file never calls an installed vendor agent,
// a provider, or a Bridge. Its CI-only counter-proofs run a copied checkout so each planted fault and
// restoration is isolated from the checked-out source.

import assert from "node:assert/strict";
import { after, test } from "node:test";
import { cpSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { agentDriver, installedAgents, testAgent } from "../src/agent-processes/index.mjs";

const NODE = process.execPath;
const fixture = () => realpathSync(mkdtempSync(join(tmpdir(), "agent-m-release-320-321-")));
const PARTICIPANT = { name: "release-cli", type: "CLI agent", model: "fixture", context: 1, price: null,
  capabilities: ["draft text"], place: "fixture", route: "bridge fixture agent claude" };
const INPUT = { prompt: "Release prompt remains whole.", parts: [], output: null, findings: [], previous: null, workdir: null };
const CLAUDE = { name: "claude", installed: true, version: "2.1.300", loggedIn: true,
  install: { macos: "https://example.test/mac", windows: "https://example.test/windows", linux: "https://example.test/linux" } };

function executable(folder, name, program) {
  const script = join(folder, `${name}.mjs`), command = join(folder, name);
  writeFileSync(script, program);
  writeFileSync(command, `#!/bin/sh\nexec '${NODE}' '${script}' "$@"\n`, { mode: 0o755 });
}
function agents(folder, record) {
  executable(folder, "claude", `
    import { appendFileSync } from "node:fs";
    const args = process.argv.slice(2);
    if (args[0] === "--version") process.stdout.write("2.1.300\\n");
    else if (args[0] === "auth") process.exit(0);
    else {
      let stdin = "";
      process.stdin.setEncoding("utf8");
      for await (const chunk of process.stdin) stdin += chunk;
      appendFileSync(${JSON.stringify(record)}, JSON.stringify({ name: "claude", args, stdin, cwd: process.cwd(), key: process.env.ANTHROPIC_API_KEY ?? null }) + "\\n");
      process.stdout.write(JSON.stringify({ type: "result", subtype: "success", is_error: false, result: "ok", usage: { input_tokens: 3, output_tokens: 1 } }) + "\\n");
    }
  `);
  executable(folder, "codex", `
    const args = process.argv.slice(2);
    if (args[0] === "--version") process.stdout.write("1.2.3\\n");
    else if (args[0] === "login") process.exit(0);
    else process.stdout.write("codex answer\\n");
  `);
  executable(folder, "opencode", `
    const args = process.argv.slice(2);
    if (args[0] === "--version") process.stdout.write("1.19.0\\n");
    else if (args[0] === "auth") process.stdout.write("1 credential\\n");
    else if (args[0] === "models") process.stdout.write("opencode/big-pickle\\n");
    else { process.stdout.write(JSON.stringify({ type: "text", part: { text: "opencode answer" } }) + "\\n"); process.stdout.write(JSON.stringify({ type: "step_finish", part: { tokens: { input: 3, output: 2 } } }) + "\\n"); }
  `);
}
async function withPath(folder, run) {
  const before = process.env.PATH;
  process.env.PATH = folder;
  try { return await run(); } finally { process.env.PATH = before; }
}
async function withEnvironment(values, run) {
  const before = Object.fromEntries(Object.keys(values).map((name) => [name, process.env[name]]));
  try {
    for (const [name, value] of Object.entries(values)) value === undefined ? delete process.env[name] : process.env[name] = value;
    return await run();
  } finally {
    for (const [name, value] of Object.entries(before)) value === undefined ? delete process.env[name] : process.env[name] = value;
  }
}
const driver = (agent, workdir, keyVariable = null) => agentDriver(agent, { workdir, keyVariable }, PARTICIPANT);

// TST-320321901
// level: release
// module: MOD-agent-processes
// guards: THE BRIDGE FINDS THE INSTALLED AGENTS; ONE DEFINITION, THREE DRIVERS; UC-010; UC-011
// given: controlled executables for every register row, all reporting the documented version and saved login.
// input: installedAgents(), followed by testAgent on the discovered Claude row.
// expect: all three public Agent records are discovered with their versions and login state; the public harmless test answers.
test("TST-320321901: public discovery reads the registered agents and tests one controlled agent", async () => {
  const folder = fixture(), record = join(folder, "record.jsonl");
  try {
    agents(folder, record);
    await withPath(folder, async () => {
      const found = await installedAgents();
      assert.deepEqual(found.map(({ name, version, loggedIn }) => [name, version, loggedIn]), [
        ["claude", "2.1.300", true], ["codex", "1.2.3", true], ["opencode", "1.19.0", true],
      ]);
      assert.deepEqual(await testAgent(found[0]), { answered: true, version: "2.1.300" });
    });
  } finally { rmSync(folder, { recursive: true, force: true }); }
});

// TST-320321902
// level: release
// module: MOD-agent-processes
// guards: A LOCAL AGENT USES THE PERSON'S OWN LOGIN; A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET; UC-010; UC-011
// given: a controlled Claude and a local inherited credential plus a named CI credential.
// input: public agentDriver.send locally, then in CI for an installed Agent without saved local login.
// expect: local invocation omits the declared credential; CI inherits its named credential without changing argv or reading it in module code.
test("TST-320321902: public Driver separates local own-login execution from named-key CI execution", async () => {
  const folder = fixture(), record = join(folder, "record.jsonl");
  try {
    agents(folder, record);
    await withEnvironment({ CI: undefined, GITHUB_ACTIONS: undefined, ANTHROPIC_API_KEY: "local-constructed-key" }, () =>
      withPath(folder, () => driver(CLAUDE, folder).send({ ...INPUT, workdir: folder })));
    await withEnvironment({ CI: "true", ANTHROPIC_API_KEY: "ci-constructed-key" }, () =>
      withPath(folder, () => driver({ ...CLAUDE, loggedIn: false }, folder, "ANTHROPIC_API_KEY").send({ ...INPUT, workdir: folder })));
    const [local, ci] = readFileSync(record, "utf8").trim().split("\n").map(JSON.parse);
    assert.deepEqual(local, { name: "claude", args: ["-p", "--output-format", "json"], stdin: INPUT.prompt, cwd: folder, key: null });
    assert.deepEqual(ci, { name: "claude", args: ["-p", "--output-format", "json"], stdin: INPUT.prompt, cwd: folder, key: "ci-constructed-key" });
  } finally { rmSync(folder, { recursive: true, force: true }); }
});

// TST-320321903
// level: release
// module: MOD-agent-processes
// guards: A CANCELLED JOB WRITES NOTHING MORE; UC-010
// given: a controlled Claude whose descendant first installs an ignoring SIGTERM handler and signals readiness over IPC before it could write a marker after cancellation.
// input: public Driver.send with an AbortSignal aborted after the parent announces it started.
// expect: Cancelled is named and the descendant marker remains absent after its scheduled write time.
test("TST-320321903: public Driver cancellation stops the controlled descendant before its later write", async () => {
  const folder = fixture(), marker = join(folder, "later-marker");
  try {
    executable(folder, "claude", `
      import { spawn } from "node:child_process";
      const child = spawn(${JSON.stringify(NODE)}, ["-e", ${JSON.stringify(`
        process.on("SIGTERM", () => {});
        process.send("ready");
        setTimeout(() => require("node:fs").writeFileSync(${JSON.stringify(marker)}, "late"), 250);
      `)}], { stdio: ["ignore", "ignore", "ignore", "ipc"] });
      child.once("message", (message) => { if (message === "ready") process.stdout.write("started\\n"); });
      setInterval(() => {}, 1000);
    `);
    const controller = new AbortController();
    await withPath(folder, async () => {
      await assert.rejects(driver(CLAUDE, folder).send({ ...INPUT, workdir: folder }, { signal: controller.signal,
        onOutput: () => controller.abort() }), { name: "Cancelled" });
    });
    await new Promise((resolve) => setTimeout(resolve, 350));
    assert.throws(() => readFileSync(marker, "utf8"), { code: "ENOENT" }, "failure node: descendant marker remains absent");
  } finally { rmSync(folder, { recursive: true, force: true }); }
});

// TST-320321904
// level: release
// module: MOD-agent-processes
// guards: A REMOTE INTERFACE NAMES HOW IT FAILS; UC-011
// given: a missing Agent, a supported Agent without local login, and a controlled Agent that exits after output.
// input: public Driver.send for each.
// expect: AgentMissing, AgentNotLoggedIn, and AgentFailed preserve the named public failure boundary and exit details.
test("TST-320321904: public Driver names missing, local-login, and process failures", async () => {
  const folder = fixture();
  try {
    executable(folder, "claude", "process.stdout.write('last release output\\n'); process.exit(23);");
    await assert.rejects(driver({ ...CLAUDE, installed: false }, folder).send({ ...INPUT, workdir: folder }), { name: "AgentMissing" });
    await assert.rejects(driver({ ...CLAUDE, loggedIn: false }, folder).send({ ...INPUT, workdir: folder }), { name: "AgentNotLoggedIn" });
    await withPath(folder, () => assert.rejects(driver(CLAUDE, folder).send({ ...INPUT, workdir: folder }), (error) =>
      error?.name === "AgentFailed" && error.exitCode === 23 && error.lastOutput === "last release output"));
  } finally { rmSync(folder, { recursive: true, force: true }); }
});

const FAULTS = {
  "TST-320321901": { file: "src/agent-processes/index.mjs", needle: "return { answered: true, version: agent.version };", replacement: "return { answered: false, version: agent.version };" },
  "TST-320321902": { file: "src/agent-processes/processes.mjs", needle: "return ownLoginEnvironment();", replacement: "return process.env;" },
  "TST-320321903": { file: "src/agent-processes/processes.mjs", needle: "process.kill(-child.pid, signal);", replacement: "child.kill(\"SIGTERM\");" },
  "TST-320321904": { file: "src/agent-processes/processes.mjs", needle: "throw failure(\"AgentNotLoggedIn\", \"the selected agent is not logged in\");", replacement: "throw failure(\"AgentMissing\", \"the selected agent is not logged in\");" },
};

after(() => {
  if (process.env.GITHUB_ACTIONS !== "true" || process.env.AGENT_M_RELEASE_FAULT_CHILD) return;
  const temporary = mkdtempSync(join(tmpdir(), "agent-m-release-proof-")), copied = join(temporary, "repo");
  const digest = (value) => createHash("sha256").update(value).digest("hex");
  try {
    cpSync(process.cwd(), copied, { recursive: true, filter: (path) => !path.includes("/.git") && !path.includes("/node_modules") });
    for (const [id, { file, needle, replacement }] of Object.entries(FAULTS)) {
      const source = join(copied, file), testPath = join(copied, "tests/release-itm-320-321-agent-processes.test.mjs");
      const original = readFileSync(source), sourceHash = digest(original), testHash = digest(readFileSync(testPath));
      assert.equal(original.toString().split(needle).length - 1, 1, `${id}: unique source fault target`);
      const invoke = () => {
        const env = { ...process.env, AGENT_M_RELEASE_FAULT_CHILD: "1" };
        delete env.NODE_TEST_CONTEXT;
        return spawnSync(NODE, ["--test", "--test-name-pattern", id, "tests/release-itm-320-321-agent-processes.test.mjs"],
          { cwd: copied, encoding: "utf8", timeout: 15_000, env });
      };
      const faultStarted = new Date().toISOString();
      writeFileSync(source, original.toString().replace(needle, replacement));
      const faultHash = digest(readFileSync(source)), failed = invoke(), faultEnded = new Date().toISOString();
      const restoreStarted = new Date().toISOString();
      writeFileSync(source, original);
      const restoredHash = digest(readFileSync(source)), restoredEnded = new Date().toISOString();
      const passed = invoke(), positiveEnded = new Date().toISOString();
      console.log("TST320321-counterproof " + JSON.stringify({ id, file, needle, replacement, sourceHash, testHash, faultHash, restoredHash,
        faultStarted, faultEnded, restoreStarted, restoredEnded, positiveEnded,
        argv: [NODE, "--test", "--test-name-pattern", id, "tests/release-itm-320-321-agent-processes.test.mjs"], cwd: copied,
        childflag: "AGENT_M_RELEASE_FAULT_CHILD=1",
        failed: { status: failed.status, signal: failed.signal, error: failed.error?.message ?? null, stdout: failed.stdout, stderr: failed.stderr },
        passed: { status: passed.status, signal: passed.signal, error: passed.error?.message ?? null, stdout: passed.stdout, stderr: passed.stderr } }));
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
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});
