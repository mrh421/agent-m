// The frame's fields and buttons wear the site's one look (ITM-1445): the site's style sheet src/site-frame/look.css gives every select, text input and textarea
// the one look of a field, wherever a page draws it, and the buttons the frame draws itself — schemaForm's Save, the decision's Cancel and Accept, the run
// panel's Run and Cancel — carry the frame's class btn (look.css: ".btn, ...").
// Run: node --test tests/site-frame-fields-look.test.mjs
//
// Module: MOD-site-frame
// Guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE; THE SITE WEARS THE PATTERN RECOGNITION LAB'S LOOK
// Level: unit
//
// The expected results are written here from the item's Acceptance ("The site's style sheet gives every `select`, text `input` and `textarea` one look, wherever
// the page draws it"; "The frame's own buttons ... carry `btn`"; "A test draws the pages and names each element out of the look") and from the look look.css
// gives the header's product selector today, and none is read from the code. Readings taken where the texts leave one open:
//   - "The look" of a field is the look look.css gives the product selector (its rule of `select.product`): a border `1px solid var(--line)`, rounded
//     `6px`, and the text colour `var(--fg)`. A field is in the look when the top-level rules of look.css that select it give it these three values, as a
//     browser's cascade picks them (the highest specificity, then the later rule); a rule inside @media, and a rule only for a state (:hover, :disabled) or a
//     position (:nth-child) of an element, is not its look at rest. A scoped rule that gives a field only its size leaves the field in the look.
//   - A "text input" is an <input> a person types into: one whose type is not checkbox, radio or file — the kinds of input the site draws that have a look
//     of their own. Its type is its attribute `type`, or, where a page set only the property, the property, as a browser reflects one into the other.
//   - "The pages" are the routes of the Settings pages, where the probe of ITM-1444 found the fields drawn bare, drawn as tests/settings-pages-look.test.mjs
//     draws them, and the frame's own parts that draw fields or buttons: schemaForm over a backlog item, the dialog of a decision with a reason, and the run panel.
//   - The frame's own buttons are those forms.mjs, decision.mjs and run-panel.mjs draw; the Save that MOD-markdown-render's editor brings into a section's field
//     of schemaForm is that module's, and is not counted here.
//   - The known positive is the textarea of the section editor in schemaForm, which look.css's rule of `.editor textarea` already gives the field's border,
//     radius and colour; and a button of the Settings page `setup`, which carries btn.
// The counter-proofs are in the pull request.

import "./site-frame-dom.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";

const { schemaForm, confirmDecision, runPanel } = await import("../src/site-frame/index.mjs");
const { artifactSchemas, readDocument } = await import("../src/documents/index.mjs");
const { view } = await import("../src/settings-pages/index.mjs");
const { openStore, writeSetting } = await import("../src/browser-store/index.mjs");

const LOOK = readFileSync(new URL("../src/site-frame/look.css", import.meta.url), "utf8");
const FIELD_LOOK = { border: "1px solid var(--line)", "border-radius": "6px", color: "var(--fg)" };
const NOT_TYPED_INTO = ["checkbox", "radio", "file"];

// ---------------------------------------------------------------- the reader of look.css and the cascade of its rules

// The selectors of a list, split at the commas that stand outside parentheses.
function selectorsOf(list) {
  const parts = [];
  let depth = 0, from = 0;
  for (let at = 0; at < list.length; at++) {
    if (list[at] === "(") depth++;
    else if (list[at] === ")") depth--;
    else if (list[at] === "," && depth === 0) { parts.push(list.slice(from, at).trim()); from = at + 1; }
  }
  parts.push(list.slice(from).trim());
  return parts.filter(Boolean);
}

