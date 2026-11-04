// The system tests of UC-002, Choose how the product is developed (ITM-223): its main flow and every alternative flow it
// names, walked through the route How this product is developed as the dashboard reaches it — docs/assets/dashboard/
// tests/implementation-pages-process-route.mjs's routes.process(app) —, over two fixture repositories behind MOD-repository-hosts' real connect(): an
// instance (its participants, a process model of its own, the SPEC that holds a process requirement, a restricted source,
// the shipped practices' files) and a product. Every expected result is UC-002's; where the page and UC-002 disagree, the
// test follows UC-002 and is marked todo with its FINDING. ITM-223's findings F1 to F7, which ITM-240 and ITM-241 settle,
// are no longer marked (ITM-242).
//
// Written by tester-opus (claude-opus-5-5), the release tester, who implemented none of the behaviour tested here.
//
// Run: node --test tests/system-uc-002-choose-a-process-model.test.mjs
//
// Module: MOD-implementation-pages
// Guards: UC-002
// Level: system
//
// The page is reached the way tests/dashboard-process-view.test.mjs reaches it: its small DOM, copied below unchanged, a
// minimal app as that helper reads it, and tests/app-harness.mjs's repoServer for each repository. The product's
// server hands every request for the instance to the instance's server, through repoServer's own `handlers`.

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

// A second process of the instance, with lab-flow's phases and roles, whose phases produce requirements, MOD and TST —
// not ARC and ITM, which lab-flow's produce (UC-002 3b).
const LAB_LITE_PATH = "docs/process-models/lab-lite.md";
const LAB_LITE = `---
name: lab-lite
kind: planned
measure: plan entries per phase
---
# Lab lite

The fixture organisation's lighter process.

## About

manages: the lab's lighter fixture risk
accepts: the lab's lighter accepted risk
example: a small lab fixture project
chapter: 6, a fixture chapter

## Phases

| Name | Role | Produces |
|---|---|---|
| Outline | Steward | requirements |
| Assemble | Builders | MOD |
| Probe | Prober | TST |
| Handover | Steward | — |

## Transitions

| From | To | Kind |
|---|---|---|
| Outline | Assemble | sequence |
| Assemble | Probe | sequence |
| Probe | Handover | sequence |

## Verification pairs

| Phase | Checked by |
|---|---|
| Assemble | Probe |

## Gates

| Between | Artifacts | Condition | Decider |
|---|---|---|---|
| Probe → Handover | TST | every test is green | Steward |

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

// The gate REQUIREMENT adds to Scrum, as a declaration names it.
const ADDED_TO_SCRUM = [REQUIREMENT, "Development → Sprint Review", "the verification record of the increment",
  "the verification of every selected item is documented", "Product Owner"];

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

// The table that keeps the process model and the rules to be met apart (UC-002, before its main flow).
const rulesTable = (target) => byTag(target, "table").find((table) => /process model/i.test(textOf(byTag(table, "thead")[0] ?? table))
  && /rules to be met/i.test(textOf(byTag(table, "thead")[0] ?? table)));
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
// The shipped practices' files as an instance holds them: a fork of Agent M (AN INSTANCE IS A FORK OF AGENT M), it holds
// each where Agent M ships it, in src/model-catalogue/practices/.
const PRACTICE_FILES = Object.fromEntries(PRACTICES.map((name) =>
  [`src/model-catalogue/practices/${name}.md`, catalogueFile(`practices/${name}.md`)]));
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

// ---------------------------------------------------------------- the main flow

// TST-476019 · level: system · module: MOD-implementation-pages
// guards: UC-002
// given: a product without a declaration, its page opened for the first time, then once more
// input: routes.process(app), twice
// expect: (step 1) the page opens with the table that keeps the process model and the rules to be met apart, not folded at the first reading; at the next opening, after the first reading, it is folded
test("UC-002 main flow, step 1: the page opens with the table of the process model and the rules to be met, folded only after the first reading", async (t) => {
  const first = await openPage(t);
  const table = rulesTable(first.target);
  assert.ok(table, "known positive: the page holds the table");
  assert.ok(!folded(table, first.target), "at the first reading, the table is not folded");

  const next = await openPage(t);
  assert.ok(folded(rulesTable(next.target), next.target), "after the first reading, the table is folded");
});

// TST-476020 · level: system · module: MOD-implementation-pages
// guards: UC-002
// given: a product without a declaration; the shipped catalogue
// input: routes.process(app)
// expect: (steps 1–2) the page, How this product is developed, holds the table of the process model and the rules to be met — what each answers, where it comes from, examples, its effect —; it offers exactly the book's five models, in two groups — plan-driven: waterfall, V-model, reuse-oriented; agile: Scrum, Kanban —, each with the risk it manages, the risk it accepts, the example project it suits and its chapter, as its data file states
test("UC-002 main flow, steps 1–2: the table, then the book's five models in their two groups, each with its risks, its example and its chapter", async (t) => {
  const { target } = await openPage(t);

  assert.match(textOf(target), /How this product is developed/);
  const table = rulesTable(target);
  assert.ok(table, "the table of the process model and the rules to be met");
  for (const row of ["answers", "comes from", "examples", "effect"]) assert.match(textOf(table), new RegExp(row), `the table's row ${row}`);

  assert.deepEqual(modelsOffered(target).sort(), [...SHIPPED].sort(), "the book's five models, and no other");
  const groupOf = (name) => card(target, name).parentNode;
  const labelOf = (group) => textOf(group.children.find((e) => /^h[1-6]$/.test(e.localName)) ?? group);
  assert.ok(["v-model", "reuse-oriented"].every((name) => groupOf(name) === groupOf("waterfall")), "waterfall, V-model and reuse-oriented stand together");
  assert.ok(groupOf("kanban") === groupOf("scrum"), "Scrum and Kanban stand together");
  assert.ok(groupOf("scrum") !== groupOf("waterfall"), "in two groups");
  assert.match(labelOf(groupOf("waterfall")), /plan-driven/i);
  assert.match(labelOf(groupOf("scrum")), /agile/i);
  for (const name of SHIPPED) {
    const data = catalogueFile(`models/${name}.md`);
    for (const key of ["manages", "accepts", "example", "chapter"]) {
      assert.ok(valueOf(data, key), `known positive: ${name}'s data file states its ${key}`);
      assert.ok(textOf(card(target, name)).includes(valueOf(data, key)), `${name}: its ${key} is shown`);
    }
  }
});

