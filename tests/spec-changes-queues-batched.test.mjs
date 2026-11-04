// The requests a read of the change queues makes to GitHub, with and without a token — MOD-spec-changes' `queues` over MOD-repository-hosts' real
// GitHub host, on a fake GitHub that answers as GitHub's REST API and GraphQL API answer and records every request. A product with 60 queues, as
// this repository has about 56: with a token the queues' files are read in the batches of the snapshot's readMany, one request for each hundred files;
// without one nothing is read ahead and every file is read on its own, as before.
// Run: node --test tests/spec-changes-queues-batched.test.mjs
//
// Module: MOD-spec-changes · MOD-repository-hosts
// Guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; OPEN PROPOSALS ARE SHOWN IN THE BROWSER; UC-006
// Level: component
//
// The product is a fixture this file builds: SPEC.md of one section and 60 queues 2026-03-01_q to 2026-03-30_q and 2026-04-01_q to 2026-04-30_q, each of one entry that
// replaces "## 1. Reading" with its proposal and rationale. The first 58 queues of that order have a decision row that names their entry's record, so their entry is in SPEC; the last two
// (2026-04-29_q and 2026-04-30_q) have none, so their entry is open and needs the text of its target, SPEC.md. Each case counts the requests of one call of `queues`, after the snapshot is read
// (the repository's commit and its tree are 2 requests more, the same on the base and on the head). Nothing reaches the network: `fetch` is the fake GitHub for the length of each case. Each case
// states its expected counts, with the arithmetic, before it runs. The counter-proofs are in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { connect, parseAddress } from "../src/repository-hosts/index.mjs";
import { queues } from "../src/spec-changes/index.mjs";
import { batchAnswer, atCommit } from "./repository-hosts-batch-fake.mjs";

const text = (...lines) => `${lines.join("\n")}\n`;
const gitBlob = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const ADDRESS = "https://github.com/alice/product";
const TOKEN = "github_pat_ALICEqueuesBATCHED0123456789abcdefghij";
const HEAD = "b".repeat(40);

const SPEC = text("# Fixture - Specification", "", "## 1. Reading", "", "**A SAMPLE RULE** *(Product Owner)*", "A reader reads a file whole.", "*Check:* `tests/sample.test.mjs`");
const PROPOSAL = SPEC.slice(SPEC.indexOf("## 1. Reading")).replace("whole.", "entirely.");

const FOLDERS = [];
for (let day = 1; day <= 30; day++) FOLDERS.push(`2026-03-${String(day).padStart(2, "0")}_q`);
for (let day = 1; day <= 30; day++) FOLDERS.push(`2026-04-${String(day).padStart(2, "0")}_q`);
const OPEN = ["2026-04-29_q", "2026-04-30_q"];

function productFiles() {
  const held = { "SPEC.md": SPEC };
  for (const folder of FOLDERS) {
    const base = `docs/spec-freigaben/${folder}`;
    held[`${base}/index.md`] = text(`# SPEC approvals - queue ${folder.slice(0, 10)} · q`, "", "**Zieldatei aller Einträge:** `SPEC.md`", "",
      "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |", "|---|---|---|---|---|", "| 01 | `SPEC.md` | ## 1. Reading | — | — |");
    held[`${base}/01-reading.md`] = PROPOSAL;
    held[`${base}/01-reading.begruendung.md`] = text("# 1. Reading: fixture change", "", "**The change.** A fixture.", "", "**Why.** A fixture.");
    held[`${base}/entscheidungen.md`] = OPEN.includes(folder) ? text(`# Decisions - queue ${folder} q`, "", "Append-only.")
      : text(`# Decisions - queue ${folder} q`, "", "Append-only.", `| ${folder.slice(0, 10)} 10:00 UTC | 1 | uebernommen | approval:spec-${folder}-01-${gitBlob(PROPOSAL).slice(0, 12)}.md |`);
  }
  return held;
}
const FILES = productFiles();

