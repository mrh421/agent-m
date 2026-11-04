// strategies.mjs — the recipe `test-selection` of `resultStrategies` (MOD-result-records, Parts: strategies.mjs; Interfaces: resultStrategies), for the kinds `propose-tests`
// and `write-tests` (UC-026 step 3): the text of each requirement, use case and module the job's parameters select, every existing test that guards any of them with its
// declaration and code, and the product's external services, each marked paid or free. The check `test-proposals` (ITM-753, ITM-851) and, for the kind `run-tests`, the recipe `commit-and-levels` and the writer `result-record` (ITM-586) are in this file too.
//
// Module: MOD-result-records
//
// It reads and writes text only: no service is called, paid or free.

import { readDocument, readRegister } from "../documents/index.mjs";
import { testDeclarations, isTestFile } from "../test-document/index.mjs";
import { finding } from "../text-tools/index.mjs";
import { traceGraph, tracesTo } from "../trace-graph/index.mjs";
import { paidServices, resourceSchema } from "../resource-list/index.mjs";
import { defaultSchedule, occasionsOf, scheduleSchema } from "../test-schedule/index.mjs";
import { appendResult } from "./append.mjs";
import { resultSchema } from "./read.mjs";

const RESOURCES = "docs/resources.md";
const SCHEDULE = "docs/tests/schedule.md";
const listOf = (value) => (Array.isArray(value) ? value : []);

// The text of a selected name: a requirement as the SPEC states it (its name line to the next blank line), a use case or module its whole file; null for a name the graph lacks.
async function textOf(snapshot, node) {
  const text = await snapshot.read(node.path);
  if (typeof text !== "string") return null;
  if (node.kind !== "requirement") return `${node.id}\n\n${text.trim()}`;
  const lines = text.split("\n").slice(node.line - 1);
  const end = lines.findIndex((line) => line.trim() === "");
  return lines.slice(0, end < 0 ? lines.length : end).join("\n");
}

// The tests that guard a name: those `tracesTo` finds, and, for a module, those that exercise it.
function guardingTests(graph, name) {
  const exercising = graph.nodes.get(name)?.kind === "MOD"
    ? graph.edges.filter((edge) => edge.via === "exercises" && edge.to === name).map((edge) => edge.from) : [];
  return [...tracesTo(graph, name).tests, ...exercising];
}

// A test's declaration lines and its code, up to the next declaration of its file.
async function testText(snapshot, node) {
  const text = await snapshot.read(node.path);
  if (typeof text !== "string") return null;
  const declarations = testDeclarations(node.path, text);
  const at = declarations.findIndex((declaration) => declaration.id === node.id);
  if (at < 0) return null;
  const lines = text.split("\n");
  const next = declarations[at + 1]?.line ?? lines.length + 1;
  return lines.slice(declarations[at].line - 1, next - 1).join("\n").trimEnd();
}

// The product's external services, each marked paid or free by MOD-resource-list's paidServices; none where the product has no docs/resources.md.
async function servicesOf(snapshot) {
  const text = await snapshot.read(RESOURCES);
  if (typeof text !== "string") return [];
  const resources = readRegister(resourceSchema(), RESOURCES, text).rows.map(({ cells: c }) => ({ name: c.Name, kind: c.Kind, address: c.Address,
    paid: c.Paid === "yes" ? true : c.Paid === "no" ? false : null }));
  return paidServices(resources);
}
const servicesText = async (snapshot) => (await servicesOf(snapshot)).map((service) => `- ${service.name} (${service.kind}, ${service.address}): ${service.paid ? "paid" : "free"}`);

// The product's schedule, or the book's default where it saved none.
async function scheduleOf(snapshot) {
  const text = await snapshot.read(SCHEDULE);
  return typeof text === "string" ? readDocument(scheduleSchema, SCHEDULE, text) : defaultSchedule();
}
const COMMIT_OCCASIONS = ["every commit", "pull request"];

/**
 * The recipe test-selection(context, params) -> Part[] — one part, `test-selection`: the text of each requirement, use case and module the parameters `requirements`,
 * `useCases` and `modules` name; every existing test that guards any of them, with its declaration and code; and the product's external services, each marked paid or free.
 */
async function testSelection(context, params) {
  const { snapshot } = context.product;
  const graph = await traceGraph(snapshot);
  const names = [...listOf(params?.requirements), ...listOf(params?.useCases), ...listOf(params?.modules)];
  const selected = [];
  for (const name of names) {
    const node = graph.nodes.get(name);
    const text = node ? await textOf(snapshot, node) : null;
    if (text !== null) selected.push(text);
  }
  const tests = [];
  for (const id of [...new Set(names.flatMap((name) => guardingTests(graph, name)))].sort()) {
    const text = await testText(snapshot, graph.nodes.get(id));
    if (text !== null) tests.push(text);
  }
  const text = [
    "The selection:", ...selected,
    "The existing tests that guard it:", ...(tests.length ? tests : ["(none)"]),
    "The product's external services:", (await servicesText(snapshot)).join("\n") || "(none)",
  ].join("\n\n");
  return [{ name: "test-selection", text, sources: [], required: true, artifacts: [] }];
}

