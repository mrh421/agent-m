// Release tests of ITM-1290 — a form's finding on a key the document lacks stands beside that key's field, on every form the dashboard builds from a schema. The behaviour is MOD-site-frame's schemaForm as
// docs/architecture/MOD-site-frame.md states it (Interfaces, schemaForm): "a form with one field per key and section of a schema of MOD-documents [...]; the findings of `documentFindings` and of `extraChecks` shown beside
// their fields while typing [...]; *Save* offered only while no error remains, so an invalid register is never saved", "It writes nothing itself: `onSave` does", and A FINDING READS LIKE A COMPILER MESSAGE (SPEC.md): every
// finding "names the artifact and line it concerns". Run: node --test tests/release-itm-1290-missing-key-beside-field.test.mjs
//
// Module: MOD-site-frame; MOD-documents; MOD-product-process
// Guards: A FINDING READS LIKE A COMPILER MESSAGE
// Level: release
//
// Written for the release testing of sprint 119 by a participant who implemented none of ITM-1290 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The forms are built by the real schemaForm over the real schemas the dashboard
// builds forms from — the backlog item of MOD-documents (the form of an issue's move into the backlog), the declaration of a product's process of MOD-product-process (the form of the process page) and the use case of
// MOD-documents — and over documents read as MOD-documents reads their files. The small DOM of tests/site-frame-dom.mjs stands for the browser; a person's click is the one the browser marks trusted (`isTrusted`). The cases
// look at the form from outside: the findings listed beside each field, the findings listed at the end of the form, Save, and what onSave and extraChecks are handed. Readings the texts leave open, which the cases state:
//   - "beside their fields": a finding stands beside the field of the key on whose line it falls; the cases look for the finding by the words "the key <key> is required", the words MOD-documents' finding on a required key
//     has, and look at where it stands, never at what the form reads of it.
//   - "a finding on a line no field holds": line 1 of the file (the line of the opening ---) and the line of a key the schema does not know. A finding whose words name a key but whose line is one of these stays at the end of
//     the form; a finding on a key's own line is beside that key's field whatever its words.
//   - "what onSave hands over is unchanged": a key whose field is empty is left out of the document handed over, not handed over with an empty value, and the keys that stand keep the schema's order.
// Nothing reaches the network.

import test from "node:test";
import assert from "node:assert/strict";
import { document } from "./site-frame-dom.mjs";

const { schemaForm } = await import("../src/site-frame/index.mjs");
const { artifactSchemas, readDocument } = await import("../src/documents/index.mjs");
const { declarationSchema } = await import("../src/product-process/index.mjs");

function elements(root, match) {
  const found = [];
  (function walk(n) { for (const k of n.childNodes) if (k.nodeType === 1) { if (match(k)) found.push(k); walk(k); } })(root);
  return found;
}
const byTag = (root, name) => elements(root, (e) => e.localName === name);
const turn = () => new Promise((resolve) => setImmediate(resolve));
const fieldOf = (form, key) => elements(form, (e) => e.getAttribute("data-key") === key)[0];
const inputOf = (form, key) => byTag(fieldOf(form, key), "input")[0];
const besideOf = (form, key) => byTag(fieldOf(form, key), "li").map((each) => each.textContent);
// The findings at the end of the form: the list that is a child of the form itself, not of a field.
const endOf = (form) => byTag([...form.childNodes].find((n) => n.nodeType === 1 && n.localName === "ul"), "li").map((each) => each.textContent);
// Every finding beside a field of a key, by key, for the keys that have one.
const besideAll = (form) => Object.fromEntries(elements(form, (e) => e.getAttribute("data-key") !== undefined && e.getAttribute("data-key") !== null)
  .map((field) => [field.getAttribute("data-key"), byTag(field, "li").map((each) => each.textContent)]).filter(([, texts]) => texts.length));
