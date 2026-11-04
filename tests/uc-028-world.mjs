// The world the independent tests of UC-028 (Run and review the tests of a commit) run in: a product repository that keeps commits, branches and tags in memory and answers MOD-repository-hosts' interface
// (repositoryInfo, readSnapshot, readHistory, listTags, createTag, commitFiles, listPullRequests, listCiRuns, ciRunLog, webLinks), the instance that holds the register of participants, the small DOM of
// tests/site-frame-dom.mjs, and the finders and record texts the tests of UC-028 share. It holds no test and no expected result; nothing reaches the network. A commit written by the page lands on its branch,
// so that a page drawn again reads it, and a refused commit (a branch that moved on) fails as the host fails.
//
// Module: MOD-test-pages
// Level: unit

import { createHash } from "node:crypto";
import "./site-frame-dom.mjs";
import { storedGraphReadOn } from "./stored-graph-fake.mjs";

const { registerStrategies } = await import("../src/job-runner/index.mjs");
const { resourceStrategies } = await import("../src/resource-list/index.mjs");
const { resultStrategies } = await import("../src/result-records/index.mjs");
const { routeStrategies } = await import("../src/runtimes/index.mjs");

// The strategies the kind run-tests meets, registered once as the frame registers them.
for (const [at, strategies] of [resultStrategies, routeStrategies, resourceStrategies].entries()) registerStrategies(`tests/uc-028-world.mjs#${at}`, strategies);

export const PRODUCT = "https://github.com/org/product";
export const WORKFLOW = ".github/workflows/agent-m-jobs.yml";

export const blobSha = (text) => createHash("sha1").update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest("hex");
const failure = (name, fields = {}) => Object.assign(new Error(`${name} ${JSON.stringify(fields)}`), { name, ...fields });

// ---------------------------------------------------------------- the product repository

/**
 * product({ files, web, logs, pulls, runs }) -> { host, commit, branch, tag, tagOf, headOf, calls } — one repository: `files` is the tree of its first commit, on the branch main. `commit(branch, files, message)`
 * adds a commit on a branch (a file given as null is deleted); `branch(name, files)` starts a branch with a commit of its own; `tag(name, sha)` sets a tag. `logs` maps a run id to the log the server still keeps;
 * `pulls` are the open pull requests; `runs` what listCiRuns gives. `calls` keeps what the host was asked to write.
 */
