// MOD-implementation-pages' route `implement` for a model that plans its work — choosing the participants and starting the jobs of the selected steps (ITM-733), as the accepted text of
// docs/architecture/MOD-implementation-pages.md states it: "`implement` — … the participants that hold the implementing role in the item's role assignment and can write and run tests, the attempt limit, who merges, the
// target branch, the gates the jobs will meet and who decides them; *Start jobs*, which queues each job on its participant's route — handed to a Bridge at once where the route is one", and UC-024 steps 5 to 7, 3a, 5a, 7a
// and 7b. It continues tests/implementation-pages-implement-plan.test.mjs (ITM-732), whose fixture it copies in part.
// Run: node --test tests/implementation-pages-implement-plan-start.test.mjs
//
// Module: MOD-implementation-pages
// Guards: UC-024; A JOB GOES ONLY TO A HOLDER OF ITS ROLE; A PARTICIPANT DECLARES ITS CAPABILITIES; A PARTICIPANT DECLARES WHERE IT PROCESSES DATA; A GATE NAMES WHO DECIDES IT
// Guards: WORK MERGES INTO THE DEFAULT BRANCH UNLESS A BRANCH IS SET; A PHASE OR A TIME BOX MAY HAVE A BRANCH OF ITS OWN; A JOB IS RECORDED IN ITS PRODUCT REPOSITORY; THE PAGE NAMES WHERE IT SENDS; ONE CLICK PER DECISION
// Guards: A REFACTORING JOB BEGINS WITHOUT A FAILING TEST
// Level: unit
//
// The product is the V-model fixture of ITM-732 (the steps ITM-012 and ITM-010 of the phase Testing ready and ticked); the role assignment gives dev-a and dev-c the roles Developer and Tester; dev-b is registered and holds
// none; dev-c lacks run code and tests. The kind `implement` and `refactor` are stood in for: their recipes give one part each. The host keeps every commit. `fetch` is a spy that refuses. Readings the texts leave
// open, which the tests state (the pull request names them):
//   - For each ticked step the page shows <div data-job-of="<step>"> with <select data-participant-of> (the holders of the implementing role with both capabilities), <p data-places-of> (where each processes data),
//     <input data-limit-of> (the attempt limit), <select data-merges-of> (`agent` or `person`), <input type="checkbox" data-refactor-of> (3a), <p data-branch-of> (the target branch), <p data-gates-of> (the gates from the step's phase on,
//     with their deciders), <div data-sent-of> (what is sent where); with no holder that can implement, <p data-none-of> beside the step's reasons, with a link to #participants (5a).
//   - The target branch is the default branch, or the declaration's branch for the step's phase as declared (MOD-work-plans' targetBranch; ITM-1171).
//   - Start jobs is <button data-start-jobs>; its outcome <div data-start-result>. A start record is docs/jobs/JOB-<stamp>-<4 hex>.md; `kind: refactor` when *refactoring* is ticked; the attempt limit is its `limit`; who merges is
//     `merges` in its parameters. A route that does not answer is named and the job is not started (7a); a token that may not start workflows gives <a data-run-workflow> to the workflow's page with the job's inputs named (7b).
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import "./site-frame-dom.mjs";
const { view } = await import("../src/implementation-pages/index.mjs");
const { registerStrategies } = await import("../src/job-runner/index.mjs");
const { openStore } = await import("../src/browser-store/index.mjs");
const kept = new Map();
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key) => (kept.has(key) ? kept.get(key) : null), setItem: (key, value) => { kept.set(key, String(value)); }, removeItem: (key) => { kept.delete(key); },
  key: (at) => [...kept.keys()][at] ?? null, get length() { return kept.size; } } });
const route = view.routes.find((candidate) => candidate.name === "implement");

const fetched = [];
globalThis.fetch = async (address) => { fetched.push(String(address)); throw new Error(`the test's network refuses ${address}`); };
test.afterEach(() => { assert.deepEqual(fetched.splice(0), [], "no request left the fixtures"); });

