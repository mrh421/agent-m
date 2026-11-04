// A browser for src/site-frame/dashboard-app.mjs under node — used by the tests that load the dashboard (load-per-view, review-page,
// dashboard-shell, architecture, dashboard-review-flows, review-core.d/refused-save), no test of its own.
//
// The app is the real module, imported fresh for every page load. Around it: a DOM that keeps what the app writes into its
// elements, localStorage, the Cache Storage (shared between page loads when the test says so), and GitHub's REST API served
// from a set of files, GitHub's batch request (POST /graphql) and its trees of named folders — every request counted by what it reads. The git-data endpoints a commit uses (ref, commit, tree, update
// of the ref, fast-forward only) are served too, and a commit changes the files; a test adds the servers its view talks to as
// request handlers of its own. A button the app wired is found by its
// attribute and clicked with an event the test gives — trusted or not. No request leaves this process.
//
// Module: MOD-site-frame

import { blobSha } from "../src/text-tools/index.mjs";
import { storedGraphBytes } from "./stored-graph-fake.mjs";

const HEAD = "c0ffee".padEnd(40, "0");
export const REPO = "akmaier/agent-m";
export const TOKEN = "github_pat_HARNESS0123456789abcdefghij";

// What one read of a snapshot with `folders` asks GitHub for, as `folders` lists it: a named path without an extension as itself (its tree),
// a named path with one as its folder's entries, `<folder>/` — each once, sorted.
export const askedFor = (named) => [...new Set(named.map((path) => {
  const at = path.lastIndexOf("/"), name = path.slice(at + 1);
  return name.includes(".") ? `${at < 0 ? "" : path.slice(0, at)}/` : path;
}))].sort();

