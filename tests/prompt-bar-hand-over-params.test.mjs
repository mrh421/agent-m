// The parameters a hand-over of the bar gives the job (ITM-626) — MOD-prompt-bar's hand-over.mjs `queue`, which the bar calls on a person's click (docs/architecture/MOD-prompt-bar.md: Interfaces,
// startPromptBar; UC-049 4a): the job is prepared with the parameters that `works_on` determines, and a kind whose strategies read a parameter that `works_on` cannot give is refused at preparation by the
// strategy's own error, with nothing queued.
// Run: node --test tests/prompt-bar-hand-over-params.test.mjs
//
// Module: MOD-prompt-bar
// Guards: UC-019; UC-049
// Level: unit
//
// Each test states its expected result in its own text; none reads it from a document. What the bar gives is fixed here by `works_on`'s shape alone, whatever the kind: a use case (UC-nnn) is `useCases`
// and, when it is the only one, `useCase` as well; an item or step (ITM-nnn) is `steps` where the product's plan holds that step (a file docs/plan/ITM-nnn-….md) and `items` where it does not; any other
// name is a requirement, `requirements`. The bar gives no `source`, `resource`, `kind`, `entry` or `part`, and no other key, whatever the kind. The real strategies of the eight sets of handOverStrategies
// run as they are, except the four recipes that read the book's chapters (`chapters-for-…`), which give no part here; the repositories are fixtures in memory (default branch `trunk`) that keep every commit
// attempt and every started workflow; the global `fetch` keeps every request, and none may be made. The kinds that a hand-over prepares today are the ten whose every strategy handOverStrategies or the
// job runner holds: change-use-case, change-requirements, derive-requirements, derive-use-cases, derive-architecture, review-architecture, implement, refactor, check-resource and converse. The others
// (change-architecture, draft-plan, propose-items, close-sprint, decide-gate, set-up-ci, propose-tests, write-tests, run-tests, analyse-issue, fix-bug, propose-issues, rewrite-without-persons,
// check-for-persons, draft-replies, propose-groups) name a strategy that no module builds yet and are not prepared. The counter-proof (a planted fault in src/prompt-bar/hand-over.mjs and the test's
// failing result) is recorded in the pull request.

import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { openStore, writeSetting } from "../src/browser-store/index.mjs";
import { registerStrategies } from "../src/job-runner/index.mjs";
import { handOverStrategies } from "../src/prompt-bar/index.mjs";
import { assess, queue } from "../src/prompt-bar/hand-over.mjs";
import { readParticipants } from "../src/prompt-bar/offer.mjs";
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

// One repository in memory whose default branch is `trunk`. `attempts` keeps every commit attempt, `starts` every startWorkflow.
function repoOf(web, files) {
  const commits = new Map(), attempts = [], starts = [];
  let made = 0;
  const commitOf = (tree) => { const id = createHash("sha1").update(`${web}#${++made}`).digest("hex"); commits.set(id, tree); return id; };
  let head = commitOf(new Map(Object.entries(files)));
  const [, , , owner, name] = web.split("/");
  const repository = { server: "github", origin: "https://github.com", path: `${owner}/${name}`, web };
  const snapshotAt = (id) => {
    const tree = commits.get(id);
    return { repository, ref: id === head ? "trunk" : id, commit: id, paths: [...tree.keys()].sort(), blob: (path) => (tree.has(path) ? blobOf(tree.get(path)) : null),
      read: async (path) => (tree.has(path) ? tree.get(path) : null) };
  };
  return {
    attempts, starts,
    host: {
      async repositoryInfo() { return { defaultBranch: "trunk", visibility: "public", canWrite: true, archived: false, description: "" }; },
      async readSnapshot(ref) { return snapshotAt(ref === "trunk" ? head : commits.has(ref) ? ref : head); },
      async listPullRequests() { return []; },
      async containsCommit() { return false; },
      async commitFiles(change) {
        attempts.push(structuredClone(change));
        if (change.branch !== "trunk" || change.expectedHead !== head) throw Object.assign(new Error("Moved"), { name: "Moved", head });
        head = commitOf(new Map([...commits.get(head), ...change.files.map((file) => [file.path, file.text])]));
        return { commit: head, url: `${web}/commit/${head}` };
      },
      async startWorkflow(workflow, ref, inputs) { starts.push({ workflow, ref, inputs: structuredClone(inputs) }); return null; },
      async listCiRuns() { return []; },
    },
  };
}

