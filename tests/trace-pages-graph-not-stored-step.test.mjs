// A product's trace page whose graph is not stored yet says how to get it stored (ITM-1261): the file that runs onMainChanged in a product is written by
// Install on its Settings page (MOD-runtimes' jobWorkflowFiles), so where the page shows a GraphNotStored on a product's page it adds the step
// "This product's graph is not stored yet: press Install on its Settings page."; on the instance's own page, whose workflow "main changed" stores its graph,
// GraphNotStored's line stands alone, as before.
//
// Run: node --test tests/trace-pages-graph-not-stored-step.test.mjs
//
// Module: MOD-trace-pages
// Guards: UC-020; A REQUIREMENT SHOWS WHAT TRACES TO IT
// Level: unit
//
// The route is called through its public Route.render with the Host/Snapshot-shaped fake of tests/trace-pages-harness.mjs, whose trace-cache holds no graph
// (`stored` false). The instance's page is given in the two contexts the dashboard hands the route: on #trace, a product whose address is the instance's
// repository on github.com; on #spec and #arc (dashboard-app.mjs' renderSpecification and renderComponents), `{ instance: { host }, product: { host } }`
// with no address, the product's host being the instance's own where the instance is shown. Readings taken: the
// step is the Acceptance's wording, written as plain text, as the pages name a button ("press Check again"); it stands on the gaps view as on every view that
// draws from the graph. Each case states its expected texts; none is read from a document. Nothing reaches the network.

import test from "node:test";
import assert from "node:assert/strict";
import { doc, document, find, treeHost, until } from "./trace-pages-harness.mjs";

const { view } = await import("../src/trace-pages/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "trace");

const SPEC = ["# Fixture — Specification", "", "## Only section", "", "**ALPHA RULE** *(Vibe Coding)*", "Alpha rule.", "*Check:* at review.", ""].join("\n");
const filesOf = (name) => ({ "SPEC.md": SPEC, "docs/use-cases/UC-001-first.md": doc("UC-001", `First use case of ${name}`, { realises: ["ALPHA RULE"] }) });
// A host of its own for each page, so that no two share a commit, and none whose trace-cache holds a graph.
const notStored = (name) => treeHost({ trees: { main: filesOf(name) }, stored: () => false });

async function gapsOf(context) {
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, context, { key: "gaps", ref: "main" });
  return {
    problems: find(target, (node) => node.className === "traces-problem").map((node) => node.textContent),
    steps: find(target, (node) => node.className === "graph-not-stored-step").map((node) => node.textContent),
  };
}
const LINE = /^The gaps could not be read: the trace graph of [0-9a-f]{12} is not stored yet — the workflow "main changed" builds it on every push to the default branch/;
const STEP = "This product's graph is not stored yet: press Install on its Settings page.";

// TST-1261301 · level: unit · module: MOD-trace-pages
// guards: UC-020; A REQUIREMENT SHOWS WHAT TRACES TO IT
// given: the gaps view of a product, acme/library on github.com, shown from the instance alice/agent-m, whose branch trace-cache holds no graph of main's commit
// input: the route trace with key gaps at main
// expect: the page shows GraphNotStored's line, "The gaps could not be read: the trace graph of <commit, 12 characters> is not stored yet — the workflow "main changed" builds it on every push to the default branch …", and after it the one line "This product's graph is not stored yet: press Install on its Settings page."
test("a product's page whose graph is not stored shows GraphNotStored's line and the step: press Install on its Settings page", async () => {
  const host = notStored("product");
  const { problems, steps } = await gapsOf({ instance: { repository: "alice/agent-m", host: notStored("instance-for-product") },
    product: { address: "https://github.com/acme/library", host } });
  assert.equal(problems.length, 1);
  assert.match(problems[0], LINE);
  assert.deepEqual(steps, [STEP]);
});

// TST-1261302 · level: unit · module: MOD-trace-pages
// guards: UC-020; A REQUIREMENT SHOWS WHAT TRACES TO IT
// given: the gaps view of the instance itself, alice/agent-m, whose product is the instance's repository on github.com, as the dashboard gives it, and whose branch trace-cache holds no graph of main's commit
// input: the route trace with key gaps at main
// expect: the page shows GraphNotStored's line alone, naming the workflow "main changed", and no line "This product's graph is not stored yet: …"
test("the instance's own page whose graph is not stored shows GraphNotStored's line alone", async () => {
  const host = notStored("instance");
  const { problems, steps } = await gapsOf({ instance: { repository: "alice/agent-m", host }, product: { address: "https://github.com/alice/agent-m", host } });
  assert.equal(problems.length, 1);
  assert.match(problems[0], LINE);
  assert.deepEqual(steps, []);
});