const matches = (element, selector) => {
  const attribute = /^\[([a-z-]+)(?:="([^"]*)")?\]$/.exec(selector);
  return attribute ? (attribute[2] === undefined ? element.getAttribute(attribute[1]) !== null : element.getAttribute(attribute[1]) === attribute[2]) : element.localName === selector;
};
const found = (root, selector) => {
  const all = [];
  (function walk(node) { for (const child of node.childNodes) if (child.nodeType === 1) { if (matches(child, selector)) all.push(child); walk(child); } })(root);
  return all;
};
globalThis.window.Element.prototype.querySelectorAll = function querySelectorAll(selector) { return found(this, selector); };
globalThis.window.Element.prototype.querySelector = function querySelector(selector) { return found(this, selector)[0] ?? null; };
const text = (node) => node.textContent.replace(/\s+/g, " ").trim();

// ---------------------------------------------------------------- the fixture product
const lines = (...rows) => `${rows.join("\n")}\n`;
const blobOf = (content) => createHash("sha1").update(content).digest("hex");
const ADDRESS = "https://github.com/acme/product";
const MODEL_VERSION = "5".repeat(40);
const decision = (id, extra) => lines("---", `id: ${id}`, `title: ${id} decision`, ...extra, "---", `# ${id} decision`, "", "## Context", "", "c", "", "## Decision", "", "d", "", "## Alternatives", "", "a", "", "## Consequences", "", "q");
const module_ = (id) => lines("---", `id: ${id}`, `title: ${id}`, `folder: src/${id.slice(4)}/`, "realises:", "follows:", "  - ARC-002", "uses: []", "provides:", "  - f", "---", `# ${id} ${id}`, "", "## Responsibility", "", "r", "",
  "## Parts", "", "p", "", "## Data", "", "d", "", "## Interfaces", "", "- `f` — i", "", "## Files", "", "f", "", "## Uses", "", "u");
const step = (id, title, extra = []) => lines("---", `id: ${id}`, `title: ${title}`, "level: module", "realises:", "  - UC-001", "modules:", "  - MOD-reader", ...extra, "tests:", "  - unit", "origin:", "  - UC-001", "---",
  `# ${id} ${title}`, "", "## Outcome", "", "o", "", "## Acceptance", "", "a");
const declaration = (model) => lines("---", `model: ${model}`, `model_file: src/model-catalogue/models/${model}.md`, `model_version: ${MODEL_VERSION}`, "---", "# Process", "", "## Practices", "", "- none", "", "## Branches", "",
  "| Phase or time box | Branch |", "|---|---|", "| Implementation | work/<item> |", "| Testing | test/<item> |", "", "## Definition of Done", "", "The job rules hold; no condition is added.");
const USE_CASE = "docs/use-cases/UC-001-load.md";
const ARCHITECTURE = {
  "docs/architecture/ARC-001-whole.md": decision("ARC-001", ["forced_by:", "  - UC-001"]),
  "docs/architecture/ARC-002-sub.md": decision("ARC-002", ["refines: ARC-001", "forced_by:", "  - UC-001", "designs:", "  - MOD-reader", "  - MOD-writer"]),
  "docs/architecture/MOD-reader.md": module_("MOD-reader"), "docs/architecture/MOD-writer.md": module_("MOD-writer"),
};
const PLAN = {
  "docs/plan/ITM-010-reader.md": step("ITM-010", "Read the store"), "docs/plan/ITM-011-writer.md": step("ITM-011", "Write the store", ["builds_on:", "  - ITM-010"]),
  "docs/plan/ITM-012-loose.md": step("ITM-012", "Loose ends"), "docs/plan/ITM-013-gated.md": step("ITM-013", "Gated work"),
  "docs/plan/order.md": lines("## Order", "", "| Step | Phase |", "| --- | --- |", "| ITM-012 | Testing |", "| ITM-010 | Testing |", "| ITM-011 | Implementation |", "| ITM-013 | Implementation |"),
};
const ASSIGNMENT = lines("# Product", "", "## Roles", "", "| Role | Participants |", "|---|---|", "| Product owner | alice |", "| Developer | dev-a, dev-c |", "| Tester | dev-a, dev-c |", "| Reviewer | alice |");

