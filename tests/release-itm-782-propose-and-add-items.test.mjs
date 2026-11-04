// Release tests of ITM-782 — UC-032 steps 2 to 4 and 2a: the Product Owner opens Backlog, chooses *Propose items for uncovered requirements*, reads the run panel (who drafts, where, what is sent), presses Run,
// edits or discards the drafts, which Agent M "rejects ... that realises nothing, names no module the architecture describes, or builds on an item that does not exist ..., and flags ... that restates an
// existing item", presses *Add to backlog* ("one click. Agent M commits one Markdown file per item under `docs/backlog/`"), or writes an item by hand with *+ Item*, which is the person's own input and is
// committed to the default branch directly (SPEC.md: A PERSON'S OWN INPUT IS COMMITTED DIRECTLY). docs/architecture/MOD-implementation-pages.md states the route `backlog` (Parts).
// Run: node --test tests/release-itm-782-propose-and-add-items.test.mjs
//
// Module: MOD-implementation-pages
// Guards: UC-032; A BACKLOG ITEM NAMES WHAT IT REALISES; A BACKLOG ITEM NAMES THE MODULES IT CHANGES; A GENERATED ARTIFACT IS A PROPOSAL; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY
// Guards: THE PAGE NAMES WHERE IT SENDS; ONE CLICK PER DECISION; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// Level: release
//
// Written for the release testing of sprint 127 by developer-sonnet-l, who implemented none of ITM-782 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The release team works from the use case and the
// page: the unit cases of the item (tests/implementation-pages-backlog-propose.test.mjs) press one control of a fixture with one drafting participant; these cases walk the Product Owner's path across
// two drafting participants at two places, and across a reload of the page, where what was added is read back. The route is MOD-implementation-pages' real `backlog` render over a repository host that
// keeps every commit and every request; the model endpoints ep1 and ep2 are answered in place of `fetch`; nothing reaches the network. No real input event is made: a person's click is an Event whose
// isTrusted is true, a script's click an Event whose isTrusted is false. Readings the texts leave open, which the cases state:
//   - "The run panel names the participant and what is sent" is read as the panel's text naming the participant, its model and the place it processes data at, and the requirements, use cases,
//     architecture and existing items it sends; the message the endpoint receives holds them.
//   - "Agent M rejects a draft" is read as: the draft shows an error and *Add to backlog* is disabled while a draft kept has one.
//   - "Agent M commits one Markdown file per item" is read as one commit, one file `docs/backlog/ITM-<nnn>-<slug>.md` per draft kept.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import "./site-frame-dom.mjs";
const { view } = await import("../src/implementation-pages/index.mjs");
const { registerStrategies } = await import("../src/job-runner/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "backlog");
for (const [at, strategies] of view.strategies.entries()) {
  try { registerStrategies(`tests/release-itm-782-propose-and-add-items.test.mjs#${at}`, strategies); } catch { /* registered already */ }
}

// ---------------------------------------------------------------- the fake DOM, as the page's other tests use it
const walk = (root, match) => {
  const found = [];
  (function visit(node) { for (const child of node.childNodes) if (child.nodeType === 1) { if (match(child)) found.push(child); visit(child); } })(root);
  return found;
};
const bySelector = (selector) => {
  const attribute = /^\[([a-z-]+)(?:="([^"]*)")?\]$/.exec(selector);
  return (element) => (attribute ? (attribute[2] === undefined ? element.getAttribute(attribute[1]) !== null : element.getAttribute(attribute[1]) === attribute[2]) : false);
};
globalThis.window.Element.prototype.querySelectorAll = function querySelectorAll(selector) { return walk(this, bySelector(selector)); };
globalThis.window.Element.prototype.querySelector = function querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; };
globalThis.window.Element.prototype.replaceWith = function replaceWith(node) { this.parentNode.insertBefore(node, this); this.parentNode.removeChild(this); };
globalThis.SVGElement ??= class SVGElement {};
const all = (root, selector) => walk(root, bySelector(selector));
const one = (root, selector) => all(root, selector)[0];
const classed = (root, name) => walk(root, (element) => String(element.getAttribute("class") ?? "").split(/\s+/).includes(name));
const buttons = (root, label) => walk(root, (element) => element.localName === "button" && element.textContent.trim() === label);
const textOf = (node) => String(node?.textContent ?? "").replace(/\s+/g, " ").trim();
const realTimeout = globalThis.setTimeout;
const settle = async () => { for (let n = 0; n < 40; n += 1) await new Promise((resolve) => setImmediate(resolve)); };
const waitFor = async (condition) => { for (let n = 0; n < 400 && !condition(); n += 1) await new Promise((resolve) => realTimeout(resolve, 10)); await settle(); };
const click = async (node, person = true) => { const event = new Event("click"); if (person) Object.defineProperty(event, "isTrusted", { value: true }); node.dispatchEvent(event); await settle(); };
const type = async (input, value) => { input.value = value; input.dispatchEvent(new Event("input")); await settle(); };
const choose = async (select, value) => { select.value = value; select.dispatchEvent(new Event("change")); await settle(); };

