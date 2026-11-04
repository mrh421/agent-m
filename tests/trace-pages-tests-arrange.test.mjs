// MOD-trace-pages' tests view leads to the review pages' arranging (ITM-1356, finding UC021-F1 of TST-738003), as the accepted text of docs/architecture/MOD-trace-pages.md states it:
// "Editing, the draft of a change asked for in the prompt bar, and arranging are the review pages' routes, which its links lead to"; at a release tag, or while the view shows an earlier
// commit's version, "nothing that writes or leads to writing is offered — no *Edit*, *+ Requirement*, *Arrange*". MOD-review-pages gives the route `arrange/<group kind>` for tests too;
// UC-021 step 1: "in the list of use cases, architecture elements, modules or tests, the author presses **Arrange**."
// Run: node --test tests/trace-pages-tests-arrange.test.mjs
//
// Module: MOD-trace-pages
// Guards: ARTIFACTS ARE ARRANGED IN NESTED GROUPS; UC-021
// Level: unit
//
// The route is called through its public Route.render with the key "tests", over the Host fake of tests/trace-pages-harness.mjs (it has no write method), for a product whose address is
// ADDRESS. Readings the cases take, each from the sentence quoted:
//   - "the product kept in the address as the review pages keep it" (ITM-1356): the link ends in `/product=` and the product's address percent-encoded, the form MOD-site-frame's
//     `menuOf` writes and `chosenProduct` reads back; the link is `#arrange/kind=tests/product=<address>`.
//   - "At the default branch's head" (ITM-1356): the version shown is the default branch the Host's repositoryInfo names. A release tag, any other ref, and a Host that cannot name its
//     default branch are not it, and offer no link (as the specification view reads it, tests/trace-pages-edit-links.test.mjs).
//   - "while it shows an earlier commit's version" (MOD-trace-pages): the tests view reads no trace graph, so it never shows an earlier commit in place of the head; a commit given as the
//     ref is the nearest case a public route reaches, and it is not the default branch.
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { doc, document, find, treeHost, addressParts } from "./trace-pages-harness.mjs";

const { view } = await import("../src/trace-pages/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "trace");

const ADDRESS = "https://github.com/acme/product";
const SPEC = ["# Arrange fixture — Specification", "", "## Only section", "", "**ALPHA RULE** *(Vibe Coding)*", "Alpha rule.", "*Check:* at review.", ""].join("\n");
const TESTS = [
  "// TST-501 · level: unit · module: MOD-direct", "// guards: ALPHA RULE", "// given: a fixture", "// input: a call", "// expect: a result", `test("alpha holds", () => {});`, "",
].join("\n");
const FILES = {
  "SPEC.md": SPEC,
  "docs/use-cases/UC-001-first.md": doc("UC-001", "First use case", { realises: ["ALPHA RULE"] }),
  "docs/architecture/MOD-direct.md": doc("MOD-direct", "Direct module", { folder: "src/direct/", realises: ["ALPHA RULE"] }),
  "tests/alpha.test.mjs": TESTS,
};
const COMMIT = "0123456789abcdef0123456789abcdef01234567";

// A Host whose trees hold the fixture at main, trunk, the tag v2026.1.0 and the commit; `info` false leaves it unable to name its default branch.
function hostOf({ defaultBranch = "main", info = true } = {}) {
  const trees = { main: FILES, trunk: FILES, "v2026.1.0": FILES, [COMMIT]: FILES, "test-results": {} };
  const base = treeHost({ trees, tags: ["v2026.1.0"] });
  const fake = { ...base };
  if (info) fake.repositoryInfo = async () => ({ defaultBranch, visibility: "public", canWrite: false, archived: false, description: "" });
  else delete fake.repositoryInfo;
  return fake;
}
async function render(productHost, params) {
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, { product: { address: ADDRESS, host: productHost } }, params);
  return target;
}
const anchors = (root) => find(root, (node) => node.localName === "a");
const arranges = (root) => anchors(root).filter((node) => node.textContent === "Arrange");
const listed = (root) => find(root, (node) => String(node.className).split(" ").includes("tests-id")).map((node) => node.textContent);

