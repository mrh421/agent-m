// The participants the prompt bar offers, the reasons it keeps a message from being sent, and the draft and running message it gives
// (ITM-504) — offer.mjs, send.mjs's whyNot, and bar.mjs's latestDraft and currentJob, as the accepted text of
// docs/architecture/MOD-prompt-bar.md and UC-049 (Precondition, 1a, 1b, 3a) state them. The module file names no function for the offer;
// offer.mjs gives `readParticipants(snapshot)`, `offeredAmong(participants, store)` and `placeOf(participant)`, which these tests call
// directly (the gap is named in the pull request).
// Run: node --test tests/prompt-bar-offer.test.mjs
//
// Module: MOD-prompt-bar
// Guards: UC-049; THE PAGE NAMES WHERE IT SENDS; A PARTICIPANT DECLARES WHERE IT PROCESSES DATA; A PARTICIPANT DECLARES ITS CAPABILITIES
// Guards: THE PROMPT BAR'S ENDPOINTS AND CLI SESSIONS ARE BOUND AS PARTICIPANTS ARE
// Level: unit
//
// The store is the browser store over fixture storages; no request leaves this process. Each test states its input and its expected result
// in its own text.

import test from "node:test";
import assert from "node:assert/strict";
import { openStore, readTabValue, writeSetting, writeTabValue } from "../src/browser-store/index.mjs";
import * as promptBar from "../src/prompt-bar/index.mjs";
import { currentJob, latestDraft } from "../src/prompt-bar/index.mjs";
import * as offer from "../src/prompt-bar/offer.mjs";
import { offeredAmong, placeOf, readParticipants } from "../src/prompt-bar/offer.mjs";
import { personOf, whyNot } from "../src/prompt-bar/send.mjs";

class Storage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
}
function freshStore() {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: new Storage() });
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: new Storage() });
  return openStore("alice/agent-m");
}

const COLUMNS = "| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |\n|---|---|---|---|---|---|---|---|";
const row = (name, type, route, { place = "Anthropic, USA", context = "200000" } = {}) =>
  `| ${name} | ${type} | ${type === "person" ? "—" : "model-x"} | ${context} | — | draft text | ${type === "person" ? "—" : place} | ${route} |`;
const register = (...rows) => `# Participants of this instance\n\n${COLUMNS}\n${rows.join("\n")}\n`;
const snapshotOf = (files) => ({ read: async (path) => files[path] ?? null });

const ROWS = [
  row("ep-local", "model endpoint", "endpoint local"),
  row("ep-missing", "model endpoint", "endpoint nowhere"),
  row("ep-bridged", "model endpoint", "endpoint viabridge"),
  row("ep-lost-bridge", "model endpoint", "endpoint lostbridge"),
  row("cli-on-bridge", "CLI agent", "bridge mac agent claude"),
  row("cli-no-bridge", "CLI agent", "bridge gone agent claude"),
  row("sub", "CLI agent", "through cli-on-bridge"),
  row("box", "sandboxed agent", "bridge mac agent opencode"),
  row("ci", "CI agent", "ci hosted secret CI_KEY"),
  row("alice", "person", "the GitHub account `alice`"),
];

