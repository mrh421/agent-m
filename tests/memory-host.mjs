// A host held in memory — the part of MOD-repository-hosts' Host (docs/architecture/MOD-repository-hosts.md, Interfaces) that a
// writer of the review layout calls: repositoryInfo, readSnapshot, readHistory, readFileAt and commitFiles, on one repository whose default branch is
// `main`. readHistory lists, newest first, the commits that added, changed or deleted a path, each a second after the one before it. A commit of all its files together is made only while the branch still stands at the expected head, else it fails with
// Moved { head }. It holds no test and no expected result; the tests that write a product through MOD-approvals, MOD-spec-changes
// and MOD-artifact-edits use it, and so do the Python checks through tests/spec_apply.py. Nothing reaches the network.
//
// Module: MOD-repository-hosts
// Level: unit

import { createHash } from "node:crypto";

// The blob SHA git gives a text: the SHA-1 of "blob <length>\0" and the text's UTF-8 bytes.
const blobOf = (text) => createHash("sha1").update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest("hex");

// memoryHost(files: { path: text }, repository?) -> { host, files(): { path: text } at the head, commits(): the commitFiles calls }.
// repository: the RepositoryAddress the snapshots name, a github.com one by default.
export function memoryHost(files, repository = { server: "github", origin: "https://github.com", path: "memory-owner/memory-repository",
  web: "https://github.com/memory-owner/memory-repository" }) {
  const trees = new Map(), parents = new Map(), dates = new Map(), calls = [];
  let made = 0, head = null;
  const commitOf = (tree) => {
    const sha = createHash("sha1").update(`commit ${++made}`).digest("hex");
    trees.set(sha, tree);
    parents.set(sha, head);
    dates.set(sha, new Date(Date.UTC(2026, 9, 1, 10, 0, made)).toISOString());
    return sha;
  };
  head = commitOf(new Map(Object.entries(files)));
  const snapshot = (commit) => {
    const tree = trees.get(commit);
    return {
      repository, ref: "main", commit, paths: [...tree.keys()].sort(),
      read: async (path) => (tree.has(path) ? tree.get(path) : null),
      readMany: async () => {},
      readOn: async () => null,
      blob: (path) => (tree.has(path) ? blobOf(tree.get(path)) : null),
    };
  };
  const host = {
    repositoryInfo: async () => ({ defaultBranch: "main", canWrite: true }),
    readSnapshot: async (ref) => snapshot(ref === "main" ? head : ref),
    readHistory: async (path, { ref = "main", limit } = {}) => {
      const found = [];
      for (let sha = ref === "main" ? head : ref; sha; sha = parents.get(sha)) {
        const parent = parents.get(sha);
        if (trees.get(sha).get(path) === (parent ? trees.get(parent).get(path) : undefined)) continue;
        found.push({ commit: sha, parents: parent ? [parent] : [], date: dates.get(sha), message: "", author: { account: null, name: "memory" }, changes: [] });
      }
      return limit ? found.slice(0, limit) : found;
    },
    readFileAt: async (path, commits) => new Map(commits.map((commit) => [commit, trees.get(commit)?.get(path) ?? null])),
    commitFiles: async ({ branch, expectedHead, files: written, message }) => {
      calls.push({ branch, expectedHead, files: written, message });
      if (branch !== "main" || expectedHead !== head) {
        throw Object.assign(new Error(`Moved: main stands at ${head}`), { name: "Moved", head });
      }
      const tree = new Map(trees.get(head));
      for (const file of written) {
        if (file.delete) tree.delete(file.path); else tree.set(file.path, file.text);
      }
      head = commitOf(tree);
      return { commit: head, url: `${repository.web}/commit/${head}` };
    },
  };
  return { host, files: () => Object.fromEntries(trees.get(head)), commits: () => calls };
}
