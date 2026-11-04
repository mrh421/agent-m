// The reason field of the decision's dialog has an accessible name (ITM-1456): THE SITE SERVES A SCREEN READER asks that "every control has an accessible name", and
// MOD-site-frame's `confirmDecision` draws, with `reason`, "a field the person fills in, as for rejecting a gate or recording a limitation"; the field is a control.
// Run: node --test tests/site-frame-decision-name.test.mjs
//
// Module: MOD-site-frame
// Guards: THE SITE SERVES A SCREEN READER
// Level: unit
//
// The expected results are written here from the item's Acceptance ("The reason field of `confirmDecision` has an accessible name, which says that it asks for the reason")
// and none is read from the code. Readings taken where the texts leave one open:
//   - An accessible name is read as a browser computes it for a form control from the sources a page can give it: its `aria-label`, else the text of the element its `aria-labelledby`
//     names, else the text of a <label for> that names its id, else the text of the <label> it stands in. A field with none has no name.
//   - A name "says that it asks for the reason" when it holds the word "reason", whatever its case.
//   - The reason field is the one control of the dialog that a person types into: the dialog has none without `reason`.
//   - The known positive is a field the frame already names: the key inputs of schemaForm, which stand in a <label> holding the key.
// The counter-proofs are in the pull request.

import "./site-frame-dom.mjs";
import test from "node:test";
import assert from "node:assert/strict";

const { schemaForm, confirmDecision } = await import("../src/site-frame/index.mjs");
const { artifactSchemas, readDocument } = await import("../src/documents/index.mjs");

const classes = (node) => (node.className ?? "").split(" ").filter(Boolean);
function descendants(root, predicate) {
  const found = [];
  (function visit(node) { for (const child of node.childNodes ?? []) { if (child.nodeType === 1) { if (predicate(child)) found.push(child); visit(child); } } })(root);
  return found;
}
const textOf = (node) => (node.textContent ?? "").replace(/\s+/g, " ").trim();
const FIELDS = ["input", "textarea", "select"];
const isField = (node) => FIELDS.includes(node.localName) && !["checkbox", "radio", "file", "hidden"].includes(node.getAttribute("type"));
const root = (node) => { let top = node; while (top.parentNode) top = top.parentNode; return top; };
// The name of a control as a browser takes it, from the sources a page can give it.
function nameOf(control) {
  const label = control.getAttribute("aria-label");
  if (label && label.trim()) return label.trim();
  const by = control.getAttribute("aria-labelledby");
  if (by) {
    const named = by.split(/\s+/).map((id) => descendants(root(control), (node) => node.getAttribute("id") === id)[0]).filter(Boolean).map(textOf).join(" ").trim();
    if (named) return named;
  }
  const id = control.getAttribute("id");
  if (id) {
    const given = descendants(root(control), (node) => node.localName === "label" && node.getAttribute("for") === id)[0];
    if (given && textOf(given)) return textOf(given);
  }
  for (let up = control.parentNode; up; up = up.parentNode) if (up.localName === "label") return textOf(up);
  return "";
}

const ITEM = ["---", "id: ITM-001", "title: Export keeps every page", "level: module", "realises:", "  - FIRST RULE", "modules:", "  - MOD-store", "tests:", "  - unit",
  "origin:", "  - https://github.com/alice/product/issues/7", "---", "# ITM-001 Export keeps every page", "", "## Outcome", "", "Every page is exported.", "", "## Acceptance", "", "- A unit test.", ""].join("\n");

// The dialog of a decision, drawn into the page as confirmDecision draws it; answered with Cancel once it has been read.
function drawDecision(options) {
  const answered = confirmDecision({ title: "Reject the gate", lines: ["The gate stays closed."], confirm: "Reject", ...options });
  const dialog = descendants(document.body, (node) => classes(node).includes("decision")).at(-1);
  return { dialog, close: async () => { descendants(dialog, (node) => node.textContent === "Cancel")[0].dispatchEvent(new Event("click")); await answered; } };
}

// TST-1456001 · level: unit · module: MOD-site-frame
// guards: THE SITE SERVES A SCREEN READER
// given: schemaForm over a backlog item, whose key inputs stand in a label; a bare textarea and a bare input made by hand; a textarea with an aria-label; a textarea with a label for its id
// input: the reading of the accessible name applied to each
// expect: known positive — each key input of the form has a name, the key it asks for; the bare textarea and the bare input have none; the textarea with an aria-label has its label, the textarea with a label for its id has the label's text
test("TST-1456001: the reading of an accessible name finds the name of a field the frame already names and none for a bare field", () => {
  const schema = artifactSchemas().item;
  const form = schemaForm(schema, readDocument(schema, "docs/backlog/ITM-001-export-keeps-every-page.md", ITEM), { onSave: async () => {} });
  document.body.append(form);
  const inputs = descendants(form, (node) => node.localName === "input" && isField(node));
  assert.ok(inputs.length > 0, "the form draws inputs");
  assert.deepEqual(inputs.filter((node) => nameOf(node) === "").length, 0, "known positive: each input of the form has a name");
  const hand = document.createElement("div");
  const bare = document.createElement("textarea"), bareInput = document.createElement("input"), labelled = document.createElement("textarea"), forId = document.createElement("textarea"), label = document.createElement("label");
  labelled.setAttribute("aria-label", "Why");
  forId.setAttribute("id", "why-field");
  label.setAttribute("for", "why-field");
  label.textContent = "Because";
  hand.append(bare, bareInput, labelled, forId, label);
  assert.deepEqual([nameOf(bare), nameOf(bareInput), nameOf(labelled), nameOf(forId)], ["", "", "Why", "Because"]);
});

// TST-1456002 · level: unit · module: MOD-site-frame
// guards: THE SITE SERVES A SCREEN READER
// given: the dialog of a decision drawn with reason true, to reject a gate
// input: the dialog's field read for its accessible name
// expect: the dialog holds exactly one field, and its accessible name holds the word "reason"
test("TST-1456002: the reason field of confirmDecision has an accessible name that says it asks for the reason", async () => {
  const decision = drawDecision({ reason: true });
  const fields = descendants(decision.dialog, isField);
  const names = fields.map(nameOf);
  await decision.close();
  assert.equal(fields.length, 1, "the dialog holds one field");
  assert.match(names[0], /reason/i, `the field's name is "${names[0]}"`);
});
