// MOD-implementation-pages' route `backlog` draws no region that scrolls and cannot be focused (ITM-932), as THE SITE SERVES A SCREEN READER asks of every page of the site (WCAG 2.2 level AA, whose rule
// `scrollable-region-focusable` asks a box that scrolls to be reached with the keyboard), and as the accepted text of docs/architecture/MOD-implementation-pages.md states the route: its tables and its
// burn-down chart are drawn in boxes of their own.
// Run: node --test tests/implementation-pages-backlog-focus.test.mjs
//
// Module: MOD-implementation-pages
// Guards: THE SITE SERVES A SCREEN READER
// Level: unit
//
// Readings the texts leave open, which the tests state (the pull request names them), each adding no word to the sentence it reads, as tests/markdown-render-931-preview-focus.test.mjs reads "can be focused":
//   - "can be focused" is read as the element carrying the attribute tabindex with the value "0", compared as a string;
//   - "a region that scrolls" is read as the two kinds of box the page draws that scroll sideways: an element with the class `table-scroll` (src/theme/lme.css: `overflow-x: auto`) and the element with the class
//     `mermaid` that MOD-markdown-render draws for a burn-down chart (src/site-frame/look.css: `overflow-x: auto`); the known positive is that the page draws at least one of each.
// The product is a small two-team fixture held in memory behind a host of this file's own; the process model is the instance's, read from a second host. Nothing reaches the network.
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import "./site-frame-dom.mjs";
const { view } = await import("../src/implementation-pages/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "backlog");
// The route that shows each team's running sprint, and its table, since ITM-1252.
const progressRoute = view.routes.find((candidate) => candidate.name === "progress");

const classes = (element) => String(element.getAttribute("class") ?? "").split(/\s+/);
const found = (root, match) => {
  const all = [];
  (function walk(node) { for (const child of node.childNodes) if (child.nodeType === 1) { if (match(child)) all.push(child); walk(child); } })(root);
  return all;
};
globalThis.window.Element.prototype.querySelectorAll = function querySelectorAll(selector) {
  const attribute = /^\[([a-z-]+)(?:="([^"]*)")?\]$/.exec(selector);
  return found(this, (element) => (selector === "pre > code.language-mermaid" ? element.localName === "code" && element.getAttribute("class") === "language-mermaid" && element.parentNode?.localName === "pre"
    : attribute ? (attribute[2] === undefined ? element.getAttribute(attribute[1]) !== null : element.getAttribute(attribute[1]) === attribute[2]) : false));
};
globalThis.window.Element.prototype.querySelector = function querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; };
globalThis.window.Element.prototype.replaceWith = function replaceWith(node) { this.parentNode.insertBefore(node, this); this.parentNode.removeChild(this); };
globalThis.SVGElement ??= class SVGElement {};
afterEach(() => { delete globalThis.mermaid; });

const lines = (...rows) => `${rows.join("\n")}\n`;
const blobOf = (content) => createHash("sha1").update(content).digest("hex");
const ADDRESS = "https://github.com/acme/product";
const COMMIT = "c".repeat(40);
const SPEC = lines("# SPEC", "", "## 1. Rules", "", "**RULE ONE** *(PO, 2026-09-01)*", "The first rule.", "*Check:* no automatic check; at review.");
const DECLARATION = lines("---", "model: fixture-scrum-wip", "model_file: docs/process-models/fixture.md", `model_version: ${"a".repeat(40)}`, "---", "# How the fixture product is developed", "", "## Practices", "",
  "- none", "", "## Branches", "", "| Phase or time box | Branch |", "|---|---|", "| Sprint | `sprint/<team>/<nn>` |", "", "## Definition of Done", "", "The job rules hold.");
const assignment = (team, owner, builder) => lines(`# ${team}`, "", "## Roles", "", "| Role | Participants |", "|---|---|", `| Owner | ${owner} |`, `| Builders | ${builder} |`, `| Checker | ${builder} |`);
const item = (n) => lines("---", `id: ITM-00${n}`, `title: The work of item ${n}`, "level: module", "realises:", "  - RULE ONE", "modules:", "  - MOD-store", "builds_on: []", "tests:", "  - unit", "origin:", "  - RULE ONE", "---",
  `# ITM-00${n} The work of item ${n}`, "", "## Outcome", "", `What item ${n} delivers.`, "", "## Acceptance", "", "- a unit test.");
const sprint = ({ n = 1, start, end = "", goal, selection }) => lines("---", `sprint: ${n}`, `goal: ${goal}`, `start: ${start}`, `end: ${end}`, "closer: alice", "branch:", "selection:", ...selection.map((each) => `  - ${each}`), "---", `# Sprint ${n}`);