// TST-600010 · level: unit · module: MOD-prompt-bar
// guards: UC-049; THE PAGE NAMES WHERE IT SENDS
// given: a register of ten participants — endpoints ep-local (setting stored), ep-missing (no setting), ep-bridged (setting stored, naming the stored Bridge mac), ep-lost-bridge (setting stored, naming a Bridge not stored); CLI agent cli-on-bridge (Bridge mac stored), cli-no-bridge (Bridge not stored), sub (route `through cli-on-bridge`); sandboxed agent box (Bridge mac stored); CI agent ci; person alice
// input: readParticipants(snapshot), then offeredAmong(participants, store)
// expect: ten participants read in the register's order; offered, in that order: ep-local, ep-bridged, cli-on-bridge, box — and none of ep-missing, ep-lost-bridge, cli-no-bridge, sub, ci, alice
test("offeredAmong — an endpoint or an agent this browser reaches; never a subagent, a CI agent or a person", async () => {
  const store = freshStore();
  writeSetting(store, "endpoint:local", { kind: "openai-compatible", url: "https://models.example/v1", model: "m", key: "k" });
  writeSetting(store, "endpoint:viabridge", { kind: "openai-compatible", url: "http://localhost:11434/v1", model: "m", key: null, bridge: "mac" });
  writeSetting(store, "endpoint:lostbridge", { kind: "openai-compatible", url: "http://localhost:11434/v1", model: "m", key: null, bridge: "lost" });
  writeSetting(store, "bridge:mac", { address: "http://localhost:7777", token: "t" });
  const participants = await readParticipants(snapshotOf({ "docs/participants.md": register(...ROWS) }));
  assert.deepEqual(participants.map((each) => each.name), ["ep-local", "ep-missing", "ep-bridged", "ep-lost-bridge", "cli-on-bridge", "cli-no-bridge", "sub", "box", "ci", "alice"]);
  assert.deepEqual(offeredAmong(participants, store).map((each) => each.name), ["ep-local", "ep-bridged", "cli-on-bridge", "box"]);
});

// TST-600011 · level: unit · module: MOD-prompt-bar
// guards: UC-049; THE PAGE NAMES WHERE IT SENDS
// given: a store that keeps no endpoint and no Bridge, a register of one endpoint and one CLI agent; and an instance with no register at all
// input: offeredAmong over the first register's participants; readParticipants over a snapshot without docs/participants.md
// expect: nothing offered for the first; no participants (an empty list) for the second
test("offeredAmong — with nothing configured in this browser nothing is offered; an instance without a register has no participants", async () => {
  const store = freshStore();
  const participants = await readParticipants(snapshotOf({ "docs/participants.md": register(row("ep-local", "model endpoint", "endpoint local"), row("cli", "CLI agent", "bridge mac agent claude")) }));
  assert.equal(participants.length, 2);
  assert.deepEqual(offeredAmong(participants, store), []);
  assert.deepEqual(await readParticipants(snapshotOf({})), []);
});

// TST-600012 · level: unit · module: MOD-prompt-bar
// guards: THE PAGE NAMES WHERE IT SENDS; A PARTICIPANT DECLARES WHERE IT PROCESSES DATA
// given: a participant whose place is "Anthropic, USA" and one whose place is null
// input: placeOf for each
// expect: "Anthropic, USA" for the first; "no processing place declared" for the second — never an empty name
test("placeOf — the declared place, or the statement that none is declared", () => {
  assert.equal(placeOf({ place: "Anthropic, USA" }), "Anthropic, USA");
  assert.equal(placeOf({ place: null }), "no processing place declared");
});

// TST-600013 · level: unit · module: MOD-prompt-bar
// guards: UC-049; UC-019
// given: a prepared job with one finding that keeps it from starting, and one that does not fit the participant tiny (context 100, size 400), with the offered participants tiny, big (context 1000) and unknown (no context)
// input: whyNot(prepared, offered)
// expect: two lines — the finding as the run panel shows it (kind, what, fix, [rule]), and "tiny does not hold this message: its context holds 100 tokens, the job needs about 400. Choose big, whose context is larger."
test("whyNot — a finding that keeps the job from starting, and the participant it does not fit, with a larger one offered", () => {
  const blocking = { artifact: "docs/participants.md", line: 1, kind: "error", rule: "A PARTICIPANT DECLARES ITS CAPABILITIES", what: "tiny cannot draft text", fix: "choose one that can" };
  const prepared = { blocking: [blocking], notFitting: [{ participant: { name: "tiny" }, size: 400, context: 100 }] };
  const offered = [{ name: "tiny", context: 100 }, { name: "big", context: 1000 }, { name: "unknown", context: null }];
  assert.deepEqual(whyNot(prepared, offered), [
    "error: tiny cannot draft text — choose one that can [A PARTICIPANT DECLARES ITS CAPABILITIES]",
    "tiny does not hold this message: its context holds 100 tokens, the job needs about 400. Choose big, whose context is larger.",
  ]);
  assert.deepEqual(whyNot({ blocking: [], notFitting: [] }, offered), []);
});

