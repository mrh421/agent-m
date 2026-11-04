// MOD-implementation-pages' route `backlog` — the backlog and the sprints of each team (ITM-681), as the accepted text of docs/architecture/MOD-implementation-pages.md states it (blob 0a1451e6e24c): "`backlog`, `board` — the items,
// each after the items they build on, with their derived states, the requirements and use cases no item realises; … in a product with several teams, what the other teams' sprints hold, from `heldItems`, and on each item the
// marks `conflicts` gives; *Plan sprint* and *Start sprint* for the person's team with `startSprint`", and UC-032 steps 1, 5 and 6 and UC-035.
// Run: node --test tests/implementation-pages-backlog.test.mjs
//
// Module: MOD-implementation-pages
// Guards: UC-032; UC-035; EVERY TEAM RUNS SPRINTS OF ITS OWN; A SPRINT HOLDS ITS ITEMS UNTIL THEY REACH THE DEFAULT BRANCH; SPRINTS OF DIFFERENT TEAMS CHANGE NO MODULE THE OTHER CHANGES OR USES; SPRINT PLANNING SHOWS WHAT THE OTHER TEAMS' SPRINTS HOLD
// Guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; EVERY STEP EXPLAINS ITSELF
// Level: unit
//
// Each test states its input and its expected result before it runs (given / input / expect). The product is a Scrum-with-limit fixture with two teams held in memory behind a host of this file's own that answers MOD-repository-hosts'
// interface (the repository's information, a snapshot, the pull requests); nothing reaches the network. The fixture DOM of the frame is the document; this file adds the two selectors the route's controls are found by. Readings
// the texts leave open, which the tests state (the pull request names them): the model the declaration names is found in the catalogue of the instance by its file (as the route `roles` finds it) and, where the product is
// the instance, the same snapshot serves both; the SPEC's requirements count as accepted; the route draws the Mermaid text of a chart as MOD-markdown-render's rendering of a Mermaid block, which the harness of this file
// does not draw (the fixture DOM lacks replaceWith, which this file adds). The counter-proofs are recorded in the pull request.

