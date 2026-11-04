// The hand-over in the prompt bar (ITM-505) — MOD-prompt-bar's startPromptBar when the participant proposes handing work on (UC-049 4a, 4c, 5a): the proposal shown with its kind, what it
// works on, its task, the participant with its processing place and the route MOD-runtimes' routesFor gives; queued with MOD-runtimes' handOverJob at once as a job of the endpoint or CLI session
// itself, without a further click, the person's Send being the request (UC-049 4a.2), with no start rule of the product's process — its kind's own preconditions decide, MOD-approvals'
// rests-on-accepted refusing an item whose use case is not accepted, and nothing is queued then —; the job followed every 15 seconds through
// MOD-job-ledger's listJobs and MOD-runtimes' liveState and jobLog until its record has its end; *Stop* calling cancelJob. As docs/architecture/MOD-prompt-bar.md states it.
// Run: node --test tests/prompt-bar-hand-over.test.mjs
//
// Module: MOD-prompt-bar
// Guards: UC-049; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED; A CANCELLED JOB WRITES NOTHING MORE
// Guards: A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; NO SERVER
// Level: component
//
// Each test states its expected result in its own text; none reads it from a document. The real MOD-job-runner, MOD-runtimes, MOD-job-catalogue (the kinds `converse` and `implement`),
// MOD-job-ledger, MOD-work-plans, MOD-progress-measures, MOD-product-process, MOD-bridge-client and MOD-markdown-render run as they are; the strategies of other modules that the kinds name
// are fixtures (the recipes `implementation-inputs`, `chapters-for-implementation`, `resource-pins` and `chapters-for-page` give no part; the writer `branch-and-pull-request` writes nothing, since no run is made here) or the real approvals' precondition `rests-on-accepted`. The repository
// servers are fixtures in memory (default branch `trunk`) that keep every commit attempt, every started workflow and every CI call; the model endpoint at https://models.example and the Bridge lab-pc stand behind
// the global `fetch`, which keeps every request, so that a request to any other address is seen: it must be none. The clock is a fake one (node:test's mock timers for setTimeout): no test waits
// for 15 real seconds. A script's click is a plain Event (isTrusted false); a person's click is an Event whose isTrusted is true. The task of every hand-over holds words that appear nowhere else
// (PLANTED-TASK-9C2E), so that a record, a commit or a request that carries them is found. Readings of the module file that the tests state (the pull request names them): a hand-over has no start
// rule of the product's process to meet and is checked by the job's own preconditions when it is handed over; the hand-over is checked against the product as it stands when the answer comes; the proposal's participant is the one the message went to. The counter-proofs are recorded in the pull request.

import test, { afterEach, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { openStore, readTabValue, writeSetting } from "../src/browser-store/index.mjs";
import { approvalStrategies } from "../src/approvals/index.mjs";
import { appendToRecord } from "../src/job-ledger/index.mjs";
import { registerStrategies } from "../src/job-runner/index.mjs";
import { startPromptBar } from "../src/prompt-bar/index.mjs";
import { tick, until } from "./prompt-bar.d/until.mjs";

// ---------------------------------------------------------------- the part of a browser's DOM that is used

class Text { constructor(data) { this.data = String(data); this.parentNode = null; } get textContent() { return this.data; } }
class Element extends EventTarget {
  constructor(name) {
    super();
    Object.assign(this, { localName: name, childNodes: [], className: "", value: "", type: "", hidden: false, disabled: false, parentNode: null, attrs: {}, html: "" });
  }
  append(...nodes) { for (const node of nodes.flat()) { const child = typeof node === "string" ? new Text(node) : node; this.childNodes.push(child); child.parentNode = this; } }
  replaceChildren(...nodes) { this.childNodes = []; this.append(...nodes); }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  getAttribute(name) { return this.attrs[name] ?? null; }
  set innerHTML(value) { this.html = String(value); }
  get innerHTML() { return this.html; }
  get textContent() { return this.html + this.childNodes.map((child) => child.textContent).join(""); }
  focus() {}
}
globalThis.document = { createElement: (name) => new Element(name) };

const all = (root, test) => { const found = []; (function visit(node) { for (const child of node.childNodes ?? []) if (child instanceof Element) { if (test(child)) found.push(child); visit(child); } })(root); return found; };
const byClass = (root, name) => all(root, (node) => node.className.split(" ").includes(name));
const one = (root, name) => byClass(root, name)[0];
const textOf = (node) => node.textContent;
const settle = async () => { for (let at = 0; at < 40; at += 1) await tick(); };
const scripted = () => new Event("click");
const personal = () => Object.defineProperty(new Event("click"), "isTrusted", { value: true });

class Storage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
}

// ---------------------------------------------------------------- the repositories

const blobOf = (text) => createHash("sha1").update(text).digest("hex");
const failure = (name, fields = {}) => Object.assign(new Error(`${name} ${JSON.stringify(fields)}`), { name }, fields);

// One repository in memory whose default branch is `trunk`. `attempts` keeps every commit attempt, `starts` every startWorkflow, `cancels` every cancelled CI run, `calls` every read of a
// snapshot or a record and every call that lists CI runs. `runs` are the CI runs the server lists. `edit` changes a file as another writer would (a runtime taking a job).
function repoOf(web, files) {
  const commits = new Map(), attempts = [], starts = [], cancels = [], calls = [], runs = [], logs = new Map();
  let made = 0, cancelWorks = true;
  const commitOf = (tree) => { const id = createHash("sha1").update(`${web}#${++made}`).digest("hex"); commits.set(id, tree); return id; };
  let head = commitOf(new Map(Object.entries(files)));
  const [, , , owner, name] = web.split("/");
  const repository = { server: "github", origin: "https://github.com", path: `${owner}/${name}`, web };
  const snapshotAt = (id) => {
    const tree = commits.get(id);
    return { repository, ref: id === head ? "trunk" : id, commit: id, paths: [...tree.keys()].sort(), blob: (path) => (tree.has(path) ? blobOf(tree.get(path)) : null),
      read: async (path) => { calls.push(`read ${path}`); return tree.has(path) ? tree.get(path) : null; } };
  };
  return {
    attempts, starts, cancels, calls, runs, logs, head: () => head, file: (path) => commits.get(head).get(path) ?? null, paths: () => [...commits.get(head).keys()],
    edit(path, change) { head = commitOf(new Map([...commits.get(head), [path, change(commits.get(head).get(path) ?? null)]])); },
    cancelDoesNotWork() { cancelWorks = false; },
    jobPath: () => [...commits.get(head).keys()].find((path) => /^docs\/jobs\/JOB-.*\.md$/.test(path) && attempts.some((attempt) => attempt.files.some((file) => file.path === path))),
    host: {
      async repositoryInfo() { calls.push("repositoryInfo"); return { defaultBranch: "trunk", visibility: "public", canWrite: true, archived: false, description: "" }; },
      async readSnapshot(ref) { calls.push("readSnapshot"); return snapshotAt(ref === "trunk" ? head : commits.has(ref) ? ref : head); },
      async listPullRequests() { return []; },
      async containsCommit() { return false; },
      async commitFiles(change) {
        attempts.push(structuredClone(change));
        if (change.branch !== "trunk" || change.expectedHead !== head) throw failure("Moved", { head });
        head = commitOf(new Map([...commits.get(head), ...change.files.map((file) => [file.path, file.text])]));
        return { commit: head, url: `${web}/commit/${head}` };
      },
      async startWorkflow(workflow, ref, inputs) { starts.push({ workflow, ref, inputs: structuredClone(inputs) }); return null; },
      async listCiRuns() { calls.push("listCiRuns"); return runs.map((run) => ({ ...run })); },
      async ciRunLog(id) { return logs.get(id) ?? null; },
      webLinks: () => ({ secrets: `${web}/settings/secrets/actions` }),
      async cancelCiRun(id) { cancels.push(id); const run = runs.find((each) => each.id === id); if (run && cancelWorks) run.state = "cancelled"; },
    },
  };
}

const INSTANCE_WEB = "https://github.com/alice/agent-m";
const PRODUCT_WEB = "https://github.com/alice/thesis-tool";
const WORKFLOW_FILE = ".github/workflows/agent-m-jobs.yml";
const MODEL_VERSION = "5".repeat(40);

const COLUMNS = "| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |\n|---|---|---|---|---|---|---|---|";
const WORKERS = "draft text, read the repository, write to the repository, run code and tests";
const register = (...rows) => `# Participants of this instance\n\n**REGISTER**\n\nThe people and agents of the fixture instance.\n\n${COLUMNS}\n${rows.join("\n")}\n`;
const ALICE = "| alice | person | — | — | — | read the repository, write to the repository | — | account github.com/alice |";

