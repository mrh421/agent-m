// What a spawn of the prompt bar reads before it queues (MOD-prompt-bar's hand-over.mjs `spawnEndpointJob` and `assess`; UC-049 4a): a job that is an endpoint's own works on
// nothing of the product's plan, so its spawn reads none of the product's facts — no MOD-progress-measures' productFacts, no backlog item, sprint, process declaration, job record or
// pull request —, only the product's default branch (its head, its paths, its visibility) and, through MOD-runtimes' handOverJob, the job workflow's file. No hand-over reads the facts,
// whether or not it works on an item of the backlog or a step of the plan: no start rule of the product's process applies to it (UC-049 4a.2). The job's identifier is new
// against the paths under docs/jobs/ of the snapshot read, without reading a record.
// Run: node --test tests/prompt-bar-spawn-reads.test.mjs
//
// Module: MOD-prompt-bar
// Guards: UC-049; A JOB IDENTIFIER IS NEVER REUSED
// Level: unit
//
// Each test states its expected result in its own text; none reads it from a document. The repositories are fixtures in memory (default branch `trunk`) whose hosts keep every call —
// `repositoryInfo`, `readSnapshot`, `listPullRequests`, `read <path>`, `readMany`, `commitFiles`, `startWorkflow` — so that what a spawn reads is counted; the global `fetch` keeps every
// request, and none may be made. The real strategies of handOverStrategies run as they are, except the recipes of the book's chapters, which give no part here. The counter-proofs (a planted
// fault in src/prompt-bar/hand-over.mjs and each test's failing result) are recorded in the pull request.

