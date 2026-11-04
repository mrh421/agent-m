// MOD-review-pages' routes give the prompt bar their subject (ITM-507), as the accepted text of docs/architecture/MOD-review-pages.md and MOD-site-frame.md state it:
// "`<k>/<id>` … Its subject for the prompt bar names the file and its version — the use case, or the architecture file —, as context (MOD-prompt-bar's `Subject`), with `draft` as its
// draft route", "`<k>/<id>/edit`, and `requirement/<name>/edit` and `requirements/new` for a requirement — whose subject for the prompt bar is the file, or the requirement
// with `change-requirements`, as on the file's route", "For a change of requirements, the subject's parameters carry the person's own source, which `personSource` names among
// the product's linked sources; without one, the prompt bar sends nothing and names the step that is missing (UC-004, UC-015, UC-019 4b)", and MOD-site-frame's Route.subject.
// Run: node --test tests/review-pages-subjects.test.mjs
//
// Module: MOD-review-pages · MOD-site-frame
// Guards: UC-049; UC-019; THE PERSON WHO PROMPTS IS A SOURCE; A DRAFTED CHANGE IS SHOWN AGAINST THE CURRENT TEXT; A PROMPTED USE-CASE CHANGE SEES ITS NEIGHBOURS
// Level: unit
//
// The fixtures are tests/review-pages-draft-world.mjs'. The route is drawn first, as the frame draws it, and then asked for its subject with the same `params` and the same
// `context`, as the frame asks it at each Send. Where the module files leave a reading open, the test states the one it takes, and the pull request names it:
//   - The key of a subject is the fragment of its file or requirement — the route's name and `id=<id>` (use cases, decisions, modules, SPEC entries), `name=<requirement>` or
//     `section=<heading>` —, with `product=<address>` after them on a product's page, every part percent-encoded, as MOD-site-frame writes the key of its default subject. The
//     page of a file and its editor are one subject. Its `draftRoute` is `draft/subject=<the key, percent-encoded>`: the route `draft` reads the subject from its address.
//   - The job's parameters are, for a use case, `useCase` (the identifier the recipe `use-case-with-neighbours` reads); for an architecture decision or module file, `target`
//     (its identifier); for requirements, `requirements` (the names the SPEC holds), `source` and, for a new requirement, `section`; for a SPEC change entry `target` (its
//     identifier), the `requirements` of its proposal that the SPEC holds, and `source`. All carry `version`: the blob of the file, or of the SPEC section the named requirements stand in, as the
//     page read it, which is the text the job reads.
//   - A page that names no file — a list, Review all, a drafting page, an identifier the product does not hold — has no subject of its own: the route's subject gives `null`, and the
//     frame's default stands (MOD-site-frame's Route.subject): no kind of its own, its key the route's fragment, its title the route's title, no draft route, the page it has drawn.
//   - The route `draft` (ITM-559) gives, while the conversation's draft for the subject its address names is kept in the tab, that draft's own subject: its `key`, its `kind`, its
//     `draftRoute` `draft/subject=<the key, percent-encoded>`, no `withhold`, no `refuses`, and as its title the name of what it changes - the draft's `useCase` or `target`, else its
//     `requirements` joined by ", ", else the route's title (the draft keeps no heading, and a subject reads nothing). Its parameters for a participant are the draft's parameters
//     plus `draft`, the kept draft as it stands: the `result` of the ConversationDraft, as it was kept - not an edit open in an editor and not saved. Without such a draft the
//     route gives null, so that the frame's default stands.
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { subjectOf as frameSubjectOf } from "../src/site-frame/subject.mjs";
import { ARC1, ENTRY_ID, GITHUB, HEADING, LENDING, LOAN, MOD_READER, NO_LINKS, PRODUCT, PRODUCT_FILES, SHELF, SOURCE, UC7, UC7_PATH, blobOf,
  byClass, changedUseCase, contextOf, draw, fakeProduct, fetched, find, keepDraft, resultOf, routeNamed, routeOfFragment } from "./review-pages-draft-world.mjs";

test.afterEach(() => { assert.deepEqual(fetched.splice(0), [], "no request left the fixtures"); });
const participant = { name: "drafter-a", model: "example-model" };
const draftRouteOf = (key) => `draft/subject=${encodeURIComponent(key)}`;

