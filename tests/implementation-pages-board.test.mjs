// MOD-implementation-pages' route `board` — the board pulls an item only below the work-in-progress limit (ITM-784), as the accepted text of docs/architecture/MOD-implementation-pages.md states it:
// "`backlog`, `board` — … for a model with a work-in-progress limit, the board and *Pull*, refused at the limit with the items in progress named", and UC-032 steps 7 and 7a: the columns of the model with each
// item in the column of its derived state; a ready item can be pulled only while fewer items are in progress than the limit allows (items in review count as in progress), and, in a model with sprints, only
// selected items; at the limit *Pull* is disabled and the panel names the items in progress and which wait for review. *Pull* opens the route `implement` with the item selected, whose *Start jobs* starts its job.
// Run: node --test tests/implementation-pages-board.test.mjs
//
// Module: MOD-implementation-pages
// Guards: UC-032; NO JOB STARTS ABOVE THE WORK-IN-PROGRESS LIMIT; A TIME BOX WORKS ONLY ON WHAT WAS SELECTED FOR IT; EVERY STEP EXPLAINS ITSELF; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// Level: unit
//
// The product is the one-team Scrum-with-limit fixture of tests/implementation-pages-implement.test.mjs (the limit is 2), held in memory behind a host of this file's own; the kind `implement` is stood in for
// as there. Readings the texts leave open, which the tests state (the pull request names them):
//   - The columns are Backlog (every state but the ones below), Doing (in progress, no pull request open), Review (in progress with a pull request) and Done; a column is <section data-column="<name>"> and holds
//     <li data-item="<id>"> for each item in it. A column is drawn only for a model with a limit; without one the page says the model has no work-in-progress limit and links the backlog.
//   - Pull is <a data-pull="<id>" href="#implement/item=<id>"> where the item can be pulled, else <button data-pull="<id>" disabled> with the reasons `startable` gives as <ul data-reasons>.
//   - <section data-wip data-team> says how many items are in progress against the limit, naming them and those that wait for review.
//   - The route `implement` given the parameter `item` ticks that item only.
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import "./site-frame-dom.mjs";
const { view } = await import("../src/implementation-pages/index.mjs");
const { registerStrategies } = await import("../src/job-runner/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "board");
const implementRoute = view.routes.find((candidate) => candidate.name === "implement");

// ---------------------------------------------------------------- the DOM: the selectors the route finds its controls by
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
globalThis.SVGElement ??= class SVGElement {};
afterEach(() => { delete globalThis.mermaid; });
const text = (node) => node.textContent.replace(/\s+/g, " ").trim();
const trusted = () => Object.defineProperty(new Event("click"), "isTrusted", { value: true });

// ---------------------------------------------------------------- the strategies the kind names: stand-ins
const part = (name) => ({ name, text: name, size: 0, sources: [], required: true });
registerStrategies("tests/implementation-pages-board.test.mjs", {
  recipes: { "implementation-inputs": async (_, params) => [part(`inputs of ${(params.items ?? []).join(", ")}`)], "chapters-for-implementation": async () => [part("chapters 9, 11, 12 and 13")],
    "resource-pins": async () => [] },
  preconditions: { "rests-on-accepted": async () => [] },
  writers: { "branch-and-pull-request": async () => ({ commits: [], files: [], pullRequest: null, shown: null, notes: [] }) },
});

// ---------------------------------------------------------------- the fixture product
const lines = (...rows) => `${rows.join("\n")}\n`;
const blobOf = (content) => createHash("sha1").update(content).digest("hex");
const ADDRESS = "https://github.com/acme/product";
const SPEC = lines("# SPEC", "", "## 1. Rules", "", "**RULE ONE** *(PO, 2026-09-01)*", "The first rule.", "*Check:* no automatic check; at review.");
const DECLARATION = lines("---", "model: fixture-scrum-wip", "model_file: docs/process-models/fixture.md", `model_version: ${"a".repeat(40)}`, "---", "# How the fixture product is developed", "", "## Practices", "",
  "- none", "", "## Branches", "", "| Phase or time box | Branch |", "|---|---|", "| Sprint | `sprint/<team>/<nn>` |", "", "## Definition of Done", "", "The job rules hold.");
const assignment = lines("# team1", "", "## Roles", "", "| Role | Participants |", "|---|---|", "| Owner | alice |", "| Builders | dev-a |", "| Checker | dev-a |");
const moduleFile = (id, uses) => lines("---", `id: ${id}`, `title: The module ${id}`, `folder: src/${id.slice(4)}/`, "realises:", "  - RULE ONE", "follows:", "  - ARC-001", `uses:${uses.length ? `\n${uses.map((use) => `  - ${use}`).join("\n")}` : " []"}`,
  "provides:", "  - read", "---", `# ${id} The module ${id}`);
const id = (n) => `ITM-${String(n).padStart(3, "0")}`;
const itemPath = (n) => `docs/backlog/${id(n)}-item-${n}.md`;
const itemText = (n, { modules, buildsOn = [], realises = ["RULE ONE"] }) => lines("---", `id: ${id(n)}`, `title: The work of item ${n}`, "level: module", "realises:", ...realises.map((name) => `  - ${name}`), "modules:",
  ...modules.map((module) => `  - ${module}`), ...(buildsOn.length ? ["builds_on:", ...buildsOn.map((dependency) => `  - ${dependency}`)] : ["builds_on: []"]), "tests:", "  - unit", "origin:", "  - RULE ONE", "---",
  `# ${id(n)} The work of item ${n}`, "", "## Outcome", "", `What item ${n} delivers.`, "", "## Acceptance", "", "- a unit test.");
const sprint = (selection) => lines("---", "sprint: 1", "goal: Store and show", "start: 2026-09-14", "end:", "closer: alice", "branch:", "selection:", ...selection.map((each) => `  - ${each}`), "---", "# team1 Sprint 01");
const JOB_WORKFLOW = ".github/workflows/agent-m-jobs.yml";

function productFiles({ selection = ["ITM-001", "ITM-002", "ITM-004", "ITM-005", "ITM-006", "ITM-007"], withWorkflow = true, wip = true } = {}) {
  return {
    "SPEC.md": SPEC, "docs/process.md": DECLARATION, "docs/process-models/fixture.md": readFileSync(new URL("./fixtures/flow/scrum-wip.md", import.meta.url), "utf8").replace("| WIP limit | 2 |", wip ? "| WIP limit | 2 |" : "| WIP limit | none |"),
    "docs/role-assignments/team1.md": assignment,
    "docs/architecture/MOD-store.md": moduleFile("MOD-store", []), "docs/architecture/MOD-pages.md": moduleFile("MOD-pages", ["MOD-store.read"]), "docs/architecture/MOD-mail.md": moduleFile("MOD-mail", []),
    [itemPath(1)]: itemText(1, { modules: ["MOD-store"] }), [itemPath(2)]: itemText(2, { modules: ["MOD-pages"], buildsOn: ["ITM-001"] }),
    [itemPath(3)]: itemText(3, { modules: ["MOD-mail"] }), [itemPath(4)]: itemText(4, { modules: ["MOD-pages"], buildsOn: ["ITM-003"] }),
    [itemPath(5)]: itemText(5, { modules: ["MOD-store"] }), [itemPath(7)]: itemText(7, { modules: ["MOD-store"] }), [itemPath(6)]: itemText(6, { modules: ["MOD-mail"], realises: ["RULE NOT ACCEPTED"] }),
    "docs/backlog/sprints/team1/01.md": sprint(selection),
    ...(withWorkflow ? { [JOB_WORKFLOW]: "name: agent-m jobs\n" } : {}),
  };
}
const pr = ({ number, item, merged = null }) => ({ number, title: `${item}: the work of ${item}`, branch: `team/${item}`, base: "main", head: merged ? "f".repeat(40) : "b".repeat(40),
  state: merged ? "merged" : "open", draft: false, url: `${ADDRESS}/pull/${number}`, opened: "2026-09-15T12:00:00Z", merged, closed: merged });
const OPEN_PRS = [pr({ number: 1, item: "ITM-001" }), pr({ number: 2, item: "ITM-003" })];

// The register of the instance: the head of this repository's own docs/participants.md and the one builder.
const ROOT = new URL("../", import.meta.url);
const onDisk = (path) => { try { return readFileSync(new URL(path, ROOT), "utf8"); } catch { return null; } };
const HEAD = onDisk("docs/participants.md").split("\n").filter((row, at, all) => at <= all.findIndex((each) => each.startsWith("|---"))).join("\n");
const REGISTER = `${HEAD}\n| dev-a | model endpoint | model-a | 200000 | — | read the repository, write to the repository, run code and tests, use tools | this machine | ci hosted secret DEV_KEY |\n| dev-b | model endpoint | model-b | 200000 | — | read the repository, write to the repository, run code and tests, use tools | this machine | ci hosted secret DEV_KEY |\n`;

// A host of this file's own: the part of MOD-repository-hosts' interface the route uses, keeping every commit it is asked for.
function hostOf(files, pullRequests, commits) {
  let head = 0;
  const tree = new Map(Object.entries(files));
  const snapshot = () => ({ repository: { server: "github", path: "acme/product", web: ADDRESS }, ref: "main", commit: String(head).padStart(40, "c"), paths: [...tree.keys()], blob: (path) => (tree.has(path) ? blobOf(tree.get(path)) : null),
    read: async (path) => (tree.has(path) ? tree.get(path) : null) });
  return {
    async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite: true, archived: false, description: "" }; },
    async readSnapshot() { return snapshot(); },
    async listPullRequests() { return pullRequests; },
    // The file at each commit, as the tree holds it (MOD-repository-hosts' readFileAt), for the declared model the board reads first (ITM-1260).
    async readFileAt(path, at) { return new Map(at.map((commit) => [commit, tree.has(path) ? tree.get(path) : null])); },
    async commitFiles(change) {
      commits.push(structuredClone(change));
      head += 1;
      for (const file of change.files) tree.set(file.path, file.text);
      return { commit: String(head).padStart(40, "c"), url: `${ADDRESS}/commit/${head}` };
    },
  };
}
async function render(files, { pullRequests = [], params = {}, using = route } = {}) {
  const commits = [];
  const host = hostOf(files, pullRequests, commits);
  const instanceHost = hostOf({ "docs/participants.md": REGISTER, "SPEC.md": "# Instance\n", "docs/process-models/fixture.md": files["docs/process-models/fixture.md"] }, [], []);
  const context = { page: "review", instance: { repository: "acme/agent-m", host: instanceHost }, product: { address: ADDRESS, kind: "github", host, tokenStored: true }, store: {}, go() {} };
  const target = document.createElement("div");
  document.body.append(target);
  await using.render(target, context, params);
  return { target, commits };
}
const row = (target, item) => found(target, `[data-item="${item}"]`)[0];
const reasons = (target, item) => found(row(target, item), "[data-reasons]").map(text).join(" ");


