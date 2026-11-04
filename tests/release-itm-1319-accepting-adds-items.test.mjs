// Release tests of ITM-1319 — accepting a use case puts the modules it changes into the backlog. The behaviour is the SPEC's ACCEPTING A USE CASE PUTS THE MODULES IT CHANGES INTO THE BACKLOG ("In a model that
// pulls its work from a backlog, accepting a use case adds one backlog item for each module whose implementation its accepted text changes, unless an item not yet done names that module."), THE PAGE NAMES
// WHERE IT SENDS and THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK, for UC-008 step 6. The cases draw the page of one use case in a product and press Accept, over MOD-review-pages, MOD-approvals, MOD-job-runner,
// MOD-work-plans and MOD-product-process as they are; the checking participant is a fixture that answers fixed module names whatever it is sent, so no case reads a use case's text. They read no code file.
// Run: node --test tests/release-itm-1319-accepting-adds-items.test.mjs
//
// Module: MOD-review-pages
// Guards: ACCEPTING A USE CASE PUTS THE MODULES IT CHANGES INTO THE BACKLOG; THE PAGE NAMES WHERE IT SENDS; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; UC-008
// Level: release
//
// Written for the release testing of sprint 128 by developer-sonnet-l, who implemented none of ITM-1319 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The world is tests/review-pages-draft-world.mjs: the
// product is a repository in memory behind one Host, every commit of the page goes through it, and the instance's host has no commitFiles, so a write to the instance would fail the case. The click is the
// Accept button's own listener called with an event, as the world's other cases do; no input event of the operating system is made. Readings the texts leave open, which the cases state:
//   - "under the person's account" is read as through the product's host, which the page holds with the token the person stored for the product; the fixture host keeps no token, so the case asserts the
//     host and the message that names the participant;
//   - "the same click" is read as: the acceptance's commit is written first and, after it, the commit of the items, with no item before the approval record;
//   - "an item not yet done" is an item of docs/backlog/ that no merged pull request names.

import test from "node:test";
import assert from "node:assert/strict";
import { PRODUCT_FILES, INSTANCE_COMMIT, MOD_READER, fakeProduct, draw, byClass, buttonsNamed, click, contextOf, fetched, text, writeSetting, pages } from "./review-pages-draft-world.mjs";

const { registerStrategies } = await import("../src/job-runner/index.mjs");
const { workStrategies } = await import("../src/work-plans/index.mjs");
// The strategies as the frame registers them at load, every view's, and MOD-work-plans' workStrategies, which the view of MOD-implementation-pages hands it.
[...(pages.view?.strategies ?? []), workStrategies].forEach((strategies, at) => registerStrategies(`tests/release-itm-1319-accepting-adds-items.test.mjs#${at}`, strategies));

const declaring = (model) => text("---", `model: ${model}`, `model_file: src/model-catalogue/models/${model}.md`, `model_version: ${INSTANCE_COMMIT}`, "---",
  "# How the thesis tool is developed", "", "## Practices", "", "- none", "", "## Definition of Done", "", "The job rules hold.");
const SHELF = MOD_READER.replaceAll("MOD-reader", "MOD-shelf").replace("folder: src/reader/", "folder: src/shelf/").replace("Reading a book", "Shelving a book");
const itemFile = (id, state) => text("---", `id: ${id}`, "title: Shelve books", "level: module", "realises:", "  - A BOOK IS SHELVED", "modules:", "  - MOD-shelf", "builds_on: []", "tests:", "  - unit", "origin:",
  "  - A BOOK IS SHELVED", "---", `# ${id} Shelve books`, "", "## Outcome", "", `Books are shelved${state}.`, "", "## Acceptance", "", "- unit tests of MOD-shelf.");
const merged = (id, number) => ({ number, title: `${id}: shelve books`, branch: `work/${id}`, base: "main", head: "a".repeat(40), state: "merged", draft: false, url: `https://example.invalid/${number}`,
  opened: "2026-10-13T08:00:00Z", merged: "2026-10-13T09:00:00Z", closed: "2026-10-13T09:00:00Z", body: "", updated: "2026-10-13T09:00:00Z", mergeCommit: "f".repeat(40) });

