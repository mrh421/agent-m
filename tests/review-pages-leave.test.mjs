// MOD-review-pages' edit routes give the frame a `leave` that closes their editor (ITM-603), as docs/architecture/MOD-review-pages.md states it: "the editor with live preview
// and the descriptor's marks, whose unsaved changes the route's `leave` keeps by the editor's `close` (UC-018 7a)".
// Run: node --test tests/review-pages-leave.test.mjs
//
// Module: MOD-review-pages
// Guards: UC-018; EDITS ARE PREPARED ON THE DASHBOARD
// Level: unit
//
// The fixtures are tests/review-pages-draft-world.mjs' (a product behind a Host of the tests' own, the browser harness and a spy on `fetch` that refuses). Each test draws one
// route of the real review pages with the real MOD-markdown-render editor and the real MOD-site-frame, and calls the route's `leave` as the frame does. The confirmation of the
// editor is replaced for the length of a test by a function that records what it is asked and answers from a list, so no dialog of a browser is shown (the pattern of
// TST-343003). Each test states its input and its expected result in its own text; none reads an expected result from the SPEC, a use case or an architecture file.
// The readings the module file leaves open, which the pull request names:
//   - "the edit routes" are the three pages that open an editor: a reviewed file's `<k>/<id>/edit` (here the use case UC-007), a requirement's `requirement/<name>` and an open SPEC
//     entry's `spec-entry/<id>/edit`.
//   - A route's `leave` is the route's, not a page's: it asks the editor of the page drawn last, and a page drawn after it has no editor of an earlier page to ask.
//   - A route that has drawn no editor lets itself be left (`leave` answers true), so `leave` may be given by every route of the module.
// Nothing reaches the network (`fetch` is a spy that refuses). The counter-proofs (a planted fault in src/review-pages/ and the test's failing result) are recorded in the
// pull request.

import assert from "node:assert/strict";
import test from "node:test";
import { ENTRY_ID, LOAN, byClass, draw, fakeProduct, fetched, find } from "./review-pages-draft-world.mjs";

test.afterEach(() => { assert.deepEqual(fetched.splice(0), [], "no request left the fixtures"); });

const QUESTION = "Discard unsaved changes?";
const editorsIn = (target) => byClass(target, "div", "editor").length;
const areaOf = (target) => find(target, (node) => node.localName === "textarea" && !node.className.split(" ").includes("why"))[0];
const type = (target, text) => { areaOf(target).value = text; areaOf(target).dispatchEvent(new Event("input")); };

// The three pages that open an editor, each with the route and the parameters that reach it.
const SITES = [
  { site: "a reviewed file", route: "use-case", params: { id: "UC-007", edit: "1" } },
  { site: "a requirement", route: "requirement", params: { name: LOAN } },
  { site: "an open SPEC entry", route: "spec-entry", params: { id: ENTRY_ID, edit: "1" } },
];

// Runs `body` with a confirmation that records its questions in `asked` and answers them from `answers`.
async function withConfirm(answers, body) {
  const prior = Object.getOwnPropertyDescriptor(globalThis, "confirm");
  const asked = [];
  Object.defineProperty(globalThis, "confirm", { configurable: true, value: (message) => { asked.push(message); return answers.shift(); } });
  try { await body(asked); } finally { if (prior) Object.defineProperty(globalThis, "confirm", prior); else delete globalThis.confirm; }
}

for (const { site, route: name, params } of SITES) {
  // TST-603020 · level: unit · module: MOD-review-pages
  // guards: UC-018; EDITS ARE PREPARED ON THE DASHBOARD
  // given: the edit page of <site>, its editor's text changed to "changed text", and a confirmation that first declines, then accepts the discard
  // input: route.leave() twice
  // expect: leave is a function; the first call returns false, asks "Discard unsaved changes?" once, and the editor is still drawn with "changed text" in it; the second returns true, asks the same question a second time, and the editor is removed
  test(`TST-603020 ${site}: leave asks through the editor's close, keeps the editor when the discard is declined and closes it when it is accepted`, async () => {
    await withConfirm([false, true], async (asked) => {
      const { route, target } = await draw(fakeProduct(), name, params);
      assert.equal(typeof route.leave, "function", "the route gives the frame a leave");
      assert.equal(editorsIn(target), 1, "known positive: the search finds the editor while it is drawn");
      type(target, "changed text");
      assert.equal(route.leave(), false);
      assert.deepEqual(asked, [QUESTION]);
      assert.equal(editorsIn(target), 1);
      assert.equal(areaOf(target).value, "changed text");
      assert.equal(route.leave(), true);
      assert.deepEqual(asked, [QUESTION, QUESTION]);
      assert.equal(editorsIn(target), 0);
    });
  });

  // TST-603021 · level: unit · module: MOD-review-pages
  // guards: UC-018; EDITS ARE PREPARED ON THE DASHBOARD
  // given: the edit page of <site> with its editor never changed, and a confirmation that would decline
  // input: route.leave()
  // expect: it returns true and asks nothing
  test(`TST-603021 ${site}: leave of an editor never changed returns true without asking`, async () => {
    await withConfirm([false], async (asked) => {
      const { route, target } = await draw(fakeProduct(), name, params);
      assert.equal(editorsIn(target), 1, "known positive: the search finds the editor while it is drawn");
      assert.equal(route.leave(), true);
      assert.deepEqual(asked, []);
    });
  });
}

