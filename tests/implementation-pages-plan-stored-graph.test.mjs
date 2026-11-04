// MOD-implementation-pages' route `plan` reads the graph stored for its commit (ITM-1120), as the accepted text of docs/architecture/MOD-implementation-pages.md states it:
// "MOD-trace-graph.traceGraph, MOD-trace-graph.moduleRows — … the architecture's subsystems and modules beside the plan, from the graph of the commit shown. Each graph is asked for with its
// commit, so that the graph `onMainChanged` stored for it is read where there is one (MOD-workflow-entries)", with the rule that a page reads the stored graph and never builds one, and
// `A PAGE LOAD READS THE REPOSITORY IN BATCHES`.
// Run: node --test tests/implementation-pages-plan-stored-graph.test.mjs
//
// Module: MOD-implementation-pages
// Guards: UC-045; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// Level: unit
//
// The product is the small V-model fixture of tests/implementation-pages-plan.test.mjs, held in memory behind a host of this file's own. Its snapshot offers `readOn`, and the branch
// `trace-cache` holds the graph of the commit (MOD-trace-graph's graphText, gzipped as `<commit>.json.gz`) where the test says so. Every call of `read` and `readOn` is kept. Nothing reaches the network. Where the module
// file leaves a reading open, the test states the one it takes, and the pull request names it:
//   - That the stored graph is the one the page draws is seen in an architecture node the stored graph holds and the files do not (MOD-stored): the page lists it only if it read the stored graph.
//   - The page asks once for the commit's graph, `trace-cache` / `<commit>.json.gz`, whether or not the branch holds it; productFacts asks for no facts file (none is stored).
//   - "No file only the graph reads is read" is: tests/sample.test.mjs is read by no one, whether or not a graph is stored. The page's marks come from MOD-work-plans' planFindings, to which the page
//     hands the graph it holds (ITM-1156), so that it builds none.
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import "./site-frame-dom.mjs";
const { view } = await import("../src/implementation-pages/index.mjs");
const { traceGraph, graphText } = await import("../src/trace-graph/index.mjs");
const { gzipped } = await import("../src/trace-graph/stored.mjs");
const route = view.routes.find((candidate) => candidate.name === "plan");

const lines = (...rows) => `${rows.join("\n")}\n`;
const blobOf = (text) => createHash("sha1").update(text).digest("hex");
const ADDRESS = "https://github.com/acme/product";
// The commit of the product: each test asks for a commit of its own, since MOD-trace-graph's storedGraph keeps a commit's graph for the page (the module).
let COMMIT = "c".repeat(40);
const MODEL_VERSION = "5".repeat(40);
const ONLY_THE_GRAPH = "tests/sample.test.mjs";

const decision = (id, extra) => lines("---", `id: ${id}`, `title: ${id} decision`, ...extra, "---", `# ${id} decision`, "", "## Context", "", "c", "", "## Decision", "", "d", "",
  "## Alternatives", "", "a", "", "## Consequences", "", "q");
const module_ = (id) => lines("---", `id: ${id}`, `title: ${id}`, `folder: src/${id.slice(4)}/`, "realises:", "follows:", "  - ARC-002", "uses: []", "provides:", "  - f", "---",
  `# ${id} ${id}`, "", "## Responsibility", "", "r", "", "## Parts", "", "p", "", "## Data", "", "d", "", "## Interfaces", "", "- `f` — i", "", "## Files", "", "f", "", "## Uses", "", "u");
const step = (id, title) => lines("---", `id: ${id}`, `title: ${title}`, "level: module", "realises:", "  - UC-001", "modules:", "  - MOD-reader", "tests:", "  - unit", "origin:", "  - UC-001", "---",
  `# ${id} ${title}`, "", "## Outcome", "", "o", "", "## Acceptance", "", "a");
const declaration = lines("---", "model: v-model", `model_file: src/model-catalogue/models/v-model.md`, `model_version: ${MODEL_VERSION}`, "---",
  "# Process", "", "## Practices", "", "- none", "", "## Branches", "", "| Phase or time box | Branch |", "|---|---|", "| Implementation | work/<item> |", "",
  "## Definition of Done", "", "The job rules hold; no condition is added.");
const USE_CASE = "docs/use-cases/UC-001-load.md";