// The checking participant: whatever it is sent, it answers the same two modules; `asked` counts its requests.
const participant = () => {
  const state = { asked: 0 };
  const item = (module) => ({ title: `Do the work in ${module}`, outcome: `${module} does what the use case asks.`, realises: ["UC-007"], modules: [module], acceptance: [`unit tests of ${module}`] });
  globalThis.fetch = async () => {
    state.asked += 1;
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ draft: { items: [item("MOD-reader"), item("MOD-shelf")] }, answers: [] }) } }],
      usage: { prompt_tokens: 10, completion_tokens: 5 } }), { status: 200, headers: { "content-type": "application/json" } });
  };
  return state;
};
const world = (model, { pending = false, done = false } = {}) => {
  const files = { ...PRODUCT_FILES, "docs/process.md": declaring(model), "docs/architecture/MOD-shelf.md": SHELF };
  if (pending || done) files["docs/backlog/ITM-001-shelve-books.md"] = itemFile("ITM-001", "");
  const fake = fakeProduct(files);
  fake.host.listPullRequests = async () => (done ? [merged("ITM-001", 7)] : []);
  return fake;
};
const note = (target) => byClass(target, "p", "affected-check").map((each) => ({ participant: byClass(each, "span", "participant").map((span) => span.textContent),
  place: byClass(each, "span", "place").map((span) => span.textContent) }));
const itemsOf = (fake) => fake.writes().flatMap((change, commit) => change.files.filter((file) => /^docs\/backlog\/ITM-\d+-/.test(file.path)).map((file) => ({ commit, path: file.path, text: file.text })));
const field = (body, key) => (new RegExp(`^${key}:\\n((?:  - .*\\n)*)`, "m").exec(body)?.[1] ?? "").split("\n").filter(Boolean).map((line) => line.slice(4));
const acceptedBy = async (target) => {
  const done = () => byClass(target, "p", "result").some((node) => node.textContent.startsWith("Accepted in commit"));
  for (const limit = Date.now() + 20000; !done() && Date.now() < limit;) await new Promise((resolve) => setTimeout(resolve, 5));
  assert.ok(done(), `the acceptance did not end: ${target.textContent.slice(0, 400)}`);
  await new Promise((resolve) => setTimeout(resolve, 400));
};
// UC-007 is accepted by one press of Accept on its page; -> { fake, target, state }.
async function press(model, options) {
  const fake = world(model, options), state = participant();
  const context = contextOf(fake);
  writeSetting(context.store, "endpoint:ep1", { url: "https://ep1.example.test/v1", kind: "openai-compatible", model: "example-model" });
  const { target } = await draw(fake, "use-case", { id: "UC-007" }, { context });
  return { fake, target, state, before: { writes: fake.writes().length, fetched: fetched.length, asked: state.asked }, async accept() {
    const buttons = buttonsNamed(target, "Accept");
    assert.equal(buttons.length, 1, "known positive: Accept is offered");
    click(buttons[0]);
    await acceptedBy(target);
  } };
}