// The top-level rules of a style sheet, in their order: [{ selectors, declarations: { property: value } }]. A block of an at-rule such as @media is skipped whole.
function rulesOf(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [];
  let at = 0;
  while (at < text.length) {
    const open = text.indexOf("{", at);
    if (open < 0) break;
    let depth = 1, end = open + 1;
    for (; end < text.length && depth > 0; end++) { if (text[end] === "{") depth++; else if (text[end] === "}") depth--; }
    const head = text.slice(at, open).trim();
    if (!head.startsWith("@")) {
      const declarations = {};
      for (const declaration of text.slice(open + 1, end - 1).split(";")) {
        const colon = declaration.indexOf(":");
        if (colon > 0) declarations[declaration.slice(0, colon).trim()] = declaration.slice(colon + 1).trim().replace(/\s+/g, " ");
      }
      rules.push({ selectors: selectorsOf(head), declarations });
    }
    at = end;
  }
  return rules;
}

const classes = (node) => String(node.className ?? "").split(/\s+/).filter(Boolean);
const attributeOf = (node, name) => node.getAttribute(name) ?? (name === "type" && typeof node.type === "string" ? node.type : null);

// Whether a node is selected by one compound selector: a type, classes, attributes and :not() of those. Any other pseudo-class or pseudo-element selects
// a state or a position, never the element at rest, so such a compound selects nothing here.
function compoundSelects(node, compound) {
  let rest = compound;
  const type = /^([a-z][a-z0-9-]*|\*)/.exec(rest);
  if (type) {
    if (type[1] !== "*" && node.localName !== type[1]) return false;
    rest = rest.slice(type[0].length);
  }
  while (rest) {
    let part;
    if ((part = /^\.([\w-]+)/.exec(rest))) { if (!classes(node).includes(part[1])) return false; }
    else if ((part = /^\[([\w-]+)(?:="([^"]*)")?\]/.exec(rest))) { const value = attributeOf(node, part[1]); if (value === null || (part[2] !== undefined && value !== part[2])) return false; }
    else if ((part = /^:not\(([^()]*)\)/.exec(rest))) { if (selectorsOf(part[1]).some((inner) => compoundSelects(node, inner))) return false; }
    else return false;
    rest = rest.slice(part[0].length);
  }
  return true;
}

// Whether a node is selected by a complex selector of compounds joined by the descendant and the child combinator; another combinator selects nothing here.
function selects(node, selector) {
  const parts = selector.replace(/\s*>\s*/g, " > ").trim().split(/\s+/);
  const from = (element, index) => {
    if (!compoundSelects(element, parts[index])) return false;
    if (index === 0) return true;
    if (parts[index - 1] === ">") return index >= 2 && element.parentNode?.nodeType === 1 && from(element.parentNode, index - 2);
    for (let up = element.parentNode; up?.nodeType === 1; up = up.parentNode) if (from(up, index - 1)) return true;
    return false;
  };
  return from(node, parts.length - 1);
}

// The specificity of a selector as one number: ids, then classes, attributes and pseudo-classes, then types; :not() counts as its argument.
function specificity(selector) {
  const flat = selector.replace(/:not\(([^()]*)\)/g, " $1 ");
  const count = (pattern) => (flat.match(pattern) ?? []).length;
  return count(/#[\w-]+/g) * 10000 + count(/\.[\w-]+|\[[^\]]*\]|:(?!:)[\w-]+/g) * 100 + count(/(?:^|[\s>+~])[a-z][\w-]*/g);
}

// The values the cascade of the top-level rules of `css` gives a node for `properties`: per property, the declaration of the selecting rule of the highest
// specificity, and of the later rule where two are equal; undefined where no selecting rule declares it.
function cascaded(css, node, properties) {
  const won = {};
  rulesOf(css).forEach((rule, order) => {
    const weights = rule.selectors.filter((selector) => selects(node, selector)).map(specificity);
    if (!weights.length) return;
    const weight = Math.max(...weights);
    for (const property of properties) {
      if (!(property in rule.declarations)) continue;
      const before = won[property];
      if (!before || weight > before.weight || (weight === before.weight && order > before.order)) won[property] = { weight, order, value: rule.declarations[property] };
    }
  });
  return Object.fromEntries(properties.map((property) => [property, won[property]?.value]));
}

// ---------------------------------------------------------------- the elements out of the look

function descendants(root, predicate) {
  const found = [];
  (function visit(node) { for (const child of node.childNodes ?? []) { if (child.nodeType === 1) { if (predicate(child)) found.push(child); visit(child); } } })(root);
  return found;
}
const isField = (node) => node.localName === "select" || node.localName === "textarea"
  || (node.localName === "input" && !NOT_TYPED_INTO.includes(attributeOf(node, "type") ?? "text"));
const nameOf = (node) => {
  const said = node.getAttribute("aria-label") ?? node.getAttribute("name") ?? node.getAttribute("placeholder")
    ?? (node.localName === "button" ? node.textContent.replace(/\s+/g, " ").trim().slice(0, 40) : "");
  const type = node.localName === "input" ? `[type=${attributeOf(node, "type") ?? "text"}]` : "";
  return `${node.localName}${type}${classes(node).map((name) => `.${name}`).join("")}${said ? ` "${said}"` : ""}`;
};
// Each field below `root` that the style sheet `css` does not give the field's look, named with what it is given instead.
function fieldFindings(root, css = LOOK) {
  return descendants(root, isField).flatMap((node) => {
    const given = cascaded(css, node, Object.keys(FIELD_LOOK));
    const off = Object.keys(FIELD_LOOK).filter((property) => given[property] !== FIELD_LOOK[property]);
    return off.length ? [`${nameOf(node)} is out of the look: ${off.map((property) => `${property} ${given[property] ?? "none"}`).join(", ")}`] : [];
  });
}
// Each button below `root` without the frame's class btn, named.
const buttonFindings = (root) => descendants(root, (node) => node.localName === "button" && !classes(node).includes("btn")).map((node) => `${nameOf(node)} has no class btn`);

// ---------------------------------------------------------------- the pages, drawn

class Storage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
}
const ROUTES = ["settings", "setup", "add-product", "endpoints", "participants", "bridge", "mailbox", "library", "sources", "resources", "get-your-own"];
const PARTICIPANTS = `# Participants of this instance

| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |
|---|---|---|---|---|---|---|---|
| a-claude | CLI agent | example-model | 200000 | — | draft text | this machine | bridge laptop agent claude |
| akmaier | person | — | — | — | draft text | — | account github.com/akmaier |
`;
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

// A Settings route drawn in a browser that keeps a Bridge and a mailbox, so that the pages draw their connected states as well as their forms.
async function drawSettings(t, name) {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: new Storage() });
  Object.defineProperty(globalThis, "crypto", { configurable: true, value: webcrypto });
  const store = openStore("fixture/instance");
  writeSetting(store, "bridge:laptop", { address: "http://127.0.0.1:4711", token: "laptop-token" });
  writeSetting(store, "mailbox", { address: "reports@example.test", route: "imap", folders: ["INBOX"], places: [],
    imap: { bridge: "laptop", imap: { host: "imap.example.test", port: 993, security: "tls" }, smtp: { host: "smtp.example.test", port: 587, security: "starttls" }, account: "reports@example.test", password: "constructed" } });
  const prior = globalThis.fetch;
  globalThis.fetch = async () => new Response("{}", { status: 404 });
  t.after(() => { globalThis.fetch = prior; });
  const host = {
    repositoryInfo: async () => ({ defaultBranch: "main", canWrite: true }),
    readSnapshot: async () => ({ paths: ["docs/participants.md"], blob: () => "b".repeat(40), read: async (path) => (path === "docs/participants.md" ? PARTICIPANTS : null), readMany: async () => [] }),
    commitFiles: async () => { throw new Error("nothing is committed"); },
  };
  const target = document.createElement("div");
  document.body.append(target);
  await view.routes.find((route) => route.name === name).render(target, { instance: { repository: "fixture/instance", host }, product: null, store, go() {} }, {});
  await settle();
  return target;
}

