// MOD-site-frame: the page harness counts a read of the tree's folders as MOD-repository-hosts' readSnapshot with `folders` sends it: "the tree of each named folder and the entries of each folder that holds a named
// file", sent together. Tree requests of one commit that are in flight together are one `folders` read; a second round, sent after the first has answered, is a read of its own, so that
// tests/load-per-view.test.mjs, which counts `folders`, sees a page that reads the tree twice.
// Run: node --test tests/site-frame-harness-folder-rounds.test.mjs
//
// Module: MOD-site-frame
// Guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// Level: unit
//
// The harness's fake GitHub is asked directly, with the requests readSnapshot sends: "git/trees/<commit>:<folder>" with recursive=1, and the entries of a folder without it. The counter-proof is recorded in the pull
// request: the harness before the change counts one `folders` read for the two rounds of the second test.

import test from "node:test";
import assert from "node:assert/strict";
import { repoServer, REPO } from "./app-harness.mjs";

const FILES = { "docs/a.md": "a\n", "docs/b/c.md": "c\n", "src/x.mjs": "x\n" };
const tree = (server, path, recursive) => server.fetch(`https://api.github.com/repos/${REPO}/git/trees/${server.head}:${path}${recursive ? "?recursive=1" : ""}`);
const foldersOf = (server) => server.requests.filter((request) => request === "folders").length;

// TST-1347001 · level: unit · module: MOD-site-frame
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: a fake GitHub holding three files in docs and src, and one commit
// input: three tree requests of that commit sent together: the tree of docs, the tree of src, and the entries of docs
// expect: one `folders` read in all, naming the three requests (docs, src, docs/), and every request answered with the files below its path
test("tree requests of one commit sent together are one folders read", async () => {
  const server = await repoServer({ files: FILES });
  const answers = await Promise.all([tree(server, "docs", true), tree(server, "src", true), tree(server, "docs", false)]);
  assert.deepEqual(answers.map((answer) => answer.status), [200, 200, 200]);
  assert.equal(foldersOf(server), 1);
  assert.deepEqual(server.folders, [["docs", "src", "docs/"]]);
  assert.deepEqual((await answers[0].json()).tree.map((entry) => entry.path), ["a.md", "b/c.md"]);
});

// TST-1347002 · level: unit · module: MOD-site-frame
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: a fake GitHub holding three files in docs and src, and one commit
// input: the tree of docs and the tree of src, sent together; and, once both have answered, the tree of docs again
// expect: two `folders` reads in all: the first naming docs and src, the second naming docs
test("a second round of tree requests, sent after the first has answered, is a folders read of its own", async () => {
  const server = await repoServer({ files: FILES });
  await Promise.all([tree(server, "docs", true), tree(server, "src", true)]);
  assert.equal(foldersOf(server), 1, "the first round alone is one read");
  await tree(server, "docs", true);
  assert.equal(foldersOf(server), 2);
  assert.deepEqual(server.folders, [["docs", "src"], ["docs"]]);
});

// TST-1347003 · level: unit · module: MOD-site-frame
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: a fake GitHub holding three files in docs and src, and one commit
// input: the tree of docs and, sent together with it, a request of another kind (the commit's information); then, once both have answered, the tree of src
// expect: two `folders` reads: a request of another kind sent together with a tree request does not split the read, and the request after the answer opens a second
test("a request of another kind sent together with the tree requests does not split the read", async () => {
  const server = await repoServer({ files: FILES });
  await Promise.all([tree(server, "docs", true), server.fetch(`https://api.github.com/repos/${REPO}/commits/main`), tree(server, "src", true)]);
  assert.equal(foldersOf(server), 1);
  assert.deepEqual(server.folders, [["docs", "src"]]);
  await tree(server, "src", true);
  assert.equal(foldersOf(server), 2);
});