export function product({ files = {}, web = PRODUCT, logs = {}, pulls = [], runs = [], visible = true } = {}) {
  const commits = new Map();
  const branches = new Map();
  const tags = new Map();
  const calls = [];
  let made = 0;
  const make = (parent, tree, message) => {
    made += 1;
    const sha = createHash("sha1").update(`commit ${made} ${message}`).digest("hex");
    commits.set(sha, { parent, tree, message, date: `2026-10-${String(10 + made).padStart(2, "0")}T09:00:00Z` });
    return sha;
  };
  const treeAfter = (sha, changes) => {
    const tree = new Map(sha ? commits.get(sha).tree : []);
    for (const [path, text] of Object.entries(changes)) { if (text === null) tree.delete(path); else tree.set(path, text); }
    return tree;
  };
  branches.set("main", make(null, treeAfter(null, files), "The first commit"));
  const shaOf = (ref) => branches.get(ref) ?? tags.get(ref) ?? (commits.has(ref) ? ref : null);
  // Every commit's graph is stored on trace-cache, as the workflow "main changed" stores it (tests/stored-graph-fake.mjs), built once for the commit.
  const storedOf = new Map();
  const snapshot = (ref) => {
    const sha = shaOf(ref);
    if (!sha) throw failure("NotFound", { what: ref });
    const tree = commits.get(sha).tree;
    const read = async (path) => (tree.has(path) ? tree.get(path) : null);
    if (!storedOf.has(sha)) storedOf.set(sha, storedGraphReadOn({ commit: sha, paths: [...tree.keys()], read }));
    return { repository: { server: "github", origin: "https://github.com", path: "org/product", web }, ref, commit: sha, paths: [...tree.keys()],
      read, readMany: async () => {}, readOn: storedOf.get(sha), blob: (path) => (tree.has(path) ? blobSha(tree.get(path)) : null) };
  };
  const entry = (sha) => ({ commit: sha, parents: commits.get(sha).parent ? [commits.get(sha).parent] : [], author: { account: null, name: "x" }, date: commits.get(sha).date,
    message: commits.get(sha).message, changes: [] });
  const host = {
    async repositoryInfo() { return { defaultBranch: "main", visibility: visible ? "public" : "private", canWrite: true, archived: false, description: "" }; },
    async readSnapshot(ref) { return snapshot(ref); },
    async readHistory(path, options = {}) {
      const found = [];
      for (let sha = shaOf(options.ref ?? "main"); sha; sha = commits.get(sha).parent) {
        const before = commits.get(sha).parent ? commits.get(commits.get(sha).parent).tree : new Map();
        if (path === null || commits.get(sha).tree.get(path) !== before.get(path)) found.push(entry(sha));
      }
      return found.slice(0, options.limit ?? found.length);
    },
    async listTags() { return [...tags.entries()].map(([name, commit]) => ({ name, commit })); },
    async createTag(name, sha) { calls.push({ fn: "createTag", name, commit: sha }); if (tags.has(name)) throw failure("TagExists", { commit: tags.get(name) }); tags.set(name, sha); },
    async commitFiles(change) {
      calls.push({ fn: "commitFiles", change: structuredClone(change) });
      const head = branches.get(change.branch);
      if (head === undefined) throw failure("NotFound", { what: change.branch });
      if (change.expectedHead !== undefined && head !== change.expectedHead) throw failure("Moved", { head });
      const sha = make(head, treeAfter(head, Object.fromEntries(change.files.map((file) => [file.path, file.delete ? null : file.text]))), change.message ?? "commit");
      branches.set(change.branch, sha);
      return { commit: sha, url: `${web}/commit/${sha}` };
    },
    async listPullRequests() { return pulls; },
    async listCiRuns() { return runs; },
    async ciRunLog(id) { return logs[id] ?? null; },
    webLinks: () => ({ actions: `${web}/actions`, run: (id) => `${web}/actions/runs/${id}`, secrets: `${web}/settings/secrets/actions`,
      commitRuns: (sha) => `${web}/commit/${sha}/checks`, branch: (name) => `${web}/tree/${name}` }),
  };
  return {
    host, calls,
    commit: (branch, changes, message = "commit") => { const sha = make(branches.get(branch), treeAfter(branches.get(branch), changes), message); branches.set(branch, sha); return sha; },
    branch: (name, changes = {}) => { const sha = make(null, treeAfter(null, changes), `The first commit of ${name}`); branches.set(name, sha); return sha; },
    tag: (name, sha) => { tags.set(name, sha); },
    tagOf: (name) => tags.get(name),
    headOf: (branch) => branches.get(branch),
    treeOf: (ref) => Object.fromEntries(commits.get(shaOf(ref)).tree),
  };
}

// The instance: the repository that holds the register of participants.
export function instance(register) {
  const world = product({ files: { "docs/participants.md": register, "SPEC.md": "# Instance\n" } });
  return world.host;
}

export const REGISTER = `# Participants of this instance

**REGISTER**

The participants of the test instance.

| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |
|---|---|---|---|---|---|---|---|
| hosted-ci | CI agent | example-model | 200000 | — | draft text, run code and tests | the server | ci hosted secret CI_KEY |
| writer | CLI agent | example-model | 200000 | — | draft text, read the repository | this machine | bridge lab-pc agent claude |
`;
export const WRITERS_ONLY = REGISTER.replace("| hosted-ci | CI agent | example-model | 200000 | — | draft text, run code and tests | the server | ci hosted secret CI_KEY |\n", "");