// files: { path: text } — the repository at its default branch. history: texts of earlier commits, readable by their blob SHA.
// dates: { path: ISO date } — when a record was committed. handlers: a test's own fakes, asked first and in order —
// (url: URL, init) -> Response, or nothing for a request the handler does not answer; each request it answers is counted as
// `handler <METHOD> <url>`. So a view's tests bring the servers that view talks to.
// empty: the repository has no commit yet — GitHub's Git database answers 409 "Git Repository is empty." until a file is created
// through the contents API (PUT …/contents/<path>), which makes the first commit.
// head: the commit the default branch stands at, c0ffee… unless a test names its own — MOD-trace-graph's storedGraph keeps a commit's graph for the length
// of a test file, so two servers of different files in one file name different heads where both are read for a graph.
export async function repoServer({ files: given, history = [], dates = {}, repo = REPO, handlers = [], empty = false, head: first = HEAD }) {
  const files = { ...given };
  const shas = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([p, t]) => [p, await blobSha(t)])));
  const bySha = Object.fromEntries(await Promise.all(history.map(async (t) => [await blobSha(t), t])));
  for (const [p, s] of Object.entries(shas)) bySha[s] = files[p];
  const requests = [], writes = [], batches = [], folderReads = [];
  let pending = 0, head = empty ? null : first, seq = 0;
  // The commit that added an approval record: the head, or, for a record that names a text its file no longer holds, an earlier commit
  // whose tree is the head's with that text at the file's path — the history that readHistory lists and the reads at that commit find
  // (A CHANGED FILE IS SHOWN AGAINST ITS LAST ACCEPTED TEXT). eras: sha -> { files, date }; added: record path -> its commit, null for the head.
  const eras = new Map(), added = new Map();
  for (const [path, text] of Object.entries(files)) {
    if (!/^docs\/approvals\/[^/]+\.md$/.test(path) || path.endsWith("README.md")) continue;
    const file = /^file: (.+)$/m.exec(text)?.[1], blob = /^blob: ([0-9a-f]{40})$/m.exec(text)?.[1];
    if (!file || !blob || shas[file] === blob || !(blob in bySha)) { added.set(path, null); continue; }
    const sha = `d${String(eras.size + 1).padStart(6, "0")}`.padEnd(40, "0");
    eras.set(sha, { files: { ...files, [file]: bySha[blob] }, date: dates[path] ?? "2026-09-01T10:00:00Z" });
    added.set(path, sha);
  }
  const eraOf = (sha) => (sha === null ? { files, date: "2026-10-01T10:00:00Z" } : eras.get(sha));
  const trees = new Map(), commits = new Map(), graphs = new Map();
  const next = (c) => `${c}${String(++seq).padStart(6, "0")}`.padEnd(40, "0");
  const put = async (path, text) => { files[path] = text; shas[path] = await blobSha(text); bySha[shas[path]] = text; };
  const api = `/repos/${repo}`;
  const blobShaOf = (text) => Object.keys(bySha).find((sha) => bySha[sha] === text) ?? "0".repeat(40);
  const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
  // GitHub's trees of named folders and the entries of the folders of named files, sent together (MOD-repository-hosts' readSnapshot with
  // `folders`): "<commit>:<path>" with recursive, or a folder's own entries without it. The requests sent together are one read of the
  // tree's folders, counted once as `folders`; what they asked for is listed in `folders` — a folder's path, a listed folder as `<folder>/`.
  // Requests are sent together while one of them is still in flight: a request sent after the last of the round has answered opens a round of its own.
  let round = null;
  const folderPart = (url, method) => {
    const m = method === "GET" && url.origin === "https://api.github.com" && new RegExp(`^${api}/git/trees/([^/:]+)(?::(.*))?$`).exec(url.pathname);
    return m && (m[2] !== undefined || !url.searchParams.has("recursive")) ? { commit: m[1], path: (m[2] ?? "").split("/").map(decodeURIComponent).join("/") } : null;
  };
  const fetchMock = async (u, init = {}) => {
    const url = new URL(String(u)), p = url.pathname, method = (init.method || "GET").toUpperCase();
    let what = `other ${method} ${url.origin}${p}${url.search}`;
    const part = folderPart(url, method);
    let mine = null;
    if (part) {
      const asked = url.searchParams.has("recursive") ? part.path : `${part.path}/`;
      if (round && round.commit === part.commit && round.inFlight > 0) { round.named.push(asked); what = null; }
      else { round = { commit: part.commit, named: [asked], inFlight: 0 }; folderReads.push(round.named); what = "folders"; }
      mine = round;
      mine.inFlight += 1;
    }
    pending += 1;
    try {
      await new Promise((r) => setTimeout(r, 0));
      for (const handle of handlers) {
        const answer = await handle(url, { ...init, method });
        if (answer) { what = `handler ${method} ${url.origin}${p}${url.search}`; return answer; }
      }
      if (part) {
        const held = part.commit === head ? files : eras.get(part.commit)?.files;
        if (!held) return new Response('{"message":"Not Found"}', { status: 404 });
        const shaOf = (file) => (held === files ? shas[file] : blobShaOf(held[file]));
        const folder = part.path, inside = (file) => folder === "" || file.startsWith(`${folder}/`), rest = (file) => (folder === "" ? file : file.slice(folder.length + 1));
        if (folder in held) return json({ message: "Invalid object requested. SHA must identify a commit or a tree." }, 422);
        const below = Object.keys(held).filter(inside).sort();
        if (!below.length) return new Response('{"message":"Not Found"}', { status: 404 });
        if (url.searchParams.has("recursive")) {
          return json({ sha: "t".repeat(40), truncated: false, tree: below.map((file) => ({ path: rest(file), mode: "100644", type: "blob", sha: shaOf(file) })) });
        }
        const entries = new Map();
        for (const file of below) {
          const [name, ...deeper] = rest(file).split("/");
          if (!entries.has(name)) entries.set(name, deeper.length ? { path: name, mode: "040000", type: "tree", sha: "t".repeat(40) }
            : { path: name, mode: "100644", type: "blob", sha: shaOf(file) });
        }
        return json({ sha: "t".repeat(40), truncated: false, tree: [...entries.values()] });
      }
      // The branch trace-cache holds `<commit>.json.gz` for the head and each earlier commit, as the workflow "main changed" stores it
      // (tests/stored-graph-fake.mjs): read through the contents API with a token, from the raw host without. Counted as `stored graph <commit>`.
      const storedFile = method === "GET" && ((url.origin === "https://api.github.com" && url.searchParams.get("ref") === "trace-cache" && new RegExp(`^${api}/contents/([0-9a-f]{40})\\.json\\.gz$`).exec(p))
        || (url.origin === "https://raw.githubusercontent.com" && new RegExp(`^/${repo}/trace-cache/([0-9a-f]{40})\\.json\\.gz$`).exec(p)));
      if (storedFile) {
        const sha = storedFile[1], at = sha === head ? files : eras.get(sha)?.files;
        what = `stored graph ${sha}`;
        if (!at) return new Response('{"message":"Not Found"}', { status: 404 });
        if (!graphs.has(sha)) graphs.set(sha, storedGraphBytes({ commit: sha, paths: Object.keys(at), read: async (path) => at[path] ?? null }));
        return new Response(await graphs.get(sha), { status: 200 });
      }
      // Without a token a public repository's files come from GitHub's raw host, at the commit the page pinned.
      const rawFile = url.origin === "https://raw.githubusercontent.com" && method === "GET"
        && new RegExp(`^/${repo}/[0-9a-f]{40}/(.+)$`).exec(p);
      if (rawFile) {
        const path = rawFile[1].split("/").map(decodeURIComponent).join("/");
        const sha = p.split("/")[3], at = eras.get(sha)?.files ?? files;
        what = at === files ? `file ${path}` : `era file ${path}`;
        return path in at ? new Response(at[path], { status: 200 }) : new Response("404: Not Found", { status: 404 });
      }
      // A read without a token of a file of another branch (raw host, /<repo>/<branch>/<path>) that the fake does not hold is answered 404, as GitHub answers it — such as
      // the branch overview-cache, which the fake holds no file of.
      if (url.origin === "https://raw.githubusercontent.com" && method === "GET" && p.startsWith(`/${repo}/`)) {
        what = `raw ${p}`;
        return new Response("404: Not Found", { status: 404 });
      }
      if (url.origin !== "https://api.github.com") return new Response("{}", { status: 500 });
      if (head === null && (p === `${api}/commits` || p.startsWith(`${api}/commits/`) || p.startsWith(`${api}/git/`))) {
        what = `empty ${method} ${p}`;
        return json({ message: "Git Repository is empty.", documentation_url: "https://docs.github.com/rest", status: "409" }, 409);
      }
      if (method === "PUT" && p.startsWith(`${api}/contents/`)) {
        const path = p.slice(`${api}/contents/`.length).split("/").map(decodeURIComponent).join("/"), body = JSON.parse(init.body);
        what = `write file ${path}`;
        if (head !== null) return json({ message: 'Invalid request. "sha" wasn\'t supplied.' }, 422);
        const text = Buffer.from(body.content, "base64").toString("utf8");
        await put(path, text);
        head = next("c");
        writes.push({ message: body.message, files: { [path]: text } });
        return json({ content: { path, sha: shas[path] }, commit: { sha: head, html_url: `https://github.com/${repo}/commit/${head}` } }, 201);
      }
      if (method === "POST" && p === `${api}/git/trees`) {
        what = "write tree";
        const sha = next("7");
        trees.set(sha, JSON.parse(init.body).tree);
        return json({ sha });
      }
      if (method === "POST" && p === `${api}/git/commits`) {
        what = "write commit";
        const body = JSON.parse(init.body), sha = next("c");
        commits.set(sha, body);
        return json({ sha, html_url: `https://github.com/${repo}/commit/${sha}` });
      }
      if (method === "PATCH" && p === `${api}/git/refs/heads/main`) {
        what = "write ref";
        const body = JSON.parse(init.body), c = commits.get(body.sha);
        if (!c || c.parents[0] !== head) return json({ message: "Update is not a fast forward" }, 422);
        const tree = trees.get(c.tree);
        for (const f of tree) await put(f.path, f.content);
        writes.push({ message: c.message, files: Object.fromEntries(tree.map((f) => [f.path, f.content])) });
        head = body.sha;
        return json({ object: { sha: head } });
      }
      // GitHub's batch query: many files of one commit in one request, one aliased field for each (repository.object(expression:
      // "<commit>:<path>") on a Blob); a path the commit does not hold answers null. Counted as `batch <n>`, and the paths it names are
      // listed in `batches`.
      if (method === "POST" && p === "/graphql") {
        const asks = [...JSON.parse(init.body).query.matchAll(/(f\d+):object\(expression:("(?:[^"\\]|\\.)*")\)/g)]
          .map((m) => [m[1], JSON.parse(m[2])]);
        what = `batch ${asks.length}`;
        const repository = {}, named = [];
        for (const [alias, expression] of asks) {
          const at = expression.indexOf(":"), commit = expression.slice(0, at), path = expression.slice(at + 1);
          named.push(path);
          const held = commit === head ? files : eras.get(commit)?.files;
          repository[alias] = held && path in held ? { text: held[path], isTruncated: false } : null;
        }
        batches.push(named);
        return json({ data: { repository } });
      }
      if (method !== "GET") return new Response("{}", { status: 500 });
      const era = new RegExp(`^${api}/(commits|git/trees)/(d\\d{6}0*)$`).exec(p);
      if (era && eras.has(era[2])) {
        // An earlier commit: its own requests are counted apart from the head's.
        if (era[1] === "commits" && url.searchParams.has("per_page")) { what = "era changes"; return json({ sha: era[2], files: [] }); }
        if (era[1] === "commits") { what = "era commit"; return json({ sha: era[2] }); }
        what = "era tree";
        const at = eras.get(era[2]).files;
        return json({ sha: "t".repeat(40), truncated: false, tree: Object.keys(at).sort().map((path) => ({ path, mode: "100644", type: "blob", sha: blobShaOf(at[path]) })) });
      }
      // The files a commit changed: the head's, read to list a record's history, changed none.
      if (p === `${api}/commits/${head}` && url.searchParams.has("per_page")) { what = "changes"; return json({ sha: head, files: [] }); }
      if (p === `${api}/commits/main` || p === `${api}/commits/${head}`) { what = "commit"; return json({ sha: head }); }
      if (p === `${api}/git/ref/heads/main`) { what = "ref"; return json({ object: { sha: head } }); }
      if (p === `${api}/git/commits/${head}`) { what = "commit object"; return json({ sha: head, tree: { sha: "t".repeat(40) } }); }
      if (p === `${api}/git/trees/${head}`) {
        what = "tree";
        return json({ sha: "t".repeat(40), truncated: false,
          tree: Object.keys(files).sort().map((path) => ({ path, mode: "100644", type: "blob", sha: shas[path] })) });
      }
      if (p.startsWith(`${api}/contents/`)) {
        const path = p.slice(`${api}/contents/`.length).split("/").map(decodeURIComponent).join("/");
        const at = eras.get(url.searchParams.get("ref"))?.files ?? files;
        what = at === files ? `file ${path}` : `era file ${path}`;
        return path in at ? new Response(at[path], { status: 200 }) : new Response('{"message":"Not Found"}', { status: 404 });
      }
      const blob = /^\/repos\/[^/]+\/[^/]+\/git\/blobs\/([0-9a-f]{40})$/.exec(p);
      if (blob) {
        what = `blob ${blob[1]}`;
        return blob[1] in bySha ? json({ sha: blob[1], encoding: "base64", content: Buffer.from(bySha[blob[1]], "utf8").toString("base64") })
          : new Response("{}", { status: 404 });
      }
      if (p === `${api}/commits`) {
        const path = url.searchParams.get("path");
        what = `history ${path}`;
        const item = (sha, date) => ({ sha, parents: [], author: null, commit: { author: { name: "A person" }, committer: { date }, message: "a commit" } });
        if (added.has(path)) return json([item(added.get(path) ?? head, eraOf(added.get(path)).date)]);
        return json(dates[path] ? [item("d".repeat(40), dates[path])] : []);
      }
      if (p === api) { what = "repository"; return json({ private: false, default_branch: "main" }); }
      return new Response("{}", { status: 404 });
    } finally {
      if (what !== null) requests.push(what);
      if (mine) mine.inFlight -= 1;
      pending -= 1;
    }
  };
  // Another commit on the branch: `path` gets `text`, and the branch moves on.
  const change = async (path, text) => { await put(path, text); head = next("e"); };
  return { files, shas, requests, writes, batches, folders: folderReads, change, fetch: fetchMock, get head() { return head; }, get pending() { return pending; } };
}

// The Cache Storage of a browser, in memory.
export function fakeCaches() {
  const stores = new Map();
  const store = (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name);
    return {
      match: async (key) => (m.has(String(key)) ? new Response(m.get(String(key))) : undefined),
      put: async (key, res) => { m.set(String(key), await res.text()); },
    };
  };
  return { stores, open: async (name) => store(name), delete: async (name) => stores.delete(name), has: async (name) => stores.has(name) };
}

