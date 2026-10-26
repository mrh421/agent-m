// MOD-review-pages' route `draft` shows the conversation's draft (ITM-507), as the accepted text of docs/architecture/MOD-review-pages.md, UC-049 (steps 5, 6) and UC-019
// (steps 7, 8, 9 and the alternative flows 7a, 8a, 8b, 8c, 9a) state it: "`draft` — the draft of the conversation: MOD-prompt-bar's `latestDraft` for the subject the person came from,
// shown against the current text before anything can be saved — files each in the editor as their difference, a use case with a changed identifier the loop left restored first with
// `keptIdentifier` (UC-019 7a); requirements as the sections `entrySections` composes from the draft and its classes as the author leaves them, each requirement beside the one it
// refers to with its class, a conflict undecided kept out of what is saved (UC-019 8a); an architecture file with its rounds, the due diligence …. *Save* saves the draft as an edit
// of UC-018 is saved — the files with one `saveFile`, in one commit (UC-019 8b), each section with `proposeSection` as an entry of the person's open queue of the day —, only on the
// text the job read, with GitHub's pages without a token, and with the job's provenance lines, which name no message of the conversation (UC-019 step 9, 9a); *Discard* drops the
// draft. … A draft of the kind `converse` … is shown and saved the same way, each file with `saveFile` after its owner's schema found no error."
// Run: node --test tests/review-pages-conversation-draft.test.mjs
//
// Module: MOD-review-pages
// Guards: UC-049; UC-019; A DRAFTED CHANGE IS SHOWN AGAINST THE CURRENT TEXT; A SPEC EDIT IS SAVED AS A PROPOSAL; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; A REFUSED SAVE KEEPS THE EDIT; AN EDITED FILE KEEPS ITS IDENTIFIER; A CONFLICT IS DECIDED BY A PERSON; THE PERSON WHO PROMPTS IS A SOURCE; A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON; AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; NO TEXT TRAVELS IN A URL; THE ROUNDS ARE COUNTED AND SHOWN
// Level: component
//
// The fixtures are tests/review-pages-draft-world.mjs'. The conversation's draft is kept in the tab as MOD-prompt-bar's `ConversationDraft` states it (subject, kind, participant, the
// parameters the message was prepared with, the job's result) and read by the real `latestDraft`; the page is drawn by the real route with the real MOD-artifact-edits, MOD-spec-changes,
// MOD-approvals, MOD-documents, MOD-markdown-render and MOD-job-runner. The tests run under a spy on `fetch` that refuses, and none is called. Where the module file leaves a reading
// open, the test states the one it takes, and the pull request names it:
//   - The route is drawn with the part `subject=<the key of the subject>`: #draft/subject=<key, encoded> is what a subject's `draftRoute` is.
//   - Without a draft for that subject — none in the tab, or one for another subject, or no part `subject` — the page holds <p class="none"> and, with a subject, <a class="back"> to
//     #<the key>.
//   - Files: <p class="rounds"> "Correction rounds: <n>", <ul class="left"> with a <li> for each finding left, and <section class="drafts"> with one <div class="draft" data-path> for each
//     file — the editor of MOD-markdown-render opened on the current text with the draft shown against it, which saves all the files together —, <button class="discard">, and
//     <div class="saved"> with <p class="saved"> linking the commit. The answer of a `converse` draft is <div class="answer">. An architecture draft adds <section class="rounds"> (the
//     rounds of its job) and <section class="due-diligence"> for a decision with such a section.
//   - Each <li class="left"> is one finding in the one fixed text form `<artifact>:<line>: <kind>: <what> [<rule>] — <fix>.` (ITM-559; `A FINDING READS LIKE A COMPILER MESSAGE`), for a draft of
//     files and of requirements alike.
//   - Requirements are shown as the old requirement prompt page showed them: <ul class="candidates"> with <li class="candidate" data-name> for each candidate — <select class="class">, <input
//     class="of">, <textarea class="candidate-rule">, <section class="current-requirement"> and <section class="candidate-difference"> —, <section class="composed-sections"> with a
//     <section class="composed-section"> for each section that would be saved, <button class="save"> and <button class="discard">; a refused section is <div class="newer">, a saved one
//     <p class="entry">.
//   - "The text the job read" is, for the file or SPEC section the subject names, the `version` among the draft's parameters; for any other file or section, the text the page read.
//   - A converse draft's file whose owner's schema (use case, decision, module file) finds an error opens with Save disabled, "Save is disabled: <the finding>".
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { ARC1, ARC_PATH, DUE_DILIGENCE, HIDE, INSTANCE_COMMIT, LENDING, LOAN, PRODUCT, PRODUCT_FILES, RENEW, ROUND_ONE, SOURCE, SPEC, UC7, UC7_PATH, UC8, UC8_PATH,
  blobOf, buttonsNamed, byClass, changedUseCase, click, contextOf, draw, fakeProduct, fetched, find, finding, keepDraft, resultOf, routeNamed, routeOfFragment, until }
  from "./review-pages-draft-world.mjs";
import { latestDraft } from "../src/prompt-bar/index.mjs";

test.afterEach(() => { assert.deepEqual(fetched.splice(0), [], "no request left the fixtures"); });

const UC7_KEY = `use-case/id=UC-007/product=${PRODUCT}`;
const ALIGN = "align UC-007 and UC-008 with the new rule";
// Keeps the draft in the tab and draws the route `draft` for the subject `key`, in one context.
async function showDraft(fake, { key = UC7_KEY, kind, params, result, shownFor = key, ...options }) {
  const context = contextOf(fake, options);
  keepDraft(context, { subject: key, kind, params, result });
  const page = await draw(fake, "draft", shownFor === null ? {} : { subject: shownFor }, { context });
  return { ...page, fake };
}
const draftBoxes = (target) => byClass(target, "div", "draft");
const areaIn = (box) => find(box, (node) => node.localName === "textarea")[0];
const written = (fake) => fake.writes().filter((change) => change.files.length > 0);
const useCaseParams = { useCase: "UC-007", version: blobOf(UC7), instruction: ALIGN };
const draft7 = () => changedUseCase("UC-007", UC7_PATH, UC7), draft8 = () => changedUseCase("UC-008", UC8_PATH, UC8);
const messageLines = (change) => change.message.split("\n");
// After Save or Discard (ITM-555): the tab keeps no draft for the subject `key`, and the route draft drawn again in the same context says that there is none.
async function assertDropped(shown, key) {
  assert.equal(latestDraft(shown.context.store, key), null, "the tab keeps no draft for the subject");
  const again = await draw(shown.fake, "draft", { subject: key }, { context: shown.context });
  assert.equal(byClass(again.target, "p", "none").length, 1, "the route says there is no draft");
  assert.equal(draftBoxes(again.target).length, 0, "no editor");
}
const kept = (shown, key) => assert.notEqual(latestDraft(shown.context.store, key), null, "known positive: the tab keeps the draft before the click");

