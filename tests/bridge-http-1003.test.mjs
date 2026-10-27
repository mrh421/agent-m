// MOD-bridge-http — serveBridge tells which origin it is paired with: pairedWith() (ITM-1003).
// Run: node --test tests/bridge-http-1003.test.mjs
//
// Module: MOD-bridge-http
// Guards: THE BRIDGE IS PAIRED ONCE; THE LOCAL BRIDGE REQUIRES A TOKEN; THE BRIDGE SHOWS ITS PAIRING TOKEN IN ITS WINDOW
// Level: unit
//
// Each case starts the real server on 127.0.0.1 at a free port (port 0) with a temporary data folder, and closes it at the end.

import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pairAnew, serveBridge } from "../src/bridge-http/index.mjs";

const ORIGIN = "https://akmaier.github.io";

async function running(t, { folder, paused = () => false } = {}) {
  const dataFolder = folder ?? await mkdtemp(join(tmpdir(), "agent-m-bridge-http-1003-"));
  const server = await serveBridge({ name: () => "lab-pc", host: "127.0.0.1", port: 0, origin: ORIGIN, dataFolder, paused }, { jobs: {}, mail: {}, tunnels: {} });
  let closing = null;
  const close = () => (closing ??= server.close());
  t.after(close);
  return { ...server, folder: dataFolder, close };
}

const pair = (server, { origin = ORIGIN, token = server.token } = {}) =>
  fetch(`${server.address}/v1/pair`, { headers: { ...(origin === null ? {} : { Origin: origin }), ...(token === null ? {} : { "X-Agent-M-Bridge-Token": token }) } });

// TST-1003001 · level: unit · module: MOD-bridge-http
// guards: THE BRIDGE IS PAIRED ONCE
// given: a Bridge server just started on 127.0.0.1, no request made
// input: call pairedWith() on what serveBridge returned
// expect: pairedWith is a function and answers null
test("TST-1003001: pairedWith() is null after the start", async (t) => {
  const server = await running(t);
  assert.equal(typeof server.pairedWith, "function");
  assert.equal(server.pairedWith(), null);
});

// TST-1003002 · level: unit · module: MOD-bridge-http
// guards: THE BRIDGE IS PAIRED ONCE; THE LOCAL BRIDGE REQUIRES A TOKEN
// given: a Bridge server just started, its token and its origin known
// input: GET /v1/pair from the origin with the token in force, then a second such request
// expect: the request is answered 200, and pairedWith() is the origin, before and after the second request
test("TST-1003002: after a request with the token from origin, pairedWith() is that origin", async (t) => {
  const server = await running(t);
  assert.equal(server.pairedWith(), null);
  assert.equal((await pair(server)).status, 200);
  assert.equal(server.pairedWith(), ORIGIN);
  assert.equal((await pair(server)).status, 200);
  assert.equal(server.pairedWith(), ORIGIN);
});

// TST-1003003 · level: unit · module: MOD-bridge-http
// guards: THE BRIDGE IS PAIRED ONCE
// given: a paired Bridge server (pairedWith() is the origin)
// input: pairAnew on its data folder with a random token; a request with the old token; a request with the new token
// expect: null right after pairAnew; still null after the refused old-token request (401); the origin again after the new-token request
test("TST-1003003: after pairAnew, pairedWith() is null again until the next such request", async (t) => {
  const server = await running(t);
  await pair(server);
  assert.equal(server.pairedWith(), ORIGIN);
  const renewed = await pairAnew(server.folder, null);
  assert.notEqual(renewed, server.token);
  assert.equal(server.pairedWith(), null);
  assert.equal((await pair(server, { token: server.token })).status, 401);
  assert.equal(server.pairedWith(), null);
  assert.equal((await pair(server, { token: renewed })).status, 200);
  assert.equal(server.pairedWith(), ORIGIN);
});

// TST-1003004 · level: unit · module: MOD-bridge-http
// guards: THE BRIDGE IS PAIRED ONCE
// given: a paired Bridge server
// input: pairAnew with the token the Bridge already has (the one given), then a request with it
// expect: null after pairAnew although the token's text is unchanged, the origin after the next request
test("TST-1003004: pairAnew with the token already in force also resets pairedWith()", async (t) => {
  const server = await running(t);
  await pair(server);
  assert.equal(server.pairedWith(), ORIGIN);
  await pairAnew(server.folder, server.token);
  assert.equal(server.pairedWith(), null);
  assert.equal((await pair(server)).status, 200);
  assert.equal(server.pairedWith(), ORIGIN);
});