// TST-600014 · level: unit · module: MOD-prompt-bar
// guards: UC-049; A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON
// given: a store whose tab keeps a draft for the subject "use-case:UC-007", and a store whose tab keeps none
// input: latestDraft(store, "use-case:UC-007") and latestDraft(store, "use-case:UC-008") on the first; latestDraft(store, "use-case:UC-007") on the second
// expect: the draft itself for the first subject; null for the other subject; null where the tab keeps no draft
test("latestDraft — the draft only for the subject it was drafted on", () => {
  const store = freshStore();
  const draft = { subject: "use-case:UC-007", kind: "converse", participant: "ep-local", params: {}, result: { draft: { answer: "A" } } };
  writeTabValue(store, "prompt-bar:draft", draft);
  assert.deepEqual(latestDraft(store, "use-case:UC-007"), draft);
  assert.equal(latestDraft(store, "use-case:UC-008"), null);
  assert.equal(latestDraft(freshStore(), "use-case:UC-007"), null);
});

// TST-555001 · level: unit · module: MOD-prompt-bar
// guards: UC-049
// given: a store whose tab keeps a draft for the subject "use-case:UC-007"; a store whose tab keeps none; MOD-prompt-bar's `dropDraft`, read from the module's interface so that a missing export fails this test alone
// input: dropDraft(store, "use-case:UC-008") on the first, then latestDraft(store, "use-case:UC-007"); dropDraft(store, "use-case:UC-007") on the first, then latestDraft for both subjects and the raw tab value "prompt-bar:draft"; dropDraft(store, "use-case:UC-007") on the second
// expect: dropping for another subject returns undefined and leaves the draft, which latestDraft still gives as it was kept; dropping for the subject returns undefined, and then latestDraft gives null for both subjects and the tab keeps no value under "prompt-bar:draft" (readTabValue gives null); dropping where the tab keeps no draft returns undefined and throws nothing
test("dropDraft — drops the draft where it was drafted on that subject, and leaves it otherwise", () => {
  assert.equal(typeof promptBar.dropDraft, "function", "MOD-prompt-bar provides dropDraft");
  const store = freshStore();
  const draft = { subject: "use-case:UC-007", kind: "converse", participant: "ep-local", params: {}, result: { draft: { answer: "A" } } };
  writeTabValue(store, "prompt-bar:draft", draft);
  assert.equal(promptBar.dropDraft(store, "use-case:UC-008"), undefined);
  assert.deepEqual(latestDraft(store, "use-case:UC-007"), draft, "a draft for another subject is left");
  assert.equal(promptBar.dropDraft(store, "use-case:UC-007"), undefined);
  assert.equal(latestDraft(store, "use-case:UC-007"), null);
  assert.equal(latestDraft(store, "use-case:UC-008"), null);
  assert.equal(readTabValue(store, "prompt-bar:draft"), null, "the tab keeps no value");
  assert.equal(promptBar.dropDraft(freshStore(), "use-case:UC-007"), undefined, "no draft kept: nothing to drop");
});

// TST-600015 · level: unit · module: MOD-prompt-bar
// guards: ONE DASHBOARD SHOWS EVERY JOB
// given: no message running in this tab
// input: currentJob()
// expect: null
test("currentJob — null while no message runs", () => {
  assert.equal(currentJob(), null);
});

// TST-1201001 · level: unit · module: MOD-prompt-bar
// guards: UC-049
// given: an endpoint as an older Settings page stored it — address, kind, model and key, with no place and no context —, the same with a place and a context, and one with only a place
// input: endpointLacks for each, and endpointsOffered over a store holding the first and the second
// expect: the first lacks the place and the context, the second nothing, the third its context in tokens and its model; endpointsOffered offers only the second
test("endpointLacks — names what keeps an endpoint out of the bar, and endpointsOffered offers only one that lacks nothing", () => {
  const old = { url: "https://example.invalid/v1", kind: "openai-compatible", model: "model-x", key: "k" };
  assert.deepEqual(promptBar.endpointLacks(old), ["the place where it processes data", "its context in tokens"]);
  assert.deepEqual(promptBar.endpointLacks({ ...old, place: "Example, USA", context: 128000 }), []);
  assert.deepEqual(promptBar.endpointLacks({ place: "Example, USA" }), ["its context in tokens", "its model"]);
  const store = freshStore();
  writeSetting(store, "endpoint:old", old);
  writeSetting(store, "endpoint:complete", { ...old, place: "Example, USA", context: 128000 });
  assert.deepEqual(promptBar.endpointsOffered(store).map((each) => each.name), ["complete"]);
});

