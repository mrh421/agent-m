// Release tests of ITM-1255 as narrowed — MOD-work-plans reads a backlog's item files, the architecture's module files and its list fields each by one rule, and every read stays what it
// was (the item is a refactoring: "No behaviour changes", Acceptance). The behaviour is the SPEC's A BACKLOG ITEM NAMES THE MODULES IT CHANGES ("Every backlog item names the modules of the
// architecture that its implementation changes") and THE BACKLOG LIVES IN THE PRODUCT REPOSITORY ("A product's backlog is kept as Markdown under `docs/backlog/` of the product's own repository"),
// as docs/architecture/MOD-work-plans.md states `backlogFindings` ("an item that ... names no module the architecture describes; that builds on an item that does not exist") and `itemStates` ("every
// backlog item after the items it builds on").
// Run: node --test tests/release-itm-1255-work-plans-backlog-reads.test.mjs
//
// Module: MOD-work-plans
// Guards: A BACKLOG ITEM NAMES THE MODULES IT CHANGES; THE BACKLOG LIVES IN THE PRODUCT REPOSITORY
// Level: release
//
// Written for the release testing of sprint 112 by a participant who implemented none of ITM-1255 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The implementers' cases
// (tests/work-plans-one-definition.test.mjs) read the module's code files and count definitions; these cases never read the code. They give the module's interface (workStrategies' check
// `backlog-checks`, itemStates) a product whose paths sit on the edges of each rule, and compare with an oracle written from the texts, and read this repository's own backlog and architecture as they
// stand. Readings the texts leave open, taken here:
//   - "the architecture's module files": the files `docs/architecture/MOD-<slug>.md` directly in that folder; one in a sub-folder, with another extension, or whose name only contains MOD- is none.
//   - "an item's file": `docs/backlog/ITM-<n>-<slug>.md` with n of at least three digits, directly in that folder; one in a sub-folder (docs/backlog/sprints/…) or with a shorter number is none.
//   - a list-valued field is a list of names, or one comma-separated line of them, each name trimmed and none blank.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { itemStates, workStrategies } from "../src/work-plans/index.mjs";

const lines = (...rows) => `${rows.join("\n")}\n`;
const check = workStrategies.checks?.["backlog-checks"];
const REPO = fileURLToPath(new URL("../", import.meta.url));

const module_ = (id) => lines("---", `id: ${id}`, `title: ${id}`, `folder: src/${id.slice(4)}/`, "realises:", "follows:", "  - ARC-001", "uses: []", "provides:", "  - f", "---",
  `# ${id} ${id}`, "", "## Responsibility", "", "r", "", "## Parts", "", "p", "", "## Data", "", "d", "", "## Interfaces", "", "- `f` — i", "", "## Files", "", "f", "", "## Uses", "", "u");
const item = (id, title, { realises = ["EXPORT IS A PDF"], modules = ["MOD-store"], builds = [] } = {}) => lines("---", `id: ${id}`, `title: ${title}`, "level: module",
  "realises:", ...realises.map((each) => `  - ${each}`), "modules:", ...modules.map((each) => `  - ${each}`),
  ...(builds.length ? ["builds_on:", ...builds.map((each) => `  - ${each}`)] : []), "tests:", "  - unit", "origin:", "  - UC-032", "---", `# ${id} ${title}`, "", "## Outcome", "", "o", "",
  "## Acceptance", "", "a");
const SPEC = lines("# Fixture", "", "## 1. Rules", "", "**EXPORT IS A PDF** *(Owner)*", "A rule.", "*Check:* no automatic check; at review.");

const contextOf = (files) => ({ params: {}, product: { address: "https://github.com/acme/product", host: null,
  snapshot: { paths: Object.keys(files), read: async (path) => (Object.prototype.hasOwnProperty.call(files, path) ? files[path] : null) } } });
const entry = (title, over = {}) => ({ title, outcome: "o", realises: ["EXPORT IS A PDF"], modules: ["MOD-store"], buildsOn: [], acceptance: ["unit tests"], class: "new", ...over });
const run = (items, files) => {
  assert.equal(typeof check, "function", "workStrategies offers the check backlog-checks");
  return check({ items }, contextOf(files));
};
const MODULES = "A BACKLOG ITEM NAMES THE MODULES IT CHANGES";