// ---------------------------------------------------------------- the product and the instance
const lines = (...rows) => `${rows.join("\n")}\n`;
const blobOf = (content) => createHash("sha1").update(content).digest("hex");
const ADDRESS = "https://github.com/acme/product";
const MODEL_COMMIT = "a".repeat(40);
const SPEC = lines("# SPEC", "", "## 1. Rules", "", "**RULE ONE** *(PO, 2026-09-01)*", "The first rule.", "*Check:* no automatic check; at review.", "",
  "**RULE TWO** *(PO, 2026-09-01)*", "The second rule, which no item realises.", "*Check:* no automatic check; at review.");
const DECLARATION = lines("---", "model: fixture-scrum-wip", "model_file: docs/process-models/fixture.md", `model_version: ${MODEL_COMMIT}`, "---", "# How the fixture product is developed", "", "## Practices", "", "- none", "",
  "## Branches", "", "| Phase or time box | Branch |", "|---|---|", "| Sprint | `sprint/<team>/<nn>` |", "", "## Definition of Done", "", "The job rules hold.");
const MODEL = readFileSync(new URL("./fixtures/flow/scrum-wip.md", import.meta.url), "utf8");
const assignment = (team, owner, builder) => lines(`# ${team}`, "", "## Roles", "", "| Role | Participants |", "|---|---|", `| Owner | ${owner} |`, `| Builders | ${builder} |`, `| Checker | ${builder} |`);
const moduleFile = (id) => lines("---", `id: ${id}`, `title: The module ${id}`, `folder: src/${id.slice(4)}/`, "realises:", "  - RULE ONE", "follows:", "  - ARC-001", "uses: []", "provides:", "  - read", "---", `# ${id} The module ${id}`);
const itemPath = (n) => `docs/backlog/ITM-00${n}-item-${n}.md`;
const itemText = (n, realises = "RULE ONE") => lines("---", `id: ITM-00${n}`, `title: The work of item ${n}`, "level: module", "realises:", `  - ${realises}`, "modules:", "  - MOD-store", "builds_on: []", "tests:", "  - unit",
  "origin:", "  - RULE ONE", "---", `# ITM-00${n} The work of item ${n}`, "", "## Outcome", "", `What item ${n} delivers.`, "", "## Acceptance", "", "- a unit test.");
const UC = "docs/use-cases/UC-001-load.md";
function productFiles() {
  const files = {
    "SPEC.md": SPEC, "docs/process.md": DECLARATION, "docs/process-models/fixture.md": MODEL,
    "docs/role-assignments/team1.md": assignment("team1", "alice", "dev-a"), "docs/role-assignments/team2.md": assignment("team2", "bob", "dev-b"),
    "docs/architecture/MOD-store.md": moduleFile("MOD-store"), "docs/architecture/MOD-pages.md": moduleFile("MOD-pages"),
    [itemPath(1)]: itemText(1), [itemPath(2)]: itemText(2), [UC]: "# UC-001 load\n",
  };
  files[`docs/approvals/UC-001-${blobOf(files[UC]).slice(0, 12)}.md`] = "kind: use-case\n";
  return files;
}
const COLUMNS = ["| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |", "|---|---|---|---|---|---|---|---|"];
const rowOf = (name, model, capabilities, place, endpoint) => `| ${name} | model endpoint | ${model} | 200000 | — | ${capabilities} | ${place} | endpoint ${endpoint} |`;
const register = (...rows) => lines("# Participants of this instance", "", "**REGISTER**", "", "The participants of the test instance.", "", ...COLUMNS, ...rows);
const TWO_DRAFTERS = register(rowOf("local-llm", "model-a", "draft text", "this machine", "ep1"), rowOf("cloud-llm", "model-b", "draft text", "a provider in the USA", "ep2"),
  rowOf("checker", "model-c", "read the repository", "this machine", "ep1"));