// TST-507001 · level: unit · module: MOD-review-pages
// guards: UC-049; UC-019; A PROMPTED USE-CASE CHANGE SEES ITS NEIGHBOURS
// given: the page of the open use case UC-007 of a product; its editor
// input: the subject of the route `use-case` with the id UC-007, and with the id UC-007 and the part edit
// expect: for both the same subject — no kind of its own, entry use-cases, title "UC-007 Derive use cases", key "use-case/id=UC-007/product=<the product's address, encoded>", draftRoute "draft/subject=<that key, encoded>", no withhold, refuses []; its parameters for a participant {useCase: "UC-007", version: the blob of the file as it stands}
test("use-case/<id> and its editor — the subject is the use case, with the change kind and the draft route", async () => {
  const fake = fakeProduct();
  const key = `use-case/id=UC-007/product=${PRODUCT}`;
  for (const params of [{ id: "UC-007" }, { id: "UC-007", edit: "1" }]) {
    const page = await draw(fake, "use-case", params);
    const subject = page.subject();
    assert.equal(subject.kind, undefined, "a subject names no kind: the bar runs converse on every page");
    assert.equal(subject.entry, "use-cases");
    assert.equal(subject.title, "UC-007 Derive use cases");
    assert.equal(subject.key, key);
    assert.equal(subject.draftRoute, draftRouteOf(key));
    assert.equal(subject.withhold, null);
    assert.deepEqual(subject.refuses, []);
    assert.deepEqual(subject.paramsFor(participant), { useCase: "UC-007", version: blobOf(UC7) });
  }
});

// TST-507002 · level: unit · module: MOD-review-pages
// guards: UC-049; UC-023
// given: the pages of the architecture decision ARC-001 and of the module file MOD-reader
// input: the subject of the route `decision` with the id ARC-001, and of the route `module` with the id MOD-reader and the part edit
// expect: no kind of its own and entry architecture for both; keys "decision/id=ARC-001/product=<address>" and "module/id=MOD-reader/product=<address>"; titles "ARC-001 Lending is a desk" and "MOD-reader Reading a book"; their draft routes "draft/subject=<key, encoded>"; the parameters {target: "ARC-001", version: the file's blob} and {target: "MOD-reader", version: the file's blob}
test("decision/<id> and module/<id> — the subject is the architecture file, with change-architecture", async () => {
  const fake = fakeProduct();
  const cases = [["decision", { id: "ARC-001" }, "ARC-001", "ARC-001 Lending is a desk", ARC1], ["module", { id: "MOD-reader", edit: "1" }, "MOD-reader", "MOD-reader Reading a book", MOD_READER]];
  for (const [name, params, id, title, body] of cases) {
    const subject = (await draw(fake, name, params)).subject();
    const key = `${name}/id=${id}/product=${PRODUCT}`;
    assert.equal(subject.kind, undefined, "a subject names no kind: the bar runs converse on every page");
    assert.equal(subject.entry, "architecture");
    assert.equal(subject.title, title);
    assert.equal(subject.key, key);
    assert.equal(subject.draftRoute, draftRouteOf(key));
    assert.deepEqual(subject.paramsFor(participant), { target: id, version: blobOf(body) });
  }
});

// TST-507003 · level: unit · module: MOD-review-pages
// guards: UC-019; THE PERSON WHO PROMPTS IS A SOURCE
// given: a product whose SPEC holds the requirement A LOAN HAS A DUE DATE in the section "## 1. Lending"; the instance's author github.com/alice, whose person source SRC-alice the product links
// input: the subject of the route `requirement` with the name A LOAN HAS A DUE DATE
// expect: no kind of its own, entry requirements, title "A LOAN HAS A DUE DATE", key "requirement/name=<the name, encoded>/product=<address>", draftRoute "draft/subject=<key, encoded>"; the parameters {requirements: ["A LOAN HAS A DUE DATE"], source: "SRC-alice", version: the blob of the section "## 1. Lending"}
test("requirement/<name> — the subject is the requirement, with change-requirements and the person's own source", async () => {
  const fake = fakeProduct();
  const subject = (await draw(fake, "requirement", { name: LOAN })).subject();
  const key = `requirement/name=${encodeURIComponent(LOAN)}/product=${PRODUCT}`;
  assert.equal(subject.kind, undefined, "a subject names no kind: the bar runs converse on every page");
  assert.equal(subject.entry, "requirements");
  assert.equal(subject.title, LOAN);
  assert.equal(subject.key, key);
  assert.equal(subject.draftRoute, draftRouteOf(key));
  assert.deepEqual(subject.paramsFor(participant), { requirements: [LOAN], source: SOURCE, version: blobOf(LENDING) });
});

