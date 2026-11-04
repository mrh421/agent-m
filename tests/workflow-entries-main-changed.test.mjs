// MOD-workflow-entries' entry onMainChanged and the workflow file that runs it (ITM-908), as the accepted text of
// docs/architecture/MOD-workflow-entries.md states it: "onMainChanged(env) — in the instance, on every push to the default branch: what a page would
// otherwise derive from that commit at the moment it is opened, computed once and stored as records the page reads. It reads the commit's snapshot
// once. It adds the commit's graph … (MOD-trace-graph's `publishGraph`) … A file the branches already hold for that commit is left as it is:
// `nothing to do`. A failure … ends the entry `failed`, naming it"; "one file under `.github/workflows/` runs each of its entries … and does nothing
// but run it"; and (ITM-941) "It adds the commit's graph and the impact lists of its decision and module files that are not accepted … Each such file
// comes with the text it was last accepted at and that text's commit: MOD-approvals' `statuses` names the files, and `lastAcceptedText` gives each one's
// text"; "It adds the commit's overview of the main page (MOD-progress-measures' `publishOverview`)".
// Run: node --test tests/workflow-entries-main-changed.test.mjs
//
// Module: MOD-workflow-entries
// Guards: THE TRACEABILITY MATRIX IS DERIVED; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// Level: unit
//
// Deterministic, no network: the instance is a temporary git repository — a bare origin whose `main` holds a small instance and whose branches
// `trace-cache` and `overview-cache` hold a first commit each, and the clone the workflow's checkout stands for, which has fetched the branches as
// the workflow's step does. The GitHub API, which the entry reaches for the repository's information and the history of an approval record, is a fake `fetch` over that origin.
// git is given no global configuration and no prompt. Each test makes its own folder and removes it, and states its expected results in its own text.

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { gunzipSync } from "node:zlib";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runEntry } from "../src/workflow-entries/main.mjs";
import { graphFromText, storedImpacts } from "../src/trace-graph/index.mjs";
import { blobSha } from "../src/text-tools/index.mjs";
import { runRecord } from "./progress-measures-facts.mjs";

process.env.GIT_CONFIG_GLOBAL = "/dev/null";
process.env.GIT_CONFIG_SYSTEM = "/dev/null";
process.env.GIT_TERMINAL_PROMPT = "0";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILES = {
  "README.md": "# Fixture instance\n",
  "SPEC.md": "# Spec\n\n**A THING IS DONE** *(Product Owner)*\n\nIt is done.\n*Check:* no automatic check; at review.\n",
  "docs/use-cases/UC-001-do-it.md": "---\nid: UC-001\ntitle: Do it\narea: 1\nactors:\n  - Reader\nrealises:\n  - A THING IS DONE\n---\n# UC-001 Do it\n",
};

