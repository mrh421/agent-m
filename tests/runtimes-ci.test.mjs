// Queueing a job on the CI route (ITM-253) — MOD-runtimes' queueJob(host, start, route, head, bridge?), as
// docs/architecture/MOD-runtimes.md states it, for the CI route alone: the job's start record (MOD-job-ledger's
// startRecord) committed at its path, on the head that was read, in one commit — the host's commitFiles, on the
// branch its repositoryInfo names, with expectedHead the head given —, as the person's commit, whose push starts the
// product's job workflow; refused with WorkflowMissing, naming the job workflow's file, while the head read does not
// hold it; and the host's failures — Moved, TokenRefused, RateLimited, and the rest it names — propagated unchanged.
// Nothing is written when either refusal happens.
// Run: node --test tests/runtimes-ci.test.mjs
//
// Module: MOD-runtimes
// Guards: A JOB IS RECORDED IN ITS PRODUCT REPOSITORY; A REMOTE INTERFACE NAMES HOW IT FAILS; UC-013
// Level: unit
//
// Not tested here, since ITM-253 leaves them out (MOD-runtimes.md, Outcome): the tab's and the Bridge's routes of
// queueJob, a job of a run (start.run, MOD-job-ledger's appendToRecord), and Route, RouteOffer, ResourceNeed,
// routesFor, runOnTab, bridgeAgentDriver, resumeJob, liveState, jobLog, cancelJob, retryJob, jobWorkflowFiles and
// routeStrategies (UC-010, UC-011, UC-036).
//
// The repository server is replaced by a fixture: a fake host that keeps to MOD-repository-hosts' interface as
// docs/architecture/MOD-repository-hosts.md states it — one repository in memory, whose default branch is `trunk`
// (deliberately not `main`, so a test fails if the code assumed that name) —; repositoryInfo, readSnapshot and
// commitFiles as the interface describes them, a commit made only if the branch still stands at the expected head,
// else `Moved { head }`, and nothing written on any failure (MOD-repository-hosts.md, Interfaces: commitFiles —
// "Nothing is written on any failure"). Nothing reaches the network. Each test states its input and its expected
// result before it runs. The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { queueJob } from "../src/runtimes/index.mjs";
import { startRecord } from "../src/job-ledger/index.mjs";
import { openStore, writeSetting } from "../src/browser-store/index.mjs";

const GITHUB_WORKFLOW = ".github/workflows/agent-m-jobs.yml";
const GITLAB_WORKFLOW = ".gitlab/agent-m-jobs.yml";

const REPO = {
  github: { server: "github", origin: "https://github.com", path: "alice/product", web: "https://github.com/alice/product" },
  gitlab: { server: "gitlab", origin: "https://gitlab.example", path: "alice/product", web: "https://gitlab.example/alice/product" },
};

// A job's start (MOD-job-ledger's JobStart), queued on the CI route, hosted.
const START = {
  id: "JOB-20261007-0930-abcd", kind: "write-tests", worksOn: ["ITM-253"], participant: "drafter-a",
  model: "example-model", route: "ci hosted", run: null, retries: null, startedBy: "alice",
  start: new Date("2026-10-07T09:30:00Z"), agentM: { version: "2026.10.0", commit: "abc1234" },
  inputs: ["SPEC.md@deadbeef"], limit: 5,
  destinations: [{ participant: "drafter-a", place: "CI", parts: ["the tests"] }], params: { requirements: ["ITM-253"] },
};
const CI_HOSTED = { kind: "ci", runner: "hosted" };

// A failure as MOD-repository-hosts names it: an error with the failure's name and its fields.
const failure = (name, fields = {}) => Object.assign(new Error(`${name} ${JSON.stringify(fields)}`), { name, ...fields });

// The fake host (MOD-repository-hosts' interface): one repository in memory, default branch `trunk`, head `c0`.
// files: { path: text } beside the job workflow, which is present unless `workflow: false`.
function fakeHost({ server = "github", files = {}, workflow = true } = {}) {
  const workflowPath = server === "github" ? GITHUB_WORKFLOW : GITLAB_WORKFLOW;
  const tree = new Map(Object.entries(files));
  if (workflow) tree.set(workflowPath, "name: agent-m-jobs\n");
  const reads = [], writes = [];
  let head = "c0", made = 0;
  return {
    reads, writes, head: () => head,
    // Another writer's commit, elsewhere, before this job is queued: only the head moves on.
    moveOn: () => { head = `moved${++made}`; },
    host: {
      async repositoryInfo() {
        return { defaultBranch: "trunk", visibility: "public", canWrite: true, archived: false, description: "" };
      },
      async readSnapshot(ref) {
        reads.push(ref);
        return { repository: REPO[server], ref, commit: head, paths: [...tree.keys()],
          read: async (p) => tree.get(p) ?? null, blob: (p) => (tree.has(p) ? `blob-${p}` : null) };
      },
      async commitFiles(change) {
        // MOD-repository-hosts.md, Interfaces (commitFiles): "Nothing is written on any failure" — checked, and
        // refused, before anything is recorded.
        if (change.branch !== "trunk" || change.expectedHead !== head) throw failure("Moved", { head });
        writes.push(structuredClone(change));
        head = `c${++made}`;
        for (const f of change.files) tree.set(f.path, f.text);
        return { commit: head, url: `${REPO[server].web}/commit/${head}` };
      },
    },
  };
}

