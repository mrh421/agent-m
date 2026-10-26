// The tools a kind offers its drafter, and the carrying out of their calls (ITM-486) — MOD-job-runner's `ToolUse` and the tool strategies
// `list-files`, `read-file`, `search-files`, `propose-edit` and `hand-over` of its table of built-in strategies, as
// docs/architecture/MOD-job-runner.md states them, and the item's readings of what the module file leaves unstated. For UC-049.
// Run: node --test tests/job-runner-tools.test.mjs
//
// Module: MOD-job-runner
// Guards: RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// Guards: A RECORD IS EVIDENCE, NOT A PROPOSAL; CODE ENTERS THE DEFAULT BRANCH THROUGH A PULL REQUEST WITH GREEN CI
// Guards: A GENERATED ARTIFACT IS A PROPOSAL; A PARTICIPANT DECLARES ITS CAPABILITIES
// Level: unit
//
// The tools are reached as a model endpoint's driver will reach them: a fixture drafter is handed `input.tools` by `runJob`, calls
// `tools.call(name, args)` and answers with the JSON of its answer; the draft `runJob` returns is where the held edits and hand-over
// stand. The kind is this file's own, with the tools it names; `hand-over` reads the real catalogue for the kinds it is given. The product's
// snapshot is a fixture; its host and the instance's are objects that fail the test when anything touches them. The expected answers
// are written out in each test, not read from a document. Nothing reaches the network. The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { formatFinding } from "../src/text-tools/index.mjs";
import { runJob } from "../src/job-runner/index.mjs";

const ENDPOINT = { name: "endpoint-a", type: "model endpoint", model: "example-model", context: 200000, price: null,
  capabilities: ["draft text", "read the repository", "use tools"], place: "this machine", route: "endpoint a" };
const withCapabilities = (capabilities) => ({ ...ENDPOINT, capabilities });

const ALL_FIVE = ["list-files", "read-file", "search-files", "propose-edit", "hand-over"];

const ANSWER = { type: "object", required: ["answer"], properties: { answer: { type: "string" }, edits: { type: "array",
  items: { type: "object", required: ["path", "text"], properties: { path: { type: "string" }, text: { type: "string" } } } } } };
const kindOf = (fields = {}) => ({ name: "fixture-tools", serves: [], participant: "one", needs: ["draft text"], resources: "none",
  preconditions: [], recipes: [], checks: ["document-schema"], personDecides: [], reviewer: null, reviewers: 0, steps: [],
  gatePoints: [], review: "person", writer: "return-draft", limit: 5, tools: ALL_FIVE, toolLimit: 7,
  purpose: "Answers, and proposes edits, for a test.", prompt: "Answer.", answer: ANSWER, ...fields });

const SNAPSHOT_FILES = {
  "README.md": "# Product\nThe needle is here.\n",
  "docs/a.md": "alpha\nneedle in a\nomega",
  "docs/sub/b.md": "beta\n\nno match",
  "docsx/y.md": "needle outside the folder docs",
  "sources/x.md": "restricted needle",
};
const snapshotOf = (files = SNAPSHOT_FILES) => ({ repository: { path: "alice/product" }, ref: "main", commit: "c".repeat(40),
  paths: Object.keys(files), async read(path) { return path in files ? files[path] : null; }, blob: () => null });

// An object that records every property anything reads from it: the product's host and the instance's, which no tool may touch.
function untouchable(touched, name) {
  return new Proxy({}, { get(target, property) { touched.push(`${name}.${String(property)}`); return undefined; } });
}

function contextOf(kind, { params = {}, places, files, touched = [] } = {}) {
  return { kind, params, product: { address: "https://github.com/alice/product", snapshot: snapshotOf(files), host: untouchable(touched, "product.host") },
    instance: { snapshot: null, host: untouchable(touched, "instance.host") }, connect: async () => { touched.push("connect"); return null; },
    participants: [ENDPOINT], places: places ?? { sources: {}, mailbox: null, contents: [] }, gates: [], person: "alice",
    now: new Date("2026-10-16T08:00:00Z"), agentM: { version: "unreleased", commit: "0".repeat(40) }, jobId: null };
}