// What this browser declares, which the bar offers (UC-049 1); the instance's participant list holds alice only and is not read for the offer.
// - dev-ci: the endpoint at https://models.example, called through the Bridge lab-pc and naming the CI secret KEY_A of its key, so that a message goes through the Bridge and a hand-over
//   it can do takes GitHub Actions (UC-049 4a.2); an endpoint's capabilities are draft text and read the repository, so it hands on the conversation itself (`converse`), not `implement`.
// - tab-only: the endpoint at https://models.example called by this tab, naming no CI secret, so that its only route is this tab.
// - lab-pc:claude and lab-pc:codex: the CLI sessions the Bridge lab-pc offers for its agents claude and codex, declared with every capability `implement` needs, at "this machine" and at
//   "Anthropic, USA"; a hand-over of theirs takes the Bridge.
const DEV_BRIDGE = "lab-pc:claude", OUTSIDER = "lab-pc:codex";
const ENDPOINTS = {
  "dev-ci": { kind: "openai-compatible", url: "https://models.example/v1", model: "model-ci", key: "sk-fixture-KEY", place: "Anthropic, USA", context: 200000, secret: "KEY_A", bridge: "lab-pc" },
  "tab-only": { kind: "openai-compatible", url: "https://models.example/v1", model: "model-tab", key: "sk-fixture-KEY", place: "Anthropic, USA", context: 200000 },
};
const SESSIONS = {
  claude: { place: "this machine", context: 200000, model: "model-bridge", capabilities: WORKERS.split(", ") },
  codex: { place: "Anthropic, USA", context: 200000, model: "model-out", capabilities: WORKERS.split(", ") },
};

const frontMatter = (fields) => ["---", ...Object.entries(fields).flatMap(([key, value]) => (Array.isArray(value)
  ? [`${key}:`, ...value.map((entry) => `  - ${entry}`)] : [`${key}: ${value}`])), "---"].join("\n");
const item = (id, { realises, modules = ["MOD-store"], builds = [] }) => [frontMatter({ id, title: `${id} the work`, level: "module", realises, modules,
  ...(builds.length ? { builds_on: builds } : {}) }), `# ${id} the work`, ""].join("\n");
const moduleFile = (id) => [frontMatter({ id, title: id }), `# ${id}`, ""].join("\n");
const sprintRecord = (selection) => [frontMatter({ sprint: 1, goal: "The fixture sprint", start: "2026-10-12", end: "", closer: "alice", branch: "", selection }), "# team1 Sprint 01", ""].join("\n");
const declaration = (model) => [frontMatter({ model, model_file: `src/model-catalogue/models/${model}.md`, model_version: MODEL_VERSION }),
  "# Process", "", "## Practices", "", "- none", "", "## Branches", "", "| Phase or time box | Branch |", "|---|---|", "", "## Definition of Done", "",
  "The job rules hold; no condition is added.", ""].join("\n");
const assignment = (rows) => ["# Role assignment", "", "## Roles", "", "| Role | Participants |", "|---|---|", ...rows.map(([role, who]) => `| ${role} | ${who} |`), ""].join("\n");
const queuedJob = (id, works) => ["---", `id: ${id}`, "kind: implement", "works_on:", `  - ${works}`, "route: ci hosted", "started_by: alice", "start: 2026-10-14 09:00 UTC",
  "agent_m: unknown, commit unknown", "limit: 1", "---", "## Destinations", "", "## Parameters", "", "```json", "{}", "```", ""].join("\n");
const UC1 = "docs/use-cases/UC-001-store.md", UC2 = "docs/use-cases/UC-002-pages.md";

// The files every product has: two use cases (UC-001 accepted by a record naming its blob, UC-002 open), two module files, the instance-independent parts of the process.
function commonFiles() {
  const files = { "SPEC.md": "# Spec\n", [UC1]: "# UC-001 store\n", [UC2]: "# UC-002 pages\n", [WORKFLOW_FILE]: "name: agent-m-jobs\n",
    "docs/architecture/MOD-store.md": moduleFile("MOD-store"), "docs/architecture/MOD-pages.md": moduleFile("MOD-pages") };
  files[`docs/approvals/UC-001-${blobOf(files[UC1]).slice(0, 12)}.md`] = "kind: use-case\n";
  return files;
}

// A Scrum product of team1: ITM-004 is ready and selected; ITM-005 is ready and in no sprint; ITM-003 realises the open UC-002; ITM-006 builds on ITM-004.
function scrumFiles() {
  return { ...commonFiles(), "docs/process.md": declaration("scrum"),
    "docs/role-assignments/team1.md": assignment([["Product Owner", "alice"], ["Scrum Master", "alice"], ["Developers", "dev-ci, lab-pc:claude"]]),
    "docs/backlog/ITM-003-mail.md": item("ITM-003", { realises: ["UC-002"] }),
    "docs/backlog/ITM-004-feed.md": item("ITM-004", { realises: ["UC-001"] }),
    "docs/backlog/ITM-005-search.md": item("ITM-005", { realises: ["UC-001"] }),
    "docs/backlog/ITM-006-more.md": item("ITM-006", { realises: ["UC-001"], builds: ["ITM-004"] }),
    "docs/backlog/sprints/team1/01.md": sprintRecord(["ITM-003", "ITM-004", "ITM-006"]) };
}

// A Kanban product with the work-in-progress limit of 3: ITM-001 to ITM-003 each have a queued job, ITM-004 is ready.
function kanbanFiles() {
  const files = { ...commonFiles(), "docs/process.md": declaration("kanban"),
    "docs/role-assignments/team.md": assignment([["Product owner", "alice"], ["Developer", "dev-ci"], ["Reviewer", "alice"], ["Tester", "alice"]]) };
  for (const id of ["ITM-001", "ITM-002", "ITM-003", "ITM-004"]) files[`docs/backlog/${id}-work.md`] = item(id, { realises: ["UC-001"] });
  for (const [at, id] of ["ITM-001", "ITM-002", "ITM-003"].entries()) files[`docs/jobs/JOB-20261014-090${at}-a1b2.md`] = queuedJob(`JOB-20261014-090${at}-a1b2`, id);
  return files;
}

// A V-model product whose plan has the step ITM-007 in the phase Implementation, behind the gate Design → Implementation, for which no record exists.
function vModelFiles() {
  return { ...commonFiles(), "docs/process.md": declaration("v-model"),
    "docs/role-assignments/product.md": assignment([["Product owner", "alice"], ["Developer", "dev-ci"], ["Tester", "alice"], ["Reviewer", "alice"]]),
    "docs/plan/ITM-007-store.md": item("ITM-007", { realises: ["UC-001"] }),
    "docs/plan/order.md": ["# Plan", "", "## Order", "", "| Step | Phase |", "|---|---|", "| ITM-007 | Implementation |", ""].join("\n") };
}

// ---------------------------------------------------------------- the model endpoint and the Bridge behind the global fetch

const MODELS = "https://models.example";
const BRIDGE = "http://localhost:4712";
const BRIDGE_TOKEN = "token-lab-pc";
const realFetch = globalThis.fetch;
const TASK = "PLANTED-TASK-9C2E split ACCOUNT-EXPORT-9C2E into two";
const RUN_URL = "https://github.com/alice/thesis-tool/actions/runs/7";
const COMMIT = "c0ffee0000000000000000000000000000000001";
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// The network: `state.handOver` is the hand-over the next answer proposes; `bridge` is the Bridge's jobs, its log and what it was asked. `seen` keeps every request; `stray` every one that is not
// for the model endpoint or the Bridge.
function network() {
  const state = { handOver: null, answer: "I can hand this on.", bridge: { jobs: [], log: [], logEnded: false, confirm: true, handedOver: [], cancelled: [] }, seen: [], stray: [] };
  const envelope = () => JSON.stringify({ draft: { answer: state.answer, ...(state.handOver ? { handOver: state.handOver } : {}) }, answers: [] });
  globalThis.fetch = async (url, init = {}) => {
    const where = new URL(String(url));
    const call = { origin: where.origin, method: init.method ?? "GET", path: where.pathname, query: where.search, body: String(init.body ?? ""), token: init.headers?.["x-agent-m-bridge-token"] ?? null };
    state.seen.push(call);
    if (call.origin === MODELS) return json({ choices: [{ message: { content: envelope() } }], usage: { prompt_tokens: 10, completion_tokens: 5 } });
    if (call.origin !== BRIDGE) { state.stray.push(call); return json({}, 404); }
    if (call.token !== BRIDGE_TOKEN) return json({ error: "token-refused", message: "pair again" }, 401);
    const bridge = state.bridge;
    // testBridge's two requests, which drawing the bar sends: the Bridge names itself and lists the agents of its sessions, ready.
    if (call.method === "GET" && call.path === "/v1/pair") return json({ bridge: { name: "lab-pc", version: "1.0.0", platform: "linux" }, origin: "https://alice.github.io" });
    if (call.method === "GET" && call.path === "/v1/agents") return json({ agents: Object.keys(SESSIONS).map((name) => ({ name, version: "1.0.0", ready: true, loggedIn: true })), missing: [] });
    if (call.method === "POST" && call.path === "/v1/ask") return json({ ask: "ask-1" });
    if (call.method === "GET" && call.path === "/v1/ask/ask-1") return json({ state: "done", text: envelope(), calls: [], usage: null });
    if (call.method === "POST" && call.path === "/v1/jobs") { bridge.handedOver.push(JSON.parse(call.body)); return json({ accepted: true }); }
    if (call.method === "GET" && call.path === "/v1/jobs") return json({ jobs: bridge.jobs });
    const log = /^\/v1\/jobs\/([^/]+)\/log$/.exec(call.path);
    if (call.method === "GET" && log) {
      const from = Number(new URLSearchParams(call.query).get("from"));
      return json({ lines: bridge.log.slice(from), next: bridge.log.length, ended: bridge.logEnded });
    }
    const cancel = /^\/v1\/jobs\/([^/]+)\/cancel$/.exec(call.path);
    if (call.method === "POST" && cancel) { bridge.cancelled.push(decodeURIComponent(cancel[1])); return json({ confirmed: bridge.confirm }); }
    state.stray.push(call);
    return json({}, 404);
  };
  return state;
}