const instanceFiles = (participants = TWO_DRAFTERS) => ({ "SPEC.md": "# Instance\n", "AGENTS.md": "# AGENTS.md of the instance\n", "docs/participants.md": participants, "docs/process-models/fixture.md": MODEL });

function hostOf(files, calls, commits) {
  let head = 0;
  const commit = () => (head === 0 ? "c".repeat(40) : String(head).padStart(40, "0"));
  const snapshot = () => ({ repository: { server: "github", path: "acme/product", web: ADDRESS }, ref: "main", commit: commit(), paths: Object.keys(files), blob: (path) => (Object.hasOwn(files, path) ? blobOf(files[path]) : null),
    read: async (path) => { calls.push(`read ${path}`); return Object.hasOwn(files, path) ? files[path] : null; }, readMany: async () => {} });
  return {
    async repositoryInfo() { calls.push("repositoryInfo"); return { defaultBranch: "main", visibility: "private", canWrite: true, archived: false, description: "" }; },
    async readSnapshot(ref) { calls.push(`readSnapshot ${ref}`); return snapshot(); },
    async listPullRequests() { calls.push("listPullRequests"); return []; },
    async containsCommit() { return false; },
    async readHistory() { calls.push("readHistory"); return []; },
    async commitFiles(request) {
      calls.push("commitFiles");
      commits.push(request);
      for (const file of request.files) { if (file.delete) delete files[file.path]; else files[file.path] = file.text; }
      head += 1;
      return { commit: commit(), url: `${ADDRESS}/commit/${commit()}` };
    },
  };
}
const endpointOf = (name, model) => JSON.stringify({ url: `https://${name}.example.test/v1`, kind: "openai-compatible", model, key: `k-${name}` });
const STORE = { prefix: "", storage: { getItem: (key) => (key === "endpoint:ep1" ? endpointOf("ep1", "model-a") : key === "endpoint:ep2" ? endpointOf("ep2", "model-b") : null) } };

const entry = (title, over = {}) => ({ title, outcome: `What ${title} delivers.`, realises: ["RULE TWO"], modules: ["MOD-store"], buildsOn: [], acceptance: ["Unit tests of it."], class: "new", ...over });
const DRAFT = { items: [entry("Show the second rule"), entry("Realise nothing", { realises: [] }), entry("Change an unknown module", { modules: ["MOD-unknown"] }),
  entry("Build on a missing item", { buildsOn: ["ITM-099"] }), entry("The work of item 1")] };
let asked = [];
const realFetch = globalThis.fetch;
function answering(draft) {
  asked = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === "object" && !(input instanceof URL) ? input.url : String(input));
    assert.ok(["https://ep1.example.test", "https://ep2.example.test"].includes(url.origin), `nothing but a model endpoint is asked: ${url.href}`);
    asked.push({ origin: url.origin, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ draft, answers: [] }) } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }), { status: 200, headers: { "content-type": "application/json" } });
  };
}
afterEach(() => { globalThis.fetch = realFetch; delete globalThis.mermaid; });