const saveOf = (form) => byTag(form, "button").at(-1);
const typeInto = async (input, text) => { input.value = text; input.dispatchEvent(new Event("input")); await turn(); };
const persons = async (node) => { node.dispatchEvent(Object.defineProperty(new Event("click"), "isTrusted", { value: true })); await turn(); };
const requiredOf = (key) => `the key ${key} is required`;
const names = (texts, key) => texts.some((text) => text.includes(requiredOf(key)));

// The backlog item of the move form, with the optional list builds_on; the keys required are id, title, level, realises, modules, tests and origin.
const ITEM_PATH = "docs/backlog/ITM-001-export-keeps-every-page.md";
const ITEM = ["---", "id: ITM-001", "title: Export keeps every page", "level: module", "realises:", "  - FIRST RULE", "modules:", "  - MOD-store", "builds_on:", "  - ITM-000", "tests:", "  - unit", "origin:",
  "  - https://github.com/alice/product/issues/7", "---", "# ITM-001 Export keeps every page", "", "## Outcome", "", "Every page is exported.", "", "## Acceptance", "", "- A unit test.", ""].join("\n");
const ITEM_KEYS = ["id", "title", "level", "realises", "modules", "tests", "origin"];
// The item as the move form is given a drafted one: the lists realises, modules and origin are not written, since the draft has no name for them.
const ITEM_DRAFT = ["---", "id: ITM-002", "title: Export keeps every page", "level: module", "tests:", "  - unit", "---", "# ITM-002 Export keeps every page", "", "## Outcome", "", "Every page is exported.", "", "## Acceptance", "",
  "- A unit test.", ""].join("\n");
const ITEM_DRAFT_PATH = "docs/backlog/ITM-002-export-keeps-every-page.md";
// The declaration of the process page; the keys required are model, model_file and model_version.
const DECLARATION_PATH = "docs/process.md";
const DECLARATION = ["---", "model: Scrum", "model_file: docs/process-models/scrum.md", `model_version: ${"a".repeat(40)}`, "---", "# Process of the product", "", "## Practices", "", "- none", "", "## Branches", "",
  "| Phase or time box | Branch |", "| --- | --- |", "| sprint | sprint/1 |", "", "## Definition of Done", "", "The job rules hold, and no condition is added.", ""].join("\n");
const DECLARATION_KEYS = ["model", "model_file", "model_version"];
// The use case, whose required keys are two texts (title, area) and two lists (actors, realises), besides id.
const USE_CASE_PATH = "docs/use-cases/UC-001-export-a-page.md";
const USE_CASE = ["---", "id: UC-001", "title: Export a page", "area: export", "actors:", "  - Reader", "realises:", "  - FIRST RULE", "---", "# UC-001 Export a page", "", "## Actors", "", "Reader.", "", "## Precondition", "", "A page.", "",
  "## Main flow", "", "1. Export.", "", "```mermaid", "flowchart LR", "  A-->B", "```", "", "## Alternative flows", "", "None.", "", "## Postcondition", "", "Exported.", ""].join("\n");
const USE_CASE_KEYS = ["id", "title", "area", "actors", "realises"];

const FORMS = {
  item: { schema: () => artifactSchemas().item, path: ITEM_PATH, text: ITEM, keys: ITEM_KEYS },
  declaration: { schema: () => declarationSchema, path: DECLARATION_PATH, text: DECLARATION, keys: DECLARATION_KEYS },
  "use case": { schema: () => artifactSchemas().useCase, path: USE_CASE_PATH, text: USE_CASE, keys: USE_CASE_KEYS },
};
// A form over a document read from `text` (the form's own when none is given), or over a new document when `text` is null.
function formOver(kind, { text = FORMS[kind].text, onSave = async () => {}, extraChecks } = {}) {
  const { schema, path } = FORMS[kind];
  const loaded = schema();
  return schemaForm(loaded, text === null ? null : readDocument(loaded, path, text), { onSave, ...(extraChecks ? { extraChecks } : {}) });
}
const WITH_COLOUR = { item: ITEM.replace("  - https://github.com/alice/product/issues/7\n", "  - https://github.com/alice/product/issues/7\ncolour: blue\n"),
  declaration: DECLARATION.replace(`model_version: ${"a".repeat(40)}\n`, `model_version: ${"a".repeat(40)}\ncolour: blue\n`) };

