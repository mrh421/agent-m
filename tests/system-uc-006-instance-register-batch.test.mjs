// UC-006 system tests of the instance's register on a product's SPEC-entry page (ITM-844): the register of requirement sources lives in the
// instance's repository, not in the product's, and the page reads it from the instance, with a token in one batch.
// Run: node --test tests/system-uc-006-instance-register-batch.test.mjs
//
// Module: MOD-review-pages
// Guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; THE PERSON WHO PROMPTS IS A SOURCE; A REQUIREMENT HAS A REGISTERED SOURCE
// Level: system
//
// The page is the `spec-entry` route of MOD-review-pages over the real GitHub host, as tests/system-uc-006-batched-reads.test.mjs reaches it, but here the
// instance is a second fake GitHub (alice/agent-m, tests/uc-006-batched-reads-harness.mjs) that holds the register, so the read of the register is reached.
// The product is a fake GitHub of 10 files. Every request of each repository is recorded by its own fake. Every expected number is written out in its test.

import test from "node:test";
import assert from "node:assert/strict";
import { productWithLinks, instanceFiles, REGISTER_PATHS, PERSON_SOURCE, INSTANCE_REPO, fakeGitHub, openPage, lastContext, ENTRY_ID } from "./uc-006-batched-reads-harness.mjs";

const pages = await import("../src/review-pages/index.mjs");
const route = pages.view.routes.find((candidate) => candidate.name === "spec-entry");
const asked = (fake) => fake.requests.map((r) => `${r.method} ${r.url.pathname}`.replace(/[0-9a-f]{40}/, "<commit>")).sort();
const REPO = `GET /repos/${INSTANCE_REPO}`, COMMIT = `GET /repos/${INSTANCE_REPO}/commits/main`, TREE = `GET /repos/${INSTANCE_REPO}/git/trees/<commit>`;

// TST-844201 · level: system · module: MOD-review-pages
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: a product on GitHub with the links file docs/sources.md; an instance alice/agent-m whose register docs/sources/ holds SRC-alice and SRC-bob; the reviewer's token is stored
// input: open the SPEC-entry page of entry 07 of the product
// expect: the instance's register is read in one request of GitHub's batch API that names its two files (docs/sources/SRC-alice.md and docs/sources/SRC-bob.md) and no file of the instance is read on its own; the instance receives 4 requests in all: its repository, its default branch's commit and its tree once each (the one snapshot serves the person's account and the register) and the 1 batch
test("TST-844201: a product's entry page reads the instance's register in one batch with a token", async () => {
  const product = fakeGitHub(productWithLinks(10)), instance = fakeGitHub(instanceFiles(), { repo: INSTANCE_REPO });
  await openPage(product, { id: ENTRY_ID }, { instance });

  assert.deepEqual(instance.namedPerQuery(), [2]);
  assert.deepEqual(instance.graphqlRequests()[0].body.query.match(/docs\/sources\/SRC-[a-z]+\.md/g).sort(), REGISTER_PATHS);
  assert.deepEqual(instance.contentPaths(), []);
  assert.deepEqual(asked(instance), [COMMIT, REPO, TREE, "POST /graphql"].sort());
  assert.equal(instance.requests.length, 4);
  // The graph the workflow "main changed" stored for the product's commit is read by one request of its own (MOD-trace-graph's storedGraph); it is no file of the product.
  assert.deepEqual(product.contentPaths().filter((path) => !/^[0-9a-f]{40}\.json\.gz$/.test(path)), [], "the product's own files are read in batches too");
});

// TST-844202 · level: system · module: MOD-review-pages
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the same product and instance; no token is stored
// input: open the SPEC-entry page of entry 07 of the product
// expect: nothing is read in a batch: no request to /graphql and no request that carries an Authorization header, on either repository; the instance's two register files are each read on its own from GitHub's raw host; the instance receives 5 requests in all (its repository, commit and tree once each and the 2 raw reads)
test("TST-844202: without a token the instance's register is read file by file from the raw host", async () => {
  const product = fakeGitHub(productWithLinks(10)), instance = fakeGitHub(instanceFiles(), { repo: INSTANCE_REPO });
  await openPage(product, { id: ENTRY_ID }, { instance, token: null });

  assert.equal(instance.graphqlRequests().length, 0);
  assert.equal(product.graphqlRequests().length, 0);
  assert.deepEqual(instance.contentPaths().sort(), REGISTER_PATHS);
  assert.equal(instance.requests.filter((r) => r.url.origin === "https://raw.githubusercontent.com").length, 2);
  assert.equal(instance.requests.length, 5);
  assert.equal([...instance.requests, ...product.requests].filter((r) => "authorization" in r.headers).length, 0);
});

