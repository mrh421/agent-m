// The line Recording conversations of the Settings page (ITM-511) — MOD-settings-pages' instance section: the state `on` or `off`
// as MOD-prompt-bar's recordingOf reads the instance's switch, the notice that *Switch on* shows before anything is saved (what
// follows, and each repository its server reports as public, an unreadable one as "visibility not known"), *Save* only after
// *I have read this* and on a person's click, *Switch off* saved at once with the page saying written records stay, and the
// file docs/conversation-recording.md as recording.schema.md states it, written with saveFile.
// Run: node --test tests/settings-pages-recording.test.mjs
//
// Module: MOD-settings-pages
// Guards: UC-042; SWITCHING CONVERSATION RECORDING ON STATES WHAT FOLLOWS
// Guards: A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON; EVERY STEP EXPLAINS ITSELF
// Guards: THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; A FORM OPENS WITH ITS FIRST FIELD FOCUSED
// Level: unit
//
// Each test names its input and states its expected values in its own text; none reads an expected result from the SPEC, a use
// case or an architecture file. The page is the small fixture DOM of tests/settings-pages-settings-regressions.test.mjs. The
// instance repository is a fixture host keeping to MOD-repository-hosts' interface (repositoryInfo, readSnapshot, commitFiles; every
// commit recorded). A product the browser keeps is read through the real GitHub host over a fixture fetch that answers
// GET /repos/<owner>/<name> from memory and records each request with its Authorization header; nothing reaches the network. The
// counter-proofs (a planted fault in src/settings-pages/ and the test's failing result) are recorded in the pull request.
//
// Readings the module file leaves open, which the tests state (the pull request names them):
//   - The line stands in the tab Repositories, after the repository lines, as the instance's section.
//   - The notice's repositories stand in two paragraphs: class settings-recording-public (the instance's `owner/name` and each
//     product's address as the browser keeps it) and class settings-recording-unknown (the same, each said "visibility not known").
//   - Both *Switch on* and *Switch off* and *Save* act only on a trusted click (THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK).

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { view } from "../src/settings-pages/index.mjs";
import { openStore, writeSetting } from "../src/browser-store/index.mjs";

let focused = null;
class Element {
  constructor(name) { this.localName = name; this.childNodes = []; this.className = ""; this.value = ""; this.type = ""; this.checked = false; this.disabled = false; this.hidden = false; this.attributes = new Map(); this.listeners = []; }
  append(...nodes) { for (const node of nodes.flat()) this.childNodes.push(typeof node === "string" ? new Text(node) : node); }
  replaceChildren(...nodes) { this.childNodes = []; this.append(...nodes); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  addEventListener(type, listener) { this.listeners.push([type, listener]); }
  fire(type, event = {}) { return Promise.all(this.listeners.filter(([kind]) => kind === type).map(([, listener]) => listener({ type, target: this, currentTarget: this, ...event }))); }
  focus() { focused = this; }
  get textContent() { return this.childNodes.map((child) => child.textContent).join(""); }
  set textContent(value) { this.replaceChildren(String(value)); }
}
class Text { constructor(value) { this.value = String(value); } get textContent() { return this.value; } }
class Storage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
}
globalThis.document = { createElement: (name) => new Element(name) };

function descendants(root, predicate) {
  const found = [];
  (function visit(node) { for (const child of node.childNodes ?? []) { if (child instanceof Element) { if (predicate(child)) found.push(child); visit(child); } } })(root);
  return found;
}
const byClass = (root, name) => descendants(root, (node) => node.className.split(" ").includes(name));
const one = (root, name) => byClass(root, name)[0];
const click = (node, isTrusted = false) => node.fire("click", { isTrusted });
// Whether `control` is shown within `root`: no node on the way from the root to the control is hidden.
function shown(root, control) {
  const trail = (node, path) => {
    if (node === control) return [...path, node];
    for (const child of node.childNodes ?? []) if (child instanceof Element) { const found = trail(child, [...path, node]); if (found) return found; }
    return null;
  };
  const path = trail(root, []);
  assert.ok(path, "the control is part of the line");
  return path.every((node) => !node.hidden);
}
const settingsRoute = () => view.routes.find((candidate) => candidate.name === "settings");
function newStore() { Object.defineProperty(globalThis, "localStorage", { configurable: true, value: new Storage() }); return openStore("fixture/instance"); }

// ---------------------------------------------------------------- the instance repository, and the products' servers

const SWITCH = "docs/conversation-recording.md";
const TITLE = "# Recording of conversations";
const file = (front) => `---\n${front}---\n${TITLE}\n`;
const blobOf = (text) => createHash("sha1").update(`blob ${Buffer.byteLength(text)}\0${text}`).digest("hex");

