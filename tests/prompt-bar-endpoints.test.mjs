// The check of THE PROMPT BAR'S ENDPOINTS AND CLI SESSIONS ARE BOUND AS PARTICIPANTS ARE (ITM-1187): a model endpoint or a CLI session that the prompt bar offers from this browser's
// configuration declares its capabilities, its place and its model, and counts as a participant for every rule of the SPEC, though no participant list lists it. As the check names it: an
// endpoint or CLI session without a place or a model is not offered; the page names each with its place before a message is sent; a page of mail gives a CLI session the mail's `MAIL-`
// identifier only; a restricted source's content is refused to an endpoint whose place its entry does not permit; counter-proof: the same endpoint at a permitted place receives it, and with
// recording off a conversation with an endpoint writes nothing to a repository. docs/architecture/MOD-prompt-bar.md (Interfaces, startPromptBar) gives the offer: "It first reads this browser's
// configuration, and reads no participant list for the offer (UC-049 1). It offers each model endpoint the store keeps under `endpoint:<name>` ... and each CLI session — a coding agent that a
// Bridge the store keeps under `bridge:<name>` offers, as MOD-bridge-client's `testBridge` lists it ready —, whose configuration declares a place, a context and a model". The requests that
// drawing the bar sends are counted here: testBridge's two, `GET /v1/pair` and `GET /v1/agents`, for each Bridge the store keeps, and none with no Bridge stored; the instance's
// docs/participants.md is not read for the offer.
// Run: node --test tests/prompt-bar-endpoints.test.mjs
//
// Module: MOD-prompt-bar
// Guards: THE PROMPT BAR'S ENDPOINTS AND CLI SESSIONS ARE BOUND AS PARTICIPANTS ARE; UC-049; THE PAGE NAMES WHERE IT SENDS; A PARTICIPANT DECLARES WHERE IT PROCESSES DATA
// Guards: A PARTICIPANT BASED ON A LANGUAGE MODEL NAMES ITS MODEL; RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS; A PARTICIPANT THAT WRITES TO A REPOSITORY NEVER RECEIVES A MAIL
// Guards: A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON
// Level: component
//
// The real MOD-prompt-bar, MOD-bridge-client, MOD-job-runner (prepareJob, the tool read-file), MOD-runtimes, MOD-job-catalogue (the kind `converse`) and MOD-markdown-render run as they are; the
// repository servers are fixtures in memory that keep every read and every commit attempt; the model endpoint at https://models.example and the Bridge mac at http://127.0.0.1:7777 stand behind
// the global `fetch`, which keeps every request. The page of mail is MOD-maintenance-pages' route `mail` in the world of tests/maintenance-pages-world.mjs. Readings the texts leave open, which the
// tests state (the pull request names them): a CLI session is named `<bridge>:<agent>`, as its setting `session:<bridge>:<agent>` is, as an endpoint is named as its setting `endpoint:<name>` is;
// a Bridge that cannot be tested offers no session and is named nowhere in the bar. Each test states its expected result in its own text; none reads it from a document.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { openStore, writeSetting } from "../src/browser-store/index.mjs";
import { registerStrategies } from "../src/job-runner/index.mjs";
import { tools } from "../src/job-runner/tools.mjs";
import { endpointsOffered, startPromptBar } from "../src/prompt-bar/index.mjs";
import * as offer from "../src/prompt-bar/offer.mjs";
import { prepareMessage } from "../src/prompt-bar/send.mjs";
import { tick, until } from "./prompt-bar.d/until.mjs";
import { ERIKA, SECRET, byClass as byClassIn, mailOf, one as oneIn, opened, pages, restoreWorld, standard, trusted, waitFor, world } from "./maintenance-pages-world.mjs";

// ---------------------------------------------------------------- the part of a browser's DOM that is used (tests/prompt-bar.test.mjs's, copied)

