// A backlog's findings (UC-032 step 3; ITM-688) — MOD-work-plans' interface as the accepted text of
// docs/architecture/MOD-work-plans.md states it: backlogFindings(items, architecture), "an item that realises nothing; that
// names no module the architecture describes; that builds on an item that does not exist, or on one that builds on it in turn;
// and, as a warning, an item that restates an existing one". Pure: it makes no request.
// Run: node --test tests/work-plans-backlog-findings.test.mjs
//
// Module: MOD-work-plans
// Guards: A BACKLOG ITEM NAMES WHAT IT REALISES; A BACKLOG ITEM NAMES THE MODULES IT CHANGES; THE BACKLOG LIVES IN THE PRODUCT REPOSITORY; EXACT DUPLICATES ARE FOUND WITHOUT A MODEL; UC-032
// Level: unit
//
// The fixture product's architecture has two module files, MOD-store and MOD-pages, and one decision, ARC-001, which is no
// module. An item and a module file are Documents in the form MOD-documents' readDocument gives — kind, path, id, title,
// fields —, written here with only the fields the function reads; the last test reads them with readDocument. Each test
// states its input and its expected result before it runs (given / input / expect), and the expected values are written in
// the test. Nothing reaches the network.

import test from "node:test";
import assert from "node:assert/strict";
import { artifactSchemas, readDocument } from "../src/documents/index.mjs";
import { formatFinding, parseFinding } from "../src/text-tools/index.mjs";
import * as plans from "../src/work-plans/index.mjs";

// ---------------------------------------------------------------- the fixture product

const moduleFile = (id) => ({ kind: "module", path: `docs/architecture/${id}.md`, id, title: id,
  fields: { id, uses: [] }, sections: [], appended: [], body: "" });
const ARCHITECTURE = [
  moduleFile("MOD-store"),
  moduleFile("MOD-pages"),
  { kind: "decision", path: "docs/architecture/ARC-001-the-system.md", id: "ARC-001", title: "ARC-001 The system",
    fields: { id: "ARC-001" }, sections: [], appended: [], body: "" },
];

// An item that is sound unless a field is overridden: it realises a requirement, changes MOD-store, builds on nothing.
const item = (id, over = {}) => ({ kind: "item", path: `docs/backlog/${id}-the-work.md`, id, title: `${id} The work`,
  fields: { id, title: `The work of ${id}`, realises: ["EXPORT IS A PDF"], modules: ["MOD-store"], builds_on: [], ...over },
  sections: [], appended: [], body: "" });

const findings = (items, architecture = ARCHITECTURE) => plans.backlogFindings(items, architecture);
const brief = (list) => list.map((f) => [f.artifact, f.kind, f.rule, f.what]);

const REALISES = "A BACKLOG ITEM NAMES WHAT IT REALISES";
const MODULES = "A BACKLOG ITEM NAMES THE MODULES IT CHANGES";
const BACKLOG = "THE BACKLOG LIVES IN THE PRODUCT REPOSITORY";
const DUPLICATE = "EXACT DUPLICATES ARE FOUND WITHOUT A MODEL";

// TST-688001 · level: unit · module: MOD-work-plans
// guards: A BACKLOG ITEM NAMES WHAT IT REALISES; A BACKLOG ITEM NAMES THE MODULES IT CHANGES; UC-032
// given: known positive first — a backlog of two sound items: ITM-001 realises EXPORT IS A PDF and changes MOD-store; ITM-002 realises UC-001, changes MOD-pages and builds on ITM-001
// input: backlogFindings(those items, the architecture); then an empty backlog
// expect: no finding for the sound backlog, and no finding for the empty one
test("backlogFindings — a sound backlog has no finding", () => {
  const sound = [item("ITM-001"), item("ITM-002", { realises: ["UC-001"], modules: ["MOD-pages"], builds_on: ["ITM-001"] })];
  assert.deepEqual(findings(sound), []);
  assert.deepEqual(findings([]), []);
});