// schemaForm over a backlog item: a field for each key of its front matter, and an editor for each of its sections.
const ITEM = ["---", "id: ITM-001", "title: Export keeps every page", "level: module", "realises:", "  - FIRST RULE", "modules:", "  - MOD-store", "tests:", "  - unit",
  "origin:", "  - https://github.com/alice/product/issues/7", "---", "# ITM-001 Export keeps every page", "", "## Outcome", "", "Every page is exported.", "", "## Acceptance", "", "- A unit test.", ""].join("\n");
function drawForm() {
  const schema = artifactSchemas().item;
  const form = schemaForm(schema, readDocument(schema, "docs/backlog/ITM-001-export-keeps-every-page.md", ITEM), { onSave: async () => {} });
  document.body.append(form);
  return form;
}
// The parts of schemaForm the frame draws itself: everything but the editors MOD-markdown-render brings into the fields of the sections.
const ownOf = (form) => {
  const own = form.cloneNode(true);
  for (const field of descendants(own, (node) => node.getAttribute("data-section") !== null)) field.remove();
  return own;
};
const editorsOf = (form) => descendants(form, (node) => node.getAttribute("data-section") !== null);

// The dialog of a decision with a reason, drawn into the page as confirmDecision draws it; answered with Cancel once it has been read.
function drawDecision() {
  const answered = confirmDecision({ title: "Reject the gate", lines: ["The gate stays closed."], confirm: "Reject", reason: true });
  const dialog = descendants(document.body, (node) => classes(node).includes("decision")).at(-1);
  return { dialog, close: async () => { descendants(dialog, (node) => node.textContent === "Cancel")[0].dispatchEvent(new Event("click")); await answered; } };
}

