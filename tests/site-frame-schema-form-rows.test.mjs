// MOD-site-frame's schemaForm checks the rows of a section the person edited (ITM-1122), as the accepted text of docs/architecture/MOD-site-frame.md states it (blob 3ca4fccb67fbba565a73b67f229f4958402422d1, :219-224): "`schemaForm(schema, document, options)` — a form with
// one field per key and section of a schema of MOD-documents, a section edited in the renderer's editor; the findings of `documentFindings` and of `extraChecks` shown beside their fields while typing; *Save* offered only while no error remains, so an invalid
// register is never saved". Run: node --test tests/site-frame-schema-form-rows.test.mjs
//
// Module: MOD-site-frame
// Guards: A RESOURCE ENTRY NAMES ITS SECRET, NOT ITS VALUE; NO SECRET IN THE REPOSITORY; THE RESOURCE KIND IS ONE OF A CLOSED SET; A PARTICIPANT HAS ONE OF FIVE TYPES; UC-040; UC-017
// Level: unit
//
// The form is built over the real schemas of the resource list and of the participants register, and over the checks the resources page gives it (MOD-resource-list's resourceFindings, from the rows as the page reads them); it is checked as a person meets it: the
// person types a table into the editor of the section, and the findings, Save and the document Save hands over are read. The small DOM of tests/site-frame-dom.mjs stands for the browser. The readings, named in the pull request: a finding of a row falls on the
// line of that row, so it is a mark of the section's editor; a table the person typed is read again by the schema's table, the way MOD-documents reads a file. Each test states its input and its expected result before it runs (given / input / expect). Nothing reaches
// the network. The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { document } from "./site-frame-dom.mjs";

const { schemaForm } = await import("../src/site-frame/index.mjs");
const { readDocument, writeDocument } = await import("../src/documents/index.mjs");
const { resourceFindings, resourceSchema } = await import("../src/resource-list/index.mjs");
const { participantSchema } = await import("../src/participant-list/index.mjs");

function elements(root, match) {
  const found = [];
  (function walk(n) { for (const k of n.childNodes) if (k.nodeType === 1) { if (match(k)) found.push(k); walk(k); } })(root);
  return found;
}
const byTag = (root, name) => elements(root, (e) => e.localName === name);
const byClass = (root, name) => elements(root, (e) => e.className.split(" ").includes(name));
const turn = () => new Promise((resolve) => setImmediate(resolve));
const saveOf = (form) => byTag(form, "button").at(-1);
const typeInto = async (area, text) => { area.value = text; area.dispatchEvent(new Event("input")); await turn(); };
// Every finding the form shows: beside a field, as a mark of an editor, or at the end.
const shownIn = (form) => [...byClass(form, "findings"), ...byClass(form, "marks")].flatMap((list) => [...list.children].map((each) => each.textContent)).filter(Boolean).join("\n");

// The page's own reading of a list's rows as Resources, and its extra check (src/settings-pages/resources.mjs).
const resourceOf = ({ cells: c }) => ({ name: c.Name, kind: c.Kind, address: c.Address, pin: c.Pin ?? null, licence: c.Licence ?? null, maintainer: c.Maintainer ?? null,
  route: c.Route ?? "", place: c["Processing place"] ?? null, paid: c.Paid === "yes" ? true : c.Paid === "no" ? false : null, secret: c.Secret ?? null });
const checksOf = (document_) => {
  const rows = document_.sections[0]?.rows ?? [];
  return resourceFindings(rows.map(resourceOf)).map((found) => ({ ...found, line: rows[found.line - 1]?.line ?? found.line }));
};

const RHEAD = "| Name | Kind | Address | Pin | Licence | Maintainer | Route | Processing place | Paid | Secret |\n|---|---|---|---|---|---|---|---|---|---|\n";
const rlist = (row) => `# Resources of the product\n\n${RHEAD}${row}\n`;
const CLUSTER = (over = {}) => `| ${over.name ?? "cluster"} | ${over.kind ?? "compute"} | http://cluster.example.org | — | — | — | ${over.route ?? "runner:gpu"} | NHR@FAU, Erlangen | — | ${over.secret ?? "—"} |`;
const resourceForm = (saved) => schemaForm(resourceSchema(), readDocument(resourceSchema(), "docs/resources.md", rlist(CLUSTER())), { extraChecks: checksOf, onSave: async (given) => { saved.push(given); } });

const PHEAD = "| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |\n|---|---|---|---|---|---|---|---|\n";
const plist = (row) => `# Participants of this instance\n\nThe participants.\n\n${PHEAD}${row}\n`;
const BOT = (over = {}) => `| ${over.name ?? "ci-bot"} | ${over.type ?? "CI agent"} | fixture-llm | 100000 | — | draft text | GitHub's hosted runners | ci hosted secret FIXTURE_KEY |`;
const participantForm = (saved) => schemaForm(participantSchema(), readDocument(participantSchema(), "docs/participants.md", plist(BOT())), { onSave: async (given) => { saved.push(given); } });