// TST-688002 · level: unit · module: MOD-work-plans
// guards: A BACKLOG ITEM NAMES WHAT IT REALISES; UC-032
// given: ITM-002 whose realises list is empty
// input: backlogFindings([ITM-001 sound, ITM-002], the architecture)
// expect: exactly one finding, whole: artifact ITM-002, line 1, kind error, rule A BACKLOG ITEM NAMES WHAT IT REALISES, what "the item realises nothing", fix "name at least one requirement or use case the item realises, or remove the item"
test("backlogFindings — an item that realises nothing is an error", () => {
  assert.deepEqual(findings([item("ITM-001"), item("ITM-002", { realises: [] })]), [{
    artifact: "ITM-002", line: 1, kind: "error", rule: REALISES, what: "the item realises nothing",
    fix: "name at least one requirement or use case the item realises, or remove the item" }]);
});

// TST-688003 · level: unit · module: MOD-work-plans
// guards: A BACKLOG ITEM NAMES WHAT IT REALISES; UC-032
// given: items that realise nothing in the other forms a Document holds that: no realises field, a list of one blank entry, a line of text holding only a comma; and the counter-proof, an item whose realises is the line "EXPORT IS A PDF, UC-001"
// input: backlogFindings of each alone
// expect: for the first three, one error ITM-001 A BACKLOG ITEM NAMES WHAT IT REALISES "the item realises nothing"; for the counter-proof, no finding
test("backlogFindings — an absent, blank or comma-only realises names nothing; a line of two names is two names", () => {
  const without = item("ITM-001");
  delete without.fields.realises;
  for (const each of [without, item("ITM-001", { realises: [""] }), item("ITM-001", { realises: " , " })]) {
    assert.deepEqual(brief(findings([each])), [["ITM-001", "error", REALISES, "the item realises nothing"]]);
  }
  assert.deepEqual(findings([item("ITM-001", { realises: "EXPORT IS A PDF, UC-001" })]), []);
});

// TST-688004 · level: unit · module: MOD-work-plans
// guards: A BACKLOG ITEM NAMES THE MODULES IT CHANGES; UC-032
// given: items that name no module the architecture describes: modules MOD-ghost, which the architecture lacks; modules empty; modules ARC-001, a decision of the architecture that is no module
// input: backlogFindings of each alone
// expect: for each, one error ITM-001 A BACKLOG ITEM NAMES THE MODULES IT CHANGES "the item names no module the architecture describes", with line 1 and kind error
test("backlogFindings — an item that names no module the architecture describes is an error", () => {
  for (const modules of [["MOD-ghost"], [], ["ARC-001"]]) {
    const [only, ...rest] = findings([item("ITM-001", { modules })]);
    assert.deepEqual(rest, []);
    assert.deepEqual([only.artifact, only.line, only.kind, only.rule, only.what],
      ["ITM-001", 1, "error", MODULES, "the item names no module the architecture describes"]);
  }
});

// TST-688005 · level: unit · module: MOD-work-plans
// guards: A BACKLOG ITEM NAMES THE MODULES IT CHANGES; UC-032
// given: counter-proofs of the test above — an item naming MOD-store; an item naming MOD-pages and MOD-store; and an architecture handed in as null with an item naming MOD-store
// input: backlogFindings of each alone
// expect: no finding for the first two; for the null architecture one error ITM-001 A BACKLOG ITEM NAMES THE MODULES IT CHANGES
test("backlogFindings — an item that names a module the architecture describes has no module finding", () => {
  assert.deepEqual(findings([item("ITM-001", { modules: ["MOD-store"] })]), []);
  assert.deepEqual(findings([item("ITM-001", { modules: ["MOD-pages", "MOD-store"] })]), []);
  assert.deepEqual(brief(findings([item("ITM-001")], null)), [["ITM-001", "error", MODULES, "the item names no module the architecture describes"]]);
});

