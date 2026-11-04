// MOD-implementation-pages' route `plan` drafts the plan, lets the planner review it, and saves it (ITM-1058), as the accepted text of docs/architecture/MOD-implementation-pages.md states the
// route: "*Draft the plan* with its run panel, run in this tab and attended, whose result waits for the planner; the draft reviewed in order, reordered, split, merged or edited where its
// dependencies allow; *Save plan*, which lets the drafted plan go on as the planner left it", with its Uses "MOD-job-runner.prepareJob — the run panels; MOD-job-runner.writeResult — a drafted plan
// or drafted items written on the person's click", MOD-job-catalogue's "*Save plan* (UC-045) — ... through MOD-job-runner's `writeResult`", and UC-045 steps 2, 4 and 5.
// Run: node --test tests/implementation-pages-plan-draft.test.mjs
//
// Module: MOD-implementation-pages
// Guards: UC-045; A GENERATED ARTIFACT IS A PROPOSAL; THE PAGE NAMES WHERE IT SENDS; ONE CLICK PER DECISION; A RUN FOLLOWS THE MODULES' INTERFACES; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK;
// A PERSON'S OWN INPUT IS COMMITTED DIRECTLY; EVERY ARTIFACT HAS AN IDENTIFIER; AN IMPLEMENTATION PLAN ASSEMBLES THE SYSTEM FROM ITS MODULES
// Level: unit
//
// The product is a V-model fixture held in memory behind a host of this file's own that keeps the commits it is given; the instance is a second host holding AGENTS.md, the participants' register and
// the V-model's file. The participant local-llm drafts text at "this machine" through the endpoint ep1, which this file answers in place of `fetch` with the drafted plan of the kind draft-plan
// (src/job-catalogue/kinds/draft-plan/answer.schema.json); nothing reaches the network, and Mermaid is replaced by a recorder that keeps the text of every diagram it is handed. The strategies of the
// view are registered, as the frame registers them. Readings the texts leave open, which the tests state (the pull request names them):
//   - *Draft the plan* is a `button` of type `button` with the class `btn` and the attribute `data-draft-plan`, offered where the plan can be drafted: a model that plans its work, its architecture
//     accepted. A click by a script draws nothing; the person's click reads the instance's register and draws the participants that can draft text (`[data-draft-participant]`) with the run panel.
//   - The draft is shown one step to a box `[data-draft-step]`, in its order, with fields to edit (`[data-step-field="title|implements|level|phase|after"]`, a list as names separated by commas) and
//     the buttons Up, Down, Split and Merge with next; beside them one Mermaid diagram of the steps in their order, each node labelled with its place and title, an edge from each step it comes after.
//   - "Where its dependencies allow" is read as the finding MOD-work-plans' planFindings gives on the order: a change of the order after which a module stands before one whose interface it uses is
//     refused, the draft stays as it was, and the finding is shown as `<li class="error">` in `[data-draft-refused]`.
//   - Split puts a copy of the step after it, titled "<title> (2)"; Merge with next makes the step and the next one step: the first's title, the modules of both, what either comes after.
// The plan written by hand (ITM-1059), as the same text states the route — "*Save plan*, which ... writes a plan made by hand with `savePlan`; *+ Step*" —, its Uses "MOD-work-plans.savePlan ...
// — every save of a plan", MOD-work-plans' savePlan ("`planFindings` first, and with an error finding nothing is written ... `trailers` are a job's provenance lines, empty for a person's own
// input"), and UC-045 2a ("They add steps with **+ Step**, each naming what it implements or integrates; the check of step 3 runs when they press **Save plan**, and the plan is committed as their
// own input"). Readings the texts leave open:
//   - *+ Step* is a `button` of type `button` with the class `btn` and the attribute `data-add-step`, beside *Draft the plan*. The person's click adds an empty step, in a box as a drafted step has,
//     with the same fields, moves and diagram; where no plan is being edited, it opens one written by hand. A click by a script adds nothing.
//   - A plan written by hand adds its steps to the plan of the default branch read at the click: its steps follow that plan's in the order, and no step of it is removed.
// The findings of the plan written by hand and the link of a cycle's finding (ITM-1368), as UC-045 2a and 3a state them — "the check of step 3 runs when they press **Save plan**", "Agent M names the
// modules of the cycle and links to UC-023 to change the architecture" — and MOD-work-plans' savePlan ("`planFindings` first, and with an error finding nothing is written"). Readings the texts leave open:
//   - A step typed without the level of its tests is a step whose tests are not named; a step typed without a phase is a step the order does not place. The page shows what planFindings finds on them.
//   - "links to UC-023 to change the architecture" is read as the link to the page of the architecture, #arc, with the product kept in the `/product=` form, beside each finding of a cycle.
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { withStoredGraph } from "./stored-graph-fake.mjs";