// The page of `backlog` over `files` (the product, which the fake host keeps changing as commits come in) and the instance's `participants`; a second render of the same files is the reload.
async function render(files = productFiles(), participants = TWO_DRAFTERS) {
  const calls = [], commits = [];
  const host = hostOf(files, calls, commits), instance = hostOf(instanceFiles(participants), calls, []);
  const context = { page: "review", instance: { repository: "acme/agent-m", host: instance }, product: { address: ADDRESS, kind: "github", host, tokenStored: true }, store: STORE, go() {} };
  const target = document.createElement("div");
  document.body.append(target);
  globalThis.mermaid = { initialize() {}, mermaidAPI: { getDiagramFromText: async () => ({ db: { getVertices: () => ({}) } }) }, run: async () => {} };
  await route.render(target, context, {});
  return { target, calls, commits, files };
}
async function proposed(page) {
  const propose = one(page.target, "[data-propose-items]");
  assert.ok(propose, "the page offers Propose items for uncovered requirements");
  await click(propose);
  await waitFor(() => classed(page.target, "run-panel").length > 0 || /warn/.test(one(page.target, "[data-propose]")?.innerHTML ?? ""));
  return classed(page.target, "run-panel")[0];
}
async function drafted(page) {
  const panel = await proposed(page);
  await click(buttons(panel, "Run")[0]);
  await waitFor(() => all(page.target, "[data-draft]").length > 0 || /No items were proposed/.test(textOf(page.target)));
  return all(page.target, "[data-draft]");
}
const itemsListed = (page) => all(page.target, "[data-item]").map((row) => row.getAttribute("data-item"));
const errorsOf = (box) => classed(box, "error").map(textOf).join(" ");
const discard = async (box) => { const tick = one(box, "[data-draft-discard]"); tick.checked = true; tick.dispatchEvent(new Event("change")); await settle(); };

// TST-782101 · level: release · module: MOD-implementation-pages
// guards: UC-032; THE PAGE NAMES WHERE IT SENDS; ONE CLICK PER DECISION; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the product with RULE TWO and UC-001 accepted and realised by no item, the instance's register with the drafting participants local-llm ("this machine", ep1) and cloud-llm ("a provider in the USA", ep2) and checker (reads the repository only); ep1 and ep2 answer one sound draft
// input: the person's click on Propose items; the panel read; cloud-llm chosen; the panel read again; the person's Run; then, on a second page, the default participant and Run
// expect: the participants offered are local-llm and cloud-llm, each named with its place, and not checker; the panel names the one chosen with its model and place, and the requirements, use cases, architecture and existing items it sends; before Run nothing is asked of any endpoint; with cloud-llm chosen Run asks ep2 alone and the message it receives holds RULE TWO, UC-001, MOD-store and the title of ITM-001; known positive — with the default participant Run asks ep1 alone
test("TST-782101: UC-032 2 the run panel names the participant and where it processes data, and Run asks the endpoint of the one chosen", async () => {
  const page = await render();
  answering({ items: [entry("Show the second rule")] });
  const panel = await proposed(page);
  const select = one(page.target, "[data-propose-participant]");
  assert.deepEqual(walk(select, (node) => node.localName === "option").map((option) => textOf(option)),
    ["local-llm — processes data at this machine", "cloud-llm — processes data at a provider in the USA"], "the participants that draft text, each with its place");
  assert.match(textOf(panel), /local-llm/, "known positive: the default participant is named");
  await choose(select, "cloud-llm");
  const chosen = classed(page.target, "run-panel")[0];
  for (const part of ["cloud-llm", "model-b", "a provider in the USA", "RULE TWO", "UC-001", "MOD-store", "existing items"]) assert.ok(textOf(chosen).includes(part), `the panel names ${part}: ${textOf(chosen)}`);
  assert.doesNotMatch(textOf(chosen), /local-llm/, "and no other participant");
  assert.equal(asked.length, 0, "nothing is asked before Run");
  await click(buttons(chosen, "Run")[0]);
  await waitFor(() => all(page.target, "[data-draft]").length > 0);
  assert.deepEqual([...new Set(asked.map((request) => request.origin))], ["https://ep2.example.test"], "only the endpoint of cloud-llm is asked");
  const sent = JSON.stringify(asked[0].body);
  for (const part of ["RULE TWO", "UC-001", "MOD-store", "The work of item 1"]) assert.ok(sent.includes(part), `the message holds ${part}`);

  const other = await render();
  answering({ items: [entry("Show the second rule")] });
  await drafted(other);
  assert.deepEqual([...new Set(asked.map((request) => request.origin))], ["https://ep1.example.test"], "known positive: with the default participant Run asks ep1 alone");
});

