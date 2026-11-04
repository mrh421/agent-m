// The prompt bar (ITM-504) — startPromptBar, latestDraft and currentJob of MOD-prompt-bar in a small DOM, with fixture hosts, a fixture store and a
// model endpoint behind the global `fetch`, as the accepted text of docs/architecture/MOD-prompt-bar.md and UC-049 (steps 1 to 5, 7, 1a, 1b, 3a, 4a
// as far as showing, 5a, 6c) state them. The real MOD-job-runner, MOD-runtimes, MOD-job-catalogue (the kind `converse`), MOD-job-ledger,
// MOD-markdown-render and MOD-bridge-client run as they are; the one strategy of another module the kind names, `chapters-for-page`, is a fixture that
// keeps the parameters it was given. Nothing reaches the network.
// Run: node --test tests/prompt-bar.test.mjs
//
// Module: MOD-prompt-bar
// Guards: UC-049; UC-019; THE PAGE NAMES WHERE IT SENDS; A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON; A RECORDED CONVERSATION IS KEPT WHERE IT WAS HELD
// Guards: A JOB IS RECORDED IN ITS PRODUCT REPOSITORY; A PARTICIPANT DECLARES WHERE IT PROCESSES DATA; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; NO SERVER
// Level: component
//
// Readings the module file leaves open, which the tests state (the pull request names them):
//   - The bar is drawn into the target when the instance's participants have been read; with none offered the target stays empty.
//   - One participant offered is named in a <span class="participant">; several in a <select class="participant"> with an <option> each, valued by name.
//   - The pieces are <textarea class="instruction">, <button class="send">, <button class="stop">, <ul class="conversation"> (an <li class="message person|participant">
//     each) and <section class="status"> holding, as they come, <ul class="destinations">, <ul class="reasons">, <div class="answer">, <p class="rounds">,
//     <ul class="left">, <section class="hand-over">, <button class="review">, <p class="problem">; above the selector <p class="recording"> is shown only while recording is on.
//   - A draft is kept in the tab when the person presses *Review the draft*, which then calls `go` with the subject's draftRoute.
//   - The record the tab keeps for each repository is the tab value `prompt-bar:records`.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { openStore, readTabValue, writeSetting } from "../src/browser-store/index.mjs";
import { registerStrategies } from "../src/job-runner/index.mjs";
import { latestDraft, currentJob, startPromptBar } from "../src/prompt-bar/index.mjs";
import { tick, until } from "./prompt-bar.d/until.mjs";

// ---------------------------------------------------------------- the part of a browser's DOM that is used

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
globalThis.document = { createElement: (name) => new Element(name) };

const all = (root, test) => { const found = []; (function visit(node) { for (const child of node.childNodes ?? []) if (child instanceof Element) { if (test(child)) found.push(child); visit(child); } })(root); return found; };
const byClass = (root, name) => all(root, (node) => node.className.split(" ").includes(name));
const one = (root, name) => byClass(root, name)[0];
const textOf = (node) => node.textContent;
const click = (node) => node.dispatchEvent(new Event("click"));
const trusted = () => Object.defineProperty(new Event("click"), "isTrusted", { value: true });

class Storage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
}

// ---------------------------------------------------------------- the store, the hosts, the endpoint

// The instance's participant list, which the bar does not read for its offer (UC-049 1): what the bar offers is declared in this browser's store.
const COLUMNS = "| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |\n|---|---|---|---|---|---|---|---|";
const row = (name, type, route, { context = "200000", capabilities = "draft text", place = "Anthropic, USA" } = {}) =>
  `| ${name} | ${type} | model-${name} | ${context} | — | ${capabilities} | ${place} | ${route} |`;
const registerOf = (...rows) => `# Participants of this instance\n\n${COLUMNS}\n${rows.join("\n")}\n`;

// What this browser declares: an endpoint `endpoint:<name>` with its place, context and model (UC-003), or a CLI session `session:mac:<agent>` of the
// Bridge mac, which offers the agent ready (UC-044). drafter-a is called at https://models.example, drafter-b at https://local.example.
const BRIDGE = "http://127.0.0.1:7777";
const endpoint = (name, { context = 200000, place = "Anthropic, USA", url = name === "drafter-b" ? "https://local.example/v1" : "https://models.example/v1", ...more } = {}) =>
  ({ key: `endpoint:${name}`, value: { kind: "openai-compatible", url, model: `model-${name}`, key: name === "drafter-b" ? null : "sk-fixture", place, context, ...more } });
const session = (agent, { capabilities = ["draft text"], place = "this machine", context = 200000 } = {}) =>
  ({ key: `session:mac:${agent}`, agent, value: { place, context, model: `model-${agent}`, capabilities } });
const DRAFTER = endpoint("drafter-a");
const OTHER = endpoint("drafter-b", { place: "this machine" });
// drafter-a called through the Bridge mac, naming the CI secret of its key: a message goes through the Bridge, and a hand-over may take GitHub Actions (UC-049 4a.2).
const DRAFTER_CI = endpoint("drafter-a", { secret: "KEY_A", bridge: "mac" });
const JOB_WORKFLOW = { ".github/workflows/agent-m-jobs.yml": "name: agent-m-jobs\n" };

const failure = (name, fields = {}) => Object.assign(new Error(`${name} ${JSON.stringify(fields)}`), { name }, fields);
const sha = (n) => createHash("sha1").update(`commit ${n}`).digest("hex");

