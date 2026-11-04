// Release test of ITM-1261 — a product stores its trace graph for each commit of its default branch. Written from the SPEC's A REQUIREMENT SHOWS WHAT TRACES TO IT ("For each requirement, the browser lists its sources and every use case, architecture element, module and test that names it, as derived from the version shown"), from UC-020 step 5 (the reader opens a requirement and the browser shows what traces to it) and from ITM-1261's Outcome (a product's trace pages end in GraphNotStored because no file Agent M writes into a product runs onMainChanged).
// Run: node --test tests/release-itm-1261-requirement-traces.test.mjs
//
// Module: MOD-trace-pages
// Guards: A REQUIREMENT SHOWS WHAT TRACES TO IT
// Level: release
//
// Written for the release testing of sprint team1/136 by a participant who implemented none of ITM-1261 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The behaviour is reached as the existing tests reach it: the entry onMainChanged runs in a temporary git repository of a product (tests/workflow-entries-main-changed-product.test.mjs, through tests/release-itm-1261-product-run.mjs), and the page is MOD-trace-pages' route `trace` with key specification, drawn with tests/trace-pages-harness.mjs' document and a Host whose snapshot serves, as its readOn, the file the entry stored on the product's trace-cache (as tests/trace-pages-graph-not-stored-step.test.mjs opens a requirement). Nothing reaches the network.

import test from "node:test";
import assert from "node:assert/strict";
import { doc, document, find, treeHost, until } from "./trace-pages-harness.mjs";
import { runInProduct } from "./release-itm-1261-product-run.mjs";

const { view } = await import("../src/trace-pages/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "trace");

const SPEC = ["# Library — Specification", "", "## Only section", "", "**A THING IS DONE** *(Product Owner)*", "It is done.", "*Check:* `tests/thing.test.mjs`", ""].join("\n");
const TEST = "// Module: MOD-thing\n// Guards: A THING IS DONE\n// Level: unit\n\n// TST-501 · level: unit · module: MOD-thing\n// guards: A THING IS DONE\n// given: a thing\n// input: do it\n// expect: it is done\ntest(\"the thing is done\", () => {});\n";
const FILES = { "SPEC.md": SPEC, "tests/thing.test.mjs": TEST, "docs/use-cases/UC-001-do-it.md": doc("UC-001", "Do it", { realises: ["A THING IS DONE"] }) };

// The page of the specification at main, A THING IS DONE opened, once the page has read what traces to it. `graph` is the file on the product's trace-cache for `commit`, or none.
async function opened(graph, commit) {
  const base = treeHost({ trees: { main: FILES }, stored: () => false });
  const host = { ...base, async readSnapshot(ref, options) {
    const snapshot = await base.readSnapshot(ref, options);
    return { ...snapshot, commit, async readOn(branch, path, how) { return graph && branch === "trace-cache" && path === `${commit}.json.gz` && how?.bytes ? graph : null; } };
  } };
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, { instance: { host }, product: { host: { ...host } } }, { key: "specification", ref: "main" });
  find(target, (node) => node.localName === "button" && node.textContent === "A THING IS DONE")[0].dispatchEvent(new Event("click"));
  await until(() => find(target, (node) => node.className === "traces-problem").length > 0 || /UC-001/.test(target.textContent));
  return { text: target.textContent, problems: find(target, (node) => node.className === "traces-problem").map((node) => node.textContent) };
}

// TST-1261401 · level: release · module: system
// guards: A REQUIREMENT SHOWS WHAT TRACES TO IT
// given: a product alice/library whose main holds the requirement A THING IS DONE, the use case UC-001 that realises it and a test file that guards it, and whose branch trace-cache holds only its first commit
// input: the workflow's onMainChanged run in the product; then the specification page at main, A THING IS DONE opened, over the file the run stored on trace-cache for main's commit; and, as the known positive that the page reports a missing graph, the same page over a commit whose graph is not stored
// expect: the run's outcome is `done`; the opened requirement lists the use case UC-001 and the test TST-501 and shows no line of the kind "could not be read"; the page over the commit with no stored graph shows the line "What traces to this requirement could not be read: …", the trace graph of that commit "is not stored yet"
// Planted fault: onMainChanged in a product not adding the graph (src/workflow-entries/main-changed.mjs, `publishGraph` skipped when `inProduct`) fails the case on "no line of the kind 'could not be read'".
test("TST-1261401 after onMainChanged ran in a product, its requirement lists the use case and the test that name it", async () => {
  const run = await runInProduct(FILES);
  assert.equal(run.outcome, "done", `the run stored the graph: ${run.summary}`);
  const shown = await opened(run.graph, run.head);
  assert.deepEqual(shown.problems, [], "no line of the kind 'could not be read'");
  assert.match(shown.text, /UC-001/, "the use case that names the requirement");
  assert.match(shown.text, /TST-501/, "the test that guards it");
  const missing = await opened(null, "e".repeat(40));
  assert.equal(missing.problems.length, 1, "known positive: the page reports a graph that is not stored");
  assert.match(missing.problems[0], /^What traces to this requirement could not be read: .*the trace graph of eeeeeeeeeeee is not stored yet/);
});
