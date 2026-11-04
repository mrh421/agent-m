// MOD-site-frame asks the route shown before it shows another (ITM-603), as docs/architecture/MOD-site-frame.md states it: "`Route` — `{ …, leave?: () -> boolean }`. Before the
// frame shows another route on a change of the address, it asks the route shown with `leave`; `false` keeps that route and puts its address back."
// Run: node --test tests/site-frame-leave.test.mjs
//
// Module: MOD-site-frame
// Guards: UC-018; EDITS ARE PREPARED ON THE DASHBOARD
// Level: unit
//
// The page is the small fixture DOM of tests/site-frame-start.d/dom.mjs, with a fixture location whose hash a test sets and a window on which the test fires `hashchange`, as a
// browser does. Each test states its input and its expected result in its own text; none reads an expected result from the SPEC, a use case or an architecture file.
// The readings the module file leaves open, which the pull request names:
//   - "the route shown" is the route that rendered last, whatever its parameters; the change of the address that shows it again with other parameters asks it too.
//   - "puts its address back" is the location's hash set to the fragment the route shown was rendered for. The browser then announces that hash as a change of its own: the
//     frame neither asks the route again nor renders it again for that announcement, and asks again on the next change a person makes.
//   - "`false` keeps that route" is that the frame renders nothing: the route's drawing is left as it is. Only the value `false` keeps the route.
//   - A route that gives no `leave` is not asked, as every route did before.
// Nothing reaches the network: the page is given an offline fetch (tests/site-frame-start.d/dom.mjs), whose refused requests are in `outside.seen`, and a clock that runs nothing. The counter-proofs (a planted fault in
// src/site-frame/ and the test's failing result) are recorded in the pull request.

import assert from "node:assert/strict";
import test from "node:test";
import { all, changeFragment, installPage, offline, outside } from "./site-frame-start.d/dom.mjs";
import { openStore } from "../src/browser-store/index.mjs";

const { startPage } = await import("../src/site-frame/index.mjs");

const PAGE = { hostname: "acme.github.io", pathname: "/instance/docs/index.html" };
const settle = () => new Promise((resolve) => setImmediate(resolve));

// The routes of the fixture view: `editing` answers each ask with the next answer of `answers` and records the ask; `other` gives no `leave`.
const rendered = [];
const asked = [];
function routes(answers) {
  const next = [...answers];
  return [
    { name: "editing", entry: "requirements", title: "editing", async render(target) { rendered.push("editing"); target.textContent = "editing"; },
      leave() { asked.push("editing"); return next.shift(); } },
    { name: "other", entry: "tests", title: "other", async render(target) { rendered.push("other"); target.textContent = "other"; } },
  ];
}

// Starts a page on a fresh fixture, at the fragment #editing.
async function start(page, answers) {
  rendered.length = 0;
  asked.length = 0;
  const fixture = installPage({ ...PAGE, hash: "#editing" });
  offline();
  globalThis.setInterval = () => 1;
  openStore("acme/instance");
  await startPage({ page, views: [{ routes: routes(answers), strategies: [] }], menuViews: [] });
  return { ...fixture, target: all(fixture.document.body, "main")[0] };
}

test.afterEach(() => { assert.deepEqual(outside.reached, [], "no request left the fixture"); });

// TST-603001 · level: unit · module: MOD-site-frame
// guards: UC-018; EDITS ARE PREPARED ON THE DASHBOARD
// given: the review page at #editing, whose route `editing` answers its leave with false, and the route `other`
// input: the fragment changes to #other
// expect: `editing` is asked once; the location's hash is "#editing" again; the route area still reads "editing"; only `editing` has been rendered
test("TST-603001 on the review page, a route that answers leave with false stays, and its address is put back", async () => {
  const page = await start("review", [false]);
  changeFragment(page, "#other");
  await settle();
  assert.deepEqual(asked, ["editing"]);
  assert.equal(page.location.hash, "#editing");
  assert.equal(page.target.textContent, "editing");
  assert.deepEqual(rendered, ["editing"]);
});

// TST-603002 · level: unit · module: MOD-site-frame
// guards: UC-018; EDITS ARE PREPARED ON THE DASHBOARD
// given: the review page at #editing, whose route `editing` answers its leave with true, and the route `other`, which gives no leave
// input: the fragment changes to #other, then back to #editing
// expect: after the first change `editing` has been asked once and the route area reads "other" at the hash "#other"; after the second change the route area reads "editing" and `editing` has still been asked once, since it was not the route shown; the routes rendered are, in this order, editing, other, editing
test("TST-603002 on the review page, a route that answers leave with true is left, and only the route shown is asked", async () => {
  const page = await start("review", [true]);
  changeFragment(page, "#other");
  await settle();
  assert.deepEqual(asked, ["editing"]);
  assert.equal(page.location.hash, "#other");
  assert.equal(page.target.textContent, "other");
  changeFragment(page, "#editing");
  await settle();
  assert.deepEqual(asked, ["editing"]);
  assert.equal(page.target.textContent, "editing");
  assert.deepEqual(rendered, ["editing", "other", "editing"]);
});

