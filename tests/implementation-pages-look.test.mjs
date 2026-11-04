// The pages of implementation wear the site's one look (ITM-1447): each button of the routes process, models, plan, implement and board carries the frame's class btn, and the plan's table
// carries the frame's class list (look.css: ".btn", ".list"); each cell of the plan's and the implement page's tables carries data-label with its column's title (ITM-1454).
// Run: node --test tests/implementation-pages-look.test.mjs
//
// Module: MOD-implementation-pages
// Guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE; THE SITE WEARS THE PATTERN RECOGNITION LAB'S LOOK
// Level: unit
//
// The expected results are written here from the item's Acceptance ("every button of the process, implement and backlog pages carries `btn`, and the plan's table carries `list`") and from the
// classes look.css styles, and none is read from the code. Readings taken where the texts leave one open:
//   - A button is an element <button>; a table is an element <table>. A link is not checked.
//   - The item names the hit "backlog.mjs:712"; that line draws the route board (the file backlog.mjs holds the routes backlog and board), so the board is drawn.
//   - "A hit whose element a scoped rule already styles is left": look.css scopes a button rule to .prompt-bar and .arrange, and a table rule to .md; an element inside one of them is not a finding.
//   - The pages are drawn over an instance and a product held in memory, with the shipped model catalogue; nothing reaches the network.
// The known positive is an element in the look; the counter-proofs are in the pull request.

import "./site-frame-dom.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { openStore, writeSetting } from "../src/browser-store/index.mjs";
import { withStoredGraph } from "./stored-graph-fake.mjs";

const { view } = await import("../src/implementation-pages/index.mjs");
const { startRecord } = await import("../src/job-ledger/index.mjs");
const routeOf = (name) => view.routes.find((candidate) => candidate.name === name);

class Storage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
}
globalThis.fetch = async (address) => { throw new Error(`the test's network refuses ${address}`); };

// The selectors the implement route finds its controls by (the attribute selectors of its own markup); the fixture DOM has no selector engine.
const matches = (element, selector) => {
  const attribute = /^\[([a-z-]+)(?:="([^"]*)")?\]$/.exec(selector);
  return attribute ? (attribute[2] === undefined ? element.getAttribute(attribute[1]) !== null : element.getAttribute(attribute[1]) === attribute[2]) : false;
};
const found = (root, selector) => {
  const all = [];
  (function walk(node) { for (const child of node.childNodes) if (child.nodeType === 1) { if (matches(child, selector)) all.push(child); walk(child); } })(root);
  return all;
};
globalThis.window.Element.prototype.querySelectorAll = function querySelectorAll(selector) { return found(this, selector); };
globalThis.window.Element.prototype.querySelector = function querySelector(selector) { return found(this, selector)[0] ?? null; };

const classes = (node) => (node.className ?? "").split(" ").filter(Boolean);
const text = (node) => node.textContent.replace(/\s+/g, " ").trim().slice(0, 40);
function descendants(root, predicate) {
  const found = [];
  (function visit(node) { for (const child of node.childNodes ?? []) { if (child.nodeType === 1) { if (predicate(child)) found.push(child); visit(child); } } })(root);
  return found;
}
const within = (node, scopes) => { for (let up = node.parentNode; up; up = up.parentNode) if (classes(up).some((name) => scopes.includes(name))) return true; return false; };
// The findings of one drawn page: what is not the frame's look, each named by its element.
const buttonFindings = (target) => descendants(target, (node) => node.localName === "button" && !classes(node).includes("btn") && !within(node, ["prompt-bar", "arrange", "schema-form"]))
  .map((node) => `button "${text(node)}" has no class btn`);
const tableFindings = (target) => descendants(target, (node) => node.localName === "table" && !classes(node).includes("list") && !within(node, ["md"]))
  .map((node) => `table "${text(node)}" has no class list`);
const findings = (target) => [...buttonFindings(target), ...tableFindings(target)];