const INSTANCE_WEB = "https://github.com/alice/agent-m";
const PRODUCT_WEB = "https://github.com/alice/thesis-tool";
const WORKFLOW_FILE = ".github/workflows/agent-m-jobs.yml";
const MODEL_VERSION = "5".repeat(40);
const TASK = "PLANTED-TASK-626A hand this on";

const COLUMNS = "| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |\n|---|---|---|---|---|---|---|---|";
const WORKERS = "draft text, read the repository, write to the repository, run code and tests";
const register = (...rows) => `# Participants of this instance\n\n**REGISTER**\n\nThe people and agents of the fixture instance.\n\n${COLUMNS}\n${rows.join("\n")}\n`;
const ALICE = "| alice | person | — | — | — | read the repository, write to the repository | — | account github.com/alice |";
const DEV_CI = `| dev-ci | model endpoint | model-ci | 200000 | — | ${WORKERS} | Anthropic, USA | endpoint ep1 secret KEY_A |`;

const frontMatter = (fields) => ["---", ...Object.entries(fields).flatMap(([key, value]) => (Array.isArray(value)
  ? [`${key}:`, ...value.map((entry) => `  - ${entry}`)] : [`${key}: ${value}`])), "---"].join("\n");
const item = (id, { realises, modules = ["MOD-store"] }) => [frontMatter({ id, title: `${id} the work`, level: "module", realises, modules }), `# ${id} the work`, ""].join("\n");
const moduleFile = (id) => [frontMatter({ id, title: id, folder: `src/${id.slice(4)}/` }), `# ${id}`, ""].join("\n");
const sprintRecord = (selection) => [frontMatter({ sprint: 1, goal: "The fixture sprint", start: "2026-10-12", end: "", closer: "alice", branch: "", selection }), "# team1 Sprint 01", ""].join("\n");
const declaration = (model) => [frontMatter({ model, model_file: `src/model-catalogue/models/${model}.md`, model_version: MODEL_VERSION }),
  "# Process", "", "## Practices", "", "- none", "", "## Branches", "", "| Phase or time box | Branch |", "|---|---|", "", "## Definition of Done", "",
  "The job rules hold; no condition is added.", ""].join("\n");
const assignment = (rows) => ["# Role assignment", "", "## Roles", "", "| Role | Participants |", "|---|---|", ...rows.map(([role, who]) => `| ${role} | ${who} |`), ""].join("\n");

const REQUIREMENT = "EXPORT IS A PDF";
const SPEC = `# Spec\n\n## 1. Export\n\n**${REQUIREMENT}** *(PO A. Maier)*\nAn export is a PDF file.\n*Check:* \`tests/test_export.py\`\n`;
const useCase = (id, title) => [frontMatter({ id, title, realises: [REQUIREMENT] }), `# ${id} ${title}`, ""].join("\n");
const UC1 = "docs/use-cases/UC-001-store.md", UC2 = "docs/use-cases/UC-002-pages.md";

// The files every product has: SPEC.md with one requirement, two use cases that a record names the text of (accepted), the job workflow, the module MOD-store.
function commonFiles() {
  const files = { "SPEC.md": SPEC, [UC1]: useCase("UC-001", "Store"), [UC2]: useCase("UC-002", "Pages"), [WORKFLOW_FILE]: "name: agent-m-jobs\n",
    "docs/architecture/MOD-store.md": moduleFile("MOD-store") };
  for (const path of [UC1, UC2]) files[`docs/approvals/${path.split("/").pop().slice(0, 6)}-${blobOf(files[path]).slice(0, 12)}.md`] = "kind: use-case\n";
  return files;
}

// A Scrum product of team1 whose backlog holds ITM-004, ready and selected, and whose Developers are dev-ci.
function scrumFiles() {
  return { ...commonFiles(), "docs/process.md": declaration("scrum"),
    "docs/role-assignments/team1.md": assignment([["Product Owner", "alice"], ["Scrum Master", "alice"], ["Developers", "dev-ci"]]),
    "docs/backlog/ITM-004-feed.md": item("ITM-004", { realises: ["UC-001"] }),
    "docs/backlog/sprints/team1/01.md": sprintRecord(["ITM-004"]) };
}

