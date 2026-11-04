// A hand-over that a job nobody attends proposes is run in the same run, by its kind's definition (UC-049 4f, as accepted: "a hand-over of a kind other than the conversation itself runs
// in the same run, by that kind's definition, and its writer writes as 4a.5 says" — 4a.5: "a change of code as a pull request"). As docs/architecture/MOD-workflow-entries.md states it
// (onRecordsChanged): the job of the kind it names is "prepared with that kind's preconditions and no start rule of the product's process, and run unattended, so that its writer writes at
// once — … a change of code as a pull request, which it does not merge … A model endpoint's job of a kind that changes code or runs tests works in the job's checkout of the product as
// `onDispatch` states — the tools of MOD-checkout-tools, the same endpoint with `checkoutPrompt` for that checkout as its system prompt …"; and MOD-approvals' `rests-on-accepted`, which
// names every requirement or use case "each step of the plan or item of the backlog of the parameters `steps` and `items` names under `realises`" that is not accepted (NOTHING IS
// IMPLEMENTED BEFORE IT IS ACCEPTED).
// Run: node --test tests/workflow-entries-hand-over-in-run.test.mjs
//
// Module: MOD-workflow-entries · MOD-approvals
// Guards: UC-049; NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED; CODE ENTERS THE DEFAULT BRANCH THROUGH A PULL REQUEST WITH GREEN CI; A CI AGENT'S DRAFT ENTERS AS OPEN; A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET
// Level: component
//
// Deterministic, no network, no real model: the product and the instance are temporary git repositories laid out as the job workflow lays them out on the agent's machine (AGENT_M_PART agent,
// its result's folder, the one key FIXTURE_KEY, no token), as tests/workflow-entries-endpoint-harness.test.mjs lays them out. The job is the endpoint's own `converse` job that the prompt bar
// spawned (its record `declares` draft text and read the repository; its task travels with the hand-over), dispatched with its task. The product holds the use case UC-001, accepted, and
// UC-002, open; the architecture ARC-001 with the module MOD-reader; and the backlog items ITM-001, which realises UC-001, and ITM-002, which realises UC-002 — no process declaration, no
// sprint, no role assignment: no start rule of the process could let either start. The model endpoint is a fake `fetch` that answers as an OpenAI-compatible endpoint does: the
// conversation with a hand-over, and the prompt of `implement` from a script of tool calls, and records every request. Readings the texts leave open, which this file takes and the
// report names:
//   - On the agent's machine the pull request is kept for the writing machine, which opens it; the job's end names it by its pending address `pending-pull-request:<branch>` (result.mjs).
//   - The participant the record declares is built for the kind handed on: `implement`'s tools make it one that may write to the repository and run code and tests.
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the report of the change.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startRecord } from "../src/job-ledger/index.mjs";

process.env.GIT_CONFIG_GLOBAL = "/dev/null";
process.env.GIT_CONFIG_SYSTEM = "/dev/null";
process.env.GIT_TERMINAL_PROMPT = "0";

const { runEntry } = await import("../src/workflow-entries/main.mjs");
const REAL_GIT = spawnSync("sh", ["-c", "command -v git"], { encoding: "utf8" }).stdout.trim();

// ---------------------------------------------------------------- the fixtures

const text = (...lines) => `${lines.join("\n")}\n`;
const sha256 = (body) => createHash("sha256").update(body).digest("hex");
const blobOf = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");
const NOW = new Date("2026-10-28T09:00:00Z");
const KEY = "sk-INRUN-KEY-0123456789abcdef";
const TASK = "Talk about the due date, token kestrel-2026";
const ENDPOINT = { kind: "openai-compatible", baseUrl: "https://llm.example.test/v1", model: "fixture-llm" };
const JOB = "JOB-20261028-0800-c4d5";
const PLACE = "GitHub's hosted runners";
const SEVEN = ["read", "write", "edit", "bash", "grep", "glob", "webfetch"];
const AGENTS_MD = "# Agent M rules, fixture in-run-2026\n";
const BRANCH = "agent-m/ITM-001";

const RULE = "A LOAN HAS A DUE DATE";
const SPEC = text("# Thesis tool — Specification", "", "## Lending", "", `**${RULE}** *(SRC-fixture-po)*`, "Every loan states the date by which the book is returned.",
  "*Check:* `tests/loan.test.mjs`");
