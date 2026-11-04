// MOD-site-frame's schemaForm hands a key whose value is a list over as a list (ITM-1257), as docs/architecture/MOD-site-frame.md states it (Interfaces, schemaForm): "a form with one field per key and section of a schema of MOD-documents
// [...]; the findings of `documentFindings` and of `extraChecks` shown beside their fields while typing", with `onSave: (document: Document) -> Promise<void>` — and a Document of MOD-documents holds each value of its fields as "a text, a list or a
// number" (src/documents/index.mjs, Document). Run: node --test tests/site-frame-schema-form-lists.test.mjs
//
// Module: MOD-site-frame
// Guards: A BACKLOG ITEM NAMES WHAT IT REALISES; A BACKLOG ITEM NAMES THE MODULES IT CHANGES; UC-033
// Level: unit
//
// The form is built over the real item schema of MOD-documents and an item of the backlog, read as MOD-documents reads the file. The small DOM of tests/site-frame-dom.mjs stands for the browser; a person's click is the one the browser
// marks trusted (`isTrusted`). The reading, named in the pull request: the field of a list key shows the list's items separated by commas, as MOD-documents writes a list on one line, and the text the person types there is the list of
// its parts between commas, each trimmed, an empty part left out; a field left empty leaves the key out. Each test states its input and its expected result before it runs (given / input / expect). Nothing reaches the network.

import test from "node:test";
import assert from "node:assert/strict";
import { document } from "./site-frame-dom.mjs";

const { schemaForm } = await import("../src/site-frame/index.mjs");
const { artifactSchemas, readDocument } = await import("../src/documents/index.mjs");

function elements(root, match) {
  const found = [];
  (function walk(n) { for (const k of n.childNodes) if (k.nodeType === 1) { if (match(k)) found.push(k); walk(k); } })(root);
  return found;
}
const byTag = (root, name) => elements(root, (e) => e.localName === name);
const turn = () => new Promise((resolve) => setImmediate(resolve));
const saveOf = (form) => byTag(form, "button").at(-1);
const fieldOf = (form, key) => elements(form, (e) => e.getAttribute("data-key") === key)[0];
const inputOf = (form, key) => byTag(fieldOf(form, key), "input")[0];
const besideOf = (form, key) => byTag(fieldOf(form, key), "li").map((each) => each.textContent);
const typeInto = async (input, text) => { input.value = text; input.dispatchEvent(new Event("input")); await turn(); };
const persons = async (node) => { node.dispatchEvent(Object.defineProperty(new Event("click"), "isTrusted", { value: true })); await turn(); };

const PATH = "docs/backlog/ITM-001-export-keeps-every-page.md";
const ITEM = ["---", "id: ITM-001", "title: Export keeps every page", "level: module", "realises:", "  - FIRST RULE", "  - THIRD RULE", "modules:", "  - MOD-store", "tests:", "  - unit", "origin:",
  "  - https://github.com/alice/product/issues/7", "---", "# ITM-001 Export keeps every page", "", "## Outcome", "", "Every page is exported.", "", "## Acceptance", "", "- A unit test.", ""].join("\n");
const formOver = (handed) => {
  const schema = artifactSchemas().item;
  return schemaForm(schema, readDocument(schema, PATH, ITEM), { onSave: async (given) => { handed.push(given); } });
};

// TST-1257001 · level: unit · module: MOD-site-frame
// guards: A BACKLOG ITEM NAMES WHAT IT REALISES; A BACKLOG ITEM NAMES THE MODULES IT CHANGES; UC-033
// given: a form over the valid item ITM-001 of the backlog, whose realises are FIRST RULE and THIRD RULE and whose modules are MOD-store
// input: the person types "FIRST RULE, SECOND RULE" into the field realises and "MOD-store, MOD-pages" into the field modules, then clicks Save
// expect: the fields show "FIRST RULE, THIRD RULE" and "MOD-store" before the typing; after it no finding is shown and Save is offered; onSave is called once with the document whose realises is the list ["FIRST RULE", "SECOND RULE"] and whose modules is the list ["MOD-store", "MOD-pages"], the other list keys as they were given. Counter-proof: before the change the field holds "FIRST RULE,THIRD RULE", and the typed key reaches onSave as the text typed (the finding "is not a list" beside it keeps Save from being offered)
test("schemaForm — a list key typed in its field reaches onSave as a list", async () => {
  const handed = [];
  const form = formOver(handed);
  const shownFirst = [inputOf(form, "realises").value, inputOf(form, "modules").value];
  await typeInto(inputOf(form, "realises"), "FIRST RULE, SECOND RULE");
  await typeInto(inputOf(form, "modules"), " MOD-store ,MOD-pages, ");
  assert.deepEqual([...besideOf(form, "realises"), ...besideOf(form, "modules")], [], "no finding beside the list keys: each is held as a list");
  assert.equal(saveOf(form).disabled, false, "Save is offered");
  await persons(saveOf(form));
  assert.equal(handed.length, 1);
  assert.deepEqual(handed[0].fields.realises, ["FIRST RULE", "SECOND RULE"]);
  assert.deepEqual(handed[0].fields.modules, ["MOD-store", "MOD-pages"]);
  assert.deepEqual(handed[0].fields.tests, ["unit"]);
  assert.deepEqual(handed[0].fields.origin, ["https://github.com/alice/product/issues/7"]);
  assert.deepEqual(shownFirst, ["FIRST RULE, THIRD RULE", "MOD-store"], "a list is shown with its items separated by commas");
});

// TST-1257002 · level: unit · module: MOD-site-frame
// guards: A BACKLOG ITEM NAMES THE MODULES IT CHANGES; UC-033
// given: known positive first — the same form shows no finding beside the field modules and offers Save
// input: the person types "MOD-store, store" into the field modules; then empties it
// expect: the finding of documentFindings on the item "store" — `the key modules does not fit: "store" is not an identifier` — stands beside the field modules, no finding says the value is not a list, and Save is not offered; the field emptied leaves the key out, and the form shows the finding that modules is required — beside the field modules, where the frame shows a finding on a key the document lacks (ITM-1290). Counter-proof: before the change the finding beside the field is that "MOD-store, store" is not a list
test("schemaForm — a finding on an item of a list key is shown beside its field", async () => {
  const form = formOver([]);
  assert.deepEqual(besideOf(form, "modules"), [], "known positive: nothing beside the field");
  assert.equal(saveOf(form).disabled, false);
  await typeInto(inputOf(form, "modules"), "MOD-store, store");
  const beside = besideOf(form, "modules");
  assert.ok(beside.some((text) => text.includes('the key modules does not fit: "store" is not an identifier')), beside.join("\n"));
  assert.ok(!beside.some((text) => text.includes("is not a list")), beside.join("\n"));
  assert.equal(saveOf(form).disabled, true, "Save is not offered while the error remains");
  await typeInto(inputOf(form, "modules"), "  ");
  const all = byTag(form, "li").map((each) => each.textContent);
  assert.ok(all.some((text) => text.includes("the key modules is required, and left out")), all.join("\n"));
  assert.equal(saveOf(form).disabled, true);
});