// A fake GitHub holding FILES at HEAD. `graphql` may answer the /graphql request instead (a Response). Every request is recorded as { method, url, body }.
function fakeGitHub({ graphql = null } = {}) {
  const requests = [];
  const prefix = "/repos/alice/product";
  const fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const method = init.method ?? "GET";
    const body = typeof init.body === "string" ? JSON.parse(init.body) : null;
    requests.push({ method, url, body });
    if (url.origin === "https://raw.githubusercontent.com") {
      const held = FILES[decodeURIComponent(url.pathname.split("/").slice(4).join("/"))];
      return held === undefined ? json({ message: "Not Found" }, 404) : new Response(held);
    }
    if (url.origin !== "https://api.github.com") return json({ message: "Not Found" }, 404);
    if (url.pathname === "/graphql") {
      const own = graphql?.();
      if (own) return own;
      return json(batchAnswer(body.query, { held: atCommit(HEAD, FILES) }));
    }
    if (url.pathname === `${prefix}/commits/main`) return json({ sha: HEAD, commit: { tree: { sha: "t" } } });
    if (url.pathname === `${prefix}/git/trees/${HEAD}`) return json({ tree: Object.entries(FILES).map(([path, body1]) => ({ path, type: "blob", sha: gitBlob(body1) })) });
    if (url.pathname.startsWith(`${prefix}/contents/`)) {
      const held = FILES[decodeURIComponent(url.pathname.slice(`${prefix}/contents/`.length))];
      return held === undefined ? json({ message: "Not Found" }, 404) : new Response(held);
    }
    return json({ message: "Not Found" }, 404);
  };
  return { fetch, requests };
}

