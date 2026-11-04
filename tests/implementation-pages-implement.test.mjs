// MOD-implementation-pages' route `implement` — ready items started as implementation jobs (ITM-789), as the accepted text of docs/architecture/MOD-implementation-pages.md states it: "`implement` — the steps of the plan
// or the ready items, each with its state and, if it cannot start, the reasons; the participants that hold the implementing role in the item's role assignment and can write and run tests, the attempt limit, who merges,
// the target branch, the gates the jobs will meet and who decides them; *Start jobs*, which queues each job on its participant's route", and UC-034 steps 1 to 4, 2a, 3a, 4a.
// Run: node --test tests/implementation-pages-implement.test.mjs
//
// Module: MOD-implementation-pages
// Guards: UC-034; AGILE IMPLEMENTATION STARTS FROM THE BACKLOG; NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED; NO JOB STARTS ABOVE THE WORK-IN-PROGRESS LIMIT; A TIME BOX WORKS ONLY ON WHAT WAS SELECTED FOR IT
// Guards: A JOB GOES ONLY TO A HOLDER OF ITS ROLE; THE PAGE NAMES WHERE IT SENDS; ONE CLICK PER DECISION
// Level: unit
//
// The product is the Scrum-with-limit fixture of tests/implementation-pages-backlog.test.mjs (one team here), held in memory behind a host of this file's own that answers MOD-repository-hosts' interface and keeps every
// commit; the instance holds the register of participants with two builders able to write and run tests, dev-a — whom team1's assignment gives the role Builders — and dev-b, whom it does not; whose route is the hosted CI. The strategies the kind `implement` names are stand-ins registered with the job runner: the recipes
// give one part each, the writer and the precondition give nothing; the real ones are other modules'. Nothing reaches the network. Readings the texts leave open, which the tests state (the pull request names them):
//   - Each item is a <tr data-item data-state data-startable>; its reasons are the <li> of <ul data-reasons>; for a startable item <select data-participant-of> lists the holders that can write and run tests, <p data-holders>
//     says where each processes data and its routes, <select data-merges-of> is who merges (`agent` or `person`), and <div data-sent> says what is sent where; <input data-start-item> ticks a startable item; <button data-start-jobs>
//     is Start jobs, <div data-start-result> its outcome.
//   - The address #implement/sprint=<team>/<nn>, which Start sprint work leads to, lists the items of that sprint's selection only.
//   - A start record is docs/jobs/JOB-<stamp>-<4 hex>.md; who merges is `merges` in its `## Parameters`; a click a script makes starts nothing.
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
const part = (name) => ({ name, text: name, size: 0, sources: [], required: true });
registerStrategies("tests/implementation-pages-implement.test.mjs", {
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
    // The file at each commit, as the one tree holds it (MOD-repository-hosts' readFileAt), for the declared model and practices the route reads (ITM-1264).
    async readFileAt(path, commits) { return new Map(commits.map((commit) => [commit, tree.has(path) ? tree.get(path) : null])); },
    async readSnapshot() { return snapshot(); },
    async listPullRequests() { return pullRequests; },
    async commitFiles(change) {
      commits.push(structuredClone(change));
      head += 1;
      for (const file of change.files) tree.set(file.path, file.text);
      return { commit: String(head).padStart(40, "c"), url: `${ADDRESS}/commit/${head}` };
    },
  };
}
async function render(files, { pullRequests = [], params = {} } = {}) {
  const commits = [];
  const host = hostOf(files, pullRequests, commits);
  const instanceHost = hostOf({ "docs/participants.md": REGISTER, "SPEC.md": "# Instance\n", "docs/process-models/fixture.md": files["docs/process-models/fixture.md"] }, [], []);
  const context = { page: "review", instance: { repository: "acme/agent-m", host: instanceHost }, product: { address: ADDRESS, kind: "github", host, tokenStored: true }, store: {}, go() {} };
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, context, params);
  return { target, commits };
}
const row = (target, item) => found(target, `[data-item="${item}"]`)[0];
const reasons = (target, item) => found(row(target, item), "[data-reasons]").map(text).join(" ");