// TST-1290301 · level: release · module: MOD-site-frame
// guards: A FINDING READS LIKE A COMPILER MESSAGE
// given: known positive first — a form over the valid backlog item ITM-001, the form of an issue's move into the backlog, shows no finding beside any field and none at its end
// input: for each required key of the item — id, title, level, realises, modules, tests, origin: a text, an enum and four lists — the person empties that key's field alone, in a form of its own
// expect: the finding "the key <key> is required" stands beside the field of that key, and beside no other field, and the end of the form does not list it. Counter-proof: a form that leaves the finding on a key it lacks at the form's end shows it there and beside nothing
test("ITM-1290: on the item form, emptying any required key puts its finding beside its field", async () => {
  const known = formOver("item");
  assert.deepEqual([besideAll(known), endOf(known)], [{}, []], "known positive: no finding anywhere");
  for (const key of ITEM_KEYS) {
    const form = formOver("item");
    await typeInto(inputOf(form, key), "");
    const beside = besideAll(form);
    assert.ok(names(beside[key] ?? [], key), `${key}: beside its field: ${JSON.stringify(beside)}; at the end: ${endOf(form).join(" | ")}`);
    assert.deepEqual(Object.keys(beside).filter((other) => other !== key && names(beside[other], key)), [], `${key}: the finding stands beside another field`);
    assert.ok(!names(endOf(form), key), `${key}: the finding is listed at the end of the form: ${endOf(form).join(" | ")}`);
  }
});

// TST-1290302 · level: release · module: MOD-site-frame; MOD-product-process
// guards: A FINDING READS LIKE A COMPILER MESSAGE
// given: known positive first — a form over a valid declaration docs/process.md, the form of the process page, shows no finding beside any field and none at its end
// input: for each required key of the declaration — model, model_file, model_version — the person empties that key's field alone, in a form of its own
// expect: the finding "the key <key> is required" stands beside the field of that key, and beside no other field, and the end of the form does not list it. Counter-proof: a form that leaves the finding on a key it lacks at the form's end shows it there and beside nothing
test("ITM-1290: on the declaration form, emptying any required key puts its finding beside its field", async () => {
  const known = formOver("declaration");
  assert.deepEqual([besideAll(known), endOf(known)], [{}, []], "known positive: no finding anywhere");
  for (const key of DECLARATION_KEYS) {
    const form = formOver("declaration");
    await typeInto(inputOf(form, key), "");
    const beside = besideAll(form);
    assert.ok(names(beside[key] ?? [], key), `${key}: beside its field: ${JSON.stringify(beside)}; at the end: ${endOf(form).join(" | ")}`);
    assert.deepEqual(Object.keys(beside).filter((other) => other !== key && names(beside[other], key)), [], `${key}: the finding stands beside another field`);
    assert.ok(!names(endOf(form), key), `${key}: the finding is listed at the end of the form: ${endOf(form).join(" | ")}`);
  }
});

// TST-1290303 · level: release · module: MOD-site-frame
// guards: A FINDING READS LIKE A COMPILER MESSAGE
// given: known positive first — a form over a valid use case UC-001 shows no finding beside any field and none at its end
// input: for each required key of the use case — id, the texts title and area, the lists actors and realises — the person empties that key's field alone, in a form of its own
// expect: the finding "the key <key> is required" stands beside the field of that key, and beside no other field, and the end of the form does not list it. Counter-proof: a form that leaves the finding on a key it lacks at the form's end shows it there and beside nothing
test("ITM-1290: on the use-case form, emptying any required key, text or list, puts its finding beside its field", async () => {
  const known = formOver("use case");
  assert.deepEqual([besideAll(known), endOf(known)], [{}, []], "known positive: no finding anywhere");
  for (const key of USE_CASE_KEYS) {
    const form = formOver("use case");
    await typeInto(inputOf(form, key), "");
    const beside = besideAll(form);
    assert.ok(names(beside[key] ?? [], key), `${key}: beside its field: ${JSON.stringify(beside)}; at the end: ${endOf(form).join(" | ")}`);
    assert.deepEqual(Object.keys(beside).filter((other) => other !== key && names(beside[other], key)), [], `${key}: the finding stands beside another field`);
    assert.ok(!names(endOf(form), key), `${key}: the finding is listed at the end of the form: ${endOf(form).join(" | ")}`);
  }
});

