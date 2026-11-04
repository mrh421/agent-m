// A change described in the prompt bar is reviewed by its own participant (ITM-1320) — MOD-job-runner's prepareJob with
// `selfReview`, as docs/architecture/MOD-job-runner.md states it: "for a reviewer or checker that it `differs` from the
// drafter and, for checkers, from each other — except with `selfReview`, which only MOD-prompt-bar sets, for a change
// described in the prompt bar: `reviewers` is then the drafter alone, and it is not asked to differ (`NO REVIEWER IS THE
// DRAFTER`)". prepareJob sends nothing.
// Run: node --test tests/job-runner-self-review.test.mjs
//
// Module: MOD-job-runner
// Guards: NO REVIEWER IS THE DRAFTER
// Level: unit
//
// The kinds are the catalogue's own: derive-architecture, reviewed by one participant of review-architecture. The
// strategies they name that no module registers in this process are stand-ins of this file, each giving no part or no
// finding; a name already registered keeps its own. Reading the module file takes (the pull request names it): with
// `selfReview`, a choice whose `reviewers` is not the drafter alone — another participant, or more than one — keeps the
// job from starting with one error under NO REVIEWER IS THE DRAFTER, as any other reviewer the rule refuses does; the
// types and errors of prepareJob are otherwise unchanged. Each test states its expected result in its own text.

import test from "node:test";
import assert from "node:assert/strict";
import { kindOf } from "../src/job-catalogue/index.mjs";
import { prepareJob, registerStrategies } from "../src/job-runner/index.mjs";

const DRAFTER = { name: "drafter-a", type: "model endpoint", model: "example-model", context: 200000, price: null,
  capabilities: ["draft text"], place: "this machine", route: "endpoint lab" };
const OTHER = { ...DRAFTER, name: "reviewer-c", model: "other-model", place: "NHR@FAU, Erlangen", route: "endpoint nhr" };

const STAND_INS = {
  preconditions: { "architecture-ready": async () => null },
  recipes: Object.fromEntries(["whole-spec", "accepted-use-cases", "whole-architecture", "chapters-for-architecture"]
    .map((name) => [name, async () => []])),
  checks: Object.fromEntries(["document-schema", "graph-checks", "candidate-classes"].map((name) => [name, () => []])),
  steps: { "due-diligence": async (draft) => ({ draft, findings: [] }) },
  writers: { "open-files": async () => ({ commits: [], files: [], pullRequest: null, shown: null, notes: [] }) },
};
for (const [category, strategies] of Object.entries(STAND_INS)) {
  for (const [name, strategy] of Object.entries(strategies)) {
    try {
      registerStrategies("tests/job-runner-self-review.test.mjs", { [category]: { [name]: strategy } });
    } catch (error) {
      if (error.name !== "DuplicateStrategy") throw error;
    }
  }
}

const contextOf = (kind) => ({
  kind, params: {}, product: { address: "https://github.com/alice/product", snapshot: null, host: null },
  instance: { snapshot: null, host: null }, connect: async () => { throw new Error("no repository is opened here"); },
  participants: [DRAFTER, OTHER], places: { sources: {}, mailbox: null, contents: [] }, gates: [], person: "alice",
  now: new Date("2026-10-30T08:00:00Z"), agentM: { version: "unreleased", commit: "0".repeat(40) }, jobId: null,
});
const prepared = async (choice) => prepareJob("derive-architecture", contextOf(await kindOf("derive-architecture")), choice);
const brief = (findings) => findings.map((f) => [f.kind, f.rule]);
const REFUSED = [["error", "NO REVIEWER IS THE DRAFTER"]];

// TST-1320001 · level: unit · module: MOD-job-runner
// guards: NO REVIEWER IS THE DRAFTER
// given: derive-architecture, reviewed by one participant of review-architecture; drafter-a, a model endpoint
// input: prepareJob("derive-architecture", its context, { drafter: drafter-a, reviewers: [drafter-a], selfReview: true }); the counter-proof, the same choice without selfReview
// expect: with selfReview nothing blocks the job, its reviewers are [drafter-a] and its destinations are drafter-a as drafter and as reviewer; without selfReview one error under NO REVIEWER IS THE DRAFTER naming drafter-a
test("prepareJob — with selfReview the drafter alone is the reviewer and is not asked to differ; without it, the same choice is refused", async () => {
  const own = await prepared({ drafter: DRAFTER, reviewers: [DRAFTER], selfReview: true });
  assert.deepEqual(own.blocking, []);
  assert.deepEqual(own.reviewers, [DRAFTER]);
  assert.deepEqual(own.destinations.map((each) => [each.participant.name, each.role]), [["drafter-a", "drafter"], ["drafter-a", "reviewer"]]);

  const refused = await prepared({ drafter: DRAFTER, reviewers: [DRAFTER] });
  assert.deepEqual(brief(refused.blocking), REFUSED, "counter-proof: without selfReview the drafter as its own reviewer is refused");
  assert.ok(refused.blocking[0].what.includes("drafter-a"), refused.blocking[0].what);
});

// TST-1320002 · level: unit · module: MOD-job-runner
// guards: NO REVIEWER IS THE DRAFTER
// given: derive-architecture as in TST-1320001; drafter-a, and reviewer-c, another participant with another model; known positive: reviewer-c without selfReview is accepted
// input: prepareJob with { drafter: drafter-a, reviewers: [reviewer-c] }; then with selfReview and reviewers [reviewer-c]; then with selfReview and reviewers [drafter-a, reviewer-c]
// expect: without selfReview nothing blocks; with selfReview, reviewers that are not the drafter alone — another participant, or more than one — each give one error under NO REVIEWER IS THE DRAFTER
test("prepareJob — with selfReview, reviewers other than the drafter alone are refused", async () => {
  assert.deepEqual((await prepared({ drafter: DRAFTER, reviewers: [OTHER] })).blocking, [], "known positive: another participant with another model");
  for (const reviewers of [[OTHER], [DRAFTER, OTHER]]) {
    const job = await prepared({ drafter: DRAFTER, reviewers, selfReview: true });
    assert.deepEqual(brief(job.blocking), REFUSED, reviewers.map((each) => each.name).join(", "));
  }
});
