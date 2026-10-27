// The check `backlog-checks` of MOD-work-plans' `workStrategies` (ITM-616; UC-032 step 3), as the accepted text of docs/architecture/MOD-work-plans.md states it (blob 42e171450da1, approved in
// docs/approvals/MOD-work-plans-42e171450da1.md): ":270 check `backlog-checks` — `backlogFindings` on drafted items", with ":187 `backlogFindings(items: Document[], architecture: Document[]) -> Finding[]`
// — an item that realises nothing; that names no module the architecture describes; that builds on an item that does not exist, or on one that builds on it in turn; and, as a warning, an item that
// restates an existing one", and ":112 `docs/assets/work-items.mjs` ... removed once this module gives `backlogFindings`". `backlogFindings` itself is built (ITM-688, tests/work-plans-backlog-findings.test.mjs);
// what is built here is the check, which the job runner calls as check(draft, context) with the answer of the kind `propose-items`.
// Run: node --test tests/work-plans-backlog-checks.test.mjs
//
// Module: MOD-work-plans
// Guards: UC-032; A BACKLOG ITEM NAMES WHAT IT REALISES; A BACKLOG ITEM NAMES THE MODULES IT CHANGES; THE BACKLOG LIVES IN THE PRODUCT REPOSITORY; EXACT DUPLICATES ARE FOUND WITHOUT A MODEL
// Level: unit
//
// The draft is the answer of the kind `propose-items` (src/job-catalogue/kinds/propose-items/answer.schema.json): { items: [{ title, outcome, realises, modules, buildsOn, acceptance, class, of }] }.
// The readings where the file leaves one open, which the pull request names:
//   - A drafted entry becomes an item whose `realises`, `modules` and `builds_on` are the entry's `realises`, `modules` and `buildsOn`, with an identifier after the highest ITM- identifier in the
//     product's files, in the drafted sequence (as `plan-checks` does for steps). `outcome`, `acceptance`, `class` and `of` are read by no rule of `backlogFindings` and are not looked at.
//   - An entry of `buildsOn` names an item by the identifier of an existing item, or by the title of an existing item or of another drafted entry (the kind's prompt lists existing items by their
//     title); a title is replaced by that item's identifier, any other entry is handed on as it is, so that `backlogFindings` finds it not to exist. The order of the entries does not matter.
//   - `backlogFindings` runs on the existing items of docs/backlog/ and the drafted ones together, with the module files of docs/architecture/ of the product's snapshot; the check gives the findings
//     whose artifact is a drafted item. A finding about an existing item is not the draft's. A finding names a drafted item by its title, as `plan-checks` names a step.
//   - A draft without `items` has no finding.
// The product is a fixture in memory; nothing reaches the network. Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the
// pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { formatFinding, parseFinding } from "../src/text-tools/index.mjs";
import { workStrategies } from "../src/work-plans/index.mjs";

const lines = (...rows) => `${rows.join("\n")}\n`;
const check = workStrategies.checks?.["backlog-checks"];

const REALISES = "A BACKLOG ITEM NAMES WHAT IT REALISES";
const MODULES = "A BACKLOG ITEM NAMES THE MODULES IT CHANGES";
const BACKLOG = "THE BACKLOG LIVES IN THE PRODUCT REPOSITORY";
const DUPLICATE = "EXACT DUPLICATES ARE FOUND WITHOUT A MODEL";

// ---------------------------------------------------------------- the fixture product

const module_ = (id) => lines("---", `id: ${id}`, `title: ${id}`, `folder: src/${id.slice(4)}/`, "realises:", "follows:", "  - ARC-001", "uses: []", "provides:", "  - f", "---",
  `# ${id} ${id}`, "", "## Responsibility", "", "r", "", "## Parts", "", "p", "", "## Data", "", "d", "", "## Interfaces", "", "- `f` — i", "", "## Files", "", "f", "", "## Uses", "", "u");
const item = (id, title, { realises = ["EXPORT IS A PDF"], modules = ["MOD-store"], builds = [] } = {}) => lines("---", `id: ${id}`, `title: ${title}`, "level: module",
  ...(realises.length ? ["realises:", ...realises.map((each) => `  - ${each}`)] : ["realises: []"]), "modules:", ...modules.map((each) => `  - ${each}`),
  ...(builds.length ? ["builds_on:", ...builds.map((each) => `  - ${each}`)] : []), "tests:", "  - unit", "origin:", "  - UC-032", "---", `# ${id} ${title}`, "", "## Outcome", "", "o", "",
  "## Acceptance", "", "a");