// TST-1290304 · level: release · module: MOD-site-frame
// guards: A FINDING READS LIKE A COMPILER MESSAGE
// given: a form over the valid item ITM-001, and one over the valid declaration
// input: on the item form the person empties modules, then title, then types "MOD-store" into modules again; on the declaration form the person empties model, then model_file, then types "Scrum" into model again
// expect: after each step the findings follow the typing: both emptied keys have their finding beside their own field and none stands at the end; once a key is typed again its finding is gone from beside its field while the finding of the key still empty stays beside that key's field
test("ITM-1290: while the person types, each emptied key keeps its finding beside its field and a refilled key loses it", async () => {
  const item = formOver("item");
  await typeInto(inputOf(item, "modules"), "");
  assert.ok(names(besideOf(item, "modules"), "modules") && !names(besideOf(item, "title"), "title"), JSON.stringify(besideAll(item)));
  await typeInto(inputOf(item, "title"), "");
  assert.ok(names(besideOf(item, "modules"), "modules") && names(besideOf(item, "title"), "title"), JSON.stringify(besideAll(item)));
  assert.deepEqual(endOf(item), [], "none at the end of the item form");
  await typeInto(inputOf(item, "modules"), "MOD-store");
  assert.ok(!names(besideOf(item, "modules"), "modules"), `modules refilled: ${besideOf(item, "modules").join(" | ")}`);
  assert.ok(names(besideOf(item, "title"), "title"), `title still empty: ${JSON.stringify(besideAll(item))}`);
  const declaration = formOver("declaration");
  await typeInto(inputOf(declaration, "model"), "");
  await typeInto(inputOf(declaration, "model_file"), "");
  assert.ok(names(besideOf(declaration, "model"), "model") && names(besideOf(declaration, "model_file"), "model_file"), JSON.stringify(besideAll(declaration)));
  assert.deepEqual(endOf(declaration), [], "none at the end of the declaration form");
  await typeInto(inputOf(declaration, "model"), "Scrum");
  assert.ok(!names(besideOf(declaration, "model"), "model"), `model refilled: ${besideOf(declaration, "model").join(" | ")}`);
  assert.ok(names(besideOf(declaration, "model_file"), "model_file"), `model_file still empty: ${JSON.stringify(besideAll(declaration))}`);
});

