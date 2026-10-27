// An entry reads its environment on GitLab CI (ITM-547): MOD-workflow-entries' CiEnvironment, as docs/architecture/MOD-workflow-entries.md states it — "the CI
// service (`github` or `gitlab`) and its event with its payload; the folder of the checkout and the repository's address; the instance repository and the commit of
// Agent M that runs", for an entry run by the GitLab job workflow that MOD-runtimes writes (src/runtimes/workflow/gitlab.yml).
// Run: node --test tests/workflow-entries-gitlab-547.test.mjs
//
// Module: MOD-workflow-entries
// Guards: UC-049; A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET; A JOB IS RECORDED IN ITS PRODUCT REPOSITORY
// Level: unit
//
// No test reads the runner's real environment: every environment is an object the test builds and passes in, as the tests of workflow-entries-job-workflow.test.mjs pass
// theirs to runEntry; ciEnvironment is given the same kind of object. The product and the instance are temporary git repositories, laid out as the GitLab template lays
// them out: the instance is `../instance` from the product's checkout. The model endpoint is a fake `fetch`. Each expected value is written in the test, never read from
// a document. The readings of ITM-547, each quoted with the sentence it reads, and the test that holds it:
//   - "It is `gitlab` where `GITLAB_CI` is `true`, and `github` otherwise, as today." — TST-547002.
//   - "The event's `name` is `CI_PIPELINE_SOURCE`." and "Its `payload` is `{ inputs }`, where `inputs` holds `job`, `task` and `endpoint` from `AGENT_M_INPUT_JOB`,
//     `AGENT_M_INPUT_TASK` and `AGENT_M_INPUT_ENDPOINT` … Each is held only where it is not empty." — TST-547001, TST-547003.
//   - "`checkout` is `CI_PROJECT_DIR`. `repository` is `CI_PROJECT_URL`, and `branch` is `CI_COMMIT_REF_NAME`. `agentM.commit` is `CI_COMMIT_SHA` … `job.productDir` is
//     `AGENT_M_PRODUCT_DIR`, and `job.instanceDir` is `../instance` from `CI_PROJECT_DIR`." — TST-547001.
//   - "`job.actor` is `GITLAB_USER_LOGIN`. `job.runUrl` is `CI_PIPELINE_URL`. `job.summaryFile` is `null` … `token` is `null`" — TST-547001, TST-547004.
//   - "`job.runner`, `job.tokenName`, `job.personToken` and `job.keys` keep the names the template already sets: `AGENT_M_RUNNER`, `AGENT_M_TOKEN_NAME`, `AGENT_M_TOKEN`
//     and `AGENT_M_KEY_NAMES`." — TST-547001.
//   - "No existing test's expected result changes: without `GITLAB_CI`, every field is read as today." — TST-547005, TST-547006.
//   - `../instance` from `CI_PROJECT_DIR` is the folder next to the checkout, written with the path module's join, as the GitHub path writes `instance/` of its workspace.
// Where the item leaves the event's name for a run started by a person unsaid, the test uses `api`, a value GitLab gives CI_PIPELINE_SOURCE (docs.gitlab.com, "Predefined
// CI/CD variables"); the entry does not branch on it. The counter-proofs are in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startRecord } from "../src/job-ledger/index.mjs";
import { registerStrategies } from "../src/job-runner/index.mjs";

process.env.GIT_CONFIG_GLOBAL = "/dev/null";
process.env.GIT_CONFIG_SYSTEM = "/dev/null";
process.env.GIT_TERMINAL_PROMPT = "0";

const composed = await import("../src/workflow-entries/compose.mjs").catch((error) => ({ error }));
const entries = await import("../src/workflow-entries/main.mjs").catch((error) => ({ error }));
const { ciEnvironment } = composed;
const { runEntry } = entries;

// ---------------------------------------------------------------- the environments

