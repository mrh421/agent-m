// Agent M's job workflow for a product (ITM-322) — MOD-runtimes' jobWorkflowFiles(server, instance, secrets, runners) and the
// templates workflow/github.yml and workflow/gitlab.yml, as the accepted text of docs/architecture/MOD-runtimes.md states them (Data:
// Agent M's job workflow in a product; Interfaces: jobWorkflowFiles), for UC-010 and UC-011 1c: `.github/workflows/agent-m-jobs.yml`
// on GitHub, `.gitlab/agent-m-jobs.yml` on GitLab with the include the product's `.gitlab-ci.yml` needs; started by a push to the
// default branch that changes `docs/jobs/` or `docs/gates/`, a pull request closed or merged, a completed check, a daily schedule and
// a start from the server's own page with a job's identifier; one job for each route of the product's CI agents — the server's runners
// and each self-hosted runner by its label —, each checking out the product with the person's token, checking out the instance at the
// commit the file names and running `node src/workflow-entries/main.mjs <entry>`; the agents' keys only by their secrets' names. The
// entries (ITM-365) and the settings line that installs the files (ITM-351) are not part of this item.
// Run: node --test tests/runtimes-workflow.test.mjs
//
// Module: MOD-runtimes
// Guards: UC-010; UC-011; A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET; A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET
// Guards: NO SECRET IN THE REPOSITORY; A SELF-HOSTED RUNNER SERVES AGENT M ONLY FROM A PRIVATE REPOSITORY; AGENT M WORKS WITHOUT A LOCAL INSTALLATION
// Level: unit
//
// jobWorkflowFiles is pure and gives text, of which this file asks what the module file states and no more: the paths; the events and
// the entry each starts; the jobs and the runner each takes; the instance and its commit; the names of the secrets and nothing that
// could be a value. No YAML parser stands in this repository, so the files are read as text: a GitHub file as the steps that begin at
// `      - ` and the jobs that begin at `  <id>:` under `jobs:`, a GitLab file as the jobs that begin at the margin and the rules that
// begin at `    - if:`. The module file gives the arguments' meaning only by their names: `instance.repository` is read as `owner/name`
// on github.com, `secrets.token` as the name of the secret that holds the person's token and `secrets.keys` as the names of the
// secrets that hold the agents' keys; the entries find the runner a job is for in `AGENT_M_RUNNER` and the product's checkout in
// `AGENT_M_PRODUCT_DIR`, and the names of the secrets in `AGENT_M_TOKEN_NAME` and `AGENT_M_KEY_NAMES`. The include entry GitLab needs
// is returned as the text of `.gitlab-ci.yml` to add, a second file. The inputs `job`, `task` and `endpoint` of a pipeline started
// through the API (ITM-532) are read as the item states them: declared in the `spec:inputs` header of the main `.gitlab-ci.yml`, each
// with `default: ""`, and passed on to `.gitlab/agent-m-jobs.yml` through `include:` … `inputs:` as `$[[ inputs.<name> ]]` ("Inputs for
// pipelines must be defined in the `spec:inputs` header of the main `.gitlab-ci.yml` file", docs.gitlab.com, "CI/CD inputs"); the included
// file declares the same three and sets the variables AGENT_M_INPUT_JOB, AGENT_M_INPUT_TASK and AGENT_M_INPUT_ENDPOINT, each to `$[[ inputs.<name> ]]`
// as the whole value ("interpolated into the configuration as its specified type", so a task with quotes or line breaks stays one string);
// the one rule of the entry onDispatch is `$CI_PIPELINE_SOURCE == "web" || $CI_PIPELINE_SOURCE == "api"`. No test reads a document for its
// expected result: every expected text and name below is written in the test. The names AGENT_M_INPUT_… are the ones MOD-workflow-entries'
// ciEnvironment reads from a GitLab job; TST-532104 gives that function an environment built from the template and from nothing else.
// Each test states its input and its expected result before it runs
// (given / input / expect). A name the module does not provide yet is undefined here, so that each test fails by itself. Nothing reaches
// the network. The counter-proofs are recorded in the pull request.
//
// The templates are files beside the module (workflow/github.yml, workflow/gitlab.yml; MOD-runtimes, Parts), and the page uses the
// module in a browser (MOD-runtimes, Responsibility: "The page uses it in a browser; its writer and its workflow files are used in Node
// as well"). So the module reads them once, as it is loaded, as the modules that read their own data files do (MOD-test-schedule's
// templates/ among them): from the disk in Node, from its own address in a browser (ITM-1202); the repository's check NO SERVER (tests/
// test_no_backend.py) lists MOD-runtimes among those modules. The last two tests load a copy of the module without the disk, as a
// browser loads it, whose fetch answers the module's own addresses with the real files there, or with 404.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import * as runtimes from "../src/runtimes/index.mjs";
import { ciEnvironment } from "../src/workflow-entries/compose.mjs";

const { jobWorkflowFiles } = runtimes;

const COMMIT = "0123456789abcdef0123456789abcdef01234567";
const INSTANCE = { repository: "alice/agent-m", commit: COMMIT };
const SECRETS = { token: "AGENT_M_TOKEN", keys: ["CLAUDE_KEY", "OPENAI_KEY"] };
const NAMES = [SECRETS.token, ...SECRETS.keys];
const RUNNERS = ["gpu"];
const files = (server, runners = RUNNERS, secrets = SECRETS) => jobWorkflowFiles(server, INSTANCE, secrets, runners);
const workflow = (server, runners, secrets) => files(server, runners, secrets)[0].text;
const MAIN = "node src/workflow-entries/main.mjs";

// The `spec:` header both GitLab files start with, then the `---` that ends it: the three inputs of a pipeline started through the API, each with an empty default.
const SPEC_HEADER = 'spec:\n  inputs:\n    job:\n      default: ""\n    task:\n      default: ""\n    endpoint:\n      default: ""\n    secret:\n      default: ""\n---\n';

// The GitHub events of the five entries they start (MOD-runtimes, Data).
const GITHUB_EVENTS = { onRecordsChanged: "push", onPullRequestClosed: "pull_request", onCheckCompleted: "check_run",
  onSchedule: "schedule", onDispatch: "workflow_dispatch" };