// TST-688006 · level: unit · module: MOD-work-plans
// guards: THE BACKLOG LIVES IN THE PRODUCT REPOSITORY; UC-032
// given: ITM-002 builds on ITM-099, which is in no item of the backlog; ITM-003 builds on ITM-001, which is
// input: backlogFindings([ITM-001, ITM-002, ITM-003], the architecture)
// expect: exactly one finding: ITM-002 error THE BACKLOG LIVES IN THE PRODUCT REPOSITORY "the item builds on ITM-099, which does not exist"; ITM-003 has none
test("backlogFindings — an item that builds on an item that does not exist is an error", () => {
  const backlog = [item("ITM-001"), item("ITM-002", { builds_on: ["ITM-099"] }), item("ITM-003", { builds_on: ["ITM-001"] })];
  assert.deepEqual(brief(findings(backlog)), [["ITM-002", "error", BACKLOG, "the item builds on ITM-099, which does not exist"]]);
});

// TST-688007 · level: unit · module: MOD-work-plans
// guards: THE BACKLOG LIVES IN THE PRODUCT REPOSITORY; UC-032
// given: ITM-001 builds on ITM-002 and ITM-002 builds on ITM-001; then the counter-proof, where only ITM-002 builds on ITM-001; then an item that builds on itself
// input: backlogFindings of each backlog
// expect: for the pair, two errors, in the order of the items: ITM-001 "the item builds on ITM-002, which builds on it in turn" and ITM-002 "the item builds on ITM-001, which builds on it in turn"; for the one-way build, none; for the item that builds on itself, one error ITM-001 "the item builds on ITM-001, which builds on it in turn"
test("backlogFindings — an item that builds on one that builds on it in turn is an error, for each of the two", () => {
  assert.deepEqual(brief(findings([item("ITM-001", { builds_on: ["ITM-002"] }), item("ITM-002", { builds_on: ["ITM-001"] })])), [
    ["ITM-001", "error", BACKLOG, "the item builds on ITM-002, which builds on it in turn"],
    ["ITM-002", "error", BACKLOG, "the item builds on ITM-001, which builds on it in turn"]]);
  assert.deepEqual(findings([item("ITM-001"), item("ITM-002", { builds_on: ["ITM-001"] })]), []);
  assert.deepEqual(brief(findings([item("ITM-001", { builds_on: ["ITM-001"] })])),
    [["ITM-001", "error", BACKLOG, "the item builds on ITM-001, which builds on it in turn"]]);
});

// TST-688008 · level: unit · module: MOD-work-plans
// guards: THE BACKLOG LIVES IN THE PRODUCT REPOSITORY; UC-032
// given: "builds on one that builds on it in turn" read through any number of items — a circle of three, ITM-001 on ITM-002, ITM-002 on ITM-003, ITM-003 on ITM-001
// input: backlogFindings of the three
// expect: three errors, one for each item of the circle, in the order of the items: ITM-001 "the item builds on ITM-002, which builds on it in turn", ITM-002 "... ITM-003 ...", ITM-003 "... ITM-001 ...", each under THE BACKLOG LIVES IN THE PRODUCT REPOSITORY
test("backlogFindings — a circle of three items is an error on each of the three", () => {
  assert.deepEqual(brief(findings([item("ITM-001", { builds_on: ["ITM-002"] }), item("ITM-002", { builds_on: ["ITM-003"] }),
    item("ITM-003", { builds_on: ["ITM-001"] })])), [
    ["ITM-001", "error", BACKLOG, "the item builds on ITM-002, which builds on it in turn"],
    ["ITM-002", "error", BACKLOG, "the item builds on ITM-003, which builds on it in turn"],
    ["ITM-003", "error", BACKLOG, "the item builds on ITM-001, which builds on it in turn"]]);
});

// TST-688009 · level: unit · module: MOD-work-plans
// guards: EXACT DUPLICATES ARE FOUND WITHOUT A MODEL; UC-032
// given: ITM-001 titled "Export the thesis as PDF" and ITM-002 titled "  export  THE thesis as PDF " (case and spacing differ); ITM-003 titled "Export the thesis as Word"
// input: backlogFindings([ITM-001, ITM-002, ITM-003], the architecture)
// expect: two findings, both warnings, none an error: ITM-001 EXACT DUPLICATES ARE FOUND WITHOUT A MODEL "the item restates ITM-002" and ITM-002 "the item restates ITM-001"; ITM-003 has none
test("backlogFindings — an item that restates another's title is a warning on each of the two", () => {
  const backlog = [item("ITM-001", { title: "Export the thesis as PDF" }), item("ITM-002", { title: "  export  THE thesis as PDF " }),
    item("ITM-003", { title: "Export the thesis as Word" })];
  assert.deepEqual(brief(findings(backlog)), [
    ["ITM-001", "warning", DUPLICATE, "the item restates ITM-002"],
    ["ITM-002", "warning", DUPLICATE, "the item restates ITM-001"]]);
});

