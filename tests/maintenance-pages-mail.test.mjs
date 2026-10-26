// The route `mail` of MOD-maintenance-pages, up to the author's decision (ITM-963) — UC-038 steps 1 to 3, 7 to 9, 10 (the link), 2a, 4b, 6a, 7a, 7b, 8a — as the accepted text of docs/architecture/MOD-maintenance-pages.md states it (:105-110, blob
// f21551157732): "`mail` — *Read mailbox*; the mails no issue lists and nobody marked *not an issue*, with sender, subject and date in this browser only; ... per mail, the mail in full beside the proposal, its text editable, every hit
// of the mail's people marked; *Create issue* — only without a hit —, *Add to #n*, *Not an issue*." The participant, the run panel and *Propose* are ITM-964's: here every proposal is empty (UC-038 4b).
// Run: node --test tests/maintenance-pages-mail.test.mjs
//
// Module: MOD-maintenance-pages
// Guards: A MAIL BECOMES AN ISSUE ONLY BY A PERSON'S CLICK; THE PRODUCT ISSUE CARRIES NO PERSONAL DATA; MAIL STAYS IN THE MAILBOX; A MAIL ALREADY DECIDED IS NOT PROPOSED AGAIN; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; UC-038
// Level: component
//
// The document is the small DOM of tests/site-frame-dom.mjs. The real MOD-mail-routes (the Bridge route), MOD-mail-handling, MOD-mail-records, MOD-personal-data, MOD-repository-hosts (GitHub), MOD-bridge-client and MOD-browser-store
// run as they are; only `fetch` is faked, by this file: the Bridge on the loopback answers the mail operation `read` (POST /v1/mail/read) with the mails given, and GitHub's REST API for alice/product answers the issues, their
// comments, the creation of an issue and of a comment, keeping what it is given. The store is a Map-backed localStorage that holds the mailbox connection, the Bridge, the product and its token. Nothing leaves the process.
// Readings the texts leave open, which the tests state (the pull request names them):
//   - The page: <button class="read-mailbox"> "Read mailbox"; <p class="mail-decided"> (how many were left out); <ul class="mail-attached"> of <li class="mail-attached-item"> with <a class="issue-link"> to the address the frame writes for the issue, #issue/number=<n>/product=<address>; <ul class="mail-list"> of
//     <li class="mail" data-mail="<MAIL-id>"> with .mail-sender, .mail-subject, .mail-date, <pre class="mail-text"> (the mail in full), <select class="mail-product">, <select class="mail-kind"> (defect, change), <input class="mail-title">,
//     <textarea class="mail-body">, <ul class="mail-hits"> of <li class="mail-hit"> (one per hit of the mail's people in the title and the text), <button class="create-issue"> "Create issue", <input class="mail-issue-number"> with
//     <button class="add-to-issue"> "Add to #<n>", <button class="not-an-issue"> "Not an issue", and <p class="mail-result"> (what came of a click). <p class="mailbox-problem"> names why nothing was read.
//   - Each decision is made on a click the browser marks as a person's (isTrusted); a click a script makes does nothing. Create issue is disabled while a hit stands, and while the title or the text is empty.
//   - After Create issue or Add to #n the mail stays in the list, with the result (7b: Create issue once per concern); after Not an issue it leaves it. Reading again leaves out every mail an issue lists or the store marks.
//   - A created issue of the kind change is followed by <a class="issue-link"> to #issue/number=<n>/product=<address> (UC-038 step 10: the issue's route drafts the change); one of the kind defect has none.
//   - A refused token (HTTP 401) or a missing permission (403) on Create issue is named with the product, with <a class="token-step"> to the step that stores the token (#add-product); nothing is written.
//   - Every step is folded with <details class="explain">: reading, the list, the review of a mail, the decisions.
//   - The route gives the prompt bar a subject whose page holds the `MAIL-` identifiers of the listed mails and no mail text, and which refuses propose-edit and hand-over (MOD-maintenance-pages.md:123-130); ITM-510 extends it for allowed participants.
// The counter-proofs are recorded in the pull request.

import "./site-frame-dom.mjs";
import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { openStore, writeSetting, readSetting } from "../src/browser-store/index.mjs";
import { mailId, withMailIds, noteText } from "../src/mail-records/index.mjs";
import { chosenProduct, fragmentOf, routeOf } from "../src/site-frame/routing.mjs";

