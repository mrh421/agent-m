// Module: MOD-agent-processes
// Level: unit
// Guards: THE BRIDGE FINDS THE INSTALLED AGENTS; THE BRIDGE GUIDES THE INSTALLATION OF A MISSING AGENT; A LOCAL AGENT USES THE PERSON'S OWN LOGIN; A REMOTE INTERFACE NAMES HOW IT FAILS; UC-011; UC-017; UC-044

import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after } from "node:test";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { installedAgents, testAgent } from "../src/agent-processes/index.mjs";

const root = new URL("..", import.meta.url).pathname;
const fixture = () => mkdtempSync(join(tmpdir(), "agent-m-320-"));
const command = (folder, name, text) => {
  const path = join(folder, name);
  writeFileSync(path, `#!/bin/sh\n${text}\n`, { mode: 0o755 });
  return path;
};
const withPath = async (folder, work) => {
  const prior = process.env.PATH;
  process.env.PATH = folder;
  try { return await work(); } finally { process.env.PATH = prior; }
};
const registerFixture = (folder, mutate = (text) => text) => {
  cpSync(join(root, "src"), join(folder, "src"), { recursive: true });
  const path = join(folder, "src", "agent-processes", "agents.md");
  writeFileSync(path, mutate(readFileSync(path, "utf8")));
  return join(folder, "src", "agent-processes", "index.mjs");
};
const FAULTS = {
  "TST-320001": ["installed: false", "installed: true"],
  "TST-320002": ["const loggedIn = loginMatches(row.login, login);", "const loggedIn = true;"],
  "TST-320003": ["const result = await invoke(row.command, row.task.args, ownLoginEnvironment(), \"Reply with one word: ok.\", enclosed);", "const result = await invoke(row.command, row.task.args, process.env, \"Reply with one word: ok.\", enclosed);"],
  "TST-320004": ["if (!result.ok) return { answered: false, reason: (result.stderr || result.error?.message || `exit ${result.status}`).trim() };", "if (!result.ok) return { answered: true, version: agent.version };"],
  "TST-320005": ["if (findings.length || !register.rows.length) {", "if (false) {"],
};