// A control the app finds by an attribute selector — `[data-x]` or `[data-x="v"]` — in an element's HTML: it keeps the listeners
// the app adds, and the test fires them. Any other selector finds nothing, as before.
const ATTR_SELECTOR = /^\[([\w-]+)(?:="([^"]*)")?\]$/;
export const reEsc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// The element a view last called focus() on, as a browser keeps document.activeElement (A FORM OPENS WITH ITS FIRST FIELD
// FOCUSED); read through richDocument().focused().
let focusedOne = null;

function control(tag) {
  const listeners = [], sink = { textContent: "", innerHTML: "", hidden: false, disabled: false };
  const dataset = {};
  for (const m of tag.matchAll(/\sdata-([\w-]+)(?:="([^"]*)")?/g)) {
    dataset[m[1].replace(/-(\w)/g, (_, c) => c.toUpperCase())] = (m[2] ?? "").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  }
  const c = { tag, dataset, disabled: /\sdisabled\b/.test(tag), checked: /\schecked\b/.test(tag), textContent: "", innerHTML: "",
    value: "", hidden: false,
    addEventListener(type, f) { listeners.push([type, f]); },
    fire(type, ev) { for (const [t, f] of listeners) if (t === type) f({ ...ev, currentTarget: c, target: c }); },
    closest() { return c; }, querySelector: () => sink, querySelectorAll: () => [], focus() { focusedOne = c; },
    // An attribute of its tag, as a browser's element answers it (the settings page finds a remote session's line this way).
    getAttribute: (name) => attrOf(tag, name) };
  return c;
}
function find(html, sel, found, prefix = "") {
  const m = ATTR_SELECTOR.exec(sel);
  if (!m) return [];
  const needle = m[2] === undefined ? new RegExp(`\\s${m[1]}(?=[\\s=>])`, "g") : new RegExp(`\\s${m[1]}="${reEsc(m[2])}"`, "g");
  const out = [];
  let i = 0;
  for (const hit of html.matchAll(needle)) {
    const key = `${prefix}${sel}#${i++}`;
    if (!found.has(key)) found.set(key, control(html.slice(html.lastIndexOf("<", hit.index), html.indexOf(">", hit.index) + 1)));
    out.push(found.get(key));
  }
  return out;
}

