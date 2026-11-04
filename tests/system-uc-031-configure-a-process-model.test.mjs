// System coverage for UC-031 Configure a process model, walked through the dashboard: the main flow, steps 1 to 7, and the alternative flows 2a, 2b, 4a, 5a, 6a and 6b, and the postcondition. The pages are the real routes `models`
// (the list and the editor `models/<name>`), `process`, `plan`, `backlog` and `progress` of MOD-implementation-pages, reached by the address a link of the page leads to, over the real MOD-repository-hosts host of GitHub behind
// tests/app-harness.mjs' fake of GitHub's API (git-data commits included) and a second fake of GitHub for each product of this browser; the catalogue is MOD-model-catalogue's, which UC-002 reads. The fixtures are those of
// tests/uc-031-harness.mjs and tests/uc-032-harness.mjs. No request leaves the process.
// Run: node --test tests/system-uc-031-configure-a-process-model.test.mjs
//
// Module: MOD-implementation-pages
// Module: MOD-model-catalogue
// Guards: UC-031
// Level: system
//
// Authored by developer-sonnet-l (ITM-802), who implemented none of ITM-776, ITM-777, ITM-778, ITM-779 or ITM-780 and no UC-031 production behaviour. Where the pages and UC-031 disagree the case follows UC-031 and is marked
// `todo` with the finding it reports (UC-031 4a, keeping a draft in the browser, is the finding UC-031-4A that TST-779110 reports and is not reported again). Each test states its input and its
// expected values in its own text; none reads an expected result from the SPEC, a use case or an architecture file, but the flow map (TST-802201), which holds the expected passages itself and checks that UC-031 still says them.
// A person's click is the page's own listener called with a trusted event; a script's click is made by `page.script`. Readings the texts leave open, which the cases state:
//   - "The author opens How products are developed → Process models" is read as the address #models, the route of the menu entry Process models; a click on Adapt, Edit or + New model is read as the address the link leads to.
//   - "one form section per part of the table above" is read as: a form part for the kind of work, the phases, the transitions, the verification pairs, the gates, the roles, the progress measure and, for pulled work, the flow
//     control, each found by its key or its heading.
//   - 6a "Agent M lists them" is read as: the products that declare the edited model are named, on the page of the editor or in its notice after Save.
//   - 6a "Each product keeps the version of the definition it declared" is read as: Save writes nothing to the product's repository, and the product's workflow stays that of the commit its declaration names.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { testDeclarations } from "../src/test-document/index.mjs";
import { ADAPTED, BARE, INSTANCE, LIBRARY, PHASES, TINY, addRow, areaOf, besideSection, catalogueAfter, classed, commitsOf, countOf, declares, diagramOf, disabledOf, edit, entryOf, heading, kindButton,
  kindOfEntry, linksNamed, movedMain, namesIn, previewButton, products, productsOfEntry, reach, read, replaceIn, routeAt, saveOf, sectionOf, textOf, typeKey, typeSection, valueOf, walk } from "./uc-031-harness.mjs";
import { HEAD, declaration, found, frozen, itemsOf, open as openRoute, product, settle as settleRoute } from "./uc-032-harness.mjs";

const UC = "docs/use-cases/UC-031-configure-a-process-model.md";
const SELF = "tests/system-uc-031-configure-a-process-model.test.mjs";
const RELEASE = "tests/release-uc-031-configure-a-process-model.test.mjs";
const V_MODEL = "src/model-catalogue/models/v-model.md";
const OWN_PATH = (name) => `docs/process-models/${name}.md`;
const PARTS = ["## Phases", "## Transitions", "## Verification pairs", "## Gates", "## Roles"];

// ---------------------------------------------------------------- the flow map