import test, { afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import "./site-frame-dom.mjs";
const { view } = await import("../src/implementation-pages/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "backlog");
// The route that shows each team's running sprint since ITM-1252.
const progressRoute = view.routes.find((candidate) => candidate.name === "progress");

// ---------------------------------------------------------------- the DOM: the selectors the route finds its controls by
const matches = (element, selector) => {
  if (selector === "pre > code.language-mermaid") return element.localName === "code" && element.getAttribute("class") === "language-mermaid" && element.parentNode?.localName === "pre";
  const attribute = /^\[([a-z-]+)(?:="([^"]*)")?\]$/.exec(selector);
  return attribute ? (attribute[2] === undefined ? element.getAttribute(attribute[1]) !== null : element.getAttribute(attribute[1]) === attribute[2]) : false;
};
const found = (root, selector) => {
  const all = [];
  (function walk(node) { for (const child of node.childNodes) if (child.nodeType === 1) { if (matches(child, selector)) all.push(child); walk(child); } })(root);
  return all;
};
globalThis.window.Element.prototype.querySelectorAll = function querySelectorAll(selector) { return found(this, selector); };
globalThis.window.Element.prototype.replaceWith = function replaceWith(node) { this.parentNode.insertBefore(node, this); this.parentNode.removeChild(this); };
globalThis.window.Element.prototype.querySelector = function querySelector(selector) { return found(this, selector)[0] ?? null; };
// MOD-markdown-render places a Mermaid block as its source only where the browser draws SVG; Mermaid is a recorder keeping the text of every diagram it is handed, as tests/implementation-pages-plan.test.mjs has it.
globalThis.SVGElement ??= class SVGElement {};
function recorder() {
  const drawn = { texts: [] };
  globalThis.mermaid = {
    initialize() {},
    mermaidAPI: { getDiagramFromText: async () => ({ db: { getVertices: () => ({}) } }) },
    run: async ({ nodes }) => { drawn.texts.push(...nodes.map((node) => node.textContent)); },
  };
  return drawn;
}
// The recorder stays in place while a click draws the page again, and goes after each test.
afterEach(() => { delete globalThis.mermaid; });
const byData = (root, attribute, value) => found(root, value === undefined ? `[${attribute}]` : `[${attribute}="${value}"]`);
const text = (node) => node.textContent.replace(/\s+/g, " ").trim();
const htmlOf = (node) => node.innerHTML;

// ---------------------------------------------------------------- the fixture product
const lines = (...rows) => `${rows.join("\n")}\n`;
const blobOf = (content) => createHash("sha1").update(content).digest("hex");
const ADDRESS = "https://github.com/acme/product";
const SPEC = lines("# SPEC", "", "## 1. Rules", "", "**RULE ONE** *(PO, 2026-09-01)*", "The first rule.", "*Check:* no automatic check; at review.", "",
  "**RULE TWO** *(PO, 2026-09-01)*", "The second rule, which no item realises.", "*Check:* no automatic check; at review.");
const DECLARATION = lines("---", "model: fixture-scrum-wip", "model_file: docs/process-models/fixture.md", `model_version: ${"a".repeat(40)}`, "---", "# How the fixture product is developed", "", "## Practices", "",
  "- none", "", "## Branches", "", "| Phase or time box | Branch |", "|---|---|", "| Sprint | `sprint/<team>/<nn>` |", "", "## Definition of Done", "", "The job rules hold.");
const assignment = (team, owner, builder) => lines(`# ${team}`, "", "## Roles", "", "| Role | Participants |", "|---|---|", `| Owner | ${owner} |`, `| Builders | ${builder} |`, `| Checker | ${builder} |`);
const moduleFile = (id, uses) => lines("---", `id: ${id}`, `title: The module ${id}`, `folder: src/${id.slice(4)}/`, "realises:", "  - RULE ONE", "follows:", "  - ARC-001", `uses:${uses.length ? `\n${uses.map((use) => `  - ${use}`).join("\n")}` : " []"}`,
  "provides:", "  - read", "---", `# ${id} The module ${id}`);
const id = (n) => `ITM-${String(n).padStart(n >= 1000 ? 4 : 3, "0")}`;
const itemPath = (n) => `docs/backlog/${id(n)}-item-${n}.md`;
const itemText = (n, { modules, buildsOn = [], realises = ["RULE ONE"] }) => lines("---", `id: ${id(n)}`, `title: The work of item ${n}`, "level: module", "realises:", ...realises.map((name) => `  - ${name}`), "modules:",
  ...modules.map((module) => `  - ${module}`), ...(buildsOn.length ? ["builds_on:", ...buildsOn.map((dependency) => `  - ${dependency}`)] : ["builds_on: []"]), "tests:", "  - unit", "origin:", "  - RULE ONE", "---",
  `# ${id(n)} The work of item ${n}`, "", "## Outcome", "", `What item ${n} delivers.`, "", "## Acceptance", "", "- a unit test.");
const TEAM1_SPRINT = "docs/backlog/sprints/team1/01.md";
const TEAM2_SPRINT = "docs/backlog/sprints/team2/01.md";
const UC = "docs/use-cases/UC-001-load.md";
const UC_OPEN = "docs/use-cases/UC-002-store.md";

function fixtureFiles() {
  const files = {
    "SPEC.md": SPEC, "docs/process.md": DECLARATION, "docs/process-models/fixture.md": readFileSync(new URL("./fixtures/flow/scrum-wip.md", import.meta.url), "utf8"),
    "docs/role-assignments/team1.md": assignment("team1", "alice", "dev-a"), "docs/role-assignments/team2.md": assignment("team2", "bob", "dev-b"),
    "docs/architecture/MOD-store.md": moduleFile("MOD-store", []), "docs/architecture/MOD-pages.md": moduleFile("MOD-pages", ["MOD-store.read"]),
    "docs/architecture/MOD-mail.md": moduleFile("MOD-mail", []), "docs/architecture/MOD-feed.md": moduleFile("MOD-feed", ["MOD-mail.read"]),
    [itemPath(1)]: itemText(1, { modules: ["MOD-store"] }), [itemPath(2)]: itemText(2, { modules: ["MOD-pages"], buildsOn: ["ITM-001"] }),
    [itemPath(3)]: itemText(3, { modules: ["MOD-mail"] }), [itemPath(4)]: itemText(4, { modules: ["MOD-feed"], buildsOn: ["ITM-003"] }),
    [itemPath(5)]: itemText(5, { modules: ["MOD-store"] }), [itemPath(6)]: itemText(6, { modules: ["MOD-mail"], realises: ["RULE NOT ACCEPTED"] }),
    [TEAM1_SPRINT]: lines("---", "sprint: 1", "goal: Store and show", "start: 2026-09-14", "end:", "closer: alice", "branch: sprint/team1/01", "selection:", "  - ITM-001", "  - ITM-002", "---", "# team1 Sprint 01"),
    [TEAM2_SPRINT]: lines("---", "sprint: 1", "goal: Mail", "start: 2026-09-01", "end: 2026-09-07", "closer: bob", "branch:", "selection:", "  - ITM-003", "---", "# team2 Sprint 01", "", "## Review", "", "No item is done.", "",
      "## Unfinished items", "", "to the backlog: ITM-003", "into the next sprint:", "", "ITM-003 waits for the mail server.", "", "## Retrospective", "", "- change: smaller items."),
    [UC]: "# UC-001 load\n", [UC_OPEN]: "# UC-002 store\n",
  };
  files[`docs/approvals/UC-001-${blobOf(files[UC]).slice(0, 12)}.md`] = "kind: use-case\n";
  return files;
}

// A pull request as MOD-repository-hosts gives it.
const pr = ({ number, item, base, created, merged = null }) => ({ number, title: `${item}: the work of ${item}`, branch: `team/${item}`, base, head: merged ? "f".repeat(40) : "b".repeat(40),
  state: merged ? "merged" : "open", draft: false, url: `${ADDRESS}/pull/${number}`, opened: created, merged, closed: merged });
const PRS = [pr({ number: 1, item: "ITM-001", base: "sprint/team1/01", created: "2026-09-14T10:00:00Z", merged: "2026-09-15T10:00:00Z" }),
  pr({ number: 2, item: "ITM-002", base: "sprint/team1/01", created: "2026-09-15T12:00:00Z" }),
  { ...pr({ number: 3, item: "ITM-000", base: "sprint/team1/01", created: "2026-09-15T13:00:00Z", merged: "2026-09-15T14:00:00Z" }), title: "Tidy the README", branch: "team/tidy" }];

// A host of this file's own, answering the part of MOD-repository-hosts' interface the route uses; `calls` keeps what it was asked.
function hostOf(files, pullRequests, calls = [], commits = {}) {
  const snapshotOf = (files) => ({ repository: { server: "github", path: "acme/product", web: ADDRESS }, ref: "main", commit: "c".repeat(40), paths: Object.keys(files), blob: (path) => (Object.hasOwn(files, path) ? blobOf(files[path]) : null),
    read: async (path) => { calls.push(`read ${path}`); return Object.hasOwn(files, path) ? files[path] : null; } });
  const snapshot = snapshotOf(files);
  return {
    async repositoryInfo() { calls.push("repositoryInfo"); return { defaultBranch: "main", visibility: "public", canWrite: true, archived: false, description: "" }; },
    async readSnapshot(ref) { calls.push(`readSnapshot ${ref}`); return Object.hasOwn(commits, ref) ? snapshotOf(commits[ref]) : snapshot; },
    async listPullRequests() { calls.push("listPullRequests"); return pullRequests; },
    async containsCommit() { calls.push("containsCommit"); return false; },
    async commitFiles() { calls.push("commitFiles"); throw new Error("a render writes nothing"); },
  };
}
// The context a route gets: the product's host and the instance's, as the frame hands them; where the product is the instance, one host.
function contextOf(files, { pullRequests = PRS, calls = [], tokenStored = true, instanceFiles = null, instanceCommits = {} } = {}) {
  const host = hostOf(files, pullRequests, calls);
  return { calls, page: "review", instance: { repository: "acme/agent-m", host: instanceFiles ? hostOf(instanceFiles, [], calls, instanceCommits) : host }, product: { address: ADDRESS, kind: "github", host, tokenStored }, store: {}, go() {} };
}
async function render(files, options = {}) {
  const context = contextOf(files, options);
  const target = document.createElement("div");
  document.body.append(target);
  const drawn = recorder();
  await (options.route ?? route).render(target, context, {});
  return { target, context, html: htmlOf(target), charts: drawn.texts };
}
// The HTML of the part that begins with `marker` and ends where the next panel begins.
function part(html, marker) {
  const at = html.indexOf(marker);
  assert.ok(at >= 0, `the page has ${marker}`);
  const next = html.indexOf('<section class="panel"', at + marker.length);
  return html.slice(at, next < 0 ? undefined : next);
}
const row = (html, item) => { const at = html.indexOf(`data-item="${item}"`); return at < 0 ? "" : html.slice(at, html.indexOf("</tr>", at)); };

// TST-681001 · level: unit · module: MOD-implementation-pages
// guards: UC-032; UC-035
// given: the fixture product with both teams named by their role assignments
// input: the route backlog's render
// expect: the route is named backlog, under the entry implementation, titled Backlog; the page holds the head, then the names no item realises yet, then team1's panel, then team2's, then the backlog — in that order —, and a folded What is this? in the head
test("the backlog page shows what no item realises yet first, then the teams' sprints, then the backlog", async () => {
  assert.deepEqual([route.name, route.entry, route.title], ["backlog", "implementation", "Backlog"]);
  const { html } = await render(fixtureFiles());
  const order = ['<section class="head"', 'data-part="uncovered"', 'data-team="team1"', 'data-team="team2"', 'data-part="backlog"'].map((marker) => html.indexOf(marker));
  assert.ok(order.every((at) => at >= 0), String(order));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.match(part(html, '<section class="head"'), /<details class="explain"><summary>What is this\?<\/summary>/);
});

// TST-681002 · level: unit · module: MOD-implementation-pages
// guards: UC-032; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; SPRINTS OF DIFFERENT TEAMS CHANGE NO MODULE THE OTHER CHANGES OR USES
// given: the fixture: ITM-001 merged into team1's sprint branch, ITM-002's pull request open, ITM-003 and ITM-005 ready, ITM-004 builds on ITM-003, ITM-006 realises a requirement that is not accepted; and a pull request that names no item
// input: the route's render
// expect: one row per item, each after the items it builds on — ITM-001 to ITM-006; ITM-001 done, ITM-002 in progress, ITM-003 ready, ITM-004 waiting for an item it builds on, naming ITM-003, ITM-006 waiting for acceptance, naming RULE NOT ACCEPTED; ITM-005 ready and marked as kept from team2, naming the sprint team1/01, the item ITM-001 and the module MOD-store
test("the backlog lists each item after the items it builds on, with its derived state and what keeps it from a team", async () => {
  const { html } = await render(fixtureFiles());
  const backlog = part(html, 'data-part="backlog"');
  assert.deepEqual([...backlog.matchAll(/<tr data-item="(ITM-\d{3})"/g)].map((match) => match[1]), ["ITM-001", "ITM-002", "ITM-003", "ITM-004", "ITM-005", "ITM-006"]);
  assert.match(row(backlog, "ITM-001"), /done/);
  assert.match(row(backlog, "ITM-002"), /in progress/);
  assert.match(row(backlog, "ITM-003"), />ready</);
  assert.match(row(backlog, "ITM-004"), /waiting for an item it builds on/);
  assert.match(row(backlog, "ITM-004"), /ITM-003/);
  assert.match(row(backlog, "ITM-005"), />ready</);
  assert.match(row(backlog, "ITM-006"), /waiting for acceptance/);
  assert.match(row(backlog, "ITM-006"), /RULE NOT ACCEPTED/);
  const kept = row(backlog, "ITM-005");
  for (const named of ["team2", "team1/01", "ITM-001", "MOD-store"]) assert.ok(kept.includes(named), `ITM-005 names ${named}`);
});

// TST-681003 · level: unit · module: MOD-implementation-pages
// guards: UC-035; EVERY TEAM RUNS SPRINTS OF ITS OWN; A SPRINT HOLDS ITS ITEMS UNTIL THEY REACH THE DEFAULT BRANCH
// given: team1's running sprint 01 with ITM-001, merged into its branch on 2026-09-15, and ITM-002, whose pull request is open; a limit of 2 items in progress
// input: the render of the route progress, which shows the running sprints since ITM-1252, and of the route backlog
// expect: on progress, team1's panel names its sprint team1/01 and its goal, lists ITM-001 done and ITM-002 in progress, each with the module it changes, says 1 of 2 items in progress, and holds the burn-down as a Mermaid chart that begins with 2 remaining; on the backlog, team2's panel says it runs no sprint, names its last sprint team2/01 and offers Plan sprint for team2
test("a team's panel shows its running sprint with its items, their modules and its burn-down, and a team without one says so", async () => {
  const { html: now, charts } = await render(fixtureFiles(), { route: progressRoute });
  const { html } = await render(fixtureFiles());
  const team1 = part(now, 'data-team="team1"');
  assert.match(team1, /team1\/01/);
  assert.match(team1, /Store and show/);
  assert.match(row(team1, "ITM-001"), /done/);
  assert.match(row(team1, "ITM-001"), /MOD-store/);
  assert.match(row(team1, "ITM-002"), /in progress/);
  assert.match(team1, /1 of 2 items in progress/);
  const chart = charts.find((each) => each.includes("team1/01"));
  assert.match(chart, /^xychart-beta/);
  assert.match(chart, /line \[2, 1/);
  const team2 = part(html, 'data-team="team2"');
  assert.match(team2, /no running sprint/i);
  assert.match(team2, /Its last sprint, .*team2\/01/s);
  assert.match(team2, /data-plan="team2"/);
});

// TST-681004 · level: unit · module: MOD-implementation-pages
// guards: UC-035; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: the same-day sprint — team1's sprint 01 starts on 2026-09-14 with ITM-001, ITM-002 and ITM-005; ITM-001 is merged at 09:30 UTC that day, ITM-005 at 11:45 UTC, ITM-002's pull request is open, and the page's clock stands at 2026-09-17 12:00 UTC; and, in a second product, team2's closed sprint 01 from 2026-09-01 to 2026-09-07 with ITM-003, ITM-004 and ITM-006, merged on 2026-09-02 10:15, 2026-09-03 16:40 and — after the end — 2026-09-10
// input: the render of the route progress for the first, of the route backlog for the second
// expect: team1's chart has one point per day of the sprint, from its start to today — 09-14, 09-15, 09-16 and 09-17 —, each the items left at that day's end: 1, 1, 1 and 1; team2's final chart has the start, the two merges by their date and time within the sprint, and end — 3, 2, 1 and 1 left —, no merge after its end and no "now"
test("a running sprint's chart counts the items left at the end of each day, from its start to today; a closed sprint's chart ends at its end", async () => {
  const sameDay = { ...fixtureFiles(), [TEAM1_SPRINT]: lines("---", "sprint: 1", "goal: Store and show", "start: 2026-09-14", "end:", "closer: alice", "branch: sprint/team1/01", "selection:", "  - ITM-001", "  - ITM-002", "  - ITM-005", "---", "# team1 Sprint 01") };
  mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-09-17T12:00:00Z") });
  let same;
  try {
    same = await render(sameDay, { route: progressRoute, pullRequests: [pr({ number: 1, item: "ITM-001", base: "sprint/team1/01", created: "2026-09-14T08:00:00Z", merged: "2026-09-14T09:30:00Z" }),
      pr({ number: 2, item: "ITM-002", base: "sprint/team1/01", created: "2026-09-14T08:10:00Z" }), pr({ number: 5, item: "ITM-005", base: "sprint/team1/01", created: "2026-09-14T08:20:00Z", merged: "2026-09-14T11:45:00Z" })] });
  } finally { mock.timers.reset(); }
  const team1 = same.charts.find((each) => each.includes("team1/01"));
  assert.match(team1, /x-axis \["09-14", "09-15", "09-16", "09-17"\]/);
  assert.match(team1, /line \[1, 1, 1, 1\]/);
  const closed = { ...fixtureFiles(), [TEAM2_SPRINT]: lines("---", "sprint: 1", "goal: Mail", "start: 2026-09-01", "end: 2026-09-07", "closer: bob", "branch:", "selection:", "  - ITM-003", "  - ITM-004", "  - ITM-006", "---",
    "# team2 Sprint 01", "", "## Review", "", "ITM-003 and ITM-004 are done.", "", "## Unfinished items", "", "to the backlog: ITM-006", "into the next sprint:", "", "ITM-006 waits for its requirement.", "", "## Retrospective", "", "- change: smaller items.") };
  const after = await render(closed, { pullRequests: [...PRS, pr({ number: 6, item: "ITM-003", base: "main", created: "2026-09-01T09:00:00Z", merged: "2026-09-02T10:15:00Z" }),
    pr({ number: 7, item: "ITM-004", base: "main", created: "2026-09-02T11:00:00Z", merged: "2026-09-03T16:40:00Z" }), pr({ number: 8, item: "ITM-006", base: "main", created: "2026-09-08T09:00:00Z", merged: "2026-09-10T09:00:00Z" })] });
  const team2 = after.charts.find((each) => each.includes("team2/01"));
  assert.match(team2, /x-axis \["start", "09-02 10:15", "09-03 16:40", "end"\]/);
  assert.match(team2, /line \[3, 2, 1, 1\]/);
  assert.doesNotMatch(team2, /"now"/);
});

// TST-681005 · level: unit · module: MOD-implementation-pages
// guards: SPRINT PLANNING SHOWS WHAT THE OTHER TEAMS' SPRINTS HOLD; SPRINTS OF DIFFERENT TEAMS CHANGE NO MODULE THE OTHER CHANGES OR USES; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the fixture, and the person's click on Plan sprint for team2 (the route draws itself again with team2's plan)
// input: the click on Plan sprint of team2
// expect: the page holds team2's plan: ITM-001, which is done, not offered, ITM-003 offered to select and ITM-005 disabled, kept by team1's sprint; the closer preset to team2's Owner, bob; beside it what the other teams' sprints hold — ITM-001 and ITM-002, each with its title, team1/01, the modules it changes and uses; Start sprint is offered and enabled; before the click no plan is drawn; a render writes nothing (no commit)
test("Plan sprint lists what the team may select and, beside it, every item the other teams' sprints hold", async () => {
  const calls = [];
  const { target, html } = await render(fixtureFiles(), { calls });
  assert.equal(byData(target, "data-plan-team").length, 0, "no plan before the click");
  byData(target, "data-plan", "team2")[0].dispatchEvent(new Event("click"));
  await new Promise((resolve) => setTimeout(resolve, 50));
  void html;
  const plan = part(htmlOf(target), 'data-plan-team="team2"');
  assert.match(plan, /Plan sprint for team2/);
  assert.equal(row(plan, "ITM-001"), "", "an item that is done is not offered");
  assert.match(row(plan, "ITM-003"), /data-select-item="ITM-003"(?![^>]*disabled)/);
  assert.match(row(plan, "ITM-005"), /data-select-item="ITM-005"[^>]*disabled/);
  assert.match(row(plan, "ITM-005"), /team1\/01 holds ITM-001/);
  assert.match(plan, /data-sprint-closer="" value="bob"/);
  assert.match(plan, /<button class="btn primary" data-start-sprint="team2">Start sprint<\/button>/);
  const held = part(htmlOf(target), 'data-part="held"');
  for (const item of ["ITM-001", "ITM-002"]) {
    const entry = row(held, item).length ? row(held, item) : held.slice(held.indexOf(`data-held="${item}"`), held.indexOf("</tr>", held.indexOf(`data-held="${item}"`)));
    assert.match(entry, /team1\/01/);
  }
  assert.match(held, /MOD-store/);
  assert.ok(!calls.includes("commitFiles"), "nothing is written");
});

// TST-681006 · level: unit · module: MOD-implementation-pages
// guards: THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT
// given: the fixture, no token stored for the product, and the person's click on Plan sprint
// input: the route's render with tokenStored false, then the click
// expect: Start sprint is disabled and the page says that starting a sprint commits to the product's repository and a token is stored first (a link to the settings)
test("without a token for the product Start sprint is disabled and says why", async () => {
  const { target } = await render(fixtureFiles(), { tokenStored: false });
  byData(target, "data-plan", "team2")[0].dispatchEvent(new Event("click"));
  await new Promise((resolve) => setTimeout(resolve, 50));
  const plan = part(htmlOf(target), 'data-plan-team="team2"');
  assert.match(plan, /<button class="btn primary" data-start-sprint="team2" disabled="">Start sprint<\/button>/);
  assert.match(plan, /store a token for it first \(<a href="#settings">Settings<\/a>\)/);
});

// TST-681007 · level: unit · module: MOD-implementation-pages
// guards: UC-032; EVERY STEP EXPLAINS ITSELF
// given: the fixture, with ITM-1000 and ITM-999 among the items, and ITM-007, which builds on ITM-008, and an accepted use case no item realises, and an open one
// input: the route's render
// expect: the backlog lists the items in the order of their numbers — ITM-999 before ITM-1000 — except that ITM-008 stands before ITM-007, which builds on it; the names no item realises lists RULE TWO as an accepted requirement and UC-001 as an accepted use case, and not UC-002, which is open; every panel carries a folded explanation (details.explain)
test("items of four digits stand in the order of their numbers, and what no item realises names the accepted requirements and use cases", async () => {
  const files = { ...fixtureFiles(), [itemPath(999)]: itemText(999, { modules: ["MOD-mail"] }), [itemPath(1000)]: itemText(1000, { modules: ["MOD-feed"] }),
    [itemPath(7)]: itemText(7, { modules: ["MOD-feed"], buildsOn: ["ITM-008"] }), [itemPath(8)]: itemText(8, { modules: ["MOD-feed"] }) };
  const { html } = await render(files);
  const backlog = part(html, 'data-part="backlog"');
  const ids = [...backlog.matchAll(/<tr data-item="(ITM-\d{3,})"/g)].map((match) => match[1]);
  assert.ok(ids.indexOf("ITM-999") >= 0 && ids.indexOf("ITM-999") < ids.indexOf("ITM-1000"), ids.join(" "));
  assert.ok(ids.indexOf("ITM-008") >= 0 && ids.indexOf("ITM-008") < ids.indexOf("ITM-007"), `an item stands after the item it builds on, whatever their numbers: ${ids.join(" ")}`);
  const uncovered = part(html, 'data-part="uncovered"');
  assert.match(uncovered, /1 accepted use case:/);
  assert.match(uncovered, /<code>UC-001<\/code>/);
  assert.doesNotMatch(uncovered, /UC-002/);
  assert.match(uncovered, /1 accepted requirement:/);
  assert.match(uncovered, /<code>RULE TWO<\/code>/);
  for (const marker of ['<section class="head"', 'data-team="team1"', 'data-team="team2"', 'data-part="backlog"', 'data-part="uncovered"']) {
    assert.match(part(html, marker), /<details class="explain">/, `${marker} explains itself`);
  }
});

// TST-681008 · level: unit · module: MOD-implementation-pages
// guards: UC-002; UC-032
// given: a product that declares no process model; one whose declaration names a model file the catalogue does not hold; one whose model plans its work in advance (a V-model); one whose model works without sprints (Kanban, with a limit of 3)
// input: the route's render for each
// expect: the first says the product declares no process model yet and names docs/process.md; the second names the model file that the catalogue does not hold; the third says there is no backlog and links the implementation plan, #plan; the fourth shows no team panel and the part Work in progress with its limit
test("the page says what is missing or what does not apply: no model, an unknown model file, a planned model, a model without sprints", async () => {
  const withoutDeclaration = fixtureFiles();
  delete withoutDeclaration["docs/process.md"];
  const none = await render(withoutDeclaration);
  assert.match(none.html, /declares no process model yet.*docs\/process\.md/s);
  const unknown = await render({ ...fixtureFiles(), "docs/process.md": DECLARATION.replace("docs/process-models/fixture.md", "docs/process-models/missing.md") });
  assert.match(unknown.html, /names the model file <code>docs\/process-models\/missing\.md<\/code>, which the catalogue does not hold/);
  const planned = await render({ ...fixtureFiles(), "docs/process.md": DECLARATION.replace("model: fixture-scrum-wip", "model: v-model").replace("docs/process-models/fixture.md", "src/model-catalogue/models/v-model.md") });
  assert.match(planned.html, /plans its work in advance: there is no backlog.*<a href="#plan">/s);
  const kanban = await render({ ...fixtureFiles(), "docs/process.md": DECLARATION.replace("model: fixture-scrum-wip", "model: kanban").replace("docs/process-models/fixture.md", "src/model-catalogue/models/kanban.md") });
  assert.doesNotMatch(kanban.html, /data-team=/);
  assert.match(kanban.html, /data-part="flow"/);
  assert.match(kanban.html, /of a limit of 3/);
});

// TST-681009 · level: unit · module: MOD-implementation-pages
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; A PAGE LOAD READS THE REPOSITORY IN BATCHES; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the fixture, with the product's host and the instance's host as one (the page shows the instance itself), and the branch the page has read named in the context
// input: the route's render
// expect: the pull requests are listed once; the repository's information is not asked for when the context names the branch, and the snapshot is read once, with the commit the declaration's model_version names; the default branch is asked for when the context names none; no commit is made
test("a render lists the pull requests once, reads one snapshot, and writes nothing", async () => {
  const named = [];
  const context = contextOf(fixtureFiles(), { calls: named });
  context.product.ref = "main";
  const target = document.createElement("div");
  recorder();
  await route.render(target, context, {});
  assert.equal(named.filter((call) => call === "listPullRequests").length, 1);
  assert.deepEqual(named.filter((call) => call.startsWith("readSnapshot")), ["readSnapshot main", `readSnapshot ${"a".repeat(40)}`], "the branch once, and the commit the declaration names once");
  assert.ok(!named.includes("repositoryInfo"), "the branch is the one the context names");
  assert.ok(!named.includes("commitFiles"));
  const asked = [];
  await render(fixtureFiles(), { calls: asked });
  assert.ok(asked.includes("repositoryInfo"), "without a named branch the repository's default is asked for");
});

// TST-681010 · level: unit · module: MOD-implementation-pages
// guards: UC-002; THE CATALOGUE IS DATA
// given: the fixture product and a separate instance whose files hold the model the declaration names (docs/process-models/fixture.md), while the product holds no model file
// input: the route's render with the two hosts
// expect: the teams' panels are drawn — the model is found in the instance's catalogue, not in the product's repository
test("the model the declaration names is found in the instance's catalogue", async () => {
  const productFiles = fixtureFiles();
  const instanceFiles = { "docs/process-models/fixture.md": productFiles["docs/process-models/fixture.md"], "SPEC.md": "# Instance\n" };
  delete productFiles["docs/process-models/fixture.md"];
  const { html } = await render(productFiles, { instanceFiles });
  assert.match(html, /data-team="team1"/);
  assert.doesNotMatch(html, /which the catalogue does not hold/);
});

// TST-681011 · level: unit · module: MOD-implementation-pages
// guards: THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the fixture, and the plan of team2 open, no goal, closer or item entered
// input: a click that is not the person's (isTrusted false) on Start sprint, then the person's click (isTrusted true)
// expect: the first changes nothing — the result area stays empty and nothing is written; the second is taken up: the page asks for the goal, the closer and an item
test("Start sprint is taken up only on a trusted click", async () => {
  const calls = [];
  const handlers = [];
  const Element = globalThis.window.Element, add = Element.prototype.addEventListener;
  Element.prototype.addEventListener = function (type, listener, ...rest) { if (type === "click") handlers.push([this, listener]); return add.call(this, type, listener, ...rest); };
  let target;
  try {
    ({ target } = await render(fixtureFiles(), { calls }));
    byData(target, "data-plan", "team2")[0].dispatchEvent(new Event("click"));
    await new Promise((resolve) => setTimeout(resolve, 50));
  } finally { Element.prototype.addEventListener = add; }
  const button = byData(target, "data-start-sprint", "team2")[0];
  const listener = handlers.filter(([element]) => element === button).at(-1)?.[1];
  assert.equal(typeof listener, "function", "known positive: the recorder sees the button's click listener");
  const result = () => target.querySelector("[data-plan-result]").innerHTML;
  await listener({ isTrusted: false });
  assert.equal(result(), "", "an untrusted click is not taken up");
  assert.ok(!calls.includes("commitFiles"), "nothing is written");
  await listener({ isTrusted: true });
  assert.match(result(), /Name the sprint's goal/, "a trusted click is taken up (known positive)");
});

// TST-681012 · level: unit · module: MOD-implementation-pages
// guards: UC-031; THE CATALOGUE IS DATA
// given: a declaration whose model_version names a commit of the instance; the model file at that commit plans sprints, and the same file now declares none (Sprints no)
// input: the route's render with the two hosts
// expect: the model is read as it stood at the commit the declaration names: the teams' sprint panels are drawn and the page does not say that the model works without sprints
test("the model is read as it stood at the commit the declaration names, not as it stands now", async () => {
  const productFiles = fixtureFiles();
  delete productFiles["docs/process-models/fixture.md"];
  const then = readFileSync(new URL("./fixtures/flow/scrum-wip.md", import.meta.url), "utf8");
  const now = then.replace("| Sprints | yes |", "| Sprints | no |");
  assert.notEqual(now, then, "known positive: the fixture changes");
  const commit = "a".repeat(40);
  const { html, context } = await render(productFiles, { instanceFiles: { "docs/process-models/fixture.md": now, "SPEC.md": "# Instance\n" }, instanceCommits: { [commit]: { "docs/process-models/fixture.md": then, "SPEC.md": "# Instance\n" } } });
  assert.ok(context.calls.includes(`readSnapshot ${commit}`), "the commit is read");
  assert.match(html, /data-team="team1"/);
  assert.doesNotMatch(html, /works without sprints/);
});

// TST-8110 · level: unit · module: MOD-implementation-pages
// guards: UC-032; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: the fixture, with ITM-003 — which no pull request names, and on which ITM-004 builds — built by the commit B1 (its built_by); then the fixture without it
// input: the route's render, and the commits the host's containsCommit is asked about
// expect: B1 is never asked about — the record decides —; with built_by, ITM-003 done and ITM-004 ready, no longer waiting for an item it builds on; without it, ITM-003 ready and ITM-004 waiting for an item it builds on
test("the backlog derives an item done by its built_by with no request", async () => {
  const B1 = "b1".repeat(20);
  for (const builtBy of [true, false]) {
    const files = fixtureFiles();
    if (builtBy) files[itemPath(3)] = files[itemPath(3)].replace("\n---\n# ITM-003", `\nbuilt_by:\n  - ${B1}\n---\n# ITM-003`);
    const context = contextOf(files);
    const asked = [];
    const contains = context.product.host.containsCommit;
    context.product.host.containsCommit = async (branch, commit) => { asked.push([branch, commit]); return contains ? contains(branch, commit) : false; };
    const target = document.createElement("div");
    document.body.append(target);
    recorder();
    await route.render(target, context, {});
    const backlog = part(htmlOf(target), 'data-part="backlog"');
    assert.deepEqual(asked.filter(([, commit]) => commit === B1), [], `built_by ${builtBy}`);
    if (builtBy) {
      assert.match(row(backlog, "ITM-003"), /done/);
      assert.match(row(backlog, "ITM-004"), />ready</);
    } else {
      assert.match(row(backlog, "ITM-003"), />ready</);
      assert.match(row(backlog, "ITM-004"), /waiting for an item it builds on/);
    }
  }
});
