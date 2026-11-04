// The recipe `fix-inputs` of MOD-issue-handling's `issueStrategies` (ITM-583), as the accepted text of docs/architecture/MOD-issue-handling.md states it: "recipe `fix-inputs` — for fixing a bug: the parts of `issue-context`; the confirmed analysis — the violated
// requirement, whether code or a test is wrong, the modules —; the implementation inputs of those modules from MOD-run-planner's recipe `implementation-inputs`, given them as its parameter `modules`; and the instruction to write first a regression test that fails
// on the reported behaviour, with invented data only, never the reporter's (UC-012). Report data is in the issue only as the product's pseudonymisation left it, which the part says (`A PARTICIPANT THAT WRITES TO A REPOSITORY NEVER RECEIVES A MAIL`)."
// Run: node --test tests/issue-handling-fix-inputs.test.mjs
//
// Module: MOD-issue-handling; MOD-run-planner
// Guards: A PARTICIPANT THAT WRITES TO A REPOSITORY NEVER RECEIVES A MAIL; AN IMPLEMENTATION JOB BEGINS WITH A FAILING TEST; UC-012
// Level: unit
//
// The product is a fixture of this file, laid out as tests/run-planner-inputs.test.mjs lays out its own: a SPEC.md with one requirement, two decisions, two modules (MOD-reader uses MOD-writer), code, tests, and the issues the host lists. Readings the texts leave open, which
// the tests state (the pull request names them):
//   - The job's parameters are `issue` (the number), `violated` (the name of the requirement the bug violates), `wrong` (the files the analysis names as wrong — a test or code, as `analyse-issue` answers them) and `modules` (the modules the fix changes); one that is left out, null,
//     blank or an empty list is not given.
//   - The parts, in this order: those of `issue-context`; the part `confirmed analysis`, where any of the three is given; the parts of `implementation-inputs` for `modules`, where any is given; the part `regression test first`. A part is given once, at its first place.
//   - The part `confirmed analysis` states the violated requirement as the SPEC states it and lists the files named as wrong and the modules. A violated requirement the SPEC does not hold is UnknownRequirement { requirement }.
//   - The part `regression test first` says to write first a regression test that fails on the reported behaviour, with invented data in its fixtures and never the reporter's, to stop and ask if it passes before the change, names the issue's address and the requirement the pull
//     request is to link, and, where the job's identifier is known, the line `Job: <id>`; and it says how the product's pseudonymisation left the issue's report data: the product's `docs/settings.md` switching it off, or none (on), changes its words.
//   - A job without the parameter `issue` gets no part of `issue-context`; the recipe makes no request but the host's list of issues and the snapshot's reads.
// The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";

const handling = await import("../src/issue-handling/index.mjs").catch((error) => ({ error }));
const recipe = () => {
  assert.ok(handling.issueStrategies, `MOD-issue-handling offers issueStrategies: ${handling.error?.message}`);
  const given = handling.issueStrategies.recipes?.["fix-inputs"];
  assert.equal(typeof given, "function", "issueStrategies holds the recipe fix-inputs");
  return given;
};

const lines = (...rows) => `${rows.join("\n")}\n`;
const RULE = "A GUARDED RULE";
const decision = (id, extra) => lines("---", `id: ${id}`, `title: ${id} decision`, ...extra, "---", `# ${id} decision`, "", "## Context", "", "c", "", "## Decision", "", "d", "", "## Alternatives", "", "a", "", "## Consequences", "", "q");
const module_ = (id, { folder, uses, interfaces, provides }) => lines("---", `id: ${id}`, `title: ${id}`, `folder: ${folder}`, "realises:", "follows:", "  - ARC-002", uses.length ? "uses:" : "uses: []", ...uses.map((use) => `  - ${use}`),
  "provides:", `  - ${provides}`, "---", `# ${id} ${id}`, "", "## Responsibility", "", `RESPONSIBILITY-OF-${id}`, "", "## Parts", "", "p", "", "## Data", "", "d", "", "## Interfaces", "", interfaces, "", "## Files", "", `FILES-OF-${id}`, "", "## Uses", "", "u");