const NOW = new Date("2026-10-16T09:00:00Z");
const SHA = "0123456789abcdef0123456789abcdef01234567";
const TOKEN = "glpat-ALICEagentMtoken0123456789";
const KEY = "sk-FIXTURE-KEY-0123456789abcdef";
const JOB = "JOB-20261016-0800-a1b2";
const ENDPOINT_NAME = "fixture-endpoint";
const PROJECT = "https://gitlab.example.test/alice/thesis-tool";
const PIPELINE = "https://gitlab.example.test/alice/thesis-tool/-/pipelines/4711";

// What the GitLab job (src/runtimes/workflow/gitlab.yml) gives an entry: GitLab's predefined variables and the names the template sets.
const gitlab = (extra = {}) => ({ GITLAB_CI: "true", CI_PIPELINE_SOURCE: "api", CI_PROJECT_DIR: "/builds/alice/thesis-tool", CI_PROJECT_URL: PROJECT, CI_COMMIT_REF_NAME: "main",
  CI_COMMIT_SHA: SHA, GITLAB_USER_LOGIN: "alice", CI_PIPELINE_URL: PIPELINE,
  AGENT_M_RUNNER: "hosted", AGENT_M_PRODUCT_DIR: "/builds/alice/thesis-tool", AGENT_M_TOKEN_NAME: "ALICE_TOKEN", AGENT_M_TOKEN: TOKEN, AGENT_M_KEY_NAMES: "FIXTURE_KEY OTHER_KEY",
  FIXTURE_KEY: KEY, AGENT_M_INPUT_JOB: JOB, AGENT_M_INPUT_TASK: "Fix the loan due date", AGENT_M_INPUT_ENDPOINT: ENDPOINT_NAME, ...extra });
// GitHub's names for another run, which GitLab's job never sets; the tests put them beside GitLab's to show which service decides.
const githubNames = (extra = {}) => ({ GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_WORKSPACE: "/home/runner/work/thesis-tool", GITHUB_SERVER_URL: "https://github.com",
  GITHUB_REPOSITORY: "alice/thesis-tool", GITHUB_REF_NAME: "release", GITHUB_SHA: "f".repeat(40), GITHUB_RUN_ID: "99", GITHUB_ACTOR: "bob", GITHUB_TOKEN: "ghs_workflowtoken",
  GITHUB_STEP_SUMMARY: "/home/runner/summary.md", ...extra });

// TST-547001 · level: unit · module: MOD-workflow-entries
// guards: UC-049; A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET
// given: the environment of a GitLab job — GITLAB_CI `true`, CI_PIPELINE_SOURCE `api`, CI_PROJECT_DIR `/builds/alice/thesis-tool`, CI_PROJECT_URL `https://gitlab.example.test/alice/thesis-tool`, CI_COMMIT_REF_NAME `main`, a CI_COMMIT_SHA, GITLAB_USER_LOGIN `alice`, CI_PIPELINE_URL `…/-/pipelines/4711`, the template's AGENT_M_RUNNER `hosted`, AGENT_M_PRODUCT_DIR, AGENT_M_TOKEN_NAME `ALICE_TOKEN`, AGENT_M_TOKEN, AGENT_M_KEY_NAMES `FIXTURE_KEY OTHER_KEY` with the value of FIXTURE_KEY only, and the inputs AGENT_M_INPUT_JOB, AGENT_M_INPUT_TASK and AGENT_M_INPUT_ENDPOINT
// input: ciEnvironment("onDispatch", that environment, NOW)
// expect: exactly { entry "onDispatch", service "gitlab", event { name "api", payload { inputs { job, task "Fix the loan due date", endpoint "fixture-endpoint" } } }, checkout "/builds/alice/thesis-tool", repository the project's address, branch "main", agentM { commit the sha }, token null, now NOW, job { runner "hosted", productDir "/builds/alice/thesis-tool", instanceDir "/builds/alice/instance", actor "alice", runUrl the pipeline's address, tokenName "ALICE_TOKEN", personToken the token, keys { FIXTURE_KEY the key, OTHER_KEY null }, summaryFile null, part null, resultDir null, agentKey null, modelUser null, keyHolder null, outputFile null } }
test("ciEnvironment — a GitLab job's variables are read into the CiEnvironment", () => {
  assert.ok(ciEnvironment, `ciEnvironment: ${composed.error?.message}`);
  assert.deepEqual(ciEnvironment("onDispatch", gitlab(), NOW), {
    entry: "onDispatch", service: "gitlab",
    event: { name: "api", payload: { inputs: { job: JOB, task: "Fix the loan due date", endpoint: "fixture-endpoint" } } },
    checkout: "/builds/alice/thesis-tool", repository: "https://gitlab.example.test/alice/thesis-tool", branch: "main", agentM: { commit: SHA }, token: null, now: NOW,
    job: { runner: "hosted", productDir: "/builds/alice/thesis-tool", instanceDir: "/builds/alice/instance", actor: "alice", runUrl: "https://gitlab.example.test/alice/thesis-tool/-/pipelines/4711",
      tokenName: "ALICE_TOKEN", personToken: TOKEN, keys: { FIXTURE_KEY: KEY, OTHER_KEY: null }, summaryFile: null, part: null, resultDir: null, agentKey: null, modelUser: null, keyHolder: null, outputFile: null },
  });
});