// TST-1255301 · level: release · module: MOD-work-plans
// guards: A BACKLOG ITEM NAMES THE MODULES IT CHANGES
// given: a product whose architecture holds MOD-store at docs/architecture/MOD-store.md, MOD-nested at docs/architecture/sub/MOD-nested.md, MOD-text at docs/architecture/MOD-text.txt and MOD-prefixed at docs/architecture/ARC-001-MOD-prefixed.md; known positive first — a draft changing MOD-store is sound
// input: the check backlog-checks on a draft of four entries, each changing one of those four modules
// expect: the entry changing MOD-store has no finding; each of the other three has one error of the rule A BACKLOG ITEM NAMES THE MODULES IT CHANGES
// Planted fault: the module files found by a looser pattern (MODULE_FILE of src/work-plans/strategies.mjs without its anchors, or allowing a sub-folder) reads MOD-nested or MOD-prefixed as described and the case fails on them.
test("TST-1255301 only docs/architecture/MOD-<slug>.md files are the architecture's modules", async () => {
  const files = { "SPEC.md": SPEC, "docs/architecture/MOD-store.md": module_("MOD-store"), "docs/architecture/sub/MOD-nested.md": module_("MOD-nested"),
    "docs/architecture/MOD-text.txt": module_("MOD-text"), "docs/architecture/ARC-001-MOD-prefixed.md": module_("MOD-prefixed") };
  assert.deepEqual(await run([entry("Sound")], files), [], "known positive: a module at its place is described");
  const found = await run(["MOD-store", "MOD-nested", "MOD-text", "MOD-prefixed"].map((id) => entry(`Changes ${id}`, { modules: [id] })), files);
  assert.deepEqual(found.map((each) => [each.artifact, each.kind, each.rule]), ["MOD-nested", "MOD-text", "MOD-prefixed"].map((id) => [`the item "Changes ${id}"`, "error", MODULES]));
});

// TST-1255302 · level: release · module: MOD-work-plans
// guards: THE BACKLOG LIVES IN THE PRODUCT REPOSITORY
// given: a product whose backlog holds docs/backlog/ITM-001-first.md, docs/backlog/old/ITM-002-nested.md (in a sub-folder), docs/backlog/ITM-12-short.md (a number of two digits) and docs/backlog/ITM-003-third.md
// input: the check backlog-checks on a draft of four entries, each building on one of ITM-001, ITM-002, ITM-12 and ITM-003 by its identifier
// expect: the entries building on ITM-001 and ITM-003 have no finding; the entries building on ITM-002 and ITM-12 each have an error that the item builds on one that does not exist, naming that identifier
// Planted fault: the item's file found by a pattern that allows a sub-folder or a short number (ITEM_FILE of src/work-plans/saves.mjs loosened) counts ITM-002 or ITM-12 as items and the case fails on them.
test("TST-1255302 only docs/backlog/ITM-<n>-<slug>.md files directly in the backlog are items", async () => {
  const files = { "SPEC.md": SPEC, "docs/architecture/MOD-store.md": module_("MOD-store"),
    "docs/backlog/ITM-001-first.md": item("ITM-001", "First"), "docs/backlog/old/ITM-002-nested.md": item("ITM-002", "Nested"),
    "docs/backlog/ITM-12-short.md": item("ITM-12", "Short"), "docs/backlog/ITM-003-third.md": item("ITM-003", "Third") };
  const draft = ["ITM-001", "ITM-002", "ITM-12", "ITM-003"].map((id) => entry(`Builds on ${id}`, { buildsOn: [id] }));
  const found = await run(draft, files);
  assert.deepEqual(found.map((each) => each.artifact), [`the item "Builds on ITM-002"`, `the item "Builds on ITM-12"`], "only the two that build on a non-item are found");
  for (const each of found) {
    assert.equal(each.kind, "error");
    assert.ok(each.what.includes(each.artifact.match(/ITM-\d+/)[0]), each.what);
  }
});

