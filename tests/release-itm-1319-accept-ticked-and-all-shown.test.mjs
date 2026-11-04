// Release tests of ITM-1319 for the two Accepts that record several use cases in one click — the list's Accept ticked (UC-008 3d) and Review all's Accept all N shown
// (UC-008 3e) —, ITM-1323. The behaviour is the SPEC's ACCEPTING A USE CASE PUTS THE MODULES IT CHANGES INTO THE BACKLOG ("In a model that pulls its work from a backlog,
// accepting a use case adds one backlog item for each module whose implementation its accepted text changes, unless an item not yet done names that module."), SEVERAL FILES
// ARE ACCEPTED IN ONE CLICK, THE PAGE NAMES WHERE IT SENDS and THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK, for UC-008 step 6. The cases draw the list and Review all of the
// use cases of a product with two open use cases, UC-007 and UC-008, and press the one Accept that records both, over MOD-review-pages, MOD-approvals, MOD-job-runner,
// MOD-work-plans and MOD-product-process as they are; the checking participant is a fixture that answers a fixed module for each use case, so no case reads a use case's
// text. They read no code file.
// Run: node --test tests/release-itm-1319-accept-ticked-and-all-shown.test.mjs
//
// Module: MOD-review-pages
// Guards: ACCEPTING A USE CASE PUTS THE MODULES IT CHANGES INTO THE BACKLOG; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; THE PAGE NAMES WHERE IT SENDS; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; UC-008
// Level: release
//
// Written for ITM-1323 by developer-opus-f, who implemented none of ITM-1319 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The world is tests/review-pages-draft-world.mjs,
// as tests/release-itm-1319-accepting-adds-items.test.mjs uses it: the product is a repository in memory behind one Host, every commit of the page goes through it, and the
// instance's host has no commitFiles, so a write to the instance would fail the case. A tick and a click are the listeners of the box and of the button called with an event,
// as the world's other cases do; no input event of the operating system is made. Readings the texts leave open, which the cases state:
//   - "the same click" is read as: the acceptance's commit is written first and, after it, the commits of the items, with no item before the approval records;
//   - "for each use case" is read as: one job for each use case the acceptance recorded, so each use case's items stand in a commit of their own, realising that use case;
//   - the fixture participant tells the use case it is asked about by the first identifier `UC-<nnn>` that follows the prompt's heading of the use case
//     (src/job-catalogue/kinds/check-affected-modules/prompt.md), and answers MOD-reader for UC-007 and MOD-shelf for UC-008: two use cases that named the same module
//     would leave the second without an item, since the first one's item is not yet done.

import test from "node:test";
import assert from "node:assert/strict";
import { PRODUCT_FILES, INSTANCE_COMMIT, MOD_READER, fakeProduct, draw, byClass, buttonsNamed, find, click, contextOf, fetched, text, writeSetting, pages } from "./review-pages-draft-world.mjs";

const { registerStrategies } = await import("../src/job-runner/index.mjs");
const { workStrategies } = await import("../src/work-plans/index.mjs");
// The strategies as the frame registers them at load, every view's, and MOD-work-plans' workStrategies, which the view of MOD-implementation-pages hands it.
[...(pages.view?.strategies ?? []), workStrategies].forEach((strategies, at) => registerStrategies(`tests/release-itm-1319-accept-ticked-and-all-shown.test.mjs#${at}`, strategies));

const declaring = (model) => text("---", `model: ${model}`, `model_file: src/model-catalogue/models/${model}.md`, `model_version: ${INSTANCE_COMMIT}`, "---",
  "# How the thesis tool is developed", "", "## Practices", "", "- none", "", "## Definition of Done", "", "The job rules hold.");
const SHELF = MOD_READER.replaceAll("MOD-reader", "MOD-shelf").replace("folder: src/reader/", "folder: src/shelf/").replace("Reading a book", "Shelving a book");

// The checking participant: for each request, the use case it is asked about, and the one module it answers for it; `asked` lists the use cases of its requests.
const ANSWER = { "UC-007": "MOD-reader", "UC-008": "MOD-shelf" };
const HEADING = "The use case, the requirements it realises, and every other use case";
const participant = () => {
  const state = { asked: [] };
  globalThis.fetch = async (url, init) => {
    const body = String(init?.body ?? "");
    const useCase = /UC-\d{3}/.exec(body.slice(body.indexOf(HEADING)))?.[0] ?? "none";
    state.asked.push(useCase);
    const module = ANSWER[useCase] ?? "MOD-reader";
    const item = { title: `Do the work in ${module}`, outcome: `${module} does what ${useCase} asks.`, realises: [useCase], modules: [module], acceptance: [`unit tests of ${module}`] };
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ draft: { items: [item] }, answers: [] }) } }],
      usage: { prompt_tokens: 10, completion_tokens: 5 } }), { status: 200, headers: { "content-type": "application/json" } });
  };
  return state;
};
// The product: its backlog empty, and no pull request on its host.
const world = (model) => {
  const fake = fakeProduct({ ...PRODUCT_FILES, "docs/process.md": declaring(model), "docs/architecture/MOD-shelf.md": SHELF });
  fake.host.listPullRequests = async () => [];
  return fake;
};