// TST-547002 · level: unit · module: MOD-workflow-entries
// guards: UC-049
// given: an environment that holds both services' names — a GitLab job's and GitHub's, GitHub's naming workflow_dispatch, /home/runner/work/thesis-tool, https://github.com/alice/thesis-tool, branch release, actor bob, run 99
// input: ciEnvironment for GITLAB_CI `true`; for GITLAB_CI `false`; for GITLAB_CI `` ; and for GITLAB_CI unset
// expect: with `true` the service is "gitlab", the event's name "api", the checkout "/builds/alice/thesis-tool", the repository the GitLab project's address and the actor "alice"; in the other three the service is "github", the event's name "workflow_dispatch", the checkout "/home/runner/work/thesis-tool", the repository "https://github.com/alice/thesis-tool", the branch "release", the commit all f, the run's address "https://github.com/alice/thesis-tool/actions/runs/99", the actor "bob", the token "ghs_workflowtoken" and the summary file "/home/runner/summary.md"
test("ciEnvironment — GITLAB_CI decides the service, and any other value reads GitHub's names", () => {
  assert.ok(ciEnvironment, `ciEnvironment: ${composed.error?.message}`);
  const both = (flag) => ({ ...githubNames(), ...gitlab(), GITLAB_CI: flag });
  const on = ciEnvironment("onDispatch", both("true"), NOW);
  assert.equal(on.service, "gitlab");
  assert.equal(on.event.name, "api");
  assert.equal(on.checkout, "/builds/alice/thesis-tool");
  assert.equal(on.repository, "https://gitlab.example.test/alice/thesis-tool");
  assert.equal(on.job.actor, "alice");
  for (const flag of ["false", "", undefined]) {
    const env = both(flag);
    if (flag === undefined) delete env.GITLAB_CI;
    const off = ciEnvironment("onDispatch", env, NOW);
    const label = `GITLAB_CI ${JSON.stringify(flag)}`;
    assert.equal(off.service, "github", label);
    assert.equal(off.event.name, "workflow_dispatch", label);
    assert.equal(off.checkout, "/home/runner/work/thesis-tool", label);
    assert.equal(off.repository, "https://github.com/alice/thesis-tool", label);
    assert.equal(off.branch, "release", label);
    assert.equal(off.agentM.commit, "f".repeat(40), label);
    assert.equal(off.job.runUrl, "https://github.com/alice/thesis-tool/actions/runs/99", label);
    assert.equal(off.job.actor, "bob", label);
    assert.equal(off.token, "ghs_workflowtoken", label);
    assert.equal(off.job.summaryFile, "/home/runner/summary.md", label);
  }
});

