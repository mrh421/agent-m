// The recipe whole-spec (ITM-438) — MOD-spec-changes' specStrategies, as docs/architecture/MOD-spec-changes.md states it under Interfaces:
// "the SPEC as it stands, as one part". The kinds derive-architecture, review-architecture and change-architecture name it; their prompt
// carries the part whole, so that nothing of the SPEC is left out of an architecture prompt silently.
// Run: node --test tests/spec-changes-whole-spec.test.mjs
//
// Module: MOD-spec-changes
// Guards: UC-022; THE ARCHITECTURE'S PARTICIPANTS RECEIVE THE WHOLE PROJECT; NOTHING IS LEFT OUT OF AN ARCHITECTURE PROMPT SILENTLY
// Level: unit
//
// The product is a snapshot this file builds, never Agent M's own SPEC.md (KEIN SPEC-ZUGRIFF AUS PRODUKT-CODE). Its SPEC is written to
// show that "as it stands" is byte for byte: CR LF line ends, trailing blanks, a blank line before the first and after the last line, a non-ASCII letter, and no line end at the end. Beside it
// stands a change queue with an open entry, which the recipe does not read. The expected texts are the fixture's own, never the code's.
// Where the module file leaves a reading open, the test states the reading it takes, and the pull request names it:
//   - The part is named by the file, `SPEC.md`, shows no source and no artifact, is required, and carries size 0: the job runner sets a
//     part's size, as it does for every recipe's parts (MOD-job-runner, prepare.mjs).
//   - A SPEC that is empty is still one part, with no bytes; a product whose snapshot holds no SPEC.md is the failure SpecNotFound
//     { path }, since a recipe never gives a part from less than the SPEC.
//   - A snapshot that cannot read the SPEC fails the recipe with the snapshot's own failure, unchanged.
// A name the module does not provide yet is undefined here, so that each test fails by itself. The counter-proofs are in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { kindOf } from "../src/job-catalogue/index.mjs";
import { prepareJob, registerStrategies } from "../src/job-runner/index.mjs";
import * as specChanges from "../src/spec-changes/index.mjs";

const { specStrategies } = specChanges;
const OWNER = "tests/spec-changes-whole-spec.test.mjs";

const SPEC = "\r\n# Fixture product — Specification  \r\n\r\n## 1. Reading\r\n\r\n**A SAMPLE RULE** *(Product Owner)*\r\nA reader liest Bücher whole.\r\n*Check:* no automatic check; at review\r\n\r\n   \r\n## 2. Writing\r\n\r\n**A WRITE RULE** *(Product Owner)*\r\nA writer writes a file whole.\r\n*Check:* no automatic check; at review\r\n\r\n  ";
const OPEN_ENTRY = "## 2. Writing\n\n**AN OPEN ENTRY RULE** *(Product Owner)*\nSomething not in the SPEC yet.\n*Check:* no automatic check; at review\n";
const FILES = {
  "SPEC.md": SPEC,
  "docs/spec-freigaben/2026-03-01_sample/index.md": "# queue\n",
  "docs/spec-freigaben/2026-03-01_sample/01-writing.md": OPEN_ENTRY,
};
const snapshotOf = (files, read = async (path) => (Object.hasOwn(files, path) ? files[path] : null)) =>
  ({ paths: Object.keys(files), blob: () => null, read });
const run = (snapshot, params = {}) => specStrategies.recipes["whole-spec"](
  { params, product: { address: "https://github.com/alice/product", snapshot, host: null } }, params);

// TST-473043 · level: unit · module: MOD-spec-changes
// guards: THE ARCHITECTURE'S PARTICIPANTS RECEIVE THE WHOLE PROJECT; UC-022
// given: the fixture product, whose SPEC has CR LF line ends, blank lines and blanks at both ends, trailing blanks, a non-ASCII letter and no final line end, and beside it a queue with an open entry
// input: specStrategies.recipes["whole-spec"](context, params)
// expect: one part named SPEC.md whose text is the SPEC's bytes as they stand, with no source, no artifact, required, size 0
test("whole-spec — the SPEC as it stands, byte for byte, as one part", async () => {
  const parts = await run(snapshotOf(FILES));
  assert.equal(parts.length, 1);
  assert.deepEqual(parts[0], { name: "SPEC.md", text: SPEC, size: 0, sources: [], required: true });
});

// TST-473044 · level: unit · module: MOD-spec-changes
// guards: THE ARCHITECTURE'S PARTICIPANTS RECEIVE THE WHOLE PROJECT
// given: the same SPEC, and an open entry of a queue beside it
// input: the recipe
// expect: the part holds nothing of the open entry — "as it stands" is the SPEC, not its queues
test("whole-spec — the open entries of the queues are not part of the SPEC as it stands", async () => {
  const [part] = await run(snapshotOf(FILES));
  assert.ok(part.text.includes("A WRITE RULE"), "known positive: the SPEC's own requirement is in the part");
  assert.ok(!part.text.includes("AN OPEN ENTRY RULE"));
});