// The passages of UC-031 the system test walks, each with the tests that walk it; a passage the page does otherwise is a finding, a todo test that fails now and names what the page does instead.
const FLOW_EVIDENCE = {
  "main-1-list": { uc: "Agent M lists the shipped\n   catalogue (waterfall, V-model, reuse-oriented, Scrum, Kanban) and the instance's own definitions.", evidence: [[SELF, "TST-802202"]] },
  "main-1-kind-and-products": { uc: "For each model it shows the kind of work and the products that use it.", evidence: [[SELF, "TST-802202"]] },
  "main-2-adapt": { uc: "The author chooses **Adapt** on the V-model. Agent M opens an editor on a copy with a new name", evidence: [[SELF, "TST-802203"], [RELEASE, "TST-779101"]] },
  "main-2-form-and-diagram": { uc: "The editor has one form section per part of the table\n   above, and next to it a live Mermaid diagram of the phases, pairs and gates.", evidence: [[SELF, "TST-802203"]] },
  "main-3-gate-and-role": { uc: "In this example they add a gate *Security review* between\n   Implementation and Testing.", evidence: [[SELF, "TST-802203"], [RELEASE, "TST-779101"]] },
  "main-4-validate": { uc: "While the author types, Agent M validates the definition and lists each error beside the field\n   that causes it", evidence: [[SELF, "TST-802206"], [RELEASE, "TST-779102"], [RELEASE, "TST-779103"]] },
  "main-5-preview": { uc: "Every accepted requirement of that product appears once in every phase.", evidence: [[SELF, "TST-802203"], [RELEASE, "TST-779104"], [RELEASE, "TST-779106"]] },
  "main-6-save": { uc: "When the list of errors is empty, **Save** becomes available. The author presses it: one click.", evidence: [[SELF, "TST-802203"], [RELEASE, "TST-779101"]] },
  "main-6-commit": { uc: "Agent M commits the definition as a Markdown data file under `docs/process-models/` of the\n   instance. The file records the definition it was adapted from.", evidence: [[SELF, "TST-802203"], [RELEASE, "TST-779101"]] },
  "main-7-catalogue": { uc: "The model now appears in UC-002's catalogue for every product of the instance.", evidence: [[SELF, "TST-802203"]] },
  "explains": { uc: "Every part carries a folded **What is this?**.", evidence: [[RELEASE, "TST-779111"]] },
  "2a-new-model": { uc: "**2a. The author starts from nothing.** They choose **+ New model**, and the editor opens empty.", evidence: [[SELF, "TST-802204"], [RELEASE, "TST-779107"], [RELEASE, "TST-779112"]] },
  "2b-shipped": { uc: "**2b. The author wants to change a shipped model itself.** Shipped models cannot be edited in an\n  instance. Agent M offers **Adapt** instead", evidence: [[SELF, "TST-802205"]] },
  "4a-discard": { uc: "The\n  author can discard the draft", evidence: [[SELF, "TST-802207"], [RELEASE, "TST-779109"]] },
  "4a-never-committed": { uc: "An invalid definition is\n  never committed.", evidence: [[SELF, "TST-802207"], [RELEASE, "TST-779109"]] },
  "5a-no-requirements": { uc: "**5a. The chosen product has no accepted requirements yet.** The preview says so", evidence: [[RELEASE, "TST-779105"]] },
  "6a-list": { uc: "**6a. The adapted model is already used by products.**", evidence: [[SELF, "TST-802208"]] },
  "6a-lists-them": { uc: "Agent M lists them.", evidence: [[SELF, "TST-802211"]] },
  "6a-keeps-version": { uc: "Each product keeps the\n  version of the definition it declared", evidence: [[SELF, "TST-802208"]] },
  "6a-shows-change": { uc: "Agent M shows what the new version changes for the product: phases,\n  gates, roles, and assignments that become invalid.", evidence: [[SELF, "TST-802209"]] },
  "6b-changed": { uc: "**6b. The file was changed in the repository since the editor opened it.** Nothing is written.", evidence: [[RELEASE, "TST-779108"]] },
  "postcondition-pulled": { uc: "For a *pulled* model, their work comes from a backlog\n  (UC-032).", evidence: [[SELF, "TST-802210"]] },
};
const FLOW_FINDINGS = {
  "4a-keep": { uc: "or keep it in this browser to finish later", finding: "UC-031-4A", file: RELEASE, test: "TST-779110" },
};

// TST-802201 · level: system · module: system
// guards: UC-031
// given: UC-031 as committed text, the executable tests named in FLOW_EVIDENCE and the findings named in FLOW_FINDINGS
// input: compare every passage of the main flow, of the alternative flows 2a, 2b, 4a, 5a, 6a and 6b and of the postcondition with its executable evidence or its finding
// expect: every named passage stands in UC-031; every evidence file exists and contains its TST id; every finding's test stands in its file with the todo naming the finding; every alternative flow UC-031 names is among the passages
test("TST-802201: UC-031 every passage of the main flow and of each alternative flow has an executable test or a finding", () => {
  const text = read(UC);
  for (const [name, { uc }] of Object.entries({ ...FLOW_EVIDENCE, ...FLOW_FINDINGS })) assert.ok(text.includes(uc), `${name}: UC-031 says "${uc}"`);
  for (const [name, { evidence }] of Object.entries(FLOW_EVIDENCE)) {
    assert.ok(evidence.length > 0, `${name}: a test is named`);
    for (const [file, id] of evidence) {
      assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), `${name}: ${file} exists`);
      assert.ok(testDeclarations(file, read(file)).some((each) => each.id === id), `${name}: ${id} is declared in ${file}`);
    }
  }
  for (const [name, { finding, file, test: id }] of Object.entries(FLOW_FINDINGS)) {
    const declared = testDeclarations(file, read(file)).find((each) => each.id === id);
    assert.ok(declared, `${name}: ${id} is declared in ${file}`);
    const at = read(file).indexOf(`${id}:`);
    assert.ok(read(file).slice(at, at + 400).includes(`todo`) && read(file).slice(at, at + 900).includes(`FINDING ${finding}`), `${name}: ${id} is a todo that names ${finding}`);
  }
  const flows = [...text.matchAll(/^- \*\*(\d+[a-z])\. /gm)].map((match) => match[1]);
  assert.deepEqual(flows, ["2a", "2b", "4a", "5a", "6a", "6b"], "known positive: UC-031 names these alternative flows");
  for (const flow of flows) assert.ok(Object.keys({ ...FLOW_EVIDENCE, ...FLOW_FINDINGS }).some((name) => name.startsWith(flow)), `${flow} is among the passages`);
});