// The same product before it has an architecture: no module file, so that the first architecture may be derived.
function scrumFilesWithoutArchitecture() {
  const files = scrumFiles();
  delete files["docs/architecture/MOD-store.md"];
  return files;
}

// A V-model product whose plan holds the step ITM-007 (docs/plan/ITM-007-store.md), in the phase Implementation.
function vModelFiles() {
  return { ...commonFiles(), "docs/process.md": declaration("v-model"),
    "docs/role-assignments/product.md": assignment([["Product owner", "alice"], ["Developer", "dev-ci"], ["Tester", "alice"], ["Reviewer", "alice"]]),
    "docs/plan/ITM-007-store.md": item("ITM-007", { realises: ["UC-001"] }),
    "docs/plan/order.md": ["# Plan", "", "## Order", "", "| Step | Phase |", "|---|---|", "| ITM-007 | Implementation |", ""].join("\n") };
}

// ---------------------------------------------------------------- the strategies, the network, the page

// The real sets of handOverStrategies, except the book's chapters: those four recipes of the register's set give no part. The real `source-excerpt` stays.
const chaptersGiveNothing = Object.fromEntries(["chapters-for-requirements", "chapters-for-tests", "chapters-for-architecture", "chapters-for-implementation", "chapters-for-page"]
  .map((name) => [name, async () => []]));
for (const set of handOverStrategies) {
  registerStrategies("tests/prompt-bar-hand-over-params.test.mjs", set === sourceStrategies
    ? { recipes: { "source-excerpt": sourceStrategies.recipes["source-excerpt"], ...chaptersGiveNothing } } : set);
}

const realFetch = globalThis.fetch;
const requests = [];
beforeEach(() => { requests.length = 0; globalThis.fetch = async (url) => { requests.push(String(url)); throw new Error(`no request may be made: ${url}`); }; });
afterEach(() => { globalThis.fetch = realFetch; });

// A page of the product: the instance with the register and the stored tokens, the product with its files. The hand-over `handOver` of dev-ci is assessed (the bar does that first) and queued.
async function handsOver(handOver, files = scrumFiles()) {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: new Storage() });
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: new Storage() });
  const store = openStore("alice/agent-m");
  writeSetting(store, "endpoint:ep1", { kind: "openai-compatible", url: "https://models.example/v1", model: "model-ci", key: "sk-fixture-KEY" });
  writeSetting(store, "github-token", { value: "github_pat_INSTANCE0123456789abcdef", name: "alice", expires: "2027-01-01" });
  writeSetting(store, "github-token:alice/thesis-tool", { value: "github_pat_PRODUCT0123456789abcdefg", name: "alice", expires: "2027-01-01" });
  const instance = repoOf(INSTANCE_WEB, { "SPEC.md": "# Instance spec\n", "docs/participants.md": register(ALICE, DEV_CI) });
  const product = repoOf(PRODUCT_WEB, files);
  const page = { address: PRODUCT_WEB, host: product.host };
  const instanceSetup = { repository: "alice/agent-m", host: instance.host };
  const handing = { task: TASK, ...handOver };
  const participant = (await readParticipants(await defaultSnapshot(instance.host))).find((each) => each.name === "dev-ci");
  const assessment = await assess({ handOver: handing, participant, instance: instanceSetup, page });
  const outcome = await queue({ handOver: handing, participant, assessment, store, instance: instanceSetup, page, ofProduct: true, conversation: null })
    .then((queued) => ({ queued }), (refusal) => ({ refusal }));
  assert.deepEqual(requests, [], "no request was made");
  return { ...outcome, assessment, product, instance };
}