import test, { afterEach, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { openStore, writeSetting } from "../src/browser-store/index.mjs";
import { registerStrategies } from "../src/job-runner/index.mjs";
import { loadHandOverStrategies } from "../src/prompt-bar/index.mjs";

const handOverStrategies = await loadHandOverStrategies();
import { assess, spawnEndpointJob } from "../src/prompt-bar/hand-over.mjs";
import { endpointsOffered, readParticipants } from "../src/prompt-bar/offer.mjs";
import { defaultSnapshot } from "../src/prompt-bar/send.mjs";
import { sourceStrategies } from "../src/source-register/index.mjs";

// ---------------------------------------------------------------- the part of a browser that is used

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

// One repository in memory whose default branch is `trunk`. `calls` keeps every call of the host and every read of a snapshot's file, `attempts` every commit attempt, `starts` every
// started workflow.
function repoOf(web, files) {
  const commits = new Map(), attempts = [], starts = [], calls = [];
  let made = 0;
  const commitOf = (tree) => { const id = createHash("sha1").update(`${web}#${++made}`).digest("hex"); commits.set(id, tree); return id; };
  let head = commitOf(new Map(Object.entries(files)));
  const [, , , owner, name] = web.split("/");
  const repository = { server: "github", origin: "https://github.com", path: `${owner}/${name}`, web };
  const snapshotAt = (id) => {
    const tree = commits.get(id);
    return { repository, ref: id === head ? "trunk" : id, commit: id, paths: [...tree.keys()].sort(), blob: (path) => (tree.has(path) ? blobOf(tree.get(path)) : null),
      read: async (path) => { calls.push(`read ${path}`); return tree.has(path) ? tree.get(path) : null; },
      readMany: async () => { calls.push("readMany"); } };
  };
  return {
    attempts, starts, calls, head: () => head,
    host: {
      async repositoryInfo() { calls.push("repositoryInfo"); return { defaultBranch: "trunk", visibility: "public", canWrite: true, archived: false, description: "" }; },
      async readSnapshot(ref) { calls.push("readSnapshot"); return snapshotAt(ref === "trunk" ? head : commits.has(ref) ? ref : head); },
      async listPullRequests() { calls.push("listPullRequests"); return []; },
      async containsCommit() { return false; },
      async commitFiles(change) {
        calls.push("commitFiles");
        attempts.push(structuredClone(change));
        if (change.branch !== "trunk" || change.expectedHead !== head) throw Object.assign(new Error("Moved"), { name: "Moved", head });
        head = commitOf(new Map([...commits.get(head), ...change.files.map((file) => [file.path, file.text])]));
        return { commit: head, url: `${web}/commit/${head}` };
      },
      async startWorkflow(workflow, ref, inputs) { calls.push("startWorkflow"); starts.push({ workflow, ref, inputs: structuredClone(inputs) }); return null; },
      async listCiRuns() { calls.push("listCiRuns"); return []; },
    },
  };
}

const INSTANCE_WEB = "https://github.com/alice/agent-m";
const PRODUCT_WEB = "https://github.com/alice/thesis-tool";
const WORKFLOW_FILE = ".github/workflows/agent-m-jobs.yml";
const MODEL_VERSION = "5".repeat(40);
const TASK = "PLANTED-TASK-1300 look at the export";

const COLUMNS = "| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |\n|---|---|---|---|---|---|---|---|";
const WORKERS = "draft text, read the repository, write to the repository, run code and tests";
const register = (...rows) => `# Participants of this instance\n\n**REGISTER**\n\nThe people and agents of the fixture instance.\n\n${COLUMNS}\n${rows.join("\n")}\n`;
const ALICE = "| alice | person | — | — | — | read the repository, write to the repository | — | account github.com/alice |";
const DEV_CI = `| dev-ci | model endpoint | model-ci | 200000 | — | ${WORKERS} | Anthropic, USA | endpoint ep1 secret KEY_A |`;

const frontMatter = (fields) => ["---", ...Object.entries(fields).flatMap(([key, value]) => (Array.isArray(value)
  ? [`${key}:`, ...value.map((entry) => `  - ${entry}`)] : [`${key}: ${value}`])), "---"].join("\n");
const item = (id, { realises, modules = ["MOD-store"] }) => [frontMatter({ id, title: `${id} the work`, level: "module", realises, modules }), `# ${id} the work`, ""].join("\n");
const moduleFile = (id) => [frontMatter({ id, title: id }), `# ${id}`, ""].join("\n");
const sprintRecord = (selection) => [frontMatter({ sprint: 1, goal: "The fixture sprint", start: "2026-10-12", end: "", closer: "alice", branch: "", selection }), "# team1 Sprint 01", ""].join("\n");
const declaration = (model) => [frontMatter({ model, model_file: `src/model-catalogue/models/${model}.md`, model_version: MODEL_VERSION }),
  "# Process", "", "## Practices", "", "- none", "", "## Branches", "", "| Phase or time box | Branch |", "|---|---|", "", "## Definition of Done", "",
  "The job rules hold; no condition is added.", ""].join("\n");
const assignment = (rows) => ["# Role assignment", "", "## Roles", "", "| Role | Participants |", "|---|---|", ...rows.map(([role, who]) => `| ${role} | ${who} |`), ""].join("\n");
const queuedJob = (id, works) => ["---", `id: ${id}`, "kind: implement", "works_on:", `  - ${works}`, "route: ci hosted", "started_by: alice", "start: 2026-10-14 09:00 UTC",
  "agent_m: unknown, commit unknown", "limit: 1", "---", "## Destinations", "", "## Parameters", "", "```json", "{}", "```", ""].join("\n");
const UC1 = "docs/use-cases/UC-001-store.md";

// A Scrum product of team1 with what the facts of the scope `work` read: the process declaration, a role assignment, a sprint selecting ITM-004 (not ITM-005), four backlog items, two
// module files, two job records — one of them `taken` — and Agent M's job workflow.
function productFiles(extra = {}) {
  const files = { "SPEC.md": "# Spec\n", [UC1]: "# UC-001 store\n", [WORKFLOW_FILE]: "name: agent-m-jobs\n",
    "docs/architecture/MOD-store.md": moduleFile("MOD-store"), "docs/architecture/MOD-pages.md": moduleFile("MOD-pages"),
    "docs/process.md": declaration("scrum"),
    "docs/role-assignments/team1.md": assignment([["Product Owner", "alice"], ["Scrum Master", "alice"], ["Developers", "dev-ci"]]),
    "docs/backlog/ITM-003-mail.md": item("ITM-003", { realises: ["UC-001"] }),
    "docs/backlog/ITM-004-feed.md": item("ITM-004", { realises: ["UC-001"] }),
    "docs/backlog/ITM-005-search.md": item("ITM-005", { realises: ["UC-001"] }),
    "docs/backlog/ITM-006-more.md": item("ITM-006", { realises: ["UC-001"] }),
    "docs/backlog/sprints/team1/01.md": sprintRecord(["ITM-003", "ITM-004"]),
    "docs/jobs/JOB-20261014-0900-0001.md": queuedJob("JOB-20261014-0900-0001", "ITM-003"),
    "docs/jobs/JOB-20261014-0901-0002.md": queuedJob("JOB-20261014-0901-0002", "ITM-006"), ...extra };
  files[`docs/approvals/UC-001-${blobOf(files[UC1]).slice(0, 12)}.md`] = "kind: use-case\n";
  return files;
}

// ---------------------------------------------------------------- the strategies, the network, the page

// The real sets of handOverStrategies, except the book's chapters: those recipes of the register's set give no part.
const chaptersGiveNothing = Object.fromEntries(["chapters-for-requirements", "chapters-for-tests", "chapters-for-architecture", "chapters-for-implementation", "chapters-for-page"]
  .map((name) => [name, async () => []]));
for (const set of handOverStrategies) {
  registerStrategies("tests/prompt-bar-spawn-reads.test.mjs", set === sourceStrategies
    ? { recipes: { "source-excerpt": sourceStrategies.recipes["source-excerpt"], ...chaptersGiveNothing } } : set);
}

const realFetch = globalThis.fetch;
const realRandom = Math.random;
const requests = [];
beforeEach(() => { requests.length = 0; globalThis.fetch = async (url) => { requests.push(String(url)); throw new Error(`no request may be made: ${url}`); }; });
afterEach(() => { globalThis.fetch = realFetch; Math.random = realRandom; mock.timers.reset(); });

// A page of the product: this browser keeps the endpoint nvidia — place "NVIDIA, USA", context 128000, the CI secret NVIDIA_API_KEY, no key, no Bridge — which the instance's register
// does not list, and the product's token. `participant` is nvidia as the bar offers it (endpointsOffered).
function open(files = productFiles()) {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: new Storage() });
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: new Storage() });
  const store = openStore("alice/agent-m");
  writeSetting(store, "endpoint:nvidia", { kind: "openai-compatible", url: "https://integrate.api.nvidia.com/v1", model: "nvidia/nemotron", place: "NVIDIA, USA", context: 128000,
    secret: "NVIDIA_API_KEY" });
  writeSetting(store, "github-token", { value: "github_pat_INSTANCE0123456789abcdef", name: "alice", expires: "2027-01-01" });
  writeSetting(store, "github-token:alice/thesis-tool", { value: "github_pat_PRODUCT0123456789abcdefg", name: "alice", expires: "2027-01-01" });
  const instance = repoOf(INSTANCE_WEB, { "SPEC.md": "# Instance spec\n", "docs/participants.md": register(ALICE, DEV_CI) });
  const product = repoOf(PRODUCT_WEB, files);
  const participant = endpointsOffered(store).find((each) => each.name === "nvidia");
  assert.ok(participant, "nvidia is offered");
  return { store, instance, product, participant, page: { address: PRODUCT_WEB, host: product.host }, instanceSetup: { repository: "alice/agent-m", host: instance.host } };
}