function git(cwd, ...args) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed in ${cwd}: ${r.stderr}`);
  return r.stdout.trim();
}
// The bytes of a file at a commit of the repository at `cwd`, as git holds them.
function gitBytes(cwd, object) {
  const r = spawnSync("git", ["show", object], { cwd });
  if (r.status !== 0) throw new Error(`git show ${object} failed in ${cwd}: ${r.stderr}`);
  return r.stdout;
}
function write(root, files) {
  for (const [path, body] of Object.entries(files)) { mkdirSync(join(root, path, ".."), { recursive: true }); writeFileSync(join(root, path), body); }
}
// A bare origin: `main` with FILES and, unless `withBranch` is false, the orphan branch trace-cache with one README commit, as the workflow's first step
// makes it; and the checkout, which has fetched trace-cache into a local branch. -> { root, origin, clone, head }.
function fixture({ withBranch = true, withOverview = true, commits = [{ message: "the instance", files: FILES }] } = {}) {
  const root = mkdtempSync(join(tmpdir(), "agent-m-main-changed-"));
  const origin = join(root, "origin.git"), seed = join(root, "seed"), clone = join(root, "clone");
  git(root, "init", "-q", "--bare", "-b", "main", origin);
  git(root, "clone", "-q", origin, seed);
  for (const [key, value] of [["user.name", "Alice"], ["user.email", "alice@example.org"]]) git(seed, "config", key, value);
  const made = [];
  for (const { message, files } of commits) {
    write(seed, files);
    git(seed, "add", "-A");
    git(seed, "commit", "-q", "-m", message);
    made.push(git(seed, "rev-parse", "HEAD"));
  }
  git(seed, "push", "-q", "origin", "HEAD:refs/heads/main");
  for (const [branch, wanted] of [["trace-cache", withBranch], ["overview-cache", withOverview]]) {
    if (!wanted) continue;
    git(seed, "checkout", "-q", "--orphan", branch);
    git(seed, "rm", "-rq", "--cached", ".");
    write(seed, { "README.md": `The ${branch} files of the commits of main, one each.\n` });
    git(seed, "add", "README.md");
    git(seed, "commit", "-q", "-m", `${branch}: the branch of the stored files`);
    git(seed, "push", "-q", "origin", `HEAD:refs/heads/${branch}`);
  }
  git(root, "clone", "-q", origin, clone);
  for (const [key, value] of [["user.name", "agent-m main-changed"], ["user.email", "41898282+github-actions[bot]@users.noreply.github.com"]]) git(clone, "config", key, value);
  if (withBranch) git(clone, "fetch", "-q", "origin", "trace-cache:trace-cache");
  if (withOverview) git(clone, "fetch", "-q", "origin", "overview-cache:overview-cache");
  return { root, origin, clone, seed, head: git(clone, "rev-parse", "HEAD"), commits: made };
}
// The fake GitHub API over the fixture's origin: the repository's information (its default branch main), the history of a path as `git log` gives it, and
// otherwise an empty list, since this instance has no pull requests and no tags.
function fakeGitHub(f) {
  const saved = globalThis.fetch;
  const json = (value) => new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } });
  globalThis.fetch = async (address) => {
    const url = new URL(String(address));
    const path = url.pathname.replace("/repos/alice/agent-m", "");
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
async function withInstance(options, run) {
  const f = fixture(options);
  const restore = fakeGitHub(f);
  try { return await run(f); } finally { restore(); rmSync(f.root, { recursive: true, force: true }); }
}
const environment = (f, extra = {}) => ({ GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "push", GITHUB_WORKSPACE: f.clone, GITHUB_SERVER_URL: "https://github.com",
  GITHUB_REPOSITORY: "alice/agent-m", GITHUB_REF_NAME: "main", GITHUB_SHA: f.head, GITHUB_TOKEN: "ghp_ALICEworkflowTOKEN0123456789abcdef", ...extra });
const run = (f, extra) => runEntry("onMainChanged", environment(f, extra), { now: new Date("2026-10-19T10:00:00Z") });
const cacheHead = (f) => git(f.origin, "rev-parse", "trace-cache");
const overviewHead = (f) => git(f.origin, "rev-parse", "overview-cache");
// The workflow's step before a run: the checkout fetches the branches again.
const refetch = (f) => { for (const branch of ["trace-cache", "overview-cache"]) git(f.clone, "fetch", "-q", "origin", `+${branch}:${branch}`); };

// TST-908101 · level: unit · module: MOD-workflow-entries
// guards: THE TRACEABILITY MATRIX IS DERIVED
// given: an instance whose main has just been pushed, and whose branch trace-cache holds only its first commit
// input: onMainChanged with the workflow's token
// expect: outcome `done`; one new commit on the origin's trace-cache, on the head the entry read, that adds exactly "<commit of main>.json.gz" (beside the impact lists); that file is gzip whose text is the graph of main's commit, which graphFromText restores for it and which holds the requirement and the use case; main is untouched
test("onMainChanged adds the graph of the pushed commit to trace-cache in one commit", async () => {
  await withInstance({}, async (f) => {
    const before = cacheHead(f);
    const status = await run(f);
    assert.equal(status.outcome, "done", status.summary);
    const after = cacheHead(f);
    assert.equal(git(f.origin, "rev-parse", `${after}^`), before);
    assert.deepEqual(git(f.origin, "diff", "--name-only", before, after).split("\n"), [`${f.head}.gaps.json`, `${f.head}.impacts.json`, `${f.head}.json.gz`, `${f.head}.references.json.gz`, "latest.json"]);
    assert.equal(JSON.parse(git(f.origin, "show", `${after}:latest.json`)).commit, f.head, "latest.json names the commit of the graph stored last");
    const graph = graphFromText(gunzipSync(gitBytes(f.origin, `${after}:${f.head}.json.gz`)).toString("utf8"), f.head);
    assert.deepEqual([graph?.nodes.has("A THING IS DONE"), graph?.nodes.has("UC-001")], [true, true]);
    assert.equal(git(f.origin, "rev-parse", "main"), f.head);
  });
});

// TST-908102 · level: unit · module: MOD-workflow-entries
// guards: THE TRACEABILITY MATRIX IS DERIVED
// given: the instance after the run above, and the same commit pushed again (the workflow run again)
// input: onMainChanged a second time, after the clone has fetched trace-cache again
// expect: outcome `nothing to do`, and the origin's trace-cache as it was
test("onMainChanged leaves a graph the branch holds already: nothing to do", async () => {
  await withInstance({}, async (f) => {
    assert.equal((await run(f)).outcome, "done");
    const once = cacheHead(f);
    const overview = overviewHead(f);
    refetch(f);
    const status = await run(f);
    assert.equal(status.outcome, "nothing to do", status.summary);
    assert.deepEqual([cacheHead(f), overviewHead(f)], [once, overview]);
  });
});

// TST-908103 · level: unit · module: MOD-workflow-entries
// guards: A REMOTE INTERFACE NAMES HOW IT FAILS
// given: (a) no GITHUB_TOKEN; (b) a repository without the branch trace-cache; (c) a branch that moved on at the origin after the checkout fetched it
// input: onMainChanged in each
// expect: (a) `not run`, nothing written; (b) `failed` with a summary that names "trace-cache", nothing written; (c) `failed` with a summary that names that the branch moved, nothing written — and, once the checkout has fetched the branch again, the run made again is `done`
test("onMainChanged: no token is not run, a missing branch and a moved one are failed and write nothing, and the run can be made again", async () => {
  await withInstance({}, async (f) => {
    const status = await run(f, { GITHUB_TOKEN: "" });
    assert.equal(status.outcome, "not run");
    assert.equal(cacheHead(f), git(f.clone, "rev-parse", "trace-cache"));
  });
  await withInstance({ withBranch: false }, async (f) => {
    const status = await run(f);
    assert.equal(status.outcome, "failed");
    assert.match(status.summary, /trace-cache/);
    assert.equal(git(f.origin, "branch", "--list", "trace-cache"), "");
  });
  await withInstance({}, async (f) => {
    git(f.seed, "checkout", "-q", "trace-cache");
    write(f.seed, { "NOTE.md": "someone else wrote\n" });
    git(f.seed, "add", "NOTE.md");
    git(f.seed, "commit", "-q", "-m", "another run");
    git(f.seed, "push", "-q", "origin", "HEAD:refs/heads/trace-cache");
    const moved = cacheHead(f);
    const status = await run(f);
    assert.equal(status.outcome, "failed");
    assert.match(status.summary, /moved/i);
    assert.equal(cacheHead(f), moved);
    refetch(f);
    assert.equal((await run(f)).outcome, "done");
  });
});

// TST-908104 · level: unit · module: MOD-workflow-entries
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the workflow file .github/workflows/main-changed.yml
// input: reading its text
// expect: it runs on a push to main; it gives the step the workflow's token as GITHUB_TOKEN and may write contents; for each of the branches trace-cache and overview-cache it makes the branch with an orphan first commit when the origin has none and fetches it into the checkout; and the only entry it runs is `node src/workflow-entries/main.mjs onMainChanged`
test("the workflow file runs onMainChanged on a push to main, makes the branches trace-cache and overview-cache once, and runs nothing else", () => {
  const text = readFileSync(join(ROOT, ".github", "workflows", "main-changed.yml"), "utf8");
  assert.match(text, /^on:\n\s+push:\n\s+branches: \[main\]/m);
  assert.match(text, /contents: write/);
  assert.match(text, /GITHUB_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}/);
  assert.match(text, /checkout --orphan/);
  const loop = /for (\w+) in trace-cache overview-cache; do/.exec(text);
  assert.ok(loop, "one loop over both branches");
  assert.match(text, new RegExp(`ls-remote --exit-code --heads origin "\\$${loop[1]}"`));
  assert.match(text, new RegExp(`push origin \\S+:refs/heads/\\$${loop[1]}`));
  assert.match(text, new RegExp(`fetch origin \\+\\$${loop[1]}:\\$${loop[1]}`));
  assert.deepEqual([...text.matchAll(/node src\/workflow-entries\/main\.mjs (\w+)/g)].map((m) => m[1]), ["onMainChanged"]);
});

// TST-1175002 · level: component · module: MOD-workflow-entries
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: the native workflow fixture with a remote test-results branch containing a passing record for the pushed main commit, absent from its checkout; and another fixture whose origin has no test-results branch
// input: the main-changed setup's existing-result fetch, then onMainChanged; the setup text for an absent branch and a non-absence ls-remote failure
// expect: the setup fetch makes the existing branch readable locally without creating it, onMainChanged stores a Tests share of 1 and literal detail "1 of 1 requirements guarded by a passing test"; an absent branch remains absent, while an ls-remote exit other than 2 exits the setup instead of treating access failure as absence
test("TST-1175002 main-changed fetches an existing results branch for the overview and does not create or hide failures", async () => {
  const text = readFileSync(join(ROOT, ".github", "workflows", "main-changed.yml"), "utf8");
  const block = /- name: Fetch the existing test-results branch\n\s+run: \|\n((?: {10}.*\n?)+)/.exec(text);
  assert.ok(block, "the workflow has an existing-results setup block");
  const setup = block[1].replace(/^ {10}/gm, "");
  const runSetup = (f) => spawnSync("bash", ["-e", "-c", setup], { cwd: f.clone, encoding: "utf8" });
  await withInstance({ commits: [{ message: "the instance", files: { ...FILES,
    "tests/accepted.test.mjs": ["// TST-001 · level: unit · module: MOD-example", "// guards: A THING IS DONE", "test(\"accepted\", () => {});", ""].join("\n") } }] }, async (f) => {
    git(f.seed, "checkout", "-q", "--orphan", "test-results");
    git(f.seed, "rm", "-rq", "--cached", ".");
    write(f.seed, { [`runs/${f.head}/20261021-1000-commit-aaaa.md`]: runRecord(f.head, [["TST-001", "unit", "passed"]]) });
    git(f.seed, "add", "-A");
    git(f.seed, "commit", "-q", "-m", "the result record");
    git(f.seed, "push", "-q", "origin", "HEAD:refs/heads/test-results");
    assert.equal(git(f.clone, "branch", "--list", "test-results"), "", "the checkout lacks the remote results branch before setup");
    assert.equal(runSetup(f).status, 0, "the existing remote branch is fetched by the workflow setup");
    assert.notEqual(git(f.clone, "branch", "--list", "test-results"), "", "the existing results branch is fetched into the checkout");
    assert.equal((await run(f)).outcome, "done");
    const overview = JSON.parse(git(f.origin, "show", `${overviewHead(f)}:${f.head}.json`));
    assert.deepEqual(overview.shares.find((share) => share.stage === "Tests"), { stage: "Tests", share: 1, detail: "1 of 1 requirements guarded by a passing test" });
  });
  await withInstance({}, async (f) => {
    assert.equal(runSetup(f).status, 0, "an absent results branch is not an error");
    assert.equal(git(f.origin, "branch", "--list", "test-results"), "", "a genuinely absent results branch is not created");
  });
  await withInstance({}, async (f) => {
    git(f.clone, "remote", "set-url", "origin", join(f.root, "missing.git"));
    const failed = runSetup(f);
    assert.notEqual(failed.status, 0, "an inaccessible origin is not treated as an absent results branch");
  });
});

// The instance of the impact tests, in three commits of main: (1) a module MOD-doer that provides `doIt` and `gone`, which MOD-user uses, and a module MOD-steady;
// (2) the approval records of MOD-doer and MOD-steady, each naming the text of (1); (3) MOD-doer changed (it no longer provides `gone`) and MOD-fresh, which was never accepted.
const moduleText = (id, provides, uses = []) => ["---", `id: ${id}`, `title: ${id}`, `folder: src/${id.slice(4)}/`, "realises:", "  - A THING IS DONE",
  "uses:", ...uses.map((name) => `  - ${name}`), "provides:", ...provides.map((name) => `  - ${name}`), "---", `# ${id}`, ""].join("\n");
