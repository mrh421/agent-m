// The editor's live preview is the box that scrolls (src/site-frame/look.css: `.editor .preview` has `max-height` and `overflow: auto`), so a
// keyboard must be able to reach it: MOD-markdown-render's openEditor draws it with tabindex="0".
// Run: node --test tests/markdown-render-931-preview-focus.test.mjs
//
// Module: MOD-markdown-render
// Guards: THE SITE SERVES A SCREEN READER
// Level: unit
//
// The expected results are written here, in the cases, and none is read from a document. Readings, each adding no word to the sentence it reads:
//   - "can be focused" (the item's Outcome: "The editor's preview can be focused") is read as the element carrying the attribute tabindex with
//     the value "0": it is then in the keyboard's tab order and takes focus when it is clicked or tabbed to. The value is compared as a string.
//   - "the preview" is the one element with the class `preview` that openEditor draws (editor.mjs: `element("div", "preview")`); the known
//     positive is that the search finds exactly one while the editor is drawn.
// The DOM is that of tests/review-pages-harness.mjs, which this imports unchanged (the pattern of tests/markdown-render-close.test.mjs). The
// system-level counter-proof, axe-core's rule scrollable-region-focusable on the edit pages, is in tests/site-accessibility.test.mjs.

import "./review-pages-harness.mjs";
import assert from "node:assert/strict";
import test from "node:test";

const { openEditor } = await import("../src/markdown-render/index.mjs");

const find = (root, match) => {
  const found = [];
  (function walk(node) { for (const child of node.childNodes) if (child.nodeType === 1) { if (match(child)) found.push(child); walk(child); } })(root);
  return found;
};
const previewsIn = (target) => find(target, (node) => node.className.split(" ").includes("preview"));
const areaIn = (target) => find(target, (node) => node.localName === "textarea")[0];
const open = (text) => {
  const target = document.createElement("div");
  const editor = openEditor(target, text, { marks: () => [], save: async () => ({ kind: "saved", link: "https://example.org/commit/1" }) });
  return { target, editor };
};

// TST-931001 · level: unit · module: MOD-markdown-render
// guards: THE SITE SERVES A SCREEN READER
// given: an editor opened on "# Title\n\nText.\n"
// input: the element with the class preview
// expect: exactly one is drawn (the known positive), and its tabindex attribute is the string "0"
test("TST-931001: the preview of an opened editor carries tabindex 0", () => {
  const { target } = open("# Title\n\nText.\n");
  const previews = previewsIn(target);
  assert.equal(previews.length, 1, "known positive: the search finds the preview while the editor is drawn");
  assert.equal(previews[0].getAttribute("tabindex"), "0");
});

// TST-931002 · level: unit · module: MOD-markdown-render
// guards: THE SITE SERVES A SCREEN READER
// given: the same editor, whose text a person changed to "# Other\n\nMore text.\n" (the preview is rendered again on every input)
// input: the element with the class preview, after the input event
// expect: it is still the one preview, its tabindex is still the string "0", and it shows the new text
test("TST-931002: the preview keeps tabindex 0 after the text changed and the preview was rendered again", () => {
  const { target } = open("# Title\n\nText.\n");
  const area = areaIn(target);
  area.value = "# Other\n\nMore text.\n";
  area.dispatchEvent(new Event("input"));
  const previews = previewsIn(target);
  assert.equal(previews.length, 1);
  assert.equal(previews[0].getAttribute("tabindex"), "0");
  assert.equal(previews[0].textContent.includes("More text."), true);
});

// TST-931003 · level: unit · module: MOD-markdown-render
// guards: THE SITE SERVES A SCREEN READER
// given: the same editor, whose draft a participant returned (Editor.showDraft puts it into the text and renders the preview again)
// input: editor.showDraft("# Draft\n\nDrafted.\n", "# Title\n\nText.\n"), then the element with the class preview
// expect: its tabindex is the string "0" and it shows the draft
test("TST-931003: the preview keeps tabindex 0 after a draft was shown", () => {
  const { target, editor } = open("# Title\n\nText.\n");
  editor.showDraft("# Draft\n\nDrafted.\n", "# Title\n\nText.\n");
  const previews = previewsIn(target);
  assert.equal(previews.length, 1);
  assert.equal(previews[0].getAttribute("tabindex"), "0");
  assert.equal(previews[0].textContent.includes("Drafted."), true);
});