// TST-688010 · level: unit · module: MOD-work-plans
// guards: EXACT DUPLICATES ARE FOUND WITHOUT A MODEL; UC-032
// given: counter-proofs of the test above — two items with different titles; two items whose titles are both blank; one item alone with a title; two items with the same title and different outcomes in their Outcome section
// input: backlogFindings of each backlog
// expect: no finding for the first three; for the fourth two warnings (the title decides, the outcome does not): ITM-001 "the item restates ITM-002", ITM-002 "the item restates ITM-001"
test("backlogFindings — different or blank titles restate nothing, and the title alone decides", () => {
  assert.deepEqual(findings([item("ITM-001", { title: "Export as PDF" }), item("ITM-002", { title: "Export as Word" })]), []);
  assert.deepEqual(findings([item("ITM-001", { title: "" }), item("ITM-002", { title: "" })]), []);
  assert.deepEqual(findings([item("ITM-001", { title: "Export as PDF" })]), []);
  const outcome = (id, text) => ({ ...item(id, { title: "Export as PDF" }), sections: [{ heading: "## Outcome", line: 12, text }] });
  assert.deepEqual(brief(findings([outcome("ITM-001", "One outcome."), outcome("ITM-002", "Another outcome.")])), [
    ["ITM-001", "warning", DUPLICATE, "the item restates ITM-002"],
    ["ITM-002", "warning", DUPLICATE, "the item restates ITM-001"]]);
});

// TST-688011 · level: unit · module: MOD-work-plans
// guards: A BACKLOG ITEM NAMES WHAT IT REALISES; A BACKLOG ITEM NAMES THE MODULES IT CHANGES; THE BACKLOG LIVES IN THE PRODUCT REPOSITORY; EXACT DUPLICATES ARE FOUND WITHOUT A MODEL; UC-032
// given: ITM-005 sound, then ITM-004 (given before ITM-006) that realises nothing, names MOD-ghost, builds on ITM-099 and has ITM-006's title; ITM-006 sound with that title
// input: backlogFindings([ITM-005, ITM-004, ITM-006], the architecture)
// expect: for ITM-004, in this order, four errors and one warning: realises nothing, names no module, builds on ITM-099, then the warning restating ITM-006; for ITM-006 the warning restating ITM-004; none for ITM-005; ITM-004's findings stand before ITM-006's
test("backlogFindings — the findings of an item stand in the order realises, modules, builds on, restates; the items in the order given", () => {
  const bad = item("ITM-004", { title: "Same title", realises: [], modules: ["MOD-ghost"], builds_on: ["ITM-099"] });
  const backlog = [item("ITM-005"), bad, item("ITM-006", { title: "Same title" })];
  assert.deepEqual(brief(findings(backlog)), [
    ["ITM-004", "error", REALISES, "the item realises nothing"],
    ["ITM-004", "error", MODULES, "the item names no module the architecture describes"],
    ["ITM-004", "error", BACKLOG, "the item builds on ITM-099, which does not exist"],
    ["ITM-004", "warning", DUPLICATE, "the item restates ITM-006"],
    ["ITM-006", "warning", DUPLICATE, "the item restates ITM-004"]]);
});

