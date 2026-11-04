// Release tests of ITM-1257 — on the issue's page, a list key typed into the form of *Move to backlog* reaches *Add* as a list, and its finding stands beside its field. The behaviour is UC-033 steps 2 to 4
// (docs/use-cases/UC-033-move-an-issue-into-the-backlog.md: "Agent M checks the item as it checks a drafted item (UC-032, step 3) and names what fails; the Product Owner corrects it" — "The Product Owner presses **Add**: one click. Agent M:
// commits the item file under `docs/backlog/`") as docs/architecture/MOD-maintenance-pages.md (`issue/<number>`: "*Move to backlog* with the item prefilled — its fields checked in a form while the person edits them —; *Add*, which writes
// the item and the issue's comment and label with `moveToBacklog`") and docs/architecture/MOD-site-frame.md (`schemaForm`: "one field per key and section of a schema of MOD-documents [...]; the findings of `documentFindings` and of
// `extraChecks` shown beside their fields while typing [...]; *Save* offered only while no error remains") state them.
// Run: node --test tests/release-itm-1257-move-form-lists.test.mjs
//
// Module: MOD-maintenance-pages; MOD-site-frame
// Guards: A BACKLOG ITEM NAMES WHAT IT REALISES; A BACKLOG ITEM NAMES THE MODULES IT CHANGES; ONE CLICK PER DECISION; UC-033
// Level: release
//
// Written for the release testing of sprint 111 by a participant who implemented none of ITM-1257 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The world is the one of the maintenance pages' tests
// (tests/maintenance-pages-world.mjs: the fake GitHub of alice/product with its issues, comments and labels, over the real MOD-repository-hosts) and the real route `issue` of MOD-maintenance-pages, whose form is the real
// `schemaForm` of MOD-site-frame over the real item schema of MOD-documents. The implementers' tests (tests/site-frame-schema-form-lists.test.mjs, tests/maintenance-pages-move-lists.test.mjs) type two list keys of a change issue's form and
// look at one finding; these cases look at what a person who moves a bug issue sees and what the product receives. Readings the texts leave open, which the cases state:
//   - "reaches Add as a list": the item file the product receives holds each list key as a front-matter list, one item to a line, in the order typed, and reads back through MOD-documents' reader with no finding.
//   - "its finding stands beside its field": the finding of a list key's item stands in the list of findings of that key's field, once, and in no other field's.
//   - A field of a key that is not a list (the title) is handed over as the text typed, commas in it included; a list key left empty is left out of the item, the finding "required" then stands at the end of the form.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { PRODUCT_URL, draw } from "./main-page-home-harness.mjs";
import { withStoredGraph } from "./stored-graph-fake.mjs";
import { connect, parseAddress } from "../src/repository-hosts/index.mjs";
import { registerStrategies } from "../src/job-runner/index.mjs";
import { artifactSchemas, documentFindings, readDocument } from "../src/documents/index.mjs";
import { buttonsOf, byClass, flush, restoreWorld, textOf, trusted, waitFor, walk, world, routeNamed, pages } from "./maintenance-pages-world.mjs";

// The strategies the page's own view hands the frame, which the harness does not register.
for (const [at, strategies] of (pages.view?.strategies ?? []).entries()) {
  try { registerStrategies(`tests/release-itm-1257-move-form-lists.test.mjs#${at}`, strategies); } catch { /* registered by the page's own view */ }
}

const PRODUCT_TOKEN = "github_pat_HOME827PRODUCT0123456789abcdefg";
const ADDRESS = `${PRODUCT_URL}/issues/6`;
const TITLE = "Export, import and share lose pages";
const moduleText = (id, folder) => ["---", `id: ${id}`, `title: ${id}`, `folder: ${folder}`, "realises: []", "follows:", "  - ARC-001", "uses: []", "provides: []", "---", `# ${id} ${id}`, "",
  "## Responsibility", "", "It stores.", "", "## Parts", "", "- index.mjs", "", "## Data", "", "Nothing.", "", "## Interfaces", "", "None.", "", "## Files", "", "None.", "", "## Uses", "", "None.", ""].join("\n");
const PRODUCT_FILES = { "docs/architecture/MOD-store.md": moduleText("MOD-store", "src/store/"), "docs/architecture/MOD-pages.md": moduleText("MOD-pages", "src/pages/") };

afterEach(restoreWorld);