// TST-476021 · level: system · module: MOD-implementation-pages
// guards: UC-002
// given: a product without a declaration; the instance's participants, one of each type: alice (a person), endpoint-x (a model endpoint, which can neither write to the repository nor run code and tests), ci-bot, cli-bot, box-bot
// input: the author chooses Scrum
// expect: (steps 3–4) Scrum is the model chosen; its roles are shown as UC-002 names them — the Product Owner a person or an agent, the Scrum Master either, the Developers either, needing "write to the repository" and "run code and tests"; no participant is offered here — who fills the roles is the role assignment's, on the Roles page (UC-048)
test("UC-002 main flow, steps 3–4: the author chooses Scrum; its roles, who may fill each and what it needs; who fills them is the Roles page's", async (t) => {
  const { target } = await openPage(t);
  await choose(target, "scrum");

  assert.equal(fieldValue(target, "model"), "scrum", "Scrum is chosen");
  assert.match(roleText(target, "Product Owner"), /either|person or (an )?agent/);
  assert.match(roleText(target, "Scrum Master"), /either/);
  const developers = roleText(target, "Developers");
  assert.match(developers, /either/);
  for (const capability of ["write to the repository", "run code and tests"]) assert.ok(developers.includes(capability), `the Developers need: ${capability}`);
  for (const name of ["alice", "ci-bot", "cli-bot", "box-bot", "endpoint-x"]) assert.ok(!developers.includes(name), `${name} is not offered here`);
  assert.match(developers, /Roles/, "the Developers link to the Roles page");
});

