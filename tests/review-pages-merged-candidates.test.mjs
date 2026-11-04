// MOD-review-pages' panel of a derivation of requirements keeps candidates that state one rule as one. UC-005 step 6.1: "candidates of this run that state the same rule are merged into one, naming every
// passage"; CANDIDATES ARE DEDUPLICATED AMONG THEMSELVES. The correction loop makes the merge (the class of the last round carries the `refs` of both candidates and their passages); the panel shows that
// one candidate with every passage, and *Write proposals* writes one requirement. A draft of the conversation (candidates.mjs, candidateRows) is the same panel and keeps the merge the same way.
// Run: node --test tests/review-pages-merged-candidates.test.mjs
//
// Module: MOD-review-pages
// Guards: UC-005; CANDIDATES ARE DEDUPLICATED AMONG THEMSELVES
// Level: unit
//
// The panel is reached the way a person reaches it, through the harness of tests/uc-005-harness.mjs unchanged: the route spec-entry/draft, the participant, Show the run panel, Run, and the endpoint's
// answer, a real job's draft whose last round the real classification of MOD-job-runner merges. Run and Write proposals are pressed here and awaited with tests/review-pages-wait.mjs. The product and the
// instance are in-memory hosts, every commit recorded; the model endpoint is a fixture behind global fetch, so nothing reaches the network. Each test states its input and its expected result before it runs
// (given / input / expect), and the texts it expects are written out here, taken from no document.

import "./review-pages-harness.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { byClass, candidate, click, find, groupsOf, itemOf, LOAN, MAIN_FILE, restoreFetch, setClass, world, writtenFiles } from "./uc-005-harness.mjs";
import { until } from "./review-pages-wait.mjs";
import { candidateRows, editedResult } from "../src/review-pages/candidates.mjs";

test.afterEach(() => restoreFetch());

const FINE = "A FINE IS CHARGED", COST = "LATE LOANS COST A FINE", RULE = "A late loan is charged a fine.";
const RETURN = "A LOAN IS RETURNED", RETURN_RULE = "Every borrowed book is brought back.";
const FINE_5 = candidate(FINE, { rule: RULE, passage: "ch. 5" });
// The same rule in other words of capitals: the normalised rule decides, so the loop merges it into the first.
const COST_6 = candidate(COST, { rule: "a late loan is charged a fine.", passage: "ch. 6" });

const textOf = (node) => node.textContent;
const sectionOf = (w) => Object.entries(writtenFiles(w)).find(([path]) => path.endsWith("01-lending.md"))[1];

// Run and Write proposals as a person presses them, awaited with the wait of the review pages.
async function derived(candidates) {
  const w = await world({ answers: { candidates } });
  const prepared = await w.prepare({ files: [MAIN_FILE] });
  const buttons = find(prepared.page, (node) => node.localName === "button" && node.textContent === "Run");
  click(buttons[0]);
  await until(prepared.page, () => byClass(prepared.page, "section", "requirements-result").length === 1, "the candidates");
  const panel = byClass(prepared.page, "section", "requirements-result")[0];
  const write = async () => {
    const before = byClass(panel, "p", "written").length;
    click(byClass(panel, "button", "write-proposals")[0]);
    await until(prepared.page, () => byClass(panel, "p", "written").length > before, "the write result");
  };
  return { w, panel, write };
}

// TST-1390001 · level: unit · module: MOD-review-pages
// guards: UC-005; CANDIDATES ARE DEDUPLICATED AMONG THEMSELVES
// given: the endpoint answers A FINE IS CHARGED (passage ch. 5) and LATE LOANS COST A FINE (passage ch. 6), which state the rule "A late loan is charged a fine." in other words of capitals, both new
// input: the route spec-entry/draft, drafter-a, Run
// expect: the panel holds one candidate item, A FINE IS CHARGED, in the group new, and none named LATE LOANS COST A FINE; its text names both passages ch. 5 and ch. 6
test("spec-entry/draft - two candidates that state one rule stand as one candidate naming both passages", async () => {
  const { panel } = await derived([FINE_5, COST_6]);
  assert.equal(byClass(panel, "li", "candidate").length, 1, "one candidate on the panel");
  assert.deepEqual(groupsOf(panel), { new: [FINE] });
  assert.equal(itemOf(panel, COST), undefined, "the merged candidate is not on the panel");
  assert.match(textOf(itemOf(panel, FINE)), /ch\. 5/);
  assert.match(textOf(itemOf(panel, FINE)), /ch\. 6/);
});

// TST-1390002 · level: unit · module: MOD-review-pages
// guards: UC-005; CANDIDATES ARE DEDUPLICATED AMONG THEMSELVES
// given: the draft of TST-1390001
// input: Write proposals
// expect: the section written to the queue entry 01-lending.md holds the rule "A late loan is charged a fine." once, the name A FINE IS CHARGED once and the name LATE LOANS COST A FINE not at all; the requirement's sources name both SRC-policy, ch. 5 and SRC-policy, ch. 6
test("spec-entry/draft - Write proposals writes the merged candidates as one requirement", async () => {
  const { w, write } = await derived([FINE_5, COST_6]);
  await write();
  const section = sectionOf(w);
  assert.equal(section.split(RULE).length - 1, 1, "the rule is written once");
  assert.equal(section.split(`**${FINE}**`).length - 1, 1, "the requirement is written once");
  assert.ok(!section.includes(COST), "the merged name is written nowhere");
  assert.match(section, /\*\*A FINE IS CHARGED\*\* \*\(SRC-policy, ch\. 5; SRC-policy, ch\. 6\)\*/);
});