// TST-507004 · level: unit · module: MOD-review-pages
// guards: UC-019; THE PERSON WHO PROMPTS IS A SOURCE
// given: the page of a new requirement in the section "## 1. Lending"
// input: the subject of the route `requirements` with the section "## 1. Lending"
// expect: no kind of its own; title "New requirement in ## 1. Lending"; key "requirements/section=<the heading, encoded>/product=<address>"; draftRoute "draft/subject=<key, encoded>"; the parameters {requirements: [], section: "## 1. Lending", source: "SRC-alice", version: the blob of the section}
test("requirements/new — the subject is the new requirement in its section, with the person's own source", async () => {
  const fake = fakeProduct();
  const subject = (await draw(fake, "requirements", { section: HEADING })).subject();
  const key = `requirements/section=${encodeURIComponent(HEADING)}/product=${PRODUCT}`;
  assert.equal(subject.kind, undefined, "a subject names no kind: the bar runs converse on every page");
  assert.equal(subject.title, `New requirement in ${HEADING}`);
  assert.equal(subject.key, key);
  assert.equal(subject.draftRoute, draftRouteOf(key));
  assert.deepEqual(subject.paramsFor(participant), { requirements: [], section: HEADING, source: SOURCE, version: blobOf(LENDING) });
});

// TST-507005 · level: unit · module: MOD-review-pages
// guards: UC-019; UC-006
// given: the SPEC change entry 01 of a queue, which proposes the section "## 1. Lending" with both of its requirements
// input: the subject of the route `spec-entry` with the id spec-2026-03-01_sample-01
// expect: no kind of its own, entry requirements, title "spec-2026-03-01_sample-01", key "spec-entry/id=spec-2026-03-01_sample-01/product=<address>", draftRoute "draft/subject=<key, encoded>"; the parameters {target: "spec-2026-03-01_sample-01", requirements: ["A LOAN HAS A DUE DATE", "A BOOK IS SHELVED"], source: "SRC-alice", version: the blob of the SPEC section "## 1. Lending", which the job reads}
test("spec-entry/<id> — the subject is the entry, with the requirements of its proposal", async () => {
  const fake = fakeProduct();
  const subject = (await draw(fake, "spec-entry", { id: ENTRY_ID })).subject();
  const key = `spec-entry/id=${ENTRY_ID}/product=${PRODUCT}`;
  assert.equal(subject.kind, undefined, "a subject names no kind: the bar runs converse on every page");
  assert.equal(subject.entry, "requirements");
  assert.equal(subject.title, ENTRY_ID);
  assert.equal(subject.key, key);
  assert.equal(subject.draftRoute, draftRouteOf(key));
  assert.deepEqual(subject.paramsFor(participant), { target: ENTRY_ID, requirements: [LOAN, SHELF], source: SOURCE, version: blobOf(LENDING) });
});

// TST-507006 · level: unit · module: MOD-review-pages
// guards: UC-019; THE PERSON WHO PROMPTS IS A SOURCE
// given: a product whose links file names no source, so that the instance's author has no personal source the product links
// input: the subject of the route `requirement` with the name A LOAN HAS A DUE DATE, then its parameters for a participant
// expect: the parameters are given all the same, with the requirement and no source: a subject is context only, and a change of requirements refuses by its own precondition (MOD-spec-changes' person-source), which names the missing steps; the subject of a use case of the same product still gives its parameters
test("requirement/<name> — without a linked source of the person, the subject's parameters give no source and refuse nothing", async () => {
  const fake = fakeProduct({ ...PRODUCT_FILES, "docs/sources.md": NO_LINKS });
  const subject = (await draw(fake, "requirement", { name: LOAN })).subject();
  const given = subject.paramsFor(participant);
  assert.deepEqual(given.requirements, [LOAN]);
  assert.equal("source" in given, false);
  const useCase = (await draw(fake, "use-case", { id: "UC-007" })).subject();
  assert.deepEqual(useCase.paramsFor(participant), { useCase: "UC-007", version: blobOf(UC7) });
});