// TST-1255303 · level: release · module: MOD-work-plans
// guards: THE BACKLOG LIVES IN THE PRODUCT REPOSITORY
// given: three backlog items ITM-901-top, ITM-901-middle and ITM-901-base as documents, top building on middle and middle on base, listed top first; the list field builds_on written once as a list, once as one comma-separated line with blanks and spaces ("ITM-901-middle, ,")
// input: itemStates on each of the two forms of the three items, without a plan order
// expect: the items come out base, middle, top (after the items they build on) in both forms, and the two results are equal
// Planted fault: a reader of the list field that does not trim its parts or keep a blank one ("ITM-901-middle" read as " ITM-901-middle", or "" as a name) loses the order or fails on the text form (the `list` of src/work-plans/sprints.mjs changed).
test("TST-1255303 a list field written as a list or as a comma-separated line orders the backlog the same", () => {
  const doc = (id, builds) => ({ kind: "item", path: `docs/backlog/${id}.md`, id, title: id, sections: [], appended: [], body: "", fields: { id, realises: ["UC-READY"], modules: [], builds_on: builds } });
  const asList = [doc("ITM-901-top", ["ITM-901-middle"]), doc("ITM-901-middle", ["ITM-901-base"]), doc("ITM-901-base", [])];
  const asText = [doc("ITM-901-top", " ITM-901-middle, ,"), doc("ITM-901-middle", "ITM-901-base"), doc("ITM-901-base", "")];
  const facts = { statuses: new Map(), queues: [], jobs: [], pullRequests: [], gates: [], workflow: null };
  const fromList = itemStates(asList, null, facts), fromText = itemStates(asText, null, facts);
  assert.deepEqual(fromList.map((state) => state.item), ["ITM-901-base", "ITM-901-middle", "ITM-901-top"]);
  assert.deepEqual(fromText, fromList);
});

// TST-1255304 · level: release · module: MOD-work-plans
// guards: A BACKLOG ITEM NAMES THE MODULES IT CHANGES; THE BACKLOG LIVES IN THE PRODUCT REPOSITORY
// given: this repository's docs/backlog/ (every ITM- file), docs/architecture/ and SPEC.md as they stand; the oracle is the listing of those folders by the file system, not the module's rules; known positive first — MOD-work-plans and ITM-1255 are in the listing
// input: the check backlog-checks on a draft of three entries, titled Sound, Unknown module and Unknown item: one changing MOD-work-plans and building on ITM-1255, one changing MOD-no-such-module, one building on ITM-9999999 (not in the backlog)
// expect: the first has no finding; the second has one error of the rule A BACKLOG ITEM NAMES THE MODULES IT CHANGES; the third has one error that it builds on an item that does not exist
// Planted fault: the module files or the item files found by a rule that reads fewer or more than the folder holds (the patterns of src/work-plans/strategies.mjs or saves.mjs changed) fails the first entry's soundness or the second and third entries' findings.
test("TST-1255304 over this repository's backlog and architecture the check finds the modules and items the folders hold", async () => {
  const items = readdirSync(`${REPO}docs/backlog`).filter((name) => /^ITM-\d{3,}-.+\.md$/.test(name));
  const modules = readdirSync(`${REPO}docs/architecture`).filter((name) => /^MOD-.+\.md$/.test(name));
  assert.ok(modules.includes("MOD-work-plans.md") && items.some((name) => name.startsWith("ITM-1255-")), "known positive: the listing holds what the case relies on");
  assert.ok(items.length > 500 && modules.length > 50, `${items.length} items, ${modules.length} modules`);
  const files = { "SPEC.md": readFileSync(`${REPO}SPEC.md`, "utf8") };
  for (const name of items) files[`docs/backlog/${name}`] = readFileSync(`${REPO}docs/backlog/${name}`, "utf8");
  for (const name of modules) files[`docs/architecture/${name}`] = readFileSync(`${REPO}docs/architecture/${name}`, "utf8");
  const realises = ["A BACKLOG ITEM NAMES THE MODULES IT CHANGES"];
  const found = await run([
    entry("Sound", { realises, modules: ["MOD-work-plans"], buildsOn: ["ITM-1255"] }),
    entry("Unknown module", { realises, modules: ["MOD-no-such-module"] }),
    entry("Unknown item", { realises, modules: ["MOD-work-plans"], buildsOn: ["ITM-9999999"] }),
  ], files);
  assert.deepEqual(found.map((each) => [each.artifact, each.kind]), [[`the item "Unknown module"`, "error"], [`the item "Unknown item"`, "error"]]);
  assert.equal(found[0].rule, MODULES);
  assert.ok(found[1].what.includes("ITM-9999999"), found[1].what);
});
