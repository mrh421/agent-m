// MOD-implementation-pages' route `implement` for a model that plans its work — the steps of the plan (ITM-732), as the accepted text of docs/architecture/MOD-implementation-pages.md states it:
// "`implement` — the steps of the plan or the ready items, each with its state and, if it cannot start, the reasons", and UC-024 steps 1 to 3, 1a, 1b, 2a and 2b: the route the model prescribes with the
// table and a folded What is this?; the steps in the plan's order, each with its derived state (itemStates) and its phase; the ready steps of the current phase preselected; a waiting step not selectable, a step
// of a phase whose closing gate is not recorded not selectable, naming the gate and its decider; the selection narrowed down to one step. Choosing the participants and Start jobs are ITM-733's.
// Run: node --test tests/implementation-pages-implement-plan.test.mjs
//
// Module: MOD-implementation-pages
// Guards: UC-024; A PLANNED MODEL IMPLEMENTS ITS IMPLEMENTATION PLAN; THE MODEL DETERMINES THE PHASES AND THE GATES; NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// Guards: AN IMPLEMENTATION PLAN ASSEMBLES THE SYSTEM FROM ITS MODULES; EVERY STEP EXPLAINS ITSELF
// Level: unit
//
// The product is the V-model fixture of tests/implementation-pages-plan.test.mjs (copied in part), held in memory behind a host of this file's own; the instance holds the register with one developer, dev-a, whom the
// product's role assignment gives the role Developer. `fetch` is a spy that refuses: no request leaves the fixtures. Readings the texts leave open, which the tests state (the pull request names them):
//   - Each step is a <tr data-step data-state data-phase>; its phase is the one the plan's order gives it; <input data-select-step> ticks it, disabled for a step that cannot start, whose reasons are the <li> of
//     <ul data-reasons>; <p data-selected> says how many steps are selected.
//   - The current phase is the phase of the first step, in the plan's order, that is not done; the ready, startable steps of that phase are ticked.
//   - A missing process model or a missing plan is <p data-missing> naming what is missing, with <a href="#process"> and <a href="#plan">; a model that works from a backlog has <a data-backlog-link href="#backlog">.
//   - ITM-1170: where repositoryInfo gives greenToMerge false, the page says so in one <p data-green-to-merge> with a link to the host's webLinks branchProtection (UC-024 12a).
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import "./site-frame-dom.mjs";
const { view } = await import("../src/implementation-pages/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "implement");
const { endedJob, REJECTED } = await import("./implementation-pages-ended-job.mjs");

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
  "| Phase or time box | Branch |", "|---|---|", "| Implementation | work/<item> |", "", "## Definition of Done", "", "The job rules hold; no condition is added.");
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
const ASSIGNMENT = lines("# Product", "", "## Roles", "", "| Role | Participants |", "|---|---|", "| Product owner | alice |", "| Developer | dev-a |", "| Tester | dev-a |", "| Reviewer | alice |");

function productFiles({ model = "v-model", plan = true, declared = true, later = false } = {}) {
  const files = { "SPEC.md": "# Fixture\n", ...(declared ? { "docs/process.md": declaration(model) } : {}), [USE_CASE]: "# UC-001 load\n", ...ARCHITECTURE, ...(plan ? PLAN : {}), "docs/role-assignments/product.md": ASSIGNMENT };
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
const REGISTER = `${HEAD}\n| dev-a | model endpoint | model-a | 200000 | — | read the repository, write to the repository, run code and tests, use tools | this machine | ci hosted secret DEV_KEY |\n`;

function snapshotOf(files, web, commits) {
  return { repository: { server: "github", path: "acme/product", web }, ref: "main", commit: "c".repeat(40), paths: Object.keys(files), blob: (path) => (Object.hasOwn(files, path) ? blobOf(files[path]) : null),
    read: async (path) => (Object.hasOwn(files, path) ? files[path] : null), commits };
}
// `greenToMerge` is what the hosts' repositoryInfo gives (ITM-1170); webLinks gives the server's page for branch protection.
const BRANCH_PROTECTION = `${ADDRESS}/settings/branches`;
async function render(files, { greenToMerge = null } = {}) {
  const commits = [];
  const hostOf = (shot) => ({ async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite: true, archived: false, description: "", greenToMerge }; }, async readSnapshot() { return shot; },
    webLinks() { return { actions: `${shot.repository.web}/actions`, branchProtection: `${shot.repository.web}/settings/branches` }; },
    // The file at each commit, as the one snapshot holds it (MOD-repository-hosts' readFileAt), for the declared model the route reads (ITM-1264).
    async readFileAt(path, at) { const held = await shot.read(path); return new Map(at.map((commit) => [commit, held])); },
    async listPullRequests() { return []; }, async containsCommit() { return false; }, async commitFiles(change) { commits.push(change); throw new Error("a render writes nothing"); } });
  const product = snapshotOf(files, ADDRESS), instance = snapshotOf({ "SPEC.md": "# Instance\n", "docs/participants.md": REGISTER }, "https://github.com/acme/agent-m");
  const context = { page: "review", instance: { repository: "acme/agent-m", host: hostOf(instance) }, product: { address: ADDRESS, kind: "github", host: hostOf(product), tokenStored: true }, store: {}, go() {} };
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

