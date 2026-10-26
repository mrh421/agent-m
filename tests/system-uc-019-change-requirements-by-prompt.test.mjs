// System scenarios of UC-019 for a change of requirements, through the prompt bar and the review pages' route `draft` (ITM-514).
// Authored by Developer developer-sonnet-e, who implemented none of ITM-507 (the route `draft`), ITM-508 (the specification browser's
// subject) or ITM-551; it implemented no UC-019 production behaviour.
// Module: MOD-trace-pages; MOD-review-pages; MOD-site-frame; MOD-prompt-bar; MOD-spec-changes; MOD-source-register; MOD-runtimes; MOD-job-runner
// Guards: UC-019
// Level: system
// Run: node --test tests/system-uc-019-change-requirements-by-prompt.test.mjs
//
// The page, the servers and the person's actions are the harness of tests/uc-019-prompt-bar-harness.mjs: MOD-site-frame's real `startPage` on the review page, over the real
// views of MOD-trace-pages and MOD-review-pages, the real MOD-prompt-bar, MOD-job-runner, MOD-runtimes and the real GitHub host, served in memory; the global `fetch`
// answers them and refuses every other origin, so nothing reaches the network.
//
// Each test states its input and its expected values in its own text; none reads an expected result from the SPEC, a use case or an
// architecture file. The counter-proofs (a planted fault in a copy of src/ and the test's failing result) are run by
// tests/release-uc-019-change-requirements-by-prompt.test.mjs (AGENT_M_418_COUNTERPROOF=1) and recorded in the pull request.
//
// Readings the texts leave open, which the tests state:
//   - "the open requirement" is the one a person opens with the control of the requirement's name on the specification browser, or the
//     requirement whose page of the review pages is shown; a group is open while its section's list is unfolded.
//   - "a requirement open in the specification browser" gives the bar a subject whose draft route is `draft`; the tests follow the bar's
//     button *Review the draft* to the address it writes, and read what that address shows.

import test from "node:test";
import assert from "node:assert/strict";
import { CONFLICT, CURRENT_RULE, INSTRUCTION, LOAN, SHELF, SPEC, all, assertProposal, barOf, candidate, draft, draftAddress, fromTrace, goTo, keptDraft, messageLines, onRequirementPage, one,
  proposalWrites, recordTexts, review, row, run, save, scenario, send, sentText, statusOf, targetsOf } from "./uc-019-prompt-bar-harness.mjs";

// TST-418001
// level: system
// module: MOD-trace-pages; MOD-site-frame; MOD-prompt-bar
// guards: UC-019; THE PAGE NAMES WHERE IT SENDS
// given: the specification browser of the product at its default branch, the register offering drafter (this machine, draft text) and observer (Anthropic, USA, read the repository only)
// input: unfold Lending, open A LOAN HAS A DUE DATE without naming it in the bar, write the instruction in the bar and press Send with the participant drafter
// expect: before Send the bar names drafter with its place, the only participant that can do the kind, and not observer, and nothing has been sent; after it the one request to the endpoint holds the instruction and names exactly A LOAN HAS A DUE DATE under "The requirements to change"
test("TST-418001: the prompt bar on the specification browser names where it sends and takes the open requirement as the target", async () => {
  const s = await scenario();
  const bar = barOf(s);
  assert.equal(one(bar, "span", "participant").textContent, "drafter — this machine");
  assert.equal(all(bar, "option").length, 0, "observer cannot draft text, so there is nothing to choose among");
  await fromTrace(s);
  assert.equal(s.endpointRequests.length, 0, "nothing is sent while a requirement is only open");
  await send(s, INSTRUCTION, { participant: "drafter" });
  assert.equal(s.endpointRequests.length, 1);
  assert.ok(sentText(s).includes(INSTRUCTION), "the instruction reaches the participant");
  assert.deepEqual(targetsOf(s), [LOAN], "the requirement to change is the open one, not named by the author");
  assert.equal(s.product.writes.length, 0);
});

