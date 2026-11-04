// MOD-settings-pages — the endpoint configuration says when the prompt bar appears, in a folded explanation, and the participants page no longer says it (ITM-1186), as UC-049 alternative 1a states it
// (docs/use-cases/UC-049-talk-to-an-agent-in-the-prompt-bar.md): "**1a. Nothing is configured.** No endpoint is configured in this browser and no paired Bridge offers a CLI session. The prompt bar is not shown. The settings page says
// that it appears once an endpoint is configured or a Bridge offers a CLI session." and as docs/architecture/MOD-settings-pages.md states it for `endpoints`: "a folded explanation that the prompt bar appears once an endpoint is
// configured or a Bridge offers a CLI session (UC-049 1a)".
// Run: node --test tests/settings-pages-prompt-bar-note.test.mjs
//
// Module: MOD-settings-pages
// Guards: UC-049; EVERY STEP EXPLAINS ITSELF
// Level: unit
//
// These tests use only MOD-settings-pages' public `view`: each route is drawn with Route.render(target, context, params) in the small DOM of tests/site-frame-dom.mjs, over a store and, for the participants register, a host that
// answers the instance's repository from memory. The readings, named in the pull request: the explanation is a fold of class `explain` whose summary is *What is this?*, as every other fold of the page reads; the sentence stands in
// the fold on the endpoints page only. Each test states its input and its expected result before it runs (given / input / expect). Nothing reaches the network. The counter-proofs are recorded in the pull request.

import "./site-frame-dom.mjs";
import test from "node:test";
import assert from "node:assert/strict";

const { view } = await import("../src/settings-pages/index.mjs");
const { openStore } = await import("../src/browser-store/index.mjs");

class Storage { constructor() { this.values = new Map(); } getItem(key) { return this.values.get(key) ?? null; } setItem(key, value) { this.values.set(key, String(value)); } removeItem(key) { this.values.delete(key); }
  key(at) { return [...this.values.keys()][at] ?? null; } get length() { return this.values.size; } }
const REGISTER = "# Participants of this instance\n\n| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |\n|---|---|---|---|---|---|---|---|\n"
  + "| local-llm | model endpoint | model-a | 200000 | — | draft text | this machine | endpoint ep1 |\n";
const host = { repositoryInfo: async () => ({ defaultBranch: "main", visibility: "private", canWrite: true }),
  readSnapshot: async () => ({ commit: "h".repeat(40), paths: ["docs/participants.md"], read: async (path) => (path === "docs/participants.md" ? REGISTER : null), blob: () => "b".repeat(40) }),
  commitFiles: async () => ({ commit: "c".repeat(40) }), webLinks: () => ({}) };

function elements(root, match) {
  const found = [];
  (function walk(n) { for (const k of n.childNodes ?? []) if (k.nodeType === 1) { if (match(k)) found.push(k); walk(k); } })(root);
  return found;
}
async function drawn(name) {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: new Storage() });
  const store = openStore("fixture/agent-m");
  const route = view.routes.find((candidate) => candidate.name === name);
  assert.ok(route, `the route ${name}`);
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, { page: "review", instance: { repository: "fixture/agent-m", host }, product: null, store, go() {} }, {});
  return target;
}

// TST-1128001 · level: unit · module: MOD-settings-pages
// guards: UC-049; EVERY STEP EXPLAINS ITSELF
// given: the settings pages of a browser whose register lists one participant
// input: the endpoint route and the participants route drawn
// expect: the endpoint page holds one sentence on the prompt bar, inside a folded explanation whose summary is "What is this?", saying that it appears once an endpoint is configured or a Bridge offers a CLI session; the participants page holds no mention of the prompt bar
// Planted fault: the sentence outside a fold, with another summary, without the Bridge's CLI session, or on the participants page fails it.
test("the endpoint configuration says in a fold that the prompt bar appears once an endpoint is configured or a Bridge offers a CLI session, and the participants page does not", async () => {
  const endpoints = await drawn("endpoints");
  const notes = elements(endpoints, (node) => node.localName === "p" && /prompt bar/i.test(node.textContent));
  assert.equal(notes.length, 1, "the endpoints page has one sentence on the prompt bar");
  const said = notes[0].textContent.replace(/\s+/g, " ");
  assert.match(said, /appears/i);
  assert.match(said, /once an endpoint is configured/i);
  assert.match(said, /a Bridge[^.]*offers a CLI session/i);
  const folds = elements(endpoints, (node) => node.localName === "details" && node.className.split(" ").includes("explain") && elements(node, (child) => child === notes[0]).length === 1);
  assert.equal(folds.length, 1, "the sentence stands in one folded explanation");
  assert.equal(elements(folds[0], (node) => node.localName === "summary").map((summary) => summary.textContent).join("|"), "What is this?");
  const participants = await drawn("participants");
  assert.doesNotMatch(participants.textContent, /prompt bar/i, "the participants page does not say when the prompt bar appears");
});