// TST-472702 · level: unit · module: MOD-runtimes
// guards: A JOB IS RECORDED IN ITS PRODUCT REPOSITORY; A REMOTE INTERFACE NAMES HOW IT FAILS; UC-013
// given: a product on GitHub whose default branch `trunk` holds its job workflow; a job's start
// input: queueJob(host, START, { kind: "ci", runner: "hosted" }, the head read)
// expect: the snapshot read at that head; one commit on `trunk`, on the head read, holding exactly startRecord(START)'s file, with a message naming the job; the result { path: startRecord(START).path, commit: the commit commitFiles returned }
test("queueJob — the CI route commits the job's start record at its path, on the head read, in one commit", async () => {
  const fake = fakeHost({});
  const head = fake.head();
  const { path, text } = startRecord(START);

  const result = await queueJob(fake.host, START, CI_HOSTED, head);

  assert.deepEqual(fake.reads, [head], "reads the snapshot at the head given");
  assert.equal(fake.writes.length, 1, "one commit");
  const [change] = fake.writes;
  assert.equal(change.branch, "trunk", "on the default branch the host's repositoryInfo names");
  assert.equal(change.expectedHead, head, "on the head that was read");
  assert.deepEqual(change.files, [{ path, text }], "the start record alone, at its path, as startRecord gives it");
  assert.equal(change.message, "Queue job JOB-20261007-0930-abcd: write-tests", "a message naming the job");
  assert.deepEqual(result, { path, commit: fake.head() }, "the path and the commit commitFiles returned");
});

// TST-1205001 · level: unit · module: MOD-runtimes
// guards: A JOB IS RECORDED IN ITS PRODUCT REPOSITORY; UC-049
// given: a product whose job workflow pins the instance at commit P on GitHub (the checkout's `repository:` and `ref:`), and one on GitLab (AGENT_M_COMMIT); a job's start whose agentM names the commit abc1234 the page was served from
// input: queueJob(host, START, { kind: "ci", runner: "hosted" }, the head read)
// expect: the start record committed names P as agentM's commit and version — the commit the run's checkout of the instance is at —, everything else as startRecord(START)
test("queueJob — the CI route's record names the instance commit the product's job workflow pins", async () => {
  const P = "5db55fa7f059c46fe45db0f6cfcb6ffab6e6cf84";
  const pinnedFiles = {
    github: { [GITHUB_WORKFLOW]: `jobs:\n  hosted:\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          repository: alice/agent-m\n          ref: ${P}\n          path: instance\n` },
    gitlab: { [GITLAB_WORKFLOW]: `variables:\n    AGENT_M_INSTANCE: "alice/agent-m"\n    AGENT_M_COMMIT: "${P}"\n` },
  };
  for (const server of ["github", "gitlab"]) {
    const fake = fakeHost({ server, workflow: false, files: pinnedFiles[server] });
    await queueJob(fake.host, START, CI_HOSTED, fake.head());
    const expected = startRecord({ ...START, agentM: { version: P, commit: P } });
    assert.deepEqual(fake.writes[0].files, [{ path: expected.path, text: expected.text }], `${server}: the record names the pinned commit`);
  }
});

// TST-472703 · level: unit · module: MOD-runtimes
// guards: A JOB IS RECORDED IN ITS PRODUCT REPOSITORY; A REMOTE INTERFACE NAMES HOW IT FAILS; UC-013
// given: a product whose default branch moved on since the head given was read
// input: queueJob(host, START, { kind: "ci", runner: "hosted" }, the stale head)
// expect: rejects with the host's Moved, naming the new head; nothing committed
test("queueJob — the CI route refuses a moved head, with nothing written", async () => {
  const fake = fakeHost({});
  const staleHead = fake.head();
  fake.moveOn();

  await assert.rejects(queueJob(fake.host, START, CI_HOSTED, staleHead), (error) => {
    assert.equal(error.name, "Moved", "the host's own failure, by name");
    assert.equal(error.head, fake.head(), "Moved names the head the branch stands at now");
    return true;
  });
  assert.equal(fake.writes.length, 0, "nothing written");
});