// A driver that runs one script per exchange: the script is handed the exchange's `tools` (and the whole input) and returns the
// answer's draft; the driver keeps every input it was sent.
function driver(participant, scripts) {
  const inputs = [];
  return { participant, inputs, async send(input) {
    inputs.push(input);
    if (scripts.length === 0) throw new Error("the drafter was asked more often than the test expects");
    const draft = await scripts.shift()(input.tools, input);
    return { text: JSON.stringify({ draft, answers: [] }), usage: null };
  } };
}

async function run(scripts, { participant = ENDPOINT, kind = kindOf(), ...contextFields } = {}) {
  const touched = [];
  const context = contextOf(kind, { ...contextFields, touched });
  const prepared = { kind, params: context.params, drafter: participant, reviewers: [], parts: [], destinations: [], fits: true,
    notFitting: [], leftOut: [], blocking: [], limit: 5 };
  const drafter = driver(participant, scripts);
  const result = await runJob(prepared, { drafter, reviewers: [] }, { attended: true, context });
  return { drafter, result, touched };
}

// The answers a one-exchange drafter got to its calls, in order.
async function answersTo(calls, options) {
  const answers = [];
  const { result, touched } = await run([async (tools) => {
    for (const [name, args] of calls) answers.push(await tools.call(name, args));
    return { answer: "done" };
  }], options);
  return { answers, result, touched };
}

const offeredIn = async (options) => {
  let seen;
  await run([async (tools) => { seen = tools; return { answer: "done" }; }], options);
  return seen;
};

// ---------------------------------------------------------------- who gets a ToolUse

// TST-486001 · level: unit · module: MOD-job-runner
// guards: A PARTICIPANT DECLARES ITS CAPABILITIES
// given: a kind naming the five tools with a tool limit of 7; a model endpoint declaring draft text, read the repository and use tools
// input: runJob with a fixture drafter that keeps the `tools` of its input
// expect: a ToolUse whose definitions are, in the kind's order, list-files, read-file, search-files, propose-edit and hand-over, each with exactly the keys name, description and input, a description with text in it and an object schema as input; and whose limit is 7
test("a model endpoint that declares use tools gets the kind's five tools in its order, with the kind's tool limit", async () => {
  const tools = await offeredIn();
  assert.deepEqual(tools.definitions.map((tool) => tool.name), ["list-files", "read-file", "search-files", "propose-edit", "hand-over"]);
  for (const tool of tools.definitions) {
    assert.deepEqual(Object.keys(tool).sort(), ["description", "input", "name"], tool.name);
    assert.ok(tool.description.trim().length > 0, `${tool.name} has a description`);
    assert.equal(tool.input.type, "object", `${tool.name} has an object schema`);
  }
  assert.equal(tools.limit, 7);
  assert.equal(typeof tools.call, "function");
  assert.equal((await offeredIn({ kind: kindOf({ toolLimit: 30 }) })).limit, 30, "the limit is the kind's, not a constant");
});

// TST-486002 · level: unit · module: MOD-job-runner
// guards: A PARTICIPANT DECLARES ITS CAPABILITIES
// given: the kind of TST-486001; then a model endpoint declaring draft text and read the repository but not use tools; a CLI agent and a sandboxed agent, each declaring use tools; a CI agent declaring use tools; the same endpoint with a kind that names no tools
// input: runJob with a fixture drafter that keeps the `tools` of its input
// expect: tools is null in every one of these cases; counter-proof: the endpoint that declares use tools, with the kind that names tools, gets a ToolUse
test("every other drafter gets null: without use tools, a coding agent, a CI agent, or a kind without tools", async () => {
  assert.notEqual(await offeredIn(), null, "the endpoint that declares use tools gets a ToolUse");
  assert.equal(await offeredIn({ participant: withCapabilities(["draft text", "read the repository"]) }), null, "no use tools");
  for (const type of ["CLI agent", "sandboxed agent", "CI agent"]) {
    assert.equal(await offeredIn({ participant: { ...ENDPOINT, type, route: "bridge lab-pc agent claude" } }), null, type);
  }
  assert.equal(await offeredIn({ kind: kindOf({ tools: [], toolLimit: 0 }) }), null, "a kind that names no tools");
});