const sha1 = (body) => createHash("sha1").update(body).digest("hex");
const lines = (...rows) => `${rows.join("\n")}\n`;
const ROOT = new URL("../", import.meta.url);
const HEAD = readFileSync(new URL("docs/participants.md", ROOT), "utf8").split("\n").filter((row, at, all) => at <= all.findIndex((each) => each.startsWith("|---"))).join("\n");
const REGISTER = `${HEAD}\n| dev-a | model endpoint | model-a | 200000 | — | read the repository, write to the repository, run code and tests, use tools | this machine | ci hosted secret DEV_KEY |\n`;
const FIXTURE_MODEL = readFileSync(new URL("./fixtures/flow/scrum-wip.md", import.meta.url), "utf8");
const SHIPPED = ["waterfall", "v-model", "reuse-oriented", "scrum", "kanban"];
const SHIPPED_FILES = Object.fromEntries(SHIPPED.map((name) => [`src/model-catalogue/models/${name}.md`, readFileSync(new URL(`../src/model-catalogue/models/${name}.md`, import.meta.url), "utf8")]));

// A host of this file's own: the part of MOD-repository-hosts' interface the routes use, over a fixed map of path -> text.
function hostOf(files, { pullRequests = [], pulls = [] } = {}) {
  // The commit is named by the files, so that the stored trace graph the plan reads (tests/stored-graph-fake.mjs) is the graph of these files.
  const snapshot = () => withStoredGraph({ repository: { server: "github", path: "acme/product", web: "https://github.com/acme/product" }, ref: "main", commit: sha1(JSON.stringify(Object.entries(files).sort())), paths: Object.keys(files),
    blob: (path) => (Object.hasOwn(files, path) ? sha1(files[path]) : null), read: async (path) => (Object.hasOwn(files, path) ? files[path] : null) });
  return {
    async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite: true, archived: false, description: "", greenToMerge: null }; },
    async readSnapshot() { return snapshot(); },
    async readFileAt(path, commits) { return new Map(commits.map((commit) => [commit, Object.hasOwn(files, path) ? files[path] : null])); },
    async listPullRequests({ state = "all" } = {}) { return pullRequests.filter((each) => state === "all" || each.state === state); },
    async pullRequestFacts(number) { return pulls.find((each) => each.request.number === number).facts; },
    async listCiRuns({ commit }) { return pulls.flatMap((each) => each.runs).filter((run) => run.commit === commit); },
    async containsCommit() { return false; },
    async commitFiles() { throw new Error("a render writes nothing"); },
    webLinks() { return { actions: "https://github.com/acme/product/actions", branchProtection: "https://github.com/acme/product/settings/branches" }; },
  };
}
async function draw(t, name, { instance = { "docs/participants.md": REGISTER, "SPEC.md": "# Instance\n", "docs/process-models/fixture.md": FIXTURE_MODEL }, product = {}, params = {}, store = {}, options } = {}) {
  globalThis.mermaid = { initialize() {}, mermaidAPI: { getDiagramFromText: async () => ({ db: { getVertices: () => ({}) } }) }, run: async () => {} };
  t.after(() => { delete globalThis.mermaid; });
  const context = { page: "review", instance: { repository: "acme/agent-m", host: hostOf(instance, options) }, product: { address: "https://github.com/acme/product", kind: "github", host: hostOf(product, options), tokenStored: true },
    store, go() {} };
  const target = document.createElement("div");
  document.body.append(target);
  await routeOf(name).render(target, context, params);
  await new Promise((resolve) => setTimeout(resolve, 20));
  return target;
}
function storeWith(products) {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: new Storage() });
  const store = openStore("acme/agent-m");
  writeSetting(store, "products", products);
  return store;
}

// ---------------------------------------------------------------- the products: a pulled model with sprints and a pull request, and a planned model with a plan
const ADDRESS = "https://github.com/acme/product";
const sha = (digit) => digit.repeat(40);
const SPEC = lines("# SPEC", "", "## 1. Rules", "", "**RULE ONE** *(PO, 2026-09-01)*", "The first rule.", "*Check:* no automatic check; at review.");
const declaration = (model, file, branch) => lines("---", `model: ${model}`, `model_file: ${file}`, `model_version: ${"a".repeat(40)}`, "---", "# How the fixture product is developed", "", "## Practices", "", "- none", "",
  "## Branches", "", "| Phase or time box | Branch |", "|---|---|", `| ${branch} |`, "", "## Definition of Done", "", "The job rules hold.");