// One repository in memory whose default branch is `trunk`: repositoryInfo, readSnapshot and commitFiles, a commit made only if the branch still stands at the
// expected head. Every commit attempt is kept.
function fakeRepo(web, files) {
  const commits = new Map(), attempts = [];
  let made = 0;
  const commitOf = (tree) => { const id = sha(`${web}${++made}`); commits.set(id, tree); return id; };
  let head = commitOf(new Map(Object.entries(files)));
  const [owner, name] = web.replace("https://github.com/", "").split("/");
  const repository = { server: "github", origin: "https://github.com", path: `${owner}/${name}`, web };
  return {
    attempts, head: () => head, file: (path) => commits.get(head).get(path) ?? null, paths: () => [...commits.get(head).keys()],
    host: {
      async repositoryInfo() { return { defaultBranch: "trunk", visibility: "public", canWrite: true, archived: false, description: "" }; },
      async readSnapshot(ref) {
        const id = ref === "trunk" ? head : ref;
        const tree = commits.get(id);
        if (!tree) throw failure("NotFound", { what: ref });
        return { repository, ref, commit: id, paths: [...tree.keys()].sort(), read: async (path) => (tree.has(path) ? tree.get(path) : null), blob: () => null };
      },
      async listPullRequests() { return []; },
      async containsCommit() { return false; },
      async commitFiles(change) {
        attempts.push(structuredClone(change));
        if (change.branch !== "trunk" || change.expectedHead !== head) throw failure("Moved", { head });
        head = commitOf(new Map([...commits.get(head), ...change.files.map((file) => [file.path, file.text])]));
        return { commit: head, url: `${web}/commit/${head}` };
      },
    },
  };
}

const INSTANCE_WEB = "https://github.com/alice/agent-m";
const PRODUCT_WEB = "https://github.com/alice/thesis-tool";
const SWITCH_ON = "---\nrecording: on\n---\n# Recording of conversations\n";

// The strategy of another module that the kind `converse` names; it keeps the parameters of every message.
const seen = [];
registerStrategies("tests/prompt-bar.test.mjs", { recipes: { "chapters-for-page": async (context, params) => { seen.push(params); return []; } } });

// The model endpoints behind the global fetch: they answer the drafts given in turn (the last again), and keep every request with what the page showed at that moment.
// The Bridge mac at BRIDGE answers testBridge's two requests, listing the agents of the sessions the page declares ready, and an ask with the next draft; its requests
// are kept apart, in `bridgeCalls`.
let requests = [], bridgeCalls = [], bridgeAgents = [], showing = () => "";
const realFetch = globalThis.fetch;
const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
function bridgeAnswer(url, init, next) {
  const { pathname } = new URL(url);
  bridgeCalls.push(`${init?.method ?? "GET"} ${pathname}`);
  if (pathname === "/v1/pair") return json({ bridge: { name: "mac", version: "1.0.0", platform: "darwin" }, origin: "https://alice.github.io" });
  if (pathname === "/v1/agents") return json({ agents: bridgeAgents.map((name) => ({ name, version: "1.0.0", ready: true, loggedIn: true })), missing: [] });
  if (pathname === "/v1/ask") { requests.push({ url: String(url), body: String(init?.body ?? ""), page: showing() }); return json({ ask: "ask-1" }); }
  if (pathname === "/v1/ask/ask-1") return json({ state: "done", text: next(), calls: [], usage: null });
  return new Response("{}", { status: 404 });
}
function endpointAnswers(...drafts) {
  requests = [];
  bridgeCalls = [];
  const queue = [...drafts];
  const next = () => {
    const draft = queue.length > 1 ? queue.shift() : queue[0];
    return typeof draft === "string" ? draft : JSON.stringify({ draft, answers: [] });
  };
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith(BRIDGE)) return bridgeAnswer(String(url), init, next);
    requests.push({ url: String(url), body: String(init?.body ?? ""), page: showing() });
    return json({ choices: [{ message: { content: next() } }], usage: { prompt_tokens: 10, completion_tokens: 5 } });
  };
}
// An endpoint that never answers but ends when the request is aborted.
function endpointHangs() {
  requests = [];
  bridgeCalls = [];
  globalThis.fetch = (url, init) => new Promise((resolve, reject) => {
    requests.push({ url: String(url), body: String(init?.body ?? ""), page: showing() });
    init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
  });
}
test.afterEach(() => { globalThis.fetch = realFetch; seen.length = 0; });

// ---------------------------------------------------------------- the page

const subjectOf = (over = {}) => ({
  key: "use-case:UC-007", title: "UC-007 Derive use cases", kind: "converse", entry: "use-cases",
  paramsFor: (participant) => ({ page: `The page shows UC-007, drafted for ${participant.name}.`, target: "UC-007" }),
  draftRoute: null, withhold: null, refuses: [], ...over,
});

// A page: the instance with its participant list (`listed`, empty unless given) and recording switch, a store declaring what `offer` names — and the Bridge mac
// where a session or an endpoint needs it — and the instance's token, and the bar started on it. `product` is a repository when the page is a product's.
function page({ offer = [DRAFTER], listed = [], recording = false, product = null, token = true, subject = subjectOf(), instanceFiles = {}, tab = new Storage() } = {}) {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: new Storage() });
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: tab });
  const store = openStore("alice/agent-m");
  for (const each of offer) writeSetting(store, each.key, each.value);
  bridgeAgents = offer.filter((each) => each.agent).map((each) => each.agent);
  if (offer.some((each) => each.agent || each.value.bridge === "mac")) writeSetting(store, "bridge:mac", { address: BRIDGE, token: "token-mac" });
  if (token) writeSetting(store, product ? "github-token:alice/thesis-tool" : "github-token", { value: "github_pat_FIXTURE0123456789abcdef", name: "alice", expires: "2027-01-01" });
  const instance = fakeRepo(INSTANCE_WEB, { "docs/participants.md": registerOf(...listed), ...(recording ? { "docs/conversation-recording.md": SWITCH_ON } : {}), ...instanceFiles });
  const productRepo = product ? fakeRepo(PRODUCT_WEB, product) : null;
  const target = document.createElement("div");
  showing = () => textOf(target);
  const current = { subject }, gone = [], explained = [];
  const bar = startPromptBar(target, {
    page: "main", store, instance: { repository: "alice/agent-m", host: instance.host },
    product: () => (productRepo ? { address: PRODUCT_WEB, host: productRepo.host } : null),
    subject: () => current.subject, explain: (topic) => { explained.push(topic); return document.createElement("details"); },
    go: (route, params) => gone.push({ route, params }),
  });
  return { store, instance, productRepo, target, current, gone, explained, bar };
}
const drawn = (it) => until(() => it.target.childNodes.length > 0, "the bar is drawn");
async function sends(it, text) {
  one(it.target, "instruction").value = text;
  one(it.target, "send").dispatchEvent(trusted());
  await until(() => !one(it.target, "stop") || one(it.target, "stop").disabled, "the message has run");
  await tick();
}
const answer = (text, extra = {}) => ({ answer: text, ...extra });