// The instance repository: `files` is the default branch `main`; `visibility` what its server reports; every commit is recorded.
function instanceHost({ files = {}, visibility = "public", readFails = false } = {}) {
  const writes = [], reads = [];
  let commit = "1".repeat(40);
  const host = {
    writes, reads, files,
    async repositoryInfo() { return { defaultBranch: "main", canWrite: true, visibility }; },
    async readSnapshot() {
      if (readFails) throw new Error("the server refused the read");
      const opened = new Map(Object.entries(files)), head = commit;
      return { commit: head, paths: [...opened.keys()], blob: (path) => (opened.has(path) ? blobOf(opened.get(path)) : null), async read(path) { reads.push(path); return opened.get(path) ?? null; } };
    },
    async commitFiles(change) {
      writes.push(change);
      for (const written of change.files) files[written.path] = written.text;
      commit = `${Number.parseInt(commit.slice(0, 8), 16) + 1}`.padStart(40, "0");
      return { commit, url: `https://github.com/fixture/instance/commit/${commit}` };
    },
  };
  return host;
}

// Every request a product's server was asked, and what it answers: GET /repos/<owner>/<name> with the visibility named for that
// repository, a 500 for a repository named "broken".
const realFetch = globalThis.fetch;
let asked = [];
function installServers(visibilities) {
  asked = [];
  globalThis.fetch = async (url, init = {}) => {
    const address = String(url);
    asked.push({ url: address, authorization: init.headers?.Authorization ?? null });
    const repository = /^https:\/\/api\.github\.com\/repos\/([^/]+\/([^/]+))$/.exec(address);
    const name = repository?.[2];
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    if (!repository) return json({ message: "Not Found" }, 404);
    if (name === "broken") return json({ message: "Server Error" }, 500);
    const visibility = visibilities[name];
    if (!visibility) return json({ message: "Not Found" }, 404);
    return json({ default_branch: "main", visibility, private: visibility !== "public", permissions: { push: true }, archived: false, description: "" });
  };
}
test.afterEach(() => { globalThis.fetch = realFetch; focused = null; });

// The person lets the event loop run until the line has read the switch.
const settled = async () => { for (let turn = 0; turn < 5; turn += 1) await new Promise((resolve) => setImmediate(resolve)); };
// The Settings page of the instance fixture/instance, with this instance host, the products this browser keeps (web addresses) and
// the stored tokens ({ key: token value }), opened on its tab Repositories, where the line stands; -> { target, line, host, store }.
async function open({ host = instanceHost(), products = [], tokens = {} } = {}) {
  const store = newStore();
  if (products.length) writeSetting(store, "products", products);
  for (const [key, value] of Object.entries(tokens)) writeSetting(store, key, { value, name: key, expires: null });
  const target = document.createElement("div");
  await settingsRoute().render(target, { instance: { repository: "fixture/instance", host }, product: null, store, go() {} }, {});
  await click(byClass(target, "settings-tab")[1]);
  await settled();
  const line = one(target, "settings-recording");
  assert.ok(line, "the instance's section holds the line Recording conversations");
  return { target, line, host, store };
}
const stateOf = (line) => one(line, "settings-recording-state").textContent;
// The person presses *Switch on*; the notice is built (the servers are asked) before the call returns.
const switchOn = (page) => click(one(page.line, "settings-recording-on"), true);
const tick = async (page) => { const box = one(page.line, "settings-recording-ack"); box.checked = true; await box.fire("change"); };

// TST-511001 · level: unit · module: MOD-settings-pages
// guards: UC-042; A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON
// given: instance repositories whose switch file docs/conversation-recording.md holds `recording: on`, holds `recording: off`, holds front matter without the key recording, or does not exist
// input: the Settings page is rendered for each
// expect: the line states "Recording conversations is on." for the first and "Recording conversations is off." for the other three; for the first Switch off is shown and Switch on is not; for the other three Switch on is shown and Switch off is not
test("the line shows on only for the switch file with recording: on, and off for off, a missing key and a missing file", async () => {
  const cases = [
    [file("recording: on\n"), "on"], [file("recording: off\n"), "off"], [file("note: x\n"), "off"], [undefined, "off"],
  ];
  for (const [text, state] of cases) {
    const page = await open({ host: instanceHost({ files: text === undefined ? { "README.md": "# Instance\n" } : { [SWITCH]: text } }) });
    assert.ok(page.line, "the instance's section holds the line Recording conversations");
    assert.equal(stateOf(page.line), `Recording conversations is ${state}.`, `file: ${JSON.stringify(text)}`);
    assert.equal(shown(page.line, one(page.line, "settings-recording-on")), state === "off", `Switch on is shown only while off (${state})`);
    assert.equal(shown(page.line, one(page.line, "settings-recording-off")), state === "on", `Switch off is shown only while on (${state})`);
  }
});