// TST-476022 · level: system · module: MOD-implementation-pages
// guards: UC-002
// given: a product without a declaration
// input: the author chooses Scrum
// expect: (step 5) the page shows Scrum's phases, and each of its gates with what it checks — its artifacts and its condition — and who decides it, as scrum.md states them; with no branch set, it says that the work merges into the default branch (preset none)
test("UC-002 main flow, step 5: the phases, each gate with what it checks and who decides it; without a branch, work merges into the default branch", async (t) => {
  const { target } = await openPage(t);
  await choose(target, "scrum");

  const scrum = catalogueFile("models/scrum.md");
  const shown = shownEntries(target);
  const phases = rowsOf(scrum, "## Phases").map(({ Name }) => Name);
  for (const name of phases) assert.ok(phaseShown(shown, name, phases), `the phase ${name}`);
  for (const gate of rowsOf(scrum, "## Gates")) {
    assert.ok(shown.some((entry) => [gate.Artifacts, gate.Condition, gate.Decider].every((part) => entry.includes(part))),
      `the gate ${gate.Between}, with its artifacts, its condition and its decider`);
  }
  assert.match(textOf(target), /merged into the default branch/, "preset none: the work merges into the default branch");
});

// TST-476023 · level: system · module: MOD-implementation-pages
// guards: UC-002
// given: a product without a declaration
// input: the author chooses Scrum
// expect: (step 5) the page shows the transitions between Scrum's phases and which of them pair for verification, as scrum.md states them
test("UC-002 main flow, step 5: the transitions between the phases, and which phases pair for verification", async (t) => {
  const { target } = await openPage(t);
  await choose(target, "scrum");

  const scrum = catalogueFile("models/scrum.md");
  const shown = shownEntries(target);
  for (const { From, To } of rowsOf(scrum, "## Transitions")) {
    assert.ok(shown.some((entry) => new RegExp(`${escape(From)}\\s*(→|->|to)\\s*${escape(To)}`).test(entry)), `the transition ${From} → ${To}`);
  }
  for (const pair of rowsOf(scrum, "## Verification pairs")) {
    assert.ok(shown.some((entry) => entry.includes(pair.Phase) && entry.includes(pair["Checked by"]) && /check|verif/i.test(entry)),
      `the verification pair: ${pair.Phase}, checked by ${pair["Checked by"]}`);
  }
});