const moduleFile = (id) => lines("---", `id: ${id}`, `title: The module ${id}`, `folder: src/${id.slice(4)}/`, "realises:", "  - RULE ONE", "follows:", "  - ARC-001", "uses: []", "provides:", "  - read", "---", `# ${id} The module ${id}`);
const itemText = (n, module) => lines("---", `id: ITM-00${n}`, `title: The work of item ${n}`, "level: module", "realises:", "  - RULE ONE", "modules:", `  - ${module}`, "builds_on: []", "tests:", "  - unit", "origin:", "  - RULE ONE",
  "---", `# ITM-00${n} The work of item ${n}`, "", "## Outcome", "", `What item ${n} delivers.`, "", "## Acceptance", "", "- a unit test.");
const SCRUM = {
  "SPEC.md": SPEC, "docs/process.md": declaration("fixture-scrum-wip", "docs/process-models/fixture.md", "Sprint | `sprint/<team>/<nn>`"), "docs/process-models/fixture.md": FIXTURE_MODEL,
  "docs/role-assignments/team1.md": lines("# team1", "", "## Roles", "", "| Role | Participants |", "|---|---|", "| Owner | alice |", "| Builders | dev-a |", "| Checker | dev-a |"),
  "docs/architecture/MOD-store.md": moduleFile("MOD-store"), "docs/architecture/MOD-mail.md": moduleFile("MOD-mail"),
  "docs/backlog/ITM-001-item-1.md": itemText(1, "MOD-store"), "docs/backlog/ITM-003-item-3.md": itemText(3, "MOD-mail"), "docs/backlog/ITM-005-item-5.md": itemText(5, "MOD-store"),
  "docs/backlog/sprints/team1/01.md": lines("---", "sprint: 1", "goal: Store and show", "start: 2026-09-14", "end:", "closer: alice", "branch:", "selection:", "  - ITM-005", "---", "# team1 Sprint 01"),
  ".github/workflows/agent-m-jobs.yml": "name: agent-m jobs\n",
};
// A job with an open pull request whose head passed the check agent-m done, so that Merge is offered.
const JOB = "JOB-20260916-0900-a1b2";
const request = { number: 7, title: `${JOB}: implement ITM-001`, branch: `job/${JOB}`, base: "main", head: sha("2"), mergeCommit: null, state: "open", draft: false, url: `${ADDRESS}/pull/7`,
  opened: "2026-09-16T10:00:00Z", merged: null, closed: null, body: `Job: ${JOB}\nKind: implement\nBacklog item: ITM-001\n` };
const commits = [{ sha: sha("1"), message: "tests", files: ["tests/store-734.test.mjs"], ci: "failure" }, { sha: sha("2"), message: "code", files: ["src/store/index.mjs"], ci: "success" }];
const pull = { request, runs: commits.map((commit, at) => ({ id: `70${at}`, workflow: "tests", commit: commit.sha, event: "pull_request", state: commit.ci, url: `${ADDRESS}/actions/runs/70${at}`, started: "2026-09-16T10:00:00Z", ended: "2026-09-16T10:01:00Z" })),
  facts: { pullRequest: request, commits, files: [{ path: "tests/store-734.test.mjs", change: "added" }, { path: "src/store/index.mjs", change: "modified" }], reviews: [],
    checks: [{ name: "agent-m tests", state: "success", url: `${ADDRESS}/actions/runs/701` }, { name: "agent-m done", state: "success", url: `${ADDRESS}/actions/runs/70102/job/70202` }] } };
const jobRecord = startRecord({ id: JOB, kind: "implement", worksOn: ["ITM-001"], participant: "dev-a", model: "model-a", route: "ci hosted", run: null, retries: null, startedBy: "alice",
  start: new Date("2026-09-16T09:00:00Z"), agentM: { version: "2026.10.0", commit: sha("a") }, inputs: [], limit: 5, destinations: [], params: { items: ["ITM-001"], merges: "person" } });
const WITH_PULL = { ...SCRUM, [`docs/jobs/${JOB}.md`]: jobRecord.text };

const decision = (id, extra) => lines("---", `id: ${id}`, `title: ${id} decision`, ...extra, "---", `# ${id} decision`, "", "## Context", "", "c", "", "## Decision", "", "d", "", "## Alternatives", "", "a", "", "## Consequences", "", "q");
const module_ = (id) => lines("---", `id: ${id}`, `title: ${id}`, `folder: src/${id.slice(4)}/`, "realises:", "follows:", "  - ARC-002", "uses: []", "provides:", "  - f", "---", `# ${id} ${id}`, "", "## Responsibility", "", "r", "",
  "## Parts", "", "p", "", "## Data", "", "d", "", "## Interfaces", "", "- `f` — i", "", "## Files", "", "f", "", "## Uses", "", "u");
