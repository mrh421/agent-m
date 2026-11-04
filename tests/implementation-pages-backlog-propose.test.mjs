// MOD-implementation-pages' route `backlog` proposes items, takes the drafts the Product Owner keeps, and adds an item written by hand (ITM-782), as the accepted text of
// docs/architecture/MOD-implementation-pages.md states the route (:167-171): "*Propose items* with its run panel, whose drafts wait for the Product Owner, and *Add to backlog*, which lets them go on as
// edited; *+ Item*, … with `saveItems`", with (:284-285) "MOD-job-runner.prepareJob — the run panels; MOD-job-runner.writeResult — a drafted plan or drafted items written on the person's click", and
// UC-032 steps 2 to 4 and 2a.
// Run: node --test tests/implementation-pages-backlog-propose.test.mjs
//
// Module: MOD-implementation-pages
// Guards: UC-032; A BACKLOG ITEM NAMES WHAT IT REALISES; A BACKLOG ITEM NAMES THE MODULES IT CHANGES; A GENERATED ARTIFACT IS A PROPOSAL; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY
// Guards: THE PAGE NAMES WHERE IT SENDS; ONE CLICK PER DECISION; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// Level: unit
//
// The product is the two-team fixture of tests/implementation-pages-backlog.test.mjs, held in memory behind a host of this file's own that keeps the commits it is given; the instance is a second host
// holding AGENTS.md, the participants' register and the process model. The participant local-llm drafts text at "this machine" through the endpoint ep1, which this file answers in place of `fetch`;
// nothing reaches the network. The strategies of the view are registered, as the frame registers them. Readings the texts leave open, which the tests state (the pull request names them):
//   - *Propose items for uncovered requirements* stands in the part "Accepted, and realised by no item yet" while that part names anything, *+ Item* below the backlog's table; each is a `button` of
//     type `button` with the class `btn`. A click by a script draws nothing; the person's click reads the instance's register and draws the participants that can draft text with the run panel.
//   - The drafts are shown one to a box `[data-draft]`, with fields to edit (`[data-draft-field]`, a list as names separated by commas), a box Discard (`[data-draft-discard]`), and the findings of
//     `backlogFindings` as `<li class="error">` and `<li class="warning">`. *Add to backlog* is offered while a draft is kept and no draft kept has an error.
//   - The form of *+ Item* is MOD-site-frame's `schemaForm` over the item schema (`[data-key]` fields), whose one button is shown as "Add".
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import "./site-frame-dom.mjs";
const { view } = await import("../src/implementation-pages/index.mjs");
const { registerStrategies } = await import("../src/job-runner/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "backlog");
for (const [at, strategies] of view.strategies.entries()) {
  try { registerStrategies(`tests/implementation-pages-backlog-propose.test.mjs#${at}`, strategies); } catch { /* registered already */ }
}

// ---------------------------------------------------------------- the DOM
const walk = (root, match) => {
  const all = [];
  (function visit(node) { for (const child of node.childNodes) if (child.nodeType === 1) { if (match(child)) all.push(child); visit(child); } })(root);
  return all;
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
const click = async (node, trusted = true) => { const event = new Event("click"); if (trusted) Object.defineProperty(event, "isTrusted", { value: true }); node.dispatchEvent(event); await settle(); };
const type = async (input, value) => { input.value = value; input.dispatchEvent(new Event("input")); await settle(); };

// ---------------------------------------------------------------- the fixture product and instance
const lines = (...rows) => `${rows.join("\n")}\n`;
const blobOf = (content) => createHash("sha1").update(content).digest("hex");
const ADDRESS = "https://github.com/acme/product";
const MODEL_COMMIT = "a".repeat(40);
const SPEC = lines("# SPEC", "", "## 1. Rules", "", "**RULE ONE** *(PO, 2026-09-01)*", "The first rule.", "*Check:* no automatic check; at review.", "",
  "**RULE TWO** *(PO, 2026-09-01)*", "The second rule, which no item realises.", "*Check:* no automatic check; at review.");
const DECLARATION = lines("---", "model: fixture-scrum-wip", "model_file: docs/process-models/fixture.md", `model_version: ${MODEL_COMMIT}`, "---", "# How the fixture product is developed", "", "## Practices", "",
  "- none", "", "## Branches", "", "| Phase or time box | Branch |", "|---|---|", "| Sprint | `sprint/<team>/<nn>` |", "", "## Definition of Done", "", "The job rules hold.");
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
    [itemPath(1)]: itemText(1), [itemPath(2)]: itemText(2),
    "docs/backlog/sprints/team1/01.md": lines("---", "sprint: 1", "goal: Store", "start: 2026-09-14", "end:", "closer: alice", "branch:", "selection:", "  - ITM-001", "---", "# team1 Sprint 01"),
    [UC]: "# UC-001 load\n",
  };
  files[`docs/approvals/UC-001-${blobOf(files[UC]).slice(0, 12)}.md`] = "kind: use-case\n";
  return files;
}
const REGISTER = lines("# Participants of this instance", "", "**REGISTER**", "", "The participants of the test instance.", "",
  "| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |", "|---|---|---|---|---|---|---|---|",
  "| local-llm | model endpoint | model-a | 200000 | — | draft text | this machine | endpoint ep1 |",
  "| checker | model endpoint | model-c | 200000 | — | read the repository | this machine | endpoint ep1 |");
