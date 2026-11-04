// MOD-review-pages names every failed read through MOD-site-frame's readProblem (ITM-601), as docs/architecture/MOD-review-pages.md lists it among the interfaces it uses
// ("MOD-site-frame.readProblem") and docs/architecture/MOD-site-frame.md states it: "for `NotFound` while this browser stores no token that reaches it, that the repository
// is private or does not exist and no token reaches it, with the link to store one (UC-008 1a, UC-020 2a); otherwise the host's own message, and the link to store a token
// where none is stored." The module's `common.mjs` holds no problem of its own any more.
// Run: node --test tests/review-pages-read-problem.test.mjs
//
// Module: MOD-review-pages
// Guards: UC-008; UC-020; A USED-UP RATE LIMIT IS NAMED, NOT BLAMED ON THE TOKEN
// Level: unit
//
// The fixtures are tests/review-pages-draft-world.mjs' (a product behind a Host of the tests' own, the instance with its register, the browser harness and a spy on `fetch`
// that refuses). Each test draws one route of the real review pages, with the real MOD-site-frame, MOD-trace-graph, MOD-approvals and MOD-job-runner, over a Host whose
// reads fail where the test says, and states its input and its expected result before it runs (given / input / expect). Every failed read the module names is reached by
// its own route: the table SITES lists the route, its parameters, the read that fails and the number of requests the page makes; the table GRAPH_SITES lists the routes
// whose own failed read is the stored graph's (a page reads no file for a graph any more), for which readProblem names a fault of the page. Where the module file leaves a reading
// open, the test states the one it takes:
//   - A failed read is drawn as <p class="problem"> with <a class="token-step" href="#add-product"> in it while no token is stored; the page holds that one paragraph of
//     the class problem, and no other.
//   - "no token stored" is a browser whose localStorage holds no token; "a token stored" one that holds the product's own token.
//   - The paragraph is the frame's own when its class and its markup equal those that readProblem gives for the same failure and the same state of the token.
//   - The requests of a page are the calls on the two Hosts: repositoryInfo, readSnapshot and each read of a file. The number in the table is the one the page makes on the
//     tree before this item; naming a failed read through the frame adds none.
//   - The module's file `common.mjs` is read by this file for one thing: that it exports no `problem`.
// Nothing reaches the network (`fetch` is a spy that refuses). The counter-proofs (a planted fault in src/site-frame/ and in src/review-pages/ and the tests' failing
// result) are recorded in the pull request.

import { emptyStorage } from "./review-pages-harness.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { ENTRY_ID, LOAN, PRODUCT, byClass, click, contextOf, draw, failure, fakeInstance, fakeProduct, fetched, keepDraft, pages, resultOf, until, writeSetting }
  from "./review-pages-draft-world.mjs";
import { registerStrategies } from "../src/job-runner/index.mjs";

const frame = await import("../src/site-frame/index.mjs");
const common = await import("../src/review-pages/common.mjs");

(pages.view?.strategies ?? []).forEach((strategies, at) => registerStrategies(`tests/review-pages-read-problem.test.mjs#${at}`, strategies));

const PRIVATE = "This repository is private or does not exist, and this browser stores no token that reaches it. Store the product's token, then reload.";
const REGISTER_PATH = "docs/participants.md";
const UC7_KEY = `use-case/id=UC-007/product=${PRODUCT}`;
const NO_REGISTER = `${REGISTER_PATH} was not found`;

test.afterEach(() => { assert.deepEqual(fetched.splice(0), [], "no request left the fixtures"); });

// A Host over `host`, every call recorded in `requests`. Its snapshots fail to read the files in `paths` with a NotFound naming the file; with `snapshotFails`, readSnapshot
// itself fails with a NotFound naming the ref; with `graphMissing`, the branch trace-cache holds no graph of the commit (its readOn answers null for `<commit>.json.gz`).
function recording(host, requests, { paths = [], snapshotFails = false, graphMissing = false } = {}) {
  return { ...host,
    async repositoryInfo() { requests.push("repositoryInfo"); return host.repositoryInfo(); },
    async readSnapshot(ref) {
      requests.push(`readSnapshot ${ref}`);
      if (snapshotFails) throw failure("NotFound", `${ref} was not found`);
      const snapshot = await host.readSnapshot(ref);
      return { ...snapshot, read: async (path) => {
        requests.push(`read ${path}`);
        if (paths.includes(path)) throw failure("NotFound", `${path} was not found`);
        return snapshot.read(path);
      }, readOn: async function readOn(branch, path, options) {
        if (graphMissing && branch === "trace-cache" && path.endsWith(".json.gz")) return null;
        return snapshot.readOn.call(this, branch, path, options);
      } };
    } };
}