// The jobs of a GitHub file: { id, text } for each `  <id>:` under `jobs:`; the steps of a job: the text from each `      - `.
function githubJobs(text) {
  const rest = text.slice(text.indexOf("\njobs:\n") + 7);
  return rest.split(/\n(?=  [A-Za-z0-9_-]+:\n)/).map((block) => ({ id: /^\s*([A-Za-z0-9_-]+):/.exec(block)[1], text: block }));
}
const stepsOf = (job) => job.text.split(/\n(?=      - )/).slice(1);
// The jobs of a GitLab file: { id, text } for each job that begins at the margin; the rules of a job: the text from each `    - if:`.
const gitlabJobs = (text) => text.split(/\n(?=[A-Za-z0-9_-]+:\n)/).filter((block) => /^agent-m-/.test(block))
  .map((block) => ({ id: /^([A-Za-z0-9_-]+):/.exec(block)[1], text: block }));
const rulesOf = (job) => job.text.split(/\n(?=    - if:)/).slice(1);

// ---------------------------------------------------------------- the files

// TST-472723 · level: unit · module: MOD-runtimes
// guards: UC-010; AGENT M WORKS WITHOUT A LOCAL INSTALLATION
// given: an instance alice/agent-m at a commit, two secret names for keys and one for the token, and the runner label gpu
// input: jobWorkflowFiles("github", …) and jobWorkflowFiles("gitlab", …)
// expect: for GitHub .github/workflows/agent-m-jobs.yml, then the file beside it, .github/workflows/agent-m-main-changed.yml; for GitLab .gitlab/agent-m-jobs.yml first, then the file the product's .gitlab-ci.yml needs, at the path .gitlab-ci.yml, then the file beside the job workflow, .gitlab/agent-m-main-changed.yml; the .gitlab-ci.yml's text is exactly: a `spec:` header with `inputs:` job, task and endpoint, each with `default: ""`, then a line `---`, then `include:` of the local file ".gitlab/agent-m-jobs.yml" with `inputs:` job, task and endpoint, each passed as the whole value `$[[ inputs.<name> ]]`, and of the local file ".gitlab/agent-m-main-changed.yml"; each file's text is not empty
test("jobWorkflowFiles — the file of GitHub, and the file of GitLab with the spec and include its .gitlab-ci.yml needs", () => {
  const github = files("github"), gitlab = files("gitlab");

  assert.deepEqual(github.map((file) => file.path), [".github/workflows/agent-m-jobs.yml", ".github/workflows/agent-m-main-changed.yml"]);
  assert.deepEqual(gitlab.map((file) => file.path), [".gitlab/agent-m-jobs.yml", ".gitlab-ci.yml", ".gitlab/agent-m-main-changed.yml"]);
  for (const file of [...github, ...gitlab]) assert.match(file.text, /\S/, file.path);
  assert.equal(gitlab[1].text, 'spec:\n  inputs:\n    job:\n      default: ""\n    task:\n      default: ""\n    endpoint:\n      default: ""\n    secret:\n      default: ""\n---\n'
    + 'include:\n  - local: ".gitlab/agent-m-jobs.yml"\n    inputs:\n      job: $[[ inputs.job ]]\n      task: $[[ inputs.task ]]\n      endpoint: $[[ inputs.endpoint ]]\n      secret: $[[ inputs.secret ]]\n'
    + '  - local: ".gitlab/agent-m-main-changed.yml"\n');
});

// ---------------------------------------------------------------- the events

