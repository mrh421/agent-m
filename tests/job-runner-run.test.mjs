// Running a job — MOD-job-runner's runJob and writeResult as docs/architecture/MOD-job-runner.md states them: the input
// sent to the drafter, the answer read by the output schema, the kind's checks and its reviewing participants, the findings
// sent back until nothing is left, the limit is reached or a round changes nothing, the kind's steps, the gates at the
// kind's points, and the writer — at once, or on a person's click.
// Run: node --test tests/job-runner-run.test.mjs
//
// Module: MOD-job-runner
// Guards: A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT; AN ERROR MUST BE FIXED, A WARNING FIXED OR JUSTIFIED
// Guards: WHAT A PERSON DECIDES IS NOT SENT BACK; THE CORRECTION LOOP HAS A FIXED LIMIT; A REVIEWER'S FINDING IS A WARNING
// Guards: A CANCELLED JOB WRITES NOTHING MORE; A JOB STOPS AT EVERY GATE; A CI AGENT'S DRAFT ENTERS AS OPEN
// Level: component
//
// The kinds are the catalogue's own. The strategies they name come from modules that do not offer them yet: this file
// registers a stand-in for each — skipped where a module already registered the name —, whose findings each test sets
// before it runs. The drivers are fixtures that answer from a list and keep every input they were sent. An answer is the
// envelope the module file states, `{ "draft": …, "answers": [ { "finding", "how", "text" } ] }`. Each test states its
// input and its expected result before it runs (given / input / expect). Nothing reaches the network.

import test from "node:test";
import assert from "node:assert/strict";
import { formatFinding } from "../src/text-tools/index.mjs";
import { kindOf } from "../src/job-catalogue/index.mjs";
import * as jobRunner from "../src/job-runner/index.mjs";

const { failedBecause, prepareJob, registerStrategies, runJob, writeResult } = jobRunner;

// ---------------------------------------------------------------- participants and drivers

const participant = (name, model) => ({ name, type: "CLI agent", model, context: 200000, price: null,
  capabilities: ["draft text", "read the repository", "write to the repository", "run code and tests"],
  place: "this machine", route: "bridge lab-pc agent claude" });
const DRAFTER = participant("drafter-a", "example-model");
const REVIEWER = participant("reviewer-c", "other-model");
const USAGE = { inputTokens: 10, outputTokens: 5, minutes: null, cost: null };

// A driver that answers from `answers` in turn — an object is sent as its JSON, a text as it is, an Error is thrown — and
// keeps every input it was sent.
function driver(who, answers) {
  const inputs = [];
  return { participant: who, inputs, async send(input) {
    inputs.push(input);
    const next = answers.shift();
    if (next instanceof Error) throw next;
    if (next === undefined) throw new Error(`${who.name} was asked more often than the test expects`);
    return { text: typeof next === "string" ? next : JSON.stringify(next), usage: USAGE };
  } };
}

// ---------------------------------------------------------------- stand-ins

// What the stand-in checks find — the stand-ins for graph-checks and for candidate-classes, each a function of the draft set by a
// test —; and what the writers and steps did. The runner registers both checks itself, which
// tests/job-runner-graph-checks.test.mjs and tests/job-runner-candidate-classes.test.mjs guard, so each stand-in is registered
// under a name of this file's own, which `withStandIns` puts in the kinds' place.
const STAND_IN_GRAPH = "graph-checks stand-in";
const STAND_IN_CLASSES = "candidate-classes stand-in";
const STAND_IN_FOR = { "graph-checks": STAND_IN_GRAPH, "candidate-classes": STAND_IN_CLASSES };
let checkFindings = () => [];
let classFindings = () => [];
let stepFindings = () => [];
const written = [];
const finding = (fields) => ({ artifact: "docs/use-cases/UC-001-x.md", line: 3, kind: "error",
  rule: "A USE CASE REALISES NAMED REQUIREMENTS", what: "realises \"EXPORT\" matches no requirement",
  fix: "use an existing name or remove the line", ...fields });