function productFiles() {
  const files = { "SPEC.md": "# Fixture\n", "docs/process.md": declaration, [USE_CASE]: "# UC-001 load\n",
    "docs/architecture/ARC-001-whole.md": decision("ARC-001", ["forced_by:", "  - UC-001"]),
    "docs/architecture/ARC-002-sub.md": decision("ARC-002", ["refines: ARC-001", "forced_by:", "  - UC-001", "designs:", "  - MOD-reader"]),
    "docs/architecture/MOD-reader.md": module_("MOD-reader"),
    "docs/plan/ITM-010-reader.md": step("ITM-010", "Read the store"),
    "docs/plan/order.md": lines("## Order", "", "| Step | Phase |", "| --- | --- |", "| ITM-010 | Testing |"),
    [ONLY_THE_GRAPH]: lines("// TST-001", "// level: unit", "// guards: UC-001", "") };
  for (const path of Object.keys(files).filter((each) => each === USE_CASE || each.startsWith("docs/architecture/"))) {
    files[`docs/approvals/${/(ARC-\d+|MOD-[a-z]+|UC-\d+)/.exec(path)[1]}-${blobOf(files[path]).slice(0, 12)}.md`] = "kind: record\n";
  }
  return files;
}

// The product's snapshot, keeping every call; `stored` is the gzipped text of the graph on trace-cache, or null for a branch that holds none.
// `others` holds further files of trace-cache, by path: latest.json and the graph of an earlier commit, where a test gives them.
function snapshotOf(files, calls, stored, others = {}) {
  return { repository: { server: "github", path: "acme/product", web: ADDRESS }, ref: "main", commit: COMMIT, paths: Object.keys(files),
    blob: (path) => (Object.hasOwn(files, path) ? blobOf(files[path]) : null),
    read: async (path) => { calls.push({ fn: "read", path }); return Object.hasOwn(files, path) ? files[path] : null; },
    readOn: async (branch, path, options) => {
      calls.push({ fn: "readOn", branch, path });
      if (branch === "trace-cache" && path === `${COMMIT}.json.gz` && options?.bytes) return stored;
      return branch === "trace-cache" && Object.hasOwn(others, path) ? others[path] : null;
    } };
}
const INSTANCE = "# Participants\n\n**REGISTER**\n\nThe people and agents of the fixture instance.\n\n| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |\n|---|---|---|---|---|---|---|---|\n";
function contextOf(snapshot) {
  const host = (shot) => ({ async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite: true, archived: false, description: "" }; },
    async readSnapshot() { return shot; }, async listPullRequests() { return []; }, async containsCommit() { return false; },
    // The file at each commit, as the one snapshot holds it (MOD-repository-hosts' readFileAt), for the declared model the route reads first (ITM-1260).
    async readFileAt(path, commits) { const held = await shot.read(path); return new Map(commits.map((commit) => [commit, held])); } });
  const instance = { ...snapshotOf({ "SPEC.md": "# Instance\n", "docs/participants.md": INSTANCE }, [], null), repository: { server: "github", path: "acme/agent-m", web: "https://github.com/acme/agent-m" } };
  return { product: { address: ADDRESS, host: host(snapshot) }, instance: { host: host(instance) } };
}
async function render(stored, others = async () => ({})) {
  globalThis.mermaid = { initialize() {}, mermaidAPI: { getDiagramFromText: async () => ({ db: { getVertices: () => ({}) } }) }, run: async () => {} };
  const files = productFiles(), calls = [];
  const target = document.createElement("div");
  document.body.append(target);
  let failure = null;
  try { await route.render(target, contextOf(snapshotOf(files, calls, await stored(files), await others(files))), {}); } catch (error) { failure = error; } finally { delete globalThis.mermaid; }
  return { target, calls, failure };
}
const elements = (root, match) => {
  const found = [];
  (function walk(n) { for (const k of n.childNodes) if (k.nodeType === 1) { if (match(k)) found.push(k); walk(k); } })(root);
  return found;
};
const architecture = (target) => elements(target, (e) => e.getAttribute("data-architecture") !== null).map((e) => e.getAttribute("data-architecture"));
// The graph of the commit as `onMainChanged` stored it, with one architecture node more than the files hold: the page lists it only from the stored graph.
const graphOf = async (files, commit = COMMIT, extra = "MOD-stored") => {
  const graph = await traceGraph({ paths: Object.keys(files), read: async (path) => files[path] ?? null }, { commit });
  const reader = graph.nodes.get("MOD-reader");
  graph.nodes.set(extra, { ...reader, id: extra, title: extra, path: `docs/architecture/${extra}.md` });
  return gzipped(graphText(graph));
};
const asOf = (target) => elements(target, (e) => e.getAttribute("data-graph-as-of") !== null).map((e) => e.textContent);