// TST-418002
// level: system
// module: MOD-review-pages; MOD-site-frame; MOD-prompt-bar; MOD-job-runner; MOD-spec-changes; MOD-source-register
// guards: UC-019
// given: the page of the requirement A LOAN HAS A DUE DATE, its author's source linked, and a fixture endpoint that drafts one changed requirement
// input: the instruction in the bar, Send, Review the draft, edit the returned rule, Save
// expect: one request to the endpoint; before Save nothing is written; after it one commit with the author's exact edit as one open proposal, SPEC.md unchanged, the commit message without the instruction, and no job record
test("TST-418002: one requirement traverses the bar, the route draft and Save", async () => {
  const s = await scenario();
  await run(s);
  assert.equal(s.endpointRequests.length, 1);
  assert.equal(s.product.writes.length, 0, "a draft alone writes nothing");
  const edit = one(row(s), "textarea", "candidate-rule");
  edit.value = "Every loan displays a readable due date.";
  edit.dispatchEvent(new Event("input"));
  await save(s);
  assert.match(assertProposal(s), /Every loan displays a readable due date\./);
  assert.ok(messageLines(proposalWrites(s)[0]).every((line) => !line.includes(INSTRUCTION)), "no line of the commit names the instruction");
  assert.equal(recordTexts(s).length, 0, "a message of the bar runs in the tab without a job record");
});

// TST-418003
// level: system
// module: MOD-trace-pages; MOD-review-pages; MOD-prompt-bar; MOD-spec-changes
// guards: UC-019
// given: the group Lending of the specification browser, whose requirements display as A LOAN HAS A DUE DATE then A BOOK IS SHELVED, and two changed candidates
// input: unfold the group, Send, press Review the draft (which keeps the draft in the tab), then the route draft at the subject the bar kept the draft for (TST-418007 is the address the bar writes), and Save
// expect: the message was prepared for the requirements [A LOAN HAS A DUE DATE, A BOOK IS SHELVED] in that order (the alphabetical order is the reverse); the draft shows both candidates; one section is proposed with the loan before the shelf and SPEC.md unchanged
test("TST-418003: an ordered group reaches the participant in its order and its draft is saved as one section", async () => {
  const s = await scenario({ answers: [draft(candidate(), candidate({ name: "A SHELF IS VISIBLE", of: SHELF, rule: "Every book displays its shelf." }))] });
  await fromTrace(s, true);
  await send(s);
  assert.deepEqual(targetsOf(s), [LOAN, SHELF], "the participant was asked for the group in its display order, which is not the alphabetical one");
  await review(s);
  assert.equal(keptDraft(s).kind, "change-requirements");
  assert.deepEqual(keptDraft(s).params.requirements, [LOAN, SHELF]);
  await goTo(s, draftAddress(s, keptDraft(s).subject));
  assert.equal(all(s.target, "li", "candidate").length, 2);
  await save(s);
  const text = assertProposal(s);
  assert.match(text, /Every book displays its shelf\./);
  assert.ok(text.indexOf(`**${LOAN}**`) < text.indexOf(`**${SHELF}**`));
});

// TST-418004
// level: system
// module: MOD-review-pages; MOD-prompt-bar; MOD-source-register
// guards: UC-019; THE PERSON WHO PROMPTS IS A SOURCE
// given: the author's source exists in the instance but the product does not link it
// input: the page of the requirement A LOAN HAS A DUE DATE, an instruction in the bar and Send
// expect: the message is the conversation's, which hands the change on; the change of requirements is never sent and nothing is written: the bar says "Nothing was run." and names the two steps,
//   registering the person (#library) and linking the source to the product (#sources), as the precondition person-source of change-requirements finds them; the bar offers no link, the steps are text
test("TST-418004: a missing personal source stops the change before it is sent and names the steps", async () => {
  const s = await scenario({ linked: false });
  await onRequirementPage(s);
  await send(s);
  const said = statusOf(s).textContent;
  assert.match(said, /Nothing was run\./);
  assert.match(said, /THE PERSON WHO PROMPTS IS A SOURCE/);
  assert.ok(said.includes("#library") && said.includes("#sources"), said);
  assert.equal(all(statusOf(s), "a").length, 0, "the steps are named in text, not offered as links");
  assert.equal(s.endpointRequests.length, 0);
  assert.equal(s.product.writes.length, 0);
});