function domElement(localName) {
  const children = [], listeners = [], controls = new Map();
  const node = {
    localName, nodeType: 1, parentNode: null, children, controls, className: "", value: "", checked: false, disabled: false, hidden: false,
    type: "", placeholder: "", autocomplete: "", spellcheck: true, href: "", target: "", rel: "", dataset: {}, style: {},
    get childNodes() { return children; },
    append(...items) {
      for (const item of items) {
        if (typeof item === "object" && item) {
          if (item.parentNode?.children?.includes(item)) item.remove?.();
          item.parentNode = node;
        }
        children.push(item);
      }
    },
    replaceChildren(...items) {
      for (const child of children) if (typeof child === "object" && child) child.parentNode = null;
      children.splice(0, children.length);
      controls.clear();
      node.append(...items);
    },
    insertBefore(item, before) {
      item.remove?.();
      const at = before === null ? children.length : children.indexOf(before);
      if (at < 0) throw new Error("The reference node is not a child.");
      item.parentNode = node;
      children.splice(at, 0, item);
      return item;
    },
    remove() {
      if (node.parentNode) {
        const siblings = node.parentNode.children;
        const at = siblings.indexOf(node);
        if (at >= 0) siblings.splice(at, 1);
      }
      node.parentNode = null;
    },
    addEventListener(type, listener) { listeners.push([type, listener]); },
    fire(type, ev = {}) { return Promise.all(listeners.filter(([kind]) => kind === type).map(([, listener]) => listener({ ...ev, type, currentTarget: node, target: node }))); },
    // An event dispatched through a node is a person's, as a browser marks it; one made with `scripted: true` is a script's.
    dispatchEvent(ev) { return node.fire(ev.type, { ...ev, isTrusted: !ev.scripted }); },
    // Downloads are observed by the test-specific wrapper where one is installed; the shared browser fixture still
    // performs the anchor activation for settings exports that need only the browser's normal no-return click.
    click() {},
    focus() { focusedOne = node; },
    setAttribute(name, value) { node[name] = String(value); },
    getAttribute(name) { return node[name] ?? null; },
    get textContent() { return children.map((child) => typeof child === "string" ? child : child.textContent).join(""); },
    set textContent(value) { node.replaceChildren(String(value)); },
    get innerHTML() { return children.map(domHtml).join(""); },
    set innerHTML(value) { node.replaceChildren(String(value)); },
    querySelector(selector) { return domFind(node, selector)[0] ?? null; },
    querySelectorAll(selector) { return domFind(node, selector); },
    getElementsByTagName(name) { return domFind(node, name); },
  };
  return node;
}