import "./site-frame-dom.mjs";
const { view } = await import("../src/implementation-pages/index.mjs");
const { registerStrategies } = await import("../src/job-runner/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "plan");
for (const [at, strategies] of view.strategies.entries()) {
  try { registerStrategies(`tests/implementation-pages-plan-draft.test.mjs#${at}`, strategies); } catch { /* registered already */ }
}

// ---------------------------------------------------------------- the DOM
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
const click = async (node, trusted = true) => { const event = new Event("click"); if (trusted) Object.defineProperty(event, "isTrusted", { value: true }); node.dispatchEvent(event); await settle(); };
const type = async (input, value) => { input.value = value; input.dispatchEvent(new Event("input")); await settle(); };

// ---------------------------------------------------------------- the fixture product and instance
const lines = (...rows) => `${rows.join("\n")}\n`;
const blobOf = (content) => createHash("sha1").update(content).digest("hex");
const ADDRESS = "https://github.com/acme/product";
const MODEL_FILE = "src/model-catalogue/models/v-model.md";
const MODEL_VERSION = "5".repeat(40);
const V_MODEL = readFileSync(new URL(`../${MODEL_FILE}`, import.meta.url), "utf8");

const decision = (id, extra) => lines("---", `id: ${id}`, `title: ${id} decision`, ...extra, "---", `# ${id} decision`, "", "## Context", "", "c", "", "## Decision", "", "d", "",
  "## Alternatives", "", "a", "", "## Consequences", "", "q");
const module_ = (id, uses = []) => lines("---", `id: ${id}`, `title: ${id}`, `folder: src/${id.slice(4)}/`, "realises:", "follows:", "  - ARC-002",
  ...(uses.length ? ["uses:", ...uses.map((each) => `  - ${each}`)] : ["uses: []"]), "provides:", "  - read", "---",
  `# ${id} ${id}`, "", "## Responsibility", "", "r", "", "## Parts", "", "p", "", "## Data", "", "d", "", "## Interfaces", "", "- `read` — i", "", "## Files", "", "f", "", "## Uses", "", "u");
const DECLARATION = lines("---", "model: v-model", `model_file: ${MODEL_FILE}`, `model_version: ${MODEL_VERSION}`, "---", "# Process", "", "## Practices", "", "- none", "", "## Branches", "",
  "| Phase or time box | Branch |", "|---|---|", "| Implementation | work/<item> |", "", "## Definition of Done", "", "The job rules hold; no condition is added.");

// The system ARC-001; the subsystem ARC-002 designing MOD-reader and MOD-writer, MOD-writer using MOD-reader's interface; MOD-loose, designed by none.
const ARCHITECTURE = {
  "docs/architecture/ARC-001-whole.md": decision("ARC-001", ["forced_by:", "  - UC-001"]),
  "docs/architecture/ARC-002-sub.md": decision("ARC-002", ["refines: ARC-001", "forced_by:", "  - UC-001", "designs:", "  - MOD-reader", "  - MOD-writer"]),
  "docs/architecture/MOD-reader.md": module_("MOD-reader"),
  "docs/architecture/MOD-writer.md": module_("MOD-writer", ["MOD-reader.read"]),
  "docs/architecture/MOD-loose.md": module_("MOD-loose"),
};
const USE_CASE = "docs/use-cases/UC-001-load.md";

// A V-model product without a plan, whose architecture and use case are accepted: an approval record names the current blob of each.
function productFiles(architecture = ARCHITECTURE) {
  const files = { "SPEC.md": "# Fixture\n", "docs/process.md": DECLARATION, [USE_CASE]: "# UC-001 load\n", ...architecture };
  for (const path of Object.keys(files).filter((each) => each === USE_CASE || each.startsWith("docs/architecture/"))) {
    files[`docs/approvals/${/(ARC-\d+|MOD-[a-z]+|UC-\d+)/.exec(path)[1]}-${blobOf(files[path]).slice(0, 12)}.md`] = "kind: record\n";
  }
  return files;
}
const REGISTER = lines("# Participants of this instance", "", "**REGISTER**", "", "The participants of the test instance.", "",
  "| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |", "|---|---|---|---|---|---|---|---|",
  "| local-llm | model endpoint | model-a | 200000 | — | draft text | this machine | endpoint ep1 |",
  "| checker | model endpoint | model-c | 200000 | — | read the repository | this machine | endpoint ep1 |");
const instanceFiles = () => ({ "SPEC.md": "# Instance\n", "AGENTS.md": "# AGENTS.md of the instance\n", "docs/participants.md": REGISTER, [MODEL_FILE]: V_MODEL });

// A host of this file's own, answering the part of MOD-repository-hosts' interface the route uses: it keeps every request in `calls` and every commit in `commits`, whose files it then holds. Its
// snapshot's commit is named by its files, and serves the trace graph stored for it (tests/stored-graph-fake.mjs).
function hostOf(files, calls, commits, web) {
  const snapshot = () => {
    const commit = createHash("sha1").update(JSON.stringify(Object.entries(files).sort())).digest("hex");
    return withStoredGraph({ repository: { server: "github", path: "acme/product", web }, ref: "main", commit, paths: Object.keys(files),
      blob: (path) => (Object.hasOwn(files, path) ? blobOf(files[path]) : null),
      read: async (path) => { calls.push(`read ${path}`); return Object.hasOwn(files, path) ? files[path] : null; }, readMany: async () => {} },
    { read: async (path) => (Object.hasOwn(files, path) ? files[path] : null) });
  };
  return {
    async repositoryInfo() { calls.push("repositoryInfo"); return { defaultBranch: "main", visibility: "private", canWrite: true, archived: false, description: "" }; },
    async readSnapshot(ref) { calls.push(`readSnapshot ${ref}`); return snapshot(); },
    async readFileAt(path, commits_) { return new Map(commits_.map((commit) => [commit, Object.hasOwn(files, path) ? files[path] : null])); },
    async listPullRequests() { calls.push("listPullRequests"); return []; },
    async containsCommit() { return false; },
    async readHistory() { calls.push("readHistory"); return []; },
    async commitFiles(request) {
      calls.push("commitFiles");
      commits.push(request);
      for (const file of request.files) { if (file.delete) delete files[file.path]; else files[file.path] = file.text; }
      return { commit: snapshot().commit, url: `${web}/commit/${snapshot().commit}` };
    },
  };
}
const STORE = { prefix: "", storage: { getItem: (key) => (key === "endpoint:ep1" ? JSON.stringify({ url: "https://ep1.example.test/v1", kind: "openai-compatible", model: "model-a", key: "k1" }) : null) } };

// The answer of the endpoint ep1: the plan drafted from the bottom up — MOD-reader, MOD-loose, MOD-writer after Reader, the subsystem ARC-002 after Writer, the system after Sub and Loose.
const DRAFT = { steps: [
  { title: "Reader", implements: ["MOD-reader"], level: "unit", phase: "Implementation", after: [] },
  { title: "Loose", implements: ["MOD-loose"], level: "unit", phase: "Implementation", after: [] },
  { title: "Writer", implements: ["MOD-writer"], level: "unit", phase: "Implementation", after: ["Reader"] },
  { title: "Sub", implements: ["ARC-002"], level: "component", phase: "Testing", after: ["Writer"] },
  { title: "Whole", implements: ["system"], level: "system", phase: "Testing", after: ["Sub", "Loose"] },
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
  const calls = [], commits = [], drawn = [];
  const host = hostOf(files, calls, commits, ADDRESS), instance = hostOf(instanceFiles(), calls, [], "https://github.com/acme/agent-m");
  const context = { page: "review", instance: { repository: "acme/agent-m", host: instance }, product: { address: ADDRESS, kind: "github", host, tokenStored: true }, store: STORE, go() {} };
  const target = document.createElement("div");
  document.body.append(target);
  globalThis.mermaid = { initialize() {}, mermaidAPI: { getDiagramFromText: async () => ({ db: { getVertices: () => ({}) } }) },
    run: async ({ nodes }) => { drawn.push(...nodes.map((node) => node.textContent)); } };
  await route.render(target, context, {});
  return { target, calls, commits, files, drawn };
}
// The person's click on Draft the plan, and the run panel waited for.
async function opened(page) {
  const draft = one(page.target, "[data-draft-plan]");
  assert.ok(draft, "the page offers Draft the plan");
  await click(draft);
  await waitFor(() => classed(page.target, "run-panel").length > 0 || /warn/.test(one(page.target, "[data-plan-draft]")?.innerHTML ?? ""));
  return classed(page.target, "run-panel")[0];
}
// The person's Run, and the drafted steps waited for.
async function drafted(page) {
  const panel = await opened(page);
  assert.ok(panel, textOf(one(page.target, "[data-plan-draft]")));
  await click(buttons(panel, "Run")[0]);
  await waitFor(() => all(page.target, "[data-draft-step]").length > 0 || /No plan was drafted/.test(textOf(page.target)));
  return all(page.target, "[data-draft-step]");
}
const titles = (page) => all(page.target, "[data-draft-step]").map((box) => one(box, '[data-step-field="title"]').value);
const stepBox = (page, title) => all(page.target, "[data-draft-step]").find((box) => one(box, '[data-step-field="title"]').value === title);
const planCommits = (page) => page.commits.filter((request) => request.files.some((file) => file.path.startsWith("docs/plan/")));

// TST-1058001 · level: unit · module: MOD-implementation-pages
// guards: UC-045; THE PAGE NAMES WHERE IT SENDS; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the V-model fixture without a plan, its architecture accepted; the instance's participants local-llm (draft text, model model-a, at "this machine", endpoint ep1) and checker (no draft text)
// input: the route's render; a click by a script on Draft the plan; then the person's click on it
// expect: the page holds <button type="button" class="btn" data-draft-plan> "Draft the plan"; the render prepares no job — it reads no AGENTS.md — and writes nothing; the script's click draws nothing and reads nothing; the person's click prepares the job — it reads AGENTS.md (known positive) — and offers local-llm alone; its run panel names local-llm, model-a and "this machine", and the parts architecture-and-model sends: docs/architecture/ARC-001-whole.md, ARC-002-sub.md, MOD-reader.md, MOD-writer.md, MOD-loose.md and docs/process.md; nothing is sent to ep1 before Run
// Planted fault: a run panel without the participant's place, or a button that prepares the job on a script's click, fails.
test("the plan page offers Draft the plan, whose run panel names the participant, its place and the parts of architecture-and-model", async () => {
  const page = await render();
  const draft = one(page.target, "[data-draft-plan]");
  assert.ok(draft, "the page offers Draft the plan");
  assert.deepEqual([draft.localName, draft.getAttribute("type"), draft.getAttribute("class"), textOf(draft)], ["button", "button", "btn", "Draft the plan"]);
  assert.ok(!page.calls.includes("read AGENTS.md"), "the render prepares no job: it reads no AGENTS.md");
  assert.ok(!page.calls.includes("commitFiles"), "the render writes nothing");
  const before = page.calls.length;
  await click(draft, false);
  assert.equal(page.calls.length, before, "a script's click reads nothing");
  assert.equal(classed(page.target, "run-panel").length, 0, "a script's click draws nothing");
  answering(DRAFT);
  const panel = await opened(page);
  assert.ok(panel, textOf(one(page.target, "[data-plan-draft]")));
  assert.ok(page.calls.includes("read AGENTS.md"), "known positive: the person's click prepares the job, which reads AGENTS.md");
  const offered = one(page.target, "[data-draft-participant]");
  assert.deepEqual(walk(offered, (node) => node.localName === "option").map((option) => option.getAttribute("value")), ["local-llm"], "only a participant that drafts text is offered");
  for (const shown of ["local-llm", "model-a", "this machine", "docs/architecture/ARC-001-whole.md", "docs/architecture/ARC-002-sub.md", "docs/architecture/MOD-reader.md",
    "docs/architecture/MOD-writer.md", "docs/architecture/MOD-loose.md", "docs/process.md"]) {
    assert.ok(textOf(panel).includes(shown), `the run panel names ${shown}`);
  }
  assert.equal(asked.length, 0, "nothing is sent before Run");
  assert.ok(!page.commits.length, "nothing is written before Run");
});

// TST-1058002 · level: unit · module: MOD-implementation-pages
// guards: UC-045; A GENERATED ARTIFACT IS A PROPOSAL
// given: the fixture; ep1 answers the draft Reader (MOD-reader), Loose (MOD-loose), Writer (MOD-writer, after Reader), Sub (ARC-002, after Writer), Whole (system, after Sub and Loose)
// input: the person's click on Draft the plan, then on Run
// expect: ep1 is asked; the draft is shown in its order, five boxes titled Reader, Loose, Writer, Sub, Whole, each with its fields; the last diagram Mermaid is handed is the flowchart of the steps in that order — S1["1. Reader"], S2["2. Loose"], S3["3. Writer"], S4["4. Sub"], S5["5. Whole"] — with the edges S1 --> S3, S3 --> S4, S4 --> S5 and S2 --> S5; nothing is written under docs/plan/ (the draft waits for the planner), and Save plan is offered
// Planted fault: drawing the boxes in another order than the draft's, or writing the plan when the job ends, fails.
test("the drafted plan waits for the planner, shown in its order with a diagram of the steps and what each comes after", async () => {
  const page = await render();
  answering(DRAFT);
  const boxes = await drafted(page);
  assert.ok(asked.length >= 1, "Run asks the endpoint");
  assert.equal(boxes.length, 5, textOf(page.target));
  assert.deepEqual(titles(page), ["Reader", "Loose", "Writer", "Sub", "Whole"]);
  for (const key of ["title", "implements", "level", "phase", "after"]) assert.ok(one(boxes[2], `[data-step-field="${key}"]`), `a step has the field ${key}`);
  assert.equal(one(boxes[2], '[data-step-field="implements"]').value, "MOD-writer");
  assert.equal(one(boxes[4], '[data-step-field="after"]').value, "Sub, Loose");
  assert.deepEqual(page.drawn.at(-1), ["flowchart TD", '  S1["1. Reader"]', '  S2["2. Loose"]', '  S3["3. Writer"]', '  S4["4. Sub"]', '  S5["5. Whole"]',
    "  S1 --> S3", "  S3 --> S4", "  S4 --> S5", "  S2 --> S5"].join("\n"));
  assert.deepEqual(planCommits(page), [], "nothing is written under docs/plan/ before Save plan");
  assert.ok(buttons(page.target, "Save plan")[0], "Save plan is offered");
});

// TST-1058003 · level: unit · module: MOD-implementation-pages
// guards: UC-045; A RUN FOLLOWS THE MODULES' INTERFACES
// given: the draft of TST-1058002, in which MOD-writer uses MOD-reader's interface
// input: Up on Loose (known positive: Loose implements a module that uses none); then Up on Writer, which would put MOD-writer before MOD-reader
// expect: after Up on Loose the order is Loose, Reader, Writer, Sub, Whole and no refusal is shown, and the diagram is drawn again in that order; Up on Writer is refused: the order stays Loose, Reader, Writer, Sub, Whole, and [data-draft-refused] shows an error "MOD-writer is ordered before MOD-reader, whose interface it uses"
// Planted fault: applying every move, or refusing every move, fails.
test("a reorder that puts a module before one whose interface it uses is refused with that finding", async () => {
  const page = await render();
  answering(DRAFT);
  await drafted(page);
  await click(one(stepBox(page, "Loose"), "[data-step-up]"));
  assert.deepEqual(titles(page), ["Loose", "Reader", "Writer", "Sub", "Whole"], "known positive: Loose moves up");
  assert.deepEqual(classed(one(page.target, "[data-draft-refused]"), "error").map(textOf), [], "no refusal for an allowed move");
  assert.match(page.drawn.at(-1), /S1\["1\. Loose"\]\n {2}S2\["2\. Reader"\]/, "the diagram is drawn again in the new order");
  await click(one(stepBox(page, "Writer"), "[data-step-up]"));
  assert.deepEqual(titles(page), ["Loose", "Reader", "Writer", "Sub", "Whole"], "the move is refused: the order stays");
  assert.match(classed(one(page.target, "[data-draft-refused]"), "error").map(textOf).join(" "), /MOD-writer is ordered before MOD-reader, whose interface it uses/);
});

// TST-1058004 · level: unit · module: MOD-implementation-pages
// guards: UC-045; ONE CLICK PER DECISION; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; A GENERATED ARTIFACT IS A PROPOSAL
// given: the draft of TST-1058002; the planner edits the title of the step Whole to "The whole system"
// input: a click by a script on Save plan; then the person's click on Save plan
// expect: the script's click writes nothing; the person's click writes one commit under docs/plan/, through the writer plan-steps: five step files docs/plan/ITM-<n>-<slug>.md and docs/plan/order.md; the step of the system is docs/plan/ITM-<n>-the-whole-system.md titled "The whole system", and no file is titled "Whole"; the commit's message carries the job's provenance (Agent-M-Job); the page names the commit and the files
// Planted fault (counter-proof): a save that writes the draft as returned, ignoring the planner's edit, writes the title "Whole" and fails.
test("Save plan writes the draft as the planner left it, in one commit through the writer plan-steps", async () => {
  const page = await render();
  answering(DRAFT);
  await drafted(page);
  await type(one(stepBox(page, "Whole"), '[data-step-field="title"]'), "The whole system");
  const save = buttons(page.target, "Save plan")[0];
  assert.ok(save, "Save plan is offered");
  await click(save, false);
  assert.deepEqual(planCommits(page), [], "a script's click writes nothing");
  await click(save);
  await waitFor(() => all(page.target, "[data-plan-saved]").some((node) => textOf(node)) || /not saved/.test(textOf(page.target)));
  const written = planCommits(page);
  assert.equal(written.length, 1, textOf(page.target));
  const paths = written[0].files.map((file) => file.path);
  assert.equal(paths.length, 6, paths.join(", "));
  for (const path of paths.filter((each) => each !== "docs/plan/order.md")) assert.match(path, /^docs\/plan\/ITM-\d{3,}-[a-z0-9-]+\.md$/);
  assert.ok(paths.includes("docs/plan/order.md"));
  const whole = written[0].files.find((file) => /-the-whole-system\.md$/.test(file.path));
  assert.ok(whole, `the system's step is saved under the planner's title: ${paths.join(", ")}`);
  assert.match(whole.text, /title: The whole system\n/);
  assert.ok(written[0].files.every((file) => !/title: Whole\n/.test(file.text)), "the title as returned is not written");
  assert.match(String(written[0].message), /Agent-M-Job/);
  const saved = textOf(one(page.target, "[data-plan-saved]"));
  for (const path of paths) assert.ok(saved.includes(path), path);
});

// TST-1058005 · level: unit · module: MOD-implementation-pages
// guards: UC-045
// given: the draft of TST-1058002
// input: Split on Reader; then Merge with next on Reader
// expect: after Split the order is Reader, Reader (2), Loose, Writer, Sub, Whole, the copy implementing MOD-reader; after Merge with next the order is Reader, Loose, Writer, Sub, Whole again, Reader implementing MOD-reader once
// Planted fault: a split that leaves the copy out, or a merge that keeps both steps, fails.
test("a step is split into two and merged with the next again", async () => {
  const page = await render();
  answering(DRAFT);
  await drafted(page);
  await click(one(stepBox(page, "Reader"), "[data-step-split]"));
  assert.deepEqual(titles(page), ["Reader", "Reader (2)", "Loose", "Writer", "Sub", "Whole"]);
  assert.equal(one(stepBox(page, "Reader (2)"), '[data-step-field="implements"]').value, "MOD-reader");
  await click(one(stepBox(page, "Reader"), "[data-step-merge]"));
  assert.deepEqual(titles(page), ["Reader", "Loose", "Writer", "Sub", "Whole"]);
  assert.equal(one(stepBox(page, "Reader"), '[data-step-field="implements"]').value, "MOD-reader");
});

// ---------------------------------------------------------------- the plan written by hand (ITM-1059)

// The person's + Step for each step, each named as the draft DRAFT names it, its fields typed into the box + Step added last.
async function byHand(page, steps) {
  for (const step of steps) {
    const before = all(page.target, "[data-draft-step]").length;
    await click(one(page.target, "[data-add-step]"));
    await waitFor(() => all(page.target, "[data-draft-step]").length > before);
    const box = all(page.target, "[data-draft-step]").at(-1);
    for (const key of ["title", "implements", "level", "phase", "after"]) {
      await type(one(box, `[data-step-field="${key}"]`), Array.isArray(step[key]) ? step[key].join(", ") : step[key]);
    }
  }
}

// TST-1059001 · level: unit · module: MOD-implementation-pages
// guards: UC-045; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY; EVERY ARTIFACT HAS AN IDENTIFIER; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the V-model fixture without a plan, its architecture accepted (TST-1058001)
// input: a click by a script on + Step; then the person's + Step five times, typing the steps of DRAFT — Reader (MOD-reader), Loose (MOD-loose), Writer (MOD-writer, after Reader), Sub (ARC-002, after Writer), Whole (system, after Sub and Loose) —; then the person's click on Save plan
// expect: the page holds <button type="button" class="btn" data-add-step> "+ Step"; the script's click adds no step; the person's click adds one empty box with the fields title, implements, level, phase and after; the last diagram is the flowchart of TST-1058002; no job is prepared — AGENTS.md is not read, whereas Draft the plan reads it (known positive, TST-1058001) —; Save plan writes one commit of six files: five docs/plan/ITM-<n>-<slug>.md, each with an identifier `id: ITM-<n>` of its own, and docs/plan/order.md naming those five identifiers in the typed order with their phases; the commit's message carries no provenance line (no line opens with "Agent-M-"); the page names the files
// Planted fault (counter-proof): saving the plan written by hand through writeResult and the writer plan-steps writes the provenance lines Agent-M-Kind and Agent-M-Participant and fails; a step written without its identifier fails.
test("steps added with + Step are saved as the planner's own input, one file per step and the order, with no provenance", async () => {
  const page = await render();
  const add = one(page.target, "[data-add-step]");
  assert.ok(add, "the page offers + Step");
  assert.deepEqual([add.localName, add.getAttribute("type"), add.getAttribute("class"), textOf(add)], ["button", "button", "btn", "+ Step"]);
  await click(add, false);
  assert.equal(all(page.target, "[data-draft-step]").length, 0, "a script's click adds no step");
  await click(add);
  await waitFor(() => all(page.target, "[data-draft-step]").length > 0);
  const first = all(page.target, "[data-draft-step]");
  assert.equal(first.length, 1, "the person's click adds one step");
  for (const key of ["title", "implements", "level", "phase", "after"]) assert.equal(one(first[0], `[data-step-field="${key}"]`)?.value, "", `the new step's ${key} is empty`);
  for (const key of ["title", "implements", "level", "phase", "after"]) await type(one(first[0], `[data-step-field="${key}"]`), [DRAFT.steps[0][key]].flat().join(", "));
  await byHand(page, DRAFT.steps.slice(1));
  assert.deepEqual(titles(page), ["Reader", "Loose", "Writer", "Sub", "Whole"]);
  assert.deepEqual(page.drawn.at(-1), ["flowchart TD", '  S1["1. Reader"]', '  S2["2. Loose"]', '  S3["3. Writer"]', '  S4["4. Sub"]', '  S5["5. Whole"]',
    "  S1 --> S3", "  S3 --> S4", "  S4 --> S5", "  S2 --> S5"].join("\n"));
  assert.ok(!page.calls.includes("read AGENTS.md"), "a plan written by hand prepares no job");
  assert.deepEqual(planCommits(page), [], "nothing is written before Save plan");
  await click(buttons(page.target, "Save plan")[0]);
  await waitFor(() => all(page.target, "[data-plan-saved]").some((node) => textOf(node)));
  const written = planCommits(page);
  assert.equal(written.length, 1, textOf(page.target));
  const steps = written[0].files.filter((file) => file.path !== "docs/plan/order.md");
  assert.equal(steps.length, 5, written[0].files.map((file) => file.path).join(", "));
  const idOfTitle = {};
  for (const file of steps) {
    const [, id] = /^docs\/plan\/(ITM-\d{3,})-[a-z0-9-]+\.md$/.exec(file.path) ?? [];
    assert.ok(id, file.path);
    assert.match(file.text, new RegExp(`^---\\nid: ${id}\\n`), `${file.path} carries its identifier`);
    idOfTitle[/\ntitle: (.*)\n/.exec(file.text)?.[1]] = id;
  }
  assert.equal(new Set(Object.values(idOfTitle)).size, 5, "each step has an identifier of its own");
  const order = written[0].files.find((file) => file.path === "docs/plan/order.md");
  assert.ok(order, "docs/plan/order.md is written");
  const rows = [...order.text.matchAll(/^\| (ITM-\d{3,}) \| ([^|]+?) \|$/gm)].map((row) => [row[1], row[2]]);
  assert.deepEqual(rows, [[idOfTitle.Reader, "Implementation"], [idOfTitle.Loose, "Implementation"], [idOfTitle.Writer, "Implementation"], [idOfTitle.Sub, "Testing"], [idOfTitle.Whole, "Testing"]]);
  assert.doesNotMatch(String(written[0].message), /^Agent-M-/m, "the commit carries no provenance line");
  const shown = textOf(one(page.target, "[data-plan-saved]"));
  for (const file of written[0].files) assert.ok(shown.includes(file.path), file.path);
});

// TST-1059002 · level: unit · module: MOD-implementation-pages
// guards: UC-045; AN IMPLEMENTATION PLAN ASSEMBLES THE SYSTEM FROM ITS MODULES; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY
// given: the V-model fixture without a plan; the planner adds by hand Reader (MOD-reader), Writer (MOD-writer, after Reader), Sub (ARC-002, after Writer) and Whole (system, after Sub) — no step for MOD-loose
// input: the person's click on Save plan
// expect: nothing is written — the host is asked for no commit —; the page says the plan is not saved and shows the error "MOD-loose has no step"; the steps stay as typed and Save plan is offered again; the same plan with Loose added is written (known positive, TST-1059001)
// Planted fault: a save that commits without planFindings, or one that refuses without naming the finding, fails.
test("a plan written by hand without a step for one module is refused, its finding shown, and nothing written", async () => {
  const page = await render();
  await byHand(page, [DRAFT.steps[0], DRAFT.steps[2], DRAFT.steps[3], { ...DRAFT.steps[4], after: ["Sub"] }]);
  await click(buttons(page.target, "Save plan")[0]);
  await waitFor(() => /not saved/.test(textOf(one(page.target, "[data-plan-saved]"))));
  assert.ok(!page.calls.includes("commitFiles"), "nothing is written");
  const result = one(page.target, "[data-plan-saved]");
  assert.match(textOf(result), /not saved/);
  assert.match(classed(result, "error").map(textOf).join(" "), /MOD-loose has no step/);
  assert.deepEqual(titles(page), ["Reader", "Writer", "Sub", "Whole"], "the steps stay as typed");
  assert.equal(buttons(page.target, "Save plan")[0].disabled, false, "Save plan is offered again");
});

// TST-1059003 · level: unit · module: MOD-implementation-pages
// guards: UC-045; A RUN FOLLOWS THE MODULES' INTERFACES
// given: the V-model fixture; the planner adds by hand Reader (MOD-reader), Loose (MOD-loose) and Writer (MOD-writer, after Reader)
// input: Up on Loose (known positive); then Up on Writer, which would put MOD-writer before MOD-reader
// expect: after Up on Loose the order is Loose, Reader, Writer; Up on Writer is refused: the order stays Loose, Reader, Writer and [data-draft-refused] shows an error "MOD-writer is ordered before MOD-reader, whose interface it uses"
// Planted fault: steps written by hand that are moved without the drafted steps' check of the order fail.
test("steps written by hand are moved with the drafted steps' check of the order", async () => {
  const page = await render();
  await byHand(page, DRAFT.steps.slice(0, 3));
  await click(one(stepBox(page, "Loose"), "[data-step-up]"));
  assert.deepEqual(titles(page), ["Loose", "Reader", "Writer"], "known positive: Loose moves up");
  await click(one(stepBox(page, "Writer"), "[data-step-up]"));
  assert.deepEqual(titles(page), ["Loose", "Reader", "Writer"], "the move is refused: the order stays");
  assert.match(classed(one(page.target, "[data-draft-refused]"), "error").map(textOf).join(" "), /MOD-writer is ordered before MOD-reader, whose interface it uses/);
});

// ---------------------------------------------------------------- the findings of a plan written by hand, and the link of a cycle (ITM-1368)

const PAGE_ERRORS = /TypeError|DocumentError|Cannot read/;
// The person's Save plan of a plan written by hand with the given steps, and the page's answer waited for.
async function handSaved(steps) {
  const page = await render();
  await byHand(page, steps);
  await click(buttons(page.target, "Save plan")[0]);
  await waitFor(() => /not saved|Saved the plan/.test(textOf(one(page.target, "[data-plan-saved]"))));
  return page;
}
const withStep = (title, change) => DRAFT.steps.map((step) => (step.title === title ? { ...step, ...change } : step));

// TST-1368001 · level: unit · module: MOD-implementation-pages
// guards: UC-045; A PLAN STEP NAMES THE TESTS OF ITS LEVEL; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY
// given: the V-model fixture without a plan; the planner adds by hand the five steps of DRAFT, with the level of the tests of Reader left empty; known positive: the same plan with the level "component" for Reader, a level of another step
// input: the person's click on Save plan
// expect: nothing is written; the page says the plan is not saved and shows an error that names the rule [A PLAN STEP NAMES THE TESTS OF ITS LEVEL]; the text of the page holds no "TypeError", "DocumentError" or "Cannot read"; the steps stay as typed and Save plan is offered again; known positive: the level of another step gives a finding of the same rule
// Planted fault (counter-proof): an ownStep that reads the first letter of the empty level fails with the TypeError on the page; a save that leaves the finding out writes the plan.
test("a plan written by hand with a step without the level of its tests shows the finding of planFindings, not an error of the page", async () => {
  const other = await handSaved(withStep("Reader", { level: "component" }));
  assert.match(classed(one(other.target, "[data-plan-saved]"), "error").map(textOf).join(" "), /\[A PLAN STEP NAMES THE TESTS OF ITS LEVEL\]/, "known positive: a level of another step is a finding");
  const page = await handSaved(withStep("Reader", { level: "" }));
  const result = one(page.target, "[data-plan-saved]");
  assert.deepEqual(planCommits(page), [], "nothing is written");
  assert.ok(!page.calls.includes("commitFiles"), "the host is asked for no commit");
  assert.match(textOf(result), /not saved/);
  assert.match(classed(result, "error").map(textOf).join(" "), /\[A PLAN STEP NAMES THE TESTS OF ITS LEVEL\]/);
  assert.doesNotMatch(textOf(page.target), PAGE_ERRORS, "no error of the page reaches the planner");
  assert.deepEqual(titles(page), DRAFT.steps.map((step) => step.title), "the steps stay as typed");
  assert.equal(buttons(page.target, "Save plan")[0].disabled, false, "Save plan is offered again");
});

// TST-1368002 · level: unit · module: MOD-implementation-pages
// guards: UC-045; THE MODEL DETERMINES THE PHASES AND THE GATES; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY
// given: the V-model fixture without a plan; the planner adds by hand the five steps of DRAFT, with the phase of Reader left empty; known positive: the same plan with the phase "Nowhere", which the model lacks
// input: the person's click on Save plan
// expect: nothing is written; the page says the plan is not saved and shows an error that names the rule [THE MODEL DETERMINES THE PHASES AND THE GATES]; the text of the page holds no "TypeError", "DocumentError" or "Cannot read"; the steps stay as typed and Save plan is offered again; known positive: a phase the model lacks gives a finding of the same rule
// Planted fault (counter-proof): a save that writes the order's row with the empty phase fails with the DocumentError on the page; a save that leaves the finding out writes the plan.
test("a plan written by hand with a step without a phase shows the finding of planFindings, not an error of the page", async () => {
  const other = await handSaved(withStep("Reader", { phase: "Nowhere" }));
  assert.match(classed(one(other.target, "[data-plan-saved]"), "error").map(textOf).join(" "), /\[THE MODEL DETERMINES THE PHASES AND THE GATES\]/, "known positive: a phase the model lacks is a finding");
  const page = await handSaved(withStep("Reader", { phase: "" }));
  const result = one(page.target, "[data-plan-saved]");
  assert.deepEqual(planCommits(page), [], "nothing is written");
  assert.ok(!page.calls.includes("commitFiles"), "the host is asked for no commit");
  assert.match(textOf(result), /not saved/);
  assert.match(classed(result, "error").map(textOf).join(" "), /\[THE MODEL DETERMINES THE PHASES AND THE GATES\]/);
  assert.doesNotMatch(textOf(page.target), PAGE_ERRORS, "no error of the page reaches the planner");
  assert.deepEqual(titles(page), DRAFT.steps.map((step) => step.title), "the steps stay as typed");
  assert.equal(buttons(page.target, "Save plan")[0].disabled, false, "Save plan is offered again");
});

// TST-1368003 · level: unit · module: MOD-implementation-pages
// guards: UC-045; MODULES DEPEND ON EACH OTHER WITHOUT A CYCLE
// given: the V-model fixture in which MOD-reader uses MOD-writer's interface and MOD-writer uses MOD-reader's; ep1 answers the draft DRAFT; the product is acme/product, the instance acme/agent-m
// input: the person's click on Draft the plan and Run; then on Save plan
// expect: the draft shows the finding of the cycle, naming MOD-reader and MOD-writer, as a list item that holds one link, to #arc/product=https%3A%2F%2Fgithub.com%2Facme%2Fproduct — the page of the architecture, the product kept; no list item that is no finding of a cycle holds a link; after Save plan the page says the plan is not saved, and the finding of the cycle there carries the link too
// Planted fault (counter-proof): a finding drawn as text only fails the link; a link on every finding fails the list item it must not stand in; a link without the product fails its address.
test("a finding of a cycle in the modules' uses carries a link to the architecture, the product kept", async () => {
  const cycle = { ...ARCHITECTURE, "docs/architecture/MOD-reader.md": module_("MOD-reader", ["MOD-writer.read"]) };
  const page = await render(productFiles(cycle));
  answering(DRAFT);
  await drafted(page);
  const ARC = "#arc/product=https%3A%2F%2Fgithub.com%2Facme%2Fproduct";
  const linksIn = (line) => walk(line, (node) => node.localName === "a").map((link) => link.getAttribute("href"));
  const linked = (root) => walk(root, (node) => node.localName === "li" && linksIn(node).length > 0);
  const cycles = (root) => walk(root, (node) => node.localName === "li" && /form a cycle/.test(textOf(node)));
  const draft = one(page.target, "[data-plan-draft]");
  assert.ok(cycles(draft).length > 0, `known positive: the cycle is named — ${textOf(draft)}`);
  assert.match(textOf(cycles(draft)[0]), /MOD-reader/);
  assert.match(textOf(cycles(draft)[0]), /MOD-writer/);
  for (const line of cycles(draft)) assert.deepEqual(linksIn(line), [ARC], "the finding of the cycle links to the architecture");
  assert.deepEqual(linked(draft).filter((line) => !cycles(draft).includes(line)).map(textOf), [], "no other finding carries a link");
  await click(buttons(page.target, "Save plan")[0]);
  await waitFor(() => /not saved/.test(textOf(one(page.target, "[data-plan-saved]"))));
  const refused = one(page.target, "[data-plan-saved]");
  assert.ok(cycles(refused).length > 0, `the refusal names the cycle — ${textOf(refused)}`);
  for (const line of cycles(refused)) assert.deepEqual(linksIn(line), [ARC]);
  assert.deepEqual(linked(refused).filter((line) => !cycles(refused).includes(line)).map(textOf), [], "no other finding of the refusal carries a link");
});
