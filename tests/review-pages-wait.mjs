// The wait of the tests of MOD-review-pages for what a click on a page comes to. Imported by every test file of the review pages that waits
// for a page; it holds no test and no expected result.
//
// Module: MOD-review-pages
// Level: unit
//
// `until(page, condition, what)` ends when `condition()` holds. It fails by name when the page shows what the click came to without the
// condition: a paragraph of the class `result` that holds text, which the flow writes after every decision, a commit or a refusal, with the
// page drawn again before it (src/review-pages/flow.mjs, `redraw`), and which an editor fills when a save is answered
// (src/markdown-render/editor.mjs; the editor holds it empty until then, so an empty one says nothing). A paragraph that already held its text
// when the wait began answers an earlier click — the refusal a second Save follows — and counts only once its text changes. A click awaits
// work node does off the event loop (crypto.subtle.digest, through MOD-text-tools' blobSha), so no count of event-loop turns bounds it: the
// condition is checked every millisecond, and the deadline only names a page that never settles. Nothing reaches the network.

import assert from "node:assert/strict";

export const SETTLES_WITHIN_MS = 10_000;

// Each paragraph of the class `result` under `root` that holds text, with that text.
const results = (root) => {
  const said = [];
  (function walk(node) {
    for (const kid of node.childNodes) {
      if (kid.nodeType !== 1) continue;
      if (kid.localName === "p" && String(kid.className).split(" ").includes("result") && kid.textContent.trim()) said.push({ node: kid, text: kid.textContent });
      walk(kid);
    }
  })(root);
  return said;
};

export async function until(page, condition, what) {
  const deadline = Date.now() + SETTLES_WITHIN_MS;
  const before = new Map(results(page).map(({ node, text }) => [node, text]));
  while (!condition()) {
    const said = results(page).filter(({ node, text }) => before.get(node) !== text).map(({ text }) => text);
    if (said.length) assert.fail(`waited for ${what}; the page settled with: ${said.join(" ")}`);
    if (Date.now() > deadline) assert.fail(`waited for ${what}; neither it nor the page's result came within ${SETTLES_WITHIN_MS} ms`);
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
}
