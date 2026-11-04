// MOD-implementation-pages ends a sprint (ITM-783), on the route `progress` since ITM-1252, as the accepted text of docs/architecture/MOD-implementation-pages.md states it: "`progress` — … In a model with
// sprints it shows what goes on now (UC-035): each team's running sprint …; *End sprint* with `endSprint` for a running sprint without a time box", and UC-032 6b: "in a sprint without one [a time box], when
// every selected item is done or the Product Owner presses **End sprint**, one click, which records the end with the sprint". MOD-work-plans' endSprint appends `## Ended` to a sprint without a time box and
// refuses (NotEndable) a sprint with one or one ended already.
// Run: node --test tests/implementation-pages-backlog-end-sprint.test.mjs
//
// Module: MOD-implementation-pages
// Guards: UC-032; ONE CLICK PER DECISION; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// Level: unit
//
// The product is a small Scrum-with-limit fixture with two teams, held in memory behind a host of this file's own that answers MOD-repository-hosts' interface and applies a commit to its files; the process
// model is the instance's, read from a second host. Nothing reaches the network. Readings the texts leave open, which the tests state (the pull request names them): the button of a team stands in its panel
// while the team's sprint runs, as *Change the selection* does, and is `data-end-sprint="<team>"`; "already ended" is the sprint's record holding `## Ended`; a click that is not the person's writes nothing.
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import "./site-frame-dom.mjs";
const { view } = await import("../src/implementation-pages/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "progress");

const matches = (element, selector) => {
  const attribute = /^\[([a-z-]+)(?:="([^"]*)")?\]$/.exec(selector);
  if (selector === "pre > code.language-mermaid") return element.localName === "code" && element.getAttribute("class") === "language-mermaid" && element.parentNode?.localName === "pre";
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
globalThis.SVGElement ??= class SVGElement {};
afterEach(() => { delete globalThis.mermaid; });
const recorder = () => { globalThis.mermaid = { initialize() {}, mermaidAPI: { getDiagramFromText: async () => ({ db: { getVertices: () => ({}) } }) }, run: async () => {} }; };

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
const sprint = ({ n = 1, start, end = "", goal, selection, tail = [] }) => lines("---", `sprint: ${n}`, `goal: ${goal}`, `start: ${start}`, `end: ${end}`, "closer: alice", "branch:", "selection:", ...selection.map((each) => `  - ${each}`), "---",
  `# Sprint ${n}`, ...tail);
const TEAM1 = "docs/backlog/sprints/team1/01.md";
const TEAM2 = "docs/backlog/sprints/team2/01.md";

function productFiles(overrides = {}) {
  return {
    "SPEC.md": SPEC, "docs/process.md": DECLARATION, "docs/process-models/fixture.md": readFileSync(new URL("./fixtures/flow/scrum-wip.md", import.meta.url), "utf8"),
    "docs/role-assignments/team1.md": assignment("team1", "alice", "dev-a"), "docs/role-assignments/team2.md": assignment("team2", "bob", "dev-b"),
    "docs/backlog/ITM-001-item-1.md": item(1), "docs/backlog/ITM-002-item-2.md": item(2),
    [TEAM1]: sprint({ start: "2026-09-14", goal: "Store", selection: ["ITM-001"] }),
    [TEAM2]: sprint({ start: "2026-09-01", end: "2026-09-07", goal: "Mail", selection: ["ITM-002"] }),
    ...overrides,
  };
}

const named = (name, message) => Object.assign(new Error(message), { name });
// The product's host, applying a commit to `files`; `commits` keeps each commitFiles call.
function hostOf(files, commits) {
  const snapshot = () => ({ repository: { server: "github", path: "acme/product", web: ADDRESS }, ref: "main", commit: COMMIT, paths: Object.keys(files), blob: (path) => (Object.hasOwn(files, path) ? blobOf(files[path]) : null),
    read: async (path) => (Object.hasOwn(files, path) ? files[path] : null), readMany: async () => {}, readOn: async () => { throw named("NotFound", "no such file"); } });
  return {
    async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite: true, archived: false, description: "" }; },
    async readSnapshot() { return snapshot(); },
    async listPullRequests() { return []; },
    async containsCommit() { return false; },
    async commitFiles(change) { commits.push(change); for (const file of change.files) files[file.path] = file.text; return { commit: "d".repeat(40), url: "https://example.org/d" }; },
  };
}
// The page, with the listeners of its click events kept by button.
async function render(overrides) {
  const files = productFiles(overrides), commits = [], handlers = [];
  const Element = globalThis.window.Element, add = Element.prototype.addEventListener;
  Element.prototype.addEventListener = function (type, listener, ...rest) { if (type === "click") handlers.push([this, listener]); return add.call(this, type, listener, ...rest); };
  const host = hostOf(files, commits);
  const instance = hostOf({ "SPEC.md": "# Instance\n", "docs/process-models/fixture.md": files["docs/process-models/fixture.md"] }, []);
  const target = document.createElement("div");
  document.body.append(target);
  recorder();
  try {
    await route.render(target, { page: "review", instance: { repository: "acme/agent-m", host: instance }, product: { address: ADDRESS, kind: "github", host, tokenStored: true }, store: {}, go() {} }, {});
  } finally { Element.prototype.addEventListener = add; }
  const listenerOf = (button) => handlers.filter(([element]) => element === button).at(-1)?.[1];
  return { target, files, commits, listenerOf };
}
const endButtons = (target, team) => found(target, `[data-end-sprint="${team}"]`);