// ITM-001 is merged (done), ITM-002 has a pull request open (in progress, waiting for review).
const PRS = [pr({ number: 1, item: "ITM-001", merged: "2026-09-15T10:00:00Z" }), pr({ number: 2, item: "ITM-002" })];
const columnOf = (target, name) => found(target, `[data-column="${name}"]`)[0];
const itemsIn = (target, name) => found(columnOf(target, name), "[data-item]").map((each) => each.getAttribute("data-item"));
const pull = (target, item) => found(target, `[data-pull="${item}"]`)[0];
const reasonsOf = (target, item) => found(found(target, `[data-item="${item}"]`)[0], "[data-reasons]").map(text).join(" ");

// TST-784001 · level: unit · module: MOD-implementation-pages
// guards: UC-032; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; EVERY STEP EXPLAINS ITSELF
// given: the one-team fixture: ITM-001 merged, ITM-002's pull request open, ITM-005 and ITM-007 ready and selected, ITM-004 waiting for ITM-003, ITM-006 waiting for acceptance; the limit is 2
// input: the route board's render
// expect: the route is named board under the entry implementation; ITM-001 stands in Done, ITM-002 in Review, ITM-005 and ITM-007 in Backlog; the page holds a folded What is this?; nothing is committed
test("the board puts each item in the column of its derived state", async () => {
  assert.ok(route, "the route board is offered");
  assert.deepEqual([route.name, route.entry, route.title], ["board", "implementation", "Board"]);
  const { target, commits } = await render(productFiles(), { pullRequests: PRS });
  assert.deepEqual(itemsIn(target, "Done"), ["ITM-001"]);
  assert.deepEqual(itemsIn(target, "Review"), ["ITM-002"]);
  assert.ok(["ITM-005", "ITM-007"].every((item) => itemsIn(target, "Backlog").includes(item)));
  assert.ok(found(target, "details").some((each) => /What is this\?/.test(text(each))));
  assert.equal(commits.length, 0);
});

