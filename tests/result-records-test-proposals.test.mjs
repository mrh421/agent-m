// MOD-result-records' check `test-proposals` of `resultStrategies`, its use for the kind `propose-tests` (ITM-753), as the accepted text of docs/architecture/MOD-result-records.md states it:
// "an error finding for a case without an expected result, a model-dependent case judged on a single run, ... a case that guards nothing; a case with the same guarded identifier, input and
// expected result as an existing test is classed a duplicate, whatever the participant said." For UC-026 step 6. The error for a commit-level case that reaches a paid service is ITM-851.
// Run: node --test tests/result-records-test-proposals.test.mjs
//
// Module: MOD-result-records
// Guards: UC-026; TEST GENERATION SEES THE EXISTING TESTS; A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS; A MODEL-DEPENDENT TEST IS MEASURED AS A RATE; EVERY ARTIFACT HAS AN IDENTIFIER
// Level: unit
//
// Where the file leaves a reading open, the tests state the one they take, and the pull request names it:
//   - The draft is the answer of `propose-tests`: `{ cases: [{ identifier, level, guards, precondition, input, expected, class, of?, phrasings?, runs? }] }`.
//   - A model-dependent case is one that carries `phrasings`; it is judged on a single run when `runs` is absent or below 2 (the rule MOD-test-document's `testFindings` reads).
//   - A case that guards nothing has an empty `guards`; its rule is EVERY ARTIFACT NAMES ITS ORIGIN, as `testFindings` states it for a test that guards nothing.
//   - The existing tests are the declarations of the test files in the product's snapshot. "The same guarded identifier" is: the case and the existing test share one guarded name.
//     Input and expected result are the same when equal after trimming and collapsing white space and ignoring case.
//   - A case so found that its participant did not class `duplicate` gets an error finding under TEST GENERATION SEES THE EXISTING TESTS, naming the existing test; the finding's `line` is the
//     case's position in `cases`, from 1, and its `artifact` the case's identifier. A case already classed `duplicate` gets none.
//   - Each case carries a `TST-` identifier (UC-026 step 5): one of the scheme `TST-<number>` that no existing test of the product declares and no other case of the proposal carries. A case
//     without one gets an error under EVERY ARTIFACT HAS AN IDENTIFIER, its `artifact` its identifier, or `case <n>` where it has none.
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { resultStrategies } from "../src/result-records/index.mjs";

const check = (draft, files = FILES) => resultStrategies.checks["test-proposals"](draft, contextOf(files));

const ROUND = [
  "// TST-901 · level: unit · module: MOD-widgets", "// guards: A SELECTED RULE", "// given: a widget", "// input: its shape", "// expect: round",
  "test(\"widget one is round\", () => { checkRound(1); });", "",
].join("\n");
const FILES = { "tests/round.test.mjs": ROUND, "src/widget.mjs": "export const round = true;\n" };
const snapshotOf = (files) => ({ paths: Object.keys(files), read: async (path) => (Object.hasOwn(files, path) ? files[path] : null) });
const contextOf = (files) => ({ kind: null, params: {},
  product: { address: "https://github.com/acme/product", snapshot: snapshotOf(files), host: null },
  instance: { snapshot: snapshotOf({}), host: null, checkout: null }, connect: async () => null, participants: [], places: { sources: {}, mailbox: null },
  gates: [], person: "alice", now: new Date("2026-10-18T08:00:00Z"), agentM: { version: "unreleased", commit: "a".repeat(40) }, jobId: null });
const CASE = { identifier: "TST-910", level: "unit", guards: ["ANOTHER RULE"], precondition: "a gadget", input: "its colour", expected: "blue", class: "new" };
const rules = (findings) => findings.map((found) => [found.artifact, found.line, found.kind, found.rule]);

// TST-753101 · level: unit · module: MOD-result-records
// guards: A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS; UC-026
// given: a proposal of three cases: a clean one, one whose expected result is missing and one whose expected result is blank
// input: the check test-proposals on the proposal
// expect: two error findings, for the second case (line 2) and the third (line 3), each under A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS, with the case's identifier as artifact and a fix; none for the first
test("test-proposals — a case without an expected result is an error under A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS", async () => {
  const { expected, ...missing } = { ...CASE, identifier: "TST-911" };
  const found = await check({ cases: [CASE, missing, { ...CASE, identifier: "TST-912", expected: "  " }] });
  const RULE = "A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS";
  assert.deepEqual(rules(found), [["TST-911", 2, "error", RULE], ["TST-912", 3, "error", RULE]]);
  assert.match(found[0].what, /expected result/);
  assert.notEqual(found[0].fix, "");
});

// TST-753102 · level: unit · module: MOD-result-records
// guards: A MODEL-DEPENDENT TEST IS MEASURED AS A RATE; UC-026
// given: a proposal of four cases with phrasings: one with runs 5, one with runs 1, one with no runs, and one without phrasings and without runs (deterministic)
// input: the check test-proposals on the proposal
// expect: two error findings under A MODEL-DEPENDENT TEST IS MEASURED AS A RATE, for the case with runs 1 (line 2) and the case with no runs (line 3); none for the case with runs 5 or the deterministic case
test("test-proposals — a model-dependent case judged on a single run is an error under A MODEL-DEPENDENT TEST IS MEASURED AS A RATE", async () => {
  const model = { ...CASE, phrasings: ["Is it blue?", "What colour is it?"] };
  const found = await check({ cases: [{ ...model, identifier: "TST-921", runs: 5 }, { ...model, identifier: "TST-922", runs: 1 }, { ...model, identifier: "TST-923" },
    { ...CASE, identifier: "TST-924" }] });
  const RULE = "A MODEL-DEPENDENT TEST IS MEASURED AS A RATE";
  assert.deepEqual(rules(found), [["TST-922", 2, "error", RULE], ["TST-923", 3, "error", RULE]]);
});

