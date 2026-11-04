// MOD-site-frame's embedRoute (ITM-641), as docs/architecture/MOD-site-frame.md states it: "`embedRoute(name: string, target: Element, params: Record<string, string>) ->
// Promise<void>` — renders a route of another view loaded on the same page inside an element of the calling view, so one view can show another's part without using it.
// Error: `RouteNotLoaded` — the route is not on this page; the frame then puts a link to it in `target`."
// Run: node --test tests/site-frame-embed-route.test.mjs
//
// Module: MOD-site-frame
// Guards: UC-013
// Level: unit
//
// The page is the small fixture DOM of tests/site-frame-start.d/dom.mjs, with a fixture location whose hash a test sets. Each test states its input and its expected result in
// its own text; none reads an expected result from the SPEC, a use case or an architecture file. The readings the module file leaves open, which the pull request names:
//   - "a route of another view loaded on the same page" is a route of a view passed to the startPage that started the page, found by its `name`; the page is the last one started.
//   - "renders a route … inside an element of the calling view" is that the route's `render` is called with that element, the `params` given, and the ViewContext of the route
//     shown on the page now: the calling route's own context, so the embedded route sees the same product, store and `go`.
//   - "Error: `RouteNotLoaded`" is that the returned promise rejects with an Error whose `name` is "RouteNotLoaded", after the link stands in `target`; a failure of the
//     embedded route's own `render` rejects as it is, with no link.
//   - "a link to it" is one <a> in `target`, replacing what `target` held, whose href is the route's address as the frame writes it for `go` — fragmentOf(name, params),
//     with the shown product's address as the parameter `product` — and, on the main page, whose review pages stand at docs/index.html, that address after "docs/index.html";
//     its text is "Open " and the route's name.
//   - Before any page is started, no route is loaded.
// Nothing reaches the network: the page is given an offline fetch (tests/site-frame-start.d/dom.mjs), whose refused requests are in `outside.seen` (the page's own read of the
// instance among them), and a clock that runs nothing; a request that gets past it is in `outside.reached`, which every test finds empty. The counter-proofs (a planted fault in src/site-frame/ and the test's failing result) are recorded in the pull request.

import assert from "node:assert/strict";
import test from "node:test";
import { all, installPage, offline, outside } from "./site-frame-start.d/dom.mjs";
import { openStore, writeSetting } from "../src/browser-store/index.mjs";

const { startPage, embedRoute } = await import("../src/site-frame/index.mjs");

const PAGE = { hostname: "acme.github.io", pathname: "/instance/docs/index.html" };
const WIDGET = "https://github.com/acme/widget";

// What the fixture routes saw: `drawn` the names of the routes rendered in order, `contexts` and `params` by route name, `caught` the names of the errors the host caught,
// `finished` whether the host's render ran to its end, `inner` the element the host embedded into.
const seen = { drawn: [], contexts: {}, params: {}, caught: [], finished: false, inner: null };

// The routes of the fixture view: `host` embeds the route named by `embedding` (name and params) into an element of its own and goes on after a failure; `part` renders a text
// that names its parameters; `broken` fails with an error named Boom.
function view(embedding) {
  return { strategies: [], routes: [
    { name: "host", entry: "tests", title: "host", async render(target, context, params) {
      seen.drawn.push("host");
      seen.contexts.host = context;
      seen.params.host = params;
      const inner = document.createElement("div");
      target.append(inner);
      seen.inner = inner;
      try {
        await embedRoute(embedding.name, inner, embedding.params);
      } catch (failure) {
        seen.caught.push(failure.name);
      }
      seen.finished = true;
    } },
    { name: "part", entry: "releases", title: "part", async render(target, context, params) {
      seen.drawn.push("part");
      seen.contexts.part = context;
      seen.params.part = params;
      target.textContent = `part ${params.key} ${params.tag}`;
    } },
    { name: "broken", entry: null, title: "broken", async render() {
      seen.drawn.push("broken");
      throw Object.assign(new Error("the audit could not be read"), { name: "Boom" });
    } },
  ] };
}

// Starts a page on a fresh fixture, at the given fragment.
async function start({ page = "review", fragment = "#host", embedding, products = [] }) {
  Object.assign(seen, { drawn: [], contexts: {}, params: {}, caught: [], finished: false, inner: null });
  const fixture = installPage({ ...PAGE, hash: fragment });
  offline();
  globalThis.setInterval = () => 1;
  const store = openStore("acme/instance");
  if (products.length) writeSetting(store, "products", products);
  await startPage({ page, views: [view(embedding)] });
  return { ...fixture, main: all(fixture.document.body, "main")[0] };
}

test.afterEach(() => { assert.deepEqual(outside.reached, [], "no request left the fixture"); });

// TST-641001 · level: unit · module: MOD-site-frame
// guards: UC-013
// given: a fixture document on which no page has been started, and an empty element
// input: embedRoute("part", element, { key: "audit" })
// expect: the promise rejects with an error named RouteNotLoaded; the element holds exactly one <a>, whose href is "#part/key=audit" and whose text is "Open part"
test("TST-641001 before any page is started, no route is loaded, and the link to it stands in the element", async () => {
  installPage({ ...PAGE });
  const element = document.createElement("div");
  await assert.rejects(embedRoute("part", element, { key: "audit" }), (failure) => failure.name === "RouteNotLoaded");
  const links = all(element, "a");
  assert.equal(links.length, 1);
  assert.equal(links[0].getAttribute("href"), "#part/key=audit");
  assert.equal(links[0].textContent, "Open part");
});