// TST-789001 · level: unit · module: MOD-implementation-pages
// guards: UC-034; AGILE IMPLEMENTATION STARTS FROM THE BACKLOG
// given: the one-team fixture: team1's running sprint selects ITM-004, ITM-005 and ITM-006; ITM-003 is ready and selected by no sprint
// input: the route implement's render
// expect: the route is named implement, under the entry implementation; ITM-005 is ready and startable; ITM-003 is not, its reason naming that it is not selected for the sprint; nothing is committed
test("the implement page lists the items with their state, and names why an item not selected cannot start", async () => {
  assert.ok(route, "the route implement is offered");
  assert.deepEqual([route.name, route.entry, route.title], ["implement", "implementation", "Implement"]);
  const { target, commits } = await render(productFiles());
  assert.equal(row(target, "ITM-005").getAttribute("data-startable"), "true");
  assert.equal(row(target, "ITM-005").getAttribute("data-state"), "ready");
  assert.equal(row(target, "ITM-003").getAttribute("data-startable"), "false");
  assert.match(reasons(target, "ITM-003"), /not selected/);
  assert.equal(commits.length, 0, "a render writes nothing");
});

// TST-789002 · level: unit · module: MOD-implementation-pages
// guards: UC-034; NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED
// given: the same product, in which ITM-006 realises a requirement the SPEC does not hold and ITM-004 builds on ITM-003, which is not done
// input: the route's render
// expect: ITM-006 is not startable and its reason names RULE NOT ACCEPTED; ITM-004 is not startable and its reason names ITM-003
test("an item with a requirement not accepted, or with an item it builds on not done, is not started and says why", async () => {
  const { target } = await render(productFiles());
  assert.equal(row(target, "ITM-006").getAttribute("data-startable"), "false");
  assert.match(reasons(target, "ITM-006"), /RULE NOT ACCEPTED/);
  assert.equal(row(target, "ITM-004").getAttribute("data-startable"), "false");
  assert.match(reasons(target, "ITM-004"), /ITM-003/);
});

// TST-789003 · level: unit · module: MOD-implementation-pages
// guards: UC-034; NO JOB STARTS ABOVE THE WORK-IN-PROGRESS LIMIT
// given: team1's sprint selects ITM-001, ITM-003 and ITM-005, ITM-001 and ITM-003 each having an open pull request, and the model's limit is 2
// input: the route's render, then a click of a person on Start jobs
// expect: ITM-005 is not startable and its reason names the work-in-progress limit; with no startable item the click says so and nothing is committed
test("above the work-in-progress limit an item is not started, and with no startable item nothing starts", async () => {
  const { target, commits } = await render(productFiles({ selection: ["ITM-001", "ITM-003", "ITM-005"] }), { pullRequests: OPEN_PRS });
  assert.equal(row(target, "ITM-005").getAttribute("data-startable"), "false");
  assert.match(reasons(target, "ITM-005"), /work-in-progress limit/);
  found(target, "[data-start-jobs]")[0].dispatchEvent(trusted());
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(commits.length, 0);
  assert.match(text(found(target, "[data-start-result]")[0]), /nothing starts/i);
});