const instanceFiles = () => ({ "SPEC.md": "# Instance\n", "AGENTS.md": "# AGENTS.md of the instance\n", "docs/participants.md": REGISTER, "docs/process-models/fixture.md": MODEL });

// A host of this file's own, answering the part of MOD-repository-hosts' interface the route uses: it keeps every request in `calls` and every commit in `commits`, whose files it then holds.
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
const STORE = { prefix: "", storage: { getItem: (key) => (key === "endpoint:ep1" ? JSON.stringify({ url: "https://ep1.example.test/v1", kind: "openai-compatible", model: "model-a", key: "k1" }) : null) } };

// The answer of the endpoint ep1: the drafted items, as the kind propose-items answers (src/job-catalogue/kinds/propose-items/answer.schema.json).
const entry = (title, over = {}) => ({ title, outcome: `What ${title} delivers.`, realises: ["RULE TWO"], modules: ["MOD-store"], buildsOn: [], acceptance: ["Unit tests of it."], class: "new", ...over });
const DRAFT = { items: [
  entry("Show the second rule"),
  entry("Realise nothing", { realises: [] }),
  entry("Change an unknown module", { modules: ["MOD-unknown"] }),
  entry("Build on a missing item", { buildsOn: ["ITM-099"] }),
  entry("The work of item 1"),
] };
let asked = [];
const realFetch = globalThis.fetch;
function answering(draft) {
  asked = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === "object" && !(input instanceof URL) ? input.url : String(input));
    assert.equal(url.origin, "https://ep1.example.test", `nothing but the endpoint ep1 is asked: ${url.href}`);
    asked.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ draft, answers: [] }) } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }), { status: 200, headers: { "content-type": "application/json" } });
  };
}
afterEach(() => { globalThis.fetch = realFetch; delete globalThis.mermaid; });

async function render(files = productFiles()) {
  const calls = [], commits = [];
  const host = hostOf(files, calls, commits), instance = hostOf(instanceFiles(), calls, []);
  const context = { page: "review", instance: { repository: "acme/agent-m", host: instance }, product: { address: ADDRESS, kind: "github", host, tokenStored: true }, store: STORE, go() {} };
  const target = document.createElement("div");
  document.body.append(target);
  globalThis.mermaid = { initialize() {}, mermaidAPI: { getDiagramFromText: async () => ({ db: { getVertices: () => ({}) } }) }, run: async () => {} };
  await route.render(target, context, {});
  return { target, calls, commits, files };
}
// The person's click on Propose items, and the run panel waited for.
async function proposed(page) {
  const propose = one(page.target, "[data-propose-items]");
  assert.ok(propose, "the page offers Propose items for uncovered requirements");
  await click(propose);
  await waitFor(() => classed(page.target, "run-panel").length > 0 || /warn/.test(one(page.target, "[data-propose]")?.innerHTML ?? ""));
  return classed(page.target, "run-panel")[0];
}
// The person's Run, and the drafts waited for.
async function drafted(page) {
  const panel = await proposed(page);
  await click(buttons(panel, "Run")[0]);
  await waitFor(() => all(page.target, "[data-draft]").length > 0 || /No items were proposed/.test(textOf(page.target)));
  return all(page.target, "[data-draft]");
}
const findingsOf = (box, kind) => classed(box, kind).map(textOf);

