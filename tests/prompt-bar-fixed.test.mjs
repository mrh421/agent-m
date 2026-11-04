// The prompt bar stands at the bottom of the window (ITM-540) — startPromptBar of MOD-prompt-bar in a small DOM, with a fixture host, a fixture store and a
// model endpoint behind the global `fetch`. The module file says startPromptBar "draws the bar into `target`, fixed to the bottom of the window", and its Parts
// name no style sheet; the item's reading is that the bar sets the style on its own root element — the element it draws into `target` — as the four
// declarations `position: fixed`, `bottom: 0`, `left: 0` and `right: 0`. Nothing reaches the network.
// Run: node --test tests/prompt-bar-fixed.test.mjs
//
// Module: MOD-prompt-bar
// Guards: UC-049
// Level: unit
//
// Readings the module file leaves open, which the tests state (the pull request names them):
//   - The bar's root element is the one element `startPromptBar` puts into `target` (<section class="prompt-bar">).
//   - The style is the root's `style` attribute, a list of `name: value;` declarations, which is also what a browser's `element.style` reflects.
//   - The values are written exactly `fixed` and `0`.
// Each test states its input and its expected result in its own text.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { openStore, writeSetting } from "../src/browser-store/index.mjs";
import { registerStrategies } from "../src/job-runner/index.mjs";
import { startPromptBar } from "../src/prompt-bar/index.mjs";
import { until } from "./prompt-bar.d/until.mjs";

// ---------------------------------------------------------------- the part of a browser's DOM that is used (no `style` object: only the attribute)

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
const one = (root, name) => all(root, (node) => node.className.split(" ").includes(name))[0];

// The declarations of an element's style attribute, as a name -> value map; empty where it has none.
function declared(node) {
  const style = node.getAttribute("style") ?? "";
  return Object.fromEntries(style.split(";").map((each) => each.trim()).filter(Boolean).map((each) => {
    const at = each.indexOf(":");
    return [each.slice(0, at).trim(), each.slice(at + 1).trim()];
  }));
}

class Storage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
}

// ---------------------------------------------------------------- the instance, the endpoint

const REGISTER = "# Participants of this instance\n\n| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |\n|---|---|---|---|---|---|---|---|\n"
  + "| drafter-a | model endpoint | model-drafter-a | 200000 | — | draft text | Anthropic, USA | endpoint ep1 |\n";
const sha = (n) => createHash("sha1").update(`commit ${n}`).digest("hex");
const instanceHost = () => {
  const head = sha("instance");
  const tree = new Map([["docs/participants.md", REGISTER]]);
  const repository = { server: "github", origin: "https://github.com", path: "alice/agent-m", web: "https://github.com/alice/agent-m" };
  return {
    async repositoryInfo() { return { defaultBranch: "trunk", visibility: "public", canWrite: true, archived: false, description: "" }; },
    async readSnapshot(ref) {
      return { repository, ref, commit: head, paths: [...tree.keys()], read: async (path) => (tree.has(path) ? tree.get(path) : null), blob: () => null };
    },
    async commitFiles() { throw new Error("nothing is written while the bar is drawn or a message is sent with recording off"); },
  };
};

registerStrategies("tests/prompt-bar-fixed.test.mjs", { recipes: { "chapters-for-page": async () => [] } });

const realFetch = globalThis.fetch;
let requests = 0;
test.afterEach(() => { globalThis.fetch = realFetch; });
function endpointAnswers(text) {
  requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    const content = JSON.stringify({ draft: { answer: text }, answers: [] });
    return new Response(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }), { status: 200, headers: { "content-type": "application/json" } });
  };
}

const subjectOf = (key, title) => ({
  key, title, kind: "converse", entry: "use-cases", paramsFor: () => ({ page: `The page shows ${title}.`, target: title }), draftRoute: null, withhold: null, refuses: [],
});

// The bar started on a page of the instance with one participant offered, this browser's endpoint drafter-a, declared with its place, context and model; resolves once
// it is drawn. The instance's participant list, which the bar does not read for its offer, holds drafter-a too.
async function drawnBar() {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: new Storage() });
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: new Storage() });
  const store = openStore("alice/agent-m");
  writeSetting(store, "endpoint:drafter-a", { kind: "openai-compatible", url: "https://models.example/v1", model: "model-drafter-a", key: "sk-fixture", place: "Anthropic, USA", context: 200000 });
  writeSetting(store, "github-token", { value: "github_pat_FIXTURE0123456789abcdef", name: "alice", expires: "2027-01-01" });
  const target = document.createElement("div");
  const current = { subject: subjectOf("use-case:UC-007", "UC-007 Derive use cases") };
  const bar = startPromptBar(target, {
    page: "main", store, instance: { repository: "alice/agent-m", host: instanceHost() }, product: () => null,
    subject: () => current.subject, explain: () => document.createElement("details"), go: () => {},
  });
  await until(() => target.childNodes.length > 0, "the bar is drawn");
  return { target, current, bar };
}