// TST-1003005 · level: unit · module: MOD-bridge-http
// guards: THE BRIDGE IS PAIRED ONCE; THE LOCAL BRIDGE REQUIRES A TOKEN
// given: a Bridge server just started
// input: a request from another origin with the right token; a request from origin with a wrong token; one with no token; one with no Origin header; a preflight from origin
// expect: 403, 401, 401, 403 and 204, and pairedWith() stays null after every one
test("TST-1003005: a request from another origin, or with a wrong token, leaves pairedWith() null", async (t) => {
  const server = await running(t);
  const cases = [
    [{ origin: "https://other.example" }, 403],
    [{ token: "not-the-token" }, 401],
    [{ token: "" }, 401],
    [{ origin: null }, 403],
  ];
  for (const [options, status] of cases) {
    assert.equal((await pair(server, options)).status, status);
    assert.equal(server.pairedWith(), null);
  }
  const preflight = await fetch(`${server.address}/v1/pair`, { method: "OPTIONS", headers: { Origin: ORIGIN, "Access-Control-Request-Method": "GET" } });
  assert.equal(preflight.status, 204);
  assert.equal(server.pairedWith(), null);
  const noToken = await pair(server, { token: null });
  assert.equal(noToken.status, 401);
  assert.equal(server.pairedWith(), null);
});

// TST-1003006 · level: unit · module: MOD-bridge-http
// guards: THE BRIDGE IS PAIRED ONCE
// given: a paired Bridge server on a data folder
// input: close it, start another server on the same data folder
// expect: the new server's pairedWith() is null, its token is the kept one, and the data folder holds the file pairing-token only, whose text is the token and not the origin
test("TST-1003006: a restart gives null, and nothing of the pairing is written to the data folder", async (t) => {
  const first = await running(t);
  await pair(first);
  assert.equal(first.pairedWith(), ORIGIN);
  await first.close();
  const second = await running(t, { folder: first.folder });
  assert.equal(second.token, first.token);
  assert.equal(second.pairedWith(), null);
  assert.deepEqual(await readdir(first.folder), ["pairing-token"]);
  assert.equal((await readFile(join(first.folder, "pairing-token"), "utf8")).trim(), first.token);
  await pair(second);
  assert.equal(second.pairedWith(), ORIGIN);
  assert.deepEqual(await readdir(first.folder), ["pairing-token"]);
  assert.equal((await readFile(join(first.folder, "pairing-token"), "utf8")).trim(), first.token);
});

// TST-1003007 · level: unit · module: MOD-bridge-http
// guards: THE BRIDGE IS PAIRED ONCE
// given: two Bridge servers on two data folders, one of them paired
// input: pairAnew on the unpaired one's folder
// expect: the paired one stays paired with the origin
test("TST-1003007: pairAnew on another data folder leaves pairedWith() as it is", async (t) => {
  const one = await running(t);
  const other = await running(t);
  await pair(one);
  await pairAnew(other.folder, null);
  assert.equal(one.pairedWith(), ORIGIN);
});

// TST-1003008 · level: unit · module: MOD-bridge-http
// guards: THE BRIDGE IS PAIRED ONCE
// given: a paused Bridge server (paused() holds)
// input: a hand-over POST /v1/jobs from origin with the token, answered paused
// expect: the answer is 503 paused, and pairedWith() is the origin, as the request carried the token in force from origin
test("TST-1003008: a request answered paused still counts, as it carried the token from origin", async (t) => {
  const server = await running(t, { paused: () => true });
  const response = await fetch(`${server.address}/v1/jobs`, {
    method: "POST",
    headers: { Origin: ORIGIN, "X-Agent-M-Bridge-Token": server.token, "Content-Type": "application/json" },
    body: JSON.stringify({ product: "p", record: "r", commit: "c" }),
  });
  assert.equal(response.status, 503);
  assert.equal(server.pairedWith(), ORIGIN);
});
