// MOD-review-pages shows one list of GitHub's pages without a token (ITM-622): the entry edited in place (entry-edit.mjs), the draft of files saved (file-drafts.mjs) and the draft of requirements saved
// (requirements-draft.mjs) each show the list that the use-case editor and the requirement editor show (file-edit.mjs' fallbackPages) — the one sentence "There is no token: GitHub's page opens for each
// file, and you commit them there.", for each file its link, its text for the clipboard and, for a file that differs on the default branch, the warning. UC-018 4a states it: "*Save* opens GitHub's own
// pages, one per file, each with its text on the clipboard and never in the link … The dashboard compares each file with the default branch before opening GitHub and warns if one already differs".
// Run: node --test tests/review-pages-fallback-pages-single-list.test.mjs
//
// Module: MOD-review-pages
// Guards: UC-018; UC-019; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK
// Level: unit
//
// This imports the browser harness of tests/review-pages-harness.mjs and, through the fixtures of tests/review-pages-draft-world.mjs (a helper that holds inputs and no test), the product behind a Host of
// the tests' own, which keeps to MOD-repository-hosts' interface (repositoryInfo with canWrite false, readSnapshot, commitFiles refused). Each fallback arises from a host that cannot write, through the
// real route: MOD-spec-changes' saveEntry for the entry, MOD-spec-changes' proposeSection for the requirements, MOD-artifact-edits' fallbackEditLinks for the files. The real MOD-markdown-render,
// MOD-spec-changes, MOD-artifact-edits and MOD-text-tools run as they are. Nothing reaches the network: `fetch` is the world's spy that refuses. Each test states its input and its expected result before
// it runs (given / input / expect). The counter-proofs are recorded in the pull request. Where the module file leaves a reading open, the test states the one it takes:
//   - The list is <ul class="pages"> with one <li> for each page: <a class="github-page"> "Open GitHub's page for <path>", <pre class="clipboard-text"> with the file's text, and, where the file differs on the
//     default branch, <p class="problem"> "The file differs on the default branch; compare before committing." (as tests/review-pages-edit-requirement-pages.test.mjs reads the requirement editor's list).
//   - "A file that differs" is stood in for by a snapshot whose `paths` is read through a counter: the last reading of an unwarned Save names one path less (or one more) than the earlier ones, so that the
//     default branch no longer has the file as the edit started (MOD-artifact-edits' fallbackEditLinks: "`differs` says that the default branch, as the snapshot holds it, no longer has the file as the edit started").
//   - The queue of a requirements draft of the section "## 1. Lending" is its section's queue, docs/spec-freigaben/lending.

import "./review-pages-harness.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { ENTRY_ID, LENDING, LOAN, PRODUCT, PRODUCT_FILES, QUEUE, SOURCE, UC7, UC7_PATH, UC8, UC8_PATH, ROUND_ONE, blobOf, buttonsNamed, byClass, changedUseCase, click, contextOf, draw, fakeProduct,
  fetched, find, keepDraft, resultOf, until } from "./review-pages-draft-world.mjs";

test.afterEach(() => { assert.deepEqual(fetched.splice(0), [], "no request left the fixtures"); });

// The sentence above GitHub's pages, written out here and taken from no document.
const SENTENCE = "There is no token: GitHub's page opens for each file, and you commit them there.";
const WARNING = "The file differs on the default branch; compare before committing.";

// ---------------------------------------------------------------- a snapshot whose paths are counted

// From `counting` on, each reading of `paths` is counted; the reading number `at` names the paths without `lacking` and with `extra`. Set on the fake's host before the page is drawn.
function watching(fake) {
  const state = { counting: false, reads: 0, at: null, lacking: [], extra: [] };
  const read = fake.host.readSnapshot;
  fake.host.readSnapshot = async (ref) => {
    const snapshot = await read(ref), held = snapshot.paths;
    return Object.create(snapshot, { paths: { get() {
      if (!state.counting) return held;
      state.reads += 1;
      return state.reads === state.at ? [...held.filter((path) => !state.lacking.includes(path)), ...state.extra].sort() : held;
    } } });
  };
  return state;
}

