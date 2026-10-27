// ITM-1002: an agent that is not logged in is returned with its own login step, and nothing asks for a password.
// Module: MOD-agent-processes
// Guards: A LOCAL AGENT USES THE PERSON'S OWN LOGIN; THE BRIDGE FINDS THE INSTALLED AGENTS; UC-044
// Level: unit
// Run: node --test tests/agent-processes-login-1002.test.mjs

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { installedAgents } from "../src/agent-processes/index.mjs";

const fixture = () => mkdtempSync(join(tmpdir(), "agent-m-1002-"));
const command = (folder, name, text) => writeFileSync(join(folder, name), `#!/bin/sh\n${text}\n`, { mode: 0o755 });
const withPath = async (folder, work) => {
  const prior = process.env.PATH;
  process.env.PATH = folder;
  try { return await work(); } finally { process.env.PATH = prior; }
};
// The login step of each supported agent, as its own CLI names it.
const STEP = { claude: "claude auth login", codex: "codex login", opencode: "opencode auth login" };
// A fixture executable of each agent that logs every call (arguments and what arrives on its standard input) and answers the
// version and login-check commands; `signedIn` chooses what the login check says. Any other call exits 64.
function agents(folder, calls, signedIn) {
  // `read` is a builtin: the controlled PATH holds no other command, so `cat` would silently read nothing.
  const log = `IFS= read -r input || true; printf '%s|stdin=[%s]\\n' "$*" "$input" >> ${calls}`;
  command(folder, "claude", `${log}; case "$*" in '--version') echo 2.1.300;; 'auth status') ${signedIn.claude ? "echo '{\"authMethod\":\"claude.ai\"}'" : "exit 1"};; *) exit 64;; esac`);
  command(folder, "codex", `${log}; case "$*" in '--version') echo 'codex 1.2.3';; 'login status') ${signedIn.codex ? "echo 'Logged in'" : "exit 1"};; *) exit 64;; esac`);
  command(folder, "opencode", `${log}; case "$*" in '--version') echo 0.9.1;; 'models') ${signedIn.opencode ? "echo opencode/big-pickle" : ":"};; *) exit 64;; esac`);
}
const NONE = { claude: false, codex: false, opencode: false };

// TST-1002001
// level: unit
// module: MOD-agent-processes
// guards: A LOCAL AGENT USES THE PERSON'S OWN LOGIN; UC-044
// given: a controlled PATH holding an executable of each supported agent whose own login check says it is not logged in.
// input: installedAgents().
// expect: each agent is installed, has loggedIn false, and carries its own login step as its CLI names it.
test("TST-1002001: an installed agent whose login check fails is returned with loggedIn false and its login step", async () => {
  const folder = fixture();
  try {
    agents(folder, join(folder, "calls"), NONE);
    const found = await withPath(folder, () => installedAgents());
    assert.deepEqual(found.map(({ name, installed, loggedIn, login }) => ({ name, installed, loggedIn, login })), [
      { name: "claude", installed: true, loggedIn: false, login: STEP.claude },
      { name: "codex", installed: true, loggedIn: false, login: STEP.codex },
      { name: "opencode", installed: true, loggedIn: false, login: STEP.opencode },
    ]);
  } finally { rmSync(folder, { recursive: true, force: true }); }
});

// TST-1002002
// level: unit
// module: MOD-agent-processes
// guards: A LOCAL AGENT USES THE PERSON'S OWN LOGIN; UC-044
// given: executables of the three agents, none logged in, each logging its arguments and its standard input.
// input: installedAgents().
// expect: only the version and login-check commands are started; no login step is started; nothing is written to any agent's
// standard input; no argument names a password, a key or a token; the returned records mention no password.
test("TST-1002002: nothing asks for a password and no login step is started", async () => {
  const folder = fixture();
  try {
    const calls = join(folder, "calls");
    agents(folder, calls, NONE);
    const found = await withPath(folder, () => installedAgents());
    const lines = readFileSync(calls, "utf8").trim().split("\n").sort();
    assert.deepEqual(lines, ["--version|stdin=[]", "--version|stdin=[]", "--version|stdin=[]",
      "auth status|stdin=[]", "models|stdin=[]", "login status|stdin=[]"].sort());
    for (const line of lines) assert.doesNotMatch(line, /password|passwd|secret|token|--key|api[-_]?key/i);
    assert.equal(JSON.stringify(found).toLowerCase().includes("password"), false);
  } finally { rmSync(folder, { recursive: true, force: true }); }
});

// TST-1002003
// level: unit
// module: MOD-agent-processes
// guards: THE BRIDGE FINDS THE INSTALLED AGENTS; A LOCAL AGENT USES THE PERSON'S OWN LOGIN; UC-044
// given: Claude installed and logged in, Codex installed and not logged in, OpenCode absent.
// input: installedAgents().
// expect: every Agent record carries `login`, a string, the agent's own login step from the register: the logged-in one, the
// not-logged-in one and the missing one alike; loggedIn stays true, false and null.
test("TST-1002003: every Agent carries its own login step, whether logged in, not logged in or missing", async () => {
  const folder = fixture();
  try {
    agents(folder, join(folder, "calls"), { claude: true, codex: false, opencode: false });
    rmSync(join(folder, "opencode"));
    const found = await withPath(folder, () => installedAgents());
    assert.deepEqual(found.map(({ name, installed, loggedIn, login }) => ({ name, installed, loggedIn, login })), [
      { name: "claude", installed: true, loggedIn: true, login: STEP.claude },
      { name: "codex", installed: true, loggedIn: false, login: STEP.codex },
      { name: "opencode", installed: false, loggedIn: null, login: STEP.opencode },
    ]);
    for (const agent of found) assert.equal(typeof agent.login, "string");
    assert.equal(existsSync(join(folder, "opencode")), false);
  } finally { rmSync(folder, { recursive: true, force: true }); }
});
