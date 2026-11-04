// Release tests of ITM-1187 — UC-049 1, 1a and 1b: "Agent M first reads this browser's configuration: its endpoints, and the CLI sessions its Bridges offer. Right above the bar, a small selector names the
// endpoint or CLI session the bar talks to, with the place where it processes data, as the configuration declares it"; "No participant list (UC-017) is configured or read for the bar"; "1b. An endpoint
// or CLI session lacks a place, a context or a model. It is not offered." (docs/use-cases/UC-049-talk-to-an-agent-in-the-prompt-bar.md) and docs/architecture/MOD-prompt-bar.md (Interfaces: startPromptBar:
// a CLI session is a coding agent that a stored Bridge lists ready through MOD-bridge-client's testBridge whose `session:<bridge>:<agent>` declares a place, a context and a model).
// Run: node --test tests/release-itm-1187-bar-offers-sessions.test.mjs
//
// Module: MOD-prompt-bar
// Module: MOD-bridge-client
// Guards: UC-049; UC-019; THE PROMPT BAR'S ENDPOINTS AND CLI SESSIONS ARE BOUND AS PARTICIPANTS ARE; THE PAGE NAMES WHERE IT SENDS
// Level: release
//
// Written for the release testing of sprint 127 by developer-sonnet-l, who implemented none of ITM-1187 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The page is MOD-site-frame's real `startPage` on the
// review page with the real prompt bar (the harness of tests/uc-019-prompt-bar-harness.mjs); the Bridge is a real controlled Bridge server on the loopback (src/bridge-http, as
// tests/release-itm-1186-bridge-sessions.test.mjs serves one) whose `/v1/agents` lists the agents claude, codex and opencode ready and gemini not ready, and every request it receives is kept with the token it carried. No
// message is sent: Send would hand the agent a task. No real input event is made. Readings the texts leave open, which the cases state:
//   - "names the session with its place before Send" is read as the bar's selector, `<bridge>:<agent> — <place>`, standing in the bar before any message is written.
//   - "No participant list ... is read for the bar" is read as: the instance's participant list is neither read when the bar is drawn nor offered, though it lists a participant the browser reaches.

import test from "node:test";
import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serveBridge } from "../src/bridge-http/index.mjs";
import { all, barOf, scenario } from "./uc-019-prompt-bar-harness.mjs";

const ORIGIN = "https://akmaier.github.io";
// The harness replaces global fetch for its page, so the page's requests to the loopback Bridge are carried to it over node:http, with the origin of the page (the Bridge refuses another).
const viaHttp = (address, init) => new Promise((resolve, reject) => {
  const request = httpRequest(address, { method: init.method ?? "GET", headers: { ...init.headers, Origin: ORIGIN } }, (response) => {
    const chunks = [];
    response.on("data", (chunk) => chunks.push(chunk));
    response.on("end", () => resolve(new Response(Buffer.concat(chunks), { status: response.statusCode, headers: { "content-type": response.headers["content-type"] ?? "application/json" } })));
  });
  request.on("error", reject);
  request.end(init.body ?? undefined);
});
const AGENTS = { agents: [{ name: "claude", version: "2.1.300", ready: true, loggedIn: true }, { name: "codex", version: "1.0.0", ready: true, loggedIn: true },
  { name: "opencode", version: "0.9.0", ready: true, loggedIn: true }, { name: "gemini", version: "0.1.0", ready: false, loggedIn: false }], missing: [] };
const CAPABILITIES = ["draft text", "read the repository", "write to the repository", "run code and tests", "use tools"];
const session = (over = {}) => ({ place: "this machine", context: 200000, model: "agent-model", capabilities: CAPABILITIES, ...over });

