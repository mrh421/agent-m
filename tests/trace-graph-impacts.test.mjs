// MOD-trace-graph's stored impact lists (ITM-939), as the accepted text of docs/architecture/MOD-trace-graph.md states it: publishGraph —
// "With `changed`, the decision and module files of the commit that are not accepted, each with the text it was last accepted at and that
// text's commit (`null` for a file never accepted), as the caller reads them, it adds `<commit>.impacts.json` in the same commit: for each
// file, its path, its blob at the commit, `before`'s commit, and `architectureImpact(graph, [{ path, before: before.text, after }])`";
// storedImpacts — "the impact lists stored for `commit` by `publishGraph`, keyed by path, read with the source's `readOn` in one request;
// `null` without `readOn`, or when the branch or the file is missing or holds another format."
// Run: node --test tests/trace-graph-impacts.test.mjs
//
// Module: MOD-trace-graph
// Guards: AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// Level: unit
//
// Deterministic, nothing reaches the network: the host is a fake of MOD-repository-hosts' Host with readSnapshot and commitFiles, holding the
// branch trace-cache in memory; the snapshot is a small repository whose module MOD-doer changed since it was accepted (it has lost the
// interface `gone`, which MOD-user uses) and whose module MOD-fresh was never accepted. Each test states its expected results in its own text.

import test from "node:test";
import assert from "node:assert/strict";
import * as trace from "../src/trace-graph/index.mjs";
import { gunzipped } from "../src/trace-graph/stored.mjs";
import { blobSha } from "../src/text-tools/index.mjs";

const COMMIT = "abcdef00abcdef00abcdef00abcdef00abcdef00";
const EARLIER = "0123456789abcdef0123456789abcdef01234567";
const HEAD = "1111111111111111111111111111111111111111";
const DOER = "docs/architecture/MOD-doer.md";
const FRESH = "docs/architecture/MOD-fresh.md";

const moduleText = (id, folder, provides, uses = []) => ["---", `id: ${id}`, `title: ${id}`, `folder: ${folder}`, "realises:", "  - A THING IS DONE",
  "uses:", ...uses.map((name) => `  - ${name}`), "provides:", ...provides.map((name) => `  - ${name}`), "---", `# ${id}`, ""].join("\n");

const DOER_BEFORE = moduleText("MOD-doer", "src/doer/", ["doIt", "gone"]);
const FILES = {
  "SPEC.md": "# Spec\n\n**A THING IS DONE** *(Product Owner)*\n\nIt is done.\n*Check:* no automatic check; at review.\n",
  [DOER]: moduleText("MOD-doer", "src/doer/", ["doIt"]),
  [FRESH]: moduleText("MOD-fresh", "src/fresh/", ["fresh"]),
  "docs/architecture/MOD-user.md": moduleText("MOD-user", "src/user/", ["use"], ["MOD-doer.gone"]),
  "tests/doer.test.mjs": "// TST-1 \n// level: unit\n// module: MOD-doer\n// guards: A THING IS DONE\n",
  "docs/backlog/ITM-001-do-it.md": "---\nid: ITM-001\ntitle: Do it\nlevel: unit\nrealises:\n  - A THING IS DONE\nmodules:\n  - MOD-doer\ntests:\n  - unit\n---\n# ITM-001 Do it\n",
  "src/doer/index.mjs": "export const doIt = () => 1;\n",
};
const snapshot = { commit: COMMIT, paths: Object.keys(FILES), read: async (path) => FILES[path] ?? null, readMany: async () => {}, blob: () => null };
const CHANGED = [{ path: DOER, before: { commit: EARLIER, text: DOER_BEFORE } }, { path: FRESH, before: null }];

// A fake host holding the branch trace-cache: `held` maps the files it has to their texts.
function fakeHost() {
  const state = { held: {}, head: HEAD, commits: [] };
  return { state, host: {
    async readSnapshot() { return { commit: state.head, paths: Object.keys(state.held), read: async (path) => state.held[path] ?? null, readMany: async () => {}, blob: () => null }; },
    async commitFiles(change) {
      state.commits.push(change);
      for (const file of change.files) state.held[file.path] = file.bytes ?? file.text;
      state.head = "2222222222222222222222222222222222222222";
      return { commit: state.head, url: "https://example.test/commit" };
    },
  } };
}

// A TextSource over the files the branch holds, which records its readOn calls; `answer` replaces what readOn answers when given.
function branchSource(held, answer) {
  const calls = { read: [], readMany: [], readOn: [] };
  const own = { paths: [], async read(path) { calls.read.push(path); return null; }, async readMany(paths) { calls.readMany.push(paths); },
    async readOn(branch, path) { calls.readOn.push([branch, path]); return answer !== undefined ? answer : branch === "trace-cache" ? held[path] ?? null : null; } };
  return { source: own, calls };
}