// TST-472704 · level: unit · module: MOD-runtimes
// guards: A JOB IS RECORDED IN ITS PRODUCT REPOSITORY; A REMOTE INTERFACE NAMES HOW IT FAILS; UC-013
// given: a product on GitHub (1), and on GitLab (2), whose default branch holds no Agent M job workflow
// input: queueJob(host, START, { kind: "ci", runner: "hosted" }, the head read)
// expect: rejects with WorkflowMissing, naming the file of that server; nothing committed
test("queueJob — the CI route refuses WorkflowMissing, naming the job workflow's file, for a product without it", async () => {
  for (const [server, workflowPath] of [["github", GITHUB_WORKFLOW], ["gitlab", GITLAB_WORKFLOW]]) {
    const fake = fakeHost({ server, workflow: false });
    const head = fake.head();

    await assert.rejects(queueJob(fake.host, START, CI_HOSTED, head), (error) => {
      assert.equal(error.name, "WorkflowMissing", `${server}: named WorkflowMissing`);
      assert.deepEqual(error.files, [workflowPath], `${server}: names ${workflowPath}`);
      return true;
    });
    assert.equal(fake.writes.length, 0, `${server}: nothing written`);
  }
});

// TST-472705 · level: unit · module: MOD-runtimes
// guards: A JOB IS RECORDED IN ITS PRODUCT REPOSITORY; A REMOTE INTERFACE NAMES HOW IT FAILS; UC-013
// given: a product whose host refuses the commit — a token refused (1), a rate limit used up (2)
// input: queueJob(host, START, { kind: "ci", runner: "hosted" }, the head read)
// expect: rejects with the same failure the host named, unchanged; nothing committed
test("queueJob — the CI route's failures are the host's, by name", async () => {
  const cases = [
    ["TokenRefused", { tokenName: "AGENT_M_TOKEN", renewal: "https://github.com/settings/tokens" }],
    ["RateLimited", { limit: "account", resetsAt: null }],
  ];
  for (const [name, fields] of cases) {
    const fake = fakeHost({});
    const head = fake.head();
    fake.host.commitFiles = async () => { throw failure(name, fields); };

    await assert.rejects(queueJob(fake.host, START, CI_HOSTED, head), (error) => {
      assert.equal(error.name, name, `named ${name}`);
      for (const [key, value] of Object.entries(fields)) assert.equal(error[key], value, `${name}.${key}`);
      return true;
    });
    assert.equal(fake.writes.length, 0, `${name}: nothing written`);
  }
});

// ---------------------------------------------------------------- the endpoint a CI start names (ITM-1378)
//
// The browser's store (MOD-browser-store) is a Map-backed localStorage and a location the test sets, as tests/runtimes-tab-browser.test.mjs sets them. Reading taken: the
// model endpoint of the participant a start names is the setting `endpoint:<participant>` of the store of the instance whose Pages address the tab shows, as MOD-prompt-bar
// names an endpoint's participant after its setting; MOD-runtimes' Uses list readSetting by key and no listing. Counter-proofs are recorded in the pull request.
const realLocation = Object.getOwnPropertyDescriptor(globalThis, "location");
const realStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const ENDPOINT_KEY = "sk-HUB-KEY-0123456789abcdef";
const STORED = { url: "https://hub.example.test/v1", kind: "openai-compatible", model: "hub-model", key: ENDPOINT_KEY, place: "NHR@FAU, Erlangen", context: 128000, secret: "HUB_KEY" };

// A tab at alice.github.io/agent-m/ whose localStorage holds the settings given. -> the store.
function browserWith(settings) {
  const values = new Map();
  const storage = { getItem: (key) => (values.has(key) ? values.get(key) : null), setItem: (key, value) => values.set(key, String(value)), removeItem: (key) => values.delete(key),
    get length() { return values.size; }, key: (index) => [...values.keys()][index] ?? null };
  Object.defineProperty(globalThis, "location", { value: { hostname: "alice.github.io", pathname: "/agent-m/" }, configurable: true, writable: true });
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true, writable: true });
  const store = openStore("alice/agent-m");
  for (const [key, value] of Object.entries(settings)) writeSetting(store, key, value);
  return store;
}
test.afterEach(() => {
  for (const [name, saved] of [["location", realLocation], ["localStorage", realStorage]]) { if (saved) Object.defineProperty(globalThis, name, saved); else delete globalThis[name]; }
});