// The repository as it stood when the edit began: a read of the commit the page opened on — any ref but "main" — names the paths without `lacking` and with `extra`; and, once `moves.armed` is
// set, which the test does just before the click on Save, the default branch stands at another commit than the page opened on. Set on the fake's host before the page is drawn.
function beganWith(fake, { lacking = [], extra = [] }) {
  const moves = { armed: false };
  const read = fake.host.readSnapshot;
  fake.host.readSnapshot = async (ref) => {
    const snapshot = await read(ref);
    if (ref === "main") return moves.armed ? Object.create(snapshot, { commit: { value: "m".repeat(40) } }) : snapshot;
    return Object.create(snapshot, { paths: { value: [...snapshot.paths.filter((path) => !lacking.includes(path)), ...extra].sort() } });
  };
  return moves;
}

// ---------------------------------------------------------------- the page

const listed = (target) => byClass(target, "ul", "pages")[0].childNodes.filter((node) => node.nodeType === 1).map((item) => ({
  path: byClass(item, "a", "github-page")[0].textContent.replace("Open GitHub's page for ", ""),
  href: byClass(item, "a", "github-page")[0].getAttribute("href"),
  clipboard: byClass(item, "pre", "clipboard-text").map((node) => node.textContent),
  warnings: byClass(item, "p", "problem").map((node) => node.textContent),
}));
// The text of every paragraph without a class: the sentence above GitHub's pages is one of them.
const sentencesOf = (target) => find(target, (node) => node.localName === "p" && node.className === "").map((node) => node.textContent);
const areaIn = (root) => find(root, (node) => node.localName === "textarea" && !node.className.split(" ").includes("why"))[0];

// ---------------------------------------------------------------- the three paths, each to the point where GitHub's pages are listed

const EDITED_ENTRY = LENDING.replace("Every book stands on a shelf.", "Every book stands on one shelf.");
const WHY = "Because it is clearer.";
// The open entry 01 of the sample queue, edited in place with a Why, saved without a token.
async function savedEntry(state = null, began = null) {
  const fake = fakeProduct(PRODUCT_FILES, { canWrite: false });
  const watch = watching(fake);
  const moves = began ? beganWith(fake, began) : null;
  const { target } = await draw(fake, "spec-entry", { id: ENTRY_ID, edit: "1" }, { token: false });
  areaIn(target).value = EDITED_ENTRY;
  areaIn(target).dispatchEvent(new Event("input"));
  byClass(target, "textarea", "why")[0].value = WHY;
  Object.assign(watch, { counting: true, ...state });
  if (moves) moves.armed = true;
  click(buttonsNamed(target, "Save")[0]);
  await until(() => byClass(target, "a", "github-page").length === 2, "GitHub's two pages of the entry");
  return { fake, target, watch };
}

const useCaseParams = { useCase: "UC-007", version: blobOf(UC7), instruction: "align UC-007 and UC-008 with the new rule" };
const UC7_KEY = `use-case/id=UC-007/product=${PRODUCT}`;
// The draft of UC-007 and UC-008 in their editors, saved without a token.
async function savedFiles(state = null) {
  const fake = fakeProduct(PRODUCT_FILES, { canWrite: false });
  const watch = watching(fake);
  const context = contextOf(fake, { token: false });
  keepDraft(context, { subject: UC7_KEY, kind: "change-use-case", params: useCaseParams,
    result: resultOf({ files: [changedUseCase("UC-007", UC7_PATH, UC7), changedUseCase("UC-008", UC8_PATH, UC8)] }, { rounds: [ROUND_ONE] }) });
  const { target } = await draw(fake, "draft", { subject: UC7_KEY }, { context });
  Object.assign(watch, { counting: true, ...state });
  click(buttonsNamed(target, "Save")[0]);
  await until(() => byClass(target, "a", "github-page").length === 2, "GitHub's two pages of the draft");
  return { fake, target, watch };
}

