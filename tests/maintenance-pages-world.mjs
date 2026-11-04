// The world of the tests of MOD-maintenance-pages' replies page — a helper, no test of its own: the browser, the repositories and the clock of tests/main-page-home-harness.mjs, and over its fake GitHub this file's fake of the Bridge lab-pc-4
// (the mail operations read, drafts, sent, find, show-draft, store-draft, update-draft, confirm-send, send), of GitHub's issues of alice/product — listed, read one by one, commented, labelled, closed — and of the model endpoints ep1 and ep2. Used by tests/maintenance-pages-replies.test.mjs (ITM-966),
// tests/maintenance-pages-send.test.mjs (ITM-967) and tests/maintenance-pages-ask.test.mjs (ITM-968). It holds no expected result.
//
// Module: MOD-maintenance-pages
// Level: unit

import assert from "node:assert/strict";
import { writeSetting } from "../src/browser-store/index.mjs";
import { mailId, noteText, withMailIds } from "../src/mail-records/index.mjs";
import { registerStrategies } from "../src/job-runner/index.mjs";
import { mailStrategies } from "../src/mail-handling/index.mjs";
import { privacyStrategies } from "../src/personal-data/index.mjs";
import { routeStrategies } from "../src/runtimes/index.mjs";
import { INSTANCE, PRODUCT, PRODUCT_URL, browser, byClass, draw, headOf, instanceFiles, network, smallProduct, timers } from "./main-page-home-harness.mjs";

const pages = await import("../src/maintenance-pages/index.mjs").catch((error) => ({ error }));
const routeNamed = (name) => pages.view?.routes.find((candidate) => candidate.name === name);
const route = () => routeNamed("replies");
for (const [at, strategies] of [mailStrategies, routeStrategies, privacyStrategies].entries()) {
  try { registerStrategies(`tests/maintenance-pages-replies.test.mjs#${at}`, strategies); } catch { /* registered by the page's own view */ }
}

const BRIDGE = "http://127.0.0.1:4711";
const ERIKA = { name: "Erika Mustermann", address: "erika@example.invalid" };
const SECRET = "the export of my thesis fails with error E42";

let net;
/** Puts the fetch, the timers and the document back; a test file calls it after each test. */
export function restoreWorld() { net?.restore(); timers.restore(); document.body.replaceChildren(); }
export const restoreNet = () => net?.restore();

const walk = (root, match) => { const found = []; (function visit(node) { for (const child of node.children ?? []) { if (typeof child === "string") continue; if (match(child)) found.push(child); visit(child); } })(root); return found; };
const one = (root, name) => byClass(root, name)[0];
const textOf = (node) => String(node.textContent).replace(/\s+/g, " ");
const flush = async () => { for (let n = 0; n < 80; n += 1) await new Promise((resolve) => setImmediate(resolve)); };
// The harness replaces setTimeout by a fake while a page is drawn, so the real one is kept from before: a page awaits the network, the hash of a Message-ID and a commit, which no number of turns of the event loop covers on a slower machine.
const realTimeout = globalThis.setTimeout;
const waitFor = async (condition) => { for (let n = 0; n < 500 && !condition(); n += 1) await new Promise((resolve) => realTimeout(resolve, 10)); await flush(); };
const trusted = async (node) => { const event = new Event("click"); Object.defineProperty(event, "isTrusted", { value: true }); node.dispatchEvent(event); await flush(); };
const buttonsOf = (root, text) => walk(root, (node) => node.localName === "button" && node.textContent === text);
const itemOf = (target, id) => walk(target, (node) => node.getAttribute?.("data-mail") === id)[0];

/** A mail as the Bridge returns it; its identifier is the hash of its Message-ID. */
async function mailOf(key, over = {}) {
  const messageId = `<${key}@mail.example.invalid>`;
  return { id: await mailId({ messageId, bytes: null }), messageId, inReplyTo: null, references: [], from: ERIKA, replyTo: [], to: [{ name: null, address: "reports@example.org" }], cc: [],
    subject: `Subject ${key}`, date: "2026-10-18T08:00:00Z", text: `Hello,\n${SECRET}.\nKind regards\nErika Mustermann`, attachments: [], folder: "INBOX", ...over };
}

const REGISTER = (rows) => ["# Participants of this instance", "", "**REGISTER**", "", "The participants of the test instance.", "",
  "| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |", "|---|---|---|---|---|---|---|---|", ...rows, ""].join("\n");
const LOCAL = "| local-llm | model endpoint | model-a | 200000 | — | draft text | this machine | endpoint ep1 |";
const CLOUD = "| cloud-llm | model endpoint | model-b | 200000 | — | draft text | a provider in the USA | endpoint ep2 |";
const NO_DRAFTER = "| checker | model endpoint | model-c | 200000 | — | read the repository | this machine | endpoint ep1 |";