// TST-507007 · level: unit · module: MOD-review-pages
// guards: UC-049; THE PAGE NAMES WHERE IT SENDS
// given: the instance's own page, with no product chosen, and the same use case on a product's page
// input: the subject of the route `use-case` with the id UC-007 on each
// expect: the keys differ — "use-case/id=UC-007" on the instance's page, "use-case/id=UC-007/product=<address>" on the product's — so that a draft is shown only on the page it was drafted on; the instance's draft route is "draft/subject=use-case%2Fid%3DUC-007"
test("use-case/<id> — the same route on the instance and on a product are two subjects", async () => {
  const fake = fakeProduct();
  const own = (await draw(fake, "use-case", { id: "UC-007" }, { context: { ...contextOf(fake, { product: false }), instance: { repository: "alice/thesis-tool", host: fake.host } } })).subject();
  const onProduct = (await draw(fake, "use-case", { id: "UC-007" })).subject();
  assert.equal(own.key, "use-case/id=UC-007");
  assert.equal(own.draftRoute, "draft/subject=use-case%2Fid%3DUC-007");
  assert.equal(onProduct.key, `use-case/id=UC-007/product=${PRODUCT}`);
});

// TST-507008 · level: unit · module: MOD-review-pages · MOD-site-frame
// guards: UC-049
// given: a product page of the route `use-case`
// input: the route's own subject for the list (no part), for Review all (id=all), for the drafting page (id=draft) and for an identifier the product does not hold (UC-999); then the subject the frame gives for each, its `subjectOf` called with the route, the same parameters and context, and the text the route has drawn
// expect: the route's own subject is null for each; the frame's is its default — no kind of its own, title "Use cases", no draft route, no withhold, refuses [], entry use-cases — with the key the route's fragment ("use-case", "use-case/id=all", …, each with "/product=<address>" after it), and as its page the lines "Use cases", "Use cases" (the menu entry's label), the product's address and what the route has drawn — for the list the rows "UC-007" and "UC-008"
test("the other routes of a kind give null, and the frame's default subject stands", async () => {
  const fake = fakeProduct();
  const cases = [[{}, "use-case"], [{ id: "all" }, "use-case/id=all"], [{ id: "draft" }, "use-case/id=draft"], [{ id: "UC-999" }, "use-case/id=UC-999"]];
  const defaults = [];
  for (const [params, fragment] of cases) {
    const page = await draw(fake, "use-case", params);
    assert.equal(page.subject(), null, `${fragment}: the route gives no subject of its own`);
    const subject = frameSubjectOf({ route: page.route, params, context: page.context, drawn: () => page.target.textContent });
    defaults.push(subject);
    assert.equal(subject.kind, undefined, fragment);
    assert.equal(subject.key, `${fragment}/product=${PRODUCT}`);
    assert.equal(subject.title, "Use cases");
    assert.equal(subject.entry, "use-cases");
    assert.equal(subject.draftRoute, null);
    assert.equal(subject.withhold, null);
    assert.deepEqual(subject.refuses, []);
    const given = subject.paramsFor(participant).page.split("\n");
    assert.deepEqual(given.slice(0, 3), ["Use cases", "Use cases", GITHUB.web], `${fragment}: the title, the menu entry's label and the product's address`);
    assert.equal(given.slice(3).join("\n"), page.target.textContent, `${fragment}: what the route has drawn`);
  }
  const list = defaults[0].paramsFor(participant).page;
  assert.match(list, /UC-007/);
  assert.match(list, /UC-008/);
  const file = await draw(fake, "use-case", { id: "UC-007" });
  assert.notEqual(frameSubjectOf({ route: file.route, params: { id: "UC-007" }, context: file.context, drawn: () => "" }).draftRoute, null, "known positive: a file's page keeps its own subject");
});

