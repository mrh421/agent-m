// Preparing a job — MOD-job-runner's registerStrategies and prepareJob as docs/architecture/MOD-job-runner.md states them:
// the registry of strategies, and what a run panel shows before the person's click — the parts the kind's recipes build,
// their sizes, every destination with what it receives, what does not fit, and the findings that keep the job from
// starting. prepareJob sends nothing.
// Run: node --test tests/job-runner-prepare.test.mjs
//
// Module: MOD-job-runner
// Guards: THE PAGE NAMES WHERE IT SENDS; NO REQUIREMENT IS LEFT OUT OF THE CONTEXT SILENTLY
// Guards: NOTHING IS LEFT OUT OF AN ARCHITECTURE PROMPT SILENTLY; THE CORRECTION LOOP HAS A FIXED LIMIT; NO REVIEWER IS THE DRAFTER
// Guards: RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS; THE PLACES A MAILBOX'S MAIL MAY GO ARE CONFIGURED
// Guards: A PARTICIPANT DECLARES ITS CAPABILITIES
// Level: component
//
// The kinds are the catalogue's own (MOD-job-catalogue). The strategies they name come from modules that do not offer them
// yet; each test file registers a stand-in for every such name it needs — skipped where a module already registered the
// name — whose parts are fixtures of this file. A part's size is the module's estimate: its characters divided by three,
// rounded up; a destination's size is the size of the kind's prompt so estimated plus the sizes of the parts it receives.
// Each test states its input and its expected result before it runs (given / input / expect); where a test asserts a
// refusal, the same call is first shown to succeed on a known positive. Nothing reaches the network.

import test from "node:test";
import assert from "node:assert/strict";
import { kindOf } from "../src/job-catalogue/index.mjs";
import { prepareJob, registerStrategies } from "../src/job-runner/index.mjs";

const estimate = (text) => Math.ceil(text.length / 3);

// ---------------------------------------------------------------- participants

const DRAFTER = { name: "drafter-a", type: "CLI agent", model: "example-model", context: 200000, price: null,
  capabilities: ["draft text", "read the repository"], place: "this machine", route: "bridge lab-pc agent claude" };
const REVIEWER = { name: "reviewer-c", type: "model endpoint", model: "other-model", context: 200000, price: null,
  capabilities: ["draft text"], place: "NHR@FAU, Erlangen", route: "endpoint nhr" };
const SAME_MODEL = { ...REVIEWER, name: "reviewer-s", model: "example-model" };
const SMALL = { ...DRAFTER, name: "small-d", model: "small-model", context: 3000 };
const READER = { ...DRAFTER, name: "reader-r", model: "reader-model", capabilities: ["read the repository"] };

// ---------------------------------------------------------------- stand-ins

// The fixture parts of the stand-in recipes: the SPEC, two accepted use cases, a source excerpt from a restricted source,
// and the book's chapters, which MOD-source-register's recipes give (tests/source-register-chapters.test.mjs).
const SPEC_PART = { name: "SPEC.md", text: "S".repeat(12000), sources: [], required: true, size: 0 };
const USE_CASES = [
  { name: "UC-001", text: "U".repeat(1200), sources: [], required: true, size: 0 },
  { name: "UC-002", text: "V".repeat(901), sources: [], required: true, size: 0 },
];
const EXCERPT = { name: "SRC-restricted 2026", text: "E".repeat(600), sources: ["SRC-restricted"], required: true, size: 0 };
const CHAPTERS = { name: "chapters 9 to 12", text: "B".repeat(1500), sources: ["SRC-vibe-coding"], required: true, size: 0 };
const CHAPTER_8 = { name: "chapter 8", text: "R".repeat(450), sources: ["SRC-vibe-coding"], required: true, size: 0 };

const NOT_READY = { artifact: "SPEC.md", line: 1, kind: "error", rule: "AN ARCHITECTURE IS DERIVED FROM THE WHOLE TO ITS MODULES",
  what: "the SPEC has open queues", fix: "decide the open queues first" };