class Text { constructor(data) { this.data = String(data); this.parentNode = null; } get textContent() { return this.data; } }
class Element extends EventTarget {
  constructor(name) {
    super();
    Object.assign(this, { localName: name, childNodes: [], className: "", value: "", type: "", hidden: false, disabled: false, parentNode: null, attrs: {}, html: "" });
  }
  append(...nodes) { for (const node of nodes.flat()) { const child = typeof node === "string" ? new Text(node) : node; this.childNodes.push(child); child.parentNode = this; } }
  replaceChildren(...nodes) { this.childNodes = []; this.append(...nodes); }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  getAttribute(name) { return this.attrs[name] ?? null; }
  set innerHTML(value) { this.html = String(value); }
  get innerHTML() { return this.html; }
  get textContent() { return this.html + this.childNodes.map((child) => child.textContent).join(""); }
  focus() {}
}
const smallDocument = { createElement: (name) => new Element(name) };

const all = (root, check) => { const found = []; (function visit(node) { for (const child of node.childNodes ?? []) if (child instanceof Element) { if (check(child)) found.push(child); visit(child); } })(root); return found; };
const byClass = (root, name) => all(root, (node) => node.className.split(" ").includes(name));
const one = (root, name) => byClass(root, name)[0];
const textOf = (node) => node.textContent;
const trustedClick = () => Object.defineProperty(new Event("click"), "isTrusted", { value: true });

class Storage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
}

// ---------------------------------------------------------------- the network: the endpoint and the Bridges

const MODELS = "https://models.example";
const MAC = "http://127.0.0.1:7777", LAB = "http://127.0.0.1:7778", GONE = "http://127.0.0.1:7779";
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const envelope = (answer) => JSON.stringify({ draft: { answer }, answers: [] });
const realFetch = globalThis.fetch;

// `agents` gives, for each Bridge's address, the agents it lists: { name, ready }. The Bridge at GONE refuses the connection. `calls` keeps every request as "<origin> <method> <path>",
// with what the page showed at that moment.
function network(agents = {}, showing = () => "") {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const where = new URL(String(url));
    calls.push({ said: `${where.origin} ${init.method ?? "GET"} ${where.pathname}`, page: showing() });
    if (where.origin === MODELS) return json({ choices: [{ message: { content: envelope("Noted.") } }], usage: { prompt_tokens: 10, completion_tokens: 5 } });
    if (where.origin === GONE) throw new TypeError(`connect ECONNREFUSED ${where.host}`);
    const listed = agents[where.origin];
    if (!listed) return json({ error: "not-found" }, 404);
    if (where.pathname === "/v1/pair") return json({ bridge: { name: where.port === "7777" ? "mac" : "lab", version: "1.0.0", platform: "darwin" }, origin: "https://alice.github.io" });
    if (where.pathname === "/v1/agents") return json({ agents: listed.map(({ name, ready }) => ({ name, version: "1.0.0", ready, loggedIn: ready })), missing: [] });
    if (where.pathname === "/v1/ask") return json({ ask: "ask-1" });
    if (where.pathname === "/v1/ask/ask-1") return json({ state: "done", text: envelope("Noted on the Bridge."), calls: [], usage: null });
    return json({ error: "not-found" }, 404);
  };
  return calls;
}
const said = (calls) => calls.map((call) => call.said);
afterEach(() => { globalThis.fetch = realFetch; });

try { registerStrategies("tests/prompt-bar-endpoints.test.mjs", { recipes: { "chapters-for-page": async () => [] } }); } catch (failure) { if (failure.name !== "DuplicateStrategy") throw failure; }

// ---------------------------------------------------------------- what this browser declares, and the instance

const ENDPOINT = { kind: "openai-compatible", url: `${MODELS}/v1`, model: "model-drafter", key: "sk-fixture", place: "Anthropic, USA", context: 200000 };
const CLI = ["draft text", "read the repository", "write to the repository", "run code and tests", "use tools"]; // the capabilities a CLI session is prefilled with, as a CLI agent's
const SESSION = { place: "this machine", context: 200000, model: "claude-model", capabilities: CLI };

// The instance's participant list: a CLI agent on the Bridge mac's agent codex and a model endpoint on `endpoint no-place`, each with its place and model, which this browser reaches. It is not
// read for the offer, so neither is offered (the counter-proof of UC-049 1).
const LISTED = ["# Participants of this instance", "", "| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |", "|---|---|---|---|---|---|---|---|",
  "| listed-cli | CLI agent | model-listed | 200000 | — | draft text | this machine | bridge mac agent codex |",
  "| listed-endpoint | model endpoint | model-listed | 200000 | — | draft text | Anthropic, USA | endpoint no-place |", ""].join("\n");