// TST-547003 · level: unit · module: MOD-workflow-entries
// guards: UC-049
// given: a GitLab job's environment whose input AGENT_M_INPUT_TASK is empty and AGENT_M_INPUT_ENDPOINT is not set; and one where all three inputs are empty or not set
// input: ciEnvironment for each
// expect: the first event's payload is exactly { inputs: { job: the job } }, with no key `task` and no key `endpoint`; the second event's payload is exactly { inputs: {} }
test("ciEnvironment — an empty input is absent from the payload's inputs", () => {
  assert.ok(ciEnvironment, `ciEnvironment: ${composed.error?.message}`);
  const first = gitlab({ AGENT_M_INPUT_TASK: "" });
  delete first.AGENT_M_INPUT_ENDPOINT;
  assert.deepEqual(ciEnvironment("onDispatch", first, NOW).event.payload, { inputs: { job: JOB } });
  const none = gitlab({ AGENT_M_INPUT_JOB: "", AGENT_M_INPUT_TASK: "" });
  delete none.AGENT_M_INPUT_ENDPOINT;
  assert.deepEqual(ciEnvironment("onDispatch", none, NOW).event.payload, { inputs: {} });
});

// TST-547004 · level: unit · module: MOD-workflow-entries
// guards: A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET
// given: a GitLab job's environment that also holds GitHub's GITHUB_STEP_SUMMARY `/home/runner/summary.md` and GITHUB_TOKEN `ghs_workflowtoken`
// input: ciEnvironment
// expect: the token is null and the job's summaryFile is null — GitLab has no step summary and no instance workflow runs on GitLab
test("ciEnvironment — on GitLab the workflow's own token and the step summary are null", () => {
  assert.ok(ciEnvironment, `ciEnvironment: ${composed.error?.message}`);
  const env = ciEnvironment("onDispatch", gitlab({ GITHUB_STEP_SUMMARY: "/home/runner/summary.md", GITHUB_TOKEN: "ghs_workflowtoken" }), NOW);
  assert.equal(env.service, "gitlab");
  assert.equal(env.token, null);
  assert.equal(env.job.summaryFile, null);
});