const OVERDUE = "Every loan states the date by which the book is returned, and says when it is overdue.";
const REQUIREMENTS = { candidates: [{ name: LOAN, rule: OVERDUE, check: "`tests/fixture.test.mjs`", constrains: "product", passage: "overdue", class: "change", of: LOAN }] };
const REQUIREMENTS_KEY = `requirement/name=${encodeURIComponent(LOAN)}/product=${PRODUCT}`;
// The draft of requirements — the rule of A LOAN HAS A DUE DATE changed —, saved without a token.
async function savedRequirements(state = null, began = null) {
  const fake = fakeProduct(PRODUCT_FILES, { canWrite: false });
  const watch = watching(fake);
  const moves = began ? beganWith(fake, began) : null;
  const context = contextOf(fake, { token: false });
  keepDraft(context, { subject: REQUIREMENTS_KEY, kind: "change-requirements", params: { requirements: [LOAN], source: SOURCE, version: blobOf(LENDING), instruction: "state the overdue rule" },
    result: resultOf(REQUIREMENTS, { rounds: [ROUND_ONE] }) });
  const { target } = await draw(fake, "draft", { subject: REQUIREMENTS_KEY }, { context });
  Object.assign(watch, { counting: true, ...state });
  if (moves) moves.armed = true;
  click(buttonsNamed(target, "Save")[0]);
  await until(() => byClass(target, "a", "github-page").length === 4, "GitHub's four pages of the proposal");
  return { fake, target, watch };
}

const written = (fake) => fake.writes().filter((change) => change.files.length > 0);

// ---------------------------------------------------------------- the entry edited in place

// TST-622001 · level: unit · module: MOD-review-pages
// guards: UC-018; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK
// given: a GitHub product whose host cannot write and no token stored; the open entry 01 of the sample queue edited in place — the section "1. Lending" with one book standing on "one shelf" — with a Why
// input: a click on Save
// expect: nothing committed; a paragraph above the list is exactly "There is no token: GitHub's page opens for each file, and you commit them there."; two pages — the entry's proposal and its rationale —, each with exactly one text beside its link; the proposal's text is the section as edited, byte for byte; the rationale's text holds the Why; no address holds a word of the text; no page is warned about
test("spec-entry/<id>/edit — without a token the entry's pages are fallbackPages' list: the sentence, each file's text, no warning", async () => {
  const { fake, target } = await savedEntry();
  assert.equal(written(fake).length, 0, "nothing committed");
  assert.ok(sentencesOf(target).includes(SENTENCE), `the sentence: ${JSON.stringify(sentencesOf(target))}`);
  const found = listed(target);
  assert.deepEqual(found.map((page) => page.path), [`${QUEUE}/01-lending.md`, `${QUEUE}/01-lending.begruendung.md`]);
  for (const page of found) {
    assert.equal(page.clipboard.length, 1, `${page.path}: one text beside the link`);
    assert.ok(!decodeURIComponent(page.href).includes("one shelf"), "no text in the address");
    assert.deepEqual(page.warnings, [], `${page.path}: no warning where nothing differs`);
  }
  assert.equal(found[0].clipboard[0], EDITED_ENTRY, "the proposal, byte for byte");
  assert.match(found[1].clipboard[0], /Because it is clearer\./);
});

// TST-622002 · level: unit · module: MOD-review-pages
// guards: UC-018; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK
// given: the product of TST-622001, whose default branch no longer has the entry's proposal between two readings of one snapshot — the file the edit began with
// input: a click on Save
// expect: the page of the proposal carries the warning "The file differs on the default branch; compare before committing." beside its text; the page of the rationale carries no warning and still its text
test("spec-entry/<id>/edit — without a token a file that already differs is warned about on its page", async () => {
  const counting = await savedEntry();
  const last = counting.watch.reads;
  assert.ok(last > 0, "known positive: the unwarned save read the paths");
  const { target } = await savedEntry({ at: last, lacking: [`${QUEUE}/01-lending.md`] });
  const [proposal, rationale] = listed(target);
  assert.deepEqual(proposal.warnings, [WARNING], "the proposal is warned about");
  assert.equal(proposal.clipboard.length, 1, "its text is beside the warning");
  assert.deepEqual(rationale.warnings, [], "the rationale is not");
  assert.equal(rationale.clipboard.length, 1, "its text");
});

// ---------------------------------------------------------------- the draft of files