// A page with the bar, against a real Bridge that lists AGENTS. -> { s, seen }; `seen` is every request the Bridge received.
async function barOn(t, settings, options = {}) {
  const folder = await mkdtemp(join(tmpdir(), "agent-m-1187-release-"));
  const seen = [];
  const bridge = await serveBridge({ name: () => "lab-pc", host: "127.0.0.1", port: 9418, origin: ORIGIN, dataFolder: folder, paused: () => false },
    { jobs: { "GET /v1/agents": async () => AGENTS }, mail: {}, tunnels: {} });
  // The harness lets the page reach the loopback address 127.0.0.1:9418 only, so the Bridge stands there; a test that opens a second page closes the first Bridge first.
  let open = true;
  const close = async () => { if (open) { open = false; await bridge.close(); } };
  t.after(close);
  const bridgeFetch = async (url, init) => {
    seen.push({ method: init.method ?? "GET", path: url.pathname, token: init.headers?.["x-agent-m-bridge-token"] ?? null });
    return viaHttp(`${bridge.address}${url.pathname}${url.search}`, init);
  };
  const s = await scenario({ drafting: false, agents: [], bridgeFetch, settings: { "bridge:release-bridge": { address: bridge.address, token: bridge.token }, ...settings }, ...options });
  return { s, seen, bridge, close };
}
// What the selector of the bar names: each participant with its place, one to a line of the selector.
const offeredBy = (s) => {
  const selector = all(barOf(s), "select", "participant")[0];
  if (selector) return all(selector, "option").map((option) => option.textContent);
  return all(barOf(s), "span", "participant").map((node) => node.textContent);
};

// TST-1187201 · level: release · module: MOD-prompt-bar
// guards: UC-049; THE PAGE NAMES WHERE IT SENDS; THE PROMPT BAR'S ENDPOINTS AND CLI SESSIONS ARE BOUND AS PARTICIPANTS ARE
// given: this browser keeps the Bridge release-bridge, a real Bridge that lists claude, codex and opencode ready and gemini not ready, and declares the sessions claude (place "this machine") and gemini (place "this machine"); known positive first — the Bridge answers a request
// input: the page opened with the bar, before any message is written
// expect: known positive — the Bridge received requests, each with the pairing token; drawing the bar sent it exactly GET /v1/pair and GET /v1/agents, and nothing more; the bar's selector names exactly "release-bridge:claude — this machine": the ready agent that is declared, with its place, and neither gemini (declared, not ready) nor codex and opencode (ready, declared nowhere); no message was sent
test("TST-1187201: UC-049 1 the bar names a declared CLI session of a Bridge that lists it ready, with its place, before Send", async (t) => {
  const { s, seen, bridge } = await barOn(t, { "session:release-bridge:claude": session(), "session:release-bridge:gemini": session() });
  assert.ok(seen.length > 0, "known positive: the Bridge was reached");
  assert.deepEqual(seen.map((request) => `${request.method} ${request.path}`), ["GET /v1/pair", "GET /v1/agents"], "drawing the bar sends testBridge's two requests and nothing more");
  assert.ok(seen.every((request) => request.token === bridge.token), "each carries the pairing token");
  assert.deepEqual(offeredBy(s), ["release-bridge:claude — this machine"]);
  assert.equal(s.endpointRequests.length + s.bridgeRequests.length, 0, "no message was sent");
});

// TST-1187202 · level: release · module: MOD-prompt-bar
// guards: UC-049; THE PROMPT BAR'S ENDPOINTS AND CLI SESSIONS ARE BOUND AS PARTICIPANTS ARE
// given: the Bridge of TST-1187201 listing claude, codex and opencode ready; the sessions codex (complete), claude with no place, opencode with a place and a context and no model; then the same with claude's place declared
// input: the page opened with the bar
// expect: the selector names exactly "release-bridge:codex — this machine": claude, which lacks a place, and opencode, which lacks a model, are not offered and are named nowhere in the bar; counter-proof — with claude's place declared the selector names claude and codex, in the order the Bridge lists them, each with its place
test("TST-1187202: UC-049 1b a CLI session with no place, or with no model, is not offered; with its place declared it is", async (t) => {
  const lacking = { "session:release-bridge:codex": session({ place: "NHR@FAU, Erlangen" }), "session:release-bridge:claude": session({ place: "" }), "session:release-bridge:opencode": { place: "this machine", context: 200000, capabilities: CAPABILITIES } };
  const { s, seen, close } = await barOn(t, lacking);
  assert.ok(seen.length > 0, "known positive: the Bridge was reached, so the others are lacking and not unlisted");
  assert.deepEqual(offeredBy(s), ["release-bridge:codex — NHR@FAU, Erlangen"]);
  assert.doesNotMatch(barOf(s).textContent, /claude|opencode/, "what lacks its declaration is named nowhere in the bar");

  await close();
  const complete = await barOn(t, { ...lacking, "session:release-bridge:claude": session({ place: "this machine" }) });
  assert.deepEqual(offeredBy(complete.s), ["release-bridge:claude — this machine", "release-bridge:codex — NHR@FAU, Erlangen"], "counter-proof: claude with its place is offered");
});

