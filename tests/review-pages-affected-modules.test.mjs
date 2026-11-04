// MOD-review-pages' Accept of a use case in a product whose workflow's model pulls its work from a backlog (ITM-1319), as the accepted text of
// docs/architecture/MOD-review-pages.md states it: "For use cases, in a product whose workflow's model is `pulled`, every *Accept* — of one file, of the ticked
// ones, or *Accept all N shown* — names beside it the participant that will check which modules each use case changes, chosen as on `<k>/draft`, with the place
// where it processes data, as `prepareJob` of the kind `check-affected-modules` gives it (`THE PAGE NAMES WHERE IT SENDS`). … In a `planned` model, none is named
// and nothing runs." What follows the click is the check tests/test_backlog_from_acceptance.py's.
// Run: node --test tests/review-pages-affected-modules.test.mjs
//
// Module: MOD-review-pages
// Guards: ACCEPTING A USE CASE PUTS THE MODULES IT CHANGES INTO THE BACKLOG; THE PAGE NAMES WHERE IT SENDS; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; UC-008
// Level: unit
//
// The product is the fixture of tests/review-pages-draft-world.mjs (UC-007 and UC-008 open, the architecture ARC-001 with MOD-reader) behind a Host of the tests' own,
// with a declaration docs/process.md that names a model of the shipped catalogue: Scrum (pulled) or the V-model (planned). The instance is that file's: a read-only
// snapshot with the register of one participant, drafter-a, a model endpoint that drafts text at "this machine". The real MOD-job-runner, MOD-product-process,
// MOD-runtimes and MOD-participant-list run as they are; `fetch` is the world's spy, which refuses and keeps every address it was asked. Readings the texts leave
// open, which the cases state:
//   - "names beside it the participant": beside Accept stands <p class="affected-check"> holding <span class="participant"> with the participant's name and
//     <span class="place"> with its place, the destination of the job prepared for the use case shown — on the list and on Review all, for the first use case shown.
//   - "chosen as on `<k>/draft`": among the participants of the register that can do what the kind needs, as the drafting page offers them, the first whose route is
//     this tab, since the job runs in this tab.
// Each test states its input and its expected result before it runs (given / input / expect).

import test from "node:test";
import assert from "node:assert/strict";
import { PRODUCT_FILES, INSTANCE_COMMIT, fakeProduct, draw, byClass, buttonsNamed, fetched, text } from "./review-pages-draft-world.mjs";

const { registerStrategies } = await import("../src/job-runner/index.mjs");
const { workStrategies } = await import("../src/work-plans/index.mjs");
const pages = await import("../src/review-pages/index.mjs");
// The strategies as the frame registers them at load, every view's (MOD-site-frame, register.mjs): this view's, and MOD-work-plans' workStrategies, which the view of
// MOD-implementation-pages hands it and whose check, step and writer the kind check-affected-modules names.
[...(pages.view?.strategies ?? []), workStrategies].forEach((strategies, at) => registerStrategies(`tests/review-pages-affected-modules.test.mjs#${at}`, strategies));

// The product's declaration of its process model: the shipped model at `model_file`, of the instance at its commit.
const declaring = (model) => text("---", `model: ${model}`, `model_file: src/model-catalogue/models/${model}.md`, `model_version: ${INSTANCE_COMMIT}`, "---",
  "# How the thesis tool is developed", "", "## Practices", "", "- none", "", "## Definition of Done", "", "The job rules hold.");
const productOf = (model) => fakeProduct({ ...PRODUCT_FILES, "docs/process.md": declaring(model) });

const named = (target) => byClass(target, "p", "affected-check").map((note) => ({
  participant: byClass(note, "span", "participant").map((each) => each.textContent), place: byClass(note, "span", "place").map((each) => each.textContent) }));