// TST-486003 · level: unit · module: MOD-job-runner
// guards: A PARTICIPANT DECLARES ITS CAPABILITIES
// given: the kind of TST-486001; a model endpoint declaring draft text and use tools but not read the repository
// input: runJob with a fixture drafter that keeps the `tools` of its input
// expect: the definitions are propose-edit and hand-over only, in that order; counter-proof: with read the repository declared as well, list-files, read-file and search-files are offered too
test("only the tools whose capability the drafter declares are offered", async () => {
  const without = await offeredIn({ participant: withCapabilities(["draft text", "use tools"]) });
  assert.deepEqual(without.definitions.map((tool) => tool.name), ["propose-edit", "hand-over"]);
  const withReading = await offeredIn();
  assert.deepEqual(withReading.definitions.map((tool) => tool.name), ALL_FIVE);
});

// TST-486004 · level: unit · module: MOD-job-runner
// guards: A GENERATED ARTIFACT IS A PROPOSAL
// given: the kind of TST-486001; a job whose parameter refuses names hand-over and list-files; then a job with no refuses; then one whose refuses is an empty list
// input: runJob with a fixture drafter that keeps the `tools` of its input, and then calls hand-over
// expect: with refuses, the definitions are read-file, search-files and propose-edit, and a call of hand-over is answered "refused: hand-over is not offered here"; without refuses, or with an empty list, all five are offered
test("the tools the job's parameter refuses are left out and cannot be called", async () => {
  const { answers } = await answersTo([["hand-over", { kind: "implement", works_on: ["UC-049"], task: "do it" }]],
    { params: { refuses: ["hand-over", "list-files"] } });
  assert.deepEqual(answers, ["refused: hand-over is not offered here"]);
  const refusing = await offeredIn({ params: { refuses: ["hand-over", "list-files"] } });
  assert.deepEqual(refusing.definitions.map((tool) => tool.name), ["read-file", "search-files", "propose-edit"]);
  assert.deepEqual((await offeredIn({ params: {} })).definitions.map((tool) => tool.name), ALL_FIVE);
  assert.deepEqual((await offeredIn({ params: { refuses: [] } })).definitions.map((tool) => tool.name), ALL_FIVE);
});

// ---------------------------------------------------------------- a call's arguments

// TST-486005 · level: unit · module: MOD-job-runner
// guards: A PARTICIPANT DECLARES ITS CAPABILITIES
// given: the kind of TST-486001
// input: calls of a tool that is not in the catalogue ("delete-everything"), of read-file with no path, of read-file with a path that is a number, of read-file with null as its arguments, of hand-over with works_on holding a number; and a call of read-file with a path of the snapshot
// expect: "refused: delete-everything is not offered here"; "refused: the call has no path"; "refused: the call.path is not a text"; "refused: the call is not an object"; "refused: the call.works_on[0] is not a text"; and, for the last, the file's text
test("a tool not offered, and arguments the tool's schema refuses, are answered with a refusal the participant reads", async () => {
  const { answers } = await answersTo([
    ["delete-everything", {}],
    ["read-file", {}],
    ["read-file", { path: 5 }],
    ["read-file", null],
    ["hand-over", { kind: "implement", works_on: [7], task: "do it" }],
    ["read-file", { path: "docs/a.md" }],
  ]);
  assert.deepEqual(answers, [
    "refused: delete-everything is not offered here",
    "refused: the call has no path",
    "refused: the call.path is not a text",
    "refused: the call is not an object",
    "refused: the call.works_on[0] is not a text",
    "alpha\nneedle in a\nomega",
  ]);
});

// ---------------------------------------------------------------- the reading tools