// ---------------------------------------------------------------- step 1: the list

const OWN = read(V_MODEL).replace("name: v-model", "name: shop-model");

// TST-802202 · level: system · module: system
// guards: UC-031
// given: an instance with the five shipped models and the model shop-model of its own (a copy of the V-model); this browser manages alice/library, whose declaration names the shipped V-model, and alice/bare, whose declaration names shop-model
// input: the author opens #models
// expect: UC-031 step 1: the page lists the shipped waterfall, V-model, reuse-oriented, Scrum and Kanban and the instance's own shop-model; for each its kind of work (waterfall, V-model, reuse-oriented, shop-model planned; Scrum, Kanban pulled) and the products that use it (alice/library under the V-model, alice/bare under shop-model, none under another); the shipped models are offered Adapt, the own model Edit, and the page + New model
test("TST-802202: UC-031 1: the page lists the shipped catalogue and the instance's own models, each with its kind of work and the products that use it", async () => {
  const around = await products({ library: declares(V_MODEL), bare: declares(OWN_PATH("shop-model")) });
  const page = await reach("#models", { files: { ...INSTANCE, [OWN_PATH("shop-model")]: OWN }, around });
  try {
    assert.deepEqual(namesIn(page), ["waterfall", "v-model", "reuse-oriented", "scrum", "kanban", "shop-model"]);
    const kinds = Object.fromEntries(namesIn(page).map((name) => [name, kindOfEntry(entryOf(page, name))]));
    assert.deepEqual(kinds, { waterfall: "planned", "v-model": "planned", "reuse-oriented": "planned", scrum: "pulled", kanban: "pulled", "shop-model": "planned" });
    const using = Object.fromEntries(namesIn(page).map((name) => [name, productsOfEntry(entryOf(page, name))]));
    assert.deepEqual(using, { waterfall: [], "v-model": [LIBRARY], "reuse-oriented": [], scrum: [], kanban: [], "shop-model": [BARE] });
    assert.deepEqual(linksNamed(page.target, "Adapt").map((link) => link.href), ["waterfall", "v-model", "reuse-oriented", "scrum", "kanban"].map((name) => `#models/name=${name}`));
    assert.deepEqual(linksNamed(page.target, "Edit").map((link) => link.href), ["#models/name=shop-model"]);
    assert.deepEqual(linksNamed(page.target, "+ New model").map((link) => link.href), ["#models/name="]);
  } finally { page.done(); }
});

// ---------------------------------------------------------------- the main flow, steps 2 to 7

// The group of the process route (UC-002) a model's card stands in.
const groupOfCard = (page, name) => walk(page.target, (node) => node.localName === "div" && String(node.getAttribute("class")).split(" ").includes("model-group"))
  .find((group) => walk(group, (inner) => inner.getAttribute("data-model") === name).length > 0)?.getElementsByTagName("h3")[0].textContent;