/** The world with the product chosen: the issue 6, a bug by its label, and a participant that would propose the class bug. */
function start() {
  const w = world({ mails: [], issues: [{ number: 6, title: TITLE, body: "The export is cut off after the second page.", state: "open", labels: ["defect"], comments: [] }],
    answer: () => ({ draft: { class: "bug", reasoning: "FIRST RULE holds, and the code breaks it.", wrong: ["src/store/read.mjs"] }, answers: [] }), product: PRODUCT_FILES });
  const real = connect(parseAddress(PRODUCT_URL), { token: PRODUCT_TOKEN });
  const host = { ...real, readSnapshot: async (ref) => withStoredGraph(await real.readSnapshot(ref)), readHistory: async () => [] };
  w.context.product = { address: PRODUCT_URL, kind: "github", host, tokenStored: true };
  return w;
}
const moveOf = (detail) => byClass(detail, "issue-move")[0];
const fieldOf = (form, key) => walk(form, (node) => node.getAttribute?.("data-key") === key)[0];
const inputOf = (form, key) => walk(fieldOf(form, key), (node) => node.localName === "input")[0];
const besideOf = (form, key) => walk(fieldOf(form, key), (node) => node.localName === "li").map(textOf);
const everyFinding = (form) => walk(form, (node) => node.localName === "li" && /^(error|warning)$/.test(node.className)).map(textOf);
const typed = async (form, key, value) => { inputOf(form, key).value = value; inputOf(form, key).dispatchEvent(new Event("input")); await flush(); };
const addOf = (form) => buttonsOf(form, "Add")[0];
// The files the product received as new blobs of the backlog, once each.
const writtenItems = (w) => [...new Map(w.kept.github.filter((request) => request.method === "POST" && request.path.endsWith("/git/trees")).flatMap((request) => JSON.parse(request.body).tree ?? [])
  .filter((entry) => typeof entry.content === "string" && entry.path.startsWith("docs/backlog/ITM-")).map((entry) => [`${entry.path}\n${entry.content}`, entry])).values()];

/** The issue 6 opened, the person's click on Move to backlog, and the form waited for. */
async function formOf(w) {
  assert.ok(routeNamed("issue"), `the route issue: ${pages.error?.message}`);
  const detail = await draw(routeNamed("issue"), w.context, { number: "6" });
  await waitFor(() => moveOf(detail) !== undefined);
  await trusted(buttonsOf(moveOf(detail), "Move to backlog")[0]);
  await waitFor(() => byClass(moveOf(detail), "schema-form").length > 0 || byClass(moveOf(detail), "issue-problem").length > 0);
  assert.equal(byClass(moveOf(detail), "issue-problem").length, 0, textOf(moveOf(detail)));
  return { detail, form: byClass(moveOf(detail), "schema-form")[0] };
}

// TST-1257301 · level: release · module: MOD-maintenance-pages, MOD-site-frame
// guards: A BACKLOG ITEM NAMES WHAT IT REALISES; A BACKLOG ITEM NAMES THE MODULES IT CHANGES; ONE CLICK PER DECISION; UC-033
// given: UC-033 steps 2 to 4. the issue 6, a bug by its label, titled "Export, import and share lose pages" (commas in it), whose item the page prefills; the architecture describes MOD-store and MOD-pages; a token that may write and comment
// input: the person adds ", again" to the title, types "  FIRST RULE ,SECOND RULE, " into the field realises and "MOD-store,MOD-pages," into the field modules (spaces and commas that mean nothing), and clicks Add
// expect: Add is offered once both are typed and no error stands in the form; the product receives one item whose title is the text typed, commas included, as one text, whose realises is the list FIRST RULE, SECOND RULE and whose modules is the list MOD-store, MOD-pages, each item on a line of its own, in that order, whose tests and origin are one-item lists, and which MOD-documents reads with no finding; the issue carries one comment naming the item and the label backlog
// Planted fault: the form handing a list key over as the text typed (`values[key] = typed || undefined` for every key in src/site-frame/forms.mjs) leaves a finding "is not a list" in the form, Add is not offered, and the case fails at that assertion.
// Planted fault: the form treating every key as a list (`const isList = true` in src/site-frame/forms.mjs) hands the typed title over as a list, the finding that the title is not a text stands in the form, and the case fails at "no error stands in the form".
test("TST-1257301 a bug's item typed with stray spaces and commas reaches the backlog with its lists as lists and its title as written", async () => {
  const w = start();
  const { detail, form } = await formOf(w);
  assert.equal(inputOf(form, "title").value, TITLE, "known positive: the title is prefilled from the issue, with its commas");
  assert.equal(addOf(form).disabled, true, "known positive: the item names nothing it realises and no module, so Add is not offered");
  await typed(form, "title", `${TITLE}, again`);
  await typed(form, "realises", "  FIRST RULE ,SECOND RULE, ");
  await typed(form, "modules", "MOD-store,MOD-pages,");
  assert.deepEqual(walk(form, (node) => node.localName === "li" && node.className === "error").map(textOf), [], "no error stands in the form");
  assert.equal(addOf(form).disabled, false, "Add is offered");
  await trusted(addOf(form));
  await waitFor(() => byClass(moveOf(detail), "move-added").length > 0 || byClass(moveOf(detail), "issue-problem").length > 0);
  assert.equal(byClass(moveOf(detail), "issue-problem").length, 0, textOf(moveOf(detail)));

  const files = writtenItems(w);
  assert.equal(files.length, 1, "the product received one item");
  const text = files[0].content;
  assert.match(text, new RegExp(`\\ntitle: ${TITLE}, again\\n`), "the title as typed");
  assert.match(text, /\nrealises:\n {2}- FIRST RULE\n {2}- SECOND RULE\n(?! {2}- )/);
  assert.match(text, /\nmodules:\n {2}- MOD-store\n {2}- MOD-pages\n(?! {2}- )/);
  assert.match(text, /\ntests:\n {2}- unit\n(?! {2}- )/);
  assert.match(text, new RegExp(`\\norigin:\\n {2}- ${ADDRESS}\\n(?! {2}- )`));
  const schema = artifactSchemas().item;
  assert.deepEqual(documentFindings(schema, readDocument(schema, files[0].path, text)).filter((finding) => finding.kind === "error"), [], "the item reads back with no error");
  const issue = w.kept.issues.find((each) => each.number === 6);
  assert.equal(issue.comments.length, 1);
  assert.ok(issue.comments[0].includes(files[0].path.replace(/^docs\/backlog\/(ITM-\d+)-.*$/, "$1")), issue.comments[0]);
  assert.deepEqual(issue.labels.sort(), ["backlog", "defect"]);
});

