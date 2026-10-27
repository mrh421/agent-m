// A part that may be left out — MOD-job-runner's prepareJob for a recipe whose name ends with `?` in its kind's definition
// (MOD-job-catalogue, Data: `recipes`): a part that may be left out with its reason, shown in `leftOut`, as
// docs/architecture/MOD-job-runner.md states Prepared and Part.
// Run: node --test tests/job-runner-left-out.test.mjs
//
// Module: MOD-job-runner
// Guards: THE PAGE NAMES WHERE IT SENDS; NO REQUIREMENT IS LEFT OUT OF THE CONTEXT SILENTLY
// Level: component
//
// No kind of the catalogue has such a recipe yet. Before this file loads the runner — and with it the catalogue, once in
// this process —, it gives the platform a disk that serves derive-requirements' definition with `source-excerpt?` in place
// of `source-excerpt`, and every other file as it stands; the shipped files are never changed. The strategies come from
// stand-ins this file registers. Each test states its input and its expected result before it runs.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const DEFINITION = "kinds/derive-requirements/kind.md";
const real = readFileSync(new URL(`../src/job-catalogue/${DEFINITION}`, import.meta.url), "utf8");
const optional = real.replace("\n  - source-excerpt\n", "\n  - source-excerpt?\n");
const saved = process.getBuiltinModule;
process.getBuiltinModule = (name) => (name === "node:fs"
  ? { readFileSync: (url, encoding) => (String(url).endsWith(DEFINITION) ? optional : readFileSync(url, encoding)) }
  : saved.call(process, name));
const { kindOf } = await import("../src/job-catalogue/index.mjs");
const { prepareJob, registerStrategies } = await import("../src/job-runner/index.mjs");
process.getBuiltinModule = saved;

const DRAFTER = { name: "drafter-a", type: "CLI agent", model: "example-model", context: 200000, price: null,
  capabilities: ["draft text"], place: "this machine", route: "bridge lab-pc agent claude" };
const part = (name) => ({ name, text: `the text of ${name}`, size: 0, sources: [], required: true });

// What the stand-in source-excerpt does: give its part, or throw the failure a test sets.
let excerptFails = null;
const named = (name, message) => Object.assign(new Error(message), { name });
for (const [category, strategies] of Object.entries({
  recipes: {
    "source-excerpt": async () => { if (excerptFails) throw excerptFails; return [part("SRC-iec-62304 2006")]; },
    "spec-with-queues": async () => { if (excerptFails?.name === "SpecUnreadable") throw excerptFails; return [part("SPEC.md")]; },
    "chapters-for-requirements": async () => [part("08_requirements-engineering.md")],
  },
  checks: { "requirement-form": () => [], "candidate-classes": () => [] },
  writers: { "queue-entries": async () => ({ commits: [], files: [], pullRequest: null, shown: null }) },
})) {
  for (const [name, strategy] of Object.entries(strategies)) {
    try {
      registerStrategies("tests/job-runner-left-out.test.mjs", { [category]: { [name]: strategy } });
    } catch (error) {
      if (error.name !== "DuplicateStrategy") throw error;
    }
  }
}

const contextOf = (kind) => ({ kind, params: {}, product: { address: "https://github.com/alice/product", snapshot: null,
  host: null }, instance: { snapshot: null, host: null }, connect: async () => null, participants: [DRAFTER],
  places: { sources: {}, mailbox: null }, gates: [], person: "alice", now: new Date(), agentM: { version: "unreleased",
  commit: "0".repeat(40) }, jobId: null });

// TST-472332 · level: component · module: MOD-job-runner
// guards: THE PAGE NAMES WHERE IT SENDS; NO REQUIREMENT IS LEFT OUT OF THE CONTEXT SILENTLY
// given: derive-requirements as this file's disk gives it, source-excerpt a recipe whose part may be left out; known positive first — the stand-in gives its part; then it fails with NotLinked
// input: prepareJob("derive-requirements", its context, { drafter, reviewers: [] }) for each
// expect: first the excerpt among the parts, not required, and nothing left out; then no excerpt, `leftOut` naming source-excerpt with the failure's own words as its reason, and the other parts as before
test("prepareJob — a part that may be left out is left out with its reason when its recipe fails", async () => {
  const kind = await kindOf("derive-requirements");
  assert.deepEqual(kind.recipes.find((recipe) => recipe.name === "source-excerpt"), { name: "source-excerpt", optional: true }, "known positive: the disk's definition is read");

  excerptFails = null;
  const given = await prepareJob("derive-requirements", contextOf(kind), { drafter: DRAFTER, reviewers: [] });
  assert.deepEqual(given.parts.map((p) => [p.name, p.required]), [["SRC-iec-62304 2006", false], ["SPEC.md", true],
    ["08_requirements-engineering.md", true]]);
  assert.deepEqual(given.leftOut, []);

  excerptFails = named("NotLinked", "the product links no version of SRC-iec-62304");
  const left = await prepareJob("derive-requirements", contextOf(kind), { drafter: DRAFTER, reviewers: [] });
  assert.deepEqual(left.parts.map((p) => p.name), ["SPEC.md", "08_requirements-engineering.md"]);
  assert.deepEqual(left.leftOut, [{ part: "source-excerpt", reason: "the product links no version of SRC-iec-62304" }]);
  assert.deepEqual(left.destinations[0].parts, ["SPEC.md", "08_requirements-engineering.md"]);
});

// TST-472333 · level: component · module: MOD-job-runner
// guards: NO REQUIREMENT IS LEFT OUT OF THE CONTEXT SILENTLY
// given: derive-requirements as above; its required recipe spec-with-queues fails with SpecUnreadable
// input: prepareJob of it
// expect: refused with that failure, by its name: a part that must be sent is never left out
test("prepareJob — a part that must be sent is never left out: its recipe's failure is thrown", async () => {
  const kind = await kindOf("derive-requirements");
  excerptFails = named("SpecUnreadable", "the SPEC could not be read");
  await assert.rejects(prepareJob("derive-requirements", contextOf(kind), { drafter: DRAFTER, reviewers: [] }),
    (error) => error.name === "SpecUnreadable");
  excerptFails = null;
});