const useCase = (id, title) => text("---", `id: ${id}`, `title: ${title}`, "area: lending", "actors:", "  - Member", "realises:", `  - ${RULE}`, "---", `# ${id} ${title}`, "",
  "**Goal.** The member borrows a book.");
const UC1 = useCase("UC-001", "Check out a book"), UC2 = useCase("UC-002", "Renew a book");
const DIAGRAM = ["", "```mermaid", "flowchart LR", "    Desk --> Shelf", "```", ""];
const ARC = text("---", "id: ARC-001", "title: Lending is a desk", "forced_by:", `  - ${RULE}`, "---", "# ARC-001 Lending is a desk", "", "## Context", "", "Books are lent at a desk.", "",
  "## Decision", "", "The desk is one module.", ...DIAGRAM, "## Alternatives", "", "None.", "", "## Consequences", "", "One folder.");
const MOD = text("---", "id: MOD-reader", "title: Reading a book", "folder: src/reader/", "realises:", `  - ${RULE}`, "follows:", "  - ARC-001", "uses:", "provides:", "  - lend", "---",
  "# MOD-reader Reading a book", "", "## Responsibility", "", "It lends a book.", ...DIAGRAM, "## Parts", "", "- `index.mjs`", "", "## Data", "", "Nothing.", "", "## Interfaces", "", "- `lend`", "",
  "## Files", "", "None.", "", "## Uses", "", "Nothing.");
const item = (id, realises) => text("---", `id: ${id}`, `title: ${id} the due date`, "realises:", `  - ${realises}`, "modules:", "  - MOD-reader", "origin:", "  - the fixture", "---",
  `# ${id} ${id} the due date`, "", "## Outcome", "", "The member is told the date.", "", "## Acceptance", "", "The date is shown.");
const record = (id, body) => [`docs/approvals/${id}-${blobOf(body).slice(0, 12)}.md`, text("---", `id: ${id}`, "kind: approval", "---", `# Approval of ${id}`)];
// UC-001, ARC-001 and MOD-reader are accepted: a record names each one's text. UC-002 is open: none names it.
const PRODUCT = Object.fromEntries([
  ["README.md", "# Thesis tool\n"], ["SPEC.md", SPEC], ["docs/use-cases/UC-001-check-out-a-book.md", UC1], ["docs/use-cases/UC-002-renew-a-book.md", UC2],
  ["docs/architecture/ARC-001-lending-is-a-desk.md", ARC], ["docs/architecture/MOD-reader.md", MOD], ["src/reader/index.mjs", "export const lend = () => null;\n"],
  ["docs/backlog/ITM-001-due-date.md", item("ITM-001", "UC-001")], ["docs/backlog/ITM-002-renewal.md", item("ITM-002", "UC-002")],
  record("UC-001", UC1), record("ARC-001", ARC), record("MOD-reader", MOD)]);

// The book's chapters 8 to 13, which the recipe chapters-for-implementation reads from the instance's register (9, 11, 12 and 13).
const CHAPTERS = [8, 9, 10, 11, 12, 13].map((n) => [`${String(n).padStart(2, "0")}_chapter-${n}.md`, `Chapter ${n} of the fixture book.\n`]);
const BOOK = text("---", "id: SRC-vibe-coding", "title: Vibe Coding", "kind: document", "authority: normative", "licence: may be republished — fixture", "---",
  "# SRC-vibe-coding Vibe Coding", "", "## Versions", "", "| Version | Date | Edition | Read from | Files |", "|---|---|---|---|---|",
  `| \`2026-10-05\` | 2026-10-05 | — | the fixture | ${CHAPTERS.length} files, listed below; version hash \`${sha256(CHAPTERS.map(([name, body]) => `${sha256(body)}  ${name}\n`).join(""))}\` |`,
  "", "### Files of 2026-10-05", "", "| File | SHA-256 |", "|---|---|", ...CHAPTERS.map(([name, body]) => `| \`${name}\` | \`${sha256(body)}\` |`));
const PARTICIPANTS = text("# Participants of this instance", "", "| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |", "|---|---|---|---|---|---|---|---|",
  "| alice | person | — | — | — | read the repository, write to the repository | — | account github.com/alice |");