const sha = (text) => createHash("sha1").update(text).digest("hex");
// The instance's repository in memory (default branch `trunk`): `reads` keeps every path read, `attempts` every commit attempt.
function instanceRepo(files) {
  const reads = [], attempts = [];
  let tree = new Map(Object.entries(files)), head = sha(`instance ${tree.size}`);
  const repository = { server: "github", origin: "https://github.com", path: "alice/agent-m", web: "https://github.com/alice/agent-m" };
  return {
    reads, attempts,
    host: {
      async repositoryInfo() { return { defaultBranch: "trunk", visibility: "public", canWrite: true, archived: false, description: "" }; },
      async readSnapshot(ref) {
        const at = tree;
        return { repository, ref, commit: head, paths: [...at.keys()].sort(), blob: () => null, read: async (path) => { reads.push(path); return at.has(path) ? at.get(path) : null; } };
      },
      async listPullRequests() { return []; },
      async commitFiles(change) {
        attempts.push(structuredClone(change));
        if (change.expectedHead !== head) throw Object.assign(new Error("moved"), { name: "Moved", head });
        tree = new Map([...tree, ...change.files.map((file) => [file.path, file.text])]);
        head = sha(`${head} ${attempts.length}`);
        return { commit: head, url: `${repository.web}/commit/${head}` };
      },
    },
  };
}

// A page of the instance with the bar started on it: a store declaring `settings` ({ key: value }) and the instance's token, the instance holding `files` (its participant list LISTED and,
// where asked, the switch that records conversations), and the Bridges' agents `agents`.
function page({ settings, agents = {}, recording = false }) {
  globalThis.document = smallDocument;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: new Storage() });
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: new Storage() });
  const store = openStore("alice/agent-m");
  for (const [key, value] of Object.entries(settings)) writeSetting(store, key, value);
  writeSetting(store, "github-token", { value: "github_pat_FIXTURE0123456789abcdef", name: "alice", expires: "2027-01-01" });
  const instance = instanceRepo({ "docs/participants.md": LISTED, ...(recording ? { "docs/conversation-recording.md": "---\nrecording: on\n---\n# Recording of conversations\n" } : {}) });
  const target = document.createElement("div");
  const calls = network(agents, () => textOf(target));
  const subject = { key: "use-case:UC-007", title: "UC-007 Derive use cases", entry: "use-cases", paramsFor: () => ({ page: "The page shows UC-007." }), draftRoute: null, withhold: null, refuses: [] };
  startPromptBar(target, { page: "main", store, instance: { repository: "alice/agent-m", host: instance.host }, product: () => null, subject: () => subject,
    explain: () => document.createElement("details"), go: () => {} });
  return { store, instance, target, calls };
}
const drawn = (it) => until(() => one(it.target, "instruction") !== undefined, "the bar is drawn");
const offered = (it) => {
  const selector = one(it.target, "participant");
  const options = all(selector, (node) => node.localName === "option");
  return options.length ? options.map(textOf) : [textOf(selector)];
};
async function sends(it, words) {
  one(it.target, "instruction").value = words;
  one(it.target, "send").dispatchEvent(trustedClick());
  await until(() => one(it.target, "stop").disabled && byClass(it.target, "message").length >= 2, "the message has run");
}