// The strategies of other modules that the kinds `converse` and `implement` name.
registerStrategies("tests/prompt-bar-hand-over.test.mjs", {
  // implementation-inputs gives, as the real recipe does (src/run-planner/inputs.mjs), one part that carries the sources of every `context.places.contents` entry.
  recipes: { "chapters-for-page": async () => [], "implementation-inputs": async (context) => ((context.places.contents ?? []).length
    ? [{ name: "files", text: "a file of the product", size: 1, sources: context.places.contents.map(({ source }) => source), required: false, recipe: "implementation-inputs", artifacts: [] }] : []),
    "chapters-for-implementation": async () => [], "resource-pins": async () => [] },
  preconditions: { "rests-on-accepted": approvalStrategies.preconditions["rests-on-accepted"] },
  writers: { "branch-and-pull-request": async () => ({ commits: [], files: [], pullRequest: null, shown: null, notes: [] }) },
});

const bars = [];
beforeEach(() => { mock.timers.enable({ apis: ["setTimeout"] }); });
afterEach(() => {
  for (const bar of bars.splice(0)) bar.stop();
  mock.timers.reset();
  globalThis.fetch = realFetch;
});

// ---------------------------------------------------------------- the page

const subjectOf = () => ({ key: "use-case:UC-007", title: "UC-007 Derive use cases", kind: "converse", entry: "use-cases",
  paramsFor: () => ({ page: "The page shows UC-007.", target: "UC-007" }), draftRoute: null, withhold: null, refuses: [] });

// A page of the product (or of the instance): the instance with its participant list, a store declaring the endpoints dev-ci and tab-only (and `endpoints`), the Bridge lab-pc and its
// sessions, and the tokens, and the bar started on it.
function open({ files = scrumFiles(), recording = false, store = null, went = [], instanceFiles = {}, subject = subjectOf, endpoints = {} } = {}) {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: new Storage() });
  if (store === null) Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: new Storage() });
  const kept = store ?? openStore("alice/agent-m");
  for (const [name, setting] of Object.entries({ ...ENDPOINTS, ...endpoints })) writeSetting(kept, `endpoint:${name}`, setting);
  writeSetting(kept, "bridge:lab-pc", { address: BRIDGE, token: BRIDGE_TOKEN });
  for (const [agent, declared] of Object.entries(SESSIONS)) writeSetting(kept, `session:lab-pc:${agent}`, declared);
  writeSetting(kept, "github-token", { value: "github_pat_INSTANCE0123456789abcdef", name: "alice", expires: "2027-01-01" });
  writeSetting(kept, "github-token:alice/thesis-tool", { value: "github_pat_PRODUCT0123456789abcdefg", name: "alice", expires: "2027-01-01" });
  const instance = repoOf(INSTANCE_WEB, { "SPEC.md": "# Instance spec\n", "docs/participants.md": register(ALICE),
    ...instanceFiles, ...(recording ? { "docs/conversation-recording.md": "---\nrecording: on\n---\n# Recording of conversations\n" } : {}) });
  const product = repoOf(PRODUCT_WEB, files);
  const net = network();
  const target = document.createElement("div");
  const bar = startPromptBar(target, { page: "main", store: kept, instance: { repository: "alice/agent-m", host: instance.host },
    product: () => ({ address: PRODUCT_WEB, host: product.host }), subject, explain: () => document.createElement("details"), go: (...where) => went.push(where) });
  bars.push(bar);
  return { went, target, instance, product, net, store: kept, bar };
}

// Sends a message to the participant, whose answer proposes the hand-over, and waits until the proposal is checked.
async function proposes(it, handOver, participant = DEV_BRIDGE) {
  await until(() => one(it.target, "instruction") !== undefined, "the bar is drawn");
  it.net.handOver = handOver;
  one(it.target, "participant").value = participant;
  one(it.target, "instruction").value = "hand this on";
  one(it.target, "send").dispatchEvent(personal());
  await until(() => byClass(it.target, "hand-over").length > 0, "the proposal is shown");
  await until(() => !textOf(one(it.target, "hand-over")).includes("Checking"), "the proposal is checked");
}
const proposal = (it) => one(it.target, "hand-over");
const queued = (it) => byClass(proposal(it), "queued").length;
const following = (it) => textOf(one(it.target, "following"));
const writesOf = (it) => it.product.attempts.length + it.product.starts.length + it.instance.attempts.length + it.net.bridge.handedOver.length;
const NOTHING_WRITTEN = "no commit was attempted, no workflow was started and nothing was handed to the Bridge";
const ITEM = (id, over = {}) => ({ kind: "implement", works_on: [id], task: TASK, ...over });
// The conversation itself handed on by dev-ci, which an endpoint can do, queued as the endpoint's own job on GitHub Actions (UC-049 4a.2).
const ON_CI = (it, id = "ITM-004") => proposes(it, { kind: "converse", works_on: [id], task: TASK }, "dev-ci");
// What the Bridge was asked to run: the messages and the answers that propose the hand-overs.
const asks = (it) => it.net.seen.filter((call) => call.origin === BRIDGE && call.method === "POST" && call.path === "/v1/ask").length;
// The requests drawing the bar sends: testBridge's two, to the Bridge lab-pc this browser keeps.
const DRAWN = ["GET /v1/pair", "GET /v1/agents"];
const requested = (calls) => calls.map((call) => `${call.method} ${call.path}`);

// Waits until the hand-over, queued at once without a further click, is followed.
async function handsOver(it) {
  await until(() => following(it).includes("State:"), "the job is followed");
}

// A runtime takes the queued job: the record gets its `## Taken`.
function takes(it, by) { it.product.edit(it.product.jobPath(), (text) => appendToRecord(text, { part: "taken", at: new Date("2026-10-16T12:01:00Z"), by })); }
// The job ends: the record gets its `## End`.
function ends(it, state, results, reason = null, log = null) {
  it.product.edit(it.product.jobPath(), (text) => appendToRecord(text, { part: "end", at: new Date("2026-10-16T12:09:00Z"), state, results, draft: null, rounds: [], usage: null,
    cost: { known: false, usage: null }, reason, log }));
}
const ciRun = (state) => ({ id: "7", workflow: "agent-m-jobs.yml", commit: "c0", event: "workflow_dispatch", state, url: RUN_URL, started: null, ended: null });
const readsOf = (it) => it.product.calls.filter((call) => call === "readSnapshot").length;
async function after(ms) { mock.timers.tick(ms); await settle(); }

// ---------------------------------------------------------------- what is shown

// TST-505001 · level: component · module: MOD-prompt-bar
// guards: UC-049; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: a Scrum product of team1 where ITM-004 is ready and selected for team1's sprint; the product holds Agent M's job workflow; the CLI session lab-pc:claude (place "this machine", every capability implement needs), which the Bridge lab-pc offers; its answer proposes { kind: "implement", works_on: ["ITM-004"], task: TASK }
// input: Send
// expect: the proposal shows "Kind: implement", "Works on: ITM-004", the task, "Participant: lab-pc:claude — this machine" and "Route: bridge lab-pc", no reason, no button "Hand over", and "Queued as" — it went on without a further click —: one commit queued the job and the Bridge was handed it once; the only request to an agent was the message, one ask of the Bridge, and none went to the model endpoint
test("a hand-over the participant proposes is shown with its kind, what it works on, its task, the participant with its place and its route, and queued without a click", async () => {
  const it = open();
  await proposes(it, ITEM("ITM-004"));
  const text = textOf(proposal(it));
  for (const line of ["Kind: implement", "Works on: ITM-004", `Task: ${TASK}`, "Participant: lab-pc:claude — this machine", "Route: bridge lab-pc"]) assert.ok(text.includes(line), `${line} in ${text}`);
  assert.equal(byClass(proposal(it), "start-reasons").length, 0);
  assert.equal(all(it.target, (node) => node.localName === "button" && /hand over/i.test(textOf(node))).length, 0, "no click is asked for");
  await until(() => queued(it) === 1, "the job is queued at once");
  assert.equal(it.product.attempts.length, 1);
  assert.equal(it.net.bridge.handedOver.length, 1);
  assert.equal(asks(it), 1);
  assert.equal(it.net.seen.filter((call) => call.origin === MODELS).length, 0);
  assert.deepEqual(it.net.stray, []);
});