const note = (target) => byClass(target, "p", "affected-check").map((each) => ({ participant: byClass(each, "span", "participant").map((span) => span.textContent),
  place: byClass(each, "span", "place").map((span) => span.textContent) }));
const itemsOf = (fake) => fake.writes().flatMap((change, commit) => change.files.filter((file) => /^docs\/backlog\/ITM-\d+-/.test(file.path)).map((file) => ({ commit, path: file.path, text: file.text })));
const field = (body, key) => (new RegExp(`^${key}:\\n((?:  - .*\\n)*)`, "m").exec(body)?.[1] ?? "").split("\n").filter(Boolean).map((line) => line.slice(4));
const records = (change) => change.files.map((file) => file.path.replace(/-[0-9a-f]{12}\.md$/, "")).sort();
const acceptedBy = async (target) => {
  const done = () => byClass(target, "p", "result").some((node) => node.textContent.startsWith("Accepted in commit"));
  for (const limit = Date.now() + 20000; !done() && Date.now() < limit;) await new Promise((resolve) => setTimeout(resolve, 5));
  assert.ok(done(), `the acceptance did not end: ${target.textContent.slice(0, 400)}`);
  await new Promise((resolve) => setTimeout(resolve, 400));
};

// The page of a product declaring `model`, drawn and read: the list (`params` {}) or Review all ({ id: "all" }), after the pages of the use cases `read`, as a reviewer reads them first;
// -> { fake, target, state, before }.
async function page(model, params, read = []) {
  const fake = world(model), state = participant();
  const context = contextOf(fake);
  writeSetting(context.store, "endpoint:ep1", { url: "https://ep1.example.test/v1", kind: "openai-compatible", model: "example-model" });
  for (const id of read) await draw(fake, "use-case", { id }, { context });
  const { target } = await draw(fake, "use-case", params, { context });
  return { fake, target, state, before: { writes: fake.writes().length, fetched: fetched.length, asked: state.asked.length } };
}
// The list's Accept ticked, with UC-007 and UC-008 ticked: the button that is pressed.
function tickBoth(target) {
  const boxes = find(target, (node) => node.localName === "input" && node.className.split(" ").includes("tick"));
  assert.deepEqual(boxes.map((box) => box.getAttribute("aria-label")), ["Accept UC-007", "Accept UC-008"], "known positive: both open use cases have a tick");
  for (const box of boxes) { box.checked = true; box.dispatchEvent(new Event("change")); }
  const [bar] = byClass(target, "button", "accept-ticked");
  assert.equal(bar?.textContent, "Accept ticked (2)", "known positive: Accept ticked counts the two ticks");
  return bar;
}
// Review all's Accept all 2 shown: the button that is pressed.
function acceptAll(target) {
  const buttons = buttonsNamed(target, "Accept all 2 shown");
  assert.equal(buttons.length, 1, "known positive: Accept all 2 shown is offered");
  return buttons[0];
}

// What one click of `press` on the page of a pulled product wrote, checked for UC-008 step 6 over the two use cases.
async function pulled(params, press, read) {
  const p = await page("scrum", params, read);
  assert.deepEqual(note(p.target), [{ participant: ["drafter-a"], place: ["this machine"] }], "the participant is named with its place beside the Accept");
  const button = press(p.target);
  assert.equal(p.fake.writes().length - p.before.writes, 0, "nothing is written before the click");
  assert.equal(fetched.length - p.before.fetched, 0, "nothing is sent before the click");
  assert.equal(p.state.asked.length, 0, "the checking participant is not asked before the click");
  click(button);
  await acceptedBy(p.target);
  const writes = p.fake.writes();
  assert.deepEqual(records(writes[0]), ["docs/approvals/UC-007", "docs/approvals/UC-008"], "known positive: the first commit holds the two approval records and nothing else");
  const items = itemsOf(p.fake);
  assert.equal(items.length, 2, `one item for each use case: ${JSON.stringify(writes.map((change) => change.files.map((file) => file.path)))}`);
  assert.ok(items.every((each) => each.commit > 0), "no item is committed with or before the approval records");
  assert.deepEqual(items.map((each) => [field(each.text, "realises"), field(each.text, "modules")]).sort(), [[["UC-007"], ["MOD-reader"]], [["UC-008"], ["MOD-shelf"]]],
    "each item realises its use case and names the module the participant answered for it");
  assert.notEqual(items[0].commit, items[1].commit, "each use case's items stand in a commit of their own");
  for (const each of items) assert.match(writes[each.commit].message, /Agent-M-Participant: drafter-a/, "the commit names the participant that checked");
  assert.deepEqual([...p.state.asked].filter((id, at, all) => all.indexOf(id) === at).sort(), ["UC-007", "UC-008"], "the checking participant was asked about each use case");
}