// TST-507020 · level: component · module: MOD-review-pages
// guards: UC-049; UC-019; A DRAFTED CHANGE IS SHOWN AGAINST THE CURRENT TEXT; THE ROUNDS ARE COUNTED AND SHOWN
// given: the conversation's draft for the page of UC-007: a changed UC-007 with an added alternative flow 2b, one correction round
// input: the route draft with the subject of that page
// expect: one draft, UC-007's, its editor holding the draft and the difference against the current text with the added line marked; "Correction rounds: 1"; one Save and one Discard; nothing written
test("draft — a changed use case opens in the editor as its difference against the current text", async () => {
  const fake = fakeProduct();
  const { target } = await showDraft(fake, { kind: "change-use-case", params: useCaseParams, result: resultOf({ files: [draft7()] }, { rounds: [ROUND_ONE] }) });
  const boxes = draftBoxes(target);
  assert.equal(boxes.length, 1);
  assert.equal(boxes[0].getAttribute("data-path"), UC7_PATH);
  assert.equal(areaIn(boxes[0]).value, draft7().text);
  assert.match(byClass(boxes[0], "div", "newer")[0].textContent, /\+ - \*\*2b\. The service fails\./);
  assert.equal(byClass(target, "p", "rounds")[0].textContent, "Correction rounds: 1");
  assert.equal(buttonsNamed(boxes[0], "Save").length, 1);
  assert.equal(byClass(target, "button", "discard").length, 1);
  assert.equal(written(fake).length, 0);
});

// TST-507021 · level: component · module: MOD-review-pages
// guards: UC-019; AN EDITED FILE KEEPS ITS IDENTIFIER; THE ROUNDS ARE COUNTED AND SHOWN
// given: the draft of UC-007 under the identifier UC-043, which the loop left, with the finding "id changed from UC-007 to UC-043 [AN EDITED FILE KEEPS ITS IDENTIFIER]"
// input: the route draft
// expect: the finding is listed among those left; the editor opens with the identifier set back to UC-007 — only the id of the front matter, every other byte as drafted
test("draft — a changed identifier the loop left is restored before the editor opens, and the findings left are shown", async () => {
  const wrong = draft7();
  wrong.text = wrong.text.replace("id: UC-007", "id: UC-043").replace("# UC-007", "# UC-043");
  const left = finding({ artifact: "UC-007", line: 2, kind: "error", rule: "AN EDITED FILE KEEPS ITS IDENTIFIER", what: "id changed from UC-007 to UC-043", fix: "keep UC-007" });
  const fake = fakeProduct();
  const { target } = await showDraft(fake, { kind: "change-use-case", params: useCaseParams, result: resultOf({ files: [wrong] }, { rounds: [ROUND_ONE, { ...ROUND_ONE, number: 2 }], remaining: [left] }) });
  assert.match(byClass(target, "ul", "left")[0].textContent, /AN EDITED FILE KEEPS ITS IDENTIFIER/);
  assert.equal(byClass(target, "p", "rounds")[0].textContent, "Correction rounds: 2");
  assert.equal(areaIn(draftBoxes(target)[0]).value, wrong.text.replace("id: UC-043", "id: UC-007"));
});

// TST-507043 · level: component · module: MOD-review-pages
// guards: UC-019; A FINDING READS LIKE A COMPILER MESSAGE
// given: the draft of UC-007 with two findings left by the loop: the error "UC-007:2: id changed from UC-007 to UC-043 [AN EDITED FILE KEEPS ITS IDENTIFIER]" with the fix "keep UC-007", and the warning "UC-007:12: realises \"EXPORT AS PDF\" matches no requirement [A USE CASE REALISES NAMED REQUIREMENTS]" with the fix "use an existing name or remove the line"
// input: the route draft
// expect: the list of the findings left holds two items, in this order and each exactly one line of the one fixed text form, the artifact and the line first, then the kind, the finding, the rule in brackets and the fix: `UC-007:2: error: id changed from UC-007 to UC-043 [AN EDITED FILE KEEPS ITS IDENTIFIER] — keep UC-007.` and `UC-007:12: warning: realises "EXPORT AS PDF" matches no requirement [A USE CASE REALISES NAMED REQUIREMENTS] — use an existing name or remove the line.`
test("draft — each finding left is shown in the one fixed text form of a compiler message", async () => {
  const error = finding({ artifact: "UC-007", line: 2, kind: "error", rule: "AN EDITED FILE KEEPS ITS IDENTIFIER", what: "id changed from UC-007 to UC-043", fix: "keep UC-007" });
  const warning = finding({ artifact: "UC-007", line: 12, kind: "warning", rule: "A USE CASE REALISES NAMED REQUIREMENTS", what: "realises \"EXPORT AS PDF\" matches no requirement", fix: "use an existing name or remove the line" });
  const fake = fakeProduct();
  const { target } = await showDraft(fake, { kind: "change-use-case", params: useCaseParams, result: resultOf({ files: [draft7()] }, { rounds: [ROUND_ONE], remaining: [error, warning] }) });
  assert.deepEqual(byClass(target, "li", "left").map((item) => item.textContent), [
    "UC-007:2: error: id changed from UC-007 to UC-043 [AN EDITED FILE KEEPS ITS IDENTIFIER] — keep UC-007.",
    "UC-007:12: warning: realises \"EXPORT AS PDF\" matches no requirement [A USE CASE REALISES NAMED REQUIREMENTS] — use an existing name or remove the line.",
  ]);
});

// TST-507044 · level: component · module: MOD-review-pages
// guards: UC-019; A FINDING READS LIKE A COMPILER MESSAGE
// given: the draft of a change of A LOAN HAS A DUE DATE with one finding left by the loop: the error "A LOAN HAS A DUE DATE:4: no check [A REQUIREMENT HAS FOUR FIELDS]" with the fix "add a line `Check:`"
// input: the route draft
// expect: the list of the findings left holds one item, exactly `A LOAN HAS A DUE DATE:4: error: no check [A REQUIREMENT HAS FOUR FIELDS] — add a line `Check:`.`
test("draft — a draft of requirements shows each finding left in the same text form", async () => {
  const left = finding({ artifact: LOAN, line: 4, kind: "error", rule: "A REQUIREMENT HAS FOUR FIELDS", what: "no check", fix: "add a line `Check:`" });
  const fake = fakeProduct();
  const { target } = await showRequirements(fake, { result: resultOf(REQUIREMENTS, { rounds: [ROUND_ONE], remaining: [left] }) });
  assert.deepEqual(byClass(target, "li", "left").map((item) => item.textContent), ["A LOAN HAS A DUE DATE:4: error: no check [A REQUIREMENT HAS FOUR FIELDS] — add a line `Check:`."]);
});

