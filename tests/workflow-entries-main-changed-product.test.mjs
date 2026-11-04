// MOD-workflow-entries' entry onMainChanged in a product (ITM-1261), as the accepted text of docs/architecture/MOD-workflow-entries.md states it:
// "onMainChanged(env) — in the instance and in a product alike, on every push to the default branch … In a product it reads the instance as the entries of
// the job workflow do, through the checkout of the instance at the commit its file names, connected as `productFacts`' `instanceAt`"; it adds the commit's
// graph (MOD-trace-graph's `publishGraph`) and the commit's overview and views (MOD-progress-measures' `publishOverview`); "A file the branches already hold
// for that commit is left as it is: `nothing to do`"; and, of CiEnvironment, "for `onMainChanged` in a product, the workflow's own token on GitHub".
// Run: node --test tests/workflow-entries-main-changed-product.test.mjs
//
// Module: MOD-workflow-entries
// Guards: THE TRACEABILITY MATRIX IS DERIVED; THE MAIN PAGE SHOWS EACH PRODUCT'S PROGRESS BY STAGE
// Level: unit
//
// Deterministic, no network: the product is a temporary git repository — a bare origin whose `main` holds a small product and whose branches `trace-cache` and
// `overview-cache` hold a first commit each, as the file beside the job workflow makes them — and the workspace of the run, as
// src/runtimes/workflow/github-main-changed.yml lays it out: the product's checkout in `product/`, which has fetched the two branches, and the instance's
// checkout in `instance/`, a repository of its own. The GitHub API, which the entry reaches for the repository's information and the history of a path, is a
// fake `fetch` over the product's origin. Each test makes its own folder and removes it, and states its expected results in its own text.

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { gunzipSync } from "node:zlib";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runEntry } from "../src/workflow-entries/main.mjs";
import { graphFromText } from "../src/trace-graph/index.mjs";

const PRODUCT = {
  "SPEC.md": "# Spec\n\n**A THING IS DONE** *(Product Owner)*\n\nIt is done.\n*Check:* no automatic check; at review.\n",
  "docs/use-cases/UC-001-do-it.md": "---\nid: UC-001\ntitle: Do it\narea: 1\nactors:\n  - Reader\nrealises:\n  - A THING IS DONE\n---\n# UC-001 Do it\n",
};
const INSTANCE = { "SPEC.md": "# Agent M\n\n**AN INSTANCE RULE** *(Product Owner)*\n\nIt holds.\n*Check:* at review.\n" };