// TST-789004 · level: unit · module: MOD-implementation-pages
// guards: UC-034; A JOB GOES ONLY TO A HOLDER OF ITS ROLE; THE PAGE NAMES WHERE IT SENDS
// given: the product of TST-789001
// input: the route's render
// expect: ITM-005 offers dev-a, the holder of the implementing role Builders in team1's assignment, and says where it processes data (this machine) and its route (ci hosted); who merges, the attempt limit and the target branch (main) are shown, with the gate Building → Checking and its decider Owner; what is sent where names dev-a and the part chapters 9, 11, 12 and 13
test("a startable item offers the holders of the implementing role with where they process data, what is sent where, the gates and who merges", async () => {
  const { target } = await render(productFiles());
  const options = found(row(target, "ITM-005"), `[data-participant-of="ITM-005"]`)[0];
  assert.ok(options, "a participant is offered");
  assert.match(text(options), /dev-a/);
  assert.doesNotMatch(text(options), /alice|dev-b/, "a participant that does not hold the implementing role in the item's assignment is not offered");
  const holders = text(found(row(target, "ITM-005"), "[data-holders]")[0]);
  assert.match(holders, /this machine/);
  assert.match(holders, /ci hosted/);
  assert.ok(found(row(target, "ITM-005"), `[data-merges-of="ITM-005"]`)[0], "who merges is chosen");
  const shown = text(row(target, "ITM-005"));
  assert.match(shown, /Attempt limit: \d+/);
  assert.match(shown, /Target branch: main/);
  assert.match(shown, /Building → Checking \(decided by Owner\)/);
  const sent = text(found(row(target, "ITM-005"), `[data-sent="ITM-005"]`)[0]);
  assert.match(sent, /dev-a/);
  assert.match(sent, /chapters 9, 11, 12 and 13/);
});

// TST-789005 · level: unit · module: MOD-implementation-pages
// guards: UC-034; A JOB IS RECORDED IN ITS PRODUCT REPOSITORY; ONE CLICK PER DECISION
// given: the product of TST-789001, whose job workflow stands in the repository
// input: a click a script makes on Start jobs; then a click of a person
// expect: the script's click commits nothing; the person's click commits one start record under docs/jobs/ for ITM-005 alone — naming dev-a as its participant, the item in works_on and, in the parameters, who merges —, and none for ITM-003, ITM-004 or ITM-006
test("Start jobs writes one start record for each startable item, naming a holder of the implementing role, on a person's click only", async () => {
  const { target, commits } = await render(productFiles());
  found(target, "[data-start-jobs]")[0].dispatchEvent(new Event("click"));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(commits.length, 0, "a script's click starts nothing");
  found(target, "[data-start-jobs]")[0].dispatchEvent(trusted());
  for (let turn = 0; turn < 200 && commits.length === 0; turn += 1) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(commits.length, 1);
  const records = commits.flatMap((commit) => commit.files).filter((file) => /^docs\/jobs\/JOB-/.test(file.path));
  assert.equal(records.length, 1, "one start record");
  assert.match(records[0].text, /participant: dev-a/);
  assert.match(records[0].text, /ITM-005/);
  assert.match(records[0].text, /merges/);
  for (const item of ["ITM-003", "ITM-004", "ITM-006"]) assert.doesNotMatch(records[0].text, new RegExp(`works_on:[^]*${item}`), `no job for ${item}`);
  assert.match(text(found(target, "[data-start-result]")[0]), /ITM-005/);
});

// TST-789006 · level: unit · module: MOD-implementation-pages
// guards: UC-034; A TIME BOX WORKS ONLY ON WHAT WAS SELECTED FOR IT
// given: the product of TST-789001
// input: the route's render with the parameter sprint=team1/01 (Start sprint work); and, as the counter-proof, the render without it
// expect: with the parameter only the items of the sprint's selection are listed — ITM-004, ITM-005 and ITM-006, not ITM-003; without it ITM-003 stands in the list
test("Start sprint work lists the items of the sprint's selection", async () => {
  const { target } = await render(productFiles(), { params: { sprint: "team1/01" } });
  assert.deepEqual(found(target, "[data-item]").map((each) => each.getAttribute("data-item")), ["ITM-004", "ITM-005", "ITM-006"]);
  const all = await render(productFiles());
  assert.ok(row(all.target, "ITM-003"), "counter-proof: without the parameter the list holds every item not done");
});

// ---------------------------------------------------------------- a ready item that a rejected gate returned (ITM-1421)
const { endedJob, REJECTED, JOB_ID } = await import("./implementation-pages-ended-job.mjs");