// TST-1203001 · level: unit · module: MOD-prompt-bar
// guards: A GITHUB PRODUCT USES A TOKEN OF ITS OWN; ONE GITHUB TOKEN SERVES EVERY FEATURE
// given: a store holding only the instance's GitHub token "Agent M · alice/agent-m"; the instance's snapshot of alice/agent-m
// input: personOf for (a) the instance's page, (b) the product alice/agent-m, the instance's own repository, with the instance's snapshot, (c) the product alice/other
// expect: (a) and (b) name the instance's token — it is the product's own token where the product is the instance —; (c) null: another product never borrows it
test("personOf — a product whose repository is the instance's uses the instance's token; another product never does", () => {
  const store = freshStore();
  writeSetting(store, "github-token", { value: "t", name: "Agent M · alice/agent-m" });
  const snapshotOf = (path) => ({ repository: { server: "github", origin: "https://github.com", path, web: `https://github.com/${path}` } });
  const instance = snapshotOf("alice/agent-m");
  assert.equal(personOf(store, instance, false), "Agent M · alice/agent-m");
  assert.equal(personOf(store, snapshotOf("alice/agent-m"), true, instance), "Agent M · alice/agent-m");
  assert.equal(personOf(store, snapshotOf("alice/other"), true, instance), null);
});

// The CLI sessions a Bridge of this browser offers (ITM-1187): offer.mjs's sessionsOffered, which startPromptBar offers after endpointsOffered (MOD-prompt-bar, Interfaces: startPromptBar). It is
// read from the module's file through a namespace, so that its absence fails these cases alone. The Bridges stand behind the global fetch, which keeps every request.
const BRIDGES = { "http://127.0.0.1:7777": "mac", "http://127.0.0.1:7778": "lab" };
function bridgesAnswer(agents) {
  const asked = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const where = new URL(String(url));
    asked.push(`${BRIDGES[where.origin] ?? where.origin} ${init.method ?? "GET"} ${where.pathname}`);
    const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    if (BRIDGES[where.origin] === "lab") return reply({ error: "token-refused", message: "pair again" }, 401);
    if (where.pathname === "/v1/pair") return reply({ bridge: { name: "mac", version: "1.0.0", platform: "darwin" }, origin: "https://alice.github.io" });
    if (where.pathname === "/v1/agents") return reply({ agents, missing: [] });
    return reply({ error: "not-found" }, 404);
  };
  return { asked, restore: () => { globalThis.fetch = real; } };
}
const CLI = ["draft text", "read the repository", "write to the repository", "run code and tests", "use tools"];
const DECLARED = { place: "this machine", context: 200000, model: "claude-model", capabilities: CLI };