const normal = (text) => String(text ?? "").replace(/\s+/g, " ").trim().toLowerCase();
const blank = (value) => typeof value !== "string" || value.trim() === "";

// The declarations of every test file of the product's snapshot.
async function existingTests(snapshot) {
  const found = [];
  for (const path of snapshot.paths.filter(isTestFile)) {
    const text = await snapshot.read(path);
    if (typeof text === "string") found.push(...testDeclarations(path, text));
  }
  return found;
}

const NEW_TEST = "A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT";
const EXPECTED = "A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS";
const IDENTIFIER = "EVERY ARTIFACT HAS AN IDENTIFIER";
const TEST_ID = /^TST-\d+$/;

// The tests the branch adds: the declarations of every file whose blob differs from the product's, whose identifier the product's file of that path does not declare.
async function addedTests(branch, snapshot) {
  const added = [];
  for (const path of branch.paths.filter(isTestFile)) {
    if (branch.blob(path) === snapshot.blob(path)) continue;
    const before = snapshot.blob(path) === null ? "" : (await snapshot.read(path)) ?? "";
    const known = new Set(testDeclarations(path, before).map((declaration) => declaration.id));
    added.push(...testDeclarations(path, await branch.read(path)).filter((declaration) => !known.has(declaration.id)));
  }
  return added;
}

// Whether the branch holds a counter-proof record of the test that records it failing with its fault planted.
async function recordsFailure(branch, id) {
  const path = `docs/tests/counter-proofs/${id}.md`;
  const text = await branch.read(path);
  if (typeof text !== "string") return false;
  const document = readDocument(resultSchema.counterProof, path, text);
  const section = (heading) => document.sections.find((one) => one.heading === heading)?.text;
  return document.fields.outcome === "failed" && !blank(section("## Fault")) && !blank(section("## Result"));
}

// A case's guards hold what a test declares as two fields (EVERY ARTIFACT NAMES ITS ORIGIN): an entry MOD-<slug> is the module it exercises, the others what it guards.
const isModule = (entry) => /^MOD-/.test(entry);

// The ways a written test differs from the reviewed case it implements: [rule, what]. The case's guards without its modules are compared with the test's guards, and its modules with the
// test's module, each where the case names it: a case that names only a module leaves the test to name what it guards.
function differences(declaration, one) {
  if (!one) return [[NEW_TEST, `${declaration.id} implements no reviewed case: no case has its identifier`]];
  const same = [];
  const guarded = (list) => [...new Set(list)].sort().join("\n");
  const named = Array.isArray(one.guards) ? one.guards : [];
  const guards = named.filter((entry) => !isModule(entry));
  const modules = named.filter(isModule);
  if (declaration.level !== one.level) same.push([NEW_TEST, `${declaration.id} has level ${declaration.level}, its case ${one.level}`]);
  if (guards.length > 0 && guarded(declaration.guards ?? []) !== guarded(guards)) same.push([NEW_TEST, `${declaration.id} guards ${(declaration.guards ?? []).join(", ")}, its case ${guards.join(", ")}`]);
  if (modules.length > 0 && !modules.includes(declaration.module)) same.push([NEW_TEST, `${declaration.id} exercises ${declaration.module ?? "no module"}, its case ${modules.join(", ")}`]);
  if (normal(declaration.expect) !== normal(one.expected)) same.push([EXPECTED, `${declaration.id} expects "${declaration.expect}", its case "${one.expected}"`]);
  return same;
}

/**
 * The check test-proposals for the kind `write-tests` (the draft with a `branch`): the branch is read through the product's host; an error for each new test of a level other than `user`
 * without a counter-proof record that records it failing, unless the draft reports it `failed`; and an error for each new test whose identifier, level, guards, module or expected result
 * differ from the reviewed case in `context.params.draft` (see differences). A branch the host does not hold is one finding.
 */