// TST-1257302 · level: release · module: MOD-maintenance-pages, MOD-site-frame
// guards: A BACKLOG ITEM NAMES WHAT IT REALISES; A BACKLOG ITEM NAMES THE MODULES IT CHANGES; UC-033
// given: UC-033 step 3. the form of the issue 6; known positive first — typing valid lists into realises and modules leaves no finding beside any field and offers Add
// input: the person types "export works, FIRST RULE" into realises, "unit, bogus" into tests and "MOD-store, store" into modules; then corrects the three fields one after another, last modules
// expect: beside realises the one finding that "export works" is none of a requirement's name, beside tests the one that "bogus" is not one of the levels, beside modules the one that "store" is not an identifier — each once beside its field, once in the whole form, in no other field, none saying a value is not a list — and Add is not offered; each correction removes the finding beside its own field and leaves the other two; Add is offered only after the last
// Planted fault: the form counting one line for every key whatever its value (`line += 1` in place of `line += 1 + (Array.isArray(value) ? value.length : 0)` in placed() of src/site-frame/forms.mjs) places the findings of the keys after realises beside the wrong fields, and the case fails at "beside tests".
// Planted fault: the form handing a list key over as the text typed (`values[key] = typed || undefined` for every key) shows "is not a list" in place of the findings of the items, and the case fails at "nothing beside realises" of its known positive.
test("TST-1257302 the finding on an item of a list key stands beside that key's field, once, and goes when the item is corrected", async () => {
  const w = start();
  const { form } = await formOf(w);
  await typed(form, "realises", "FIRST RULE");
  await typed(form, "modules", "MOD-store, MOD-pages");
  for (const key of ["realises", "tests", "modules"]) assert.deepEqual(besideOf(form, key), [], `known positive: nothing beside ${key}`);
  assert.equal(addOf(form).disabled, false, "known positive: Add is offered");

  await typed(form, "realises", "export works, FIRST RULE");
  await typed(form, "tests", "unit, bogus");
  await typed(form, "modules", "MOD-store, store");
  const expected = { realises: '"export works" is none of a requirement\'s name', tests: '"bogus" is not one of unit, component, system, release', modules: '"store" is not an identifier' };
  for (const [key, finding] of Object.entries(expected)) {
    const beside = besideOf(form, key);
    assert.equal(beside.filter((text) => text.includes(`the key ${key} does not fit`) && text.includes(finding)).length, 1, `beside ${key}:\n${beside.join("\n")}`);
    assert.equal(everyFinding(form).filter((text) => text.includes(`the key ${key} does not fit`)).length, 1, `${key} once in the whole form`);
    for (const other of Object.keys(expected).filter((name) => name !== key)) assert.equal(besideOf(form, other).some((text) => text.includes(`"${finding.split('"')[1]}"`)), false, `the finding on ${key} is not beside ${other}`);
  }
  assert.equal(everyFinding(form).some((text) => text.includes("is not a list")), false, everyFinding(form).join("\n"));
  assert.equal(addOf(form).disabled, true);

  await typed(form, "realises", "SECOND RULE, FIRST RULE");
  assert.deepEqual(besideOf(form, "realises"), []);
  assert.equal(besideOf(form, "tests").length, 1);
  assert.equal(besideOf(form, "modules").length, 1);
  await typed(form, "tests", "unit, component");
  assert.deepEqual(besideOf(form, "tests"), []);
  assert.equal(besideOf(form, "modules").length, 1);
  assert.equal(addOf(form).disabled, true, "one error remains");
  await typed(form, "modules", "MOD-store, MOD-pages");
  assert.deepEqual(besideOf(form, "modules"), []);
  assert.equal(addOf(form).disabled, false, "Add is offered once the last is corrected");
});