// TST-802203 · level: system · module: system
// guards: UC-031
// given: an instance with the five shipped models; this browser manages alice/library (a SPEC of three accepted requirements) and alice/bare
// input: the author opens #models and follows the link Adapt of the V-model; reads the form and the diagram; adds the gate Implementation → Testing that checks the threat model ARC, decided by the new role Security reviewer; types a gate without a decider and then gives it one; picks alice/library for the preview; renames the model v-model-with-security-review; a script presses Save, then the person; then the author opens #models again and UC-002's route How this product is developed
// expect: step 2: the link leads to #models/name=v-model, the editor is headed "Adapt v-model" and holds a form part for the kind of work, the measure, the phases, the transitions, the verification pairs, the gates and the roles (no flow control) beside a diagram that draws the 7 phases; step 3: the diagram shows the new decider once it is typed; step 4: the missing decider is named beside Gates and Save is unavailable, and with the decider Save is available; step 5: the preview says "3 requirements × 7 phases = 21 plan entries"; step 6: the script's click commits nothing, the person's makes one commit on the default branch with the one file docs/process-models/v-model-with-security-review.md, which records adapted_from: v-model; step 7: the list of #models offers the model among the instance's own, as a planned model with Edit, and UC-002's route offers it among the models of this instance
test("TST-802203: UC-031 2 to 7: Adapt the V-model, add a gate and a role, see the plan, Save once, and the model is in the catalogue UC-002 reads", async () => {
  const around = await products();
  const list = await reach("#models", { around });
  const adapt = linksNamed(list.target, "Adapt").find((link) => link.href === "#models/name=v-model");
  list.done();
  assert.ok(adapt, "the list offers Adapt on the V-model");
  assert.deepEqual(routeAt(adapt.href), { name: "models", params: { name: "v-model" } });
  const page = await reach(adapt.href, { around });
  try {
    assert.equal(heading(page), "Adapt v-model");
    assert.notEqual(valueOf(page, "name"), "v-model", "a copy with a new name");
    for (const key of ["kind", "measure"]) assert.ok(page.target && walk(page.target, (node) => node.getAttribute("data-key") === key).length === 1, `a form part for ${key}`);
    for (const part of PARTS) assert.ok(sectionOf(page, part), `a form part for ${part}`);
    assert.equal(sectionOf(page, "## Flow control"), undefined, "a planned model has no flow control");
    for (const phase of PHASES) assert.ok(diagramOf(page).includes(phase.replace("&", "&amp;")) || diagramOf(page).includes(phase), `the diagram draws ${phase}`);
    assert.doesNotMatch(diagramOf(page), /Security reviewer/);
    await addRow(page, "## Gates", "| Implementation → Testing | the threat model ARC | a person has accepted the threat model |  |");
    assert.match(besideSection(page, "## Gates"), /decider/i, "a gate without a decider is named beside Gates");
    assert.equal(disabledOf(saveOf(page)), true, "Save is unavailable while the error stands");
    await addRow(page, "## Roles", "| Security reviewer | either | one | read the repository |");
    await replaceIn(page, "## Gates", "| a person has accepted the threat model |  |", "| a person has accepted the threat model | Security reviewer |");
    assert.equal(besideSection(page, "## Gates"), "", "with its decider the gate has no finding");
    assert.match(diagramOf(page), /Security reviewer/, "the live diagram follows the typing");
    assert.equal(disabledOf(saveOf(page)), false, "Save becomes available");
    await page.press(previewButton(page, LIBRARY));
    assert.equal(countOf(page), "3 requirements × 7 phases = 21 plan entries");
    await typeKey(page, "name", "v-model-with-security-review");
    await page.script(saveOf(page));
    assert.equal(commitsOf(page).length, 0, "a script's click commits nothing");
    await page.press(saveOf(page));
    assert.equal(commitsOf(page).length, 1, "one click, one commit");
    assert.equal(movedMain(page).length, 1, "on the default branch");
    assert.deepEqual(Object.keys(commitsOf(page)[0].files), [OWN_PATH("v-model-with-security-review")]);
    const written = commitsOf(page)[0].files[OWN_PATH("v-model-with-security-review")];
    assert.match(written, /^adapted_from: v-model$/m);
    const read_ = await catalogueAfter(page);
    assert.deepEqual(read_.findings[OWN_PATH("v-model-with-security-review")], []);

    const after = { ...INSTANCE, ...commitsOf(page)[0].files };
    const again = await reach("#models", { files: after, around });
    try {
      const entry = entryOf(again, "v-model-with-security-review");
      assert.ok(entry, "step 7: the list offers the model");
      assert.equal(kindOfEntry(entry), "planned");
      assert.deepEqual(linksNamed(entry, "Edit").map((link) => link.href), ["#models/name=v-model-with-security-review"]);
      assert.deepEqual(linksNamed(entry, "Adapt"), [], "an own model is edited, not adapted");
    } finally { again.done(); }
    const files = await product({ files: { [OWN_PATH("v-model-with-security-review")]: written } });
    const process = await openRoute("process", {}, { files });
    await settleRoute();
    try {
      assert.equal(groupOfCard(process, "v-model-with-security-review"), "This instance", "UC-002 offers the model among the models of this instance");
      assert.equal(groupOfCard(process, "v-model"), "Plan-driven");
    } finally { process.done(); }
  } finally { page.done(); }
});

// ---------------------------------------------------------------- 2a: from nothing, for pulled work

