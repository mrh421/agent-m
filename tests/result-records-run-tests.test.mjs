// MOD-result-records' recipe `commit-and-levels` and writer `result-record` of `resultStrategies` (ITM-586), as the accepted text of docs/architecture/MOD-result-records.md states them
// (:138 "the commit and the levels to run on it, with the commands the product's schedule names"; :150 "appends the record of the run the job made, through `appendResult`"), for the
// kind `run-tests` of a release candidate (UC-013 step 2 and its second postcondition: the complete suite at every level on exactly that commit, its result record on the branch `test-results`).
// Run: node --test tests/result-records-run-tests.test.mjs
//
// Module: MOD-result-records
// Guards: EVERY TEST RUN LEAVES A RESULT RECORD; TEST RESULTS ARE KEPT IN THE REPOSITORY; A RESULT RECORD IS NEVER REWRITTEN; A RELEASE RUNS EVERY TEST AT EVERY LEVEL; UC-013
// Level: unit
//
// Where the file leaves a reading open, the tests state the one they take, and the pull request names it:
//   - The commit is `params.candidate.commit` (what MOD-release-evidence's startReleaseCandidate gives the job) or else `params.commit`; a job with neither is refused, `NoCommit`.
//   - The occasion is `params.occasion` when it is one of the record's five, else `release-candidate` for a job with `params.candidate`, else `on-demand`.
//   - The levels are `params.levels` when given, else for a release candidate every row of the product's docs/tests/schedule.md (the row `paid` included, whatever the row's cells say), else the levels (not the cross-cutting row `paid`) the product's docs/tests/schedule.md — or the book's default where none is saved — ticks for the occasion.
//   - The command is the schedule's front-matter `command`; where it names none the part says the tests run with node's own test runner.
//   - The record's participant is the job's drafter's name, else the person; its `date` the job context's `now`; its path `runs/<commit>/<yyyymmdd>-<hhmm>-<occasion>-<4 hex>.md`; it names no `run` address and no `uncommitted`.
//   - The draft's outcomes become the rows of `## Outcomes` (Test, Level, Outcome, Runs empty). The draft holds no expected or observed result, so no `## Failures` is written. An outcome without a level cannot
//     be a row of a record whose Level is required: the writer refuses it, `OutcomeWithoutLevel`, and commits nothing.
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { resultStrategies, resultsAt, resultSchema } from "../src/result-records/index.mjs";
import { readDocument } from "../src/documents/index.mjs";

const COMMIT = "c".repeat(40);
const recipe = (context) => resultStrategies.recipes["commit-and-levels"](context, context.params);
const write = (result, context) => resultStrategies.writers["result-record"](result, context);
const snapshotOf = (files, commit = "h0") => ({ paths: Object.keys(files), commit, read: async (path) => (Object.hasOwn(files, path) ? files[path] : null),
  blob: (path) => (Object.hasOwn(files, path) ? "b".repeat(40) : null) });
const contextOf = (params, { files = {}, host = null } = {}) => ({ kind: null, params,
  product: { address: "https://github.com/acme/product", snapshot: snapshotOf(files), host },
  instance: { snapshot: snapshotOf({}), host: null, checkout: null }, connect: async () => null, participants: [], places: { sources: {}, mailbox: null },
  gates: [], person: "alice", now: new Date("2026-10-19T08:05:00Z"), agentM: { version: "unreleased", commit: "a".repeat(40) }, jobId: "JOB-20261019-0800-ab12" });
const CANDIDATE = { candidate: { version: "2026.1.0", tag: "v2026.1.0-rc.1", commit: COMMIT } };
const scheduleOf = (front, rows) => `---\nnightly: 02:00\n${front}---\n## Levels\n\n| Row | every commit | pull request | nightly | release candidate | on demand | runs on |\n|---|---|---|---|---|---|---|\n${rows.join("\n")}\n`;
const ROWS = ["| unit | ✓ | ✓ | ✓ | ✓ | ✓ | |", "| component | | ✓ | ✓ | ✓ | ✓ | |", "| system | | | ✓ | ✓ | ✓ | |", "| paid | | | ✓ | ✓ | ✓ | |",
  "| release | | | | ✓ | ✓ | |", "| user | | | | | ✓ | |"];