// TST-622003 · level: unit · module: MOD-review-pages
// guards: UC-019; UC-018; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK
// given: a GitHub product whose host cannot write and no token stored; the draft of UC-007 and UC-008, each with an added alternative flow 2b, in their editors
// input: a click on Save
// expect: nothing committed; a paragraph above the list is exactly "There is no token: GitHub's page opens for each file, and you commit them there."; two pages — UC-007's file and UC-008's, in this order —, each with exactly one text beside its link, which is the file as drafted, byte for byte; no address holds a word of the text; no page is warned about
test("draft — without a token the pages of a draft of files are fallbackPages' list: the sentence, each file's text, no warning", async () => {
  const { fake, target } = await savedFiles();
  assert.equal(written(fake).length, 0, "nothing committed");
  assert.ok(sentencesOf(target).includes(SENTENCE), `the sentence: ${JSON.stringify(sentencesOf(target))}`);
  const found = listed(target);
  assert.deepEqual(found.map((page) => page.path), [UC7_PATH, UC8_PATH]);
  assert.deepEqual(found.map((page) => page.clipboard), [[changedUseCase("UC-007", UC7_PATH, UC7).text], [changedUseCase("UC-008", UC8_PATH, UC8).text]], "each file as drafted, byte for byte");
  for (const page of found) {
    assert.ok(!decodeURIComponent(page.href).includes("service fails"), "no text in the address");
    assert.deepEqual(page.warnings, [], `${page.path}: no warning where nothing differs`);
  }
});

// TST-622004 · level: unit · module: MOD-review-pages
// guards: UC-019; UC-018; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK
// given: the product of TST-622003, whose default branch no longer has UC-007's file between two readings of one snapshot — the file the draft began with
// input: a click on Save
// expect: the page of UC-007 carries the warning "The file differs on the default branch; compare before committing." beside its text; the page of UC-008 carries no warning and still its text
test("draft — without a token a file of a draft that already differs is warned about on its page", async () => {
  const counting = await savedFiles();
  const last = counting.watch.reads;
  assert.ok(last > 0, "known positive: the unwarned save read the paths");
  const { target } = await savedFiles({ at: last, lacking: [UC7_PATH] });
  const [seven, eight] = listed(target);
  assert.deepEqual(seven.warnings, [WARNING], "UC-007 is warned about");
  assert.equal(seven.clipboard.length, 1, "its text is beside the warning");
  assert.deepEqual(eight.warnings, [], "UC-008 is not");
  assert.equal(eight.clipboard.length, 1, "its text");
});

// ---------------------------------------------------------------- the draft of requirements