// TST-784002 · level: unit · module: MOD-implementation-pages
// guards: UC-032; NO JOB STARTS ABOVE THE WORK-IN-PROGRESS LIMIT; A TIME BOX WORKS ONLY ON WHAT WAS SELECTED FOR IT
// given: the same board, one item in progress of a limit of 2; ITM-003 is ready and selected by no sprint
// input: the route's render
// expect: Pull on ITM-005 is a link to #implement/item=ITM-005; ITM-003 has no Pull link, its Pull is disabled and its reason says it is not selected
test("below the limit Pull leads to the implement page with the item selected; an item no sprint selected cannot be pulled", async () => {
  const { target } = await render(productFiles(), { pullRequests: PRS });
  assert.equal(pull(target, "ITM-005").localName, "a");
  assert.equal(pull(target, "ITM-005").getAttribute("href"), "#implement/item=ITM-005");
  assert.equal(pull(target, "ITM-003").localName, "button");
  assert.notEqual(pull(target, "ITM-003").getAttribute("disabled"), null);
  assert.match(reasonsOf(target, "ITM-003"), /not selected/);
});

// TST-784003 · level: unit · module: MOD-implementation-pages
// guards: UC-032; NO JOB STARTS ABOVE THE WORK-IN-PROGRESS LIMIT
// given: two items in progress of a limit of 2 — ITM-002 and ITM-007, each with a pull request open
// input: the route's render
// expect: Pull on ITM-005 is disabled; the work-in-progress panel names ITM-002 and ITM-007 and says ITM-002 and ITM-007 wait for review; the reason of ITM-005 names the limit
test("at the limit Pull is disabled and the panel names the items in progress and those waiting for review", async () => {
  const { target } = await render(productFiles(), { pullRequests: [...PRS, pr({ number: 3, item: "ITM-007" })] });
  assert.equal(pull(target, "ITM-005").localName, "button");
  assert.notEqual(pull(target, "ITM-005").getAttribute("disabled"), null);
  const panel = text(found(target, "[data-wip]")[0]);
  assert.match(panel, /2 of 2/);
  assert.match(panel, /ITM-002/);
  assert.match(panel, /ITM-007/);
  assert.match(panel, /waiting for review/i);
  assert.match(reasonsOf(target, "ITM-005"), /work-in-progress limit/);
});