// TST-844203 · level: system · module: MOD-review-pages
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; THE PERSON WHO PROMPTS IS A SOURCE
// given: the same product and instance with the reviewer's token, on a GitHub whose /graphql answers 404 for the instance (a server that serves none)
// input: open the SPEC-entry page of entry 07, then ask the route for its subject and for the parameters of a message
// expect: the batch is tried once (1 request to the instance's /graphql, which names the two register files), then each register file is read on its own (2 GETs of file contents, the two register files); the subject's parameters still name the person's own source SRC-alice
test("TST-844203: when the instance serves no batch, its register is read file by file and the person's source is still found", async () => {
  const none = () => new Response(JSON.stringify({ message: "Not Found" }), { status: 404, headers: { "Content-Type": "application/json" } });
  const product = fakeGitHub(productWithLinks(10)), instance = fakeGitHub(instanceFiles(), { repo: INSTANCE_REPO, graphql: none });
  await openPage(product, { id: ENTRY_ID }, { instance });

  assert.equal(instance.graphqlRequests().length, 1);
  assert.deepEqual(instance.graphqlRequests()[0].body.query.match(/docs\/sources\/SRC-[a-z]+\.md/g).sort(), REGISTER_PATHS);
  assert.deepEqual(instance.contentPaths().sort(), REGISTER_PATHS);
  assert.equal(route.subject({ id: ENTRY_ID }, lastContext()).paramsFor({}).source, PERSON_SOURCE);
});

// TST-844204 · level: system · module: MOD-review-pages
// guards: THE PERSON WHO PROMPTS IS A SOURCE
// given: the product, whose links file links SRC-alice, and the instance alice/agent-m, whose register holds the entry SRC-alice of the account github.com/alice, the owner of the instance; the reviewer's token is stored
// input: open the SPEC-entry page of entry 07, then ask the route for the parameters of a message
// expect: the parameters carry the person's own source "SRC-alice", found in the register that was read in one batch
test("TST-844204: with the author's entry in the register, the subject carries the person's own source", async () => {
  const product = fakeGitHub(productWithLinks(10)), instance = fakeGitHub(instanceFiles(), { repo: INSTANCE_REPO });
  await openPage(product, { id: ENTRY_ID }, { instance });

  assert.equal(route.subject({ id: ENTRY_ID }, lastContext()).paramsFor({}).source, "SRC-alice");
  assert.deepEqual(instance.namedPerQuery(), [2]);
});

// TST-844205 · level: system · module: MOD-review-pages
// guards: THE PERSON WHO PROMPTS IS A SOURCE; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the same product, and an instance whose register holds only SRC-bob, not the entry of its author github.com/alice; the reviewer's token is stored
// input: open the SPEC-entry page of entry 07, then ask the route for the parameters of a message
// expect: the register is read in one batch that names its one file (docs/sources/SRC-bob.md); the parameters are given without throwing and hold no `source` key — a kind that needs one refuses by its own precondition (MOD-prompt-bar, MOD-review-pages)
test("TST-844205: with no entry of the author in the register, the batch names the one file and the parameters hold no source", async () => {
  const product = fakeGitHub(productWithLinks(10)), instance = fakeGitHub(instanceFiles({ withAuthor: false }), { repo: INSTANCE_REPO });
  await openPage(product, { id: ENTRY_ID }, { instance });

  assert.deepEqual(instance.namedPerQuery(), [1]);
  assert.deepEqual(instance.contentPaths(), []);
  assert.equal(Object.hasOwn(route.subject({ id: ENTRY_ID }, lastContext()).paramsFor({}), "source"), false, "a missing source is no `source` key");
});