export function context(world, { register = REGISTER, tokenStored = true, went = [] } = {}) {
  return { page: "main", instance: { repository: "alice/agent-m", host: instance(register) }, store: null, go: (name, given) => went.push([name, given]),
    product: { address: PRODUCT, kind: "github", host: world.host, tokenStored } };
}

// ---------------------------------------------------------------- the DOM

export function descendants(root, predicate) {
  const found = [];
  (function visit(node) { for (const child of node.childNodes ?? []) { if (child.nodeType === 1) { if (predicate(child)) found.push(child); visit(child); } } })(root);
  return found;
}
export const byClass = (root, name) => descendants(root, (node) => (node.className ?? "").split(" ").includes(name));
export const byTag = (root, name) => descendants(root, (node) => node.localName === name);
export const textOf = (node) => node.textContent.replace(/\s+/g, " ");
export const levelOf = (page, level) => descendants(page, (node) => node.getAttribute?.("data-level") === level)[0];
export const testOf = (page, id) => descendants(page, (node) => node.getAttribute?.("data-test") === id)[0];
export const flush = async () => { for (let n = 0; n < 60; n += 1) await new Promise((resolve) => setImmediate(resolve)); };
export const clickOf = async (node) => { const event = new Event("click"); Object.defineProperty(event, "isTrusted", { value: true }); node.dispatchEvent(event); await flush(); };
export const changeOf = async (node) => { node.dispatchEvent(new Event("change")); await flush(); };
export const typeInto = (field, text) => { field.value = text; field.dispatchEvent(new Event("input")); };

export async function renderRoute(route, ctx, params) {
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, ctx, params);
  return target;
}

// ---------------------------------------------------------------- the files of a product and the records of runs

export const SPEC = ["# Fixture product — Specification", "", "## Section", "", "**A GUARDED RULE** *(Product Owner)*", "A rule.", "*Check:* `tests/sample.test.mjs`", "",
  "**A SECOND RULE** *(Product Owner)*", "Another rule.", "*Check:* `tests/sample.test.mjs`", ""].join("\n");
// A test file's text: one declaration for each entry [number, level, guards, extra lines], built by join so that no line of this file is itself a declaration.
export const declarations = (entries) => entries.map(([number, level, guards, extra = []]) => ["// TST-" + number + " · level: " + level + " · module: system", "// guards: " + guards,
  "// given: g", "// input: i", "// expect: the list holds one entry", ...extra, "test(\"t\", () => {});", ""].join("\n")).join("\n");

export const SCHEDULE = "---\nnightly: 02:00\n---\n## Levels\n\n| Row | every commit | pull request | nightly | release candidate | on demand | runs on |\n|---|---|---|---|---|---|---|\n"
  + "| unit | ✓ | ✓ | ✓ | ✓ | ✓ | |\n| component | ✓ | ✓ | ✓ | ✓ | ✓ | |\n| system | ✓ | ✓ | ✓ | ✓ | ✓ | |\n| paid | | | ✓ | ✓ | ✓ | |\n| release | | | | ✓ | ✓ | |\n| user | | | | ✓ | ✓ | |\n";

// A result record in result-record.schema.md's form: its front matter, its outcomes and, where given, its failures.
export function record(commit, who, rows, { occasion = "commit", date = "2026-10-18T10:00:00Z", extra = "", failures = [] } = {}) {
  const levels = [...new Set(rows.map((row) => row[1]))];
  const front = `---\ncommit: ${commit}\nlevels:\n${levels.map((level) => `  - ${level}`).join("\n")}\noccasion: ${occasion}\nparticipant: ${who}\ndate: ${date}\n${extra}---\n`;
  const table = `## Outcomes\n\n| Test | Level | Outcome | Runs |\n|---|---|---|---|\n${rows.map((row) => `| ${row.join(" | ")} |`).join("\n")}\n`;
  const failed = failures.length ? `\n## Failures\n\n| Test | Expected | Observed | Log |\n|---|---|---|---|\n${failures.map((row) => `| ${row.join(" | ")} |`).join("\n")}\n` : "";
  return front + table + failed;
}