// TST-486006 · level: unit · module: MOD-job-runner
// guards: A GENERATED ARTIFACT IS A PROPOSAL
// given: a snapshot of README.md, docs/a.md, docs/sub/b.md, docsx/y.md and sources/x.md
// input: list-files of "docs", of "docs/", of "" and of "nothing"
// expect: "docs/a.md\ndocs/sub/b.md" for the first two (docsx/y.md is not under docs); all five paths, one per line in the snapshot's order, for ""; the empty text for "nothing"
test("list-files names the snapshot's paths under a folder, one per line, in order", async () => {
  const { answers } = await answersTo([["list-files", { folder: "docs" }], ["list-files", { folder: "docs/" }],
    ["list-files", { folder: "" }], ["list-files", { folder: "nothing" }]]);
  assert.deepEqual(answers, ["docs/a.md\ndocs/sub/b.md", "docs/a.md\ndocs/sub/b.md",
    "README.md\ndocs/a.md\ndocs/sub/b.md\ndocsx/y.md\nsources/x.md", ""]);
});

// TST-486007 · level: unit · module: MOD-job-runner
// guards: A GENERATED ARTIFACT IS A PROPOSAL
// given: the snapshot of TST-486006
// input: read-file of docs/a.md and of docs/missing.md
// expect: "alpha\nneedle in a\nomega" and "refused: no file docs/missing.md"
test("read-file answers the file's text, or a refusal naming the missing path", async () => {
  const { answers } = await answersTo([["read-file", { path: "docs/a.md" }], ["read-file", { path: "docs/missing.md" }]]);
  assert.deepEqual(answers, ["alpha\nneedle in a\nomega", "refused: no file docs/missing.md"]);
});

// TST-486008 · level: unit · module: MOD-job-runner
// guards: A GENERATED ARTIFACT IS A PROPOSAL
// given: the snapshot of TST-486006
// input: search-files for "needle", and for "absent"
// expect: the lines holding needle, each as <path>:<line number>: <line>, in the snapshot's path order and each file's line order — README.md:2, docs/a.md:2, docsx/y.md:1, sources/x.md:1; and the empty text for "absent"
test("search-files answers each line that holds the text as <path>:<line number>: <line>", async () => {
  const { answers } = await answersTo([["search-files", { text: "needle" }], ["search-files", { text: "absent" }]]);
  assert.deepEqual(answers, [[
    "README.md:2: The needle is here.",
    "docs/a.md:2: needle in a",
    "docsx/y.md:1: needle outside the folder docs",
    "sources/x.md:1: restricted needle",
  ].join("\n"), ""]);
});

// ---------------------------------------------------------------- a restricted path

const RESTRICTED = { sources: { "SRC-x": ["this machine"] }, mailbox: null, contents: [{ source: "SRC-x", paths: ["sources/x.md"] }] };

// TST-486009 · level: unit · module: MOD-job-runner
// guards: RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS
// given: places naming the path sources/x.md as content of the source SRC-x, which allows "this machine" only; a drafter whose place is "NHR@FAU, Erlangen"; then one whose place is "this machine"; then places with no contents
// input: read-file of sources/x.md and of docs/a.md; list-files of "sources"
// expect: at NHR@FAU, Erlangen: "refused: sources/x.md holds content of SRC-x, which may not go to NHR@FAU, Erlangen" for the restricted path, docs/a.md's text, and the path "sources/x.md" listed; at this machine: the restricted file's text "restricted needle"; with no contents named, the text as well
test("a path the context names for a restricted source is refused unless the source allows the drafter's place", async () => {
  const away = { ...ENDPOINT, place: "NHR@FAU, Erlangen" };
  const calls = [["read-file", { path: "sources/x.md" }], ["read-file", { path: "docs/a.md" }], ["list-files", { folder: "sources" }]];
  assert.deepEqual((await answersTo(calls, { participant: away, places: RESTRICTED })).answers, [
    "refused: sources/x.md holds content of SRC-x, which may not go to NHR@FAU, Erlangen",
    "alpha\nneedle in a\nomega",
    "sources/x.md",
  ]);
  assert.equal((await answersTo(calls, { participant: ENDPOINT, places: RESTRICTED })).answers[0], "restricted needle");
  const noContents = { sources: { "SRC-x": ["this machine"] }, mailbox: null };
  assert.equal((await answersTo(calls, { participant: away, places: noContents })).answers[0], "restricted needle", "a missing contents names none");
});