// TST-600034 · level: unit · module: MOD-prompt-bar
// guards: UC-049
// given: one participant offered, this browser's endpoint drafter-a, declared with its place "Anthropic, USA", its context and its model; the bar started with a main-page route as its subject
// input: startPromptBar, until the bar is drawn
// expect: `target` holds exactly one element, the bar's root, and its style declares `position` as `fixed`
test("the bar's root element is positioned fixed", async () => {
  const it = await drawnBar();
  assert.equal(it.target.childNodes.length, 1);
  assert.equal(declared(it.target.childNodes[0]).position, "fixed");
});

// TST-600035 · level: unit · module: MOD-prompt-bar
// guards: UC-049
// given: as TST-600034
// input: startPromptBar, until the bar is drawn
// expect: the bar's root style declares `bottom` as `0`, so that the bar stands on the bottom edge of the window, and declares no `top`
test("the bar's root element stands on the bottom edge", async () => {
  const it = await drawnBar();
  const style = declared(it.target.childNodes[0]);
  assert.equal(style.bottom, "0");
  assert.equal(style.top, undefined);
});

// TST-600036 · level: unit · module: MOD-prompt-bar
// guards: UC-049
// given: as TST-600034
// input: startPromptBar, until the bar is drawn
// expect: the bar's root style declares `left` as `0` and `right` as `0`, so that the bar spans the width of the window
test("the bar's root element spans the width of the window", async () => {
  const it = await drawnBar();
  const style = declared(it.target.childNodes[0]);
  assert.equal(style.left, "0");
  assert.equal(style.right, "0");
});

// TST-600037 · level: unit · module: MOD-prompt-bar
// guards: UC-049
// given: as TST-600034; the endpoint drafter-a answers "Done."; the bar's root element is kept
// input: the route changes — the subject the frame hands over becomes "use-case:UC-008" — and a message "go on" is sent
// expect: the answer "Done." is shown, `target` still holds the same root element, which is the only element in it, and its style still declares position fixed, bottom 0, left 0 and right 0
test("the bar stays fixed when the route changes and a message is sent on the new route", async () => {
  endpointAnswers("Done.");
  const it = await drawnBar();
  const root = it.target.childNodes[0];
  it.current.subject = subjectOf("use-case:UC-008", "UC-008 Another use case");
  one(it.target, "instruction").value = "go on";
  one(it.target, "send").dispatchEvent(Object.defineProperty(new Event("click"), "isTrusted", { value: true }));
  await until(() => requests === 1 && one(it.target, "answer"), "the answer is shown");
  assert.ok(one(it.target, "answer").textContent.includes("Done."));
  assert.equal(it.target.childNodes.length, 1);
  assert.equal(it.target.childNodes[0], root);
  assert.deepEqual(
    { position: declared(root).position, bottom: declared(root).bottom, left: declared(root).left, right: declared(root).right },
    { position: "fixed", bottom: "0", left: "0", right: "0" },
  );
});

// TST-1207001 · level: unit · module: MOD-prompt-bar
// guards: UC-049
// given: the bar of TST-600034, a message sent and answered, so that the conversation holds the author's message and the answer
// input: Clear conversation, clicked
// expect: the conversation shown is empty and the tab keeps no conversation; known positive: before the click both messages are shown
test("Clear conversation empties the conversation of the tab and what the bar shows of it", async () => {
  endpointAnswers("Done.");
  const it = await drawnBar();
  one(it.target, "instruction").value = "hello";
  one(it.target, "send").dispatchEvent(Object.defineProperty(new Event("click"), "isTrusted", { value: true }));
  await until(() => one(it.target, "answer") && !one(it.target, "send").disabled, "the answer is shown");
  const messages = () => all(it.target, (node) => String(node.className).split(" ").includes("message")).length;
  assert.ok(messages() >= 2, "known positive: the author's message and the answer are shown");
  const key = [...globalThis.sessionStorage.values.keys()].find((name) => name.includes("prompt-bar:conversation"));
  assert.ok(key, "known positive: the tab keeps the conversation");
  assert.ok(globalThis.sessionStorage.getItem(key).includes("hello"), "known positive: the kept conversation holds the message");
  one(it.target, "clear").dispatchEvent(new Event("click"));
  assert.equal(messages(), 0);
  assert.equal(globalThis.sessionStorage.getItem(key).includes("hello"), false);
});