// The start rules of the product's process bind the process's jobs; the prompt bar is not part of the process (UC-049 4a.2, as accepted). TST-505002 to TST-505006 expected a hand-over that a
// start rule would keep from starting — an item no sprint selects, one that builds on an item not done, a participant that holds no role, the work-in-progress limit, a gate not recorded — to
// show that rule's reason and queue nothing. They now expect it queued, as a job of the participant the message went to; an item whose use case is not accepted is still refused, by the
// kind's own precondition (NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED).

// The one start record the hand-over committed: its text.
const recordText = (it) => it.product.attempts[0].files[0].text;

// TST-505002 · level: component · module: MOD-prompt-bar
// guards: UC-049
// given: the Scrum product of TST-505001, where ITM-005 is ready and is in no sprint's selection; lab-pc:claude's answer proposes a hand-over that works on ITM-005
// input: Send
// expect: no reason is shown and the hand-over is queued at once: one commit queues the job (kind implement, works_on ITM-005, participant lab-pc:claude) and the Bridge is handed it once
test("a hand-over of an item no sprint selects is queued: the sprint's selection is a start rule of the process", async () => {
  const it = open();
  await proposes(it, ITEM("ITM-005"));
  await until(() => queued(it) === 1, "the job is queued at once");
  assert.equal(byClass(proposal(it), "start-reasons").length, 0);
  assert.equal(it.product.attempts.length, 1);
  assert.equal(it.net.bridge.handedOver.length, 1);
  for (const line of ["kind: implement", "  - ITM-005", "participant: lab-pc:claude"]) assert.ok(recordText(it).includes(line), line);
});

// TST-505003 · level: component · module: MOD-prompt-bar
// guards: NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED; UC-049
// given: the Scrum product, where ITM-003 is selected and realises the open UC-002, and ITM-006 is selected and builds on ITM-004, which is not done; the answer proposes a hand-over of ITM-003, then of ITM-006
// input: Send, each
// expect: for ITM-003 the page says "Nothing was queued." with the finding of implement's precondition rests-on-accepted, naming UC-002 and NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED, and nothing was written; ITM-006 is queued (one commit, handed to the Bridge once) — building on an item not done is a start rule of the process
test("a hand-over of an item whose use case is not accepted is refused by the kind's precondition; one that builds on an item not done is queued", async () => {
  const unaccepted = open();
  await proposes(unaccepted, ITEM("ITM-003"));
  await until(() => textOf(proposal(unaccepted)).includes("Nothing was queued."), "the refusal is shown");
  const said = textOf(proposal(unaccepted));
  assert.ok(said.includes("UC-002") && said.includes("NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED"), said);
  assert.equal(queued(unaccepted), 0);
  assert.equal(writesOf(unaccepted), 0, NOTHING_WRITTEN);
  const builds = open();
  await proposes(builds, ITEM("ITM-006"));
  await until(() => queued(builds) === 1, "the job is queued at once");
  assert.equal(builds.product.attempts.length, 1);
  assert.equal(builds.net.bridge.handedOver.length, 1);
});

// TST-505004 · level: component · module: MOD-prompt-bar
// guards: UC-049
// given: the Scrum product, whose Developers are dev-ci and lab-pc:claude; the CLI session lab-pc:codex, with the same capabilities as lab-pc:claude, holds no role
// input: Send to lab-pc:codex, whose answer proposes a hand-over of ITM-004
// expect: no reason is shown and the hand-over is queued at once as lab-pc:codex's own job: one commit whose record names participant lab-pc:codex, handed to the Bridge once
test("a hand-over proposed by a participant that holds no implementing role is queued as that participant's own job", async () => {
  const it = open();
  await proposes(it, ITEM("ITM-004"), OUTSIDER);
  await until(() => queued(it) === 1, "the job is queued at once");
  assert.equal(byClass(proposal(it), "start-reasons").length, 0);
  assert.equal(it.product.attempts.length, 1);
  assert.ok(recordText(it).includes("participant: lab-pc:codex"), recordText(it));
  assert.equal(it.net.bridge.handedOver.length, 1);
});

// TST-505005 · level: component · module: MOD-prompt-bar
// guards: UC-049
// given: a Kanban product (work-in-progress limit 3, no sprints, one role assignment whose Developer is dev-ci) where ITM-001, ITM-002 and ITM-003 each have a queued job and ITM-004 is ready
// input: Send, whose answer proposes a hand-over of ITM-004
// expect: no reason is shown and the hand-over is queued at once: one commit, handed to the Bridge once
test("a hand-over above the product's work-in-progress limit is queued: the limit is a start rule of the process", async () => {
  const it = open({ files: kanbanFiles() });
  await proposes(it, ITEM("ITM-004"));
  await until(() => queued(it) === 1, "the job is queued at once");
  assert.equal(byClass(proposal(it), "start-reasons").length, 0);
  assert.equal(it.product.attempts.length, 1);
  assert.equal(it.net.bridge.handedOver.length, 1);
});

// TST-505006 · level: component · module: MOD-prompt-bar
// guards: UC-049
// given: a V-model product whose plan has the step ITM-007 in the phase Implementation, behind the gate Design → Implementation, for which no gate record exists; dev-ci is its Developer
// input: Send, whose answer proposes a hand-over of ITM-007
// expect: no reason is shown and the hand-over is queued at once: one commit whose record works on ITM-007, handed to the Bridge once
test("a hand-over of a step behind a gate that is not recorded is queued: the gate is a start rule of the process", async () => {
  const it = open({ files: vModelFiles() });
  await proposes(it, ITEM("ITM-007"));
  await until(() => queued(it) === 1, "the job is queued at once");
  assert.equal(byClass(proposal(it), "start-reasons").length, 0);
  assert.ok(recordText(it).includes("  - ITM-007"), recordText(it));
  assert.equal(it.net.bridge.handedOver.length, 1);
});

// TST-505007 · level: component · module: MOD-prompt-bar
// guards: UC-049; A JOB GOES ONLY TO A HOLDER OF ITS ROLE
// given: the Scrum product; tab-only, this browser's endpoint without a CI secret, so that its only route is this tab; and a second product that lacks Agent M's job workflow, for dev-ci, the endpoint that names the CI secret KEY_A
// input: Send to tab-only, and Send to dev-ci on the product without the workflow, each proposing a hand-over of ITM-004
// expect: "Route: not available" with a reason — for tab-only that its route is this tab, for dev-ci that the product has no Agent M job workflow —; no button "Hand over"; nothing was written
test("a participant with no route a hand-over takes, and a product without the job workflow, show the route as not available and queue nothing", async () => {
  const tab = open();
  await proposes(tab, ITEM("ITM-004"), "tab-only");
  assert.match(textOf(one(proposal(tab), "route")), /^Route: not available — .*this tab/);
  assert.equal(queued(tab), 0);
  assert.equal(writesOf(tab), 0, NOTHING_WRITTEN);
  const files = scrumFiles();
  delete files[WORKFLOW_FILE];
  const missing = open({ files });
  await proposes(missing, ITEM("ITM-004"), "dev-ci");
  assert.match(textOf(one(proposal(missing), "route")), /^Route: not available — .*job workflow/);
  assert.equal(queued(missing), 0);
  assert.equal(writesOf(missing), 0, NOTHING_WRITTEN);
});

// ---------------------------------------------------------------- queued on the click

// TST-505008 · level: component · module: MOD-prompt-bar
// guards: THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; UC-049
// given: the Scrum product, which holds Agent M's job workflow; dev-ci, this browser's endpoint naming the CI secret KEY_A, whose answer hands the conversation itself on — { kind: "converse", works_on: ["ITM-004"], task: TASK } —, which its tab cannot take as a hand-over
// input: the person's Send, whose answer proposes the hand-over — no further click
// expect: exactly one commit on the head the page read, which adds docs/jobs/JOB-….md (kind converse, works_on ITM-004, participant dev-ci, route ci hosted, task "with the hand-over", started by alice) and whose message is "Queue job <id>: converse", and exactly one start of the workflow agent-m-jobs.yml on trunk with the inputs job (that id), task (the task, byte for byte) and endpoint (the JSON of kind, address and model, without the key); the page says the job is queued
test("the hand-over is queued on the head the page read, without a further click, and starts the job workflow with the task", async () => {
  const it = open();
  const head = it.product.head();
  await ON_CI(it);
  await handsOver(it);
  assert.equal(it.product.attempts.length, 1);
  const [commit] = it.product.attempts;
  assert.equal(commit.expectedHead, head);
  assert.equal(commit.files.length, 1);
  const id = /^docs\/jobs\/(JOB-\d{8}-\d{4}-[0-9a-f]{4})\.md$/.exec(commit.files[0].path)?.[1];
  assert.ok(id, commit.files[0].path);
  assert.equal(commit.message, `Queue job ${id}: converse`);
  for (const line of ["kind: converse", "participant: dev-ci", "route: ci hosted", "task: with the hand-over", "started_by: alice", "  - ITM-004"]) assert.ok(commit.files[0].text.includes(line), line);
  assert.deepEqual(it.product.starts, [{ workflow: "agent-m-jobs.yml", ref: "trunk", inputs: { job: id, task: TASK,
    endpoint: '{"kind":"openai-compatible","baseUrl":"https://models.example/v1","model":"model-ci"}', secret: "KEY_A" } }]);
  assert.match(textOf(one(it.target, "queued")), new RegExp(`Queued as ${id}`));
  assert.equal(it.instance.attempts.length, 0);
});