// TST-486010 · level: unit · module: MOD-job-runner
// guards: RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS
// given: the places of TST-486009; a drafter at "NHR@FAU, Erlangen"; then one at "this machine"
// input: search-files for "needle"
// expect: at NHR@FAU, Erlangen: the lines of README.md, docs/a.md and docsx/y.md, none of sources/x.md's text, and last the line "refused: sources/x.md holds content of SRC-x, which may not go to NHR@FAU, Erlangen"; at this machine: the line "sources/x.md:1: restricted needle" and no refusal
test("search-files leaves out the lines of a restricted file and says why", async () => {
  const away = { ...ENDPOINT, place: "NHR@FAU, Erlangen" };
  const searched = await answersTo([["search-files", { text: "needle" }]], { participant: away, places: RESTRICTED });
  assert.equal(searched.answers[0], [
    "README.md:2: The needle is here.",
    "docs/a.md:2: needle in a",
    "docsx/y.md:1: needle outside the folder docs",
    "refused: sources/x.md holds content of SRC-x, which may not go to NHR@FAU, Erlangen",
  ].join("\n"));
  const home = await answersTo([["search-files", { text: "needle" }]], { participant: ENDPOINT, places: RESTRICTED });
  assert.ok(home.answers[0].includes("sources/x.md:1: restricted needle"));
  assert.ok(!home.answers[0].includes("refused"));
});

// ---------------------------------------------------------------- propose-edit

const edit = (path, text) => ["propose-edit", { path, text }];

// TST-486011 · level: unit · module: MOD-job-runner
// guards: THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; A GENERATED ARTIFACT IS A PROPOSAL
// given: the kind of TST-486001
// input: propose-edit of docs/a.md "one", of docs/z.md "two", and of docs/a.md again "three"
// expect: each call answered "proposed: <path> is held for the person, who may save it"; the draft's edits are docs/a.md "three" then docs/z.md "two" — the later edit of a path replaces the earlier, in its place; the draft's answer is untouched; the snapshot's docs/a.md is unchanged and no host was touched
test("propose-edit holds a document's new text in the draft's edits, the later edit of a path replacing the earlier", async () => {
  const { answers, result, touched } = await answersTo([edit("docs/a.md", "one"), edit("docs/z.md", "two"), edit("docs/a.md", "three")]);
  assert.deepEqual(answers, ["proposed: docs/a.md is held for the person, who may save it",
    "proposed: docs/z.md is held for the person, who may save it", "proposed: docs/a.md is held for the person, who may save it"]);
  assert.deepEqual(result.draft, { answer: "done", edits: [{ path: "docs/a.md", text: "three" }, { path: "docs/z.md", text: "two" }] });
  assert.deepEqual(touched, []);
});

