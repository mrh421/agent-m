// Two versions compared in the specification and the gaps (ITM-600, UC-020 1b): "The reader picks a second version; the tree marks requirements added,
// changed and removed between them, and a changed one opens with the difference. On **Gaps**, it marks what became covered and what lost its coverage in
// between." MOD-trace-pages' route, drawn through its public Route.render, with the comparison MOD-trace-graph's compareGraphs gives.
//
// Run: node --test tests/trace-pages-version-compare.test.mjs
//
// Module: MOD-trace-pages
// Guards: UC-020; THE BROWSER SHOWS ANY RELEASED VERSION; UNREALISED REQUIREMENTS ARE REPORTED, NOT FORBIDDEN
// Level: component
//
// The Host is the trace pages' fake (tests/trace-pages-harness.mjs): the trees of main, the default branch, and of the tags v2026.1.0 and v2025.0.1, each
// commit's graph stored on trace-cache but v2025.0.1's. Each case states its expected texts; none is read from a document. Readings the cases take, each
// from the text quoted:
// - "a second choice in the version bar, a control of its own class `version-compare`, offered on the specification and the gaps only" (ITM-600,
//   Acceptance): a select `version-compare`, labelled "Compare with", offering "none" first and then every other version of the version choice, in its
//   order and with its labels; where the choice offers one version alone, nothing to compare with is offered;
// - "Nothing is read for the comparison before a second version is picked" (ITM-600, Acceptance): neither the second version's snapshot nor its graph;
// - the older of the two versions is the one that stands later among the tags, which are newest first, as the tests view's comparison of two releases
//   takes it (UC-029 step 6), and the default branch, which no tag names, is newer than every tag;
// - "a version whose commit has none stored ... is named with `GraphNotStored`, never built" (ITM-600, Outcome): the comparison says it could not be read,
//   with storedGraph's message for that commit, and draws no list;
// - what the comparison shows stands under "Compared with <version>": on the specification three lists, Added, Changed and Removed, and in the tree a mark
//   "added", "changed" or "removed" beside each requirement it names; on the gaps two lists, "Became covered" and "Lost its coverage", one line
//   "<requirement> — by <artifact>" each. "Opens with the difference": a changed requirement opened in the tree shows, below its fields, the difference of
//   its three fields — "Source: …", "Rule: …", "Check: …", one line each — from the older version to the newer.

import test from "node:test";
import assert from "node:assert/strict";
import { doc, document, find, treeHost, until } from "./trace-pages-harness.mjs";