// TST-507009 · level: unit · module: MOD-review-pages
// guards: UC-049; UC-019
// given: the view the module offers, a product with the use case UC-007 and the requirement A LOAN HAS A DUE DATE
// input: the former routes of changing by prompt, drawn: `use-case/id=UC-007/prompt=1`, `requirement/name=A LOAN HAS A DUE DATE/prompt=1` and `requirements/requirements=["A LOAN HAS A DUE DATE"]/prompt=1`; known positives: the same routes without `prompt`
// expect: none draws a prompt page — no heading "Change UC-007 by prompt" or "Change requirements by prompt", nor any heading containing "by prompt", no field "What should change" (textarea.instruction), no participant list —; the use case's route draws the page of UC-007 (heading "UC-007 Derive use cases"), the requirement's route the editor of the requirement (heading "Edit A LOAN HAS A DUE DATE", a field Why), as the same routes draw them without the part prompt
test("the old prompt routes are gone", async () => {
  const fake = fakeProduct();
  const headings = (page) => find(page.target, (node) => node.localName === "h2" || node.localName === "h3").map((node) => node.textContent);
  const first = (page) => headings(page)[0];
  const prompted = (page) => find(page.target, (node) => node.localName === "textarea" && node.className.split(" ").includes("instruction")).length + byClass(page.target, "ul", "participants").length;
  const names = JSON.stringify([LOAN]);
  const useCase = await draw(fake, "use-case", { id: "UC-007" });
  const requirement = await draw(fake, "requirement", { name: LOAN });
  assert.equal(first(useCase), "UC-007 Derive use cases", "known positive: the page of the use case");
  assert.equal(first(requirement), `Edit ${LOAN}`, "known positive: the editor of the requirement");

  const useCasePrompt = await draw(fake, "use-case", { id: "UC-007", prompt: "1" });
  assert.equal(first(useCasePrompt), "UC-007 Derive use cases");
  assert.equal(headings(useCasePrompt).some((heading) => /by prompt/.test(heading)), false);
  assert.equal(prompted(useCasePrompt), 0);
  const requirementPrompt = await draw(fake, "requirement", { name: LOAN, prompt: "1" });
  assert.equal(first(requirementPrompt), `Edit ${LOAN}`);
  assert.equal(headings(requirementPrompt).some((heading) => /by prompt/.test(heading)), false);
  assert.equal(prompted(requirementPrompt), 0);
  const groupPrompt = await draw(fake, "requirements", { requirements: names, prompt: "1" });
  assert.equal(headings(groupPrompt).some((heading) => /by prompt/.test(heading)), false);
  assert.equal(prompted(groupPrompt), 0);
});

// TST-507010 · level: unit · module: MOD-review-pages
// guards: UC-049; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the view the module offers
// input: its route named draft, and the drawing of a file's page
// expect: the route draft is there, outside the menu (entry null), titled "The draft of the conversation"; drawing a page changes no file of the product
test("MOD-review-pages view — the route draft is outside the menu", async () => {
  const fake = fakeProduct();
  const route = routeNamed("draft");
  assert.ok(route, "the route draft");
  assert.equal(route.entry, null);
  assert.equal(route.title, "The draft of the conversation");
  assert.equal(typeof route.render, "function");
  await draw(fake, "decision", { id: "ARC-001" });
  assert.deepEqual(fake.files(), PRODUCT_FILES);
});

// ---------------------------------------------------------------- the route draft (ITM-559, S11)

const DRAFT_TITLE = "The draft of the conversation";
const UC7_KEY = `use-case/id=UC-007/product=${PRODUCT}`;
const useCaseParams = { useCase: "UC-007", version: blobOf(UC7) };
const unusedFiles = () => resultOf({ files: [changedUseCase("UC-007", UC7_PATH, UC7)] });
// Keeps a draft for `key` in a fresh context and draws the route draft for `shown` in it.
async function draftSubject(fake, { key = UC7_KEY, kind = "change-use-case", params = useCaseParams, shown = key, result = unusedFiles() }) {
  const context = contextOf(fake);
  keepDraft(context, { subject: key, kind, params, result });
  return draw(fake, "draft", shown === null ? {} : { subject: shown }, { context });
}