// TST-486012 · level: unit · module: MOD-job-runner
// guards: A RECORD IS EVIDENCE, NOT A PROPOSAL; CODE ENTERS THE DEFAULT BRANCH THROUGH A PULL REQUEST WITH GREEN CI
// given: the kind of TST-486001
// input: propose-edit of each path in the table below
// expect: the answer in the table for each — a refusal naming where the document is changed — and no edit in the draft; counter-proof: docs/notes/allowed.md, docs/jobs-notes.md and docs/tests-overview.md are held
test("propose-edit refuses SPEC.md, use cases, architecture, every record, every change queue, settings and every file outside docs/, naming where each is changed", async () => {
  const requirements = "refused: SPEC.md is changed by a job of change-requirements, from the requirements page";
  const useCases = "refused: docs/use-cases/UC-001-x.md is a use case, changed by a job of change-use-case, from the use case's page";
  const record = (path) => `refused: ${path} is a record, written once as evidence of what happened`;
  const REFUSED = [
    ["SPEC.md", requirements],
    ["docs/use-cases/UC-001-x.md", useCases],
    ["docs/architecture/ARC-001-x.md", "refused: docs/architecture/ARC-001-x.md is architecture, changed by a job of change-architecture, from the architecture page"],
    ["docs/architecture/MOD-x.md", "refused: docs/architecture/MOD-x.md is architecture, changed by a job of change-architecture, from the architecture page"],
    ["docs/approvals/a.md", record("docs/approvals/a.md")],
    ["docs/gates/g.md", record("docs/gates/g.md")],
    ["docs/jobs/JOB-1.md", record("docs/jobs/JOB-1.md")],
    ["docs/conversations/c.md", record("docs/conversations/c.md")],
    ["docs/test-results/r.md", record("docs/test-results/r.md")],
    ["docs/tests/counter-proofs/TST-1.md", record("docs/tests/counter-proofs/TST-1.md")],
    ["docs/spec-freigaben/2026-10-16_x/01-a.md", "refused: docs/spec-freigaben/2026-10-16_x/01-a.md is a change queue, whose entries a change of requirements writes"],
    ["docs/settings.md", "refused: docs/settings.md is a settings file, changed on the settings page, which states a notice first"],
    ["docs/collaborators.md", "refused: docs/collaborators.md is a settings file, changed on the settings page, which states a notice first"],
    ["docs/conversation-recording.md", "refused: docs/conversation-recording.md is a settings file, changed on the settings page, which states a notice first"],
    ["src/job-runner/index.mjs", "refused: src/job-runner/index.mjs is outside docs/; code, tests and workflows reach the default branch by a pull request, through hand-over"],
    ["README.md", "refused: README.md is outside docs/; code, tests and workflows reach the default branch by a pull request, through hand-over"],
    ["docs/../src/x.mjs", "refused: docs/../src/x.mjs is outside docs/; code, tests and workflows reach the default branch by a pull request, through hand-over"],
  ];
  const { answers, result } = await answersTo(REFUSED.map(([path]) => edit(path, "text")));
  assert.deepEqual(answers, REFUSED.map(([, said]) => said));
  assert.equal(result.draft.edits, undefined, "nothing was held");
  const allowed = await answersTo([edit("docs/notes/allowed.md", "a"), edit("docs/jobs-notes.md", "b"), edit("docs/tests-overview.md", "c")]);
  assert.deepEqual(allowed.result.draft.edits.map((held) => held.path), ["docs/notes/allowed.md", "docs/jobs-notes.md", "docs/tests-overview.md"]);
});

const ITEM = `---
id: ITM-001
title: Fixture item
level: module
realises:
  - A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT
modules:
  - MOD-fixture
tests:
  - unit
origin:
  - fixture
---
# ITM-001 Fixture item

## Outcome

An outcome.

## Acceptance

- An acceptance.
`;
const ITEM_PATH = "docs/backlog/ITM-001-fixture.md";
const ITEM_LACKING = `${ITEM.slice(0, ITEM.indexOf("## Acceptance")).trimEnd()}\n`;
const ITEM_FINDING = "ITM-001:1: error: the section ## Acceptance is required, and missing "
  + "[THE BACKLOG LIVES IN THE PRODUCT REPOSITORY] — add the section ## Acceptance.";