// The backlog holds ITM-001, a sound item, and ITM-004, which realises nothing (a fault of its own, that is not the draft's); the highest identifier is ITM-004.
const FILES = {
  "SPEC.md": lines("# Fixture", "", "## 1. Rules", "", "**EXPORT IS A PDF** *(Owner)*", "A rule.", "*Check:* no automatic check; at review."),
  "docs/architecture/MOD-store.md": module_("MOD-store"),
  "docs/architecture/MOD-pages.md": module_("MOD-pages"),
  "docs/backlog/ITM-001-export-thesis-as-pdf.md": item("ITM-001", "Export thesis as PDF"),
  "docs/backlog/ITM-004-broken.md": item("ITM-004", "A broken item", { realises: [] }),
};

const contextOf = (files = FILES) => ({ params: {}, product: { address: "https://github.com/acme/product", host: null,
  snapshot: { paths: Object.keys(files), read: async (path) => (Object.prototype.hasOwnProperty.call(files, path) ? files[path] : null) } } });
const entry = (title, over = {}) => ({ title, outcome: "o", realises: ["EXPORT IS A PDF"], modules: ["MOD-store"], buildsOn: [], acceptance: ["unit tests"], class: "new", ...over });
const run = (items, files) => {
  assert.equal(typeof check, "function", "workStrategies offers the check backlog-checks");
  return check({ items }, contextOf(files));
};
const brief = (found) => found.map((each) => [each.artifact, each.kind, each.rule, each.what]);
const the = (title) => `the item "${title}"`;

// TST-616001 · level: unit · module: MOD-work-plans
// guards: UC-032; THE BACKLOG LIVES IN THE PRODUCT REPOSITORY
// given: the fixture product (MOD-store and MOD-pages, the items ITM-001 and ITM-004) and a draft of two entries: "Store the thesis" changing MOD-store and building on ITM-001, an existing item, by its identifier; "Page layout" changing MOD-pages and building on "Store the thesis", a drafted entry, by its title
// input: the check backlog-checks on that draft
// expect: no finding (the known positive of every case below)
// Planted fault: any finding raised for a sound draft makes this case fail, and each case below changes one line of it.
test("backlog-checks — a sound draft gives no finding", async () => {
  const sound = [entry("Store the thesis", { buildsOn: ["ITM-001"] }), entry("Page layout", { modules: ["MOD-pages"], buildsOn: ["Store the thesis"] })];
  assert.deepEqual(await run(sound), []);
});

// TST-616002 · level: unit · module: MOD-work-plans
// guards: UC-032; A BACKLOG ITEM NAMES WHAT IT REALISES
// given: the sound draft with the entry "Page layout" realising nothing
// input: the check backlog-checks
// expect: exactly one finding, whole: artifact the item "Page layout", line 1, kind error, rule A BACKLOG ITEM NAMES WHAT IT REALISES, what "the item realises nothing", fix "name at least one requirement or use case the item realises, or remove the item"
// Planted fault: not calling backlogFindings, or leaving the title out of the artifact (a provisional identifier is not what the drafter was given), fails.
test("backlog-checks — a drafted item that realises nothing is an error naming the item by its title", async () => {
  const found = await run([entry("Store the thesis"), entry("Page layout", { modules: ["MOD-pages"], realises: [] })]);
  assert.deepEqual(found, [{ artifact: the("Page layout"), line: 1, kind: "error", rule: REALISES, what: "the item realises nothing",
    fix: "name at least one requirement or use case the item realises, or remove the item" }]);
});

// TST-616003 · level: unit · module: MOD-work-plans
// guards: UC-032; A BACKLOG ITEM NAMES THE MODULES IT CHANGES
// given: the sound draft's first entry changing MOD-ghost, which the product's architecture lacks; then changing no module; then, as the counter-proof, changing MOD-store and MOD-ghost
// input: the check backlog-checks on each draft
// expect: for the first two, one error A BACKLOG ITEM NAMES THE MODULES IT CHANGES "the item names no module the architecture describes" on the item "Store the thesis"; for the counter-proof, no finding
// Planted fault: reading the architecture from nothing (every item then names no module), or never from the snapshot's module files, fails the counter-proof or the first case.
test("backlog-checks — a drafted item that names no module the product's architecture describes is an error", async () => {
  for (const modules of [["MOD-ghost"], []]) {
    assert.deepEqual(brief(await run([entry("Store the thesis", { modules })])), [[the("Store the thesis"), "error", MODULES, "the item names no module the architecture describes"]]);
  }
  assert.deepEqual(await run([entry("Store the thesis", { modules: ["MOD-store", "MOD-ghost"] })]), []);
});