// TST-320001
// level: unit
// module: MOD-agent-processes
// guards: THE BRIDGE FINDS THE INSTALLED AGENTS; THE BRIDGE GUIDES THE INSTALLATION OF A MISSING AGENT; A LOCAL AGENT USES THE PERSON'S OWN LOGIN; UC-011; UC-017
// given: a controlled PATH containing only register-named Claude and Codex executables whose version and harmless login-status outputs are constructed; OpenCode is absent.
// input: installedAgents() reads the public register and performs its discovery checks.
// expect: two installed agents carry their register name, version and logged-in state; the missing third carries all platform install guidance; no fixture receives a task.
test("TST-320001: discovery reports register agents' version and own-login outcomes", async () => {
  const folder = fixture();
  try {
    const calls = join(folder, "calls");
    command(folder, "claude", `printf '%s\\n' \"$*\" >> ${calls}; case \"$*\" in '--version') echo '2.1.300';; 'auth status') echo '{\"authMethod\":\"claude.ai\"}';; *) exit 64;; esac`);
    command(folder, "codex", `printf '%s\\n' \"$*\" >> ${calls}; case \"$*\" in '--version') echo 'codex 1.2.3';; 'login status') echo 'Logged in';; *) exit 64;; esac`);
    const agents = await withPath(folder, () => installedAgents());
    assert.deepEqual(agents.filter((agent) => agent.installed).map(({ name, version, loggedIn }) => ({ name, version, loggedIn })), [
      { name: "claude", version: "2.1.300", loggedIn: true }, { name: "codex", version: "1.2.3", loggedIn: true },
    ]);
    assert.deepEqual(Object.keys(agents.find((agent) => agent.name === "opencode").install).sort(), ["linux", "macos", "windows"]);
    const missing = agents.find((agent) => agent.name === "opencode");
    assert.deepEqual({ installed: missing.installed, version: missing.version, loggedIn: missing.loggedIn }, { installed: false, version: null, loggedIn: null });
    for (const url of Object.values(missing.install)) assert.match(url, /^https:\/\/opencode\.ai\/docs\/(?:#install|#windows|windows(?:\/|$))/);
    assert.deepEqual(readFileSync(calls, "utf8").trim().split("\n").sort(), ["--version", "--version", "auth status", "login status"].sort());
  } finally { rmSync(folder, { recursive: true, force: true }); }
});

// TST-320002
// level: unit
// module: MOD-agent-processes
// guards: THE BRIDGE FINDS THE INSTALLED AGENTS; A REMOTE INTERFACE NAMES HOW IT FAILS; UC-011
// given: a controlled PATH with one register command present and the other supported commands absent.
// input: installedAgents() performs only discovery's version/login checks.
// expect: the present entry is installed and missing commands are named unavailable without executing a task or reaching a real agent.
test("TST-320002: discovery names missing supported commands without a task", async () => {
  const folder = fixture();
  try {
    const calls = join(folder, "calls");
    command(folder, "claude", `printf '%s\\n' \"$*\" >> ${calls}; case \"$*\" in '--version') echo 2.1.300;; 'auth status') echo '{\"authMethod\":\"none\"}'; exit 1;; *) exit 64;; esac`);
    const agents = await withPath(folder, () => installedAgents());
    assert.equal(agents.find((agent) => agent.name === "claude").installed, true);
    assert.equal(agents.find((agent) => agent.name === "claude").loggedIn, false);
    assert.match(JSON.stringify(agents.find((agent) => agent.name === "claude")), /claude auth login/);
    assert.equal(JSON.stringify(agents.find((agent) => agent.name === "claude")).includes("password"), false);
    assert.deepEqual(readFileSync(calls, "utf8").trim().split("\n").sort(), ["--version", "auth status"].sort());
    for (const name of ["codex", "opencode"]) assert.equal(agents.find((agent) => agent.name === name).installed, false);
  } finally { rmSync(folder, { recursive: true, force: true }); }
});

// TST-320003
// level: unit
// module: MOD-agent-processes
// guards: THE BRIDGE FINDS THE INSTALLED AGENTS; A LOCAL AGENT USES THE PERSON'S OWN LOGIN; UC-011
// given: a controlled Claude executable that records its complete argument vector and its standard input, rejects a constructed inherited ANTHROPIC_API_KEY at its task invocation, and otherwise prints Claude Code's JSON result line whose result is exactly one word.
// input: testAgent(the discovered public Claude Agent).
// expect: its documented print-mode task `claude -p --output-format json` reads the one-word request on its standard input and returns `{ answered: true, version }`; no other agent executable is reachable.
test("TST-320003: harmless agent test sends a one-word task", async () => {
  const folder = fixture();
  const priorKey = process.env.ANTHROPIC_API_KEY;
  try {
    const record = join(folder, "arguments");
    command(folder, "claude", `case \"$*\" in '--version') echo 2.1.300;; 'auth status') echo '{\"authMethod\":\"claude.ai\"}';; *) IFS= read -r input; [ -z \"$ANTHROPIC_API_KEY\" ] && [ \"$*\" = '-p --output-format json' ] && [ \"$input\" = 'Reply with one word: ok.' ] && printf '%s\\n' \"$@\" \"$input\" > ${record} && echo '{\"type\":\"result\",\"subtype\":\"success\",\"is_error\":false,\"result\":\"yes\",\"usage\":{\"input_tokens\":3,\"output_tokens\":1}}' || exit 64;; esac`);
    process.env.ANTHROPIC_API_KEY = "constructed-parent-fixture-key";
    const agent = (await withPath(folder, () => installedAgents())).find((value) => value.name === "claude");
    const answer = await withPath(folder, () => testAgent(agent));
    assert.deepEqual(answer, { answered: true, version: "2.1.300" });
    const argv = readFileSync(record, "utf8").trim().split("\n");
    assert.deepEqual(argv, ["-p", "--output-format", "json", "Reply with one word: ok."]);
  } finally {
    if (priorKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = priorKey;
    rmSync(folder, { recursive: true, force: true });
  }
});

// TST-320004
// level: unit
// module: MOD-agent-processes
// guards: A REMOTE INTERFACE NAMES HOW IT FAILS; UC-011; UC-044
// given: a controlled Claude executable whose harmless request, read on its standard input, exits unsuccessfully after its own login check.
// input: testAgent(the discovered public Claude Agent).
// expect: the documented print-mode harmless request returns `{ answered: false, reason }` rather than a fabricated success.
test("TST-320004: harmless agent refusal is named", async () => {
  const folder = fixture();
  try {
    const record = join(folder, "arguments");
    command(folder, "claude", `case \"$*\" in '--version') echo 2.1.300;; 'auth status') echo '{\"authMethod\":\"claude.ai\"}';; *) IFS= read -r input; [ \"$*\" = '-p --output-format json' ] && [ \"$input\" = 'Reply with one word: ok.' ] && printf '%s\\n' \"$@\" \"$input\" > ${record} && { echo refused >&2; exit 23; } || exit 64;; esac`);
    const agent = (await withPath(folder, () => installedAgents())).find((value) => value.name === "claude");
    const answer = await withPath(folder, () => testAgent(agent));
    assert.deepEqual(answer, { answered: false, reason: "refused" });
    const argv = readFileSync(record, "utf8").trim().split("\n");
    assert.deepEqual(argv, ["-p", "--output-format", "json", "Reply with one word: ok."]);
  } finally { rmSync(folder, { recursive: true, force: true }); }
});

// TST-320005
// level: unit
// module: MOD-agent-processes
// guards: THE BRIDGE FINDS THE INSTALLED AGENTS; A REMOTE INTERFACE NAMES HOW IT FAILS; UC-017
// given: an isolated copied MOD-agent-processes module and its actual agents.md register with exactly one required header field corrupted.
// input: importing the copied public module that loads that corrupt register.
// expect: schema-breaking register data refuses module load; the test does not require a particular error class.
test("TST-320005: corrupt copied agent register refuses module load", async () => {
  const folder = fixture();
  try {
    const valid = registerFixture(join(folder, "valid"));
    await import(new URL(`file://${valid}`).href);
    const corrupt = registerFixture(join(folder, "corrupt"), (text) => {
      assert.equal((text.match(/\|\s*Command\s*\|/g) ?? []).length, 1, "known positive: exactly one required Command header exists");
      return text.replace(/\|\s*Command\s*\|/, "| Broken command |");
    });
    await assert.rejects(import(new URL(`file://${corrupt}`).href), (error) => error?.code !== "ERR_MODULE_NOT_FOUND" && error?.name !== "SyntaxError" && /command|register|schema/i.test(String(error.message)));
  } finally { rmSync(folder, { recursive: true, force: true }); }
});

after(() => {
  if (process.env.GITHUB_ACTIONS !== "true" || process.env.AGENT_M_320_FAULT_CHILD) return;
  const temporary = mkdtempSync(join(tmpdir(), "agent-m-320-fault-"));
  const copied = join(temporary, "repo");
  const digest = (value) => createHash("sha256").update(value).digest("hex");
  try {
    cpSync(process.cwd(), copied, { recursive: true, filter: (path) => !path.includes("/.git") && !path.includes("/node_modules") });
    for (const [id, [needle, replacement]] of Object.entries(FAULTS)) {
      const source = join(copied, "src", "agent-processes", "index.mjs");
      const original = readFileSync(source);
      const argv = [process.execPath, "--test", "--test-name-pattern", id, "tests/agent-processes-320.test.mjs"];
      assert.equal(original.toString().split(needle).length - 1, 1, `${id}: unique fault target`);
      const invoke = () => {
        const env = { ...process.env, AGENT_M_320_FAULT_CHILD: "1" };
        delete env.NODE_TEST_CONTEXT;
        return spawnSync(argv[0], argv.slice(1), { cwd: copied, encoding: "utf8", timeout: 15_000, env });
      };
      const sourceHash = digest(original);
      const testHash = digest(readFileSync(join(copied, "tests", "agent-processes-320.test.mjs")));
      let failed, passed, faultHash, restoredHash, faultEnded, restoreStarted, restoredEnded, positiveEnded;
      const faultStarted = new Date().toISOString();
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
      console.log("TST320-counterproof " + JSON.stringify({ id, source, needle, replacement, sourceHash, testHash, faultHash,
        restoredHash, faultStarted, faultEnded, restoreStarted, restoredEnded, positiveEnded, argv, cwd: copied,
        childflag: "AGENT_M_320_FAULT_CHILD=1", failed: { status: failed.status, signal: failed.signal,
          error: failed.error?.message ?? null, stdout: failed.stdout, stderr: failed.stderr }, passed: { status: passed.status,
          signal: passed.signal, error: passed.error?.message ?? null, stdout: passed.stdout, stderr: passed.stderr } }));
      assert.equal(failed.status, 1, id);
      assert.match(`${failed.stdout}\n${failed.stderr}`, new RegExp(`not ok \\d+ - ${id}\\b`));
      assert.equal(restoredHash, sourceHash, id);
      assert.equal(passed.status, 0, id);
      assert.match(`${passed.stdout}\n${passed.stderr}`, new RegExp(`ok \\d+ - ${id}\\b`));
    }
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});