// One call of `queues` over the real GitHub host, with or without a token -> its result and the requests it sent itself (those of the snapshot not counted); a second call on the same snapshot too.
async function call({ token, graphql }) {
  const fake = fakeGitHub({ graphql });
  const real = globalThis.fetch;
  globalThis.fetch = fake.fetch;
  try {
    const snapshot = await connect(parseAddress(ADDRESS), token ? { token: TOKEN } : {}).readSnapshot("main");
    const before = fake.requests.length;
    const result = await queues(snapshot);
    const sent = fake.requests.slice(before);
    const again = fake.requests.length;
    await queues(snapshot);
    return { result, sent, sentAgain: fake.requests.length - again };
  } finally {
    globalThis.fetch = real;
  }
}
const named = (sent) => sent.filter((r) => r.url.pathname === "/graphql").map((r) => [...r.body.query.matchAll(/:object\(expression:/g)].length);
const alone = (sent) => sent.filter((r) => r.url.pathname !== "/graphql");

// TST-677001 · level: component · module: MOD-spec-changes; MOD-repository-hosts
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-006
// given: a product on GitHub with 60 queues of one entry each, 58 of them decided and 2 open, and the reader's token
// input: one call of `queues` on the snapshot
// expect: 60 queues, in the order of their folders' names, the first 58 with their entry in SPEC and the last two with theirs open; exactly 3 requests, all POST https://api.github.com/graphql, naming 100, 20 and 2 files — the last the target and the rationales, whose line Issue gives each entry's issue (MOD-spec-changes, Queue): the 60 rationales are one text, one blob, read once —: the 60 index.md and the 60 entscheidungen.md are 120 files, which are 100 and 20; the target SPEC.md of the 2 open entries is 1 file; no file is read on its own
test("TST-677001: queues reads 60 queues with a token in 3 requests, 100 files, 20 files and the target", async () => {
  const { result, sent } = await call({ token: true });
  assert.equal(result.length, 60);
  assert.deepEqual(result.map((queue) => queue.folder), FOLDERS.map((folder) => `docs/spec-freigaben/${folder}`));
  assert.deepEqual(result.map((queue) => queue.entries[0].state), [...Array(58).fill("in SPEC"), ...OPEN.map(() => "open")]);
  assert.deepEqual(named(sent), [100, 20, 2]);
  assert.equal(sent.length, 3);
  assert.deepEqual(sent.map((request) => `${request.method} ${request.url.href}`), Array(3).fill("POST https://api.github.com/graphql"));
});

// TST-677002 · level: component · module: MOD-spec-changes; MOD-repository-hosts
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the product of TST-677001 and the reader's token; the snapshot has been read by `queues` once
// input: a second call of `queues` on the same snapshot
// expect: no request: the texts of the 122 files are held, and a file whose blob has been read is not read again
test("TST-677002: a second read of the queues on one snapshot sends no request", async () => {
  const { sentAgain } = await call({ token: true });
  assert.equal(sentAgain, 0);
});

// TST-677003 · level: component · module: MOD-spec-changes; MOD-repository-hosts
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK
// given: the product of TST-677001, public, and no token
// input: one call of `queues` on the snapshot
// expect: the same 60 queues as with a token; nothing is read ahead: no request to /graphql and no Authorization header, and every file on its own from GitHub's raw host: 122 reads, the 120 files of the queues, their rationales — one blob — and SPEC.md
test("TST-677003: queues without a token reads nothing ahead, 122 files on their own, and gives the same queues", async () => {
  const withToken = await call({ token: true });
  const { result, sent } = await call({ token: false });
  assert.deepEqual(result, withToken.result);
  assert.deepEqual(named(sent), []);
  assert.equal(alone(sent).filter((request) => request.url.origin === "https://raw.githubusercontent.com").length, 122);
  assert.equal(sent.length, 122);
});

// TST-677004 · level: component · module: MOD-spec-changes; MOD-repository-hosts
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the product of TST-677001 and the reader's token, on a GitHub whose /graphql answers 404 (a server that serves none)
// input: one call of `queues` on the snapshot
// expect: the same 60 queues; the batch is tried once for each of the two rounds of reading ahead (2 requests to /graphql, the first of 100 files and the second of 2), and every file is read on its own: 122 reads through the contents API
test("TST-677004: queues on a server that serves no /graphql gives the same queues, the batch tried in each of its two rounds", async () => {
  const withToken = await call({ token: true });
  const { result, sent } = await call({ token: true, graphql: () => json({ message: "Not Found" }, 404) });
  assert.deepEqual(result, withToken.result);
  assert.deepEqual(named(sent), [100, 2]);
  assert.equal(alone(sent).filter((request) => request.url.pathname.includes("/contents/")).length, 122);
  assert.equal(sent.length, 124);
});

// TST-1302017 · level: component · module: MOD-spec-changes; MOD-repository-hosts
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-019
// given: the product of TST-677001, 2 of its 60 queues open, and the reader's token
// input: the recipe `spec-with-queues` of specStrategies on the snapshot, as a change-requirements job prepares its input
// expect: the part "SPEC.md with its open queues"; SPEC.md read first, on its own; then only POST https://api.github.com/graphql — 100 and 20 files as `queues` reads them, then the rationales — one blob, SPEC.md, its target, being held already —, then the 2 open proposals in one more batch, which holds 1 file since both proposals are the same text —; no proposal read on its own
test("TST-1302017: spec-with-queues reads the open proposals in one batch, none on its own", async () => {
  const { specStrategies } = await import("../src/spec-changes/index.mjs");
  const fake = fakeGitHub();
  const real = globalThis.fetch;
  globalThis.fetch = fake.fetch;
  try {
    const snapshot = await connect(parseAddress(ADDRESS), { token: TOKEN }).readSnapshot("main");
    const before = fake.requests.length;
    const parts = await specStrategies.recipes["spec-with-queues"]({ product: { snapshot } }, {});
    const sent = fake.requests.slice(before);
    assert.equal(parts[0].name, "SPEC.md with its open queues");
    assert.deepEqual(alone(sent).map((request) => request.url.pathname), ["/repos/alice/product/contents/SPEC.md"], "only SPEC.md, read first, on its own");
    assert.deepEqual(named(sent), [100, 20, 1, 1]);
  } finally {
    globalThis.fetch = real;
  }
});