// TST-1421001 · level: unit · module: MOD-implementation-pages
// guards: UC-034; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: the one-team fixture whose sprint selects ITM-003 and ITM-005; ITM-005's only job ended failed at a rejected gate, its End reason "the gate Building → Checking was rejected by docs/gates/20261102-0900-building-checking-1421.md: The review found no test."; ITM-003 has no job
// input: the route implement's render
// expect: ITM-005 is ready and startable, its row offers dev-a as before and carries that reason in <p data-returned>; ITM-003 is ready and startable and its row has no <p data-returned>; nothing is committed
test("TST-1421001: UC-034 7a a ready item that a rejected gate returned shows the reason in its row, beside what a startable item shows; an item with no reason shows none", async () => {
  const { target, commits } = await render({ ...productFiles({ selection: ["ITM-003", "ITM-005"] }), ...endedJob("ITM-005", REJECTED) });
  assert.deepEqual([row(target, "ITM-005").getAttribute("data-state"), row(target, "ITM-005").getAttribute("data-startable")], ["ready", "true"], "known positive: the item a rejected gate returned is ready and startable");
  assert.deepEqual(found(row(target, "ITM-005"), "[data-returned]").map(text), [REJECTED]);
  assert.match(text(found(row(target, "ITM-005"), `[data-participant-of="ITM-005"]`)[0]), /dev-a/, "the participant is offered as for any startable item");
  assert.deepEqual([row(target, "ITM-003").getAttribute("data-state"), row(target, "ITM-003").getAttribute("data-startable")], ["ready", "true"]);
  assert.deepEqual(found(row(target, "ITM-003"), "[data-returned]").map(text), [], "an item with no reason shows none");
  assert.equal(commits.length, 0, "a render writes nothing");
});

// TST-1421002 · level: unit · module: MOD-implementation-pages
// guards: UC-034; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: the fixture of TST-1421001, but ITM-005's job ended failed otherwise ("CI stayed red after the retry limit")
// input: the route implement's render
// expect: ITM-005 is blocked and not startable, its reasons name the job as before (UC-034 6a) and its row has no <p data-returned>: only a ready item carries the reason of its return
test("TST-1421002: UC-034 6a an item whose job failed otherwise stays blocked and shows no returned reason", async () => {
  const { target } = await render({ ...productFiles({ selection: ["ITM-003", "ITM-005"] }), ...endedJob("ITM-005", "CI stayed red after the retry limit") });
  assert.deepEqual([row(target, "ITM-005").getAttribute("data-state"), row(target, "ITM-005").getAttribute("data-startable")], ["blocked", "false"]);
  assert.match(reasons(target, "ITM-005"), new RegExp(`ITM-005 is blocked: job ${JOB_ID} is failed`));
  assert.deepEqual(found(row(target, "ITM-005"), "[data-returned]").map(text), []);
});

// TST-1421005 · level: unit · module: MOD-implementation-pages
// guards: UC-034; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: the product of TST-789001, whose sprint does not select ITM-003; ITM-003's only job ended failed at a rejected gate, its End reason "the gate Building → Checking was rejected by docs/gates/20261102-0900-building-checking-1421.md: The review found no test."
// input: the route implement's render
// expect: ITM-003 is ready and not startable, its reasons name that it is not selected for the sprint, and its row carries the reason of its return in <p data-returned>: a ready item shows why it returned whether or not it can start
test("TST-1421005: UC-034 7a a ready item that cannot start yet shows the reason it returned beside the reasons it cannot start", async () => {
  const { target } = await render({ ...productFiles(), ...endedJob("ITM-003", REJECTED) });
  assert.deepEqual([row(target, "ITM-003").getAttribute("data-state"), row(target, "ITM-003").getAttribute("data-startable")], ["ready", "false"], "known positive: ready, and not selected for the sprint");
  assert.match(reasons(target, "ITM-003"), /not selected/);
  assert.deepEqual(found(row(target, "ITM-003"), "[data-returned]").map(text), [REJECTED]);
});