// TST-1378001 · level: unit · module: MOD-runtimes
// guards: AGENT M WORKS WITHOUT A LOCAL INSTALLATION; NO SECRET IN THE REPOSITORY; UC-010
// given: a tab whose browser stores the model endpoint `drafter-a` — address, kind, model, the CI secret HUB_KEY and the key itself — and a product on GitHub whose default branch holds its job workflow; a start of the participant drafter-a with the parameters { requirements }
// input: queueJob(host, START, { kind: "ci", runner: "hosted" }, the head read)
// expect: the committed record is startRecord of START whose parameters hold, besides requirements, `endpoint` { kind, baseUrl, model } of the stored endpoint and `secret` HUB_KEY; the file holds neither the key nor any text that begins sk-
test("queueJob — a CI start for a model endpoint names the endpoint's address, kind and model and its secret's name, and no key", async () => {
  browserWith({ "endpoint:drafter-a": STORED });
  const fake = fakeHost({});
  await queueJob(fake.host, START, CI_HOSTED, fake.head());
  const expected = startRecord({ ...START, params: { ...START.params, endpoint: { kind: "openai-compatible", baseUrl: "https://hub.example.test/v1", model: "hub-model" }, secret: "HUB_KEY" } });
  assert.deepEqual(fake.writes[0].files, [{ path: expected.path, text: expected.text }], "the record names the endpoint and its secret");
  assert.ok(fake.writes[0].files[0].text.includes("https://hub.example.test/v1"), "known positive: the address stands in the record");
  assert.ok(!fake.writes[0].files[0].text.includes(ENDPOINT_KEY) && !/sk-/.test(fake.writes[0].files[0].text), "no key is written");
});

// TST-1378002 · level: unit · module: MOD-runtimes
// guards: AGENT M WORKS WITHOUT A LOCAL INSTALLATION; A JOB IS RECORDED IN ITS PRODUCT REPOSITORY; UC-010
// given: (1) a tab whose browser stores the endpoint `other` and none of the participant drafter-a; (2) a tab that stores the endpoint `drafter-a`, and a start whose parameters already hold an `endpoint` and a `secret`; (3) no tab: no location and no localStorage
// input: queueJob(host, START, { kind: "ci", runner: "hosted" }, the head read) in each case
// expect: (1) and (3) the record is startRecord(START) as it was, with no `endpoint` and no `secret`; (2) the record is the start's own parameters, not the stored endpoint's
test("queueJob — a CI start names nothing where the browser keeps no endpoint of the participant, and keeps the parameters a page gave", async () => {
  const committed = async (start) => { const fake = fakeHost({}); await queueJob(fake.host, start, CI_HOSTED, fake.head()); return fake.writes[0].files; };
  const unchanged = [{ path: startRecord(START).path, text: startRecord(START).text }];

  browserWith({ "endpoint:other": STORED });
  assert.deepEqual(await committed(START), unchanged, "(1) another participant's endpoint is not named");

  browserWith({ "endpoint:drafter-a": STORED });
  const given = { ...START, params: { ...START.params, endpoint: { kind: "anthropic", baseUrl: "https://api.example.test", model: "given-model" }, secret: "GIVEN_KEY" } };
  assert.deepEqual(await committed(given), [{ path: startRecord(given).path, text: startRecord(given).text }], "(2) the page's own endpoint and secret stand");

  delete globalThis.location; delete globalThis.localStorage;
  assert.deepEqual(await committed(START), unchanged, "(3) without a tab nothing is named");
});

// TST-1378003 · level: unit · module: MOD-runtimes
// guards: A RUNTIME IS INTERCHANGEABLE; UC-010
// given: a tab whose browser stores the endpoint `drafter-a`; a start of drafter-a on the tab's route
// input: queueJob(host, START with route "tab", { kind: "tab" }, the head read)
// expect: the record's parameters are START's own: no `endpoint` and no `secret` (the endpoint reaches CI at the start of a CI job alone)
test("queueJob — a start on the tab's route names no endpoint", async () => {
  browserWith({ "endpoint:drafter-a": STORED });
  const fake = fakeHost({});
  const start = { ...START, route: "tab" };
  await queueJob(fake.host, start, { kind: "tab" }, fake.head());
  const text = fake.writes[0].files[0].text;
  assert.ok(text.includes("route: tab"), "known positive: the tab's record");
  assert.ok(!text.includes("hub.example.test") && !text.includes("HUB_KEY"), "no endpoint, no secret");
});