function domHtml(node) {
  if (typeof node === "string") return node;
  const esc = (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const attrs = [node.className && ` class="${esc(node.className)}"`, node.type && ` type="${esc(node.type)}"`, node.value && ` value="${esc(node.value)}"`,
    node.href && ` href="${esc(node.href)}"`, node.disabled && " disabled", node.checked && " checked"].filter(Boolean).join("");
  return `<${node.localName}${attrs}>${node.innerHTML}</${node.localName}>`;
}

function domFind(root, selector) {
  const matches = (node) => {
    if (typeof node === "string") return false;
    const attribute = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(selector);
    if (attribute) return attribute[2] === undefined ? node.getAttribute(attribute[1]) !== null : node.getAttribute(attribute[1]) === attribute[2];
    const match = /^([\w-]+)?(?:\.([\w-]+))?$/.exec(selector);
    return Boolean(match && (!match[1] || node.localName === match[1]) && (!match[2] || node.className.split(/\s+/).includes(match[2])));
  };
  const found = [];
  let index = 0;
  for (const child of root.children ?? []) {
    if (typeof child === "string") {
      if (!root.controls) root.controls = new Map();
      found.push(...find(child, selector, root.controls, `${index}:`));
      index += 1;
      continue;
    }
    if (matches(child)) found.push(child);
    found.push(...domFind(child, selector));
    index += 1;
  }
  return found;
}

function element(id) {
  let html = "";
  let children = null;
  const found = new Map(); // the controls found in the HTML now; new HTML has new ones
  return {
    id, textContent: "", hidden: false, value: "", checked: false, disabled: false, dataset: {}, style: {},
    get innerHTML() { return children ? children.map(domHtml).join("") : html; },
    set innerHTML(v) { children = null; html = String(v); found.clear(); },
    append(...items) { children = (children ?? []); children.push(...items); },
    replaceChildren(...items) { children = [...items]; html = ""; found.clear(); },
    classList: { toggle() {}, add() {}, remove() {} },
    addEventListener() {},
    querySelectorAll(sel) { return children ? domFind({ children }, sel) : find(html, sel, found); },
    querySelector(sel) { return this.querySelectorAll(sel)[0] ?? null; },
    closest() { return this; },
    insertAdjacentHTML(where, x) { html = where === "afterbegin" ? x + html : html + x; },
    focus() { focusedOne = this; }, replaceWith() {}, click() {}, getAttribute: () => null,
  };
}

// The entry of MOD-browser-store's setting `key` of the instance REPO, as this browser's localStorage holds it: the key under the
// instance's prefix, the value as JSON (MOD-browser-store, Data).
export const setting = (key, value) => ({ [`agent-m:${REPO}:${key}`]: JSON.stringify(value) });
// The setting of a stored token, as the settings pages store one (MOD-browser-store, Data: `{ value, name, expires, stored }`).
export const tokenSetting = (key, value, { name = "Agent M", expires = null } = {}) =>
  setting(key, { value, name, expires, stored: new Date().toISOString().slice(0, 10) });

function localStorageWith(entries) {
  const mem = new Map(Object.entries(entries));
  return { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k),
    get length() { return mem.size; }, key: (i) => [...mem.keys()][i] ?? null };
}

// Until the page has had nothing in flight for a while: no request open, none new.
export async function settle(server) {
  let idle = 0, seen = server.requests.length;
  while (idle < 40) {
    await new Promise((r) => setTimeout(r, 0));
    if (server.pending === 0 && server.requests.length === seen) idle += 1;
    else { idle = 0; seen = server.requests.length; }
  }
}

