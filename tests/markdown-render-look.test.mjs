// The rendered front matter and the editor's Save wear the site's one look (ITM-1451): the front-matter table renderArtifact draws carries the frame's class list, and the button openEditor
// draws, Save, carries the frame's class btn.
// Run: node --test tests/markdown-render-look.test.mjs
//
// Module: MOD-markdown-render
// Guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// Level: unit
//
// The expected results are written here from the item's Acceptance ("the front-matter table carries list, and the editor's Save carries btn") and from the classes look.css styles (".list",
// ".btn, ..."), and none is read from the code. Readings taken where the texts leave one open:
//   - The ITM-1444 hits are confirmed by drawing: look.css has ".md table" (borders only) and ".editor textarea/.preview" but no rule that gives the front-matter table the rows, header cells and
//     panel of ".list", nor the button the look of ".btn", so no hit is one "a scoped rule already styles". The tables of the Markdown body are styled by ".md table" and are left.
//   - A "front-matter table" is the table with the class frontmatter; a "button" is an element <button>. A link is not checked: neither part draws one as a button.
//   - The editor's preview draws the front matter of the text it shows, so the table is checked in the preview too.
// The checks are shown on the known positive (an element in the look) and the known negative (the element as it is); the counter-proofs are in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import "./markdown-render-dom.mjs";

const { renderArtifact, openEditor } = await import("../src/markdown-render/index.mjs");

const classes = (node) => (node.className ?? "").split(" ").filter(Boolean);
function descendants(root, predicate) {
  const found = [];
  (function visit(node) { for (const child of node.childNodes ?? []) { if (child.nodeType === 1) { if (predicate(child)) found.push(child); visit(child); } } })(root);
  return found;
}
const text = (node) => node.textContent.replace(/\s+/g, " ").trim().slice(0, 40);

// The findings of one drawn page: each front-matter table without list and each button without btn, named by what it holds.
function findings(target) {
  return [
    ...descendants(target, (n) => n.localName === "table" && classes(n).includes("frontmatter") && !classes(n).includes("list")).map((n) => `front-matter table "${text(n)}" has no class list`),
    ...descendants(target, (n) => n.localName === "button" && !classes(n).includes("btn")).map((n) => `button "${text(n)}" has no class btn`),
  ];
}
const tables = (target) => descendants(target, (n) => n.localName === "table" && classes(n).includes("frontmatter"));
const buttons = (target) => descendants(target, (n) => n.localName === "button").map(text);

const WITH_FRONT_MATTER = "---\ntitle: Burn-down\nstatus: open\n---\n# Heading\n\nText.\n";

// TST-1451001 · level: unit · module: MOD-markdown-render
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: a front-matter table with the class list, a bare one, a button with btn and a bare button
// input: the check applied to each
// expect: known positive — the elements in the look are no finding; known negative — each bare element is one finding, named by its text
test("TST-1451001: elements in the look pass the check, and the bare ones are findings", () => {
  const inLook = document.createElement("div");
  const table = document.createElement("table");
  table.className = "frontmatter list";
  table.append("title");
  const good = document.createElement("button");
  good.className = "btn";
  good.append("Save");
  inLook.append(table, good);
  assert.deepEqual(findings(inLook), []);
  const bare = document.createElement("div");
  const badTable = document.createElement("table");
  badTable.className = "frontmatter";
  badTable.append("title");
  const bad = document.createElement("button");
  bad.append("Save");
  bare.append(badTable, bad);
  assert.deepEqual(findings(bare), ['front-matter table "title" has no class list', 'button "Save" has no class btn']);
});

// TST-1451002 · level: unit · module: MOD-markdown-render
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: a text with front matter of two keys and a heading
// input: renderArtifact of it
// expect: exactly one front-matter table is drawn (known positive) and it carries the class list
test("TST-1451002: the front-matter table of a rendered text carries the frame's class list", () => {
  const drawn = renderArtifact(WITH_FRONT_MATTER);
  assert.equal(tables(drawn).length, 1, "known positive: the front-matter table is drawn");
  assert.deepEqual(findings(drawn), []);
});

// TST-1451003 · level: unit · module: MOD-markdown-render
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: an editor opened on a text with front matter
// input: the editor drawn, then the text changed so that the preview is rendered again
// expect: the editor draws one button, Save, with the class btn, and the front-matter table of its preview carries list, before and after the change
test("TST-1451003: the editor's Save carries btn and the front matter of its preview carries list", () => {
  const target = document.createElement("div");
  openEditor(target, WITH_FRONT_MATTER, { marks: () => [], save: async () => ({ kind: "saved", link: "https://example.org/commit/1" }) });
  assert.deepEqual(buttons(target), ["Save"], "known positive: the editor's one button is drawn");
  assert.equal(tables(target).length, 1, "known positive: the preview's front-matter table is drawn");
  assert.deepEqual(findings(target), []);
  const area = descendants(target, (n) => n.localName === "textarea")[0];
  area.value = "---\ntitle: Other\n---\nMore.\n";
  area.dispatchEvent(new Event("input"));
  assert.equal(tables(target).length, 1);
  assert.deepEqual(findings(target), []);
});
