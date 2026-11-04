// Release tests of the dashboard's hub chain, driven like a person. Written by a participant who implemented nothing of what
// they test, from the use cases and the SPEC alone.
//
// Module: MOD-site-frame
// Guards: UC-008; UC-024; UC-042; AN EDITED FILE KEEPS ITS IDENTIFIER; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A USED-UP RATE LIMIT IS NAMED, NOT BLAMED ON THE TOKEN; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; NO TEXT TRAVELS IN A URL; EVERY ARTIFACT NAMES ITS ORIGIN; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; EVERY SETTING IS REACHED FROM ONE PAGE; A CLEAR IS A REAL CLEAR; SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS
// Level: release
//
// The real dashboard (src/site-frame/dashboard-app.mjs) runs in tests/app-harness.mjs against fake GitHub and GitLab servers; no
// request leaves the process. Every case names, above it, the use-case flow or the SPEC rule it was written from, and its
// expected result before it runs (SOFTWARE_MAINTENANCE.md §4.0a rule 1). A case that fails is a finding: it stays here marked
// { todo } with the item it sends back to Development.
//
// What this file adds to the harness, for what a browser does and the harness does not show by itself:
//  - every module the page imports below docs/assets/ is recorded (a resolve hook of node:module), so that a page load's
//    requests for files are seen as a browser's would be — the views are loaded by import(), not by fetch;
//  - a reload keeps this browser's localStorage: the next page load starts with the entries the last one left (reload());
//  - elements reached by id keep the listeners a view adds (live(), as in tests/release-sprint-01-dashboard-app.test.mjs);
//    confirm, the clipboard, window.open and a file chosen for import are stand-ins that record what the page asked of them.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { resolveObjectURL } from "node:buffer";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import { repoServer, openDashboard, press, TOKEN, APP_FILE } from "./app-harness.mjs";

const API = "https://api.github.com";
const INSTANCE = "akmaier/agent-m";
const GL_ORIGIN = "https://gitlab.example.org", GL_PROJECT = "team/proj", GL_ADDRESS = `${GL_ORIGIN}/${GL_PROJECT}`;
const GL_TOKEN = "glpat-STRANDA0123456789abcdef";
const NEW_TOKEN = "github_pat_STRANDANEW0123456789abcdefgh";
const ROOT = fileURLToPath(new URL("../", import.meta.url));
const ASSETS = new URL("../docs/assets/", import.meta.url).href;

// ---------------------------------------------------------------- the files a page load asks for

