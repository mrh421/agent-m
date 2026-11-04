// MOD-implementation-pages' route `implement` offers a participant a linked source forbids only where the job can do without that source's content (ITM-1160), as the accepted text of
// docs/architecture/MOD-implementation-pages.md states it in its Uses: "MOD-source-register.sourceSchemas, restrictedPlaces — ... the places each restricted source permits, against which the route `implement`
// judges the participants it offers: a participant whose place a linked source forbids is offered only where the job needs none of that source's content, and the content is named (UC-024 5b)."
// Run: node --test tests/implementation-pages-implement-places.test.mjs
//
// Module: MOD-implementation-pages
// Guards: UC-024; RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS; A JOB GOES ONLY TO A HOLDER OF ITS ROLE
// Level: unit
//
// The product is the Scrum fixture of tests/implementation-pages-implement.test.mjs with the sprint selecting ITM-001 and ITM-005; team1's assignment gives the role Builders to dev-a, who processes data at
// "this machine", and to dev-b, who processes data at "elsewhere". The instance's register holds the source SRC-fixture, whose licence and places are as each test states. The recipe
// `implementation-inputs` is stood in for: the part it gives for ITM-005 cites SRC-fixture, the part for ITM-001 cites no source, so ITM-005's job would include the source's content and ITM-001's would not.
// Nothing reaches the network. Readings the texts leave open, which the tests state (the pull request names them):
//   - "offered" is the option in <select data-participant-of="<item>">; a participant a source forbids is not an option.
//   - "the content is named": the text of <p data-withheld-of="<item>"> names the participant that is not offered, the source (SRC-fixture) whose content the job would include and the place.
//   - A job that includes no content of the source is judged as before: every holder of the role is offered.
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import "./site-frame-dom.mjs";
const { view } = await import("../src/implementation-pages/index.mjs");
const { registerStrategies } = await import("../src/job-runner/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "implement");

// ---------------------------------------------------------------- the DOM: the selectors the route finds its controls by
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
globalThis.SVGElement ??= class SVGElement {};
afterEach(() => { delete globalThis.mermaid; });
const text = (node) => node.textContent.replace(/\s+/g, " ").trim();
const trusted = () => Object.defineProperty(new Event("click"), "isTrusted", { value: true });


// ---------------------------------------------------------------- the strategies the kind names: stand-ins
const broken = { on: false };
const part = (name, sources = []) => ({ name, text: name, size: 0, sources, required: true });
registerStrategies("tests/implementation-pages-implement-places.test.mjs", {
  recipes: { "implementation-inputs": async (_, params) => { if (broken.on) throw new Error("the inputs cannot be read"); return [part(`inputs of ${(params.items ?? []).join(", ")}`, (params.items ?? []).includes("ITM-005") ? ["SRC-fixture"] : [])]; },
    "chapters-for-implementation": async () => [part("chapters 9, 11, 12 and 13")], "resource-pins": async () => [] },
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

function productFiles({ selection = ["ITM-004", "ITM-005", "ITM-006"], withWorkflow = true } = {}) {
  return {
    "SPEC.md": SPEC, "docs/process.md": DECLARATION, "docs/process-models/fixture.md": readFileSync(new URL("./fixtures/flow/scrum-wip.md", import.meta.url), "utf8"),
    "docs/role-assignments/team1.md": assignment,
    "docs/architecture/MOD-store.md": moduleFile("MOD-store", []), "docs/architecture/MOD-pages.md": moduleFile("MOD-pages", ["MOD-store.read"]), "docs/architecture/MOD-mail.md": moduleFile("MOD-mail", []),
    [itemPath(1)]: itemText(1, { modules: ["MOD-store"] }), [itemPath(2)]: itemText(2, { modules: ["MOD-pages"], buildsOn: ["ITM-001"] }),
    [itemPath(3)]: itemText(3, { modules: ["MOD-mail"] }), [itemPath(4)]: itemText(4, { modules: ["MOD-pages"], buildsOn: ["ITM-003"] }),
    [itemPath(5)]: itemText(5, { modules: ["MOD-store"] }), [itemPath(6)]: itemText(6, { modules: ["MOD-mail"], realises: ["RULE NOT ACCEPTED"] }),
    "docs/backlog/sprints/team1/01.md": sprint(selection),
    ...(withWorkflow ? { [JOB_WORKFLOW]: "name: agent-m jobs\n" } : {}),
  };
}
const pr = ({ number, item, merged = null }) => ({ number, title: `${item}: the work of ${item}`, branch: `team/${item}`, base: "main", head: merged ? "f".repeat(40) : "b".repeat(40),
  state: merged ? "merged" : "open", draft: false, url: `${ADDRESS}/pull/${number}`, opened: "2026-09-15T12:00:00Z", merged, closed: merged });
const OPEN_PRS = [pr({ number: 1, item: "ITM-001" }), pr({ number: 2, item: "ITM-003" })];

const ROOT = new URL("../", import.meta.url);
const HEAD = readFileSync(new URL("docs/participants.md", ROOT), "utf8").split("\n").filter((row, at, all) => at <= all.findIndex((each) => each.startsWith("|---"))).join("\n");
const CAPABILITIES = "read the repository, write to the repository, run code and tests, use tools";
const REGISTER = `${HEAD}\n| dev-a | model endpoint | model-a | 200000 | — | ${CAPABILITIES} | this machine | ci hosted secret DEV_KEY |\n| dev-b | model endpoint | model-b | 200000 | — | ${CAPABILITIES} | elsewhere | ci hosted secret DEV_KEY |\n`;
const assignmentBoth = lines("# team1", "", "## Roles", "", "| Role | Participants |", "|---|---|", "| Owner | alice |", "| Builders | dev-a, dev-b |", "| Checker | dev-a |");
const sourceEntry = (licence, places) => lines("---", "id: SRC-fixture", "title: The fixture source", "kind: document", "authority: normative", `licence: ${licence}`,
  ...(places.length ? ["places:", ...places.map((place) => `  - ${place}`)] : []), "---", "# SRC-fixture The fixture source", "", "## Versions", "", "| Version | Date | Edition | Read from | Files |", "|---|---|---|---|---|",
  "| `1` | 2026-10-13 | fixture | here | one file, hashed only |");

// A host of this file's own: the part of MOD-repository-hosts' interface the route uses.
function hostOf(files) {
  const tree = new Map(Object.entries(files));
  return {
    async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite: true, archived: false, description: "" }; },
    // The file at each commit, as the one tree holds it (MOD-repository-hosts' readFileAt), for the declared model and practices the route reads (ITM-1264).
    async readFileAt(path, commits) { return new Map(commits.map((commit) => [commit, tree.has(path) ? tree.get(path) : null])); },
    async readSnapshot() { return { repository: { server: "github", path: "acme/product", web: ADDRESS }, ref: "main", commit: "c".repeat(40), paths: [...tree.keys()], blob: (path) => (tree.has(path) ? blobOf(tree.get(path)) : null),
      read: async (path) => (tree.has(path) ? tree.get(path) : null) }; },
    async listPullRequests() { return []; },
  };
}
async function render({ licence = "restricted - fixture terms", places = ["this machine"] } = {}) {
  const files = { ...productFiles({ selection: ["ITM-001", "ITM-005"] }), "docs/role-assignments/team1.md": assignmentBoth };
  const instance = hostOf({ "docs/participants.md": REGISTER, "SPEC.md": "# Instance\n", "docs/process-models/fixture.md": files["docs/process-models/fixture.md"], "docs/sources/SRC-fixture.md": sourceEntry(licence, places) });
  const context = { page: "review", instance: { repository: "acme/agent-m", host: instance }, product: { address: ADDRESS, kind: "github", host: hostOf(files), tokenStored: true }, store: {}, go() {} };
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, context, {});
  return target;
}
const row = (target, item) => found(target, `[data-item="${item}"]`)[0];
const offered = (target, item) => (found(row(target, item), `[data-participant-of="${item}"]`)[0]?.childNodes ?? []).map(text);
const withheld = (target, item) => found(row(target, item), `[data-withheld-of="${item}"]`).map(text).join(" ");