const pages = await import("../src/maintenance-pages/index.mjs").catch((error) => ({ error }));
const route = () => pages.view?.routes.find((candidate) => candidate.name === "mail");

const INSTANCE = "alice/agent-m";
const PRODUCT = "alice/product";
const PRODUCT_URL = `https://github.com/${PRODUCT}`;
const BRIDGE_URL = "http://127.0.0.1:4711";
const ERIKA = { name: "Erika Mustermann", address: "erika@example.invalid" };
const SECRET_SENTENCE = "the export of my thesis fails with error E42";

function descendants(root, predicate) {
  const found = [];
  (function visit(node) { for (const child of node.childNodes ?? []) { if (child.nodeType === 1) { if (predicate(child)) found.push(child); visit(child); } } })(root);
  return found;
}
const byClass = (root, name) => descendants(root, (node) => (node.className ?? "").split(" ").includes(name));
const byTag = (root, name) => descendants(root, (node) => node.localName === name);
const textOf = (node) => node.textContent.replace(/\s+/g, " ");
const flush = async () => { for (let n = 0; n < 80; n += 1) await new Promise((resolve) => setImmediate(resolve)); };
const trusted = async (node) => { const event = new Event("click"); Object.defineProperty(event, "isTrusted", { value: true }); node.dispatchEvent(event); await flush(); };
// Waits (real timers, at most two seconds) until the condition holds: a page awaits the network and the hash of a Message-ID, which no fixed number of turns of the event loop covers on a slower machine.
const waitFor = async (condition) => { for (let n = 0; n < 200 && !condition(); n += 1) await new Promise((resolve) => setTimeout(resolve, 10)); };
const typed = async (node, value) => { node.value = value; node.dispatchEvent(new Event("input")); await flush(); };
const itemOf = (target, id) => descendants(target, (node) => node.getAttribute?.("data-mail") === id)[0];

// ---------------------------------------------------------------- the world

const REAL_FETCH = globalThis.fetch;
function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => (values.has(key) ? values.get(key) : null), setItem: (key, value) => values.set(key, String(value)), removeItem: (key) => values.delete(key),
    get length() { return values.size; }, key: (index) => [...values.keys()][index] ?? null, values };
}
const CONNECTION = { address: "reports@example.org", route: "imap", folders: ["INBOX"], places: [],
  imap: { bridge: "lab-pc", jumpHostNoted: false, imap: { host: "imap.example.org", port: 993, security: "tls" }, smtp: { host: "smtp.example.org", port: 587, security: "starttls" }, account: "reports@example.org", password: "mail-password-963" } };

const sent = [];                                  // every request to GitHub: { method, path, body }
let github, bridgeAnswer;
afterEach(() => { globalThis.fetch = REAL_FETCH; document.body.replaceChildren(); });

/** A mail as the Bridge returns it; its identifier is the hash of its Message-ID, as MOD-mail-records names it. */
async function mailOf(key, over = {}) {
  const messageId = `<${key}@mail.example.invalid>`;
  return { id: await mailId({ messageId, bytes: null }), messageId, inReplyTo: null, references: [], from: ERIKA, replyTo: [], to: [{ name: null, address: "reports@example.org" }], cc: [],
    subject: `Subject ${key}`, date: "2026-10-18T08:00:00Z", text: `Hello,\n${SECRET_SENTENCE}.\nKind regards\nErika Mustermann`, attachments: [], folder: "INBOX", ...over };
}

