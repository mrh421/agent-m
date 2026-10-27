// The world of the system and release tests of UC-049 "Talk to an agent in the prompt bar" (tests/system-uc-049-talk-to-an-agent-in-the-prompt-bar.test.mjs, tests/release-uc-049-talk-to-an-agent-in-the-prompt-bar.test.mjs) — a helper, no test of
// its own, and it holds no expected result. The page is MOD-site-frame's real `startPage` on the review page with the prompt bar, as tests/uc-019-prompt-bar-harness.mjs opens it (the product akmaier/lending-tool and the instance
// akmaier/agent-m served in memory, the global `fetch` answering only the fixtures); this file adds what UC-049 needs beyond that harness:
//   - a register of the participants a test names (`registerOf`) and the rows it uses (a model endpoint, a model endpoint that can use tools, a CLI agent on the Bridge, a subagent, a CI agent);
//   - `watch(s)`: a layer over the page's `fetch` that keeps every request with its headers and body, answers the model endpoint from a script of replies (a text answer, or the tool calls of a model that can use
//     tools), can hold an answer back until the test lets it go (a message that is still running), and answers a handed-over job's workflow dispatch and runs;
//   - the person's actions the bar offers that the harness has not: Stop, Hand over, the conversation's text.
//
// Module: MOD-prompt-bar; MOD-site-frame
// Level: system

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { click, until } from "./review-pages-draft-world.mjs";
import { barOf, all, one, readOriginal, rest, trustedClick } from "./uc-019-prompt-bar-harness.mjs";
import { registerStrategies } from "../src/job-runner/index.mjs";
import { handOverStrategies } from "../src/prompt-bar/index.mjs";

const PARTICIPANTS = readOriginal("docs/participants.md").split("\n");
const HEADER = PARTICIPANTS.slice(0, PARTICIPANTS.findIndex((line) => line.startsWith("|---")) + 1).join("\n");

/** The register of the instance with the rows given. */
export const registerOf = (...rows) => `${HEADER}\n${rows.join("\n")}\n`;
const ROW = (name, type, capabilities, place, route, context = 200000) => `| ${name} | ${type} | ${name}-model | ${context} | - | ${capabilities} | ${place} | ${route} |`;
export const DRAFTER = ROW("drafter", "model endpoint", "draft text", "this machine", "endpoint fixture");
export const TOOLER = ROW("tooler", "model endpoint", "draft text, read the repository, use tools", "Anthropic, USA", "endpoint fixture");
export const AGENT = ROW("agent-cli", "CLI agent", "draft text, read the repository, write to the repository, run code and tests, use tools", "this machine", "bridge release-bridge agent claude");
export const SUBAGENT = ROW("sub-cli", "CLI agent", "draft text", "this machine", "through agent-cli");
export const CI_AGENT = ROW("ci-agent", "CI agent", "draft text, read the repository, write to the repository, run code and tests", "GitHub Actions in the USA", "ci hosted secret CI_KEY");

export const RUN_URL = "https://github.com/akmaier/lending-tool/actions/runs/7";
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const completion = (message) => json({ choices: [{ message }], usage: { prompt_tokens: 10, completion_tokens: 5 } });

/** A reply of a model that can use tools: the calls it makes, `{ id, name, args }` each. */
export const calls = (...made) => ({ calls: made });
/** A reply of the model: the answer it gives, as the kind `converse` reads it. */
export const answer = (text, extra = {}) => ({ envelope: { draft: { answer: text, ...extra }, answers: [] } });

/**
 * watch(s, { script, hold }) -> { requests, endpoint, bridge, github, release } — wraps the page's fetch. Every request is kept with its method, address, headers and body. The model endpoint's
 * requests are answered from `script` (replies in turn: `answer(...)` or `calls(...)`; the last is repeated), after `hold` (a promise, or none) has been awaited, unless the request is aborted; the
 * Bridge's /v1/ask is answered with the next reply as the Bridge would, the rest passes to the page's fixtures.
 */
