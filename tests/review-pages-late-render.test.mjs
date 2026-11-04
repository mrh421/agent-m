// A late render does not replace a newer editor (ITM-673) — MOD-review-pages: "the editor with live preview and the descriptor's marks, whose unsaved changes the route's `leave` keeps by the
// editor's `close` (UC-018 7a)", and ITM-603's reading that `leave` asks the editor of the page drawn last. An edit page's render reads before it draws; when a render started earlier ends
// after a newer one, its editor must not become the route's, or `leave` would ask an editor that is no longer shown.
// Run: node --test tests/review-pages-late-render.test.mjs
//
// Module: MOD-review-pages
// Guards: UC-018; EDITS ARE PREPARED ON THE DASHBOARD
// Level: unit
//
// The fixtures are tests/review-pages-draft-world.mjs' (a product behind a Host of the tests' own, the browser harness and a spy on `fetch` that refuses). The Host's first readSnapshot is held
// until the test lets it go, so that the render which asked it ends after the render started next. The confirmation of the editor is replaced, as tests/review-pages-leave.test.mjs does, by a
// function that records its questions. Readings the module file leaves open, which the pull request names: "the page drawn last" is the page of the render that started last, whichever
// ends last; and a render that started earlier and ends later draws into its own target, which the frame has replaced, and makes nothing of it the route's. Each test states its input and its
// expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import assert from "node:assert/strict";
import test from "node:test";
import { ENTRY_ID, LOAN, byClass, contextOf, fakeProduct, fetched, find, routeNamed } from "./review-pages-draft-world.mjs";

test.afterEach(() => { assert.deepEqual(fetched.splice(0), [], "no request left the fixtures"); });

const QUESTION = "Discard unsaved changes?";
const areaOf = (target) => find(target, (node) => node.localName === "textarea" && !node.className.split(" ").includes("why"))[0];
const editorsIn = (target) => byClass(target, "div", "editor").length;
const type = (target, text) => { areaOf(target).value = text; areaOf(target).dispatchEvent(new Event("input")); };
const turns = async (count = 10) => { for (let at = 0; at < count; at += 1) await new Promise((resolve) => setImmediate(resolve)); };

const SITES = [
  { site: "a reviewed file", route: "use-case", params: { id: "UC-007", edit: "1" } },
  { site: "a requirement", route: "requirement", params: { name: LOAN } },
  { site: "an open SPEC entry", route: "spec-entry", params: { id: ENTRY_ID, edit: "1" } },
];

async function withConfirm(answers, body) {
  const prior = Object.getOwnPropertyDescriptor(globalThis, "confirm");
  const asked = [];
  Object.defineProperty(globalThis, "confirm", { configurable: true, value: (message) => { asked.push(message); return answers.shift(); } });
  try { await body(asked); } finally { if (prior) Object.defineProperty(globalThis, "confirm", prior); else delete globalThis.confirm; }
}

// Two renders of one route, the first ending last: the first render's first read is held; the second render starts, ends and is drawn; then the first is let go and ends.
// -> { route, first, second, targets } once both have ended.
async function twoRenders({ route: name, params }, { released = true } = {}) {
  const fake = fakeProduct();
  const context = contextOf(fake);
  const realRead = context.product.host.readSnapshot.bind(context.product.host);
  let hold = null, release = null, held = false;
  context.product.host = { ...context.product.host, async readSnapshot(ref) {
    if (!held) { held = true; hold = new Promise((resolve) => { release = resolve; }); await hold; }
    return realRead(ref);
  } };
  const route = routeNamed(name);
  const firstTarget = document.createElement("div"), secondTarget = document.createElement("div");
  document.body.append(firstTarget, secondTarget);
  const first = route.render(firstTarget, context, params);
  await turns();
  assert.equal(held, true, "known positive: the first render waits for its read");
  const second = route.render(secondTarget, context, params);
  await second;
  assert.equal(editorsIn(secondTarget), 1, "known positive: the newer render has drawn its editor");
  if (released) { release(); await first; }
  return { route, firstTarget, secondTarget, release, first };
}

for (const site of SITES) {
  // TST-067301 · level: unit · module: MOD-review-pages
  // guards: UC-018; EDITS ARE PREPARED ON THE DASHBOARD
  // given: the edit page of <site> rendered twice, the first render ending after the second; the second render's editor changed to "newer text", and a confirmation that declines
  // input: route.leave() after both renders have ended
  // expect: it asks the newer editor: it returns false and asks "Discard unsaved changes?" once, for the newer editor holds unsaved changes (the late render's editor never changed); the newer editor is still drawn with "newer text" in it
  test(`TST-067301 ${site.site}: two renders, the first ending last, leave the newer editor as the one leave asks`, async () => {
    await withConfirm([false], async (asked) => {
      const { route, firstTarget, secondTarget } = await twoRenders(site);
      assert.equal(editorsIn(firstTarget), 1, "known positive: the late render drew an editor of its own");
      type(secondTarget, "newer text");
      assert.equal(route.leave(), false);
      assert.deepEqual(asked, [QUESTION]);
      assert.equal(areaOf(secondTarget).value, "newer text");
    });
  });

  // TST-067302 · level: unit · module: MOD-review-pages
  // guards: UC-018; EDITS ARE PREPARED ON THE DASHBOARD
  // given: the same two renders, the first ending last, and then the late render's editor changed instead and the newer one left as it was
  // input: route.leave() and route.unsaved()
  // expect: counter-proof — the late render's editor is not the route's: unsaved is false, and leave returns true and asks nothing
  test(`TST-067302 ${site.site}: the editor of the late render is not the route's`, async () => {
    await withConfirm([false], async (asked) => {
      const { route, firstTarget } = await twoRenders(site);
      type(firstTarget, "late text");
      assert.equal(route.unsaved(), false);
      assert.equal(route.leave(), true);
      assert.deepEqual(asked, []);
    });
  });

  // TST-067303 · level: unit · module: MOD-review-pages
  // guards: UC-018; EDITS ARE PREPARED ON THE DASHBOARD
  // given: the edit page of <site> rendered once, with no second render, its editor changed, and a confirmation that declines
  // input: route.leave()
  // expect: known positive of the guard — a render that is the last one still makes its editor the route's: leave returns false and asks once
  test(`TST-067303 ${site.site}: a render that is the last one makes its editor the route's`, async () => {
    await withConfirm([false], async (asked) => {
      const route = routeNamed(site.route);
      const context = contextOf(fakeProduct());
      const target = document.createElement("div");
      document.body.append(target);
      await route.render(target, context, site.params);
      type(target, "text");
      assert.equal(route.leave(), false);
      assert.deepEqual(asked, [QUESTION]);
    });
  });
}