// The parameters of the job record that the hand-over queued: the one fenced json block of its section "## Parameters".
function paramsOfRecord(it) {
  assert.equal(it.product.attempts.length, 1, "exactly one commit queued the job");
  const text = it.product.attempts[0].files[0].text;
  const section = /\n## Parameters\n\n```json\n([\s\S]*?)\n```/.exec(text);
  assert.ok(section, `the record has its Parameters: ${text}`);
  return JSON.parse(section[1]);
}
const NEVER_GIVEN = ["source", "resource", "kind", "entry", "part"];
const NOTHING_WRITTEN = "no commit was attempted and no workflow was started";
const nothingWritten = (it) => assert.equal(it.product.attempts.length + it.product.starts.length + it.instance.attempts.length, 0, NOTHING_WRITTEN);
const neverGiven = (params) => { for (const key of NEVER_GIVEN) assert.ok(!(key in params), `the bar gives no ${key}: ${JSON.stringify(params)}`); };

// ---------------------------------------------------------------- the kinds whose strategies read a parameter works_on gives

// TST-626001 · level: unit · module: MOD-prompt-bar
// guards: UC-019
// given: the Scrum product, whose use cases UC-001 and UC-002 are accepted and realise EXPORT IS A PDF; dev-ci, a Developer of team1 with the CI secret KEY_A, route ci hosted; known positive: the start rules let ITM-004 start (assess gives no reason for a hand-over of ITM-004)
// input: queue of the hand-over { kind: "change-use-case", works_on: ["UC-001"], task }
// expect: the job is queued (one commit, one started workflow) and its record's parameters are exactly { useCases: ["UC-001"], useCase: "UC-001" } — `useCase` is what MOD-approvals' recipe use-case-with-neighbours reads —, with none of source, resource, kind, entry and part; no request was made
test("a hand-over of change-use-case on one use case is queued with the parameter useCase beside useCases", async () => {
  const positive = await handsOver({ kind: "implement", works_on: ["ITM-004"] });
  assert.deepEqual(positive.assessment.reasons, [], "known positive: ITM-004 may start");
  const it = await handsOver({ kind: "change-use-case", works_on: ["UC-001"] });
  assert.equal(it.refusal, undefined, it.refusal?.message);
  assert.deepEqual(paramsOfRecord(it), { useCases: ["UC-001"], useCase: "UC-001" });
  neverGiven(paramsOfRecord(it));
  assert.equal(it.product.starts.length, 1);
  assert.deepEqual(requests, []);
});

// TST-626002 · level: unit · module: MOD-prompt-bar
// guards: UC-019
// given: the product of TST-626001; known positive: the hand-over of change-use-case on UC-001 alone is queued (TST-626001)
// input: queue of change-use-case on both use cases, ["UC-001", "UC-002"], and on none, ["EXPORT IS A PDF"]
// expect: both are refused at preparation by the strategy's own error, UseCaseNotFound, whose use case is undefined — the bar names no use case for two of them or for none —; nothing was queued: no commit,
//   no workflow
test("a hand-over of change-use-case on several use cases or on none is refused by UseCaseNotFound and queues nothing", async () => {
  const positive = await handsOver({ kind: "change-use-case", works_on: ["UC-001"] });
  assert.equal(positive.refusal, undefined, "known positive: one use case is queued");
  for (const worksOn of [["UC-001", "UC-002"], [REQUIREMENT]]) {
    const it = await handsOver({ kind: "change-use-case", works_on: worksOn });
    assert.equal(it.queued, undefined, `${JSON.stringify(worksOn)} is not queued`);
    assert.equal(it.refusal?.name, "UseCaseNotFound", it.refusal?.message);
    assert.equal(it.refusal.useCase, undefined);
    nothingWritten(it);
  }
});

// TST-626003 · level: unit · module: MOD-prompt-bar
// guards: UC-019
// given: the product of TST-626001
// input: queue of change-requirements on the requirement EXPORT IS A PDF, with no source of the person (works_on cannot give one)
// expect: refused at preparation by the kind's own precondition person-source (MOD-spec-changes): NotStartable, its finding under THE PERSON WHO PROMPTS IS A SOURCE; nothing was queued — no
//   commit —; no request was made
test("a hand-over of change-requirements without the person's own source is refused by the kind's precondition, and nothing is queued", async () => {
  const it = await handsOver({ kind: "change-requirements", works_on: [REQUIREMENT] });
  assert.equal(it.refusal?.name, "NotStartable", it.refusal?.message);
  assert.deepEqual(it.refusal.findings.map((each) => each.rule), ["THE PERSON WHO PROMPTS IS A SOURCE"]);
  assert.equal(it.product.attempts.length, 0);
  assert.deepEqual(requests, []);
});