// TST-802204 · level: system · module: system
// guards: UC-031
// given: an instance with the shipped models and no model of its own
// input: the author follows the link + New model; picks the kind pulled; reads the form; types the name tiny-flow, the phases Todo and Done, their transition and role, the gate, the roles, the flow control with a WIP limit of 3, no time box and no sprints, and the measure items per state over time; the person presses Save
// expect: UC-031 2a and the table's "Flow control (pulled only)": the link leads to #models/name=, the page asks for the kind of work first and shows no form; after pulled the form holds a Flow control with the rows WIP limit, Time box and Sprints and a measure; with no flow control typed the Flow control part names the fault and Save is unavailable, with the WIP limit alone Save is available; the click makes one commit that adds docs/process-models/tiny-flow.md alone, and the catalogue reads a pulled model of the flow control typed (WIP 3, no time box, no sprints) and the measure typed
test("TST-802204: UC-031 2a: + New model for pulled work first asks for the kind, adapts the form to a flow control, and saves a pulled model the catalogue reads", async () => {
  const list = await reach("#models");
  const link = linksNamed(list.target, "+ New model")[0];
  list.done();
  assert.deepEqual(routeAt(link.href), { name: "models", params: { name: "" } });
  const page = await reach(link.href);
  try {
    assert.equal(walk(page.target, (node) => node.localName === "textarea").length, 0, "no form before the kind is picked");
    await page.press(kindButton(page, "pulled"));
    assert.equal(valueOf(page, "kind"), "pulled");
    for (const row of ["WIP limit", "Time box", "Sprints"]) assert.ok(areaOf(page, "## Flow control").value.includes(`| ${row} |`), `the flow control holds ${row}`);
    assert.ok(walk(page.target, (node) => node.getAttribute("data-key") === "measure").length === 1, "a part for the measure");
    await typeKey(page, "name", "tiny-flow");
    await typeKey(page, "measure", "items per state over time");
    await typeSection(page, "## Phases", "| Name | Role | Produces |\n|---|---|---|\n| Todo | Owner | ITM |\n| Done | Builder | MOD |\n");
    await typeSection(page, "## Transitions", "| From | To | Kind |\n|---|---|---|\n| Todo | Done | sequence |\n");
    await typeSection(page, "## Verification pairs", "| Phase | Checked by |\n|---|---|\n| Todo | Done |\n");
    await typeSection(page, "## Gates", "| Between | Artifacts | Condition | Decider |\n|---|---|---|---|\n| Todo → Done | the ITM | the item is accepted | Owner |\n");
    await typeSection(page, "## Roles", TINY["## Roles"]);
    assert.match(besideSection(page, "## Flow control"), /time box|WIP/i, "neither a time box nor a WIP limit is named");
    assert.equal(disabledOf(saveOf(page)), true);
    await typeSection(page, "## Flow control", "| Kind | Value |\n|---|---|\n| WIP limit | 3 |\n| Time box | — |\n| Sprints | no |\n");
    assert.equal(besideSection(page, "## Flow control"), "");
    assert.equal(disabledOf(saveOf(page)), false, "the WIP limit alone is a flow control");
    await page.press(saveOf(page));
    assert.equal(commitsOf(page).length, 1);
    assert.deepEqual(Object.keys(commitsOf(page)[0].files), [OWN_PATH("tiny-flow")]);
    const read_ = await catalogueAfter(page);
    assert.deepEqual(read_.findings[OWN_PATH("tiny-flow")], []);
    const model = read_.models.find((candidate) => candidate.name === "tiny-flow");
    assert.equal(model.kind, "pulled");
    assert.equal(model.measure, "items per state over time");
    assert.equal(model.adaptedFrom, null);
    assert.deepEqual(model.flow, { wip: 3, timeBox: null, sprints: false });
  } finally { page.done(); }
});

// ---------------------------------------------------------------- 2b: a shipped model is adapted, never edited

