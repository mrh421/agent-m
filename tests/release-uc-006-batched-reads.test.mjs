// UC-006 release tests of batched reads (ITM-479), one for each requirement ITM-479 realises besides UC-006 itself: A REQUIREMENT IS NOT
// CHANGED WITHOUT AN IMPACT LIST, A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT, A USED-UP RATE LIMIT IS NAMED, NOT BLAMED ON THE TOKEN.
// Run: node --test tests/release-uc-006-batched-reads.test.mjs
//
// Module: MOD-review-pages · MOD-trace-graph · MOD-repository-hosts
// Guards: UC-006; A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; A USED-UP RATE LIMIT IS NAMED, NOT BLAMED ON THE TOKEN
// Level: release
//
// Input: the SPEC-entry page of a product of 1,332 files on a fake GitHub (tests/uc-006-batched-reads-harness.mjs), opened as the dashboard opens it.
// Precondition: the reviewer's token is stored, except where a test says otherwise. Nothing reaches the network.
// Expected result: stated in each test. Written by a developer who implemented none of the behaviour; no expected value is read from a document.

import test from "node:test";
import assert from "node:assert/strict";
import { productFiles, fakeGitHub, openPage, byClass, ENTRY_ID, TOKEN } from "./uc-006-batched-reads-harness.mjs";