// TST-418005
// level: system
// module: MOD-review-pages; MOD-prompt-bar; MOD-job-runner; MOD-spec-changes
// guards: UC-019; A CONFLICT IS DECIDED BY A PERSON
// given: a draft of a changed A LOAN HAS A DUE DATE and a candidate THE DUE DATE MAY BE HIDDEN that the participant classes as a conflict with it
// input: Send, Review the draft, Save with the conflict undecided; in a second page the same draft with the class of the conflict set to new before Save
// expect: undecided: the proposal holds the changed rule and not "Every loan may hide its due date.", and the conflict stays in the draft, undecided; decided: the proposal holds that rule under THE DUE DATE MAY BE HIDDEN; the endpoint was asked once in each
test("TST-418005: an unresolved conflict stays out of the proposal until its author decides", async () => {
  const answers = [draft(candidate(), candidate({ name: CONFLICT, class: "conflict", rule: "Every loan may hide its due date." }))];
  const undecided = await scenario({ answers });
  await run(undecided);
  assert.equal(one(row(undecided, CONFLICT), "select", "class").value, "conflict");
  await save(undecided);
  const proposal = assertProposal(undecided);
  assert.match(proposal, /Every loan visibly displays its due date\./);
  assert.ok(!proposal.includes("Every loan may hide its due date."), "the undecided conflict is not in the proposal");
  assert.equal(all(undecided.target, "li", "candidate").length, 2, "the conflict stays in the draft");
  assert.equal(undecided.endpointRequests.length, 1);

  const decided = await scenario({ answers });
  await run(decided);
  const choice = one(row(decided, CONFLICT), "select", "class");
  choice.value = "new";
  choice.dispatchEvent(new Event("change"));
  await save(decided);
  const decidedProposal = assertProposal(decided);
  assert.match(decidedProposal, new RegExp(`\\*\\*${CONFLICT}\\*\\*`));
  assert.match(decidedProposal, /Every loan may hide its due date\./);
  assert.equal(decided.endpointRequests.length, 1);
});

// TST-418006
// level: system
// module: MOD-review-pages; MOD-spec-changes
// guards: UC-019; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; A REFUSED SAVE KEEPS THE EDIT
// given: an editable draft on the route draft, followed by a concurrent commit changing the section Lending of the SPEC
// input: Save (UC-019 9a)
// expect: no write; the author's edit is still in its field; the section as it stands now is beside it
test("TST-418006: a stale section refuses Save and retains the draft beside the newer text", async () => {
  const s = await scenario();
  await run(s);
  const edit = one(row(s), "textarea", "candidate-rule");
  edit.value = "Every loan displays the author's retained edit.";
  edit.dispatchEvent(new Event("input"));
  await s.product.change("SPEC.md", SPEC.replace(CURRENT_RULE, "Every loan states its updated due date."));
  const before = s.product.writes.length;
  await save(s);
  assert.equal(s.product.writes.length, before);
  assert.equal(edit.value, "Every loan displays the author's retained edit.");
  assert.match(one(s.target, "div", "newer").textContent, /Every loan states its updated due date\./);
});

// TST-418007
// level: system
// module: MOD-trace-pages; MOD-prompt-bar; MOD-review-pages
// guards: UC-019
// given: A LOAN HAS A DUE DATE open in the specification browser, a draft returned for it
// input: press Review the draft in the bar
// expect: the route draft shows the candidates of that draft, as it does from the page of the requirement
test("TST-418007: Review the draft from the specification browser shows the draft", async () => {
  const s = await scenario();
  await fromTrace(s);
  await send(s);
  await review(s);
  assert.equal(all(s.target, "li", "candidate").length, 1, s.target.textContent);
});

// TST-418008
// level: system
// module: MOD-trace-pages; MOD-prompt-bar; MOD-source-register
// guards: UC-019; THE PERSON WHO PROMPTS IS A SOURCE
// given: the author's source is not linked by the product, and A LOAN HAS A DUE DATE is open in the specification browser
// input: an instruction in the bar and Send
// expect: nothing is sent, as from the page of the requirement (TST-418004)
test("TST-418008: a missing personal source stops a send from the specification browser", async () => {
  const s = await scenario({ linked: false });
  await fromTrace(s);
  await send(s);
  assert.equal(s.endpointRequests.length, 0, statusOf(s).textContent);
});