// TST-1257303 · level: release · module: MOD-maintenance-pages, MOD-site-frame
// guards: A BACKLOG ITEM NAMES WHAT IT REALISES; ONE CLICK PER DECISION; UC-033
// given: UC-033 step 3. the form of the issue 6 with realises and modules typed (Add offered); the item prefilled with the list key tests holding "unit"; the schema requires realises, modules and tests of an item and not integrates
// input: the person empties tests; types "unit , component" into it; types ARC-001 into integrates and empties it again; types " , " into realises and then FIRST RULE; and clicks Add
// expect: with tests emptied the finding that tests is required stands in the form and Add is not offered; with unit and component Add is offered; integrates typed and emptied leaves no finding and Add offered; with realises holding no name the finding that realises is required stands in the form and Add is not offered, and after FIRST RULE Add is offered; the item the product receives has no key integrates at all — no line "integrates:" —, tests is the list unit, component and realises the list FIRST RULE
// Planted fault: an emptied list key handed over as an empty list (`(items.length ? items : undefined)` replaced by `items` in src/site-frame/forms.mjs) leaves the finding that tests is required unsaid, and the case fails at that assertion.
// Planted fault: the form not shown again after the input of a field (the `show()` call removed from the input handler of src/site-frame/forms.mjs) leaves the findings of the last input in place, and the case fails at its known positive.
test("TST-1257303 a list key the person empties is left out of the item, a required one is named missing and withholds Add until it is typed again", async () => {
  const w = start();
  const { detail, form } = await formOf(w);
  await typed(form, "realises", "FIRST RULE");
  await typed(form, "modules", "MOD-store");
  assert.equal(inputOf(form, "tests").value, "unit", "known positive: the prefilled list is shown as the text unit");
  assert.equal(addOf(form).disabled, false, "known positive");

  await typed(form, "tests", "");
  assert.ok(everyFinding(form).some((text) => text.includes("the key tests is required")), everyFinding(form).join("\n"));
  assert.equal(addOf(form).disabled, true, "tests is required");
  await typed(form, "tests", "unit , component");
  assert.deepEqual(everyFinding(form).filter((text) => text.includes("tests")), []);
  assert.equal(addOf(form).disabled, false);
  await typed(form, "integrates", "ARC-001");
  assert.equal(addOf(form).disabled, false, "a list that is not required, typed");
  await typed(form, "integrates", "");
  assert.deepEqual(everyFinding(form).filter((text) => text.includes("integrates")), [], "a list that is not required, emptied");
  assert.equal(addOf(form).disabled, false);
  await typed(form, "realises", " , ");
  assert.ok(everyFinding(form).some((text) => text.includes("the key realises is required")), everyFinding(form).join("\n"));
  assert.equal(addOf(form).disabled, true, "realises is required");
  await typed(form, "realises", "FIRST RULE");
  assert.equal(addOf(form).disabled, false);
  await trusted(addOf(form));
  await waitFor(() => byClass(moveOf(detail), "move-added").length > 0 || byClass(moveOf(detail), "issue-problem").length > 0);
  assert.equal(byClass(moveOf(detail), "issue-problem").length, 0, textOf(moveOf(detail)));
  const files = writtenItems(w);
  assert.equal(files.length, 1);
  assert.doesNotMatch(files[0].content, /\nintegrates:/, "no key integrates");
  assert.match(files[0].content, /\ntests:\n {2}- unit\n {2}- component\n(?! {2}- )/);
  assert.match(files[0].content, /\nrealises:\n {2}- FIRST RULE\n(?! {2}- )/);
});