const writer = (name) => async (result, context) => {
  written.push({ name, draft: result.draft, stepFindings: result.stepFindings, gates: context.gates });
  return { commits: ["c0ffee"], files: [], pullRequest: null, shown: null };
};
const part = (name, text) => ({ name, text, size: 0, sources: [], required: true });
const STAND_INS = {
  preconditions: { "rests-on-accepted": async () => null, "architecture-ready": async () => null },
  recipes: Object.fromEntries(["chosen-requirements", "use-cases", "chapters-for-requirements", "source-excerpt",
    "spec-with-queues", "whole-spec", "accepted-use-cases", "chapters-for-architecture", "implementation-inputs",
    "chapters-for-implementation", "resource-pins"].map((name) => [name, async () => [part(`${name} part`, `the text of ${name}`)]])),
  checks: Object.fromEntries(["document-schema", STAND_IN_GRAPH, STAND_IN_CLASSES, "requirement-form"]
    .map((name) => [name, (draft) => (name === STAND_IN_GRAPH ? checkFindings(draft)
      : name === STAND_IN_CLASSES ? classFindings(draft) : [])])),
  steps: { "due-diligence": async (draft) => ({ draft, findings: stepFindings(draft) }) },
  writers: Object.fromEntries(["open-files", "queue-entries", "branch-and-pull-request"].map((name) => [name, writer(name)])),
};
for (const [category, strategies] of Object.entries(STAND_INS)) {
  for (const [name, strategy] of Object.entries(strategies)) {
    try {
      registerStrategies("tests/job-runner-run.test.mjs", { [category]: { [name]: strategy } });
    } catch (error) {
      if (error.name !== "DuplicateStrategy") throw error;
    }
  }
}

const contextOf = (kind, { gates = [] } = {}) => ({
  kind, params: {}, product: { address: "https://github.com/alice/product", snapshot: null, host: null },
  instance: { snapshot: null, host: null }, connect: async () => null, participants: [DRAFTER, REVIEWER],
  places: { sources: {}, mailbox: null }, gates, person: "alice", now: new Date("2026-10-11T08:00:00Z"),
  agentM: { version: "unreleased", commit: "0".repeat(40) }, jobId: "JOB-20261011-0800-abcd",
});
// These tests drive the loop with the findings they set. Their drafts are neither documents nor requirements as the artifact
// model reads them, which the runner's own checks judge — document-schema (tests/job-runner-document-schema.test.mjs) and
// requirement-form (tests/job-runner-requirement-form.test.mjs) —, so their kinds run without those; and graph-checks and
// candidate-classes (tests/job-runner-graph-checks.test.mjs, tests/job-runner-candidate-classes.test.mjs) are replaced in them
// by their stand-ins, which find what a test sets.
const OWN_CHECKS = ["document-schema", "requirement-form"];
const withStandIns = (job) => ({ ...job, kind: { ...job.kind, checks: job.kind.checks
  .filter((check) => !OWN_CHECKS.includes(check)).map((check) => STAND_IN_FOR[check] ?? check) } });
async function prepared(name, { reviewers = [], limit, gates } = {}) {
  const context = contextOf(await kindOf(name), { gates });
  return { job: withStandIns(await prepareJob(name, context, { drafter: DRAFTER, reviewers, limit })), context };
}

const USE_CASE = (text) => ({ files: [{ path: "docs/use-cases/UC-001-x.md", text, class: "new" }] });
const answer = (draft, answers = []) => ({ draft, answers });
const UNKNOWN = finding({});
const lineOf = (f) => formatFinding(f);

// ---------------------------------------------------------------- the correction loop