// TST-507022 · level: component · module: MOD-review-pages
// guards: UC-019; AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT; ONE CLICK PER DECISION; A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON
// given: the draft of two use cases, UC-007 and UC-008, for the instruction "align UC-007 and UC-008 with the new rule" among the conversation's messages, the second edited by the person in its editor
// input: a click on Save
// expect: one commit holding both files — the first as drafted, the second as edited, byte for byte, no trailer in a file —, whose message ends with the provenance lines — Agent-M-Version: <the
//   instance's commit>, commit <it>; Agent-M-Kind: change-use-case; Agent-M-Participant: drafter-a; Agent-M-Model: example-model; Agent-M-Rounds: 1 —, no Agent-M-Job line, and no line that
//   holds a word of the conversation; the page links the commit; afterwards latestDraft for the subject gives null, and the route draft drawn again for it says that there is no draft (<p class="none">) and shows no editor
test("draft — Save writes the use cases in one commit with the provenance lines and no message of the conversation", async () => {
  const fake = fakeProduct();
  const conversation = [{ at: "2026-10-16T10:00:00Z", from: "person", who: "alice", text: ALIGN, subject: UC7_KEY }];
  const shown = await showDraft(fake, { kind: "change-use-case", params: { ...useCaseParams, conversation },
    result: resultOf({ files: [draft7(), draft8()] }, { rounds: [ROUND_ONE] }) });
  const { target } = shown;
  kept(shown, UC7_KEY);
  const boxes = draftBoxes(target);
  assert.deepEqual(boxes.map((box) => box.getAttribute("data-path")), [UC7_PATH, UC8_PATH]);
  const edited = `${draft8().text}\nA line the person added.\n`;
  areaIn(boxes[1]).value = edited;
  areaIn(boxes[1]).dispatchEvent(new Event("input"));
  click(buttonsNamed(boxes[0], "Save")[0]);
  await until(() => byClass(target, "p", "saved").length === 1, "the commit");
  assert.equal(written(fake).length, 1, "one commit");
  const [change] = written(fake);
  assert.deepEqual(change.files.map((file) => [file.path, file.text]), [[UC7_PATH, draft7().text], [UC8_PATH, edited]]);
  assert.ok(change.files.every((file) => !file.text.includes("Agent-M-")), "no trailer in a file");
  const lines = messageLines(change);
  for (const wanted of [`Agent-M-Version: ${INSTANCE_COMMIT}, commit ${INSTANCE_COMMIT}`, "Agent-M-Kind: change-use-case", "Agent-M-Participant: drafter-a", "Agent-M-Model: example-model", "Agent-M-Rounds: 1"]) {
    assert.ok(lines.includes(wanted), `${wanted} in ${change.message}`);
  }
  assert.ok(lines.every((line) => !line.startsWith("Agent-M-Job:")), `no job line in ${change.message}`);
  assert.ok(lines.every((line) => !line.includes(ALIGN) && !line.includes("change it")), `no message of the conversation in ${change.message}`);
  assert.ok(find(byClass(target, "p", "saved")[0], (node) => node.localName === "a").some((node) => node.getAttribute("href").includes(`/commit/${fake.head()}`)));
  await assertDropped(shown, UC7_KEY);
});

// TST-507023 · level: component · module: MOD-review-pages
// guards: UC-019; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; A REFUSED SAVE KEEPS THE EDIT
// given: the draft of UC-007 and UC-008 drawn; then another writer changes UC-008, which says "Agent M says so, at once."
// input: a click on Save
// expect: nothing written; both drafts stay in their editors as drafted; the newer UC-008 is beside the draft
test("draft — a use case changed after the page was drawn refuses the save and the draft stays", async () => {
  const fake = fakeProduct();
  const { target } = await showDraft(fake, { kind: "change-use-case", params: useCaseParams, result: resultOf({ files: [draft7(), draft8()] }, { rounds: [ROUND_ONE] }) });
  fake.land({ [UC8_PATH]: UC8.replace("Agent M says so.", "Agent M says so, at once.") });
  const before = written(fake).length;
  click(buttonsNamed(draftBoxes(target)[0], "Save")[0]);
  await until(() => byClass(draftBoxes(target)[0], "div", "newer")[0].textContent.includes("at once."), "the newer text");
  assert.equal(written(fake).length, before, "nothing written");
  assert.equal(areaIn(draftBoxes(target)[0]).value, draft7().text);
  assert.equal(areaIn(draftBoxes(target)[1]).value, draft8().text);
});

// TST-507024 · level: component · module: MOD-review-pages
// guards: UC-019; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; A REFUSED SAVE KEEPS THE EDIT
// given: the draft of UC-007 whose job read an older text of UC-007 — the parameter version is the blob of "an older text of UC-007" — than the one the product holds now; nothing changed after the page was drawn
// input: a click on Save
// expect: nothing written; the draft stays in its editor; the text the product holds now is beside it
test("draft — a use case changed while the participant drafted refuses the save and the draft stays", async () => {
  const fake = fakeProduct();
  const { target } = await showDraft(fake, { kind: "change-use-case", params: { ...useCaseParams, version: blobOf("an older text of UC-007\n") },
    result: resultOf({ files: [draft7()] }, { rounds: [ROUND_ONE] }) });
  click(buttonsNamed(draftBoxes(target)[0], "Save")[0]);
  await until(() => byClass(draftBoxes(target)[0], "div", "newer")[0].textContent.includes("Derive use cases"), "the newer text");
  assert.equal(written(fake).length, 0, "nothing written");
  assert.equal(areaIn(draftBoxes(target)[0]).value, draft7().text);
});

// TST-507025 · level: component · module: MOD-review-pages
// guards: UC-019; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; NO TEXT TRAVELS IN A URL
// given: a GitHub product whose host cannot write, the draft of UC-007
// input: a click on Save
// expect: nothing written; GitHub's page for the file, its address without the text of the draft
test("draft — without a token, GitHub's page opens for each file", async () => {
  const fake = fakeProduct(PRODUCT_FILES, { canWrite: false });
  const { target } = await showDraft(fake, { kind: "change-use-case", params: useCaseParams, result: resultOf({ files: [draft7()] }, { rounds: [ROUND_ONE] }) });
  click(buttonsNamed(draftBoxes(target)[0], "Save")[0]);
  await until(() => byClass(target, "a", "github-page").length === 1, "GitHub's page");
  assert.equal(written(fake).length, 0);
  assert.ok(!decodeURIComponent(byClass(target, "a", "github-page")[0].getAttribute("href")).includes("service fails"), "no text in the address");
});

