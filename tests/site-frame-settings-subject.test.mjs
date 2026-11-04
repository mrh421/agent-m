// The subject of the Settings routes (ITM-511) — MOD-settings-pages' routes keep MOD-site-frame's default subject (UC-049 3c): the kind
// `converse`, and as its page the text the route has drawn, which holds no input's value. So the page names the settings and their
// states — among them the line Recording conversations — and a stored token, shown only in a hidden field, is never part of it, also
// after *Show*.
// Run: node --test tests/site-frame-settings-subject.test.mjs
//
// Module: MOD-site-frame · MOD-settings-pages
// Guards: A STORED SECRET IS HIDDEN UNTIL SHOWN; UC-049; UC-042
// Level: unit
//
// Each test names its input and states its expected values in its own text; none reads an expected result from the SPEC, a use case or
// an architecture file. The page is the small fixture DOM of tests/site-frame-start.d/dom.mjs, as tests/site-frame-prompt-bar.test.mjs
// uses it. The real MOD-prompt-bar, MOD-job-runner, MOD-runtimes and the real GitHub host run as they are, over a fetch that answers the
// repository of the instance (acme/instance) and a model endpoint from memory; nothing reaches the network. The one strategy of another
// module that the kind `converse` names, `chapters-for-page`, is a fixture that keeps the parameters of every message, so a test reads
// what the bar asked the subject for. The counter-proof (a planted fault in src/settings-pages/ and the test's failing result) is
// recorded in the pull request.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { all, installPage, fixtureStorage, FixtureElement } from "./site-frame-start.d/dom.mjs";
import { openStore, readTabValue, writeSetting } from "../src/browser-store/index.mjs";
import { registerStrategies } from "../src/job-runner/index.mjs";
import { renderArtifact } from "../src/markdown-render/index.mjs";
import { view } from "../src/settings-pages/index.mjs";

const { startPage } = await import("../src/site-frame/index.mjs");

// The fixture page's elements do not take the focus; the Settings page moves it to a tab it selects.
FixtureElement.prototype.focus ??= function focus() {};

const REVIEW = { hostname: "acme.github.io", pathname: "/instance/docs/index.html" };
const SECRET = "github_pat_SECRET_TOKEN_VALUE_0123456789";
const settle = () => new Promise((resolve) => setImmediate(resolve));
async function until(condition, what) { for (let at = 0; at < 400; at += 1) { if (condition()) return; await settle(); } assert.fail(`never: ${what}`); }
const walk = (root) => root.children.flatMap((child) => typeof child === "string" ? [] : [child, ...walk(child)]);
const byClass = (root, name) => walk(root).filter((node) => node.className.split(" ").includes(name));
const one = (root, name) => byClass(root, name)[0];

const COLUMNS = "| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |\n|---|---|---|---|---|---|---|---|";
const REGISTER = `# Participants of this instance\n\n${COLUMNS}\n| drafter-a | model endpoint | model-drafter-a | 200000 | — | draft text | Anthropic, USA | endpoint ep1 |\n`;
const FILES = { "docs/participants.md": REGISTER };
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const seen = [];
registerStrategies("tests/site-frame-settings-subject.test.mjs", { recipes: { "chapters-for-page": async (context, params) => { seen.push(params); return []; } } });
const realFetch = globalThis.fetch;
function installNetwork() {
  globalThis.fetch = async (url) => {
    const address = String(url);
    if (address === "https://models.example/v1/chat/completions") {
      return reply({ choices: [{ message: { content: JSON.stringify({ draft: { answer: "ok" }, answers: [] }) } }], usage: { prompt_tokens: 10, completion_tokens: 5 } });
    }
    const api = /^https:\/\/api\.github\.com\/repos\/acme\/instance(\/.*)?$/.exec(address);
    if (!api) return reply({ message: "Not Found" }, 404);
    const rest = api[1] ?? "";
    if (rest === "") return reply({ default_branch: "main", visibility: "public", private: false, permissions: { push: true }, archived: false, description: "" });
    if (rest.startsWith("/commits/")) return reply({ sha: "c-instance" });
    if (rest.startsWith("/git/trees/")) return reply({ tree: Object.keys(FILES).map((path) => ({ type: "blob", path, sha: `b-${path}` })) });
    const file = /^\/contents\/([^?]+)/.exec(rest)?.[1];
    if (file && FILES[decodeURIComponent(file)] !== undefined) return new Response(FILES[decodeURIComponent(file)], { status: 200 });
    return reply({ message: "Not Found" }, 404);
  };
}
test.afterEach(() => { globalThis.fetch = realFetch; });