// The context the dashboard hands the route on #spec and #arc: the instance's host, and the product's — the instance's own where the instance is shown.
const reviewContext = (instanceHost, productHost) => ({ instance: { host: instanceHost }, product: { host: productHost } });
const stepsIn = (target) => find(target, (node) => node.className === "graph-not-stored-step").map((node) => node.textContent);
async function modulesOf(context) {
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, context, { key: "modules", ref: "main" });
  return { problems: find(target, (node) => node.className === "traces-problem").map((node) => node.textContent), steps: stepsIn(target) };
}
// The specification at main, with ALPHA RULE opened, once what traces to it has been read.
async function openedOf(context) {
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, context, { key: "specification", ref: "main" });
  find(target, (node) => node.localName === "button" && node.textContent === "ALPHA RULE")[0].dispatchEvent(new Event("click"));
  await until(() => find(target, (node) => node.className === "traces-problem").length > 0);
  return { problems: find(target, (node) => node.className === "traces-problem").map((node) => node.textContent), steps: stepsIn(target) };
}

// TST-1261303 · level: unit · module: MOD-trace-pages
// guards: UC-020; UC-025
// given: the modules view as #arc draws it under the architecture — the context { instance: { host }, product: { host } } — of the instance itself, the product's host being the instance's own, whose trace-cache holds no graph of main's commit; and, as the counter-proof, the same context of a product, whose host is another than the instance's
// input: the route trace with key modules at main, in each context
// expect: the instance's page shows "The modules could not be read: the trace graph of <commit> is not stored yet — the workflow "main changed" builds it …" alone, with no Install line; counter-proof: the product's page shows that line and "This product's graph is not stored yet: press Install on its Settings page."
test("#arc of the instance itself shows GraphNotStored's line alone; of a product, the line and the step", async () => {
  const instanceHost = notStored("arc-instance");
  const own = await modulesOf(reviewContext(instanceHost, instanceHost));
  assert.equal(own.problems.length, 1);
  assert.match(own.problems[0], /^The modules could not be read: the trace graph of [0-9a-f]{12} is not stored yet — the workflow "main changed" builds it/);
  assert.deepEqual(own.steps, []);

  const product = await modulesOf(reviewContext(notStored("arc-instance-of-product"), notStored("arc-product")));
  assert.equal(product.problems.length, 1, "counter-proof: the product's page shows the line");
  assert.deepEqual(product.steps, [STEP], "counter-proof: the product's page shows the step");
});

// TST-1261304 · level: unit · module: MOD-trace-pages
// guards: UC-020; A REQUIREMENT SHOWS WHAT TRACES TO IT
// given: the specification as #spec draws it under the open SPEC changes — the context { instance: { host }, product: { host } } — of the instance itself, whose trace-cache holds no graph of main's commit; and, as the counter-proof, the same context of a product, whose host is another than the instance's
// input: the route trace with key specification at main, then a click on ALPHA RULE, in each context
// expect: the opened requirement of the instance says "What traces to this requirement could not be read: …" with GraphNotStored's line, naming the workflow "main changed", and no Install line; counter-proof: the product's opened requirement shows that and "This product's graph is not stored yet: press Install on its Settings page."
test("#spec of the instance itself shows GraphNotStored's line alone under an opened requirement; of a product, the line and the step", async () => {
  const instanceHost = notStored("spec-instance");
  const own = await openedOf(reviewContext(instanceHost, instanceHost));
  assert.equal(own.problems.length, 1);
  assert.match(own.problems[0], /^What traces to this requirement could not be read: .*the trace graph of [0-9a-f]{12} is not stored yet — the workflow "main changed" builds it/);
  assert.deepEqual(own.steps, []);

  const product = await openedOf(reviewContext(notStored("spec-instance-of-product"), notStored("spec-product")));
  assert.equal(product.problems.length, 1, "counter-proof: the product's opened requirement shows the line");
  assert.deepEqual(product.steps, [STEP], "counter-proof: the product's page shows the step");
});
