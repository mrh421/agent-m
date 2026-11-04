// A draft that lacks the decision stating the whole architecture is sent to no reviewer — MOD-job-runner's correction loop as
// docs/architecture/MOD-job-runner.md states it (runJob: its checks and then its reviewing participants), under the check of
// AN ARCHITECTURE IS CHECKED WHEN IT IS COMPLETE: "no review starts for a draft that lacks the decision stating the whole
// architecture". The reading taken: the loop sends a draft to its reviewers only when its checks found nothing under ONE DECISION
// STATES THE WHOLE ARCHITECTURE; that finding goes back to the drafter as any check's finding does, and the reviewers are asked
// in the first round whose checks no longer find it. The condition is on a finding, not on a kind: every kind with reviewers
// is held to it.
// Run: node --test tests/job-runner-incomplete-draft.test.mjs
//
// Module: MOD-job-runner
// Guards: AN ARCHITECTURE IS CHECKED WHEN IT IS COMPLETE; A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT
// Guards: UC-022
// Level: unit
//
// The kind is this file's own and names one check, a stand-in registered under a name of this file's: it finds an error under
// ONE DECISION STATES THE WHOLE ARCHITECTURE in a draft whose `lacks` is `whole`, an error under another rule in one whose
// `lacks` is `other`, and nothing in any other. Its reviewing kind is the catalogue's review-architecture. The drivers are
// fixtures that answer from a list and keep every input they were sent. Each test states its input and its expected result
// before it runs (given / input / expect). Nothing reaches the network.

import test from "node:test";
import assert from "node:assert/strict";
import { finding, formatFinding } from "../src/text-tools/index.mjs";
import { registerStrategies, runJob } from "../src/job-runner/index.mjs";

const DRAFTER = { name: "drafter-a", type: "CLI agent", model: "example-model", context: 200000, price: null,
  capabilities: ["draft text"], place: "this machine", route: "bridge lab-pc agent claude" };
const REVIEWER = { name: "reviewer-b", type: "CLI agent", model: "other-model", context: 200000, price: null,
  capabilities: ["draft text"], place: "this machine", route: "bridge lab-pc agent claude" };

const WHOLE = "ONE DECISION STATES THE WHOLE ARCHITECTURE";
const OTHER = "DEVELOP AGAINST INTERFACES";
const missing = finding({ artifact: "ARC-002", line: 3, kind: "error", rule: WHOLE,
  what: "every decision refines another, so none states the whole architecture",
  fix: "leave the decision that states the whole architecture without refines" });
const elsewhere = finding({ artifact: "MOD-x", line: 5, kind: "error", rule: OTHER, what: "MOD-x uses MOD-y's code",
  fix: "use its interface" });

const CHECK = "itm-1395 stand-in for graph-checks";
registerStrategies("tests/job-runner-incomplete-draft.test.mjs", { checks: { [CHECK]: (draft) => (draft.lacks === "whole"
  ? [missing] : draft.lacks === "other" ? [elsewhere] : []) } });

// The kind: the shape of the architecture kinds, with the one stand-in check and one reviewing participant.
const FILES = { type: "object", required: ["files", "lacks"], properties: { lacks: { type: "string" }, files: { type: "array",
  items: { type: "object", required: ["path", "text", "class"], properties: { path: { type: "string" },
    text: { type: "string" }, class: { type: "string", enum: ["new", "change", "duplicate", "conflict"] } } } } } };
const KIND = { name: "fixture-architecture", serves: [], participant: "one", needs: ["draft text"], resources: "none",
  preconditions: [], recipes: [], checks: [CHECK], personDecides: [], reviewer: "review-architecture", reviewers: 1, steps: [],
  gatePoints: [], review: "person", writer: "return-draft", limit: 5, purpose: "Drafts an architecture, for a test.",
  prompt: "Draft the architecture.", answer: FILES };
const JOB = { kind: KIND, params: {}, drafter: DRAFTER, reviewers: [REVIEWER], parts: [], destinations: [], fits: true,
  notFitting: [], leftOut: [], blocking: [], limit: 5 };

const context = () => ({ kind: KIND, params: {}, product: { address: "https://github.com/alice/product", snapshot: null, host: null },
  instance: { snapshot: null, host: null }, connect: async () => null, participants: [DRAFTER, REVIEWER],
  places: { sources: {}, mailbox: null }, gates: [], person: "alice", now: new Date("2026-10-11T08:00:00Z"),
  agentM: { version: "unreleased", commit: "0".repeat(40) }, jobId: null });

// A driver that answers from `answers` in turn — a value is sent as its JSON, a function is called with the input the driver
// was sent and its value sent; once the list is spent, the last answer is repeated — and keeps every input it was sent.
function driver(who, answers) {
  const inputs = [];
  let last;
  return { participant: who, inputs, async send(input) {
    inputs.push(input);
    if (answers.length > 0) last = answers.shift();
    return { text: JSON.stringify(typeof last === "function" ? last(input) : last), usage: null };
  } };
}
const correcting = (draft) => (input) => ({ draft,
  answers: input.findings.map((found) => ({ finding: formatFinding(found), how: "fixed" })) });