// The review page at #settings, in a browser that declares the endpoint drafter-a — its place, context and model, as the bar offers it (UC-049 1) — and the
// instance's token SECRET.
async function start() {
  installNetwork();
  seen.length = 0;
  const fixture = installPage({ ...REVIEW, hash: "#settings" });
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: fixtureStorage() });
  globalThis.setInterval = () => 1;
  const store = openStore("acme/instance");
  writeSetting(store, "endpoint:drafter-a", { kind: "openai-compatible", url: "https://models.example/v1", model: "model-drafter-a", key: "sk-fixture", place: "Anthropic, USA", context: 200000 });
  writeSetting(store, "github-token", { value: SECRET, name: "alice", expires: "2030-01-01" });
  await startPage({ page: "review", views: [view], menuViews: [] });
  const body = fixture.document.body;
  const footer = all(body, "footer").find((node) => node.className === "site-frame-prompt-bar");
  await until(() => byClass(footer, "prompt-bar").length > 0 && byClass(body, "settings-repository-secret").length > 0, "the bar and the Settings page are drawn");
  // The line Recording conversations stands in the tab Repositories, which the person opens.
  byClass(body, "settings-tab")[1].dispatchEvent(new Event("click"));
  await until(() => /Recording conversations is (on|off)\./.test(one(body, "settings-recording-state")?.textContent ?? ""), "the line has read the switch");
  return { body, footer };
}
async function sends(page, text) {
  one(page.footer, "instruction").value = text;
  const before = seen.length;
  one(page.footer, "send").dispatchEvent(Object.defineProperty(new Event("click"), "isTrusted", { value: true }));
  await until(() => seen.length === before + 1 && one(page.footer, "send").disabled === false, "the message has run");
}

// TST-511201 · level: unit · module: MOD-site-frame · MOD-settings-pages
// guards: A STORED SECRET IS HIDDEN UNTIL SHOWN; UC-049; UC-042
// given: the review page at #settings (the real Settings route, which gives no subject of its own), in a browser that stores the instance's token github_pat_SECRET_TOKEN_VALUE_0123456789 and an instance without a switch file
// input: the person opens the tab Repositories; Send "what is stored?"; the person presses Show on the token's line; Send "and now?"
// expect: the token's field holds the secret, hidden before Show and shown after it (known positive, so the check below can find it); the page each message is given begins "Settings\nSettings\nhttps://github.com/acme/instance\n", names the line with its state, "Recording conversations is off.", and the setting "GitHub token", and does not contain the secret — before Show and after it; the subjects kept with the tab's messages are "settings" four times
test("the Settings routes keep the frame's default subject: the settings and their states, never a stored token, also after Show", async () => {
  const page = await start();
  const field = one(page.body, "settings-repository-secret");
  assert.equal(field.value, SECRET, "known positive: the field holds the secret");
  assert.equal(field.type, "password", "hidden until Show");
  await sends(page, "what is stored?");
  one(page.body, "settings-repository-show").dispatchEvent(new Event("click"));
  assert.equal(field.type, "text", "after Show the secret is revealed in full");
  assert.equal(field.value, SECRET);
  await sends(page, "and now?");
  for (const [at, subject] of seen.entries()) {
    assert.ok(subject.page.startsWith("Settings\nSettings\nhttps://github.com/acme/instance\n"), `message ${at}: the default page of the route`);
    assert.match(subject.page, /Recording conversations is off\./, `message ${at}: the page names the line and its state`);
    assert.match(subject.page, /GitHub token/, `message ${at}: the page names the setting`);
    assert.ok(!subject.page.includes(SECRET), `message ${at}: the stored token is not in the page`);
  }
  assert.equal(seen.length, 2);
  assert.deepEqual(readTabValue(openStore("acme/instance"), "prompt-bar:conversation").map((message) => message.subject), ["settings", "settings", "settings", "settings"]);
});

// TST-511202 · level: unit · module: MOD-site-frame · MOD-settings-pages
// guards: EVERY STEP EXPLAINS ITSELF; UC-042
// given: the review page at #settings (the real Settings route), an instance without a switch file, and explanations.md (the data under test, read only to find the topic)
// input: the Settings page is drawn
// expect: the line Recording conversations holds one folded explanation — a details of class explain, without the open attribute, with the summary "What is this?" — whose body is the rendered Markdown of the topic recording-conversations, and not that of the topic prompt-bar (known positive: the two renderings differ)
test("the line Recording conversations holds the folded explanation of the topic recording-conversations", async () => {
  const page = await start();
  const line = one(page.body, "settings-recording");
  assert.ok(line, "the instance's section holds the line Recording conversations");
  const folded = byClass(line, "explain");
  assert.equal(folded.length, 1, "the line holds one folded explanation");
  assert.equal(folded[0].localName, "details");
  assert.equal(folded[0].getAttribute("open"), null, "it is folded");
  const [summary, body] = folded[0].children;
  assert.equal(summary.textContent, "What is this?");
  const text = readFileSync(new URL("../src/site-frame/explanations.md", import.meta.url), "utf8");
  const topic = (name) => text.split(/^## /m).slice(1).find((part) => part.startsWith(`${name}\n`))?.slice(name.length + 1);
  assert.ok(topic("recording-conversations")?.trim() && topic("prompt-bar")?.trim(), "known positive: explanations.md holds both topics");
  assert.notEqual(renderArtifact(topic("recording-conversations")).innerHTML, renderArtifact(topic("prompt-bar")).innerHTML, "known positive: the two topics render differently");
  assert.equal(body.innerHTML, renderArtifact(topic("recording-conversations")).innerHTML, "the body is the topic recording-conversations, rendered");
});
