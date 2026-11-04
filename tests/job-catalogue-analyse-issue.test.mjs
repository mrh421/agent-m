// The kind `analyse-issue` through the job runner (ITM-582) — MOD-job-catalogue's definition, prompt and answer schema of the kind and MOD-issue-handling's recipe `issue-context`, prepared and run by MOD-job-runner, as docs/architecture/MOD-job-catalogue.md states the kind ("`analyse-issue` | UC-012 | draft text | | `issue-context` | | | | `none` · `return-draft` | the class and its reasoning") and docs/architecture/MOD-issue-handling.md the class ("*Bug*: the SPEC is right, code or a test is wrong; *change*: the SPEC is wrong, incomplete or silent for the case — a missing requirement is a change, not a bug (UC-012)").
// Run: node --test tests/job-catalogue-analyse-issue.test.mjs
//
// Module: MOD-job-catalogue; MOD-issue-handling; MOD-job-runner
// Guards: THE CATALOGUE IS DATA; A JOB STOPS AT EVERY GATE; EVOLUTION ENTERS THROUGH THE SPECIFICATION; UC-012
// Level: component
//
// The kind and its prompt are the catalogue's own, the recipe is MOD-issue-handling's `issueStrategies` registered with the runner, the runner is the real one. The product is a fixture of this file, its host a fixture that lists one issue,
// the drivers fixtures that answer from a list and keep every input they were sent. Readings the texts leave open, which the tests state (the pull request names them):
//   - The prompt tells the participant that a requirement that is missing is a change: the sentence "a missing requirement is a change" stands in it (UC-012 3a).
//   - The class the participant may propose is one of bug, change and not-reproducible: the answer schema's enum holds those three, so that `rejected`, which only the person decides (UC-012 4a), is an unusable answer.
// The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { kindOf } from "../src/job-catalogue/index.mjs";
import { prepareJob, registerStrategies, runJob } from "../src/job-runner/index.mjs";

const handling = await import("../src/issue-handling/index.mjs").catch((error) => ({ error }));
if (handling.issueStrategies) {
  try { registerStrategies("tests/job-catalogue-analyse-issue.test.mjs", handling.issueStrategies); } catch (error) { if (error.name !== "DuplicateStrategy") throw error; }
}

const participant = (name, capabilities) => ({ name, type: "model endpoint", model: "example-model", context: 200000, price: null, capabilities, place: "this machine", route: "endpoint ep1" });
const DRAFTER = participant("drafter-a", ["draft text"]);
const READER = participant("reader-b", ["read the repository"]);
const USAGE = { inputTokens: 10, outputTokens: 5, minutes: null, cost: null };
function driver(who, answers) {
  const inputs = [];
  return { participant: who, inputs, async send(input) {
    inputs.push(input);
    const next = answers.shift();
    if (next === undefined) throw new Error(`${who.name} was asked more often than the test expects`);
    return { text: typeof next === "string" ? next : JSON.stringify(next), usage: USAGE };
  } };
}

const RULE = "THE EXPORT IS A PDF";
const SPEC = `# Fixture — Specification\n\n## 1. Export\n\n**${RULE}** *(PO A)*\nThe export is one PDF file.\n*Check:* \`tests/reader.test.mjs\`\n`;
const BODY = `The rule ${RULE} says nothing about page size, and the export is cut off.`;
const FILES = { "SPEC.md": SPEC };
const snapshot = { paths: Object.keys(FILES), read: async (path) => FILES[path] ?? null };
const issue = { number: 5, title: "Export is cut off", body: BODY, state: "open", labels: [], comments: [], url: "https://github.com/acme/product/issues/5" };
const contextOf = (kind, participants = [DRAFTER]) => ({
  kind, params: { issue: 5 }, product: { address: "https://github.com/acme/product", snapshot, host: { listIssues: async () => [issue] } }, instance: { snapshot: null, host: null, checkout: null },
  connect: async () => null, participants, places: { sources: {}, mailbox: null }, gates: [], person: "alice", now: new Date("2026-10-19T08:00:00Z"),
  agentM: { version: "unreleased", commit: "0".repeat(40) }, jobId: "JOB-20261019-0800-abcd",
});
async function prepared(drafter = DRAFTER) {
  assert.ok(handling.issueStrategies, `MOD-issue-handling offers issueStrategies: ${handling.error?.message}`);
  const context = contextOf(await kindOf("analyse-issue"), [drafter]);
  return { context, job: await prepareJob("analyse-issue", context, { drafter, reviewers: [] }) };
}

