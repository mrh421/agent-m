// MOD-bridge-jobs — the agents of a Bridge's computer, listed, tested and asked (ITM-326), as docs/architecture/MOD-bridge-jobs.md
// states them: `jobHandlers` gains, for the agents the Bridge offers — those of installedAgents' agents that its settings name with their
// working folders —, GET /v1/agents (the offered agents with version, ready and logged in, and the supported agents missing on this
// computer), POST /v1/probes/agent (testAgent's answer for the named agent, invalid-request for one not offered) and POST /v1/ask with
// GET /v1/ask/{ask} for an agent (a drafting request through agentDriver, answered running, done with its text and usage, or failed with
// its error; the correction loop stays in the page). UC-017 steps 3 and 6; UC-011 step 3.
// Run: node --test tests/bridge-jobs-agents.test.mjs
//
// Module: MOD-bridge-jobs
// Guards: UC-011; UC-017; THE BRIDGE FINDS THE INSTALLED AGENTS; A LOCAL AGENT USES THE PERSON'S OWN LOGIN
// Level: unit
//
// MOD-agent-processes runs as it is, over fixture executables: a folder of small shell scripts named claude, codex and opencode, which is
// the whole PATH of a test, so that no real agent starts and nothing reaches the network. Each script records what it was asked in a file
// of the test. Where the module file leaves a reading open, the test states the one it takes, and the pull request names it:
//   - jobHandlers takes the agents the settings name as `agents: [{ name, folder }]`; an agent offered is one named there that
//     installedAgents finds installed; one installed and not named is neither offered nor missing; one named and not found is missing.
//   - An agent is ready when it is logged in and its working folder is set; a folder left empty is not set.
//   - The probe's `args` is `{ agent: <name> }`; the ask's body is `{ agent, input }` with `input` the prompt, as bridgeApi has it.
//   - An ask's answer is `{ state, text, calls, usage, error }`, `calls` `[]` since an agent's ask is no exchange of a tool loop; `error` is the failure's message with the agent's last output; an ask the Bridge
//     does not know is not-found; an ask is kept in memory only.
// Each test states its input and its expected result before it runs (given / input / expect); where a test expects an agent not to be
// started, the same call is first shown to start it. The counter-proofs are recorded in the pull request.

