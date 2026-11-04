// MOD-trace-pages' specification, gaps and modules views while the trace graph of the default branch's head is not stored yet, as docs/architecture/MOD-trace-pages.md states
// it: they show the whole version of the commit whose graph MOD-trace-graph's latestGraph finds — the snapshot read at that commit, its SPEC, group file and every file the page
// reads —, with latestGraph's line naming both commits, and read-only, as at a released version; where the head's graph is stored, nothing changes and the page sends the very
// requests it sent before. A requirement the group file names nowhere is shown at the top level, marked *not yet placed* (UC-021 3b).
// Run: node --test tests/trace-pages-earlier-version.test.mjs
//
// Module: MOD-trace-pages
// Guards: A REQUIREMENT SHOWS WHAT TRACES TO IT; THE TRACEABILITY MATRIX IS DERIVED; AN UNGROUPED ITEM IS SHOWN AT THE TOP LEVEL; UC-020; UC-021
// Level: component
//
// The product is a Host of this file's own with two commits in memory, the head of main and an earlier commit, keeping to MOD-repository-hosts' interface (readSnapshot,
// repositoryInfo, listTags, readHistory, readFileAt; a snapshot's read, readMany, readOn). The branch trace-cache holds the graph of the earlier commit, the head's where the
// case says so, and latest.json naming the earlier commit (tests/stored-graph-fake.mjs builds a stored graph as the workflow "main changed" does). Every call the page makes
// is logged, in the order made, one line each. The real MOD-trace-graph, MOD-group-document and MOD-spec-document run. Nothing reaches the network.
// Readings the cases take, each stated with the sentence it reads:
//   - "the one line naming both commits, in the same wording `latestGraph` gives" and "say so in the line": the line is latestGraph's sentence followed by
//     " Until then it shows that commit's version, read-only.", with the class version-earlier, in place of the "as of" line.
//   - "Where the head's graph exists, nothing changes" and "a test that counts the host's calls": the calls are pinned as a list written out here, which the route
//     sent before this change, and compared as counted — each call as often as listed —, not by their order: the page asks several at once, and which of
//     those the Host hears first is not a request more or less.
// Each test states its input and its expected result before it runs. The counter-proofs are recorded in the commit messages.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { doc, document, find, until } from "./trace-pages-harness.mjs";
import { storedGraphReadOn } from "./stored-graph-fake.mjs";
import { fileOf } from "../src/trace-graph/stored.mjs";