// The read-only request for greenToMerge that repositoryInfo sends with a token (ITM-1170) is a query of no file; the others ask for files.
const filesAsked = (fake) => fake.graphqlRequests().filter((q) => /object\(expression/.test(q.body.query));
const greenAsked = (fake) => fake.graphqlRequests().filter((q) => !/object\(expression/.test(q.body.query));

// TST-479201 · level: release · module: MOD-review-pages; MOD-trace-graph; MOD-repository-hosts
// guards: UC-006; A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST
// given: the product of 1,332 files in which UC-002, the only artifact that names "A WRITE RULE", is the last file of the tree; the branch trace-cache holds the graph the workflow "main changed" stored for the commit (a page reads that graph and never builds one — MOD-trace-graph)
// input: open the SPEC-entry page of entry 07, which changes "A WRITE RULE"
// expect: the impact list reads "A WRITE RULE — changed, named by UC-002", though the page reads no use case: UC-002 stands in no query and is read on its own by no request; the graph is read by one request; at most 3 queries for files (the queue's and the entry's) and one read-only query for greenToMerge (ITM-1170), and at most 11 requests in all — at most 9 and the two reads of the overview cache (the head's `<head>.json`, then `latest.json`, which the waiting queues are read from) — against the 1,336 of one request for each file
test("TST-479201: an impact list names an artifact the page never reads, from the stored graph, within 3 queries", async () => {
  const held = productFiles(1332), uc2 = "docs/use-cases/UC-002-write-a-file.md";
  const last = held[uc2];
  delete held[uc2];
  held[uc2] = last;
  const fake = fakeGitHub(held);
  const page = await openPage(fake, { id: ENTRY_ID });

  assert.equal(byClass(page, "ul", "impact")[0].textContent, "A WRITE RULE — changed, named by UC-002");
  assert.equal(fake.graphqlRequests().filter((q) => q.body.query.includes(uc2)).length, 0, "UC-002 stands in no query");
  assert.deepEqual(fake.contentPaths().filter((path) => path === uc2), [], "UC-002 is read on its own by no request");
  assert.equal(fake.requests.filter((r) => r.url.pathname.endsWith(".json.gz") && !r.url.pathname.endsWith(".references.json.gz") && r.url.searchParams.get("ref") === "trace-cache").length, 1, "no references stored: the stored graph, read once");
  assert.ok(filesAsked(fake).length <= 3);
  assert.equal(greenAsked(fake).length, 1, "and the one read-only request for greenToMerge");
  const head = fake.requests.find((r) => r.url.pathname.includes("/git/trees/")).url.pathname.split("/").pop();
  const overview = fake.requests.filter((r) => r.url.searchParams.get("ref") === "overview-cache");
  assert.deepEqual(overview.map((r) => r.url.pathname.split("/").pop()), [`${head}.json`, "latest.json"], "the overview cache is read twice: the head's file, then latest.json");
  // the references stored beside the graph (MOD-trace-graph's storedReferences) are asked for once; this fake stores none, so the graph is read.
  assert.ok(fake.requests.length - overview.length <= 9, `${fake.requests.length - overview.length} requests besides the overview cache, at most 9`);
  assert.ok(fake.requests.length <= 11, `${fake.requests.length} requests, at most 11 — the read-only request for greenToMerge is one of them, and one asks for the references stored beside the graph, which this fake stores none of`);
});

// TST-479202 · level: release · module: MOD-review-pages; MOD-trace-graph; MOD-repository-hosts
// guards: UC-006; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT
// given: the product on GitHub with the reviewer's token stored
// input: open the SPEC-entry page of entry 07 (the queries and the reads are made)
// expect: every request goes to https://api.github.com — the read of the stored graph on the branch trace-cache among them; every request carries "Authorization: Bearer <the token>"; the token is in no address and no body; there are 1 to 3 queries for files (the queue's and the entry's) and one read-only query for greenToMerge (ITM-1170), each a POST to https://api.github.com/graphql; and those POSTs are the only requests not GET
test("TST-479202: the token goes only to api.github.com, in the header, also on the batched reads", async () => {
  const fake = fakeGitHub(productFiles(1332));
  await openPage(fake, { id: ENTRY_ID });

  assert.ok(fake.requests.length > 0);
  for (const r of fake.requests) {
    assert.equal(r.url.origin, "https://api.github.com", r.url.href);
    assert.equal(r.headers.authorization, `Bearer ${TOKEN}`, r.url.href);
    assert.equal(r.url.href.includes(TOKEN) || JSON.stringify(r.body ?? "").includes(TOKEN), false, r.url.href);
  }
  const queries = fake.graphqlRequests();
  assert.equal(greenAsked(fake).length, 1, "one of the queries is the read-only request for greenToMerge");
  assert.ok(fake.requests.some((r) => r.url.pathname.endsWith(".json.gz") && r.url.searchParams.get("ref") === "trace-cache"), "the stored graph is among the requests checked");
  assert.ok(filesAsked(fake).length >= 1 && filesAsked(fake).length <= 3, `${filesAsked(fake).length} queries for files, 1 to 3`);
  for (const q of queries) { assert.equal(q.method, "POST"); assert.equal(q.url.href, "https://api.github.com/graphql"); }
  assert.equal(fake.requests.filter((r) => r.method !== "GET").length, queries.length, "every request that is not a GET is one of those queries");
});

// TST-479203 · level: release · module: MOD-review-pages; MOD-trace-graph; MOD-repository-hosts
// guards: UC-006; A USED-UP RATE LIMIT IS NAMED, NOT BLAMED ON THE TOKEN
// given: the product on GitHub with the reviewer's token; the account's hourly limit is used up, which GitHub tells on a query as (a) 403 with X-RateLimit-Remaining: 0 and (b) 200 with the error type RATE_LIMITED and X-RateLimit-Remaining: 0; and, apart, (c) a query answered 401 "Bad credentials"
// input: open the SPEC-entry page of entry 07 for each
// expect: the page is drawn (it does not reject), and its last element is one problem paragraph: for (a) and (b) it names the used-up limit and its reset (2030-01-01) and does not mention the token; for (c) it reads "GitHub rejected authentication with your ... Renew it on ..."; no file is read on its own after the limit is named
test("TST-479203: a used-up limit on a batched read is named on the page, a refused token shows its message", async () => {
  const limit = { "Content-Type": "application/json", "x-ratelimit-remaining": "0", "x-ratelimit-limit": "5000", "x-ratelimit-reset": "1893456000" };
  const answers = [
    [() => new Response(JSON.stringify({ message: "API rate limit exceeded" }), { status: 403, headers: limit }), "RateLimited"],
    [() => new Response(JSON.stringify({ data: null, errors: [{ type: "RATE_LIMITED", message: "API rate limit exceeded for user ID 1." }] }), { status: 200, headers: limit }), "RateLimited"],
    [() => new Response(JSON.stringify({ message: "Bad credentials" }), { status: 401, headers: { "Content-Type": "application/json" } }), "TokenRefused"],
  ];
  for (const [graphql, name] of answers) {
    const fake = fakeGitHub(productFiles(1332), { graphql });
    const page = await openPage(fake, { id: ENTRY_ID });
    const problems = byClass(page, "p", "problem");
    assert.equal(problems.length, 1, `${name}: one problem paragraph on the page`);
    assert.equal(page.children[page.children.length - 1], problems[0], `${name}: the paragraph is appended after what the view drew`);
    const text = problems[0].textContent;
    if (name === "RateLimited") {
      assert.match(text, /request limit/);
      assert.match(text, /used up/);
      assert.match(text, /resets at 2030-01-01/);
      assert.doesNotMatch(text, /token/i);
    } else {
      assert.match(text, /GitHub rejected authentication with your .+\. Renew it on /);
    }
    assert.equal(fake.contentPaths().filter((p) => p.startsWith("docs/backlog/")).length, 0, "no backlog item is read on its own after the failure");
  }
});

// TST-521201 · level: release · module: MOD-review-pages; MOD-trace-graph; MOD-repository-hosts
// guards: UC-006; A USED-UP RATE LIMIT IS NAMED, NOT BLAMED ON THE TOKEN
// given: the product of 1,332 files on GitHub with the reviewer's token stored; the account's hourly limit is used up, which GitHub tells on the impact list's batched queries as 403 with X-RateLimit-Remaining: 0, X-RateLimit-Limit: 5000 and X-RateLimit-Reset: 1893456000 (2030-01-01), after the snapshot has been read
// input: open the SPEC-entry page of entry 07, as the dashboard opens it
// expect: opening the page resolves, it does not reject; the page holds exactly one problem paragraph, the last element of the page, which reads that GitHub's request limit for the account these requests are made with is used up and that it resets at 2030-01-01; no word "token" stands in the paragraph, and it offers no link to store a token
test("TST-521201: a SPEC-entry page whose impact list meets a used-up limit names the limit and its reset, not the token", async () => {
  const limit = { "Content-Type": "application/json", "x-ratelimit-remaining": "0", "x-ratelimit-limit": "5000", "x-ratelimit-reset": "1893456000" };
  const fake = fakeGitHub(productFiles(1332), { graphql: () => new Response(JSON.stringify({ message: "API rate limit exceeded" }), { status: 403, headers: limit }) });
  const page = await openPage(fake, { id: ENTRY_ID });

  const problems = byClass(page, "p", "problem");
  assert.equal(problems.length, 1, "one problem paragraph on the page");
  assert.equal(page.children[page.children.length - 1], problems[0], "the paragraph is the last element of the page");
  const text = problems[0].textContent;
  assert.match(text, /request limit for the account these requests are made with is used up/);
  assert.match(text, /resets at 2030-01-01/);
  assert.doesNotMatch(text, /token/i);
  assert.equal(byClass(problems[0], "a", "token-step").length, 0, "no link to store a token");
});