const productFiles = () => ({
  "SPEC.md": SPEC, "docs/process.md": DECLARATION, "docs/process-models/fixture.md": readFileSync(new URL("./fixtures/flow/scrum-wip.md", import.meta.url), "utf8"),
  "docs/role-assignments/team1.md": assignment("team1", "alice", "dev-a"), "docs/role-assignments/team2.md": assignment("team2", "bob", "dev-b"),
  "docs/backlog/ITM-001-item-1.md": item(1), "docs/backlog/ITM-002-item-2.md": item(2),
  "docs/backlog/sprints/team1/01.md": sprint({ start: "2026-09-14", goal: "Store", selection: ["ITM-001"] }),
  "docs/backlog/sprints/team2/01.md": sprint({ start: "2026-09-01", end: "2026-09-07", goal: "Mail", selection: ["ITM-002"] }),
});
const named = (name, message) => Object.assign(new Error(message), { name });
function hostOf(files) {
  const snapshot = () => ({ repository: { server: "github", path: "acme/product", web: ADDRESS }, ref: "main", commit: COMMIT, paths: Object.keys(files), blob: (path) => (Object.hasOwn(files, path) ? blobOf(files[path]) : null),
    read: async (path) => (Object.hasOwn(files, path) ? files[path] : null), readMany: async () => {}, readOn: async () => { throw named("NotFound", "no such file"); } });
  return {
    async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite: true, archived: false, description: "" }; },
    async readSnapshot() { return snapshot(); },
    async listPullRequests() { return []; },
    async containsCommit() { return false; },
  };
}
async function render(planFor = null, shown = route) {
  const files = productFiles();
  const host = hostOf(files), instance = hostOf({ "SPEC.md": "# Instance\n", "docs/process-models/fixture.md": files["docs/process-models/fixture.md"] });
  const target = document.createElement("div");
  document.body.append(target);
  globalThis.mermaid = { initialize() {}, mermaidAPI: { getDiagramFromText: async () => ({ db: { getVertices: () => ({}) } }) }, run: async () => {} };
  await shown.render(target, { page: "review", instance: { repository: "acme/agent-m", host: instance }, product: { address: ADDRESS, kind: "github", host, tokenStored: true }, store: {}, go() {} }, {});
  if (planFor) {
    found(target, (element) => element.getAttribute("data-plan") === planFor)[0].dispatchEvent(new Event("click"));
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return target;
}

// TST-932001 · level: unit · module: MOD-implementation-pages
// guards: THE SITE SERVES A SCREEN READER
// given: the backlog page of the two-team fixture, with team1's running sprint, whose burn-down chart is drawn
// input: the route backlog's render
// expect: every burn-down chart box (class mermaid) carries tabindex "0"; there is at least one (known positive)
test("the backlog page's burn-down chart, which scrolls sideways, can be focused", async () => {
  const target = await render();
  const charts = found(target, (element) => classes(element).includes("mermaid"));
  assert.ok(charts.length >= 1, "known positive: the page draws a chart");
  assert.deepEqual(charts.map((chart) => chart.getAttribute("tabindex")), charts.map(() => "0"));
});

// TST-932002 · level: unit · module: MOD-implementation-pages
// guards: THE SITE SERVES A SCREEN READER
// given: the same page, whose tables stand in boxes of their own that scroll sideways
// input: the route backlog's render, and the route progress's, which shows the running sprint since ITM-1252
// expect: every box with the class table-scroll carries tabindex "0"; there is at least one for the sprint's items and one for the backlog (known positive)
test("the backlog page's tables, which scroll sideways, can be focused", async () => {
  const targets = [await render(), await render(null, progressRoute)];
  const tables = targets.flatMap((target) => found(target, (element) => classes(element).includes("table-scroll")));
  assert.ok(tables.length >= 2, "known positive: the page draws the sprint's table and the backlog's");
  assert.deepEqual(tables.map((box) => box.getAttribute("tabindex")), tables.map(() => "0"));
});

// TST-932003 · level: unit · module: MOD-implementation-pages
// guards: THE SITE SERVES A SCREEN READER
// given: the same page after the person's click on Plan sprint for team2, which adds the plan's table and the table of what the other teams' sprints hold (the counter-proof of TST-932002)
// input: the route backlog's render, then the click; and the route progress's render, which shows the sprint's table since ITM-1252
// expect: four boxes with the class table-scroll — the sprint's in team1's panel on progress; the plan's, the held items' and the backlog's on the backlog — and each carries tabindex "0"
test("the tables of a team's plan and of the held items, which scroll sideways, can be focused", async () => {
  const backlog = await render("team2"), progress = await render(null, progressRoute);
  const scrolling = (root) => found(root, (element) => classes(element).includes("table-scroll"));
  const tables = [...found(progress, (element) => element.getAttribute("data-team") === "team1").flatMap(scrolling), ...scrolling(backlog)];
  assert.equal(tables.length, 4, "known positive: the sprint's table, the plan's, the held items' and the backlog's");
  assert.deepEqual(tables.map((box) => box.getAttribute("tabindex")), tables.map(() => "0"));
});