// TST-1187001 · level: unit · module: MOD-prompt-bar
// guards: THE PROMPT BAR'S ENDPOINTS AND CLI SESSIONS ARE BOUND AS PARTICIPANTS ARE; UC-049
// given: a store holding the endpoint complete (place, context, model), the endpoint modelless (no model), and the Bridge mac, which lists its agents claude and codex ready, whose sessions declare: mac:claude the place "this machine", the context 200000, the model claude-model and the capabilities a CLI agent is prefilled with; mac:codex the same without a model
// input: offer.mjs's sessionsOffered(store), and endpointsOffered(store)
// expect: sessionsOffered gives exactly one participant — { name "mac:claude", type "CLI agent", model "claude-model", context 200000, price null, place "this machine", the declared capabilities, route "bridge mac agent claude" } —, after the two requests GET /v1/pair and GET /v1/agents to mac and no other; endpointsOffered gives complete alone
test("sessionsOffered — each ready agent of a stored Bridge whose session declares a place, a context and a model, in the Participant shape", async () => {
  assert.equal(typeof offer.sessionsOffered, "function", "offer.mjs gives sessionsOffered");
  const store = freshStore();
  writeSetting(store, "endpoint:complete", { kind: "openai-compatible", url: "https://models.example/v1", model: "model-x", key: "k", place: "Anthropic, USA", context: 200000 });
  writeSetting(store, "endpoint:modelless", { kind: "openai-compatible", url: "https://models.example/v1", model: "", key: "k", place: "Anthropic, USA", context: 200000 });
  writeSetting(store, "bridge:mac", { address: "http://127.0.0.1:7777", token: "token-mac" });
  writeSetting(store, "session:mac:claude", DECLARED);
  writeSetting(store, "session:mac:codex", { ...DECLARED, model: "" });
  const net = bridgesAnswer([{ name: "claude", version: "1", ready: true, loggedIn: true }, { name: "codex", version: "1", ready: true, loggedIn: true }]);
  try {
    assert.deepEqual(await offer.sessionsOffered(store), [{ name: "mac:claude", type: "CLI agent", model: "claude-model", context: 200000, price: null, place: "this machine",
      capabilities: CLI, route: "bridge mac agent claude" }]);
    assert.deepEqual(net.asked, ["mac GET /v1/pair", "mac GET /v1/agents"]);
  } finally {
    net.restore();
  }
  assert.deepEqual(promptBar.endpointsOffered(store).map((each) => each.name), ["complete"]);
});

// TST-1187002 · level: unit · module: MOD-prompt-bar
// guards: THE PROMPT BAR'S ENDPOINTS AND CLI SESSIONS ARE BOUND AS PARTICIPANTS ARE; UC-049
// given: (a) a store that keeps no Bridge; (b) the Bridge mac, which lists its agent claude not ready, its session declared; (c) the Bridge lab, which refuses its token, its session declared; (d) the Bridge far, reached through the jump host at a port, while no jump host is stored, its session declared
// input: offer.mjs's sessionsOffered(store) for each
// expect: (a) no session and no request; (b) no session — an agent that is not ready is not offered —, after mac's two requests; (c) no session, after one request, GET /v1/pair to lab, and nothing thrown; (d) no session, no request, and nothing thrown
test("sessionsOffered — none without a Bridge, none of an agent not ready, none of a Bridge that cannot be tested", async () => {
  assert.equal(typeof offer.sessionsOffered, "function", "offer.mjs gives sessionsOffered");
  const net = bridgesAnswer([{ name: "claude", version: "1", ready: false, loggedIn: false }]);
  try {
    assert.deepEqual(await offer.sessionsOffered(freshStore()), []);
    assert.deepEqual(net.asked, []);
    const notReady = freshStore();
    writeSetting(notReady, "bridge:mac", { address: "http://127.0.0.1:7777", token: "token-mac" });
    writeSetting(notReady, "session:mac:claude", DECLARED);
    assert.deepEqual(await offer.sessionsOffered(notReady), []);
    assert.deepEqual(net.asked, ["mac GET /v1/pair", "mac GET /v1/agents"]);
    net.asked.length = 0;
    const refused = freshStore();
    writeSetting(refused, "bridge:lab", { address: "http://127.0.0.1:7778", token: "token-lab" });
    writeSetting(refused, "session:lab:claude", DECLARED);
    assert.deepEqual(await offer.sessionsOffered(refused), []);
    assert.deepEqual(net.asked, ["lab GET /v1/pair"]);
    net.asked.length = 0;
    const far = freshStore();
    writeSetting(far, "bridge:far", { port: 41001, token: "token-far" });
    writeSetting(far, "session:far:claude", DECLARED);
    assert.deepEqual(await offer.sessionsOffered(far), []);
    assert.deepEqual(net.asked, []);
  } finally {
    net.restore();
  }
});