// TST-507026 · level: component · module: MOD-review-pages
// guards: UC-019; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the draft of UC-007 in its editor
// input: a click on Discard
// expect: the draft is gone from the page and the page says it was discarded and that nothing was written; nothing written; latestDraft for the subject gives null, and the route draft drawn again says that there is no draft
test("draft — Discard drops the draft and writes nothing", async () => {
  const fake = fakeProduct();
  const shown = await showDraft(fake, { kind: "change-use-case", params: useCaseParams, result: resultOf({ files: [draft7()] }, { rounds: [ROUND_ONE] }) });
  const { target } = shown;
  assert.equal(draftBoxes(target).length, 1, "known positive: the draft is there");
  kept(shown, UC7_KEY);
  click(byClass(target, "button", "discard")[0]);
  assert.equal(draftBoxes(target).length, 0);
  assert.match(target.textContent, /The draft was discarded\. Nothing was written\./);
  assert.equal(written(fake).length, 0);
  await assertDropped(shown, UC7_KEY);
});

// TST-507027 · level: component · module: MOD-review-pages
// guards: UC-049; A DRAFTED CHANGE IS SHOWN AGAINST THE CURRENT TEXT
// given: a tab that keeps the draft for UC-007; and a tab that keeps no draft
// input: the route draft for the subject of UC-008; the route draft for the subject of UC-007 with no draft kept; the route draft with no subject
// expect: each says there is no draft (<p class="none">), shows no editor and writes nothing; the first two link back to "#<the subject's key>" — "#use-case/id=UC-008/product=<address>" and "#use-case/id=UC-007/product=<address>"; the third links nowhere
test("draft — without a draft for the subject the page says so and links back to the subject", async () => {
  const fake = fakeProduct();
  const other = await showDraft(fake, { kind: "change-use-case", params: useCaseParams, result: resultOf({ files: [draft7()] }, { rounds: [ROUND_ONE] }), shownFor: `use-case/id=UC-008/product=${PRODUCT}` });
  assert.equal(byClass(other.target, "p", "none").length, 1);
  assert.equal(draftBoxes(other.target).length, 0);
  assert.equal(byClass(other.target, "a", "back")[0].getAttribute("href"), `#use-case/id=UC-008/product=${PRODUCT}`);
  const context = contextOf(fake);
  const empty = await draw(fake, "draft", { subject: UC7_KEY }, { context });
  assert.equal(byClass(empty.target, "p", "none").length, 1);
  assert.equal(byClass(empty.target, "a", "back")[0].getAttribute("href"), `#${UC7_KEY}`);
  const nameless = await draw(fake, "draft", {}, { context });
  assert.equal(byClass(nameless.target, "p", "none").length, 1);
  assert.equal(byClass(nameless.target, "a", "back").length, 0);
  assert.equal(written(fake).length, 0);
});

// TST-507028 · level: component · module: MOD-review-pages
// guards: UC-023; UC-049; THE ROUNDS ARE COUNTED AND SHOWN; A REUSE DECISION RECORDS ITS DUE DILIGENCE; A DRAFTED CHANGE IS SHOWN AGAINST THE CURRENT TEXT
// given: the draft of the decision ARC-001 for a change of the architecture, whose text holds a due-diligence section, with one correction round that had a warning, fixed
// input: the route draft; then a click on Save
// expect: the page shows the file's difference against the current text, the rounds of the job (Round 1 with the warning) and the due diligence (a table with "lend-lib" and "GPL-3.0"); Save writes the
//   file in one commit whose message holds "Agent-M-Kind: change-architecture"; afterwards latestDraft for the subject gives null, and the route draft drawn again for it says that there is no draft (<p class="none">) and shows no editor
test("draft — an architecture file is shown with its rounds and its due diligence, and saved", async () => {
  const diligent = `${ARC1}\n${DUE_DILIGENCE}`;
  const warning = finding({ artifact: "ARC-001", line: 9, kind: "warning", rule: "A REUSE DECISION RECORDS ITS DUE DILIGENCE", what: "the candidate desk-kit has no release history", fix: "record its release history" });
  const rounds = [{ number: 1, findings: [warning], answers: [{ finding: warning, how: "fixed", text: null }], changed: true }];
  const key = `decision/id=ARC-001/product=${PRODUCT}`;
  const fake = fakeProduct();
  const shown = await showDraft(fake, { key, kind: "change-architecture", params: { target: "ARC-001", version: blobOf(ARC1), instruction: "record the due diligence" },
    result: resultOf({ files: [{ path: ARC_PATH, text: diligent, class: "change", of: "ARC-001" }] }, { rounds }) });
  const { target } = shown;
  kept(shown, key);
  assert.match(byClass(draftBoxes(target)[0], "div", "newer")[0].textContent, /\+ \| lend-lib \| MIT \|/);
  const section = byClass(target, "section", "rounds")[0];
  assert.match(section.textContent, /Round 1 — 1 finding/);
  assert.match(section.textContent, /A REUSE DECISION RECORDS ITS DUE DILIGENCE/);
  const table = byClass(target, "section", "due-diligence")[0];
  assert.match(table.textContent, /lend-lib/);
  assert.match(table.textContent, /GPL-3\.0/);
  click(buttonsNamed(draftBoxes(target)[0], "Save")[0]);
  await until(() => byClass(target, "p", "saved").length === 1, "the commit");
  const [change] = written(fake);
  assert.deepEqual(change.files.map((file) => [file.path, file.text]), [[ARC_PATH, diligent]]);
  assert.ok(messageLines(change).includes("Agent-M-Kind: change-architecture"), change.message);
  await assertDropped(shown, key);
});

// ---------------------------------------------------------------- requirements

const candidate = (name, fields = {}) => ({ name, rule: `${name.toLowerCase()} rule.`, check: "`tests/fixture.test.mjs`", constrains: "product", passage: "the instruction", class: "new", ...fields });
const OVERDUE = "Every loan states the date by which the book is returned, and says when it is overdue.";
const REQUIREMENTS = { candidates: [candidate(LOAN, { class: "change", of: LOAN, rule: OVERDUE, passage: "overdue" }), candidate(RENEW, { passage: "renewal" }),
  candidate(HIDE, { class: "conflict", of: LOAN, passage: "due date", rule: "Every loan may hide its due date." })] };
const REQUIREMENTS_KEY = `requirement/name=${encodeURIComponent(LOAN)}/product=${PRODUCT}`;
const requirementsParams = { requirements: [LOAN], source: SOURCE, version: blobOf(LENDING), instruction: "split this requirement" };
const showRequirements = (fake, options = {}) => showDraft(fake, { key: REQUIREMENTS_KEY, kind: "change-requirements", params: requirementsParams,
  result: resultOf(REQUIREMENTS, { rounds: [ROUND_ONE] }), ...options });