// TST-600020 · level: component · module: MOD-prompt-bar
// guards: UC-049; THE PAGE NAMES WHERE IT SENDS
// given: a store that keeps the endpoint ep1 as an older settings page stored it — address, kind, model and key, no place and no context —, while the instance's participant list holds drafter-a, a model endpoint on `endpoint ep1` with its place and context; and a second store that declares nothing, with the same list
// input: startPromptBar on each
// expect: the target stays empty for both — nothing drawn, nothing said — and no request and no write is made: the list is not read for the offer (UC-049 1), and ep1 lacks a place and a context (UC-049 1b)
test("startPromptBar — with no participant offered it draws nothing and says nothing", async () => {
  endpointAnswers(answer("unused"));
  const listed = [row("drafter-a", "model endpoint", "endpoint ep1")];
  const undeclared = page({ offer: [{ key: "endpoint:ep1", value: { kind: "openai-compatible", url: "https://models.example/v1", model: "model-drafter-a", key: "sk-fixture" } }], listed });
  await tick(); await tick(); await tick();
  assert.equal(undeclared.target.childNodes.length, 0);
  assert.equal(undeclared.explained.length, 0);
  assert.equal(requests.length, 0);
  assert.equal(undeclared.instance.attempts.length, 0);
  const none = page({ offer: [], listed });
  await tick(); await tick(); await tick();
  assert.equal(none.target.childNodes.length, 0);
});

// TST-600021 · level: component · module: MOD-prompt-bar
// guards: UC-049; THE PAGE NAMES WHERE IT SENDS; A PARTICIPANT DECLARES WHERE IT PROCESSES DATA; EVERY STEP EXPLAINS ITSELF
// given: this browser declares the endpoint drafter-a (place "Anthropic, USA") only; and, on a second page, drafter-a, drafter-b (place "this machine") and the endpoint unplaced, which declares no place; the instance's list holds the subagent sub-agent (route `through drafter-a`)
// input: startPromptBar on each
// expect: for the first, the bar names "drafter-a — Anthropic, USA" and has no <select>; for the second a <select class="participant"> with exactly two options, "drafter-a — Anthropic, USA" and "drafter-b — this machine" (valued drafter-a, drafter-b), no unplaced and no sub-agent; both ask the frame to explain the topic "prompt-bar"; no request is made and nothing is written while the bar is drawn; the recording line is hidden
test("startPromptBar — one participant is named, several are chosen among, each with its processing place; a subagent never", async () => {
  endpointAnswers(answer("unused"));
  const single = page();
  await drawn(single);
  assert.equal(textOf(one(single.target, "participant")), "drafter-a — Anthropic, USA");
  assert.equal(all(single.target, (node) => node.localName === "select").length, 0);
  assert.deepEqual(single.explained, ["prompt-bar"]);
  assert.equal(one(single.target, "recording").hidden, true);
  const several = page({ offer: [DRAFTER, OTHER, endpoint("unplaced", { place: "" })], listed: [row("sub-agent", "CLI agent", "through drafter-a")] });
  await drawn(several);
  const options = all(several.target, (node) => node.localName === "option");
  assert.deepEqual(options.map(textOf), ["drafter-a — Anthropic, USA", "drafter-b — this machine"]);
  assert.deepEqual(options.map((option) => option.value), ["drafter-a", "drafter-b"]);
  assert.deepEqual(several.explained, ["prompt-bar"]);
  assert.equal(requests.length, 0, "nothing is sent while the bar is drawn");
  assert.equal(single.instance.attempts.length + several.instance.attempts.length, 0, "nothing is written while the bar is drawn");
});

// TST-600022 · level: component · module: MOD-prompt-bar
// guards: UC-049; THE PAGE NAMES WHERE IT SENDS; ONE CLICK PER DECISION
// given: one participant, this browser's endpoint drafter-a, that answers "Split it in two."; the subject's menu entry "use-cases" and no refused tool; the message "split this use case"
// input: Send, then a second message "and name the new one" in the same tab
// expect: at the first request the page already names "drafter-a — Anthropic, USA" under "Sent to"; the request goes to https://models.example/v1/chat/completions and its text holds the instruction and the page "The page shows UC-007, drafted for drafter-a."; the kind's strategy was given the parameters instruction "split this use case", an empty conversation, entry "use-cases" and refuses []; the answer "Split it in two." and "Rounds: 1" are shown; the conversation holds the person's message (who alice) and the participant's (who drafter-a) and the input is emptied; the second request's text holds "alice: split this use case" and "drafter-a: Split it in two." (the conversation so far), and the strategy was given a two-message conversation; the tab's conversation holds four messages of the subject "use-case:UC-007"
test("Send — the destinations are named before the request, the page and the person's words go with it, the answer is shown, the conversation goes on", async () => {
  endpointAnswers(answer("Split it in two."), answer("Call it UC-043."));
  const it = page({ subject: subjectOf({ refuses: [] }) });
  await drawn(it);
  await sends(it, "split this use case");
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://models.example/v1/chat/completions");
  assert.ok(requests[0].page.includes("Sent to:") && requests[0].page.includes("drafter-a — Anthropic, USA"), `the page named the destination before the request: ${requests[0].page}`);
  assert.ok(requests[0].body.includes("split this use case"));
  assert.ok(requests[0].body.includes("The page shows UC-007, drafted for drafter-a."));
  assert.deepEqual({ instruction: seen[0].instruction, conversation: seen[0].conversation, entry: seen[0].entry, refuses: seen[0].refuses },
    { instruction: "split this use case", conversation: [], entry: "use-cases", refuses: [] });
  assert.ok(textOf(one(it.target, "answer")).includes("Split it in two."));
  assert.equal(textOf(one(it.target, "rounds")), "Rounds: 1");
  assert.equal(one(it.target, "instruction").value, "");
  assert.deepEqual(byClass(it.target, "message").map((node) => [node.className, textOf(one(node, "who"))]), [["message person", "alice"], ["message participant", "drafter-a"]]);
  await sends(it, "and name the new one");
  assert.ok(requests[1].body.includes("alice: split this use case") && requests[1].body.includes("drafter-a: Split it in two."));
  assert.deepEqual(seen[1].conversation.map((message) => [message.from, message.who, message.text]), [["person", "alice", "split this use case"], ["participant", "drafter-a", "Split it in two."]]);
  const kept = readTabValue(it.store, "prompt-bar:conversation");
  assert.deepEqual(kept.map((message) => [message.from, message.text, message.subject]), [
    ["person", "split this use case", "use-case:UC-007"], ["participant", "Split it in two.", "use-case:UC-007"],
    ["person", "and name the new one", "use-case:UC-007"], ["participant", "Call it UC-043.", "use-case:UC-007"]]);
});

