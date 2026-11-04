// MOD-progress-measures' scheduleView and the view of the schedule page that publishOverview stores (ITM-1265), as the accepted text of
// docs/architecture/MOD-progress-measures.md states them: "`ScheduleView` — what the route `schedule` shows of one commit's tests: `{ commit: string, counts: { unit: number,
// component: number, system: number, release: number, user: number, paid: number } }`, the number of the test declarations of each level, and of those that call a paid service";
// "`scheduleView(facts: Facts) -> ScheduleView` — the counts of `facts.tests`. Pure; `publishOverview` adds `<commit>.schedule.json.gz` from it, in the same commit as the other
// views, and a file the branch holds already is left as it is"; and, under Data, "`<commit>.schedule.json.gz` … what `scheduleView` gives for the facts of the scope `all` at that
// commit, as JSON, gzipped as the other views".
// Run: node --test tests/progress-measures-schedule-view.test.mjs
//
// Module: MOD-progress-measures
// Guards: THE TEST SCHEDULE IS DECLARED PER PRODUCT; A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-027
// Level: unit
//
// The facts are those of tests/progress-measures-facts.mjs, every field unread or empty but `tests`; the host is a fake of this file's own that records each commitFiles. Nothing
// reaches the network. Where the texts leave a reading open, the test states the one it takes, and the pull request names it:
//   - `written` is `false` when the branch holds every file publishOverview adds, the schedule's view among them: scheduleView's entry gives publishOverview this fourth file "in
//     the same commit as the other views" (MOD-progress-measures.md, Interfaces: scheduleView), where publishOverview's own entry still names three.
//   - A declaration of a level outside the five counts under no level; one that calls no paid service counts under no row at all.
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { gunzipSync } from "node:zlib";
import * as measures from "../src/progress-measures/index.mjs";
import { COMMIT, facts } from "./progress-measures-facts.mjs";

const BRANCH_HEAD = "0".repeat(40);
const SCHEDULE = `${COMMIT}.schedule.json.gz`;
const OTHERS = [`${COMMIT}.json`, `${COMMIT}.progress.json.gz`, `${COMMIT}.backlog.json.gz`];

// A TestDeclaration of MOD-test-document's shape.
const declared = (id, level, paid = null) => ({ id, title: null, level, module: "MOD-sample", guards: ["A SAMPLE REQUIREMENT"], given: "g", input: "i", expect: "e", paid });
// Two unit tests, one system test that calls a paid service, and one release test.
const TESTS = [declared("TST-001", "unit"), declared("TST-002", "unit"), declared("TST-003", "system", "the oracle"), declared("TST-004", "release")];

function hostOver(paths) {
  const commits = [];
  return { commits, readSnapshot: async () => ({ commit: BRANCH_HEAD, paths }), commitFiles: async (change) => { commits.push(change); return { commit: "9".repeat(40), url: "" }; } };
}
const snapshot = { commit: COMMIT, paths: [], blob: () => null, read: async () => null };

// TST-1265001 · level: unit · module: MOD-progress-measures
// guards: THE TEST SCHEDULE IS DECLARED PER PRODUCT; UC-027
// given: facts at the commit ccc…c whose tests hold two unit declarations, one system declaration that calls the paid service "the oracle" and one release declaration; and the same tests with a fifth declaration of the level "integration", which calls no paid service
// input: scheduleView(facts) of each
// expect: both give { commit: "ccc…c", counts: { unit: 2, component: 0, system: 1, release: 1, user: 0, paid: 1 } }: the declaration of the unknown level is counted in no row
test("scheduleView counts the declarations of each level and those that call a paid service, and a declaration of an unknown level in no row", () => {
  const expected = { commit: COMMIT, counts: { unit: 2, component: 0, system: 1, release: 1, user: 0, paid: 1 } };
  assert.deepEqual(measures.scheduleView(facts({ tests: TESTS })), expected);
  const unknown = [...TESTS, declared("TST-005", "integration")];
  assert.equal(unknown.length, 5, "known positive: the fifth declaration is there");
  assert.deepEqual(measures.scheduleView(facts({ tests: unknown })), expected, "counter-proof: an unknown level is counted in no row");
});

// TST-1265002 · level: unit · module: MOD-progress-measures
// guards: THE TEST SCHEDULE IS DECLARED PER PRODUCT; A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-027
// given: the facts of TST-1265001 (four tests); a branch overview-cache that holds nothing for ccc…c; one that holds ccc…c.json and the views of the progress and the backlog but not the schedule's; and one that holds all four files of ccc…c
// input: publishOverview(host, snapshot, facts) to each
// expect: the first: { written: true } by one commit that holds ccc…c.json, ccc…c.progress.json.gz, ccc…c.backlog.json.gz, ccc…c.schedule.json.gz and latest.json, the schedule's file gzipped JSON equal to scheduleView of the facts; the second: { written: true } by one commit that holds ccc…c.schedule.json.gz and latest.json and no other file; the third: { written: false } and no commit
test("publishOverview adds the schedule's view of the commit in its one commit, and leaves it where the branch holds it", async () => {
  const given = facts({ tests: TESTS });
  const empty = hostOver([]);
  assert.deepEqual(await measures.publishOverview(empty, snapshot, given), { commit: COMMIT, written: true });
  assert.equal(empty.commits.length, 1, "one commit");
  assert.deepEqual([empty.commits[0].branch, empty.commits[0].expectedHead], ["overview-cache", BRANCH_HEAD]);
  assert.deepEqual(empty.commits[0].files.map((file) => file.path).sort(), [...OTHERS, SCHEDULE, "latest.json"].sort());
  const file = empty.commits[0].files.find((each) => each.path === SCHEDULE);
  assert.deepEqual(JSON.parse(gunzipSync(Buffer.from(file.bytes)).toString("utf8")),
    { commit: COMMIT, counts: { unit: 2, component: 0, system: 1, release: 1, user: 0, paid: 1 } });

  const three = hostOver(OTHERS);
  assert.deepEqual(await measures.publishOverview(three, snapshot, given), { commit: COMMIT, written: true });
  assert.deepEqual(three.commits.map((commit) => commit.files.map((each) => each.path).sort()), [[SCHEDULE, "latest.json"].sort()]);

  const all = hostOver([...OTHERS, SCHEDULE]);
  assert.deepEqual(await measures.publishOverview(all, snapshot, given), { commit: COMMIT, written: false });
  assert.deepEqual(all.commits, []);
});