const recipe = (parts) => async () => parts.map((part) => ({ ...part }));
const STAND_INS = {
  preconditions: { "architecture-ready": async (context) => (context.params.notReady ? NOT_READY : null) },
  recipes: { "whole-spec": recipe([SPEC_PART]), "accepted-use-cases": recipe(USE_CASES), "whole-architecture": recipe([]), "source-excerpt": recipe([EXCERPT]),
    "spec-with-queues": recipe([SPEC_PART]), "chapters-for-architecture": recipe([CHAPTERS]),
    "chapters-for-requirements": recipe([CHAPTER_8]) },
  checks: Object.fromEntries(["document-schema", "graph-checks", "candidate-classes", "requirement-form"]
    .map((name) => [name, () => []])),
  steps: { "due-diligence": async (draft) => ({ draft, findings: [] }) },
  writers: Object.fromEntries(["open-files", "queue-entries"].map((name) => [name, async () => ({ commits: [], files: [],
    pullRequest: null, shown: null })])),
};
for (const [category, strategies] of Object.entries(STAND_INS)) {
  for (const [name, strategy] of Object.entries(strategies)) {
    try {
      registerStrategies("tests/job-runner-prepare.test.mjs", { [category]: { [name]: strategy } });
    } catch (error) {
      if (error.name !== "DuplicateStrategy") throw error;
    }
  }
}

// A job's context, as MOD-job-runner's JobContext states it, with what these tests vary.
const contextOf = (kind, { params = {}, sources = {}, mailbox = null } = {}) => ({
  kind, params, product: { address: "https://github.com/alice/product", snapshot: null, host: null },
  instance: { snapshot: null, host: null }, connect: async () => { throw new Error("no repository is opened here"); },
  participants: [DRAFTER, REVIEWER, SAME_MODEL, SMALL, READER], places: { sources, mailbox }, gates: [], person: "alice",
  now: new Date("2026-10-11T08:00:00Z"), agentM: { version: "unreleased", commit: "0".repeat(40) }, jobId: null,
});

const prepared = async (name, choice, options) => prepareJob(name, contextOf(await kindOf(name), options), choice);
const brief = (findings) => findings.map((f) => [f.kind, f.rule]);

// ---------------------------------------------------------------- registerStrategies

// TST-472334 · level: component · module: MOD-job-runner
// guards: THE CATALOGUE IS DATA
// given: a recipe registered under a name of this file's own by one owner
// input: registerStrategies of a recipe under the same name by a second owner
// expect: refused with DuplicateStrategy naming the strategy and both owners
test("registerStrategies — a name registered twice is refused as DuplicateStrategy, naming both owners", () => {
  registerStrategies("owner-one", { recipes: { "fixture-twice": recipe([]) } });
  assert.throws(() => registerStrategies("owner-two", { recipes: { "fixture-twice": recipe([]) } }), (error) =>
    error.name === "DuplicateStrategy" && error.strategy === "fixture-twice"
      && error.owners.includes("owner-one") && error.owners.includes("owner-two"));
});

// TST-1302007 · level: component · module: MOD-job-runner
// guards: THE CATALOGUE IS DATA
// given: a recipe registered under a name of this file's own by one owner, as a Bridge composed in the page's process registers MOD-approvals' strategies
// input: registerStrategies of the very same recipe under the same name by a second owner, as a view hands the same set
// expect: no DuplicateStrategy; the name keeps its one recipe; the counter-proof, another recipe under that name, is still refused
test("registerStrategies — the same strategy handed again by another owner is no duplicate; another strategy under its name is", () => {
  const once = recipe([]);
  registerStrategies("owner-one", { recipes: { "fixture-same": once } });
  registerStrategies("owner-two", { recipes: { "fixture-same": once } });
  assert.throws(() => registerStrategies("owner-three", { recipes: { "fixture-same": recipe([]) } }), (error) =>
    error.name === "DuplicateStrategy" && error.owners[0] === "owner-one" && error.owners[1] === "owner-three");
});

// ---------------------------------------------------------------- prepareJob: parts, destinations, limit