// TST-1356001 · level: unit · module: MOD-trace-pages
// guards: ARTIFACTS ARE ARRANGED IN NESTED GROUPS; UC-021
// given: the fixture product, whose default branch is main, with its test TST-501; the specification view at main offers Arrange (known positive: the tool finds an Arrange where one is drawn)
// input: Route.render with the key "tests" at main
// expect: the test TST-501 is listed; exactly one Arrange, a plain anchor of the class arrange-link whose href is #arrange/kind=tests/product=https%3A%2F%2Fgithub.com%2Facme%2Fproduct, which reads back as the route arrange with kind tests and the product's address
test("TST-1356001: the tests view at the default branch offers Arrange, which leads to arrange/tests with the product kept", async () => {
  const positive = await render(hostOf(), { key: "specification", ref: "main" });
  assert.equal(arranges(positive).length, 1, "known positive: the specification view offers one Arrange");
  const target = await render(hostOf(), { key: "tests", ref: "main" });
  assert.deepEqual(listed(target), ["TST-501"], "the tests are listed");
  const offered = arranges(target);
  assert.equal(offered.length, 1, "one Arrange");
  assert.equal(offered[0].className, "arrange-link");
  assert.equal(offered[0].getAttribute("href"), `#arrange/kind=tests/product=${encodeURIComponent(ADDRESS)}`);
  assert.deepEqual(addressParts(offered[0].getAttribute("href")), { route: "arrange", params: { kind: "tests", product: ADDRESS } });
});

// TST-1356002 · level: unit · module: MOD-trace-pages
// guards: ARTIFACTS ARE ARRANGED IN NESTED GROUPS; UC-021
// given: the same product; the tests view at main shown to offer Arrange first; the tag v2026.1.0 and a commit of forty digits, neither the default branch
// input: Route.render with the key "tests" at the tag and at the commit
// expect: the test TST-501 is listed at each, and neither offers an Arrange
test("TST-1356002: the tests view offers no Arrange at a release tag or at a commit", async () => {
  assert.equal(arranges(await render(hostOf(), { key: "tests", ref: "main" })).length, 1, "known positive: main offers Arrange");
  for (const ref of ["v2026.1.0", COMMIT]) {
    const target = await render(hostOf(), { key: "tests", ref });
    assert.deepEqual(listed(target), ["TST-501"], `${ref}: the tests are listed`);
    assert.deepEqual(arranges(target).map((node) => node.getAttribute("href")), [], ref);
  }
});

// TST-1356003 · level: unit · module: MOD-trace-pages
// guards: ARTIFACTS ARE ARRANGED IN NESTED GROUPS; UC-021
// given: a Host whose default branch is trunk; one whose repositoryInfo is missing, so it cannot name its default branch
// input: Route.render with the key "tests" at trunk and at main on the first; at main on the second
// expect: Arrange at trunk (the Host's default branch, not a name assumed) and none at main on the first; none on the second, whose tests are still listed
test("TST-1356003: the default branch is the Host's own, and a Host that cannot name it offers no Arrange", async () => {
  const trunk = hostOf({ defaultBranch: "trunk" });
  assert.equal(arranges(await render(trunk, { key: "tests", ref: "trunk" })).length, 1, "known positive: trunk is the default branch");
  assert.deepEqual(arranges(await render(trunk, { key: "tests", ref: "main" })).map((node) => node.getAttribute("href")), []);
  const unknown = await render(hostOf({ info: false }), { key: "tests", ref: "main" });
  assert.deepEqual(listed(unknown), ["TST-501"], "the tests are listed");
  assert.deepEqual(arranges(unknown).map((node) => node.getAttribute("href")), []);
});