const { view } = await import("../src/trace-pages/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "trace");

const requirement = (name, source, rule) => [`**${name}** *(${source})*`, rule, "*Check:* at review.", ""];
const spec = (...requirements) => ["# Compare fixture — Specification", "", "## Section", "", ...requirements.flat()].join("\n");
const testFile = (guards) => ["// TST-601 · level: unit · module: MOD-direct", `// guards: ${guards}`, "// given: a fixture", "// input: none", "// expect: nothing", ""].join("\n");
const MODULE = doc("MOD-direct", "Direct module", { folder: "src/direct/" });

// main: ALPHA RULE with a second item of its source, BETA RULE and GAMMA RULE; UC-001 realises ALPHA RULE, UC-002 GAMMA RULE, TST-601 guards BETA RULE.
const MAIN = {
  "SPEC.md": spec(requirement("ALPHA RULE", "Vibe Coding; PO A. Maier", "Alpha rule."), requirement("BETA RULE", "Vibe Coding", "Beta rule."),
    requirement("GAMMA RULE", "Vibe Coding", "Gamma rule.")),
  "docs/use-cases/UC-001-first.md": doc("UC-001", "First use case", { realises: ["ALPHA RULE"] }),
  "docs/use-cases/UC-002-second.md": doc("UC-002", "Second use case", { realises: ["GAMMA RULE"] }),
  "docs/architecture/MOD-direct.md": MODULE,
  "tests/direct.test.mjs": testFile("BETA RULE"),
};
// v2026.1.0: ALPHA RULE with one item of its source, BETA RULE and DELTA RULE; UC-001 realises ALPHA RULE and DELTA RULE, TST-601 guards ALPHA RULE.
const TAGGED = {
  "SPEC.md": spec(requirement("ALPHA RULE", "Vibe Coding", "Alpha rule."), requirement("BETA RULE", "Vibe Coding", "Beta rule."),
    requirement("DELTA RULE", "Vibe Coding", "Delta rule.")),
  "docs/use-cases/UC-001-first.md": doc("UC-001", "First use case", { realises: ["ALPHA RULE", "DELTA RULE"] }),
  "docs/architecture/MOD-direct.md": MODULE,
  "tests/direct.test.mjs": testFile("ALPHA RULE"),
};
const UNSTORED = "v2025.0.1";
const ADDRESS = "https://github.com/acme/library";

const hostOf = (extra = {}) => treeHost({ trees: { main: MAIN, "v2026.1.0": TAGGED, [UNSTORED]: TAGGED }, tags: ["v2026.1.0", UNSTORED], stored: (ref) => ref !== UNSTORED, ...extra });
function render(productHost, params) {
  const target = document.createElement("div");
  document.body.append(target);
  return route.render(target, { product: { address: ADDRESS, host: productHost } }, params).then(() => target);
}
const withClass = (root, name) => find(root, (node) => node.className.split(" ").includes(name));
const compareOf = (target) => find(target, (node) => node.localName === "select" && node.className === "version-compare");
const optionsOf = (select) => find(select, (node) => node.localName === "option").map((node) => [node.value, node.textContent]);
const compareWith = (target, ref) => { const [select] = compareOf(target); select.value = ref; select.dispatchEvent(new Event("change")); };
const lists = (target) => Object.fromEntries(withClass(target, "version-compared-list").map((section) =>
  [find(section, (node) => node.localName === "h4")[0].textContent, find(section, (node) => node.localName === "li").map((node) => node.textContent)]));
const heading = (target) => withClass(target, "version-compared").flatMap((box) => find(box, (node) => node.localName === "h3")).map((node) => node.textContent);
const marks = (target) => withClass(target, "requirement-compared").map((node) => [node.parentNode.firstChild.textContent, node.textContent]);
const settled = (target) => until(() => heading(target).length > 0 || withClass(target, "version-compared-problem").length > 0);
const readFor = (productHost, ref) => ({
  snapshots: productHost.log.snapshots.filter((asked) => asked === ref).length,
  graphs: productHost.log.readOns.filter(([branch, path]) => branch === "trace-cache" && path.startsWith(productHost.commitOf(ref))).length,
});

// TST-600411 · level: component · module: MOD-trace-pages
// guards: UC-020; THE BROWSER SHOWS ANY RELEASED VERSION
// given: the specification at main, the default branch, with the tags v2026.1.0 and v2025.0.1; v2026.1.0 holds ALPHA RULE with the one source item "Vibe Coding", BETA RULE and DELTA RULE, main ALPHA RULE with "Vibe Coding; PO A. Maier", BETA RULE and GAMMA RULE
// input: Route.render with the key "specification" at main; then "Compare with" set to v2026.1.0; then ALPHA RULE and BETA RULE opened in the tree
// expect: the bar holds one version-choice and one version-compare, the latter offering none, v2026.1.0 and v2025.0.1 with none selected; before the pick neither the snapshot nor the graph of v2026.1.0 is read; after it, under "Compared with v2026.1.0", Added ["GAMMA RULE"], Changed ["ALPHA RULE"], Removed ["DELTA RULE"]; the tree marks ALPHA RULE "changed" and GAMMA RULE "added"; opened ALPHA RULE shows the difference with the removed line "- Source: Vibe Coding" and the added line "+ Source: Vibe Coding; PO A. Maier"; opened BETA RULE shows no difference
test("TST-600411: the specification compares two versions: the requirements added, changed and removed, marked in the tree, a changed one opening with its difference", async () => {
  const productHost = hostOf();
  const target = await render(productHost, { key: "specification", ref: "main" });
  assert.equal(withClass(target, "version-choice").length, 1);
  const [select] = compareOf(target);
  assert.deepEqual(optionsOf(select), [["none", "none"], ["v2026.1.0", "v2026.1.0"], [UNSTORED, UNSTORED]]);
  assert.equal(select.value, "none");
  assert.equal(select.parentNode.textContent.startsWith("Compare with "), true);
  assert.deepEqual(readFor(productHost, "v2026.1.0"), { snapshots: 0, graphs: 0 }, "nothing is read for the comparison before a second version is picked");
  assert.deepEqual(heading(target), []);
  compareWith(target, "v2026.1.0");
  await settled(target);
  assert.deepEqual(heading(target), ["Compared with v2026.1.0"]);
  assert.deepEqual(lists(target), { Added: ["GAMMA RULE"], Changed: ["ALPHA RULE"], Removed: ["DELTA RULE"] });
  assert.deepEqual(marks(target), [["ALPHA RULE", "changed"], ["GAMMA RULE", "added"]]);
  const open = (name) => find(target, (node) => node.localName === "button" && node.className.includes("requirement-name") && node.textContent === name)[0].dispatchEvent(new Event("click"));
  open("ALPHA RULE");
  open("BETA RULE");
  await until(() => withClass(target, "requirement-difference").some((box) => find(box, (node) => node.localName === "pre").length));
  const differences = withClass(target, "requirement-difference");
  assert.equal(differences.length, 1, "only the changed requirement opens with a difference");
  const lines = (className) => withClass(differences[0], className).map((node) => node.textContent);
  assert.deepEqual(lines("ddel"), ["- Source: Vibe Coding"]);
  assert.deepEqual(lines("dadd"), ["+ Source: Vibe Coding; PO A. Maier"]);
});

// TST-600412 · level: component · module: MOD-trace-pages
// guards: UC-020; THE BROWSER SHOWS ANY RELEASED VERSION
// given: the same product with a newer tag v2026.2.0 whose tree is main's, the tags named v2026.2.0, v2026.1.0, v2025.0.1; the specification drawn at the tag v2026.1.0, the older of v2026.1.0 and v2026.2.0
// input: Route.render with the key "specification" at v2026.1.0; then "Compare with" set to v2026.2.0
// expect: version-compare offers none, v2026.2.0 and v2025.0.1; under "Compared with v2026.2.0", Added ["GAMMA RULE"], Changed ["ALPHA RULE"], Removed ["DELTA RULE"]; the tree of v2026.1.0 marks ALPHA RULE "changed" and DELTA RULE "removed"
test("TST-600412: at a release tag the comparison with a newer tag takes the tag drawn as the older version", async () => {
  const productHost = treeHost({ trees: { main: MAIN, "v2026.2.0": MAIN, "v2026.1.0": TAGGED, [UNSTORED]: TAGGED }, tags: ["v2026.2.0", "v2026.1.0", UNSTORED],
    stored: (ref) => ref !== UNSTORED });
  const target = await render(productHost, { key: "specification", ref: "v2026.1.0" });
  assert.deepEqual(optionsOf(compareOf(target)[0]), [["none", "none"], ["v2026.2.0", "v2026.2.0"], [UNSTORED, UNSTORED]]);
  compareWith(target, "v2026.2.0");
  await settled(target);
  assert.deepEqual(heading(target), ["Compared with v2026.2.0"]);
  assert.deepEqual(lists(target), { Added: ["GAMMA RULE"], Changed: ["ALPHA RULE"], Removed: ["DELTA RULE"] });
  assert.deepEqual(marks(target), [["ALPHA RULE", "changed"], ["DELTA RULE", "removed"]]);
});

// TST-600413 · level: component · module: MOD-trace-pages
// guards: UC-020; UNREALISED REQUIREMENTS ARE REPORTED, NOT FORBIDDEN
// given: the gaps at main; at v2026.1.0 UC-001 realises ALPHA RULE and DELTA RULE and TST-601 guards ALPHA RULE, at main UC-001 realises ALPHA RULE, UC-002 GAMMA RULE and TST-601 guards BETA RULE
// input: Route.render with the key "gaps" at main; then "Compare with" set to v2026.1.0
// expect: the bar holds one version-choice and one version-compare offering none, v2026.1.0 and v2025.0.1; before the pick nothing of v2026.1.0 is read; after it, under "Compared with v2026.1.0", "Became covered" ["BETA RULE — by TST-601", "GAMMA RULE — by UC-002"] and "Lost its coverage" ["ALPHA RULE — by TST-601", "DELTA RULE — by UC-001"]
test("TST-600413: the gaps compare two versions: what became covered and what lost its coverage", async () => {
  const productHost = hostOf();
  const target = await render(productHost, { key: "gaps", ref: "main" });
  assert.equal(withClass(target, "version-choice").length, 1);
  assert.deepEqual(optionsOf(compareOf(target)[0]), [["none", "none"], ["v2026.1.0", "v2026.1.0"], [UNSTORED, UNSTORED]]);
  assert.deepEqual(readFor(productHost, "v2026.1.0"), { snapshots: 0, graphs: 0 }, "nothing is read for the comparison before a second version is picked");
  compareWith(target, "v2026.1.0");
  await settled(target);
  assert.deepEqual(heading(target), ["Compared with v2026.1.0"]);
  assert.deepEqual(lists(target), { "Became covered": ["BETA RULE — by TST-601", "GAMMA RULE — by UC-002"],
    "Lost its coverage": ["ALPHA RULE — by TST-601", "DELTA RULE — by UC-001"] });
});

// TST-600414 · level: component · module: MOD-trace-pages
// guards: UC-020; THE BROWSER SHOWS ANY RELEASED VERSION
// given: the specification at main; the graph of v2025.0.1's commit is not stored on trace-cache; known positive: the graph of v2026.1.0 is
// input: Route.render with the key "specification" at main; then "Compare with" set to v2025.0.1, then to v2026.1.0
// expect: for v2025.0.1 one line "The comparison with v2025.0.1 could not be read: the trace graph of <its commit, 12 characters> is not stored yet — the workflow "main changed" builds it on every push to the default branch; reload once its run has finished", no list and no mark; for v2026.1.0 the lists Added, Changed and Removed and no such line
test("TST-600414: a second version whose graph is not stored is named, and nothing is compared", async () => {
  const productHost = hostOf();
  const target = await render(productHost, { key: "specification", ref: "main" });
  compareWith(target, UNSTORED);
  await settled(target);
  assert.deepEqual(withClass(target, "version-compared-problem").map((node) => node.textContent), [`The comparison with ${UNSTORED} could not be read: the trace graph of `
    + `${productHost.commitOf(UNSTORED).slice(0, 12)} is not stored yet — the workflow "main changed" builds it on every push to the default branch; reload once its run has finished`]);
  assert.deepEqual(lists(target), {});
  assert.deepEqual(marks(target), []);
  compareWith(target, "v2026.1.0");
  await until(() => heading(target).length > 0);
  assert.deepEqual(Object.keys(lists(target)), ["Added", "Changed", "Removed"], "known positive: a stored graph is compared");
  assert.deepEqual(withClass(target, "version-compared-problem"), []);
});

// TST-600415 · level: component · module: MOD-trace-pages
// guards: UC-020; THE BROWSER SHOWS ANY RELEASED VERSION
// given: the same product without a release tag, and with its tags; known positive: with its tags the specification offers version-compare
// input: Route.render with the key "specification" at main without a tag; with the key "tests" at main with its tags; then the specification at main with its tags
// expect: without a tag the specification offers no version-compare; the tests view, which draws the same version choice, offers none either; with its tags the specification offers one
test("TST-600415: a second version is offered only where there is one to compare with, and not on the tests view", async () => {
  const bare = () => treeHost({ trees: { main: MAIN }, tags: [] });
  assert.equal(compareOf(await render(bare(), { key: "specification", ref: "main" })).length, 0);
  const tests = await render(hostOf(), { key: "tests", ref: "main" });
  assert.equal(withClass(tests, "version-choice").length, 1, "known positive: the tests view draws the version choice");
  assert.equal(compareOf(tests).length, 0);
  assert.equal(compareOf(await render(hostOf(), { key: "specification", ref: "main" })).length, 1, "known positive");
});