// TST-1122001 · level: unit · module: MOD-site-frame
// guards: A RESOURCE ENTRY NAMES ITS SECRET, NOT ITS VALUE; NO SECRET IN THE REPOSITORY; THE RESOURCE KIND IS ONE OF A CLOSED SET; UC-040
// given: a form over the resource list holding the valid compute resource cluster; Save is offered
// input: the person types the table into the editor with (1) a secret's value `sk-live-0123456789abcdef` in the Secret column, (2) the kind `bogus`, (3) the route `ssh alex` of a compute resource
// expect: each is named while typing, with its rule — A RESOURCE ENTRY NAMES ITS SECRET, NOT ITS VALUE; THE RESOURCE KIND IS ONE OF A CLOSED SET; A COMPUTE RESOURCE IS REACHED THROUGH THE BRIDGE OR A SELF-HOSTED RUNNER —, and Save is not offered (a disabled button takes no click in a browser)
// Planted fault: handing the edited section over without its rows leaves every one of the three unnamed and Save offered.
test("a form over the resource list names a secret's value, an unknown kind and a route that is no route in a table typed into the editor, and offers no Save", async () => {
  for (const [what, row, rule] of [["a secret's value", CLUSTER({ secret: "sk-live-0123456789abcdef" }), "A RESOURCE ENTRY NAMES ITS SECRET, NOT ITS VALUE"],
    ["the kind bogus", CLUSTER({ kind: "bogus" }), "THE RESOURCE KIND IS ONE OF A CLOSED SET"], ["the route ssh alex", CLUSTER({ route: "ssh alex" }), "A COMPUTE RESOURCE IS REACHED THROUGH THE BRIDGE OR A SELF-HOSTED RUNNER"]]) {
    const saved = [];
    const form = resourceForm(saved);
    assert.equal(saveOf(form).disabled, false, "Save is offered for the valid list");
    await typeInto(byTag(form, "textarea")[0], `\n${RHEAD}${row}\n`);
    assert.ok(shownIn(form).includes(rule), `${what}: ${rule} in\n${shownIn(form)}`);
    assert.equal(saveOf(form).disabled, true, `${what}: Save is not offered`);
  }
});

// TST-1122002 · level: unit · module: MOD-site-frame
// guards: A PARTICIPANT HAS ONE OF FIVE TYPES; UC-017
// given: a form over the participants register holding the valid CI agent ci-bot; Save is offered
// input: the person types the table into the editor with the type `robot`
// expect: the finding A PARTICIPANT HAS ONE OF FIVE TYPES is shown and Save is not offered
// Planted fault: handing the edited section over without its rows names nothing and offers Save.
test("a form over the participants register names a type that is none of the five in a table typed into the editor, and offers no Save", async () => {
  const saved = [];
  const form = participantForm(saved);
  assert.equal(saveOf(form).disabled, false);
  await typeInto(byTag(form, "textarea")[0], `\nThe participants.\n\n${PHEAD}${BOT({ type: "robot" })}\n`);
  assert.ok(shownIn(form).includes("A PARTICIPANT HAS ONE OF FIVE TYPES"), shownIn(form));
  assert.equal(saveOf(form).disabled, true);
});

// TST-1122003 · level: unit · module: MOD-site-frame
// guards: A RESOURCE ENTRY NAMES ITS SECRET, NOT ITS VALUE; UC-040; UC-017
// given: the same forms
// input: the person types a valid table into each editor — the resource renamed to `cluster-two`, the participant renamed to `lab-bot` — and presses Save
// expect: no finding is shown, Save is offered, one click hands the document over once, and the section it hands over holds the rows as typed (the new name in the first row); written with writeDocument, the file holds the new name
// Planted fault: dropping the rows of an edited section hands over a section without rows; or refusing every edited table offers no Save.
test("a valid table typed into the editor is saved as typed: the rows are handed over with the edited section", async () => {
  for (const [form, saved, row, schema, name] of [[resourceForm, [], CLUSTER({ name: "cluster-two" }), resourceSchema(), "cluster-two"], [participantForm, [], BOT({ name: "lab-bot" }), participantSchema(), "lab-bot"]]) {
    const made = form(saved);
    await typeInto(byTag(made, "textarea")[0], schema.schema === "resources" ? `\n${RHEAD}${row}\n` : `\nThe participants.\n\n${PHEAD}${row}\n`);
    assert.equal(shownIn(made), "", shownIn(made));
    assert.equal(saveOf(made).disabled, false);
    saveOf(made).dispatchEvent(Object.defineProperty(new Event("click"), "isTrusted", { value: true }));
    await turn();
    assert.equal(saved.length, 1);
    assert.equal(saved[0].sections[0].rows[0].cells.Name, name, "the section holds the rows as typed");
    assert.ok(writeDocument(schema, saved[0]).includes(`| ${name} |`));
  }
});