const step = (id, title, extra = []) => lines("---", `id: ${id}`, `title: ${title}`, "level: module", "realises:", "  - UC-001", "modules:", "  - MOD-reader", ...extra, "tests:", "  - unit", "origin:", "  - UC-001", "---",
  `# ${id} ${title}`, "", "## Outcome", "", "o", "", "## Acceptance", "", "a");
const PLANNED = {
  "SPEC.md": "# Fixture\n", "docs/process.md": declaration("v-model", "src/model-catalogue/models/v-model.md", "Implementation | work/<item>"), "docs/use-cases/UC-001-load.md": "# UC-001 load\n",
  "docs/architecture/ARC-001-whole.md": decision("ARC-001", ["forced_by:", "  - UC-001"]), "docs/architecture/ARC-002-sub.md": decision("ARC-002", ["refines: ARC-001", "forced_by:", "  - UC-001", "designs:", "  - MOD-reader"]),
  "docs/architecture/MOD-reader.md": module_("MOD-reader"),
  "docs/plan/ITM-010-reader.md": step("ITM-010", "Read the store"), "docs/plan/ITM-011-writer.md": step("ITM-011", "Write the store", ["builds_on:", "  - ITM-010"]),
  "docs/plan/order.md": lines("## Order", "", "| Step | Phase |", "| --- | --- |", "| ITM-010 | Testing |", "| ITM-011 | Implementation |"),
  "docs/role-assignments/product.md": lines("# Product", "", "## Roles", "", "| Role | Participants |", "|---|---|", "| Product owner | alice |", "| Developer | dev-a |", "| Tester | dev-a |", "| Reviewer | alice |"),
};
for (const path of Object.keys(PLANNED).filter((each) => each.startsWith("docs/use-cases/") || each.startsWith("docs/architecture/"))) {
  PLANNED[`docs/approvals/${/(ARC-\d+|MOD-[a-z]+|UC-\d+)/.exec(path)[1]}-${sha1(PLANNED[path]).slice(0, 12)}.md`] = "kind: record\n";
}
Object.assign(PLANNED, SHIPPED_FILES);

// TST-1447001 · level: unit · module: MOD-implementation-pages
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: a button with class btn and a table with class list, made by hand; the route plan of the planned product, which draws buttons with class btn; a bare button and a bare table made by hand
// input: the checks (buttons, tables) applied to each
// expect: known positive — the element in the look is no finding, and the drawn plan page's buttons (Draft the plan, + step) are no finding; known negative — the bare button and the bare table are one finding each
test("TST-1447001: an element in the look passes the checks, and a bare button and a bare table are findings", async (t) => {
  const inLook = document.createElement("div");
  const button = document.createElement("button"), table = document.createElement("table");
  button.className = "btn"; table.className = "list";
  inLook.append(button, table);
  assert.deepEqual(findings(inLook), [], "an element in the look passes");
  const bare = document.createElement("div");
  bare.append(document.createElement("button"), document.createElement("table"));
  assert.equal(findings(bare).length, 2, "known negative: a bare button and a bare table are one finding each");
  const target = await draw(t, "plan", { product: PLANNED });
  const buttons = descendants(target, (node) => node.localName === "button");
  assert.ok(buttons.length > 0 && buttons.every((each) => classes(each).includes("btn")), "known positive: the plan page's buttons are in the look");
  assert.deepEqual(buttonFindings(target), []);
});