// TST-1187203 · level: release · module: MOD-prompt-bar
// guards: UC-049; THE PROMPT BAR'S ENDPOINTS AND CLI SESSIONS ARE BOUND AS PARTICIPANTS ARE
// given: the instance's participant list holds listed-llm, a CLI agent at "this machine" whose route is the Bridge release-bridge's agent claude, which this browser reaches, and conversation recording is on, so that the draw reads one file of the instance; this browser declares the session release-bridge:codex only
// input: the page opened with the bar
// expect: known positive — the instance was asked for docs/conversation-recording.md when the bar was drawn, so that its reads are seen; the instance was never asked for docs/participants.md; the selector names "release-bridge:codex — this machine" alone and nowhere listed-llm
test("TST-1187203: UC-049 1 the instance's participant list is not read for the bar, and a participant of it is not offered", async (t) => {
  const listed = ["# Participants of this instance", "", "**REGISTER**", "", "The participants of the test instance.", "",
    "| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |", "|---|---|---|---|---|---|---|---|",
    "| listed-llm | CLI agent | listed-model | 200000 | — | draft text | this machine | bridge release-bridge agent claude |", ""].join("\n");
  const { s } = await barOn(t, { "session:release-bridge:codex": session() }, { recording: true, instanceFiles: { "docs/participants.md": listed } });
  const reads = s.instance.requests.filter((request) => /docs\/conversation-recording\.md|docs\/participants\.md/.test(request));
  assert.ok(reads.some((request) => request.includes("docs/conversation-recording.md")), `known positive: the instance's reads are seen: ${reads.join(" | ")}`);
  assert.ok(!reads.some((request) => request.includes("docs/participants.md")), "the participant list was not read");
  assert.deepEqual(offeredBy(s), ["release-bridge:codex — this machine"]);
  assert.doesNotMatch(barOf(s).textContent, /listed-llm/);
  assert.equal(s.product.writes.length + s.instance.writes.length, 0, "and nothing was written");
});

// TST-1187204 · level: release · module: MOD-prompt-bar
// guards: UC-049; UC-019; THE PROMPT BAR'S ENDPOINTS AND CLI SESSIONS ARE BOUND AS PARTICIPANTS ARE
// given: this browser keeps no Bridge and declares the endpoint drafter (place "this machine", context, model) and the endpoint no-place, which declares no place
// input: the page opened with the bar
// expect: the selector names exactly "drafter — this machine": the endpoint that lacks its place is not offered and is named nowhere in the bar; with no Bridge stored the draw sent no request to any Bridge; known positive — the endpoint no-place is stored in this browser
test("TST-1187204: UC-049 1b an endpoint with no place is not offered, and with no Bridge stored drawing the bar sends no Bridge a request", async () => {
  const placeless = { kind: "openai-compatible", url: "https://fixture-endpoint.example.test/v1", model: "no-place-model", context: 200000 };
  const s = await scenario({ keepBridge: false, settings: { "endpoint:no-place": placeless } });
  assert.ok(Array.from({ length: globalThis.localStorage.length }, (_, at) => globalThis.localStorage.key(at)).some((key) => key.endsWith(":endpoint:no-place")), "known positive: the endpoint is stored");
  assert.deepEqual(offeredBy(s), ["drafter — this machine"]);
  assert.doesNotMatch(barOf(s).textContent, /no-place/);
  assert.deepEqual(s.testRequests, [], "no Bridge was tested: none is stored");
  assert.equal(s.bridgeRequests.length, 0);
});