// TST-1319201 · level: release · module: MOD-review-pages
// guards: ACCEPTING A USE CASE PUTS THE MODULES IT CHANGES INTO THE BACKLOG; THE PAGE NAMES WHERE IT SENDS; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; UC-008
// given: a product declaring Scrum, a pulled model, whose use case UC-007 is open, whose architecture describes MOD-reader and MOD-shelf and whose backlog is empty; the register's participant drafter-a, a model endpoint at "this machine"; a checking participant that answers MOD-reader and MOD-shelf whatever it is sent
// input: the page of UC-007 is drawn and read; then the person presses Accept once
// expect: before the click, one note beside Accept names drafter-a with its place "this machine", and nothing is sent or written; after it, the first commit holds UC-007's approval record alone, then one commit holds exactly two backlog items, each realising UC-007 and naming one of MOD-reader and MOD-shelf, its message naming drafter-a; no item is committed before the approval; the checking participant was asked
test("TST-1319201: UC-008 6 in a pulled product Accept names the checking participant with its place, writes the approval, then one commit of the items", async () => {
  const p = await press("scrum");
  assert.deepEqual(note(p.target), [{ participant: ["drafter-a"], place: ["this machine"] }], "the participant is named with its place beside Accept");
  assert.equal(p.fake.writes().length - p.before.writes, 0, "nothing is written before the click");
  assert.equal(fetched.length - p.before.fetched, 0, "nothing is sent before the click");
  assert.equal(p.state.asked, 0, "the checking participant is not asked before the click");
  await p.accept();
  const writes = p.fake.writes();
  assert.deepEqual(writes[0].files.map((file) => file.path.replace(/-[0-9a-f]{12}\.md$/, "")), ["docs/approvals/UC-007"], "known positive: the first commit is the approval alone");
  const items = itemsOf(p.fake);
  assert.equal(items.length, 2, `two items: ${JSON.stringify(writes.map((change) => change.files.map((file) => file.path)))}`);
  assert.deepEqual([...new Set(items.map((each) => each.commit))].length, 1, "in one commit");
  assert.ok(items[0].commit > 0, "after the approval's commit");
  assert.deepEqual(items.map((each) => [field(each.text, "realises"), field(each.text, "modules")]).sort(), [[["UC-007"], ["MOD-reader"]], [["UC-007"], ["MOD-shelf"]]]);
  assert.match(writes[items[0].commit].message, /Agent-M-Participant: drafter-a/, "the commit names the participant that checked");
  assert.ok(p.state.asked > 0, "the checking participant was asked");
});

// TST-1319202 · level: release · module: MOD-review-pages
// guards: ACCEPTING A USE CASE PUTS THE MODULES IT CHANGES INTO THE BACKLOG; UC-008
// given: the product of TST-1319201 whose backlog holds ITM-001, naming MOD-shelf, that no merged pull request names; and the same product where a merged pull request names ITM-001
// input: the person presses Accept on UC-007 in each
// expect: with ITM-001 not done, one item is committed, realising UC-007 and naming MOD-reader, and no item names MOD-shelf; counter-proof — with ITM-001 done, two items are committed, MOD-shelf among them
test("TST-1319202: UC-008 6 a module that an item not yet done names gets no item, and one that a done item names does", async () => {
  const open = await press("scrum", { pending: true });
  await open.accept();
  const added = itemsOf(open.fake);
  assert.deepEqual(added.map((each) => [field(each.text, "realises"), field(each.text, "modules")]), [[["UC-007"], ["MOD-reader"]]], "one item, for MOD-reader");
  assert.ok(!added.some((each) => field(each.text, "modules").includes("MOD-shelf")), "no item names MOD-shelf");

  const finished = await press("scrum", { done: true });
  await finished.accept();
  assert.deepEqual(itemsOf(finished.fake).map((each) => field(each.text, "modules")).sort(), [["MOD-reader"], ["MOD-shelf"]], "counter-proof: ITM-001 is done, so MOD-shelf gets an item");
});

// TST-1319203 · level: release · module: MOD-review-pages
// guards: ACCEPTING A USE CASE PUTS THE MODULES IT CHANGES INTO THE BACKLOG; THE PAGE NAMES WHERE IT SENDS; UC-008
// given: the product of TST-1319201 declaring the V-model, a planned model
// input: the page of UC-007 is drawn; the person presses Accept once
// expect: known positive — Accept is offered; no participant is named beside it; the click writes one commit, UC-007's approval record, and no item; the checking participant is never asked and nothing is sent to an endpoint
test("TST-1319203: UC-008 6 in a planned product Accept writes the approval alone and names no checking participant", async () => {
  const p = await press("v-model");
  assert.deepEqual(note(p.target), [], "no participant is named beside Accept");
  await p.accept();
  const writes = p.fake.writes();
  assert.equal(writes.length - p.before.writes, 1, `one commit: ${JSON.stringify(writes.map((change) => change.files.map((file) => file.path)))}`);
  assert.deepEqual(writes[0].files.map((file) => file.path.replace(/-[0-9a-f]{12}\.md$/, "")), ["docs/approvals/UC-007"]);
  assert.deepEqual(itemsOf(p.fake), []);
  assert.equal(p.state.asked, 0, "the checking participant is never asked");
});