// TST-802205 · level: system · module: system
// guards: UC-031
// given: an instance with the five shipped models, whose files stand in the instance as the book has them
// input: the author reads the shipped models on #models; follows Adapt on the V-model; types the name shop-model and presses Save
// expect: UC-031 2b: no shipped model is offered Edit, each is offered Adapt, and the page explains that a shipped model cannot be edited in an instance and to choose Adapt, naming the book; the editor the link opens is headed "Adapt v-model" and never "Edit v-model"; Save adds docs/process-models/shop-model.md and changes no shipped file: src/model-catalogue/models/v-model.md still holds the book's V-model byte for byte
test("TST-802205: UC-031 2b: a shipped model cannot be edited in an instance, Adapt is offered instead, and the shipped file stays as the book has it", async () => {
  const list = await reach("#models");
  try {
    const shipped = classed(list.target, "shipped-models")[0];
    assert.deepEqual(linksNamed(shipped, "Edit"), [], "no shipped model is offered Edit");
    assert.equal(linksNamed(shipped, "Adapt").length, 5, "each shipped model is offered Adapt");
    const explanation = textOf(walk(shipped, (node) => node.localName === "details")[0]);
    assert.match(explanation, /cannot be edited in an instance/);
    assert.match(explanation, /Adapt/);
    assert.match(explanation, /book/i);
  } finally { list.done(); }
  const page = await reach("#models/name=v-model");
  try {
    assert.equal(heading(page), "Adapt v-model");
    assert.notEqual(heading(page), "Edit v-model");
    await typeKey(page, "name", "shop-model");
    await page.press(saveOf(page));
    assert.deepEqual(Object.keys(commitsOf(page)[0].files), [OWN_PATH("shop-model")]);
    assert.equal(page.srv.files[V_MODEL], read(V_MODEL), "the shipped file is the book's V-model byte for byte");
    assert.equal(Object.keys(commitsOf(page)[0].files).filter((path) => path.startsWith("src/")).length, 0);
  } finally { page.done(); }
});

// ---------------------------------------------------------------- step 4: the errors beside their fields

// TST-802206 · level: system · module: system
// guards: UC-031
// given: the editor on the adapted V-model, which has no error
// input: the author types, without pressing anything, a transition to the phase Nowhere and a gate without a decider; then removes the first, then the second; the person presses Save while an error stands
// expect: UC-031 step 4 "While the author types, Agent M validates the definition and lists each error beside the field that causes it": both errors stand at once, the transition to Nowhere beside Transitions and the missing decider beside Gates, and none beside the other parts; with the first removed the second remains and Save stays unavailable; with both removed no finding stands and Save is available; a click on Save while an error stands commits nothing
test("TST-802206: UC-031 4: two errors typed at once are each listed beside the field that causes it, and Save waits for both to be gone", async () => {
  const page = await edit("v-model");
  try {
    const transitions = areaOf(page, "## Transitions").value, gates = areaOf(page, "## Gates").value;
    for (const part of PARTS) assert.equal(besideSection(page, part), "", `known positive: no finding beside ${part} as opened`);
    await replaceIn(page, "## Transitions", "| Validation & Verification | Operation & Maintenance | sequence |", "| Validation & Verification | Nowhere | sequence |");
    await addRow(page, "## Gates", "| Implementation → Testing | the MOD files | the code is reviewed |  |");
    assert.match(besideSection(page, "## Transitions"), /Nowhere/);
    assert.match(besideSection(page, "## Gates"), /decider/i);
    for (const part of ["## Phases", "## Verification pairs", "## Roles"]) assert.equal(besideSection(page, part), "", `no finding beside ${part}`);
    assert.equal(disabledOf(saveOf(page)), true);
    await page.press(saveOf(page));
    assert.equal(commitsOf(page).length, 0, "nothing is committed while an error stands");
    await typeSection(page, "## Transitions", transitions);
    assert.equal(besideSection(page, "## Transitions"), "", "the first is gone");
    assert.match(besideSection(page, "## Gates"), /decider/i, "the second remains");
    assert.equal(disabledOf(saveOf(page)), true, "Save stays unavailable");
    await typeSection(page, "## Gates", gates);
    for (const part of PARTS) assert.equal(besideSection(page, part), "", `no finding beside ${part}`);
    assert.equal(disabledOf(saveOf(page)), false);
  } finally { page.done(); }
});

// ---------------------------------------------------------------- 4a: the definition stays invalid

// TST-802207 · level: system · module: system
// guards: UC-031
// given: the editor on the adapted V-model with a transition to Nowhere typed, so that the definition stays invalid; this browser manages alice/library
// input: the author reads the page for what to do; the person presses Save; follows the link Discard; reads the list of the models
// expect: UC-031 4a: Save stays unavailable, the error is named beside Transitions, the page offers Discard as a link to #models; the click on Save commits nothing and the repository received no write; the list the link leads to holds the five shipped models and no model of the instance's own; "An invalid definition is never committed"
test("TST-802207: UC-031 4a: an invalid definition keeps Save unavailable, can be discarded, and is never committed", async () => {
  const around = await products();
  const page = await edit("v-model", { around });
  try {
    await replaceIn(page, "## Transitions", "| Validation & Verification | Operation & Maintenance | sequence |", "| Validation & Verification | Nowhere | sequence |");
    assert.match(besideSection(page, "## Transitions"), /Nowhere/);
    assert.equal(disabledOf(saveOf(page)), true);
    await page.press(saveOf(page));
    const discard = linksNamed(page.target, "Discard");
    assert.equal(discard.length, 1, "Discard is offered");
    assert.equal(commitsOf(page).length, 0);
    assert.deepEqual(page.srv.requests.filter((what) => /^write/.test(what)), [], "the repository received no write");
    const list = await reach(discard[0].href, { around });
    try {
      assert.deepEqual(namesIn(list), ["waterfall", "v-model", "reuse-oriented", "scrum", "kanban"]);
      assert.equal(page.srv.files[ADAPTED], undefined, "the draft is no file of the instance");
    } finally { list.done(); }
  } finally { page.done(); }
});