// TST-603022 · level: unit · module: MOD-review-pages
// guards: UC-018; EDITS ARE PREPARED ON THE DASHBOARD
// given: the list page of the use cases, which opens no editor, and a confirmation that would decline
// input: route.leave()
// expect: leave is a function; it returns true and asks nothing
test("TST-603022 a page of the route that opens no editor lets itself be left", async () => {
  await withConfirm([false], async (asked) => {
    const { route } = await draw(fakeProduct(), "use-case", {});
    assert.equal(typeof route.leave, "function", "the route gives the frame a leave");
    assert.equal(route.leave(), true);
    assert.deepEqual(asked, []);
  });
});

// TST-603023 · level: unit · module: MOD-review-pages
// guards: UC-018; EDITS ARE PREPARED ON THE DASHBOARD
// given: the edit page of the use case UC-007 with its editor's text changed to "changed text", and then the same route drawn again as the list page, in a target of its own, as the frame does after it was allowed to leave; a confirmation that would decline
// input: route.leave()
// expect: it returns true and asks nothing, for the editor of the page drawn before is not the page's now
test("TST-603023 the editor of a page drawn earlier is not asked once the route has drawn another page", async () => {
  await withConfirm([false], async (asked) => {
    const fake = fakeProduct();
    const first = await draw(fake, "use-case", { id: "UC-007", edit: "1" });
    assert.equal(editorsIn(first.target), 1, "known positive: the search finds the editor while it is drawn");
    type(first.target, "changed text");
    const second = document.createElement("div");
    document.body.append(second);
    await first.route.render(second, first.context, {});
    assert.equal(first.route.leave(), true);
    assert.deepEqual(asked, []);
  });
});

for (const { site, route: name, params } of SITES) {
  // TST-672020 · level: unit · module: MOD-review-pages
  // guards: UC-018; EDITS ARE PREPARED ON THE DASHBOARD
  // given: the edit page of <site> with its editor never changed, then its text changed to "changed text", and a confirmation that would decline and records what it is asked
  // input: route.unsaved() before the change, after it, and after route.leave() accepted the discard (the confirmation now accepts)
  // expect: unsaved is a function; false, true, then false once the editor is closed; the confirmation is asked nothing by the two first calls
  test(`TST-672020 ${site}: unsaved passes the editor's unsaved through without asking`, async () => {
    await withConfirm([false, true], async (asked) => {
      const { route, target } = await draw(fakeProduct(), name, params);
      assert.equal(typeof route.unsaved, "function", "the route tells the frame whether it holds unsaved changes");
      assert.equal(editorsIn(target), 1, "known positive: the search finds the editor while it is drawn");
      assert.equal(route.unsaved(), false);
      type(target, "changed text");
      assert.equal(route.unsaved(), true);
      assert.deepEqual(asked, []);
      assert.equal(route.leave(), false);
      assert.equal(route.leave(), true);
      assert.equal(route.unsaved(), false);
    });
  });
}

// TST-672021 · level: unit · module: MOD-review-pages
// guards: UC-018; EDITS ARE PREPARED ON THE DASHBOARD
// given: the list page of the use cases, which opens no editor
// input: route.unsaved()
// expect: unsaved is a function; it returns false
test("TST-672021 a page of the route that opens no editor holds no unsaved changes", async () => {
  const { route } = await draw(fakeProduct(), "use-case", {});
  assert.equal(typeof route.unsaved, "function", "the route tells the frame whether it holds unsaved changes");
  assert.equal(route.unsaved(), false);
});