const spawn = (it, more = {}) => spawnEndpointJob({ kind: "converse", task: TASK, participant: it.participant, store: it.store, instance: it.instanceSetup, page: it.page, ofProduct: true,
  conversation: null, ...more });
const count = (calls, name) => calls.filter((call) => call === name).length;
const readsOf = (calls) => calls.filter((call) => call.startsWith("read ")).map((call) => call.slice("read ".length));
// What the product's facts read and a spawn does not need: the process declaration, role assignments, backlog items, sprints, module files and job records.
const FACT_FILES = /^(docs\/process\.md|docs\/role-assignments\/|docs\/backlog\/|docs\/architecture\/MOD-|docs\/jobs\/)/;

// ---------------------------------------------------------------- the spawn of an endpoint's own job

// TST-1300001 · level: unit · module: MOD-prompt-bar
// guards: UC-049
// given: the Scrum product, whose facts would read its declaration, its role assignment, four backlog items, a sprint, two module files and two job records, and list its pull requests; the endpoint nvidia of this browser, which runs through GitHub Actions; known positive: the same counting host sees the facts read when a hand-over works on an item (TST-1300003)
// input: spawnEndpointJob of a job of kind converse with the task TASK
// expect: the job is spawned — one commit, one started workflow —; the product's host is asked for its information twice and for its snapshot twice — once by the spawn, for the head, the paths and the visibility, once by MOD-runtimes' handOverJob, which commits on that head —, lists no pull request and reads exactly one file, the job workflow (which handOverJob reads for the instance commit it pins); none of the files the facts read is read; the instance is read once (its default branch), its file docs/participants.md, for whether the endpoint is listed, and its AGENTS.md, which the job's input begins with (EVERY MODEL READS AGENT M'S AGENTS.MD FIRST); no request was made
test("a spawn of an endpoint's own job reads no facts of the product: its head, its paths and its visibility, and the job workflow's file", async () => {
  const it = open();
  const spawned = await spawn(it);
  assert.equal(spawned.refused, undefined, spawned.refused);
  assert.match(spawned.id, /^JOB-\d{8}-\d{4}-[0-9a-f]{4}$/);
  assert.equal(it.product.attempts.length, 1, "one commit queues the job");
  assert.equal(it.product.starts.length, 1, "the job workflow is started once");
  const calls = it.product.calls;
  assert.equal(count(calls, "listPullRequests"), 0, `no pull request is listed: ${calls.join(", ")}`);
  assert.deepEqual(readsOf(calls).filter((path) => FACT_FILES.test(path)), [], "none of the files the facts read is read");
  assert.deepEqual(readsOf(calls), [WORKFLOW_FILE], "the product's one file read is the job workflow's");
  assert.equal(count(calls, "repositoryInfo"), 2, calls.join(", "));
  assert.equal(count(calls, "readSnapshot"), 2, calls.join(", "));
  assert.equal(count(it.instance.calls, "readSnapshot"), 1, it.instance.calls.join(", "));
  assert.deepEqual(readsOf(it.instance.calls), ["docs/participants.md", "AGENTS.md"]);
  assert.deepEqual(requests, []);
});