// ---------------------------------------------------------------- 6a: the adapted model is already used by products

// A product that declares the instance's own model at the instance's head, and the instance's files with that model.
const SHOP = OWN_PATH("shop-model");
const instanceWithShop = { ...INSTANCE, [SHOP]: OWN };

// TST-802208 · level: system · module: system
// guards: UC-031
// given: an instance with the model shop-model of its own, which alice/library declares at the instance's head; alice/bare declares no model
// input: the author follows Edit on shop-model; adds the role Auditor (either, one, read the repository); presses Save; opens #models
// expect: UC-031 6a "Each product keeps the version of the definition it declared, until its author opens UC-002 and saves the product's declaration again": the Save commits one file, docs/process-models/shop-model.md of the instance, and the repository of alice/library received no write — its docs/process.md is as it was; the list still shows alice/library under shop-model
test("TST-802208: UC-031 6a: editing a model that a product declares writes the instance's file alone and leaves the product's declaration as it was", async () => {
  const around = await products({ library: declares(SHOP) });
  const list = await reach("#models", { files: instanceWithShop, around });
  const edit_ = linksNamed(entryOf(list, "shop-model"), "Edit")[0];
  assert.deepEqual(productsOfEntry(entryOf(list, "shop-model")), [LIBRARY], "known positive: the list names the product that declares shop-model");
  list.done();
  const declared = around.library.files["docs/process.md"];
  assert.ok(declared, "known positive: the product holds its declaration");
  const page = await reach(edit_.href, { files: instanceWithShop, around });
  try {
    assert.equal(heading(page), "Edit shop-model");
    await addRow(page, "## Roles", "| Auditor | either | one | read the repository |");
    await page.press(saveOf(page));
    assert.equal(commitsOf(page).length, 1);
    assert.deepEqual(Object.keys(commitsOf(page)[0].files), [SHOP]);
    assert.deepEqual(around.library.writes, [], "the product's repository received no commit");
    assert.deepEqual(around.library.requests.filter((what) => /^write/.test(what)), [], "and no write of any kind");
    assert.equal(around.library.files["docs/process.md"], declared, "its declaration is as it was");
    const after = { ...instanceWithShop, ...commitsOf(page)[0].files };
    const again = await reach("#models", { files: after, around });
    try { assert.deepEqual(productsOfEntry(entryOf(again, "shop-model")), [LIBRARY], "the product still declares the model"); } finally { again.done(); }
  } finally { page.done(); }
});

// TST-802211 · level: system · module: system
// guards: UC-031
// given: an instance with the model shop-model of its own, which alice/library declares at the instance's head
// input: the author follows Edit on shop-model, adds a role and presses Save; reads the page of the editor and the notice after Save
// expect: UC-031 6a "Agent M lists them": the page of the editor or its notice after Save names alice/library as a product that uses shop-model, before the author leaves it
test("TST-802211: UC-031 6a: the editor of a model that products use lists those products", async () => {
    const around = await products({ library: declares(SHOP) });
    const page = await edit("shop-model", { files: instanceWithShop, around });
    try {
      await addRow(page, "## Roles", "| Auditor | either | one | read the repository |");
      await page.press(saveOf(page));
      assert.equal(commitsOf(page).length, 1, "known positive: the model is saved");
      // The preview offers every product of this browser to pick, which names none as a user of the model: the editor's form, its notice and its diagram are read.
      const shown = ["model-form", "save-notice", "model-picture"].flatMap((name) => classed(page.target, name)).map(textOf).join("\n");
      assert.ok(shown.includes(LIBRARY), "the page names the product that uses the model");
    } finally { page.done(); }
  });

// The V-model's roles filled for a product of one team without sprints, from the participants of tests/uc-032-harness.mjs.
const ASSIGNMENT = ["# Team", "", "## Roles", "", "| Role | Participants |", "|---|---|", "| Product owner | dev-a |", "| Developer | dev-a |", "| Tester | dev-b |", "| Reviewer | dev-a |", ""].join("\n");