// The routes of the review pages that name a failed read, each with the parameters that reach it, the read that fails (on the product's Host, or on the instance's) and the
// number of requests the page makes. `draft` keeps the conversation's draft of a use case for the route `draft`.
const SITES = [
  { site: "common.mjs readPlace", route: "use-case", params: {}, product: { snapshotFails: true }, message: "main was not found", requests: 2 },
  { site: "conversation-draft.mjs", route: "draft", params: { subject: UC7_KEY }, draft: true, instance: { paths: [REGISTER_PATH] }, message: NO_REGISTER, requests: 5 },
  { site: "jobs.mjs showRequirementsDraft", route: "spec-entry", params: { id: "draft" }, instance: { paths: [REGISTER_PATH] }, message: NO_REGISTER, requests: 5 },
];

// The routes whose own failed read is the stored graph's: the page reads the graph the workflow "main changed" stored for its commit and builds none (MOD-review-pages: "The graph is
// the one `onMainChanged` stored for the commit shown (MOD-workflow-entries), read through `storedGraph`; no page builds a graph"), so the file a graph reads is read by no page, and
// the read that fails is the graph's: storedGraph rejects with GraphNotStored, naming the commit (MOD-trace-graph). `message` gives the host's message for the commit shown.
const GRAPH_NOT_STORED = (commit) => `the trace graph of ${commit.slice(0, 12)} is not stored yet — the workflow "main changed" builds it on every push to the default branch; ` +
  "reload once its run has finished";
const GRAPH_SITES = [
  // The entry's own queue is read alone (queueAt) for the page and for its subject; with no overview stored, the other proposals come from every queue (waitingQueues), which
  // reads the one queue of the fixture a third time on this Host, whose read keeps no text (a snapshot of MOD-repository-hosts answers it from the texts it holds).
  { site: "flow.mjs", route: "spec-entry", params: { id: ENTRY_ID }, product: { graphMissing: true }, requests: 17 },
  { site: "edit.mjs", route: "requirement", params: { name: LOAN }, product: { graphMissing: true }, requests: 8 },
  { site: "entry-edit.mjs", route: "spec-entry", params: { id: ENTRY_ID, edit: "1" }, product: { graphMissing: true }, requests: 23 },
  { site: "jobs.mjs showDraft", route: "use-case", params: { id: "draft" }, product: { graphMissing: true }, requests: 2 },
  // The drafting of the architecture is no such route: while the head's graph is not stored it lists the requirements of the head's SPEC.md (MOD-review-pages, Uses).
];

async function drawSite(site, token) {
  emptyStorage();
  const fake = fakeProduct();
  const requests = [];
  const base = contextOf(fake, { token });
  const context = { ...base, product: { ...base.product, host: recording(fake.host, requests, site.product) },
    instance: { ...base.instance, host: recording(fakeInstance().host, requests, site.instance) } };
  if (site.draft) keepDraft(context, { subject: UC7_KEY, kind: "change-use-case", params: { useCase: "UC-007" }, result: resultOf({ files: [] }) });
  const { target } = await draw(fake, site.route, site.params, { context });
  const problems = byClass(target, "p", "problem");
  return { problems, requests, links: problems.flatMap((paragraph) => byClass(paragraph, "a", "token-step")), commit: fake.head() };
}

// The paragraph as a string: its class and its markup.
const shown = (paragraph) => `${paragraph.className}|${paragraph.innerHTML}`;