export function watch(s, { script = [answer("Understood.")], hold = null } = {}) {
  const below = globalThis.fetch;
  const kept = { requests: [], held: [], asks: [], dispatches: [], cancels: [], runs: [] };
  let at = 0;
  const reply = () => script[Math.min(at++, script.length - 1)];
  const asEnvelope = (value) => JSON.stringify(value.envelope ?? { draft: { answer: "Understood." }, answers: [] });
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === "object" && !(input instanceof URL) ? input.url : String(input));
    const request = { method: String(init.method ?? "GET").toUpperCase(), url: url.href, origin: url.origin, path: url.pathname, headers: init.headers ?? {}, body: init.body ?? null };
    kept.requests.push(request);
    if (url.origin === "https://fixture-endpoint.example.test") {
      if (hold) {
        kept.held.push(request);
        await new Promise((resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
          hold.then(resolve);
        });
      }
      const value = reply();
      if (value.calls) {
        return completion({ content: null, tool_calls: value.calls.map(({ id, name, args }) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } })) });
      }
      return completion({ content: asEnvelope(value) });
    }
    if (url.origin === "http://127.0.0.1:9418" && request.method === "POST" && url.pathname === "/v1/ask") {
      kept.asks.push(JSON.parse(init.body));
      return json({ ask: "fixture-ask" });
    }
    if (url.origin === "http://127.0.0.1:9418" && url.pathname === "/v1/ask/fixture-ask") {
      return json({ state: "done", text: asEnvelope(reply()), calls: [], usage: { inputTokens: 10, outputTokens: 5 }, error: null });
    }
    // The product's pull requests and its job workflow: the fixture host serves neither; here the workflow is started (200 with its run), lists its runs and cancels one.
    const product = /^\/repos\/[^/]+\/lending-tool(\/.*)?$/.exec(url.pathname)?.[1] ?? null;
    if (product !== null && request.method === "GET" && product === "/pulls") return json([]);
    // A release: the tag v1.0.0 names the commit the default branch stands at.
    if (product === "/tags" && request.method === "GET") return json([{ name: "v1.0.0", commit: { sha: "c0ffee0000000000000000000000000000000000" } }]);
    if (product === "/commits/v1.0.0" && request.method === "GET") return below(String(input).replace("/commits/v1.0.0", "/commits/main"), init);
    if (product !== null && request.method === "POST" && /^\/actions\/workflows\/[^/]+\/dispatches$/.test(product)) {
      kept.dispatches.push({ workflow: decodeURIComponent(product.split("/")[3]), ...JSON.parse(init.body) });
      return json({ workflow_run_id: 7, run_url: "https://api.github.com/repos/akmaier/lending-tool/actions/runs/7", html_url: RUN_URL });
    }
    if (product !== null && request.method === "GET" && /^\/actions\/(workflows\/[^/]+\/)?runs$/.test(product)) {
      return json({ workflow_runs: kept.runs.map((run) => ({ id: Number(run.id), path: `.github/workflows/${run.workflow}`, head_sha: run.commit, event: run.event, status: run.status, conclusion: run.conclusion, html_url: run.url })) });
    }
    const cancel = product === null ? null : /^\/actions\/runs\/(\d+)\/cancel$/.exec(product);
    if (cancel && request.method === "POST") {
      kept.cancels.push(cancel[1]);
      for (const run of kept.runs) if (run.id === cancel[1]) { run.status = "completed"; run.conclusion = "cancelled"; }
      return json({}, 202);
    }
    return below(input, init);
  };
  return Object.assign(kept, {
    endpoint: () => kept.requests.filter((request) => request.origin === "https://fixture-endpoint.example.test"),
    bridge: () => kept.requests.filter((request) => request.origin === "http://127.0.0.1:9418"),
    github: () => kept.requests.filter((request) => request.origin === "https://api.github.com" || request.origin === "https://raw.githubusercontent.com"),
    bodies: () => kept.requests.filter((request) => request.origin === "https://fixture-endpoint.example.test").map((request) => JSON.parse(request.body)),
    stop: () => { globalThis.fetch = below; },
  });
}

// ---------------------------------------------------------------- what a person does in the bar, and what the bar shows