// TST-582201 · level: component · module: MOD-job-catalogue
// guards: THE CATALOGUE IS DATA; UC-012
// given: known positive first — the kind is read; MOD-issue-handling's strategies are registered
// input: kindOf("analyse-issue") and prepareJob of it for issue 5 with a drafter that declares draft text
// expect: the kind is prepared — its recipe issue-context is registered, no UnknownStrategy —, nothing blocks, the drafter is its one destination at its place, and the parts are the issue's and the requirement the issue names, "issue #5" and THE EXPORT IS A PDF
test("analyse-issue — is prepared over the recipe issue-context: the issue and the requirement it names are the drafter's parts", async () => {
  const { job } = await prepared();
  assert.equal(job.kind.name, "analyse-issue");
  assert.deepEqual(job.blocking, []);
  assert.deepEqual(job.parts.map((part) => [part.recipe, part.name]), [["issue-context", "issue #5"], ["issue-context", RULE]]);
  assert.deepEqual(job.destinations.map((each) => [each.participant.name, each.role, each.place, each.parts]), [["drafter-a", "drafter", "this machine", ["issue #5", RULE]]]);
});

// TST-582202 · level: component · module: MOD-job-runner
// guards: A PARTICIPANT DECLARES ITS CAPABILITIES; UC-012
// given: a participant that declares read the repository and not draft text
// input: prepareJob of analyse-issue for issue 5 with it as the drafter
// expect: one error under A PARTICIPANT DECLARES ITS CAPABILITIES naming reader-b, which keeps the job from starting
test("analyse-issue — a participant that cannot draft text is not eligible", async () => {
  const { job } = await prepared(READER);
  assert.deepEqual(job.blocking.map((found) => [found.kind, found.rule]), [["error", "A PARTICIPANT DECLARES ITS CAPABILITIES"]]);
  assert.ok(job.blocking[0].what.includes("reader-b"), job.blocking[0].what);
});

// TST-582203 · level: component · module: MOD-job-catalogue
// guards: THE CATALOGUE IS DATA; UC-012
// given: the prepared kind, and a drafter that answers class change with its reasoning and the files it names under wrong
// input: runJob of it, nobody attending
// expect: the drafter is asked once; its input holds the prompt with the issue's text and the requirement's text in the place of the recipe, and the sentence "a missing requirement is a change"; the draft is the answer's draft; stopped because passed; the writer return-draft shows the draft and writes nothing
test("analyse-issue — the participant is sent the issue with the requirement it names and the prompt that says a missing requirement is a change, and its class is shown, not written", async () => {
  const { job, context } = await prepared();
  const proposed = { class: "change", reasoning: "The SPEC says nothing about page size: a requirement is missing.", wrong: [] };
  const drafter = driver(DRAFTER, [{ draft: proposed, answers: [] }]);
  const result = await runJob(job, { drafter, reviewers: [] }, { attended: false, context });

  assert.equal(drafter.inputs.length, 1);
  const input = drafter.inputs[0];
  assert.ok(input.prompt.includes("a missing requirement is a change"), "the prompt says a missing requirement is a change");
  assert.ok(input.prompt.includes(BODY) && input.prompt.includes("The export is one PDF file."), "the prompt holds the issue and the requirement");
  assert.equal(input.prompt.includes("{{issue-context}}"), false, "the place of the recipe is filled");
  assert.deepEqual([result.draft, result.stoppedBecause], [proposed, "passed"]);
  assert.deepEqual(result.written, { commits: [], files: [], pullRequest: null, shown: proposed, notes: [] });
});