// TST-622005 · level: unit · module: MOD-review-pages
// guards: UC-019; UC-018; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK
// given: a GitHub product whose host cannot write and no token stored; the draft of a change of A LOAN HAS A DUE DATE — its rule gains "and says when it is overdue." — from the source SRC-alice
// input: a click on Save
// expect: nothing committed; a paragraph above the list is exactly "There is no token: GitHub's page opens for each file, and you commit them there."; four pages — the queue's index and decisions file, the entry's proposal and its rationale — of the queue docs/spec-freigaben/<day>_edits-of-anonymous, each with exactly one text beside its link; the proposal's text is the section "## 1. Lending" with the changed rule; the rationale's text is "Drafted from SRC-alice on the person's instruction."; the index's text names the section; no address holds a word of the text; no page is warned about
test("draft — without a token the pages of a draft of requirements are fallbackPages' list: the sentence, each file's text, no warning", async () => {
  const { fake, target } = await savedRequirements();
  assert.equal(written(fake).length, 0, "nothing committed");
  assert.ok(sentencesOf(target).includes(SENTENCE), `the sentence: ${JSON.stringify(sentencesOf(target))}`);
  const found = listed(target);
  const queue = /^(docs\/spec-freigaben\/lending)\//.exec(found[0].path)?.[1];
  assert.ok(queue, `the queue of the section: ${found[0].path}`);
  assert.deepEqual(found.map((page) => page.path.replace(queue, "<queue>")).sort(), ["<queue>/01-lending.begruendung.md", "<queue>/01-lending.md", "<queue>/entscheidungen.md", "<queue>/index.md"]);
  for (const page of found) {
    assert.equal(page.clipboard.length, 1, `${page.path}: one text beside the link`);
    assert.ok(!decodeURIComponent(page.href).includes("overdue"), "no text in the address");
    assert.deepEqual(page.warnings, [], `${page.path}: no warning where nothing differs`);
  }
  const textOf = (suffix) => found.find((page) => page.path.endsWith(suffix)).clipboard[0];
  assert.match(textOf("/01-lending.md"), /^## 1\. Lending\n/);
  assert.match(textOf("/01-lending.md"), /Every loan states the date by which the book is returned, and says when it is overdue\./);
  assert.match(textOf("/01-lending.begruendung.md"), /Drafted from SRC-alice on the person's instruction\./);
  assert.match(textOf("/index.md"), /\| 01 \| `SPEC.md` \| ## 1\. Lending \|/);
});

// TST-622006 · level: unit · module: MOD-review-pages
// guards: UC-019; UC-018; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK
// given: the product of TST-622005, whose default branch gains the queue's index between two readings of one snapshot — the file the draft began without
// input: a click on Save
// expect: the page of the index carries the warning "The file differs on the default branch; compare before committing." beside its text; no other page carries a warning, and each other page still carries its text
test("draft — without a token the index of a draft of requirements that already differs is warned about on its page", async () => {
  const counting = await savedRequirements();
  const last = counting.watch.reads;
  assert.ok(last > 0, "known positive: the unwarned save read the paths");
  const index = listed(counting.target).find((page) => page.path.endsWith("/index.md")).path;
  const { target } = await savedRequirements({ at: last, extra: [index] });
  const found = listed(target);
  const warned = found.find((page) => page.path === index);
  assert.deepEqual(warned.warnings, [WARNING], "the index is warned about");
  assert.equal(warned.clipboard.length, 1, "its text is beside the warning");
  for (const page of found.filter((each) => each !== warned)) {
    assert.deepEqual(page.warnings, [], `${page.path}: no warning`);
    assert.equal(page.clipboard.length, 1, `${page.path}: its text`);
  }
});

// ---------------------------------------------------------------- what the edit began from

// TST-611007 · level: unit · module: MOD-review-pages
// guards: UC-018; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK
// given: the product of TST-622001, whose default branch has moved to another commit since the entry's editor was opened, and whose repository at the commit it was opened on lacked the entry's proposal that the default branch holds now
// input: a click on Save
// expect: the page of the proposal carries the warning "The file differs on the default branch; compare before committing." beside its text; the page of the rationale carries no warning and still its text
test("spec-entry/<id>/edit — without a token a file that appeared on the default branch since the editor was opened is warned about on its page", async () => {
  const { target } = await savedEntry(null, { lacking: [`${QUEUE}/01-lending.md`] });
  const [proposal, rationale] = listed(target);
  assert.deepEqual(proposal.warnings, [WARNING], "the proposal is warned about");
  assert.equal(proposal.clipboard.length, 1, "its text is beside the warning");
  assert.deepEqual(rationale.warnings, [], "the rationale is not");
  assert.equal(rationale.clipboard.length, 1, "its text");
});

// TST-611008 · level: unit · module: MOD-review-pages
// guards: UC-019; UC-018; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK
// given: the product of TST-622005, whose default branch has moved to another commit since the draft was opened, and whose repository at the commit it was opened on held the index of the queue the draft starts, which the default branch no longer holds
// input: a click on Save
// expect: the page of the index carries the warning "The file differs on the default branch; compare before committing." beside its text; no other page carries a warning, and each other page still carries its text
test("draft — without a token the index of a draft of requirements that the default branch lost since the draft was opened is warned about on its page", async () => {
  const index = "docs/spec-freigaben/lending/index.md";
  const { target } = await savedRequirements(null, { extra: [index] });
  const found = listed(target);
  const warned = found.find((page) => page.path === index);
  assert.deepEqual(warned.warnings, [WARNING], "the index is warned about");
  assert.equal(warned.clipboard.length, 1, "its text is beside the warning");
  for (const page of found.filter((each) => each !== warned)) {
    assert.deepEqual(page.warnings, [], `${page.path}: no warning`);
    assert.equal(page.clipboard.length, 1, `${page.path}: its text`);
  }
});