function git(cwd, ...args) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed in ${cwd}: ${r.stderr}`);
  return r.stdout.trim();
}
function gitBytes(cwd, object) {
  const r = spawnSync("git", ["show", object], { cwd });
  if (r.status !== 0) throw new Error(`git show ${object} failed in ${cwd}: ${r.stderr}`);
  return r.stdout;
}
function write(root, files) {
  for (const [path, body] of Object.entries(files)) { mkdirSync(join(root, path, ".."), { recursive: true }); writeFileSync(join(root, path), body); }
}
const configure = (dir) => { for (const [key, value] of [["user.name", "Alice"], ["user.email", "alice@example.org"]]) git(dir, "config", key, value); };

// -> { root, origin, workspace, product, instance, head }: the product's bare origin with main and the two orphan branches; the workspace with the product's
// checkout, which has fetched them, and the instance's checkout at its one commit.
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "agent-m-main-changed-product-"));
  const origin = join(root, "origin.git"), seed = join(root, "seed"), workspace = join(root, "workspace");
  const product = join(workspace, "product"), instance = join(workspace, "instance");
  git(root, "init", "-q", "--bare", "-b", "main", origin);
  git(root, "clone", "-q", origin, seed);
  configure(seed);
  write(seed, PRODUCT);
  git(seed, "add", "-A");
  git(seed, "commit", "-q", "-m", "the product");
  git(seed, "push", "-q", "origin", "HEAD:refs/heads/main");
  for (const branch of ["trace-cache", "overview-cache"]) {
    git(seed, "checkout", "-q", "--orphan", branch);
    git(seed, "rm", "-rq", "--cached", ".");
    write(seed, { "README.md": "The files of the commits of the default branch, one each.\n" });
    git(seed, "add", "README.md");
    git(seed, "commit", "-q", "-m", `${branch}: the branch of the stored files`);
    git(seed, "push", "-q", "origin", `HEAD:refs/heads/${branch}`);
  }
  mkdirSync(workspace);
  git(workspace, "clone", "-q", origin, product);
  configure(product);
  for (const branch of ["trace-cache", "overview-cache"]) git(product, "fetch", "-q", "origin", `+${branch}:${branch}`);
  git(workspace, "init", "-q", "-b", "main", instance);
  configure(instance);
  write(instance, INSTANCE);
  git(instance, "add", "-A");
  git(instance, "commit", "-q", "-m", "the instance");
  return { root, origin, workspace, product, instance, head: git(product, "rev-parse", "HEAD") };
}
// The fake GitHub API over the product's origin: its information (default branch main), the history of a path as `git log` gives it, else an empty list.
function fakeGitHub(f) {
  const saved = globalThis.fetch;
  const json = (value) => new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } });
  globalThis.fetch = async (address) => {
    const url = new URL(String(address));
    const path = url.pathname.replace("/repos/alice/library", "");
    if (path === "") return json({ default_branch: "main", private: false, permissions: { push: true }, archived: false, description: "" });
    if (path === "/commits") {
      const args = ["--git-dir", f.origin, "log", "--format=%H", url.searchParams.get("sha")];
      if (url.searchParams.get("path")) args.push("--", url.searchParams.get("path"));
      return json(git(f.root, ...args).split("\n").filter(Boolean).map((sha) => ({ sha, parents: [], author: { login: "alice" },
        commit: { message: "", author: { name: "Alice" }, committer: { date: git(f.root, "--git-dir", f.origin, "log", "-1", "--format=%cI", sha) } } })));
    }
    if (path === "/actions/runs") return json({ workflow_runs: [] });
    return json([]);
  };
  return () => { globalThis.fetch = saved; };
}
async function withProduct(run) {
  const f = fixture();
  const restore = fakeGitHub(f);
  try { return await run(f); } finally { restore(); rmSync(f.root, { recursive: true, force: true }); }
}
// The step of .github/workflows/agent-m-main-changed.yml: the workflow's own token, the product's checkout in product/, the instance's in instance/.
const environment = (f) => ({ GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "push", GITHUB_WORKSPACE: f.workspace, GITHUB_SERVER_URL: "https://github.com",
  GITHUB_REPOSITORY: "alice/library", GITHUB_REF_NAME: "main", GITHUB_SHA: f.head, GITHUB_TOKEN: "ghp_ALICEworkflowTOKEN0123456789abcdef",
  AGENT_M_PRODUCT_DIR: f.product });
const run = (f) => runEntry("onMainChanged", environment(f), { now: new Date("2026-10-31T10:00:00Z") });
const changedOn = (f, branch, before) => git(f.origin, "diff", "--name-only", before, git(f.origin, "rev-parse", branch)).split("\n").filter(Boolean);

// TST-1261201 · level: unit · module: MOD-workflow-entries
// guards: THE TRACEABILITY MATRIX IS DERIVED; THE MAIN PAGE SHOWS EACH PRODUCT'S PROGRESS BY STAGE
// given: a product alice/library whose main has just been pushed and whose branches trace-cache and overview-cache hold only their first commit, its checkout in product/ and the instance's checkout in instance/ of the run's workspace
// input: onMainChanged with the workflow's own token and AGENT_M_PRODUCT_DIR naming the product's checkout
// expect: outcome `done`; the product's origin's trace-cache gains "<main's commit>.json.gz", "<main's commit>.impacts.json" and latest.json, and that graph, restored for the commit, holds the requirement A THING IS DONE and UC-001 — the product's, not the instance's AN INSTANCE RULE; its overview-cache gains, among what publishOverview stores, "<main's commit>.json", "<main's commit>.progress.json.gz", "<main's commit>.backlog.json.gz" and latest.json; the product's main is untouched
test("onMainChanged in a product adds the graph to the product's trace-cache and the overview and views to its overview-cache", async () => {
  await withProduct(async (f) => {
    const [trace, overview] = [git(f.origin, "rev-parse", "trace-cache"), git(f.origin, "rev-parse", "overview-cache")];
    const status = await run(f);
    assert.equal(status.outcome, "done", status.summary);
    assert.deepEqual(changedOn(f, "trace-cache", trace), [`${f.head}.gaps.json`, `${f.head}.impacts.json`, `${f.head}.json.gz`, `${f.head}.references.json.gz`, "latest.json"]);
    const graph = graphFromText(gunzipSync(gitBytes(f.origin, `trace-cache:${f.head}.json.gz`)).toString("utf8"), f.head);
    assert.deepEqual([graph?.nodes.has("A THING IS DONE"), graph?.nodes.has("UC-001"), graph?.nodes.has("AN INSTANCE RULE")], [true, true, false]);
    // publishOverview stores what it holds when this runs (the Acceptance's "whatever those hold"): these four among them.
    const added = changedOn(f, "overview-cache", overview);
    for (const file of [`${f.head}.json`, `${f.head}.progress.json.gz`, `${f.head}.backlog.json.gz`, "latest.json"]) assert.ok(added.includes(file), `${file} in ${added.join(", ")}`);
    assert.equal(git(f.origin, "rev-parse", "main"), f.head);
  });
});

// TST-1261202 · level: unit · module: MOD-workflow-entries
// guards: THE TRACEABILITY MATRIX IS DERIVED
// given: the product after the run above, its checkout having fetched trace-cache and overview-cache again, as the next run's step does
// input: onMainChanged a second time
// expect: outcome `nothing to do`, and both branches of the product's origin as they were after the first run
test("onMainChanged in a product run again: nothing to do", async () => {
  await withProduct(async (f) => {
    assert.equal((await run(f)).outcome, "done");
    const heads = () => [git(f.origin, "rev-parse", "trace-cache"), git(f.origin, "rev-parse", "overview-cache")];
    const once = heads();
    for (const branch of ["trace-cache", "overview-cache"]) git(f.product, "fetch", "-q", "origin", `+${branch}:${branch}`);
    const status = await run(f);
    assert.equal(status.outcome, "nothing to do", status.summary);
    assert.deepEqual(heads(), once);
  });
});
