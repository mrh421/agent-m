// Release tests of ITM-1320 — a change described in the prompt bar is reviewed by its own model. The behaviour is the SPEC's NO REVIEWER IS THE DRAFTER ("The reviewing participant of an architecture draft,
// other than one of a change described in the prompt bar, is not the participant that drafted it and does not use its model.") and AN ARCHITECTURE DRAFT IS CHECKED BEFORE A PERSON SEES IT, as UC-023 2 says it:
// "in the prompt bar, the bar's participant derives and reviews the change". The cases walk the dashboard from the bar to the draft the author opens (tests/uc-023-harness.mjs: the real page, bar, job runner
// and catalogue over fixture servers), and the job without the page for the rule itself. No case reads a code file.
// Run: node --test tests/release-itm-1320-bar-self-review.test.mjs
//
// Module: MOD-prompt-bar
// Guards: NO REVIEWER IS THE DRAFTER; AN ARCHITECTURE DRAFT IS CHECKED BEFORE A PERSON SEES IT; UC-023
// Level: release
//
// Written for the release testing of sprint 128 by developer-sonnet-l, who implemented none of ITM-1320 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER) and wrote the changed cases TST-739005 and TST-739011
// of the system test of UC-023, which these cases do not repeat. The author's Send is the bar's own button called with a trusted click event, as the system tests do; no input event of the operating
// system is made, and no request leaves the process. Readings the texts leave open, which the cases state:
//   - the reviewer's request is told from the drafter's by the first sentence of review-architecture's prompt, which only the reviewer is sent;
//   - "before a person sees it" is read as before the author opens the draft with "Review the draft": every request of the review has been made by the time Send has run;
//   - "a kind with reviewers" is a kind that names a reviewer kind; a message of the conversation (`converse`) names none.

import test from "node:test";
import assert from "node:assert/strict";
import { prepareJob, runJob } from "../src/job-runner/index.mjs";
import { formatFinding } from "../src/text-tools/index.mjs";
import { ARC1, ARC1_PATH, all, answer, driver, jobOf, onFile, pageText, review, scenario, send, DRAFTER, TWIN } from "./uc-023-harness.mjs";

const REVIEW_PROMPT = "You review a complete architecture draft against the whole SPEC";
const sentTo = (request) => request.body.messages.map((message) => message.content).join("\n");
const asReviewer = (request) => sentTo(request).includes(REVIEW_PROMPT);
const ARC1_RETRIED = ARC1.replace("one synchronisation module.", "one synchronisation module, which retries.");
const CHANGE = { files: [{ path: ARC1_PATH, text: ARC1_RETRIED, class: "change", of: "ARC-001" }] };
const WARNING = { artifact: ARC1_PATH, line: 9, rule: "A MODULE IS CHECKED AGAINST ITS SUBSYSTEM", what: "MOD-desk and MOD-report have no named owner", fix: "name who owns each module" };
const warningLine = formatFinding({ ...WARNING, kind: "warning" });
const PARAMS = { target: "ARC-001", instruction: "Let the sync retry" };

// TST-1320101 · level: release · module: MOD-prompt-bar
// guards: AN ARCHITECTURE DRAFT IS CHECKED BEFORE A PERSON SEES IT; A REVIEWER'S FINDING IS A WARNING; NO REVIEWER IS THE DRAFTER; UC-023
// given: the participants drafter (model-a) and reviewer (model-b) offered by the bar; the endpoint of drafter answers a change of ARC-001 as the deriving participant, answers the finding it is sent with a justification, and as the reviewing participant finds one warning in every round
// input: the author describes the change in the bar, chooses drafter and presses Send; then opens the draft with Review the draft
// expect: known positive — the endpoint of drafter received the instruction; it was asked as the reviewer twice, and as the drafter twice, the second time with the reviewer's warning in the compiler's form in what it is sent; no request reached the endpoint of reviewer (model-b); the draft the author opens shows two correction rounds, the change, and no finding left, the warning being answered
test("TST-1320101: UC-023 2 the bar's participant reviews the change it derived, and the author opens the draft after the reviewer's warning was answered", async () => {
  const answers = [(requests) => {
    if (asReviewer(requests.at(-1))) return { findings: [WARNING] };
    const drafted = requests.filter((request) => !asReviewer(request)).length;
    return drafted === 1 ? { draft: CHANGE } : { draft: CHANGE, answers: [{ finding: warningLine, how: "answered", text: "the owners are named in the module files" }] };
  }];
  const s = await scenario({ answers });
  await onFile(s, "decision", "ARC-001");
  await send(s, "Let the sync retry", { participant: "drafter" });
  const drafting = s.endpointRequests.filter((request) => !asReviewer(request)), reviewing = s.endpointRequests.filter(asReviewer);
  assert.ok(drafting[0] && sentTo(drafting[0]).includes("Let the sync retry"), "known positive: the drafter received the instruction");
  assert.deepEqual([drafting.length, reviewing.length], [2, 2], "asked twice as the drafter and twice as the reviewer");
  assert.ok(sentTo(drafting[1]).includes(warningLine), `the reviewer's warning reaches the drafter in the compiler's form: ${sentTo(drafting[1]).slice(-800)}`);
  assert.deepEqual(s.reviewerRequests, [], "no second participant is asked");
  await review(s);
  assert.match(pageText(s), /Correction rounds: 2/);
  assert.match(pageText(s), /one synchronisation module, which retries\./);
  assert.equal(all(s.target, "li", "left").length, 0, "the answered warning is not left");
});