// TST-507038 · level: unit · module: MOD-review-pages
// guards: UC-019; UC-049
// given: the conversation's draft for the page of UC-007, kind change-use-case, prepared with {useCase: "UC-007", version: the blob of UC-007, instruction: "change it", conversation: []}, whose result holds one file
// input: the subject of the route draft with the part subject=<that key>
// expect: key "use-case/id=UC-007/product=<address>"; no kind of its own; title "UC-007"; draftRoute "draft/subject=<that key, percent-encoded>"; withhold null; refuses []; its parameters for a participant exactly the draft's {useCase: "UC-007", version: the blob of UC-007, instruction: "change it", conversation: []} plus draft: the result as it was kept
test("draft — the subject is the draft's: its key, kind and title, its own draft route, and the draft as it stands in its parameters", async () => {
  const fake = fakeProduct();
  const result = unusedFiles();
  const subject = (await draftSubject(fake, { result })).subject();
  assert.equal(subject.key, UC7_KEY);
  assert.equal(subject.kind, undefined, "a subject names no kind: the bar runs converse on every page");
  assert.equal(subject.title, "UC-007");
  assert.equal(subject.draftRoute, draftRouteOf(UC7_KEY));
  assert.equal(subject.withhold, null);
  assert.deepEqual(subject.refuses, []);
  assert.deepEqual(subject.paramsFor(participant), { useCase: "UC-007", version: blobOf(UC7), instruction: "change it", conversation: [], draft: result });
});

// TST-507039 · level: unit · module: MOD-review-pages
// guards: UC-019; THE PERSON WHO PROMPTS IS A SOURCE
// given: the conversation's draft for each of: the page of ARC-001 (change-architecture, prepared with target ARC-001 and its blob); the requirement A LOAN HAS A DUE DATE (change-requirements, prepared with requirements [LOAN], source SRC-alice and the blob of its section); a group of two requirements (change-requirements, requirements [LOAN, A BOOK IS SHELVED]); a document edit (converse, prepared with a page)
// input: the subject of the route draft for each key
// expect: no kind of its own (the draft keeps its kind, which the bar's hand-over runs), the draft's key and draftRoute "draft/subject=<key, encoded>" for each; titles "ARC-001", "A LOAN HAS A DUE DATE", "A LOAN HAS A DUE DATE, A BOOK IS SHELVED" and, the draft naming nothing it changes, "The draft of the conversation"; its parameters the draft's own plus draft - the person's own source stays among those of the requirements
test("draft — the subject of an architecture, a requirements and a conversation draft keeps its kind, its target and its source", async () => {
  const fake = fakeProduct();
  const cases = [
    [`decision/id=ARC-001/product=${PRODUCT}`, "change-architecture", { target: "ARC-001", version: blobOf(ARC1) }, "ARC-001"],
    [`requirement/name=${encodeURIComponent(LOAN)}/product=${PRODUCT}`, "change-requirements", { requirements: [LOAN], source: SOURCE, version: blobOf(LENDING) }, LOAN],
    [`requirements/product=${PRODUCT}`, "change-requirements", { requirements: [LOAN, SHELF], source: SOURCE, version: blobOf(LENDING) }, `${LOAN}, ${SHELF}`],
    [`list/product=${PRODUCT}`, "converse", { page: "The list of use cases" }, DRAFT_TITLE],
  ];
  for (const [key, kind, params, title] of cases) {
    const result = resultOf({ files: [] });
    const subject = (await draftSubject(fake, { key, kind, params, result })).subject();
    assert.equal(subject.key, key);
    assert.equal(subject.kind, undefined, kind);
    assert.equal(subject.title, title, key);
    assert.equal(subject.draftRoute, draftRouteOf(key));
    assert.deepEqual(subject.paramsFor(participant), { ...params, instruction: "change it", conversation: [], draft: result }, key);
  }
});