// TST-600023 · level: component · module: MOD-prompt-bar
// guards: UC-049; UC-019; ONE CLICK PER DECISION
// given: this browser's endpoints drafter-a, with a context of 100 tokens, chosen, and drafter-b with 200000; and, in a second page, the one CLI session mac:reader, which declares no capability to draft text; an endpoint that would answer
// input: choose the first, press Send with "why is this step red?"; then, on the second page, press Send
// expect: nothing is sent (no request) and nothing is written; the page says "Nothing was sent." and lists a reason "drafter-a does not hold this message" that names drafter-b as one whose context is larger; the conversation stays empty and the input keeps the words; for the second page, whose participant cannot draft text and is therefore not offered, Send sends nothing and the page says "Nothing was sent."
test("Send — nothing is sent while the job does not fit or a finding keeps it from starting, and the page says why", async () => {
  endpointAnswers(answer("unused"));
  const tiny = page({ offer: [endpoint("drafter-a", { context: 100 }), OTHER] });
  await drawn(tiny);
  one(tiny.target, "participant").value = "drafter-a";
  await sends(tiny, "why is this step red?");
  assert.equal(requests.length, 0);
  assert.equal(tiny.instance.attempts.length, 0);
  assert.ok(textOf(one(tiny.target, "status")).includes("Nothing was sent."));
  const reasons = byClass(tiny.target, "reason").map(textOf);
  assert.equal(reasons.length, 1);
  assert.ok(reasons[0].startsWith("drafter-a does not hold this message: its context holds 100 tokens"), reasons[0]);
  assert.ok(reasons[0].includes("Choose drafter-b, whose context is larger."), reasons[0]);
  assert.equal(readTabValue(tiny.store, "prompt-bar:conversation"), null);
  assert.equal(one(tiny.target, "instruction").value, "why is this step red?");
  // A participant that cannot do the kind is not offered (UC-019 2), so it cannot be sent to: the second page offers none, and Send sends nothing.
  const mute = page({ offer: [session("reader", { capabilities: ["read the repository"] })] });
  await drawn(mute);
  await sends(mute, "plan the next sprint");
  assert.equal(requests.length, 0);
  assert.ok(textOf(one(mute.target, "status")).includes("Nothing was sent."));
});

// TST-600024 · level: component · module: MOD-prompt-bar
// guards: UC-049; UC-019; A GENERATED ARTIFACT IS A PROPOSAL
// given: a subject whose draftRoute is "use-case/id=UC-007/prompt=1"; an endpoint that answers "Here is the change." with one edit for docs/x.md; a second subject "use-case:UC-008" asked about afterwards
// input: Send, then press the button "Review the draft"; latestDraft for both subjects
// expect: before the press the tab keeps no draft and `go` was not called; the button is shown; after it `go` was called once with "use-case/id=UC-007/prompt=1"; latestDraft(store, "use-case:UC-007") holds subject, kind "converse", participant "drafter-a", the params the message was prepared with (instruction "change it") and the result whose draft has the edit; latestDraft(store, "use-case:UC-008") is null
test("Review the draft — keeps the ConversationDraft in the tab and goes to the subject's draft route", async () => {
  const edit = { path: "docs/x.md", text: "# X\n" };
  endpointAnswers(answer("Here is the change.", { edits: [edit] }));
  const it = page({ subject: subjectOf({ draftRoute: "use-case/id=UC-007/prompt=1" }) });
  await drawn(it);
  await sends(it, "change it");
  assert.equal(readTabValue(it.store, "prompt-bar:draft"), null);
  assert.deepEqual(it.gone, []);
  const review = one(it.target, "review");
  assert.equal(textOf(review), "Review the draft");
  click(review);
  assert.deepEqual(it.gone, [{ route: "use-case/id=UC-007/prompt=1", params: undefined }]);
  const draft = latestDraft(it.store, "use-case:UC-007");
  assert.equal(draft.subject, "use-case:UC-007");
  assert.equal(draft.kind, "converse");
  assert.equal(draft.participant, "drafter-a");
  assert.equal(draft.params.instruction, "change it");
  assert.deepEqual(draft.result.draft.edits, [edit]);
  assert.equal(latestDraft(it.store, "use-case:UC-008"), null);
});

// TST-600025 · level: component · module: MOD-prompt-bar
// guards: UC-049; A CANCELLED JOB WRITES NOTHING MORE; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: an endpoint that does not answer until the request is aborted; recording off
// input: Send, then (while it waits) currentJob(), then press Stop
// expect: while it waits currentJob() holds kind "converse", participant "drafter-a", state "running" and a start date, and the button Stop is enabled; after Stop the page says "Stopped. Nothing was written.", currentJob() is null, Stop is disabled again, the answer is not shown, the participant's message is not in the conversation, and nothing was written to any repository
test("Stop — aborts the message running in this tab; currentJob gives it while it runs", async () => {
  endpointHangs();
  const it = page();
  await drawn(it);
  one(it.target, "instruction").value = "plan the next sprint";
  one(it.target, "send").dispatchEvent(trusted());
  await until(() => requests.length === 1, "the request is sent");
  assert.deepEqual({ ...currentJob(), started: currentJob().started instanceof Date }, { kind: "converse", participant: "drafter-a", state: "running", started: true });
  assert.equal(one(it.target, "stop").disabled, false);
  click(one(it.target, "stop"));
  await until(() => currentJob() === null, "the message has stopped");
  await tick();
  assert.ok(textOf(one(it.target, "status")).includes("Stopped. Nothing was written."));
  assert.equal(one(it.target, "stop").disabled, true);
  assert.equal(byClass(it.target, "answer").length, 0);
  assert.deepEqual(readTabValue(it.store, "prompt-bar:conversation").map((message) => message.from), ["person"]);
  assert.equal(it.instance.attempts.length, 0);
});