// TST-753103 · level: unit · module: MOD-result-records
// guards: EVERY ARTIFACT NAMES ITS ORIGIN; UC-026
// given: a proposal of two cases: one whose guards is empty and one that guards a name
// input: the check test-proposals on the proposal
// expect: one error finding under EVERY ARTIFACT NAMES ITS ORIGIN, for the case with empty guards (line 1); none for the other
test("test-proposals — a case that guards nothing is an error", async () => {
  const found = await check({ cases: [{ ...CASE, identifier: "TST-931", guards: [] }, { ...CASE, identifier: "TST-932" }] });
  assert.deepEqual(rules(found), [["TST-931", 1, "error", "EVERY ARTIFACT NAMES ITS ORIGIN"]]);
});

// TST-753104 · level: unit · module: MOD-result-records
// guards: TEST GENERATION SEES THE EXISTING TESTS; UC-026
// given: an existing test TST-901 guarding A SELECTED RULE, input "its shape", expect "round"; a proposal of six cases: (1) class new with the same guard, input and expected result (input in other case and spacing), (2) class duplicate with the same, (3) class new with the same guard and input but expected "square", (4) class new with the same input and expected result but guarding ANOTHER RULE, (5) class extends with the same guard, input and expected result, (6) class new with the same guard and expected result but another input
// input: the check test-proposals on the proposal
// expect: error findings under TEST GENERATION SEES THE EXISTING TESTS for case 1 (line 1) and case 5 (line 5), each naming TST-901 in what or fix; none for cases 2, 3, 4 and 6
test("test-proposals — a case equal to an existing test in guard, input and expected result is reclassified a duplicate, whatever its participant said", async () => {
  const same = { ...CASE, guards: ["A SELECTED RULE"], input: "its shape", expected: "round" };
  const found = await check({ cases: [
    { ...same, identifier: "TST-941", input: "Its   SHAPE" },
    { ...same, identifier: "TST-942", class: "duplicate", of: "TST-901" },
    { ...same, identifier: "TST-943", expected: "square" },
    { ...same, identifier: "TST-944", guards: ["ANOTHER RULE"] },
    { ...same, identifier: "TST-945", class: "extends", of: "TST-901" },
    { ...same, identifier: "TST-946", input: "its colour" },
  ] });
  const RULE = "TEST GENERATION SEES THE EXISTING TESTS";
  assert.deepEqual(rules(found), [["TST-941", 1, "error", RULE], ["TST-945", 5, "error", RULE]]);
  assert.match(`${found[0].what} ${found[0].fix}`, /TST-901/);
});

// TST-753105 · level: unit · module: MOD-result-records
// guards: UC-026; A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS
// given: the product of the other tests, with an existing test, and a clean proposal: a deterministic new case, a model-dependent case with 5 runs, and a duplicate classed duplicate; and, as the known positive, the same proposal with one expected result removed
// input: the check test-proposals on each
// expect: no finding for the clean proposal; one finding for the proposal with the expected result removed; no finding for a draft with no cases
test("test-proposals — a clean proposal gives no finding", async () => {
  const clean = { cases: [CASE, { ...CASE, identifier: "TST-951", phrasings: ["a", "b"], runs: 5 },
    { ...CASE, identifier: "TST-952", guards: ["A SELECTED RULE"], input: "its shape", expected: "round", class: "duplicate", of: "TST-901" }] };
  assert.deepEqual(await check(clean), []);
  assert.equal((await check({ cases: [{ ...CASE, expected: "" }] })).length, 1);
  assert.deepEqual(await check({ cases: [] }), []);
});

// TST-1425002 · level: unit · module: MOD-result-records
// guards: EVERY ARTIFACT HAS AN IDENTIFIER; UC-026
// given: the product of the other tests, whose existing test is TST-901, and a proposal of six otherwise clean cases: TST-960, case-1, one with no identifier, TST-901, and TST-961 twice
// input: the check test-proposals on the proposal
// expect: known positive — no finding for TST-960 (line 1); one error under EVERY ARTIFACT HAS AN IDENTIFIER for each other case, by its line: case-1 (line 2) and the case with none (line 3, artifact "case 3"), not of the scheme TST-<number>; TST-901 (line 4), the identifier of the existing test TST-901; each TST-961 (lines 5 and 6), the identifier of another case; each naming its identifier or its case in what
test("TST-1425002: test-proposals — a case without a TST- identifier, or with one another test or case has, is an error", async () => {
  const { identifier, ...unnamed } = CASE;
  const found = await check({ cases: [{ ...CASE, identifier: "TST-960" }, { ...CASE, identifier: "case-1" }, unnamed, { ...CASE, identifier: "TST-901" },
    { ...CASE, identifier: "TST-961" }, { ...CASE, identifier: "TST-961" }] });
  const RULE = "EVERY ARTIFACT HAS AN IDENTIFIER";
  assert.deepEqual(rules(found), [["case-1", 2, "error", RULE], ["case 3", 3, "error", RULE], ["TST-901", 4, "error", RULE], ["TST-961", 5, "error", RULE], ["TST-961", 6, "error", RULE]]);
  assert.match(found[0].what, /case-1/);
  assert.match(found[1].what, /case 3/);
  assert.match(found[2].what, /TST-901/);
  assert.match(found[3].what, /TST-961/);
  for (const one of found) assert.notEqual(one.fix, "");
});