// TST-688012 · level: unit · module: MOD-work-plans
// guards: A BACKLOG ITEM NAMES WHAT IT REALISES; UC-032
// given: the backlog of the test above, handed in and then handed in again
// input: backlogFindings twice over the same items and architecture, with the JSON of both taken before and after
// expect: the two results are equal, and the items and the architecture are as they were; every finding read back with parseFinding(formatFinding(it)) is the finding itself
test("backlogFindings — it changes nothing it is given, gives the same result again, and its findings are the compiler form", () => {
  const backlog = [item("ITM-005"), item("ITM-004", { title: "Same title", realises: [], modules: ["MOD-ghost"], builds_on: ["ITM-099"] }),
    item("ITM-006", { title: "Same title" })];
  const before = JSON.stringify([backlog, ARCHITECTURE]);
  const first = findings(backlog), second = findings(backlog);
  assert.equal(first.length, 5);
  assert.deepEqual(second, first);
  assert.equal(JSON.stringify([backlog, ARCHITECTURE]), before);
  for (const each of first) assert.deepEqual(parseFinding(formatFinding(each)), each);
});

// TST-688013 · level: unit · module: MOD-work-plans
// guards: A BACKLOG ITEM NAMES WHAT IT REALISES; UC-032
// given: a fetch that records every call, in place of the global fetch; a known positive first — the test itself calls it once; then a backlog with an error in every kind and a warning
// input: backlogFindings over the faulty backlog, with the recording fetch in place
// expect: the recording fetch saw one call before (the test's own) and still exactly one after backlogFindings ran, which returned five findings; the global fetch is put back
test("backlogFindings — it makes no request", async () => {
  const real = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (...args) => { calls.push(args); return { ok: true }; };
  try {
    await globalThis.fetch("https://spy.invalid/known-positive");
    assert.equal(calls.length, 1, "the recording fetch sees a call that is made");
    const out = findings([item("ITM-005"), item("ITM-004", { title: "Same title", realises: [], modules: ["MOD-ghost"], builds_on: ["ITM-099"] }),
      item("ITM-006", { title: "Same title" })]);
    assert.equal(out.length, 5);
    assert.equal(calls.length, 1, "backlogFindings made no call");
  } finally {
    globalThis.fetch = real;
  }
  assert.equal(globalThis.fetch, real);
});

// TST-688014 · level: unit · module: MOD-work-plans
// guards: A BACKLOG ITEM NAMES WHAT IT REALISES; A BACKLOG ITEM NAMES THE MODULES IT CHANGES; UC-032
// given: two item files and two module files as text, read with MOD-documents' readDocument and the schemas of artifactSchemas — docs/backlog/ITM-001 realising EXPORT IS A PDF and changing MOD-store; docs/backlog/ITM-002 realising UC-001, changing MOD-ghost and building on ITM-001; docs/architecture/MOD-store and MOD-pages
// input: backlogFindings([ITM-001, ITM-002], [MOD-store, MOD-pages]) over the documents read
// expect: exactly one finding: ITM-002 error A BACKLOG ITEM NAMES THE MODULES IT CHANGES "the item names no module the architecture describes"
test("backlogFindings — over documents read from their files by MOD-documents", () => {
  const schemas = artifactSchemas();
  const itemText = (id, title, realises, modules, buildsOn) => [
    "---", `id: ${id}`, `title: ${title}`, "level: module", "realises:", ...realises.map((r) => `  - ${r}`), "modules:",
    ...modules.map((m) => `  - ${m}`), "builds_on:", ...buildsOn.map((b) => `  - ${b}`),
    "tests:", "  - unit", "origin:", "  - UC-032", "---", `# ${id} ${title}`, "", "## Outcome", "", "The work.", "", "## Acceptance", "", "- It works.", ""].join("\n");
  const moduleText = (id) => ["---", `id: ${id}`, `title: The ${id}`, "folder: src/x/", "realises:", "follows:", "  - ARC-001", "uses:", "provides:", "---",
    `# ${id} The ${id}`, "", "## Responsibility", "", "It stores.", ""].join("\n");
  const items = [
    readDocument(schemas.item, "docs/backlog/ITM-001-export.md", itemText("ITM-001", "Export", ["EXPORT IS A PDF"], ["MOD-store"], [])),
    readDocument(schemas.item, "docs/backlog/ITM-002-pages.md", itemText("ITM-002", "Pages", ["UC-001"], ["MOD-ghost"], ["ITM-001"])),
  ];
  const architecture = ["MOD-store", "MOD-pages"].map((id) => readDocument(schemas.module, `docs/architecture/${id}.md`, moduleText(id)));
  assert.deepEqual(brief(findings(items, architecture)), [["ITM-002", "error", MODULES, "the item names no module the architecture describes"]]);
});