// TST-472352 · level: component · module: MOD-job-runner
// guards: A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT
// given: derive-use-cases, written at once (review none); a check that finds an unknown name under realises in a draft holding "EXPORT", and nothing in one that does not; a drafter that first drafts with "EXPORT", then without it, answering the finding as fixed
// input: runJob of it, nobody attending
// expect: the drafter asked twice — the second time with the finding and its first draft —; two rounds, the first with the finding answered fixed, the second without a finding; stopped because passed; the writer called once, with the corrected draft; the usage of both sends
test("runJob — a draft that fails a check goes back to its participant, and the corrected draft is written", async () => {
  checkFindings = (draft) => (JSON.stringify(draft).includes("EXPORT") ? [UNKNOWN] : []);
  written.length = 0;
  const { job, context } = await prepared("derive-use-cases");
  const first = USE_CASE("realises: EXPORT");
  const fixed = USE_CASE("realises: SAVE");
  const drafter = driver(DRAFTER, [answer(first), answer(fixed, [{ finding: lineOf(UNKNOWN), how: "fixed" }])]);
  const result = await runJob(job, { drafter, reviewers: [] }, { attended: false, context });

  assert.equal(drafter.inputs.length, 2);
  assert.deepEqual([drafter.inputs[0].findings, drafter.inputs[1].findings], [[], [UNKNOWN]]);
  assert.equal(drafter.inputs[1].previous, JSON.stringify(first, null, 2));
  assert.deepEqual(result.rounds.map((round) => [round.number, round.findings.map(lineOf), round.answers.map((a) => a.how)]),
    [[1, [lineOf(UNKNOWN)], ["fixed"]], [2, [], []]]);
  assert.deepEqual([result.draft, result.stoppedBecause, result.remaining, result.drafter], [fixed, "passed", [], DRAFTER]);
  assert.deepEqual(written.map((w) => [w.name, w.draft]), [["open-files", fixed]]);
  assert.deepEqual(result.usage, [{ participant: "drafter-a", usage: USAGE }, { participant: "drafter-a", usage: USAGE }]);
  assert.deepEqual(result.written, { commits: ["c0ffee"], files: [], pullRequest: null, shown: null });
});

// TST-472353 · level: component · module: MOD-job-runner
// guards: THE CORRECTION LOOP HAS A FIXED LIMIT
// given: derive-use-cases with the limit 3; a check that always finds an error whose text names the draft's number; a drafter that answers a new draft each round — so each round's finding differs —; then a drafter that answers the same draft each round — so the second round's finding is the first's
// input: runJob of each
// expect: the first asked exactly 3 times, stopped because of the limit, its last finding remaining; the second asked twice — once more than the round without change —, stopped because unchanged, its finding remaining
test("runJob — a participant that never fixes its error is asked exactly limit times, or once more than a round without change", async () => {
  checkFindings = (draft) => [finding({ what: `draft ${draft.files[0].text} still realises an unknown name` })];
  const { job, context } = await prepared("derive-use-cases", { limit: 3 });
  const changing = driver(DRAFTER, [answer(USE_CASE("1")), answer(USE_CASE("2")), answer(USE_CASE("3"))]);
  const limited = await runJob(job, { drafter: changing, reviewers: [] }, { attended: false, context });
  assert.deepEqual([changing.inputs.length, limited.stoppedBecause, limited.remaining.map((f) => f.what)],
    [3, "limit", ["draft 3 still realises an unknown name"]]);

  const same = driver(DRAFTER, [answer(USE_CASE("1")), answer(USE_CASE("1"))]);
  const unchanged = await runJob(job, { drafter: same, reviewers: [] }, { attended: false, context });
  assert.deepEqual([same.inputs.length, unchanged.stoppedBecause, unchanged.remaining.length], [2, "unchanged", 1]);
});

// TST-472354 · level: component · module: MOD-job-runner
// guards: AN ERROR MUST BE FIXED, A WARNING FIXED OR JUSTIFIED
// given: derive-use-cases; a check that finds one warning on every draft; a drafter that answers it justified; and the same with an error the drafter answers justified
// input: runJob of each
// expect: the justified warning ends the loop after its second round, passed, the justification recorded; the error answered justified does not — its loop ends unchanged with the error remaining
test("runJob — a justified warning ends the loop; an error answered with a justification does not", async () => {
  const { job, context } = await prepared("derive-use-cases");
  for (const [kind, stopped, left] of [["warning", "passed", 0], ["error", "unchanged", 1]]) {
    const found = finding({ kind, rule: "ONE STATEMENT PER REQUIREMENT", what: "the rule contains \"and\"" });
    checkFindings = () => [found];
    const drafter = driver(DRAFTER, [answer(USE_CASE("x")),
      answer(USE_CASE("x"), [{ finding: lineOf(found), how: "justified", text: "the two clauses name one condition" }])]);
    const result = await runJob(job, { drafter, reviewers: [] }, { attended: false, context });
    assert.deepEqual([result.stoppedBecause, result.remaining.length], [stopped, left], kind);
    assert.deepEqual(result.rounds[0].answers.map((a) => [a.how, a.text]),
      [["justified", "the two clauses name one condition"]], kind);
  }
});