// The requests of a fake server that are writes: every request that is not a GET, except the batch of reads, a POST to GitHub's
// /graphql, which answers with file texts and changes nothing.
const BATCH_OF_READS = /^(write|other|handler) POST https:\/\/api\.github\.com\/graphql(\?|$)/;
export const writeRequests = (server) => server.requests.filter((request) => /^(write|other|handler) (?!GET )/.test(request) && !BATCH_OF_READS.test(request));

// The app: the one place tests and the harness load it from.
export const APP_FILE = new URL("../src/site-frame/dashboard-app.mjs", import.meta.url);

let loads = 0;

// One page load of the dashboard at `hash`, with a stored GitHub token. caches: the browser's Cache Storage, or null for a
// browser without one. assets: the folder the app is served from (another checkout's, to measure it). search: the page's query,
// such as `?product=<address>` for a GitLab product (empty: the instance).
// -> { main() -> the HTML of <main>, el(id) -> the HTML of another element, requests since the load began,
//      go(hash) -> the requests that view made, click(selector, event) -> the requests the click made }
// entries: further entries of this browser's localStorage when the page opens, { key: raw value } — a product's own token, for one
// (setting, tokenSetting).
// views: the slugs of the view modules the page's script tag names in `data-views`, which the app loads (MOD-site-frame, Data: the page setup); by default the six the live page names.
export const LIVE_VIEWS = ["review-pages", "trace-pages", "implementation-pages", "test-pages", "maintenance-pages", "settings-pages"];
export async function openDashboard({ server, hash = "", caches = null, token = TOKEN, search = "", entries = {},
  assets = new URL(".", APP_FILE), views = LIVE_VIEWS }) {
  // The renderer (MOD-markdown-render) draws only where the browser can sanitise (DOMPurify.isSupported) and, for a Mermaid block, draws
  // SVG (SVGElement). This fake DOM has no HTML parser, so it sanitises nothing: the HTML of a text that holds a Mermaid block, which the
  // renderer wrote itself, passes as it is, and any other text is refused as a browser without DOMPurify refuses it, so the renderer shows
  // its source (what the explanations' tests read).
  const renderer = (await import("../src/markdown-render/vendor/purify.es.mjs")).default;
  renderer.sanitize = (html, options) => {
    if (!options?.USE_PROFILES && !String(html).includes('class="language-mermaid"')) throw new Error("this browser cannot sanitise HTML");
    return String(html);
  };
  renderer.isSupported = true;
  globalThis.SVGElement ??= class SVGElement {};
  const els = new Map();
  const head = { children: [], append(x) { this.children.push(x); } }; // the stylesheets a view links into the page
  // The script tag that loads the app, with the setup of the page in its attributes (MOD-site-frame, Data).
  const appTag = { getAttribute: (name) => ({ src: new URL("dashboard-app.mjs", assets).href, "data-views": views.join(" ") })[name] ?? null };
  const doc = { getElementById: (id) => { if (!els.has(id)) els.set(id, element(id)); return els.get(id); },
    baseURI: "https://akmaier.github.io/agent-m/", getElementsByTagName: (name) => (name === "script" ? [appTag] : []),
    querySelectorAll: () => [], createElement: (tag) => domElement(tag), body: Object.assign(domElement("body"), { contains: () => true }), head };
  const loc = { hostname: "akmaier.github.io", pathname: "/agent-m/", search, hash, origin: "https://akmaier.github.io",
    get href() { return `https://akmaier.github.io/agent-m/${this.search}${this.hash}`; } };
  const listeners = [];
  const g = globalThis;
  Object.defineProperty(g, "location", { value: loc, configurable: true, writable: true });
  Object.defineProperty(g, "document", { value: doc, configurable: true, writable: true });
  Object.defineProperty(g, "localStorage", { value: localStorageWith({ ...(token ? tokenSetting("github-token", token, { name: `Agent M · ${REPO}` }) : {}), ...entries }),
    configurable: true, writable: true });
  Object.defineProperty(g, "caches", { value: caches ?? undefined, configurable: true, writable: true });
  g.window = g;
  g.fetch = server.fetch;
  g.addEventListener = (type, f) => { if (type === "hashchange") listeners.push(f); };
  g.scrollTo = () => {};
  g.matchMedia = () => ({ matches: false });
  const start = server.requests.length;
  loads += 1;
  await import(new URL(`dashboard-app.mjs?load=${loads}`, assets));
  await settle(server);
  const page = {
    main: () => doc.getElementById("main").innerHTML,
    el: (id) => doc.getElementById(id).innerHTML, // a part the app fills after rendering, such as #impact
    stylesheets: () => head.children.map((l) => l.href), // the stylesheets the views linked, beside the site's style sheets
    requests: server.requests.slice(start),
    async go(next) {
      const from = server.requests.length;
      loc.hash = next;
      for (const f of listeners) f();
      await settle(server);
      return server.requests.slice(from);
    },
    // The first control in <main> that `selector` finds is clicked with `event`; { isTrusted: true } is a person's click.
    async click(selector, event = { isTrusted: true }) {
      const from = server.requests.length;
      const c = doc.getElementById("main").querySelector(selector);
      if (!c) throw new Error(`nothing on the page matches ${selector}`);
      c.fire("click", event);
      await settle(server);
      return server.requests.slice(from);
    },
  };
  return page;
}