async function writtenTests(draft, context) {
  const { host, snapshot } = context.product;
  let branch;
  try {
    branch = await host.readSnapshot(draft.branch);
  } catch (error) {
    if (error.name !== "NotFound") throw error;
    return [finding({ artifact: "answer", line: 1, kind: "error", rule: NEW_TEST, what: `the branch ${draft.branch} is not on the host`, fix: "push the branch, then report it" })];
  }
  const reviewed = context.params?.draft;
  const cases = Array.isArray(reviewed) ? reviewed : Array.isArray(reviewed?.cases) ? reviewed.cases : null;
  const reported = new Map(listOf(draft.tests).map((one) => [one.identifier, one]));
  const findings = [];
  for (const declaration of await addedTests(branch, snapshot)) {
    const at = { artifact: declaration.path, line: declaration.line, kind: "error" };
    if (declaration.level !== "user" && reported.get(declaration.id)?.outcome !== "failed" && !(await recordsFailure(branch, declaration.id))) {
      findings.push(finding({ ...at, rule: NEW_TEST, what: `the new test ${declaration.id} has no counter-proof record of it failing with its fault planted`,
        fix: `add docs/tests/counter-proofs/${declaration.id}.md recording the fault and the failing result, or report the test failed` }));
    }
    if (cases) for (const [rule, what] of differences(declaration, cases.find((one) => one.identifier === declaration.id))) {
      findings.push(finding({ ...at, rule, what, fix: "write the test as its reviewed case says" }));
    }
  }
  return findings;
}

/**
 * The check test-proposals(draft, context) -> Finding[], for the kind `propose-tests` (the draft's `cases`): an error for a case without an identifier of the scheme TST-<number>, or with
 * one that an existing test of the product or another case of the proposal carries (EVERY ARTIFACT HAS AN IDENTIFIER); an error for a case without an expected result, a model-dependent
 * case (one with `phrasings`) judged on fewer than two runs, a case that guards nothing, and a case of a level that runs on a commit or pull request that names in `paid` a service the product's resources mark paid (COMMIT TESTS CALL NO PAID SERVICE; the levels from the product's schedule, or the book's default); an error for a case not classed `duplicate` that shares a guarded name, its input
 * and its expected result with an existing test. A draft without `cases` has no finding. It calls no model.
 */
async function testProposals(draft, context) {
  if (typeof draft?.branch === "string") return writtenTests(draft, context);
  const cases = Array.isArray(draft?.cases) ? draft.cases : [];
  const existing = cases.length ? await existingTests(context.product.snapshot) : [];
  const paid = cases.some((one) => !blank(one.paid)) ? new Set((await servicesOf(context.product.snapshot)).filter((service) => service.paid).map((service) => service.name)) : new Set();
  const schedule = paid.size > 0 ? await scheduleOf(context.product.snapshot) : null;
  const declared = new Set(existing.map((test) => test.id));
  const carried = cases.map((one) => one.identifier);
  const findings = [];
  cases.forEach((one, index) => {
    const at = { artifact: one.identifier ?? `case ${index + 1}`, line: index + 1, kind: "error" };
    const fix = "give the case an identifier TST-<number> that no existing test and no other case has";
    if (typeof one.identifier !== "string" || !TEST_ID.test(one.identifier)) findings.push(finding({ ...at, rule: IDENTIFIER,
      what: `case ${at.artifact} carries no identifier of the scheme TST-<number>`, fix }));
    else if (declared.has(one.identifier)) findings.push(finding({ ...at, rule: IDENTIFIER, what: `case ${one.identifier} carries the identifier of the existing test ${one.identifier}`, fix }));
    else if (carried.indexOf(one.identifier) !== carried.lastIndexOf(one.identifier)) findings.push(finding({ ...at, rule: IDENTIFIER,
      what: `case ${one.identifier} carries the identifier of another case of the proposal`, fix }));
    if (blank(one.expected)) findings.push(finding({ ...at, rule: "A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS",
      what: `case ${at.artifact} names no expected result`, fix: "state the result the case expects before it runs" }));
    if (Array.isArray(one.phrasings) && one.phrasings.length > 0 && !(one.runs >= 2)) findings.push(finding({ ...at, rule: "A MODEL-DEPENDENT TEST IS MEASURED AS A RATE",
      what: `model-dependent case ${at.artifact} is judged on ${one.runs === undefined ? "no number of runs" : `${one.runs} run`}`, fix: "fix a number of runs of at least 2 before the first run" }));
    const guards = Array.isArray(one.guards) ? one.guards : [];
    if (guards.length === 0) findings.push(finding({ ...at, rule: "EVERY ARTIFACT NAMES ITS ORIGIN",
      what: `case ${at.artifact} guards no requirement, use case or module`, fix: "name the identifiers the case guards, or drop the case" }));
    if (!blank(one.paid) && paid.has(one.paid.trim()) && occasionsOf(one.level, schedule).some((occasion) => COMMIT_OCCASIONS.includes(occasion))) {
      findings.push(finding({ ...at, rule: "COMMIT TESTS CALL NO PAID SERVICE", what: `case ${at.artifact} of level ${one.level} runs on a commit or pull request and reaches the paid service ${one.paid.trim()}`,
        fix: "use a recorded or constructed response in place of the service, or give the case a level that runs only nightly or on a release" }));
    }
    const same = one.class === "duplicate" ? null : existing.find((test) => (test.guards ?? []).some((name) => guards.includes(name))
      && normal(test.input) === normal(one.input) && normal(test.expect) === normal(one.expected));
    if (same) findings.push(finding({ ...at, rule: "TEST GENERATION SEES THE EXISTING TESTS",
      what: `case ${at.artifact} has the guarded identifier, input and expected result of the existing test ${same.id} but is classed ${one.class ?? "unclassed"}`,
      fix: `class it duplicate of ${same.id}` }));
  });
  return findings;
}

