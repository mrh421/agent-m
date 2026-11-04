// Release tests of ITM-1318 — the reviewer of an architecture draft receives the whole architecture. The behaviour is the SPEC's THE ARCHITECTURE'S PARTICIPANTS RECEIVE THE WHOLE PROJECT ("A participant that
// drafts or checks an architecture receives the whole SPEC, every accepted use case and the whole architecture."), A CHANGE ACROSS MODULES IS CHECKED AS A WHOLE and NOTHING IS LEFT OUT OF AN ARCHITECTURE PROMPT
// SILENTLY ("If the SPEC, the accepted use cases and the architecture do not fit into a participant's context, nothing is sent and the dashboard says what does not fit."), for UC-022 (the first architecture)
// and UC-023 (a change). The job is MOD-job-runner's, prepared and run over the product of tests/uc-023-harness.mjs with fixture participants as drivers; the kind is the catalogue's `review-architecture`
// as it stands. No case reads a code file.
// Run: node --test tests/release-itm-1318-reviewer-whole-architecture.test.mjs
//
// Module: MOD-job-catalogue
// Guards: THE ARCHITECTURE'S PARTICIPANTS RECEIVE THE WHOLE PROJECT; A CHANGE ACROSS MODULES IS CHECKED AS A WHOLE; NOTHING IS LEFT OUT OF AN ARCHITECTURE PROMPT SILENTLY
// Level: release
//
// Written for the release testing of sprint 128 by developer-sonnet-l, who implemented none of ITM-1318 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The participants are drivers that answer from a
// list, so that each case states what the reviewer is sent and what it answers; no request leaves the process. Readings the texts leave open, which the cases state:
//   - "the whole architecture" is every decision and module file of the default branch, each with its whole text (the reading of tests/release-uc-023-described-change.test.mjs);
//   - the architecture the reviewer is sent is the one that stands on the default branch, so a file the draft changes is sent in its text before the change, and the draft carries the change;
//   - for a first derivation (UC-022) the product has no architecture file, and the reviewer is sent none.

import test from "node:test";
import assert from "node:assert/strict";
import { runJob } from "../src/job-runner/index.mjs";
import { ARC1, ARC1_PATH, ARC2, ARC2_PATH, DESK, DESK_PATH, REPORT, REPORT_PATH, SHELF_MOD, SHELF_PATH, SPEC, SYNC, SYNC_PATH, UC1, UC2, UC3_PATH, answer, driver, jobOf, scenario, DRAFTER, REVIEWER } from "./uc-023-harness.mjs";

const ARCHITECTURE_HEADING = "## The whole architecture as it stands on the default branch";
const NEXT_HEADING = "## Chapters 9 to 12 of the book";
const ARC1_RETRIED = ARC1.replace("one synchronisation module.", "one synchronisation module, which retries.");
const PARAMS = { target: "ARC-001", instruction: "Let the sync retry" };
const run = (job, drivers) => runJob(job.prepared, drivers, { attended: true, context: job.context });
const architectureOf = (prompt) => prompt.slice(prompt.indexOf(ARCHITECTURE_HEADING), prompt.indexOf(NEXT_HEADING));
const ALL_SIX = [ARC1, ARC2, SYNC, DESK, REPORT, SHELF_MOD];

// TST-1318101 · level: release · module: MOD-job-catalogue
// guards: THE ARCHITECTURE'S PARTICIPANTS RECEIVE THE WHOLE PROJECT; A CHANGE ACROSS MODULES IS CHECKED AS A WHOLE; UC-023
// given: a product whose architecture holds six files, ARC-001 and ARC-002 and four module files; a described change of ARC-001 with a reviewing participant of another model
// input: the job is run; the reviewer's input is read for the block under the heading "The whole architecture as it stands on the default branch" and for the draft
// expect: known positive — the reviewer's input holds the heading and the draft's changed sentence "which retries"; the block under the heading holds the whole text of all six files, ARC-001 as it stood before the change, and not the draft's changed sentence; the whole SPEC and both accepted use cases stand in the input
test("TST-1318101: UC-023 the reviewer is sent the architecture as it stands, under a heading of its own, beside the draft that changes it", async () => {
  const s = await scenario({});
  const job = await jobOf(s, "change-architecture", PARAMS, { drafter: DRAFTER, reviewers: [REVIEWER] });
  const reviewer = driver(REVIEWER, [answer({ findings: [] })]);
  await run(job, { drafter: driver(DRAFTER, [answer({ files: [{ path: ARC1_PATH, text: ARC1_RETRIED, class: "change", of: "ARC-001" }] })]), reviewers: [reviewer] });
  const sent = reviewer.inputs[0].prompt;
  assert.ok(sent.includes(ARCHITECTURE_HEADING), "known positive: the heading stands in what the reviewer is sent");
  assert.ok(sent.includes("which retries"), "known positive: the draft carries the change");
  const block = architectureOf(sent);
  ALL_SIX.forEach((held, at) => assert.ok(block.includes(held), `file ${at + 1} of the six is in the block of the architecture`));
  assert.ok(!block.includes("which retries"), "the block holds the architecture before the change");
  for (const [what, held] of [["the SPEC", SPEC], ["UC-001", UC1], ["UC-002", UC2]]) assert.ok(sent.includes(held), `${what} is in what the reviewer is sent`);
});