// TST-511002 · level: unit · module: MOD-settings-pages
// guards: SWITCHING CONVERSATION RECORDING ON STATES WHAT FOLLOWS; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; A FORM OPENS WITH ITS FIRST FIELD FOCUSED
// given: an instance repository without a switch file, whose server reports it public
// input: the person presses Switch on; presses Save before ticking I have read this; ticks it; a script presses Save (a click that is not trusted); the person presses Save
// expect: after Switch on the notice is shown with I have read this focused and Save disabled, and nothing is written; Save before the tick, and the script's Save, write nothing; the person's Save after the tick writes one commit on main at the head that was read, of the one file docs/conversation-recording.md with exactly "---\nrecording: on\n---\n# Recording of conversations\n"; the line then states "Recording conversations is on.", shows Switch off and no longer shows the notice
test("Switch on shows the notice and saves nothing; Save works only after I have read this and on a person's click", async () => {
  const page = await open();
  const notice = one(page.line, "settings-recording-notice");
  assert.equal(shown(page.line, notice), false, "before Switch on, the notice is not shown");
  assert.doesNotMatch(page.line.textContent, /will be published|will be committed/, "before Switch on, the page says nothing of what follows");
  await switchOn(page);
  assert.equal(page.host.writes.length, 0, "Switch on writes nothing");
  assert.equal(shown(page.line, notice), true, "Switch on shows the notice");
  const ack = one(page.line, "settings-recording-ack"), save = one(page.line, "settings-recording-save");
  assert.equal(focused, ack, "the notice opens at its box I have read this while it is not ticked");
  assert.equal(ack.disabled, false, "the box can be ticked");
  assert.equal(save.disabled, true, "Save waits for the tick");
  await click(save, true);
  assert.equal(page.host.writes.length, 0, "Save before the tick writes nothing");
  await tick(page);
  assert.equal(save.disabled, false, "ticked, Save is enabled");
  await click(save, false);
  assert.equal(page.host.writes.length, 0, "a click that is not a person's writes nothing");
  await click(save, true);
  assert.equal(page.host.writes.length, 1, "the person's Save writes one commit");
  const [commit] = page.host.writes;
  assert.equal(commit.branch, "main");
  assert.equal(commit.expectedHead, "1".repeat(40), "on the head that was read");
  assert.deepEqual(commit.files, [{ path: SWITCH, text: "---\nrecording: on\n---\n# Recording of conversations\n" }]);
  assert.equal(stateOf(page.line), "Recording conversations is on.");
  assert.equal(shown(page.line, one(page.line, "settings-recording-off")), true, "Switch off is shown");
  assert.equal(shown(page.line, notice), false, "the notice is no longer shown");
});