// TST-505009 · level: component · module: MOD-prompt-bar
// guards: A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; NO SECRET IN THE REPOSITORY
// given: recording is off; dev-ci's hand-over to GitHub Actions of TST-505008, whose task holds the words PLANTED-TASK-9C2E; known positive: the task reaches the started workflow's inputs
// input: a person's click on Hand over
// expect: the words appear in the started workflow's task input (true) and in no commit of the product or the instance, in no request made after the click, and not the endpoint's key "sk-fixture-KEY" in any commit or workflow input; the record has no conversation line
test("the task's words reach no record, commit or request through the bar, except as the task the workflow is started with", async () => {
  const it = open();
  await ON_CI(it);
  const before = it.net.seen.length;
  await handsOver(it);
  assert.ok(JSON.stringify(it.product.starts).includes("PLANTED-TASK-9C2E"), "known positive: the task travels in the workflow's inputs");
  const written = JSON.stringify([it.product.attempts, it.instance.attempts]);
  assert.ok(!written.includes("PLANTED-TASK-9C2E") && !written.includes("ACCOUNT-EXPORT-9C2E"), "no commit holds the task");
  assert.ok(!written.includes("sk-fixture-KEY") && !JSON.stringify(it.product.starts).includes("sk-fixture-KEY"), "no key is written or sent to the workflow");
  assert.ok(!it.net.seen.slice(before).some((call) => call.body.includes("PLANTED-TASK-9C2E")), "no request after the click carries the task");
  assert.ok(!/^conversation: \S/m.test(it.product.attempts[0].files[0].text), "no conversation record is named");
  assert.deepEqual(it.net.stray, []);
});

// TST-505010 · level: component · module: MOD-prompt-bar
// guards: THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; A JOB GOES ONLY TO A HOLDER OF ITS ROLE; UC-049
// given: lab-pc:claude, the CLI session the Bridge lab-pc offers for its agent claude; its answer (through the Bridge) proposes a hand-over of ITM-004
// input: Send to lab-pc:claude, whose answer proposes the hand-over — no further click
// expect: the proposal shows "Participant: lab-pc:claude — this machine" and "Route: bridge lab-pc"; after the click exactly one commit queues the job with route "bridge lab-pc" and without the task, no workflow is started, and the Bridge is handed { product: the product's address, record: the record's path, commit: the commit made, task: the task } once
test("a hand-over to a Bridge is queued by one commit and handed to the Bridge with the task, which no file holds", async () => {
  const it = open();
  await proposes(it, ITEM("ITM-004"), DEV_BRIDGE);
  const text = textOf(proposal(it));
  assert.ok(text.includes("Participant: lab-pc:claude — this machine") && text.includes("Route: bridge lab-pc"), text);
  await handsOver(it);
  assert.equal(it.product.attempts.length, 1);
  assert.equal(it.product.starts.length, 0);
  const path = it.product.attempts[0].files[0].path;
  assert.ok(it.product.attempts[0].files[0].text.includes("route: bridge lab-pc"));
  assert.ok(!JSON.stringify(it.product.attempts).includes("PLANTED-TASK-9C2E"));
  assert.deepEqual(it.net.bridge.handedOver, [{ product: PRODUCT_WEB, record: path, commit: it.product.head(), task: TASK }]);
  assert.deepEqual(it.net.stray, []);
});

// What changed: the product used to change its sprint's selection, a start rule of the process that no longer applies to the bar (UC-049 4a.2, as accepted); it now changes what ITM-004 rests on, which the kind's own precondition checks.
// TST-505011 · level: component · module: MOD-prompt-bar
// guards: NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the product of TST-505001; before the person's Send, the text of UC-001, which ITM-004 realises, changes, so that no approval record names it any more
// input: Send, whose answer proposes the hand-over of ITM-004
// expect: the hand-over is checked against the product as it stands when the answer comes: the page says "Nothing was queued." with the finding that names UC-001 and NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED, nothing is queued, and nothing was written
test("the hand-over is checked against the product as it stands when the answer comes", async () => {
  const it = open();
  it.product.edit(UC1, () => "# UC-001 store, changed\n");
  await proposes(it, ITEM("ITM-004"));
  await until(() => textOf(proposal(it)).includes("Nothing was queued."), "the refusal is shown");
  const said = textOf(proposal(it));
  assert.ok(said.includes("UC-001") && said.includes("NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED"), said);
  assert.equal(queued(it), 0);
  assert.equal(writesOf(it), 0, NOTHING_WRITTEN);
});

// TST-505012 · level: component · module: MOD-prompt-bar
// guards: NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the Scrum product; lab-pc:claude's answer proposes a hand-over that works on the use case UC-002, which is open and is no item or step of the plan, so that no start rule applies and the job's own precondition decides
// input: Send, whose answer proposes the hand-over
// expect: no start rule applies, so it is queued at once, and refused there: the page says "Nothing was queued." and the finding that the job rests on what is not accepted, naming UC-002 and the rule NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED; nothing was written
test("a hand-over of an open use case is refused by the job's own precondition at once", async () => {
  const it = open();
  await proposes(it, { kind: "implement", works_on: ["UC-002"], task: TASK });
  await until(() => textOf(proposal(it)).includes("Nothing was queued."), "the refusal is shown");
  const text = textOf(proposal(it));
  assert.ok(text.includes("UC-002") && text.includes("NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED"), text);
  assert.equal(writesOf(it), 0, NOTHING_WRITTEN);
});

// TST-1123005 · level: component · module: MOD-prompt-bar
// guards: UC-049; RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS
// given: the allowed hand-over of TST-505001, and the instance's register of sources holds the source SRC-restricted (restricted, its content may go to "this machine" only); the recipe implementation-inputs gives one part that carries the sources of `places.contents`, as the real recipe does
// input: a hand-over to lab-pc:codex (place "Anthropic, USA"); the same hand-over to lab-pc:claude (place "this machine")
// expect: lab-pc:codex's hand-over writes nothing and the page says "Nothing was queued." with a finding that names SRC-restricted and "Anthropic, USA"; lab-pc:claude's hand-over is queued by one commit (the counter-proof: a source whose licence allows the place is read)
test("a hand-over to a participant at a place a restricted source does not allow queues nothing, and one at a place it allows is queued", async () => {
  const restricted = ["---", "id: SRC-restricted", "title: A restricted handbook", "kind: document", "authority: informational", "licence: restricted - internal", "places:", "  - this machine", "content_repository: https://github.com/alice/thesis-tool", "---",
    "# SRC-restricted A restricted handbook", "", "## Versions", "", "| Version | Date | Edition | Read from | Files |", "|---|---|---|---|---|", "| `1` | 2026-10-13 | fixture | here | one file, hashed only |", ""].join("\n");
  const it = open({ instanceFiles: { "docs/sources/SRC-restricted.md": restricted } });
  await proposes(it, ITEM("ITM-004"), OUTSIDER);
  await until(() => textOf(proposal(it)).includes("Nothing was queued."), "the refusal is shown");
  const text = textOf(proposal(it));
  assert.ok(text.includes("SRC-restricted") && text.includes("Anthropic, USA"), text);
  assert.equal(writesOf(it), 0, NOTHING_WRITTEN);
  const allowed = open({ instanceFiles: { "docs/sources/SRC-restricted.md": restricted } });
  await proposes(allowed, ITEM("ITM-004"), DEV_BRIDGE);
  await handsOver(allowed);
  assert.equal(allowed.product.attempts.length, 1);
});

// ---------------------------------------------------------------- followed