// TST-616004 · level: unit · module: MOD-work-plans
// guards: UC-032; THE BACKLOG LIVES IN THE PRODUCT REPOSITORY
// given: one drafted entry "Store the thesis" building on, in turn: ITM-099, which no item is; the text "No such item", which is the title of no item; and, as counter-proofs, the title "Export thesis as PDF" of the existing ITM-001
// input: the check backlog-checks on each draft
// expect: for ITM-099 one error THE BACKLOG LIVES IN THE PRODUCT REPOSITORY "the item builds on ITM-099, which does not exist"; for "No such item" one error "the item builds on No such item, which does not exist"; for the existing title no finding
// Planted fault: handing on a title without replacing it by the identifier gives an error for the existing title; replacing every entry by an identifier hides the others.
test("backlog-checks — a drafted item that builds on an item that does not exist is an error; an existing item may be named by its title", async () => {
  const on = (name) => run([entry("Store the thesis", { buildsOn: [name] })]);
  assert.deepEqual(brief(await on("ITM-099")), [[the("Store the thesis"), "error", BACKLOG, "the item builds on ITM-099, which does not exist"]]);
  assert.deepEqual(brief(await on("No such item")), [[the("Store the thesis"), "error", BACKLOG, "the item builds on No such item, which does not exist"]]);
  assert.deepEqual(await on("Export thesis as PDF"), []);
});

// TST-616005 · level: unit · module: MOD-work-plans
// guards: UC-032; THE BACKLOG LIVES IN THE PRODUCT REPOSITORY
// given: "Page layout" building on "Store the thesis", listed before it in the draft; then both building on each other
// input: the check backlog-checks on each draft
// expect: for the first, no finding (the order of the entries does not matter); for the pair, two errors in the order of the entries: the item "Page layout" "the item builds on the item "Store the thesis", which builds on it in turn" and the item "Store the thesis" "the item builds on the item "Page layout", which builds on it in turn"
// Planted fault: numbering the entries so that a later one is unknown to an earlier one gives an error for the first; checking only one direction gives one error for the pair.
test("backlog-checks — drafted items may build on each other in any order, but not in turn", async () => {
  const pages = (over = {}) => entry("Page layout", { modules: ["MOD-pages"], buildsOn: ["Store the thesis"], ...over });
  assert.deepEqual(await run([pages(), entry("Store the thesis")]), []);
  assert.deepEqual(brief(await run([pages(), entry("Store the thesis", { buildsOn: ["Page layout"] })])), [
    [the("Page layout"), "error", BACKLOG, `the item builds on ${the("Store the thesis")}, which builds on it in turn`],
    [the("Store the thesis"), "error", BACKLOG, `the item builds on ${the("Page layout")}, which builds on it in turn`]]);
});

// TST-616006 · level: unit · module: MOD-work-plans
// guards: UC-032; EXACT DUPLICATES ARE FOUND WITHOUT A MODEL
// given: an entry titled "  export THESIS as pdf ", which restates the existing ITM-001; then an entry with a title of its own; then two entries with the one title "Same title"
// input: the check backlog-checks on each draft
// expect: for the first, one warning (kind warning) EXACT DUPLICATES ARE FOUND WITHOUT A MODEL "the item restates ITM-001" on the item "  export THESIS as pdf "; for the second, none; for the two of one title, a warning on each: the item "Same title" restates the item "Same title"
// Planted fault: giving the findings as errors, or running backlogFindings on the draft alone (without the existing items), leaves no warning or an error.
test("backlog-checks — a drafted item that restates another item is a warning", async () => {
  const [one, ...rest] = await run([entry("  export THESIS as pdf ")]);
  assert.deepEqual(rest, []);
  assert.deepEqual([one.artifact, one.kind, one.rule, one.what], [the("  export THESIS as pdf "), "warning", DUPLICATE, "the item restates ITM-001"]);
  assert.deepEqual(await run([entry("Store the thesis")]), []);
  const twins = await run([entry("Same title"), entry("Same title")]);
  assert.deepEqual(twins.map((each) => each.kind), ["warning", "warning"]);
  assert.ok(twins.every((each) => each.rule === DUPLICATE && each.artifact === the("Same title") && each.what === `the item restates ${the("Same title")}`));
});

// TST-616007 · level: unit · module: MOD-work-plans
// guards: UC-032; A BACKLOG ITEM NAMES WHAT IT REALISES; EXACT DUPLICATES ARE FOUND WITHOUT A MODEL
// given: the existing ITM-004, which realises nothing, and a sound draft; then a draft whose entry takes the title of ITM-001; then the draft of ITM-004's fault (a known positive: an entry that realises nothing)
// input: the check backlog-checks on each draft
// expect: for the sound draft, no finding (ITM-004's fault is not the draft's); for the entry that takes ITM-001's title, exactly one finding, on the drafted item and not on ITM-001; for the fault drafted, the error of TST-616002
// Planted fault: giving every finding of backlogFindings, those of the existing items too, gives an error for ITM-004 and a warning for ITM-001.
test("backlog-checks — the findings are those of the drafted items, not of the items already in the backlog", async () => {
  assert.deepEqual(await run([entry("Store the thesis")]), []);
  const found = await run([entry("Export thesis as PDF")]);
  assert.deepEqual(brief(found), [[the("Export thesis as PDF"), "warning", DUPLICATE, "the item restates ITM-001"]]);
  assert.deepEqual(brief(await run([entry("Store the thesis", { realises: [] })])), [[the("Store the thesis"), "error", REALISES, "the item realises nothing"]]);
});