// TST-782001 · level: unit · module: MOD-implementation-pages
// guards: UC-032; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the fixture, in which RULE TWO and UC-001 are accepted and realised by no item; and the same fixture with two more items that realise them
// input: the route's render; a click by a script on Propose items and on + Item; then the person's click on Propose items
// expect: the part "Accepted, and realised by no item yet" holds <button type="button" class="btn" data-propose-items> "Propose items for uncovered requirements", the backlog's part holds, after its table, <button type="button" class="btn" data-add-item> "+ Item"; the render prepares no job — it reads no AGENTS.md — and writes nothing; a script's click draws nothing and reads nothing; the person's click prepares the job and reads AGENTS.md (known positive); where every accepted name is realised, Propose items is not offered and + Item is
test("the backlog page offers Propose items where something is not realised and + Item below the backlog, and reads nothing for them before the person's click", async () => {
  const page = await render();
  const uncovered = one(page.target, '[data-part="uncovered"]');
  const propose = one(uncovered, "[data-propose-items]");
  assert.ok(propose, "Propose items stands in the part of what no item realises");
  assert.deepEqual([propose.localName, propose.getAttribute("type"), propose.getAttribute("class"), textOf(propose)], ["button", "button", "btn", "Propose items for uncovered requirements"]);
  const backlog = one(page.target, '[data-part="backlog"]');
  const add = one(backlog, "[data-add-item]");
  assert.ok(add, "+ Item stands in the backlog's part");
  assert.deepEqual([add.localName, add.getAttribute("type"), add.getAttribute("class"), textOf(add)], ["button", "button", "btn", "+ Item"]);
  assert.ok(backlog.innerHTML.indexOf("</table>") < backlog.innerHTML.indexOf("data-add-item"), "+ Item stands below the table");
  assert.ok(!page.calls.includes("read AGENTS.md"), "the render prepares no job: it reads no AGENTS.md");
  assert.ok(!page.calls.includes("commitFiles"), "the render writes nothing");
  const before = page.calls.length;
  await click(propose, false);
  await click(add, false);
  assert.equal(page.calls.length, before, "a script's click reads nothing");
  assert.equal(classed(page.target, "run-panel").length + classed(page.target, "schema-form").length, 0, "a script's click draws nothing");
  answering(DRAFT);
  assert.ok(await proposed(page), "the person's click draws the run panel");
  assert.ok(page.calls.includes("read AGENTS.md"), "known positive: the person's click prepares the job, which reads AGENTS.md");
  const covered = await render({ ...productFiles(), [itemPath(3)]: itemText(3, "RULE TWO"), [itemPath(4)]: itemText(4, "UC-001") });
  assert.equal(one(covered.target, "[data-propose-items]"), undefined, "nothing to propose where every accepted name is realised");
  assert.ok(one(covered.target, "[data-add-item]"), "+ Item is offered all the same");
});