const issueRecord = (number, state, mails, { comments = [], labels = [] } = {}) => ({ number, title: `Issue ${number}`, body: withMailIds(`Issue ${number}.`, mails.map((mail) => mail.id)), state, labels, comments });

/**
 * The world: the mails of the mailbox (`mails`, found by `find`), the drafts in Drafts (`drafts`: { ref, inReplyTo, mail }), GitHub's issues of alice/product, the participants' register and the places the mailbox allows.
 * Returns what the fakes kept: the operations the Bridge received, the requests GitHub received, the texts the endpoint returned.
 * For the route `mail` (ITM-964): `reading` is what the Bridge's operation `read` returns; `answer(request)` is the answer of a model endpoint or of an agent on the Bridge to a request ({ origin, body }), a draft object that is wrapped as the endpoint answers; `product` adds files to the product's repository, `instance` to the instance's.
 */
function world({ mails, drafts = [], issues, rows = [LOCAL, CLOUD, NO_DRAFTER], places = [{ place: "this machine", outsideEu: false }], texts = [], send = "ok", commentStatus = null, createStatus = null, reading = null, stateDelay = 0, answer = null, product = {}, instance = {} }) {
  const files = { ...instanceFiles(), "docs/participants.md": REGISTER(rows), ...instance };
  const productFiles = { ...smallProduct(), ...product };
  let pending = {};
  net = network({ [INSTANCE]: files, [PRODUCT]: productFiles }, { bridgeLists: null });
  net.install();
  const context = browser();
  // The small DOM of the harness lacks hasAttribute, which MOD-site-frame's run panel asks of its Run button.
  const prototype = Object.getPrototypeOf(document.createElement("div"));
  prototype.hasAttribute ??= function hasAttribute(name) { return this.getAttribute(name) !== null && this.getAttribute(name) !== undefined; };
  writeSetting(context.store, "mailbox", { address: "reports@example.org", route: "imap", folders: ["INBOX"], places,
    imap: { bridge: "lab-pc-4", jumpHostNoted: false, imap: { host: "imap.example.org", port: 993, security: "tls" }, smtp: { host: "smtp.example.org", port: 587, security: "starttls" }, account: "reports@example.org", password: "mail-password-966" } });
  writeSetting(context.store, "endpoint:ep1", { url: "https://ep1.example.test/v1", kind: "openai-compatible", model: "model-a", key: "k1" });
  writeSetting(context.store, "endpoint:ep2", { url: "https://ep2.example.test/v1", kind: "openai-compatible", model: "model-b", key: "k2" });
  const asked = new Map();
  const kept = { bridge: [], github: [], endpoint: [], ask: [], drafts: [...drafts], issues: issues.map((issue) => ({ ...issue })), send, commentStatus, createStatus, created: [] };
  let nextUid = 100;
  let inner = globalThis.fetch;
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const wrapper = async (input, init = {}) => {
    const url = new URL(typeof input === "object" && !(input instanceof URL) ? input.url : String(input));
    const method = String(init.method ?? "GET").toUpperCase();
    if (url.origin === BRIDGE && url.pathname.startsWith("/v1/mail/")) {
      const operation = url.pathname.slice("/v1/mail/".length);
      const { args } = JSON.parse(init.body);
      kept.bridge.push({ operation, args });
      if (operation === "read") return json(reading ?? mails);
      if (operation === "drafts") return json(kept.drafts);
      if (operation === "sent") return json([]);
      if (operation === "find") {
        const found = mails.find((each) => each.id === args.id);
        return found ? json(found) : json({ error: "not-found", message: `${args.id}: no such mail in INBOX` }, 404);
      }
      if (operation === "show-draft") {
        const draft = kept.drafts.find((each) => JSON.stringify(each.ref) === JSON.stringify(args.ref));
        if (!draft) return json({ error: "not-found", message: "no such draft" }, 404);
        return json({ ref: draft.ref, sha256: "a".repeat(64), from: { name: null, address: "reports@example.org" }, to: [draft.to ?? ERIKA], cc: [], subject: draft.subject ?? `Re: ${draft.mail.subject}`, body: draft.body ?? "Draft text.",
          attachments: draft.attachments ?? [] });
      }
      if (operation === "confirm-send") return json({ confirmation: "single-use-1" });
      if (operation === "send") {
        if (kept.send === "refused") return json({ error: "upstream-failed", message: "550 relay denied" }, 502);
        if (kept.send === "changed") return json({ error: "confirmation-refused", message: "The draft is not the mail that was confirmed." }, 409);
        kept.drafts = kept.drafts.filter((each) => JSON.stringify(each.ref) !== JSON.stringify(args.ref));
        return json({ sentAt: "2026-10-19T10:00:00.000Z" });
      }
      if (operation === "store-draft" || operation === "update-draft") {
        const ref = { route: "bridge", uid: nextUid += 1, uidValidity: 7 };
        const entry = { ref, inReplyTo: args.draft.replyTo.messageId, mail: args.draft.replyTo, to: args.draft.to, subject: args.draft.subject, body: args.draft.body };
        if (operation === "update-draft") kept.drafts = kept.drafts.filter((each) => JSON.stringify(each.ref) !== JSON.stringify(args.ref));
        kept.drafts.push(entry);
        return json(ref);
      }
      return json({ error: "not-found", message: `unknown operation ${operation}` }, 404);
    }
    if (url.origin === BRIDGE && url.pathname === "/v1/ask" && method === "POST") {
      const request = { origin: url.origin, body: JSON.parse(init.body) };
      kept.ask.push(request);
      asked.set(`ask-${kept.ask.length}`, JSON.stringify(answer ? answer(request) : { draft: { replies: texts }, answers: [] }));
      return json({ ask: `ask-${kept.ask.length}` });
    }
    if (url.origin === BRIDGE && url.pathname.startsWith("/v1/ask/") && method === "GET") return json({ state: "done", text: asked.get(url.pathname.slice("/v1/ask/".length)), usage: null });
    if (url.host === "api.github.com" && url.pathname.startsWith(`/repos/${PRODUCT}/issues`)) {
      kept.github.push({ method, path: url.pathname, body: init.body ?? null });
      // An issue as GitHub's "List repository issues" and "Get an issue" answer it: its comments by their count.
      const issueJson = (issue) => ({ number: issue.number, title: issue.title, body: issue.body, state: issue.state, labels: issue.labels, comments: issue.comments.length, html_url: `${PRODUCT_URL}/issues/${issue.number}` });
      if (method === "GET" && url.pathname === `/repos/${PRODUCT}/issues`) return json(kept.issues.map(issueJson));
      const single = /^\/repos\/alice\/product\/issues\/(\d+)$/.exec(url.pathname);
      if (method === "GET" && single) {
        const found = kept.issues.find((issue) => issue.number === Number(single[1]));
        return found ? json(issueJson(found)) : json({ message: "Not Found" }, 404);
      }
      if (method === "POST" && url.pathname === `/repos/${PRODUCT}/issues`) {
        if (kept.createStatus) return json({ message: "Resource not accessible by personal access token" }, kept.createStatus);
        const given = JSON.parse(init.body);
        const number = 100 + kept.created.length;
        const made = { number, title: given.title, body: given.body, state: "open", labels: given.labels ?? [], comments: [] };
        kept.created.push(made);
        kept.issues.push(made);
        return json({ number, title: made.title, body: made.body, labels: made.labels.map((name) => ({ name })), state: "open", html_url: `https://github.com/${PRODUCT}/issues/${number}` }, 201);
      }
      const comments = /^\/repos\/alice\/product\/issues\/(\d+)\/comments$/.exec(url.pathname);
      if (method === "GET" && comments) return json((kept.issues.find((issue) => issue.number === Number(comments[1]))?.comments ?? []).map((comment) => ({ user: { login: "dev" }, body: comment, created_at: "2026-10-18T09:00:00Z" })));
      const one_ = /^\/repos\/alice\/product\/issues\/(\d+)$/.exec(url.pathname);
      if (method === "PATCH" && one_) { if (stateDelay) await new Promise((resolve) => realTimeout(resolve, stateDelay)); kept.issues.find((issue) => issue.number === Number(one_[1])).state = JSON.parse(init.body).state; return json({ number: Number(one_[1]) }); }
      const labels = /^\/repos\/alice\/product\/issues\/(\d+)\/labels(?:\/(.+))?$/.exec(url.pathname);
      if (labels && method === "POST") { const target = kept.issues.find((issue) => issue.number === Number(labels[1])); target.labels = [...new Set([...target.labels, ...JSON.parse(init.body).labels])]; return json(target.labels.map((name) => ({ name }))); }
      if (labels && method === "DELETE") { const target = kept.issues.find((issue) => issue.number === Number(labels[1])); target.labels = target.labels.filter((name) => name !== decodeURIComponent(labels[2])); return json([]); }
      if (method === "POST" && comments && kept.commentStatus) return json({ message: "Resource not accessible by personal access token" }, kept.commentStatus);
      if (method === "POST" && comments) { kept.issues.find((issue) => issue.number === Number(comments[1])).comments.push(JSON.parse(init.body).body); return json({ id: 1 }, 201); }
    }
    if (url.origin === "https://ep1.example.test" || url.origin === "https://ep2.example.test") {
      const request = { origin: url.origin, body: JSON.parse(init.body) };
      kept.endpoint.push(request);
      return json({ choices: [{ message: { content: JSON.stringify(answer ? answer(request) : { draft: { replies: texts }, answers: [] }) } }], usage: { prompt_tokens: 10, completion_tokens: 5 } });
    }
    if (url.host === "api.github.com" && url.pathname === `/repos/${PRODUCT}/commits/${headOf(PRODUCT)}`) return inner(new URL(`https://api.github.com/repos/${PRODUCT}/commits/main`), init);
    if (url.host === "api.github.com" && url.pathname.startsWith(`/repos/${PRODUCT}/git/`) && !url.pathname.includes("/git/trees/")) {
      if (method !== "GET") kept.github.push({ method, path: url.pathname, body: init.body ?? null });
      if (method === "GET" && url.pathname.endsWith("/git/ref/heads/main")) return json({ object: { sha: headOf(PRODUCT) } });
      if (method === "GET" && url.pathname.includes("/git/commits/")) return json({ tree: { sha: "tree-1" } });
      if (method === "POST" && url.pathname.endsWith("/git/commits")) return json({ sha: "9".repeat(40) });
      if (method === "PATCH") { Object.assign(productFiles, pending); pending = {}; net.change(PRODUCT, { ...productFiles }); inner = globalThis.fetch; globalThis.fetch = wrapper; return json({}); }
    }
    if (url.host === "api.github.com" && method === "POST" && url.pathname === `/repos/${PRODUCT}/git/trees`) {
      kept.github.push({ method, path: url.pathname, body: init.body ?? null });
      for (const entry of JSON.parse(init.body).tree ?? []) if (typeof entry.content === "string") pending[entry.path] = entry.content;
      return json({ sha: "tree-2" });
    }
    return inner(input, init);
  };
  globalThis.fetch = wrapper;
  return { context, kept };
}