// TST-782102 · level: release · module: MOD-implementation-pages
// guards: UC-032; A BACKLOG ITEM NAMES WHAT IT REALISES; A BACKLOG ITEM NAMES THE MODULES IT CHANGES; A GENERATED ARTIFACT IS A PROPOSAL; ONE CLICK PER DECISION
// given: the product of TST-782101 and one answer of five drafts: a sound one, one that realises nothing, one that changes MOD-unknown, one that builds on ITM-099, which does not exist, and one that restates ITM-001
// input: Propose items and Run; the drafts read; Add to backlog read; the faulty drafts discarded one by one; a script's click, then the person's click on Add to backlog; the page loaded again
// expect: the sound draft has no finding, the three faulty ones each an error naming what is wrong, the restatement a warning only; while any draft kept has an error Add to backlog is disabled, and nothing but the job's record is committed; after the three are discarded it is enabled; the script's click writes nothing; the person's click makes one commit of exactly two new files docs/backlog/ITM-003-… and ITM-004-… (the sound draft and the restatement) and no file of a discarded draft; after the page is loaded again both are listed in the backlog, ITM-001 and ITM-002 with them, and the part of what no item realises no longer names RULE TWO but still names UC-001
test("TST-782102: UC-032 3 and 4 faulty drafts cannot be added, a restatement is flagged, and Add to backlog commits the drafts kept in one click", async () => {
  const page = await render();
  answering(DRAFT);
  const drafts = await drafted(page);
  assert.equal(drafts.length, 5);
  assert.equal(errorsOf(drafts[0]), "", "the sound draft has no error");
  assert.match(errorsOf(drafts[1]), /realises nothing/);
  assert.match(errorsOf(drafts[2]), /names no module the architecture describes/);
  assert.match(errorsOf(drafts[3]), /ITM-099, which does not exist/);
  assert.equal(errorsOf(drafts[4]), "", "a restatement is no error");
  assert.match(classed(drafts[4], "warning").map(textOf).join(" "), /restates ITM-001/, "known positive: it is flagged");
  const add = () => buttons(page.target, "Add to backlog")[0];
  assert.ok(add(), "Add to backlog is offered");
  assert.equal(add().disabled, true, "a draft kept has an error");
  assert.ok(page.commits.every((request) => request.files.every((file) => file.path.startsWith("docs/jobs/"))), "nothing but the job's record is committed so far");
  await discard(drafts[1]);
  assert.equal(add().disabled, true, "two drafts kept still have an error");
  await discard(drafts[2]);
  await discard(drafts[3]);
  assert.equal(add().disabled, false, "the drafts kept have no error");
  const before = page.commits.length;
  await click(add(), false);
  assert.equal(page.commits.length, before, "a script's click writes nothing");
  await click(add());
  await waitFor(() => classed(page.target, "drafts-added").length > 0);
  const written = page.commits.slice(before);
  assert.equal(written.length, 1, "one commit");
  assert.deepEqual(written[0].files.map((file) => file.path).sort().map((path) => path.replace(/^(docs\/backlog\/ITM-00\d)-.*$/, "$1")), ["docs/backlog/ITM-003", "docs/backlog/ITM-004"]);
  const texts = written[0].files.map((file) => file.text).join("\n");
  assert.ok(texts.includes("title: Show the second rule") && texts.includes("title: The work of item 1"));
  for (const title of ["Realise nothing", "Change an unknown module", "Build on a missing item"]) assert.ok(!texts.includes(title), `${title} was discarded`);

  const reloaded = await render(page.files);
  assert.deepEqual(itemsListed(reloaded).sort(), ["ITM-001", "ITM-002", "ITM-003", "ITM-004"], "the backlog lists what was added");
  const uncovered = textOf(one(reloaded.target, '[data-part="uncovered"]'));
  assert.ok(!uncovered.includes("RULE TWO"), "RULE TWO is realised now: the part of what no item realises no longer names it");
  assert.ok(uncovered.includes("UC-001"), "known positive: UC-001, which no draft realised, is still named");
});