const DOER = "docs/architecture/MOD-doer.md", STEADY = "docs/architecture/MOD-steady.md", FRESH = "docs/architecture/MOD-fresh.md", USER = "docs/architecture/MOD-user.md";
const DOER_V1 = moduleText("MOD-doer", ["doIt", "gone"]), DOER_V2 = moduleText("MOD-doer", ["doIt"]);
const STEADY_TEXT = moduleText("MOD-steady", ["steady"]), USER_TEXT = moduleText("MOD-user", ["use"], ["MOD-doer.gone"]);
async function impactCommits() {
  const record = async (path, text) => [`docs/approvals/${path.split("/").pop().slice(0, -3)}-${(await blobSha(text)).slice(0, 12)}.md`, `kind: module\nfile: ${path}\nblob: ${await blobSha(text)}\n`];
  return [
    { message: "the instance", files: { ...FILES, [DOER]: DOER_V1, [STEADY]: STEADY_TEXT, [USER]: USER_TEXT } },
    { message: "accept MOD-doer, MOD-steady and MOD-user", files: Object.fromEntries([await record(DOER, DOER_V1), await record(STEADY, STEADY_TEXT), await record(USER, USER_TEXT)]) },
    { message: "change MOD-doer, add MOD-fresh", files: { [DOER]: DOER_V2, [FRESH]: moduleText("MOD-fresh", ["fresh"]) } },
  ];
}
// The impact lists stored on trace-cache for the commit, as storedImpacts reads them from the origin.
const impactsStored = (f) => storedImpacts({ readOn: async (branch, path) => { try { return git(f.origin, "show", `${branch}:${path}`); } catch { return null; } } }, f.head);