for (const site of SITES) {
  // TST-601010 · level: unit · module: MOD-review-pages
  // guards: UC-008; UC-020
  // given: the review pages over a product whose read named in the table fails with a NotFound, and a browser that stores no token
  // input: the route and parameters of the table
  // expect: the page holds one <p class="problem"> whose text is exactly the sentence that the repository is private or does not exist and that this browser stores no token that reaches it, a space and "Store a token"; one <a class="token-step"> in it, href "#add-product"; the paragraph is the one readProblem gives for a NotFound while no token is stored
  test(`${site.site} — a failed read without a stored token is named by readProblem: private or missing, with the link to store a token`, async () => {
    assert.equal(typeof frame.readProblem, "function", "the frame provides readProblem");
    const { problems, links } = await drawSite(site, false);
    assert.equal(problems.length, 1, "one problem paragraph");
    assert.equal(problems[0].textContent, `${PRIVATE} Store a token`);
    assert.equal(links.length, 1, "one link to store a token");
    assert.equal(links[0].getAttribute("href"), "#add-product");
    assert.equal(shown(problems[0]), shown(frame.readProblem(failure("NotFound", site.message), false)));
  });

  // TST-601011 · level: unit · module: MOD-review-pages
  // guards: UC-008; UC-020; A USED-UP RATE LIMIT IS NAMED, NOT BLAMED ON THE TOKEN
  // given: the same failing read, and a browser that stores the product's token
  // input: the same route and parameters
  // expect: the page holds one <p class="problem"> whose text is exactly the host's message of the table; no link to store a token (the same search finds the link in the case above); the paragraph is the one readProblem gives for a NotFound while a token is stored
  test(`${site.site} — a failed read with a stored token is named by readProblem: the host's own message and no link`, async () => {
    const known = await drawSite(site, false);
    assert.equal(known.links.length, 1, "known positive: the search finds the link where no token is stored");
    const { problems, links } = await drawSite(site, true);
    assert.equal(problems.length, 1, "one problem paragraph");
    assert.equal(problems[0].textContent, site.message);
    assert.equal(links.length, 0, "no link to store a token");
    assert.equal(shown(problems[0]), shown(frame.readProblem(failure("NotFound", site.message), true)));
  });

  // TST-601012 · level: unit · module: MOD-review-pages
  // guards: UC-008; UC-020
  // given: the same failing read, with a token stored and with none
  // input: the same route and parameters, counting the calls on the product's Host and on the instance's
  // expect: the page makes exactly the number of requests the table names, with a token and without; naming the failed read adds none
  test(`${site.site} — naming the failed read makes no request of its own`, async () => {
    const without = await drawSite(site, false);
    const withToken = await drawSite(site, true);
    assert.ok(without.requests.length > 0, "known positive: the page makes requests");
    assert.equal(without.requests.length, site.requests, "requests without a token");
    assert.equal(withToken.requests.length, site.requests, "requests with a token");
  });
}

for (const site of GRAPH_SITES) {
  // TST-601015 · level: unit · module: MOD-review-pages
  // guards: UC-008; UC-020
  // given: the review pages over a product whose branch trace-cache holds no graph of the commit shown, with no token stored, and with the product's token stored
  // input: the route and parameters of the table
  // expect: the page holds one <p class="problem"> whose text is exactly "This page could not be drawn: " and the message of GraphNotStored, "the trace graph of <commit12> is not stored yet — …"; no link to store a token, with a token or without; the paragraph is the one readProblem gives for that error. MOD-site-frame's readProblem: "for an error that is no host's failure, a fault of the page itself: that this page could not be drawn, with the error's message, and no link to a token" — GraphNotStored is MOD-trace-graph's error, not a host's failure.
  test(`${site.site} — a graph that is not stored is named by readProblem: this page could not be drawn, with the message and no link`, async () => {
    for (const token of [false, true]) {
      const { problems, links, commit } = await drawSite(site, token);
      const message = GRAPH_NOT_STORED(commit);
      assert.equal(problems.length, 1, `one problem paragraph (token: ${token})`);
      assert.equal(problems[0].textContent, `This page could not be drawn: ${message}`);
      assert.equal(links.length, 0, "no link to store a token");
      assert.equal(shown(problems[0]), shown(frame.readProblem(Object.assign(new Error(message), { name: "GraphNotStored" }), token)));
    }
  });

  // TST-601017 · level: unit · module: MOD-review-pages
  // guards: UC-008; UC-020
  // given: the same product, with a token stored and with none
  // input: the same route and parameters, counting the calls on the product's Host and on the instance's (repositoryInfo, readSnapshot and each read of a file of the default branch)
  // expect: the page makes exactly the number of requests the table names, with a token and without; naming the missing graph adds none
  test(`${site.site} — naming the missing graph makes no request of its own`, async () => {
    const without = await drawSite(site, false);
    const withToken = await drawSite(site, true);
    assert.ok(without.requests.length > 0, "known positive: the page makes requests");
    assert.equal(without.requests.length, site.requests, "requests without a token");
    assert.equal(withToken.requests.length, site.requests, "requests with a token");
  });
}