function productFiles({ model = "v-model", plan = true, declared = true, later = false } = {}) {
  const files = { "SPEC.md": "# Fixture\n", ...(declared ? { "docs/process.md": declaration(model) } : {}), [USE_CASE]: "# UC-001 load\n", ...ARCHITECTURE, ...(plan ? PLAN : {}), "docs/role-assignments/product.md": ASSIGNMENT, ".github/workflows/agent-m-jobs.yml": "name: agent-m jobs\n" };
  if (later) {
    // A ready step of a later phase: no gate stands before Validation & Verification, and it builds on nothing.
    files["docs/plan/ITM-014-later.md"] = step("ITM-014", "Later work");
    files["docs/plan/order.md"] = PLAN["docs/plan/order.md"] + "| ITM-014 | Validation & Verification |\n";
  }
  for (const path of Object.keys(files).filter((each) => each === USE_CASE || each.startsWith("docs/architecture/"))) {
    files[`docs/approvals/${/(ARC-\d+|MOD-[a-z]+|UC-\d+)/.exec(path)[1]}-${blobOf(files[path]).slice(0, 12)}.md`] = "kind: record\n";
  }
  return files;
}

const ROOT = new URL("../", import.meta.url);
const HEAD = readFileSync(new URL("docs/participants.md", ROOT), "utf8").split("\n").filter((row, at, all) => at <= all.findIndex((each) => each.startsWith("|---"))).join("\n");
const REGISTER = `${HEAD}\n| dev-a | model endpoint | model-a | 200000 | — | read the repository, write to the repository, run code and tests, use tools | this machine | ci hosted secret DEV_KEY |
| dev-b | model endpoint | model-b | 200000 | — | read the repository, write to the repository, run code and tests, use tools | this machine | ci hosted secret DEV_KEY |
| dev-c | model endpoint | model-c | 200000 | — | read the repository, write to the repository | a server in Singapore | ci hosted secret DEV_KEY |\n`;

// The strategies the kinds name: stand-ins, as tests/implementation-pages-implement.test.mjs has them.
const part = (name) => ({ name, text: name, size: 0, sources: [], required: true });
registerStrategies("tests/implementation-pages-implement-plan-start.test.mjs", {
  recipes: { "implementation-inputs": async (_, params) => [part(`inputs of ${(params.steps ?? params.items ?? []).join(", ")}`)], "chapters-for-implementation": async () => [part("chapters 9, 11, 12 and 13")],
    "resource-pins": async () => [] },
  preconditions: { "rests-on-accepted": async () => [] },
  writers: { "branch-and-pull-request": async () => ({ commits: [], files: [], pullRequest: null, shown: null, notes: [] }) },
});

// A host of this file's own: the part of MOD-repository-hosts' interface the route uses, keeping every commit; `failure` makes commitFiles fail as a token that may not write.
function hostOf(files, commits, failure = null) {
  let head = 0;
  const tree = new Map(Object.entries(files));
  const snapshot = () => ({ repository: { server: "github", path: "acme/product", web: ADDRESS }, ref: "main", commit: String(head).padStart(40, "c"), paths: [...tree.keys()],
    blob: (path) => (tree.has(path) ? blobOf(tree.get(path)) : null), read: async (path) => (tree.has(path) ? tree.get(path) : null) });
  return {
    async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite: true, archived: false, description: "" }; },
    async readSnapshot() { return snapshot(); }, async listPullRequests() { return []; }, async containsCommit() { return false; },
    async commitFiles(change) {
      if (failure) throw failure;
      commits.push(structuredClone(change));
      head += 1;
      for (const file of change.files) tree.set(file.path, file.text);
      return { commit: String(head).padStart(40, "c"), url: `${ADDRESS}/commit/${head}` };
    },
  };
}
async function render(files, { register = REGISTER, failure = null, store = {} } = {}) {
  const commits = [];
  const instance = hostOf({ "SPEC.md": "# Instance\n", "docs/participants.md": register }, [], null);
  const context = { page: "review", instance: { repository: "acme/agent-m", host: instance }, product: { address: ADDRESS, kind: "github", host: hostOf(files, commits, failure), tokenStored: true }, store, go() {} };
  const target = document.createElement("div");
  document.body.append(target);
  globalThis.mermaid = { initialize() {}, mermaidAPI: { getDiagramFromText: async () => ({ db: { getVertices: () => ({}) } }) }, run: async () => {} };
  try { await route.render(target, context, {}); } finally { delete globalThis.mermaid; }
  return { target, commits };
}
const rowOf = (target, id) => found(target, `[data-step="${id}"]`)[0];
const tickOf = (target, id) => found(rowOf(target, id), "[data-select-step]")[0];
const ticked = (box) => box.getAttribute("disabled") === null && (box.checked === undefined ? box.getAttribute("checked") !== null : box.checked === true);
const reasons = (target, id) => found(rowOf(target, id), "[data-reasons]").map(text).join(" ");