// TST-1447002 · level: unit · module: MOD-implementation-pages
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: the route process over the shipped catalogue, which draws a model card with a Choose button for each model; the route models with the empty name (+ New model), which draws the buttons planned and pulled; the route models of the v-model with a product in this browser, which draws a preview button for it
// input: each route drawn
// expect: every button of the three pages carries the class btn (the Choose of each card, planned, pulled and the product's preview button among them)
test("TST-1447002: the buttons of the process and models pages carry the frame's class btn", async (t) => {
  const own = { instance: SHIPPED_FILES };
  const process = await draw(t, "process", { ...own, store: { async get() { return null; }, async set() {} } });
  assert.ok(descendants(process, (node) => node.localName === "button" && node.textContent === "Choose").length > 0, "the cards are drawn");
  const created = await draw(t, "models", { ...own, params: { name: "" }, store: storeWith([ADDRESS]) });
  assert.deepEqual(descendants(created, (node) => node.hasAttribute?.("data-kind")).map((node) => node.getAttribute("data-kind")), ["planned", "pulled"]);
  const edited = await draw(t, "models", { ...own, params: { name: "v-model" }, store: storeWith([ADDRESS]) });
  assert.equal(descendants(edited, (node) => node.getAttribute?.("data-preview-product") === ADDRESS).length, 1, "the preview button is drawn");
  assert.deepEqual([process, created, edited].flatMap((page) => buttonFindings(page)), []);
});

// TST-1447003 · level: unit · module: MOD-implementation-pages
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: a pulled product with a startable item and a job with an open pull request that passed the check agent-m done, and a planned product whose plan has startable steps
// input: the route implement drawn for each
// expect: the buttons Start jobs and Merge carry the class btn on both pages (Merge is offered on the first)
test("TST-1447003: the buttons of the implement page carry the frame's class btn", async (t) => {
  const options = { pullRequests: [request], pulls: [pull] };
  const items = await draw(t, "implement", { product: WITH_PULL, options });
  assert.equal(descendants(items, (node) => node.getAttribute?.("data-merge-pull") === "7").length, 1, "Merge is offered");
  assert.equal(descendants(items, (node) => node.hasAttribute?.("data-start-jobs")).length, 1, "Start jobs is offered");
  const steps = await draw(t, "implement", { product: PLANNED });
  assert.equal(descendants(steps, (node) => node.hasAttribute?.("data-start-jobs")).length, 1, "Start jobs is offered for the steps");
  assert.deepEqual([...buttonFindings(items), ...buttonFindings(steps)], []);
});

// TST-1447004 · level: unit · module: MOD-implementation-pages
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: the pulled product with a ready item that no sprint selects, so that it cannot be pulled
// input: the route board drawn
// expect: the disabled Pull button of that item carries the class btn
test("TST-1447004: the board's Pull button carries the frame's class btn", async (t) => {
  const board = await draw(t, "board", { product: SCRUM });
  assert.equal(descendants(board, (node) => node.localName === "button" && node.getAttribute("data-pull") === "ITM-003").length, 1, "the disabled Pull of ITM-003 is drawn");
  assert.deepEqual(buttonFindings(board), []);
});

// TST-1447005 · level: unit · module: MOD-implementation-pages
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: the planned product with a plan of two steps
// input: the route plan drawn
// expect: the table of the steps carries the class list; no table of the page is a finding
test("TST-1447005: the plan's table carries the frame's class list", async (t) => {
  const plan = await draw(t, "plan", { product: PLANNED });
  assert.equal(descendants(plan, (node) => node.localName === "table" && !within(node, ["md"])).length, 1, "the plan's table is drawn");
  assert.deepEqual(tableFindings(plan), []);
});

// ---------------------------------------------------------------- every cell names its column on a phone (ITM-1454)
// The cells of a drawn table that do not carry their column's title as data-label (look.css: "td[data-label]::before"; MOD-site-frame: "the route that draws the table sets to the
// column's title"): each cell of a body row beside the header cell of its column. A table inside rendered Markdown (.md) is not the route's own, and is left.
// Reading taken: a column whose header cell is empty (the column of the tick boxes) has the empty title, so its cells carry data-label="".
const labelFindings = (target) => descendants(target, (node) => node.localName === "table" && !within(node, ["md"])).flatMap((table) => {
  const titles = descendants(table, (node) => node.localName === "th").map((cell) => cell.textContent.trim());
  return descendants(table, (node) => node.localName === "tr" && node.parentNode?.localName !== "thead")
    .flatMap((row) => [...row.childNodes].filter((cell) => cell.localName === "td").map((cell, at) => [row, cell, at]))
    .filter(([, cell, at]) => cell.getAttribute("data-label") !== titles[at])
    .map(([row, cell, at]) => `cell ${at + 1} of row "${text(row)}" carries data-label ${JSON.stringify(cell.getAttribute("data-label"))}, not "${titles[at]}"`);
});
const bodyCells = (target) => descendants(target, (node) => node.localName === "td" && !within(node, ["md"]));