// TST-547005 · level: unit · module: MOD-workflow-entries
// guards: UC-049
// given: GitHub's job environment — GITHUB_EVENT_NAME `workflow_dispatch`, GITHUB_EVENT_PATH naming a file that holds { "inputs": { "job": "JOB-1" } }, GITHUB_WORKSPACE `/home/runner/work/thesis-tool`, GITHUB_SERVER_URL, GITHUB_REPOSITORY `alice/thesis-tool`, GITHUB_REF_NAME `main`, GITHUB_SHA, GITHUB_RUN_ID `4711`, GITHUB_ACTOR `alice`, GITHUB_TOKEN, GITHUB_STEP_SUMMARY, and the template's AGENT_M names — and no GITLAB_CI
// input: ciEnvironment("onDispatch", that environment, NOW)
// expect: exactly { entry "onDispatch", service "github", event { name "workflow_dispatch", payload { inputs { job "JOB-1" } } }, checkout "/home/runner/work/thesis-tool", repository "https://github.com/alice/thesis-tool", branch "main", agentM { commit the sha }, token "ghs_workflowtoken", now NOW, job { runner "hosted", productDir "/home/runner/work/thesis-tool/product", instanceDir "/home/runner/work/thesis-tool/instance", actor "alice", runUrl "https://github.com/alice/thesis-tool/actions/runs/4711", tokenName "ALICE_TOKEN", personToken the token, keys { FIXTURE_KEY the key }, summaryFile "/home/runner/summary.md", part null, resultDir null, agentKey null, modelUser null, keyHolder null, outputFile null } } — the known positive: the GitHub path's result, which the item leaves unchanged
test("ciEnvironment — without GITLAB_CI a GitHub job is read as before", () => {
  assert.ok(ciEnvironment, `ciEnvironment: ${composed.error?.message}`);
  const root = mkdtempSync(join(tmpdir(), "agent-m-547-"));
  try {
    const eventPath = join(root, "event.json");
    writeFileSync(eventPath, JSON.stringify({ inputs: { job: "JOB-1" } }));
    const env = { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_EVENT_PATH: eventPath, GITHUB_WORKSPACE: "/home/runner/work/thesis-tool", GITHUB_SERVER_URL: "https://github.com",
      GITHUB_REPOSITORY: "alice/thesis-tool", GITHUB_REF_NAME: "main", GITHUB_SHA: SHA, GITHUB_RUN_ID: "4711", GITHUB_ACTOR: "alice", GITHUB_TOKEN: "ghs_workflowtoken",
      GITHUB_STEP_SUMMARY: "/home/runner/summary.md", AGENT_M_RUNNER: "hosted", AGENT_M_PRODUCT_DIR: "/home/runner/work/thesis-tool/product", AGENT_M_TOKEN_NAME: "ALICE_TOKEN",
      AGENT_M_TOKEN: TOKEN, AGENT_M_KEY_NAMES: "FIXTURE_KEY", FIXTURE_KEY: KEY };
    assert.deepEqual(ciEnvironment("onDispatch", env, NOW), {
      entry: "onDispatch", service: "github", event: { name: "workflow_dispatch", payload: { inputs: { job: "JOB-1" } } },
      checkout: "/home/runner/work/thesis-tool", repository: "https://github.com/alice/thesis-tool", branch: "main", agentM: { commit: SHA }, token: "ghs_workflowtoken", now: NOW,
      job: { runner: "hosted", productDir: "/home/runner/work/thesis-tool/product", instanceDir: "/home/runner/work/thesis-tool/instance", actor: "alice",
        runUrl: "https://github.com/alice/thesis-tool/actions/runs/4711", tokenName: "ALICE_TOKEN", personToken: TOKEN, keys: { FIXTURE_KEY: KEY }, summaryFile: "/home/runner/summary.md", part: null, resultDir: null, agentKey: null, modelUser: null, keyHolder: null, outputFile: null },
    });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// ---------------------------------------------------------------- an entry on GitLab

const text = (...lines) => `${lines.join("\n")}\n`;
const GATE_PATH = "docs/gates/GATE-fixture.md";
const REASON = "every artifact meets the condition";
const gateText = (decision, reason) => text("# Gate fixture", "", `decision: ${decision}`, `reason: ${reason}`);
const PARTICIPANTS = text("# Participants of this instance", "",
  "| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |", "|---|---|---|---|---|---|---|---|",
  "| ci-bot | CI agent | fixture-llm | 100000 | — | read the repository, write to the repository | GitLab's hosted runners | ci hosted secret FIXTURE_KEY |");
const ENDPOINT = { name: "fixture", kind: "openai-compatible", baseUrl: "https://llm.example.test/v1", model: "fixture-llm" };
const jobStart = (agentM) => ({ id: JOB, kind: "decide-gate", worksOn: ["A LOAN HAS A DUE DATE"], participant: "ci-bot", model: "fixture-llm", route: "ci hosted", run: null, retries: null,
  startedBy: "alice", start: new Date("2026-10-16T08:00:00Z"), agentM, inputs: [], limit: 2, destinations: [{ participant: "ci-bot", place: "GitLab's hosted runners", parts: ["gate-inputs"] }],
  params: { endpoint: ENDPOINT } });

function git(cwd, ...args) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed in ${cwd}: ${r.stderr}`);
  return r.stdout.trim();
}
function write(root, files) {
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), body);
  }
}
// A bare origin whose `main` holds `files`, and the clone of it the job checks out into `folder`.
// Git starts `git maintenance run --auto --detach` after a push it receives, a commit and a fetch (git 2.55 on the CI runners). That process detaches and goes on
// writing into the repository (its lock, objects/) a moment after the command that started it has returned, so a repository removed straight after the command
// can still be written to (ENOTEMPTY). The repositories of these tests need no maintenance: it is off in each.
const NO_MAINTENANCE = ["-c", "gc.auto=0", "-c", "maintenance.auto=false", "-c", "receive.autogc=false"];
const quiet = (dir) => { for (const [key, value] of [["gc.auto", "0"], ["maintenance.auto", "false"], ["receive.autogc", "false"]]) git(dir, "config", key, value); };
function repository(root, name, files, folder) {
  const origin = join(root, `${name}.git`), seed = join(root, `${name}-seed`);
  git(root, "init", "-q", "--bare", "-b", "main", origin);
  quiet(origin);
  git(root, "clone", "-q", ...NO_MAINTENANCE, origin, seed);
  quiet(seed);
  git(seed, "config", "user.name", "Seed");
  git(seed, "config", "user.email", "seed@example.org");
  write(seed, files);
  git(seed, "add", "-A");
  git(seed, "commit", "-q", "-m", "first");
  git(seed, "push", "-q", "origin", "HEAD:refs/heads/main");
  mkdirSync(join(folder, ".."), { recursive: true });
  git(root, "clone", "-q", ...NO_MAINTENANCE, origin, folder);
  quiet(folder);
  git(folder, "config", "user.name", "Alice Agent M token");
  git(folder, "config", "user.email", "alice@example.org");
  return origin;
}
// The layout of the GitLab template: the product's checkout `<root>/ws/product`, which CI_PROJECT_DIR names, and the instance's clone `../instance` next to it.
async function withCheckouts(run) {
  const root = mkdtempSync(join(tmpdir(), "agent-m-gitlab-"));
  const productDir = join(root, "ws", "product"), instanceDir = join(root, "ws", "instance");
  try {
    repository(root, "instance", { "README.md": "# Instance\n", "docs/participants.md": PARTICIPANTS }, instanceDir);
    const agentM = { version: "2026.10.0", commit: git(instanceDir, "rev-parse", "HEAD") };
    const start = startRecord(jobStart(agentM));
    const origin = repository(root, "product", { "README.md": "# Thesis tool\n", [start.path]: start.text }, productDir);
    return await run({ root, productDir, origin, head: git(productDir, "rev-parse", "HEAD") });
  } finally { rmSync(root, { recursive: true, force: true }); }
}
const subjects = (c) => git(c.origin, "log", "--format=%s", "main").split("\n");
const fileAt = (c, path) => git(c.origin, "show", `main:${path}`).concat("\n");

// The fake model endpoint: answers as an OpenAI-compatible one does and records every request.
function fakeEndpoint() {
  const requests = [];
  globalThis.fetch = async (address, init = {}) => {
    requests.push({ address: String(address), headers: init.headers ?? {} });
    const content = JSON.stringify({ draft: { decision: "passed", reason: REASON }, answers: [] });
    return new Response(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 120, completion_tokens: 30 } }), { status: 200 });
  };
  return requests;
}
// The recipe and the writer of the kind decide-gate that this file gives the runner, as the tests of workflow-entries-job-workflow.test.mjs give theirs.
registerStrategies("tests/workflow-entries-gitlab-547.test.mjs", {
  recipes: { "gate-inputs": async () => [{ name: "gate-inputs", text: "gate fixture checks docs/a.md", size: 0, sources: [], required: true }] },
  writers: { "gate-record": async (result, context) => {
    const host = context.product.host, head = await host.readSnapshot("HEAD");
    const { commit } = await host.commitFiles({ branch: "main", expectedHead: head.commit, files: [{ path: GATE_PATH, text: gateText(result.draft.decision, result.draft.reason) }], message: "gate fixture decided" });
    return { commits: [commit], files: [GATE_PATH], pullRequest: null, shown: null, notes: [] };
  } },
});

// TST-547006 · level: unit · module: MOD-workflow-entries
// guards: UC-049; A JOB IS RECORDED IN ITS PRODUCT REPOSITORY; A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET
// given: a product checkout with a queued job of the route `ci hosted`, the instance's clone `../instance` next to it, and a GitLab job's environment whose input AGENT_M_INPUT_JOB names that job
// input: runEntry("onDispatch", the environment) with the same variables once without GITLAB_CI, and once with it
// expect: without GITLAB_CI the outcome is `not run`, the summary says the input job is missing, the origin's main is as it was and the endpoint is not asked; with GITLAB_CI the outcome is `done`, the commits on main are in order the End `end <job>: done`, the writer's `gate fixture decided` and `take <job> (https://gitlab.example.test/alice/thesis-tool/-/pipelines/4711)`; the record's Taken part names the pipeline's address, its End is `done` with `log:` the pipeline's address; the endpoint was asked once with the key in its authorisation header
test("onDispatch — on GitLab the input job is read from AGENT_M_INPUT_JOB and the queued job is run", async () => {
  const requests = fakeEndpoint();
  assert.ok(runEntry, `runEntry: ${entries.error?.message}`);
  await withCheckouts(async (c) => {
    const env = (extra = {}) => gitlab({ CI_PROJECT_DIR: c.productDir, AGENT_M_PRODUCT_DIR: c.productDir, AGENT_M_INPUT_TASK: "", AGENT_M_INPUT_ENDPOINT: "", ...extra });
    const without = env();
    delete without.GITLAB_CI;
    const refused = await runEntry("onDispatch", without, { now: NOW });
    assert.equal(refused.outcome, "not run");
    assert.match(refused.summary, /input job is missing/);
    assert.equal(git(c.origin, "rev-parse", "main"), c.head, "known positive: without GITLAB_CI the origin's main is as it was");
    assert.equal(requests.length, 0);
    const status = await runEntry("onDispatch", env(), { now: NOW });
    assert.equal(status.outcome, "done", status.summary);
    assert.deepEqual(subjects(c).slice(0, 3), [`end ${JOB}: done`, "gate fixture decided", `take ${JOB} (${PIPELINE})`]);
    const record = fileAt(c, `docs/jobs/${JOB}.md`);
    assert.ok(record.includes(`by: ${PIPELINE}`), "the Taken part names the pipeline's address");
    assert.ok(record.includes(`log: ${PIPELINE}`), "the End names the pipeline's address as its log");
    assert.match(record, /## End[^]*state: done/);
    assert.equal(fileAt(c, GATE_PATH), gateText("passed", REASON));
    assert.equal(requests.length, 1);
    assert.equal(requests[0].address, "https://llm.example.test/v1/chat/completions");
    assert.equal(requests[0].headers.Authorization, `Bearer ${KEY}`);
  });
});

// TST-547007 · level: unit · module: MOD-workflow-entries
// guards: UC-049
// given: the product checkout of the previous test and a GitLab job's environment whose input AGENT_M_INPUT_JOB names a job the product holds no record of, and whose other inputs are empty
// input: runEntry("onDispatch", the environment)
// expect: outcome `failed`, the summary saying there is no record of that job — the entry reached the product's records through the instance and the product of the GitLab layout, where it ended `not run` for the missing input before —, and the origin's main as it was
test("onDispatch — on GitLab a job without a record is reported, with nothing written", async () => {
  fakeEndpoint();
  assert.ok(runEntry, `runEntry: ${entries.error?.message}`);
  await withCheckouts(async (c) => {
    const status = await runEntry("onDispatch", gitlab({ CI_PROJECT_DIR: c.productDir, AGENT_M_PRODUCT_DIR: c.productDir, AGENT_M_INPUT_JOB: "JOB-20261016-0801-c3d4", AGENT_M_INPUT_TASK: "", AGENT_M_INPUT_ENDPOINT: "" }), { now: NOW });
    assert.equal(status.outcome, "failed");
    assert.match(status.summary, /There is no record JOB-20261016-0801-c3d4/);
    assert.equal(git(c.origin, "rev-parse", "main"), c.head, "nothing was written");
  });
});

// ---------------------------------------------------------------- the machines of the GitLab job workflow

// TST-547008 · level: unit · module: MOD-workflow-entries
// guards: A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET; A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET
// given: the environment of the GitLab agent's job of the second key — AGENT_M_PART `agent`, AGENT_M_KEY `2`, AGENT_M_RESULT_DIR, AGENT_M_KEY_NAMES `FIXTURE_KEY OTHER_KEY` with OTHER_KEY's value alone, no AGENT_M_TOKEN —; that of the job that writes — AGENT_M_PART `write` —; and that of the plan — AGENT_M_OUTPUT naming its dotenv file, no AGENT_M_PART
// input: ciEnvironment for each
// expect: the agent's job is the machine `agent` with the result's folder and the key OTHER_KEY, no person's token, and the keys { FIXTURE_KEY null, OTHER_KEY its value }; the job that writes is the machine `write` with no key of its own; the plan is no machine, with no result's folder, and its output file is the dotenv file
test("ciEnvironment — a GitLab job of the job workflow names its machine, its result's folder, its key and its output file as GitHub's does", () => {
  assert.ok(ciEnvironment, `ciEnvironment: ${composed.error?.message}`);
  const agent = gitlab({ AGENT_M_PART: "agent", AGENT_M_KEY: "2", AGENT_M_RESULT_DIR: "/builds/alice/agent-m-result", FIXTURE_KEY: undefined, OTHER_KEY: "sk-OTHER-0123456789", AGENT_M_TOKEN: undefined });
  const read = ciEnvironment("onDispatch", agent, NOW).job;
  assert.deepEqual({ part: read.part, resultDir: read.resultDir, agentKey: read.agentKey, personToken: read.personToken, keys: read.keys },
    { part: "agent", resultDir: "/builds/alice/agent-m-result", agentKey: "OTHER_KEY", personToken: null, keys: { FIXTURE_KEY: null, OTHER_KEY: "sk-OTHER-0123456789" } });
  const write = ciEnvironment("writeResult", gitlab({ AGENT_M_PART: "write", AGENT_M_RESULT_DIR: "/builds/alice/thesis-tool/agent-m-result" }), NOW).job;
  assert.deepEqual({ part: write.part, resultDir: write.resultDir, agentKey: write.agentKey }, { part: "write", resultDir: "/builds/alice/thesis-tool/agent-m-result", agentKey: null });
  const plan = ciEnvironment("chooseAgentKey", gitlab({ AGENT_M_OUTPUT: "/builds/alice/thesis-tool/agent-m-plan.env" }), NOW).job;
  assert.deepEqual({ part: plan.part, resultDir: plan.resultDir, outputFile: plan.outputFile }, { part: null, resultDir: null, outputFile: "/builds/alice/thesis-tool/agent-m-plan.env" });
});

// TST-547009 · level: unit · module: MOD-workflow-entries
// guards: A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET
// given: the product checkout with a queued job whose participant's route names FIXTURE_KEY, the instance's clone next to it, and the GitLab plan's environment of a pipeline the API started for a hand-over to a model endpoint — CI_PIPELINE_SOURCE `api`, the inputs endpoint and secret `OTHER_KEY`, AGENT_M_KEY_NAMES `FIXTURE_KEY OTHER_KEY`, no key's value and no token, AGENT_M_OUTPUT naming a file
// input: runEntry("chooseAgentKey", that environment)
// expect: `done`, and the file holds exactly the dotenv line `AGENT_M_AGENT=2` — the place of the key the input secret names, read for a start by the API as for GitHub's workflow_dispatch, not the key of the queued job's participant; the origin's main is as it was
test("chooseAgentKey — on GitLab a pipeline the API started takes the key its input secret names and leaves it as the dotenv line AGENT_M_AGENT", async () => {
  assert.ok(runEntry, `runEntry: ${entries.error?.message}`);
  await withCheckouts(async (c) => {
    const output = join(c.root, "agent-m-plan.env");
    const status = await runEntry("chooseAgentKey", gitlab({ CI_PROJECT_DIR: c.productDir, AGENT_M_PRODUCT_DIR: c.productDir, AGENT_M_INPUT_SECRET: "OTHER_KEY", AGENT_M_INPUT_TASK: "",
      AGENT_M_INPUT_ENDPOINT: JSON.stringify(ENDPOINT), FIXTURE_KEY: undefined, AGENT_M_TOKEN: undefined, AGENT_M_OUTPUT: output }), { now: NOW });
    assert.equal(status.outcome, "done", status.summary);
    assert.equal(readFileSync(output, "utf8"), "AGENT_M_AGENT=2\n");
    assert.equal(git(c.origin, "rev-parse", "main"), c.head, "nothing was written");
  });
});