// ---------------------------------------------------------------- what the harness's document lacks, added for the flows
//
// Moved here unchanged from tests/dashboard-review-flows.test.mjs (written by ITM-123), so that the checks of the dashboard's
// editor in other files use the same document.
//
// The harness above keeps the listeners of the controls it finds in an element's HTML by an attribute selector ([data-x]),
// and page.click fires them in <main>. Three kinds of control these flows click are not reached that way; richDocument() adds
// them on top of the harness's document, whose own controls stay the objects they were (page.click works as before):
//  1. an element found by its id (document.getElementById) keeps the listeners a view adds and can be fired — Add product,
//     Store and check, Check, the settings page's Save buttons are wired that way. Its value, checked, disabled and hidden start
//     from its tag, and new HTML that writes the same id again makes it a new element, as in a browser;
//  2. the edit panel a view finds by its classes (`.panel.edit`), with its textarea, preview, result and buttons — no other class
//     selector is answered, so every other view behaves as under the harness alone;
//  3. a control whose HTML a view sets (a form built inside it) is searched in that HTML.
// It is installed after the first page load and before the view under test is opened (page.go), so that the view's wiring
// reaches it.

const ATTR = ATTR_SELECTOR;
export const unesc = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
export const attrOf = (tag, name) => { const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag); return m ? unesc(m[1]) : null; };
const flagOf = (tag, name) => new RegExp(`\\s${name}(?=[\\s>=/])`).test(tag);
// The positions the harness finds an attribute selector at, in the same order as its controls.
const needle = (sel) => {
  const m = ATTR.exec(sel);
  return m[2] === undefined ? new RegExp(`\\s${m[1]}(?=[\\s=>])`, "g") : new RegExp(`\\s${m[1]}="${reEsc(m[2])}"`, "g");
};