// TST-732001 · level: unit · module: MOD-implementation-pages
// guards: UC-024; A PLANNED MODEL IMPLEMENTS ITS IMPLEMENTATION PLAN; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: a V-model product with an accepted architecture and a plan of four steps whose order puts ITM-012 and ITM-010 in Testing and ITM-011 and ITM-013 in Implementation; ITM-011 builds on ITM-010
// input: the route implement's render
// expect: the steps stand in the plan's order ITM-012, ITM-010, ITM-011, ITM-013, with the states ready, ready, waiting for an item it builds on, waiting, and the phases of the order; nothing is committed
test("the implement page of a planned model lists the steps in the plan's order with their state and phase", async () => {
  const { target, commits } = await render(productFiles());
  const steps = found(target, "[data-step]");
  assert.deepEqual(steps.map((each) => each.getAttribute("data-step")), ["ITM-012", "ITM-010", "ITM-011", "ITM-013"]);
  assert.deepEqual(steps.map((each) => each.getAttribute("data-state")), ["ready", "ready", "waiting for an item it builds on", "waiting"]);
  assert.deepEqual(steps.map((each) => each.getAttribute("data-phase")), ["Testing", "Testing", "Implementation", "Implementation"]);
  assert.equal(commits.length, 0, "a render writes nothing");
});

// TST-732002 · level: unit · module: MOD-implementation-pages
// guards: UC-024; NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED; THE MODEL DETERMINES THE PHASES AND THE GATES
// given: the product of TST-732001, whose gate Design → Implementation, decided by the Reviewer, has no record
// input: the route's render
// expect: the ready steps of the current phase, Testing — ITM-012 and ITM-010 — are ticked; ITM-011 is not selectable and its reason names ITM-010 (2a); ITM-013 is not selectable and its reason names the gate Design → Implementation and its decider, the Reviewer (2b)
test("the ready steps of the current phase are ticked; a waiting step and a step behind an unrecorded gate are not selectable, with their reasons", async () => {
  const { target } = await render(productFiles());
  assert.equal(ticked(tickOf(target, "ITM-012")), true);
  assert.equal(ticked(tickOf(target, "ITM-010")), true);
  for (const id of ["ITM-011", "ITM-013"]) assert.notEqual(tickOf(target, id).getAttribute("disabled"), null, `${id} cannot be ticked`);
  assert.match(reasons(target, "ITM-011"), /ITM-010/);
  assert.match(reasons(target, "ITM-013"), /Design → Implementation/);
  assert.match(reasons(target, "ITM-013"), /Reviewer/);
});

// TST-732003 · level: unit · module: MOD-implementation-pages
// guards: UC-024
// given: the product of TST-732001, its two ready steps ticked
// input: the person unticks ITM-012
// expect: the page says one step is selected; ITM-010 stays ticked (the selection narrows down to one step)
test("the author narrows the selection down to one step", async () => {
  const { target } = await render(productFiles());
  assert.match(text(found(target, "[data-selected]")[0]), /2 steps selected/);
  const box = tickOf(target, "ITM-012");
  box.checked = false;
  box.dispatchEvent(new Event("change"));
  assert.match(text(found(target, "[data-selected]")[0]), /1 step selected/);
  assert.equal(ticked(tickOf(target, "ITM-010")), true);
});