// TST-1319001 · level: unit · module: MOD-review-pages
// guards: ACCEPTING A USE CASE PUTS THE MODULES IT CHANGES INTO THE BACKLOG; THE PAGE NAMES WHERE IT SENDS; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; UC-008
// given: a product whose docs/process.md declares Scrum, a pulled model; its use case UC-007 open; the instance's register with drafter-a, a model endpoint that drafts text at "this machine"; a token
// input: the page #use-case/id=UC-007, drawn and not clicked
// expect: beside Accept, one note naming drafter-a with its place "this machine"; nothing sent — no address asked of fetch — and nothing written
test("use-case/<id> in a pulled product names, beside Accept, the participant that checks the modules, with its place, before the click", async () => {
  const fake = productOf("scrum");
  const asked = fetched.length;
  const { target } = await draw(fake, "use-case", { id: "UC-007" });
  assert.equal(buttonsNamed(target, "Accept").length, 1, "known positive: Accept is offered");
  assert.deepEqual(named(target), [{ participant: ["drafter-a"], place: ["this machine"] }]);
  assert.equal(fetched.length - asked, 0, "nothing is sent before the click");
  assert.deepEqual(fake.writes(), [], "nothing is written before the click");
});

// TST-1319002 · level: unit · module: MOD-review-pages
// guards: ACCEPTING A USE CASE PUTS THE MODULES IT CHANGES INTO THE BACKLOG; THE PAGE NAMES WHERE IT SENDS; UC-008
// given: the product of TST-1319001, Scrum declared, UC-007 and UC-008 open; a token
// input: the list #use-case, and Review all #use-case/id=all, each drawn and not clicked
// expect: beside Accept ticked and beside Accept all 2 shown, one note each naming drafter-a with its place "this machine"; nothing sent and nothing written
test("the list's Accept ticked and Review all's Accept all N shown name the checking participant too", async () => {
  const fake = productOf("scrum");
  const asked = fetched.length;
  const list = (await draw(fake, "use-case", {})).target;
  assert.equal(byClass(list, "button", "accept-ticked").length, 1, "known positive: Accept ticked is offered");
  assert.deepEqual(named(list), [{ participant: ["drafter-a"], place: ["this machine"] }], "the list");
  const all = (await draw(fake, "use-case", { id: "all" })).target;
  assert.equal(buttonsNamed(all, "Accept all 2 shown").length, 1, "known positive: Accept all 2 shown is offered");
  assert.deepEqual(named(all), [{ participant: ["drafter-a"], place: ["this machine"] }], "Review all");
  assert.equal(fetched.length - asked, 0, "nothing is sent before the click");
  assert.deepEqual(fake.writes(), [], "nothing is written before the click");
});

// TST-1319003 · level: unit · module: MOD-review-pages
// guards: ACCEPTING A USE CASE PUTS THE MODULES IT CHANGES INTO THE BACKLOG; UC-008
// given: the same product, its docs/process.md declaring the V-model, a planned model; a token
// input: the page #use-case/id=UC-007, the list #use-case and Review all #use-case/id=all
// expect: Accept, Accept ticked and Accept all 2 shown offered (known positive), and no participant named beside any of them; nothing sent and nothing written
test("counter-proof: in a planned product no participant is named beside Accept", async () => {
  const fake = productOf("v-model");
  const asked = fetched.length;
  const one = (await draw(fake, "use-case", { id: "UC-007" })).target;
  const list = (await draw(fake, "use-case", {})).target;
  const all = (await draw(fake, "use-case", { id: "all" })).target;
  assert.equal(buttonsNamed(one, "Accept").length, 1, "known positive: Accept is offered");
  assert.equal(byClass(list, "button", "accept-ticked").length, 1, "known positive: Accept ticked is offered");
  assert.equal(buttonsNamed(all, "Accept all 2 shown").length, 1, "known positive: Accept all 2 shown is offered");
  assert.deepEqual([named(one), named(list), named(all)], [[], [], []]);
  assert.equal(fetched.length - asked, 0, "nothing is sent");
  assert.deepEqual(fake.writes(), [], "nothing is written");
});