// TST-511003 · level: unit · module: MOD-settings-pages
// guards: UC-042; SWITCHING CONVERSATION RECORDING ON STATES WHAT FOLLOWS
// given: an instance repository without a switch file
// input: the person presses Switch on
// expect: the notice says, in its own words, that every message of a conversation in the prompt bar, the person's and the participant's, will be committed to the repository of the page the conversation is held on, under docs/conversations/; that it stays in that repository's history; and that for each repository the server reports as public the conversations held on its pages will be published
test("the notice states the three statements of UC-042 step 3", async () => {
  const page = await open();
  await switchOn(page);
  const text = one(page.line, "settings-recording-notice").textContent.replace(/\s+/g, " ");
  assert.match(text, /Every message of a conversation in the prompt bar, the person's and the participant's, will be committed to the repository of the page the conversation is held on, under docs\/conversations\//,
    "the first statement");
  assert.match(text, /It stays in that repository's history\./, "the second statement");
  assert.match(text, /For each repository the server reports as public, the conversations held on its pages will be published\./, "the third statement");
});

// TST-511004 · level: unit · module: MOD-settings-pages
// guards: SWITCHING CONVERSATION RECORDING ON STATES WHAT FOLLOWS; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT
// given: an instance whose server reports it public; the products https://github.com/fixture/pub (public, with a token of its own, ghp_PUB), https://github.com/fixture/priv (private, without a token of its own, so read with the instance's ghp_INSTANCE), https://github.com/fixture/broken (its server answers 500)
// input: the person presses Switch on
// expect: the paragraph of the repositories reported as public names fixture/instance and https://github.com/fixture/pub and does not name priv or broken; the paragraph of the repositories whose visibility is not known names https://github.com/fixture/broken, says "visibility not known", and does not name pub, priv or the instance; the page asked pub with "Bearer ghp_PUB" and priv with "Bearer ghp_INSTANCE"
test("the notice names the instance and each product its server reports as public, an unreadable one as visibility not known, a private one not at all", async () => {
  installServers({ pub: "public", priv: "private" });
  const page = await open({
    products: ["https://github.com/fixture/pub", "https://github.com/fixture/priv", "https://github.com/fixture/broken"],
    tokens: { "github-token": "ghp_INSTANCE", "github-token:fixture/pub": "ghp_PUB" },
  });
  await switchOn(page);
  const named = one(page.line, "settings-recording-public").textContent, unknown = one(page.line, "settings-recording-unknown").textContent;
  assert.match(named, /fixture\/instance/, "the public instance is named");
  assert.match(named, /https:\/\/github\.com\/fixture\/pub\b/, "the public product is named");
  assert.doesNotMatch(named, /fixture\/priv\b|fixture\/broken/, "a private product and an unreadable one are not named as public");
  assert.match(unknown, /https:\/\/github\.com\/fixture\/broken/, "the unreadable product is named");
  assert.match(unknown, /visibility not known/, "as visibility not known");
  assert.doesNotMatch(unknown, /fixture\/pub\b|fixture\/priv\b|fixture\/instance/, "no repository whose visibility was read is named there");
  const of = (name) => asked.find((request) => request.url === `https://api.github.com/repos/fixture/${name}`);
  assert.equal(of("pub")?.authorization, "Bearer ghp_PUB", "a product is asked with the token the page already uses for it");
  assert.equal(of("priv")?.authorization, "Bearer ghp_INSTANCE", "a product without a token of its own is asked with the instance's");
});

// TST-511005 · level: unit · module: MOD-settings-pages
// guards: SWITCHING CONVERSATION RECORDING ON STATES WHAT FOLLOWS
// given: an instance whose server reports it private; one product, https://github.com/fixture/priv, private
// input: the person presses Switch on
// expect: the notice says "No repository is reported as public."; the paragraphs of the repositories reported as public and of the unknown ones are not shown; neither fixture/instance nor priv is named anywhere in the notice
test("with no repository reported as public the notice says so and names none", async () => {
  installServers({ priv: "private" });
  const page = await open({ host: instanceHost({ visibility: "private" }), products: ["https://github.com/fixture/priv"], tokens: { "github-token": "ghp_INSTANCE" } });
  await switchOn(page);
  const notice = one(page.line, "settings-recording-notice");
  assert.match(notice.textContent, /No repository is reported as public\./);
  assert.equal(shown(page.line, one(page.line, "settings-recording-public")), false, "the paragraph of public repositories is not shown");
  assert.equal(shown(page.line, one(page.line, "settings-recording-unknown")), false, "the paragraph of unknown repositories is not shown");
  assert.doesNotMatch(notice.textContent, /fixture\/instance|fixture\/priv\b/, "a private repository is not named");
  assert.ok(asked.some((request) => request.url === "https://api.github.com/repos/fixture/priv"), "known positive: the product's server was asked");
});

// TST-511006 · level: unit · module: MOD-settings-pages
// guards: A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; UC-042
// given: an instance repository whose switch file holds `recording: on`, and one product https://github.com/fixture/pub, public
// input: a script presses Switch off (a click that is not trusted); the person presses Switch off
// expect: the script's click writes nothing; the person's click writes at once one commit of the one file docs/conversation-recording.md with exactly "---\nrecording: off\n---\n# Recording of conversations\n"; the notice and I have read this are not shown and no product's server was asked; the line states "Recording conversations is off." and says "Records already written stay in the history of the repositories they were written to."; Switch on is shown again
test("Switch off saves at once without a notice and says that written records stay", async () => {
  installServers({ pub: "public" });
  const page = await open({ host: instanceHost({ files: { [SWITCH]: file("recording: on\n") } }), products: ["https://github.com/fixture/pub"] });
  await click(one(page.line, "settings-recording-off"), false);
  assert.equal(page.host.writes.length, 0, "a click that is not a person's writes nothing");
  await click(one(page.line, "settings-recording-off"), true);
  assert.equal(page.host.writes.length, 1, "the person's click writes at once");
  assert.deepEqual(page.host.writes[0].files, [{ path: SWITCH, text: "---\nrecording: off\n---\n# Recording of conversations\n" }]);
  assert.equal(shown(page.line, one(page.line, "settings-recording-notice")), false, "no notice is shown");
  assert.deepEqual(asked, [], "no server was asked whether a repository is public");
  assert.equal(stateOf(page.line), "Recording conversations is off.");
  assert.match(page.line.textContent, /Records already written stay in the history of the repositories they were written to\./);
  assert.equal(shown(page.line, one(page.line, "settings-recording-on")), true, "Switch on is shown again");
});

// TST-511007 · level: unit · module: MOD-settings-pages
// guards: A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; UC-042
// given: an instance repository without a switch file
// input: the person presses Switch on and ticks I have read this; another writer then creates the switch file with `recording: off`; the person presses Save
// expect: nothing is written by the page; the line says "changed meanwhile; nothing was written" and still states "Recording conversations is off."
test("a switch file created meanwhile refuses the save and nothing is written", async () => {
  const page = await open();
  await switchOn(page);
  await tick(page);
  page.host.files[SWITCH] = file("recording: off\n");
  await click(one(page.line, "settings-recording-save"), true);
  assert.equal(page.host.writes.length, 0, "nothing is written");
  assert.match(page.line.textContent, /changed meanwhile; nothing was written/);
  assert.equal(stateOf(page.line), "Recording conversations is off.");
});

// TST-511008 · level: unit · module: MOD-settings-pages
// guards: EVERY STEP EXPLAINS ITSELF; UC-042
// given: an instance repository without a switch file
// input: the Settings page is rendered
// expect: the line holds one folded explanation — a details of class explain — with the summary "What is this?". The fixture DOM of this file renders no Markdown, so the text of the topic is checked on the line in tests/site-frame-settings-subject.test.mjs
test("the line has its folded explanation", async () => {
  const page = await open();
  const folded = descendants(page.line, (node) => node.localName === "details" && node.className.split(" ").includes("explain"));
  assert.equal(folded.length, 1, "the line holds one folded explanation");
  assert.equal(descendants(folded[0], (node) => node.localName === "summary")[0].textContent, "What is this?");
});

// TST-511009 · level: unit · module: MOD-settings-pages
// guards: UC-042; EVERY SETTING IS REACHED FROM ONE PAGE
// given: a Settings page whose instance is not connected (no host), and one whose instance repository cannot be read
// input: the Settings page is rendered for each
// expect: no exception; the line says "not connected" for the first and "could not be read" for the second, and neither offers Switch on nor Switch off; the page still shows its other tabs
test("an instance that is not connected or cannot be read gives a line without a switch, and the page goes on", async () => {
  const store = newStore();
  const target = document.createElement("div");
  await settingsRoute().render(target, { instance: { repository: "fixture/instance" }, product: null, store, go() {} }, {});
  await click(byClass(target, "settings-tab")[1]);
  await settled();
  const notConnected = one(target, "settings-recording");
  assert.ok(notConnected, "the instance's section holds the line Recording conversations");
  assert.match(notConnected.textContent, /not connected/);
  const unreadable = (await open({ host: instanceHost({ readFails: true }) })).line;
  assert.match(unreadable.textContent, /could not be read/);
  for (const line of [notConnected, unreadable]) {
    assert.equal(byClass(line, "settings-recording-on").length + byClass(line, "settings-recording-off").length, 0, "no switch is offered");
  }
  assert.equal(byClass(target, "settings-tab").length, 4, "known positive: the page still has its four tabs");
});

// TST-511010 · level: unit · module: MOD-settings-pages
// guards: UC-042; UC-049
// given: an instance repository whose switch file holds `recording: on`
// input: the Settings page is rendered and left on its first tab, General; the person then opens the tab Repositories
// expect: while the first tab is shown the page asks the instance repository for no file at all and the line states "Recording conversations is not read yet."; once the tab Repositories is opened the switch file docs/conversation-recording.md is read exactly once and the line states "Recording conversations is on."
test("the switch is read when the tab Repositories is shown, not when the page is rendered", async () => {
  const host = instanceHost({ files: { [SWITCH]: file("recording: on\n") } });
  const store = newStore();
  const target = document.createElement("div");
  await settingsRoute().render(target, { instance: { repository: "fixture/instance", host }, product: null, store, go() {} }, {});
  await settled();
  assert.deepEqual(host.reads, [], "no file of the instance repository was read");
  assert.equal(stateOf(one(target, "settings-recording")), "Recording conversations is not read yet.");
  await click(byClass(target, "settings-tab")[1]);
  await settled();
  assert.deepEqual(host.reads.filter((path) => path === SWITCH), [SWITCH], "the switch file was read once");
  assert.equal(stateOf(one(target, "settings-recording")), "Recording conversations is on.");
});