// TST-941101 · level: unit · module: MOD-workflow-entries
// guards: AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST
// given: main in three commits — MOD-doer accepted at its first text (the commit of the record is the second), then changed; MOD-steady accepted and unchanged; MOD-fresh never accepted; MOD-user uses the interface `gone` that MOD-doer no longer provides
// input: onMainChanged
// expect: outcome `done`; trace-cache holds "<commit>.impacts.json" beside the graph, and storedImpacts reads exactly the two files not accepted, MOD-doer and MOD-fresh, not MOD-steady; MOD-doer's entry names the second commit as `before` and its impact marks MOD-user as breaking ("uses an interface that is removed"), which only its first text gives; MOD-fresh's entry has `before` null
test("onMainChanged hands publishGraph exactly the files not accepted, each with its last accepted text and that text's commit", async () => {
  await withInstance({ commits: await impactCommits() }, async (f) => {
    const status = await run(f);
    assert.equal(status.outcome, "done", status.summary);
    const stored = await impactsStored(f);
    assert.deepEqual([...stored.keys()].sort(), [DOER, FRESH]);
    assert.equal(stored.get(DOER).before, f.commits[1]);
    assert.equal(stored.get(DOER).blob, await blobSha(DOER_V2));
    assert.deepEqual(stored.get(DOER).impact.modules.find((entry) => entry.id === "MOD-user"), { id: "MOD-user", why: "uses an interface that is removed", breaks: true });
    assert.equal(stored.get(FRESH).before, null);
  });
});