// TST-505013 · level: component · module: MOD-prompt-bar
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-049
// given: dev-ci's hand-over to GitHub Actions of TST-505008; a fake clock; the job's record is queued, not yet taken by a run
// input: the job's first poll at once; then the CI takes the job (the record's `## Taken` names the run at RUN_URL, which the server lists as running) and the clock moves 14 999 ms, then 1 ms; then the job ends done with the commit COMMIT and the clock moves 15 000 ms; then 60 000 ms
// expect: at once "State: queued" and "waiting for GitHub Actions" without an address; after 14 999 ms no further read of the default branch, after 1 ms one, now "State: running", still "waiting for GitHub Actions", with the address RUN_URL; after the end "State: done", "Ended: done" and COMMIT listed, no longer waiting; after 60 000 ms no further read
test("a handed-over job is followed every 15 seconds: waiting for GitHub Actions with the run's address, then its end with its commits, and then no more", async () => {
  const it = open();
  await ON_CI(it);
  await handsOver(it);
  assert.ok(following(it).includes("State: queued") && following(it).includes("waiting for GitHub Actions"), following(it));
  assert.ok(!following(it).includes(RUN_URL));
  takes(it, RUN_URL);
  it.product.runs.push(ciRun("running"));
  const reads = readsOf(it);
  await after(14999);
  assert.equal(readsOf(it), reads, "no read before the 15 seconds are over");
  await after(1);
  await until(() => following(it).includes("State: running"), "the second poll");
  assert.equal(readsOf(it), reads + 1, "one read for the second poll");
  assert.ok(following(it).includes("waiting for GitHub Actions") && following(it).includes(RUN_URL), following(it));
  ends(it, "done", [COMMIT]);
  it.product.runs[0].state = "completed";
  await after(15000);
  await until(() => following(it).includes("Ended: done"), "the end is shown");
  assert.ok(following(it).includes("State: done") && following(it).includes(COMMIT), following(it));
  assert.ok(!following(it).includes("waiting for GitHub Actions"));
  const done = readsOf(it);
  await after(60000);
  assert.equal(readsOf(it), done, "a job that has ended is not followed any more");
  assert.deepEqual(it.net.stray, []);
});

// TST-505014 · level: component · module: MOD-prompt-bar
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-049
// given: the allowed Bridge hand-over of lab-pc:claude; the Bridge lab-pc takes the job and its log holds "first line" and "second line", not ended
// input: a person's click on Hand over; the Bridge takes the job (the record's `## Taken` names lab-pc; the Bridge lists the job as running); the clock moves 15 000 ms; then the Bridge's log gets "third line" and the clock moves 15 000 ms
// expect: before it takes the job "waiting for the Bridge lab-pc"; after, the log shows "first line" and "second line" and later "third line", in that order; once the job ends, "Ended: done"
test("a job on a Bridge is waited for, then its log's lines are shown as they come", async () => {
  const it = open();
  await proposes(it, ITEM("ITM-004"), DEV_BRIDGE);
  await handsOver(it);
  assert.ok(following(it).includes("waiting for the Bridge lab-pc"), following(it));
  const id = /Handed over: (JOB-[0-9a-z-]+)/.exec(following(it))[1];
  takes(it, "lab-pc");
  it.net.bridge.jobs.push({ id, product: "alice/thesis-tool", kind: "implement", agent: "claude", state: "running", started: "2026-10-16T12:01:00Z", usage: null });
  it.net.bridge.log.push("first line", "second line");
  await after(15000);
  await until(() => following(it).includes("second line"), "the first lines");
  assert.ok(following(it).indexOf("first line") < following(it).indexOf("second line"));
  assert.ok(!following(it).includes("third line"));
  it.net.bridge.log.push("third line");
  await after(2000);
  await until(() => following(it).includes("third line"), "the third line");
  assert.ok(following(it).indexOf("second line") < following(it).indexOf("third line"));
  ends(it, "done", [COMMIT]);
  it.net.bridge.logEnded = true;
  await after(15000);
  await until(() => following(it).includes("Ended: done"), "the end is shown");
  assert.deepEqual(it.net.stray, []);
});