// TST-472355 · level: component · module: MOD-job-runner
// guards: WHAT A PERSON DECIDES IS NOT SENT BACK
// given: derive-requirements, whose kind leaves A CONFLICT IS DECIDED BY A PERSON to a person, attended; a check that finds a conflict on every draft
// input: runJob of it
// expect: the drafter asked once, with no finding; the conflict under forPerson, not among the rounds' findings; passed; nothing written, the result waiting for the person
test("runJob — a finding a person decides goes to the person and is never sent back", async () => {
  const conflict = finding({ rule: "A CONFLICT IS DECIDED BY A PERSON", what: "contradicts EXPORT IS A PDF" });
  classFindings = () => [conflict];
  written.length = 0;
  const { job, context } = await prepared("derive-requirements");
  const candidates = { candidates: [{ name: "EXPORT AS CSV", rule: "r", check: "c", constrains: "product", passage: "p",
    class: "conflict", of: "EXPORT IS A PDF" }] };
  const drafter = driver(DRAFTER, [answer(candidates)]);
  const result = await runJob(job, { drafter, reviewers: [] }, { attended: true, context });
  assert.equal(drafter.inputs.length, 1);
  assert.deepEqual([result.forPerson, result.rounds.flatMap((r) => r.findings), result.stoppedBecause, result.written],
    [[conflict], [], "passed", null]);
  assert.deepEqual(written, []);
  classFindings = () => [];
});

// TST-472356 · level: component · module: MOD-job-runner
// guards: A REVIEWER'S FINDING IS A WARNING
// given: derive-architecture, reviewed by one participant, attended; a reviewer that finds one finding — written as it likes — on every draft; a drafter that answers it with the reason it does not hold; then a drafter that leaves it unanswered
// input: runJob of each
// expect: the reviewer's finding reaches the drafter as a warning; answered, the loop ends after its second round, passed; unanswered, it does not end there: it stops unchanged with the finding remaining. The reviewer receives the draft in its input.
test("runJob — a reviewer's finding is a warning: answered with its reason it ends the loop; unanswered it does not", async () => {
  checkFindings = () => [];
  stepFindings = () => [];
  const { job, context } = await prepared("derive-architecture", { reviewers: [REVIEWER] });
  const review = { findings: [{ artifact: "MOD-x", line: 4, rule: "DEVELOP AGAINST INTERFACES", what: "uses MOD-y's code",
    fix: "use its interface" }] };
  const warning = { ...review.findings[0], kind: "warning" };
  const files = { files: [{ path: "docs/architecture/MOD-x.md", text: "MOD-x", class: "new" }] };

  const reviewer = driver(REVIEWER, [answer(review), answer(review)]);
  const drafter = driver(DRAFTER, [answer(files),
    answer(files, [{ finding: lineOf(warning), how: "answered", text: "it uses MOD-y's interface, as its Uses say" }])]);
  const answered = await runJob(job, { drafter, reviewers: [reviewer] }, { attended: true, context });
  assert.deepEqual(drafter.inputs[1].findings, [warning]);
  assert.ok(reviewer.inputs[0].prompt.includes("MOD-x"), "the reviewer receives the draft");
  assert.deepEqual([answered.stoppedBecause, answered.remaining], ["passed", []]);

  const silent = driver(DRAFTER, [answer(files), answer(files)]);
  const again = driver(REVIEWER, [answer(review), answer(review)]);
  const unanswered = await runJob(job, { drafter: silent, reviewers: [again] }, { attended: true, context });
  assert.deepEqual([unanswered.stoppedBecause, unanswered.remaining], ["unchanged", [warning]]);
});

