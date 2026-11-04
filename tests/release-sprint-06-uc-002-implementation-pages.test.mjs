// The release tests of UC-002, Choose how the product is developed (ITM-223): one or more for every requirement UC-002
// realises, through the route How this product is developed as the dashboard reaches it — docs/assets/dashboard/
// tests/implementation-pages-process-route.mjs's routes.process(app) —, over two fixture repositories behind MOD-repository-hosts' real connect(): an
// instance and a product. Every expected result is the requirement's own; where the page disagrees, the test follows the
// requirement and is marked todo with its FINDING. ITM-223's findings F2 and F3, which ITM-240 settles, and F8, which the
// SPEC settles as accepted in 617988d, are no longer marked (ITM-242).
//
// Written by tester-opus (claude-opus-5-5), the release tester, who implemented none of the behaviour tested here.
//
// Run: node --test tests/release-sprint-06-uc-002-implementation-pages.test.mjs
//
// Module: MOD-implementation-pages
// Guards: THE PROCESS MODEL IS DECLARED PER PRODUCT; A PROCESS MODEL ORGANISES PEOPLE AND AGENTS; AGENT M CARRIES THE BOOK'S CATALOGUE; THE CATALOGUE IS DATA; THE MODEL DETERMINES THE PHASES AND THE GATES; A GATE NAMES WHAT IT CHECKS; A PRACTICE IS NOT A MODEL; A PROCESS REQUIREMENT ADDS TO THE MODEL; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; A ROLE NAMES THE CAPABILITIES IT NEEDS; A PARTICIPANT DECLARES ITS CAPABILITIES; A PARTICIPANT DECLARES WHERE IT PROCESSES DATA; A PRODUCT DECLARES ITS DEFINITION OF DONE; THE DEFAULT DEFINITION OF DONE IS THE JOB RULES; A PHASE OR A TIME BOX MAY HAVE A BRANCH OF ITS OWN; WORK MERGES INTO THE DEFAULT BRANCH UNLESS A BRANCH IS SET; A GATE NAMES WHO DECIDES IT
// Level: release
//
// The page is reached as in tests/system-uc-002-choose-a-process-model.test.mjs: tests/dashboard-process-view.test.mjs's
// small DOM, copied below unchanged, a minimal app as that helper reads it, and a repoServer for each repository.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { repoServer, settle, TOKEN } from "./app-harness.mjs";

// ---------------------------------------------------------------- a small DOM, copied unchanged from tests/dashboard-
// ---------------------------------------------------------------- process-view.test.mjs (itself copied from tests/
// ---------------------------------------------------------------- implementation-pages.test.mjs, with insertAdjacentHTML
// ---------------------------------------------------------------- added for the helper).

const FOCUSABLE = new Set(["input", "textarea", "select", "button"]);
const HTML_NS = "http://www.w3.org/1999/xhtml";
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const RAW = new Set(["script", "style", "textarea", "title", "xmp", "iframe", "noembed", "noframes", "noscript"]); // text until its end tag
const LITERAL = new Set(["script", "style", "xmp", "iframe", "noembed", "noframes", "noscript"]); // its text is neither decoded nor escaped
const SHOWN = { 1: 0x1, 3: 0x4, 8: 0x80 }; // NodeFilter's SHOW_ bit of an element, a text, a comment
const iterators = new Set();

const ENTITY = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => (e[0] !== "#" ? ENTITY[e.toLowerCase()] ?? m
  : String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1)))));