const jobOf = (target, step) => found(target, `[data-job-of="${step}"]`)[0];
const trusted = () => Object.defineProperty(new Event("click"), "isTrusted", { value: true });
const settle = async () => { for (let turn = 0; turn < 60; turn += 1) await new Promise((resolve) => setImmediate(resolve)); };
const startRecords = (commits) => commits.flatMap((commit) => commit.files).filter((file) => /^docs\/jobs\/JOB-/.test(file.path));

// TST-733001 · level: unit · module: MOD-implementation-pages
// guards: UC-024; A JOB GOES ONLY TO A HOLDER OF ITS ROLE; A PARTICIPANT DECLARES ITS CAPABILITIES; A PARTICIPANT DECLARES WHERE IT PROCESSES DATA
// given: the V-model fixture, ITM-012 and ITM-010 ticked; dev-a holds Developer and Tester with every capability, dev-c holds both but lacks run code and tests, dev-b has every capability and holds no role
// input: the route implement's render
// expect: for ITM-012 only dev-a is offered, with where it processes data (this machine); neither dev-c nor dev-b is offered; nothing is committed
test("for each selected step only the holders of the implementing role with both capabilities are offered, each with where it processes data", async () => {
  const { target, commits } = await render(productFiles());
  const offered = text(found(jobOf(target, "ITM-012"), `[data-participant-of="ITM-012"]`)[0]);
  assert.match(offered, /dev-a/);
  assert.doesNotMatch(offered, /dev-b|dev-c/);
  assert.match(text(found(jobOf(target, "ITM-012"), "[data-places-of]")[0]), /dev-a[^]*this machine/);
  assert.ok(jobOf(target, "ITM-010"), "every selected step has its own choice");
  assert.equal(commits.length, 0, "without Start jobs nothing is committed");
});

// TST-733002 · level: unit · module: MOD-implementation-pages
// guards: UC-024; WORK MERGES INTO THE DEFAULT BRANCH UNLESS A BRANCH IS SET; A PHASE OR A TIME BOX MAY HAVE A BRANCH OF ITS OWN; A GATE NAMES WHO DECIDES IT; THE PAGE NAMES WHERE IT SENDS
// given: the same page, the declaration setting the branch test/<item> for the phase Testing
// input: the route's render
// expect: ITM-012 names the target branch test/<item>, as the declaration writes it, the attempt limit, who merges (a choice) and refactoring (a tick, not ticked); the gates from its phase on with their deciders — Validation & Verification → Operation & Maintenance, decided by Reviewer —; what is sent where names dev-a and the part inputs of ITM-012
test("a selected step names its target branch, the attempt limit, who merges, the gates with their deciders and what is sent where", async () => {
  const { target } = await render(productFiles());
  const job = jobOf(target, "ITM-012");
  assert.match(text(found(job, "[data-branch-of]")[0]), /Target branch: test\/<item>$/);
  assert.match(String(found(job, "[data-limit-of]")[0].getAttribute("value") ?? found(job, "[data-limit-of]")[0].value), /\d+/);
  assert.ok(found(job, "[data-merges-of]")[0], "who merges is chosen");
  assert.equal(found(job, "[data-refactor-of]")[0].getAttribute("checked"), null, "refactoring is not ticked");
  assert.match(text(found(job, "[data-gates-of]")[0]), /Validation & Verification → Operation & Maintenance \(decided by Reviewer\)/);
  const sent = text(found(job, "[data-sent-of]")[0]);
  assert.match(sent, /dev-a/);
  assert.match(sent, /inputs of ITM-012/);
});