// TST-472357 · level: component · module: MOD-job-runner
// guards: THE CORRECTION LOOP HAS A FIXED LIMIT
// given: derive-use-cases with the limit 2; a drafter that first answers a text that is no JSON, then a readable draft; then one that answers no JSON both times
// input: runJob of each
// expect: the first: its unreadable answer a finding of the first round, sent back with the raw answer as the previous draft, and the readable draft passes in the second; the second: stopped because unusable, no draft, its raw answer kept for a person
test("runJob — an answer that cannot be read is a finding of the loop; still unreadable after the last round, the result is unusable", async () => {
  checkFindings = () => [];
  const { job, context } = await prepared("derive-use-cases", { limit: 2 });
  const drafter = driver(DRAFTER, ["I will draft it now.", answer(USE_CASE("x"))]);
  const read = await runJob(job, { drafter, reviewers: [] }, { attended: false, context });
  assert.equal(read.rounds[0].findings.length, 1);
  assert.equal(drafter.inputs[1].previous, "I will draft it now.");
  assert.deepEqual([read.stoppedBecause, read.draft], ["passed", USE_CASE("x")]);

  const never = driver(DRAFTER, ["no", "still no"]);
  const unusable = await runJob(job, { drafter: never, reviewers: [] }, { attended: false, context });
  assert.deepEqual([unusable.stoppedBecause, unusable.draft, unusable.raw], ["unusable", null, "still no"]);
});

// TST-2026271041 · level: component · module: MOD-job-runner
// guards: A JOB IS RECORDED IN ITS PRODUCT REPOSITORY; THE CORRECTION LOOP HAS A FIXED LIMIT
// given: derive-use-cases with the limit 2 and nobody attending; a drafter that answers, both times, JSON whose envelope has no `draft` — `{ "answers": [] }` —; and, as the counter-proof, a drafter that answers a readable draft
// input: runJob of each, then failedBecause of each result
// expect: the first stopped because unusable, and failedBecause is "the participant's answer could not be read: the answer has no draft", the why of its last round's finding; the second passed, and failedBecause is null
test("TST-2026271041: failedBecause — a run whose answer could not be read fails, naming why; a run that passed does not", async () => {
  checkFindings = () => [];
  const { job, context } = await prepared("derive-use-cases", { limit: 2 });
  assert.equal(typeof failedBecause, "function", "MOD-job-runner provides failedBecause");
  const undrafted = await runJob(job, { drafter: driver(DRAFTER, [{ answers: [] }, { answers: [] }]), reviewers: [] }, { attended: false, context });
  assert.equal(undrafted.stoppedBecause, "unusable");
  assert.equal(failedBecause(undrafted), "the participant's answer could not be read: the answer has no draft");

  const read = await runJob(job, { drafter: driver(DRAFTER, [answer(USE_CASE("x"))]), reviewers: [] }, { attended: false, context });
  assert.equal(read.stoppedBecause, "passed");
  assert.equal(failedBecause(read), null);
});

// ---------------------------------------------------------------- steps, writing, gates, cancelling, refusing

// TST-472358 · level: component · module: MOD-job-runner
// guards: A CI AGENT'S DRAFT ENTERS AS OPEN
// given: derive-architecture, reviewed by one participant, whose step due-diligence finds one finding; once attended, once with nobody attending
// input: runJob of each; then writeResult of the attended result with a draft the person changed
// expect: the step's finding among stepFindings and never sent back; attended, nothing written and the result waits; unattended, the writer called at once with the draft and the step's finding; writeResult runs the step again on the person's draft and calls the writer with that draft
test("runJob and writeResult — the kind's steps run after the loop; a result waits for a person who attends it, else it is written at once", async () => {
  checkFindings = () => [];
  const marked = finding({ artifact: "docs/architecture/ARC-002.md", rule: "A REUSE DECISION RECORDS ITS DUE DILIGENCE",
    what: "the registry could not be read" });
  stepFindings = () => [marked];
  const files = { files: [{ path: "docs/architecture/ARC-001.md", text: "the system", class: "new" }] };
  const clean = { findings: [] };
  const { job, context } = await prepared("derive-architecture", { reviewers: [REVIEWER] });

  written.length = 0;
  const attended = await runJob(job, { drafter: driver(DRAFTER, [answer(files)]), reviewers: [driver(REVIEWER, [answer(clean)])] },
    { attended: true, context });
  assert.deepEqual([attended.stepFindings, attended.written, written.length], [[marked], null, 0]);

  const unattended = await runJob(job, { drafter: driver(DRAFTER, [answer(files)]), reviewers: [driver(REVIEWER, [answer(clean)])] },
    { attended: false, context });
  assert.deepEqual(written.map((w) => [w.name, w.draft, w.stepFindings]), [["open-files", files, [marked]]]);
  assert.ok(unattended.written);

  written.length = 0;
  const theirs = { files: [{ path: "docs/architecture/ARC-001.md", text: "the system, as the person left it", class: "new" }] };
  const outcome = await writeResult(job, theirs, { result: attended, context });
  assert.deepEqual(written.map((w) => [w.draft, w.stepFindings]), [[theirs, [marked]]]);
  assert.deepEqual(outcome.commits, ["c0ffee"]);
});