// TST-939001 · level: unit · module: MOD-trace-graph
// guards: AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST
// given: a fake host whose branch trace-cache holds no file of the commit; the small repository, whose MOD-doer is changed (accepted before with the interface `gone`, which MOD-user uses) and whose MOD-fresh was never accepted
// input: publishGraph(host, snapshot, changed) with changed = MOD-doer with its accepted text and commit, and MOD-fresh with null; then storedImpacts of a source over the branch, for the commit
// expect: { commit, written: true }; one commitFiles whose files are "<commit>.json.gz", "<commit>.impacts.json" and latest.json (TST-1302015); storedImpacts gives, keyed by the two paths in that order, { blob: the blob SHA of the file at the commit, before: the accepted commit or null, impact: architectureImpact of the graph for [{ path, before: the accepted text or null, after: the file's text }] }; MOD-doer's impact marks MOD-user as breaking ("uses an interface that is removed"); the same impact computed without the before-text is another list
test("publishGraph with changed adds the impact lists beside the graph, each the architectureImpact of its file with the text it was accepted at", async () => {
  const { host, state } = fakeHost();
  assert.deepEqual(await trace.publishGraph(host, snapshot, CHANGED), { commit: COMMIT, written: true });
  assert.equal(state.commits.length, 1);
  assert.deepEqual(state.commits[0].files.map((file) => file.path), [`${COMMIT}.json.gz`, `${COMMIT}.gaps.json`, `${COMMIT}.references.json.gz`, `${COMMIT}.impacts.json`, "latest.json"]);
  const graph = await trace.traceGraph({ paths: snapshot.paths, read: snapshot.read }, { commit: COMMIT });
  const stored = await trace.storedImpacts(branchSource(state.held).source, COMMIT);
  assert.deepEqual([...stored.keys()], [DOER, FRESH]);
  const want = async (path, before) => ({ blob: await blobSha(FILES[path]), before: before?.commit ?? null,
    impact: trace.architectureImpact(graph, [{ path, before: before?.text ?? null, after: FILES[path] }]) });
  assert.deepEqual(stored.get(DOER), await want(DOER, CHANGED[0].before));
  assert.deepEqual(stored.get(FRESH), await want(FRESH, null));
  assert.deepEqual(stored.get(DOER).impact.modules.find((entry) => entry.id === "MOD-user"), { id: "MOD-user", why: "uses an interface that is removed", breaks: true });
  const without = trace.architectureImpact(graph, [{ path: DOER, before: null, after: FILES[DOER] }]);
  assert.notDeepEqual(stored.get(DOER).impact, without, "counter-proof: the list computed without the before-text is another list");
});

// TST-939002 · level: unit · module: MOD-trace-graph
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the branch trace-cache after the publishGraph of TST-939001
// input: storedImpacts(source, commit) with a source whose readOn serves the branch
// expect: a Map of two entries; readOn called once, with ("trace-cache", "<commit>.impacts.json"); no read and no readMany
test("storedImpacts reads the stored lists in one readOn", async () => {
  const { host, state } = fakeHost();
  await trace.publishGraph(host, snapshot, CHANGED);
  const { source, calls } = branchSource(state.held);
  const stored = await trace.storedImpacts(source, COMMIT);
  assert.equal(stored.size, 2);
  assert.deepEqual(calls.readOn, [["trace-cache", `${COMMIT}.impacts.json`]]);
  assert.deepEqual([calls.read, calls.readMany], [[], []]);
});

// TST-939003 · level: unit · module: MOD-trace-graph
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the stored lists of TST-939002, and these sources: (a) no readOn; (b) readOn answering null (no branch or no file); (c) readOn answering a text that is no JSON; (d) readOn answering "{}"; (e) readOn answering the text of the commit's graph file, gunzipped
// input: storedImpacts(each source, commit)
// expect: null for each of the five; and, as the known positive, a Map of two entries for the source that serves the stored text
test("storedImpacts gives null without readOn, for a missing branch or file, and for another format", async () => {
  const { host, state } = fakeHost();
  await trace.publishGraph(host, snapshot, CHANGED);
  assert.equal((await trace.storedImpacts(branchSource(state.held).source, COMMIT)).size, 2, "known positive");
  const { source: noReadOn } = branchSource(state.held);
  delete noReadOn.readOn;
  assert.equal(await trace.storedImpacts(noReadOn, COMMIT), null, "(a) no readOn");
  const other = { "(b) missing": null, "(c) no JSON": "not json", "(d) {}": "{}", "(e) the graph file": await gunzipped(state.held[`${COMMIT}.json.gz`]) };
  for (const [name, answer] of Object.entries(other)) assert.equal(await trace.storedImpacts(branchSource(state.held, answer).source, COMMIT), null, name);
});
