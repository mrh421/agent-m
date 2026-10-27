// ITM-1230: opencode is ready where it lists a model it can use — a free model without any credential, as with one.
// Module: MOD-agent-processes
// Guards: THE BRIDGE FINDS THE INSTALLED AGENTS; A LOCAL AGENT USES THE PERSON'S OWN LOGIN; UC-044
// Level: unit
// Run: node --test tests/agent-processes-login-1230.test.mjs

import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { installedAgents } from "../src/agent-processes/index.mjs";

const fixture = () => mkdtempSync(join(tmpdir(), "agent-m-1230-"));
const command = (folder, name, text) => writeFileSync(join(folder, name), `#!/bin/sh\n${text}\n`, { mode: 0o755 });
const withPath = async (folder, work) => {
  const prior = process.env.PATH;
  process.env.PATH = folder;
  try { return await work(); } finally { process.env.PATH = prior; }
};
// The two opencode versions as they answer on a machine with no credential stored: 2.1.4 (Homebrew) and 1.19.0 (npm, CI).
const VERSIONS = [
  { version: "2.1.4", authList: "No authenticated integrations" },
  { version: "1.19.0", authList: "0 credentials" },
];
// A fixture opencode alone on the PATH: it answers its version, `auth list` with no credential, and `models` with `models`
// — the lines it prints, its exit status and what it writes to standard error. Any other call exits 64.
function opencode(folder, { version, authList }, models) {
  const lines = models.lines.map((line) => `echo '${line}'`).join("; ") || ":";
  command(folder, "opencode", `case "$*" in '--version') echo ${version};; 'auth list') echo '${authList}';; `
    + `'models') ${lines}; ${models.stderr ? `echo '${models.stderr}' >&2;` : ""} exit ${models.status ?? 0};; *) exit 64;; esac`);
}
const opencodeOf = (found) => {
  const { name, installed, version, loggedIn, login } = found.find((agent) => agent.name === "opencode");
  return { name, installed, version, loggedIn, login };
};

// TST-1230001
// level: unit
// module: MOD-agent-processes
// guards: THE BRIDGE FINDS THE INSTALLED AGENTS; A LOCAL AGENT USES THE PERSON'S OWN LOGIN; UC-044
// given: a controlled PATH holding opencode alone, in the 2.1.4 and the 1.19.0 manner, with no credential stored (its `auth list` names none) and listing free models with `models`.
// input: installedAgents().
// expect: opencode is installed with its version, logged in, and carries its login step `opencode auth login`.
test("TST-1230001: opencode with no credential that lists a free model is installed and logged in", async () => {
  for (const each of VERSIONS) {
    const folder = fixture();
    try {
      opencode(folder, each, { lines: ["opencode/big-pickle", "opencode/glm-5.3-flash-free"] });
      const found = await withPath(folder, () => installedAgents());
      assert.deepEqual(opencodeOf(found),
        { name: "opencode", installed: true, version: each.version, loggedIn: true, login: "opencode auth login" }, each.version);
    } finally { rmSync(folder, { recursive: true, force: true }); }
  }
});

// TST-1230002
// level: unit
// module: MOD-agent-processes
// guards: THE BRIDGE FINDS THE INSTALLED AGENTS; A LOCAL AGENT USES THE PERSON'S OWN LOGIN; UC-044
// given: a controlled PATH holding opencode alone with no credential stored, whose `models` lists no model: (a) it prints nothing and ends 0, as 2.1.4 with free models switched off; (b) it fails, ending 1 with an error on standard error.
// input: installedAgents().
// expect: opencode is installed and not logged in, and its login step is `opencode auth login`.
test("TST-1230002: opencode that lists no model is installed, not logged in, with its login step", async () => {
  for (const models of [{ lines: [] }, { lines: [], status: 1, stderr: "Error: no provider at /tmp/opencode" }]) {
    const folder = fixture();
    try {
      opencode(folder, VERSIONS[0], models);
      const found = await withPath(folder, () => installedAgents());
      assert.deepEqual(opencodeOf(found),
        { name: "opencode", installed: true, version: "2.1.4", loggedIn: false, login: "opencode auth login" }, JSON.stringify(models));
    } finally { rmSync(folder, { recursive: true, force: true }); }
  }
});