export const instructionOf = (s) => one(barOf(s), "textarea", "instruction");
/** The person writes `text` and presses Send without waiting for the answer. */
export async function sendNow(s, text, { participant = null } = {}) {
  const bar = barOf(s);
  if (participant !== null) {
    const selector = all(bar, "select", "participant")[0];
    if (selector) selector.value = participant;
  }
  instructionOf(s).value = text;
  one(bar, "button", "send").dispatchEvent(trustedClick());
  await rest(s);
}
/** Resolves once the bar's Send can be pressed again. */
export const free = (s) => until(() => one(barOf(s), "button", "send").disabled === false, "the message has run");
export const conversationOf = (s) => all(barOf(s), "li").filter((node) => node.parentNode?.className === "conversation").map((node) => node.textContent);
export const barText = (s) => barOf(s).textContent.replace(/\s+/g, " ");
export const textOfSent = (request) => JSON.parse(request.body).messages.map((message) => message.content).join("\n");
export const rulesOf = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
export { assert };

// ---------------------------------------------------------------- the job workflow over fixture checkouts, and the clock of the following

export const HANDY = "| handy | model endpoint | handy-model | 200000 | - | draft text, read the repository, write to the repository, run code and tests | GitHub Actions in the USA | endpoint fixture secret CI_KEY |";

/**
 * The 15-second timers of the bar's following are held back and run by the test: `clock.tick()` runs those set so far. Other timers pass.
 * -> { tick, stop }.
 */
export function followClock() {
  const real = globalThis.setTimeout;
  const held = [];
  globalThis.setTimeout = (run, ms, ...rest) => (ms >= 15000 ? (held.push(run), held.length) : real(run, ms, ...rest));
  return {
    held: () => held.length,
    async tick() { const due = held.splice(0); for (const run of due) await run(); },
    stop() { globalThis.setTimeout = real; },
  };
}

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const git = (cwd, ...args) => {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null", GIT_TERMINAL_PROMPT: "0" } });
  assert.equal(result.status, 0, result.stderr);
  return args[0] === "show" ? result.stdout : result.stdout.trim();
};
function checkout(root, name, files) {
  const origin = join(root, `${name}.git`), clone = join(root, "ws", name);
  git(root, "init", "-q", "--bare", "-b", "main", origin);
  git(root, "clone", "-q", origin, clone);
  git(clone, "config", "user.name", "UC-049 fixture");
  git(clone, "config", "user.email", "fixture@example.org");
  for (const [path, text] of Object.entries(files)) { mkdirSync(join(clone, path, ".."), { recursive: true }); writeFileSync(join(clone, path), text); }
  git(clone, "add", "-A");
  git(clone, "commit", "-q", "-m", "Fixture baseline");
  git(clone, "push", "-q", "origin", "HEAD:refs/heads/main");
  return { origin, checkout: clone, commit: git(clone, "rev-parse", "HEAD") };
}

/**
 * withWorkflow(s, { answers, token, key }, verify) — the real job workflow entry (`onRecordsChanged` of MOD-workflow-entries) run in a fresh process on fixture checkouts of the instance and of the
 * product as the page left it (the record the bar queued included), with the model endpoint answering `answers` in turn and every other request refused. `verify({ status, requests, git, product,
 * instance, agentM })` reads the result; `git(product.origin, "show", "main:<path>")` reads what the run committed.
 */
