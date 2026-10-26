// A change kind takes the conversation's draft as it stands (ITM-564) — MOD-job-catalogue's accepted table of kinds:
// `change-requirements`, `change-use-case` and `change-architecture` name the recipe `draft?` right after `conversation`; their
// prompts hold the named place `{{draft}}`. The recipe itself is built into MOD-job-runner and registered as `draft`: the job's
// parameter `draft` as one part, none while the job has no draft; made optional as `instruction?` is (ITM-529).
// Run: node --test tests/job-catalogue-draft.test.mjs
//
// Module: MOD-job-catalogue
// Guards: ONE DEFINITION, THREE DRIVERS
// Level: unit
//
// The strategies the three kinds name besides `instruction`, `conversation` and `draft` belong to other modules; this file
// registers a stand-in for each, giving no part and no finding. Nothing reaches the network.

import test from "node:test";
import assert from "node:assert/strict";
import { kindOf } from "../src/job-catalogue/index.mjs";
import { prepareJob, registerStrategies } from "../src/job-runner/index.mjs";

const CHANGE_KINDS = ["change-requirements", "change-use-case", "change-architecture"];

const nothing = async () => [];
// The precondition person-source of change-requirements (MOD-spec-changes), which these tests do not concern: it finds nothing.
try {
  registerStrategies("tests/job-catalogue-draft.test.mjs:person-source", { preconditions: { "person-source": async () => null } });
} catch (error) {
  if (error.name !== "DuplicateStrategy") throw error;
}
for (const [category, name] of [["recipes", "named-requirements"], ["recipes", "spec-with-queues"],
  ["recipes", "chapters-for-requirements"], ["recipes", "use-case-with-neighbours"], ["recipes", "whole-spec"],
  ["recipes", "use-cases"], ["recipes", "accepted-use-cases"], ["recipes", "whole-architecture"], ["recipes", "chapters-for-architecture"],
  ["preconditions", "rests-on-accepted"], ["checks", "requirement-form"], ["checks", "identifier-kept"],
  ["steps", "due-diligence"], ["writers", "queue-entries"], ["writers", "open-files"]]) {
  try {
    registerStrategies("tests/job-catalogue-draft.test.mjs", { [category]: { [name]: nothing } });
  } catch (error) {
    if (error.name !== "DuplicateStrategy") throw error;
  }
}

const DRAFTER = { name: "drafter-a", type: "model endpoint", model: "example-model", context: 200000, price: null,
  capabilities: ["draft text", "use tools"], place: "this machine", route: "endpoint" };
const contextOf = (params) => ({ kind: null, params, product: { address: "https://github.com/alice/product", snapshot: null, host: null },
  instance: { snapshot: null, host: null }, connect: async () => null, participants: [DRAFTER], places: { sources: {}, mailbox: null }, gates: [],
  person: "alice", now: new Date("2026-10-16T08:00:00Z"), agentM: { version: "unreleased", commit: "0".repeat(40) }, jobId: null });
const prepare = (kind, params) => prepareJob(kind, contextOf(params), { drafter: DRAFTER, reviewers: [] });

// TST-564001 · level: unit · module: MOD-job-catalogue
// guards: ONE DEFINITION, THREE DRIVERS
// given: the kinds change-requirements, change-use-case and change-architecture of the catalogue
// input: kindOf of each
// expect: the recipes are, in this order, instruction, conversation, draft — the third and only the third optional — and then, for change-requirements named-requirements, spec-with-queues and chapters-for-requirements, for change-use-case use-case-with-neighbours and chapters-for-requirements, for change-architecture whole-spec, use-cases, whole-architecture and chapters-for-architecture, none optional
test("kindOf — the three change kinds name draft? right after conversation, then the recipes they named before", async () => {
  const expected = {
    "change-requirements": ["named-requirements", "spec-with-queues", "chapters-for-requirements"],
    "change-use-case": ["use-case-with-neighbours", "chapters-for-requirements"],
    "change-architecture": ["whole-spec", "use-cases", "whole-architecture", "chapters-for-architecture"],
  };
  assert.deepEqual(Object.keys(expected), CHANGE_KINDS, "known positive: the three kinds are those expected here");
  for (const name of CHANGE_KINDS) {
    assert.deepEqual((await kindOf(name)).recipes,
      [{ name: "instruction", optional: false }, { name: "conversation", optional: false }, { name: "draft", optional: true },
        ...expected[name].map((recipe) => ({ name: recipe, optional: false }))], name);
  }
});

// TST-564002 · level: unit · module: MOD-job-catalogue
// guards: ONE DEFINITION, THREE DRIVERS
// given: the prompts of change-requirements, change-use-case and change-architecture
// input: the prompt text of kindOf of each
// expect: the heading `## The draft as it stands` stands exactly once, then one paragraph saying that the draft, where one is given, is what the participant changes further, then the place `{{draft}}`; that place comes after the place `{{conversation}}` and before the place of every recipe named after `draft` in the kind's recipes
test("kindOf — each change kind's prompt holds {{draft}} under its own heading, after the conversation", async () => {
  const heading = "## The draft as it stands";
  for (const name of CHANGE_KINDS) {
    const { prompt, recipes } = await kindOf(name);
    assert.equal(prompt.split(heading).length, 2, `${name}: the heading once`);
    const after = prompt.slice(prompt.indexOf(heading) + heading.length);
    assert.match(after, /^\n\n[^\n]+\n\n\{\{draft\}\}\n/, `${name}: one paragraph, then the place`);
    assert.match(after.split("{{draft}}")[0], /draft.*where one is given.*change.*further/s, name);
    assert.ok(prompt.indexOf("{{conversation}}") < prompt.indexOf("{{draft}}"), `${name}: after the conversation`);
    for (const later of recipes.slice(recipes.findIndex((recipe) => recipe.name === "draft") + 1)) {
      assert.ok(prompt.indexOf("{{draft}}") < prompt.indexOf(`{{${later.name}}}`), `${name}: before ${later.name}`);
    }
  }
});

// TST-564003 · level: unit · module: MOD-job-catalogue
// guards: ONE DEFINITION, THREE DRIVERS
// given: jobs of change-use-case, change-requirements and change-architecture whose parameters hold draft { files: [ { path: "a.md" } ] }; then one of change-use-case whose draft is the text "The draft text"; then jobs without the parameter
// input: prepareJob(kind, …)
// expect: with an object, exactly one part of the recipe draft, named draft, whose text is the object written as JSON indented by two spaces; with a text, one part whose text is "The draft text"; without the parameter, no part of that recipe for any of the three kinds; in every case nothing is left out
test("prepareJob of a change kind — the conversation's draft is the part draft; without a draft there is none and nothing is left out", async () => {
  const draft = { files: [{ path: "a.md" }] };
  const drafted = (prepared) => prepared.parts.filter((part) => part.recipe === "draft").map((part) => [part.name, part.text]);
  for (const name of CHANGE_KINDS) {
    const given = await prepare(name, { draft });
    assert.deepEqual(drafted(given), [["draft", '{\n  "files": [\n    {\n      "path": "a.md"\n    }\n  ]\n}']], name);
    assert.deepEqual(given.leftOut, [], name);
  }
  const text = await prepare("change-use-case", { draft: "The draft text" });
  assert.deepEqual(drafted(text), [["draft", "The draft text"]]);
  for (const name of CHANGE_KINDS) {
    const without = await prepare(name, {});
    assert.deepEqual(drafted(without), [], name);
    assert.deepEqual(without.leftOut, [], name);
  }
});