// TST-941102 · level: unit · module: MOD-workflow-entries
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the instance of the first impact test, whose branch overview-cache holds only its first commit
// input: onMainChanged
// expect: one new commit on overview-cache, on the head it read, that adds exactly "<commit>.json" and the views "<commit>.backlog.json.gz", "<commit>.progress.json.gz" (ITM-1260) and "<commit>.schedule.json.gz" (ITM-1265) — no "<commit>.facts.json" — and writes "latest.json" naming the commit; the summary names the overview and the views; storedOverview-shaped content: { commit, shares, waiting } of main's commit, the six stages in their order; the origin's main is untouched
test("onMainChanged adds the overview of the commit to overview-cache once", async () => {
  await withInstance({ commits: await impactCommits() }, async (f) => {
    const before = overviewHead(f);
    const status = await run(f);
    assert.equal(status.outcome, "done");
    assert.match(status.summary, new RegExp(`Added the overview and the views of progress and backlog of ${f.head} to overview-cache\\.`), "the summary names the overview and the views");
    const after = overviewHead(f);
    assert.equal(git(f.origin, "rev-parse", `${after}^`), before);
    assert.deepEqual(git(f.origin, "diff", "--name-only", before, after).split("\n"), [`${f.head}.backlog.json.gz`, `${f.head}.json`, `${f.head}.progress.json.gz`, `${f.head}.schedule.json.gz`, "latest.json"]);
    assert.equal(JSON.parse(git(f.origin, "show", `${after}:latest.json`)).commit, f.head, "latest.json names the commit");
    const overview = JSON.parse(git(f.origin, "show", `${after}:${f.head}.json`));
    assert.equal(overview.commit, f.head);
    assert.equal(overview.shares.length, 6);
    assert.ok(Array.isArray(overview.waiting));
    assert.equal(git(f.origin, "rev-parse", "main"), f.head);
  });
});