// TST-1160001 · level: unit · module: MOD-implementation-pages
// guards: UC-024; RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS; A JOB GOES ONLY TO A HOLDER OF ITS ROLE
// given: the source SRC-fixture is restricted and permits only "this machine"; dev-a processes data there, dev-b at "elsewhere"; both hold Builders; ITM-005's job would include the source's content
// input: the route's render
// expect: ITM-005 offers dev-a alone, and says that dev-b is not offered because SRC-fixture's content would go to its place, elsewhere
// Planted fault: offering every holder of the role, or leaving the content unnamed, fails.
test("a participant whose place a linked source forbids is not offered for a job that includes that source's content, and the content is named", async () => {
  const target = await render();
  assert.deepEqual(offered(target, "ITM-005"), ["dev-a"]);
  const said = withheld(target, "ITM-005");
  assert.match(said, /dev-b/);
  assert.match(said, /SRC-fixture/);
  assert.match(said, /elsewhere/);
});

// TST-1160002 · level: unit · module: MOD-implementation-pages
// guards: UC-024; RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS
// given: the same register; ITM-001's job would include none of SRC-fixture's content
// input: the route's render
// expect: ITM-001 offers dev-a and dev-b, and names no participant as withheld
// Planted fault: withholding a participant for a source whose content the job does not include fails.
test("a participant is offered where the job needs none of the source's content", async () => {
  const target = await render();
  assert.deepEqual(offered(target, "ITM-001"), ["dev-a", "dev-b"]);
  assert.equal(withheld(target, "ITM-001"), "");
});