// TST-476024 · level: system · module: MOD-implementation-pages
// guards: UC-002
// given: a product declaring Scrum, its sprint given a branch of its own, sprint/<nn>
// input: routes.process(app)
// expect: (step 5) the page shows the sprint's branch, and that merging it into the default branch is the gate at the sprint's end, decided by the Product Owner after the review of the increment
test("UC-002 main flow, step 5: a sprint's branch of its own, and its merge into the default branch as the gate at its end, decided by the Product Owner after the review", async (t) => {
  const { target } = await openPage(t, { product: { "docs/process.md": scrumDeclaration({ branches: [["Sprint", "sprint/<nn>"]] }) } });

  const shown = shownEntries(target);
  assert.ok(shown.some((entry) => entry.includes("sprint/<nn>")), "known positive: the sprint's branch is shown");
  assert.ok(shown.some((entry) => /sprint\/<nn>|sprint['’]s branch|sprint branch/i.test(entry) && /default branch|\bmain\b/.test(entry)
    && entry.includes("Product Owner") && /review/i.test(entry)),
  "the gate at the sprint's end: its branch merged into the default branch, decided by the Product Owner after the review");
});

// TST-476025 · level: system · module: MOD-implementation-pages
// guards: UC-002
// given: a product without a declaration; the shipped practices
// input: the author chooses Scrum and adds the practice devops
// expect: (step 6) the page offers the practices DevOps, prototyping, incremental delivery and the scaling layers, each with the models it fits as its data file states them; with DevOps added, the model is still Scrum
test("UC-002 main flow, step 6: the practices, each with the models it fits; adding one leaves the model as it is", async (t) => {
  const { target } = await openPage(t);
  await choose(target, "scrum");

  const shown = shownEntries(target);
  for (const name of PRACTICES) {
    const fits = [...catalogueFile(`practices/${name}.md`).split("---")[1].matchAll(/^\s+- (.+)$/gm)].map((m) => m[1].trim());
    assert.ok(fits.length, `known positive: ${name}'s data file names the models it fits`);
    assert.ok(shown.some((entry) => entry.includes(name) && fits.every((model) => entry.includes(model))), `${name}, with the models it fits`);
  }
  await typeSection(target, "## Practices", "\n- devops\n");
  assert.equal(fieldValue(target, "model"), "scrum", "the practice replaces no model");
});

// TST-476026 · level: system · module: MOD-implementation-pages
// guards: UC-002
// given: a product without a declaration; the shipped practices, whose files the instance holds as a fork of Agent M does (PRACTICE_FILES)
// input: the author chooses Scrum
// expect: (step 6) each practice says what it adds — the first item of its data file's ## Adds, by its name
test("UC-002 main flow, step 6: each practice says what it adds", async (t) => {
  const { target } = await openPage(t, { instance: PRACTICE_FILES });
  await choose(target, "scrum");

  const shown = shownEntries(target).join("\n");
  for (const name of PRACTICES) {
    const adds = catalogueFile(`practices/${name}.md`).split("## Adds")[1].split("\n## ")[0];
    const first = /^(?:- |\d+\. )(.+)$/m.exec(adds)[1].replace(/\*/g, "").split(/:| — /)[0].trim();
    assert.ok(first, `known positive: ${name}'s data file says what it adds`);
    assert.ok(shown.includes(first), `${name}: what it adds — "${first}" — is shown`);
  }
});

// TST-476027 · level: system · module: MOD-implementation-pages
// guards: UC-002
// given: a product declaring Scrum whose process requirement adds a gate — REQUIREMENT, accepted from the standard SRC-standard-fixture, names the gate Development → Sprint Review with the verification record of the increment
// input: routes.process(app)
// expect: (step 7) the page shows the gate and the artifact the requirement adds, marked with the requirement and the source it comes from
test("UC-002 main flow, step 7: what the product's process requirements add, each marked with its requirement and its source", async (t) => {
  const { target } = await openPage(t, { product: { "docs/process.md": scrumDeclaration({ added: [ADDED_TO_SCRUM] }) } });

  assert.ok(shownEntries(target).some((entry) => entry.includes(REQUIREMENT) && entry.includes(STANDARD) && entry.includes(ADDED_TO_SCRUM[2])),
    "the added gate's artifact, marked with its requirement and its source");
});

// TST-476028 · level: system · module: MOD-implementation-pages
// guards: UC-002
// given: a product without a declaration
// input: the author chooses Scrum
// expect: (step 8) the Definition of Done is preset to the rules every implementation job already follows — CI green, the job's first commit held only failing tests, only the job's modules changed, every gate before the merge recorded —; a folded explanation says that in Scrum the Developers meet the Definition of Done, whoever presses merge
test("UC-002 main flow, step 8: the Definition of Done, preset to the job rules, and the folded word on who meets it in Scrum", async (t) => {
  const { target } = await openPage(t);
  await choose(target, "scrum");

  const shown = shownEntries(target);
  const rules = {
    "CI green": [/\bCI( run)? is green/],
    "the job's first commit held only failing tests": [/first commit/, /tests/, /fail|red/],
    "only the job's modules changed": [/job['’]s modules/],
    "every gate before the merge recorded": [/gate/, /merge/, /recorded/],
  };
  for (const [rule, parts] of Object.entries(rules)) assert.ok(shown.some((entry) => parts.every((part) => part.test(entry))), `the job rule: ${rule}`);
  const word = explanations(target).find((d) => /Developers meet the Definition of Done/.test(textOf(d)));
  assert.ok(word, "an explanation says that the Developers meet the Definition of Done");
  assert.match(textOf(word), /Scrum/);
  assert.match(textOf(word), /whoever presses merge/);
  assert.ok(!word.hasAttribute("open"), "folded");
});

// TST-476029 · level: system · module: MOD-implementation-pages
// guards: UC-002
// given: a product without a declaration; the instance's participants, one of each type
// input: the author chooses Scrum; gives the sprint the branch sprint/<nn>; adds the practice devops; adds the condition "review: 1 by participants other than the implementer"; then presses Save, once
// expect: (steps 3–9) nothing is committed before Save; the one click commits docs/process.md to the product repository, once, with the author's token, and nothing to the instance; besides the writes, the page's only POSTs are the three read-only GraphQL requests of greenToMerge (ITM-1170) — declaring exactly one model, Scrum, the practice, the branch and the added condition, and naming no participant: who fills the roles is the product's role assignment (UC-048)
test("UC-002 main flow, steps 3–9: the author's choices, then one click on Save commits the declaration to the product repository", async (t) => {
  const page = await openPage(t);
  const { target } = page;
  await choose(target, "scrum");
  await typeSection(target, "## Practices", "\n- devops\n");
  await typeSection(target, "## Branches", "\n| Phase or time box | Branch |\n|---|---|\n| Sprint | sprint/<nn> |\n");
  await typeSection(target, "## Definition of Done", "\nreview: 1 by participants other than the implementer\n");

  assert.equal(page.product.writes.length, 0, "nothing is committed before Save");
  assert.equal(saveOf(target).disabled, false, "known positive: Save is offered once the declaration is complete");
  await pressSave(page);

  assert.equal(page.product.writes.length, 1, "one commit");
  assert.deepEqual(Object.keys(page.product.writes[0].files), ["docs/process.md"], "of the declaration");
  const text = page.product.writes[0].files["docs/process.md"];
  assert.equal(text.match(/^model:/gm)?.length, 1, "exactly one model");
  assert.match(text, /^model: scrum$/m);
  for (const name of ["alice", "endpoint-x", "ci-bot", "cli-bot", "box-bot"]) assert.ok(!text.includes(name), `${name} is not named`);
  assert.match(text, /^- devops$/m);
  assert.match(text, /^\|\s*Sprint\s*\|\s*sprint\/<nn>\s*\|$/m);
  assert.match(text, /^review: 1 by participants other than the implementer$/m);
  // ITM-1170: the POSTs to /graphql are no writes — the read-only GraphQL request of greenToMerge beside each of the page's three reads of the product's information.
  assert.deepEqual(page.sent.filter((request) => request.path === "/graphql").map((request) => request.method), ["POST", "POST", "POST"], "greenToMerge's GraphQL requests");
  const writes = page.sent.filter((request) => request.path !== "/graphql");
  assert.ok(writes.length > 0 && writes.every((request) => request.path.startsWith(`/repos/${PRODUCT}/`)), "every write goes to the product repository");
  assert.ok(page.sent.every((request) => String(request.authorization).includes(TOKEN)), "with the author's token");
  assert.equal(page.instance.writes.length, 0, "nothing is committed to the instance");
});

// TST-473082 · level: system · module: MOD-implementation-pages
// guards: UC-002
// given: a product without a declaration, its page read once before — UC-002 step 1 shows the table of the process model and the rules to be met unfolded at the first reading only
// input: the page opened again; the author chooses Scrum
// expect: every choice — the model, the roles' holders, a branch, the practices, the Definition of Done — carries a folded "What is this?" with a pointer to the book (Vibe Coding, a chapter)
test("UC-002 main flow: every choice carries a folded What is this? with a pointer to the book", async (t) => {
  await openPage(t);
  const { target } = await openPage(t);
  await choose(target, "scrum");

  const all = explanations(target);
  for (const [choice, about] of [["the model", /process model/i], ["the roles' holders", /\brole/i], ["a branch", /\bbranch/i],
    ["the practices", /\bpractice/i], ["the Definition of Done", /Definition of Done/]]) {
    const own = all.filter((d) => about.test(textOf(d)));
    assert.ok(own.length, `known positive: ${choice} carries a What is this?`);
    assert.ok(own.every((d) => !d.hasAttribute("open")), `${choice}: its What is this? is folded`);
    assert.ok(own.some((d) => /Vibe Coding/.test(textOf(d)) && /chapter/i.test(textOf(d))), `${choice}: its What is this? points to the book`);
  }
});

// ---------------------------------------------------------------- the alternative flows

// TST-476030 · level: system · module: MOD-implementation-pages
// guards: UC-002
// given: the instance's own process lab-flow, added as a data file in the catalogue's format — docs/process-models/ lab-flow.md —, no line of Agent M's code changed; a product without a declaration
// input: routes.process(app); the author chooses lab-flow
// expect: (3a) lab-flow is offered beside the book's five; chosen, the page shows its roles, its phases and its gates as its data file states them
test("UC-002 alternative flow 3a: the organisation's own process, a data file in the catalogue's format, is offered and used", async (t) => {
  const { target } = await openPage(t, { instance: { [LAB_FLOW_PATH]: LAB_FLOW } });

  assert.deepEqual(modelsOffered(target).sort(), [...SHIPPED, "lab-flow"].sort(), "lab-flow, beside the book's five");
  await choose(target, "lab-flow");
  assert.equal(fieldValue(target, "model"), "lab-flow");
  for (const { Name, Capabilities } of rowsOf(LAB_FLOW, "## Roles")) assert.ok(roleText(target, Name).includes(Capabilities), `the role ${Name}`);
  const shown = shownEntries(target);
  const phases = rowsOf(LAB_FLOW, "## Phases").map(({ Name }) => Name);
  for (const name of phases) assert.ok(phaseShown(shown, name, phases), `the phase ${name}`);
  for (const gate of rowsOf(LAB_FLOW, "## Gates")) {
    assert.ok(shown.some((entry) => [gate.Artifacts, gate.Condition, gate.Decider].every((part) => entry.includes(part))), `the gate ${gate.Between}`);
  }
});

// TST-476031 · level: system · module: MOD-implementation-pages
// guards: UC-002
// given: a product declaring lab-flow — whose phases produce requirements, ARC, ITM, MOD and TST —, naming no participant, its declaration naming the gate REQUIREMENT adds (Probe → Handover); in its repository an item and an architecture file; the instance also holds lab-lite, whose phases produce requirements, MOD and TST
// input: the author chooses lab-lite, then presses Save
// expect: (3b) the page lists ARC and ITM as the artifacts lab-lite no longer requires — not requirements, MOD or TST —; the requirement's gate is still shown; the save writes docs/process.md alone, naming lab-lite and keeping the requirement's gate, and the product's item and architecture file stay
test("UC-002 alternative flow 3b: changing the model lists the artifacts the new one no longer requires; none is deleted, and the process requirement keeps its gate", async (t) => {
  const ITEM = "docs/backlog/ITM-001-a-fixture-item.md", ARCHITECTURE = "docs/architecture/ARC-001-a-fixture-decision.md";
  const added = [REQUIREMENT, "Probe → Handover", "TST", "the verification is documented", "Steward"];
  const page = await openPage(t, {
    product: { "docs/process.md": labFlowDeclaration({ added: [added] }), [ITEM]: "# ITM-001\n", [ARCHITECTURE]: "# ARC-001\n" },
    instance: { [LAB_FLOW_PATH]: LAB_FLOW, [LAB_LITE_PATH]: LAB_LITE } });
  const { target } = page;
  const listing = () => shownEntries(target).filter((entry) => /\bARC\b/.test(entry) && /\bITM\b/.test(entry));
  assert.equal(listing().length, 0, "known positive: before the change, no entry lists ARC and ITM together");

  await choose(target, "lab-lite");
  assert.equal(listing().length, 1, "one entry lists what lab-lite no longer requires");
  for (const kept of ["requirements", "MOD", "TST"]) assert.ok(!new RegExp(`\\b${kept}\\b`).test(listing()[0]), `${kept}, which lab-lite requires too, is not listed`);
  assert.ok(shownEntries(target).some((entry) => entry.includes(REQUIREMENT)), "the process requirement's gate is still shown");

  await pressSave(page);
  assert.equal(page.product.writes.length, 1, "known positive: the change is saved");
  assert.deepEqual(Object.keys(page.product.writes[0].files), ["docs/process.md"], "the save writes the declaration alone");
  const text = page.product.writes[0].files["docs/process.md"];
  assert.match(text, /^model: lab-lite$/m);
  assert.match(text, new RegExp(`^\\|\\s*${REQUIREMENT}\\s*\\|\\s*Probe → Handover\\s*\\|`, "m"), "the requirement keeps its gate");
  assert.equal(page.product.files[ITEM], "# ITM-001\n", "the item stays");
  assert.equal(page.product.files[ARCHITECTURE], "# ARC-001\n", "the architecture file stays");
});

// TST-476032 · level: system · module: MOD-implementation-pages
// guards: UC-002
// given: a product declaring Scrum, its declaration naming no gate a process requirement adds
// input: routes.process(app); then REQUIREMENT, accepted, adds its gate — the declaration names it — and the page is opened again
// expect: (7a) first, the view says that the product has no process requirements yet; then the requirement's addition appears, and the model is still Scrum, its own gates shown
test("UC-002 alternative flow 7a: no process requirements yet — the view says so; once one is accepted, its addition appears and the model stays", async (t) => {
  const before = await openPage(t, { product: { "docs/process.md": scrumDeclaration({}) } });
  assert.ok(shownEntries(before.target).some((entry) => /no process requirements/i.test(entry)), "the view says there are none yet");

  const after = await openPage(t, { product: { "docs/process.md": scrumDeclaration({ added: [ADDED_TO_SCRUM] }) } });
  const shown = shownEntries(after.target);
  assert.ok(shown.some((entry) => entry.includes(REQUIREMENT)), "the requirement's addition appears");
  assert.ok(!shown.some((entry) => /no process requirements/i.test(entry)), "and the view no longer says there are none");
  assert.equal(fieldValue(after.target, "model"), "scrum", "the model is still Scrum");
  for (const gate of rowsOf(catalogueFile("models/scrum.md"), "## Gates")) {
    assert.ok(shown.some((entry) => entry.includes(gate.Condition)), `Scrum's own gate ${gate.Between} is still shown`);
  }
});

// TST-476033 · level: system · module: MOD-implementation-pages
// guards: UC-002
// given: a product declaring Kanban — whose one gate, Review → Done, is a review, no release gate —, its process requirement adding the gate Kanban does not have: documented verification before release, between Review and Done
// input: routes.process(app)
// expect: (7b) the page shows the gate being added, marked with its requirement, and where — between Review and Done —; the model stays Kanban, its phases and its own gate shown
test("UC-002 alternative flow 7b: a process requirement needs a gate the model does not have — the gate is shown being added, and where; the model stays Kanban", async (t) => {
  const { target } = await openPage(t, { product: { "docs/process.md": kanbanDeclaration({
    added: [[REQUIREMENT, "Review → Done", "the verification record of the item", "the verification is documented", "Reviewer"]] }) } });

  const kanban = catalogueFile("models/kanban.md");
  const shown = shownEntries(target);
  assert.equal(fieldValue(target, "model"), "kanban", "the model stays Kanban");
  const phases = rowsOf(kanban, "## Phases").map(({ Name }) => Name);
  for (const name of phases) assert.ok(phaseShown(shown, name, phases), `Kanban's phase ${name}`);
  for (const gate of rowsOf(kanban, "## Gates")) assert.ok(shown.some((entry) => entry.includes(gate.Condition)), `Kanban's own gate ${gate.Between}`);
  assert.ok(shown.some((entry) => entry.includes(REQUIREMENT)), "known positive: the gate being added is shown, marked with its requirement");
  assert.ok(shown.some((entry) => entry.includes(REQUIREMENT) && /\bReview\b/.test(entry) && /\bDone\b/.test(entry)), "where it is added: between Review and Done");
});