// TST-1320102 · level: release · module: MOD-prompt-bar
// guards: NO REVIEWER IS THE DRAFTER; UC-023
// given: the same page and participants; the endpoint of drafter answers a question about the page in words
// input: the author asks the bar "What does MOD-sync do?" with drafter chosen and presses Send (a message of the conversation, a kind without reviewers)
// expect: known positive — the endpoint of drafter received the question, once; it was asked no request of the reviewing prompt; the endpoint of reviewer received none
test("TST-1320102: UC-023 a plain message of the bar names no reviewer and is sent once", async () => {
  const s = await scenario({ answers: [{ answer: "MOD-sync synchronises the loans." }] });
  await onFile(s, "decision", "ARC-001");
  await send(s, "What does MOD-sync do?", { participant: "drafter" });
  assert.equal(s.endpointRequests.filter((request) => sentTo(request).includes("What does MOD-sync do?")).length, 1, "known positive: the question is sent once");
  assert.equal(s.endpointRequests.length, 1, "nothing else is sent");
  assert.ok(!s.endpointRequests.some(asReviewer), "no reviewer is asked");
  assert.deepEqual(s.reviewerRequests, []);
});

// TST-1320103 · level: release · module: MOD-prompt-bar
// guards: NO REVIEWER IS THE DRAFTER; UC-023
// given: the described change of ARC-001 of the product of the harness, the participant drafter (model-a), the participant twin (model-a, another name) and reviewer (model-b); the drafter answers the change, and as its own reviewer no finding
// input: the job is prepared as the bar prepares a described change — the drafter its own one reviewer, selfReview set — and run; then prepared with the same choice without selfReview, and with selfReview and twin as the reviewer
// expect: known positive — with selfReview nothing blocks the job, and the run asks the drafter twice, once as the drafter and once as its own reviewer, with the draft in the reviewer's input, and the result holds the change; without selfReview the drafter as its own reviewer gives one error under NO REVIEWER IS THE DRAFTER naming it; with selfReview and twin, who is not the drafter, the same error names twin (counter-proofs)
test("TST-1320103: NO REVIEWER IS THE DRAFTER the drafter of a change described in the bar is its own reviewer, and no other participant of its model is", async () => {
  const s = await scenario({});
  const rule = (prepared) => prepared.blocking.map((found) => [found.kind, found.rule]);
  const own = await jobOf(s, "change-architecture", PARAMS, { drafter: DRAFTER, reviewers: [DRAFTER] });
  assert.deepEqual(rule(own.prepared), [["error", "NO REVIEWER IS THE DRAFTER"]], "counter-proof: without selfReview the drafter is refused as its own reviewer");
  assert.ok(own.prepared.blocking[0].what.includes(DRAFTER.name));

  const prepared = await prepareJob("change-architecture", own.context, { drafter: DRAFTER, reviewers: [DRAFTER], selfReview: true });
  assert.deepEqual(prepared.blocking, [], "known positive: with selfReview nothing blocks the job");
  const both = driver(DRAFTER, [answer(CHANGE), answer({ findings: [] })]);
  const result = await runJob(prepared, { drafter: both, reviewers: [both] }, { attended: true, context: own.context });
  assert.equal(both.inputs.length, 2, "asked once as the drafter and once as the reviewer");
  assert.ok(both.inputs[1].prompt.includes("which retries") && both.inputs[1].prompt.includes(REVIEW_PROMPT), "the reviewer's input holds the draft");
  assert.deepEqual(result.draft.files.map((file) => file.path), [ARC1_PATH]);

  const twin = await prepareJob("change-architecture", own.context, { drafter: DRAFTER, reviewers: [TWIN], selfReview: true });
  assert.deepEqual(rule(twin), [["error", "NO REVIEWER IS THE DRAFTER"]], "counter-proof: selfReview is for the drafter alone");
  assert.ok(twin.blocking[0].what.includes(TWIN.name));
});