// TST-1300002 · level: unit · module: MOD-prompt-bar
// guards: UC-049
// given: the product of TST-1300001; the instance's default branch as the bar read it already, for the recording switch (bar.mjs onSpawn); known positive: without it the spawn reads the instance's default branch once (TST-1300001)
// input: spawnEndpointJob with that snapshot as `instanceSnapshot`
// expect: the job is spawned, and the instance's host is not asked for a snapshot again
test("a spawn given the instance's snapshot the bar read does not read it again", async () => {
  const it = open();
  const instanceSnapshot = await defaultSnapshot(it.instance.host);
  it.instance.calls.length = 0;
  const spawned = await spawn(it, { instanceSnapshot });
  assert.equal(spawned.refused, undefined, spawned.refused);
  assert.equal(it.product.starts.length, 1);
  assert.equal(count(it.instance.calls, "readSnapshot"), 0, it.instance.calls.join(", "));
  assert.equal(count(it.instance.calls, "repositoryInfo"), 0, it.instance.calls.join(", "));
});

// ---------------------------------------------------------------- a hand-over that works on an item, and one that works on none

// What changed: this test expected a hand-over that works on a backlog item to be checked by MOD-work-plans' startable on the product's facts, which listed the pull requests. The start rules of the product's process do not apply to the prompt bar (UC-049 4a.2, as accepted): it now expects the hand-over on ITM-005, which no sprint selects, to read none of the facts.
// TST-1300003 · level: unit · module: MOD-prompt-bar
// guards: UC-049
// given: the Scrum product, whose sprint selects ITM-004 and not ITM-005; dev-ci proposes a hand-over that works on ITM-005
// input: assess of { kind: "implement", works_on: ["ITM-005"] }
// expect: a route on CI, and none of the product's facts read: no pull request listed, none of the files the facts read
test("a hand-over that works on a backlog item reads none of the product's facts", async () => {
  const it = open();
  const participant = (await readParticipants(await defaultSnapshot(it.instance.host))).find((each) => each.name === "dev-ci");
  it.product.calls.length = 0;
  const assessed = await assess({ handOver: { kind: "implement", works_on: ["ITM-005"], task: TASK }, participant, instance: it.instanceSetup, page: it.page });
  assert.equal(assessed.route?.kind, "ci");
  assert.equal(count(it.product.calls, "listPullRequests"), 0, it.product.calls.join(", "));
  assert.deepEqual(readsOf(it.product.calls).filter((path) => FACT_FILES.test(path)), [], it.product.calls.join(", "));
});