// TST-472335 · level: component · module: MOD-job-runner
// guards: THE PAGE NAMES WHERE IT SENDS; THE CORRECTION LOOP HAS A FIXED LIMIT
// given: the kind derive-architecture, whose recipes are whole-spec, accepted-use-cases and chapters-for-architecture, reviewed by one participant of review-architecture, whose recipes are whole-spec, accepted-use-cases, whole-architecture (which gives no part for a product without an architecture), the draft under review and chapters-for-architecture; drafter-a with 200000 tokens of context; reviewer-c, another participant with another model
// input: prepareJob("derive-architecture", its context, { drafter: drafter-a, reviewers: [reviewer-c] }); and once more with the limit 2
// expect: the job's parts — the SPEC, both use cases and the chapters, whole, each sized by the estimate and naming its recipe, the reviewer's being the same; two destinations: the drafter, with those parts and its prompt, and the reviewer, with review-architecture's prompt and the parts its recipes give before a draft exists, each at its place; everything fits, nothing left out, nothing blocking; the kind's limit, 5, and the caller's, 2, where it gives one
test("prepareJob — names every destination with the parts it receives and their size, and fixes the limit before the first round", async () => {
  const kind = await kindOf("derive-architecture");
  const reviewing = await kindOf("review-architecture");
  const job = await prepared("derive-architecture", { drafter: DRAFTER, reviewers: [REVIEWER] });

  const recipes = ["whole-spec", "accepted-use-cases", "accepted-use-cases", "chapters-for-architecture"];
  const parts = [SPEC_PART, ...USE_CASES, CHAPTERS].map((part, at) => ({ ...part, size: estimate(part.text), recipe: recipes[at] }));
  assert.deepEqual(job.parts, parts);
  const partsSize = parts.reduce((sum, part) => sum + part.size, 0);
  assert.deepEqual(job.destinations, [
    { participant: DRAFTER, role: "drafter", place: "this machine", parts: ["SPEC.md", "UC-001", "UC-002", "chapters 9 to 12"],
      size: estimate(kind.prompt) + partsSize },
    { participant: REVIEWER, role: "reviewer", place: "NHR@FAU, Erlangen", parts: ["SPEC.md", "UC-001", "UC-002", "chapters 9 to 12"],
      size: estimate(reviewing.prompt) + partsSize },
  ]);
  assert.deepEqual([job.kind, job.drafter, job.reviewers, job.fits, job.notFitting, job.leftOut, job.blocking, job.limit],
    [kind, DRAFTER, [REVIEWER], true, [], [], [], 5]);

  const limited = await prepareJob("derive-architecture", contextOf(kind), { drafter: DRAFTER, reviewers: [REVIEWER], limit: 2 });
  assert.equal(limited.limit, 2);
});

// TST-472336 · level: component · module: MOD-job-runner
// guards: NO REQUIREMENT IS LEFT OUT OF THE CONTEXT SILENTLY; NOTHING IS LEFT OUT OF AN ARCHITECTURE PROMPT SILENTLY
// given: known positive first — derive-architecture for drafter-a, whose context holds the job; then for small-d, whose context holds 3000 tokens, fewer than the drafter's destination
// input: prepareJob("derive-architecture", its context, { drafter, reviewers: [reviewer-c] }) for each
// expect: drafter-a fits; small-d is named in notFitting with the size of its destination and its context, the job does not fit, and the parts are the same, whole — nothing is cut
test("prepareJob — a participant whose context cannot hold its part is named as not fitting, and nothing is cut", async () => {
  const fitting = await prepared("derive-architecture", { drafter: DRAFTER, reviewers: [REVIEWER] });
  assert.equal(fitting.fits, true);
  const job = await prepared("derive-architecture", { drafter: SMALL, reviewers: [REVIEWER] });
  const drafted = job.destinations.find((destination) => destination.role === "drafter");
  assert.ok(drafted.size > 3000, "known positive: the drafter's destination is larger than small-d's context");
  assert.deepEqual([job.fits, job.notFitting], [false, [{ participant: SMALL, size: drafted.size, context: 3000 }]]);
  assert.deepEqual(job.parts, fitting.parts);
});

// ---------------------------------------------------------------- prepareJob: what keeps a job from starting

// TST-472337 · level: component · module: MOD-job-runner
// guards: AN ARCHITECTURE IS DERIVED FROM THE WHOLE TO ITS MODULES
// given: derive-architecture, whose precondition architecture-ready gives a finding when the stand-in is told the SPEC is not ready, and none otherwise
// input: prepareJob of it, once ready and once not
// expect: no blocking finding when ready; the precondition's finding, as it gave it, when not
test("prepareJob — a precondition's finding keeps the job from starting", async () => {
  assert.deepEqual((await prepared("derive-architecture", { drafter: DRAFTER, reviewers: [REVIEWER] })).blocking, []);
  const job = await prepared("derive-architecture", { drafter: DRAFTER, reviewers: [REVIEWER] }, { params: { notReady: true } });
  assert.deepEqual(job.blocking, [NOT_READY]);
});

// TST-472338 · level: component · module: MOD-job-runner
// guards: A PARTICIPANT DECLARES ITS CAPABILITIES
// given: known positive first — derive-requirements, whose participant needs `draft text`, for drafter-a; then for reader-r, which can only read the repository
// input: prepareJob("derive-requirements", its context, { drafter, reviewers: [] }) for each
// expect: nothing blocking for drafter-a; for reader-r one error under A PARTICIPANT DECLARES ITS CAPABILITIES, naming reader-r and the capability it lacks
test("prepareJob — a drafter without a capability the kind needs keeps the job from starting, named", async () => {
  assert.deepEqual((await prepared("derive-requirements", { drafter: DRAFTER, reviewers: [] })).blocking, []);
  const job = await prepared("derive-requirements", { drafter: READER, reviewers: [] });
  assert.deepEqual(brief(job.blocking), [["error", "A PARTICIPANT DECLARES ITS CAPABILITIES"]]);
  assert.ok(job.blocking[0].what.includes("reader-r") && job.blocking[0].what.includes("draft text"), job.blocking[0].what);
});