// TST-783001 · level: unit · module: MOD-implementation-pages
// guards: UC-032
// given: team1's sprint 01 runs without a time box; team2's sprint 01 has ended on its date (2026-09-07)
// input: the route progress's render
// expect: team1's panel offers End sprint (one button, data-end-sprint="team1"); team2's panel, with no running sprint, offers none
test("the progress page offers End sprint for a running sprint without a time box", async () => {
  const { target } = await render();
  assert.equal(endButtons(target, "team1").length, 1);
  assert.equal(found(target, "[data-end-sprint]").length, 1, "known positive: only team1's button stands on the page");
  assert.match(found(target, '[data-team="team1"]')[0].textContent, /End sprint/);
});

// TST-783002 · level: unit · module: MOD-implementation-pages
// guards: UC-032
// given: team1's running sprint has a time box (end: 2099-12-31); and, as a second page, one without a time box whose record already holds `## Ended` of today (so that the sprint has ended: it is drawn as ended, waiting for its review)
// input: the route progress's render, both ways
// expect: neither page offers End sprint (the counter-proof of TST-783001); the second page says the sprint ended, that its review and retrospective are not recorded yet, and offers no Change the selection
test("the progress page offers no End sprint for a sprint with a time box or one already ended", async () => {
  const boxed = await render({ [TEAM1]: sprint({ start: "2026-09-14", end: "2099-12-31", goal: "Store", selection: ["ITM-001"] }) });
  assert.equal(found(boxed.target, '[data-team="team1"]').length, 1, "known positive: team1's panel is drawn");
  assert.equal(found(boxed.target, "[data-end-sprint]").length, 0, "a time box ends on its date");
  const ended = await render({ [TEAM1]: sprint({ start: "2026-09-14", goal: "Store", selection: ["ITM-001"], tail: ["", "## Ended", "", `at: ${new Date().toISOString().slice(0, 10)}`] }) });
  assert.match(found(ended.target, '[data-team="team1"]')[0].textContent, /It ended on \d{4}-\d{2}-\d{2}; its review and retrospective are not recorded yet\./, "known positive: team1's sprint is drawn as ended on the page");
  assert.doesNotMatch(found(ended.target, '[data-team="team1"]')[0].textContent, /Change the selection/, "an ended sprint's selection is not changed");
  assert.equal(found(ended.target, "[data-end-sprint]").length, 0, "an ended sprint is not ended twice");
});

// TST-783003 · level: unit · module: MOD-implementation-pages
// guards: ONE CLICK PER DECISION; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: team1's running sprint without a time box
// input: a click that is not the person's (isTrusted false) on End sprint, then the person's click (isTrusted true)
// expect: the first writes nothing; the second makes one commit holding only docs/backlog/sprints/team1/01.md with `## Ended`, on the default branch at the head read; the page is drawn again with no End sprint for team1
test("End sprint is one click that writes ## Ended, and only the person's click", async () => {
  const { target, files, commits, listenerOf } = await render();
  const listener = listenerOf(endButtons(target, "team1")[0]);
  assert.equal(typeof listener, "function", "known positive: the button has a click listener");
  await listener({ isTrusted: false });
  assert.equal(commits.length, 0, "an untrusted click writes nothing");
  await listener({ isTrusted: true });
  assert.equal(commits.length, 1, "one commit");
  assert.deepEqual(commits[0].files.map((file) => file.path), [TEAM1]);
  assert.match(files[TEAM1], /^## Ended$/m);
  assert.equal(commits[0].branch, "main");
  assert.equal(commits[0].expectedHead, COMMIT);
  assert.equal(found(target, "[data-end-sprint]").length, 0, "the page is drawn again: the sprint is ended");
});
