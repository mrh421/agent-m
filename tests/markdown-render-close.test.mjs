// MOD-markdown-render's Editor.close says whether the editor closed (ITM-603), as docs/architecture/MOD-markdown-render.md states it: "`Editor` — `{ …, close() -> boolean }`;
// `close` asks first when the text holds unsaved changes, and says whether the editor closed".
// Run: node --test tests/markdown-render-close.test.mjs
//
// Module: MOD-markdown-render
// Guards: UC-018; EDITS ARE PREPARED ON THE DASHBOARD
// Level: unit
//
// The small DOM is that of tests/review-pages-harness.mjs, which this imports unchanged. The confirmation is replaced for the length of a test by a function that records
// what it is asked and answers from a list, so no dialog of a browser is shown (the pattern of TST-343003). Each test states its input and its expected result in its own
// text; none reads an expected result from the SPEC, a use case or an architecture file. The readings the module file leaves open, which the pull request names:
//   - "whether the editor closed" is the boolean true when the editor's drawing was removed from its target, and the boolean false when it was kept.
//   - "unsaved changes" are those TST-343003 and TST-343004 take: the text differs from the text the editor was opened with or last saved.
// The counter-proofs (a planted fault in src/markdown-render/ and the test's failing result) are recorded in the pull request.

import "./review-pages-harness.mjs";
import assert from "node:assert/strict";
import test from "node:test";

const { openEditor } = await import("../src/markdown-render/index.mjs");

const find = (root, match) => {
  const found = [];
  (function walk(node) { for (const child of node.childNodes) if (child.nodeType === 1) { if (match(child)) found.push(child); walk(child); } })(root);
  return found;
};
const editorsIn = (target) => find(target, (node) => node.className.split(" ").includes("editor")).length;
const areaIn = (target) => find(target, (node) => node.localName === "textarea")[0];
const type = (area, text) => { area.value = text; area.dispatchEvent(new Event("input")); };

// Runs `body` with a confirmation that records its questions in `asked` and answers them from `answers`.
async function withConfirm(answers, body) {
  const prior = Object.getOwnPropertyDescriptor(globalThis, "confirm");
  const asked = [];
  Object.defineProperty(globalThis, "confirm", { configurable: true, value: (message) => { asked.push(message); return answers.shift(); } });
  try { await body(asked); } finally { if (prior) Object.defineProperty(globalThis, "confirm", prior); else delete globalThis.confirm; }
}

// TST-603010 · level: unit · module: MOD-markdown-render
// guards: UC-018; EDITS ARE PREPARED ON THE DASHBOARD
// given: an editor opened on "current\n" whose text a person changed to "changed\n", and a confirmation that first declines, then accepts the discard
// input: editor.close() twice
// expect: the first call returns false, asks "Discard unsaved changes?" and leaves the editor drawn with the text "changed\n" in it; the second returns true, asks the same question again and the editor is removed
test("TST-603010 close of an edited editor returns false when the discard is declined and true when it is accepted", async () => {
  await withConfirm([false, true], async (asked) => {
    const target = document.createElement("div");
    const editor = openEditor(target, "current\n", { marks: () => [], save: async () => ({ kind: "saved", link: "https://example.org/commit/1" }) });
    type(areaIn(target), "changed\n");
    assert.equal(editor.close(), false);
    assert.deepEqual(asked, ["Discard unsaved changes?"]);
    assert.equal(editorsIn(target), 1);
    assert.equal(areaIn(target).value, "changed\n");
    assert.equal(editor.close(), true);
    assert.deepEqual(asked, ["Discard unsaved changes?", "Discard unsaved changes?"]);
    assert.equal(editorsIn(target), 0);
  });
});

// TST-603011 · level: unit · module: MOD-markdown-render
// guards: UC-018; EDITS ARE PREPARED ON THE DASHBOARD
// given: an editor opened on "current\n" and never changed, and a confirmation that would decline
// input: editor.close()
// expect: it returns true, asks nothing, and the editor is removed
test("TST-603011 close of an editor never changed returns true without asking", async () => {
  await withConfirm([false], async (asked) => {
    const target = document.createElement("div");
    const editor = openEditor(target, "current\n", { marks: () => [], save: async () => ({ kind: "saved", link: "https://example.org/commit/1" }) });
    assert.equal(editorsIn(target), 1, "known positive: the search finds the editor while it is drawn");
    assert.equal(editor.close(), true);
    assert.deepEqual(asked, []);
    assert.equal(editorsIn(target), 0);
  });
});

// TST-672001 · level: unit · module: MOD-markdown-render
// guards: UC-018; EDITS ARE PREPARED ON THE DASHBOARD
// given: an editor opened on "current\n", and a confirmation that would decline and records what it is asked
// input: editor.unsaved() as opened; after the text is changed to "changed\n"; after it is changed back to "current\n"
// expect: false, true, false; the confirmation is asked nothing at any call, and the editor stays drawn throughout
test("TST-672001 unsaved says whether the text holds unsaved changes, without asking and without closing", async () => {
  await withConfirm([false], async (asked) => {
    const target = document.createElement("div");
    const editor = openEditor(target, "current\n", { marks: () => [], save: async () => ({ kind: "saved", link: "https://example.org/commit/1" }) });
    assert.equal(typeof editor.unsaved, "function", "the Editor says whether it holds unsaved changes");
    assert.equal(editor.unsaved(), false);
    type(areaIn(target), "changed\n");
    assert.equal(editor.unsaved(), true);
    type(areaIn(target), "current\n");
    assert.equal(editor.unsaved(), false);
    assert.deepEqual(asked, []);
    assert.equal(editorsIn(target), 1);
  });
});

// TST-672002 · level: unit · module: MOD-markdown-render
// guards: UC-018; EDITS ARE PREPARED ON THE DASHBOARD
// given: an editor opened on "current\n" whose text a person changed to "changed\n" and saved (the caller's save answers "saved"), and then changed to "changed again\n"
// input: editor.unsaved() after the save; after the further change; then editor.close() with a confirmation that declines
// expect: false after the save, true after the further change, and close() asks "Discard unsaved changes?" exactly when unsaved() is true (once here) and returns false
test("TST-672002 unsaved follows the last saved text, the same rule close asks by", async () => {
  await withConfirm([false], async (asked) => {
    const target = document.createElement("div");
    const editor = openEditor(target, "current\n", { marks: () => [], save: async () => ({ kind: "saved", link: "https://example.org/commit/1" }) });
    type(areaIn(target), "changed\n");
    assert.equal(editor.unsaved(), true);
    find(target, (node) => node.localName === "button")[0].dispatchEvent(new Event("click"));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(editor.unsaved(), false);
    type(areaIn(target), "changed again\n");
    assert.equal(editor.unsaved(), true);
    assert.equal(editor.close(), false);
    assert.deepEqual(asked, ["Discard unsaved changes?"]);
  });
});