// TST-782103 · level: release · module: MOD-implementation-pages
// guards: UC-032; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY; A BACKLOG ITEM NAMES WHAT IT REALISES; A BACKLOG ITEM NAMES THE MODULES IT CHANGES; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the product of TST-782101, whose highest item is ITM-002
// input: the person's click on + Item; the form filled with a title, RULE TWO, no module; then MOD-unknown; then MOD-store; Add clicked by a script, then by the person; the page loaded again
// expect: with no module, and again with MOD-unknown, an error stands in the form and Add is disabled; with MOD-store it is enabled; the script's click writes nothing; the person's click makes one commit on the default branch main, of the one file docs/backlog/ITM-003-<slug>.md, no pull request is opened, and no job is recorded; after the page is loaded again ITM-003 is listed beside ITM-001 and ITM-002
test("TST-782103: UC-032 2a an item written by hand is committed directly to the default branch, and only once it names a module of the architecture", async () => {
  const page = await render();
  await click(one(page.target, "[data-add-item]"));
  await waitFor(() => classed(page.target, "schema-form").length > 0);
  const form = classed(page.target, "schema-form")[0];
  const field = (key) => walk(one(form, `[data-key="${key}"]`), (node) => node.localName === "input")[0];
  await type(field("title"), "Show the second rule by hand");
  await type(field("level"), "module");
  await type(field("realises"), "RULE TWO");
  await type(field("tests"), "unit");
  await type(field("origin"), "the Product Owner");
  const add = () => buttons(form, "Add")[0];
  assert.equal(add().disabled, true, "no module is named");
  assert.match(classed(form, "error").map(textOf).join(" "), /module/i);
  await type(field("modules"), "MOD-unknown");
  assert.equal(add().disabled, true, "a module the architecture does not describe");
  assert.match(classed(form, "error").map(textOf).join(" "), /names no module the architecture describes/);
  await type(field("modules"), "MOD-store");
  assert.equal(add().disabled, false, `known positive: the item is complete: ${classed(form, "error").map(textOf).join(" | ")}`);
  const before = page.commits.length;
  await click(add(), false);
  assert.equal(page.commits.length, before, "a script's click writes nothing");
  await click(add());
  await waitFor(() => classed(page.target, "item-added").length > 0);
  const written = page.commits.slice(before);
  assert.equal(written.length, 1, "one commit");
  assert.equal(written[0].branch, "main", "on the default branch");
  assert.equal(written[0].files.length, 1);
  assert.match(written[0].files[0].path, /^docs\/backlog\/ITM-003-[a-z0-9-]+\.md$/);
  assert.ok(written.every((request) => !request.pullRequest && request.branch === "main"), "no pull request is opened: the commit stands on main itself");
  assert.ok(!written.some((request) => request.files.some((file) => file.path.startsWith("docs/jobs/"))), "no job is recorded: it is the person's own input");
  const reloaded = await render(page.files);
  assert.deepEqual(itemsListed(reloaded).sort(), ["ITM-001", "ITM-002", "ITM-003"], "the backlog lists the item written by hand");
});

// TST-782104 · level: release · module: MOD-implementation-pages
// guards: UC-032; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; THE PAGE NAMES WHERE IT SENDS
// given: the product of TST-782101, and an instance whose register holds no participant that drafts text (checker reads the repository only)
// input: the page drawn; a script's click on Propose items and on + Item; the person's click on Propose items
// expect: drawing writes nothing and asks no endpoint; the script's clicks read nothing and draw nothing; the person's click draws no run panel and says that no participant of the instance's register can draft text, with no Run, so that nothing can be sent
test("TST-782104: UC-032 2 with no participant that can draft text nothing is offered to run, and nothing is sent or written", async () => {
  const page = await render(productFiles(), register(rowOf("checker", "model-c", "read the repository", "this machine", "ep1")));
  answering({ items: [] });
  assert.equal(page.commits.length, 0, "drawing writes nothing");
  assert.equal(asked.length, 0, "and asks no endpoint");
  const propose = one(page.target, "[data-propose-items]");
  assert.ok(propose, "known positive: Propose items is offered where something is not realised");
  const before = page.calls.length;
  await click(propose, false);
  await click(one(page.target, "[data-add-item]"), false);
  assert.equal(page.calls.length, before, "a script's click reads nothing");
  assert.equal(classed(page.target, "run-panel").length + classed(page.target, "schema-form").length, 0, "and draws nothing");
  await click(propose);
  await waitFor(() => /No participant of the instance's register can draft text/.test(textOf(page.target)));
  assert.match(textOf(page.target), /No participant of the instance's register can draft text/);
  assert.equal(classed(page.target, "run-panel").length, 0, "no run panel");
  assert.equal(buttons(page.target, "Run").length, 0, "no Run");
  assert.equal(asked.length, 0);
  assert.equal(page.commits.length, 0);
});