// TST-1120001 · level: unit · module: MOD-implementation-pages
// guards: UC-045; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the plan of a V-model product whose accepted architecture has the system ARC-001, the subsystem ARC-002 and MOD-reader, and `trace-cache` holding the graph of the commit
// input: the route plan's render
// expect: the page shows the architecture of the stored graph, MOD-stored among it, and reads no file only the graph reads; `readOn` is asked once, for trace-cache / <commit>.json.gz, and for nothing on overview-cache
test("the plan page reads the graph stored for its commit and builds none", async () => {
  const probe = await graphOf(productFiles());
  const { target: shown, calls: asked, failure } = await render(() => probe);
  assert.equal(failure, null);
  assert.ok(architecture(shown).includes("MOD-stored"), "the architecture is the stored graph's");
  assert.deepEqual(architecture(shown).filter((id) => id !== "MOD-stored"), ["ARC-001", "ARC-002", "MOD-reader"]);
  assert.equal(asked.filter((call) => call.path === ONLY_THE_GRAPH).length, 0, "no file only the graph reads is read");
  assert.deepEqual(asked.filter((call) => call.fn === "readOn"), [{ fn: "readOn", branch: "trace-cache", path: `${COMMIT}.json.gz` }]);
  assert.deepEqual(asOf(shown), [], "the head's own graph is shown, and no line says otherwise");
});

// TST-1120002 · level: unit · module: MOD-implementation-pages
// guards: UC-045; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the same product, `trace-cache` holding no graph of the commit and no latest.json
// input: the route plan's render
// expect: no graph is built: tests/sample.test.mjs is read by no one and no architecture is listed; the render fails with GraphNotStored, whose message — "the trace graph of <commit> is not stored yet" — the frame shows in the page's place (MOD-site-frame's readProblem); `readOn` was asked as in TST-1120001, and once more for trace-cache / latest.json (the counter-proof of TST-1120001)
test("the plan page builds no graph where none is stored, and fails with GraphNotStored", async () => {
  COMMIT = "d".repeat(40);
  const { target, calls, failure } = await render(() => null);
  assert.deepEqual(architecture(target), []);
  assert.equal(failure?.name, "GraphNotStored");
  assert.match(failure.message, new RegExp(`the trace graph of ${COMMIT.slice(0, 12)} is not stored yet`));
  assert.deepEqual(calls.filter((call) => call.fn === "readOn"), [{ fn: "readOn", branch: "trace-cache", path: `${COMMIT}.json.gz` },
    { fn: "readOn", branch: "trace-cache", path: "latest.json" }]);
  assert.equal(calls.filter((call) => call.path === ONLY_THE_GRAPH).length, 0, "no graph is built from the files");
});

// TST-1302005 · level: unit · module: MOD-implementation-pages
// guards: UC-045; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the same product, `trace-cache` holding no graph of the commit, a latest.json naming an earlier commit, and that commit's graph, which holds MOD-earlier (a node the files do not hold)
// input: the route plan's render
// expect: no failure; the architecture is the earlier graph's (MOD-earlier listed, MOD-stored not); one line, data-graph-as-of, reads "As of <earlier, 7>: the trace graph of the newest commit, <commit, 7>, is being stored."; `readOn` asked for trace-cache / <commit>.json.gz, latest.json and <earlier>.json.gz, once each and nothing else; tests/sample.test.mjs read by no one
test("the plan page shows the graph stored last, with the line naming both commits, while its commit's graph is not stored", async () => {
  COMMIT = "e".repeat(40);
  const earlier = "f".repeat(40);
  const { target, calls, failure } = await render(() => null,
    async (files) => ({ "latest.json": `{"commit":"${earlier}"}\n`, [`${earlier}.json.gz`]: await graphOf(files, earlier, "MOD-earlier") }));
  assert.equal(failure, null);
  assert.ok(architecture(target).includes("MOD-earlier"), "the architecture is the earlier graph's");
  assert.equal(architecture(target).includes("MOD-stored"), false);
  assert.deepEqual(asOf(target), [`As of ${earlier.slice(0, 7)}: the trace graph of the newest commit, ${COMMIT.slice(0, 7)}, is being stored.`]);
  assert.deepEqual(calls.filter((call) => call.fn === "readOn"), [{ fn: "readOn", branch: "trace-cache", path: `${COMMIT}.json.gz` },
    { fn: "readOn", branch: "trace-cache", path: "latest.json" }, { fn: "readOn", branch: "trace-cache", path: `${earlier}.json.gz` }]);
  assert.equal(calls.filter((call) => call.path === ONLY_THE_GRAPH).length, 0, "no graph is built from the files");
});