export async function withWorkflow(s, { answers, inputs = null, token = "github_pat_fixture-person-token", key = "fixture-model-key", runner = "hosted", fail = null, agent = null, files: given = {} }, verify) {
  const root = mkdtempSync(join(tmpdir(), "agent-m-uc049-ci-"));
  try {
    mkdirSync(join(root, "ws"));
    const instance = checkout(root, "instance", s.instance.files);
    // The fixture host's commits are made-up names; the job's record names the commit of the instance's checkout the run must stand on, which here is a real one.
    const files = Object.fromEntries(Object.entries({ ...s.product.files, ...given }).map(([path, text]) => [path, path.startsWith("docs/jobs/") ? text.replaceAll("c0ffee0000000000000000000000000000000000", instance.commit) : text]));
    const product = checkout(root, "product", files);
    const agentM = { version: "2026.10.0", commit: instance.commit };
    // A hand-over to a model endpoint runs through Agent M's own job runner calling the endpoint (MOD-workflow-entries, onDispatch), whatever its kind; the endpoint answers `agent.answer`
    // (the draft) where no `answers` are given. No coding agent is on the runner's PATH.
    const bin = join(root, "bin");
    mkdirSync(bin);
    const eventPath = join(root, "event.json");
    if (inputs) writeFileSync(eventPath, JSON.stringify({ inputs }));
    const environment = { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: inputs ? "workflow_dispatch" : "push", ...(inputs ? { GITHUB_EVENT_PATH: eventPath } : {}), GITHUB_WORKSPACE: join(root, "ws"), GITHUB_SERVER_URL: "https://github.com", GITHUB_REPOSITORY: s.repo,
      GITHUB_REF_NAME: "main", GITHUB_SHA: product.commit, GITHUB_RUN_ID: "7", GITHUB_ACTOR: "akmaier", AGENT_M_RUNNER: runner, AGENT_M_PRODUCT_DIR: product.checkout,
      AGENT_M_TOKEN_NAME: "AGENT_M_TOKEN", AGENT_M_KEY_NAMES: "CI_KEY", AGENT_M_TOKEN: token, CI_KEY: key };
    // A wait of a second or more — the retries of a failed endpoint request (MOD-endpoint-calls: 2 s doubled, at most 30 s) — is collapsed to none, so
    // that the run's five retries finish within the child's timeout; the number of requests, not the time between them, is what a test reads.
    const script = `import {runEntry} from ${JSON.stringify(new URL("../src/workflow-entries/main.mjs", import.meta.url).href)};
      const realSetTimeout=globalThis.setTimeout; globalThis.setTimeout=(callback,ms,...rest)=>realSetTimeout(callback,ms>=1000?0:ms,...rest);
      const answers=${JSON.stringify(answers.length === 0 && agent?.answer ? [agent.answer] : answers)},requests=[]; globalThis.fetch=async(url,init={})=>{if(!String(url).startsWith("https://fixture-endpoint.example.test/"))throw Error("uncontrolled request: "+url);requests.push({headers:init.headers,body:JSON.parse(init.body)});if(${JSON.stringify(fail)})throw new TypeError(${JSON.stringify(fail)});return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({draft:answers[Math.min(requests.length-1,answers.length-1)],answers:[]})}}]}),{status:200})};
      const status=await runEntry(${JSON.stringify(inputs ? "onDispatch" : "onRecordsChanged")},${JSON.stringify(environment)},{now:new Date("2026-10-19T12:01:00Z")});console.log(JSON.stringify({status,requests}));`;
    const env = { ...process.env, PATH: `${bin}:${process.env.PATH}` };
    delete env.NODE_TEST_CONTEXT;
    const invoked = spawnSync(process.execPath, ["--input-type=module", "-e", script], { cwd: ROOT, env, encoding: "utf8", timeout: 20000 });
    assert.equal(invoked.status, 0, invoked.stderr);
    // What the run prints before its status line is its log: the answer a hand-over leaves.
    const lines = invoked.stdout.trim().split("\n");
    const { status, requests } = JSON.parse(lines.at(-1));
    await verify({ status, requests, log: lines.slice(0, -1).join("\n"), git, product, instance, agentM });
  } finally { rmSync(root, { recursive: true, force: true }); }
}

/** The composition root of the entry pages (src/site-frame/start.mjs): the strategies of each view and the prompt bar's hand-over sets are registered once. */
export function registerLikeStart(views, owner = "tests/uc-049-world.mjs") {
  const handled = new Set();
  const once = (name, strategies) => {
    if (handled.has(strategies)) return;
    try { registerStrategies(name, strategies); } catch (error) { if (error.name !== "DuplicateStrategy") throw error; }
    handled.add(strategies);
  };
  for (const view of views) for (const strategies of view.strategies ?? []) once(`${owner}#${view.routes?.[0]?.name ?? "view"}`, strategies);
  for (const strategies of handOverStrategies) once(`${owner}#hand-over`, strategies);
}