// TST-603003 · level: unit · module: MOD-site-frame
// guards: UC-018; EDITS ARE PREPARED ON THE DASHBOARD
// given: the review page at #editing, whose route `editing` answers its first leave with false and its second with true
// input: the fragment changes to #other; then the window announces the hash that the frame put back (the browser's own announcement); then the fragment changes to #other again
// expect: after the announcement `editing` has still been asked once, the hash is "#editing" and `editing` has been rendered once; after the second change `editing` has been asked twice, and the route area reads "other" at the hash "#other"
test("TST-603003 the announcement of the address put back asks and renders nothing, and the next change is asked again", async () => {
  const page = await start("review", [false, true]);
  changeFragment(page, "#other");
  await settle();
  page.window.dispatchEvent(new Event("hashchange"));
  await settle();
  assert.deepEqual(asked, ["editing"]);
  assert.equal(page.location.hash, "#editing");
  assert.deepEqual(rendered, ["editing"]);
  changeFragment(page, "#other");
  await settle();
  assert.deepEqual(asked, ["editing", "editing"]);
  assert.equal(page.location.hash, "#other");
  assert.equal(page.target.textContent, "other");
});

// TST-603004 · level: unit · module: MOD-site-frame
// guards: UC-018; EDITS ARE PREPARED ON THE DASHBOARD
// given: the Bridge's page at #editing, whose route `editing` answers its leave with false, and the route `other`
// input: the fragment changes to #other
// expect: `editing` is asked once; the location's hash is "#editing" again; the route area still reads "editing"; only `editing` has been rendered
test("TST-603004 in the Bridge's window, a route that answers leave with false stays, and its address is put back", async () => {
  const page = await start("bridge", [false]);
  changeFragment(page, "#other");
  await settle();
  assert.deepEqual(asked, ["editing"]);
  assert.equal(page.location.hash, "#editing");
  assert.equal(page.target.textContent, "editing");
  assert.deepEqual(rendered, ["editing"]);
});

// TST-603005 · level: unit · module: MOD-site-frame
// guards: UC-018; EDITS ARE PREPARED ON THE DASHBOARD
// given: the Bridge's page at #editing, whose route `editing` answers its leave with true, and the route `other`
// input: the fragment changes to #other
// expect: `editing` is asked once; the location's hash is "#other"; the route area reads "other"; the routes rendered are, in this order, editing, other
test("TST-603005 in the Bridge's window, a route that answers leave with true is left", async () => {
  const page = await start("bridge", [true]);
  changeFragment(page, "#other");
  await settle();
  assert.deepEqual(asked, ["editing"]);
  assert.equal(page.location.hash, "#other");
  assert.equal(page.target.textContent, "other");
  assert.deepEqual(rendered, ["editing", "other"]);
});

// The page at #editing, whose route `editing` reports `unsaved` from `state.unsaved` (and asks nothing of a person), and the route `other`, which gives no `unsaved`.
async function startUnsaved(page, state) {
  rendered.length = 0;
  asked.length = 0;
  const fixture = installPage({ ...PAGE, hash: "#editing" });
  offline();
  globalThis.setInterval = () => 1;
  openStore("acme/instance");
  const views = [{ routes: [
    { name: "editing", entry: "requirements", title: "editing", async render(target) { rendered.push("editing"); target.textContent = "editing"; }, unsaved: () => state.unsaved },
    { name: "other", entry: "tests", title: "other", async render(target) { rendered.push("other"); target.textContent = "other"; } },
  ], strategies: [] }];
  await startPage({ page, views, menuViews: [] });
  return { ...fixture, target: all(fixture.document.body, "main")[0] };
}
// The tab closes or reloads: the window announces `beforeunload`, a cancelable event; -> the event, to read whether the page cancelled it.
const closing = (page) => {
  const event = new Event("beforeunload", { cancelable: true });
  page.window.dispatchEvent(event);
  return event;
};

for (const kind of ["main", "review"]) {
  // TST-672010 · level: unit · module: MOD-site-frame
  // guards: UC-018; EDITS ARE PREPARED ON THE DASHBOARD
  // given: the <kind> page at #editing, whose route `editing` reports unsaved changes (unsaved() true)
  // input: the window announces beforeunload, as the tab closes or reloads; then the route reports no unsaved changes and the window announces it again
  // expect: the first beforeunload is cancelled (the browser asks first); the second is not; the route is asked nothing by leave in either case, and nothing else is rendered
  test(`TST-672010 on the ${kind} page, closing the tab while the route shown holds unsaved changes makes the browser ask`, async () => {
    const state = { unsaved: true };
    const page = await startUnsaved(kind, state);
    assert.equal(closing(page).defaultPrevented, true);
    state.unsaved = false;
    assert.equal(closing(page).defaultPrevented, false);
    assert.deepEqual(asked, []);
    assert.deepEqual(rendered, ["editing"]);
  });
}

// TST-672011 · level: unit · module: MOD-site-frame
// guards: UC-018; EDITS ARE PREPARED ON THE DASHBOARD
// given: the review page at #editing, whose route `editing` reports unsaved changes, and the route `other`, which gives no `unsaved`
// input: the fragment changes to #other (the route `editing` gives no leave, so it is left); then the window announces beforeunload
// expect: the beforeunload is not cancelled, for the route shown is `other`, which holds no unsaved changes (a route that gives none holds none)
test("TST-672011 the route shown is the one asked: a route that gives no unsaved holds none", async () => {
  const state = { unsaved: true };
  const page = await startUnsaved("review", state);
  changeFragment(page, "#other");
  await settle();
  assert.equal(page.target.textContent, "other");
  assert.equal(closing(page).defaultPrevented, false);
});