// TST-784004 · level: unit · module: MOD-implementation-pages
// guards: UC-032
// given: a model without a work-in-progress limit
// input: the route's render
// expect: the page says the model has no work-in-progress limit and links the backlog; it draws no column
test("a model without a work-in-progress limit has no board", async () => {
  const { target } = await render(productFiles({ wip: false }), { pullRequests: PRS });
  assert.match(text(target), /no work-in-progress limit/);
  assert.ok(found(target, "a").some((link) => link.getAttribute("href") === "#backlog"));
  assert.equal(found(target, "[data-column]").length, 0);
});

// TST-784005 · level: unit · module: MOD-implementation-pages
// guards: UC-032; UC-034; ONE CLICK PER DECISION
// given: the one-team fixture with ITM-005 and ITM-007 ready and selected
// input: the route implement's render without a parameter, and with the parameter item=ITM-007
// expect: without it both are ticked; with it only ITM-007 is ticked and ITM-005 is listed but not ticked
test("the implement page opened with an item selects that item only", async () => {
  const ticks = async (params) => {
    const { target } = await render(productFiles(), { pullRequests: PRS, params, using: implementRoute });
    return Object.fromEntries(["ITM-005", "ITM-007"].map((item) => [item, found(target, `[data-start-item="${item}"]`)[0]?.getAttribute("checked") !== null]));
  };
  assert.deepEqual(await ticks({}), { "ITM-005": true, "ITM-007": true });
  assert.deepEqual(await ticks({ item: "ITM-007" }), { "ITM-005": false, "ITM-007": true });
});