// TST-507040 · level: unit · module: MOD-review-pages
// guards: UC-019; A DRAFTED CHANGE IS SHOWN AGAINST THE CURRENT TEXT
// given: the page of UC-007 drawn, whose subject writes its draft route; the conversation keeps a draft for that subject; and a draft for the instance's own page of UC-007 (key "use-case/id=UC-007")
// input: the subject of the route draft shown with the parameters the frame reads from the first subject's draft route; the same for the instance's key
// expect: the draft route of the route draft is the string the page's subject wrote - "draft/subject=" and the key percent-encoded, which holds the product's address encoded twice - and for the instance "draft/subject=use-case%2Fid%3DUC-007"; each read back as {name: "draft", params: {subject: <the key>}}; the route draft drawn with it shows one editor, data-path "docs/use-cases/UC-007-derive-use-cases.md"
test("draft — its draft route is the form the subject that wrote it used, and is read back as the key", async () => {
  const fake = fakeProduct();
  const page = await draw(fake, "use-case", { id: "UC-007" });
  const written = page.subject().draftRoute;
  assert.equal(written, `draft/subject=${encodeURIComponent(UC7_KEY)}`);
  keepDraft(page.context, { subject: UC7_KEY, kind: "change-use-case", params: useCaseParams, result: unusedFiles() });
  const address = routeOfFragment(written);
  const again = await draw(fake, address.name, address.params, { context: page.context });
  assert.equal(again.subject().draftRoute, written);
  assert.deepEqual(routeOfFragment(again.subject().draftRoute), { name: "draft", params: { subject: UC7_KEY } });
  assert.deepEqual(byClass(again.target, "div", "draft").map((box) => box.getAttribute("data-path")), [UC7_PATH]);
  const instanceKey = "use-case/id=UC-007";
  const own = await draftSubject(fake, { key: instanceKey });
  assert.equal(own.subject().draftRoute, "draft/subject=use-case%2Fid%3DUC-007");
  assert.deepEqual(routeOfFragment(own.subject().draftRoute), { name: "draft", params: { subject: instanceKey } });
});

// TST-507041 · level: unit · module: MOD-review-pages · MOD-site-frame
// guards: UC-049
// given: a draft kept for the page of UC-007
// input: the subject of the route draft shown with the key of another page, shown with no part subject, and, in the context of the draft, shown with the key of the draft after the draft was replaced by one for another page
// expect: null in all three, and the frame takes its default for the route draft then - no kind of its own, no draft route, entry null - so that a draft is offered for review only on the subject it was drafted on
test("draft — without a draft for the subject its address names, the route gives none and the frame's default stands", async () => {
  const fake = fakeProduct();
  const other = `use-case/id=UC-008/product=${PRODUCT}`;
  const elsewhere = await draftSubject(fake, { shown: other });
  assert.equal(elsewhere.subject(), null);
  const frame = frameSubjectOf({ route: elsewhere.route, params: { subject: other }, context: elsewhere.context, drawn: () => "" });
  assert.equal(frame.kind, undefined);
  assert.equal(frame.draftRoute, null);
  assert.equal(frame.entry, null);
  assert.equal((await draftSubject(fake, { shown: null })).subject(), null);
  const replaced = await draftSubject(fake, {});
  keepDraft(replaced.context, { subject: other, kind: "change-use-case", params: useCaseParams, result: unusedFiles() });
  assert.equal(replaced.route.subject({ subject: UC7_KEY }, replaced.context), null);
});

// TST-507042 · level: unit · module: MOD-review-pages
// guards: UC-019
// given: the conversation's draft for the page of UC-007 drawn on the route draft, its editor open on the text of UC-007's draft
// input: the person types a line into the editor without saving; the subject of the route draft is asked for its parameters
// expect: their `draft` is the result as the conversation kept it, deep equal to it - the draft's file text without the typed line; the typed line is in no part of them
test("draft — the draft in the parameters is the conversation's, not an edit open in an editor", async () => {
  const fake = fakeProduct();
  const result = unusedFiles();
  const page = await draftSubject(fake, { result });
  const area = find(page.target, (node) => node.localName === "textarea")[0];
  area.value = `${area.value}\nA line typed and not saved.\n`;
  area.dispatchEvent(new Event("input"));
  const params = page.subject().paramsFor(participant);
  assert.deepEqual(params.draft, result);
  assert.ok(!JSON.stringify(params).includes("A line typed and not saved."));
});