// TST-782002 · level: unit · module: MOD-implementation-pages
// guards: UC-032; THE PAGE NAMES WHERE IT SENDS; A BACKLOG ITEM NAMES WHAT IT REALISES; A BACKLOG ITEM NAMES THE MODULES IT CHANGES; A GENERATED ARTIFACT IS A PROPOSAL
// given: the fixture; the instance's participants local-llm (draft text, at "this machine", endpoint ep1) and checker (no draft text); ep1 answers five drafts: a sound one, one that realises nothing, one that names the module MOD-unknown, one that builds on ITM-099, which does not exist, and one titled "The work of item 1", as ITM-001 is
// input: the person's click on Propose items; the person's Run; the draft that realises nothing given RULE TWO; then the two other faulty drafts discarded
// expect: the participants offered are local-llm alone; the run panel names local-llm, its model and "this machine", and sends the requirements and the existing items; before Run nothing is asked of ep1; after it ep1 is asked and five drafts are shown with their findings — none for the sound one, an error that it realises nothing, one that it names no module the architecture describes, one that ITM-099 does not exist, a warning that it restates ITM-001 — and Add to backlog is disabled; once the first is given RULE TWO its error is gone and Add stays disabled; once the other two are discarded, Add to backlog is enabled; nothing is written but the job's record
test("Propose items runs the job from its run panel, and its drafts wait with their findings until the person keeps only drafts without an error", async () => {
  const page = await render();
  answering(DRAFT);
  const panel = await proposed(page);
  assert.ok(panel, "the run panel is drawn");
  const offered = all(page.target, "[data-propose-participant]")[0];
  assert.deepEqual(walk(offered, (node) => node.localName === "option").map((option) => option.getAttribute("value")), ["local-llm"], "only a participant that drafts text is offered");
  assert.match(textOf(panel), /local-llm/);
  assert.match(textOf(panel), /model-a/);
  assert.match(textOf(panel), /this machine/);
  assert.match(textOf(panel), /RULE TWO/);
  assert.match(textOf(panel), /existing items/);
  assert.equal(asked.length, 0, "nothing is sent before Run");
  const writesBefore = page.commits.length;

  const drafts = await drafted(page);
  assert.ok(asked.length >= 1, "Run asks the endpoint");
  assert.equal(drafts.length, 5, textOf(page.target));
  assert.deepEqual(findingsOf(drafts[0], "error").concat(findingsOf(drafts[0], "warning")), [], "the sound draft has no finding");
  assert.match(findingsOf(drafts[1], "error").join(" "), /realises nothing/);
  assert.match(findingsOf(drafts[2], "error").join(" "), /names no module the architecture describes/);
  assert.match(findingsOf(drafts[3], "error").join(" "), /ITM-099, which does not exist/);
  assert.deepEqual(findingsOf(drafts[4], "error"), []);
  assert.match(findingsOf(drafts[4], "warning").join(" "), /restates ITM-001/);
  const add = () => buttons(page.target, "Add to backlog")[0];
  assert.ok(add(), "Add to backlog is offered");
  assert.equal(add().disabled, true, "a draft with an error cannot be added");

  await type(one(drafts[1], '[data-draft-field="realises"]'), "RULE TWO");
  assert.deepEqual(findingsOf(drafts[1], "error"), [], "the edited draft realises RULE TWO");
  assert.equal(add().disabled, true, "two drafts still have an error");
  for (const box of [drafts[2], drafts[3]]) {
    const discard = one(box, "[data-draft-discard]");
    discard.checked = true;
    discard.dispatchEvent(new Event("change"));
    await settle();
  }
  assert.equal(add().disabled, false, "the drafts kept have no error");
  assert.ok(page.commits.slice(writesBefore).every((request) => request.files.every((file) => file.path.startsWith("docs/jobs/"))), "nothing but the job's record is written before Add");
});

// TST-782003 · level: unit · module: MOD-implementation-pages
// guards: UC-032; ONE CLICK PER DECISION; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; A BACKLOG ITEM NAMES WHAT IT REALISES
// given: the drafts of TST-782002, with the draft that realised nothing given RULE TWO and the drafts naming MOD-unknown and ITM-099 discarded
// input: a click by a script on Add to backlog, then the person's click
// expect: the script's click writes nothing; the person's writes one commit, which holds three files, each a new item docs/backlog/ITM-<nnn>-<slug>.md — "Show the second rule", "Realise nothing" realising RULE TWO, and "The work of item 1" — and no file of the discarded drafts; the page names the files added
test("Add to backlog writes the drafts kept, as edited, in one commit of item files under docs/backlog/", async () => {
  const page = await render();
  answering(DRAFT);
  const drafts = await drafted(page);
  await type(one(drafts[1], '[data-draft-field="realises"]'), "RULE TWO");
  for (const box of [drafts[2], drafts[3]]) {
    const discard = one(box, "[data-draft-discard]");
    discard.checked = true;
    discard.dispatchEvent(new Event("change"));
    await settle();
  }
  const add = buttons(page.target, "Add to backlog")[0];
  assert.equal(add.disabled, false, "known positive: Add to backlog is enabled");
  const before = page.commits.length;
  await click(add, false);
  assert.equal(page.commits.length, before, "a script's click writes nothing");
  await click(add);
  await waitFor(() => classed(page.target, "drafts-added").length > 0 || /are not added/.test(textOf(page.target)));
  const written = page.commits.slice(before);
  assert.equal(written.length, 1, `one commit: ${textOf(page.target)}`);
  const paths = written[0].files.map((file) => file.path);
  assert.equal(paths.length, 3, paths.join(", "));
  for (const path of paths) assert.match(path, /^docs\/backlog\/ITM-\d{3,}-[a-z0-9-]+\.md$/);
  const texts = written[0].files.map((file) => file.text).join("\n");
  for (const title of ["Show the second rule", "Realise nothing", "The work of item 1"]) assert.ok(texts.includes(`title: ${title}`), title);
  for (const title of ["Change an unknown module", "Build on a missing item"]) assert.ok(!texts.includes(title), `${title} is discarded`);
  const realiseNothing = written[0].files.find((file) => file.text.includes("title: Realise nothing")).text;
  assert.match(realiseNothing, /realises:\n {2}- RULE TWO\n/);
  for (const path of paths) assert.ok(textOf(classed(page.target, "drafts-added")[0]).includes(path), path);
});