// What one click of `press` on the page of a planned product wrote.
async function planned(params, press, read) {
  const p = await page("v-model", params, read);
  assert.deepEqual(note(p.target), [], "no participant is named beside the Accept");
  click(press(p.target));
  await acceptedBy(p.target);
  const writes = p.fake.writes();
  assert.equal(writes.length - p.before.writes, 1, `one commit: ${JSON.stringify(writes.map((change) => change.files.map((file) => file.path)))}`);
  assert.deepEqual(records(writes[0]), ["docs/approvals/UC-007", "docs/approvals/UC-008"]);
  assert.deepEqual(itemsOf(p.fake), []);
  assert.equal(p.state.asked.length, 0, "the checking participant is never asked");
  assert.equal(fetched.length - p.before.fetched, 0, "nothing is sent to an endpoint");
}

// TST-1319205 · level: release · module: MOD-review-pages
// guards: ACCEPTING A USE CASE PUTS THE MODULES IT CHANGES INTO THE BACKLOG; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; THE PAGE NAMES WHERE IT SENDS; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; UC-008
// given: a product declaring Scrum, a pulled model, whose use cases UC-007 and UC-008 are open, whose architecture describes MOD-reader and MOD-shelf and whose backlog is empty; the register's participant drafter-a, a model endpoint at "this machine"; a checking participant that answers MOD-reader for UC-007 and MOD-shelf for UC-008
// input: the pages of UC-007 and UC-008 are drawn and read, then the list of use cases; the person ticks UC-007 and UC-008 and presses Accept ticked once
// expect: known positive — both use cases have a tick and the button reads Accept ticked (2); before the click, one note beside Accept ticked names drafter-a with its place "this machine", and nothing is sent or written; after it, the first commit holds the two approval records, UC-007's and UC-008's, alone; then one item realising UC-007 and naming MOD-reader and one realising UC-008 and naming MOD-shelf are committed, each in a commit of its own whose message names drafter-a; no item is committed with or before the approval records; the checking participant was asked about each use case
test("TST-1319205: UC-008 3d in a pulled product Accept ticked over two use cases writes the approvals, then the items of each use case", async () => {
  await pulled({}, tickBoth, ["UC-007", "UC-008"]);
});

// TST-1319206 · level: release · module: MOD-review-pages
// guards: ACCEPTING A USE CASE PUTS THE MODULES IT CHANGES INTO THE BACKLOG; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; THE PAGE NAMES WHERE IT SENDS; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; UC-008
// given: the product and participants of TST-1319205
// input: Review all of the use cases is drawn and read; the person presses Accept all 2 shown once
// expect: known positive — Accept all 2 shown is offered; before the click, one note beside it names drafter-a with its place "this machine", and nothing is sent or written; after it, the first commit holds the two approval records, UC-007's and UC-008's, alone; then one item realising UC-007 and naming MOD-reader and one realising UC-008 and naming MOD-shelf are committed, each in a commit of its own whose message names drafter-a; no item is committed with or before the approval records; the checking participant was asked about each use case
test("TST-1319206: UC-008 3e in a pulled product Accept all 2 shown writes the approvals, then the items of each use case", async () => {
  await pulled({ id: "all" }, acceptAll);
});

// TST-1319207 · level: release · module: MOD-review-pages
// guards: ACCEPTING A USE CASE PUTS THE MODULES IT CHANGES INTO THE BACKLOG; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; THE PAGE NAMES WHERE IT SENDS; UC-008
// given: the product of TST-1319205 declaring the V-model, a planned model
// input: the pages of UC-007 and UC-008 are drawn, then the list; UC-007 and UC-008 are ticked and Accept ticked is pressed once; then, in another such product, Review all is drawn and Accept all 2 shown is pressed once
// expect: known positive — both use cases have a tick, Accept ticked (2) and Accept all 2 shown are offered; counter-proof — no participant is named beside either; each click writes one commit, the approval records of UC-007 and UC-008, and no item; the checking participant is never asked and nothing is sent to an endpoint
test("TST-1319207: UC-008 3d, 3e in a planned product Accept ticked and Accept all 2 shown write the approvals alone and ask no participant", async () => {
  await planned({}, tickBoth, ["UC-007", "UC-008"]);
  await planned({ id: "all" }, acceptAll);
});
