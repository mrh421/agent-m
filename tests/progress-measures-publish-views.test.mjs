// MOD-progress-measures' publishOverview and storedView for the views of the routes progress and backlog (ITM-1260), as the accepted text of
// docs/architecture/MOD-progress-measures.md states them: "`publishOverview(host, snapshot, facts)` — adds `<commit>.json`, `<commit>.progress.json.gz` and
// `<commit>.backlog.json.gz` to the branch `overview-cache` in one commit by `commitFiles`, on the head it read … A file the branch holds already is left as it is; `written` is
// `false` when it holds all three. A commit that adds any also writes `latest.json` naming the snapshot's commit"; and "`storedView(snapshot, page)` — the page's view of the
// snapshot's commit, read with the snapshot's `readOn` in one request, and `asOf` null; while that is not stored yet, the view of the commit `latest.json` names, in two requests
// more, and `asOf` that commit … `null` without `readOn`, or where neither is stored or one holds another format".
// Run: node --test tests/progress-measures-publish-views.test.mjs
//
// Module: MOD-progress-measures
// Guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// Level: unit
//
// The facts are those of tests/progress-measures-facts.mjs, every field unread or empty; the host is a fake of this file's own that records each commitFiles, and the snapshots'
// readOn serve the files the test gives, counted. Where the texts leave a reading open, the test states the one it takes: the module file names three files of the commit in
// publishOverview's entry, and scheduleView's entry adds the fourth, the schedule's view, "in the same commit as the other views" (ITM-1265) — the commit holds the four files of
// the commit and latest.json, and `written` is false where the branch holds all four. Each test states its input and its expected result before it runs (given / input / expect).

import test from "node:test";
import assert from "node:assert/strict";
import { gunzipSync, gzipSync } from "node:zlib";
import * as measures from "../src/progress-measures/index.mjs";
import { COMMIT, facts } from "./progress-measures-facts.mjs";

const C0 = "0c".repeat(20);
const BRANCH_HEAD = "0".repeat(40);
const VIEWS = [`${COMMIT}.json`, `${COMMIT}.progress.json.gz`, `${COMMIT}.backlog.json.gz`, `${COMMIT}.schedule.json.gz`];

function hostOver(paths) {
  const commits = [];
  return { commits, readSnapshot: async () => ({ commit: BRANCH_HEAD, paths }), commitFiles: async (change) => { commits.push(change); return { commit: "9".repeat(40), url: "" }; } };
}
const snapshot = { commit: COMMIT, paths: [], blob: () => null, read: async () => null };
const fileOf = (commits, path) => commits[0].files.find((file) => file.path === path);

// TST-1260011 · level: unit · module: MOD-progress-measures
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: facts with every field unread or empty at the commit ccc…c; a branch overview-cache that holds nothing for it, and one that holds all four of its files
// input: publishOverview(host, snapshot, facts) to each
// expect: the first: { written: true }, one commit on overview-cache at the head it read holding exactly ccc…c.json, ccc…c.progress.json.gz, ccc…c.backlog.json.gz, ccc…c.schedule.json.gz (ITM-1265) and latest.json, the two views gzipped JSON equal to progressView and backlogView of the facts, latest.json naming ccc…c; the second: { written: false } and no commit
test("publishOverview adds the overview and the views of the commit and latest.json in one commit, and nothing where the branch holds all four", async () => {
  const given = facts();
  const empty = hostOver([]);
  assert.deepEqual(await measures.publishOverview(empty, snapshot, given), { commit: COMMIT, written: true });
  assert.equal(empty.commits.length, 1);
  assert.deepEqual([empty.commits[0].branch, empty.commits[0].expectedHead], ["overview-cache", BRANCH_HEAD]);
  assert.deepEqual(empty.commits[0].files.map((file) => file.path).sort(), [...VIEWS, "latest.json"].sort());
  const unzip = (path) => JSON.parse(gunzipSync(Buffer.from(fileOf(empty.commits, path).bytes)).toString("utf8"));
  assert.deepEqual(unzip(`${COMMIT}.progress.json.gz`), JSON.parse(JSON.stringify(measures.progressView(given, new Date()))));
  assert.deepEqual(unzip(`${COMMIT}.backlog.json.gz`), JSON.parse(JSON.stringify(measures.backlogView(given, new Date()))));
  assert.equal(JSON.parse(fileOf(empty.commits, "latest.json").text).commit, COMMIT);
  const full = hostOver(VIEWS);
  assert.deepEqual(await measures.publishOverview(full, snapshot, given), { commit: COMMIT, written: false });
  assert.deepEqual(full.commits, []);
});

// A snapshot of ccc…c whose readOn serves `held` — by path on overview-cache, a view's bytes with { bytes: true } —, counted; a missing file is null.
function served(held) {
  const asked = [];
  return { asked, snapshot: { commit: COMMIT, paths: [], blob: () => null, read: async () => null,
    readOn: async (branch, path, options) => { asked.push([branch, path, options?.bytes === true]); return branch === "overview-cache" && Object.hasOwn(held, path) ? held[path] : null; } } };
}
const zipped = (value) => new Uint8Array(gzipSync(JSON.stringify(value)));

// TST-1260012 · level: unit · module: MOD-progress-measures
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: overview-cache holding ccc…c's progress view; one holding no view of ccc…c, latest.json naming 0c0c…0c and 0c0c…0c's progress view; one holding nothing; and one whose ccc…c backlog view is JSON of another format (no rows), with no latest.json
// input: storedView(snapshot, "progress") on the first three, storedView(snapshot, "backlog") on the last
// expect: the first: the view and asOf null, by one readOn of ccc…c.progress.json.gz as bytes; the second: 0c0c…0c's view and asOf 0c0c…0c, by three readOns — ccc…c's view, latest.json, 0c0c…0c's view —; the third: null; the last: null
test("storedView reads the head's view in one request, the view latest.json names in three, and null where none is stored or one holds another format", async () => {
  const own = { commit: COMMIT, teams: [{ team: "team1", sprint: null }] };
  const head = served({ [`${COMMIT}.progress.json.gz`]: zipped(own) });
  assert.deepEqual(await measures.storedView(head.snapshot, "progress"), { view: own, asOf: null });
  assert.deepEqual(head.asked, [["overview-cache", `${COMMIT}.progress.json.gz`, true]]);

  const older = { commit: C0, teams: [] };
  const last = served({ "latest.json": `${JSON.stringify({ commit: C0 })}\n`, [`${C0}.progress.json.gz`]: zipped(older) });
  assert.deepEqual(await measures.storedView(last.snapshot, "progress"), { view: older, asOf: C0 });
  assert.deepEqual(last.asked.map(([, path]) => path), [`${COMMIT}.progress.json.gz`, "latest.json", `${C0}.progress.json.gz`]);

  assert.equal(await measures.storedView(served({}).snapshot, "progress"), null);
  assert.equal(await measures.storedView(served({ [`${COMMIT}.backlog.json.gz`]: zipped({ commit: COMMIT, teams: [] }) }).snapshot, "backlog"), null,
    "a view of another format is none");
});