// The run panel of a job that nothing keeps from starting, with Run and Cancel.
const PARTICIPANT = { name: "Erlangen endpoint", type: "model endpoint", model: "model-a", context: 20000, price: null, capabilities: ["draft text"], place: "Erlangen", route: "browser" };
const PART = { name: "SPEC.md", text: "x", size: 1, sources: [], required: true, recipe: "spec", artifacts: [] };
const drawRunPanel = () => runPanel({ kind: { name: "derive-requirements" }, params: {}, drafter: PARTICIPANT, reviewers: [], parts: [PART],
  destinations: [{ participant: PARTICIPANT, role: "drafter", place: "Erlangen", parts: [PART.name], size: 1 }], fits: true, notFitting: [], leftOut: [], blocking: [], limit: 5 },
{ onRun: async () => {}, onCancel: () => {} });

// ---------------------------------------------------------------- the tests

// TST-1445001 · level: unit · module: MOD-site-frame
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: src/site-frame/look.css as committed; schemaForm over a backlog item, whose sections are edited in editors whose textarea look.css's rule of `.editor textarea` gives the field's border, radius and colour; the Settings route setup, whose buttons carry btn
// input: the field check applied to the textareas of the section editors and to a planted <div> holding a bare <select>, a bare <input>, a bare <textarea> and a checkbox; the button check applied to setup and to a planted bare <button>
// expect: known positive — the editors' textareas are at least one field and none is a finding, setup draws at least one button and none is a finding; the planted <select>, <input> and <textarea> are one finding each and the checkbox none; the planted button is one finding, `button "Planted" has no class btn`
test("TST-1445001: a field and a button in the look pass the checks, and bare ones are findings", async (t) => {
  const editors = editorsOf(drawForm());
  assert.ok(editors.flatMap((editor) => descendants(editor, isField)).length > 0, "the section editors draw a textarea");
  assert.deepEqual(editors.flatMap((editor) => fieldFindings(editor)), [], "the section editors' textareas are in the look");
  const setup = await drawSettings(t, "setup");
  assert.ok(descendants(setup, (node) => node.localName === "button").length > 0, "setup draws a button");
  assert.deepEqual(buttonFindings(setup), [], "setup's buttons carry btn");

  const bare = document.createElement("div");
  const box = document.createElement("input");
  box.setAttribute("type", "checkbox");
  bare.append(document.createElement("select"), document.createElement("input"), document.createElement("textarea"), box);
  const planted = { border: "1px solid red", "border-radius": "0", color: "red" };
  assert.deepEqual(fieldFindings(bare, `div select, div input, div textarea { ${Object.entries(planted).map(([property, value]) => `${property}: ${value}`).join("; ")} }`).length, 3,
    "known negative: a planted rule of another look gives three findings");
  assert.deepEqual(fieldFindings(bare, ".elsewhere select { border: 1px solid var(--line); border-radius: 6px; color: var(--fg); }"),
    ['select is out of the look: border none, border-radius none, color none', 'input[type=text] is out of the look: border none, border-radius none, color none',
      'textarea is out of the look: border none, border-radius none, color none'], "known negative: bare fields are findings, the checkbox is none");
  const button = document.createElement("button");
  button.textContent = "Planted";
  const holder = document.createElement("div");
  holder.append(button);
  assert.deepEqual(buttonFindings(holder), ['button "Planted" has no class btn']);
});

