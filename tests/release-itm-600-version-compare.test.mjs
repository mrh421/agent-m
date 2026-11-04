// Release tests of ITM-600 — two versions of a product are compared in the specification and the gaps. Written from UC-020 1b: "The reader compares two versions. The reader picks a second version; the tree marks requirements added, changed and removed between them, and a changed one opens with the difference. On **Gaps**, it marks what became covered and what lost its coverage in between."
// ITM-600 realises UC-020 alone; its alternative flow 1b has two halves, the tree and the gaps, one release test each, and a third states the limit that was ruled at the item's gate as a finding.
// Run: node --test tests/release-itm-600-version-compare.test.mjs
//
// Module: MOD-trace-pages
// Module: MOD-trace-graph
// Guards: UC-020; THE BROWSER SHOWS ANY RELEASED VERSION
// Level: release
//
// Written for the release testing of sprint team1/133 by a participant who implemented none of ITM-600 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The reader reaches the views as the existing page tests do (tests/trace-pages-harness.mjs: the fake Host of a product with trees for main and a tag, each commit's graph stored on trace-cache; Route.render of MOD-trace-pages' route `trace`; a change of the select "Compare with"). The cases use requirements, use cases and tests of their own, and also a requirement that only moves down the file.
// Readings the texts leave open, which the cases state:
//   - "changed" is a requirement of both versions whose source items differ (the graph keeps no more of a requirement); a requirement that only stands on another line is not changed.
//   - A requirement is "covered" by a use case that realises it or a test that guards it; the gaps line reads "<requirement> — by <artifact>".
//   - The tree's mark is the text "added", "changed" or "removed" beside the requirement's name; "opens with the difference" is a box "requirement-difference" below the opened requirement's fields.

import test from "node:test";
import assert from "node:assert/strict";
import { doc, document, find, treeHost, until } from "./trace-pages-harness.mjs";

const { view } = await import("../src/trace-pages/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "trace");

const requirement = (name, source, rule = "A rule.", check = "at review.") => [`**${name}** *(${source})*`, rule, `*Check:* ${check}`, ""];
const spec = (...requirements) => ["# Release fixture — Specification", "", "## Section", "", ...requirements.flat()].join("\n");
const testFile = (guards) => ["// TST-701 · level: unit · module: MOD-direct", `// guards: ${guards}`, "// given: a fixture", "// input: none", "// expect: nothing", ""].join("\n");
const MODULE = doc("MOD-direct", "Direct module", { folder: "src/direct/" });
const ADDRESS = "https://github.com/acme/library";
const TAG = "v2026.3.0";

// The tag: FIRST, SECOND, THIRD and FOURTH RULE. UC-001 realises FIRST and FOURTH, TST-701 guards SECOND.
const OLD = {
  "SPEC.md": spec(requirement("FIRST RULE", "Book ch. 8"), requirement("SECOND RULE", "Book ch. 8"), requirement("THIRD RULE", "Book ch. 8"), requirement("FOURTH RULE", "Book ch. 8")),
  "docs/use-cases/UC-001-first.md": doc("UC-001", "First", { realises: ["FIRST RULE", "FOURTH RULE"] }),
  "docs/architecture/MOD-direct.md": MODULE, "tests/direct.test.mjs": testFile("SECOND RULE"),
};
// main: NEWEST RULE above all (every line below moves), FIRST RULE with a second source item, SECOND RULE, FOURTH RULE; THIRD RULE is gone. UC-001 realises FIRST and NEWEST, TST-701 guards FIRST.
const NEW = {
  "SPEC.md": spec(requirement("NEWEST RULE", "Book ch. 8"), requirement("FIRST RULE", "Book ch. 8; PO A. Maier"), requirement("SECOND RULE", "Book ch. 8"), requirement("FOURTH RULE", "Book ch. 8")),
  "docs/use-cases/UC-001-first.md": doc("UC-001", "First", { realises: ["FIRST RULE", "NEWEST RULE"] }),
  "docs/architecture/MOD-direct.md": MODULE, "tests/direct.test.mjs": testFile("FIRST RULE"),
};
const hostOf = (trees = { main: NEW, [TAG]: OLD }) => treeHost({ trees, tags: [TAG] });
async function render(key, host) {
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, { product: { address: ADDRESS, host } }, { key, ref: "main" });
  return target;
}
const withClass = (root, name) => find(root, (node) => node.className.split(" ").includes(name));
const pick = async (target) => {
  const [select] = find(target, (node) => node.localName === "select" && node.className === "version-compare");
  select.value = TAG; select.dispatchEvent(new Event("change"));
  await until(() => withClass(target, "version-compared").length > 0);
};
const lists = (target) => Object.fromEntries(withClass(target, "version-compared-list").map((section) =>
  [find(section, (node) => node.localName === "h4")[0].textContent, find(section, (node) => node.localName === "li").map((node) => node.textContent)]));
const marks = (target) => withClass(target, "requirement-compared").map((node) => [node.parentNode.firstChild.textContent, node.textContent]);
const open = (target, name) => find(target, (node) => node.localName === "button" && node.className.includes("requirement-name") && node.textContent === name)[0].dispatchEvent(new Event("click"));

