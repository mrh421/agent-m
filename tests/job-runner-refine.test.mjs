// A draft refined by a follow-up instruction (ITM-389) — MOD-job-runner's runJob with `refine`, as the accepted text of
// docs/architecture/MOD-job-runner.md states it: "With `refine`, the drafter's first exchange carries that draft as `previous`, beside the job's parts
// with the person's follow-up instruction among them, and the drafter changes it as the instruction says (UC-019 step 8, *Refine*)"; `DriverInput`:
// "the findings of the last round with the draft they concern — or, in the first exchange of a job given `refine`, no finding and the draft to change".
// For UC-019 step 8. The page's *Refine* that calls it is ITM-363's and ITM-398's.
// Run: node --test tests/job-runner-refine.test.mjs
//
// Module: MOD-job-runner
// Guards: A DRAFTED CHANGE IS SHOWN AGAINST THE CURRENT TEXT; THE ROUNDS ARE COUNTED AND SHOWN
// Level: unit
//
// The kind is the catalogue's `change-requirements`, whose recipe `instruction` gives the person's words from the job's parameters, as one part
// (MOD-job-runner's table of built-in strategies): the follow-up instruction is that parameter. Its other recipes, its writer and its two checks come
// from modules that do not offer them here; this file registers a stand-in for each recipe and the writer under names of its own, and gives the job
// one stand-in check whose findings each test sets. The draft is read as the module file's `previous`: a text as it is, any other draft as its JSON, as
// the loop shows a draft to the participant in every later round. The driver is a fixture that answers from a list and keeps every input it was sent.
// Each test states its input and its expected result before it runs (given / input / expect). Nothing reaches the network. The counter-proofs are
// recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { formatFinding } from "../src/text-tools/index.mjs";
import { kindOf } from "../src/job-catalogue/index.mjs";
import { prepareJob, registerStrategies, runJob } from "../src/job-runner/index.mjs";

const DRAFTER = { name: "drafter-a", type: "CLI agent", model: "example-model", context: 200000, price: null,
  capabilities: ["draft text"], place: "this machine", route: "bridge lab-pc agent claude" };
const part = (name, text) => ({ name, text, size: 0, sources: [], required: true });
const CHECK = "refine stand-in check";
let checkFindings = () => [];
const STAND_INS = {
  recipes: {
    ...Object.fromEntries(["named-requirements", "spec-with-queues", "chapters-for-requirements"].map((name) => [name,
      async () => [part(`${name} part`, `the text of ${name}`)]])),
    // The recipe issue-context (MOD-issue-handling) gives no part to a job without the parameter issue, as these jobs are.
    "issue-context": async () => [],
  },
  checks: { [CHECK]: (draft) => checkFindings(draft) },
  // The kind's precondition person-source (MOD-spec-changes), which these tests do not concern: it finds nothing.
  preconditions: { "person-source": async () => null },
  writers: { "queue-entries": async () => ({ commits: [], files: [], pullRequest: null, shown: null, notes: [] }) },
};
for (const [category, strategies] of Object.entries(STAND_INS)) {
  for (const [name, strategy] of Object.entries(strategies)) {
    try {
      registerStrategies("tests/job-runner-refine.test.mjs", { [category]: { [name]: strategy } });
    } catch (error) {
      if (error.name !== "DuplicateStrategy") throw error;
    }
  }
}

const INSTRUCTION = "Make the second requirement shorter.";
const contextOf = (kind) => ({ kind, params: { instruction: INSTRUCTION }, product: { address: "https://github.com/alice/product", snapshot: null, host: null },
  instance: { snapshot: null, host: null }, connect: async () => null, participants: [DRAFTER], places: { sources: {}, mailbox: null }, gates: [],
  person: "alice", now: new Date("2026-10-11T08:00:00Z"), agentM: { version: "unreleased", commit: "0".repeat(40) }, jobId: null });
async function prepared() {
  const kind = await kindOf("change-requirements");
  const context = contextOf(kind);
  const job = await prepareJob("change-requirements", context, { drafter: DRAFTER, reviewers: [] });
  return { job: { ...job, kind: { ...job.kind, checks: [CHECK] } }, context };
}

function driver(answers) {
  const inputs = [];
  return { participant: DRAFTER, inputs, async send(input) {
    inputs.push(input);
    if (answers.length === 0) throw new Error("the drafter was asked more often than the test expects");
    return { text: JSON.stringify(answers.shift()), usage: null };
  } };
}
const candidate = (name, rule) => ({ name, rule, check: "A test checks it.", constrains: "product", passage: "the instruction", class: "change" });
const draftOf = (...rules) => ({ candidates: rules.map((rule, at) => candidate(`REQUIREMENT ${at + 1}`, rule)) });
const answer = (draft, answers = []) => ({ draft, answers });
const run = async (drafter, options) => {
  const { job, context } = await prepared();
  return runJob(job, { drafter, reviewers: [] }, { attended: true, context, ...options });
};

