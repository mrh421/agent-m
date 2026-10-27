// MOD-agent-processes — an agent started inside the enclosure it is given (ARC-054), as docs/architecture/MOD-agent-processes.md states it:
// `Enclosure.wrap(command, args, at)` gives the command that starts the CLI inside it, the whole environment it receives and the text written
// before its own input; `agentDriver`, `installedAgents` and `testAgent` take one as an option and then start nothing of the agent outside it.
// Run: node --test tests/agent-processes-enclosure.test.mjs
//
// Module: MOD-agent-processes
// Guards: NO MODEL READS A CREDENTIAL; A LOCAL AGENT USES THE PERSON'S OWN LOGIN; THE BRIDGE FINDS THE INSTALLED AGENTS
// Level: unit
//
// Fast, no network, no real agent: a fixture `claude` — a shell script in a temporary folder that is the whole PATH — records its arguments, its
// working folder, whether it sees the person's variable PERSON_SECRET and the enclosure's variable ENCLOSED, and its standard input. The enclosure is a
// recording fixture whose wrap starts the program through `/bin/sh` with the environment it names, so that what reaches the agent is what the
// enclosure gave; what the real enclosure does is tests/agent-enclosure.test.mjs's.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { agentDriver, installedAgents, testAgent } from "../src/agent-processes/index.mjs";

const RESULT = JSON.stringify({ type: "result", subtype: "success", is_error: false, result: "ok", usage: { input_tokens: 3, output_tokens: 1 } });

function machine(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "am-enc-agent-")));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bin = join(root, "bin"), work = join(root, "work"), log = join(root, "log");
  mkdirSync(bin);
  mkdirSync(work);
  writeFileSync(log, "");
  writeFileSync(join(bin, "claude"), `#!/bin/sh
printf 'args=%s cwd=%s secret=%s enclosed=%s\\n' "$*" "$(pwd)" "\${PERSON_SECRET:-none}" "\${ENCLOSED:-no}" >> ${log}
case "$*" in '--version') echo '2.1.300';; 'auth status') exit 0;; *) /bin/cat >> ${log}; printf '\\n' >> ${log}; printf '%s\\n' '${RESULT}';; esac
`, { mode: 0o755 });
  const prior = { PATH: process.env.PATH, PERSON_SECRET: process.env.PERSON_SECRET };
  process.env.PATH = bin;
  process.env.PERSON_SECRET = "person-secret-fixture";
  t.after(() => { process.env.PATH = prior.PATH; if (prior.PERSON_SECRET === undefined) delete process.env.PERSON_SECRET; else process.env.PERSON_SECRET = prior.PERSON_SECRET; });
  const wraps = [];
  const enclosure = {
    wrap(command, args, at) {
      wraps.push({ command, args, at });
      return { command: "/bin/sh", args: ["-c", 'exec "$0" "$@"', command, ...args], env: { PATH: bin, ENCLOSED: "yes" }, input: "line-of-the-enclosure\n" };
    },
  };
  return { root, bin, work, wraps, enclosure, lines: () => readFileSync(log, "utf8").split("\n").filter(Boolean) };
}

// TST-1380101 · level: unit · module: MOD-agent-processes
// guards: NO MODEL READS A CREDENTIAL; A LOCAL AGENT USES THE PERSON'S OWN LOGIN
// given: the fixture claude, logged in, the person's variable PERSON_SECRET set in the Bridge's environment, and the recording enclosure
// input: agentDriver(claude, { workdir, keyVariable: null, endpoint: null, enclosure, writable: [workdir, workdir + ".out.git"] }).send of the prompt "Draft it."
// expect: the enclosure's wrap is asked once for claude with its task arguments `-p --output-format json`, the working folder and the two writable folders; the agent runs in the working folder, sees ENCLOSED and not PERSON_SECRET, and reads the enclosure's line before the prompt; the answer is "ok"; counter-proof: the same driver without an enclosure starts the agent with the person's environment, PERSON_SECRET among it
test("TST-1380101: the driver starts the agent through its enclosure, with the enclosure's environment only", async (t) => {
  const m = machine(t);
  const claude = { name: "claude", installed: true, version: "2.1.300", loggedIn: true, login: "claude auth login", install: {} };
  const input = { prompt: "Draft it.", parts: [], output: null, findings: [], previous: null, workdir: null };
  const answer = await agentDriver(claude, { workdir: m.work, keyVariable: null, endpoint: null, enclosure: m.enclosure, writable: [m.work, `${m.work}.out.git`] }, { name: "fixture" }).send(input);
  assert.equal(answer.text, "ok");
  assert.equal(m.wraps.length, 1);
  assert.deepEqual(m.wraps[0], { command: "claude", args: ["-p", "--output-format", "json"], at: { workdir: m.work, writable: [m.work, `${m.work}.out.git`] } });
  const [call, ...stdin] = m.lines();
  assert.equal(call, `args=-p --output-format json cwd=${m.work} secret=none enclosed=yes`);
  assert.equal(stdin[0], "line-of-the-enclosure", "the enclosure's line comes first");
  assert.ok(stdin.join("\n").includes("Draft it."), "then the prompt");

  await agentDriver(claude, { workdir: m.work, keyVariable: null, endpoint: null }, { name: "fixture" }).send(input);
  assert.ok(m.lines().some((line) => line.endsWith("secret=person-secret-fixture enclosed=no")), "counter-proof: outside an enclosure the person's environment reaches the agent");
});

// TST-1380102 · level: unit · module: MOD-agent-processes
// guards: THE BRIDGE FINDS THE INSTALLED AGENTS; A LOCAL AGENT USES THE PERSON'S OWN LOGIN
// given: the fixture claude on the PATH and no codex or opencode, and the recording enclosure
// input: installedAgents({ enclosure, workdir }), then testAgent of the claude it found, with the same enclosure
// expect: claude's version and login check run through the enclosure, in workdir — wrap asked for `claude --version` and `claude auth status` —, and claude is installed, 2.1.300 and logged in; codex and opencode, whose version command fails in the enclosure, are missing; testAgent asks claude through the enclosure and is answered; no line of the agent sees PERSON_SECRET; counter-proof: the enclosure was asked for every command the agent ran
test("TST-1380102: the installed agents and the probe are asked in the enclosure", async (t) => {
  const m = machine(t);
  const agents = await installedAgents({ enclosure: m.enclosure, workdir: m.work });
  const claude = agents.find((agent) => agent.name === "claude");
  assert.deepEqual([claude.installed, claude.version, claude.loggedIn], [true, "2.1.300", true]);
  for (const name of ["codex", "opencode"]) assert.equal(agents.find((agent) => agent.name === name).installed, false, `${name} is missing in the enclosure`);
  assert.ok(m.wraps.some(({ command, args, at }) => command === "claude" && args.join(" ") === "--version" && at.workdir === m.work));
  assert.ok(m.wraps.some(({ command, args }) => command === "claude" && args.join(" ") === "auth status"));
  const answer = await testAgent(claude, { enclosure: m.enclosure, workdir: m.work });
  assert.deepEqual(answer, { answered: true, version: "2.1.300" });
  const ran = m.lines().filter((line) => line.startsWith("args="));
  assert.ok(ran.length >= 3);
  assert.equal(ran.every((line) => line.includes("secret=none enclosed=yes")), true, `every start went through the enclosure: ${ran.join(" | ")}`);
});