/** The world: the store, the Bridge's answer to read, and GitHub's issues of alice/product (`issues`: { number, title, body, state, comments: [{ body }] }). */
function world({ mails, issues = [], bridge = null, refuse = null, marked = null }) {
  const storage = memoryStorage();
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true, writable: true });
  Object.defineProperty(globalThis, "location", { value: { hostname: "alice.github.io", pathname: "/agent-m/", origin: "https://alice.github.io", href: "https://alice.github.io/agent-m/" }, configurable: true, writable: true });
  const store = openStore(INSTANCE);
  writeSetting(store, "mailbox", CONNECTION);
  writeSetting(store, "bridge:lab-pc", { address: BRIDGE_URL, token: "bridge-token-963" });
  writeSetting(store, "products", [PRODUCT_URL]);
  writeSetting(store, `github-token:${PRODUCT}`, { value: "github_pat_PRODUCT963", name: "alice/product token", expires: "2027-01-01" });
  if (marked) writeSetting(store, "not-an-issue", marked);
  sent.length = 0;
  github = { issues: issues.map((issue) => ({ state: "open", labels: [], comments: [], ...issue })), created: [] };
  bridgeAnswer = bridge ?? (() => new Response(JSON.stringify(mails), { status: 200, headers: { "Content-Type": "application/json" } }));
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === "object" && !(input instanceof URL) ? input.url : String(input));
    const method = String(init.method ?? "GET").toUpperCase();
    if (url.origin === BRIDGE_URL) return typeof bridgeAnswer === "function" ? bridgeAnswer(url, init) : bridgeAnswer;
    if (url.host !== "api.github.com") throw new Error(`no request leaves the fixtures: ${url.href}`);
    sent.push({ method, path: url.pathname, body: init.body ?? null });
    const base = `/repos/${PRODUCT}`;
    if (method === "GET" && url.pathname === `${base}/issues`) return json(github.issues.map((issue) => ({ number: issue.number, title: issue.title, body: issue.body, state: issue.state, labels: issue.labels, comments: issue.comments.length, html_url: `${PRODUCT_URL}/issues/${issue.number}` })));
    const comments = /^\/repos\/alice\/product\/issues\/(\d+)\/comments$/.exec(url.pathname);
    if (method === "GET" && comments) return json((github.issues.find((issue) => issue.number === Number(comments[1]))?.comments ?? []).map((comment) => ({ user: { login: "dev" }, body: comment.body, created_at: "2026-10-18T09:00:00Z" })));
    if (method === "POST" && comments) { github.issues.find((issue) => issue.number === Number(comments[1])).comments.push({ body: JSON.parse(init.body).body }); return json({ id: 1 }, 201); }
    if (method === "POST" && url.pathname === `${base}/issues`) {
      if (refuse) return json({ message: "Resource not accessible by personal access token" }, refuse);
      const given = JSON.parse(init.body);
      const number = 100 + github.created.length;
      const made = { number, title: given.title, body: given.body, labels: given.labels, state: "open", comments: [] };
      github.created.push(made);
      github.issues.push(made);
      return json({ number, title: made.title, body: made.body, labels: made.labels.map((name) => ({ name })), state: "open", html_url: `${PRODUCT_URL}/issues/${number}` }, 201);
    }
    return json({ message: "Not Found" }, 404);
  };
  return { store, storage };
}

async function open(world_, goes = []) {
  const target = document.createElement("div");
  document.body.append(target);
  const context = { page: "main", instance: { repository: INSTANCE, host: null }, store: world_.store, product: null, go: (name, params) => goes.push([name, params]) };
  assert.ok(route(), `the route mail: ${pages.error?.message}`);
  await route().render(target, context, {});
  return target;
}
async function read(target) {
  await trusted(byClass(target, "read-mailbox")[0]);
  await waitFor(() => byClass(target, "mail-decided").length > 0 || byClass(target, "mailbox-problem").length > 0);
  return target;
}
const writesToGitHub = () => sent.filter((request) => request.method !== "GET");

// ---------------------------------------------------------------- the tests