// TST-473045 · level: unit · module: MOD-spec-changes
// guards: NOTHING IS LEFT OUT OF AN ARCHITECTURE PROMPT SILENTLY
// given: a snapshot with an empty SPEC; one without a SPEC.md; one whose read fails with its own failure
// input: the recipe for each
// expect: one part with no bytes for the first; SpecNotFound naming SPEC.md for the second; the third's failure, the same object, unchanged
test("whole-spec — an empty SPEC is one empty part, a missing one and an unreadable one are failures, never a part from less", async () => {
  assert.equal((await run(snapshotOf(FILES))).length, 1, "known positive");
  assert.deepEqual(await run(snapshotOf({ "SPEC.md": "" })), [{ name: "SPEC.md", text: "", size: 0, sources: [], required: true }]);
  await assert.rejects(run(snapshotOf({ "README.md": "x" })), (error) => error.name === "SpecNotFound" && error.path === "SPEC.md"
    && error.message.includes("SPEC.md"));
  const refused = Object.assign(new Error("rate limited"), { name: "RateLimited" });
  await assert.rejects(run(snapshotOf(FILES, async () => { throw refused; })), (error) => error === refused);
});

// ---------------------------------------------------------------- the job runner

// The strategies the kinds name besides the recipes of this module: stand-ins, each skipped where a module registered the name.
const part = (name, text) => ({ name, text, sources: [], required: true, size: 0 });
const STAND_INS = {
  preconditions: { "architecture-ready": async () => null },
  recipes: { "accepted-use-cases": async () => [part("UC-001", "U".repeat(300))], "whole-architecture": async () => [], "chapters-for-architecture": async () => [part("chapters 9 to 12", "B".repeat(300))] },
  checks: Object.fromEntries(["document-schema", "graph-checks", "candidate-classes"].map((name) => [name, () => []])),
  steps: { "due-diligence": async (draft) => ({ draft, findings: [] }) },
  writers: { "open-files": async () => ({ commits: [], files: [], pullRequest: null, shown: null }) },
};
const register = (category, name, strategy) => {
  try {
    registerStrategies(OWNER, { [category]: { [name]: strategy } });
  } catch (error) {
    if (error.name !== "DuplicateStrategy") throw error;
  }
};
for (const [category, strategies] of Object.entries(STAND_INS)) {
  for (const [name, strategy] of Object.entries(strategies)) register(category, name, strategy);
}
const DRAFTER = { name: "drafter-a", type: "CLI agent", model: "example-model", context: 200000, price: null,
  capabilities: ["draft text", "read the repository"], place: "this machine", route: "bridge lab-pc agent claude" };
const SMALL = { ...DRAFTER, name: "small-d", model: "small-model", context: 400 };
const estimate = (text) => Math.ceil(text.length / 3);
const contextOf = (kind, snapshot) => ({
  kind, params: {}, product: { address: "https://github.com/alice/product", snapshot, host: null },
  instance: { snapshot: null, host: null }, connect: async () => { throw new Error("no repository is opened here"); },
  participants: [DRAFTER, SMALL], places: { sources: {}, mailbox: null }, gates: [], person: "alice",
  now: new Date("2026-10-11T08:00:00Z"), agentM: { version: "unreleased", commit: "0".repeat(40) }, jobId: null,
});

// TST-473046 · level: unit · module: MOD-spec-changes
// guards: THE ARCHITECTURE'S PARTICIPANTS RECEIVE THE WHOLE PROJECT; NOTHING IS LEFT OUT OF AN ARCHITECTURE PROMPT SILENTLY; UC-022
// given: derive-architecture, whose recipes name whole-spec, with this module's recipe registered; the fixture product; a drafter whose context holds the job, and one whose context of 400 tokens does not
// input: prepareJob("derive-architecture", context, { drafter, reviewers: [] }) for each
// expect: the part of whole-spec is the SPEC whole, named for its recipe, sized as the runner sizes every part (its characters divided by three, rounded up); the destination counts the kind's prompt and every part; the small drafter is named as not fitting with that size, and its parts are the same, whole
test("prepareJob — the SPEC part is sized as every part is, and a participant that cannot hold it is named, nothing cut", async () => {
  register("recipes", "whole-spec", specStrategies?.recipes?.["whole-spec"]);
  const kind = await kindOf("derive-architecture");
  const fitting = await prepareJob("derive-architecture", contextOf(kind, snapshotOf(FILES)), { drafter: DRAFTER, reviewers: [] });
  const spec = fitting.parts.find((each) => each.recipe === "whole-spec");
  assert.ok(spec, "the part of whole-spec");
  assert.equal(spec.text, SPEC);
  assert.equal(spec.size, estimate(SPEC));
  const others = fitting.parts.filter((each) => each !== spec).reduce((sum, each) => sum + each.size, 0);
  assert.equal(fitting.destinations[0].size, estimate(kind.prompt) + spec.size + others);
  assert.equal(fitting.fits, true);

  const small = await prepareJob("derive-architecture", contextOf(kind, snapshotOf(FILES)), { drafter: SMALL, reviewers: [] });
  assert.ok(fitting.destinations[0].size > 400, "known positive: the destination is larger than small-d's context");
  assert.deepEqual([small.fits, small.notFitting], [false, [{ participant: SMALL, size: fitting.destinations[0].size, context: 400 }]]);
  assert.deepEqual(small.parts, fitting.parts);
});
