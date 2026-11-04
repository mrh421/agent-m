// The browser harness of the tests of MOD-trace-pages' route: the part of a browser's DOM that the renderer (MOD-markdown-render, DOMPurify) and the
// pages use, set as the globals `document` and `window` when this file is imported; the Host of a product whose snapshots hold the files of a few
// trees, with a log of what it was asked; and the small finders and fixtures the tests of the route share. node has no DOM and the module runs in a
// browser. It holds no test and no expected result; nothing reaches the network.
//
// Module: MOD-trace-pages
// Level: unit

import { createHash } from "node:crypto";
import { storedGraphReadOn } from "./stored-graph-fake.mjs";

// A small browser DOM, adapted from the working MOD-test-pages route test.  renderArtifact needs the DOMPurify surface
// of a browser; this harness provides it without a browser or a request.
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const ENTITY = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => (e[0] !== "#" ? ENTITY[e.toLowerCase()] ?? m
  : String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1)))));
const escapeText = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

class Node extends EventTarget {
  constructor(doc, type, name) { super(); Object.assign(this, { _doc: doc, _type: type, _name: name, _parent: null, _kids: [] }); }
  get nodeType() { return this._type; }
  get nodeName() { return this._name; }
  get ownerDocument() { return this._type === 9 ? null : this._doc; }
  get parentNode() { return this._parent; }
  get childNodes() { return this._kids; }
  get firstChild() { return this._kids[0] ?? null; }
  get nextSibling() { const kids = this._parent?._kids; return kids ? kids[kids.indexOf(this) + 1] ?? null : null; }
  get textContent() { return this._type === 3 ? this.data : this._kids.map((kid) => kid.textContent).join(""); }
  set textContent(value) { if (this._type === 3) this.data = String(value); else this.replaceChildren(String(value)); }
  get innerHTML() { return this._kids.map(serialise).join(""); }
  set innerHTML(value) { this.replaceChildren(); parse(this._doc, String(value), this); }
  get isConnected() { let node = this; while (node._parent) node = node._parent; return node === this._doc; }
  appendChild(node) { return this.insertBefore(node, null); }
  insertBefore(node, before) {
    if (node._type === 11) { for (const kid of [...node._kids]) this.insertBefore(kid, before); return node; }
    node._parent?.removeChild(node);
    const at = before ? this._kids.indexOf(before) : -1;
    this._kids.splice(at < 0 ? this._kids.length : at, 0, node); node._parent = this;
    return node;
  }
  removeChild(node) { this._kids.splice(this._kids.indexOf(node), 1); node._parent = null; return node; }
  append(...nodes) { for (const node of nodes) this.appendChild(typeof node === "string" ? this._doc.createTextNode(node) : node); }
  replaceChildren(...nodes) { for (const node of [...this._kids]) this.removeChild(node); this.append(...nodes); }
  cloneNode(deep = false) {
    const copy = this._type === 1 ? this._doc.createElement(this.localName) : this._type === 3 ? this._doc.createTextNode(this.data) : this._doc.createDocumentFragment();
    for (const attr of this._attrs ?? []) copy.setAttribute(attr.name, attr.value);
    if (deep) for (const kid of this._kids) copy.appendChild(kid.cloneNode(true));
    return copy;
  }
  getElementsByTagName(name) { const found = []; (function walk(node) { for (const kid of node._kids) { if (kid._type === 1 && kid.localName === name) found.push(kid); walk(kid); } })(this); return found; }
}
class Text extends Node { constructor(doc, text) { super(doc, 3, "#text"); this.data = text; } }
class Fragment extends Node { constructor(doc) { super(doc, 11, "#document-fragment"); } }
class Element extends Node {
  constructor(doc, name) { super(doc, 1, name.toUpperCase()); this.localName = name; this._attrs = []; }
  get tagName() { return this._name; }
  get namespaceURI() { return "http://www.w3.org/1999/xhtml"; }
  get attributes() { return this._attrs; }
  get className() { return this.getAttribute("class") ?? ""; }
  set className(value) { this.setAttribute("class", value); }
  getAttributeNode(name) { return this._attrs.find((attr) => attr.name === name.toLowerCase()) ?? null; }
  getAttribute(name) { return this.getAttributeNode(name)?.value ?? null; }
  hasAttribute(name) { return this.getAttributeNode(name) !== null; }
  setAttribute(name, value) { const old = this.getAttributeNode(name), lower = name.toLowerCase(); if (old) old.value = String(value); else this._attrs.push({ name: lower, value: String(value), localName: lower, namespaceURI: null }); }
  removeAttribute(name) { const old = this.getAttributeNode(name); if (old) this._attrs.splice(this._attrs.indexOf(old), 1); }
}
class Document extends Node {
  constructor() { super(null, 9, "#document"); this._doc = this; this.implementation = { createHTMLDocument: htmlDocument }; }
  get children() { return this._kids.filter((kid) => kid._type === 1); }
  get body() { return this.getElementsByTagName("body")[0] ?? null; }
  createElement(name) { return new Element(this, String(name).toLowerCase()); }
  createTextNode(text) { return new Text(this, String(text)); }
  createDocumentFragment() { return new Fragment(this); }
  importNode(node, deep) { return node.cloneNode(deep); }
}
function htmlDocument() { const doc = new Document(), html = doc.createElement("html"); doc.append(html); html.append(doc.createElement("head"), doc.createElement("body")); return doc; }
class DOMParser { parseFromString(html) { const doc = htmlDocument(); parse(doc, String(html), doc.body); return doc; } }
const TAG = /^<(\/?)([a-zA-Z][\w-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*\/?>/;
const ATTRIBUTE = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
function parse(doc, html, into) {
  const open = [into];
  for (let i = 0; i < html.length;) {
    const tag = TAG.exec(html.slice(i));
    if (!tag) { const next = html.indexOf("<", i + 1), end = next < 0 ? html.length : next; open.at(-1).append(doc.createTextNode(decode(html.slice(i, end)))); i = end; continue; }
    i += tag[0].length;
    const name = tag[2].toLowerCase();
    if (tag[1]) { const at = open.findLastIndex((node, index) => index > 0 && node.localName === name); if (at > 0) open.length = at; continue; }
    const node = doc.createElement(name);
    for (const attr of tag[3].matchAll(ATTRIBUTE)) if (!node.hasAttribute(attr[1])) node.setAttribute(attr[1], decode(attr[2] ?? attr[3] ?? attr[4] ?? ""));
    open.at(-1).append(node); if (!VOID.has(name)) open.push(node);
  }
}
function serialise(node) { if (node._type === 3) return escapeText(node.data); if (node._type !== 1) return node.innerHTML; const start = `<${node.localName}${node._attrs.map((attr) => ` ${attr.name}="${attr.value}"`).join("")}>`; return VOID.has(node.localName) ? start : `${start}${node.innerHTML}</${node.localName}>`; }

export const document = htmlDocument();
globalThis.document = document;
globalThis.window = { document, Node, Element, Text, DocumentFragment: Fragment, DOMParser, NodeFilter: { SHOW_ELEMENT: 1, SHOW_TEXT: 4 } };

export function find(root, match) { const found = []; (function walk(node) { for (const kid of node.childNodes) { if (kid.nodeType === 1) { if (match(kid)) found.push(kid); walk(kid); } } })(root); return found; }
// Polls until `done()` holds, at most `ms` by the clock.
export async function until(done, ms = 2000) { const end = Date.now() + ms; while (!done() && Date.now() < end) await new Promise((resolve) => setTimeout(resolve, 1)); }

// The route name and the parts of an address in the form the frame reads: `#route/key=value/key=value`, each part decoded.
export function addressParts(href) {
  const [route, ...parts] = String(href).replace(/^#/, "").split("/");
  return { route, params: Object.fromEntries(parts.map((part) => { const at = part.indexOf("="); return [decodeURIComponent(part.slice(0, at)), decodeURIComponent(part.slice(at + 1))]; })) };
}

export const blobOf =(text) => createHash("sha1").update(`blob ${Buffer.byteLength(text)}\0${text}`).digest("hex");
export function doc(id, title, keys = {}, body = "") {
  const lines = ["---", `id: ${id}`, `title: ${title}`];
  for (const [key, values] of Object.entries(keys)) lines.push(Array.isArray(values) ? `${key}:\n${values.map((value) => `  - ${value}`).join("\n")}` : `${key}: ${values}`);
  return [...lines, "---", `# ${id} ${title}`, "", body, ""].join("\n");
}

// A Host whose snapshots hold the files of `trees` by ref; `log` records every snapshot asked for, every read and every readMany. `failing(path, nth)` makes the nth
// read of a path (from 1) fail as an unreachable server does. It has no write method and no repositoryInfo beyond the default branch. Each snapshot's readOn
// serves the graph of its tree stored on trace-cache for the snapshot's commit (`commitOf(ref)`, or the commit a wrapper of the snapshot names), as the workflow "main changed"
// stores it (tests/stored-graph-fake.mjs); `stored(ref, nth)` false (from 1) leaves the nth readOn of a ref without it, as before the workflow ran. `log.readOns` records
// each readOn. The branch `test-results` has a history of its own: one commit for each record file of its tree, in the order of the tree taken as newest first, each commit adding that file alone (readHistory with
// `ref: "test-results"` or the commit a page of it ends at, as a page of the history is read from the parent of the page before). readSnapshot with `folders` holds only the files of those folders and the files
// named, and a read of any other path fails with OutsideSnapshot; `log.narrowed` records each readSnapshot as [ref, folders | null]. Building that graph is the push job's work and reads nothing the log records. The commit of a ref is a SHA of its own for each Host: MOD-trace-graph's
// storedGraph keeps a commit's graph for the page (the module), so two Hosts of one test file never share a commit.
let hostsMade = 0;
export function treeHost({ trees, tags = [], failing = () => false, history = [], onDefault = [], stored = () => true }) {
  const log = { contains: [], snapshots: [], narrowed: [], reads: [], manys: [], histories: [], fileAts: [], readOns: [] };
  const made = ++hostsMade;
  const commitOf = (ref) => createHash("sha1").update(`tree host ${made} ${ref}`).digest("hex");
  const counts = new Map();
  const resultsPaths = Object.keys(trees["test-results"] ?? {}).filter((path) => /^runs\/[^/]+\/[^/]+\.md$/.test(path));
  const resultsLog = resultsPaths.map((path, at) => ({ path, commit: createHash("sha1").update(`results ${made} ${path}`).digest("hex"), at }));
  resultsLog.forEach((entry) => { entry.parents = resultsLog[entry.at + 1] ? [resultsLog[entry.at + 1].commit] : []; });
  const outside = (path, folders) => Object.assign(new Error(`${path} lies outside what this snapshot holds — ${folders.join(", ")}`), { name: "OutsideSnapshot", path });
  const storedOf = new Map(), readOnCounts = new Map();
  const readOnOf = (ref, commit, files) => {
    const key = `${ref}\0${commit}`;
    if (!storedOf.has(key)) storedOf.set(key, storedGraphReadOn({ commit, paths: Object.keys(files), read: async (path) => (Object.hasOwn(files, path) ? files[path] : null) }));
    return storedOf.get(key);
  };
  return {
    log, commitOf,
    async readSnapshot(ref, options = {}) {
      log.snapshots.push(ref);
      const folders = options?.folders ?? null;
      log.narrowed.push([ref, folders]);
      const files = trees[ref];
      if (!files) throw Object.assign(new Error("unreachable"), { name: "Unreachable" });
      const inside = (path) => folders === null || folders.some((folder) => path === folder || path.startsWith(`${folder}/`));
      return {
        ref, commit: commitOf(ref), paths: Object.keys(files).filter(inside),
        async read(path) {
          if (!inside(path)) throw outside(path, folders);
          log.reads.push(path);
          counts.set(path, (counts.get(path) ?? 0) + 1);
          if (failing(path, counts.get(path))) throw Object.assign(new Error("unreachable"), { name: "Unreachable" });
          return Object.hasOwn(files, path) ? files[path] : null;
        },
        async readMany(paths) { const away = paths.find((path) => !inside(path)); if (away !== undefined) throw outside(away, folders); log.manys.push([...paths]); },
        async readOn(branch, path, options) {
          log.readOns.push([branch, path]);
          readOnCounts.set(ref, (readOnCounts.get(ref) ?? 0) + 1);
          return stored(ref, readOnCounts.get(ref)) ? readOnOf(ref, this?.commit ?? commitOf(ref), files)(branch, path, options) : null;
        },
        blob: (path) => (Object.hasOwn(files, path) ? blobOf(files[path]) : null),
      };
    },
    // `history` is the commits of the default branch, newest first: { commit, date, files } with the whole tree of the commit. readHistory names those that changed a
    // path (every commit for no path, and, for no path, the commits `onDefault` names after them), as the Host does, newest first, up to the limit; readFileAt gives the text of the path at each commit asked, null where it has none.
    async readHistory(path, options = {}) {
      log.histories.push([path, options]);
      const from = options.ref === "test-results" ? 0 : resultsLog.findIndex((entry) => entry.commit === options.ref);
      if (from >= 0 && resultsLog.length) {
        return resultsLog.slice(from, from + (options.limit ?? resultsLog.length)).map((entry) => ({ commit: entry.commit, parents: entry.parents, author: { account: null, name: "fixture" }, date: "2026-10-01T10:00:00Z", message: "",
          changes: options.changes === false ? [] : [{ path: entry.path, change: "added" }] }));
      }
      const changed = history.filter((entry, index) => path === null || entry.files[path] !== history[index + 1]?.files[path]);
      // For the repository (a null path) the default branch also holds the commits `onDefault` names, after those of `history`.
      if (path === null) changed.push(...onDefault.filter((commit) => !changed.some((entry) => entry.commit === commit)).map((commit) => ({ commit, date: "2026-10-01T10:00:00Z", files: {} })));
      return changed.slice(0, options.limit ?? changed.length).map(({ commit, date }) => ({ commit, parents: [], author: { account: null, name: "fixture" }, date, message: "", changes: [] }));
    },
    // containsCommit(branch, commit): whether the default branch holds the commit, that is `history` or `onDefault` names it; every question is noted in `log.contains` as [branch, commit].
    async containsCommit(branch, commit) {
      log.contains.push([branch, commit]);
      return onDefault.includes(commit) || history.some((entry) => entry.commit === commit);
    },
    async readFileAt(path, commits) {
      log.fileAts.push([path, [...commits]]);
      return new Map(commits.map((commit) => [commit, history.find((entry) => entry.commit === commit)?.files[path] ?? null]));
    },
    async listTags() { return tags.map((name) => ({ name, commit: `commit-of-${name}` })); },
    async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite: false, archived: false, description: "" }; },
  };
}