// TST-1318102 · level: release · module: MOD-job-catalogue
// guards: THE ARCHITECTURE'S PARTICIPANTS RECEIVE THE WHOLE PROJECT; UC-022
// given: a product with the SPEC and the accepted use cases UC-001 and UC-002 and no decision or module file (UC-003, which is open, taken away); the job derive-architecture with a reviewing participant of another model; and, for the counter-proof, the product with its architecture and a described change
// input: both jobs are prepared
// expect: known positive — the derivation is startable (nothing blocks it) and its reviewer is sent the whole SPEC and the accepted use cases UC-001 and UC-002; it has no part of the recipe whole-architecture, since the product has none; counter-proof — the described change of the product with an architecture has six such parts, one for each file, and the reviewer's destination holds each of them
test("TST-1318102: UC-022 a first derivation has no architecture to send its reviewer; a change of an existing architecture sends one part for each file", async () => {
  const bare = await scenario({ remove: [UC3_PATH, ARC1_PATH, ARC2_PATH, SYNC_PATH, DESK_PATH, REPORT_PATH, SHELF_PATH] });
  const first = await jobOf(bare, "derive-architecture", {}, { drafter: DRAFTER, reviewers: [REVIEWER] });
  assert.deepEqual(first.prepared.blocking.map((found) => found.what), [], "known positive: the first derivation is startable");
  const reviewerParts = first.prepared.parts.filter((part) => ["whole-spec", "accepted-use-cases"].includes(part.recipe));
  assert.ok(reviewerParts.some((part) => part.recipe === "whole-spec"), "known positive: the whole SPEC is sent");
  assert.deepEqual(reviewerParts.filter((part) => part.recipe === "accepted-use-cases").map((part) => part.text).sort(), [UC1, UC2].sort(), "known positive: the accepted use cases are sent");
  assert.equal(first.prepared.parts.filter((part) => part.recipe === "whole-architecture").length, 0, "there is no architecture file to send");

  const existing = await scenario({});
  const change = await jobOf(existing, "change-architecture", PARAMS, { drafter: DRAFTER, reviewers: [REVIEWER] });
  const held = change.prepared.parts.filter((part) => part.recipe === "whole-architecture");
  assert.equal(held.length, 6, "counter-proof: one part for each of the six files");
  const sentToReviewer = change.prepared.destinations.find((each) => each.role === "reviewer").parts;
  assert.deepEqual(held.filter((part) => !sentToReviewer.includes(part.name)).map((part) => part.name), [], "and the reviewer's destination holds each of them");
});

// TST-1318103 · level: release · module: MOD-job-catalogue
// guards: NOTHING IS LEFT OUT OF AN ARCHITECTURE PROMPT SILENTLY; THE ARCHITECTURE'S PARTICIPANTS RECEIVE THE WHOLE PROJECT; UC-023
// given: a described change of ARC-001; a reviewing participant "mid" whose context holds what the reviewer was sent without the architecture, plus one token, and not the architecture; a reviewing participant "roomy" whose context holds all of it; the sizes are those of the prepared job
// input: the job is prepared with each as the reviewer, and the one that does not hold it is run
// expect: known positive — roomy's destination holds the six files of the architecture and roomy is named as fitting (nothing not fitting, nothing blocks); mid is named as not fitting, with the size the job needs, greater than its own context, and its context greater than the input without the architecture; the job refuses to start (NotStartable) and nothing is sent to mid or to the drafter
test("TST-1318103: UC-023 a reviewer whose context cannot hold the whole architecture is named, and nothing is sent", async () => {
  const s = await scenario({});
  const endpoint = (name, context) => ({ name, type: "model endpoint", model: "model-c", context, price: null, capabilities: ["draft text"], place: "this machine", route: `endpoint ${name}` });
  const roomy = await jobOf(s, "change-architecture", PARAMS, { drafter: DRAFTER, reviewers: [REVIEWER] });
  const needed = roomy.prepared.destinations.find((each) => each.role === "reviewer").size;
  const architecture = roomy.prepared.parts.filter((part) => part.recipe === "whole-architecture").reduce((sum, part) => sum + part.size, 0);
  assert.ok(architecture > 1, "the architecture has a size");
  const wholeNames = roomy.prepared.parts.filter((part) => part.recipe === "whole-architecture").map((part) => part.name);
  assert.equal(wholeNames.length, 6);
  assert.deepEqual(wholeNames.filter((name) => !roomy.prepared.destinations.find((each) => each.role === "reviewer").parts.includes(name)), [], "known positive: the reviewer's destination holds the six files");
  assert.deepEqual(roomy.prepared.notFitting, [], "known positive: a roomy reviewer fits");
  assert.deepEqual(roomy.prepared.blocking, []);

  const mid = endpoint("mid", needed - architecture + 1);
  const small = await jobOf(s, "change-architecture", PARAMS, { drafter: DRAFTER, reviewers: [mid], participants: [DRAFTER, REVIEWER, mid] });
  assert.deepEqual(small.prepared.notFitting.map((each) => each.participant.name), ["mid"]);
  assert.equal(small.prepared.notFitting[0].size, needed, "the job needs what it needed for the roomy reviewer");
  assert.ok(small.prepared.notFitting[0].size > mid.context && mid.context > needed - architecture, "mid would have held the input without the architecture, and cannot hold it with");
  const drafter = driver(DRAFTER, [answer({ files: [{ path: ARC1_PATH, text: ARC1_RETRIED, class: "change", of: "ARC-001" }] })]), reviewer = driver(mid, [answer({ findings: [] })]);
  await assert.rejects(run(small, { drafter, reviewers: [reviewer] }), { name: "NotStartable" });
  assert.equal(reviewer.inputs.length + drafter.inputs.length, 0, "nothing is sent");
});
