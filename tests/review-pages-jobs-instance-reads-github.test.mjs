// System test of the requests the instance receives from a page that starts a drafting job (MOD-review-pages, jobs.mjs, `<route>/id=draft`), over MOD-repository-hosts' real
// GitHub host: docs/architecture/MOD-repository-hosts.md states that `readSnapshot` reads "the commit and its whole tree in a fixed number of requests … two on GitHub, the
// commit and then its tree", after the repository's own information, so one snapshot of the instance costs three requests.
// Run: node --test tests/review-pages-jobs-instance-reads-github.test.mjs
//
// Module: MOD-review-pages
// Guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// Level: system
//
// The fixture is tests/uc-006-batched-reads-harness.mjs': a product of 10 files with the links file docs/sources.md, and the instance alice/agent-m whose register docs/sources/
// holds SRC-alice and SRC-bob, each a fake GitHub that records its requests, behind the real GitHub host. The harness opens the SPEC-entry route only, so this file draws the
// routes itself in the same way. Every expected number is written out in its test.

import "./review-pages-harness.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { TOKEN, PRODUCT_ADDRESS, INSTANCE_REPO, INSTANCE_ADDRESS, fakeGitHub, productWithLinks, instanceFiles } from "./uc-006-batched-reads-harness.mjs";
import { openStore, writeSetting } from "../src/browser-store/index.mjs";
import { connect, parseAddress } from "../src/repository-hosts/index.mjs";
import { storedGraphBytes } from "./stored-graph-fake.mjs";

const pages = await import("../src/review-pages/index.mjs");

// The request of each repository goes to its own fake, told apart by the repository in the path, the raw host's path or the GraphQL variables. The product's branch
// trace-cache holds the graph of its commit, `<commit>.json.gz`, as the workflow "main changed" stores it (tests/stored-graph-fake.mjs): a page reads that graph and
// never builds one (MOD-trace-graph). The product fake answers no other branch, so this router answers that file's read.
const routed = (product, instance, held) => async (input, init = {}) => {
  const url = new URL(String(input));
  const body = typeof init.body === "string" ? JSON.parse(init.body) : null;
  const ofInstance = url.pathname.startsWith(`/repos/${INSTANCE_REPO}`) || url.pathname.startsWith(`/${INSTANCE_REPO}/`) || body?.variables?.name === INSTANCE_REPO.split("/")[1];
  const stored = !ofInstance && /\/([0-9a-f]{40})\.json\.gz$/.exec(url.pathname);
  if (stored) return new Response(await storedGraphBytes({ commit: stored[1], paths: Object.keys(held), read: async (path) => held[path] ?? null }));
  return (ofInstance ? instance : product).fetch(input, init);
};

// Draws `<route>/id=draft` of the product over the real GitHub host, with the product's token stored or none, and returns the requests the instance received, by kind.
async function startPage(routeName, token) {
  const held = productWithLinks(10);
  const product = fakeGitHub(held), instance = fakeGitHub(instanceFiles(), { repo: INSTANCE_REPO });
  const real = globalThis.fetch;
  globalThis.fetch = routed(product, instance, held);
  try {
    while (globalThis.localStorage.length) globalThis.localStorage.removeItem(globalThis.localStorage.key(0));
    const store = openStore("alice/agent-m");
    if (token) writeSetting(store, "github-token:alice/spec-product", { value: TOKEN, name: "Agent M - spec-product", expires: "2027-01-01" });
    const credentials = token ? { token: TOKEN } : {};
    const target = document.createElement("div");
    document.body.append(target);
    const context = { page: "review", instance: { repository: INSTANCE_REPO, host: connect(parseAddress(INSTANCE_ADDRESS), credentials) },
      product: { address: PRODUCT_ADDRESS, kind: "github", host: connect(parseAddress(PRODUCT_ADDRESS), credentials) }, store, go() {} };
    await pages.view.routes.find((candidate) => candidate.name === routeName).render(target, context, { id: "draft" });
  } finally {
    globalThis.fetch = real;
  }
  const paths = instance.requests.map((request) => request.url.pathname);
  return { total: instance.requests.length, repository: paths.filter((path) => path === `/repos/${INSTANCE_REPO}`).length, commit: paths.filter((path) => path.endsWith("/commits/main")).length,
    tree: paths.filter((path) => path.includes("/git/trees/")).length, batch: instance.graphqlRequests().length, raw: instance.requests.filter((r) => r.url.origin === "https://raw.githubusercontent.com").length };
}

// The three requests of one snapshot of the instance: its repository, the commit of its default branch and that commit's tree.
const ONE_SNAPSHOT = { repository: 1, commit: 1, tree: 1 };

for (const route of [["spec-entry", "requirements"], ["decision", "the architecture"]]) {
  // TST-852201 · level: system · module: MOD-review-pages
  // guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
  // given: a product on GitHub with the links file docs/sources.md; an instance alice/agent-m whose register docs/sources/ holds SRC-alice and SRC-bob; the reviewer's token is stored
  // input: open the page that starts the derivation of requirements, or of the architecture, of the product
  // expect: the instance receives 5 requests in all: its repository, its default branch's commit and its tree once each, the 1 batch of GitHub's GraphQL API that reads its register, and the GraphQL request of greenToMerge beside its repository (ITM-1170); nothing is read on the raw host
  test(`TST-852201: the derivation of ${route[1]} sends the instance one repository, one commit and one tree request, with a token`, async () => {
    const seen = await startPage(route[0], true);
    assert.deepEqual({ repository: seen.repository, commit: seen.commit, tree: seen.tree }, ONE_SNAPSHOT, JSON.stringify(seen));
    assert.equal(seen.batch, 2, JSON.stringify(seen));
    assert.equal(seen.raw, 0, JSON.stringify(seen));
    assert.equal(seen.total, 5, JSON.stringify(seen));
  });

  // TST-852202 · level: system · module: MOD-review-pages
  // guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
  // given: the same product and instance; no token is stored
  // input: open the same page
  // expect: the instance receives 5 requests in all: its repository, its default branch's commit and its tree once each, and the 2 files of its register each on the raw host; no request to /graphql
  test(`TST-852202: the derivation of ${route[1]} sends the instance one repository, one commit and one tree request, without a token`, async () => {
    const seen = await startPage(route[0], false);
    assert.deepEqual({ repository: seen.repository, commit: seen.commit, tree: seen.tree }, ONE_SNAPSHOT, JSON.stringify(seen));
    assert.equal(seen.batch, 0, JSON.stringify(seen));
    assert.equal(seen.raw, 2, JSON.stringify(seen));
    assert.equal(seen.total, 5, JSON.stringify(seen));
  });
}

for (const token of [true, false]) {
  // TST-852203 · level: system · module: MOD-review-pages
  // guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
  // given: the same product and instance; the token is stored, or none (the page that already reads the instance once)
  // input: open the page that starts the derivation of use cases, which reads the instance's register of participants and no source
  // expect: the instance receives 3 requests in all: its repository, its default branch's commit and its tree once each — with a token 4, the GraphQL request of greenToMerge beside its repository (ITM-1170); the count is otherwise the same as before this item
  test(`TST-852203: the derivation of use cases still sends the instance three requests, ${token ? "with" : "without"} a token`, async () => {
    const seen = await startPage("use-case", token);
    assert.deepEqual({ repository: seen.repository, commit: seen.commit, tree: seen.tree }, ONE_SNAPSHOT, JSON.stringify(seen));
    assert.equal(seen.total, token ? 4 : 3, JSON.stringify(seen));
  });
}