// TST-1290305 · level: release · module: MOD-site-frame; MOD-product-process
// guards: A FINDING READS LIKE A COMPILER MESSAGE
// given: a form over no document (a new one) of the item schema, of the declaration schema and of the use-case schema, and a form over a drafted item ITM-002 written without realises, modules and origin, as the move form is given one
// input: the forms are built and nothing is typed; then, on the new declaration form, the person types "Scrum" into model
// expect: on each form every required key's field has the finding "the key <key> is required" beside it, and the end of the form lists no such finding; the end keeps the findings of the sections and the path, which no field holds; on the declaration form the typed key's finding is gone and the other two stay beside their fields
test("ITM-1290: on a new document, each empty required field has its finding beside it", async () => {
  const draft = schemaForm(artifactSchemas().item, readDocument(artifactSchemas().item, ITEM_DRAFT_PATH, ITEM_DRAFT), { onSave: async () => {} });
  const cases = [["item", formOver("item", { text: null }), ITEM_KEYS, true], ["declaration", formOver("declaration", { text: null }), DECLARATION_KEYS, true],
    ["use case", formOver("use case", { text: null }), USE_CASE_KEYS, true], ["drafted item", draft, ["realises", "modules", "origin"], false]];
  for (const [kind, form, keys, isNew] of cases) {
    const beside = besideAll(form);
    for (const key of keys) assert.ok(names(beside[key] ?? [], key), `${kind}: ${key} beside its field: ${JSON.stringify(beside)}`);
    assert.ok(!endOf(form).some((each) => /the key \S+ is required/.test(each)), `${kind}: a required key listed at the end: ${endOf(form).join(" | ")}`);
    if (isNew) assert.ok(endOf(form).length > 0, `${kind}: the end keeps the findings no field holds`);
  }
  const form = formOver("declaration", { text: null });
  await typeInto(inputOf(form, "model"), "Scrum");
  assert.ok(!names(besideOf(form, "model"), "model"), `model typed: ${besideOf(form, "model").join(" | ")}`);
  assert.ok(names(besideOf(form, "model_file"), "model_file") && names(besideOf(form, "model_version"), "model_version"), JSON.stringify(besideAll(form)));
});

// TST-1290306 · level: release · module: MOD-site-frame; MOD-product-process
// guards: A FINDING READS LIKE A COMPILER MESSAGE
// given: a form over the item ITM-001 with the key colour, and a form over the declaration with the key colour, neither of which the schema knows, each with an extraChecks that gives a warning on line 1 whose what reads "the caller asks for a value of modules" and whose fix reads "give the key title a value" (the declaration's: "a value of model" and "give the key model_file a value")
// input: the forms are built; then on each the person empties the field of one required key (the item's modules, the declaration's model_version)
// expect: known positive — documentFindings' finding that colour is not a key of the format stands at the end of each form, beside no field; the warning on line 1 stands at the end whatever key its words name, beside no field; the emptied key's own finding stands beside its field and not at the end, and the other two stay at the end
test("ITM-1290: a finding on a line no field holds stays at the end of the form, whatever key its words name", async () => {
  const warningOf = (what, fix) => ({ artifact: "docs", line: 1, kind: "warning", rule: "A FINDING READS LIKE A COMPILER MESSAGE", what, fix });
  for (const [kind, what, fix, emptied] of [["item", "the caller asks for a value of modules", "give the key title a value", "modules"], ["declaration", "the caller asks for a value of model", "give the key model_file a value", "model_version"]]) {
    const form = formOver(kind, { text: WITH_COLOUR[kind], extraChecks: () => [warningOf(what, fix)] });
    const end = endOf(form);
    assert.ok(end.some((text) => text.includes("colour is not a key of the format")), `${kind}: known positive: ${end.join(" | ")}`);
    assert.ok(end.some((text) => text.includes(what)), `${kind}: the warning stands at the end: ${end.join(" | ")}`);
    assert.deepEqual(besideAll(form), {}, `${kind}: nothing beside any field`);
    await typeInto(inputOf(form, emptied), "");
    assert.ok(names(besideOf(form, emptied), emptied), `${kind}: ${emptied} beside its field: ${JSON.stringify(besideAll(form))}`);
    const after = endOf(form);
    assert.ok(!names(after, emptied) && after.some((text) => text.includes("colour is not a key of the format")) && after.some((text) => text.includes(what)), `${kind}: at the end: ${after.join(" | ")}`);
    assert.ok(Object.values(besideAll(form)).flat().every((text) => !text.includes("colour") && !text.includes("the caller")), `${kind}: beside the fields: ${JSON.stringify(besideAll(form))}`);
  }
});

