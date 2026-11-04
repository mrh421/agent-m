// MOD-main-page's route `jobs` reads each repository's job records in batches and lists the job workflow's runs once (ITM-1280), as the accepted text of docs/architecture/MOD-main-page.md states it
// (Interfaces: `jobs`): "The list reads every record, in batches (`listJobs`), since which jobs have not ended — those it shows first — is known only from their records; the live states of the jobs
// without an end it asks with MOD-runtimes' `liveStates`, which lists a repository's runs of the job workflow once."
// Run: node --test tests/main-page-jobs-reads.test.mjs
//
// Module: MOD-main-page
// Guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; ONE DASHBOARD SHOWS EVERY JOB; UC-036
// Level: component
//
// The real MOD-job-ledger, MOD-runtimes, MOD-repository-hosts, MOD-browser-store and MOD-site-frame run as they are; only `fetch` is faked, by tests/main-page-home-harness.mjs over the counting fake
// GitHub of tests/progress-measures-load.mjs, which answers the batch request of files' texts (POST /graphql, with a token) and the list of the job workflow's runs. This test keeps, besides, the
// repository each batch request names and the number of files it asks for. No request leaves the fixtures.
//
// Readings the texts leave open, which the test states (the pull request names them):
//   - "a listing of runs" is a request for the runs of the job workflow, GET /repos/<repository>/actions/workflows/agent-m-jobs.yml/runs.
//   - A batch holds at most a hundred files (MOD-repository-hosts, BATCH): 150 records are two batches, of 100 and 50; 30 are one.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { view } from "../src/main-page/index.mjs";
import { startRecord, appendToRecord } from "../src/job-ledger/index.mjs";
import { INSTANCE, PRODUCT, PRODUCT_URL, PRODUCT_TOKEN, browser, byClass, draw, headOf, instanceFiles, network, smallProduct, timers, withEnd } from "./main-page-home-harness.mjs";

const jobs = view.routes.find((candidate) => candidate.name === "jobs");
let net;
afterEach(() => {
  net?.restore();
  timers.restore();
});

const at = (text) => new Date(`${text}:00Z`);
const runOf = (repository, n) => `https://github.com/${repository}/actions/runs/${n}`;

// `count` job records of `repository`, JOB-20261016-<hhmm>-<tag><nnn>: the first `open` taken by their own CI run and not ended, every other taken by its run and ended as done.
function records(repository, tag, count, open) {
  return Array.from({ length: count }, (_, n) => {
    const id = `JOB-20261016-${String(800 + n).padStart(4, "0")}-${tag}${String(n).padStart(3, "0")}`;
    const { path, text } = startRecord({ id, kind: "implement-item", worksOn: ["ITM-0900"], participant: "dev-ci", model: "model-x", route: "ci hosted", run: null, retries: null, startedBy: "alice",
      start: at("2026-10-16T08:00"), agentM: { version: "2026.1.0", commit: "abc1234" }, inputs: [], limit: 5, task: "in parameters", conversation: null, destinations: [], params: {} });
    const taken = appendToRecord(text, { part: "taken", at: at("2026-10-16T08:00"), by: runOf(repository, n + 1) });
    return { path, text: n < open ? taken : withEnd(taken, "done") };
  });
}

// The batch requests of files' texts, as { repository, files }: each POST /graphql whose query asks for blobs by `f<n>:object(expression: …)`, with the repository its variables name.
function keepBatches() {
  const batches = [];
  const spy = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === "object" && !(input instanceof URL) ? input.url : String(input));
    if (url.host === "api.github.com" && url.pathname === "/graphql" && init?.body) {
      const { query, variables } = JSON.parse(init.body);
      const files = [...query.matchAll(/\bf\d+:object\(expression:/g)].length;
      if (files > 0) batches.push({ repository: `${variables.owner}/${variables.name}`, files });
    }
    return spy(input, init);
  };
  return batches;
}

// TST-1280004 · level: component · module: MOD-main-page
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; ONE DASHBOARD SHOWS EVERY JOB; UC-036
// given: the instance alice/agent-m with 30 job records, 2 of them not ended, and the kept product alice/product with 150 job records, 3 of them not ended, every record taken by a CI run of its own; a token for each; the job workflow's runs list none; each repository's branch overview-cache holds the overview of its head, in which nothing waits (what waits stands above the list, ITM-1190)
// input: the route jobs drawn
// expect: 180 rows; per repository its batches and no record read by itself — alice/product two batches of 100 and 50 files, alice/agent-m one of 30 —; per repository one listing of the job workflow's runs (known positive: each repository has jobs taken on CI that have not ended); and per repository the one request of what waits, its head's overview <head>.json on overview-cache, and no listing of pull requests; counter-proof: asking liveState once for each such job lists the runs three times for alice/product and twice for alice/agent-m
test("TST-1280004 #jobs with two repositories sends per repository its batches of records, one listing of the job workflow's runs and one read of its head's overview", async () => {
  net = network({ [INSTANCE]: { ...instanceFiles(), ...Object.fromEntries(records(INSTANCE, "i", 30, 2).map(({ path, text }) => [path, text])) },
    [PRODUCT]: smallProduct({ jobs: records(PRODUCT, "p", 150, 3) }) });
  for (const repository of [INSTANCE, PRODUCT]) {
    const commit = headOf(repository);
    net.overviews[repository] = { [commit]: JSON.stringify({ commit, shares: [], waiting: [], model: null, build: { states: [], records: [] }, queues: [] }) };
  }
  net.install();
  const batches = keepBatches();
  const target = await draw(jobs, browser({ products: [PRODUCT_URL], tokens: { [PRODUCT]: PRODUCT_TOKEN } }));
  assert.equal(byClass(target, "job").length, 180, "known positive: every job is listed");

  const of = (repository) => batches.filter((batch) => batch.repository === repository).map((batch) => batch.files);
  assert.deepEqual(of(PRODUCT), [100, 50], "alice/product: two batches");
  assert.deepEqual(of(INSTANCE), [30], "alice/agent-m: one batch");
  const singles = net.requests.filter(({ url }) => /^https:\/\/api\.github\.com\/repos\/[^/]+\/[^/]+\/contents\/docs\/jobs\//.test(url));
  assert.deepEqual(singles, [], "no record is read by itself");

  const listings = (repository) => net.requests.filter(({ url }) => url.startsWith(`https://api.github.com/repos/${repository}/actions/workflows/agent-m-jobs.yml/runs`)).length;
  assert.deepEqual([listings(PRODUCT), listings(INSTANCE)], [1, 1], "one listing of the job workflow's runs per repository");

  const overviews = (repository) => net.requests.filter(({ url }) => url.includes("ref=overview-cache") && url.startsWith(`https://api.github.com/repos/${repository}/`))
    .map(({ url }) => new URL(url).pathname.replace(`/repos/${repository}/contents/`, ""));
  assert.deepEqual([overviews(PRODUCT), overviews(INSTANCE)], [[`${headOf(PRODUCT)}.json`], [`${headOf(INSTANCE)}.json`]], "one read of the head's overview per repository");
  const pulls = net.requests.filter(({ url }) => /\/pulls(\?|$)/.test(url));
  assert.deepEqual(pulls, [], "no listing of pull requests: what waits is the stored overview's");
});