// TST-1445002 · level: unit · module: MOD-site-frame
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE; THE SITE WEARS THE PATTERN RECOGNITION LAB'S LOOK
// given: src/site-frame/look.css as committed; every route of MOD-settings-pages, with a stored Bridge and a stored mailbox — the fields of the Bridge, the endpoints, the mailbox, the participants, the library, the resources, the sources, the settings, the products and the setup among them
// input: each route drawn; the field check applied to it
// expect: the routes draw fields, and every select, text input and textarea of every route is given the field's look by look.css: no finding
test("TST-1445002: every field of every Settings page wears the site's one look", async (t) => {
  const findings = [];
  let fields = 0;
  for (const name of ROUTES) {
    const target = await drawSettings(t, name);
    fields += descendants(target, isField).length;
    for (const finding of fieldFindings(target)) findings.push(`${name}: ${finding}`);
  }
  assert.ok(fields > 0, "the Settings pages draw fields");
  assert.deepEqual(findings, []);
});

// TST-1445003 · level: unit · module: MOD-site-frame
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: src/site-frame/look.css as committed; schemaForm over a backlog item, and the dialog of a decision that asks for a reason
// input: the form and the dialog drawn into the page; the field check applied to the form's own fields and to the dialog
// expect: the form's own part holds a field for each of the ten keys of a backlog item's front matter and the dialog the field of the reason, and each is given the field's look by look.css: no finding
test("TST-1445003: the fields the frame draws itself wear the site's one look", async () => {
  const own = ownOf(drawForm());
  const decision = drawDecision();
  assert.deepEqual([descendants(own, isField).length, descendants(decision.dialog, isField).length], [10, 1], "ten fields of the form, one of the dialog");
  const findings = [...fieldFindings(own).map((finding) => `schemaForm: ${finding}`), ...fieldFindings(decision.dialog).map((finding) => `confirmDecision: ${finding}`)];
  await decision.close();
  assert.deepEqual(findings, []);
});

// TST-1445004 · level: unit · module: MOD-site-frame
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: schemaForm over a backlog item; the dialog of a decision; the run panel of a job that nothing keeps from starting, with a Cancel
// input: each drawn; the button check applied to the form's own part, the dialog and the panel
// expect: the buttons are the form's Save, the dialog's Cancel and Reject, the panel's Run and Cancel, and each carries the class btn: no finding
test("TST-1445004: the buttons the frame draws itself carry the frame's class btn", async () => {
  const own = ownOf(drawForm());
  const decision = drawDecision();
  const panel = drawRunPanel();
  const parts = [["schemaForm", own], ["confirmDecision", decision.dialog], ["runPanel", panel]];
  const labels = parts.map(([, root]) => descendants(root, (node) => node.localName === "button").map((node) => node.textContent.trim()));
  const findings = parts.flatMap(([name, root]) => buttonFindings(root).map((finding) => `${name}: ${finding}`));
  await decision.close();
  assert.deepEqual(labels, [["Save"], ["Cancel", "Reject"], ["Run", "Cancel"]]);
  assert.deepEqual(findings, []);
});