// A control of our own, of the harness's shape, for HTML a view writes into a control.
function ownControl(tag) {
  const listeners = [], dataset = {};
  for (const m of tag.matchAll(/\sdata-([\w-]+)(?:="([^"]*)")?/g)) dataset[m[1].replace(/-(\w)/g, (_, c) => c.toUpperCase())] = unesc(m[2] ?? "");
  const c = { tag, dataset, disabled: flagOf(tag, "disabled"), checked: flagOf(tag, "checked"), value: attrOf(tag, "value") ?? "",
    textContent: "", innerHTML: "", hidden: false,
    addEventListener(type, f) { listeners.push([type, f]); },
    fire(type, ev) { for (const [t, f] of [...listeners]) if (t === type) f({ ...ev, currentTarget: c, target: c }); },
    getAttribute: (n) => attrOf(tag, n), closest() { return c; }, focus() { focusedOne = c; } };
  return withInner(c);
}
// A control's querySelector searches the HTML a view set into it; an attribute selector it does not find, and any other
// selector, answer as before.
function withInner(c) {
  if (c.__inner) return c;
  const before = c.querySelector, beforeAll = c.querySelectorAll;
  let html = null, found = null;
  const all = (sel) => {
    if (html !== c.innerHTML) { html = c.innerHTML; found = new Map(); }
    const out = [];
    let i = 0;
    for (const hit of String(html).matchAll(needle(sel))) {
      const key = `${sel}#${i++}`;
      if (!found.has(key)) found.set(key, ownControl(html.slice(html.lastIndexOf("<", hit.index), html.indexOf(">", hit.index) + 1)));
      out.push(found.get(key));
    }
    return out;
  };
  c.__inner = true;
  c.querySelector = (sel) => (ATTR.test(sel) && all(sel)[0]) || (before ? before.call(c, sel) : null);
  c.querySelectorAll = (sel) => (ATTR.test(sel) ? all(sel) : beforeAll ? beforeAll.call(c, sel) : []);
  return c;
}

// The start tags of `html` in [from, to) that a simple selector — `tag`, `.a`, `.a.b`, `tag.a` — matches, with where each ends.
function tagsMatching(html, sel, from = 0, to = html.length) {
  const [, name, cls] = /^([a-z]*)((?:\.[\w-]+)*)$/.exec(sel) || [];
  if (name === undefined) return [];
  const want = cls.split(".").filter(Boolean), out = [];
  for (const m of html.slice(from, to).matchAll(/<([a-z][\w-]*)([^<>]*)>/g)) {
    const at = from + m.index, tag = m[0];
    const classes = (attrOf(tag, "class") || "").split(/\s+/);
    if ((name && m[1] !== name) || !want.every((k) => classes.includes(k))) continue;
    out.push({ at, tag, name: m[1], end: closing(html, m[1], at + tag.length) });
  }
  return out;
}
function closing(html, name, from) {
  if (["input", "br", "img"].includes(name)) return from;
  const re = new RegExp(`<(/?)${name}\\b[^<>]*>`, "g");
  re.lastIndex = from;
  let depth = 1;
  for (let m; (m = re.exec(html));) { depth += m[1] ? -1 : 1; if (depth === 0) return m.index; }
  return html.length;
}

export function richDocument() {
  const doc = globalThis.document, harnessGet = doc.getElementById;
  const els = new Map(), nodes = new WeakMap();
  const tagOf = (id) => {
    const re = new RegExp(`<[^<>]*\\sid="${reEsc(id)}"[^<>]*>`);
    for (const el of els.values()) { const m = re.exec(el.innerHTML); if (m) return m[0]; }
    return null;
  };
  const reset = (el, tag) => {
    el.listeners = [];
    el.disabled = flagOf(tag, "disabled");
    el.checked = flagOf(tag, "checked");
    el.hidden = flagOf(tag, "hidden");
    el.value = attrOf(tag, "value") ?? "";
  };
  // New HTML: an id it writes again is a new element; the nodes found in the old HTML are gone.
  const renew = (owner, html) => {
    nodes.set(owner, new Map());
    for (const m of html.matchAll(/<[^<>]*\sid="([^"]+)"[^<>]*>/g)) if (els.has(m[1]) && els.get(m[1]) !== owner) reset(els.get(m[1]), m[0]);
  };
  // A part of an element's HTML found by its classes — the edit panel —, and the parts and controls inside it.
  const node = (owner, from, to, tag, name) => {
    const listeners = [];
    const html = () => owner.innerHTML;
    const inside = (sel) => {
      if (ATTR.test(sel)) {
        const hits = [...html().matchAll(needle(sel))].map((h) => h.index);
        return owner.querySelectorAll(sel).filter((_, i) => hits[i] >= from && hits[i] < to);
      }
      return tagsMatching(html(), sel, from, to).map((t) => nodeAt(owner, t, sel));
    };
    const n = { tag, hidden: flagOf(tag, "hidden"), innerHTML: "", textContent: "", outerHTML: "",
      value: name === "textarea" ? unesc(html().slice(from + tag.length, to)) : attrOf(tag, "value") ?? "",
      addEventListener(type, f) { listeners.push([type, f]); },
      fire(type, ev = {}) { for (const [t, f] of [...listeners]) if (t === type) f({ ...ev, currentTarget: n, target: n }); },
      querySelector: (sel) => inside(sel)[0] ?? null, querySelectorAll: (sel) => (ATTR.test(sel) || /^[\w.-]+$/.test(sel) ? inside(sel) : []),
      closest() { return n; }, focus() { focusedOne = n; } };
    return n;
  };
  const nodeAt = (owner, t, sel) => {
    const kept = nodes.get(owner) ?? nodes.set(owner, new Map()).get(owner);
    const key = `${sel}@${t.at}`;
    if (!kept.has(key)) kept.set(key, node(owner, t.at, t.end, t.tag, t.name));
    return kept.get(key);
  };
  const augment = (el) => {
    if (el.__rich) return el;
    el.__rich = true;
    const d = Object.getOwnPropertyDescriptor(el, "innerHTML");
    Object.defineProperty(el, "innerHTML", { configurable: true, enumerable: true, get: d.get,
      set(v) { d.set.call(el, v); renew(el, String(v)); } });
    el.listeners = [];
    el.addEventListener = (type, f) => el.listeners.push([type, f]);
    el.fire = (type, ev = {}) => { for (const [t, f] of [...el.listeners]) if (t === type) f({ ...ev, currentTarget: el, target: el }); };
    const qs = el.querySelector, qsa = el.querySelectorAll;
    el.querySelector = (sel) => {
      if (ATTR.test(sel)) { const c = qs.call(el, sel); return c && withInner(c); }
      return sel === ".panel.edit" ? (tagsMatching(el.innerHTML, sel).map((t) => nodeAt(el, t, sel))[0] ?? null) : qs.call(el, sel);
    };
    el.querySelectorAll = (sel) => (ATTR.test(sel) ? qsa.call(el, sel).map(withInner) : qsa.call(el, sel));
    const tag = tagOf(el.id);
    if (tag) reset(el, tag);
    return el;
  };
  doc.getElementById = (id) => {
    const el = harnessGet(id);
    if (!els.has(id)) els.set(id, el);
    return augment(el);
  };
  for (const id of ["main", "product", "token-banner", "tabs", "repo-line"]) doc.getElementById(id);
  focusedOne = null;
  return {
    byId: (id) => doc.getElementById(id),
    focused: () => focusedOne,
    edit: () => doc.getElementById("main").querySelector(".panel.edit"),
  };
}

// A click on a control or an element, as a person makes it: a disabled one cannot be clicked. -> the requests it made.
export async function press(server, el, ev = { isTrusted: true }) {
  if (!el) throw new Error("nothing to click");
  if (el.disabled) throw new Error(`disabled — a person cannot click ${el.tag || el.id}`);
  const from = server.requests.length;
  el.fire("click", ev);
  await settle(server);
  return server.requests.slice(from);
}