// TST-802209 · level: system · module: system
// guards: UC-031
// given: the model shop-model as alice/library declared it at a commit of the instance, whose roles include Reviewer and whose role assignment fills Reviewer; the instance's head holds the model the author saved from the editor, in which Reviewer is renamed Auditor everywhere
// input: the author edits shop-model in the editor, renames the role Reviewer to Auditor in the gates and the roles, and saves; then opens UC-002's route How this product is developed for the product
// expect: UC-031 6a "There, Agent M shows what the new version changes for the product: phases, gates, roles, and assignments that become invalid": the route shows the section "shop-model has a new version", the roles As declared with Reviewer and the roles As it stands with Auditor and without Reviewer, the difference of the two files, and, among what becomes invalid, the role assignment that fills Reviewer; known positive: the same route with a declaration naming the head shows no such section
test("TST-802209: UC-031 6a: the route How this product is developed shows what the saved new version of the model changes for a product that declared the old one", async () => {
  const editor = await edit("shop-model", { files: instanceWithShop });
  let renamed;
  try {
    for (const part of ["## Gates", "## Roles"]) await typeSection(editor, part, areaOf(editor, part).value.replaceAll("Reviewer", "Auditor"));
    await editor.press(saveOf(editor));
    renamed = commitsOf(editor)[0].files[SHOP];
  } finally { editor.done(); }
  assert.match(renamed, /\| Auditor \|/);
  const OLD = "b1".repeat(20);
  const named = (version) => declaration("docs/process-models/fixture.md").replace(`model_version: ${HEAD}`, `model_version: ${version}`).replace("model: fixture-scrum-wip", "model: shop-model");
  const worldAt = (model, version) => product({ model, files: { "docs/process.md": named(version), "docs/role-assignments/team1.md": ASSIGNMENT, "docs/role-assignments/team2.md": null } });
  const oldFiles = await worldAt(OWN, OLD);
  const page = await openRoute("process", {}, { files: await worldAt(renamed, OLD), server: [await frozen(OLD, oldFiles)] });
  await settleRoute();
  try {
    const change = classed(page.target, "version-change")[0];
    assert.ok(change, "the section stands");
    assert.match(textOf(change), /shop-model has a new version/);
    const listed = (name) => walk(classed(change, name)[0], (node) => node.localName === "li").map((node) => node.textContent);
    const before = listed("version-before").join("\n"), after = listed("version-after").join("\n");
    assert.match(before, /Reviewer/);
    assert.doesNotMatch(before, /Auditor/);
    assert.match(after, /Auditor/);
    assert.doesNotMatch(after, /Reviewer \(/, "the role as it stands lacks Reviewer");
    assert.match(textOf(classed(change, "version-difference")[0]), /Auditor/);
    assert.match(textOf(classed(change, "version-assignment-findings")[0]), /Reviewer/, "the role assignment that fills Reviewer becomes invalid");
  } finally { page.done(); }
  const same = await openRoute("process", {}, { files: await worldAt(renamed, HEAD) });
  await settleRoute();
  try {
    assert.ok(walk(same.target, (node) => node.getAttribute("data-model") !== null).length > 0, "known positive: the route is drawn");
    assert.equal(classed(same.target, "version-change").length, 0, "a declaration that names the head shows no comparison");
  } finally { same.done(); }
});

// ---------------------------------------------------------------- the postcondition

// TST-802210 · level: system · module: system
// guards: UC-031
// given: the author adapts the shipped Scrum and saves it as shop-flow; a product of the instance declares shop-flow, a pulled model
// input: the author reads the routes plan and backlog of that product
// expect: UC-031 postcondition "For a *pulled* model, their work comes from a backlog (UC-032)": the route plan holds a link to #backlog and no step of a plan, and the route backlog lists the product's items
test("TST-802210: UC-031 the postcondition: a product that declares a saved pulled model works from its backlog", async () => {
  const editor = await edit("scrum");
  let text;
  try {
    await typeKey(editor, "name", "shop-flow");
    await editor.press(saveOf(editor));
    text = commitsOf(editor)[0].files[OWN_PATH("shop-flow")];
  } finally { editor.done(); }
  assert.match(text, /^kind: pulled$/m);
  const files = await product({ model: text });
  const plan = await openRoute("plan", {}, { files });
  await settleRoute();
  try {
    assert.ok(walk(plan.target, (node) => node.localName === "a" && node.getAttribute("href") === "#backlog").length >= 1, "a link to the backlog");
    assert.equal(found(plan.target, "[data-step]").length, 0, "no step of a plan");
  } finally { plan.done(); }
  const backlog = await openRoute("backlog", {}, { files });
  await settleRoute();
  try { assert.ok(itemsOf(backlog).length >= 1, "the backlog lists the product's items"); } finally { backlog.done(); }
});