// TST-817001 · level: unit · module: MOD-work-plans
// guards: A BACKLOG ITEM NAMES THE MODULES IT CHANGES
// given: ITM-001 naming MOD-store (described) and MOD-ghost (not); ITM-002 naming MOD-ghost, MOD-lost and MOD-pages; counter-proof ITM-003 naming MOD-store and MOD-pages
// input: backlogFindings of each alone
// expect: ITM-001: one error A BACKLOG ITEM NAMES THE MODULES IT CHANGES "the item names MOD-ghost, which the architecture does not describe", line 1; ITM-002: two errors, one naming MOD-ghost and one naming MOD-lost, in that order; ITM-003: no finding
test("backlogFindings — every module an item names that the architecture does not describe is an error naming it", () => {
  const [only, ...rest] = findings([item("ITM-001", { modules: ["MOD-store", "MOD-ghost"] })]);
  assert.deepEqual(rest, []);
  assert.deepEqual([only.artifact, only.line, only.kind, only.rule, only.what],
    ["ITM-001", 1, "error", MODULES, "the item names MOD-ghost, which the architecture does not describe"]);
  assert.deepEqual(brief(findings([item("ITM-002", { modules: ["MOD-ghost", "MOD-lost", "MOD-pages"] })])), [
    ["ITM-002", "error", MODULES, "the item names MOD-ghost, which the architecture does not describe"],
    ["ITM-002", "error", MODULES, "the item names MOD-lost, which the architecture does not describe"]]);
  assert.deepEqual(findings([item("ITM-003", { modules: ["MOD-store", "MOD-pages"] })]), []);
});

// TST-817002 · level: unit · module: MOD-work-plans
// guards: THE BACKLOG LIVES IN THE PRODUCT REPOSITORY
// given: a circle of four, ITM-001 on ITM-002 on ITM-003 on ITM-004 on ITM-001, and ITM-005 building on ITM-001 from outside it; counter-proofs: a chain ITM-001 on ITM-002 on ITM-003, and a diamond ITM-004 on ITM-002 and ITM-003, both on ITM-001
// input: backlogFindings of each backlog
// expect: for the circle, one error "the item builds on <next>, which builds on it in turn" on each of ITM-001 to ITM-004 and none on ITM-005; for the chain and the diamond, no finding
test("backlogFindings — a circle of any length is reported on its items only; a chain or a diamond is not a circle", () => {
  const circle = [item("ITM-001", { builds_on: ["ITM-002"] }), item("ITM-002", { builds_on: ["ITM-003"] }),
    item("ITM-003", { builds_on: ["ITM-004"] }), item("ITM-004", { builds_on: ["ITM-001"] }), item("ITM-005", { builds_on: ["ITM-001"] })];
  assert.deepEqual(brief(findings(circle)), [
    ["ITM-001", "error", BACKLOG, "the item builds on ITM-002, which builds on it in turn"],
    ["ITM-002", "error", BACKLOG, "the item builds on ITM-003, which builds on it in turn"],
    ["ITM-003", "error", BACKLOG, "the item builds on ITM-004, which builds on it in turn"],
    ["ITM-004", "error", BACKLOG, "the item builds on ITM-001, which builds on it in turn"]]);
  assert.deepEqual(findings([item("ITM-001", { builds_on: ["ITM-002"] }), item("ITM-002", { builds_on: ["ITM-003"] }), item("ITM-003")]), []);
  assert.deepEqual(findings([item("ITM-001"), item("ITM-002", { builds_on: ["ITM-001"] }), item("ITM-003", { builds_on: ["ITM-001"] }),
    item("ITM-004", { builds_on: ["ITM-002", "ITM-003"] })]), []);
});