// TST-472724 · level: unit · module: MOD-runtimes
// guards: UC-010
// given: the two files for the instance, the secrets and the runner above
// input: the triggers and the steps of the GitHub file; the rules of each job of the GitLab file
// expect: GitHub — a push that changes docs/jobs/ or docs/gates/, a pull request closed, a check run completed, a schedule once a day, and a start by hand with the job's identifier as its input; the entries that run an agent — push onRecordsChanged, dispatch onDispatch — in each agent's job, each once, after the plan, which runs only on a dispatch or a push to the default branch; the entries that run none — pull request onPullRequestClosed, check onCheckCompleted, schedule onSchedule — and writeResult, on a dispatch or a push to the default branch, in the job that writes, each once; every step that runs an entry runs `node src/workflow-entries/main.mjs <entry>` on its event. GitLab — the plan and each agent's job have a rule for a push to the default branch that changes docs/jobs/ or docs/gates/ and one for a start from the page or the API, the agent's jobs setting AGENT_M_ENTRY to onRecordsChanged and onDispatch; the job that writes has the push rule, a second push rule for a push of any branch, then pipeline and schedule, then the start, setting writeResult, onPullRequestClosed, onCheckCompleted, onSchedule and writeResult; the plan's script runs chooseAgentKey, every other job's the entry its rule sets
test("jobWorkflowFiles — each event starts its entry, on GitHub and on GitLab", () => {
  const github = workflow("github");
  assert.match(github, /\n  push:\n(?:.*\n)*?    paths:\n(?:.*\n)*?      - ["']?docs\/jobs\/\*\*["']?\n(?:.*\n)*?      - ["']?docs\/gates\/\*\*["']?\n/);
  assert.match(github, /\n  pull_request:\n    types: \[closed\]\n/);
  assert.match(github, /\n  check_run:\n    types: \[completed\]\n/);
  assert.match(github, /\n  schedule:\n    - cron: ["'][^"']+["']\n/);
  assert.match(github, /\n  workflow_dispatch:\n    inputs:\n      job:\n/);
  const DEFAULT_PUSH = "github.event_name == 'push' && github.ref == format('refs/heads/{0}', github.event.repository.default_branch)";
  for (const job of githubJobs(github)) {
    const kind = job.id.endsWith("-plan") ? "plan" : /-agent-\d+$/.test(job.id) ? "agent" : "write";
    const entries = { plan: ["chooseAgentKey"], agent: ["onRecordsChanged", "onDispatch", "leaveResult"], write: ["writeResult", "onPullRequestClosed", "onCheckCompleted", "onSchedule"] }[kind];
    assert.deepEqual(stepsOf(job).filter((step) => step.includes(MAIN)).map((step) => /main\.mjs (\w+)/.exec(step)[1]), entries, job.id);
    for (const entry of entries.filter((each) => Object.hasOwn(GITHUB_EVENTS, each))) {
      const [step] = stepsOf(job).filter((each) => each.includes(`${MAIN} ${entry}`));
      assert.ok(step.includes(`github.event_name == '${GITHUB_EVENTS[entry]}'`), `${job.id}: ${entry} on ${GITHUB_EVENTS[entry]}: ${step}`);
    }
    if (kind === "plan") assert.ok(job.text.includes(`if: github.event_name == 'workflow_dispatch' || (${DEFAULT_PUSH})`), `${job.id}: only a dispatch or a push to the default branch`);
    if (kind === "agent") assert.match(job.text, /\n    needs: \S+-plan\n/, job.id);
    if (kind === "write") assert.ok(stepsOf(job).find((step) => step.includes(`${MAIN} writeResult`)).includes(DEFAULT_PUSH), `${job.id}: the result written on a push only to the default branch`);
  }

  const gitlab = gitlabJobs(workflow("gitlab"));
  assert.ok(gitlab.length > 0);
  const PUSH = '$CI_PIPELINE_SOURCE == "push" && $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH', STARTED = '$CI_PIPELINE_SOURCE == "web" || $CI_PIPELINE_SOURCE == "api"';
  for (const job of gitlab) {
    const kind = job.id.endsWith("-plan") ? "plan" : /-agent-\d+$/.test(job.id) ? "agent" : "write";
    const sources = { plan: [PUSH, STARTED], agent: [PUSH, STARTED],
      write: [PUSH, '$CI_PIPELINE_SOURCE == "push"', '$CI_PIPELINE_SOURCE == "pipeline"', '$CI_PIPELINE_SOURCE == "schedule"', STARTED] }[kind];
    const entries = { plan: [], agent: ["onRecordsChanged", "onDispatch"], write: ["writeResult", "onPullRequestClosed", "onCheckCompleted", "onSchedule", "writeResult"] }[kind];
    assert.deepEqual(rulesOf(job).map((rule) => /^    - if: '(.*)'\n/.exec(rule)[1]), sources, `${job.id}: a rule for each event it runs on`);
    assert.deepEqual(rulesOf(job).flatMap((rule) => [...rule.matchAll(/AGENT_M_ENTRY: (\w+)/g)].map((m) => m[1])), entries, `${job.id}: the entry of each rule`);
    assert.match(rulesOf(job)[0], /changes:\n\s+- docs\/jobs\/\*\*\/\*\n\s+- docs\/gates\/\*\*\/\*/, `${job.id}: the push rule for a change of the records`);
    assert.ok(job.text.includes(kind === "plan" ? `${MAIN} chooseAgentKey` : `${MAIN} "$AGENT_M_ENTRY"`), `${job.id}: the script runs the entry`);
  }
});

// TST-1259001 · level: unit · module: MOD-runtimes
// guards: GITLAB PRODUCTS ARE SUPPORTED; UC-012
// given: the GitLab file for the instance, the secrets and the runner above; MOD-runtimes' table: the job workflow runs `onPullRequestClosed` on "a pull or merge request closed or merged"
// input: the rules of each route's job that writes
// expect: no rule runs on `merge_request_event`, a pipeline of an open merge request, which is not its merge; the rule that sets onPullRequestClosed is a push of any branch with no `changes:`, the pipeline that GitLab starts on the target branch, whichever it is, when a merge request is merged, and it comes after the rule that sets writeResult for a push to the default branch that changes docs/jobs/ or docs/gates/; counter-proof: the plan's and the agent's jobs have no such rule
test("jobWorkflowFiles — on GitLab the job that writes runs onPullRequestClosed on the push that merges a merge request, not on a merge request's own pipeline", () => {
  const PUSH = '$CI_PIPELINE_SOURCE == "push"';
  for (const job of gitlabJobs(workflow("gitlab"))) {
    const rules = rulesOf(job);
    const closing = rules.filter((rule) => rule.includes("AGENT_M_ENTRY: onPullRequestClosed"));
    if (!/-(?:plan|agent-\d+)$/.test(job.id)) {
      assert.ok(!job.text.includes("merge_request_event"), `${job.id}: no rule runs on a merge request's own pipeline`);
      assert.equal(closing.length, 1, job.id);
      assert.ok(closing[0].startsWith(`    - if: '${PUSH}'\n`), `${job.id}: a push of any branch: ${closing[0]}`);
      assert.ok(!closing[0].includes("changes:"), `${job.id}: any push, whatever it changes`);
      const entries = rules.flatMap((rule) => [...rule.matchAll(/AGENT_M_ENTRY: (\w+)/g)].map((m) => m[1]));
      assert.ok(entries.indexOf("writeResult") < entries.indexOf("onPullRequestClosed"), `${job.id}: the records' push rule comes first`);
    } else assert.equal(closing.length, 0, `counter-proof: ${job.id} runs no such entry`);
  }
});

// GitLab's start of a pipeline, read from the generated file ("rules:", docs.gitlab.com): a job is in the pipeline when one of its rules holds — its `if:`, and, where it
// has `changes:`, a changed path below one of them —, and the first rule that holds sets its variables. The `if:` expressions of the file are comparisons with `==`,
// joined by `&&` and `||`. What the job then runs is its script's lines that run an entry, run by `sh` with those variables and with `node` standing in for Node, which
// only names the entry it is given; nothing else of the script runs, and nothing reaches the network.
const valueOf = (side, variables) => (side.startsWith("$") ? variables[side.slice(1)] ?? null : JSON.parse(side));
const holds = (expression, variables) => expression.split("||").some((any) => any.split("&&").every((comparison) => {
  const [left, right] = comparison.split("==").map((side) => side.trim());
  return valueOf(left, variables) === valueOf(right, variables);
}));
const changesOf = (rule) => [...(/\n      changes:\n((?:        - .*\n?)+)/.exec(rule)?.[1] ?? "").matchAll(/- (.+)/g)].map((match) => match[1]);
const below = (glob, path) => path.startsWith(glob.replace(/\*\*\/\*$/, ""));
/** The jobs of the GitLab file GitLab starts for a pipeline of these variables whose push changed these paths, each with the entries its script runs: [{ id, entries }]. */
function pipelineOf(text, variables, changed) {
  return gitlabJobs(text).flatMap((job) => {
    const rule = rulesOf(job).find((each) => holds(/^    - if: '(.*)'\n/.exec(each)[1], variables)
      && (changesOf(each).length === 0 || changed.some((path) => changesOf(each).some((glob) => below(glob, path)))));
    if (!rule) return [];
    const set = Object.fromEntries([...rule.matchAll(/^ {8}(AGENT_M_[A-Z_]+): (\S+)$/gm)].map((match) => [match[1], match[2]]));
    const lines = job.text.slice(job.text.indexOf("\n  script:\n")).split("\n").filter((line) => /^    - .*main\.mjs/.test(line)).map((line) => line.slice(6));
    const run = spawnSync("sh", ["-c", `node() { printf '%s\\n' "$2"; }\n${lines.join("\n")}`], { env: { PATH: process.env.PATH, ...variables, ...set }, encoding: "utf8" });
    return [{ id: job.id, entries: run.stdout.split("\n").filter(Boolean) }];
  });
}
const PIPELINE = (source, branch) => ({ CI_PIPELINE_SOURCE: source, CI_COMMIT_BRANCH: branch, CI_DEFAULT_BRANCH: "main", CI_PROJECT_DIR: "/builds/product" });

// TST-1289001 · level: unit · module: MOD-runtimes
// guards: GITLAB PRODUCTS ARE SUPPORTED; UC-012
// given: the GitLab file for the instance, the secrets and the runner gpu above; MOD-runtimes' table: `onPullRequestClosed` for "a pull or merge request closed or merged"; GitLab starts, for the merge of a merge request, the push pipeline of its target branch, and of a push the first rule of a job that holds sets its variables; the default branch main
// input: the pipeline of (1) the push to main that merges a merge request whose commit changes docs/jobs/JOB-20261029-0900-a1b2.md and src/store/read.mjs, (2) the push to sprint/team1/120 that merges one into that sprint branch, changing src/store/read.mjs; known positive: (3) a push to main that changes src/store/read.mjs; counter-proofs: (4) a merge request's own pipeline (merge_request_event) and (5) the schedule
// expect: (1) each route's job that writes runs writeResult and then onPullRequestClosed; (2) only the jobs that write start, agent-m-hosted and agent-m-runner-gpu, each running onPullRequestClosed and nothing else; (3) the same two jobs, each running onPullRequestClosed once; (4) no job starts; (5) the jobs that write run onSchedule alone
test("jobWorkflowFiles — on GitLab every merged merge request runs onPullRequestClosed, one whose commit changes the records and one into another branch than the default one", () => {
  const text = workflow("gitlab");
  const writing = (pipeline) => pipeline.filter((job) => !/-(?:plan|agent-\d+)$/.test(job.id));
  const WRITE_JOBS = ["agent-m-hosted", "agent-m-runner-gpu"];

  const records = pipelineOf(text, PIPELINE("push", "main"), ["docs/jobs/JOB-20261029-0900-a1b2.md", "src/store/read.mjs"]);
  assert.deepEqual(writing(records), WRITE_JOBS.map((id) => ({ id, entries: ["writeResult", "onPullRequestClosed"] })), "(1) a merge whose commit changes docs/jobs/ runs both entries");

  const sprint = pipelineOf(text, PIPELINE("push", "sprint/team1/120"), ["src/store/read.mjs"]);
  assert.deepEqual(sprint, WRITE_JOBS.map((id) => ({ id, entries: ["onPullRequestClosed"] })), "(2) a merge into a sprint branch runs onPullRequestClosed");

  assert.deepEqual(pipelineOf(text, PIPELINE("push", "main"), ["src/store/read.mjs"]), WRITE_JOBS.map((id) => ({ id, entries: ["onPullRequestClosed"] })), "(3) known positive: a merge into main");
  assert.deepEqual(pipelineOf(text, { ...PIPELINE("merge_request_event", null), CI_MERGE_REQUEST_IID: "7" }, ["src/store/read.mjs"]), [], "(4) an open merge request's pipeline starts no job");
  assert.deepEqual(writing(pipelineOf(text, PIPELINE("schedule", "main"), [])), WRITE_JOBS.map((id) => ({ id, entries: ["onSchedule"] })), "(5) the schedule closes no merge request");
});

// ---------------------------------------------------------------- the routes

// TST-472725 · level: unit · module: MOD-runtimes
// guards: A SELF-HOSTED RUNNER SERVES AGENT M ONLY FROM A PRIVATE REPOSITORY; AGENT M WORKS WITHOUT A LOCAL INSTALLATION; UC-011
// given: the runner labels (1) gpu, (2) none, (3) gpu and cpu
// input: jobWorkflowFiles for each, on GitHub and on GitLab
// expect: for each route — the server's runners and each runner by its label, in that order: (1) two, (2) one, (3) three —, on each server the plan, an agent's job for no key and for each of the two keys, and the job that writes; GitHub: the agent's jobs of the hosted route run on ubuntu-latest and a runner's on [self-hosted, "<label>"], the plan and the job that writes on ubuntu-latest for every route; GitLab: the hosted route's jobs have no tag, a runner's agent's jobs have the tag of its label and its plan and job that writes none; every job takes the product's jobs of its own route, AGENT_M_RUNNER being `hosted` or the label
test("jobWorkflowFiles — one job for each route of the product's CI agents", () => {
  for (const [runners, labels] of [[["gpu"], ["gpu"]], [[], []], [["gpu", "cpu"], ["gpu", "cpu"]]]) {
    const github = githubJobs(workflow("github", runners)), gitlab = gitlabJobs(workflow("gitlab", runners));

    const routeJobs = (id) => [`${id}-plan`, `${id}-agent-0`, `${id}-agent-1`, `${id}-agent-2`, id];
    assert.deepEqual(github.map((job) => job.id), ["hosted", ...labels.map((label) => `runner-${label}`)].flatMap(routeJobs), `GitHub with ${runners}`);
    assert.deepEqual(gitlab.map((job) => job.id), ["agent-m-hosted", ...labels.map((label) => `agent-m-runner-${label}`)].flatMap(routeJobs), `GitLab with ${runners}`);
    for (const job of github.filter((each) => !/-agent-\d+$/.test(each.id))) assert.match(job.text, /\n    runs-on: ubuntu-latest\n/, job.id);
    for (const job of github.slice(0, 5)) {
      assert.match(job.text, /\n    runs-on: ubuntu-latest\n/, job.id);
      assert.match(job.text, /AGENT_M_RUNNER: "hosted"\n/, job.id);
    }
    for (const job of gitlab.slice(0, 5)) {
      assert.ok(!/\n {2,4}tags:/.test(job.text), `${job.id}: the hosted route's jobs have no tag`);
      assert.match(job.text, /AGENT_M_RUNNER: "hosted"\n/, job.id);
    }
    labels.forEach((label, at) => {
      for (const job of github.slice(5 * (at + 1), 5 * (at + 2))) assert.match(job.text, new RegExp(`AGENT_M_RUNNER: "${label}"\\n`), job.id);
      for (const job of github.slice(5 * (at + 1) + 1, 5 * (at + 1) + 4)) assert.match(job.text, new RegExp(`\\n    runs-on: \\[self-hosted, "${label}"\\]\\n`), job.id);
      const route = gitlab.slice(5 * (at + 1), 5 * (at + 2));
      for (const job of route) assert.match(job.text, new RegExp(`AGENT_M_RUNNER: "${label}"\\n`), job.id);
      for (const job of route.slice(1, 4)) assert.match(job.text, new RegExp(`\\n  tags: \\["${label}"\\]\\n`), job.id);
      for (const job of [route[0], route[4]]) assert.ok(!/\n {2,4}tags:/.test(job.text), `${job.id}: the plan and the job that writes have no tag`);
    });
  }
});

// ---------------------------------------------------------------- the instance and the product

// TST-472726 · level: unit · module: MOD-runtimes
// guards: UC-010; A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET
// given: the instance alice/agent-m at the commit 0123…4567
// input: jobWorkflowFiles on each server
// expect: GitHub — in every job the product checked out, then alice/agent-m checked out at that commit — and at no other ref —, the entries run from the instance's checkout; in the job that writes both checkouts take the person's token, in the plan and the agent's jobs neither takes a token; GitLab — in every job the instance cloned from github.com without a token — the person's token is the GitLab server's — and set to that commit before the entry runs, the product's directory handed over as AGENT_M_PRODUCT_DIR; on both the commit stands in the file once for each job, and nothing runs on a branch name of the instance
test("jobWorkflowFiles — the product is checked out with the person's token and the instance at the commit the file names", () => {
  for (const job of githubJobs(workflow("github"))) {
    const checkouts = stepsOf(job).filter((step) => step.includes("actions/checkout"));
    assert.equal(checkouts.length, 2, job.id);
    assert.match(checkouts[0], /path: product(\n|$)/);
    const writes = !/-(plan|agent-\d+)$/.test(job.id);
    for (const checkout of checkouts) assert.equal(/token: \$\{\{ secrets\.AGENT_M_TOKEN \}\}/.test(checkout), writes, `${job.id}: ${checkout}`);
    assert.equal(checkouts.filter((checkout) => checkout.includes("token:")).length, writes ? 2 : 0, job.id);
    assert.match(checkouts[1], /repository: alice\/agent-m\n/);
    assert.ok(checkouts[1].includes(`ref: ${COMMIT}\n`), checkouts[1]);
    assert.match(checkouts[1], /path: instance(\n|$)/);
    assert.ok(stepsOf(job).filter((step) => step.includes(MAIN)).every((step) => step.includes("working-directory: instance")), job.id);
    assert.match(job.text, /AGENT_M_PRODUCT_DIR: \$\{\{ github\.workspace \}\}\/product\n/);
    assert.equal(job.text.split(COMMIT).length - 1, 1, `${job.id}: the commit once`);
  }
  for (const job of gitlabJobs(workflow("gitlab"))) {
    assert.ok(job.text.includes(`AGENT_M_COMMIT: "${COMMIT}"\n`), job.id);
    assert.ok(job.text.includes('AGENT_M_INSTANCE: "alice/agent-m"\n'), job.id);
    assert.ok(job.text.includes('\n    - git clone "https://github.com/$AGENT_M_INSTANCE.git" ../instance\n'), `${job.id}: the instance cloned without a token, which is the product's server's`);
    assert.match(job.text, /checkout "\$AGENT_M_COMMIT"/);
    assert.match(job.text, /AGENT_M_PRODUCT_DIR="\$CI_PROJECT_DIR"/);
    assert.equal(job.text.split(COMMIT).length - 1, 1, `${job.id}: the commit once`);
  }
});

// ---------------------------------------------------------------- the secrets

// TST-472727 · level: unit · module: MOD-runtimes
// guards: A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET; A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET; NO SECRET IN THE REPOSITORY
// given: the secrets AGENT_M_TOKEN, CLAUDE_KEY and OPENAI_KEY, and a second call with the token secret PERSON_TOKEN; and names that are no names of a secret
// input: jobWorkflowFiles on each server; and with a name that holds a space, `${{ secrets.X }}`, a quote or a newline, a commit that is no 40-digit hex, a server that is neither, a repository that is no owner/name, and a runner label with a space
// expect: GitHub — every secret the file reads is one of the three, as `${{ secrets.<name> }}`, each of the three read, and the workflow's own token (GITHUB_TOKEN) not at all; GitLab — every variable it reads is one of the three, a predefined CI_ variable, GITLAB_USER_NAME and GITLAB_USER_EMAIL for the committer, or one of Agent M's own AGENT_M_…, the names listed in AGENT_M_TOKEN_NAME and AGENT_M_KEY_NAMES; no file holds anything of the form of a token (ghp_, github_pat_, glpat-); the second call reads PERSON_TOKEN and no AGENT_M_TOKEN secret; each bad argument throws a TypeError and no file is made
test("jobWorkflowFiles — the secrets are named and never valued, the token is the person's and not the workflow's", () => {
  const github = workflow("github"), gitlab = workflow("gitlab");

  const read = [...github.matchAll(/secrets\.([A-Za-z0-9_]+)/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(read)].sort(), [...NAMES].sort());
  for (const name of NAMES) assert.ok(github.includes(`${name}: \${{ secrets.${name} }}`) || name === SECRETS.token, name);
  assert.ok(github.includes("AGENT_M_TOKEN: ${{ secrets.AGENT_M_TOKEN }}"));
  assert.ok(!/GITHUB_TOKEN|github\.token/.test(github), "the workflow's own token is not used");
  assert.ok(github.includes('AGENT_M_TOKEN_NAME: "AGENT_M_TOKEN"') && github.includes('AGENT_M_KEY_NAMES: "CLAUDE_KEY OPENAI_KEY"'));

  const variables = [...gitlab.matchAll(/\$\{?([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1])
    .filter((name) => !/^(CI_|GITLAB_USER_(NAME|EMAIL)$|AGENT_M_)/.test(name));
  assert.deepEqual(variables, [], "every variable the GitLab file reads is predefined or Agent M's own");
  assert.ok(gitlab.includes('AGENT_M_TOKEN_NAME: "AGENT_M_TOKEN"') && gitlab.includes('AGENT_M_KEY_NAMES: "CLAUDE_KEY OPENAI_KEY"'));
  for (const text of [github, gitlab]) assert.ok(!/ghp_|github_pat_|glpat-/.test(text), "nothing of the form of a token");

  const other = workflow("github", RUNNERS, { token: "PERSON_TOKEN", keys: ["CLAUDE_KEY"] });
  assert.ok(other.includes("AGENT_M_TOKEN: ${{ secrets.PERSON_TOKEN }}") && !other.includes("secrets.AGENT_M_TOKEN"));
  assert.ok(workflow("gitlab", RUNNERS, { token: "PERSON_TOKEN", keys: [] }).includes('AGENT_M_TOKEN_NAME: "PERSON_TOKEN"'));

  for (const bad of ["MY KEY", "${{ secrets.X }}", 'A"B', "A\nB", "", "1KEY"]) {
    assert.throws(() => files("github", RUNNERS, { token: SECRETS.token, keys: [bad] }), TypeError, `key ${JSON.stringify(bad)}`);
    assert.throws(() => files("gitlab", RUNNERS, { token: bad, keys: [] }), TypeError, `token ${JSON.stringify(bad)}`);
  }
  assert.throws(() => jobWorkflowFiles("github", { repository: "alice/agent-m", commit: "main" }, SECRETS, []), TypeError, "a commit");
  assert.throws(() => jobWorkflowFiles("bitbucket", INSTANCE, SECRETS, []), { name: "TypeError", message: /GitHub or GitLab/ }, "a server");
  for (const repository of ["alice", "alice/agent m", "alice/agent-m/extra", "", "alice/agent-m\n  evil: x"]) {
    assert.throws(() => jobWorkflowFiles("github", { repository, commit: COMMIT }, SECRETS, []), TypeError, `repository ${JSON.stringify(repository)}`);
  }
  assert.throws(() => files("github", ["my gpu"]), TypeError, "a label");
});

// ---------------------------------------------------------------- the inputs of a pipeline started through the API

// The variables a GitLab job sets for the inputs: [[ variable, the value it is set to ]], in the order they stand in the job's text.
const inputVariables = (job) => [...job.text.matchAll(/^ {4}(AGENT_M_INPUT_[A-Z_]+): (.*)$/gm)].map((m) => [m[1], m[2]]);
// The lines of a file that are not comments.
const codeLines = (text) => text.split("\n").filter((line) => !/^\s*#/.test(line));
// A task with double quotes, single quotes, a backslash, a dollar sign, braces and two line breaks.
const TASK = 'Fix the "loan due date" for \'Ana\'\nand keep C:\\temp, $HOME and {braces}\nas they stand';
const JOB_ID = "JOB-20261016-0800-a1b2";
const ENDPOINT = '{"kind":"openai-compatible","baseUrl":"https://llm.example.test/v1","model":"fixture-llm"}';
const WHEN = new Date("2026-10-16T09:00:00Z");

// TST-532101 · level: unit · module: MOD-runtimes
// guards: UC-049; A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET
// given: the two files for the instance, the secrets and the runner above
// input: the text of the GitLab job file, and of the GitHub file
// expect: the GitLab job file begins with exactly `spec:`, `  inputs:`, job, task and endpoint each with `default: ""`, and then the line `---`, which stands once; the GitHub file holds no `spec:` header and no `$[[`
test("jobWorkflowFiles — the GitLab job file declares job, task and endpoint with an empty default, the GitHub file declares none of it", () => {
  const gitlab = workflow("gitlab");
  assert.ok(gitlab.startsWith(SPEC_HEADER), gitlab.slice(0, 200));
  assert.equal(gitlab.split("\n---\n").length, 2, "one header, ended by one `---`");
  const github = workflow("github");
  assert.ok(!/^spec:/m.test(github) && !github.includes("$[["), "GitHub's file has no GitLab input syntax");
});

// TST-532102 · level: unit · module: MOD-runtimes
// guards: UC-049
// given: the runner labels (1) none, (2) gpu, (3) gpu and cpu
// input: jobWorkflowFiles("gitlab", …) for each; the lines of every job that begin AGENT_M_INPUT_, and every line of the file, comments apart, that holds `$[[`
// expect: in every job, in this order, AGENT_M_INPUT_JOB set to `$[[ inputs.job ]]`, AGENT_M_INPUT_TASK to `$[[ inputs.task ]]`, AGENT_M_INPUT_ENDPOINT to `$[[ inputs.endpoint ]]` and AGENT_M_INPUT_SECRET to `$[[ inputs.secret ]]`, each the whole value — no quote, no other text — and no other AGENT_M_INPUT_ variable; the only lines of the file that hold `$[[` are those four lines of each job
test("jobWorkflowFiles — every GitLab job sets the three input variables to the whole value of the input, and nothing else", () => {
  for (const runners of [[], ["gpu"], ["gpu", "cpu"]]) {
    const text = workflow("gitlab", runners), jobs = gitlabJobs(text);
    assert.equal(jobs.length, 5 * (1 + runners.length), "the plan, three agent's jobs and the job that writes for each route");
    for (const job of jobs) {
      assert.deepEqual(inputVariables(job), [["AGENT_M_INPUT_JOB", "$[[ inputs.job ]]"], ["AGENT_M_INPUT_TASK", "$[[ inputs.task ]]"],
        ["AGENT_M_INPUT_ENDPOINT", "$[[ inputs.endpoint ]]"], ["AGENT_M_INPUT_SECRET", "$[[ inputs.secret ]]"]], `${job.id} with ${runners}`);
    }
    assert.deepEqual(codeLines(text).filter((line) => line.includes("$[[")), jobs.flatMap(() => ["    AGENT_M_INPUT_JOB: $[[ inputs.job ]]",
      "    AGENT_M_INPUT_TASK: $[[ inputs.task ]]", "    AGENT_M_INPUT_ENDPOINT: $[[ inputs.endpoint ]]",
      "    AGENT_M_INPUT_SECRET: $[[ inputs.secret ]]"]), `the lines with $[[ with ${runners}`);
  }
});

// TST-532103 · level: unit · module: MOD-runtimes
// guards: UC-010; UC-049
// given: the GitLab job file for the runner gpu
// input: the rules of each job
// expect: in every job exactly one rule whose condition holds "api", which is exactly `$CI_PIPELINE_SOURCE == "web" || $CI_PIPELINE_SOURCE == "api"`; in every agent's job it sets AGENT_M_ENTRY to onDispatch, in the job that writes to writeResult, in the plan nothing; no other rule of any job sets onDispatch
test("jobWorkflowFiles — the entry onDispatch runs for a pipeline started from the server's page and for one the API started, with one rule", () => {
  const jobs = gitlabJobs(workflow("gitlab"));
  assert.ok(jobs.length > 0);
  for (const job of jobs) {
    const rules = rulesOf(job);
    const started = rules.filter((rule) => rule.includes('"api"'));
    assert.equal(started.length, 1, `${job.id}: one rule for a start from the page or the API`);
    assert.ok(started[0].startsWith(`    - if: '$CI_PIPELINE_SOURCE == "web" || $CI_PIPELINE_SOURCE == "api"'`), `${job.id}: ${started[0]}`);
    const wanted = /-agent-\d+$/.test(job.id) ? "onDispatch" : job.id.endsWith("-plan") ? null : "writeResult";
    assert.equal(/AGENT_M_ENTRY: (\w+)/.exec(started[0])?.[1] ?? null, wanted, job.id);
    for (const rule of rules.filter((each) => each !== started[0])) assert.ok(!rule.includes("onDispatch"), `${job.id}: ${rule}`);
  }
});

// TST-532104 · level: unit · module: MOD-runtimes
// guards: UC-049; A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET
// given: the GitLab job file; a GitLab job's environment built from what the file sets and nothing else — each variable it sets, to the value of the input it names, as GitLab interpolates a whole value —, GITLAB_CI `true`, CI_PIPELINE_SOURCE `api`, and one more variable AGENT_M_INPUT_PLANTED
// input: the names of the variables the file sets for the inputs; ciEnvironment("onDispatch", that environment, a date)
// expect: the names are exactly AGENT_M_INPUT_JOB, AGENT_M_INPUT_TASK, AGENT_M_INPUT_ENDPOINT and AGENT_M_INPUT_SECRET, set to the inputs job, task, endpoint and secret; the event is named "api" and its payload holds the inputs job, task and endpoint as given, the planted variable absent (the input secret is read by ITM-1189's entry, tests/workflow-entries-hand-over.test.mjs)
test("jobWorkflowFiles — the four variables the GitLab file sets are exactly the names an entry reads from a GitLab job", () => {
  const [job] = gitlabJobs(workflow("gitlab"));
  assert.deepEqual(inputVariables(job).map(([name]) => name), ["AGENT_M_INPUT_JOB", "AGENT_M_INPUT_TASK", "AGENT_M_INPUT_ENDPOINT", "AGENT_M_INPUT_SECRET"]);
  const given = { job: JOB_ID, task: TASK, endpoint: ENDPOINT, secret: "FIXTURE_KEY" };
  const set = Object.fromEntries(inputVariables(job).map(([name, value]) => [name, given[/^\$\[\[ inputs\.([a-z]+) \]\]$/.exec(value)?.[1]]]));
  assert.deepEqual(set, { AGENT_M_INPUT_JOB: JOB_ID, AGENT_M_INPUT_TASK: TASK, AGENT_M_INPUT_ENDPOINT: ENDPOINT, AGENT_M_INPUT_SECRET: "FIXTURE_KEY" });

  const env = ciEnvironment("onDispatch", { GITLAB_CI: "true", CI_PIPELINE_SOURCE: "api", ...set, AGENT_M_INPUT_PLANTED: "planted" }, WHEN);
  assert.equal(env.event.name, "api");
  assert.deepEqual({ job: env.event.payload.inputs.job, task: env.event.payload.inputs.task, endpoint: env.event.payload.inputs.endpoint }, { job: JOB_ID, task: TASK, endpoint: ENDPOINT });
  assert.ok(!JSON.stringify(env.event.payload).includes("AGENT_M_INPUT_PLANTED") && !JSON.stringify(env.event.payload).includes("planted"), "the planted variable is absent");
});

// TST-532105 · level: unit · module: MOD-runtimes
// guards: UC-049; A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON
// given: a task with double quotes, single quotes, a backslash, a dollar sign, braces and two line breaks, as the input `task`; the two GitLab files for the instance and the runner gpu
// input: every line of the two files, comments apart, that holds `inputs.task`; the script of every job; the task's words searched in both files; the task carried by ciEnvironment as AGENT_M_INPUT_TASK
// expect: `inputs.task` stands in exactly eleven lines: `AGENT_M_INPUT_TASK: $[[ inputs.task ]]` of the variables of each of the ten jobs — the plan, three agent's jobs and the job that writes of the hosted route and of the gpu route —, then `task: $[[ inputs.task ]]` of the .gitlab-ci.yml include; no job's script holds AGENT_M_INPUT_TASK or `inputs.`; no file holds a word of the task; ciEnvironment gives the task unchanged as one string with its two line breaks
test("jobWorkflowFiles — a task with quotes and line breaks is one value, held by a variable of the job and written to no file", () => {
  const [jobFile, ciFile] = files("gitlab", ["gpu"]);
  const lines = [...codeLines(jobFile.text), ...codeLines(ciFile.text)].filter((line) => line.includes("inputs.task"));
  assert.deepEqual(lines, [...Array(10).fill("    AGENT_M_INPUT_TASK: $[[ inputs.task ]]"), "      task: $[[ inputs.task ]]"]);
  for (const job of gitlabJobs(jobFile.text)) {
    const script = job.text.slice(job.text.indexOf("  script:\n"));
    assert.ok(script.startsWith("  script:\n") && !script.includes("AGENT_M_INPUT_TASK") && !script.includes("inputs."), `${job.id}: no script line holds the task`);
  }
  for (const file of [jobFile, ciFile]) for (const word of ["loan due date", "Ana", "C:", "braces"]) assert.ok(!file.text.includes(word), `${file.path}: ${word}`);

  const carried = ciEnvironment("onDispatch", { GITLAB_CI: "true", CI_PIPELINE_SOURCE: "api", AGENT_M_INPUT_JOB: JOB_ID, AGENT_M_INPUT_TASK: TASK }, WHEN);
  assert.equal(carried.event.payload.inputs.task, TASK);
  assert.equal(carried.event.payload.inputs.task.split("\n").length, 3);
});

// ---------------------------------------------------------------- without a disk

// One load of ci.mjs, anew under an address of its own, `ci.mjs?load=<n>`, as tests/product-process.test.mjs loads MOD-product-process:
// `disk` is what process.getBuiltinModule("node:fs") gives it — undefined, as in a browser —, `fetch` the browser's fetch. Both are put
// back after the load. -> { module, error, reads } — the module's namespace, or the error its load failed with; and every read of its own
// templates, as "disk <address>" or "fetch <address>". Only ci.mjs is loaded anew; the modules it imports are this file's.
const CI_MODULE = new URL("../src/runtimes/ci.mjs", import.meta.url);
const TEMPLATE_FILES = ["github.yml", "gitlab.yml", "github-main-changed.yml", "gitlab-main-changed.yml"].map((name) => new URL(`../src/runtimes/workflow/${name}`, import.meta.url).href);
let loads = 0;
async function loadCi({ disk, fetch }) {
  const saved = { getBuiltinModule: process.getBuiltinModule, fetch: globalThis.fetch };
  const reads = [];
  process.getBuiltinModule = (name) => (name === "node:fs" ? disk?.(reads) : saved.getBuiltinModule.call(process, name));
  globalThis.fetch = fetch ? (url) => { reads.push(`fetch ${url}`); return fetch(url); } : undefined;
  try {
    loads += 1;
    return { module: await import(new URL(`?load=${loads}`, CI_MODULE)), error: null, reads };
  } catch (error) {
    return { module: null, error, reads };
  } finally {
    process.getBuiltinModule = saved.getBuiltinModule;
    globalThis.fetch = saved.fetch;
  }
}
// A disk that gives the real file's text for a read, noting each read; a browser's fetch that answers each address with the real file there.
const realDisk = (reads) => ({ readFileSync: (url, encoding) => { reads.push(`disk ${url}`); return readFileSync(url, encoding); } });
const servedFetch = async (url) => new Response(readFileSync(new URL(url), "utf8"), { status: 200 });

// The product's own .gitlab-ci.yml of the fixture: its include: a list of one entry of its own.
const OWN_GITLAB_CI = 'include:\n  - local: ".gitlab/own.yml"\n';

// TST-472728 · level: unit · module: MOD-runtimes
// guards: AGENT M WORKS WITHOUT A LOCAL INSTALLATION; ONE CLICK PER DECISION; UC-010
// given: ci.mjs loaded anew twice — as in Node, with a disk that gives the real templates, and as a browser loads it, without a disk, whose fetch answers each of the module's own addresses with the text of the real file there; one fixture: the instance alice/agent-m at COMMIT, the secrets AGENT_M_TOKEN, CLAUDE_KEY and OPENAI_KEY, the runner gpu, and on GitLab a product without a .gitlab-ci.yml and one with its own
// input: jobWorkflowFiles on GitHub, and on GitLab for each .gitlab-ci.yml, from each copy
// expect: each copy loads and reads workflow/github.yml, workflow/gitlab.yml, workflow/github-main-changed.yml and workflow/gitlab-main-changed.yml beside ci.mjs, once each, as it is loaded — the Node copy from the disk, the browser's copy from those addresses with fetch; the files of the browser's copy are deep-equal to those of the Node copy for each server and each .gitlab-ci.yml; the GitHub file is .github/workflows/agent-m-jobs.yml and names the instance's commit
test("jobWorkflowFiles — in a browser the templates are read from the module's own address, and the files equal those given in Node", async () => {
  const inNode = await loadCi({ disk: realDisk });
  const inBrowser = await loadCi({ disk: undefined, fetch: servedFetch });
  for (const [where, loaded, read] of [["Node", inNode, "disk"], ["browser", inBrowser, "fetch"]]) {
    assert.equal(loaded.error, null, `${where}: the module loads: ${loaded.error?.message}`);
    assert.deepEqual(loaded.reads, TEMPLATE_FILES.map((address) => `${read} ${address}`), `${where}: the templates are read once each, as the module is loaded`);
  }
  const cases = [["github", undefined], ["gitlab", null], ["gitlab", OWN_GITLAB_CI]];
  for (const [server, gitlabCi] of cases) {
    const node = inNode.module.jobWorkflowFiles(server, INSTANCE, SECRETS, RUNNERS, gitlabCi);
    assert.ok(node.length >= 1, `known positive: Node gives the ${server} files`);
    assert.deepEqual(inBrowser.module.jobWorkflowFiles(server, INSTANCE, SECRETS, RUNNERS, gitlabCi), node, `${server}, .gitlab-ci.yml ${JSON.stringify(gitlabCi)}`);
  }
  const [github] = inBrowser.module.jobWorkflowFiles("github", INSTANCE, SECRETS, RUNNERS);
  assert.equal(github.path, ".github/workflows/agent-m-jobs.yml");
  assert.ok(github.text.includes(COMMIT), "the GitHub file names the instance's commit");
});

// TST-1202101 · level: unit · module: MOD-runtimes
// guards: AGENT M WORKS WITHOUT A LOCAL INSTALLATION; UC-010
// given: ci.mjs loaded anew as a browser loads it, without a disk, whose fetch answers every address with 404 Not Found
// input: the load of the module
// expect: the module does not load — a template that is not served stops its module, as an own data file that is not served stops the modules that read theirs — and the error names the module, a template workflow/<name>.yml, and 404
test("jobWorkflowFiles — a template that is not served stops the module, and the error names it and the server's status", async () => {
  const notServed = await loadCi({ disk: undefined, fetch: async () => new Response("Not Found", { status: 404 }) });
  assert.ok(notServed.reads.length >= 1 && notServed.reads.every((read) => TEMPLATE_FILES.some((address) => read === `fetch ${address}`)),
    `only the templates are asked for: ${notServed.reads.join(", ")}`);
  assert.equal(notServed.module, null, "a template that cannot be read stops the module");
  assert.ok(notServed.error instanceof Error && /MOD-runtimes/.test(notServed.error.message) && /workflow\/(github|gitlab)\.yml/.test(notServed.error.message)
    && notServed.error.message.includes("404"), `the error names the module, the template and 404: ${notServed.error?.message}`);
});