// TST-616008 · level: unit · module: MOD-work-plans
// guards: UC-032; THE BACKLOG LIVES IN THE PRODUCT REPOSITORY
// given: the fixture product, whose highest identifier is ITM-004, and a draft of two sound entries, the first building on ITM-001 and ITM-004, both existing
// input: the check backlog-checks
// expect: no finding — the drafted items take identifiers after ITM-004, so that neither ITM-001 nor ITM-004 is taken for a drafted item
// Planted fault: numbering the drafted items from ITM-001, or from the number of existing items, makes the first entry build on itself and gives an error.
test("backlog-checks — the drafted items take identifiers after the product's highest", async () => {
  assert.deepEqual(await run([entry("Store the thesis", { buildsOn: ["ITM-001", "ITM-004"] }), entry("Page layout", { modules: ["MOD-pages"] })]), []);
});

// TST-616009 · level: unit · module: MOD-work-plans
// guards: UC-032
// given: drafts without items — null, {}, { items: null }, { items: [] } —; and a product with no docs/backlog and no docs/architecture and a draft of one entry
// input: the check backlog-checks on each
// expect: no finding and no throw for the drafts without items; for the product without files, one error A BACKLOG ITEM NAMES THE MODULES IT CHANGES (no module is described) and nothing thrown
// Planted fault: reading draft.items without a guard throws on the first drafts.
test("backlog-checks — a draft without items has no finding, and a product without a backlog or an architecture is read", async () => {
  assert.equal(typeof check, "function", "workStrategies offers the check backlog-checks");
  for (const draft of [null, {}, { items: null }, { items: [] }]) assert.deepEqual(await check(draft, contextOf()), []);
  assert.deepEqual(brief(await run([entry("Store the thesis")], { "SPEC.md": "# Fixture\n" })),
    [[the("Store the thesis"), "error", MODULES, "the item names no module the architecture describes"]]);
});

// TST-616010 · level: unit · module: MOD-work-plans
// guards: UC-032
// given: the module's workStrategies
// input: its recipes, checks and writers
// expect: the check backlog-checks stands beside plan-checks and sprint-record-checks, and the recipes (architecture-and-model, backlog-inputs, sprint-facts) and writers (backlog-items, ITM-617, and sprint-record) are those built before: nothing already registered changes
// Planted fault: replacing the checks object instead of adding to it removes plan-checks and sprint-record-checks.
test("workStrategies — adds the check backlog-checks and changes no registration", () => {
  assert.equal(typeof workStrategies.checks?.["backlog-checks"], "function");
  assert.deepEqual(Object.keys(workStrategies.checks).sort(), ["backlog-checks", "plan-checks", "sprint-record-checks"]);
  assert.deepEqual(Object.keys(workStrategies.recipes), ["architecture-and-model", "backlog-inputs", "sprint-facts"]);
  assert.deepEqual(Object.keys(workStrategies.writers), ["backlog-items", "sprint-record"]);
});

// TST-616011 · level: unit · module: MOD-work-plans
// guards: UC-032
// given: a fetch that records every call, in place of the global fetch; a known positive first — the test calls it once; a draft with an error in each of three kinds and a warning
// input: the check backlog-checks twice on that draft, with the JSON of the draft taken before and after
// expect: the recording fetch saw one call (the test's own) and no more; both results are equal and hold four findings; the draft is as it was; every finding read back with parseFinding(formatFinding(it)) is the finding itself
// Planted fault: a check that changes the draft's entries, or reads through fetch, fails; a finding not in the compiler form fails the round trip.
test("backlog-checks — it makes no request, changes nothing it is given, and its findings are in the compiler form", async () => {
  const draft = { items: [entry("Export thesis as PDF", { realises: [], modules: ["MOD-ghost"], buildsOn: ["ITM-099"] })] };
  const before = JSON.stringify(draft);
  const real = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (...args) => { calls.push(args); return { ok: true }; };
  try {
    await globalThis.fetch("https://spy.invalid/known-positive");
    assert.equal(calls.length, 1, "the recording fetch sees a call that is made");
    const first = await check(draft, contextOf()), second = await check(draft, contextOf());
    assert.equal(first.length, 4);
    assert.deepEqual(second, first);
    assert.equal(calls.length, 1, "the check made no call");
    for (const each of first) assert.deepEqual(parseFinding(formatFinding(each)), each);
  } finally {
    globalThis.fetch = real;
  }
  assert.equal(JSON.stringify(draft), before);
});