// TST-472359 · level: component · module: MOD-job-runner
// guards: A JOB STOPS AT EVERY GATE
// given: implement, whose kind has the gate point before-merge; its context with a gate at before-merge not passed; then with that gate passed
// input: runJob of each, with onGate keeping the gates it is called for
// expect: not passed: the writer opens its pull request, then onGate is called with the gate and the job stops with it; passed: no gate is called and the job ends passed
test("runJob — a job stops at a gate of its kind's points that is not passed, and calls onGate", async () => {
  checkFindings = () => [];
  const report = { branch: "item/ITM-001", commits: ["c0ffee"], pullRequest: "#7" };
  for (const passed of [false, true]) {
    const { job, context } = await prepared("implement", { gates: [{ name: "Development → Review", point: "before-merge", passed }] });
    const reached = [];
    const result = await runJob(job, { drafter: driver(DRAFTER, [answer(report)]), reviewers: [] },
      { attended: false, context, onGate: async (gate) => { reached.push(gate); } });
    assert.deepEqual([reached, result.stoppedBecause, result.gate],
      passed ? [[], "passed", null] : [["Development → Review"], "gate", "Development → Review"], String(passed));
  }
});

// TST-472360 · level: component · module: MOD-job-runner
// guards: A CANCELLED JOB WRITES NOTHING MORE
// given: derive-use-cases, written at once; a signal aborted before the job runs
// input: runJob with that signal
// expect: refused as Cancelled; the drafter not asked; nothing written
test("runJob — a cancelled job is refused as Cancelled and writes nothing more", async () => {
  checkFindings = () => [];
  written.length = 0;
  const { job, context } = await prepared("derive-use-cases");
  const drafter = driver(DRAFTER, [answer(USE_CASE("x"))]);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(runJob(job, { drafter, reviewers: [] }, { attended: false, context, signal: controller.signal }),
    (error) => error.name === "Cancelled");
  assert.deepEqual([drafter.inputs.length, written.length], [0, 0]);
});

// TST-472361 · level: component · module: MOD-job-runner
// guards: THE PAGE NAMES WHERE IT SENDS
// given: a prepared job with a blocking finding, and one with a participant named as not fitting
// input: runJob of each
// expect: both refused as NotStartable, nothing sent
test("runJob — a prepared job with a blocking finding, or a participant that does not fit, is refused as NotStartable", async () => {
  const { job, context } = await prepared("derive-use-cases");
  const drafter = driver(DRAFTER, [answer(USE_CASE("x"))]);
  for (const changed of [{ ...job, blocking: [UNKNOWN] }, { ...job, fits: false,
    notFitting: [{ participant: DRAFTER, size: 300000, context: 200000 }] }]) {
    await assert.rejects(runJob(changed, { drafter, reviewers: [] }, { attended: false, context }),
      (error) => error.name === "NotStartable");
  }
  assert.equal(drafter.inputs.length, 0);
});

// TST-472362 · level: component · module: MOD-job-runner
// guards: A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT
// given: derive-use-cases; a draft a person changed, with "EXPORT", on which the check finds the unknown name; no drafter
// input: runJob with that draft as `from`
// expect: nothing sent; one round with the finding; the finding remaining for the person
test("runJob — without a drafter, a person's draft is only checked, and its findings returned", async () => {
  checkFindings = (draft) => (JSON.stringify(draft).includes("EXPORT") ? [UNKNOWN] : []);
  const { job, context } = await prepared("derive-use-cases");
  const result = await runJob(job, { drafter: null, reviewers: [] }, { attended: true, context, from: USE_CASE("EXPORT") });
  assert.deepEqual([result.rounds.length, result.remaining, result.usage], [1, [UNKNOWN], []]);
});