const escapeText = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/ /g, "&nbsp;");
const escapeAttribute = (s) => escapeText(s).replace(/"/g, "&quot;");

class Node extends EventTarget {
  constructor(doc, type, name) {
    super();
    Object.assign(this, { _doc: doc, _type: type, _name: name, _parent: null, _kids: [] });
  }
  get nodeType() { return this._type; }
  get nodeName() { return this._name; }
  get ownerDocument() { return this._type === 9 ? null : this._doc; }
  get parentNode() { return this._parent; }
  get childNodes() { return this._kids; }
  get firstChild() { return this._kids[0] ?? null; }
  get nextSibling() { const k = this._parent?._kids; return k ? k[k.indexOf(this) + 1] ?? null : null; }
  get previousSibling() { const k = this._parent?._kids; return k ? k[k.indexOf(this) - 1] ?? null : null; }
  get textContent() {
    return this._type === 3 || this._type === 8 ? this.data : this._kids.map((k) => (k._type === 8 ? "" : k.textContent)).join("");
  }
  set textContent(v) { if (this._type === 3 || this._type === 8) this.data = String(v); else this.replaceChildren(String(v)); }
  get innerHTML() { return this._kids.map(serialise).join(""); }
  set innerHTML(html) { this.replaceChildren(); parse(this._doc, String(html), this); }
  // Not part of tests/implementation-pages.test.mjs's own copy: the helper's one line after render calls this
  // (target.insertAdjacentHTML("afterbegin", …)) to show the route's title above its content. "afterbegin" only —
  // the one position used here — parsed with the same parse() the rest of this DOM already uses.
  insertAdjacentHTML(where, html) {
    const frag = this._doc.createDocumentFragment();
    parse(this._doc, String(html), frag);
    if (where === "afterbegin") this.insertBefore(frag, this.firstChild);
    else if (where === "beforeend") this.appendChild(frag);
    else throw new Error(`insertAdjacentHTML: position "${where}" is not implemented by this test's small DOM`);
  }
  hasChildNodes() { return this._kids.length > 0; }
  contains(n) { for (; n; n = n._parent) if (n === this) return true; return false; }
  get isConnected() { let n = this; while (n._parent) n = n._parent; return n === this._doc; }
  insertBefore(n, before) {
    if (n._type === 11) { for (const k of [...n._kids]) this.insertBefore(k, before); return n; }
    n._parent?.removeChild(n);
    const at = before ? this._kids.indexOf(before) : -1;
    this._kids.splice(at < 0 ? this._kids.length : at, 0, n);
    n._parent = this;
    return n;
  }
  appendChild(n) { return this.insertBefore(n, null); }
  removeChild(n) {
    // The DOM's removing steps for a NodeIterator: one whose reference lies in what is removed moves back to the node before
    // it — the last node of its previous sibling, or its parent. Removing the iterator's root moves nothing.
    for (const it of iterators) {
      if (it.root === n || !n.contains(it.reference)) continue;
      let before = n.previousSibling;
      while (before?._kids.length) before = before._kids.at(-1);
      it.reference = before ?? n._parent;
    }
    this._kids.splice(this._kids.indexOf(n), 1);
    n._parent = null;
    return n;
  }
  remove() { this._parent?.removeChild(this); }
  append(...nodes) { for (const n of nodes) this.appendChild(typeof n === "string" ? this._doc.createTextNode(n) : n); }
  replaceChildren(...nodes) { for (const k of [...this._kids]) this.removeChild(k); this.append(...nodes); }
  cloneNode(deep = false) {
    const c = this._type === 1 ? this._doc.createElement(this.localName) : this._type === 3 ? this._doc.createTextNode(this.data)
      : this._type === 8 ? this._doc.createComment(this.data) : this._doc.createDocumentFragment();
    for (const a of this._attrs ?? []) c.setAttribute(a.name, a.value);
    if (deep) for (const k of this._kids) c.appendChild(k.cloneNode(true));
    return c;
  }
  getElementsByTagName(name) {
    const found = [];
    (function walk(n) { for (const k of n._kids) { if (k._type === 1 && k.localName === name) found.push(k); walk(k); } })(this);
    return found;
  }
}

class Text extends Node { constructor(doc, data) { super(doc, 3, "#text"); this.data = data; } }
class Comment extends Node { constructor(doc, data) { super(doc, 8, "#comment"); this.data = data; } }
class DocumentFragment extends Node { constructor(doc) { super(doc, 11, "#document-fragment"); } }

class Element extends Node {
  constructor(doc, name) { super(doc, 1, name.toUpperCase()); this.localName = name; this._attrs = []; }
  get tagName() { return this._name; }
  get namespaceURI() { return HTML_NS; }
  get attributes() { return this._attrs; }
  get children() { return this._kids.filter((k) => k._type === 1); }
  get firstElementChild() { return this.children[0] ?? null; }
  get className() { return this.getAttribute("class") ?? ""; }
  set className(v) { this.setAttribute("class", v); }
  getAttributeNode(name) { return this._attrs.find((a) => a.name === name.toLowerCase()) ?? null; }
  getAttribute(name) { return this.getAttributeNode(name)?.value ?? null; }
  hasAttribute(name) { return this.getAttributeNode(name) !== null; }
  setAttribute(name, value) {
    const a = this.getAttributeNode(name), lower = name.toLowerCase();
    if (a) a.value = String(value);
    else this._attrs.push({ name: lower, localName: lower, value: String(value), namespaceURI: null });
  }
  removeAttributeNode(a) {
    const at = this._attrs.indexOf(a);
    if (at < 0) throw new Error("NotFoundError: not an attribute of this element");
    this._attrs.splice(at, 1);
    return a;
  }
  removeAttribute(name) { const a = this.getAttributeNode(name); if (a) this.removeAttributeNode(a); }
  focus() { if (this.isConnected && FOCUSABLE.has(this.localName)) this._doc._focused = this; }
}

class Document extends Node {
  constructor() { super(null, 9, "#document"); this._doc = this; this.implementation = { createHTMLDocument: htmlDocument }; }
  get documentElement() { return this.children[0] ?? null; }
  get children() { return this._kids.filter((k) => k._type === 1); }
  get body() { return this.getElementsByTagName("body")[0] ?? null; }
  get activeElement() { return this._focused?.isConnected ? this._focused : this.body; }
  createElement(name) { return new Element(this, String(name).toLowerCase()); }
  createTextNode(data) { return new Text(this, String(data)); }
  createComment(data) { return new Comment(this, String(data)); }
  createDocumentFragment() { return new DocumentFragment(this); }
  importNode(n, deep) { return n.cloneNode(deep); }
  createNodeIterator(root, whatToShow = 0xffffffff) {
    const it = {
      root, reference: root, beforeReference: true,
      nextNode() {
        for (let n = this.reference; ;) {
          if (this.beforeReference) this.beforeReference = false;
          else n = following(n, this.root);
          if (!n) return null;
          this.reference = n;
          if (whatToShow & (SHOWN[n._type] ?? 0)) return n;
        }
      },
    };
    iterators.add(it);
    return it;
  }
}

// The node after `n` in tree order, within `root`.
function following(n, root) {
  if (n._kids.length) return n._kids[0];
  for (; n && n !== root; n = n._parent) if (n.nextSibling) return n.nextSibling;
  return null;
}

function htmlDocument() {
  const doc = new Document(), html = doc.createElement("html");
  doc.appendChild(html);
  html.append(doc.createElement("head"), doc.createElement("body"));
  return doc;
}

class DOMParser {
  parseFromString(html) { const doc = htmlDocument(); parse(doc, String(html), doc.body); return doc; }
}

// An HTML parser for well-formed HTML: elements, void elements, the text of script and its kin up to their end tag,
// attributes quoted or not, character references, comments.
const TAG = /^<(\/?)([a-zA-Z][\w-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*\/?>/;
const ATTRIBUTE = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

function parse(doc, html, into) {
  const open = [into];
  for (let i = 0; i < html.length;) {
    const top = open.at(-1);
    if (html.startsWith("<!--", i)) {
      const close = html.indexOf("-->", i + 4), end = close < 0 ? html.length : close;
      top.appendChild(doc.createComment(html.slice(i + 4, end)));
      i = end + 3;
      continue;
    }
    const tag = TAG.exec(html.slice(i));
    if (!tag) {
      const next = html.indexOf("<", i + 1), end = next < 0 ? html.length : next;
      top.appendChild(doc.createTextNode(decode(html.slice(i, end))));
      i = end;
      continue;
    }
    i += tag[0].length;
    const name = tag[2].toLowerCase();
    if (tag[1]) {
      const at = open.findLastIndex((e, k) => k > 0 && e.localName === name);
      if (at > 0) open.length = at;
      continue;
    }
    const el = doc.createElement(name);
    for (const a of tag[3].matchAll(ATTRIBUTE)) if (!el.hasAttribute(a[1])) el.setAttribute(a[1], decode(a[2] ?? a[3] ?? a[4] ?? ""));
    top.appendChild(el);
    if (RAW.has(name)) {
      const close = html.toLowerCase().indexOf(`</${name}`, i), end = close < 0 ? html.length : close;
      if (end > i) el.appendChild(doc.createTextNode(LITERAL.has(name) ? html.slice(i, end) : decode(html.slice(i, end))));
      i = end + (TAG.exec(html.slice(end))?.[0].length ?? 0);
    } else if (!VOID.has(name)) open.push(el);
  }
}

// The HTML fragment serialisation of a node.
function serialise(n) {
  if (n._type === 3) return LITERAL.has(n._parent?.localName) ? n.data : escapeText(n.data);
  if (n._type === 8) return `<!--${n.data}-->`;
  if (n._type !== 1) return n.innerHTML;
  const start = `<${n.localName}${n._attrs.map((a) => ` ${a.name}="${escapeAttribute(a.value)}"`).join("")}>`;
  return VOID.has(n.localName) ? start : `${start}${n.innerHTML}</${n.localName}>`;
}

const document = htmlDocument();
globalThis.document = document;
globalThis.window = { document, Node, Element, Text, Comment, DocumentFragment, DOMParser,
  NodeFilter: { SHOW_ELEMENT: 0x1, SHOW_TEXT: 0x4, SHOW_CDATA_SECTION: 0x8, SHOW_PROCESSING_INSTRUCTION: 0x40, SHOW_COMMENT: 0x80 } };

// the helper is loaded only now, after globalThis.document exists, as tests/dashboard-process-view.test.mjs loads
// it: through MOD-implementation-pages' route it reaches modules that need a document from the moment they are imported.
const { routes } = await import("./implementation-pages-process-route.mjs");

// ---------------------------------------------------------------- the fixture repositories: an instance and a product

const INSTANCE = "fixture/instance";
const PRODUCT = "fixture/product";
// The commit tests/app-harness.mjs's repoServer starts every repository at: a model_version of 40 hex digits.
const HEAD = "c0ffee".padEnd(40, "0");

// The instance's participants: one of each of the five types UC-002 step 4 names. endpoint-x can neither write to the
// repository nor run code and tests; ci-bot cannot use tools.
const PARTICIPANTS = `# Participants of this instance

Fixture participants, one of each type.

| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |
|---|---|---|---|---|---|---|---|
| alice | person | — | — | — | draft text, read the repository, write to the repository, run code and tests | — | account github/alice |
| endpoint-x | model endpoint | fixture-llm | — | — | draft text, read the repository | NHR@FAU, Erlangen | endpoint https://llm.example.test |
| ci-bot | CI agent | fixture-llm | — | — | read the repository, write to the repository, run code and tests | a provider in the USA | ci hosted secret CI_BOT |
| cli-bot | CLI agent | fixture-llm | — | — | read the repository, write to the repository, run code and tests, use tools | this machine | bridge lab agent claude |
| box-bot | sandboxed agent | fixture-llm | — | — | read the repository, write to the repository, run code and tests | a container on this machine | container lab-box |
`;

// A process requirement, accepted from a registered standard: the requirement, the source it comes from, and the
// instance's SPEC that holds it — where a declaration's ## Gates added by requirements looks its requirement up
// (src/product-process/declaration.schema.md).
const REQUIREMENT = "VERIFICATION IS DOCUMENTED BEFORE RELEASE";
const STANDARD = "SRC-standard-fixture";
const INSTANCE_SPEC = `# SPEC

## 1. Process

**${REQUIREMENT}** *(${STANDARD})*
The verification of every item is documented before the item is released.
*Check:* no automatic check.
`;

// The instance's own process (UC-002 3a), a data file in the catalogue's format (src/model-catalogue/model.schema.md):
// four phases, a transition back, a verification pair of its first and its last phase, a gate decided by a role and one
// decided by a CI check, and a role for a person, one for either and one for an agent.
const LAB_FLOW_PATH = "docs/process-models/lab-flow.md";
const LAB_FLOW = `---
name: lab-flow
kind: planned
measure: plan entries per phase
---
# Lab flow

The fixture organisation's own process.

## About

manages: the lab's fixture risk it manages
accepts: the lab's fixture risk it accepts
example: a lab fixture project
chapter: 6, a fixture chapter

## Phases

| Name | Role | Produces |
|---|---|---|
| Outline | Steward | requirements, ARC |
| Assemble | Builders | ITM, MOD |
| Probe | Prober | TST |
| Handover | Steward | — |

## Transitions

| From | To | Kind |
|---|---|---|
| Outline | Assemble | sequence |
| Assemble | Probe | sequence |
| Probe | Assemble | back |
| Probe | Handover | sequence |

## Verification pairs

| Phase | Checked by |
|---|---|
| Outline | Handover |

## Gates

| Between | Artifacts | Condition | Decider |
|---|---|---|---|
| Outline → Assemble | ARC | the architecture is accepted | Steward |
| Probe → Handover | TST | every test is green | check: lab-tests |

## Roles

| Name | Filled by | How many | Capabilities |
|---|---|---|---|
| Steward | person | several | draft text |
| Builders | either | several | write to the repository, run code and tests |
| Prober | agent | several | run code and tests, use tools |
`;

// A product whose implementation starts: no declaration yet.
const NEW_PRODUCT = { "README.md": "# The fixture product\n" };

// A product's declaration docs/process.md (src/product-process/declaration.schema.md), which names no participant:
// branches as [phase or time box, branch], added gates as [requirement, between, artifacts, condition, decider].
function declaration({ model, file, practices = ["none"], branches = [],
  done = "The job rules hold; no condition is added.", added = [] }) {
  const table = (head, rows) => [`| ${head.join(" | ")} |`, `|${head.map(() => "---|").join("")}`,
    ...rows.map((row) => `| ${row.join(" | ")} |`)].join("\n");
  return [`---\nmodel: ${model}\nmodel_file: ${file}\nmodel_version: ${HEAD}\n---\n# How the fixture product is developed`,
    `## Practices\n\n${practices.map((practice) => `- ${practice}`).join("\n")}`,
    `## Branches\n\n${table(["Phase or time box", "Branch"], branches)}`,
    `## Definition of Done\n\n${done}`,
    ...(added.length ? [`## Gates added by requirements\n\n${table(["Requirement", "Between", "Artifacts", "Condition", "Decider"], added)}`] : []),
  ].join("\n\n") + "\n";
}
const scrumDeclaration = (rest) => declaration({ model: "scrum", file: "src/model-catalogue/models/scrum.md", ...rest });
const kanbanDeclaration = (rest) => declaration({ model: "kanban", file: "src/model-catalogue/models/kanban.md", ...rest });
const labFlowDeclaration = (rest) => declaration({ model: "lab-flow", file: LAB_FLOW_PATH, ...rest });

// ---------------------------------------------------------------- the dashboard's way to the page

// The h() dashboard-app.mjs's context gives every view, as tests/dashboard-process-view.test.mjs gives it.
const h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Opens the page as the dashboard does — routes.process(app), with a minimal app as that helper reads it — over an
// instance and a product, each a repoServer of its own behind the real connect(): the product's server answers the
// product and hands every request for the instance to the instance's server. Every request that writes is recorded with
// the token it carries. -> { target, product, instance, sent }
async function openPage(t, { product = NEW_PRODUCT, instance = {}, participants = PARTICIPANTS } = {}) {
  const instanceServer = await repoServer({ repo: INSTANCE,
    files: { "docs/participants.md": participants, "SPEC.md": INSTANCE_SPEC, ...instance } });
  const sent = [];
  const productServer = await repoServer({ repo: PRODUCT, files: product, handlers: [
    (url, init) => { if (init.method !== "GET") sent.push({ method: init.method, path: url.pathname, authorization: init.headers?.Authorization }); },
    (url, init) => (url.pathname.includes(`/${INSTANCE}`) ? instanceServer.fetch(url, init) : undefined),
  ] });
  globalThis.fetch = productServer.fetch;
  const target = document.createElement("div");
  document.body.append(target);
  t.after(() => target.remove());
  await routes.process({ T: { instance: INSTANCE, product: { address: `https://github.com/${PRODUCT}` } },
    ghToken: () => TOKEN, token: () => TOKEN, main: () => target, h });
  await turn();
  return { target, product: productServer, instance: instanceServer, sent };
}

// ---------------------------------------------------------------- reading the page, and the author's actions on it

// The elements below `root`, in tree order, that `match` accepts.
function elements(root, match) {
  const found = [];
  (function walk(n) { for (const k of n.childNodes) if (k.nodeType === 1) { if (match(k)) found.push(k); walk(k); } })(root);
  return found;
}
const byTag = (root, name) => elements(root, (e) => e.localName === name);
const byData = (root, attribute, value) => elements(root, (e) => e.getAttribute(attribute) === value);
const hasClass = (e, name) => e.className.split(" ").includes(name);
// An element's text as a person reads it: its runs of white space as one space.
const textOf = (node) => node.textContent.replace(/\s+/g, " ").trim();
// Whether `node` lies within an ancestor, up to `root`, that `match` accepts.
function within(node, root, match) {
  for (let n = node.parentNode; n && n !== root; n = n.parentNode) if (n.nodeType === 1 && match(n)) return true;
  return false;
}
// Folded: within a <details> that is not open.
const folded = (node, root) => within(node, root, (e) => e.localName === "details" && !e.hasAttribute("open"));
// The folded explanations "What is this?".
const explanations = (root) => byTag(root, "details").filter((d) => /What is this\?/.test(textOf(byTag(d, "summary")[0] ?? d)));

// What the page itself shows, entry by entry — its list items, table rows and paragraphs —, apart from the author's own
// declaration text (a section's editor and its preview) and the folded explanations, which say the same for every
// product.
const shownEntries = (target) => elements(target, (e) => ["li", "tr", "p"].includes(e.localName)
  && !within(e, target, (a) => a.localName === "details" || hasClass(a, "editor"))).map(textOf);
// Whether the phase `name` is shown in an entry of its own — one that names it and no other of the model's `phases` —, not
// merely as an end of a gate.
const phaseShown = (shown, name, phases) => shown.some((entry) => entry.includes(name) && phases.every((other) => other === name || !entry.includes(other)));

// The models offered, by name, and a model's card.
const modelsOffered = (target) => elements(target, (e) => e.hasAttribute("data-model")).map((e) => e.getAttribute("data-model"));
const card = (target, name) => byData(target, "data-model", name)[0];
// A role as the page shows it, and its text.
const role = (target, name) => byData(target, "data-role", name)[0];
const roleText = (target, name) => { const r = role(target, name); assert.ok(r, `the role ${name} is shown`); return textOf(r); };
// The value of the declaration's field `key`.
const fieldValue = (target, key) => byTag(byData(target, "data-key", key)[0], "input")[0].value;
// The Save at the end of the form — the page's own name for it: a section's Save answers "a section is saved with its
// form — Save at the end of the form hands over the whole document".
const saveOf = (target) => byTag(target, "button").filter((b) => textOf(b) === "Save").at(-1);

// The turn of the event loop in which the page answers what was done to it.
const turn = () => new Promise((resolve) => setImmediate(resolve));
// The author chooses a model: the Choose of its card.
async function choose(target, name) {
  const button = byTag(card(target, name), "button").find((b) => textOf(b) === "Choose");
  button.dispatchEvent(new Event("click"));
  await turn();
}
// The author types a section of the declaration — its text below the heading — as a person's typing does.
async function typeSection(target, heading, text) {
  const area = byTag(byData(target, "data-section", heading)[0], "textarea")[0];
  area.value = text;
  area.dispatchEvent(new Event("input"));
  await turn();
}
// The author presses Save, once; the page's requests run to their end.
async function pressSave(page) {
  saveOf(page.target).dispatchEvent(Object.defineProperty(new Event("click"), "isTrusted", { value: true }));
  await settle(page.product);
}

// The data of the shipped catalogue: what the page shows of a shipped model or practice is what its data file holds.
const catalogueFile = (path) => readFileSync(new URL(`../src/model-catalogue/${path}`, import.meta.url), "utf8");
const SHIPPED = ["waterfall", "v-model", "reuse-oriented", "scrum", "kanban"];
const PRACTICES = ["devops", "prototyping", "incremental-delivery", "scaling-layers"];
// The rows of the table under `heading` ("## …") in a markdown text, as [{ column: cell }].
function rowsOf(text, heading) {
  const lines = text.split("\n");
  const below = lines.slice(lines.indexOf(heading) + 1);
  const end = below.findIndex((line) => line.startsWith("## "));
  const table = below.slice(0, end < 0 ? below.length : end).filter((line) => line.startsWith("|"));
  const cells = (line) => line.split("|").slice(1, -1).map((cell) => cell.trim());
  const [head, , ...rows] = table;
  return rows.map((row) => Object.fromEntries(cells(head).map((name, i) => [name, cells(row)[i]])));
}
// The value of a `key: value` line, as a model's ## About holds it.
const valueOf = (text, key) => new RegExp(`^${key}: (.*)$`, "m").exec(text)?.[1];
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// The job rules, as THE DEFAULT DEFINITION OF DONE IS THE JOB RULES states them as accepted in 617988d — five conditions,
// the second with its alternative for a refactoring job —, each by the words any wording of it holds.
const JOB_RULES = {
  "its CI run is green": [/\bCI( run)? is green/],
  "the job's first commit held only failing tests — or, for a refactoring job, CI was green on every commit and no expected result changed":
    [/first commit/, /tests/, /fail|red/, /refactoring/, /green on every commit/, /expected result/],
  "it changes only the job's modules": [/job['’]s modules/],
  "every new test names the requirement it guards and the module it exercises": [/new test/, /requirement/, /module/],
  "every gate the workflow places before the merge is recorded": [/gate/, /merge/, /recorded/],
};
// The conditions the page shows as the Definition of Done: the entries below its heading.
function doneConditions(target) {
  const heading = elements(target, (e) => /^h[1-6]$/.test(e.localName) && textOf(e) === "Definition of Done")[0];
  assert.ok(heading, "the page shows a Definition of Done");
  return elements(heading.parentNode, (e) => e.localName === "li" && !within(e, heading.parentNode, (a) => a.localName === "details")).map(textOf);
}

// ---------------------------------------------------------------- 5. Process models and practices

// TST-472486 · level: release · module: MOD-implementation-pages
// guards: THE PROCESS MODEL IS DECLARED PER PRODUCT
// given: a product without a declaration
// input: routes.process(app); then the author chooses Kanban, completes the declaration and presses Save
// expect: no model is assumed — the model field is empty and Save is not offered —; then the product's own repository holds a declaration of exactly one model, Kanban, and the instance's repository none
test("THE PROCESS MODEL IS DECLARED PER PRODUCT: no model is assumed; the product's own repository declares exactly one", async (t) => {
  const page = await openPage(t);
  const { target } = page;
  assert.equal(fieldValue(target, "model"), "", "no model is assumed");
  assert.equal(saveOf(target).disabled, true, "nothing can be saved before a model is chosen");

  await choose(target, "kanban");
  await typeSection(target, "## Practices", "\n- none\n");
  await typeSection(target, "## Branches", "\n| Phase or time box | Branch |\n|---|---|\n");
  await typeSection(target, "## Definition of Done", "\nThe job rules hold; no condition is added.\n");
  assert.equal(saveOf(target).disabled, false, "known positive: with a model chosen, Save is offered");
  await pressSave(page);

  const text = page.product.files["docs/process.md"];
  assert.ok(text, "the product's repository holds the declaration");
  assert.deepEqual(text.match(/^model: .*$/gm), ["model: kanban"], "exactly one model: Kanban");
  assert.equal(page.instance.files["docs/process.md"], undefined, "the instance's repository holds none");
});

// TST-472487 · level: release · module: MOD-implementation-pages
// guards: A PROCESS MODEL ORGANISES PEOPLE AND AGENTS
// given: the instance's own lab-flow, whose roles are Steward (a person), Builders (either) and Prober (an agent)
// input: the author chooses lab-flow
// expect: each role is shown with whether a person, an agent or either may fill it
test("A PROCESS MODEL ORGANISES PEOPLE AND AGENTS: each role is shown with whether a person, an agent or either may fill it", async (t) => {
  const { target } = await openPage(t, { instance: { [LAB_FLOW_PATH]: LAB_FLOW } });
  await choose(target, "lab-flow");

  assert.match(roleText(target, "Steward"), /\bperson\b/);
  assert.doesNotMatch(roleText(target, "Steward"), /\bagent\b|either/);
  assert.match(roleText(target, "Builders"), /either|person or (an )?agent/);
  assert.match(roleText(target, "Prober"), /\bagent\b/);
  assert.doesNotMatch(roleText(target, "Prober"), /\bperson\b|either/);
});

// TST-472488 · level: release · module: MOD-implementation-pages
// guards: AGENT M CARRIES THE BOOK'S CATALOGUE
// given: a product without a declaration; the shipped catalogue
// input: routes.process(app); the author chooses Scrum
// expect: the book's five models are offered — waterfall, V-model, reuse-oriented, Scrum, Kanban —, and, apart from them, its practices: DevOps, prototyping, incremental delivery, the scaling layers of disciplined agile delivery
test("AGENT M CARRIES THE BOOK'S CATALOGUE: the five models, and apart from them the four practices", async (t) => {
  const { target } = await openPage(t);
  assert.deepEqual(modelsOffered(target).sort(), [...SHIPPED].sort());
  await choose(target, "scrum");

  const shown = shownEntries(target);
  for (const practice of [/devops/i, /prototyping/i, /incremental[- ]delivery/i, /scaling[- ]layers/i]) {
    assert.ok(shown.some((entry) => practice.test(entry)), `the practice ${practice}`);
    assert.ok(!modelsOffered(target).some((name) => practice.test(name)), `${practice} is not offered as a model`);
  }
});

// TST-472489 · level: release · module: MOD-implementation-pages
// guards: THE CATALOGUE IS DATA
// given: an instance that adds its own process as a data file, docs/process-models/lab-flow.md — no code changed
// input: routes.process(app); the author chooses lab-flow
// expect: lab-flow is offered with what its ## About holds, and the workflow shown is its data file's: its phases, its roles and its gates
test("THE CATALOGUE IS DATA: a process model added as a data file is offered and used, no code changed", async (t) => {
  const { target } = await openPage(t, { instance: { [LAB_FLOW_PATH]: LAB_FLOW } });
  assert.ok(modelsOffered(target).includes("lab-flow"), "lab-flow is offered");
  for (const key of ["manages", "accepts", "example", "chapter"]) assert.ok(textOf(card(target, "lab-flow")).includes(valueOf(LAB_FLOW, key)), `its ${key}`);

  await choose(target, "lab-flow");
  const shown = shownEntries(target);
  const phases = rowsOf(LAB_FLOW, "## Phases").map(({ Name }) => Name);
  for (const name of phases) assert.ok(phaseShown(shown, name, phases), `its phase ${name}`);
  for (const { Name } of rowsOf(LAB_FLOW, "## Roles")) assert.ok(role(target, Name), `its role ${Name}`);
  for (const { Condition } of rowsOf(LAB_FLOW, "## Gates")) assert.ok(shown.some((entry) => entry.includes(Condition)), `its gate "${Condition}"`);
});

// TST-472490 · level: release · module: MOD-implementation-pages
// guards: THE MODEL DETERMINES THE PHASES AND THE GATES
// given: a product declaring lab-flow — four phases; its gates between Outline and Assemble and between Probe and Handover —, its roles named, and no participant
// input: routes.process(app)
// expect: the workflow shown is lab-flow's: its four phases, and each of its gates where it sits
test("THE MODEL DETERMINES THE PHASES AND THE GATES: the workflow shows the model's phases, and its gates where they sit", async (t) => {
  const { target } = await openPage(t, { instance: { [LAB_FLOW_PATH]: LAB_FLOW },
    product: { "docs/process.md": labFlowDeclaration({}) } });

  const shown = shownEntries(target);
  const phases = rowsOf(LAB_FLOW, "## Phases").map(({ Name }) => Name);
  for (const name of phases) assert.ok(phaseShown(shown, name, phases), `the phase ${name}`);
  for (const gate of rowsOf(LAB_FLOW, "## Gates")) {
    const [from, to] = gate.Between.split(" → ");
    assert.ok(shown.some((entry) => new RegExp(`${escape(from)}\\s*(→|->|to)\\s*${escape(to)}`).test(entry) && entry.includes(gate.Condition)),
      `the gate "${gate.Condition}", between ${from} and ${to}`);
  }
});

// TST-472491 · level: release · module: MOD-implementation-pages
// guards: THE MODEL DETERMINES THE PHASES AND THE GATES
// given: a product declaring lab-flow — its transitions Outline → Assemble → Probe → Handover and back from Probe to Assemble; its first and its last phase paired for verification, Outline checked by Handover
// input: routes.process(app)
// expect: the workflow shows the transitions between the phases and which phases pair for verification
test("THE MODEL DETERMINES THE PHASES AND THE GATES: the workflow shows the model's transitions and its verification pairs", async (t) => {
  const { target } = await openPage(t, { instance: { [LAB_FLOW_PATH]: LAB_FLOW },
    product: { "docs/process.md": labFlowDeclaration({}) } });

  const shown = shownEntries(target);
  for (const { From, To } of rowsOf(LAB_FLOW, "## Transitions")) {
    assert.ok(shown.some((entry) => new RegExp(`${escape(From)}\\s*(→|->|to)\\s*${escape(To)}`).test(entry)), `the transition ${From} → ${To}`);
  }
  for (const pair of rowsOf(LAB_FLOW, "## Verification pairs")) {
    assert.ok(shown.some((entry) => entry.includes(pair.Phase) && entry.includes(pair["Checked by"])), `${pair.Phase}, checked by ${pair["Checked by"]}`);
  }
});

// TST-472492 · level: release · module: MOD-implementation-pages
// guards: A GATE NAMES WHAT IT CHECKS
// given: a product declaring lab-flow, whose gates check ARC — "the architecture is accepted" — and TST — "every test is green"
// input: routes.process(app)
// expect: each gate is shown with the artifacts that must exist and the condition that must hold
test("A GATE NAMES WHAT IT CHECKS: each gate is shown with its artifacts and its condition", async (t) => {
  const { target } = await openPage(t, { instance: { [LAB_FLOW_PATH]: LAB_FLOW },
    product: { "docs/process.md": labFlowDeclaration({}) } });

  const shown = shownEntries(target);
  for (const gate of rowsOf(LAB_FLOW, "## Gates")) {
    assert.ok(shown.some((entry) => entry.includes(gate.Between) && new RegExp(`\\b${gate.Artifacts}\\b`).test(entry) && entry.includes(gate.Condition)),
      `${gate.Between}: ${gate.Artifacts}, "${gate.Condition}"`);
  }
});

// TST-472493 · level: release · module: MOD-implementation-pages
// guards: A PRACTICE IS NOT A MODEL
// given: a product without a declaration; the shipped practices
// input: the author chooses Scrum, adds the practice devops, completes the declaration and presses Save
// expect: no practice is offered to choose as the model; the saved declaration names Scrum as its model and devops among its practices
test("A PRACTICE IS NOT A MODEL: no practice is offered instead of a model; one added keeps the model", async (t) => {
  const page = await openPage(t);
  const { target } = page;
  for (const practice of PRACTICES) assert.ok(!modelsOffered(target).includes(practice), `${practice} is not offered as a model`);

  await choose(target, "scrum");
  await typeSection(target, "## Practices", "\n- devops\n");
  await typeSection(target, "## Branches", "\n| Phase or time box | Branch |\n|---|---|\n");
  await typeSection(target, "## Definition of Done", "\nThe job rules hold; no condition is added.\n");
  await pressSave(page);

  const text = page.product.files["docs/process.md"];
  assert.ok(text, "known positive: the declaration is saved");
  assert.match(text, /^model: scrum$/m);
  assert.match(text, /^- devops$/m);
});

// TST-472494 · level: release · module: MOD-implementation-pages
// guards: A PROCESS REQUIREMENT ADDS TO THE MODEL
// given: a product declaring Kanban, its process requirement REQUIREMENT adding a gate between Review and Done that checks the verification record of the item
// input: routes.process(app)
// expect: the workflow holds Kanban's own phases and its own gate, as kanban.md states them, and in addition the requirement's gate with its artifact; the model is still Kanban
test("A PROCESS REQUIREMENT ADDS TO THE MODEL: the requirement's gate is added, the model's own phases and gate stay", async (t) => {
  const { target } = await openPage(t, { product: { "docs/process.md": kanbanDeclaration({
    added: [[REQUIREMENT, "Review → Done", "the verification record of the item", "the verification is documented", "Reviewer"]] }) } });

  const kanban = catalogueFile("models/kanban.md");
  const shown = shownEntries(target);
  assert.equal(fieldValue(target, "model"), "kanban", "the model is still Kanban");
  const phases = rowsOf(kanban, "## Phases").map(({ Name }) => Name);
  for (const name of phases) assert.ok(phaseShown(shown, name, phases), `Kanban's phase ${name}`);
  for (const gate of rowsOf(kanban, "## Gates")) assert.ok(shown.some((entry) => entry.includes(gate.Condition)), `Kanban's own gate ${gate.Between}`);
  assert.ok(shown.some((entry) => entry.includes(REQUIREMENT) && entry.includes("the verification record of the item")), "the requirement's gate, with its artifact");
});

// ---------------------------------------------------------------- 7. the person's own input; 16. usability

// TST-472495 · level: release · module: MOD-implementation-pages
// guards: A PERSON'S OWN INPUT IS COMMITTED DIRECTLY
// given: a product declaring Scrum, its default branch main; the author's own token
// input: the author adds the condition "review: 1 by participants other than the implementer" to the Definition of Done and presses Save
// expect: the declaration is committed straight onto the product's default branch, main — no other branch is made, no pull request opened —, each request that writes carrying the author's own token
test("A PERSON'S OWN INPUT IS COMMITTED DIRECTLY: Save commits onto the product's default branch, under the author's own token", async (t) => {
  const page = await openPage(t, { product: { "docs/process.md": scrumDeclaration({}) } });
  await typeSection(page.target, "## Definition of Done", "\nreview: 1 by participants other than the implementer\n");
  await pressSave(page);

  assert.match(page.product.files["docs/process.md"], /^review: 1 by participants other than the implementer$/m,
    "the default branch holds the author's input");
  assert.ok(page.sent.some((request) => request.method === "PATCH" && request.path === `/repos/${PRODUCT}/git/refs/heads/main`), "the default branch moves on");
  assert.ok(!page.sent.some((request) => /\/pulls\b/.test(request.path) || (request.method === "POST" && /\/git\/refs$/.test(request.path))),
    "no branch is made and no pull request opened");
  assert.ok(page.sent.every((request) => String(request.authorization).includes(TOKEN)), "every write carries the author's own token");
});

// TST-472496 · level: release · module: MOD-implementation-pages
// guards: ONE CLICK PER DECISION
// given: a product declaring Scrum; the author's edit complete — a condition added to the Definition of Done
// input: one click on Save
// expect: before the click nothing is written; the one click commits the declaration, and nothing more is asked
test("ONE CLICK PER DECISION: one click on Save, once the declaration is complete, does all that follows", async (t) => {
  const page = await openPage(t, { product: { "docs/process.md": scrumDeclaration({}) } });
  await typeSection(page.target, "## Definition of Done", "\nreview: 1 by participants other than the implementer\n");
  assert.equal(page.product.writes.length, 0, "nothing is written before the click");

  await pressSave(page);
  assert.equal(page.product.writes.length, 1, "the one click commits");
  assert.match(page.product.writes[0].files["docs/process.md"], /^review: 1 by participants other than the implementer$/m);
});

// TST-472497 · level: release · module: MOD-implementation-pages
// guards: EVERY STEP EXPLAINS ITSELF
// given: a product without a declaration
// input: the author chooses Scrum
// expect: each step that asks something of the author — the model, the roles' holders, a branch, the practices, the Definition of Done — carries an explanation that can be expanded
test("EVERY STEP EXPLAINS ITSELF: each step that asks something carries an explanation that can be expanded", async (t) => {
  const { target } = await openPage(t);
  await choose(target, "scrum");

  const all = explanations(target);
  for (const [step, about] of [["the model", /process model/i], ["the roles' holders", /\brole/i], ["a branch", /\bbranch/i],
    ["the practices", /\bpractice/i], ["the Definition of Done", /Definition of Done/]]) {
    assert.ok(all.some((d) => about.test(textOf(d)) && byTag(d, "summary").length === 1), `${step}: an explanation that can be expanded`);
  }
});

// ---------------------------------------------------------------- 5. participants and roles

// TST-472498 · level: release · module: MOD-implementation-pages
// guards: A ROLE NAMES THE CAPABILITIES IT NEEDS
// given: Scrum's Developers, needing to read and to write the repository and to run code and tests; endpoint-x, a model endpoint, can neither write to the repository nor run code and tests
// input: routes.process(app) of a product declaring Scrum
// expect: the page shows what the Developers need; endpoint-x is not offered to them. Assigning it all the same is the role assignment's, and refused there (tests/product-process-eligibility.test.mjs)
test("A ROLE NAMES THE CAPABILITIES IT NEEDS: the page shows what a role needs, and only a participant with all of them is offered", async (t) => {
  const page = await openPage(t, { product: { "docs/process.md": scrumDeclaration({}) } });
  const { target } = page;
  const developers = roleText(target, "Developers");
  for (const capability of rowsOf(catalogueFile("models/scrum.md"), "## Roles").find((r) => r.Name === "Developers").Capabilities.split(", ")) {
    assert.ok(developers.includes(capability), `the Developers need: ${capability}`);
  }
  assert.ok(!developers.includes("endpoint-x"), "endpoint-x is not offered");
});

// ---------------------------------------------------------------- 13. Definition of Done and branches

// TST-472499 · level: release · module: MOD-implementation-pages
// guards: A PRODUCT DECLARES ITS DEFINITION OF DONE
// given: a product declaring Scrum with no condition added to the job rules
// input: the author adds the condition "review: 1 by participants other than the implementer" and presses Save; the page is opened again
// expect: the condition is in the product's own docs/process.md, under ## Definition of Done; opened again, the page shows it in the Definition of Done
test("A PRODUCT DECLARES ITS DEFINITION OF DONE: a condition the author adds is declared in the product's own repository", async (t) => {
  const page = await openPage(t, { product: { "docs/process.md": scrumDeclaration({}) } });
  await typeSection(page.target, "## Definition of Done", "\nreview: 1 by participants other than the implementer\n");
  await pressSave(page);

  const text = page.product.files["docs/process.md"];
  assert.match(text.split("## Definition of Done")[1] ?? "", /^review: 1 by participants other than the implementer$/m, "declared in the product's docs/process.md");
  const again = await openPage(t, { product: { "docs/process.md": text } });
  assert.ok(doneConditions(again.target).some((condition) => condition.includes("review: 1 by participants other than the implementer")), "shown in the Definition of Done");
});

// TST-472500 · level: release · module: MOD-implementation-pages
// guards: THE DEFAULT DEFINITION OF DONE IS THE JOB RULES
// given: a product without a declaration, so without a Definition of Done of its own
// input: the author chooses Kanban
// expect: the Definition of Done shown is the job rules: CI green; the job's first commit held only failing tests — for a refactoring job, CI green on every commit and no expected result changed —; only the job's modules changed; every new test names the requirement it guards and the module it exercises; every gate before the merge recorded
test("THE DEFAULT DEFINITION OF DONE IS THE JOB RULES: without a declaration, the Definition of Done shown is the job rules", async (t) => {
  const { target } = await openPage(t);
  await choose(target, "kanban");

  const conditions = doneConditions(target);
  for (const [rule, parts] of Object.entries(JOB_RULES)) assert.ok(conditions.some((c) => parts.every((part) => part.test(c))), `the job rule: ${rule}`);
});

// TST-472501 · level: release · module: MOD-implementation-pages
// guards: THE DEFAULT DEFINITION OF DONE IS THE JOB RULES
// given: a product without a declaration
// input: the author chooses Kanban
// expect: every condition the Definition of Done shows is one of the five job rules: CI green; the job's first commit held only failing tests — for a refactoring job, CI green on every commit and no expected result changed —; only the job's modules changed; every new test names the requirement it guards and the module it exercises; every gate before the merge recorded
test("THE DEFAULT DEFINITION OF DONE IS THE JOB RULES: without a declaration, no condition beyond the job rules", async (t) => {
  const { target } = await openPage(t);
  await choose(target, "kanban");

  const conditions = doneConditions(target);
  assert.ok(conditions.length, "known positive: the Definition of Done shows conditions");
  for (const condition of conditions) {
    assert.ok(Object.values(JOB_RULES).some((parts) => parts.every((part) => part.test(condition))), `"${condition}" is one of the job rules`);
  }
});

// TST-472502 · level: release · module: MOD-implementation-pages
// guards: A PHASE OR A TIME BOX MAY HAVE A BRANCH OF ITS OWN
// given: a product declaring Scrum with no branch
// input: the author gives the sprint the branch sprint/<nn> and presses Save; the page is opened again
// expect: the declaration gives the sprint its branch; opened again, the page shows the branch for the sprint
test("A PHASE OR A TIME BOX MAY HAVE A BRANCH OF ITS OWN: the sprint is given a branch of its own", async (t) => {
  const page = await openPage(t, { product: { "docs/process.md": scrumDeclaration({}) } });
  await typeSection(page.target, "## Branches", "\n| Phase or time box | Branch |\n|---|---|\n| Sprint | sprint/<nn> |\n");
  await pressSave(page);

  const text = page.product.files["docs/process.md"];
  assert.match(text, /^\|\s*Sprint\s*\|\s*sprint\/<nn>\s*\|$/m, "declared");
  const again = await openPage(t, { product: { "docs/process.md": text } });
  assert.ok(shownEntries(again.target).some((entry) => entry.includes("Sprint") && entry.includes("sprint/<nn>")), "shown for the sprint");
});

// TST-472503 · level: release · module: MOD-implementation-pages
// guards: A PHASE OR A TIME BOX MAY HAVE A BRANCH OF ITS OWN
// given: a product declaring Scrum, its sprint given the branch sprint/<nn>
// input: routes.process(app)
// expect: merging the sprint's branch into the default branch is shown as the gate at the sprint's end, decided by the role Scrum names for it, the Product Owner, after the review of the increment
test("A PHASE OR A TIME BOX MAY HAVE A BRANCH OF ITS OWN: merging the branch into the default branch is the gate at its end, decided by the Product Owner after the review", async (t) => {
  const { target } = await openPage(t, { product: { "docs/process.md": scrumDeclaration({ branches: [["Sprint", "sprint/<nn>"]] }) } });

  const shown = shownEntries(target);
  assert.ok(shown.some((entry) => entry.includes("sprint/<nn>")), "known positive: the sprint's branch is shown");
  assert.ok(shown.some((entry) => /sprint\/<nn>|sprint['’]s branch|sprint branch/i.test(entry) && /default branch|\bmain\b/.test(entry)
    && entry.includes("Product Owner") && /review/i.test(entry)),
  "the gate at the sprint's end: its branch merged into the default branch, decided by the Product Owner after the review");
});

// TST-472504 · level: release · module: MOD-implementation-pages
// guards: WORK MERGES INTO THE DEFAULT BRANCH UNLESS A BRANCH IS SET
// given: a product declaring Scrum with no branch for any phase or sprint
// input: routes.process(app)
// expect: no branch is shown for the sprint, and the page says that the work of every job is merged into the default branch; known positive: once the sprint is given a branch, the page shows it
test("WORK MERGES INTO THE DEFAULT BRANCH UNLESS A BRANCH IS SET: without a branch, the page says the work merges into the default branch", async (t) => {
  const branched = await openPage(t, { product: { "docs/process.md": scrumDeclaration({ branches: [["Sprint", "sprint/<nn>"]] }) } });
  assert.ok(shownEntries(branched.target).some((entry) => entry.includes("sprint/<nn>")), "known positive: a branch set is shown");

  const { target } = await openPage(t, { product: { "docs/process.md": scrumDeclaration({}) } });
  assert.ok(!shownEntries(target).some((entry) => /sprint\//.test(entry)), "no branch is shown");
  assert.match(textOf(target), /the work of every job is merged into the default branch/);
});

// TST-472505 · level: release · module: MOD-implementation-pages
// guards: A GATE NAMES WHO DECIDES IT
// given: a product declaring lab-flow, whose gate Outline → Assemble is decided by the role Steward, held by a person, and whose gate Probe → Handover by the CI check lab-tests
// input: routes.process(app)
// expect: each gate is shown with its decider: the role Steward; the check lab-tests, whose result decides
test("A GATE NAMES WHO DECIDES IT: each gate is shown with its decider, a role or an automated check", async (t) => {
  const { target } = await openPage(t, { instance: { [LAB_FLOW_PATH]: LAB_FLOW },
    product: { "docs/process.md": labFlowDeclaration({}) } });

  const shown = shownEntries(target);
  assert.ok(shown.some((entry) => entry.includes("Outline → Assemble") && entry.includes("Steward")), "Outline → Assemble, decided by Steward");
  assert.ok(shown.some((entry) => entry.includes("Probe → Handover") && /check\W+lab-tests/.test(entry)), "Probe → Handover, decided by the check lab-tests");
});