// TST-486013 · level: unit · module: MOD-job-runner
// guards: A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT
// given: the kind of TST-486001, whose check is document-schema; a drafter whose first exchange proposes docs/backlog/ITM-001-fixture.md without its ## Acceptance section and whose second exchange proposes the whole item
// input: runJob
// expect: round 1 has one finding, formatted "ITM-001:1: error: the section ## Acceptance is required, and missing [THE BACKLOG LIVES IN THE PRODUCT REPOSITORY] — add the section ## Acceptance." and the drafter is sent it as its second input's finding; round 2 has none; the result stopped because passed, with one held edit, the whole item (the second exchange starts with no edit held)
test("a proposed edit is checked in the round as every drafted document is, and each exchange holds its own edits", async () => {
  const { drafter, result } = await run([
    async (tools) => { await tools.call(...edit(ITEM_PATH, ITEM_LACKING)); return { answer: "first" }; },
    async (tools) => { await tools.call(...edit(ITEM_PATH, ITEM)); return { answer: "second" }; },
  ]);
  assert.deepEqual(result.rounds.map((round) => round.findings.map(formatFinding)), [[ITEM_FINDING], []]);
  assert.deepEqual(drafter.inputs[1].findings.map(formatFinding), [ITEM_FINDING]);
  assert.equal(result.stoppedBecause, "passed");
  assert.deepEqual(result.draft, { answer: "second", edits: [{ path: ITEM_PATH, text: ITEM }] });
});

// TST-486014 · level: unit · module: MOD-job-runner
// guards: A GENERATED ARTIFACT IS A PROPOSAL
// given: a drafter that proposes docs/z.md "held" with propose-edit and whose answer itself carries the edits docs/a.md "own" and docs/z.md "own"
// input: runJob
// expect: the draft's edits are docs/a.md "own" then docs/z.md "held": the edits of the answer first, the one held by a call replacing the answer's edit of the same path
test("an edit held by a call replaces the answer's own edit of the same path", async () => {
  const { result } = await run([async (tools) => {
    await tools.call(...edit("docs/z.md", "held"));
    return { answer: "done", edits: [{ path: "docs/a.md", text: "own" }, { path: "docs/z.md", text: "own" }] };
  }]);
  assert.deepEqual(result.draft.edits, [{ path: "docs/a.md", text: "own" }, { path: "docs/z.md", text: "held" }]);
});

// ---------------------------------------------------------------- hand-over

const handOver = (kind, works_on, task) => ["hand-over", { kind, works_on, task }];

// TST-486015 · level: unit · module: MOD-job-runner
// guards: CODE ENTERS THE DEFAULT BRANCH THROUGH A PULL REQUEST WITH GREEN CI
// given: the real catalogue, whose kind implement has a participant; the kind of TST-486001
// input: hand-over of implement, works on UC-049, with the task "Add the tool"; then of implement, works on UC-001, with the task "Add the other tool"
// expect: each answered "proposed: a job of implement goes on once you have answered: what it drafts is a proposal for the person"; the draft's handOver is { kind: "implement", works_on: ["UC-001"], task: "Add the other tool" }, the later replacing the earlier; no host was touched, so nothing is queued
test("hand-over holds the proposed hand-over in the draft's handOver and queues nothing", async () => {
  const { answers, result, touched } = await answersTo([handOver("implement", ["UC-049"], "Add the tool"),
    handOver("implement", ["UC-001"], "Add the other tool")]);
  assert.deepEqual(answers, Array(2).fill("proposed: a job of implement goes on once you have answered: what it drafts is a proposal for the person"));
  assert.deepEqual(result.draft.handOver, { kind: "implement", works_on: ["UC-001"], task: "Add the other tool" });
  assert.deepEqual(touched, []);
});

// TST-486016 · level: unit · module: MOD-job-runner
// guards: CODE ENTERS THE DEFAULT BRANCH THROUGH A PULL REQUEST WITH GREEN CI
// given: the real catalogue, whose index holds no kind "no-such-kind" and whose kind set-up-ci has no participant
// input: hand-over of no-such-kind, and of set-up-ci
// expect: "refused: the catalogue holds no kind no-such-kind" and "refused: set-up-ci has no participant"; the draft holds no handOver
test("hand-over refuses a kind the catalogue does not hold, and one without a participant", async () => {
  const { answers, result } = await answersTo([handOver("no-such-kind", ["UC-049"], "x"), handOver("set-up-ci", ["UC-049"], "x")]);
  assert.deepEqual(answers, ["refused: the catalogue holds no kind no-such-kind", "refused: set-up-ci has no participant"]);
  assert.equal(result.draft.handOver, undefined);
});