async function opened(w, params = {}, name = "replies") {
  assert.ok(routeNamed(name), `the route ${name}: ${pages.error?.message}`);
  return draw(routeNamed(name), w.context, params);
}
async function read(target) {
  await trusted(one(target, "read-replies"));
  await waitFor(() => byClass(target, "replies-group").length > 0 || byClass(target, "replies-problem").length > 0);
  return target;
}
const issuesIn = (target, group) => walk(walk(target, (node) => node.getAttribute?.("data-group") === group)[0] ?? target, (node) => (node.className ?? "").split(" ").includes("reply-issue")).map((node) => Number(node.getAttribute("data-issue")));

/** The standard fixture: the closed issue 4 listing four mails (one with a draft, one not in the mailbox, one without a reply address), an answer received (5), an open issue (6), and a closed issue fully answered (7). */
async function standard(over = {}) {
  const [plain, drafted, absent, nowhere, waiting, open, answered] = [await mailOf("plain"), await mailOf("drafted"), await mailOf("absent"), await mailOf("nowhere", { from: { name: null, address: "not-an-address" } }),
    await mailOf("waiting"), await mailOf("open"), await mailOf("answered")];
  const draft = { ref: { route: "bridge", uid: 1, uidValidity: 7 }, inReplyTo: drafted.messageId, mail: drafted, to: ERIKA, subject: "Re: Subject drafted", body: "We fixed the export in version 1.5.\n\n> Hello,\n> the original",
    attachments: [{ name: "log.txt", type: "text/plain", size: 4 }] };
  const date = new Date().toISOString().slice(0, 10);
  const issues = [
    issueRecord(4, "closed", [plain, drafted, absent, nowhere], { comments: ["Closed with pull request https://github.com/alice/product/pull/9."] }),
    issueRecord(5, "open", [waiting], { labels: ["waiting-for-reporter"], comments: [noteText("question-sent", waiting.id, date), noteText("mail-added", waiting.id, date)] }),
    issueRecord(6, "open", [open]),
    issueRecord(7, "closed", [answered], { comments: [noteText("reply-sent", answered.id, date)] }),
  ];
  return { mails: { plain, drafted, absent, nowhere, waiting, open, answered }, found: [plain, drafted, nowhere, waiting, open, answered], drafts: [draft], issues, ...over };
}
const start = async (extra = {}) => {
  const f = await standard();
  const w = world({ mails: f.found, drafts: f.drafts, issues: f.issues, ...extra });
  return { ...f, w, target: await opened(w) };
};


export { routeNamed, BRIDGE, ERIKA, SECRET, PRODUCT_URL, PRODUCT, walk, one, textOf, flush, waitFor, trusted, buttonsOf, itemOf, mailOf, world, opened, read, issuesIn, standard, start, pages, route, byClass, noteText, REGISTER, LOCAL, CLOUD, issueRecord };