// TST-1454001 · level: unit · module: MOD-implementation-pages
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: the route backlog of the pulled product, which already sets data-label on each cell; a table made by hand whose second cell carries no data-label; one whose cell carries another title
// input: the check applied to each
// expect: known positive — the backlog page's cells are no finding; known negative — the cell without data-label is one finding, and the cell with another title is one finding
test("TST-1454001: a route that labels its cells passes the check, and a cell without its column's title is a finding", async (t) => {
  const backlog = await draw(t, "backlog", { product: SCRUM });
  assert.ok(bodyCells(backlog).length > 0, "the backlog's table is drawn");
  assert.deepEqual(labelFindings(backlog), [], "known positive: the backlog page's cells carry their columns' titles");
  const bare = document.createElement("div");
  bare.innerHTML = `<table class="list"><thead><tr><th>Item</th><th>State</th></tr></thead><tbody><tr><td data-label="Item">ITM-001</td><td>ready</td></tr></tbody></table>`;
  assert.equal(labelFindings(bare).length, 1, "known negative: the cell without data-label");
  const other = document.createElement("div");
  other.innerHTML = `<table class="list"><thead><tr><th>Item</th></tr></thead><tbody><tr><td data-label="Title">ITM-001</td></tr></tbody></table>`;
  assert.equal(labelFindings(other).length, 1, "known negative: the cell with another column's title");
});

// TST-1454002 · level: unit · module: MOD-implementation-pages
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: the planned product with a plan of two steps
// input: the route plan drawn
// expect: each cell of the steps' table carries data-label with its column's title — Step, State, Waits for
test("TST-1454002: the plan's table names each cell's column", async (t) => {
  const plan = await draw(t, "plan", { product: PLANNED });
  assert.equal(bodyCells(plan).length, 6, "two steps of three cells");
  assert.deepEqual(labelFindings(plan), []);
});

// TST-1454003 · level: unit · module: MOD-implementation-pages
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: the planned product whose plan has startable steps; the pulled product with a startable item and a job with an open pull request
// input: the route implement drawn for each
// expect: each cell of the steps' table carries its column's title — "" (the tick box), Step, Phase, State, Why not —, and each cell of the items' table its column's — "" (the tick box), Item, State, Start
test("TST-1454003: the implement page's tables name each cell's column", async (t) => {
  const steps = await draw(t, "implement", { product: PLANNED });
  assert.ok(descendants(steps, (node) => node.hasAttribute?.("data-select-step")).length > 0, "the steps' table is drawn");
  const items = await draw(t, "implement", { product: WITH_PULL, options: { pullRequests: [request], pulls: [pull] } });
  assert.ok(descendants(items, (node) => node.hasAttribute?.("data-start-item")).length > 0, "the items' table is drawn");
  assert.deepEqual([...labelFindings(steps), ...labelFindings(items)], []);
});

// TST-1454004 · level: unit · module: MOD-implementation-pages
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: a pulled product whose head's view is not stored yet: overview-cache holding latest.json naming 0c0c…0c and the backlog view of 0c0c…0c
// input: the route implement drawn
// expect: the line "As of 0c0c0c0: …"; each cell of the items' table carries its column's title — Item, State
test("TST-1454004: while the head's view is being stored, the implement page's table names each cell's column", async () => {
  const { DECLARATION_AT_HEAD, productFiles, renderOverGitHub, storedViewBytes } = await import("./implementation-pages-sprints.mjs");
  const C0 = "0c".repeat(20);
  const files = productFiles({ "docs/process.md": DECLARATION_AT_HEAD });
  const page = await renderOverGitHub("implement", {}, { files, overview: { "latest.json": `${JSON.stringify({ commit: C0 })}\n`, [`${C0}.backlog.json.gz`]: await storedViewBytes("backlog", files, C0) } });
  try {
    assert.match(page.html(), /As of 0c0c0c0: the view of the newest commit is being stored\./, "known positive: the view stored last is drawn");
    assert.ok(bodyCells(page.target).length > 0, "the items' table is drawn");
    assert.deepEqual(labelFindings(page.target), []);
  } finally { page.done(); }
});