// TST-641002 · level: unit · module: MOD-site-frame
// guards: UC-013
// given: the review page at #host, whose route `host` embeds the route `part` into an element of its own with { key: "audit", tag: "v1" }
// input: the page starts
// expect: `part` is rendered once, after `host`, into that element, with the params { key: "audit", tag: "v1" }; the route area reads "part audit v1"; the hash is still "#host"; `part` is given the very context `host` was given; the host's embedding did not fail and its render ran to its end
test("TST-641002 on the review page, the route of another view is rendered into the element of the calling route", async () => {
  const page = await start({ embedding: { name: "part", params: { key: "audit", tag: "v1" } } });
  assert.deepEqual(seen.drawn, ["host", "part"]);
  assert.deepEqual(seen.params.part, { key: "audit", tag: "v1" });
  assert.equal(seen.inner.textContent, "part audit v1");
  assert.equal(page.main.textContent, "part audit v1");
  assert.equal(page.location.hash, "#host");
  assert.equal(seen.contexts.part === seen.contexts.host, true);
  assert.deepEqual(seen.caught, []);
  assert.equal(seen.finished, true);
});

// TST-641003 · level: unit · module: MOD-site-frame
// guards: UC-013
// given: the review page at #host, whose route `host` embeds the route `missing`, which no view of the page serves, with { key: "audit" } and catches what it is thrown
// input: the page starts
// expect: the host caught one error, named RouteNotLoaded; its element holds exactly one <a>, whose href is "#missing/key=audit" and whose text is "Open missing"; only `host` was rendered; the host's render ran to its end
test("TST-641003 on the review page, a route no view serves gives RouteNotLoaded and a link in the element", async () => {
  await start({ embedding: { name: "missing", params: { key: "audit" } } });
  assert.deepEqual(seen.caught, ["RouteNotLoaded"]);
  const links = all(seen.inner, "a");
  assert.equal(links.length, 1);
  assert.equal(links[0].getAttribute("href"), "#missing/key=audit");
  assert.equal(links[0].textContent, "Open missing");
  assert.deepEqual(seen.drawn, ["host"]);
  assert.equal(seen.finished, true);
});

// TST-641004 · level: unit · module: MOD-site-frame
// guards: UC-013
// given: the review page at #host/product=<https://github.com/acme/widget> in a browser that keeps that product, whose route `host` embeds first `part`, then `missing`
// input: the page starts
// expect: `part` is given the context of the product https://github.com/acme/widget; the link to `missing` has the href "#missing/key=audit/product=https%3A%2F%2Fgithub.com%2Facme%2Fwidget"
test("TST-641004 with a product shown, the embedded route sees the product and the link keeps it", async () => {
  const fragment = `#host/product=${encodeURIComponent(WIDGET)}`;
  await start({ fragment, products: [WIDGET], embedding: { name: "part", params: { key: "audit", tag: "v1" } } });
  assert.equal(seen.contexts.part.product.address, WIDGET);
  await start({ fragment, products: [WIDGET], embedding: { name: "missing", params: { key: "audit" } } });
  assert.equal(all(seen.inner, "a")[0].getAttribute("href"), "#missing/key=audit/product=https%3A%2F%2Fgithub.com%2Facme%2Fwidget");
});

// TST-641005 · level: unit · module: MOD-site-frame
// guards: UC-013
// given: the main page at #host, whose route `host` embeds the route `missing`, which no view of the page serves, with { key: "audit" }
// input: the page starts
// expect: the host caught one error, named RouteNotLoaded; its element holds exactly one <a>, whose href is "docs/index.html#missing/key=audit"
test("TST-641005 on the main page, the link to a route no view serves leads into the review pages", async () => {
  await start({ page: "main", embedding: { name: "missing", params: { key: "audit" } } });
  assert.deepEqual(seen.caught, ["RouteNotLoaded"]);
  const links = all(seen.inner, "a");
  assert.equal(links.length, 1);
  assert.equal(links[0].getAttribute("href"), "docs/index.html#missing/key=audit");
});

// TST-641006 · level: unit · module: MOD-site-frame
// guards: UC-013
// given: the Bridge's page at #host, whose route `host` embeds the route `part` with { key: "audit", tag: "v1" }
// input: the page starts
// expect: `part` is rendered once, after `host`, with the context of the page "bridge", and its element reads "part audit v1"
test("TST-641006 in the Bridge's window, the route of another view is rendered into the element of the calling route", async () => {
  await start({ page: "bridge", embedding: { name: "part", params: { key: "audit", tag: "v1" } } });
  assert.deepEqual(seen.drawn, ["host", "part"]);
  assert.equal(seen.contexts.part.page, "bridge");
  assert.equal(seen.inner.textContent, "part audit v1");
  assert.deepEqual(seen.caught, []);
});

// TST-641007 · level: unit · module: MOD-site-frame
// guards: UC-013
// given: the review page at #host, whose route `host` embeds the route `broken`, a loaded route whose render fails with an error named Boom
// input: the page starts
// expect: the host caught one error, named Boom, not RouteNotLoaded; its element holds no <a>
test("TST-641007 a failure of the embedded route's own render is passed on as it is, with no link", async () => {
  await start({ embedding: { name: "broken", params: {} } });
  assert.deepEqual(seen.caught, ["Boom"]);
  assert.equal(all(seen.inner, "a").length, 0);
});