// TST-1390003 · level: unit · module: MOD-review-pages
// guards: UC-005; CANDIDATES ARE DEDUPLICATED AMONG THEMSELVES
// given: the endpoint answers A FINE IS CHARGED (rule "A late loan is charged a fine.", ch. 5) and A LOAN IS RETURNED (rule "Every borrowed book is brought back.", ch. 6), which state two rules, both new
// input: Run, then Write proposals
// expect: known positive: two candidates stay two — the panel holds both items in the group new, and the written section holds both requirements, each with its own passage only
test("spec-entry/draft - candidates that state two rules stay two", async () => {
  const { w, panel, write } = await derived([FINE_5, candidate(RETURN, { rule: RETURN_RULE, passage: "ch. 6" })]);
  assert.deepEqual(groupsOf(panel), { new: [FINE, RETURN] });
  await write();
  const section = sectionOf(w);
  assert.ok(section.includes(`**${FINE}** *(SRC-policy, ch. 5)*`) && section.includes(`**${RETURN}** *(SRC-policy, ch. 6)*`), "both are written, each with its own passage");
});

// TST-1390004 · level: unit · module: MOD-review-pages
// guards: UC-005; CANDIDATES ARE DEDUPLICATED AMONG THEMSELVES; A DUPLICATE ADDS A SOURCE, NOT A REQUIREMENT
// given: the draft of TST-1390001; the product's SPEC holds A LOAN HAS A DUE DATE with the source SRC-handbook, ch. 1
// input: set the class of A FINE IS CHARGED to duplicate of A LOAN HAS A DUE DATE; Write proposals
// expect: the written section adds both passages to the sources of A LOAN HAS A DUE DATE, whose sources then read "SRC-handbook, ch. 1; SRC-policy, ch. 5; SRC-policy, ch. 6"; neither A FINE IS CHARGED nor LATE LOANS COST A FINE is written as a requirement
test("spec-entry/draft - the class the author gives a merged candidate holds for every passage of it", async () => {
  const { w, panel, write } = await derived([FINE_5, COST_6]);
  setClass(panel, FINE, "duplicate", LOAN);
  await write();
  const section = sectionOf(w);
  assert.ok(section.includes(`**${LOAN}** *(SRC-handbook, ch. 1; SRC-policy, ch. 5; SRC-policy, ch. 6)*`), "both passages are added to the requirement");
  assert.ok(!section.includes(`**${FINE}**`) && !section.includes(`**${COST}**`), "no merged candidate is written as a requirement");
});

// TST-1390005 · level: unit · module: MOD-review-pages
// guards: UC-005; CANDIDATES ARE DEDUPLICATED AMONG THEMSELVES
// given: an outcome whose draft holds the candidates A FINE IS CHARGED (ch. 5), LATE LOANS COST A FINE (ch. 6) and A LOAN IS RETURNED (ch. 7), and whose classes hold one class for the first two (refs both, from ch. 5 and ch. 6, new) and one for the third (refs it, from ch. 7, new); candidateRows draws them, as the page of a draft of the conversation does
// input: candidateRows on an empty list, then editedResult over the list and the outcome
// expect: the list holds two items, A FINE IS CHARGED and A LOAN IS RETURNED; the edited draft holds those two candidates only; its classes are [{ refs: [A FINE IS CHARGED, LATE LOANS COST A FINE], from: [ch. 5, ch. 6], class: new, of: null }, { refs: [A LOAN IS RETURNED], from: [ch. 7], class: new, of: null }]
test("candidateRows and editedResult - a class of two candidates keeps both refs and passages, and one item", () => {
  const third = candidate(RETURN, { rule: RETURN_RULE, passage: "ch. 7" });
  const outcome = { draft: { candidates: [FINE_5, COST_6, third] }, classes: [
    { refs: [FINE, COST], from: ["ch. 5", "ch. 6"], class: "new", of: null }, { refs: [RETURN], from: ["ch. 7"], class: "new", of: null }] };
  const list = document.createElement("ul");
  candidateRows(list, outcome, { requirements: new Map() }, "SRC-policy", [], () => {});
  assert.deepEqual(byClass(list, "li", "candidate").map((item) => item.getAttribute("data-name")), [FINE, RETURN]);
  const edited = editedResult(list, outcome);
  assert.deepEqual(edited.draft.candidates.map((each) => each.name), [FINE, RETURN]);
  assert.deepEqual(edited.classes, [
    { refs: [FINE, COST], from: ["ch. 5", "ch. 6"], class: "new", of: null }, { refs: [RETURN], from: ["ch. 7"], class: "new", of: null }]);
});