const NO_FINDING = { draft: { findings: [] } };
const drafted = (lacks, name) => ({ lacks, files: [{ path: `docs/architecture/${name}.md`, text: name, class: "new" }] });
const run = (drafterAnswers, reviewerAnswers = [NO_FINDING]) => {
  const drafter = driver(DRAFTER, drafterAnswers), reviewer = driver(REVIEWER, reviewerAnswers);
  return { drafter, reviewer, done: runJob(JOB, { drafter, reviewers: [reviewer] }, { attended: true, context: context() }) };
};

// TST-1395001 · level: unit · module: MOD-job-runner
// guards: AN ARCHITECTURE IS CHECKED WHEN IT IS COMPLETE; UC-022
// given: a kind with one check and one reviewing participant; a drafter that drafts a complete architecture — the check finds nothing in it
// input: runJob of it, a person attending
// expect: known positive — the reviewer is asked once, in the first round, and its input holds the drafted file; the drafter is asked once; the loop stops passed with nothing left
test("runJob — a complete draft is sent to the reviewer, in the first round", async () => {
  const { drafter, reviewer, done } = run([{ draft: drafted("none", "ARC-001-whole") }]);
  const result = await done;
  assert.equal(reviewer.inputs.length, 1, "known positive: the complete draft is reviewed");
  assert.ok(reviewer.inputs[0].prompt.includes("ARC-001-whole"), "the reviewer receives the draft");
  assert.equal(drafter.inputs.length, 1);
  assert.deepEqual([result.stoppedBecause, result.remaining, result.rounds.length], ["passed", [], 1]);
});

// TST-1395002 · level: unit · module: MOD-job-runner
// guards: AN ARCHITECTURE IS CHECKED WHEN IT IS COMPLETE; A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT; UC-022
// given: the kind of TST-1395001; a drafter that first drafts an architecture the check finds without the decision that states the whole architecture, and, told of the finding, drafts the complete one
// input: runJob of it, a person attending
// expect: no review starts for the first draft: the reviewer's first and only input is the second draft — it holds the corrected file and not the first draft's —; the finding goes back to the drafter in the second round as the compiler's form gives it; the first round holds that finding, the second none; stopped passed
test("runJob — a draft that lacks the decision stating the whole architecture goes back to the drafter and is reviewed once it is complete", async () => {
  const { drafter, reviewer, done } = run([{ draft: drafted("whole", "ARC-002-first") }, correcting(drafted("none", "ARC-001-whole"))]);
  const result = await done;
  assert.deepEqual(drafter.inputs.map((input) => input.findings), [[], [missing]], "the finding goes back to the drafter");
  assert.equal(reviewer.inputs.length, 1, "the reviewer is asked once, not for the draft that lacks the decision");
  assert.ok(reviewer.inputs[0].prompt.includes("ARC-001-whole") && !reviewer.inputs[0].prompt.includes("ARC-002-first"),
    "and its input is the complete draft");
  assert.deepEqual(result.rounds.map((round) => [round.number, round.findings.map(formatFinding)]),
    [[1, [formatFinding(missing)]], [2, []]]);
  assert.deepEqual([result.stoppedBecause, result.remaining], ["passed", []]);
});

// TST-1395003 · level: unit · module: MOD-job-runner
// guards: AN ARCHITECTURE IS CHECKED WHEN IT IS COMPLETE; THE CORRECTION LOOP HAS A FIXED LIMIT; UC-022
// given: the kind of TST-1395001; a drafter that drafts the same architecture, without the decision that states the whole architecture, however often it is told
// input: runJob of it, a person attending
// expect: counter-proof — no review starts, in any round: the reviewer is never asked; the drafter is asked twice, and the loop stops unchanged with the finding remaining
test("runJob — a draft that never gets the decision stating the whole architecture is never reviewed", async () => {
  const { drafter, reviewer, done } = run([{ draft: drafted("whole", "ARC-002-first") }]);
  const result = await done;
  assert.equal(reviewer.inputs.length, 0, "no review starts for a draft that lacks the decision stating the whole architecture");
  assert.equal(drafter.inputs.length, 2);
  assert.deepEqual([result.stoppedBecause, result.remaining.map(formatFinding)], ["unchanged", [formatFinding(missing)]]);
});

// TST-1395004 · level: unit · module: MOD-job-runner
// guards: AN ARCHITECTURE IS CHECKED WHEN IT IS COMPLETE; A REVIEWER'S FINDING IS A WARNING; UC-022
// given: the kind of TST-1395001; a drafter that first drafts an architecture the check finds an error in under another rule, then, told of it, a clean one
// input: runJob of it, a person attending
// expect: the reviewer is asked in both rounds, on the draft each has — only a draft that lacks the decision stating the whole architecture is withheld from it
test("runJob — an error under another rule does not keep the reviewer from a draft", async () => {
  const { reviewer, done } = run([{ draft: drafted("other", "ARC-003-first") }, correcting(drafted("none", "ARC-001-whole"))]);
  const result = await done;
  assert.equal(reviewer.inputs.length, 2, "the reviewer is asked in each round");
  assert.ok(reviewer.inputs[0].prompt.includes("ARC-003-first") && reviewer.inputs[1].prompt.includes("ARC-001-whole"));
  assert.deepEqual([result.stoppedBecause, result.remaining], ["passed", []]);
});