// TST-941103 · level: unit · module: MOD-workflow-entries
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the instance of the first impact test after one run, the checkout having fetched both branches again
// input: onMainChanged a second time
// expect: outcome `nothing to do`; trace-cache and overview-cache as they were
test("onMainChanged on a commit it stored already is nothing to do", async () => {
  await withInstance({ commits: await impactCommits() }, async (f) => {
    assert.equal((await run(f)).outcome, "done");
    const heads = [cacheHead(f), overviewHead(f)];
    refetch(f);
    const status = await run(f);
    assert.equal(status.outcome, "nothing to do", status.summary);
    assert.match(status.summary, new RegExp(`overview-cache holds the overview and the views of progress and backlog of ${f.head} already\\.`), "the summary names the overview and the views, held already");
    assert.deepEqual([cacheHead(f), overviewHead(f)], heads);
  });
});

// TST-941104 · level: unit · module: MOD-workflow-entries
// guards: A REMOTE INTERFACE NAMES HOW IT FAILS
// given: the instance of the first impact test in a repository without the branch overview-cache
// input: onMainChanged
// expect: outcome `failed` with a summary that names the overview ("overview-cache"); the graph and the impact lists are written all the same (trace-cache holds both files of the commit) — a failure of one leaves the other written
test("a failing overview leaves the graph and the impact lists written and ends failed, naming it", async () => {
  await withInstance({ commits: await impactCommits(), withOverview: false }, async (f) => {
    const status = await run(f);
    assert.equal(status.outcome, "failed");
    assert.match(status.summary, /overview-cache/);
    assert.deepEqual(git(f.origin, "ls-tree", "--name-only", "trace-cache").split("\n").filter((name) => name.startsWith(f.head)).sort(), [`${f.head}.gaps.json`, `${f.head}.impacts.json`, `${f.head}.json.gz`, `${f.head}.references.json.gz`]);
    assert.equal(git(f.origin, "branch", "--list", "overview-cache"), "");
  });
});

// TST-1118001 · level: unit · module: MOD-workflow-entries
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the workflow file .github/workflows/main-changed.yml
// input: its header comment read
// expect: it names the overview of the main page of that commit, added to the branch overview-cache, and no facts (no commit's facts file is stored); known positive: it still names the graph and the impact lists of trace-cache
test("the header of the workflow main-changed names the overview, and no stored facts", () => {
  const header = readFileSync(new URL("../.github/workflows/main-changed.yml", import.meta.url), "utf8").split("\n").filter((line) => line.startsWith("#")).join(" ").replace(/#\s*/g, " ").replace(/\s+/g, " ");
  assert.match(header, /graph of the pushed commit and the impact lists/);
  assert.match(header, /overview of the main page of that commit to the branch overview-cache/);
  assert.doesNotMatch(header, /facts/);
});