// TST-600601 · level: release · module: MOD-trace-pages
// guards: UC-020; THE BROWSER SHOWS ANY RELEASED VERSION
// given: the specification at main, with the tag v2026.3.0 older; main adds NEWEST RULE above all others, gives FIRST RULE a second source item and drops THIRD RULE; SECOND RULE and FOURTH RULE are the same text in both, each on another line
// input: the reader opens the specification at main, picks the tag in "Compare with"; opens FIRST RULE and SECOND RULE in the tree
// expect: under "Compared with v2026.3.0" Added [NEWEST RULE], Changed [FIRST RULE], Removed [THIRD RULE]; the tree marks NEWEST RULE "added" and FIRST RULE "changed" and no other requirement; FIRST RULE opens with a difference showing "- Source: Book ch. 8" and "+ Source: Book ch. 8; PO A. Maier"; SECOND RULE opens with none
// Planted fault: compareGraphs counting the line as part of what a node keeps (`const kept = ({ line, ...facts }) => JSON.stringify(facts)` of src/trace-graph/derive.mjs replaced by `const kept = (node) => JSON.stringify(node)`) lists SECOND RULE and FOURTH RULE, which only moved, as changed, and the case fails on the Changed list.
// Planted fault: the Removed list taken from `after` instead of `before` (src/trace-graph/derive.mjs) names no THIRD RULE, and the case fails on the Removed list.
test("TST-600601 the specification marks the requirements added, changed and removed between two versions, and a changed one opens with its difference", async () => {
  const target = await render("specification", hostOf());
  assert.equal(withClass(target, "version-compared").length, 0, "known positive: no comparison before a second version is picked");
  await pick(target);
  assert.deepEqual(find(withClass(target, "version-compared")[0], (node) => node.localName === "h3").map((node) => node.textContent), ["Compared with v2026.3.0"]);
  assert.deepEqual(lists(target), { Added: ["NEWEST RULE"], Changed: ["FIRST RULE"], Removed: ["THIRD RULE"] }, "failure node: the added, changed and removed requirements");
  assert.deepEqual(marks(target), [["NEWEST RULE", "added"], ["FIRST RULE", "changed"]], "failure node: the marks in the tree");
  open(target, "FIRST RULE");
  open(target, "SECOND RULE");
  await until(() => withClass(target, "requirement-difference").some((box) => find(box, (node) => node.localName === "pre").length));
  const boxes = withClass(target, "requirement-difference");
  assert.equal(boxes.length, 1, "failure node: only the changed requirement opens with a difference");
  assert.deepEqual(withClass(boxes[0], "ddel").map((node) => node.textContent), ["- Source: Book ch. 8"]);
  assert.deepEqual(withClass(boxes[0], "dadd").map((node) => node.textContent), ["+ Source: Book ch. 8; PO A. Maier"]);
});

// TST-600602 · level: release · module: MOD-trace-pages
// guards: UC-020; UNREALISED REQUIREMENTS ARE REPORTED, NOT FORBIDDEN
// given: the gaps at main and the tag v2026.3.0 older; at the tag UC-001 realises FIRST RULE and FOURTH RULE and TST-701 guards SECOND RULE; at main UC-001 realises FIRST RULE and NEWEST RULE and TST-701 guards FIRST RULE
// input: the reader opens the gaps at main and picks the tag in "Compare with"
// expect: under "Compared with v2026.3.0", "Became covered" holds "FIRST RULE — by TST-701" and "NEWEST RULE — by UC-001", and "Lost its coverage" holds "FOURTH RULE — by UC-001" and "SECOND RULE — by TST-701"; FIRST RULE — by UC-001 is in neither list
// Planted fault: the two sides of the coverage swapped (`coverage: { gained: only(now, was), lost: only(was, now) }` of src/trace-graph/derive.mjs replaced by `{ gained: only(was, now), lost: only(now, was) }`) fills each list with the other's lines, and the case fails on "Became covered".
// Planted fault: the tests left out of what covers (`guards: new Set(["TST"])` emptied in COVERING) drops the lines by TST-701, and the case fails on "Became covered".
test("TST-600602 the gaps mark what became covered and what lost its coverage between two versions", async () => {
  const target = await render("gaps", hostOf());
  await pick(target);
  assert.deepEqual(lists(target), { "Became covered": ["FIRST RULE — by TST-701", "NEWEST RULE — by UC-001"], "Lost its coverage": ["FOURTH RULE — by UC-001", "SECOND RULE — by TST-701"] },
    "failure node: the coverage gained and lost");
});

// TST-600603 · level: release · module: MOD-trace-graph
// guards: UC-020
// given: the specification at main and the tag v2026.3.0, which differ in the Rule text of FIRST RULE alone (same source, same check, same line)
// input: the reader opens the specification at main and picks the tag in "Compare with"
// expect: UC-020 1b — "the tree marks requirements added, changed and removed between them": FIRST RULE is listed as changed and marked "changed"
// FINDING 600-RULE-TEXT — compareGraphs sees only what the graph keeps of a requirement, its source items, so a requirement whose rule or check alone changed is listed as no change and not marked; the Scrum Master recorded this as a known limit ruled at the item's gate, for akmaier
test("TST-600603 a requirement whose rule text alone changed is marked changed", { todo: "FINDING 600-RULE-TEXT — the graph keeps no requirement text, so a requirement whose only rule or check changed is not listed or marked as changed" }, async () => {
  const same = (rule) => ({ ...NEW, "SPEC.md": spec(requirement("FIRST RULE", "Book ch. 8", rule)) });
  const target = await render("specification", hostOf({ main: same("The rule, reworded."), [TAG]: same("The rule.") }));
  await pick(target);
  assert.deepEqual(lists(target).Changed, ["FIRST RULE"]);
  assert.deepEqual(marks(target), [["FIRST RULE", "changed"]]);
});