// ---------------------------------------------------------------- the run of a `run-tests` job (ITM-586)

const OCCASIONS = { commit: "every commit", "pull-request": "pull request", nightly: "nightly", "release-candidate": "release candidate", "on-demand": "on demand" };

class RunError extends Error {
  constructor(name, message) {
    super(message);
    this.name = name;
  }
}

// The commit, the occasion and the levels a job runs: the commit of the candidate the job was queued for, else `params.commit`; the occasion `params.occasion`, else the release candidate's for a job with
// a candidate, else on demand; the levels `params.levels`, else for a release candidate every row of the schedule, else those (not the cross-cutting row `paid`) the schedule ticks for the occasion.
async function runOf(context) {
  const params = context.params ?? {};
  const commit = params.candidate?.commit ?? params.commit;
  if (typeof commit !== "string" || commit === "") throw new RunError("NoCommit", "the job names no commit to run the tests on");
  const occasion = Object.hasOwn(OCCASIONS, params.occasion) ? params.occasion : params.candidate ? "release-candidate" : "on-demand";
  const schedule = await scheduleOf(context.product.snapshot);
  const levels = Array.isArray(params.levels) ? params.levels
    : (schedule.sections.find((section) => section.heading === "## Levels")?.rows ?? []).map(({ cells }) => cells.Row)
      .filter((row) => occasion === "release-candidate" || (row !== "paid" && occasionsOf(row, schedule).includes(OCCASIONS[occasion])));
  return { commit, occasion, levels, command: schedule.fields.command ?? null };
}

/**
 * The recipe commit-and-levels(context, params) -> Part[] — one required part: the commit, the levels to run on it and the command the product's schedule names (the tests run with node's own test runner where it names none).
 */
async function commitAndLevels(context) {
  const { commit, levels, command } = await runOf(context);
  const text = [`The commit: ${commit}`, `The levels to run on it: ${levels.join(", ")}`,
    `The command: ${command ?? "none named: the tests run with node's own test runner"}`].join("\n");
  return [{ name: "commit-and-levels", text, sources: [], required: true, artifacts: [] }];
}

const pad = (number) => String(number).padStart(2, "0");
const stamp = (now) => `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}`;
const clock = (now) => `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}`;

/**
 * The writer result-record(result, context) -> WriteOutcome — appends the record of the run the job made to the branch test-results of the product, through appendResult: its commit, levels and occasion as the
 * recipe named them, the job's drafter (else the person) as participant, the context's `now` as date, and the draft's outcomes as the rows of `## Outcomes`. An outcome without a level is refused, `OutcomeWithoutLevel`,
 * and nothing is committed. Fails as appendResult fails.
 */
async function resultRecord(result, context) {
  const { commit, occasion, levels } = await runOf(context);
  const outcomes = listOf(result.draft?.outcomes);
  const stray = outcomes.find((one) => blank(one.level));
  if (stray) throw new RunError("OutcomeWithoutLevel", `the outcome of ${stray.test} names no level, which the record's row requires`);
  const participant = result.drafter?.name ?? context.person;
  const { now } = context;
  const path = `runs/${commit}/${stamp(now)}-${clock(now)}-${occasion}-${[...crypto.getRandomValues(new Uint8Array(2))].map((byte) => byte.toString(16).padStart(2, "0")).join("")}.md`;
  const text = ["---", `commit: ${commit}`, "levels:", ...levels.filter((level) => level !== "paid").map((level) => `  - ${level}`), `occasion: ${occasion}`, `participant: ${participant}`,
    `date: ${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())} UTC`, "---",
    "## Outcomes", "", "| Test | Level | Outcome | Runs |", "|---|---|---|---|", ...outcomes.map((one) => `| ${one.test} | ${one.level} | ${one.outcome} |  |`), ""].join("\n");
  const { commit: committed } = await appendResult(context.product.host, readDocument(resultSchema.run, path, text));
  return { commits: [committed], files: [path], pullRequest: null, shown: null, notes: [] };
}

// resultStrategies: MOD-job-runner's Partial<Strategies> with the recipes, the check and the writer.
export const resultStrategies = { recipes: { "test-selection": testSelection, "commit-and-levels": commitAndLevels }, checks: { "test-proposals": testProposals }, writers: { "result-record": resultRecord } };