// A host whose branch `test-results` holds `files`; every commit asked for is kept.
function resultsHost(files = {}) {
  const held = new Map(Object.entries(files)), writes = [];
  let head = "h0";
  return { writes, held, host: {
    async readSnapshot(ref) { if (ref !== "test-results") throw Object.assign(new Error("no branch"), { name: "NotFound" }); return { ...snapshotOf(Object.fromEntries(held), head), ref }; },
    async commitFiles(change) { if (change.expectedHead !== head) throw Object.assign(new Error("moved"), { name: "Moved", head }); writes.push(structuredClone(change));
      for (const file of change.files) held.set(file.path, file.text); head = `h${writes.length}`; return { commit: head, url: "https://example.test/commit" }; },
  } };
}
const OUTCOMES = [{ test: "TST-101", level: "unit", outcome: "passed" }, { test: "TST-102", level: "component", outcome: "failed" }, { test: "TST-103", level: "release", outcome: "not run" }];
const RESULT = { draft: { outcomes: OUTCOMES }, drafter: { name: "runner-a" }, rounds: [], remaining: [], forPerson: [], written: null };

// TST-586101 · level: unit · module: MOD-result-records
// guards: A RELEASE RUNS EVERY TEST AT EVERY LEVEL; UC-013
// given: a release candidate job on commit cccc… of a product with no saved schedule, so the book's default holds
// input: the recipe commit-and-levels
// expect: one required part named commit-and-levels; its text holds the commit, the levels unit, component, system, paid, release and user, and says the tests run with node's own test runner
test("commit-and-levels gives the commit, every row of the default schedule, the row paid included, and the runner", async () => {
  const parts = await recipe(contextOf(CANDIDATE));
  assert.equal(parts.length, 1);
  assert.equal(parts[0].name, "commit-and-levels");
  assert.equal(parts[0].required, true);
  assert.ok(parts[0].text.includes(COMMIT));
  for (const level of ["unit", "component", "system", "paid", "release", "user"]) assert.match(parts[0].text, new RegExp(`\\b${level}\\b`));
  assert.match(parts[0].text, /node's own test runner/);
});

// TST-586102 · level: unit · module: MOD-result-records
// guards: A RELEASE RUNS EVERY TEST AT EVERY LEVEL; UC-013
// given: a product whose docs/tests/schedule.md names the command "make check", and ticks the release candidate column for unit, component, system and release but not for user and paid
// input: the recipe commit-and-levels
// expect: the part's text holds "make check", the levels unit, component, system, paid, release and user (a row whose cell is empty is not left out), and not "node's own test runner"
test("commit-and-levels takes every row of the product's schedule for a candidate, and the command it names", async () => {
  const files = { "docs/tests/schedule.md": scheduleOf("command: make check\n", ROWS) };
  const [part] = await recipe(contextOf(CANDIDATE, { files }));
  assert.match(part.text, /make check/);
  for (const level of ["unit", "component", "system", "paid", "release", "user"]) assert.match(part.text, new RegExp(`\\b${level}\\b`));
  assert.doesNotMatch(part.text, /node's own test runner/);
});

// TST-586103 · level: unit · module: MOD-result-records
// guards: A RELEASE RUNS EVERY TEST AT EVERY LEVEL; UC-013
// given: a job with params.commit = cccc…, params.levels = ["unit"] and no candidate
// input: the recipe commit-and-levels
// expect: the text holds the commit and the level unit and none of component, system, release, user
test("commit-and-levels names the levels the job's parameters give, on the commit they give", async () => {
  const [part] = await recipe(contextOf({ commit: COMMIT, levels: ["unit"] }));
  assert.ok(part.text.includes(COMMIT));
  assert.match(part.text, /\bunit\b/);
  for (const level of ["component", "system", "release", "user"]) assert.doesNotMatch(part.text, new RegExp(`\\b${level}\\b`));
});

// TST-586104 · level: unit · module: MOD-result-records
// guards: A RELEASE RUNS EVERY TEST AT EVERY LEVEL; UC-013
// given: a job whose parameters name no commit
// input: the recipe commit-and-levels
// expect: it rejects with an error named NoCommit
test("commit-and-levels refuses a job that names no commit", async () => {
  await assert.rejects(recipe(contextOf({})), (error) => error.name === "NoCommit");
});

// TST-586105 · level: unit · module: MOD-result-records
// guards: EVERY TEST RUN LEAVES A RESULT RECORD; TEST RESULTS ARE KEPT IN THE REPOSITORY; UC-013
// given: a release candidate job on commit cccc… whose runner runner-a reported three outcomes (unit passed, component failed, release not run); an empty branch test-results at head h0; now 2026-10-19 08:05 UTC
// input: the writer result-record
// expect: one commit on test-results on head h0 adding exactly one file runs/cccc…/20261019-0805-release-candidate-<4 hex>.md; read with the run schema its fields are commit cccc…, levels unit, component, system, release, user (the row paid is no level), occasion release-candidate, participant runner-a, date 2026-10-19 08:05 UTC, no run, no uncommitted; its Outcomes rows are TST-101 unit passed, TST-102 component failed, TST-103 release not run, with Runs empty; the outcome is { commits: [h1], files: [the path], pullRequest: null, shown: null, notes: [] }
test("result-record appends the run's record to test-results on the head it read", async () => {
  const fake = resultsHost();
  const outcome = await write(RESULT, contextOf(CANDIDATE, { host: fake.host }));
  assert.equal(fake.writes.length, 1);
  assert.deepEqual([fake.writes[0].branch, fake.writes[0].expectedHead, fake.writes[0].files.length], ["test-results", "h0", 1]);
  const { path, text } = fake.writes[0].files[0];
  assert.match(path, new RegExp(`^runs/${COMMIT}/20261019-0805-release-candidate-[0-9a-f]{4}\\.md$`));
  assert.deepEqual(outcome, { commits: ["h1"], files: [path], pullRequest: null, shown: null, notes: [] });
  const record = readDocument(resultSchema.run, path, text);
  assert.deepEqual(record.fields, { commit: COMMIT, levels: ["unit", "component", "system", "release", "user"], occasion: "release-candidate", participant: "runner-a", date: "2026-10-19 08:05 UTC" });
  assert.deepEqual(record.sections[0].rows.map(({ cells }) => [cells.Test, cells.Level, cells.Outcome, cells.Runs ?? ""]),
    [["TST-101", "unit", "passed", ""], ["TST-102", "component", "failed", ""], ["TST-103", "release", "not run", ""]]);
});

// TST-1442001 · level: unit · module: MOD-result-records
// guards: A RELEASE RUNS EVERY TEST AT EVERY LEVEL; UC-028
// given: a release candidate job on commit cccc… of a product whose schedule ticks no cell of the release candidate column
// input: the recipe commit-and-levels
// expect: the text names the levels unit, component, system, paid, release and user, each row of the schedule, though no cell of the release candidate column is ticked
test("commit-and-levels names every row of the schedule for a candidate whatever its release candidate column says", async () => {
  const none = ["unit", "component", "system", "paid", "release", "user"].map((row) => `| ${row} | ✓ | | | | | |`);
  const [part] = await recipe(contextOf(CANDIDATE, { files: { "docs/tests/schedule.md": scheduleOf("", none) } }));
  for (const level of ["unit", "component", "system", "paid", "release", "user"]) assert.match(part.text, new RegExp(`\\b${level}\\b`));
});

// TST-1442002 · level: unit · module: MOD-result-records
// guards: A RELEASE RUNS EVERY TEST AT EVERY LEVEL; UC-028
// given: the book's default schedule; jobs on commit cccc… with params.occasion pull-request and nightly, none with a candidate
// input: the recipe commit-and-levels for each
// expect: each text names unit, component and system and none of paid, release, user — the columns name the rows and paid is left out, as before
test("commit-and-levels keeps the rows the columns name for the other occasions", async () => {
  for (const occasion of ["pull-request", "nightly"]) {
    const [part] = await recipe(contextOf({ commit: COMMIT, occasion }));
    for (const level of ["unit", "component", "system"]) assert.match(part.text, new RegExp(`\\b${level}\\b`), occasion);
    for (const level of ["paid", "release", "user"]) assert.doesNotMatch(part.text, new RegExp(`\\b${level}\\b`), occasion);
  }
});

// TST-586106 · level: unit · module: MOD-result-records
// guards: EVERY TEST RUN LEAVES A RESULT RECORD; UC-013
// given: the job and the branch of TST-586105, after the writer ran; the record's declared tests TST-101 unit, TST-102 component, TST-103 release
// input: resultsAt on the branch test-results at commit cccc…, the reading of the release panel and the test pages
// expect: level unit passed 1 failed 0; level component passed 0 failed 1; level release notRun 1 and passed 0 — the levels the record holds, from the one record the writer appended
test("the record the writer appends is the one resultsAt reads for the commit", async () => {
  const fake = resultsHost();
  await write(RESULT, contextOf(CANDIDATE, { host: fake.host }));
  const read = await resultsAt(snapshotOf(Object.fromEntries(fake.held)), COMMIT, [{ id: "TST-101", level: "unit" }, { id: "TST-102", level: "component" }, { id: "TST-103", level: "release" }]);
  const by = Object.fromEntries(read.map((one) => [one.level, [one.passed, one.failed, one.notRun]]));
  assert.deepEqual([by.unit, by.component, by.release], [[1, 0, 0], [0, 1, 0], [0, 0, 1]]);
});

// TST-586107 · level: unit · module: MOD-result-records
// guards: EVERY TEST RUN LEAVES A RESULT RECORD; UC-013
// given: a draft of two outcomes, the second without a level; an empty branch test-results
// input: the writer result-record
// expect: it rejects with an error named OutcomeWithoutLevel, and no commit was asked for
test("result-record refuses an outcome without a level and commits nothing", async () => {
  const fake = resultsHost();
  const draft = { outcomes: [OUTCOMES[0], { test: "stray case", outcome: "undeclared" }] };
  await assert.rejects(write({ ...RESULT, draft }, contextOf(CANDIDATE, { host: fake.host })), (error) => error.name === "OutcomeWithoutLevel");
  assert.equal(fake.writes.length, 0);
});

// TST-586108 · level: unit · module: MOD-result-records
// guards: A RESULT RECORD IS NEVER REWRITTEN; TEST RESULTS ARE KEPT IN THE REPOSITORY; UC-013
// given: a branch test-results that already holds a record of another run on commit cccc…, and a host whose head moves once before the commit
// input: the writer result-record
// expect: the error of the host, Moved, comes through unchanged; the earlier record's bytes are unchanged and no second file was added
test("result-record leaves an earlier record of the commit as it is and passes the host's refusal on", async () => {
  const earlier = `runs/${COMMIT}/20261018-0100-nightly-0000.md`;
  const fake = resultsHost({ [earlier]: "earlier text" });
  const real = fake.host.commitFiles;
  fake.host.commitFiles = async (change) => real({ ...change, expectedHead: "elsewhere" });
  await assert.rejects(write(RESULT, contextOf(CANDIDATE, { host: fake.host })), (error) => error.name === "Moved");
  assert.deepEqual([...fake.held], [[earlier, "earlier text"]]);
});