// TST-1160003 · level: unit · module: MOD-implementation-pages
// guards: UC-024; RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS
// given: the counter-proof: SRC-fixture permits both "this machine" and "elsewhere"
// input: the route's render
// expect: ITM-005 offers dev-a and dev-b as before, and names no participant as withheld
// Planted fault: withholding every participant for a job that includes restricted content, whatever the source permits, fails.
test("a participant whose place the source allows is offered as before", async () => {
  const target = await render({ places: ["this machine", "elsewhere"] });
  assert.deepEqual(offered(target, "ITM-005"), ["dev-a", "dev-b"]);
  assert.equal(withheld(target, "ITM-005"), "");
});

// TST-1160004 · level: unit · module: MOD-implementation-pages
// guards: UC-024; RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS
// given: SRC-fixture may be republished
// input: the route's render
// expect: ITM-005 offers dev-a and dev-b, and names no participant as withheld
// Planted fault: treating every cited source as restricted fails.
test("a source that may be republished forbids no place", async () => {
  const target = await render({ licence: "may be republished - fixture", places: [] });
  assert.deepEqual(offered(target, "ITM-005"), ["dev-a", "dev-b"]);
  assert.equal(withheld(target, "ITM-005"), "");
});

// TST-1160005 · level: unit · module: MOD-implementation-pages
// guards: UC-024; RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS
// given: SRC-fixture is restricted and permits no place; ITM-005's job would include its content
// input: the route's render
// expect: ITM-005 offers no participant; the row says that no holder is at a place the linked sources permit for this job (not that no holder can write and run tests), and names dev-a and dev-b as withheld; ITM-001 still offers both
// Planted fault: the message of a role with no capable holder where every holder is withheld fails.
test("where every holder's place is forbidden the row says so, and names them", async () => {
  const target = await render({ places: [] });
  assert.deepEqual(offered(target, "ITM-005"), []);
  const shown = text(row(target, "ITM-005"));
  assert.match(shown, /at a place the linked sources permit/);
  assert.doesNotMatch(shown, /can write and run tests/);
  assert.match(withheld(target, "ITM-005"), /dev-a/);
  assert.match(withheld(target, "ITM-005"), /dev-b/);
  assert.deepEqual(offered(target, "ITM-001"), ["dev-a", "dev-b"]);
});

// TST-1160006 · level: unit · module: MOD-implementation-pages
// guards: UC-024; RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS
// given: the recipe of the job's inputs fails, so the job cannot be prepared for any participant
// input: the route's render
// expect: every holder of the role is still offered, none is named as withheld; the failure is what the row shows where it shows what is sent
// Planted fault: withholding a participant for which the job cannot be prepared fails.
test("a job that cannot be prepared withholds no participant", async () => {
  broken.on = true;
  try {
    const target = await render();
    assert.deepEqual(offered(target, "ITM-005"), ["dev-a", "dev-b"]);
    assert.equal(withheld(target, "ITM-005"), "");
    assert.match(text(found(row(target, "ITM-005"), `[data-sent="ITM-005"]`)[0]), /the inputs cannot be read/);
  } finally { broken.on = false; }
});