// ---------------------------------------------------------------- the component

// TST-486017 · level: component · module: MOD-job-runner
// guards: THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; A GENERATED ARTIFACT IS A PROPOSAL
// given: a model endpoint declaring use tools; the kind of TST-486001; a fixture drafter that lists docs/, reads docs/a.md, proposes an edit of docs/a.md and a hand-over of implement for UC-049, and answers; a product host and an instance host that fail the test when touched
// input: runJob, attended
// expect: the drafter's listing is "docs/a.md\ndocs/sub/b.md" and its reading is the file's text; the result's draft is { answer: "read it", edits: [{ path: "docs/a.md", text: "alpha changed" }], handOver: { kind: "implement", works_on: ["UC-049"], task: "Implement it" } }; the job stopped because passed, nothing was written (written is null), and no property of either host and no connection was touched
test("a fixture drafter reads, proposes an edit and a hand-over; nothing is written by any tool", async () => {
  const seen = {};
  const { result, touched } = await run([async (tools) => {
    seen.listing = await tools.call("list-files", { folder: "docs" });
    seen.reading = await tools.call("read-file", { path: "docs/a.md" });
    await tools.call(...edit("docs/a.md", "alpha changed"));
    await tools.call(...handOver("implement", ["UC-049"], "Implement it"));
    return { answer: "read it" };
  }]);
  assert.equal(seen.listing, "docs/a.md\ndocs/sub/b.md");
  assert.equal(seen.reading, "alpha\nneedle in a\nomega");
  assert.deepEqual(result.draft, { answer: "read it", edits: [{ path: "docs/a.md", text: "alpha changed" }],
    handOver: { kind: "implement", works_on: ["UC-049"], task: "Implement it" } });
  assert.equal(result.stoppedBecause, "passed");
  assert.equal(result.written, null);
  assert.deepEqual(touched, []);
});

// TST-1208001 · level: unit · module: MOD-job-runner
// guards: UC-049
// given: a product of 250 files — SPEC.md holding the needle, 249 others below docs/many/ —
// input: search-files { text: "needle" } with no path; then with path "SPEC.md"; then with path "docs/many/" (249 files)
// expect: with no path and with docs/many/ a refusal naming the count and the limit of 200; with SPEC.md its one matching line
test("search-files reads only the files below its path, and refuses a search of more than 200 files", async () => {
  const files = { "SPEC.md": "# SPEC\nthe needle\n", ...Object.fromEntries(Array.from({ length: 249 }, (_, at) => [`docs/many/${at}.md`, "hay"])) };
  const { answers } = await answersTo([["search-files", { text: "needle" }], ["search-files", { text: "needle", path: "SPEC.md" }],
    ["search-files", { text: "needle", path: "docs/many/" }]], { files });
  assert.match(answers[0], /^refused: the repository holds 250 files, more than the 200 one search reads; name a file or a folder as path/);
  assert.equal(answers[1], "SPEC.md:2: the needle");
  assert.match(answers[2], /^refused: docs\/many\/ holds 249 files, more than the 200/);
});

// TST-1360201 · level: unit · module: MOD-job-runner
// guards: UC-049
// given: a snapshot with no plan; a hand-over whose works_on names the requirement "NO SERVER", the place "SPEC.md section 16 Usability", the use case UC-007 and a web address
// input: handOverParams(works_on, snapshot)
// expect: requirements ["NO SERVER"] — the place, written with lowercase letters, names no requirement (JOB-20261026-2006-2d8e was refused for it) —; useCases ["UC-007"], useCase "UC-007"
test("handOverParams — an entry with lowercase letters, such as a section, names no requirement", async () => {
  const { handOverParams } = await import("../src/job-runner/index.mjs");
  const snapshot = { paths: ["SPEC.md"] };
  assert.deepEqual(handOverParams(["NO SERVER", "SPEC.md section 16 Usability", "UC-007", "https://example.test/x"], snapshot),
    { requirements: ["NO SERVER"], useCases: ["UC-007"], useCase: "UC-007" });
});