// TST-472339 · level: component · module: MOD-job-runner
// guards: RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS; THE PLACES A MAILBOX'S MAIL MAY GO ARE CONFIGURED
// given: derive-requirements, whose recipe source-excerpt gives a part of SRC-restricted; drafter-a at "this machine" and reviewer-c at "NHR@FAU, Erlangen"; SRC-restricted allows only NHR@FAU, Erlangen; and, apart, a mailbox that allows only "this machine"
// input: prepareJob("derive-requirements", …) for reviewer-c — the known positive —, then for drafter-a; and with the mailbox's places for reviewer-c
// expect: nothing blocking for reviewer-c with the source; for drafter-a one error under RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS naming drafter-a, its place and the source; for reviewer-c with the mailbox one error under THE PLACES A MAILBOX'S MAIL MAY GO ARE CONFIGURED naming reviewer-c and its place
test("prepareJob — a drafter at a place a part's source or the mailbox does not allow keeps the job from starting, named", async () => {
  const sources = { "SRC-restricted": ["NHR@FAU, Erlangen"] };
  assert.deepEqual((await prepared("derive-requirements", { drafter: REVIEWER, reviewers: [] }, { sources })).blocking, []);

  const job = await prepared("derive-requirements", { drafter: DRAFTER, reviewers: [] }, { sources });
  assert.deepEqual(brief(job.blocking), [["error", "RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS"]]);
  for (const word of ["drafter-a", "this machine", "SRC-restricted"]) assert.ok(job.blocking[0].what.includes(word), word);

  const mailed = await prepared("derive-requirements", { drafter: REVIEWER, reviewers: [] }, { mailbox: ["this machine"] });
  assert.deepEqual(brief(mailed.blocking), [["error", "THE PLACES A MAILBOX'S MAIL MAY GO ARE CONFIGURED"]]);
  for (const word of ["reviewer-c", "NHR@FAU, Erlangen"]) assert.ok(mailed.blocking[0].what.includes(word), word);
});

// TST-472340 · level: component · module: MOD-job-runner
// guards: NO REVIEWER IS THE DRAFTER
// given: known positive first — derive-architecture drafted by drafter-a and reviewed by reviewer-c, another participant with another model; then reviewed by drafter-a itself, and by reviewer-s, another participant with drafter-a's model
// input: prepareJob("derive-architecture", its context, { drafter: drafter-a, reviewers: [reviewer] }) for each
// expect: nothing blocking for reviewer-c; for drafter-a and for reviewer-s one error under NO REVIEWER IS THE DRAFTER, naming the reviewer
test("prepareJob — a reviewer that is the drafter, or uses its model, keeps the job from starting", async () => {
  assert.deepEqual((await prepared("derive-architecture", { drafter: DRAFTER, reviewers: [REVIEWER] })).blocking, []);
  for (const reviewer of [DRAFTER, SAME_MODEL]) {
    const job = await prepared("derive-architecture", { drafter: DRAFTER, reviewers: [reviewer] });
    assert.deepEqual(brief(job.blocking), [["error", "NO REVIEWER IS THE DRAFTER"]], reviewer.name);
    assert.ok(job.blocking[0].what.includes(reviewer.name), job.blocking[0].what);
  }
});

// ---------------------------------------------------------------- prepareJob: what it refuses

// TST-472341 · level: component · module: MOD-job-runner
// guards: THE CATALOGUE IS DATA
// given: known positive first — derive-requirements, every strategy of which is registered; then analyse-issue, whose recipe issue-context no module has registered; and a name the catalogue does not hold
// input: prepareJob of each
// expect: derive-requirements is prepared; analyse-issue is refused with UnknownStrategy naming issue-context; the unknown name with the catalogue's UnknownKind
test("prepareJob — a strategy no module registered is refused as UnknownStrategy, an unknown kind as UnknownKind", async () => {
  assert.equal((await prepared("derive-requirements", { drafter: DRAFTER, reviewers: [] })).kind.name, "derive-requirements");
  await assert.rejects(prepared("analyse-issue", { drafter: DRAFTER, reviewers: [] }),
    (error) => error.name === "UnknownStrategy" && error.strategy === "issue-context");
  const context = contextOf(await kindOf("derive-requirements"));
  await assert.rejects(prepareJob("no-such-kind", context, { drafter: DRAFTER, reviewers: [] }),
    (error) => error.name === "UnknownKind" && error.kind === "no-such-kind");
});