// TST-626004 · level: unit · module: MOD-prompt-bar
// guards: UC-019
// given: the product of TST-626001, which links no source (it holds no docs/sources.md)
// input: queue of derive-requirements on the requirement EXPORT IS A PDF
// expect: refused at preparation by the strategy's own error, NotLinked, whose source is "" — MOD-source-register's recipe source-excerpt reads `source`, which works_on cannot give —; nothing was
//   queued: no commit, no workflow
test("a hand-over of derive-requirements, which needs a source works_on cannot give, is refused by NotLinked and queues nothing", async () => {
  const it = await handsOver({ kind: "derive-requirements", works_on: [REQUIREMENT] });
  assert.equal(it.queued, undefined);
  assert.equal(it.refusal?.name, "NotLinked", it.refusal?.message);
  assert.equal(it.refusal.source, "");
  nothingWritten(it);
});

// TST-626005 · level: unit · module: MOD-prompt-bar
// guards: UC-019
// given: the product of TST-626001
// input: queue of derive-use-cases on the requirement EXPORT IS A PDF and the use case UC-001
// expect: the job is queued and its record's parameters are exactly { requirements: ["EXPORT IS A PDF"], useCases: ["UC-001"], useCase: "UC-001" } — requirements and useCases are what MOD-approvals'
//   precondition rests-on-accepted and MOD-spec-changes' recipe chosen-requirements read — with none of source, resource, kind, entry and part
test("a hand-over of derive-use-cases is queued with the parameters requirements and useCases", async () => {
  const it = await handsOver({ kind: "derive-use-cases", works_on: [REQUIREMENT, "UC-001"] });
  assert.equal(it.refusal, undefined, it.refusal?.message);
  assert.deepEqual(paramsOfRecord(it), { requirements: [REQUIREMENT], useCases: ["UC-001"], useCase: "UC-001" });
  neverGiven(paramsOfRecord(it));
});

// TST-626006 · level: unit · module: MOD-prompt-bar
// guards: UC-019
// given: the Scrum product before it has an architecture (no module file); its use cases are accepted
// input: queue of derive-architecture on the use case UC-001
// expect: the job is queued and its record's parameters are exactly { useCases: ["UC-001"], useCase: "UC-001" }; the kind's strategies (architecture-ready, whole-spec, accepted-use-cases) read none
//   of them, and need none of source, resource, kind, entry and part, which the record lacks
test("a hand-over of derive-architecture is queued: its strategies read no parameter", async () => {
  const it = await handsOver({ kind: "derive-architecture", works_on: ["UC-001"] }, scrumFilesWithoutArchitecture());
  assert.equal(it.refusal, undefined, it.refusal?.message);
  assert.deepEqual(paramsOfRecord(it), { useCases: ["UC-001"], useCase: "UC-001" });
  neverGiven(paramsOfRecord(it));
});

// TST-626007 · level: unit · module: MOD-prompt-bar
// guards: UC-019
// given: the product of TST-626001
// input: queue of review-architecture on the use case UC-001
// expect: the job is queued and its record's parameters are exactly { useCases: ["UC-001"], useCase: "UC-001" }; the kind's strategies read only the draft, which the bar does not give
test("a hand-over of review-architecture is queued: its strategies read no parameter the bar gives", async () => {
  const it = await handsOver({ kind: "review-architecture", works_on: ["UC-001"] });
  assert.equal(it.refusal, undefined, it.refusal?.message);
  assert.deepEqual(paramsOfRecord(it), { useCases: ["UC-001"], useCase: "UC-001" });
  neverGiven(paramsOfRecord(it));
  assert.ok(!("draft" in paramsOfRecord(it)));
});