// Every module the page asks for below docs/assets/, in the order asked — the dashboard's views and settings sections are
// imported by name, each one a request to the Pages site in a browser. Recorded before node resolves it, so that a file that is
// not there is recorded too.
const asked = [];
registerHooks({
  resolve(specifier, context, next) {
    let url = null;
    try { url = new URL(specifier, context.parentURL).href; } catch { url = null; }
    if (url && url.startsWith(ASSETS)) asked.push(url.split(/[?#]/)[0]);
    return next(specifier, context);
  },
});
const missing = (urls) => [...new Set(urls)].filter((u) => !fs.existsSync(fileURLToPath(u))).map((u) => u.slice(ASSETS.length));

// ---------------------------------------------------------------- an oracle of this file's own

const blobSha = (t) => createHash("sha1").update(`blob ${Buffer.byteLength(t)}\0`).update(t).digest("hex");
const isoDay = (d) => d.toISOString().slice(0, 10);
const today = () => isoDay(new Date());
const unescape = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
const header = (h, name) => Object.entries(h || {}).find(([k]) => k.toLowerCase() === name)?.[1] ?? null;
const stripTags = (html) => unescape(String(html).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");
const hrefs = (html) => [...String(html).matchAll(/href="([^"]*)"/g)].map((m) => unescape(m[1]));

// ---------------------------------------------------------------- fixtures: an instance with use cases and architecture

const useCase = (id, title, line = "The reader opens the report.") => `---
id: ${id}
title: ${title}
area: test
actors:
  - Reader
realises:
  - RULE ONE
---
# ${id} ${title}

**Goal.** The reader gets the report.

## Actors

- **Reader** — reads reports.

## Precondition

- A report exists.

## Main flow

1. ${line}

\`\`\`mermaid
sequenceDiagram
    actor R as Reader
    R->>R: read the report ${id}
\`\`\`

## Alternative flows

- **1a. No report.** The reader is told so.

## Postcondition

- The reader has read the report.
`;
const ucRecord = (p, text) => `kind: use-case\nfile: ${p}\nblob: ${blobSha(text)}\n`;

const ARC1 = "docs/architecture/ARC-001-static-client.md", MODR = "docs/architecture/MOD-reader.md";
const ARC1_TEXT = `---
id: ARC-001
title: The dashboard is a static client of the Git server's API
forced_by:
  - RULE ONE
  - UC-001
---
# ARC-001 The dashboard is a static client of the Git server's API

## Context

The product has no server of its own.

## Decision

The page reads and writes through the Git server's API.

## Alternatives

- A small server of our own — rejected: it would have to be operated.

## Consequences

Every write is a commit made with the person's own token.
`;
const MODR_TEXT = `---
id: MOD-reader
title: Reads files at a pinned commit
realises:
  - RULE ONE
  - UC-001
follows:
  - ARC-001
uses:
provides:
  - readFile
---
# MOD-reader Reads files at a pinned commit

## Responsibility

Reads the product's files, all at one commit.

## Interfaces

- \`readFile(path) -> text | null\` — the exact text of one file at the pinned commit.
`;

const SPEC = `# Test product — Specification

**VERBINDLICH (SPEC)**

## 1. Rules

**RULE ONE** *(PO, 2026-01-01)*
Rule one holds.
*Occasion:* a test.
*Check:* no automatic check; at review.

## 2. More

**RULE TWO** *(PO, 2026-01-01)*
Rule two holds as first written.
*Occasion:* a test.
*Check:* no automatic check; at review.
`;
const Q = "docs/spec-freigaben/2026-01-01a_wording";
const PROPOSAL = `## 2. More

**RULE TWO** *(PO, 2026-01-01, reworded 2026-01-02)*
Rule two holds in its PROPOSED-WORDING.
*Occasion:* a test.
*Check:* no automatic check; at review.
`;

const UC1 = "docs/use-cases/UC-001-read-a-report.md", UC2 = "docs/use-cases/UC-002-file-a-report.md", UC3 = "docs/use-cases/UC-003-sign-a-report.md";
const UC3_ACCEPTED = useCase("UC-003", "Sign a report", "The reader signs the report as accepted.");
const UC3_NOW = useCase("UC-003", "Sign a report", "The reader signs the report as CHANGED-SINCE.");
function instanceFiles(extra = {}) {
  const uc2 = useCase("UC-002", "File a report");
  return {
    "SPEC.md": SPEC,
    [UC1]: useCase("UC-001", "Read a report"),
    [UC2]: uc2,
    [UC3]: UC3_NOW,
    [ARC1]: ARC1_TEXT,
    [MODR]: MODR_TEXT,
    [`docs/approvals/UC-002-${blobSha(uc2).slice(0, 12)}.md`]: ucRecord(UC2, uc2),
    [`docs/approvals/UC-003-${blobSha(UC3_ACCEPTED).slice(0, 12)}.md`]: ucRecord(UC3, UC3_ACCEPTED),
    [`${Q}/index.md`]: "# SPEC approvals — queue 2026-01-01a · wording\n\n**Zieldatei aller Einträge:** `SPEC.md`\n\n" +
      "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |\n|---|---|---|---|---|\n" +
      "| 01 | `SPEC.md` | ## 2. More | — | — |\n",
    [`${Q}/entscheidungen.md`]: "# Decisions — queue 2026-01-01a · wording\n\nAppend-only.\n",
    [`${Q}/01-rule-two.md`]: PROPOSAL,
    [`${Q}/01-rule-two.begruendung.md`]: "# Rationale\n\nThe RATIONALE-TEXT of the change.\n",
    ...extra,
  };
}

// A GitLab project on its own server: the REST API v4 the dashboard reads and writes, its project token, and every request.
// refuseWrite: the server refuses the commit — as GitLab does for a Developer on a protected default branch.
function gitlabServer({ files = instanceFiles(), visibility = "public", accessLevel = 40, refuseToken = false, refuseWrite = false } = {}) {
  const s = { files: { ...files }, head: "a".repeat(40), seq: 0, writes: [], requests: [], refuseToken, refuseWrite };
  const base = `/api/v4/projects/${encodeURIComponent(GL_PROJECT)}`;
  const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
  s.fetch = async (u, init = {}) => {
    const method = (init.method || "GET").toUpperCase(), tok = header(init.headers, "private-token");
    s.requests.push({ method, url: u.href, token: tok, auth: header(init.headers, "authorization") });
    if (!u.pathname.startsWith(base)) return json({ message: "404 Not Found" }, 404);
    if (tok && (s.refuseToken || tok !== GL_TOKEN)) return json({ message: "401 Unauthorized" }, 401);
    const authed = tok === GL_TOKEN;
    if (visibility !== "public" && !authed) return json({ message: "404 Project Not Found" }, 404);
    const rest = u.pathname.slice(base.length);
    if (method === "GET" && rest === "") {
      return json({ path_with_namespace: GL_PROJECT, default_branch: "main", visibility,
        permissions: { project_access: authed ? { access_level: accessLevel } : null, group_access: null } });
    }
    if (method === "GET" && rest.startsWith("/repository/commits/")) return json({ id: s.head });
    if (method === "GET" && rest === "/repository/commits") return json([]);
    if (method === "GET" && rest === "/repository/tree") {
      return json(u.searchParams.get("page") === "1" ? Object.keys(s.files).sort().map((p) => ({ type: "blob", path: p, id: blobSha(s.files[p]) })) : []);
    }
    if (method === "GET" && rest.startsWith("/repository/branches/")) return json({ commit: { id: s.head } });
    const blob = /^\/repository\/blobs\/([0-9a-f]{40})\/raw$/.exec(rest);
    if (method === "GET" && blob) {
      const p = Object.keys(s.files).find((x) => blobSha(s.files[x]) === blob[1]);
      return p ? new Response(s.files[p]) : json({ message: "404 Blob Not Found" }, 404);
    }
    const raw = /^\/repository\/files\/([^/]+)\/raw$/.exec(rest);
    if (method === "GET" && raw) { const p = decodeURIComponent(raw[1]); return p in s.files ? new Response(s.files[p]) : json({ message: "404 File Not Found" }, 404); }
    const meta = /^\/repository\/files\/([^/]+)$/.exec(rest);
    if (method === "GET" && meta) { const p = decodeURIComponent(meta[1]); return p in s.files ? json({ file_path: p, blob_id: blobSha(s.files[p]) }) : json({ message: "404 File Not Found" }, 404); }
    if (method === "POST" && rest === "/repository/commits") {
      if (!authed || s.refuseWrite) return json({ message: "403 Forbidden" }, 403);
      const body = JSON.parse(init.body), parent = s.head;
      for (const a of body.actions) s.files[a.file_path] = a.content;
      s.head = String(++s.seq).padStart(40, "b");
      s.writes.push({ message: body.commit_message, files: Object.fromEntries(body.actions.map((a) => [a.file_path, a.content])) });
      return json({ id: s.head, web_url: `${GL_ADDRESS}/-/commit/${s.head}`, parent_ids: [parent] });
    }
    return json({ message: "404 Not Found" }, 404);
  };
  return s;
}

// ---------------------------------------------------------------- the world of one test: servers, a page, a person's hands

// Every request the page makes, with the credentials it carries. refuse: a server's own answer to some requests.
async function world({ files = instanceFiles(), history = [UC3_ACCEPTED], dates = {}, gitlab = null, refuse = null } = {}) {
  const log = [];
  let server;
  const handlers = [
    (u, init) => { log.push({ method: init.method, url: u.href, origin: u.origin, path: u.pathname, auth: header(init.headers, "authorization"),
      privateToken: header(init.headers, "private-token") }); return undefined; },
    (u, init) => (refuse ? refuse(u, init) : undefined),
    (u, init) => (gitlab && u.origin === GL_ORIGIN ? gitlab.fetch(u, init) : undefined),
    // The contents API as JSON (a file's blob SHA), which a write asks for to see whether the file changed since it was opened.
    (u, init) => {
      const m = new RegExp(`^/repos/${INSTANCE}/contents/(.+)$`).exec(u.pathname);
      if (!m || u.origin !== API || init.method !== "GET" || header(init.headers, "accept") !== "application/vnd.github+json") return undefined;
      const p = m[1].split("/").map(decodeURIComponent).join("/");
      return server.shas[p] ? new Response(JSON.stringify({ path: p, sha: server.shas[p] }), { status: 200 })
        : new Response('{"message":"Not Found"}', { status: 404 });
    },
  ];
  server = await repoServer({ files, history, dates, handlers });
  return { server, log, gitlab };
}

async function settle(server) {
  let idle = 0, seen = server.requests.length;
  while (idle < 40) {
    await new Promise((r) => setTimeout(r, 0));
    if (server.pending === 0 && server.requests.length === seen) idle += 1;
    else { idle = 0; seen = server.requests.length; }
  }
}
async function until(f, what, ms = 8000) {
  const end = Date.now() + ms;
  while (!f()) { if (Date.now() > end) throw new Error(`waited in vain for ${what}`); await new Promise((r) => setTimeout(r, 10)); }
}

// A page load; then the person's hands. entries: what this browser's localStorage holds before the page loads — a reload starts
// with the entries the page before it left (reload()). The harness gives every page load a new localStorage with the token
// only; the entries are put into it before the app is imported, as a browser's storage is there before the page runs.
// direct: the page is loaded at `hash` itself, as a browser opens an address (nothing is clicked on such a page); otherwise it
// is loaded at the start page and goes to `hash`, so that the hands below reach what the view wires.
async function open(w, { hash = "", token = TOKEN, search = "", entries = null, direct = false } = {}) {
  const shown = { confirm: [], clipboard: [], opened: [], downloads: [] };
  globalThis.confirm = (text) => { shown.confirm.push(text); return true; };
  Object.defineProperty(globalThis, "navigator", { value: { clipboard: { writeText: async (t) => { shown.clipboard.push(t); } } }, configurable: true, writable: true });
  globalThis.open = (url) => { shown.opened.push(url); return null; };
  const define = Object.defineProperty;
  if (entries) {
    Object.defineProperty = function (o, k, d) {
      if (o === globalThis && k === "localStorage" && d && d.value) for (const [key, v] of Object.entries(entries)) d.value.setItem(key, v);
      return define.call(Object, o, k, d);
    };
  }
  const from = asked.length;
  let page;
  try {
    page = await openDashboard({ server: w.server, token: entries ? null : token, search, hash: direct ? hash : "" });
  } finally {
    Object.defineProperty = define;
  }
  live(shown);
  if (hash && !direct) await page.go(hash);
  const doc = globalThis.document;
  return Object.assign(page, {
    shown,
    asked: () => asked.slice(from),
    byId: (id) => doc.getElementById(id),
    html: (id) => doc.getElementById(id).innerHTML,
    text: (id) => `${doc.getElementById(id).textContent} ${stripTags(doc.getElementById(id).innerHTML)}`.trim(),
    async fire(id, type = "click", ev = { isTrusted: true }) {
      await doc.getElementById(id).fire(type, ev);
      await settle(w.server);
    },
    async tick(id) { doc.getElementById(id).checked = true; await this.fire(id, "change"); },
    async type(id, value) { doc.getElementById(id).value = value; await this.fire(id, "input"); },
    async press(id, selector, type = "click", ev = { isTrusted: true }) {
      const c = doc.getElementById(id).querySelector(selector);
      if (!c) throw new Error(`nothing in #${id} matches ${selector}`);
      c.fire(type, ev);
      await settle(w.server);
      return c;
    },
    editor: () => doc.getElementById("main")._editor,
    storage: () => Object.fromEntries(Array.from({ length: localStorage.length }, (_, i) => [localStorage.key(i), localStorage.getItem(localStorage.key(i))])),
  });
}
// The same browser, the page loaded again: localStorage as the last page left it, nothing else.
const reload = (w, page, opts = {}) => open(w, { ...opts, entries: page.storage() });

// The selected migration replaces the former dashboard-owned Add form with MOD-settings-pages' public add-product route.
// Drive its real controls: address, acknowledgement, project token and Store and check — no compatibility ids.
async function storeGitLabProductToken(w, page, address = GL_ADDRESS, { add = false } = {}) {
  const main = page.byId("main"), addressInput = main.querySelector("input.address");
  assert.ok(addressInput, "the public add-product route exposes its address field");
  addressInput.value = address;
  await addressInput.fire("input");
  const ack = main.querySelector("input.ack"), token = main.querySelector("input.token"), store = main.querySelector("button.store");
  assert.ok(ack && token && store, "the public GitLab route exposes acknowledgement, token and Store and check");
  ack.checked = true;
  await ack.fire("change");
  token.value = GL_TOKEN;
  await store.fire("click", { isTrusted: true });
  await settle(w.server);
  if (add) {
    const addProduct = main.querySelector("button.add");
    assert.ok(addProduct && !addProduct.disabled, "the stored project token enables the public Add product decision");
    await addProduct.fire("click", { isTrusted: true });
    await settle(w.server);
  }
}

// Elements reached by id keep their listeners, and are new elements once their container is written again; their value,
// checked, disabled and hidden start as their tag says. The <main> element reaches its editor panel, as in a browser.
function live(shown) {
  const doc = globalThis.document, byId = doc.getElementById.bind(doc);
  const tagOf = (html, id) => new RegExp(`<[a-z]+\\b[^>]*\\sid="${id}"[^>]*>`).exec(html)?.[0] ?? "";
  const attr = (tag, name) => { const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag); return m ? unescape(m[1]) : null; };
  function reset(el, tag) {
    el._listeners = [];
    el.value = attr(tag, "value") ?? "";
    el.checked = /\schecked\b/.test(tag);
    el.disabled = /\sdisabled\b/.test(tag);
    el.hidden = /\shidden\b/.test(tag);
    el.files = [];
  }
  function refresh(html) { for (const m of String(html).matchAll(/\sid="([^"]+)"/g)) reset(adopt(byId(m[1])), tagOf(html, m[1])); }
  function adopt(el) {
    if (el._live) return el;
    el._live = true;
    el._listeners = [];
    el.addEventListener = (type, f) => el._listeners.push([type, f]);
    el.fire = (type, ev = {}) => Promise.all(el._listeners.filter(([t]) => t === type).map(([, f]) => f({ ...ev, currentTarget: el, target: el })));
    const d = Object.getOwnPropertyDescriptor(el, "innerHTML");
    Object.defineProperty(el, "innerHTML", { configurable: true, get: d.get, set(v) { d.set.call(el, v); refresh(v); } });
    const insert = el.insertAdjacentHTML.bind(el);
    el.insertAdjacentHTML = (where, x) => { insert(where, x); refresh(x); };
    if (el.id === "main") {
      const q = el.querySelector.bind(el);
      el.querySelector = (sel) => {
        if (sel !== ".panel.edit") return q(sel);
        const m = /<textarea[^>]*>([\s\S]*?)<\/textarea>/.exec(el.innerHTML);
        if (!m) return null;
        const part = () => ({ textContent: "", innerHTML: "", addEventListener() {} });
        const parts = { textarea: { value: unescape(m[1]), addEventListener() {} }, ".preview": part(), ".result": part(), ".edit-diff": part() };
        el._editor = { hidden: true, parts, querySelector: (s) => parts[s] ?? q(s) };
        return el._editor;
      };
    }
    return el;
  }
  doc.getElementById = (id) => adopt(byId(id));
  doc.createElement = ((make) => (tag) => { const e = make(tag); if (tag === "a") { e.click = () => shown.downloads.push({ href: e.href, name: e.download }); } return e; })(doc.createElement);
}

async function downloaded(page) {
  return Promise.all(page.shown.downloads.map(async (d) => ({ ...d, text: await resolveObjectURL(d.href).text() })));
}

// A write is a request that is not a GET, except the batch of reads: a POST to GitHub's /graphql, which answers with file texts and changes nothing.
const isBatchOfReads = (r) => r.method === "POST" && r.origin === API && r.path === "/graphql";
const writesOf = (w) => w.log.filter((r) => r.method !== "GET" && !isBatchOfReads(r));
// The pages are MOD-review-pages' routes (its Interfaces): controls found by their class, a file's editor on the route its Edit link
// leads to, and the result line a decision leaves in <main>.
const inMain = () => globalThis.document.getElementById("main");
const buttonNamed = (text) => inMain().querySelectorAll("button").find((button) => button.textContent === text);
async function openEditor(page, hash) {
  await page.go(hash);
  const edit = inMain().querySelector("a.edit-link");
  assert.ok(edit, `${hash}: the page offers Edit`);
  await page.go(edit.href);
  return { area: inMain().querySelector("textarea"), save: () => buttonNamed("Save"), result: () => inMain().querySelector(".result")?.textContent ?? "" };
}
// What the page says of a decision: the text and the HTML that follow the Accept button in <main> (the refusal and GitHub's path).
const resultOf = () => {
  const html = inMain().innerHTML, rest = html.slice(Math.max(0, html.lastIndexOf('<button class="btn accept"')));
  return { text: stripTags(rest), html: rest };
};

// ================================================================ ITM-126 — AN EDITED FILE KEEPS ITS IDENTIFIER
//
// SPEC §10: "Saving is refused for a use case, architecture element, module or test whose identifier differs from the one it was
// opened with." The refusal is MOD-artifact-edits' and the sentence the dashboard's; the finding of a drafted change that
// carries another identifier is tested in tests/release-sprint-02-a-artifacts.test.mjs. Tests are not edited on the dashboard (no view of today shows one).

const ucText = (w, p) => w.server.files[p];
const withId = (text, from, to) => text.replace(`id: ${from}\n`, to === null ? "" : `id: ${to}\n`);

// AN EDITED FILE KEEPS ITS IDENTIFIER (UC-008 3a, the editor of a use case) — Expected: the reviewer opens UC-001, changes the
// `id:` of its front matter to UC-009 — or deletes the line — and presses Save: nothing is written, the file on the branch is
// the text it was, and the page says that nothing was saved, naming UC-001, the identifier it was opened with, and UC-009.
// Known positive first: the same edit with the identifier kept is saved.
test("release · ITM-126 AN EDITED FILE KEEPS ITS IDENTIFIER: a use case saved under another identifier is refused, nothing is written", async () => {
  const kept = await world();
  const ok = await open(kept);
  const kept1 = await openEditor(ok, "#uc/UC-001");
  kept1.area.value = ucText(kept, UC1).replace("opens the report.", "opens the report, KEPT-ID.");
  await press(kept.server, kept1.save());
  assert.equal(kept.server.writes.length, 1, "known positive: an edit that keeps the identifier is saved");

  for (const to of ["UC-009", null]) {
    const w = await world();
    const page = await open(w);
    const before = ucText(w, UC1);
    const ed = await openEditor(page, "#uc/UC-001");
    ed.area.value = withId(before, "UC-001", to).replace("opens the report.", "opens the report, RENUMBERED.");
    await press(w.server, ed.save());
    assert.deepEqual(writesOf(w), [], `${to}: nothing is written`);
    assert.equal(ucText(w, UC1), before, `${to}: the file on the branch is unchanged`);
    const said = ed.result();
    assert.match(said, /nothing was saved|not saved|Save is disabled/i, `${to}: ${said}`);
    assert.match(said, /UC-001/, `${to}: names the identifier it was opened with`);
    if (to) assert.match(said, /UC-009/, "names the identifier the text carries now");
  }
});

// AN EDITED FILE KEEPS ITS IDENTIFIER — "architecture element, module": the editor of an architecture decision and of a module
// (UC-023's files on the Architecture tab). Expected: ARC-001 saved as ARC-009 and MOD-reader saved as MOD-writer are refused,
// nothing is written, and the page names both identifiers; known positive: MOD-reader saved with its identifier is written.
test("release · ITM-126 AN EDITED FILE KEEPS ITS IDENTIFIER: a decision and a module saved under another identifier are refused", async () => {
  const kept = await world();
  const ok = await open(kept);
  const kept1 = await openEditor(ok, "#arc/MOD-reader");
  kept1.area.value = MODR_TEXT.replace("all at one commit.", "all at one commit, KEPT-ID.");
  await press(kept.server, kept1.save());
  assert.equal(kept.server.writes.length, 1, "known positive: a module saved with its identifier is written");

  for (const [hash, p, text, from, to] of [["#arc/ARC-001", ARC1, ARC1_TEXT, "ARC-001", "ARC-009"], ["#arc/MOD-reader", MODR, MODR_TEXT, "MOD-reader", "MOD-writer"]]) {
    const w = await world();
    const page = await open(w);
    const ed = await openEditor(page, hash);
    ed.area.value = withId(text, from, to);
    await press(w.server, ed.save());
    assert.deepEqual(writesOf(w), [], `${from}: nothing is written`);
    assert.equal(w.server.files[p], text, `${from}: unchanged on the branch`);
    const said = ed.result();
    assert.match(said, /nothing was saved|not saved|Save is disabled/i, `${from}: ${said}`);
    assert.match(said, new RegExp(from), `${from}: the identifier it was opened with`);
    assert.match(said, new RegExp(to), `${from}: the identifier the text carries now`);
  }
});
// ================================================================ ITM-129 — UC-024, the shell: views loaded by name
//
// ITM-129's outcome: "a page load requests only files that exist, and a view whose file is missing is still not shown"; and ITM-142:
// "a page load of every address requests no view or settings file that is not built; every tab and view of today is shown".
// The addresses of today are the routes of the shell's one table (DASHBOARD) and the detail addresses of the views built; which
// view is built is read here from the disk — the files under docs/assets/dashboard/ —, not from the shell's own list of them.

const { DASHBOARD } = await import(APP_FILE.href);
const { MENU } = await import("../src/site/menu.mjs");
const builtOnDisk = (file) => typeof file === "string" && fs.existsSync(path.join(ROOT, "docs/assets/dashboard", file));
const VIEWS = DASHBOARD.filter((v) => v.view);
const ADDRESSES = ["", ...VIEWS.map((v) => `#${v.view}`),
  "#uc/UC-001", "#uc/UC-003", "#arc/ARC-001", "#arc/MOD-reader", "#review/uc", "#review/arc", "#spec/2026-01-01a_wording/01"];

// UC-024 · ITM-129 — Expected: a page load at each address of today — the start page, every route of the table, the detail
// addresses of the views built — asks for no file below docs/assets/ that is not on the disk: no module, no settings section,
// no stylesheet. Known positive of the recorder: the load of #uc asks for the use-case views' file, which is there.
test("release · ITM-129 UC-024: a page load of every address asks for no file below docs/assets/ that is not there", async () => {
  const w = await world();
  const start = await open(w, { hash: "", direct: true });
  assert.ok(start.asked().some((u) => u.endsWith("/dashboard/built.json")), "known positive: the recorder sees the list of built files asked for");
  const notThere = {};
  for (const hash of ADDRESSES) {
    const page = await open(w, { hash, direct: true });
    const files = [...page.asked(), ...page.stylesheets().map((s) => String(s).split(/[?#]/)[0]).filter((s) => s.startsWith(ASSETS))];
    const gone = missing(files);
    if (gone.length) notThere[hash || "(start)"] = gone;
  }
  assert.deepEqual(notThere, {}, "files asked for that are not there, by address");
});

// UC-024 · ITM-129 — Expected: the menu links each stage of the process to the first of its views whose file is on the disk, in
// the order of the process (THE MENU FOLLOWS THE PROCESS), and no view whose file is not; each view of the table whose file is
// there, opened at its address, is shown — its page is not the use-case list the shell falls back to —; the public handed
// get-your-own route is likewise shown. The address of an
// unbuilt view shows the use-case list and asks for no file of that view.
test("release · ITM-129 UC-024: every menu entry and view of today is shown; a view whose file is not built is not", async () => {
  const w = await world();
  const page = await open(w, { hash: "#uc", direct: true });
  const tabs = [...page.el("tabs").matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
  const fileOf = (view) => VIEWS.find((v) => v.view === view)?.file;
  // A view is built where its file is on the disk, or where the app hands its address to a route of MOD-review-pages or to the fold
  // of the topic `accepting`, so that its file is gone.
  // The route progress of MOD-implementation-pages, which a loaded view provides, counts as built (ITM-1252), though views.mjs names a file for it.
  // The guided pages of MOD-settings-pages that the Settings page opens — participants, library, sources, resources — are handed to their routes too.
  const HANDED = new Set(["uc", "arc", "review", "spec", "how", "settings", "runs", "schedule", "generate", "release", "trace", "mail", "replies", "arrange", "process", "roles", "backlog", "progress", "get-your-own",
    "participants", "library", "sources", "resources"]);
  const builtView = (view) => HANDED.has(view) || builtOnDisk(fileOf(view));
  const expected = MENU.map((e) => e.views.find(builtView)).filter(Boolean);
  assert.deepEqual(tabs, expected, "the stages' views built, in the order of the process");
  assert.ok(expected.length >= 4, `the views of today: ${expected.join(", ")}`);
  const fallback = page.main();
  assert.match(fallback, /#use-case\/id=UC-001"/, "known positive: #uc is the use-case list");
  for (const v of VIEWS.filter((x) => x.view !== "uc")) {
    if (v.builtIn) {
      assert.ok(["add", "setup", "settings", "runs", "schedule", "generate", "release", "trace", "mail", "replies", "process", "roles", "backlog"].includes(v.view), "only the public settings-pages Add, Setup and Settings routes, the test pages' routes runs, schedule, generate and release, the trace pages' route trace, the maintenance pages' routes mail and replies and the implementation pages' routes process, roles and backlog have no dashboard file");
      const dispatched = fs.readFileSync(APP_FILE, "utf8");
      if (v.view === "add") assert.match(dispatched, /settingsPages\.routes\.find\(\(r\) => r\.name === "add-product"\)/, "#add dispatches the public route");
      else if (v.view === "settings") assert.match(dispatched, /settingsPages\.routes\.find\(\(r\) => r\.name === "settings"\)/, "#settings dispatches the public route");
      else if (v.view === "release") assert.match(dispatched, /testPages\.routes\.find\(\(r\) => r\.name === "release"\)/, "#release dispatches the public route");
      else if (v.view === "runs" || v.view === "schedule" || v.view === "generate") assert.match(dispatched, /kind === "runs" \|\| kind === "schedule" \|\| kind === "generate"\) \{\s*await renderProductRoute\(testPages, kind,/, `#${v.view} dispatches the test pages' public route`);
      else if (v.view === "trace") assert.match(dispatched, /renderProductRoute\(tracePages, "trace",/, "#trace dispatches the trace pages' public route");
      else if (v.view === "mail") assert.match(dispatched, /maintenancePages\.routes\.find\(\(r\) => r\.name === "mail"\)/, "#mail dispatches the maintenance pages' public route");
      else if (v.view === "replies") assert.match(dispatched, /maintenancePages\.routes\.find\(\(r\) => r\.name === "replies"\)/, "#replies dispatches the maintenance pages' public route");
      else if (v.view === "backlog") assert.match(dispatched, /implementationPages\.routes\.find\(\(r\) => r\.name === "backlog"\)/, "#backlog dispatches the implementation pages' public route");
      else if (v.view === "process" || v.view === "roles") assert.match(dispatched, /implementationPages\.routes\.find\(\(r\) => r\.name === kind\)/, `#${v.view} dispatches the implementation pages' public route`);
      else assert.match(dispatched, /settingsPages\.routes\.find\(\(r\) => r\.name === "setup"\)/, "#setup dispatches the public route");
      continue;
    }
    const there = builtView(v.view);
    const p = await open(w, { hash: v.view === "review" ? "#review/uc" : `#${v.view}`, direct: true });
    if (there) {
      assert.notEqual(p.main(), fallback, `#${v.view} shows its own view`);
      assert.ok(p.main().trim().length > 0, `#${v.view} shows something`);
    } else {
      assert.match(p.main(), /#use-case\/id=UC-001"/, `#${v.view}: not built — the use-case list is shown`);
      assert.ok(!p.asked().some((u) => u.endsWith(`/dashboard/${v.file}`)), `#${v.view}: its file is not asked for`);
    }
  }
});
// ================================================================ ITM-130 — the shells read only through what the repository hosts provide
//
// ITM-142: "no shell file reads past what the git host provides; the dashboard's reads behave as before". The dashboard reads
// through the hosts of MOD-repository-hosts, whose Parts make index.mjs the interface and every other file of its folder — the
// adapters, the request helper and the failures behind them — private to it; ARC-003 decision 6, "no module file but the
// adapters' calls fetch". A file belongs to a module by its `Module:` line (ARC-020). The kernel's half — no kernel file imports
// from a repository host — is in tests/release-sprint-02-a-review-core.test.mjs.

const CODE_DIR = path.join(ROOT, "docs/assets");
function codeFiles(dir = CODE_DIR) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "vendor" ? [] : codeFiles(p);
    return /\.(mjs|js)$/.test(e.name) ? [p] : [];
  });
}
const moduleOf = (file) => /(?:\/\/|#)\s*Module:\s*(MOD-[a-z0-9-]+)/.exec(fs.readFileSync(file, "utf8").split("\n").slice(0, 20).join("\n"))?.[1] ?? null;
const rel = (file) => path.relative(ROOT, file);
// The names a text imports from each file it imports: [{ from, names, namespace }]; `import * as x` is a namespace.
function importsOf(text) {
  const out = [];
  for (const m of text.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g)) {
    out.push({ from: m[2], names: m[1].split(",").map((s) => s.trim().split(/\s+as\s+/)[0]).filter(Boolean), namespace: null });
  }
  for (const m of text.matchAll(/import\s*\*\s*as\s+(\w+)\s+from\s*["']([^"']+)["']/g)) out.push({ from: m[2], names: [], namespace: m[1] });
  return out;
}
// The names a file uses of the files of `module`: named imports, and the members it takes of a namespace import.
function namesFrom(file, module) {
  const text = fs.readFileSync(file, "utf8"), out = [];
  for (const imp of importsOf(text)) {
    if (!imp.from.startsWith(".")) continue;
    const target = path.resolve(path.dirname(file), imp.from);
    if (!fs.existsSync(target) || moduleOf(target) !== module) continue;
    out.push(...imp.names);
    if (imp.namespace) out.push(...[...text.matchAll(new RegExp(`\\b${imp.namespace}\\.(\\w+)`, "g"))].map((m) => m[1]));
  }
  return out;
}
// The shell itself, src/site-frame/dashboard-app.mjs, and every file below docs/assets/ whose Module: line names it.
const SHELL_APP = path.join(ROOT, "src/site-frame/dashboard-app.mjs");
const SHELL_FILES = [...codeFiles(), SHELL_APP].filter((f) => moduleOf(f) === "MOD-dashboard-app");
// The files of MOD-repository-hosts that a file of the dashboard imports from, each with the names it takes: [{ file, names }],
// `file` relative to the module's folder.
const HOSTS_DIR = path.join(ROOT, "src/repository-hosts");
function hostFilesOf(file) {
  return importsOf(fs.readFileSync(file, "utf8")).filter((imp) => imp.from.startsWith("."))
    .map((imp) => ({ target: path.resolve(path.dirname(file), imp.from), names: imp.namespace ? ["*"] : imp.names }))
    .filter(({ target }) => fs.existsSync(target) && moduleOf(target) === "MOD-repository-hosts")
    .map(({ target, names }) => ({ file: path.relative(HOSTS_DIR, target), names }));
}

// ITM-130 · the request helper of the repository hosts is private to them — Expected: no file whose Module: line names
// MOD-dashboard-app imports a file of MOD-repository-hosts other than its interface, index.mjs — neither the request helper
// (`send` in failures.mjs) nor an adapter —, by name or as a namespace. Known positive of the reader: the shell's own import of
// connect from index.mjs is seen, and a planted import of the helper is seen as a file of the module.
test("release · ITM-130 EVERY ARTIFACT NAMES ITS ORIGIN: no file of the dashboard imports the repository hosts' request helper",
  () => {
    assert.ok(SHELL_FILES.includes(SHELL_APP), `the shell is read: ${SHELL_FILES.map(rel).join(", ")}`);
    assert.ok(hostFilesOf(SHELL_APP).some((i) => i.file === "index.mjs" && i.names.includes("connect")), "known positive: the shell's connect");
    const planted = path.join(ROOT, "src/site-frame/planted.mjs");
    assert.deepEqual(importsOf('import { send } from "../repository-hosts/failures.mjs";').map((imp) => moduleOf(path.resolve(path.dirname(planted), imp.from))),
      ["MOD-repository-hosts"], "known positive: the helper's file belongs to the module");
    const past = SHELL_FILES.flatMap((f) => hostFilesOf(f).filter((i) => i.file !== "index.mjs").map((i) => `${rel(f)}: ${i.file} ${i.names.join(", ")}`));
    assert.deepEqual(past, []);
  });

// ITM-130 · "no shell file reads past what the repository hosts provide" — Expected: every name a file of MOD-dashboard-app takes
// from MOD-repository-hosts is one its interface exports — parseAddress, connect, HostError —, and no namespace takes the whole
// module. Known positive: the shell takes connect and parseAddress.
test("release · ITM-130 EVERY ARTIFACT NAMES ITS ORIGIN: the dashboard reads through no name of the repository hosts that their interface does not provide",
  async () => {
    const provided = new Set(Object.keys(await import("../src/repository-hosts/index.mjs")));
    assert.ok(provided.has("connect") && provided.has("parseAddress"), "the interface is read");
    const taken = SHELL_FILES.flatMap((f) => hostFilesOf(f).flatMap((i) => i.names.map((n) => ({ f, n }))));
    assert.ok(taken.some(({ n }) => n === "connect") && taken.some(({ n }) => n === "parseAddress"), "known positive: the shell's names are read");
    assert.deepEqual(taken.filter(({ n }) => !provided.has(n)).map(({ f, n }) => `${rel(f)}: ${n}`), []);
  });

// ARC-003 decision 6 · ITM-130 — Expected: no file of MOD-dashboard-app calls fetch itself; every request goes through the
// adapters. Comments are not code. Known positive of the scan: a planted call in a code line is seen.
const codeOnly = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/(^|[^:"'`])\/\/.*$/, "$1")).join("\n");
const callsFetch = (t) => /(^|[^.\w])fetch\s*\(/m.test(codeOnly(t));
test("release · ITM-130 ARC-003: no file of the dashboard calls fetch itself", () => {
  assert.ok(callsFetch("const r = await fetch(url);") && !callsFetch("// fetch(url) in a comment") && !callsFetch("await fetchText(url)"), "known positive");
  assert.deepEqual(SHELL_FILES.filter((f) => callsFetch(fs.readFileSync(f, "utf8"))).map(rel), []);
});

// ITM-130 · UC-008 2a · MOD-approvals lastAcceptedText — the reads that left the kernel behave as before:
// the last accepted text of a changed use case is read by the blob SHA its record names and refused unless it hashes to that SHA.
// Expected: with the true text, the difference above UC-003 shows its accepted line against the current one; when the server
// answers that blob with another text, that text is shown nowhere on the page — not as the accepted text — and UC-003's own
// text is still shown.
test("release · ITM-130 UC-008 2a: the last accepted text is read by its blob and refused unless it hashes to that SHA", async () => {
  const honest = await world();
  const ok = await open(honest, { hash: "#uc/UC-003" });
  assert.match(stripTags(inMain().querySelector("section.accepted-diff")?.innerHTML ?? ""), /signs the report as accepted/, "known positive: the accepted text is read and shown");
  const sha = blobSha(UC3_ACCEPTED), forged = useCase("UC-003", "Sign a report", "The reader signs a FORGED-ACCEPTED-TEXT.");
  const w = await world({ refuse: (u) => (u.origin === API && u.pathname === `/repos/${INSTANCE}/git/blobs/${sha}`
    ? new Response(JSON.stringify({ sha, encoding: "base64", content: Buffer.from(forged).toString("base64") }), { status: 200 }) : undefined) });
  const page = await open(w, { hash: "#uc/UC-003" });
  assert.match(stripTags(inMain().querySelector("section.accepted-diff")?.innerHTML ?? ""), /signs the report as accepted/, "the text compared is the one the most recent record names");
  const everything = page.main();
  assert.doesNotMatch(everything, /FORGED-ACCEPTED-TEXT/, "the forged text is shown nowhere");
  assert.match(stripTags(page.main()), /CHANGED-SINCE/, "UC-003's own text is shown");
});
// ================================================================ ITM-133 — UC-008 4a, the GitHub path when the token cannot write
//
// UC-008 4a: "The reviewer has no write access. The commit is refused; the dashboard says so and offers the GitHub path, where
// the commit becomes a pull request that counts once a maintainer merges it." WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE
// FALLBACK: "accepting and editing open GitHub's web interface with the commit prepared as far as GitHub allows" — ITM-133
// offers the same route when the token cannot write, "as without a token" (its acceptance criteria). A fine-grained token that
// may read but not write is answered 403 on GitHub's write endpoints.

const noWrite = (status = 403, headers = {}) => (u, init) => (u.origin === API && init.method && init.method !== "GET" && u.pathname.startsWith(`/repos/${INSTANCE}/`)
  ? new Response(JSON.stringify({ message: status === 403 && !Object.keys(headers).length ? "Resource not accessible by personal access token" : "API rate limit exceeded" }),
    { status, headers: { "Content-Type": "application/json", ...headers } })
  : undefined);
const newFilePages = (html) => hrefs(html).filter((x) => x.startsWith(`https://github.com/${INSTANCE}/new/`));

// UC-008 4a · ITM-133 — Expected: the reviewer, whose token can read but not write, presses Accept on UC-001: nothing is
// written; the page says that the token cannot write to the repository and offers, as a link, GitHub's new-file page for
// docs/approvals/UC-001-<sha>.md prefilled with the three-line record that names the file and the blob SHA of the text shown —
// the page Accept opens without a token —, and says that there the commit becomes a pull request that counts once a
// maintainer merges it; no link carries the use case's text (NO TEXT TRAVELS IN A URL).
test("release · ITM-133 UC-008 4a: an Accept refused for missing write access offers GitHub's new-file page with the record, as a link", async () => {
  const w = await world({ refuse: noWrite() });
  const page = await open(w, { hash: "#uc/UC-001" });
  const shown = ucText(w, UC1);
  await page.click(".accept");
  assert.equal(w.server.writes.length, 0, "nothing is written");
  assert.ok(writesOf(w).length > 0, "known positive: a write was tried and refused");
  const out = resultOf();
  assert.match(out.text, /may not write|cannot write|no write access|not allowed to write/i, out.text);
  const links = newFilePages(out.html);
  assert.equal(links.length, 1, `one link to GitHub's new-file page: ${out.html}`);
  const q = new URL(links[0]).searchParams;
  assert.match(q.get("filename"), /^docs\/approvals\/UC-001-[0-9a-f]{7,40}\.md$/);
  assert.ok(blobSha(shown).startsWith(q.get("filename").slice("docs/approvals/UC-001-".length, -3)), "the record's file names the blob shown");
  assert.ok(q.get("value").includes(UC1) && q.get("value").includes(blobSha(shown)), "the record is prefilled: file and blob SHA");
  assert.equal(q.get("value").trimEnd().split("\n").length, 3, "a three-line record");
  assert.ok(hrefs(out.html).every((x) => !x.includes("reader opens the report")), "no link carries the use case's text");
  assert.match(out.text, /pull request/i, "says the commit becomes a pull request");
  assert.match(out.text, /merge/i, "that counts once a maintainer merges it");
});

// A USED-UP RATE LIMIT IS NAMED, NOT BLAMED ON THE TOKEN · ITM-133's counter-proof — Expected: the same Accept refused with 403
// because the account's limit is used up (X-RateLimit-Remaining 0, X-RateLimit-Limit 5000) writes nothing, names the limit,
// and offers no GitHub path and no word of the token being unable to write.
test("release · ITM-133 UC-008 4a: an Accept refused for a used-up rate limit gets no GitHub path and no word of write access", async () => {
  const reset = String(Math.floor(Date.now() / 1000) + 1800);
  const w = await world({ refuse: noWrite(403, { "X-RateLimit-Limit": "5000", "X-RateLimit-Remaining": "0", "X-RateLimit-Reset": reset }) });
  const page = await open(w, { hash: "#uc/UC-001" });
  await page.click(".accept");
  assert.equal(w.server.writes.length, 0);
  const out = resultOf();
  assert.match(out.text, /limit/i, out.text);
  assert.deepEqual(newFilePages(out.html), [], "no GitHub path");
  assert.doesNotMatch(out.text, /cannot write|no write access|permission/i);
});

// A GITLAB PRODUCT IS WRITTEN WITH A TOKEN · ITM-133 — Expected: in a GitLab product whose project token is stored but whose
// server refuses the commit (403, as for a Developer on a protected default branch), Accept writes nothing, the page says the
// token cannot write there, and no link to a GitHub page is offered.
test("release · ITM-133 UC-008 4a: a GitLab product's refused Accept offers no GitHub path", async () => {
  const gitlab = gitlabServer({ refuseWrite: true });
  const w = await world({ gitlab });
  const setup = await open(w, { hash: "#add" });
  await storeGitLabProductToken(w, setup, GL_ADDRESS, { add: true });
  assert.ok(Object.values(setup.storage()).some((v) => v.includes(GL_TOKEN)), "the project token is stored");
  const page = await reload(w, setup, { search: `?product=${encodeURIComponent(GL_ADDRESS)}`, hash: "#uc/UC-001" });
  assert.match(page.main(), /The reader opens the report\./);
  await page.click(".accept");
  assert.ok(gitlab.requests.some((r) => r.method === "POST"), "known positive: the commit was tried");
  assert.deepEqual(gitlab.writes, [], "nothing is written");
  const out = resultOf();
  assert.match(out.text, /cannot write|no write access|not allowed|permission|Maintainer|role/i, out.text);
  assert.ok(hrefs(out.html).every((x) => !x.startsWith("https://github.com/")), "no GitHub path");
});

// UC-008 3d with 4a — "Accept ticked writes one commit"; refused for missing write access, the GitHub path is offered "as
// without a token" (ITM-133), where GitHub's page commits one file at a time: one prefilled new-file page per ticked record.
// Expected: nothing is written; the page says the token cannot write and offers GitHub's new-file page for UC-001's record and
// for UC-003's, each prefilled with its record.
test("release · ITM-133 UC-008 3d·4a: Accept ticked refused for missing write access offers the GitHub path for each ticked record",
  { todo: "FINDING A3 — docs/assets/dashboard/review-views.mjs runAccept: a batch (Accept ticked, Accept all) refused for missing write access gets the sentence only, no GitHub path — ITM-133 back to Development" }, async () => {
    const w = await world({ refuse: noWrite() });
    const page = await open(w, { hash: "#uc" });
    for (const box of inMain().querySelectorAll("input.tick")) { box.checked = true; box.fire("change", {}); }
    await page.click(".accept-ticked");
    assert.equal(w.server.writes.length, 0);
    const html = inMain().innerHTML, out = { text: stripTags(html), html };
    assert.match(out.text, /may not write|cannot write|no write access/i, out.text);
    const files = newFilePages(out.html).map((x) => new URL(x).searchParams.get("filename"));
    assert.ok(files.some((f) => f.startsWith("docs/approvals/UC-001-")) && files.some((f) => f.startsWith("docs/approvals/UC-003-")), `${out.html}`);
  });

// UC-008 3a with 4a · UC-018 6b ("as in UC-008 4a, the dashboard offers the GitHub route") — editing is the other half of
// WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK. Expected: a Save refused for missing write access writes nothing, says
// the token cannot write, keeps the edit, and offers GitHub's route for the edit as without a token (UC-008 3b): GitHub's editor
// of the file — a link to it, or the control that copies the text and opens it.
test("release · ITM-133 UC-008 3a·4a: a Save refused for missing write access offers GitHub's editor for the file", async () => {
    const w = await world({ refuse: noWrite() });
    const page = await open(w);
    const ed = await openEditor(page, "#uc/UC-001");
    ed.area.value = ucText(w, UC1).replace("opens the report.", "opens the report, NO-WRITE-ACCESS.");
    await press(w.server, ed.save());
    assert.equal(w.server.writes.length, 0);
    const said = stripTags(`${ed.result()} ${inMain().innerHTML}`);
    assert.match(said, /may not write|cannot write|no write access/i, said);
    const editPage = `https://github.com/${INSTANCE}/edit/main/${UC1}`;
    assert.ok(hrefs(page.main()).includes(editPage) || /data-edit-commit/.test(page.main()),
      `GitHub's editor offered: ${said}`);
  });
// ================================================================ ITM-136 — UC-042 step 1, a setting's last test across reloads
//
// UC-042 step 1: "each setting is one line with its state: ✓ works — with the date of the last successful test; … ✗ refused —
// the server or the bridge refused it at the last use". ITM-136: the date and the outcome are kept in this browser beside the
// setting, "Clear removes them with it (A CLEAR IS A REAL CLEAR), and the export carries them like every browser setting".
// A reload is a new page load on the same browser: localStorage as the last page left it, nothing else (reload()).

const publicControls = (root, name, out = []) => { for (const child of root?.children ?? []) { if (typeof child !== "object") continue; if (child.className?.split(" ").includes(name)) out.push(child); publicControls(child, name, out); } return out; };
async function settingsPanes(page) {
  const main = globalThis.document.getElementById("main"), replace = main.replaceChildren.bind(main);
  let mounted = []; main.replaceChildren = (...children) => { mounted = children; replace(...children); };
  await page.go("#settings");
  const pane = (name) => mounted.find((node) => node.className === "settings-tab-panel" && node.textContent.includes(name));
  assert.ok(pane("Repositories"), "the dashboard mounts the public Repositories pane");
  assert.ok(pane("Endpoints & Agents"), "the dashboard mounts the public Endpoints & Agents pane");
  return { repositories: () => pane("Repositories"), endpoints: () => pane("Endpoints & Agents") };
}
const githubRow = (panes) => publicControls(panes.repositories(), "settings-repository").find((row) => /GitHub token/.test(row.textContent));
const gitlabRow = (panes) => publicControls(panes.repositories(), "settings-repository").find((row) => /GitLab token/.test(row.textContent));
const repositoryControl = (row, name) => publicControls(row, `settings-repository-${name}`)[0];
const pressPublic = async (w, control) => { control.fire("click", { isTrusted: true }); await settle(w.server); };
const settingStorageKey = (key) => `agent-m:${INSTANCE}:${key}`;
const storedSetting = (page, key) => JSON.parse(page.storage()[settingStorageKey(key)]);
const testedAt = (page, key) => {
  const test = storedSetting(page, `last-test:${key}`);
  assert.equal(test.outcome, "working", `${key}'s kept test says it works`);
  assert.equal(test.at.slice(0, 10), today(), `${key}'s kept test records today's date`);
  return test.at;
};
const worksAt = (row, at) => {
  assert.ok(repositoryControl(row, "status").textContent.includes(`Works. Last successful test: ${at}.`),
    `the public setting line names its exact kept test time (${at})`);
  return true;
};
const refusedRead = (u) => (u.origin === API && u.pathname.startsWith(`/repos/${INSTANCE}`) ? new Response('{"message":"Bad credentials"}', { status: 401 }) : undefined);

// UC-042 1 · A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN — Expected: Test of the GitHub token shows ✓ works with
// today's date; after a reload the line still shows ✓ works with that date — the reload made no new Test.
test("release · ITM-136 UC-042 1: the GitHub token's ✓ works and its date are shown after a reload", async () => {
  const w = await world();
  const page = await open(w, { hash: "#uc" }), panes = await settingsPanes(page);
  assert.doesNotMatch(repositoryControl(githubRow(panes), "status").textContent, /Last successful test/, "known positive: not tested before the Test");
  await pressPublic(w, repositoryControl(githubRow(panes), "test"));
  const at = testedAt(page, "github-token");
  worksAt(githubRow(panes), at);
  const again = await reload(w, page, { hash: "#uc" }), againPanes = await settingsPanes(again);
  assert.deepEqual(storedSetting(again, "last-test:github-token"), { at, outcome: "working" }, "the exact successful test remains stored after the reload");
  worksAt(githubRow(againPanes), at);
});

// UC-042 1, 1b · AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED — Expected: when GitHub refuses the token at its Test, the
// line shows ✗ refused and the frame's notice at the top says "The server refused your token Agent M · akmaier/agent-m.";
// after a reload — GitHub still refusing it — both say so again.
test("release · ITM-136 UC-042 1b: a GitHub token refused at its last use is shown refused after a reload, on its line and at the top", async () => {
  let refusing = false;
  const w = await world({ refuse: (u) => (refusing ? refusedRead(u) : undefined) });
  const page = await open(w, { hash: "#uc" }), panes = await settingsPanes(page);
  refusing = true;
  await pressPublic(w, repositoryControl(githubRow(panes), "test"));
  assert.match(repositoryControl(githubRow(panes), "status").textContent, /Refused/);
  const again = await reload(w, page, { hash: "#uc" }), againPanes = await settingsPanes(again);
  assert.match(repositoryControl(githubRow(againPanes), "status").textContent, /Refused/, "after the reload");
  assert.match(stripTags(again.el("token-banner")), /The server refused your token Agent M · akmaier\/agent-m\./, "the notice at the top names it");
});

// UC-042 1 · ITM-136 — "each setting kept in the browser" has its line's state: a GitLab project token. Expected: its Test with
// the server accepting it shows ✓ works with today's date, after a reload too; with the server refusing it, ✗ refused, after a
// reload too.
test("release · ITM-136 UC-042 1: a GitLab project token's last test — works, then refused — is shown after a reload", async () => {
  const gitlab = gitlabServer();
  const w = await world({ gitlab });
  const setup = await open(w, { hash: "#add" });
  await storeGitLabProductToken(w, setup, GL_ADDRESS, { add: true });
  let page = await reload(w, setup, { hash: "#uc" }), panes = await settingsPanes(page);
  await pressPublic(w, repositoryControl(gitlabRow(panes), "test"));
  const key = `gitlab-token:${new URL(GL_ADDRESS).host}/${GL_PROJECT}`;
  const at = testedAt(page, key);
  worksAt(gitlabRow(panes), at);
  page = await reload(w, page, { hash: "#uc" }); panes = await settingsPanes(page);
  assert.deepEqual(storedSetting(page, `last-test:${key}`), { at, outcome: "working" }, "the GitLab successful test remains stored after the reload");
  worksAt(gitlabRow(panes), at);
  gitlab.refuseToken = true;
  await pressPublic(w, repositoryControl(gitlabRow(panes), "test"));
  assert.match(repositoryControl(gitlabRow(panes), "status").textContent, /Refused/);
  page = await reload(w, page, { hash: "#uc" }); panes = await settingsPanes(page);
  assert.match(repositoryControl(gitlabRow(panes), "status").textContent, /Refused/, "refused, after the reload");
});

// UC-042 2 · ITM-136 — the kept test describes the token that was tested. Expected: after Test (✓ works) the token is changed to
// a new value with Change; the new token has not been tested, and its line — on the page and after a reload — does not show
// ✓ works.
test("release · ITM-136 UC-042 2: a new token stored with Change does not inherit the old token's ✓ works", async () => {
  const w = await world();
  const page = await open(w, { hash: "#uc" }), panes = await settingsPanes(page);
  await pressPublic(w, repositoryControl(githubRow(panes), "test"));
  assert.match(repositoryControl(githubRow(panes), "status").textContent, /Works/, "known positive: the old token works");
  await pressPublic(w, repositoryControl(githubRow(panes), "change"));
  const ack = repositoryControl(githubRow(panes), "ack"); ack.checked = true; await ack.fire("change");
  repositoryControl(githubRow(panes), "secret").value = NEW_TOKEN;
  repositoryControl(githubRow(panes), "expiry").value = today();
  await pressPublic(w, repositoryControl(githubRow(panes), "save"));
  assert.equal(storedSetting(page, "github-token").value, NEW_TOKEN, "the new token is stored in its canonical record");
  assert.doesNotMatch(repositoryControl(githubRow(panes), "status").textContent, /Last successful test|Refused/, "the new token is not tested");
  const again = await reload(w, page, { hash: "#uc" }), againPanes = await settingsPanes(again);
  assert.doesNotMatch(repositoryControl(githubRow(againPanes), "status").textContent, /Last successful test|Refused/, "not after the reload either");
});

// UC-042 2 · A CLEAR IS A REAL CLEAR · ITM-136 — Expected: after Test, Clear of the GitHub token removes from localStorage the
// token, its expiry date and its kept test — every entry the token and its Test added —; after a reload its line shows
// — not set, not ✓ works.
test("release · ITM-136 UC-042 2: Clear removes the token's kept test with the token, from localStorage itself", async () => {
  const w = await world();
  const page = await open(w, { hash: "#uc" }), panes = await settingsPanes(page);
  const before = Object.keys(page.storage());
  await pressPublic(w, repositoryControl(githubRow(panes), "test"));
  const added = Object.keys(page.storage()).filter((k) => !before.includes(k));
  const tokenKey = settingStorageKey("github-token"), testKey = settingStorageKey("last-test:github-token");
  assert.deepEqual(added, [testKey], `known positive: the Test keeps its canonical metadata (${testKey})`);
  assert.equal(storedSetting(page, "github-token").value, TOKEN, "the tested canonical token remains present before Clear");
  testedAt(page, "github-token");
  await pressPublic(w, repositoryControl(githubRow(panes), "clear"));
  const left = page.storage();
  assert.deepEqual(Object.keys(left).filter((k) => added.includes(k) || k === tokenKey), [], "token and its test are gone");
  assert.ok(!Object.values(left).some((v) => v.includes(TOKEN) || v.includes(today())), JSON.stringify(left));
  const again = await reload(w, page, { hash: "#uc" }), againPanes = await settingsPanes(again);
  assert.match(repositoryControl(githubRow(againPanes), "status").textContent, /Not set\.|Cleared/, "after the reload");
});

// EVERY SETTING IS REACHED FROM ONE PAGE · ITM-136 ("the new keys have their place on the page") — Expected: after the tests of
// the GitHub token and of a GitLab project token, every entry Agent M keeps in localStorage is named on the settings page.
test("release · ITM-136 EVERY SETTING IS REACHED FROM ONE PAGE: every key kept after the tests is named on the settings page", async () => {
  const gitlab = gitlabServer();
  const w = await world({ gitlab });
  const setup = await open(w, { hash: "#add" });
  await storeGitLabProductToken(w, setup, GL_ADDRESS, { add: true });
  let page = await reload(w, setup, { hash: "#uc" }), panes = await settingsPanes(page);
  await pressPublic(w, repositoryControl(githubRow(panes), "test"));
  await pressPublic(w, repositoryControl(gitlabRow(panes), "test"));
  page = await reload(w, page, { hash: "#uc" }); panes = await settingsPanes(page);
  const gitlabKey = `gitlab-token:${new URL(GL_ADDRESS).host}/${GL_PROJECT}`;
  const githubAt = testedAt(page, "github-token"), gitlabAt = testedAt(page, gitlabKey);
  const reachability = new Map([
    [settingStorageKey("github-token"), () => /GitHub token/.test(githubRow(panes).textContent)],
    [settingStorageKey("last-test:github-token"), () => worksAt(githubRow(panes), githubAt)],
    [settingStorageKey("products"), () => /Managed products/.test(panes.repositories().textContent)],
    [settingStorageKey(gitlabKey), () => /GitLab token/.test(gitlabRow(panes).textContent)],
    [settingStorageKey(`last-test:${gitlabKey}`), () => worksAt(gitlabRow(panes), gitlabAt)],
  ]);
  const keys = Object.keys(page.storage()).filter((key) => key.startsWith(`agent-m:${INSTANCE}:`));
  assert.deepEqual(keys.sort(), [...reachability.keys()].sort(), "every canonical setting kept by these flows is accounted for");
  for (const [key, reachesPage] of reachability) assert.ok(reachesPage(), `${key} is reached on the public Repositories pane`);
});