// TST-582204 · level: component · module: MOD-job-catalogue
// guards: UC-012
// given: the prepared kind; a drafter that proposes bug naming the files that are wrong, and one that proposes not-reproducible, with their reasoning
// input: runJob of each
// expect: both drafts are usable and shown as they are, with `wrong` kept for the bug
test("analyse-issue — a bug names what is wrong, and not-reproducible says what was tried", async () => {
  for (const proposed of [{ class: "bug", reasoning: "The code drops the last page.", wrong: ["src/export/index.mjs"] }, { class: "not-reproducible", reasoning: "I exported a three-page file and it was whole." }]) {
    const { job, context } = await prepared();
    const result = await runJob(job, { drafter: driver(DRAFTER, [{ draft: proposed, answers: [] }]), reviewers: [] }, { attended: false, context });
    assert.deepEqual([result.draft, result.written?.shown], [proposed, proposed], proposed.class);
  }
});

// TST-582205 · level: component · module: MOD-job-catalogue
// guards: UC-012
// given: the prepared kind; a drafter that answers class rejected, and one that answers class wontfix
// input: runJob of each
// expect: the answer is unusable for each — stopped because unusable, no draft, nothing written —: the class a participant may propose is bug, change or not-reproducible; rejecting is the person's decision
test("analyse-issue — a participant cannot reject an issue: a class outside bug, change and not-reproducible is an unusable answer", async () => {
  for (const cls of ["rejected", "wontfix"]) {
    const { job, context } = await prepared();
    const answer = { draft: { class: cls, reasoning: "No." }, answers: [] };
    const result = await runJob(job, { drafter: driver(DRAFTER, [answer, answer, answer, answer, answer, answer]), reviewers: [] }, { attended: false, context });
    assert.deepEqual([result.stoppedBecause, result.draft, result.written], ["unusable", null, null], cls);
  }
});

// TST-1374002 · level: component · module: MOD-job-catalogue
// guards: UC-012; A BACKLOG ITEM NAMES WHAT IT REALISES
// given: the prepared kind; three drafters that propose bug for issue 5 naming src/export/index.mjs as wrong — one names THE EXPORT IS A PDF under violated, one answers as before ITM-1374 without violated, one names the number 3 under violated
// input: runJob of each, nobody attending
// expect: the first draft is usable and shown as it is, violated THE EXPORT IS A PDF kept; the second is usable and shown as it is, with no violated (an old answer still reads); the third is unusable — stopped because unusable, no draft, nothing written —, since violated is a requirement's name, a text
test("TST-1374002: analyse-issue — a bug's answer keeps the requirement it names as violated, an answer without it still reads, and one whose violated is no text is unusable", async () => {
  const named = { class: "bug", reasoning: "The code drops the last page.", wrong: ["src/export/index.mjs"], violated: RULE };
  const old = { class: "bug", reasoning: "The code drops the last page.", wrong: ["src/export/index.mjs"] };
  for (const proposed of [named, old]) {
    const { job, context } = await prepared();
    const result = await runJob(job, { drafter: driver(DRAFTER, [{ draft: proposed, answers: [] }]), reviewers: [] }, { attended: false, context });
    assert.deepEqual([result.stoppedBecause, result.draft, result.written?.shown], ["passed", proposed, proposed], JSON.stringify(proposed));
  }
  const { job, context } = await prepared();
  const answer = { draft: { ...old, violated: 3 }, answers: [] };
  const result = await runJob(job, { drafter: driver(DRAFTER, [answer, answer, answer, answer, answer, answer]), reviewers: [] }, { attended: false, context });
  assert.deepEqual([result.stoppedBecause, result.draft, result.written], ["unusable", null, null]);
});