const candidateOf = (target, name) => byClass(target, "li", "candidate").find((item) => item.getAttribute("data-name") === name);
const proposalsOf = (fake) => written(fake).flatMap((change) => change.files).filter((file) => /^docs\/spec-freigaben\/[^/]+\/\d\d-[^/]+\.md$/.test(file.path) && !file.path.endsWith(".begruendung.md"));

// TST-507029 · level: component · module: MOD-review-pages
// guards: UC-019; A CONFLICT IS DECIDED BY A PERSON; A CANDIDATE IS NEW, A CHANGE, A DUPLICATE OR A CONFLICT; THE ROUNDS ARE COUNTED AND SHOWN
// given: the draft of a change of A LOAN HAS A DUE DATE: the requirement changed (class change, of itself), A MEMBER CAN RENEW ONCE (new) and THE DUE DATE MAY BE HIDDEN (a conflict with A LOAN HAS A DUE DATE); the person's source SRC-alice (authority informative); one round
// input: the route draft
// expect: three candidates, each with its class — change, new, conflict —; the first beside the requirement it refers to, "Every loan states the date by which the book is returned." with the difference to the drafted rule; the conflict beside the same requirement with the source "SRC-alice (informative)"; the composed section "## 1. Lending" with the changed rule and the new requirement and without the conflict's rule; "Correction rounds: 1"; one Save and one Discard; nothing written
test("draft — requirements are shown with their classes, beside the requirement each refers to, a conflict kept out of the composed section", async () => {
  const fake = fakeProduct();
  const { target } = await showRequirements(fake);
  assert.deepEqual(byClass(target, "li", "candidate").map((item) => item.getAttribute("data-name")), [LOAN, RENEW, HIDE]);
  assert.deepEqual([LOAN, RENEW, HIDE].map((name) => byClass(candidateOf(target, name), "select", "class")[0].value), ["change", "new", "conflict"]);
  const loan = candidateOf(target, LOAN);
  assert.match(byClass(loan, "section", "current-requirement")[0].textContent, /Every loan states the date by which the book is returned\./);
  assert.match(byClass(loan, "section", "candidate-difference")[0].textContent, /and says when it is overdue/);
  const conflict = candidateOf(target, HIDE);
  assert.match(byClass(conflict, "section", "current-requirement")[0].textContent, /Every loan states the date by which the book is returned\./);
  assert.match(byClass(conflict, "p", "candidate-source")[0].textContent, /SRC-alice \(informative\)/);
  const composed = byClass(target, "section", "composed-section");
  assert.equal(composed.length, 1);
  assert.match(composed[0].textContent, /## 1\. Lending/);
  assert.match(composed[0].textContent, /and says when it is overdue/);
  assert.match(composed[0].textContent, /a member can renew once rule\./);
  assert.ok(!composed[0].textContent.includes("may hide its due date"), "the conflict stays out of the composed section");
  assert.equal(byClass(target, "p", "rounds")[0].textContent, "Correction rounds: 1");
  assert.equal(buttonsNamed(target, "Save").length, 1);
  assert.equal(byClass(target, "button", "discard").length, 1);
  assert.equal(written(fake).length, 0);
});

// TST-507030 · level: component · module: MOD-review-pages
// guards: UC-019; A SPEC EDIT IS SAVED AS A PROPOSAL; THE PERSON WHO PROMPTS IS A SOURCE; AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT; A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON
// given: the draft of TST-507029, the conflict undecided
// input: a click on Save
// expect: one commit in a change queue under docs/spec-freigaben/, SPEC.md byte-identical; the proposal holds the changed rule and the new requirement, both naming SRC-alice among their sources, and not the
//   conflict; the commit's message holds Agent-M-Kind: change-requirements, Agent-M-Participant: drafter-a, Agent-M-Model: example-model, Agent-M-Rounds: 1, and no line that holds the instruction
//   "split this requirement"; the page links the commit; afterwards latestDraft for the subject gives null, and the route draft drawn again for it says that there is no draft (<p class="none">) and shows no editor
test("draft — Save writes the composed section as an entry of a queue, the conflict undecided and left out", async () => {
  const fake = fakeProduct();
  const shown = await showRequirements(fake);
  const { target } = shown;
  kept(shown, REQUIREMENTS_KEY);
  click(buttonsNamed(target, "Save")[0]);
  await until(() => byClass(target, "p", "entry").length === 1, "the saved entry");
  assert.equal(fake.files()["SPEC.md"], SPEC, "SPEC.md byte-identical");
  assert.equal(written(fake).length, 1, "one commit");
  const [proposal] = proposalsOf(fake);
  assert.ok(proposal, "an entry of a queue");
  assert.match(proposal.text, /and says when it is overdue/);
  assert.match(proposal.text, new RegExp(`\\*\\*${RENEW}\\*\\* \\*\\(${SOURCE}`));
  assert.ok(!proposal.text.includes(HIDE), "the conflict is not in the proposal");
  const lines = messageLines(written(fake)[0]);
  for (const wanted of ["Agent-M-Kind: change-requirements", "Agent-M-Participant: drafter-a", "Agent-M-Model: example-model", "Agent-M-Rounds: 1"]) assert.ok(lines.includes(wanted), `${wanted} in ${lines.join("|")}`);
  assert.ok(lines.every((line) => !line.includes("split this requirement")), "no message of the conversation");
  await assertDropped(shown, REQUIREMENTS_KEY);
});

// TST-507031 · level: component · module: MOD-review-pages
// guards: UC-019; A CONFLICT IS DECIDED BY A PERSON; A CANDIDATE IS NEW, A CHANGE, A DUPLICATE OR A CONFLICT
// given: the draft of TST-507029
// input: the person sets the class of the conflict to new in its select, then clicks Save
// expect: the composed section now holds the rule "Every loan may hide its due date."; the saved proposal holds it too, under the name THE DUE DATE MAY BE HIDDEN
test("draft — a conflict the author decides is composed and saved", async () => {
  const fake = fakeProduct();
  const { target } = await showRequirements(fake);
  const select = byClass(candidateOf(target, HIDE), "select", "class")[0];
  select.value = "new";
  select.dispatchEvent(new Event("change"));
  assert.match(byClass(target, "section", "composed-section")[0].textContent, /Every loan may hide its due date\./);
  click(buttonsNamed(target, "Save")[0]);
  await until(() => byClass(target, "p", "entry").length === 1, "the saved entry");
  const [proposal] = proposalsOf(fake);
  assert.match(proposal.text, new RegExp(`\\*\\*${HIDE}\\*\\*`));
  assert.match(proposal.text, /Every loan may hide its due date\./);
});

// TST-507032 · level: component · module: MOD-review-pages
// guards: UC-019; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; A REFUSED SAVE KEEPS THE EDIT
// given: the draft of TST-507029 drawn; then the SPEC section "## 1. Lending" changes on the default branch
// input: a click on Save
// expect: nothing written; the draft stays in the page; the section as it stands now is beside the composed section (<div class="newer">)
test("draft — a SPEC section changed after the page was drawn refuses the save and the draft stays", async () => {
  const fake = fakeProduct();
  const { target } = await showRequirements(fake);
  fake.land({ "SPEC.md": SPEC.replace("Every book stands on a shelf.", "Every book stands on a shelf, tidily.") });
  click(buttonsNamed(target, "Save")[0]);
  await until(() => byClass(target, "div", "newer").length === 1 && byClass(target, "div", "newer")[0].textContent.includes("tidily"), "the newer section");
  assert.equal(written(fake).length, 0, "nothing written");
  assert.equal(byClass(target, "li", "candidate").length, 3, "the draft stays");
});

// TST-507033 · level: component · module: MOD-review-pages
// guards: UC-019; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE
// given: the draft of TST-507029 whose job read an older section — the parameter version is the blob of "an older section" — than the SPEC holds now
// input: a click on Save
// expect: nothing written; the section as it stands now is beside the composed section
test("draft — a SPEC section changed while the participant drafted refuses the save", async () => {
  const fake = fakeProduct();
  const { target } = await showRequirements(fake, { params: { ...requirementsParams, version: blobOf("an older section\n") } });
  click(buttonsNamed(target, "Save")[0]);
  await until(() => byClass(target, "div", "newer").length === 1 && byClass(target, "div", "newer")[0].textContent.includes("Every book stands on a shelf."), "the newer section");
  assert.equal(written(fake).length, 0, "nothing written");
});

// TST-507034 · level: component · module: MOD-review-pages
// guards: UC-019; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the draft of requirements in the page
// input: a click on Discard
// expect: the candidates are gone and the page says the draft was discarded and nothing written; nothing written; afterwards latestDraft for the subject gives null, and the route draft drawn again for it says that there is no draft (<p class="none">) and shows no editor
test("draft — Discard drops the requirements and writes nothing", async () => {
  const fake = fakeProduct();
  const shown = await showRequirements(fake);
  const { target } = shown;
  assert.equal(byClass(target, "li", "candidate").length, 3, "known positive: the candidates are there");
  kept(shown, REQUIREMENTS_KEY);
  click(byClass(target, "button", "discard")[0]);
  assert.equal(byClass(target, "li", "candidate").length, 0);
  assert.match(target.textContent, /The draft was discarded\. Nothing was written\./);
  assert.equal(written(fake).length, 0);
  await assertDropped(shown, REQUIREMENTS_KEY);
});

// TST-636011 · level: component · module: MOD-review-pages
// guards: UC-019; A CHANGE IS PROPOSED UNDER THE EXISTING NAME; A SPEC EDIT IS SAVED AS A PROPOSAL
// given: the draft of a change of A LOAN HAS A DUE DATE with two candidates that change it: A LOAN HAS A DUE DATE (class change, of itself) and A MEMBER CAN RENEW ONCE (class change, of A LOAN HAS A DUE DATE)
// input: the route draft; a click on Save; then the person sets the class of A MEMBER CAN RENEW ONCE to new and clicks Save
// expect: the page shows no composed section and one problem reading "TwoChanges: A LOAN HAS A DUE DATE and A MEMBER CAN RENEW ONCE change A LOAN HAS A DUE DATE: one block would replace the other. Nothing was composed. To go on, give one of the two the class new, or merge them into one.";
//   after the first Save the same text is shown a second time, as the result of Save, the two candidates are still there and nothing is written; after the class is set to new the composed section is shown and the second Save writes one commit whose proposal holds
//   the changed rule of A LOAN HAS A DUE DATE and the block A MEMBER CAN RENEW ONCE
test("draft — two candidates that change one requirement are refused on the page and on Save, nothing written", async () => {
  const fake = fakeProduct();
  const refusal = `TwoChanges: ${LOAN} and ${RENEW} change ${LOAN}: one block would replace the other. Nothing was composed. To go on, give one of the two the class new, or merge them into one.`;
  const draft = { candidates: [candidate(LOAN, { class: "change", of: LOAN, rule: OVERDUE, passage: "overdue" }), candidate(RENEW, { class: "change", of: LOAN, passage: "renewal" })] };
  const { target } = await showRequirements(fake, { result: resultOf(draft, { rounds: [ROUND_ONE] }) });
  const problems = () => byClass(target, "p", "problem").map((node) => node.textContent);
  assert.deepEqual(problems(), [refusal]);
  assert.equal(byClass(target, "section", "composed-section").length, 0);
  click(buttonsNamed(target, "Save")[0]);
  await until(() => problems().length === 2, "the result of Save");
  assert.deepEqual(problems(), [refusal, refusal]);
  assert.equal(byClass(target, "li", "candidate").length, 2, "the draft stays");
  assert.equal(written(fake).length, 0, "nothing written");
  const select = byClass(candidateOf(target, RENEW), "select", "class")[0];
  select.value = "new";
  select.dispatchEvent(new Event("change"));
  assert.equal(byClass(target, "section", "composed-section").length, 1);
  click(buttonsNamed(target, "Save")[0]);
  await until(() => byClass(target, "p", "entry").length === 1, "the saved entry");
  assert.equal(written(fake).length, 1, "one commit");
  const [proposal] = proposalsOf(fake);
  assert.match(proposal.text, /and says when it is overdue/);
  assert.match(proposal.text, new RegExp(`\\*\\*${RENEW}\\*\\*`));
});

// TST-066501 · level: component · module: MOD-review-pages
// guards: UC-019; EVERY STEP EXPLAINS ITSELF
// given: the draft of a change with one candidate of the class change of a requirement the SPEC does not hold
// input: the route draft
// expect: counter-proof — the page shows one problem reading "RequirementNotFound: the SPEC holds no requirement NO SUCH REQUIREMENT", which gives no advice on how to go on: the panel's words for two changes are
//   for that refusal alone
test("draft — a refusal other than two changes gets no advice on how to go on", async () => {
  const fake = fakeProduct();
  const draft = { candidates: [candidate(LOAN, { class: "change", of: "NO SUCH REQUIREMENT", rule: OVERDUE, passage: "overdue" })] };
  const { target } = await showRequirements(fake, { result: resultOf(draft, { rounds: [ROUND_ONE] }) });
  assert.deepEqual(byClass(target, "p", "problem").map((node) => node.textContent), ["RequirementNotFound: the SPEC holds no requirement NO SUCH REQUIREMENT"]);
});

// ---------------------------------------------------------------- leaving the draft (ITM-671)

// UC-018 7a: "The author leaves the editor with unsaved changes. The dashboard asks before discarding", and MOD-review-pages' edit routes' `leave`, which keeps unsaved changes by the editor's
// `close` (ITM-603). Readings the module file leaves open, which the pull request names: the route `draft` gives the frame the same `leave` and `unsaved`, over all the editors of the page drawn
// last; `leave` asks once, for the first editor that holds unsaved changes, and the page stays as it is when the person declines; a page without an editor, or a draft saved or discarded, lets itself be left.
const QUESTION = "Discard unsaved changes?";
async function withConfirm(answers, body) {
  const prior = Object.getOwnPropertyDescriptor(globalThis, "confirm");
  const asked = [];
  Object.defineProperty(globalThis, "confirm", { configurable: true, value: (message) => { asked.push(message); return answers.shift(); } });
  try { await body(asked); } finally { if (prior) Object.defineProperty(globalThis, "confirm", prior); else delete globalThis.confirm; }
}
const editFirst = (target, text) => { const area = areaIn(draftBoxes(target)[0]); area.value = text; area.dispatchEvent(new Event("input")); return area; };
const filesDraft = () => ({ kind: "change-use-case", params: useCaseParams, result: resultOf({ files: [draft7(), draft8()] }, { rounds: [ROUND_ONE] }) });

// TST-067101 · level: component · module: MOD-review-pages
// guards: UC-018; UC-019
// given: the draft of UC-007 and UC-008 drawn, the first editor's text changed to "changed text", and a confirmation that first declines, then accepts
// input: route.leave() twice
// expect: leave is a function; the first call returns false and asks "Discard unsaved changes?" once, and the editor is still drawn with "changed text"; the second returns true, asks a second time, and the edited editor is removed (the one never changed is left with the page)
test("TST-067101 draft: leave asks through the editors' close, keeps the page when the discard is declined and closes it when accepted", async () => {
  await withConfirm([false, true], async (asked) => {
    const { route, target } = await showDraft(fakeProduct(), filesDraft());
    assert.equal(typeof route.leave, "function", "the route gives the frame a leave");
    assert.equal(draftBoxes(target).length, 2, "known positive: the editors are drawn");
    const area = editFirst(target, "changed text");
    assert.equal(route.leave(), false);
    assert.deepEqual(asked, [QUESTION]);
    assert.equal(area.value, "changed text");
    assert.equal(byClass(target, "div", "editor").length, 2, "both editors stay");
    assert.equal(route.leave(), true);
    assert.deepEqual(asked, [QUESTION, QUESTION]);
    assert.equal(byClass(target, "div", "editor").length, 1, "the edited editor is closed; the one never changed is left with the page");
  });
});

// TST-067102 · level: component · module: MOD-review-pages
// guards: UC-018; UC-019
// given: the same draft with no editor changed, and a confirmation that would decline
// input: route.leave() and route.unsaved()
// expect: leave returns true and asks nothing; unsaved is false; after the first editor is changed it is true, without asking anyone
test("TST-067102 draft: an unchanged draft lets itself be left without asking, and unsaved passes the editors' through", async () => {
  await withConfirm([false], async (asked) => {
    const { route, target } = await showDraft(fakeProduct(), filesDraft());
    assert.equal(draftBoxes(target).length, 2, "known positive: the editors are drawn");
    assert.equal(route.unsaved(), false);
    editFirst(target, "changed text");
    assert.equal(route.unsaved(), true);
    assert.deepEqual(asked, []);
  });
  await withConfirm([false], async (asked) => {
    const { route, target } = await showDraft(fakeProduct(), filesDraft());
    assert.equal(draftBoxes(target).length, 2);
    assert.equal(route.leave(), true);
    assert.deepEqual(asked, []);
  });
});

// TST-067103 · level: component · module: MOD-review-pages
// guards: UC-018; UC-019
// given: the draft with an edited editor, then Discard pressed; and, in another page, a draft of requirements, which opens no editor; a confirmation that would decline
// input: route.leave() after Discard, and route.leave() on the requirements' page
// expect: counter-proof — a draft discarded, and a page without an editor, let themselves be left: true, nothing asked
test("TST-067103 draft: a discarded draft and a draft without an editor let themselves be left", async () => {
  await withConfirm([false], async (asked) => {
    const { route, target } = await showDraft(fakeProduct(), filesDraft());
    editFirst(target, "changed text");
    assert.equal(route.unsaved(), true, "known positive: the edit is unsaved");
    click(byClass(target, "button", "discard")[0]);
    assert.equal(route.leave(), true);
    assert.deepEqual(asked, []);
  });
  await withConfirm([false], async (asked) => {
    const draft = { candidates: [{ name: LOAN, rule: "r", source: "Product Owner", passage: "p", class: "new", of: null }] };
    const { route } = await showDraft(fakeProduct(), { kind: "change-requirements", params: { requirements: [LOAN], instruction: "x" }, result: resultOf(draft, { rounds: [ROUND_ONE] }) });
    assert.equal(route.leave(), true);
    assert.deepEqual(asked, []);
  });
});

// TST-067104 · level: component · module: MOD-review-pages
// guards: UC-018; UC-019
// given: the draft of UC-007 and UC-008 with an edited editor, and then the route draft drawn again in a target of its own for a subject that has no draft, as the frame does once it was allowed to leave; a confirmation that would decline
// input: route.leave()
// expect: counter-proof — the editors of a page drawn earlier are not the route's now: leave returns true and asks nothing
test("TST-067104 draft: the editors of a page drawn earlier are not asked once the route has drawn another page", async () => {
  await withConfirm([false], async (asked) => {
    const first = await showDraft(fakeProduct(), filesDraft());
    editFirst(first.target, "changed text");
    assert.equal(first.route.unsaved(), true, "known positive: the edit is unsaved");
    const second = document.createElement("div");
    document.body.append(second);
    await first.route.render(second, first.context, {});
    assert.equal(first.route.leave(), true);
    assert.deepEqual(asked, []);
  });
});

// TST-067108 · level: component · module: MOD-review-pages
// guards: UC-018; UC-019
// given: the route draft rendered twice for the same draft, the first render ending after the second: the first render's first read is held; the second renders, is drawn and its first editor changed
// input: route.leave() after both have ended
// expect: counter-proof — the late render's editors are not the route's: leave asks the newer editor: it returns false and asks once
test("TST-067108 draft: two renders, the first ending last, leave the newer page as the one leave asks", async () => {
  await withConfirm([false], async (asked) => {
    const fake = fakeProduct();
    const context = contextOf(fake);
    keepDraft(context, { subject: UC7_KEY, ...filesDraft() });
    const realRead = context.product.host.readSnapshot.bind(context.product.host);
    let release = null, held = false;
    context.product.host = { ...context.product.host, async readSnapshot(ref) {
      if (!held) { held = true; await new Promise((resolve) => { release = resolve; }); }
      return realRead(ref);
    } };
    const route = routeNamed("draft");
    const firstTarget = document.createElement("div"), secondTarget = document.createElement("div");
    document.body.append(firstTarget, secondTarget);
    const first = route.render(firstTarget, context, { subject: UC7_KEY });
    for (let at = 0; at < 10; at += 1) await new Promise((resolve) => setImmediate(resolve));
    assert.equal(held, true, "known positive: the first render waits for its read");
    await route.render(secondTarget, context, { subject: UC7_KEY });
    release();
    await first;
    assert.equal(draftBoxes(firstTarget).length, 2, "known positive: the late render drew editors of its own");
    editFirst(secondTarget, "newer text");
    assert.equal(route.leave(), false);
    assert.deepEqual(asked, [QUESTION]);
  });
});

// TST-067109 · level: component · module: MOD-review-pages
// guards: UC-018; UC-019; ONE CLICK PER DECISION
// given: the draft of UC-007 and UC-008, the first editor's text changed, and Save pressed, which writes both files
// input: route.unsaved() and route.leave()
// expect: counter-proof — what was saved is not unsaved: false, and leave returns true and asks nothing
test("TST-067109 draft: after Save the saved text is not unsaved", async () => {
  await withConfirm([false], async (asked) => {
    const fake = fakeProduct();
    const { route, target } = await showDraft(fake, filesDraft());
    editFirst(target, `${draft7().text}\nA line the person added.\n`);
    assert.equal(route.unsaved(), true, "known positive: the change is unsaved");
    click(buttonsNamed(draftBoxes(target)[0], "Save")[0]);
    await until(() => byClass(target, "p", "saved").length === 1, "the commit");
    assert.equal(route.unsaved(), false);
    assert.equal(route.leave(), true);
    assert.deepEqual(asked, []);
  });
});

// ---------------------------------------------------------------- the kind converse

const NOTES_PATH = "docs/notes.md";
const NOTES = "# Notes\n\nA note the participant proposed.\n";

// TST-507035 · level: component · module: MOD-review-pages
// guards: UC-049; A DRAFTED CHANGE IS SHOWN AGAINST THE CURRENT TEXT; A GENERATED ARTIFACT IS A PROPOSAL
// given: the draft of a conversation of the kind converse: the answer "Here is the change." and two edits — UC-007 changed, and a new file docs/notes.md
// input: the route draft; then a click on Save
// expect: the answer is shown; two drafts, each in an editor, the new file as all added lines against nothing; Save writes both in one commit, the new file too, and the message holds Agent-M-Kind: converse; afterwards latestDraft for the subject gives null, and the route draft drawn again for it says that there is no draft (<p class="none">) and shows no editor
test("draft — the edits of a converse draft are shown and saved, a new file too", async () => {
  const fake = fakeProduct();
  const shown = await showDraft(fake, { kind: "converse", params: { ...useCaseParams, page: "the page" },
    result: resultOf({ answer: "Here is the change.", edits: [{ path: UC7_PATH, text: draft7().text }, { path: NOTES_PATH, text: NOTES }] }, { rounds: [ROUND_ONE] }) });
  const { target } = shown;
  kept(shown, UC7_KEY);
  assert.match(byClass(target, "div", "answer")[0].textContent, /Here is the change\./);
  const boxes = draftBoxes(target);
  assert.deepEqual(boxes.map((box) => box.getAttribute("data-path")), [UC7_PATH, NOTES_PATH]);
  assert.match(byClass(boxes[1], "div", "newer")[0].textContent, /\+ A note the participant proposed\./);
  click(buttonsNamed(boxes[0], "Save")[0]);
  await until(() => byClass(target, "p", "saved").length === 1, "the commit");
  assert.equal(written(fake).length, 1, "one commit");
  assert.deepEqual(written(fake)[0].files.map((file) => [file.path, file.text]), [[UC7_PATH, draft7().text], [NOTES_PATH, NOTES]]);
  assert.ok(messageLines(written(fake)[0]).includes("Agent-M-Kind: converse"));
  await assertDropped(shown, UC7_KEY);
});

// TST-507036 · level: component · module: MOD-review-pages
// guards: UC-049; A DRAFTED CHANGE IS SHOWN AGAINST THE CURRENT TEXT; AN EDITED FILE KEEPS ITS IDENTIFIER
// given: a converse draft whose edit of UC-007 keeps its identifier and drops the section "## Postcondition", which the schema of a use case requires
// input: the route draft; a click on Save
// expect: the editor opens with Save disabled — "Save is disabled: the section ## Postcondition is required, and missing" —; the click writes nothing
test("draft — a converse edit its owner's schema finds an error in cannot be saved", async () => {
  const broken = UC7.replace(/## Postcondition[^]*$/, "");
  const fake = fakeProduct();
  const { target } = await showDraft(fake, { kind: "converse", params: useCaseParams, result: resultOf({ answer: "Here.", edits: [{ path: UC7_PATH, text: broken }] }, { rounds: [ROUND_ONE] }) });
  assert.match(draftBoxes(target)[0].textContent, /Save is disabled: .*the section ## Postcondition is required, and missing/);
  click(buttonsNamed(draftBoxes(target)[0], "Save")[0]);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(written(fake).length, 0, "nothing written");
});

// ---------------------------------------------------------------- from the subject to the draft

// TST-507037 · level: component · module: MOD-review-pages
// guards: UC-049; UC-019
// given: the page of UC-007 drawn; the prompt bar keeps a draft for its subject and goes to the subject's draftRoute
// input: the route the draftRoute names, drawn with the parameters the frame reads from it, in the same context; then Save
// expect: the draft is shown — UC-007's editor with the difference; Save writes the file in one commit with the version the subject gave in the parameters of the draft
test("draft — the route a subject names shows the draft kept for that subject", async () => {
  const fake = fakeProduct();
  const base = await draw(fake, "use-case", { id: "UC-007" });
  const subject = base.subject();
  // The draft's kind is the one the conversation handed the change on to (MOD-prompt-bar): a subject names none.
  keepDraft(base.context, { subject: subject.key, kind: "change-use-case", params: { ...subject.paramsFor({ name: "drafter-a" }), instruction: "add error handling" },
    result: resultOf({ files: [draft7()] }, { rounds: [ROUND_ONE] }) });
  const { name, params } = routeOfFragment(subject.draftRoute);
  assert.equal(name, "draft");
  assert.ok(routeNamed(name));
  const { target } = await draw(fake, name, params, { context: base.context });
  assert.equal(draftBoxes(target).length, 1);
  click(buttonsNamed(draftBoxes(target)[0], "Save")[0]);
  await until(() => byClass(target, "p", "saved").length === 1, "the commit");
  assert.deepEqual(written(fake)[0].files.map((file) => [file.path, file.text]), [[UC7_PATH, draft7().text]]);
});