// TST-1187101 · level: component · module: MOD-prompt-bar
// guards: THE PROMPT BAR'S ENDPOINTS AND CLI SESSIONS ARE BOUND AS PARTICIPANTS ARE; A PARTICIPANT DECLARES WHERE IT PROCESSES DATA; A PARTICIPANT BASED ON A LANGUAGE MODEL NAMES ITS MODEL; UC-049
// given: this browser declares the endpoints drafter (place "Anthropic, USA", context, model), no-place (no place) and no-model (no model), and keeps the Bridge mac, which lists the agents claude, codex, gemini and idle — the first three ready, idle not —, whose sessions declare: mac:claude a place "this machine", a context and a model; mac:codex no place; mac:gemini no model; mac:idle everything; the instance's participant list holds listed-cli (`bridge mac agent codex`) and listed-endpoint (`endpoint no-place`), each with its place and model
// input: startPromptBar, until the bar is drawn
// expect: the selector offers exactly "drafter — Anthropic, USA" and "mac:claude — this machine", in that order: no endpoint or session lacking a place or a model, no agent that is not ready, and no participant of the list; drawing sent the Bridge mac testBridge's two requests, GET /v1/pair then GET /v1/agents, and nothing else; the instance's docs/participants.md was not read
test("an endpoint or CLI session without a place or a model is not offered, nor the participants of the instance's list", async () => {
  const it = page({
    settings: { "endpoint:drafter": ENDPOINT, "endpoint:no-place": { ...ENDPOINT, place: "" }, "endpoint:no-model": { ...ENDPOINT, model: "" }, "bridge:mac": { address: MAC, token: "token-mac" },
      "session:mac:claude": SESSION, "session:mac:codex": { ...SESSION, place: "" }, "session:mac:gemini": { ...SESSION, model: "" }, "session:mac:idle": SESSION },
    agents: { [MAC]: [{ name: "claude", ready: true }, { name: "codex", ready: true }, { name: "gemini", ready: true }, { name: "idle", ready: false }] },
  });
  await drawn(it);
  assert.deepEqual(offered(it), ["drafter — Anthropic, USA", "mac:claude — this machine"]);
  assert.deepEqual(said(it.calls), [`${MAC} GET /v1/pair`, `${MAC} GET /v1/agents`]);
  assert.equal(it.instance.reads.includes("docs/participants.md"), false, "the participant list is not read for the offer");
});

// TST-1187102 · level: component · module: MOD-prompt-bar
// guards: THE PROMPT BAR'S ENDPOINTS AND CLI SESSIONS ARE BOUND AS PARTICIPANTS ARE; THE PAGE NAMES WHERE IT SENDS; UC-049
// given: this browser declares the endpoint drafter ("Anthropic, USA") and keeps the Bridge mac, which offers its agent claude ready, the session mac:claude declared at "this machine"; recording off
// input: the bar drawn; mac:claude chosen; Send "what does this page say?"
// expect: before any message the selector names each with its place, "drafter — Anthropic, USA" and "mac:claude — this machine"; the message goes to the Bridge mac (one POST /v1/ask) and none to the endpoint, and at the moment of that request the page already says "Sent to:" and names "mac:claude — this machine"; the answer "Noted on the Bridge." is shown
test("the page names each endpoint and CLI session with its place, and the destination before the message is sent", async () => {
  const it = page({ settings: { "endpoint:drafter": ENDPOINT, "bridge:mac": { address: MAC, token: "token-mac" }, "session:mac:claude": SESSION },
    agents: { [MAC]: [{ name: "claude", ready: true }] } });
  await drawn(it);
  assert.deepEqual(offered(it), ["drafter — Anthropic, USA", "mac:claude — this machine"]);
  const chooser = one(it.target, "participant");
  chooser.value = "mac:claude";
  chooser.dispatchEvent(new Event("change"));
  await sends(it, "what does this page say?");
  const asked = it.calls.filter((call) => call.said === `${MAC} POST /v1/ask`);
  assert.equal(asked.length, 1);
  assert.equal(it.calls.filter((call) => call.said.startsWith(MODELS)).length, 0);
  assert.ok(asked[0].page.includes("Sent to:") && asked[0].page.includes("mac:claude — this machine"), asked[0].page);
  assert.ok(textOf(one(it.target, "conversation")).includes("Noted on the Bridge."));
});