const useCase = (id) => lines("---", `id: ${id}`, `title: ${id} case`, "area: x", "actors:", "  - A", "realises:", `  - ${RULE}`, "---", `# ${id} case`, "");
const testFile = (id, mod) => lines(`// ${id}`, "// level: unit", `// module: ${mod}`, `// guards: ${RULE}`, "", "// the case follows");
const FILES = {
  "SPEC.md": lines("# Fixture — Specification", "", "## 1. Rules", "", `**${RULE}** *(Owner)*`, "A rule.", "*Check:* `tests/reader.test.mjs`"),
  "docs/architecture/ARC-001-whole.md": decision("ARC-001", ["forced_by:", "  - UC-001"]),
  "docs/architecture/ARC-002-sub.md": decision("ARC-002", ["refines: ARC-001", "forced_by:", "  - UC-001", "designs:", "  - MOD-reader", "  - MOD-writer"]),
  "docs/architecture/MOD-reader.md": module_("MOD-reader", { folder: "src/reader/", uses: ["MOD-writer.write"], interfaces: "- `read` — INTERFACE-OF-MOD-reader", provides: "read" }),
  "docs/architecture/MOD-writer.md": module_("MOD-writer", { folder: "src/writer/", uses: [], interfaces: "- `write` — INTERFACE-OF-MOD-writer", provides: "write" }),
  "docs/use-cases/UC-001-load.md": useCase("UC-001"),
  "src/reader/index.mjs": "export const read = 1;\n",
  "src/writer/index.mjs": "export const write = 1;\n",
  "tests/reader.test.mjs": testFile("TST-001", "MOD-reader"),
  "tests/writer.test.mjs": testFile("TST-002", "MOD-writer"),
};
const SETTINGS_OFF = lines("---", "pseudonymisation: off", "---", "# Settings of this product");

const snapshotOf = (files) => ({ paths: Object.keys(files), read: async (path) => (Object.prototype.hasOwnProperty.call(files, path) ? files[path] : null) });
const issue = (number, title, body) => ({ number, title, body, state: "open", labels: ["defect"], comments: [], url: `https://github.com/acme/product/issues/${number}` });
const ISSUES = [
  issue(1, "The reader drops the last line", `The reader drops the last line of a file, which ${RULE} forbids. The report said: error E42 in version 1.4.`),
  issue(2, "The reader again", "MOD-reader drops a line when the file ends without a newline."),
  issue(3, "Nothing named", "It does not work for me."),
];
const contextOf = (params, { files = FILES, jobId = "JOB-20261028-0900-a1b2" } = {}) => ({
  kind: null, params, product: { address: "https://github.com/acme/product", snapshot: snapshotOf(files), host: { listIssues: async () => ISSUES } }, instance: { snapshot: snapshotOf({}), host: null, checkout: null },
  connect: async () => null, participants: [], places: { sources: {}, mailbox: null, contents: [] }, gates: [], person: "alice", now: new Date("2026-10-28T08:00:00Z"),
  agentM: { version: "unreleased", commit: "a".repeat(40) }, jobId,
});

// Runs `body` with a fetch that fails the test if it is called.
async function offline(body) {
  const real = globalThis.fetch, calls = [];
  globalThis.fetch = async (...args) => { calls.push(args); throw new Error("the recipe must make no request"); };
  try {
    return await body();
  } finally {
    globalThis.fetch = real;
    assert.deepEqual(calls, [], "no request was made");
  }
}
const partsOf = (params, options) => offline(() => recipe()(contextOf(params, options), params));
const namesOf = (parts) => parts.map((part) => part.name);
const textOf = (parts, name) => parts.find((part) => part.name === name)?.text;
const STATED = `**${RULE}** *(Owner)*\nA rule.\n*Check:* \`tests/reader.test.mjs\``;
const READER_INPUTS = ["docs/architecture/MOD-reader.md", "docs/architecture/ARC-002-sub.md", "docs/architecture/ARC-001-whole.md", "SPEC.md", "docs/architecture/MOD-writer.md ## Interfaces",
  "src/reader/index.mjs", "tests/reader.test.mjs"];

// TST-583001 · level: unit · module: MOD-issue-handling
// guards: UC-012; AN IMPLEMENTATION JOB BEGINS WITH A FAILING TEST
// given: the issue 1, which names the requirement A GUARDED RULE; a confirmed analysis of that requirement, the file src/reader/index.mjs as wrong and the module MOD-reader; known positive first — the recipe is registered
// input: the recipe with the parameters issue 1, violated A GUARDED RULE, wrong [src/reader/index.mjs], modules [MOD-reader]
// expect: the parts, in this order: the issue's and the requirement's (those of issue-context), the confirmed analysis, the implementation inputs of MOD-reader (its file, its two decisions, the SPEC, MOD-writer's interfaces, its code and its test), the instruction
test("fix-inputs — gives the parts of issue-context, the confirmed analysis, the implementation inputs of the modules and the instruction, in this order", async () => {
  const parts = await partsOf({ issue: 1, violated: RULE, wrong: ["src/reader/index.mjs"], modules: ["MOD-reader"] });
  assert.deepEqual(namesOf(parts), ["issue #1", RULE, "confirmed analysis", ...READER_INPUTS, "regression test first"]);
  assert.ok(parts.every((part) => part.required === true && typeof part.text === "string" && Array.isArray(part.sources)));
  assert.equal(textOf(parts, "docs/architecture/MOD-reader.md"), FILES["docs/architecture/MOD-reader.md"], "a file of the implementation inputs is given whole");
  assert.equal(textOf(parts, "docs/architecture/MOD-writer.md ## Interfaces"), "## Interfaces\n\n- `write` — INTERFACE-OF-MOD-writer\n");
});