// TST-1290307 · level: release · module: MOD-site-frame; MOD-product-process
// guards: A FINDING READS LIKE A COMPILER MESSAGE
// given: a form over the valid item ITM-001, one over the valid declaration and one over the valid use case, each with an onSave that records what it is handed; known positive: Save is offered on each
// input: on each form the person empties one required key (the item's modules, the declaration's model, the use case's actors), clicks Save, then types the key again and clicks Save
// expect: while the key is empty Save is not offered and the click calls onSave not at all; once the key is typed again Save is offered and the click calls onSave once, with the document whose field for that key holds what was typed
test("ITM-1290: Save is withheld while a required key is empty, on every form", async () => {
  for (const [kind, key, typed, expected] of [["item", "modules", "MOD-store", ["MOD-store"]], ["declaration", "model", "Kanban", "Kanban"], ["use case", "actors", "Reader, Editor", ["Reader", "Editor"]]]) {
    const handed = [];
    const form = formOver(kind, { onSave: async (given) => { handed.push(given); } });
    assert.equal(saveOf(form).disabled, false, `${kind}: known positive: Save is offered`);
    await typeInto(inputOf(form, key), "");
    assert.equal(saveOf(form).disabled, true, `${kind}: Save is offered while ${key} is empty`);
    await persons(saveOf(form));
    assert.equal(handed.length, 0, `${kind}: onSave was called while ${key} is empty`);
    await typeInto(inputOf(form, key), typed);
    assert.equal(saveOf(form).disabled, false, `${kind}: Save is not offered once ${key} is typed again`);
    await persons(saveOf(form));
    assert.equal(handed.length, 1, `${kind}: onSave is called once`);
    assert.deepEqual(handed[0].fields[key], expected, `${kind}: ${key} as handed over`);
  }
});

// TST-1290308 · level: release · module: MOD-site-frame; MOD-product-process
// guards: A FINDING READS LIKE A COMPILER MESSAGE
// given: a form over the valid item ITM-001, whose optional list builds_on holds ITM-000, with an onSave that records what it is handed and an extraChecks that records the document it is given; and a form over the valid declaration with the same two
// input: on the item form the person empties the optional builds_on and clicks Save; on each form the person then empties a required key (the item's modules, the declaration's model_file) and the recorded extraChecks document is read
// expect: onSave is handed the item with builds_on left out, not empty, and its other keys id, title, level, realises, modules, tests, origin in the schema's order with their values; while a required key is empty the document extraChecks is given leaves that key out too (the key is not among its fields, not even with an empty value), on both forms
test("ITM-1290: what onSave and extraChecks are handed has an emptied key left out", async () => {
  const handed = [], given = [];
  const item = formOver("item", { onSave: async (document_) => { handed.push(document_); }, extraChecks: (document_) => { given.push(document_); return []; } });
  await typeInto(inputOf(item, "builds_on"), "");
  assert.deepEqual(besideAll(item), {}, "an optional key emptied has no finding");
  assert.equal(saveOf(item).disabled, false, "Save is offered with an optional key empty");
  await persons(saveOf(item));
  assert.equal(handed.length, 1);
  assert.deepEqual(Object.keys(handed[0].fields), ITEM_KEYS, "the keys that stand, in the schema's order, builds_on left out");
  assert.deepEqual(handed[0].fields.modules, ["MOD-store"]);
  assert.equal(handed[0].fields.title, "Export keeps every page");
  await typeInto(inputOf(item, "modules"), "");
  assert.ok(!("modules" in given.at(-1).fields), `extraChecks is given the item with modules: ${JSON.stringify(given.at(-1).fields.modules)}`);
  assert.ok(names(besideOf(item, "modules"), "modules"), JSON.stringify(besideAll(item)));
  const seen = [];
  const declaration = formOver("declaration", { extraChecks: (document_) => { seen.push(document_); return []; } });
  await typeInto(inputOf(declaration, "model_file"), "");
  assert.ok(!("model_file" in seen.at(-1).fields), `extraChecks is given the declaration with model_file: ${JSON.stringify(seen.at(-1).fields.model_file)}`);
  assert.deepEqual(Object.keys(seen.at(-1).fields), ["model", "model_version"], "the other keys stand");
  assert.ok(names(besideOf(declaration, "model_file"), "model_file"), JSON.stringify(besideAll(declaration)));
});