// TST-732004 · level: unit · module: MOD-implementation-pages
// guards: UC-024; EVERY STEP EXPLAINS ITSELF
// given: a product without a declared process model; one with a V-model and no plan; one whose model works from a backlog; and the planned product
// input: the route's render for each
// expect: the first names the missing process model and links #process; the second says no plan is saved and links #plan and #process, and lists no step; the third links #backlog; every page holds the folded What is this? of the route the model prescribes
test("without a model or without a plan nothing starts and what is missing is named; a backlog model links to the backlog", async () => {
  const none = await render(productFiles({ declared: false }));
  assert.match(text(found(none.target, "[data-missing]")[0]), /process model/);
  assert.ok(found(none.target, "a").some((link) => link.getAttribute("href") === "#process"));
  const noPlan = await render(productFiles({ plan: false }));
  assert.match(text(found(noPlan.target, "[data-missing]")[0]), /plan/);
  assert.ok(found(noPlan.target, "a").some((link) => link.getAttribute("href") === "#plan"));
  assert.equal(found(noPlan.target, "[data-step]").length, 0);
  const scrum = await render(productFiles({ model: "scrum" }));
  assert.ok(found(scrum.target, "[data-backlog-link]").length >= 1, "a model that works from a backlog links to the backlog");
  for (const { target } of [none, noPlan, scrum, await render(productFiles())]) assert.ok(found(target, "details").some((each) => /What is this\?/.test(text(each))), "the folded What is this?");
});

// TST-732005 · level: unit · module: MOD-implementation-pages
// guards: UC-024; A PLANNED MODEL IMPLEMENTS ITS IMPLEMENTATION PLAN
// given: the product of TST-732001 and a fifth step ITM-014, ready and with no gate before its phase, Validation & Verification, a phase after the current one
// input: the route's render
// expect: ITM-014 is ready and may be ticked by the author, but is not preselected; the ready steps of the current phase, Testing, still are (the counter-proof of TST-732002: only the current phase is preselected)
test("a ready step of a later phase is selectable but not preselected", async () => {
  const { target } = await render(productFiles({ later: true }));
  assert.equal(rowOf(target, "ITM-014").getAttribute("data-state"), "ready");
  assert.equal(tickOf(target, "ITM-014").getAttribute("disabled"), null, "it can be ticked");
  assert.equal(ticked(tickOf(target, "ITM-014")), false, "it is not preselected");
  assert.equal(ticked(tickOf(target, "ITM-012")), true);
  assert.equal(ticked(tickOf(target, "ITM-010")), true);
});

// TST-1170008 · level: unit · module: MOD-implementation-pages
// guards: UC-024; CODE ENTERS THE DEFAULT BRANCH THROUGH A PULL REQUEST WITH GREEN CI
// given: the product of TST-732001, a model that plans its work, on a server whose repositoryInfo gives greenToMerge false; counter-proof: the same product on a server that gives true
// input: the route implement's render, once for each
// expect: with false, one <p data-green-to-merge> says that the server does not enforce "merge only on green" and links the page for branch protection (https://github.com/acme/product/settings/branches); with true, none; known positive: the steps are listed on each; nothing is fetched
test("on a planned model's implement page too, a server that does not enforce green CI before a merge is named, with its page for branch protection", async () => {
  const open = await render(productFiles(), { greenToMerge: false });
  assert.equal(found(open.target, "[data-step]").length, 4, "known positive: the steps are listed");
  const note = found(open.target, "[data-green-to-merge]");
  assert.equal(note.length, 1);
  assert.match(text(note[0]), /does not enforce/);
  assert.match(text(note[0]), /merge only on green/);
  assert.deepEqual(found(note[0], "a").map((link) => link.getAttribute("href")), [BRANCH_PROTECTION]);
  const guarded = await render(productFiles(), { greenToMerge: true });
  assert.equal(found(guarded.target, "[data-step]").length, 4, "known positive: the steps are listed");
  assert.equal(found(guarded.target, "[data-green-to-merge]").length, 0, "counter-proof: a server that enforces it is not named");
});

// TST-1421003 · level: unit · module: MOD-implementation-pages
// guards: UC-024; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: the product of TST-732001, in which the only job of the step ITM-010 ended failed at a rejected gate, its End reason "the gate Building → Checking was rejected by docs/gates/20261102-0900-building-checking-1421.md: The review found no test."
// input: the route implement's render
// expect: ITM-010 is ready and selectable and its row carries that reason in <p data-returned>; ITM-012, ready with no job, has none
test("TST-1421003: UC-024 10a a ready step that a rejected gate returned shows the reason in its row; a step with no reason shows none", async () => {
  const { target } = await render({ ...productFiles(), ...endedJob("ITM-010", REJECTED) });
  assert.equal(rowOf(target, "ITM-010").getAttribute("data-state"), "ready", "known positive: the step a rejected gate returned is ready");
  assert.equal(tickOf(target, "ITM-010").getAttribute("disabled"), null, "and selectable");
  assert.deepEqual(found(rowOf(target, "ITM-010"), "[data-returned]").map(text), [REJECTED]);
  assert.deepEqual(found(rowOf(target, "ITM-012"), "[data-returned]").map(text), []);
});