// TST-1300008 · level: unit · module: MOD-review-pages
// guards: UC-008; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the review pages over a product whose branch trace-cache holds no graph of the commit shown, with a token stored
// input: the route decision/draft
// expect: no problem paragraph — the page is drawn; its list of what the derivation covers holds the requirement A LOAN… of the head's SPEC.md (li.requirement), and no line of an earlier graph (p.graph-as-of) — the page shows none. Counter-proof: before this change the same route drew "This page could not be drawn: the trace graph of … is not stored yet" (TST-601015's row for it)
test("jobs.mjs showArchitectureDraft — while the head's graph is not stored, the page lists the head SPEC's requirements and draws", async () => {
  emptyStorage();
  const fake = fakeProduct();
  const requests = [];
  const base = contextOf(fake, { token: true });
  const context = { ...base, product: { ...base.product, host: recording(fake.host, requests, { graphMissing: true }) } };
  const { target } = await draw(fake, "decision", { id: "draft" }, { context });
  assert.deepEqual(byClass(target, "p", "problem").map((each) => each.textContent), []);
  assert.ok(byClass(target, "li", "requirement").some((item) => item.textContent === LOAN), "the head SPEC's requirement is listed");
  assert.deepEqual(byClass(target, "p", "graph-as-of"), []);
});

// TST-601014 · level: unit · module: MOD-review-pages
// guards: UC-008; UC-020
// given: the page that drafts use cases, with a participant chosen and a token stored, and then every read of a file of the product failing with a NotFound naming the file
// input: pressing Show the run panel
// expect: the stage of the page holds one <p class="problem"> whose text is exactly the host's message, "SPEC.md was not found" (the first file the preparation reads); no link to store a token (a token is stored); the paragraph is the one readProblem gives for that failure while a token is stored
test("jobs.mjs panelOf — a run panel that cannot be prepared is named by readProblem: the host's own message", async () => {
  emptyStorage();
  const fake = fakeProduct();
  const armed = { on: false };
  const base = contextOf(fake, { token: true });
  writeSetting(base.store, "endpoint:ep1", { url: "https://ep1.example.test/v1", kind: "openai-compatible", model: "m", throughBridge: false });
  const requests = [];
  const host = { ...fake.host, async readSnapshot(ref) {
    requests.push(`readSnapshot ${ref}`);
    const snapshot = await fake.host.readSnapshot(ref);
    return { ...snapshot, read: async (path) => { requests.push(`read ${path}`); if (armed.on) throw failure("NotFound", `${path} was not found`); return snapshot.read(path); } };
  } };
  const { target } = await draw(fake, "use-case", { id: "draft" }, { context: { ...base, product: { ...base.product, host } } });
  const box = byClass(target, "input", "participant").find((each) => each.value === "drafter-a");
  box.checked = true;
  box.dispatchEvent(new Event("change"));
  armed.on = true;
  const before = requests.length;
  click(byClass(target, "button", "prepare")[0]);
  await until(() => byClass(target, "p", "problem").length > 0, "the problem paragraph");
  const problems = byClass(target, "p", "problem");
  assert.equal(problems.length, 1, "one problem paragraph");
  assert.equal(problems[0].textContent, "SPEC.md was not found");
  assert.equal(byClass(problems[0], "a", "token-step").length, 0, "no link to store a token");
  assert.equal(shown(problems[0]), shown(frame.readProblem(failure("NotFound", "SPEC.md was not found"), true)));
  assert.equal(requests.length - before, 1, "the press makes one request, the failed read of SPEC.md");
});

// TST-601013 · level: unit · module: MOD-review-pages
// guards: UC-008; UC-020
// given: the module's file common.mjs, which holds what the review pages of every kind share
// input: the names it exports
// expect: readPlace and storedToken are among them (the same search finds what it must); `problem` is not
test("common.mjs — the review pages keep no problem of their own: the frame's readProblem is the one", () => {
  const exported = Object.keys(common);
  assert.ok(exported.includes("readPlace") && exported.includes("storedToken"), "known positive: the search finds what common.mjs exports");
  assert.equal(exported.includes("problem"), false);
});