// TST-583002 · level: unit · module: MOD-issue-handling
// guards: UC-012
// given: the parts of TST-583001
// input: the recipe with the same parameters
// expect: the confirmed analysis states the requirement as the SPEC states it, lists src/reader/index.mjs among the files named as wrong and MOD-reader among the modules; it holds nothing of the issue's text
test("fix-inputs — the confirmed analysis states the violated requirement, the files named as wrong and the modules", async () => {
  const text = textOf(await partsOf({ issue: 1, violated: RULE, wrong: ["src/reader/index.mjs"], modules: ["MOD-reader"] }), "confirmed analysis");
  assert.ok(text.includes(STATED), text);
  assert.ok(/^- src\/reader\/index\.mjs$/m.test(text) && /^- MOD-reader$/m.test(text), text);
  assert.equal(text.includes("error E42"), false, "the issue's text is the issue's part, not the analysis'");
});

// TST-583003 · level: unit · module: MOD-issue-handling
// guards: UC-012; AN IMPLEMENTATION JOB BEGINS WITH A FAILING TEST
// given: the issue 1 and a job whose identifier is JOB-20261028-0900-a1b2; and the same recipe for a job whose identifier is not known and a confirmed analysis that names no requirement
// input: the recipe with the parameters of TST-583001; then with the parameters issue 1 and modules [MOD-reader] and no job identifier
// expect: the instruction says to write first a regression test that fails on the reported behaviour, that its fixtures hold invented data and never the reporter's, and to stop and ask if it passes before the change; it names the issue's address, the requirement A GUARDED RULE and the line `Job: JOB-20261028-0900-a1b2`; with no requirement and no job identifier it names neither (counter-proof)
test("fix-inputs — the instruction is to write the regression test first, with invented data only, and the pull request links the issue and the requirement", async () => {
  const full = textOf(await partsOf({ issue: 1, violated: RULE, wrong: ["src/reader/index.mjs"], modules: ["MOD-reader"] }), "regression test first");
  for (const sentence of [/Write first a regression test that fails on the reported behaviour/, /invented data/, /never the reporter's/, /stop and ask/, /https:\/\/github\.com\/acme\/product\/issues\/1/, new RegExp(RULE), /Job: JOB-20261028-0900-a1b2/]) {
    assert.match(full, sentence, `the instruction says ${sentence}`);
  }
  const bare = textOf(await partsOf({ issue: 1, modules: ["MOD-reader"] }, { jobId: null }), "regression test first");
  assert.match(bare, /invented data/);
  assert.equal(bare.includes(RULE) || bare.includes("Job:"), false, "no requirement and no job identifier are named where none is known");
});

// TST-583004 · level: unit · module: MOD-issue-handling, MOD-personal-data
// guards: A PARTICIPANT THAT WRITES TO A REPOSITORY NEVER RECEIVES A MAIL; PSEUDONYMISATION IS ON UNLESS A PRODUCT SWITCHES IT OFF; UC-012
// given: the issue 1 in a product without docs/settings.md, and in a product whose docs/settings.md switches pseudonymisation off
// input: the recipe for issue 1 in each
// expect: without settings the instruction says that the report data is only as the product's rewriting without persons left it; with the setting off it says that pseudonymisation is switched off and the report data may name persons — the two sentences differ
test("fix-inputs — the instruction says how the product's pseudonymisation left the report data", async () => {
  const on = textOf(await partsOf({ issue: 1 }), "regression test first");
  const off = textOf(await partsOf({ issue: 1 }, { files: { ...FILES, "docs/settings.md": SETTINGS_OFF } }), "regression test first");
  assert.match(on, /rewrites report data without persons/);
  assert.equal(/switched pseudonymisation off/.test(on), false);
  assert.match(off, /switched pseudonymisation off/);
  assert.match(off, /may name persons/);
  assert.equal(/rewrites report data without persons/.test(off), false);
});

// TST-583005 · level: unit · module: MOD-issue-handling
// guards: UC-012; DEVELOP AGAINST INTERFACES
// given: the issue 2, which names MOD-reader in its text, so that issue-context gives that module's file; the job names the same module
// input: the recipe with the parameters issue 2 and modules [MOD-reader]
// expect: the file of MOD-reader is one part, at its first place — after the issue's part, followed by the requirement its tests guard, both before the confirmed analysis — and the implementation inputs add the other parts of the module, none twice
test("fix-inputs — a part both issue-context and the implementation inputs give is given once, at its first place", async () => {
  const parts = await partsOf({ issue: 2, modules: ["MOD-reader"] });
  assert.deepEqual(namesOf(parts), ["issue #2", "docs/architecture/MOD-reader.md", RULE, "confirmed analysis", ...READER_INPUTS.slice(1), "regression test first"]);
  assert.equal(new Set(namesOf(parts)).size, parts.length, "no part twice");
});

// TST-583006 · level: unit · module: MOD-issue-handling
// guards: UC-012
// given: the issue 3, which names nothing the product holds; known positive first — it is analysed with a module
// input: the recipe with the parameters issue 3 alone; issue 3 and violated A GUARDED RULE; and a job without the issue and without a module
// expect: issue 3 alone: the issue's part, the whole SPEC and the instruction — no confirmed analysis, no implementation inputs, and no failure for a job that names no module —; with the requirement also the analysis; without an issue and a module, the instruction alone
test("fix-inputs — a job that names no module gets no implementation inputs, and a job without an issue gets no part of issue-context", async () => {
  assert.ok((await partsOf({ issue: 3, modules: ["MOD-writer"] })).some((part) => part.name === "src/writer/index.mjs"), "known positive");
  assert.deepEqual(namesOf(await partsOf({ issue: 3 })), ["issue #3", "SPEC.md", "regression test first"]);
  assert.deepEqual(namesOf(await partsOf({ issue: 3, violated: RULE, modules: [], wrong: [] })), ["issue #3", "SPEC.md", "confirmed analysis", "regression test first"]);
  for (const params of [{}, { issue: null }, { issue: undefined, violated: "", wrong: null, modules: [] }]) {
    assert.deepEqual(namesOf(await partsOf(params)), ["regression test first"], JSON.stringify(params));
  }
  assert.deepEqual(namesOf(await partsOf({ modules: ["MOD-writer"] })), ["confirmed analysis", "docs/architecture/MOD-writer.md", "docs/architecture/ARC-002-sub.md", "docs/architecture/ARC-001-whole.md", "SPEC.md",
    "src/writer/index.mjs", "tests/writer.test.mjs", "regression test first"]);
});

// TST-583007 · level: unit · module: MOD-issue-handling
// guards: UC-012
// given: known positive first — the issue 1 with its requirement and module; then a requirement the SPEC does not hold, a module no file holds, and an issue the host does not list
// input: the recipe with violated THE RULE NOBODY WROTE; with modules [MOD-nothing]; with issue 99; with an issue that is no whole number
// expect: UnknownRequirement { requirement }, UnknownWork { id: MOD-nothing } (MOD-run-planner's own), IssueNotFound { issue: 99 } (issue-context's), and a TypeError
test("fix-inputs — a requirement the SPEC does not hold, a module no file holds and an issue the host does not list are refused by name", async () => {
  assert.ok((await partsOf({ issue: 1, violated: RULE, modules: ["MOD-reader"] })).length > 0, "known positive");
  await assert.rejects(partsOf({ issue: 1, violated: "THE RULE NOBODY WROTE" }), (error) => error.name === "UnknownRequirement" && error.requirement === "THE RULE NOBODY WROTE");
  await assert.rejects(partsOf({ issue: 1, modules: ["MOD-nothing"] }), (error) => error.name === "UnknownWork" && error.id === "MOD-nothing");
  await assert.rejects(partsOf({ issue: 99 }), (error) => error.name === "IssueNotFound" && error.issue === 99);
  await assert.rejects(partsOf({ issue: "1" }), TypeError);
});

// TST-583008 · level: unit · module: MOD-issue-handling
// guards: A PARTICIPANT THAT WRITES TO A REPOSITORY NEVER RECEIVES A MAIL; UC-012
// given: the issue 1, whose text is the neutral text of an issue created from a mail (it lists no mail identifier)
// input: the recipe for issue 1, with every fetch failing the test
// expect: no request is made, and no part is named or holds a MAIL- identifier other than one the issue's own text lists (here none)
test("fix-inputs — makes no request and gives no mail", async () => {
  const parts = await partsOf({ issue: 1, violated: RULE, modules: ["MOD-reader"] });
  assert.equal(parts.some((part) => /MAIL-[0-9a-f]{16}/.test(part.name) || /MAIL-[0-9a-f]{16}/.test(part.text)), false);
});