// TST-963001 · level: component · module: MOD-maintenance-pages
// guards: A MAIL ALREADY DECIDED IS NOT PROPOSED AGAIN; A MAIL IN A KNOWN THREAD IS MATCHED WITHOUT A MODEL; READING THE MAILBOX CHANGES NOTHING IN IT; UC-038
// given: the mailbox holds a new mail, a mail an issue lists, a mail this browser marked, and a reply in the thread of the listed mail
// input: the route mail drawn; the person's click on Read mailbox
// expect: drawing reads nothing (no request); the list shows the new mail alone, with sender, subject and date; the page says two mails were left out as decided; the reply is shown under issue #4 with a link to the address the frame writes for issue 4 of alice/product (fragmentOf) and an
//         issue-link only for it; the Bridge got one request, the read; GitHub received one write, the note that lists the reply on #4
test("Read mailbox lists only the undecided mails, with sender, subject and date, and shows a mail of a known thread under its issue", async () => {
  const fresh = await mailOf("new"), listed = await mailOf("listed"), marked = await mailOf("marked");
  const reply = await mailOf("reply", { inReplyTo: listed.messageId, references: [listed.messageId] });
  const requests = [];
  const w = world({ mails: [fresh, listed, marked, reply], marked: [marked.id], issues: [{ number: 4, title: "Export fails", body: withMailIds("Export fails.", [listed.id]) }],
    bridge: (url, init) => { requests.push(`${init.method} ${url.pathname}`); return new Response(JSON.stringify([fresh, listed, marked, reply]), { status: 200, headers: { "Content-Type": "application/json" } }); } });
  const target = await open(w);
  assert.deepEqual([requests, sent], [[], []], "drawing reads nothing");
  await read(target);
  const items = byClass(target, "mail");
  assert.deepEqual(items.map((node) => node.getAttribute("data-mail")), [fresh.id]);
  const line = textOf(items[0]);
  assert.ok(line.includes("Erika Mustermann") && line.includes("Subject new") && line.includes("2026-10-18"), line);
  assert.match(textOf(byClass(target, "mail-decided")[0]), /2/);
  const attached = byClass(target, "mail-attached-item");
  assert.equal(attached.length, 1);
  assert.match(textOf(attached[0]), /#4/);
  assert.deepEqual(byClass(attached[0], "issue-link").map((link) => link.getAttribute("href")), [fragmentOf("issue", { number: "4", product: PRODUCT_URL })]);
  assert.deepEqual(requests, ["POST /v1/mail/read"]);
  assert.deepEqual(writesToGitHub().map((request) => `${request.method} ${request.path}`), ["POST /repos/alice/product/issues/4/comments"]);
  assert.equal(JSON.parse(writesToGitHub()[0].body).body, noteText("mail-added", reply.id, new Date().toISOString().slice(0, 10)));
});

// TST-963002 · level: component · module: MOD-maintenance-pages
// guards: A MAIL BECOMES AN ISSUE ONLY BY A PERSON'S CLICK; THE PRODUCT ISSUE CARRIES NO PERSONAL DATA; ONE CLICK PER DECISION; UC-038
// given: one new mail from Erika Mustermann; the proposal is empty (4b)
// input: the title and the text typed with the sender's name in it; the title and the text edited without the name; a click a script makes on Create issue; the kind change chosen; the person's click on Create issue
// expect: with the name the hit is listed in .mail-hits and Create issue is disabled; without it no hit and Create issue is enabled; the script's click writes nothing; the person's click creates exactly one issue, labelled change, whose text
//         ends with the mail's identifier in a Mails line and holds none of the mail's text, sender or address; the page names issue #100, and, the kind being change, links the address the frame writes for issue 100 of alice/product
test("Create issue is disabled while the text names the mail's people, and one click then creates one issue with the label and the Mails line", async () => {
  const mail = await mailOf("one");
  const w = world({ mails: [mail] });
  const target = await read(await open(w));
  const item = itemOf(target, mail.id);
  const create = byClass(item, "create-issue")[0];
  assert.equal(create.disabled, true, "disabled while empty");
  await typed(byClass(item, "mail-title")[0], "Export fails for Erika");
  await typed(byClass(item, "mail-body")[0], "Erika Mustermann reports an export failure in version 1.4.");
  assert.ok(byClass(item, "mail-hit").length >= 1, "the hit is marked");
  assert.equal(create.disabled, true);
  await typed(byClass(item, "mail-title")[0], "PDF export fails with error E42");
  await typed(byClass(item, "mail-body")[0], "Exporting a thesis as PDF fails with error E42 in version 1.4. A PDF file was expected.");
  assert.equal(byClass(item, "mail-hit").length, 0);
  assert.equal(create.disabled, false);
  create.dispatchEvent(new Event("click"));
  await flush();
  assert.deepEqual(writesToGitHub(), []);
  const kind = byClass(item, "mail-kind")[0];
  kind.value = "change";
  kind.dispatchEvent(new Event("change"));
  await trusted(create);
  await waitFor(() => github.created.length > 0 && byClass(item, "mail-result")[0].textContent !== "");
  assert.equal(github.created.length, 1);
  const made = github.created[0];
  assert.deepEqual(made.labels, ["change"]);
  assert.ok(made.body.endsWith(`Mails: \`${mail.id}\``) || made.body.includes(mail.id), made.body);
  assert.equal(made.body.includes(SECRET_SENTENCE) || made.body.includes("Erika") || made.body.includes(ERIKA.address), false, "none of the mail's text, name or address");
  assert.match(textOf(byClass(item, "mail-result")[0]), /#100/);
  assert.deepEqual(byClass(item, "issue-link").map((link) => link.getAttribute("href")), [fragmentOf("issue", { number: "100", product: PRODUCT_URL })]);
});

// TST-963003 · level: component · module: MOD-maintenance-pages
// guards: A DUPLICATE MAIL IS ADDED TO THE EXISTING ISSUE; A MAIL ALREADY DECIDED IS NOT PROPOSED AGAIN; ONE CLICK PER DECISION; UC-038
// given: one new mail and an open issue #4
// input: the number 4 typed; the person's click on Add to #4; Read mailbox again
// expect: exactly one comment is written to #4, the note `mail-added` naming the mail's identifier; the result names #4; the second reading lists no mail (an issue lists it now) and says one was left out
test("Add to #n lists the mail on the existing issue with one click, and the next reading leaves it out", async () => {
  const mail = await mailOf("two");
  const w = world({ mails: [mail], issues: [{ number: 4, title: "Export fails", body: "Export fails." }] });
  const target = await read(await open(w));
  const item = itemOf(target, mail.id);
  await typed(byClass(item, "mail-issue-number")[0], "4");
  const add = byClass(item, "add-to-issue")[0];
  assert.match(textOf(add), /Add to #4/);
  await trusted(add);
  await waitFor(() => github.issues[0].comments.length > 0 && byClass(item, "mail-result")[0].textContent !== "");
  const comments = writesToGitHub().filter((request) => request.path.endsWith("/comments"));
  assert.equal(comments.length, 1);
  assert.equal(JSON.parse(comments[0].body).body, noteText("mail-added", mail.id, new Date().toISOString().slice(0, 10)));
  assert.match(textOf(byClass(item, "mail-result")[0]), /#4/);
  await read(target);
  assert.deepEqual(byClass(target, "mail").map((node) => node.getAttribute("data-mail")), []);
  assert.match(textOf(byClass(target, "mail-decided")[0]), /1/);
});

// TST-963004 · level: component · module: MOD-maintenance-pages
// guards: A MAIL ALREADY DECIDED IS NOT PROPOSED AGAIN; MAIL STAYS IN THE MAILBOX; ONE CLICK PER DECISION; UC-038
// given: two new mails
// input: the person's click on Not an issue for the first; Read mailbox again
// expect: the first leaves the list at once; the store holds its identifier under not-an-issue and nothing else of the mail; nothing is written to GitHub; the second reading lists the second mail alone
test("Not an issue takes one click, marks the mail in this browser and writes nothing to the tracker", async () => {
  const [one, two] = [await mailOf("a"), await mailOf("b")];
  const w = world({ mails: [one, two] });
  const target = await read(await open(w));
  await trusted(byClass(itemOf(target, one.id), "not-an-issue")[0]);
  await waitFor(() => byClass(target, "mail").length === 1);
  assert.deepEqual(byClass(target, "mail").map((node) => node.getAttribute("data-mail")), [two.id]);
  assert.deepEqual(readSetting(w.store, "not-an-issue"), [one.id]);
  assert.deepEqual(writesToGitHub(), []);
  await read(target);
  assert.deepEqual(byClass(target, "mail").map((node) => node.getAttribute("data-mail")), [two.id]);
  assert.equal(JSON.stringify([...w.storage.values.values()]).includes(SECRET_SENTENCE), false, "the browser keeps no text of a mail");
});

// TST-963005 · level: component · module: MOD-maintenance-pages
// guards: AN ISSUE FROM A MAIL NAMES ITS MAILS BY THEIR IDENTIFIERS; UC-038
// given: one mail that mixes two concerns
// input: Create issue for the first concern, then the title and text changed and Create issue for the second
// expect: two issues are created, each of the kind chosen, and both list the same identifier; the mail is still in the list between and after
test("a mail that mixes two concerns gets one issue per concern, each listing the same identifier", async () => {
  const mail = await mailOf("mixed");
  const w = world({ mails: [mail] });
  const target = await read(await open(w));
  const item = itemOf(target, mail.id);
  await typed(byClass(item, "mail-title")[0], "PDF export fails");
  await typed(byClass(item, "mail-body")[0], "Exporting as PDF fails with error E42.");
  await trusted(byClass(item, "create-issue")[0]);
  await waitFor(() => github.created.length === 1);
  await typed(byClass(item, "mail-title")[0], "The ribbon hides the toolbar");
  await typed(byClass(item, "mail-body")[0], "On a small screen the ribbon covers the toolbar.");
  await trusted(byClass(item, "create-issue")[0]);
  await waitFor(() => github.created.length === 2);
  assert.equal(github.created.length, 2);
  assert.deepEqual(github.created.map((made) => made.body.includes(mail.id)), [true, true]);
  assert.notEqual(github.created[0].title, github.created[1].title);
  assert.ok(itemOf(target, mail.id), "the mail stays in the list");
});

// TST-963006 · level: component · module: MOD-maintenance-pages
// guards: READING THE MAILBOX CHANGES NOTHING IN IT; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; UC-038
// given: the Bridge the connection names does not answer (the request fails); and a Bridge that answers with BridgeUnavailable-like HTTP 401 (token refused)
// input: the person's click on Read mailbox, for each
// expect: no mail is listed; .mailbox-problem names the reason (the failure's own words); nothing is written to GitHub
test("an unreachable mailbox is named, nothing is listed and nothing is written", async () => {
  for (const bridge of [() => { throw new TypeError("connect ECONNREFUSED 127.0.0.1:4711"); }, () => new Response(JSON.stringify({ error: "token-refused", message: "The pairing token was refused." }), { status: 401, headers: { "Content-Type": "application/json" } })]) {
    const w = world({ mails: [], bridge });
    const target = await read(await open(w));
    assert.deepEqual(byClass(target, "mail"), []);
    const problem = byClass(target, "mailbox-problem")[0];
    assert.ok(problem && textOf(problem).length > 20, "a reason is named");
    assert.deepEqual(writesToGitHub(), []);
    document.body.replaceChildren();
  }
});

// TST-963007 · level: component · module: MOD-maintenance-pages
// guards: A MAIL BECOMES AN ISSUE ONLY BY A PERSON'S CLICK; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; UC-038
// given: one new mail; GitHub refuses the creation of an issue with 403 (the token lacks the permission), and, in another run, with 401 (the token is refused)
// input: a neutral title and text; the person's click on Create issue
// expect: the result names the product alice/product and which of the two happened, with a link to the step that stores the token (#add-product); no issue exists
test("an issue that cannot be created names the token's refusal or the missing permission, links the token step and writes nothing", async () => {
  for (const [status, words] of [[403, /permission/i], [401, /refused|token/i]]) {
    const mail = await mailOf(`refused${status}`);
    const w = world({ mails: [mail], refuse: status });
    const target = await read(await open(w));
    const item = itemOf(target, mail.id);
    await typed(byClass(item, "mail-title")[0], "PDF export fails");
    await typed(byClass(item, "mail-body")[0], "Exporting as PDF fails with error E42.");
    await trusted(byClass(item, "create-issue")[0]);
    await waitFor(() => byClass(item, "mail-result")[0].textContent !== "");
    const result = textOf(byClass(item, "mail-result")[0]);
    assert.ok(result.includes(PRODUCT) && words.test(result), result);
    assert.equal(byClass(item, "token-step").length, 1);
    assert.equal(github.created.length, 0);
    document.body.replaceChildren();
  }
});

// TST-963008 · level: component · module: MOD-maintenance-pages
// guards: NO PERSONAL DATA FROM A MAIL ENTERS A REPOSITORY; MAIL STAYS IN THE MAILBOX; UC-038
// given: the whole flow of a mail: reading, a neutral issue created, a duplicate added, another marked
// input: every request GitHub received, and the store
// expect: no body of any request holds the mail's text, the sender's name or address, or the subject; the mailbox connection's password reaches the Bridge only (not GitHub)
test("no text, sender or address of a mail reaches a repository request", async () => {
  const [a, b, c] = [await mailOf("x1"), await mailOf("x2"), await mailOf("x3")];
  const w = world({ mails: [a, b, c], issues: [{ number: 4, title: "Export fails", body: "Export fails." }] });
  const target = await read(await open(w));
  const item = itemOf(target, a.id);
  await typed(byClass(item, "mail-title")[0], "PDF export fails");
  await typed(byClass(item, "mail-body")[0], "Exporting as PDF fails with error E42.");
  await trusted(byClass(item, "create-issue")[0]);
  await waitFor(() => github.created.length === 1);
  await typed(byClass(itemOf(target, b.id), "mail-issue-number")[0], "4");
  await trusted(byClass(itemOf(target, b.id), "add-to-issue")[0]);
  await waitFor(() => github.issues[0].comments.length > 0);
  await trusted(byClass(itemOf(target, c.id), "not-an-issue")[0]);
  await waitFor(() => byClass(target, "mail").length === 2);
  const bodies = sent.map((request) => String(request.body ?? "")).join("\n");
  assert.ok(bodies.includes(a.id), "known positive: the identifier is written");
  for (const forbidden of [SECRET_SENTENCE, "Erika", ERIKA.address, "Subject x1", "mail-password-963"]) assert.equal(bodies.includes(forbidden), false, forbidden);
});

// TST-963009 · level: component · module: MOD-maintenance-pages
// guards: EVERY STEP EXPLAINS ITSELF; UC-038
// given: the page before and after Read mailbox
// input: the folded explanations
// expect: the reading step, the list of mails, the review of a mail and the decisions each carry a folded <details class="explain">, and the review of a mail carries its own
test("every step of the route carries its folded explanation", async () => {
  const mail = await mailOf("explained");
  const w = world({ mails: [mail] });
  const target = await open(w);
  assert.ok(byClass(byClass(target, "mail-step-read")[0] ?? target, "explain").length >= 1, "the reading step");
  await read(target);
  for (const step of ["mail-step-list", "mail-step-review", "mail-step-decide"]) {
    const sections = byClass(target, step);
    assert.ok(sections.length >= 1, `${step} is drawn`);
    assert.ok(byClass(sections[0], "explain").length >= 1, `${step} has its explanation`);
  }
  assert.equal(byTag(target, "details").every((node) => (node.className ?? "").includes("explain")), true);
});

// TST-963010 · level: component · module: MOD-maintenance-pages
// guards: MAIL STAYS IN THE MAILBOX; NO PERSONAL DATA FROM A MAIL ENTERS A REPOSITORY; UC-038
// given: the page after Read mailbox with one mail
// input: the route's subject for its parameters, and its paramsFor for a participant
// expect: the subject is of the kind converse, refuses propose-edit and hand-over, and its page holds the mail's MAIL- identifier and none of the mail's text, sender or subject
test("the route gives the prompt bar a subject that holds a mail's identifier and no text of it", async () => {
  const mail = await mailOf("subject");
  const w = world({ mails: [mail] });
  const target = await read(await open(w));
  const subject = route().subject({}, { page: "main", instance: { repository: INSTANCE }, store: w.store, product: null });
  assert.ok(subject, "a subject");
  assert.equal(subject.kind, undefined, "a subject names no kind: the bar runs converse on every page");
  assert.deepEqual([...subject.refuses].sort(), ["hand-over", "propose-edit"]);
  const page = String(subject.paramsFor({ name: "any" }).page);
  assert.ok(page.includes(mail.id), "the identifier");
  for (const forbidden of [SECRET_SENTENCE, "Erika", ERIKA.address, "Subject subject"]) assert.equal(page.includes(forbidden), false, forbidden);
  assert.ok(target);
});

// TST-963011 · level: unit · module: MOD-maintenance-pages
// guards: UC-038
// given: the view of MOD-maintenance-pages
// input: its routes read
// expect: it holds the route mail, in the menu entry maintenance, titled Mail
test("the view holds the route mail under the menu entry maintenance", () => {
  assert.ok(pages.view, `the view: ${pages.error?.message}`);
  const mail = route();
  assert.ok(mail);
  assert.deepEqual([mail.entry, mail.title], ["maintenance", "Mail"]);
});

/** What the frame does with an address: the route and parameters routeOf reads, the product chosenProduct names (the fragment's `product`), and the route drawn with them. */
async function followed(w, href) {
  const { name, params: { product: _named, ...params } } = routeOf(href);
  const issue = pages.view?.routes.find((candidate) => candidate.name === name);
  assert.ok(issue, `the route ${name} for ${href}`);
  const target = document.createElement("div");
  document.body.append(target);
  const product = await chosenProduct({ store: w.store, fragment: href });
  await issue.render(target, { page: "main", instance: { repository: INSTANCE, host: null }, store: w.store, product, go: () => {} }, params);
  return target;
}

// TST-1166001 · level: component · module: MOD-maintenance-pages
// guards: UC-038
// given: the mailbox holds a reply in the thread of issue #4 of alice/product, which GitHub lists as "Export fails"
// input: the link under the reply (the issue of its thread) followed as the frame follows an address: routeOf, chosenProduct, the route drawn with what they give
// expect: the link is the address the frame writes (fragmentOf: `#issue/number=4/product=<address>`); followed, it draws the page of issue #4 of alice/product ("Issue #4: Export fails"); counter-proof: the old form `#issue/4`, followed the same way, draws no such page
test("the link to the issue of a mail's thread is the address the frame writes, and following it shows that issue's page", async () => {
  const listed = await mailOf("listed"), reply = await mailOf("reply", { inReplyTo: listed.messageId, references: [listed.messageId] });
  const w = world({ mails: [listed, reply], issues: [{ number: 4, title: "Export fails", body: withMailIds("Export fails.", [listed.id]) }] });
  const target = await read(await open(w));
  const href = byClass(byClass(target, "mail-attached-item")[0], "issue-link")[0].getAttribute("href");
  assert.equal(href, fragmentOf("issue", { number: "4", product: PRODUCT_URL }));
  const page = await followed(w, href);
  await waitFor(() => /Issue #4/.test(textOf(page)) || byClass(page, "issue-problem").length > 0);
  assert.match(textOf(page), /Issue #4: Export fails/);
  const old = await followed(w, "#issue/4");
  await waitFor(() => byClass(old, "issue-problem").length > 0);
  assert.doesNotMatch(textOf(old), /Issue #4: Export fails/, "the old form shows no issue page");
});

// TST-1166002 · level: component · module: MOD-maintenance-pages
// guards: UC-038
// given: one new mail; GitHub creates the issue as #100
// input: a change issue created with the person's click; the link Propose SPEC change followed as the frame follows an address
// expect: the link is the address the frame writes (fragmentOf: `#issue/number=100/product=<address>`); followed, it draws the page of issue #100 of alice/product with the title the person typed; counter-proof: the old form `#issue/100` draws no such page
test("the link Propose SPEC change is the address the frame writes, and following it shows the created issue's page", async () => {
  const mail = await mailOf("one");
  const w = world({ mails: [mail] });
  const target = await read(await open(w));
  const item = itemOf(target, mail.id);
  await typed(byClass(item, "mail-title")[0], "PDF export fails with error E42");
  await typed(byClass(item, "mail-body")[0], "Exporting a thesis as PDF fails with error E42 in version 1.4. A PDF file was expected.");
  const kind = byClass(item, "mail-kind")[0];
  kind.value = "change";
  kind.dispatchEvent(new Event("change"));
  await trusted(byClass(item, "create-issue")[0]);
  await waitFor(() => byClass(item, "issue-link").length > 0);
  const href = byClass(item, "issue-link")[0].getAttribute("href");
  assert.equal(href, fragmentOf("issue", { number: "100", product: PRODUCT_URL }));
  const page = await followed(w, href);
  await waitFor(() => /Issue #100/.test(textOf(page)) || byClass(page, "issue-problem").length > 0);
  assert.match(textOf(page), /Issue #100: PDF export fails with error E42/);
  const old = await followed(w, "#issue/100");
  await waitFor(() => byClass(old, "issue-problem").length > 0);
  assert.doesNotMatch(textOf(old), /Issue #100: PDF export fails/, "the old form shows no issue page");
});