// TST-1187103 · level: component · module: MOD-prompt-bar
// guards: THE PROMPT BAR'S ENDPOINTS AND CLI SESSIONS ARE BOUND AS PARTICIPANTS ARE; UC-049
// given: (a) this browser declares the endpoint drafter and keeps no Bridge; (b) it also keeps the Bridges mac and lab, each offering its agent claude ready, both sessions declared; (c) it keeps, beside drafter, only the Bridge gone, whose address refuses the connection
// input: startPromptBar on each, until the bar is drawn
// expect: (a) drawing sends no request at all, and of the instance it reads only docs/conversation-recording.md — not docs/participants.md; (b) drawing sends four requests, GET /v1/pair and GET /v1/agents to each Bridge in the store's order of its settings — lab, then mac —, and offers drafter, lab:claude and mac:claude; (c) drawing sends one request, GET /v1/pair to gone, offers drafter alone, and the bar names no Bridge and shows no problem
test("drawing the bar sends testBridge's two requests to each Bridge this browser keeps, and none without one", async () => {
  const none = page({ settings: { "endpoint:drafter": ENDPOINT } });
  await drawn(none);
  assert.deepEqual(said(none.calls), []);
  assert.deepEqual(none.instance.reads, ["docs/conversation-recording.md"]);
  const two = page({ settings: { "endpoint:drafter": ENDPOINT, "bridge:mac": { address: MAC, token: "token-mac" }, "bridge:lab": { address: LAB, token: "token-lab" },
    "session:mac:claude": SESSION, "session:lab:claude": SESSION }, agents: { [MAC]: [{ name: "claude", ready: true }], [LAB]: [{ name: "claude", ready: true }] } });
  await drawn(two);
  assert.deepEqual(said(two.calls), [`${LAB} GET /v1/pair`, `${LAB} GET /v1/agents`, `${MAC} GET /v1/pair`, `${MAC} GET /v1/agents`]);
  assert.deepEqual(offered(two), ["drafter — Anthropic, USA", "lab:claude — this machine", "mac:claude — this machine"]);
  const gone = page({ settings: { "endpoint:drafter": ENDPOINT, "bridge:gone": { address: GONE, token: "token-gone" }, "session:gone:claude": SESSION } });
  await drawn(gone);
  assert.deepEqual(said(gone.calls), [`${GONE} GET /v1/pair`]);
  assert.deepEqual(offered(gone), ["drafter — Anthropic, USA"]);
  assert.equal(byClass(gone.target, "problem").length, 0);
  assert.equal(textOf(gone.target).includes("gone"), false);
});

// TST-1187104 · level: component · module: MOD-prompt-bar
// guards: THE PROMPT BAR'S ENDPOINTS AND CLI SESSIONS ARE BOUND AS PARTICIPANTS ARE; A PARTICIPANT THAT WRITES TO A REPOSITORY NEVER RECEIVES A MAIL; UC-049
// given: the CLI session mac:claude as the bar offers it (offer.mjs sessionsOffered over a store keeping the Bridge mac, which offers claude ready, the session declared at "this machine" with the capabilities a CLI agent is prefilled with); the endpoint drafter as the bar offers it (endpointsOffered), declared at "this machine"; MOD-maintenance-pages' route mail after Read mailbox, one mail listed from Erika Mustermann, on a mailbox that allows "this machine"
// input: the route's subject's paramsFor for the session, and for the endpoint
// expect: the session is offered as a CLI agent at "this machine" that declares write to the repository; the page it is given holds the mail's MAIL- identifier and none of the mail's text, its sender's name or address; the counter-proof: the endpoint, at the same place, which does not write, is given the mail's text
test("a page of mail gives a CLI session of this browser the mail's MAIL- identifier only", async () => {
  assert.equal(typeof offer.sessionsOffered, "function", "offer.mjs gives the CLI sessions offered");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: new Storage() });
  const store = openStore("alice/agent-m");
  writeSetting(store, "bridge:mac", { address: MAC, token: "token-mac" });
  writeSetting(store, "session:mac:claude", SESSION);
  writeSetting(store, "endpoint:drafter", { ...ENDPOINT, place: "this machine" });
  network({ [MAC]: [{ name: "claude", ready: true }] });
  const [session] = await offer.sessionsOffered(store);
  const [endpoint] = endpointsOffered(store);
  globalThis.fetch = realFetch;
  assert.deepEqual({ name: session.name, type: session.type, place: session.place, writes: session.capabilities.includes("write to the repository") },
    { name: "mac:claude", type: "CLI agent", place: "this machine", writes: true });
  try {
    const f = await standard();
    const fresh = await mailOf("fresh");
    const w = world({ mails: [...f.found, fresh], drafts: f.drafts, issues: f.issues });
    const target = await opened(w, {}, "mail");
    await trusted(oneIn(target, "read-mailbox"));
    await waitFor(() => byClassIn(target, "mail").length > 0);
    const subject = pages.view.routes.find((route) => route.name === "mail").subject({}, w.context);
    const forSession = String(subject.paramsFor(session).page);
    assert.match(forSession, /MAIL-[0-9a-f]{16}/);
    for (const text of [SECRET, ERIKA.name, ERIKA.address]) assert.equal(forSession.includes(text), false, `the session is not given ${text}`);
    assert.ok(String(subject.paramsFor(endpoint).page).includes(SECRET), "counter-proof: the endpoint at the allowed place, which does not write, is given the mail's text");
  } finally {
    restoreWorld();
  }
});