// TST-472345 · level: unit · module: MOD-job-runner
// guards: A DRAFTED CHANGE IS SHOWN AGAINST THE CURRENT TEXT; UC-019
// given: a draft the person wants refined, and a drafter that answers a changed draft
// input: runJob with `refine` — the draft — and the job's parameter `instruction` — the follow-up instruction —, nobody checking anything
// expect: one exchange; its input carries the draft as `previous`, as the JSON the loop shows a draft in, and no finding; the result's draft is the drafter's changed draft, in one round, stopped because passed
test("runJob with refine — the first exchange carries the draft as previous and no finding", async () => {
  checkFindings = () => [];
  const draft = draftOf("A long rule that says too much about the second thing.", "Another long rule.");
  const refined = draftOf("A long rule that says too much about the second thing.", "A short rule.");
  const drafter = driver([answer(refined)]);
  const result = await run(drafter, { refine: draft });
  assert.equal(drafter.inputs.length, 1);
  assert.equal(drafter.inputs[0].previous, JSON.stringify(draft, null, 2));
  assert.deepEqual(drafter.inputs[0].findings, []);
  assert.deepEqual([result.draft, result.rounds.length, result.stoppedBecause], [refined, 1, "passed"]);
});

// TST-472346 · level: unit · module: MOD-job-runner
// guards: A DRAFTED CHANGE IS SHOWN AGAINST THE CURRENT TEXT; UC-019
// given: the same job; a draft that is a text
// input: runJob with `refine` a text
// expect: `previous` is that text as it stands
test("runJob with refine — a draft that is a text is carried as it is", async () => {
  checkFindings = () => [];
  const drafter = driver([answer(draftOf("A short rule."))]);
  await run(drafter, { refine: "the draft, as a text" });
  assert.equal(drafter.inputs[0].previous, "the draft, as a text");
});

// TST-472347 · level: unit · module: MOD-job-runner
// guards: UC-019
// given: the same job, its parameter `instruction` the follow-up instruction
// input: runJob with `refine`
// expect: the first exchange's parts include the part of the recipe `instruction` holding exactly the instruction, and the prompt holds it in the recipe's named place, among the parts of the kind's other recipes
test("runJob with refine — the follow-up instruction is among the parts of the first exchange", async () => {
  checkFindings = () => [];
  const drafter = driver([answer(draftOf("A short rule."))]);
  await run(drafter, { refine: draftOf("A long rule.") });
  const [input] = drafter.inputs;
  assert.deepEqual(input.parts.filter((each) => each.recipe === "instruction").map((each) => each.text), [INSTRUCTION]);
  assert.ok(input.prompt.includes(INSTRUCTION), "the prompt holds the instruction");
  assert.ok(input.parts.some((each) => each.recipe === "spec-with-queues"), "beside the kind's other parts");
});

// TST-472348 · level: unit · module: MOD-job-runner
// guards: THE ROUNDS ARE COUNTED AND SHOWN; A DRAFTED CHANGE IS SHOWN AGAINST THE CURRENT TEXT
// given: the same job; a check that finds an error in the draft the drafter returns first and none in the corrected one; a drafter that answers the finding fixed
// input: runJob with `refine`
// expect: two exchanges; the second carries the finding and the refined draft as `previous`, not the draft that was refined; two rounds, the first with the finding answered fixed; the result's draft the corrected one, stopped because passed
test("runJob with refine — the correction loop then runs on the refined draft as for any draft", async () => {
  const flaw = { artifact: "REQUIREMENT 2", line: 1, kind: "error", rule: "A REQUIREMENT IS ONE STATEMENT", what: "the rule says two things", fix: "say one" };
  checkFindings = (draft) => (draft.candidates[1].rule.includes(" and ") ? [flaw] : []);
  const original = draftOf("A rule.", "A rule.");
  const refined = draftOf("A rule.", "It does this and that.");
  const corrected = draftOf("A rule.", "It does this.");
  const drafter = driver([answer(refined), answer(corrected, [{ finding: formatFinding(flaw), how: "fixed" }])]);
  const result = await run(drafter, { refine: original });
  assert.equal(drafter.inputs.length, 2);
  assert.deepEqual(drafter.inputs.map((input) => input.findings), [[], [flaw]]);
  assert.equal(drafter.inputs[1].previous, JSON.stringify(refined, null, 2));
  assert.deepEqual(result.rounds.map((round) => [round.number, round.findings.map(formatFinding), round.answers.map((each) => each.how)]),
    [[1, [formatFinding(flaw)], ["fixed"]], [2, [], []]]);
  assert.deepEqual([result.draft, result.stoppedBecause], [corrected, "passed"]);
});

// TST-472349 · level: unit · module: MOD-job-runner
// guards: A DRAFTED CHANGE IS SHOWN AGAINST THE CURRENT TEXT
// given: the same job without `refine`
// input: runJob
// expect: the first exchange as before: no `previous` and no finding; the instruction is still among its parts
test("runJob without refine — the first exchange carries no previous draft, as before", async () => {
  checkFindings = () => [];
  const drafter = driver([answer(draftOf("A rule."))]);
  await run(drafter, {});
  assert.equal(drafter.inputs[0].previous, null);
  assert.deepEqual(drafter.inputs[0].findings, []);
  assert.deepEqual(drafter.inputs[0].parts.filter((each) => each.recipe === "instruction").map((each) => each.text), [INSTRUCTION]);
});
