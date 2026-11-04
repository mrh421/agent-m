// A change described in the prompt bar is reviewed by the bar's own participant (ITM-1320) — MOD-prompt-bar's hand-over run in this tab, as
// docs/architecture/MOD-prompt-bar.md states it: it "runs in this tab, attended, as a message runs, prepared with `prepareJob` for that kind — for a kind
// with reviewers, with the participant itself as its one reviewer and `selfReview` set, since the change is described in the prompt bar (`NO REVIEWER IS
// THE DRAFTER`)". send.mjs's prepareHandOver prepares it; it sends nothing.
// Run: node --test tests/prompt-bar-self-review.test.mjs
//
// Module: MOD-prompt-bar
// Guards: UC-023; UC-049; NO REVIEWER IS THE DRAFTER
// Level: unit
//
// The kinds are the catalogue's own: change-architecture, whose reviewer kind is review-architecture, and change-use-case, which names no reviewer. The
// strategies they name that no module registers in this process are stand-ins of this file, each giving no part, no finding and nothing written; the real
// MOD-job-runner (prepareJob) and MOD-runtimes' tabContext run. The repository is a fixture in memory; no request is made. Each test states its expected
// result in its own text.

import test from "node:test";
import assert from "node:assert/strict";
import { registerStrategies } from "../src/job-runner/index.mjs";
import { prepareHandOver } from "../src/prompt-bar/send.mjs";
import { freshStore } from "./settings-pages-setup.d/dom.mjs";

const STAND_INS = {
  preconditions: { "rests-on-accepted": async () => null },
  recipes: Object.fromEntries(["whole-spec", "use-cases", "whole-architecture", "chapters-for-architecture", "accepted-use-cases", "use-case-with-neighbours",
    "chapters-for-requirements"].map((name) => [name, async () => []])),
  checks: { "identifier-kept": () => [] },
  steps: { "due-diligence": async (draft) => ({ draft, findings: [] }) },
  writers: { "open-files": async () => ({ commits: [], files: [], pullRequest: null, shown: null, notes: [] }) },
};
for (const [category, strategies] of Object.entries(STAND_INS)) {
  for (const [name, strategy] of Object.entries(strategies)) {
    try {
      registerStrategies("tests/prompt-bar-self-review.test.mjs", { [category]: { [name]: strategy } });
    } catch (error) {
      if (error.name !== "DuplicateStrategy") throw error;
    }
  }
}

const PARTICIPANT = { name: "tooler", type: "model endpoint", model: "m", context: 200000, capabilities: ["draft text", "read the repository"], place: "this machine",
  route: "endpoint e1" };
const FILES = { "docs/participants.md": "# Participants\n", "SPEC.md": "# Spec\n" };
const snapshot = { repository: { server: "github", path: "acme/instance", web: "https://github.com/acme/instance" }, ref: "main", commit: "c".repeat(40),
  paths: Object.keys(FILES), blob: () => null, read: async (path) => FILES[path] ?? null };
const host = { repositoryInfo: async () => ({ defaultBranch: "main" }), readSnapshot: async () => snapshot };
const subject = { kind: "converse", entry: "architecture", refuses: [], paramsFor: () => ({ page: "a page" }) };

// The hand-over of `kind` the participant proposed, prepared to run in this tab.
const handedOver = async (kind, worksOn) => (await prepareHandOver({ handOver: { kind, works_on: worksOn, task: "Split MOD-store into a reader and a writer." }, subject,
  participant: PARTICIPANT, conversation: "", store: freshStore("acme/instance"), instance: { host }, product: null })).prepared;
const roles = (prepared) => prepared.destinations.map((each) => [each.participant.name, each.role]);

// TST-1320003 · level: unit · module: MOD-prompt-bar
// guards: UC-023; UC-049; NO REVIEWER IS THE DRAFTER
// given: the bar's participant tooler, a model endpoint; the kind change-architecture, whose reviewer kind is review-architecture
// input: prepareHandOver of the hand-over { kind: change-architecture, works_on: [MOD-store], task } that tooler proposed
// expect: the job's reviewers are [tooler]; its destinations are tooler as drafter and tooler as reviewer; nothing blocks it, no error under NO REVIEWER IS THE DRAFTER among it
test("prepareHandOver — a hand-over of a kind with reviewers is prepared with the bar's participant as its one reviewer, and nothing blocks it", async () => {
  const prepared = await handedOver("change-architecture", ["MOD-store"]);
  assert.deepEqual(prepared.reviewers, [PARTICIPANT]);
  assert.deepEqual(roles(prepared), [["tooler", "drafter"], ["tooler", "reviewer"]]);
  assert.deepEqual(prepared.blocking, []);
});

// TST-1320004 · level: unit · module: MOD-prompt-bar
// guards: UC-049; NO REVIEWER IS THE DRAFTER
// given: known positive TST-1320003; the bar's participant tooler; the kind change-use-case, which names no reviewer
// input: prepareHandOver of the hand-over { kind: change-use-case, works_on: [UC-001], task } that tooler proposed
// expect: the job names no reviewer: its reviewers are [], its one destination is tooler as drafter, and nothing blocks it (the counter-proof)
test("prepareHandOver — a hand-over of a kind without reviewers names none", async () => {
  const prepared = await handedOver("change-use-case", ["UC-001"]);
  assert.deepEqual(prepared.reviewers, []);
  assert.deepEqual(roles(prepared), [["tooler", "drafter"]]);
  assert.deepEqual(prepared.blocking, []);
});