// TST-1300004 · level: unit · module: MOD-prompt-bar
// guards: UC-049
// given: the Scrum product; dev-ci proposes a hand-over that works on the use case UC-001, which is no item of the backlog and no step of the plan; known positive: the counting host sees each file that is read (TST-1300001)
// input: assess of { kind: "converse", works_on: ["UC-001"] }
// expect: a route, and none of the product's facts read: no pull request listed, none of the files the facts read
test("a hand-over that works on no item or step reads none of the product's facts", async () => {
  const it = open();
  const participant = (await readParticipants(await defaultSnapshot(it.instance.host))).find((each) => each.name === "dev-ci");
  it.product.calls.length = 0;
  const assessed = await assess({ handOver: { kind: "converse", works_on: ["UC-001"], task: TASK }, participant, instance: it.instanceSetup, page: it.page });
  assert.equal(assessed.route?.kind, "ci");
  assert.equal(count(it.product.calls, "listPullRequests"), 0, it.product.calls.join(", "));
  assert.deepEqual(readsOf(it.product.calls).filter((path) => FACT_FILES.test(path)), [], it.product.calls.join(", "));
});

// ---------------------------------------------------------------- the job's identifier

// TST-1300005 · level: unit · module: MOD-prompt-bar
// guards: A JOB IDENTIFIER IS NEVER REUSED
// given: the clock at 2026-10-25 07:26 UTC; the product holds the record docs/jobs/JOB-20261025-0726-a1b2.md; the random digits come as a, 1, b, 2 and then c, 3, d, 4; known positive: the first four digits make the identifier of the record that exists
// input: spawnEndpointJob of a job of kind converse
// expect: the job's record is docs/jobs/JOB-20261025-0726-c3d4.md — the identifier is new against the paths under docs/jobs/ of the snapshot —, and no record under docs/jobs/ was read for it
test("the spawned job's identifier is new against the paths under docs/jobs/ of the snapshot, and no record is read for it", async () => {
  const existing = "JOB-20261025-0726-a1b2";
  const it = open(productFiles({ [`docs/jobs/${existing}.md`]: queuedJob(existing, "ITM-004") }));
  mock.timers.enable({ apis: ["Date"], now: Date.UTC(2026, 9, 25, 7, 26, 30) });
  const digits = [0xa, 0x1, 0xb, 0x2, 0xc, 0x3, 0xd, 0x4];
  let at = 0;
  Math.random = () => (at < digits.length ? (digits[at++] + 0.5) / 16 : realRandom());
  assert.equal(`JOB-20261025-0726-${digits.slice(0, 4).map((digit) => digit.toString(16)).join("")}`, existing, "known positive: the first digits make the existing identifier");
  const spawned = await spawn(it);
  assert.equal(spawned.refused, undefined, spawned.refused);
  assert.equal(spawned.id, "JOB-20261025-0726-c3d4");
  assert.equal(it.product.attempts[0].files[0].path, "docs/jobs/JOB-20261025-0726-c3d4.md");
  assert.deepEqual(readsOf(it.product.calls).filter((path) => path.startsWith("docs/jobs/")), [], "no record is read");
});
