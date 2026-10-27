// Module: MOD-runtimes
// The fixture of the hand-over tests of ITM-495 (tests/runtimes-hand-over.test.mjs, tests/runtimes-hand-over-routes.test.mjs), no test of its own: a fake
// repository host in memory (default branch `trunk`, deliberately not `main`) that keeps every commit and every startWorkflow in the order it happened, a Bridge
// behind the global `fetch`, and the job and the task the tests hand over. No expected result is computed here; each test states its own. Nothing reaches the network.

import { bridgeApi } from "../src/bridge-http/index.mjs";
import { bridgeAt } from "../src/bridge-client/index.mjs";
import { recordsNewestFirst } from "../src/job-ledger/index.mjs";

export const GITHUB_WORKFLOW = ".github/workflows/agent-m-jobs.yml";
export const GITLAB_WORKFLOW = ".gitlab/agent-m-jobs.yml";
const REPO = {
  github: { server: "github", origin: "https://github.com", path: "alice/product", web: "https://github.com/alice/product" },
  gitlab: { server: "gitlab", origin: "https://gitlab.example", path: "alice/product", web: "https://gitlab.example/alice/product" },
};
export const BRIDGE_ADDRESS = "http://127.0.0.1:4712";
export const bridgeNamed = (name) => bridgeAt({ name, address: BRIDGE_ADDRESS, token: `token-${name}` });

// The words of the task: distinctive, so that a record or a message holding them is found.
export const TASK = "PLANTED-TASK-7F3A split the requirement ACCOUNT-EXPORT into two";
export const holdsTask = (text) => text.includes("PLANTED-TASK-7F3A") || text.includes("ACCOUNT-EXPORT");
export const ENDPOINT = { kind: "openai-compatible", baseUrl: "https://ep1.example.test/v1", model: "model-m" };
export const ENDPOINT_TEXT = '{"kind":"openai-compatible","baseUrl":"https://ep1.example.test/v1","model":"model-m"}';

// A job's start (MOD-job-ledger's JobStart) as a conversation's hand-over makes it: its task field is whatever the caller wrote; handOverJob sets "with the hand-over".
export const START = {
  id: "JOB-20261016-0930-abcd", kind: "write-tests", worksOn: ["ITM-495"], participant: "drafter-a", model: "example-model", route: "ci hosted", run: null,
  retries: null, startedBy: "alice", start: new Date("2026-10-16T09:30:00Z"), agentM: { version: "2026.10.0", commit: "a".repeat(40) }, inputs: ["SPEC.md@deadbeef"],
  limit: 5, task: "in parameters", conversation: null, destinations: [{ participant: "drafter-a", place: "CI", parts: ["the task"] }], params: {},
};
export const RECORD_PATH = `docs/jobs/${START.id}.md`;
export const CI_HOSTED = { kind: "ci", runner: "hosted" };
export const BRIDGE_ROUTE = { kind: "bridge", bridge: "lab-pc" };

// A prepared job (MOD-job-runner's Prepared) as prepareJob returns it for a kind: only what a hand-over reads is of interest — of the kind, its name, its gate points,
// and its recipes, of which write-tests names `instruction?` first, so that the task it is handed reaches its prompt.
export const preparedOf = (extra = {}, gatePoints = ["before-merge", "question"]) => ({
  kind: { name: "write-tests", gatePoints, recipes: [{ name: "instruction", optional: true }] }, params: {}, drafter: { name: "drafter-a", context: 200000 }, reviewers: [], parts: [], destinations: [], fits: true,
  notFitting: [], leftOut: [], blocking: [], limit: 5, ...extra,
});

export const failure = (name, fields = {}, message = name) => Object.assign(new Error(message), { name, ...fields });

// The fake host (MOD-repository-hosts' interface): one repository in memory, default branch `trunk`, head `c0`; every commit and every startWorkflow is kept in
// `events` in the order it happened. `startWorkflow` is the spy: it answers `null` (the run not named at once) unless `refuseStart` is set; with `refuseSecondCommit`
// the branch refuses every commit after the first (Moved).
export function fakeHost({ server = "github", workflow = true, refuseStart = null, refuseSecondCommit = false } = {}) {
  const tree = new Map();
  if (workflow) tree.set(server === "github" ? GITHUB_WORKFLOW : GITLAB_WORKFLOW, "name: agent-m-jobs\n");
  const events = [], writes = [], starts = [];
  let head = "c0", made = 0;
  const snapshot = () => ({ repository: REPO[server], ref: "trunk", commit: head, paths: [...tree.keys()].sort(), read: async (path) => tree.get(path) ?? null, blob: () => null });
  return {
    events, writes, starts, tree, head: () => head, moveOn: () => { head = `moved${++made}`; },
    record: async () => { for await (const each of recordsNewestFirst(snapshot())) return each; return null; },
    host: {
      async repositoryInfo() { return { defaultBranch: "trunk", visibility: "public", canWrite: true, archived: false, description: "" }; },
      async readSnapshot() { return snapshot(); },
      async commitFiles(change) {
        if (change.branch !== "trunk" || change.expectedHead !== head) throw failure("Moved", { head });
        if (refuseSecondCommit && writes.length >= 1) throw failure("Moved", { head: "elsewhere" });
        writes.push(structuredClone(change));
        events.push(["commit", change.message]);
        for (const file of change.files) tree.set(file.path, file.text);
        head = `c${++made}`;
        return { commit: head, url: `${REPO[server].web}/commit/${head}` };
      },
      async startWorkflow(workflow, ref, inputs) {
        events.push(["start", workflow]);
        starts.push({ workflow, ref, inputs: structuredClone(inputs) });
        if (refuseStart) throw refuseStart;
        return null;
      },
    },
  };
}

// The Bridge behind the global fetch: `seen` keeps every request with the number of commits `writesOf()` gave when it arrived; `seen.refuse` set to "paused" makes
// POST /v1/jobs answer that the Bridge is paused. Call `restoreFetch()` after each test.
const realFetch = globalThis.fetch;
export const restoreFetch = () => { globalThis.fetch = realFetch; };
export function installBridge(writesOf = () => null) {
  const seen = { requests: [], refuse: null };
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  globalThis.fetch = async (url, init) => {
    const where = new URL(String(url));
    seen.requests.push({ origin: where.origin, method: init.method, path: where.pathname, token: init.headers[bridgeApi.tokenHeader], body: init.body ? JSON.parse(init.body) : null,
      writes: writesOf() });
    if (init.method === "POST" && where.pathname === "/v1/jobs") {
      if (seen.refuse === "paused") return json(503, { error: "paused", message: "Bridge is paused." });
      return json(200, { accepted: START.id });
    }
    return json(404, { error: "not-found", message: "no" });
  };
  return seen;
}