// TST-626008 · level: unit · module: MOD-prompt-bar
// guards: UC-019
// given: the Scrum product, whose backlog holds ITM-004 (no docs/plan); it realises UC-001
// input: queue of implement, and of refactor, on the item ITM-004
// expect: both are queued and their records' parameters are exactly { items: ["ITM-004"] } — what MOD-run-planner's recipe implementation-inputs reads for a backlog item —, with no steps and none of
//   source, resource, kind, entry and part
test("a hand-over of implement or refactor on a backlog item is queued with the parameter items", async () => {
  for (const kind of ["implement", "refactor"]) {
    const it = await handsOver({ kind, works_on: ["ITM-004"] });
    assert.equal(it.refusal, undefined, `${kind}: ${it.refusal?.message}`);
    assert.deepEqual(paramsOfRecord(it), { items: ["ITM-004"] }, kind);
    neverGiven(paramsOfRecord(it));
  }
});

// TST-626009 · level: unit · module: MOD-prompt-bar
// guards: UC-019
// given: a V-model product whose plan holds the step ITM-007 (docs/plan/ITM-007-store.md) and no backlog
// input: queue of implement, and of refactor, on the step ITM-007
// expect: both are queued and their records' parameters are exactly { steps: ["ITM-007"] } — what MOD-run-planner's recipe implementation-inputs and MOD-runtimes' writer branch-and-pull-request read
//   for a plan step —, with no items and none of source, resource, kind, entry and part
test("a hand-over of implement or refactor on a plan step is queued with the parameter steps", async () => {
  for (const kind of ["implement", "refactor"]) {
    const it = await handsOver({ kind, works_on: ["ITM-007"] }, vModelFiles());
    assert.equal(it.refusal, undefined, `${kind}: ${it.refusal?.message}`);
    assert.deepEqual(paramsOfRecord(it), { steps: ["ITM-007"] }, kind);
    neverGiven(paramsOfRecord(it));
  }
});

// TST-626010 · level: unit · module: MOD-prompt-bar
// guards: UC-019
// given: the Scrum product of TST-626008; known positive: implement on ITM-004 is queued (TST-626008)
// input: queue of implement on the use case UC-001 alone
// expect: refused at preparation by the strategy's own error, NoWorkNamed — the bar gives neither items nor steps for a use case —; nothing was queued: no commit, no workflow
test("a hand-over of implement that works on no item or step is refused by NoWorkNamed and queues nothing", async () => {
  const positive = await handsOver({ kind: "implement", works_on: ["ITM-004"] });
  assert.equal(positive.refusal, undefined, "known positive");
  const it = await handsOver({ kind: "implement", works_on: ["UC-001"] });
  assert.equal(it.queued, undefined);
  assert.equal(it.refusal?.name, "NoWorkNamed", it.refusal?.message);
  nothingWritten(it);
});

// TST-626011 · level: unit · module: MOD-prompt-bar
// guards: UC-019
// given: the product of TST-626001, which declares no resource
// input: queue of check-resource on the name "Cluster"
// expect: refused at preparation by the strategy's own error, ResourceNotNamed — MOD-resource-list's recipe resource-check reads `resource`, which works_on cannot give —; nothing was queued: no commit,
//   no workflow
test("a hand-over of check-resource, which needs a resource works_on cannot give, is refused by ResourceNotNamed and queues nothing", async () => {
  const it = await handsOver({ kind: "check-resource", works_on: ["Cluster"] });
  assert.equal(it.queued, undefined);
  assert.equal(it.refusal?.name, "ResourceNotNamed", it.refusal?.message);
  nothingWritten(it);
});

// TST-626012 · level: unit · module: MOD-prompt-bar
// guards: UC-019; UC-049
// given: the product of TST-626001
// input: queue of converse on the use case UC-001
// expect: the job is queued and its record's parameters are exactly { useCases: ["UC-001"], useCase: "UC-001" }; the kind's strategies read `page` and `entry`, which the bar does not give, and the
//   record lacks them; the job is queued all the same, since a missing page or entry is no error of a recipe
test("a hand-over of converse is queued without the page and the entry its strategies read", async () => {
  const it = await handsOver({ kind: "converse", works_on: ["UC-001"] });
  assert.equal(it.refusal, undefined, it.refusal?.message);
  assert.deepEqual(paramsOfRecord(it), { useCases: ["UC-001"], useCase: "UC-001" });
  assert.ok(!("page" in paramsOfRecord(it)));
  neverGiven(paramsOfRecord(it));
});