// TST-1187105 · level: component · module: MOD-prompt-bar
// guards: THE PROMPT BAR'S ENDPOINTS AND CLI SESSIONS ARE BOUND AS PARTICIPANTS ARE; RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS; UC-049
// given: the instance's register of sources holds SRC-restricted, whose content may go to "this machine" only and lies in docs/sources/SRC-restricted/ of the instance; the endpoint drafter as the bar offers it (endpointsOffered), declared at "Anthropic, USA", and the same endpoint declared at "this machine"
// input: a message prepared for each in this tab (send.mjs prepareMessage); the job's tool read-file on docs/sources/SRC-restricted/handbook.md
// expect: for the endpoint at "Anthropic, USA" the read is refused, names SRC-restricted and "Anthropic, USA", and does not hold the file's text; the counter-proof: for the same endpoint at "this machine" the read gives the text
test("a restricted source's content is refused to an endpoint whose place its entry does not permit, and given at a permitted place", async () => {
  const restricted = ["---", "id: SRC-restricted", "title: SRC-restricted title", "kind: document", "authority: informational", "licence: restricted - internal", "places:", "  - this machine",
    "content_repository: https://github.com/alice/agent-m", "---", "# SRC-restricted SRC-restricted title", "", "## Versions", "", "| Version | Date | Edition | Read from | Files |", "|---|---|---|---|---|",
    "| `1` | 2026-10-13 | fixture | here | one file, hashed only |", ""].join("\n");
  const readAt = async (place) => {
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: new Storage() });
    Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: new Storage() });
    const store = openStore("alice/agent-m");
    writeSetting(store, "endpoint:drafter", { ...ENDPOINT, place });
    const [participant] = endpointsOffered(store);
    const instance = instanceRepo({ "docs/participants.md": LISTED, "docs/sources/SRC-restricted.md": restricted, "docs/sources/SRC-restricted/handbook.md": "RESTRICTED-HANDBOOK-TEXT" });
    const subject = { key: "settings", title: "Settings", entry: "settings", paramsFor: () => ({ page: "a page" }), draftRoute: null, withhold: null, refuses: [] };
    const ready = await prepareMessage({ subject, participant, instruction: "Summarise.", conversation: [], store, instance: { host: instance.host }, product: null });
    const read = await tools["read-file"]({ path: "docs/sources/SRC-restricted/handbook.md" }, { ...ready.context, exchange: { drafter: participant } });
    return String(read.text ?? read);
  };
  const refused = await readAt("Anthropic, USA");
  assert.match(refused, /SRC-restricted/);
  assert.match(refused, /Anthropic, USA/);
  assert.equal(refused.includes("RESTRICTED-HANDBOOK-TEXT"), false);
  assert.equal((await readAt("this machine")).includes("RESTRICTED-HANDBOOK-TEXT"), true, "counter-proof: at a permitted place the content is read");
});

// TST-1187106 · level: component · module: MOD-prompt-bar
// guards: THE PROMPT BAR'S ENDPOINTS AND CLI SESSIONS ARE BOUND AS PARTICIPANTS ARE; A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON; UC-049
// given: this browser declares the endpoint drafter only; the instance without the switch that records conversations; known positive: the same page with recording on
// input: Send "first", then Send "second", in the same conversation; on the known positive, Send "first"
// expect: both answers "Noted." are shown and not one commit was attempted on the instance; with recording on, the first message is committed to a conversation record under docs/conversations/ of the instance
test("with recording off a conversation with an endpoint of this browser writes nothing to a repository", async () => {
  const off = page({ settings: { "endpoint:drafter": ENDPOINT } });
  await drawn(off);
  await sends(off, "first");
  await sends(off, "second");
  await until(() => byClass(off.target, "message").length === 4, "both answers are shown");
  assert.equal(off.instance.attempts.length, 0);
  const on = page({ settings: { "endpoint:drafter": ENDPOINT }, recording: true });
  await drawn(on);
  await sends(on, "first");
  assert.ok(on.instance.attempts.some((attempt) => attempt.files.some((file) => /^docs\/conversations\//.test(file.path) && file.text.includes("first"))), "known positive: with recording on the message is recorded");
  await tick();
});