// TST-600026 · level: component · module: MOD-prompt-bar
// guards: UC-049; A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: recording off (no switch file) on a page of a product repository and on a page of the instance, an endpoint that answers; the person's token stored for each repository
// input: Send one message on each page
// expect: the answer is shown on each; not one commit was attempted on the instance or on the product repository, and the files of both are as they were; the recording line stays hidden
test("Send — with recording off no request writes anything", async () => {
  endpointAnswers(answer("Done."));
  const files = { "README.md": "# Thesis tool\n" };
  const onProduct = page({ product: files });
  await drawn(onProduct);
  await sends(onProduct, "summarise the page");
  assert.ok(textOf(one(onProduct.target, "answer")).includes("Done."));
  const onInstance = page();
  await drawn(onInstance);
  await sends(onInstance, "summarise the page");
  assert.ok(textOf(one(onInstance.target, "answer")).includes("Done."));
  assert.equal(onProduct.instance.attempts.length + onProduct.productRepo.attempts.length + onInstance.instance.attempts.length, 0);
  assert.deepEqual(onProduct.productRepo.paths(), ["README.md"]);
  assert.deepEqual(onInstance.instance.paths(), ["docs/participants.md"]);
  assert.equal(one(onInstance.target, "recording").hidden, true);
});

// TST-600027 · level: component · module: MOD-prompt-bar
// guards: UC-049; A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON; A RECORDED CONVERSATION IS KEPT WHERE IT WAS HELD; A RECORD IS EVIDENCE, NOT A PROPOSAL
// given: the instance's switch docs/conversation-recording.md with `recording: on`; a page of the product alice/thesis-tool; the person's token for the product stored (name alice); an endpoint that answers "Shortened."; a subject titled "Main page"
// input: Send "shorten the introduction"
// expect: the recording line is shown above the selector; the first commit — made before the request to the endpoint was sent — is on the PRODUCT repository (the instance has none) and creates one file under docs/conversations/ whose text holds `started_by: alice`, a section `— alice` with `page: Main page` and "shorten the introduction"; after the answer a second commit appends a section `— drafter-a` with `model: model-drafter-a` and "Shortened." and the text before it is unchanged; both commits are on the head the one before made; the tab keeps one record for the product, and a second message is appended to the same file
test("Send — with recording on the message is appended to the record of the repository the page is held on before it is sent, and the answer after", async () => {
  endpointAnswers(answer("Shortened."), answer("Shorter still."));
  const it = page({ product: { "README.md": "# Thesis tool\n" }, recording: true, subject: subjectOf({ title: "Main page" }) });
  await drawn(it);
  assert.equal(one(it.target, "recording").hidden, false);
  const before = [];
  const realFetchNow = globalThis.fetch;
  globalThis.fetch = async (url, init) => { before.push(it.productRepo.attempts.length); return realFetchNow(url, init); };
  await sends(it, "shorten the introduction");
  assert.deepEqual(before, [1], "the person's message was committed before the request was sent");
  assert.equal(it.instance.attempts.length, 0, "the instance holds no record of a product's page");
  assert.equal(it.productRepo.attempts.length, 2);
  const [first, second] = it.productRepo.attempts;
  assert.equal(first.files.length, 1);
  const path = first.files[0].path;
  assert.match(path, /^docs\/conversations\/\d{8}-\d{4}-[0-9a-f]{4}\.md$/);
  assert.ok(first.files[0].text.includes("started_by: alice"));
  assert.match(first.files[0].text, /## \d{4}-\d\d-\d\d \d\d:\d\d UTC — alice\npage: Main page\n\nshorten the introduction\n/);
  assert.equal(second.files[0].path, path);
  assert.ok(second.files[0].text.startsWith(first.files[0].text.trimEnd()));
  assert.match(second.files[0].text, /— drafter-a\npage: Main page\nmodel: model-drafter-a\n\nShortened\.\n/);
  assert.equal(second.expectedHead, it.productRepo.attempts.length === 2 ? second.expectedHead : null);
  assert.deepEqual(Object.keys(readTabValue(it.store, "prompt-bar:records")), [PRODUCT_WEB]);
  await sends(it, "and shorter");
  assert.equal(it.productRepo.paths().filter((each) => each.startsWith("docs/conversations/")).length, 1, "one record for the conversation");
  assert.ok(it.productRepo.file(path).includes("and shorter") && it.productRepo.file(path).includes("Shorter still."));
});

// TST-600028 · level: component · module: MOD-prompt-bar
// guards: A RECORDED CONVERSATION IS KEPT WHERE IT WAS HELD; NO PERSONAL DATA FROM A MAIL ENTERS A REPOSITORY
// given: recording on; a subject that withholds any text holding "@" with the reason "the page is a mail"; the person's token stored; an endpoint that answers
// input: Send "reply to dana@example.org"
// expect: the message is still sent (one request); the record's section for it holds `withheld: the page is a mail` and the text "dana@example.org" is in no commit
test("Send — a message the subject withholds is recorded as withheld and sent", async () => {
  endpointAnswers(answer("Noted."));
  const withhold = (text) => (text.includes("@") ? "the page is a mail" : null);
  const it = page({ recording: true, subject: subjectOf({ withhold }) });
  await drawn(it);
  await sends(it, "reply to dana@example.org");
  assert.equal(requests.length, 1);
  assert.match(it.instance.attempts[0].files[0].text, /withheld: the page is a mail/);
  assert.ok(it.instance.attempts.every((attempt) => attempt.files.every((file) => !file.text.includes("dana@example.org"))));
});

// TST-600029 · level: component · module: MOD-prompt-bar
// guards: A RECORDED CONVERSATION IS KEPT WHERE IT WAS HELD; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT
// given: recording on, and no token stored for the instance's repository; an endpoint that would answer
// input: Send "hello"
// expect: nothing is sent (no request), nothing is written, the page says "Nothing was sent." and that no token is stored to record with, and the conversation stays empty
test("Send — a message that cannot be recorded is not sent, and the page says why", async () => {
  endpointAnswers(answer("unused"));
  const it = page({ recording: true, token: false });
  await drawn(it);
  await sends(it, "hello");
  assert.equal(requests.length, 0);
  assert.equal(it.instance.attempts.length, 0);
  const said = textOf(one(it.target, "status"));
  assert.ok(said.includes("Nothing was sent.") && said.includes("no token for this repository is stored"), said);
  assert.equal(readTabValue(it.store, "prompt-bar:conversation"), null);
});

// TST-600030 · level: component · module: MOD-prompt-bar
// guards: UC-049; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION
// given: this browser's endpoint drafter-a, called through the Bridge mac, naming the CI secret KEY_A of its key, with "Anthropic, USA" as its place; an instance that holds Agent M's job workflow; an endpoint whose draft proposes a hand-over { kind: "implement", works_on: ["ITM-504"], task: "Add the bar." }
// input: Send
// expect: the page shows "Kind: implement", "Works on: ITM-504", "Task: Add the bar.", "Participant: drafter-a — Anthropic, USA" and "Route: ci hosted", and no button "Hand over": the hand-over goes on without a further click (UC-049 4a), and is refused at once — "Nothing was queued." — since drafter-a, which drafts text only, cannot do implement; no commit was attempted
test("Send — a hand-over the participant proposes is shown with its kind, what it works on, its task, the participant and its route, and goes on without a click", async () => {
  endpointAnswers(answer("I can hand this on.", { handOver: { kind: "implement", works_on: ["ITM-504"], task: "Add the bar." } }));
  const it = page({ offer: [DRAFTER_CI], instanceFiles: JOB_WORKFLOW });
  await drawn(it);
  await sends(it, "implement this");
  await until(() => !textOf(one(it.target, "hand-over")).includes("Checking"), "the hand-over is checked");
  const proposal = textOf(one(it.target, "hand-over"));
  for (const line of ["Kind: implement", "Works on: ITM-504", "Task: Add the bar.", "Participant: drafter-a — Anthropic, USA", "Route: ci hosted"]) {
    assert.ok(proposal.includes(line), `${line} in ${proposal}`);
  }
  assert.equal(all(it.target, (node) => node.localName === "button" && /hand over/i.test(textOf(node))).length, 0, "no click is asked for");
  await until(() => textOf(one(it.target, "hand-over")).includes("Nothing was queued."), "the hand-over is refused at once");
  assert.equal(it.instance.attempts.length, 0);
});

// TST-600031 · level: component · module: MOD-prompt-bar
// guards: UC-049; THE ROUNDS ARE COUNTED AND SHOWN; A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT
// given: an endpoint that answers with text that is no JSON answer
// input: Send "hello"
// expect: the page says the answer could not be read, folds the answer as received (holding that text), shows no answer; the conversation holds only the person's message; nothing is written
test("Send — an answer that cannot be read is named and kept folded, and is no message of the participant", async () => {
  endpointAnswers("this is not an envelope");
  const it = page();
  await drawn(it);
  await sends(it, "hello");
  assert.ok(textOf(one(it.target, "problem")).includes("could not be read"));
  assert.ok(textOf(one(it.target, "raw")).includes("this is not an envelope"));
  assert.equal(byClass(it.target, "answer").length, 0);
  assert.deepEqual(readTabValue(it.store, "prompt-bar:conversation").map((message) => message.from), ["person"]);
  assert.equal(it.instance.attempts.length, 0);
});

// TST-600032 · level: component · module: MOD-prompt-bar
// guards: UC-049; NO SERVER
// given: the conversation of a tab that already holds a person's message and the participant's answer, then the bar started again in that tab (another page of the same tab)
// input: startPromptBar a second time on a new target with the same store
// expect: the new bar lists the same two messages (person alice, participant drafter-a) holding "first question" and "First answer.", without any request
test("startPromptBar — the conversation of the tab is shown again on the next page of the same tab", async () => {
  endpointAnswers(answer("First answer."));
  const first = page();
  await drawn(first);
  await sends(first, "first question");
  const target = document.createElement("div");
  startPromptBar(target, {
    page: "review", store: first.store, instance: { repository: "alice/agent-m", host: first.instance.host }, product: () => null,
    subject: () => subjectOf(), explain: () => document.createElement("details"), go: () => {},
  });
  await until(() => target.childNodes.length > 0, "the second bar is drawn");
  const messages = byClass(target, "message");
  assert.deepEqual(messages.map((node) => [node.className, textOf(one(node, "who"))]), [["message person", "alice"], ["message participant", "drafter-a"]]);
  assert.ok(textOf(messages[0]).includes("first question") && textOf(messages[1]).includes("First answer."));
  assert.equal(requests.length, 1);
});

// TST-600033 · level: component · module: MOD-prompt-bar
// guards: UC-049; THE ROUNDS ARE COUNTED AND SHOWN; A FINDING READS LIKE A COMPILER MESSAGE; THE CORRECTION LOOP HAS A FIXED LIMIT
// given: an endpoint that always answers with an edit of docs/use-cases/UC-999-broken.md whose text is "# broken" (a use case without its parts), so that the kind's check finds errors the drafter does not fix
// input: Send "write the use case"
// expect: the page shows "Rounds: " followed by a number above 1, and a list of the findings the loop left, each item reading `error: <what> — <fix> [<RULE>]` or the same with `warning`, at least one of them an error
test("Send — the findings the loop left are shown with the rounds, each as the run panel shows a finding", async () => {
  endpointAnswers(answer("Here it is.", { edits: [{ path: "docs/use-cases/UC-999-broken.md", text: "# broken\n" }] }));
  const it = page();
  await drawn(it);
  await sends(it, "write the use case");
  console.log("STATUS", textOf(one(it.target, "status")));
  assert.match(textOf(one(it.target, "rounds")), /^Rounds: ([2-9]|\d\d+)$/);
  const left = byClass(it.target, "finding").map(textOf);
  assert.ok(left.length > 0 && left.some((text) => text.startsWith("error: ")), left.join("\n"));
  for (const text of left) assert.match(text, /^(error|warning): .+ — .+ \[[A-Z0-9 ,'-]+\]$/, text);
});

// TST-560001 · level: component · module: MOD-prompt-bar; MOD-job-runner
// guards: UC-019; THE CORRECTION LOOP HAS A FIXED LIMIT; THE PAGE NAMES WHERE IT SENDS
// given: one participant, this browser's endpoint drafter-a, that answers "Split it in two."; the subject's kind converse, whose correction loop is limited to 5 rounds
// input: Send "split this use case"
// expect: at the moment of the first (and only) request the page already says "at most 5 rounds", after the names of the destinations ("Sent to:" … "drafter-a — Anthropic, USA"); after the answer it still says so, and the rounds shown are "Rounds: 1"
test("Send — the limit of correction rounds is named with the destinations, before the first round", async () => {
  endpointAnswers(answer("Split it in two."));
  const it = page();
  await drawn(it);
  await sends(it, "split this use case");
  assert.equal(requests.length, 1);
  const before = requests[0].page;
  assert.match(before, /at most 5 rounds/, `the page named the limit before the request: ${before}`);
  assert.ok(before.indexOf("drafter-a — Anthropic, USA") < before.indexOf("at most 5 rounds"), "the limit follows the destinations");
  assert.match(textOf(one(it.target, "status")), /at most 5 rounds/);
  assert.equal(textOf(one(it.target, "rounds")), "Rounds: 1");
});

// TST-560002 · level: component · module: MOD-prompt-bar
// guards: UC-019; THE CORRECTION LOOP HAS A FIXED LIMIT
// given: two participants, the chosen one with a context of 100 tokens that does not hold the message; an endpoint that would answer
// input: choose the first, press Send "why is this step red?"
// expect: nothing is sent and the page says "Nothing was sent."; it names no limit of rounds, since no round will run (the counter-proof of TST-560001: the same page with a participant that holds the message names it)
test("Send — a message that is not sent names no limit of rounds", async () => {
  endpointAnswers(answer("unused"));
  const tiny = page({ offer: [endpoint("drafter-a", { context: 100 }), OTHER] });
  await drawn(tiny);
  one(tiny.target, "participant").value = "drafter-a";
  await sends(tiny, "why is this step red?");
  assert.equal(requests.length, 0);
  assert.ok(textOf(one(tiny.target, "status")).includes("Nothing was sent."));
  assert.doesNotMatch(textOf(one(tiny.target, "status")), /at most/);
  one(tiny.target, "participant").value = "drafter-b";
  await sends(tiny, "why is this step red?");
  assert.equal(requests.length, 1);
  assert.match(textOf(one(tiny.target, "status")), /at most 5 rounds/);
});

// TST-560003 · level: component · module: MOD-prompt-bar; MOD-participant-list
// guards: UC-019; A PARTICIPANT DECLARES ITS CAPABILITIES; THE PAGE NAMES WHERE IT SENDS
// given: this browser's endpoint drafter-a (draft text, "Anthropic, USA") and the CLI session mac:reader, which the Bridge mac offers and which declares read the repository only, "this machine"; the subject's kind converse, which needs draft text
// input: startPromptBar; then Send "split this use case"
// expect: the bar names "drafter-a — Anthropic, USA" and offers no <select> and no reader; Send makes one request, to https://models.example/v1/chat/completions, and the destinations are "drafter-a — Anthropic, USA" alone
test("startPromptBar — of the participants reached it offers only each that can do the subject's kind", async () => {
  endpointAnswers(answer("Split it in two."));
  const it = page({ offer: [DRAFTER, session("reader", { capabilities: ["read the repository"] })] });
  await drawn(it);
  assert.equal(textOf(one(it.target, "participant")), "drafter-a — Anthropic, USA");
  assert.equal(all(it.target, (node) => node.localName === "select").length, 0);
  assert.doesNotMatch(textOf(it.target), /reader/);
  await sends(it, "split this use case");
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://models.example/v1/chat/completions");
  assert.equal(textOf(one(it.target, "destinations")), "drafter-a — Anthropic, USA");
});

// TST-560004 · level: component · module: MOD-prompt-bar; MOD-participant-list
// guards: UC-019; A PARTICIPANT DECLARES ITS CAPABILITIES
// given: this browser's only offer, the CLI session mac:reader, which declares only "read the repository"; the subject's kind converse, which needs draft text
// input: startPromptBar; press the link; write "split this use case" and press Send
// expect: the bar draws, names no participant, and says "No endpoint or CLI session of this browser can do converse: it needs draft text."; the link "Set up endpoints" calls go with the route "endpoints" once (UC-019 3a); Send sends nothing (no request) and says "Nothing was sent."
test("startPromptBar — where nothing offered can do the kind it says so, names the capability and links the endpoints", async () => {
  endpointAnswers(answer("unused"));
  const it = page({ offer: [session("reader", { capabilities: ["read the repository"] })] });
  await drawn(it);
  assert.equal(all(it.target, (node) => ["select", "option"].includes(node.localName)).length + byClass(it.target, "participant").length, 0);
  assert.match(textOf(it.target), /No endpoint or CLI session of this browser can do converse: it needs draft text\./);
  assert.doesNotMatch(textOf(it.target), /reader/);
  assert.equal(textOf(one(it.target, "endpoints-link")), "Set up endpoints");
  click(one(it.target, "endpoints-link"));
  assert.deepEqual(it.gone, [{ route: "endpoints", params: undefined }]);
  await sends(it, "split this use case");
  assert.equal(requests.length, 0);
  assert.ok(textOf(one(it.target, "status")).includes("Nothing was sent."));
});

// TST-560005 · level: component · module: MOD-prompt-bar; MOD-job-catalogue
// guards: UC-019; A PARTICIPANT DECLARES ITS CAPABILITIES
// given: this browser's endpoint drafter-a (draft text) and the CLI session mac:runner (draft text, run code and tests, "this machine"), which the Bridge mac offers; the bar's subject getter first gives one subject, then one that still names a kind of its own, run-tests (needs run code and tests)
// input: startPromptBar; the getter now gives the new subject; nothing is announced; the person puts the cursor in the input (focus)
// expect: the selector offers "drafter-a — Anthropic, USA" and "mac:runner — this machine", before and after the input takes focus: the offer is that of the bar's one kind, converse, and no subject narrows it (UC-049 step 3)
test("startPromptBar — the offer is the bar's one kind's, whatever kind a subject names", async () => {
  endpointAnswers(answer("unused"));
  const it = page({ offer: [DRAFTER, session("runner", { capabilities: ["draft text", "run code and tests"] })] });
  await drawn(it);
  assert.deepEqual(all(it.target, (node) => node.localName === "option").map(textOf), ["drafter-a — Anthropic, USA", "mac:runner — this machine"]);
  it.current.subject = subjectOf({ key: "tests:all", title: "The tests", kind: "run-tests" });
  await tick();
  assert.equal(all(it.target, (node) => node.localName === "option").length, 2, "nothing reads the getter before the bar is used");
  one(it.target, "instruction").dispatchEvent(new Event("focus"));
  for (let turn = 0; turn < 20; turn += 1) await tick();
  assert.deepEqual(all(it.target, (node) => node.localName === "option").map(textOf), ["drafter-a — Anthropic, USA", "mac:runner — this machine"], "the offer does not follow a subject's kind");
});

// TST-560006 · level: component · module: MOD-prompt-bar; MOD-job-catalogue
// guards: UC-019; A PARTICIPANT DECLARES ITS CAPABILITIES
// given: drafter-a and drafter-b (draft text each), both reached; the getter first gives one subject, then one that still names the kind run-tests (needs run code and tests), which neither can do
// input: startPromptBar; the getter now gives the new subject; the person writes "run the tests" and presses Send without the input having taken focus
// expect: Send reads the getter, and sends the message as converse all the same: one request, whose text holds the new subject's page; the answer is shown; nothing says that no participant can do run-tests
test("Send — reads the subject again, and sends converse whatever kind it names", async () => {
  endpointAnswers(answer("I hand the tests on."));
  const it = page({ offer: [DRAFTER, OTHER] });
  await drawn(it);
  it.current.subject = subjectOf({ key: "tests:all", title: "The tests", kind: "run-tests", paramsFor: () => ({ page: "The page lists the tests." }) });
  await sends(it, "run the tests");
  assert.equal(requests.length, 1);
  assert.ok(requests[0].body.includes("The page lists the tests."));
  assert.ok(textOf(one(it.target, "answer")).includes("I hand the tests on."));
  assert.doesNotMatch(textOf(it.target), /can do run-tests/);
});

// TST-560007 · level: component · module: MOD-prompt-bar
// guards: UC-019; ONE CLICK PER DECISION
// given: drafter-a and drafter-b (draft text each), both reached; the subject's kind converse, which both can do
// input: startPromptBar; the person clicks the selector (it takes focus), then chooses drafter-b
// expect: the select the person clicked is still the one in the bar after the focus, and drafter-b stays chosen
test("selector — taking focus keeps the same select, so the person's choice stays", async () => {
  endpointAnswers(answer("unused"));
  const it = page({ offer: [DRAFTER, OTHER] });
  await drawn(it);
  const clicked = one(it.target, "participant");
  assert.equal(clicked.localName, "select");
  clicked.dispatchEvent(new Event("focus"));
  await tick();
  await tick();
  assert.equal(one(it.target, "participant"), clicked, "the focused select is not replaced");
  clicked.value = "drafter-b";
  clicked.dispatchEvent(new Event("change"));
  clicked.dispatchEvent(new Event("focus"));
  await tick();
  await tick();
  assert.equal(one(it.target, "participant").value, "drafter-b");
});

// TST-560008 · level: component · module: MOD-prompt-bar; MOD-browser-store
// guards: UC-049
// given: drafter-a and drafter-b (draft text each), both reached; one browser tab, whose storage the reload keeps
// input: startPromptBar; the person chooses drafter-b; the page is loaded again in the same tab (a new bar on the same tab storage)
// expect: the new bar's selector shows drafter-b, not the first offered, drafter-a; in a new tab it shows drafter-a
test("selector — the participant chosen stays chosen when the page is loaded again in the tab", async () => {
  endpointAnswers(answer("unused"));
  const tab = new Storage();
  const it = page({ offer: [DRAFTER, OTHER], tab });
  await drawn(it);
  const chooser = one(it.target, "participant");
  chooser.value = "drafter-b";
  chooser.dispatchEvent(new Event("change"));
  it.bar.stop();
  const again = page({ offer: [DRAFTER, OTHER], tab });
  await drawn(again);
  assert.equal(one(again.target, "participant").value, "drafter-b");
  again.bar.stop();
  const fresh = page({ offer: [DRAFTER, OTHER] });
  await drawn(fresh);
  assert.equal(one(fresh.target, "participant").value, "drafter-a");
});

// TST-560009 · level: component · module: MOD-prompt-bar; MOD-browser-store
// guards: UC-049
// given: the bar drawn in one tab; a window 800 px high (the fake DOM has none, so the bar takes 800)
// input: the person presses ArrowUp on the bar's grip twice from its lowest height, then the page is loaded again in the same tab; then 40 presses of ArrowUp
// expect: the grip is a separator reachable by keyboard; each press raises the bar by 40 px from 120 to 200; the next bar in the tab starts at 200 px; the height never goes above nine tenths of the window, 720 px
test("grip — the person sets the bar's height, and the tab keeps it", async () => {
  endpointAnswers(answer("unused"));
  const tab = new Storage();
  const it = page({ tab });
  await drawn(it);
  const grip = one(it.target, "bar-grip");
  assert.equal(grip.getAttribute("role"), "separator");
  assert.equal(grip.getAttribute("tabindex"), "0");
  const bar = one(it.target, "prompt-bar");
  const press = (key) => grip.dispatchEvent(Object.assign(new Event("keydown"), { key }));
  press("ArrowUp");
  press("ArrowUp");
  assert.match(bar.getAttribute("style"), /height: 200px; max-height: 200px;/);
  it.bar.stop();
  const again = page({ tab });
  await drawn(again);
  assert.match(one(again.target, "prompt-bar").getAttribute("style"), /height: 200px;/);
  for (let i = 0; i < 40; i += 1) one(again.target, "bar-grip").dispatchEvent(Object.assign(new Event("keydown"), { key: "ArrowUp" }));
  assert.match(one(again.target, "prompt-bar").getAttribute("style"), /height: 720px;/);
});