const { view } = await import("../src/trace-pages/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "trace");

const spec = (...names) => ["# Fixture — Specification", "", "## 1. Rules", "", ...names.flatMap((name) => [`**${name}** *(Product Owner)*`, `The rule ${name.toLowerCase()}.`, "*Check:* at review.", ""])].join("\n");
const GROUPS = ["# Requirements — groups", "", "- Rules", "  - RULE ONE", "  - RULE TWO", ""].join("\n");
const useCase = (...names) => doc("UC-001", "Read a book", { area: "reading", actors: ["Member"], realises: names }, "**Goal.** Read.");
// The earlier commit: two requirements, both in the group Rules, RULE ONE realised by UC-001; one module.
const EARLIER = {
  "SPEC.md": spec("RULE ONE", "RULE TWO"),
  "docs/groups/requirements.md": GROUPS,
  "docs/use-cases/UC-001-read-a-book.md": useCase("RULE ONE"),
  "docs/architecture/MOD-reader.md": doc("MOD-reader", "Reads files", { folder: "src/reader/", provides: ["readFile"] }),
};
// The head: RULE THREE added, named by no group, and realised with RULE TWO by UC-001; a second module.
const HEAD = {
  "SPEC.md": spec("RULE ONE", "RULE TWO", "RULE THREE"),
  "docs/groups/requirements.md": GROUPS,
  "docs/use-cases/UC-001-read-a-book.md": useCase("RULE TWO", "RULE THREE"),
  "docs/architecture/MOD-reader.md": EARLIER["docs/architecture/MOD-reader.md"],
  "docs/architecture/MOD-writer.md": doc("MOD-writer", "Writes files", { folder: "src/writer/", uses: ["MOD-reader.readFile"] }),
};

// A Host of this file's own. `headStored`: whether trace-cache holds the head's graph. The commits are this Host's own: MOD-trace-graph keeps a commit's graph for the page.
let made = 0;
function product({ headStored }) {
  const n = ++made;
  const sha = (what) => createHash("sha1").update(`earlier-version ${n} ${what}`).digest("hex");
  const head = sha("head"), earlier = sha("earlier");
  const trees = new Map([[head, HEAD], [earlier, EARLIER]]);
  const name = (commit) => (commit === head ? "head" : commit === earlier ? "earlier" : commit);
  const calls = [];
  const stored = new Map([...trees].map(([commit, files]) => [commit,
    storedGraphReadOn({ commit, paths: Object.keys(files), read: async (path) => files[path] ?? null })]));
  const snapshotAt = (commit, ref) => {
    const files = trees.get(commit);
    return {
      ref, commit, paths: Object.keys(files),
      async read(path) { calls.push(`read ${name(commit)} ${path}`); return files[path] ?? null; },
      async readMany(paths) { calls.push(`readMany ${name(commit)} ${[...paths].join(", ")}`); },
      async readOn(branch, path, options) {
        const file = path === fileOf(head) ? "<head>.json.gz" : path === fileOf(earlier) ? "<earlier>.json.gz"
          : path === `${head}.gaps.json` ? "<head>.gaps.json" : path === `${earlier}.gaps.json` ? "<earlier>.gaps.json" : path;
        calls.push(`readOn ${branch} ${file}`);
        if (branch !== "trace-cache") return null;
        if (path === "latest.json") return `${JSON.stringify({ commit: earlier })}\n`;
        if (path === fileOf(earlier)) return stored.get(earlier)(branch, path, options);
        if (path === fileOf(head) && headStored) return stored.get(head)(branch, path, options);
        return null;
      },
      blob: () => null,
    };
  };
  const host = {
    async readSnapshot(ref) {
      calls.push(`readSnapshot ${name(ref)}`);
      if (ref === "main") return snapshotAt(head, "main");
      if (trees.has(ref)) return snapshotAt(ref, ref);
      throw Object.assign(new Error(`${ref} was not found`), { name: "NotFound" });
    },
    async repositoryInfo() { calls.push("repositoryInfo"); return { defaultBranch: "main", visibility: "public", canWrite: true, archived: false, description: "" }; },
    async listTags() { calls.push("listTags"); return []; },
    async readHistory(path) { calls.push(`readHistory ${path}`); return []; },
    async readFileAt(path) { calls.push(`readFileAt ${path}`); return new Map(); },
  };
  return { host, calls, head, earlier };
}

// Mermaid as a recorder, as tests/trace-pages-modules.test.mjs replaces it.
async function render(host, params) {
  const texts = [];
  globalThis.mermaid = { initialize() {}, mermaidAPI: { getDiagramFromText: async () => ({ db: { getVertices: () => ({}) } }) },
    run: async ({ nodes }) => { texts.push(...nodes.map((node) => node.textContent)); } };
  const target = document.createElement("div");
  document.body.append(target);
  try {
    await route.render(target, { product: { address: "https://github.com/acme/library", kind: "github", host } }, params);
  } finally {
    delete globalThis.mermaid;
  }
  return { target, texts };
}
// The calls as counted: each as often as made, in one order.
const counted = (calls) => [...calls].sort();
const hasClass = (node, name) => (node.getAttribute?.("class") ?? "").split(/\s+/).includes(name);
const byClass = (root, name) => find(root, (node) => hasClass(node, name));
const requirementNames = (target) => byClass(target, "requirement-name").map((node) => node.textContent);
const lineOf = (product) => `As of ${product.earlier.slice(0, 7)}: the trace graph of the newest commit, ${product.head.slice(0, 7)}, is being stored. Until then it shows that commit's version, read-only.`;

// TST-trace-pages-earlier-01 · level: component · module: MOD-trace-pages
// guards: A REQUIREMENT SHOWS WHAT TRACES TO IT; UC-020
// given: the head's graph is stored
// input: the specification at main
// expect: the head's three requirements, no earlier line, Edit offered; the calls are exactly the list written out — the snapshot of main, its graph, the SPEC and the group file,
//   no read of latest.json and no snapshot of another commit
test("where the head's graph is stored, the specification shows the head and sends the requests it sent before", async () => {
  const given = product({ headStored: true });
  const { target } = await render(given.host, { key: "specification", ref: "main" });
  await until(() => /that no use case realises/.test(target.textContent));
  assert.deepEqual(requirementNames(target), ["RULE THREE", "RULE ONE", "RULE TWO"]);
  assert.equal(byClass(target, "version-earlier").length, 0);
  assert.equal(byClass(target, "requirement-edit").length, 3);
  assert.deepEqual(counted(given.calls), counted([
    "listTags", "repositoryInfo", "readSnapshot main", "readOn trace-cache <head>.gaps.json", "readOn trace-cache <head>.json.gz", "read head SPEC.md", "read head docs/groups/requirements.md",
  ]));
});

// TST-trace-pages-earlier-02 · level: component · module: MOD-trace-pages
// guards: A REQUIREMENT SHOWS WHAT TRACES TO IT; THE TRACEABILITY MATRIX IS DERIVED; UC-020
// given: the head's graph is not stored; latest.json names the earlier commit, whose graph is stored
// input: the specification at main, then RULE ONE opened
// expect: the earlier commit's two requirements (no RULE THREE), the line naming both commits, the group's count from the earlier graph ("1 that no use case realises":
//   RULE TWO), RULE ONE traced to UC-001 as the earlier commit's use case says; no Edit, + Requirement or Arrange; the calls are those of the stored case with the head's
//   graph missing, then exactly latest.json, the earlier graph, the earlier snapshot, its SPEC and its group file
test("while the head's graph is not stored, the specification shows the earlier commit's whole version, read-only, with the line", async () => {
  const given = product({ headStored: false });
  const { target } = await render(given.host, { key: "specification", ref: "main" });
  await until(() => byClass(target, "version-earlier").length > 0 && /that no use case realises/.test(target.textContent));
  assert.deepEqual(byClass(target, "version-earlier").map((node) => node.textContent), [lineOf(given)]);
  assert.deepEqual(requirementNames(target), ["RULE ONE", "RULE TWO"]);
  assert.match(target.textContent, /2 requirements, 1 that no use case realises/);
  assert.equal(byClass(target, "version-as-of").length, 0);
  for (const name of ["requirement-edit", "requirement-new", "arrange-link", "spec-change-links"]) assert.equal(byClass(target, name).length, 0, name);
  assert.deepEqual(counted(given.calls), counted([
    "listTags", "repositoryInfo", "readSnapshot main", "readOn trace-cache <head>.gaps.json", "readOn trace-cache <head>.json.gz", "read head SPEC.md", "read head docs/groups/requirements.md",
    "readOn trace-cache latest.json", "readOn trace-cache <earlier>.gaps.json", "readOn trace-cache <earlier>.json.gz",
    "readSnapshot earlier", "read earlier SPEC.md", "read earlier docs/groups/requirements.md",
  ]));
  byClass(target, "requirement-name").find((node) => node.textContent === "RULE ONE").dispatchEvent(new Event("click"));
  await until(() => byClass(target, "requirement-trace").length > 0);
  assert.match(byClass(target, "requirement-traces")[0].textContent, /UC-001 Read a book/);
  assert.deepEqual(given.calls.slice(13), ["readMany earlier docs/sources.md", "read earlier docs/sources.md"],
    "opening reads the earlier commit's links to sources, as an opening reads them at any version, and no graph: the earlier one is held");
});

// TST-trace-pages-earlier-03 · level: component · module: MOD-trace-pages
// guards: THE TRACEABILITY MATRIX IS DERIVED; UC-020
// given: as in 02
// input: the gaps at main
// expect: the line; RULE TWO realised by no use case and RULE THREE not listed (the earlier version); the matrix of the earlier SPEC's two requirements
test("while the head's graph is not stored, the gaps show the earlier commit's version with the line", async () => {
  const given = product({ headStored: false });
  const { target } = await render(given.host, { key: "gaps", ref: "main" });
  await until(() => byClass(target, "gaps-matrix").length > 0);
  assert.deepEqual(byClass(target, "version-earlier").map((node) => node.textContent), [lineOf(given)]);
  const unrealised = byClass(target, "gaps-list").find((node) => /Requirements realised by no use case/.test(node.textContent));
  assert.deepEqual(byClass(unrealised, "gap-open").map((node) => node.textContent), ["RULE TWO"]);
  assert.doesNotMatch(target.textContent, /RULE THREE/);
});

// TST-trace-pages-earlier-04 · level: component · module: MOD-trace-pages
// guards: UC-025
// given: as in 02
// input: the modules at main
// expect: the line; the diagram and the table of the earlier commit's one module, MOD-reader (no MOD-writer); no next step (Change the architecture, Implement)
test("while the head's graph is not stored, the modules show the earlier commit's version with the line", async () => {
  const given = product({ headStored: false });
  const { target, texts } = await render(given.host, { key: "modules", ref: "main" });
  assert.deepEqual(byClass(target, "version-earlier").map((node) => node.textContent), [lineOf(given)]);
  assert.deepEqual(byClass(target, "module-row").map((node) => node.getAttribute("data-module")), ["MOD-reader"]);
  assert.equal(texts.length, 1);
  assert.doesNotMatch(texts[0], /MOD-writer/);
  assert.equal(byClass(target, "gap-implement").length + byClass(target, "gap-change-architecture").length, 0);
});

// TST-trace-pages-earlier-05 · level: component · module: MOD-trace-pages
// guards: UC-025
// given: the head's graph is stored (known positive: 04 shows the earlier version where it is not)
// input: the modules at main
// expect: the head's two modules, no line, and the calls of today: the snapshot, the head's graph, the module files in one batch, then each read, and the default branch
test("where the head's graph is stored, the modules show the head and send the requests they sent before", async () => {
  const given = product({ headStored: true });
  const { target } = await render(given.host, { key: "modules", ref: "main" });
  assert.deepEqual(byClass(target, "module-row").map((node) => node.getAttribute("data-module")), ["MOD-reader", "MOD-writer"]);
  assert.equal(byClass(target, "version-earlier").length, 0);
  assert.deepEqual(counted(given.calls), counted([
    "readSnapshot main", "readOn trace-cache <head>.json.gz", "readMany head docs/architecture/MOD-reader.md, docs/architecture/MOD-writer.md",
    "read head docs/architecture/MOD-reader.md", "read head docs/architecture/MOD-writer.md", "repositoryInfo",
  ]));
});

// TST-trace-pages-earlier-06 · level: component · module: MOD-trace-pages
// guards: AN UNGROUPED ITEM IS SHOWN AT THE TOP LEVEL; UC-021
// given: the head's graph is stored; the head's group file names RULE ONE and RULE TWO in the group Rules and RULE THREE nowhere
// input: the specification at main
// expect: RULE THREE at the top level, its row marked "not yet placed"; RULE ONE and RULE TWO unmarked (known positive of the absence: they are in the tree, in their group)
test("a requirement no group names is shown at the top level, marked not yet placed", async () => {
  const given = product({ headStored: true });
  const { target } = await render(given.host, { key: "specification", ref: "main" });
  const marked = byClass(target, "requirement-unplaced");
  assert.deepEqual(marked.map((node) => node.textContent), ["not yet placed"]);
  const rowOf = (name) => byClass(target, "requirement-name").find((node) => node.textContent === name).parentNode;
  assert.ok(rowOf("RULE THREE").childNodes.includes(marked[0]));
  for (const name of ["RULE ONE", "RULE TWO"]) assert.equal(byClass(rowOf(name), "requirement-unplaced").length, 0, name);
  assert.equal(byClass(target, "spec-group").length, 1);
});