// TST-782004 · level: unit · module: MOD-implementation-pages
// guards: UC-032; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY; A BACKLOG ITEM NAMES THE MODULES IT CHANGES; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the fixture, whose highest item is ITM-002
// input: the person's click on + Item; the title "Read the second rule", the level module, RULE TWO under realises, the tests unit and the origin "the Product Owner" typed and no module; then MOD-store typed; then ITM-099 typed under builds_on, then ITM-001; Add clicked by a script, then by the person
// expect: the click draws the form of the item schema, with one field per key; while no module is named, an error naming the module stands in the form and Add is disabled; once MOD-store is typed Add is enabled; with ITM-099 under builds_on an error that ITM-099 does not exist stands in the form and Add is disabled, with ITM-001 it is enabled again; the script's click writes nothing; the person's writes one commit with one file, docs/backlog/ITM-003-read-the-second-rule.md, whose title, realises, modules and builds_on are those typed; the page names ITM-003 as added
test("+ Item opens the form of an item, and Add commits the item as the person's own input in one commit", async () => {
  const page = await render();
  const plus = one(page.target, "[data-add-item]");
  assert.ok(plus, "the page offers + Item");
  await click(plus);
  await waitFor(() => classed(page.target, "schema-form").length > 0 || /not added|Error/.test(textOf(one(page.target, "[data-item-form]"))));
  const form = classed(page.target, "schema-form")[0];
  assert.ok(form, textOf(one(page.target, "[data-item-form]")));
  const field = (key) => walk(one(form, `[data-key="${key}"]`), (node) => node.localName === "input")[0];
  for (const key of ["title", "level", "realises", "modules", "builds_on", "tests", "origin"]) assert.ok(field(key), `the form has the field ${key}`);
  await type(field("title"), "Read the second rule");
  await type(field("level"), "module");
  await type(field("realises"), "RULE TWO");
  await type(field("tests"), "unit");
  await type(field("origin"), "the Product Owner");
  const add = () => buttons(form, "Add")[0];
  assert.ok(add(), "the form's button is Add");
  assert.equal(add().disabled, true, "an item without a module cannot be added");
  assert.match(classed(form, "error").map(textOf).join(" "), /module/i);
  await type(field("modules"), "MOD-store");
  assert.equal(add().disabled, false, `the item is complete: ${classed(form, "error").map(textOf).join(" | ")}`);
  await type(field("builds_on"), "ITM-099");
  assert.equal(add().disabled, true, "an item that builds on an item that does not exist cannot be added");
  assert.match(classed(form, "error").map(textOf).join(" "), /ITM-099, which does not exist/);
  await type(field("builds_on"), "ITM-001");
  assert.equal(add().disabled, false, "the item builds on ITM-001 of the backlog");
  const before = page.commits.length;
  await click(add(), false);
  assert.equal(page.commits.length, before, "a script's click writes nothing");
  await click(add());
  await waitFor(() => classed(page.target, "item-added").length > 0 || /not added/.test(textOf(page.target)));
  const written = page.commits.slice(before);
  assert.equal(written.length, 1, textOf(page.target));
  assert.deepEqual(written[0].files.map((file) => file.path), ["docs/backlog/ITM-003-read-the-second-rule.md"]);
  const [file] = written[0].files;
  assert.match(file.text, /title: Read the second rule\n/);
  assert.match(file.text, /realises:\n {2}- RULE TWO\n/);
  assert.match(file.text, /modules:\n {2}- MOD-store\n/);
  assert.match(file.text, /builds_on:\n {2}- ITM-001\n/);
  assert.match(textOf(classed(page.target, "item-added")[0]), /ITM-003/);
});