// TST-733003 · level: unit · module: MOD-implementation-pages
// guards: UC-024; A JOB IS RECORDED IN ITS PRODUCT REPOSITORY; ONE CLICK PER DECISION; A REFACTORING JOB BEGINS WITHOUT A FAILING TEST
// given: the page with ITM-012 and ITM-010 ticked; the attempt limit of ITM-012 set to 3 and who merges to a person; refactoring ticked for ITM-010
// input: a click a script makes on Start jobs; then a click of a person
// expect: the script's click commits nothing; the person's commits one start record per step — ITM-012's of kind implement with the limit 3 and merges person, ITM-010's of kind refactor — each naming dev-a
test("Start jobs commits one start record per selected step with the attempt limit, who merges and the kind refactor when ticked, on a person's click only", async () => {
  const { target, commits } = await render(productFiles());
  found(jobOf(target, "ITM-012"), "[data-limit-of]")[0].value = "3";
  found(jobOf(target, "ITM-012"), "[data-merges-of]")[0].value = "person";
  const refactor = found(jobOf(target, "ITM-010"), "[data-refactor-of]")[0];
  refactor.checked = true;
  found(target, "[data-start-jobs]")[0].dispatchEvent(new Event("click"));
  await settle();
  assert.equal(commits.length, 0, "a script's click starts nothing");
  found(target, "[data-start-jobs]")[0].dispatchEvent(trusted());
  for (let turn = 0; turn < 300 && startRecords(commits).length < 2; turn += 1) await new Promise((resolve) => setImmediate(resolve));
  const records = startRecords(commits);
  assert.equal(records.length, 2, "one start record per step");
  const of = (step) => records.find((record) => new RegExp(`works_on:[^]*${step}`).test(record.text));
  assert.match(of("ITM-012").text, /kind: implement/);
  assert.match(of("ITM-012").text, /limit: 3/);
  assert.match(of("ITM-012").text, /merges/);
  assert.match(of("ITM-012").text, /person/);
  assert.match(of("ITM-010").text, /kind: refactor/);
  for (const record of records) assert.match(record.text, /participant: dev-a/);
});

// TST-733004 · level: unit · module: MOD-implementation-pages
// guards: UC-024; A JOB GOES ONLY TO A HOLDER OF ITS ROLE
// given: the role assignment gives the roles only to dev-c, which cannot run tests
// input: the route's render
// expect: the step says, beside its reasons, that no participant can write and run tests and links to #participants; no start record is committed by a click on Start jobs
test("a step no participant can implement says so and links to the participants", async () => {
  const noDev = productFiles();
  noDev["docs/role-assignments/product.md"] = ASSIGNMENT.replaceAll("dev-a, dev-c", "dev-c");
  const { target, commits } = await render(noDev);
  const none = found(rowOf(target, "ITM-012"), "[data-none-of]")[0];
  assert.match(text(none), /No participant can write and run tests/);
  assert.ok(found(none, "a").some((link) => link.getAttribute("href") === "#participants"));
  found(target, "[data-start-jobs]")[0].dispatchEvent(trusted());
  await settle();
  assert.equal(startRecords(commits).length, 0);
});

// TST-733005 · level: unit · module: MOD-implementation-pages
// guards: UC-024; A JOB IS RECORDED IN ITS PRODUCT REPOSITORY
// given: dev-a is reached through a Bridge named lab-pc that is not connected
// input: a click of a person on Start jobs
// expect: the result names the Bridge lab-pc as the reason, and no start record is committed
test("a Bridge that does not answer is named and nothing is started", async () => {
  const register = REGISTER.replace("ci hosted secret DEV_KEY |\n| dev-b", "bridge lab-pc agent claude |\n| dev-b");
  const { target, commits } = await render(productFiles(), { register, store: openStore("acme/agent-m") });
  found(target, "[data-start-jobs]")[0].dispatchEvent(trusted());
  await settle();
  assert.match(text(found(target, "[data-start-result]")[0]), /lab-pc/);
  assert.equal(startRecords(commits).length, 0);
});

// TST-733006 · level: unit · module: MOD-implementation-pages
// guards: UC-024
// given: the host refuses the commit as a token that may not start workflows does
// input: a click of a person on Start jobs
// expect: the result gives a link to the workflow's Run workflow page (the repository's actions) and names the job's inputs — its identifier, the kind and the participant dev-a
test("a token that may not start workflows leads to the workflow's Run workflow page with the job's inputs named", async () => {
  const refused = Object.assign(new Error("Resource not accessible by personal access token"), { name: "PermissionMissing" });
  const { target } = await render(productFiles(), { failure: refused });
  found(target, "[data-start-jobs]")[0].dispatchEvent(trusted());
  await settle();
  const run = found(target, "[data-run-workflow]")[0];
  assert.ok(run, "a link to the workflow's page");
  assert.match(run.getAttribute("href"), /acme\/product\/actions/);
  assert.match(text(found(target, "[data-start-result]")[0]), /JOB-[^ ]+[^]*dev-a/);
});