// TST-505015 · level: component · module: MOD-prompt-bar
// guards: A CANCELLED JOB WRITES NOTHING MORE; UC-049
// given: dev-ci's hand-over to GitHub Actions of TST-505008, taken by the run at RUN_URL, which the server lists as running; the person has handed it over; Stop is enabled while the job is followed
// input: a click on Stop; then, in a second page, the same with a server that does not confirm the cancel within the time
// expect: the CI is asked to cancel the run 7 once; the page shows "cancelled", the record has its end with the state cancelled, and the job is shown "State: cancelled" and not followed any more; with the server that does not confirm: the page shows "cancelling" and the record has no end
test("Stop cancels the followed job and shows cancelled or cancelling as the runtime answers", async () => {
  const it = open();
  await ON_CI(it);
  await handsOver(it);
  takes(it, RUN_URL);
  it.product.runs.push(ciRun("running"));
  await after(15000);
  await until(() => following(it).includes("State: running"), "the job runs");
  assert.equal(one(it.target, "stop").disabled, false, "Stop is enabled while a job is followed");
  one(it.target, "stop").dispatchEvent(scripted());
  await until(() => following(it).includes("State: cancelled"), "the cancel is shown");
  assert.deepEqual(it.product.cancels, ["7"]);
  assert.equal(textOf(one(it.target, "cancel")), "cancelled");
  assert.match(it.product.file(it.product.jobPath()), /## End[^]*state: cancelled/);
  const reads = readsOf(it);
  await after(60000);
  assert.equal(readsOf(it), reads, "a cancelled job is not followed any more");

  const unconfirmed = open();
  await ON_CI(unconfirmed);
  await handsOver(unconfirmed);
  takes(unconfirmed, RUN_URL);
  unconfirmed.product.runs.push(ciRun("running"));
  unconfirmed.product.cancelDoesNotWork();
  await after(15000);
  await until(() => following(unconfirmed).includes("State: running"), "the job runs");
  one(unconfirmed.target, "stop").dispatchEvent(scripted());
  await until(() => byClass(unconfirmed.target, "cancel").length > 0, "the answer is shown");
  assert.equal(textOf(one(unconfirmed.target, "cancel")), "cancelling");
  assert.ok(!/## End/.test(unconfirmed.product.file(unconfirmed.product.jobPath())), "nothing is appended before the runtime confirms");
});

// TST-505016 · level: component · module: MOD-prompt-bar
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-049
// given: dev-ci's hand-over to GitHub Actions of TST-505008, handed over on one page of the tab; the job has not ended
// input: the bar started again in the same tab (another page of the product)
// expect: the new bar shows the same job — its identifier and "State: queued" — without queuing anything again (one commit in all); after the job ends and the clock moves 15 000 ms the tab no longer follows it: another bar started then shows no job
test("a job handed over on one page goes on being followed on the next page of the tab, and is forgotten once it has ended", async () => {
  const it = open();
  await ON_CI(it);
  await handsOver(it);
  const id = /Handed over: (JOB-[0-9a-z-]+)/.exec(following(it))[1];
  const second = document.createElement("div");
  bars.push(startPromptBar(second, { page: "review", store: it.store, instance: { repository: "alice/agent-m", host: it.instance.host },
    product: () => ({ address: PRODUCT_WEB, host: it.product.host }), subject: subjectOf, explain: () => document.createElement("details"), go: () => {} }));
  await until(() => textOf(one(second, "following") ?? new Element("p")).includes("State: queued"), "the second bar follows the job");
  assert.ok(textOf(one(second, "following")).includes(id));
  assert.equal(it.product.attempts.length, 1, "nothing is queued again");
  ends(it, "done", [COMMIT]);
  await after(15000);
  await until(() => following(it).includes("Ended: done"), "the end is shown");
  assert.equal(readTabValue(it.store, "prompt-bar:job"), null);
  const third = document.createElement("div");
  bars.push(startPromptBar(third, { page: "review", store: it.store, instance: { repository: "alice/agent-m", host: it.instance.host },
    product: () => ({ address: PRODUCT_WEB, host: it.product.host }), subject: subjectOf, explain: () => document.createElement("details"), go: () => {} }));
  await until(() => one(third, "instruction") !== undefined, "the third bar is drawn");
  assert.equal(textOf(one(third, "following")), "");
});

// TST-505017 · level: component · module: MOD-prompt-bar
// guards: A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON; A RECORDED CONVERSATION IS KEPT WHERE IT WAS HELD; UC-049
// given: recording is on at the instance; the person's message to dev-ci was recorded in the product's conversation record; dev-ci's hand-over to GitHub Actions of TST-505008
// input: a person's click on Hand over
// expect: the job's record names that conversation record (conversation: its path); the conversation record gains a section "handed over" with `job: <the job's id>`; the task's words are in neither the job's record nor the conversation record
test("with recording on, the job's record names the conversation record and the conversation record names the job, and the task is in neither", async () => {
  const it = open({ recording: true });
  await ON_CI(it);
  const path = readTabValue(it.store, "prompt-bar:records")[PRODUCT_WEB].path;
  assert.match(path, /^docs\/conversations\/\d{8}-\d{4}-[0-9a-f]{4}\.md$/);
  await handsOver(it);
  const id = /Handed over: (JOB-[0-9a-z-]+)/.exec(following(it))[1];
  await until(() => /handed over\njob: /.test(it.product.file(path) ?? ""), "the hand-over is recorded");
  const jobRecord = it.product.file(`docs/jobs/${id}.md`);
  assert.ok(jobRecord.includes(`conversation: ${path}`), jobRecord);
  assert.ok(it.product.file(path).includes(`## `) && it.product.file(path).includes(`job: ${id}`));
  for (const text of [jobRecord, it.product.file(path)]) assert.ok(!text.includes("PLANTED-TASK-9C2E"));
});

// ---------------------------------------------------------------- what is missing is linked (UC-049 4c)

const withoutWorkflow = () => { const files = scrumFiles(); delete files[WORKFLOW_FILE]; return files; };
const SECRETS_PAGE = `${PRODUCT_WEB}/settings/secrets/actions`;
const NOT_RUN = "onDispatch: not run — KEY_A is missing: the key of dev-ci is a secret of this repository, passed to the job as KEY_A. Nothing was written.";
// The run the server lists for the started workflow, ended failed, with the log the entry's command line prints.
const endsNotRun = (it, log) => { it.product.runs.push(ciRun("failed")); it.product.logs.set("7", log); };

// TST-1037001 · level: component · module: MOD-prompt-bar
// guards: UC-049; EVERY STEP EXPLAINS ITSELF
// given: the Scrum product without Agent M's job workflow; dev-ci's answer proposes a hand-over of the ready ITM-004
// input: Send; then a click on the link the proposal shows
// expect: the proposal shows "Route: not available" with the reason that the product has no Agent M job workflow, and one link "Set up the job workflow"; the click calls go with the route "settings" and nothing else; nothing was written
test("a hand-over refused for a missing job workflow links the route settings, and the click goes there", async () => {
  const it = open({ files: withoutWorkflow() });
  await proposes(it, ITEM("ITM-004"), "dev-ci");
  assert.match(textOf(one(proposal(it), "route")), /^Route: not available — .*job workflow/);
  const links = byClass(proposal(it), "settings-link");
  assert.equal(links.length, 1);
  assert.equal(textOf(links[0]), "Set up the job workflow");
  links[0].dispatchEvent(scripted());
  assert.deepEqual(it.went, [["settings"]]);
  assert.equal(writesOf(it), 0, NOTHING_WRITTEN);
});

// What changed: the refusal for another reason was a start rule's (ITM-005, which no sprint selects), which no longer applies to the bar (UC-049 4a.2, as accepted); it is now the kind's own precondition's (ITM-003, whose use case UC-002 is not accepted).
// TST-1037002 · level: component · module: MOD-prompt-bar
// guards: UC-049
// given: known positive TST-1037001; lab-pc:claude's hand-over of ITM-003, whose use case is not accepted, on a product with the job workflow; tab-only, whose only route is this tab, on a product without it; the allowed hand-over of TST-505001
// input: Send, each
// expect: no link to settings in any of them; ITM-003's says "Nothing was queued."
test("a refusal for another reason shows no link to settings", async () => {
  const positive = open({ files: withoutWorkflow() });
  await proposes(positive, ITEM("ITM-004"), "dev-ci");
  assert.equal(byClass(proposal(positive), "settings-link").length, 1, "known positive");
  const unaccepted = open();
  await proposes(unaccepted, ITEM("ITM-003"));
  await until(() => textOf(proposal(unaccepted)).includes("Nothing was queued."), "the refusal is shown");
  assert.equal(byClass(proposal(unaccepted), "settings-link").length, 0);
  const tab = open({ files: withoutWorkflow() });
  await proposes(tab, ITEM("ITM-004"), "tab-only");
  assert.equal(byClass(proposal(tab), "settings-link").length, 0);
  const allowed = open();
  await proposes(allowed, ITEM("ITM-004"));
  assert.equal(byClass(proposal(allowed), "settings-link").length, 0);
});

// TST-1037003 · level: component · module: MOD-prompt-bar
// guards: UC-049; A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET
// given: dev-ci's hand-over to GitHub Actions of TST-505008; the server lists the started run as failed, and its log says `not run` for the missing secret KEY_A
// input: the clock moves 15 000 ms
// expect: the followed job names the secret KEY_A and shows one link whose address is the product's page of CI secrets (the host's webLinks().secrets)
test("a run that ended not run for a missing secret names the secret and links the server's page of the repository's secrets", async () => {
  const it = open();
  await ON_CI(it);
  await handsOver(it);
  endsNotRun(it, NOT_RUN);
  await after(15000);
  await until(() => byClass(one(it.target, "following"), "secrets-link").length > 0, "the link is shown");
  const links = byClass(one(it.target, "following"), "secrets-link");
  assert.equal(links.length, 1);
  assert.equal(links[0].getAttribute("href"), SECRETS_PAGE);
  assert.ok(textOf(one(it.target, "following")).includes("KEY_A"));
});

// TST-1037004 · level: component · module: MOD-prompt-bar
// guards: UC-049
// given: known positive TST-1037003; dev-ci's hand-over to GitHub Actions of TST-505008 whose run failed with a log that names no missing secret; and one whose run is still running while its log says `not run`
// input: the clock moves 15 000 ms
// expect: no link to the page of secrets in either
test("a run that failed for another reason, or is still running, shows no link to the page of secrets", async () => {
  const failed = open();
  await ON_CI(failed);
  await handsOver(failed);
  endsNotRun(failed, "onDispatch: failed — the model refused the request");
  await after(15000);
  assert.equal(byClass(one(failed.target, "following"), "secrets-link").length, 0);
  const running = open();
  await ON_CI(running);
  await handsOver(running);
  running.product.runs.push(ciRun("running"));
  running.product.logs.set("7", NOT_RUN);
  await after(15000);
  assert.equal(byClass(one(running.target, "following"), "secrets-link").length, 0);
});

// ---------------------------------------------------------------- Send is a person's click (ITM-1139)

// TST-1139001 · level: component · module: MOD-prompt-bar
// guards: THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON; UC-049
// given: recording is on at the instance; the bar is drawn on the product's page — drawing it sent the Bridge lab-pc testBridge's two requests, GET /v1/pair and GET /v1/agents —, tab-only, the endpoint this tab calls, chosen and a message written; known positive: a person's click records the message and sends it
// input: a click a script makes on Send (isTrusted false); then a person's click (isTrusted true)
// expect: after the script's click nothing was sent (no request beyond the two of the drawing), no commit was attempted on the product or the instance, and the conversation shows no message; after the person's click the message was sent to the model endpoint and the conversation record was committed on the product (the record names the message)
test("with recording on, a script's click on Send sends nothing and commits nothing; a person's click sends and records", async () => {
  const it = open({ recording: true });
  await until(() => one(it.target, "instruction") !== undefined, "the bar is drawn");
  one(it.target, "participant").value = "tab-only";
  one(it.target, "instruction").value = "SCRIPTED-MESSAGE-4F7A please";
  one(it.target, "send").dispatchEvent(scripted());
  await settle();
  assert.deepEqual(requested(it.net.seen), DRAWN, "no request was made but the drawing's");
  assert.equal(writesOf(it), 0, NOTHING_WRITTEN);
  assert.equal(it.product.attempts.length + it.instance.attempts.length, 0);
  assert.equal(byClass(it.target, "message").length, 0, "the conversation holds no message");
  assert.equal(one(it.target, "instruction").value, "SCRIPTED-MESSAGE-4F7A please", "the person's words stay in the input");
  one(it.target, "send").dispatchEvent(personal());
  await until(() => it.net.seen.some((call) => call.origin === MODELS) && it.product.attempts.length > 0, "the message is sent and recorded");
  const recorded = it.product.attempts.map((attempt) => attempt.files.map((file) => file.text).join("\n")).join("\n");
  assert.ok(recorded.includes("SCRIPTED-MESSAGE-4F7A"), "the record names the message");
});

// ---------------------------------------------------------------- a hand-over of the subject's own kind takes only the subject's source (ITM-1129)

// A page whose subject gives, as context, the person's own source, and also what a page gives the bar — the text of the page, a target and, on the route draft, the participant's answer as `draft`.
// `withSource: false` is a subject that gives none.
function subjectGiving({ withSource = true } = {}) {
  return () => ({ key: "use-case:UC-001", title: "UC-001 Store", entry: "use-cases",
    paramsFor: () => ({ page: "PLANTED-PAGE-9A1 The page shows UC-001.", target: "UC-001", draft: { answer: "PLANTED-ANSWER-9A1 the participant's answer" }, ...(withSource ? { source: "SRC-person-alice" } : {}) }),
    draftRoute: null, withhold: null, refuses: [] });
}
const jobRecordOf = (it) => it.product.attempts.flatMap((attempt) => attempt.files).find((file) => /^docs\/jobs\/JOB-.*\.md$/.test(file.path))?.text ?? "";

// TST-1129001 · level: component · module: MOD-prompt-bar
// guards: THE PERSON WHO PROMPTS IS A SOURCE; A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON; UC-049
// given: a page whose subject gives, as context, the source SRC-person-alice, and also the text of the page, a target and a draft that holds the participant's answer; the participant proposes a hand-over of the kind implement, queued since the participant's tab cannot run it
// input: Send, whose answer proposes the hand-over
// expect: the queued job's record holds `"source": "SRC-person-alice"` among its parameters and no other parameter of the subject — no `page`, no `draft`, no `target`, no text of the page and no text of the answer anywhere in the record
test("a queued hand-over takes only the subject's source into its record", async () => {
  const it = open({ subject: subjectGiving() });
  await proposes(it, ITEM("ITM-004"));
  await handsOver(it);
  const record = jobRecordOf(it);
  assert.ok(record.includes("kind: implement"), "known positive: the job is queued");
  assert.match(record, /"source": "SRC-person-alice"/);
  assert.doesNotMatch(record, /"page"|"draft"|"target"/);
  assert.doesNotMatch(record, /PLANTED-PAGE-9A1|PLANTED-ANSWER-9A1/);
});

// TST-1129002 · level: component · module: MOD-prompt-bar
// guards: THE PERSON WHO PROMPTS IS A SOURCE; UC-049
// given: a page whose subject gives no source of the person; the participant proposes the hand-over of TST-1129001
// input: Send, whose answer proposes the hand-over
// expect: the job is queued all the same — the subject refuses nothing, a kind that needs the source refuses by its own precondition — and its record holds no source
test("a queued hand-over from a subject without the person's source takes none", async () => {
  const it = open({ subject: subjectGiving({ withSource: false }) });
  await proposes(it, ITEM("ITM-004"));
  await handsOver(it);
  const record = jobRecordOf(it);
  assert.ok(record.includes("kind: implement"), "known positive: the job is queued");
  assert.doesNotMatch(record, /"source"/);
});

// ---------------------------------------------------------------- an endpoint of this browser that runs through GitHub Actions: *Spawn job*

const NVIDIA = "https://integrate.api.nvidia.com/v1";
const NVIDIA_MODEL = "nvidia/nemotron-3-ultra-550b-a55b";
// This browser's endpoint nvidia, declared with its place, context and the CI secret of its key, and no key here; and one that names no place, which is not offered.
const ON_ACTIONS = { nvidia: { kind: "openai-compatible", url: NVIDIA, model: NVIDIA_MODEL, place: "NVIDIA, USA", context: 128000, secret: "NVIDIA_API_KEY" },
  undeclared: { kind: "openai-compatible", url: NVIDIA, model: NVIDIA_MODEL, secret: "NVIDIA_API_KEY" } };
const choose = (it, name) => { const selector = one(it.target, "participant"); selector.value = name; selector.dispatchEvent(new Event("change")); };
const optionNames = (it) => all(one(it.target, "participant"), (node) => node.localName === "option").map((node) => node.value);
const ANSWER_LOG = (id) => ["Agent M jobs on hosted", `2026-10-16T12:08:00.0000000Z --- answer of ${id} ---`, "2026-10-16T12:08:00.0000000Z PLANTED-ANSWER-NV7 ok",
  `2026-10-16T12:08:00.0000000Z --- end of the answer of ${id} ---`, ""].join("\n");

// TST-1200001 · level: component · module: MOD-prompt-bar
// guards: UC-049; THE PROMPT BAR'S ENDPOINTS AND CLI SESSIONS ARE BOUND AS PARTICIPANTS ARE; THE PAGE NAMES WHERE IT SENDS
// given: this browser keeps the endpoint nvidia — place "NVIDIA, USA", context 128000, the CI secret NVIDIA_API_KEY and no key — and the endpoint undeclared, which names no place nor context; the instance's register does not list either; this browser's endpoint dev-ci names the CI secret KEY_A and the Bridge lab-pc that calls it
// input: the bar drawn; nvidia chosen; then dev-ci chosen
// expect: nvidia is offered, named "nvidia — NVIDIA, USA", and undeclared is not; with nvidia chosen the button reads "Spawn job"; with dev-ci (called through its Bridge) it reads "Send"
test("an endpoint that runs through GitHub Actions is offered from this browser's configuration, and the button then reads Spawn job; for one the tab calls it reads Send", async () => {
  const it = open({ endpoints: ON_ACTIONS });
  await until(() => one(it.target, "instruction") !== undefined, "the bar is drawn");
  assert.ok(optionNames(it).includes("nvidia"), optionNames(it).join(", "));
  assert.equal(optionNames(it).includes("undeclared"), false, "an endpoint without a place and a context is not offered");
  assert.ok(textOf(one(it.target, "participant")).includes("nvidia — NVIDIA, USA"));
  choose(it, "nvidia");
  assert.equal(textOf(one(it.target, "send")), "Spawn job");
  choose(it, "dev-ci");
  assert.equal(textOf(one(it.target, "send")), "Send");
});

// TST-1200002 · level: component · module: MOD-prompt-bar
// guards: UC-049; A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; NO SECRET IN THE REPOSITORY; A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON
// given: the page of TST-1200001 on the Scrum product, which holds Agent M's job workflow; nvidia chosen; recording off
// input: a script's click on Spawn job, then a person's, with the message TASK; then a runtime takes the job, its run leaves the answer "PLANTED-ANSWER-NV7 ok" in its log and its record ends done with that run's address; 15 seconds pass
// expect: the script's click writes nothing; no request goes to NVIDIA or anywhere but GitHub's fixtures, beyond testBridge's two requests to the Bridge lab-pc at the drawing; one commit queues the record — participant nvidia, model the endpoint's, route ci hosted, `declares` the context 128000 and the capabilities, the place NVIDIA, USA, and none of the task's words —; the job workflow is started once with the inputs job, task TASK, endpoint the JSON of { kind, baseUrl, model } and secret NVIDIA_API_KEY; the bar says waiting for GitHub Actions; once ended, it shows the answer, and the conversation holds it
test("Spawn job hands the message to GitHub Actions with the endpoint and the name of its CI secret, follows the run and shows its answer once, in the conversation", async () => {
  const it = open({ endpoints: ON_ACTIONS });
  await until(() => one(it.target, "instruction") !== undefined, "the bar is drawn");
  choose(it, "nvidia");
  one(it.target, "instruction").value = TASK;
  one(it.target, "send").dispatchEvent(scripted());
  await settle();
  assert.equal(writesOf(it), 0, "a script's click spawns nothing");
  one(it.target, "send").dispatchEvent(personal());
  await until(() => following(it).includes("State:"), "the job is followed");
  assert.deepEqual(requested(it.net.seen), DRAWN, "no request reached a model or any address outside the repository fixtures but the drawing's");
  assert.equal(it.product.starts.length, 1);
  const { inputs } = it.product.starts[0];
  assert.deepEqual(Object.keys(inputs).sort(), ["endpoint", "job", "secret", "task"]);
  assert.equal(inputs.task, TASK);
  assert.deepEqual(JSON.parse(inputs.endpoint), { kind: "openai-compatible", baseUrl: NVIDIA, model: NVIDIA_MODEL });
  assert.equal(inputs.secret, "NVIDIA_API_KEY");
  const record = it.product.file(it.product.jobPath());
  assert.match(record, /^participant: nvidia$/m);
  assert.match(record, new RegExp(`^model: ${NVIDIA_MODEL}$`, "m"));
  assert.match(record, /^route: ci hosted$/m);
  assert.match(record, /^declares: \{"context":128000,"capabilities":\["draft text","read the repository"\]\}$/m);
  assert.match(record, /nvidia, at NVIDIA, USA/);
  assert.doesNotMatch(record, /PLANTED-TASK-9C2E/);
  assert.ok(following(it).includes("waiting for GitHub Actions"), following(it));
  takes(it, RUN_URL);
  it.product.runs.push(ciRun("succeeded"));
  const id = /docs\/jobs\/(JOB-[^/]+)\.md$/.exec(it.product.jobPath())[1];
  it.product.logs.set("7", ANSWER_LOG(id));
  ends(it, "done", [], null, RUN_URL);
  await after(15000);
  await until(() => textOf(one(it.target, "conversation")).includes("PLANTED-ANSWER-NV7 ok"), "the answer joins the conversation");
  assert.equal(following(it).includes("PLANTED-ANSWER-NV7 ok"), false, "the answer stands once, in the conversation, not again under the run");
});

// TST-1200003 · level: component · module: MOD-prompt-bar
// guards: UC-049; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the page of TST-1200001 on a product without Agent M's job workflow; nvidia chosen
// input: a person's click on Spawn job
// expect: "Nothing was spawned" naming the missing job workflow, and the button "Set up the job workflow", whose click goes to the route settings; nothing was written and no workflow started
test("Spawn job on a product without the job workflow spawns nothing and links setting it up", async () => {
  const files = scrumFiles();
  delete files[WORKFLOW_FILE];
  const it = open({ files, endpoints: ON_ACTIONS });
  await until(() => one(it.target, "instruction") !== undefined, "the bar is drawn");
  choose(it, "nvidia");
  one(it.target, "instruction").value = TASK;
  one(it.target, "send").dispatchEvent(personal());
  await until(() => textOf(one(it.target, "status")).includes("Nothing was spawned"), "the refusal is shown");
  assert.match(textOf(one(it.target, "status")), /no Agent M job workflow/);
  one(it.target, "settings-link").dispatchEvent(personal());
  assert.deepEqual(it.went.at(-1), ["settings"]);
  assert.equal(writesOf(it), 0, NOTHING_WRITTEN);
});