import assert from "node:assert/strict";
import { closeSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { mock } from "node:test";
import * as bridgeJobs from "../src/bridge-jobs/index.mjs";

const { jobHandlers } = bridgeJobs;
const fs = process.getBuiltinModule("node:fs");

// ---------------------------------------------------------------- fixture agents

const script = (folder, name, body) => writeFileSync(join(folder, name), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
const GATE = "gate", CALLS = "calls";
// Claude Code's answer to `claude -p --output-format json`: one `result` line, shaped as tests/fixtures/agent-processes/claude-result.json; the values are synthetic.
const CLAUDE_RESULT = JSON.stringify({ type: "result", subtype: "success", is_error: false, api_error_status: null, duration_ms: 1000, duration_api_ms: 900,
  num_turns: 1, result: "ok", stop_reason: "end_turn", session_id: "00000000-0000-4000-8000-000000000326", total_cost_usd: 0.001,
  usage: { input_tokens: 5, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 1, output_tokens_details: { thinking_tokens: 0 },
    server_tool_use: { web_search_requests: 0, web_fetch_requests: 0 }, service_tier: "standard", cache_creation: { ephemeral_1h_input_tokens: 0, ephemeral_5m_input_tokens: 0 },
    iterations: [{ input_tokens: 5, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, type: "message" }] },
  modelUsage: { "fixture-model": { inputTokens: 5, outputTokens: 1, cacheReadInputTokens: 0, cacheCreationInputTokens: 0, costUSD: 0.001 } },
  permission_denials: [], terminal_reason: "completed", uuid: "00000000-0000-4000-8000-000000000001" });
// A computer: a folder that is the whole PATH, with the agents given — claude: { loggedIn }, codex, opencode: { gated, fails } — and the
// working folders of the offered agents.
function computer({ claude = null, codex = null, opencode = null } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "agent-m-326-")));
  const bin = join(root, "bin"), calls = join(root, CALLS), gate = join(root, GATE);
  mkdirSync(bin);
  writeFileSync(calls, "");
  const log = `printf '%s\\n' "$0 $*" >> ${calls}`;
  const input = `/bin/cat >> ${calls}; printf '\\n' >> ${calls}`;
  if (claude) {
    script(bin, "claude", `${log}\ncase "$*" in '--version') echo '2.1.300';; 'auth status') ${claude.loggedIn ? "echo '{\"authMethod\":\"claude.ai\"}'" : "exit 1"};; *) ${claude.answers === false ? "exit 2" : `printf '%s\\n' '${CLAUDE_RESULT}'`};; esac`);
  }
  if (codex) script(bin, "codex", `${log}\ncase "$*" in '--version') echo 'codex 1.2.3';; 'login status') echo 'Logged in';; *) echo ok;; esac`);
  if (opencode) {
    const events = `printf '%s\\n' '{"type":"text","part":{"text":"drafted in '"$(pwd)"'"}}' '{"type":"step_finish","part":{"tokens":{"input":11,"output":7}}}'`;
    script(bin, "opencode", `${log}\ncase "$1" in --version) echo 1.4.0;; auth) echo '1 credentials';; models) echo opencode/big-pickle;; run) ${input}; ${opencode.gated ? `while [ ! -e ${gate} ]; do /bin/sleep 0.02; done` : ":"}; ${opencode.fails ? "echo boom >&2; exit 3" : events};; esac`);
  }
  const folders = { claude: join(root, "work-claude"), codex: join(root, "work-codex"), opencode: join(root, "work-opencode") };
  for (const folder of Object.values(folders)) mkdirSync(folder);
  return { root, bin, folders, calls: () => readFileSync(calls, "utf8").trim().split("\n").filter(Boolean),
    release: () => closeSync(openSync(gate, "w")) };
}
// Every ask the test posted; onComputer refuses to remove the machine's folder while one of them still runs, since its agent writes there.
const asked = [];
async function onComputer(machine, work) {
  const prior = process.env.PATH;
  process.env.PATH = machine.bin;
  asked.length = 0;
  try {
    const result = await work();
    const running = [];
    for (const { handlers, ask } of asked) if ((await handlers["GET /v1/ask/{ask}"]({ params: { ask }, query: {}, body: {} })).state === "running") running.push(ask);
    assert.deepEqual(running, [], "the test returned while an ask it started still ran, and its agent still writes into the folder that is removed next");
    return result;
  } finally { process.env.PATH = prior; rmSync(machine.root, { recursive: true, force: true }); }
}
const call = async (handlers, key, { params = {}, body = {} } = {}) => {
  const answer = await handlers[key]({ params, query: {}, body });
  if (key === "POST /v1/ask") asked.push({ handlers, ask: answer.ask });
  return answer;
};
const offered = (machine, ...names) => names.map((name) => ({ name, folder: machine.folders[name] }));
async function rejection(promise) {
  try { await promise; } catch (error) { return error; }
  assert.fail("the call was not refused");
}
async function until(condition, what) {
  // The bound only ends a wait that can never be met; a machine running other suites beside this one takes seconds to start an agent.
  for (const stop = Date.now() + 60_000; Date.now() < stop;) {
    const found = await condition();
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail(`waited for ${what}`);
}

// ---------------------------------------------------------------- GET /v1/agents

// TST-472077 · level: unit · module: MOD-bridge-jobs
// guards: THE BRIDGE FINDS THE INSTALLED AGENTS; UC-011; UC-017
// given: a computer with claude (version 2.1.300, logged in) and codex (installed) and no opencode; settings that name claude and opencode with working folders
// input: GET /v1/agents
// expect: agents holding claude alone — its version, ready true, logged in true; missing holding opencode alone; codex, installed and not offered, in neither list; no agent was given a task
test("GET /v1/agents — the offered agents, and the supported agents missing; an installed agent that is not offered is left out", async () => {
  const machine = computer({ claude: { loggedIn: true }, codex: {} });
  await onComputer(machine, async () => {
    const handlers = jobHandlers({ agents: offered(machine, "claude", "opencode") });
    const answer = await call(handlers, "GET /v1/agents");

    assert.deepEqual(answer, { agents: [{ name: "claude", version: "2.1.300", ready: true, loggedIn: true }], missing: [{ name: "opencode" }] });
    assert.ok(machine.calls().length >= 2 && machine.calls().every((line) => /--version|auth status|login status/.test(line)), machine.calls().join("; "));
  });
});

// TST-472078 · level: unit · module: MOD-bridge-jobs
// guards: THE BRIDGE FINDS THE INSTALLED AGENTS; A LOCAL AGENT USES THE PERSON'S OWN LOGIN; UC-017
// given: a computer with claude, which is not logged in, and codex, which is; claude offered with its working folder, codex named without one
// input: GET /v1/agents
// expect: claude: logged in false and not ready; codex: logged in true and not ready, since its working folder is not set
test("GET /v1/agents — an agent not logged in, or without a working folder, is not ready", async () => {
  const machine = computer({ claude: { loggedIn: false }, codex: {} });
  await onComputer(machine, async () => {
    const handlers = jobHandlers({ agents: [{ name: "claude", folder: machine.folders.claude }, { name: "codex", folder: "" }] });
    const { agents, missing } = await call(handlers, "GET /v1/agents");

    assert.deepEqual(agents, [{ name: "claude", version: "2.1.300", ready: false, loggedIn: false }, { name: "codex", version: "1.2.3", ready: false, loggedIn: true }]);
    assert.deepEqual(missing, [{ name: "opencode" }]);
  });
});

// ---------------------------------------------------------------- POST /v1/probes/agent

// TST-472079 · level: unit · module: MOD-bridge-jobs
// guards: UC-017; A LOCAL AGENT USES THE PERSON'S OWN LOGIN
// given: a computer with claude, which answers, and codex, which is installed and not offered; claude offered; then claude changed to one that exits with an error on a task
// input: POST /v1/probes/agent for claude; for codex; with no agent named; and for claude that fails
// expect: { answer: { answered: true, version: "2.1.300" } } for claude; invalid-request for codex, with nothing started and codex never asked; invalid-request with no agent; for the failing claude { answer: { answered: false, reason } } and no error
test("POST /v1/probes/agent — testAgent's answer for the offered agent, invalid-request for one not offered", async () => {
  const machine = computer({ claude: { loggedIn: true }, codex: {} });
  await onComputer(machine, async () => {
    const handlers = jobHandlers({ agents: offered(machine, "claude") });
    const probe = (agent) => call(handlers, "POST /v1/probes/agent", { params: { kind: "agent" }, body: { args: agent === undefined ? {} : { agent } } });

    assert.deepEqual(await probe("claude"), { answer: { answered: true, version: "2.1.300" } });
    assert.ok(machine.calls().some((line) => /claude -p/.test(line)), "known positive: the offered agent is asked");
    const before = machine.calls().length;
    for (const agent of ["codex", "nobody", undefined, 7]) {
      const error = await rejection(probe(agent));
      assert.equal(error.code, "invalid-request", String(agent));
    }
    assert.equal(machine.calls().length, before, "a refused probe started nothing");
    assert.equal(machine.calls().some((line) => /codex/.test(line) && !/--version|login status/.test(line)), false, "codex was never asked");
  });

  const failing = computer({ claude: { loggedIn: true, answers: false } });
  await onComputer(failing, async () => {
    const handlers = jobHandlers({ agents: offered(failing, "claude") });
    const { answer } = await call(handlers, "POST /v1/probes/agent", { params: { kind: "agent" }, body: { args: { agent: "claude" } } });
    assert.equal(answer.answered, false);
    assert.equal(typeof answer.reason, "string");
  });
});

// ---------------------------------------------------------------- POST /v1/ask, GET /v1/ask/{ask}

// TST-472080 · level: unit · module: MOD-bridge-jobs
// guards: UC-011; A LOCAL AGENT USES THE PERSON'S OWN LOGIN
// given: a computer with opencode, which waits for a gate and then answers with the folder it runs in and reports 11 input and 7 output tokens; opencode offered with its working folder
// input: POST /v1/ask with { agent: "opencode", input: <a prompt> }; GET /v1/ask/{ask} before the gate opens and after it
// expect: the answer to the post is { ask } with a text; the first read { state: "running", text: null, calls: [], usage: null, error: null }; after the gate { state: "done", text: <the agent's answer, naming its working folder>, calls: [], usage: { inputTokens: 11, outputTokens: 7, minutes: null, cost: null }, error: null }, and the same on a second read; a second ask has another identifier and leaves the first as it was
test("POST /v1/ask and GET /v1/ask/{ask} — an ask running, then done with its text and usage, in the agent's working folder", async () => {
  const machine = computer({ opencode: { gated: true } });
  await onComputer(machine, async () => {
    const handlers = jobHandlers({ agents: offered(machine, "opencode") });
    const posted = await call(handlers, "POST /v1/ask", { body: { agent: "opencode", input: "Draft the thing." } });
    assert.equal(typeof posted.ask, "string");
    assert.deepEqual(Object.keys(posted), ["ask"]);
    const read = () => call(handlers, "GET /v1/ask/{ask}", { params: { ask: posted.ask } });

    await until(() => machine.calls().some((line) => /opencode run/.test(line)), "the agent to be started");
    const running = await read();
    machine.release();
    assert.deepEqual(running, { state: "running", text: null, calls: [], usage: null, error: null });
    const done = await until(async () => { const now = await read(); return now.state === "done" ? now : null; }, "the ask to be done");

    assert.deepEqual(done, { state: "done", text: `drafted in ${machine.folders.opencode}`, calls: [], usage: { inputTokens: 11, outputTokens: 7, minutes: null, cost: null }, error: null });
    assert.deepEqual(await read(), done, "a second read gives the same answer");
    const second = await call(handlers, "POST /v1/ask", { body: { agent: "opencode", input: "Draft again." } });
    assert.notEqual(second.ask, posted.ask, "each ask has an identifier of its own");
    assert.deepEqual(await read(), done, "the first ask is still answered as it was");
    await until(async () => (await call(handlers, "GET /v1/ask/{ask}", { params: { ask: second.ask } })).state === "done", "the second ask to be done");
    assert.ok(machine.calls().some((line) => line.includes("Draft the thing.")), "the agent was given the prompt");
  });
});

// TST-472081 · level: unit · module: MOD-bridge-jobs
// guards: UC-011
// given: a computer with an opencode that fails — it writes "boom" to its error output and exits with 3
// input: POST /v1/ask, then GET /v1/ask/{ask} until it is not running
// expect: { state: "failed", text: null, usage: null, error } with an error that names the failure and the agent's last output, "boom"
test("GET /v1/ask/{ask} — a failed ask with its error", async () => {
  const machine = computer({ opencode: { fails: true } });
  await onComputer(machine, async () => {
    const handlers = jobHandlers({ agents: offered(machine, "opencode") });
    const { ask } = await call(handlers, "POST /v1/ask", { body: { agent: "opencode", input: "Draft." } });
    const failed = await until(async () => { const now = await call(handlers, "GET /v1/ask/{ask}", { params: { ask } }); return now.state === "running" ? null : now; }, "the ask to end");

    assert.equal(failed.state, "failed");
    assert.equal(failed.text, null);
    assert.equal(failed.usage, null);
    assert.match(failed.error, /the agent process failed/);
    assert.match(failed.error, /boom/);
  });
});

// TST-1237001 · level: unit · module: MOD-bridge-jobs
// guards: UC-049; UC-011
// given: a computer with an opencode that waits for a gate, then answers and reports 11 input and 7 output tokens; and a computer with an opencode that fails with "boom"
// input: POST /v1/ask with { agent: "opencode", input } on each; GET /v1/ask/{ask} while the first runs, after it is done, and after the second has failed
// expect: every read holds the field calls, and it is [] — running, done and failed alike, since an agent's ask is no exchange of a tool loop; the done read holds the agent's text beside it
test("GET /v1/ask/{ask} — an agent's answer holds calls: [] while running, when done and when failed", async () => {
  const machine = computer({ opencode: { gated: true } });
  await onComputer(machine, async () => {
    const handlers = jobHandlers({ agents: offered(machine, "opencode") });
    const { ask } = await call(handlers, "POST /v1/ask", { body: { agent: "opencode", input: "Say Blue." } });
    const read = () => call(handlers, "GET /v1/ask/{ask}", { params: { ask } });
    await until(() => machine.calls().some((line) => /opencode run/.test(line)), "the agent to be started");
    const running = await read();
    machine.release();
    const done = await until(async () => { const now = await read(); return now.state === "done" ? now : null; }, "the ask to be done");
    assert.equal(running.state, "running");
    assert.deepEqual(running.calls, []);
    assert.equal(done.text, `drafted in ${machine.folders.opencode}`, "known positive: the agent answered");
    assert.deepEqual(done.calls, []);
  });
  const failing = computer({ opencode: { fails: true } });
  await onComputer(failing, async () => {
    const handlers = jobHandlers({ agents: offered(failing, "opencode") });
    const { ask } = await call(handlers, "POST /v1/ask", { body: { agent: "opencode", input: "Say Blue." } });
    const failed = await until(async () => { const now = await call(handlers, "GET /v1/ask/{ask}", { params: { ask } }); return now.state === "running" ? null : now; }, "the ask to end");
    assert.equal(failed.state, "failed");
    assert.deepEqual(failed.calls, []);
  });
});

// TST-472082 · level: unit · module: MOD-bridge-jobs
// guards: THE BRIDGE FINDS THE INSTALLED AGENTS; UC-011
// given: a computer with opencode and codex, opencode offered with a folder, codex installed and not offered, claude named without a folder
// input: POST /v1/ask for codex, for an agent nobody names, for claude, with an input that is no text; and GET /v1/ask/{ask} for an ask nobody made; and, to show an ask started, one for opencode
// expect: invalid-request for the first four, with no agent started by them; not-found for the unknown ask; the ask for opencode answered
test("POST /v1/ask — an agent not offered, one without a working folder and an input that is no text are invalid-request", async () => {
  const machine = computer({ claude: { loggedIn: true }, codex: {}, opencode: {} });
  await onComputer(machine, async () => {
    const handlers = jobHandlers({ agents: [{ name: "opencode", folder: machine.folders.opencode }, { name: "claude", folder: "" }] });
    const ask = (body) => call(handlers, "POST /v1/ask", { body });

    const first = await ask({ agent: "opencode", input: "Draft." });
    assert.equal(typeof first.ask, "string", "known positive");
    await until(() => machine.calls().some((line) => /opencode run/.test(line)), "the first ask to start");
    await until(async () => (await call(handlers, "GET /v1/ask/{ask}", { params: { ask: first.ask } })).state === "done", "the first ask to be done");
    const before = machine.calls().length;
    for (const body of [{ agent: "codex", input: "Draft." }, { agent: "nobody", input: "Draft." }, { agent: "claude", input: "Draft." },
      { agent: "opencode", input: { prompt: "Draft." } }, { agent: "opencode" }]) {
      assert.equal((await rejection(ask(body))).code, "invalid-request", JSON.stringify(body));
    }
    assert.equal(machine.calls().length, before, "no agent was started by a refused ask");
    assert.equal((await rejection(call(handlers, "GET /v1/ask/{ask}", { params: { ask: "nobody-asked" } }))).code, "not-found");
  });
});

// TST-472083 · level: unit · module: MOD-bridge-jobs
// guards: NO SECRET IN THE REPOSITORY; UC-011
// given: a computer with an opencode; the file functions that write, append, create or open a file for writing watched; an ask whose prompt holds a marker
// input: POST /v1/ask and GET /v1/ask/{ask} until it is done
// expect: the ask done; no file function called by the handler; the working folder as empty as it was, and no file of the computer's folder holds the marker, apart from the agent's own call log
test("POST /v1/ask — nothing of an ask is kept on disk", async (t) => {
  const machine = computer({ opencode: {} });
  const written = [];
  for (const [owner, names] of [[fs, ["writeFile", "writeFileSync", "appendFile", "appendFileSync", "mkdir", "mkdirSync", "createWriteStream", "open", "openSync"]],
    [fs.promises, ["writeFile", "appendFile", "mkdir", "open"]]]) {
    for (const name of names) mock.method(owner, name, (...args) => { written.push(`${name} ${String(args[0])}`); });
  }
  t.after(() => mock.restoreAll());
  await onComputer(machine, async () => {
    const handlers = jobHandlers({ agents: offered(machine, "opencode") });
    const { ask } = await call(handlers, "POST /v1/ask", { body: { agent: "opencode", input: "Draft with marker-326-prompt." } });
    await until(async () => (await call(handlers, "GET /v1/ask/{ask}", { params: { ask } })).state === "done", "the ask to be done");
    const mine = written.filter((line) => !line.includes(machine.root));
    mock.restoreAll();

    assert.deepEqual(mine, [], "the handler called no function that writes a file");
    assert.deepEqual(readdirSync(machine.folders.opencode), [], "the working folder holds nothing");
    for (const name of readdirSync(machine.root, { recursive: true })) {
      const path = join(machine.root, name);
      if (name === CALLS || name.startsWith("bin") || !fs.statSync(path).isFile()) continue;
      assert.ok(!readFileSync(path, "utf8").includes("marker-326-prompt"), `${name} holds the prompt`);
    }
  });
});