function git(cwd, ...args) {
  const r = spawnSync(REAL_GIT, args, { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed in ${cwd}: ${r.stderr}`);
  return r.stdout.trim();
}
function write(root, files) {
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), body);
  }
}
const NO_MAINTENANCE = ["-c", "gc.auto=0", "-c", "maintenance.auto=false", "-c", "receive.autogc=false"];
const quiet = (dir) => { for (const [key, value] of [["gc.auto", "0"], ["maintenance.auto", "false"], ["receive.autogc", "false"]]) git(dir, "config", key, value); };
// A bare origin whose `main` holds `files`, and the clone of it the workflow checks out into `folder`.
function repository(root, name, files, folder) {
  const origin = join(root, `${name}.git`), seed = join(root, `${name}-seed`);
  git(root, "init", "-q", "--bare", "-b", "main", origin);
  quiet(origin);
  git(root, "clone", "-q", ...NO_MAINTENANCE, origin, seed);
  quiet(seed);
  git(seed, "config", "user.name", "Seed");
  git(seed, "config", "user.email", "seed@example.org");
  write(seed, files);
  git(seed, "add", "-A");
  git(seed, "commit", "-q", "-m", "first");
  git(seed, "push", "-q", "origin", "HEAD:refs/heads/main");
  mkdirSync(join(folder, ".."), { recursive: true });
  git(root, "clone", "-q", ...NO_MAINTENANCE, origin, folder);
  quiet(folder);
  git(folder, "config", "user.name", "Alice");
  git(folder, "config", "user.email", "alice@example.org");
  return origin;
}

// The answers of the fake endpoint: a tool call, or the final draft.
const call = (id, name, args) => ({ choices: [{ finish_reason: "tool_calls", message: { content: null, tool_calls: [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }] } }] });
const final = (draft) => ({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ draft, answers: [] }) } }], usage: { prompt_tokens: 10, completion_tokens: 5 } });
// The prompt of `implement` (src/job-catalogue/kinds/implement/prompt.md), by which the fake endpoint tells its requests from the conversation's.
const IMPLEMENT = "You implement one step of a product's plan, or one backlog item";

// The implementation in the checkout: a file written, a branch of its own committed and pushed, the draft reporting it.
const IMPLEMENTS = [
  call("i1", "write", { path: "src/reader/due.mjs", content: "export const due = (day) => day + 14;\n" }),
  call("i2", "bash", { command: `git checkout -q -b ${BRANCH} && git add -A && git commit -q -m "ITM-001: the due date" && git push -q origin HEAD` }),
  final({ branch: BRANCH, commits: [], pullRequest: "" }),
];

// The agent's machine of a run the prompt bar started for the endpoint's own converse job. `handOver` is what the conversation's answer hands on; `implementing` the answers to the prompt of
// implement, in turn, the last repeated.
async function world({ handOver, implementing = IMPLEMENTS }, run) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "agent-m-in-run-")));
  const workspace = join(root, "ws"), instanceDir = join(workspace, "instance"), productDir = join(workspace, "product");
  repository(root, "instance", { "README.md": "# Instance\n", "AGENTS.md": AGENTS_MD, "docs/participants.md": PARTICIPANTS, "docs/sources/SRC-vibe-coding.md": BOOK,
    ...Object.fromEntries(CHAPTERS.map(([name, body]) => [`docs/sources/SRC-vibe-coding/2026-10-05/${name}`, body])) }, instanceDir);
  const agentM = { version: "2026.10.0", commit: git(instanceDir, "rev-parse", "HEAD") };
  const { path, text: start } = startRecord({ id: JOB, declares: { context: 100000, capabilities: ["draft text", "read the repository"] }, kind: "converse",
    worksOn: ["https://github.com/alice/thesis-tool"], participant: "fixture-endpoint", model: "fixture-llm", route: "ci hosted", run: null, retries: null, startedBy: "alice",
    start: new Date("2026-10-28T08:00:00Z"), agentM, inputs: [], limit: 1, task: "with the hand-over", destinations: [{ participant: "fixture-endpoint", place: PLACE, parts: ["instruction"] }],
    params: {} });
  const origin = repository(root, "product", { ...PRODUCT, [path]: start }, productDir);
  const base = git(origin, "rev-parse", "main");
  const requests = [];
  const saved = { FIXTURE_KEY: process.env.FIXTURE_KEY, NODE_TEST_CONTEXT: process.env.NODE_TEST_CONTEXT, fetch: globalThis.fetch };
  process.env.FIXTURE_KEY = KEY;
  delete process.env.NODE_TEST_CONTEXT;
  let implementAsked = 0;
  globalThis.fetch = async (address, init = {}) => {
    if (!String(address).startsWith(ENDPOINT.baseUrl)) throw new TypeError(`uncontrolled request: ${address}`);
    const body = JSON.parse(String(init.body ?? "{}"));
    requests.push({ address: String(address), headers: init.headers ?? {}, body });
    const answer = JSON.stringify(body).includes(IMPLEMENT) ? implementing[Math.min(implementAsked++, implementing.length - 1)]
      : final({ answer: "I hand this on.", handOver });
    return new Response(JSON.stringify(answer), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const payload = join(root, "event.json");
    writeFileSync(payload, JSON.stringify({ inputs: { job: JOB, task: TASK, endpoint: JSON.stringify(ENDPOINT), secret: "FIXTURE_KEY" } }));
    const status = await runEntry("onDispatch", { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_EVENT_PATH: payload, GITHUB_WORKSPACE: workspace,
      GITHUB_SERVER_URL: "https://github.com", GITHUB_REPOSITORY: "alice/thesis-tool", GITHUB_REF_NAME: "main", GITHUB_SHA: agentM.commit, GITHUB_RUN_ID: "4711",
      GITHUB_ACTOR: "alice", AGENT_M_RUNNER: "hosted", AGENT_M_PRODUCT_DIR: productDir, AGENT_M_TOKEN_NAME: "AGENT_M_TOKEN", AGENT_M_KEY_NAMES: "FIXTURE_KEY",
      AGENT_M_PART: "agent", AGENT_M_KEY: "1", AGENT_M_RESULT_DIR: join(root, "result"), FIXTURE_KEY: KEY }, { now: NOW });
    const deferred = join(root, "result", "deferred.json");
    const kept = existsSync(deferred) ? JSON.parse(readFileSync(deferred, "utf8")) : { pullRequests: [], ends: [] };
    const bare = join(root, "result", "result.git");
    return await run({ status, requests, productDir, origin, base, bare, kept,
      implementRequests: () => requests.filter((each) => JSON.stringify(each.body).includes(IMPLEMENT)),
      results: () => kept.ends.map((end) => end.part.part.results.join("\n")).join("\n"),
      branchOf: (name) => (existsSync(bare) ? spawnSync(REAL_GIT, ["--git-dir", bare, "rev-parse", "--verify", "--quiet", name], { encoding: "utf8" }).stdout.trim() : "") });
  } finally {
    for (const name of ["FIXTURE_KEY", "NODE_TEST_CONTEXT"]) { if (saved[name] === undefined) delete process.env[name]; else process.env[name] = saved[name]; }
    globalThis.fetch = saved.fetch;
    rmSync(root, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------- a change of code handed on in the same run

// TST-2026281001 · level: component · module: MOD-workflow-entries
// guards: UC-049; CODE ENTERS THE DEFAULT BRANCH THROUGH A PULL REQUEST WITH GREEN CI; A CI AGENT'S DRAFT ENTERS AS OPEN; A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET
// given: the agent's machine of a run the bar started for the endpoint's own converse job (it declares draft text and read the repository); the conversation's answer hands on { kind implement (review: none), works_on [ITM-001], task "tell the member the due date" }, ITM-001 realising the accepted UC-001; no process declaration, sprint or role assignment; the endpoint answers implement's prompt by writing src/reader/due.mjs, then committing it on the branch agent-m/ITM-001 and pushing it, then reporting that branch
// input: onDispatch with the inputs job, task, endpoint and secret FIXTURE_KEY
// expect: outcome `done`; implement's prompt is sent (three requests), each to https://llm.example.test/v1/chat/completions with the model fixture-llm and the key FIXTURE_KEY's value as its bearer — the job's own endpoint and key —; the first of them offers exactly the seven tools of the checkout and its system prompt names the product's checkout as the working folder, while the conversation's request offers none; the result's repository holds the branch agent-m/ITM-001 with src/reader/due.mjs, which its main — the job's records only — does not contain, and the product's main is where it was — nothing merged —; one pull request of agent-m/ITM-001 into main is kept for the writing machine; the job's end lists `pending-pull-request:agent-m/ITM-001` and no `not run: implement`.
test("TST-2026281001: a hand-over of implement in a hosted conversation runs in the same run, in the job's checkout, and its writer writes a pull request it does not merge", async () => {
  await world({ handOver: { kind: "implement", works_on: ["ITM-001"], task: "tell the member the due date" } }, async (w) => {
    assert.equal(w.status.outcome, "done", w.status.summary);
    const implementing = w.implementRequests();
    assert.equal(implementing.length, 3, `implement's prompt is sent, once per step of its loop: ${w.results()}`);
    for (const request of w.requests) {
      assert.equal(request.address, "https://llm.example.test/v1/chat/completions");
      assert.equal(request.body.model, "fixture-llm");
      assert.equal(request.headers.Authorization, `Bearer ${KEY}`, "the job's own endpoint and key");
    }
    assert.deepEqual((implementing[0].body.tools ?? []).map((tool) => tool.function.name), SEVEN, "the seven tools of the checkout are offered");
    assert.equal(implementing[0].body.messages[0].role, "system");
    assert.ok(implementing[0].body.messages[0].content.includes(`Working folder: ${w.productDir}`), "checkoutPrompt names the checkout");
    assert.equal((w.requests[0].body.tools ?? []).length, 0, "the conversation itself works in no checkout");
    assert.ok(w.branchOf(`refs/heads/${BRANCH}`), "the result's repository holds the branch");
    assert.equal(git(w.productDir, "show", `${BRANCH}:src/reader/due.mjs`), "export const due = (day) => day + 14;");
    // The result's main holds the job's own records (its taking); the branch is not merged into it.
    const merged = spawnSync(REAL_GIT, ["--git-dir", w.bare, "merge-base", "--is-ancestor", `refs/heads/${BRANCH}`, "refs/heads/main"]).status === 0;
    assert.equal(merged, false, "the branch is not merged into the result's main");
    assert.equal(spawnSync(REAL_GIT, ["--git-dir", w.bare, "cat-file", "-e", "main:src/reader/due.mjs"]).status === 0, false, "the result's main holds no src/reader/due.mjs");
    assert.equal(git(w.origin, "rev-parse", "main"), w.base, "the product's main is where it was");
    assert.deepEqual(w.kept.pullRequests.map((each) => [each.branch, each.base]), [[BRANCH, "main"]], "one pull request is kept for the writing machine");
    assert.ok(w.results().includes(`pending-pull-request:${BRANCH}`), w.results());
    assert.doesNotMatch(w.results(), /not run: implement/);
  });
});

// TST-2026281002 · level: component · module: MOD-workflow-entries · MOD-approvals
// guards: NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED; UC-049
// given: as TST-2026281001 — whose hand-over of ITM-001 runs, the known positive —, but the conversation hands on { kind implement, works_on [ITM-002] }, and ITM-002 realises UC-002, which no approval record names
// input: onDispatch
// expect: outcome `done`; implement's prompt is never sent; the result's repository holds no branch agent-m/ITM-001 and no pull request is kept; the job's end lists `not run: implement — ` naming the rule NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED and UC-002 — MOD-approvals' rests-on-accepted read the item's `realises`.
test("TST-2026281002: a hand-over of implement on an item whose use case is not accepted is not run, its reason the kind's precondition", async () => {
  await world({ handOver: { kind: "implement", works_on: ["ITM-002"], task: "let the member renew" } }, async (w) => {
    assert.equal(w.status.outcome, "done", w.status.summary);
    assert.equal(w.implementRequests().length, 0, "implement's prompt is never sent");
    assert.equal(w.branchOf(`refs/heads/${BRANCH}`), "");
    assert.deepEqual(w.kept.pullRequests, []);
    assert.match(w.results(), /not run: implement — [^\n]*UC-002[^\n]*NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED/);
  });
});
